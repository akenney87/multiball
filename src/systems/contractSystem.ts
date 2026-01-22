/**
 * Contract System (FM-Style)
 *
 * Football Manager-inspired contract negotiation system:
 * - Player market value calculation
 * - Agent fee handling
 * - Multi-round negotiations with counter-offers
 * - Contract clauses (playing time, bonuses, etc.)
 * - Squad role promises
 * - Performance bonuses
 * - Release clauses
 * - Yearly wage increases
 */

import type {
  Contract,
  ContractOffer,
  ContractNegotiation,
  ContractDemands,
  ContractClause,
  ContractClauseType,
  PerformanceBonuses,
  SquadRole,
  NegotiationStrategy,
  NegotiationRound,
  NegotiationOutcome,
  Player,
} from '../data/types';
import { getExpectedRole } from './roleExpectationSystem';
import { calculateAllOveralls } from '../utils/overallRating';
// Import the EXACT same overall calculation that the UI uses
import { calculatePlayerOverall } from '../ui/integration/gameInitializer';

// =============================================================================
// CONSTANTS
// =============================================================================

// Contract length limits
export const MIN_CONTRACT_LENGTH = 1;
export const MAX_CONTRACT_LENGTH = 5;

// Salary calculation
export const SALARY_PERCENTAGE = 0.25; // Salary = 25% of market value

// Agent fees (agents don't work for free!)
export const MIN_AGENT_FEE_PCT = 0.08; // 8% minimum - agents won't accept less
export const MAX_AGENT_FEE_PCT = 0.12; // 12% maximum
export const DEFAULT_AGENT_FEE_PCT = 0.10; // 10% default
export const ABSOLUTE_MIN_AGENT_FEE_PCT = 0.05; // 5% absolute floor - agents NEVER work for free

// Age multipliers for valuation
// Young high-potential players are MORE valuable (longer careers, upside)
export const AGE_MULTIPLIERS = {
  young: 2.0,    // Age < 23 - premium for youth
  prime: 1.8,    // Age 23-28 - peak performance
  veteran: 1.2,  // Age 29-32 - declining value
  aging: 0.7,    // Age >= 33 - limited years left
};

// Multi-sport bonus
export const MULTI_SPORT_BONUS = 0.2; // +20% per sport above 50 rating

// Negotiation limits
export const DEFAULT_MAX_ROUNDS = 5;
export const NEGOTIATION_DEADLINE_WEEKS = 2;

// Strategy flexibility modifiers
export const STRATEGY_FLEXIBILITY = {
  aggressive: 0.05,   // Very rigid
  moderate: 0.15,     // Normal flexibility
  passive: 0.25,      // Quite flexible
  desperate: 0.40,    // Very flexible
};

// Squad role expectations (minutes per game)
export const SQUAD_ROLE_MINUTES = {
  star_player: 32,
  important_player: 26,
  rotation_player: 20,
  squad_player: 12,
  youth_prospect: 8,
  backup: 4,
};

// =============================================================================
// MARKET VALUE CALCULATION
// =============================================================================

/**
 * Calculates a player's market value
 * Uses tiered exponential scaling - higher rated players are disproportionately more valuable
 */
export function calculateMarketValue(
  overallRating: number,
  age: number,
  averagePotential: number,
  sportsAbove50: number
): number {
  // Tiered base value - dramatically increases with rating
  // This creates realistic salary gaps between rating tiers
  let baseValue: number;
  if (overallRating < 40) {
    // Below replacement level
    baseValue = 50000 + Math.max(0, overallRating - 20) * 2500; // $50k-$100k
  } else if (overallRating < 50) {
    // Poor players
    baseValue = 100000 + (overallRating - 40) * 15000; // $100k-$250k
  } else if (overallRating < 60) {
    // Below average
    baseValue = 250000 + (overallRating - 50) * 45000; // $250k-$700k
  } else if (overallRating < 70) {
    // Average to good
    baseValue = 700000 + (overallRating - 60) * 130000; // $700k-$2M
  } else if (overallRating < 80) {
    // Good to great
    baseValue = 2000000 + (overallRating - 70) * 300000; // $2M-$5M
  } else if (overallRating < 90) {
    // Elite
    baseValue = 5000000 + (overallRating - 80) * 700000; // $5M-$12M
  } else {
    // Superstar
    baseValue = 12000000 + (overallRating - 90) * 1500000; // $12M+
  }

  // Age multiplier - young players with upside are MORE valuable
  let ageMultiplier: number;
  if (age < 23) {
    ageMultiplier = AGE_MULTIPLIERS.young;
  } else if (age < 29) {
    ageMultiplier = AGE_MULTIPLIERS.prime;
  } else if (age < 33) {
    ageMultiplier = AGE_MULTIPLIERS.veteran;
  } else {
    ageMultiplier = AGE_MULTIPLIERS.aging;
  }

  // Potential modifier - high potential players cost more
  // Cap the bonus at 50% to prevent runaway values
  const potentialGap = Math.max(0, averagePotential - overallRating);
  const potentialModifier = 1.0 + Math.min(0.5, potentialGap / 50);

  // Multi-sport bonus
  const multiSportBonus = 1.0 + (sportsAbove50 - 1) * MULTI_SPORT_BONUS;

  const marketValue = baseValue * ageMultiplier * potentialModifier * Math.max(1.0, multiSportBonus);
  return Math.round(marketValue);
}

/**
 * Calculate performance multiplier based on awards and career stats
 * Must match the UI's calculatePerformanceMultiplier in ConnectedTransferMarketScreen.tsx
 */
function calculatePerformanceMultiplier(player: Player): number {
  let multiplier = 1.0;

  const awards = player.awards;
  if (awards) {
    // Sum up weekly awards across all sports
    const weeklyTotal = awards.playerOfTheWeek.basketball +
                        awards.playerOfTheWeek.baseball +
                        awards.playerOfTheWeek.soccer;
    // Sum up monthly awards across all sports
    const monthlyTotal = awards.playerOfTheMonth.basketball +
                         awards.playerOfTheMonth.baseball +
                         awards.playerOfTheMonth.soccer;

    multiplier += weeklyTotal * 0.05;                         // +5% per weekly award
    multiplier += monthlyTotal * 0.15;                        // +15% per monthly award
    multiplier += awards.basketballPlayerOfTheYear * 0.50;    // +50% per Basketball POY
    multiplier += awards.baseballPlayerOfTheYear * 0.50;      // +50% per Baseball POY
    multiplier += awards.soccerPlayerOfTheYear * 0.50;        // +50% per Soccer POY
    multiplier += awards.rookieOfTheYear * 0.30;              // +30% for ROY
    multiplier += awards.championships * 0.35;                // +35% per championship
  }

  const gamesPlayed = player.careerStats?.gamesPlayed || { basketball: 0, baseball: 0, soccer: 0 };
  const totalGames = gamesPlayed.basketball + gamesPlayed.baseball + gamesPlayed.soccer;
  if (totalGames >= 100) {
    multiplier += 0.30;
  } else if (totalGames >= 50) {
    multiplier += 0.15;
  } else if (totalGames >= 20) {
    multiplier += 0.05;
  }

  return Math.min(3.0, multiplier);
}

/**
 * Calculates market value from a Player object
 * Uses the EXACT same logic as ConnectedPlayerDetailScreen.tsx to ensure consistency
 */
export function calculatePlayerMarketValue(player: Player, debug = false): number {
  const attrs = player.attributes;
  if (!attrs) return 5000; // Minimum market value

  // Free agents show $0 market value
  if (player.teamId === 'free_agent') return 0;

  // Use the EXACT same overall calculation as the UI
  const overall = calculatePlayerOverall(player);

  // Calculate performance multiplier (awards + career games)
  const perfMultiplier = calculatePerformanceMultiplier(player);

  if (debug) console.log(`[MV Debug] ${player.name}: overall=${overall}, perfMultiplier=${perfMultiplier.toFixed(2)}`);

  // Base value tiers - MUST MATCH ConnectedPlayerDetailScreen.tsx exactly
  let baseValue: number;
  if (overall < 45) {
    baseValue = 10000; // Barely roster-worthy
  } else if (overall < 50) {
    baseValue = 10000 + (overall - 45) * 4000; // $10k - $30k
  } else if (overall < 55) {
    baseValue = 30000 + (overall - 50) * 14000; // $30k - $100k
  } else if (overall < 60) {
    baseValue = 100000 + (overall - 55) * 40000; // $100k - $300k
  } else if (overall < 65) {
    baseValue = 300000 + (overall - 60) * 100000; // $300k - $800k
  } else if (overall < 70) {
    baseValue = 800000 + (overall - 65) * 240000; // $800k - $2M
  } else if (overall < 75) {
    baseValue = 2000000 + (overall - 70) * 600000; // $2M - $5M
  } else if (overall < 80) {
    baseValue = 5000000 + (overall - 75) * 1400000; // $5M - $12M
  } else if (overall < 85) {
    baseValue = 12000000 + (overall - 80) * 3600000; // $12M - $30M
  } else {
    // Exponential scaling for elite players (85+)
    // 85: $30M, 90: $53M, 95: $93M, 99: $147M
    baseValue = 30000000 * Math.pow(1.12, overall - 85);
  }

  // Age factor - MUST MATCH ConnectedPlayerDetailScreen.tsx exactly
  let ageFactor: number;
  if (player.age < 22) {
    ageFactor = 1.3; // Potential premium
  } else if (player.age < 26) {
    ageFactor = 1.1; // Developing
  } else if (player.age < 29) {
    ageFactor = 1.0; // Prime
  } else if (player.age < 32) {
    ageFactor = 0.75; // Declining
  } else if (player.age < 35) {
    ageFactor = 0.5; // Veteran
  } else {
    ageFactor = 0.3; // Near retirement
  }

  let transferValue = baseValue * ageFactor;
  if (debug) console.log(`[MV Debug] ${player.name}: baseValue=${baseValue}, ageFactor=${ageFactor}, beforeCap=${transferValue}`);

  // Cap transfer value relative to salary for unproven players
  // This prevents the free agent flip exploit
  // Elite players (85+) are worth their market rate regardless of salary
  const salary = player.contract?.salary || 0;
  if (salary > 0 && overall < 85) {
    // Multiplier scales with rating - MUST MATCH ConnectedPlayerDetailScreen.tsx exactly
    let maxMultiple: number;
    if (overall >= 80) {
      maxMultiple = 5.0; // Star talent - salary less relevant
    } else if (overall >= 75) {
      maxMultiple = 3.0; // Very good player
    } else if (overall >= 70) {
      maxMultiple = 2.0; // Good player
    } else if (overall >= 65) {
      maxMultiple = 1.0; // Solid starter
    } else {
      maxMultiple = 0.5; // Unproven - transfer value ~= signing cost
    }
    const capValue = salary * maxMultiple;
    if (debug) console.log(`[MV Debug] ${player.name}: salary=${salary}, maxMultiple=${maxMultiple}, cap=${capValue}`);
    transferValue = Math.min(transferValue, capValue);
  }

  if (debug) console.log(`[MV Debug] ${player.name}: afterCap=${transferValue}, withPerf=${transferValue * perfMultiplier}`);

  // Apply performance multiplier (awards + career games)
  transferValue *= perfMultiplier;

  // Round to nearest $5k, minimum $5k - MUST MATCH ConnectedPlayerDetailScreen.tsx exactly
  const result = Math.max(5000, Math.round(transferValue / 5000) * 5000);
  if (debug) console.log(`[MV Debug] ${player.name}: FINAL=${result}`);
  return result;
}

/**
 * Calculates annual salary from market value
 */
export function calculateAnnualSalary(marketValue: number): number {
  return Math.round(marketValue * SALARY_PERCENTAGE);
}

/**
 * Calculates agent fee based on salary and player prestige
 */
export function calculateAgentFee(annualSalary: number, playerRating: number): number {
  // Higher rated players have more demanding agents
  const agentPct = MIN_AGENT_FEE_PCT + (playerRating / 100) * (MAX_AGENT_FEE_PCT - MIN_AGENT_FEE_PCT);
  return Math.round(annualSalary * agentPct);
}

// =============================================================================
// PLAYER DEMANDS GENERATION
// =============================================================================

/**
 * Determines player's negotiation strategy based on situation
 */
export function determineNegotiationStrategy(
  player: Player,
  isContractExpiring: boolean,
  currentTeamInterest: boolean
): NegotiationStrategy {
  if (isContractExpiring && !currentTeamInterest) {
    return 'desperate';
  }

  // Higher rated players are more demanding
  const attrs = player.attributes;
  const overall = attrs
    ? (Object.values(attrs).filter(v => typeof v === 'number') as number[]).reduce((a, b) => a + b, 0) / 25
    : 50;

  if (overall >= 80) return 'aggressive';
  if (overall >= 65) return 'moderate';
  return 'passive';
}

/**
 * Determines appropriate squad role based on player rating
 * Legacy function for backward compatibility - prefer determineSquadRoleForDivision
 */
export function determineSquadRole(playerRating: number, teamAvgRating: number): SquadRole {
  const diff = playerRating - teamAvgRating;

  if (diff >= 15) return 'star_player';
  if (diff >= 5) return 'important_player';
  if (diff >= -5) return 'rotation_player';
  if (diff >= -15) return 'squad_player';
  if (playerRating < 50) return 'youth_prospect';
  return 'backup';
}

/**
 * Determines squad role using division-based expectations
 * Uses player's OVR, division quality range, and ambition modifier
 *
 * @param player - Player to determine role for
 * @param division - Division number (1-10)
 * @returns Expected squad role based on division context
 */
export function determineSquadRoleForDivision(player: Player, division: number): SquadRole {
  const overalls = calculateAllOveralls(player);
  return getExpectedRole(overalls.overall, division, player.ambition);
}

/**
 * Generates player's contract demands (FM-style)
 *
 * @param player - Player making demands
 * @param calculatedSalary - Base salary calculation
 * @param strategy - Negotiation strategy
 * @param teamAvgRatingOrDivision - Either team average rating (legacy) or division number
 * @param useDivisionSystem - If true, treat 4th param as division and use division-based role expectations
 */
export function generatePlayerDemands(
  player: Player,
  calculatedSalary: number,
  strategy: NegotiationStrategy,
  teamAvgRatingOrDivision: number = 60,
  useDivisionSystem: boolean = false
): ContractDemands {
  // Strategy affects demand multiplier
  const strategyMultipliers = {
    aggressive: 1.30,  // 30% above calculated
    moderate: 1.15,    // 15% above calculated
    passive: 1.05,     // 5% above calculated
    desperate: 0.95,   // 5% below calculated
  };

  const multiplier = strategyMultipliers[strategy];

  // Ambition significantly affects salary demands (±30% based on 0.85-1.15 range)
  // Ambitious players overvalue themselves, humble players undervalue
  // This creates meaningful variance so salary doesn't perfectly indicate quality
  const ambitionFactor = 0.7 + (player.ambition * 0.6); // 0.85->1.21, 1.0->1.30, 1.15->1.39

  // Additional random variance (±15%) to make scouting valuable
  const randomFactor = 0.85 + Math.random() * 0.30;

  const idealSalary = Math.round(calculatedSalary * multiplier * ambitionFactor * randomFactor);
  const minSalary = Math.round(idealSalary * 0.85); // Will accept 85% of ideal

  // Contract length based on age
  let minLength: number, maxLength: number;
  if (player.age < 25) {
    minLength = 3;
    maxLength = 5;
  } else if (player.age < 30) {
    minLength = 2;
    maxLength = 4;
  } else {
    minLength = 1;
    maxLength = 3;
  }

  // Squad role based on player quality
  let desiredRole: SquadRole;
  let playerRating: number;

  if (useDivisionSystem) {
    // New system: use division-based role expectations with player's ambition
    const division = teamAvgRatingOrDivision;
    desiredRole = determineSquadRoleForDivision(player, division);
    const overalls = calculateAllOveralls(player);
    playerRating = overalls.overall;
  } else {
    // Legacy system: compare to team average
    const teamAvgRating = teamAvgRatingOrDivision;
    const attrs = player.attributes;
    playerRating = attrs
      ? (Object.values(attrs).filter(v => typeof v === 'number') as number[]).reduce((a, b) => a + b, 0) / 25
      : 50;
    desiredRole = determineSquadRole(playerRating, teamAvgRating);
  }

  // Signing bonus (higher rated players want more, with variance)
  // Base: 10-30% of salary depending on rating, then ±30% random variance
  const bonusBase = calculatedSalary * (0.1 + (playerRating / 100) * 0.2);
  const bonusVariance = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  const signingBonus = Math.round(bonusBase * bonusVariance);

  // Agent fee expectation (with variance - some agents are greedier than others)
  // Base: 8-12% of salary, then ±25% random variance
  const agentBase = calculatedSalary * (MIN_AGENT_FEE_PCT + (playerRating / 100) * (MAX_AGENT_FEE_PCT - MIN_AGENT_FEE_PCT));
  const agentVariance = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
  const agentFee = Math.round(agentBase * agentVariance);

  // Upfront priority - how much player/agent cares about bonus/fee vs salary
  // 0.3-0.7 range: some prioritize salary, others want upfront money
  // Higher ambition players tend to want more upfront (they value immediate compensation)
  const upfrontPriority = 0.3 + Math.random() * 0.4 + (player.ambition - 1.0) * 0.2;

  // Release clause preference
  const releaseClause = strategy === 'aggressive' ? null : Math.round(calculatedSalary * 5);

  // Required clauses based on strategy
  const requiredClauses: ContractClauseType[] = [];
  if (strategy === 'aggressive') {
    if (Math.random() > 0.5) requiredClauses.push('no_release_clause');
    if (Math.random() > 0.7) requiredClauses.push('highest_paid');
  }
  if (desiredRole === 'star_player' || desiredRole === 'important_player') {
    if (Math.random() > 0.6) requiredClauses.push('player_extension_option');
  }

  // Flexibility based on strategy
  const flexibility = STRATEGY_FLEXIBILITY[strategy] * 100;

  return {
    minSalary,
    idealSalary,
    minContractLength: minLength,
    maxContractLength: maxLength,
    desiredRole,
    signingBonus,
    agentFee,
    releaseClause,
    requiredClauses,
    flexibility,
    upfrontPriority: Math.max(0.1, Math.min(0.9, upfrontPriority)), // Clamp to 0.1-0.9
  };
}

// =============================================================================
// CONTRACT OFFER CREATION
// =============================================================================

/**
 * Creates a default contract offer based on player valuation
 */
export function createDefaultOffer(
  player: Player,
  squadRole: SquadRole = 'rotation_player'
): ContractOffer {
  const marketValue = calculatePlayerMarketValue(player);
  const salary = calculateAnnualSalary(marketValue);
  const agentFee = calculateAgentFee(salary, 50);

  return {
    salary,
    contractLength: 2,
    signingBonus: Math.round(salary * 0.1),
    performanceBonuses: {},
    releaseClause: Math.round(marketValue * 1.5),
    agentFee,
    clauses: [],
    squadRole,
    loyaltyBonus: 0,
    yearlyWageRise: 0,
  };
}

/**
 * Creates a recommended offer based on player demands
 */
export function createRecommendedOffer(
  player: Player,
  demands: ContractDemands
): ContractOffer {
  const marketValue = calculatePlayerMarketValue(player);
  const agentFee = calculateAgentFee(demands.idealSalary, 60);

  // Offer slightly below ideal but above minimum
  const offerSalary = Math.round((demands.idealSalary + demands.minSalary) / 2);
  const contractLength = Math.round((demands.minContractLength + demands.maxContractLength) / 2);

  const clauses: ContractClause[] = demands.requiredClauses.map(type => ({
    type,
    value: getDefaultClauseValue(type),
    description: getClauseDescription(type, getDefaultClauseValue(type)),
  }));

  return {
    salary: offerSalary,
    contractLength,
    signingBonus: demands.signingBonus,
    performanceBonuses: {},
    releaseClause: demands.releaseClause,
    agentFee,
    clauses,
    squadRole: demands.desiredRole,
    loyaltyBonus: Math.round(offerSalary * 0.5),
    yearlyWageRise: 3, // 3% default
  };
}

// =============================================================================
// NEGOTIATION EVALUATION
// =============================================================================

/**
 * Evaluates how satisfied a player is with an offer (0-100)
 *
 * Key design: Uses soft rules with trade-offs
 * - High salary can partially compensate for low bonus/agent fee
 * - upfrontPriority determines how much bonus/fee matter vs salary
 * - Random variance prevents exact minimum predictions
 */
export function evaluateOfferSatisfaction(
  offer: ContractOffer,
  demands: ContractDemands,
  round: number,
  strategy: NegotiationStrategy
): number {
  let satisfaction = 50; // Start neutral

  // ==========================================================================
  // SALARY SATISFACTION (base weight ~35-45% depending on upfrontPriority)
  // ==========================================================================
  const salaryWeight = 40 - (demands.upfrontPriority * 10); // 31-39 depending on priority

  if (offer.salary >= demands.idealSalary) {
    // Above ideal: full points + overflow bonus that can compensate other areas
    const overflow = (offer.salary - demands.idealSalary) / demands.idealSalary;
    satisfaction += salaryWeight + Math.min(15, overflow * 30); // Up to +15 bonus for high salary
  } else if (offer.salary >= demands.minSalary) {
    const salaryRatio = (offer.salary - demands.minSalary) / (demands.idealSalary - demands.minSalary);
    satisfaction += Math.round(salaryRatio * (salaryWeight - 5));
  } else {
    const deficit = (demands.minSalary - offer.salary) / demands.minSalary;
    satisfaction -= Math.round(deficit * 50);
  }

  // ==========================================================================
  // CONTRACT LENGTH (15% weight)
  // ==========================================================================
  if (offer.contractLength >= demands.minContractLength &&
      offer.contractLength <= demands.maxContractLength) {
    satisfaction += 15;
  } else {
    satisfaction -= 10;
  }

  // ==========================================================================
  // SQUAD ROLE (20% weight)
  // ==========================================================================
  const roleRanks: Record<SquadRole, number> = {
    star_player: 6,
    important_player: 5,
    rotation_player: 4,
    squad_player: 3,
    youth_prospect: 2,
    backup: 1,
  };
  const desiredRank = roleRanks[demands.desiredRole];
  const offeredRank = roleRanks[offer.squadRole];
  if (offeredRank >= desiredRank) {
    satisfaction += 20;
  } else {
    satisfaction -= (desiredRank - offeredRank) * 5;
  }

  // ==========================================================================
  // UPFRONT MONEY: SIGNING BONUS + AGENT FEE (combined ~15-25% weight)
  // Weight scales with upfrontPriority - some care more than others
  // ==========================================================================
  const upfrontWeight = 10 + (demands.upfrontPriority * 15); // 11.5-23.5 depending on priority

  // Signing bonus satisfaction
  const bonusRatio = demands.signingBonus > 0
    ? offer.signingBonus / demands.signingBonus
    : 1;

  // Agent fee satisfaction - agents won't work for free, but expectations vary
  const expectedAgentFee = demands.agentFee || (offer.salary * DEFAULT_AGENT_FEE_PCT);
  const agentRatio = expectedAgentFee > 0
    ? offer.agentFee / expectedAgentFee
    : 1;

  // Combined upfront satisfaction with trade-off between bonus and agent fee
  // Player cares about bonus, agent cares about their fee
  const upfrontRatio = (bonusRatio * 0.5 + agentRatio * 0.5);

  if (upfrontRatio >= 1.0) {
    satisfaction += upfrontWeight;
  } else if (upfrontRatio >= 0.5) {
    satisfaction += Math.round(upfrontRatio * upfrontWeight);
  } else if (upfrontRatio >= 0.2) {
    // Below 50% but not insulting - small penalty
    satisfaction -= Math.round((0.5 - upfrontRatio) * upfrontWeight);
  } else {
    // Very low upfront money - significant penalty, but high salary can still save the deal
    satisfaction -= Math.round((0.5 - upfrontRatio) * upfrontWeight * 1.5);
  }

  // Hard floor: Agent fee can't be zero (agents NEVER work for free)
  // But even this has some variance based on how desperate the situation is
  const absoluteMinAgentFee = offer.salary * (ABSOLUTE_MIN_AGENT_FEE_PCT * (0.8 + Math.random() * 0.4));
  if (offer.agentFee < absoluteMinAgentFee) {
    const agentDeficit = (absoluteMinAgentFee - offer.agentFee) / absoluteMinAgentFee;
    satisfaction -= Math.round(agentDeficit * 20); // Penalty but not instant rejection
  }

  // ==========================================================================
  // REQUIRED CLAUSES (5% weight)
  // ==========================================================================
  const hasAllClauses = demands.requiredClauses.every(
    req => offer.clauses.some(c => c.type === req)
  );
  if (hasAllClauses) {
    satisfaction += 5;
  } else {
    satisfaction -= 10;
  }

  // ==========================================================================
  // FLEXIBILITY & VARIANCE
  // ==========================================================================
  // Flexibility increases with rounds
  const flexibilityBonus = round * STRATEGY_FLEXIBILITY[strategy] * 20;
  satisfaction += flexibilityBonus;

  // Add small random variance (±5) so exact thresholds aren't predictable
  const variance = Math.round((Math.random() - 0.5) * 10);
  satisfaction += variance;

  return Math.max(0, Math.min(100, Math.round(satisfaction)));
}

/**
 * Determines the outcome of a negotiation round
 */
export function determineNegotiationOutcome(
  satisfaction: number,
  round: number,
  maxRounds: number,
  strategy: NegotiationStrategy
): NegotiationOutcome {
  // Acceptance threshold decreases with rounds
  const baseThreshold = 75;
  const roundModifier = (round - 1) * 5;
  const strategyModifier = STRATEGY_FLEXIBILITY[strategy] * 30;
  const acceptThreshold = baseThreshold - roundModifier - strategyModifier;

  if (satisfaction >= acceptThreshold) {
    return 'accepted';
  }

  // Rejection threshold
  const rejectThreshold = 30 - (round * 3);
  if (satisfaction < rejectThreshold || round >= maxRounds) {
    return 'rejected';
  }

  return 'countered';
}

/**
 * Generates a response message based on satisfaction
 */
export function generateResponseMessage(
  satisfaction: number,
  outcome: NegotiationOutcome,
  demands: ContractDemands,
  offer: ContractOffer
): string {
  if (outcome === 'accepted') {
    if (satisfaction >= 90) {
      return "The player is delighted with the offer and is eager to sign!";
    } else if (satisfaction >= 75) {
      return "The player is happy with the terms and will accept the offer.";
    } else {
      return "After some consideration, the player has decided to accept the offer.";
    }
  }

  if (outcome === 'rejected') {
    if (offer.salary < demands.minSalary * 0.7) {
      return "The player feels insulted by this lowball offer and has walked away from negotiations.";
    } else {
      return "Despite multiple rounds of negotiation, the player cannot agree to these terms.";
    }
  }

  // Counter-offer messages
  const issues: string[] = [];
  if (offer.salary < demands.minSalary) {
    issues.push("higher wages");
  }
  if (offer.squadRole !== demands.desiredRole) {
    issues.push("a more prominent role");
  }
  if (offer.signingBonus < demands.signingBonus * 0.7) {
    issues.push("a better signing bonus");
  }
  if (offer.agentFee < demands.agentFee * 0.7) {
    issues.push("improved agent compensation");
  }

  if (issues.length === 0) {
    return "The player would like to negotiate further on the overall package.";
  }

  return `The player is interested but wants ${issues.join(" and ")}.`;
}

// =============================================================================
// COUNTER-OFFER GENERATION
// =============================================================================

/**
 * Generates a player's counter-offer (FM-style)
 */
export function generateCounterOffer(
  offer: ContractOffer,
  demands: ContractDemands,
  round: number,
  strategy: NegotiationStrategy
): ContractOffer {
  const flexibility = STRATEGY_FLEXIBILITY[strategy];
  const roundModifier = round * 0.05; // More flexible each round
  const totalFlex = flexibility + roundModifier;

  // Counter salary: Move toward their ideal
  let counterSalary: number;
  if (offer.salary >= demands.idealSalary) {
    counterSalary = offer.salary; // Accept if already above ideal
  } else {
    // Split the difference, weighted by flexibility
    const gap = demands.idealSalary - offer.salary;
    counterSalary = offer.salary + Math.round(gap * (1 - totalFlex));
  }

  // Ensure counter is at least minimum
  counterSalary = Math.max(counterSalary, demands.minSalary);

  // Counter contract length: Move toward their preference
  let counterLength = offer.contractLength;
  if (offer.contractLength < demands.minContractLength) {
    counterLength = demands.minContractLength;
  } else if (offer.contractLength > demands.maxContractLength) {
    counterLength = demands.maxContractLength;
  }

  // Counter signing bonus
  const bonusGap = demands.signingBonus - offer.signingBonus;
  const counterBonus = offer.signingBonus + Math.round(bonusGap * (1 - totalFlex));

  // Counter agent fee - agents will push back on low fees
  const agentFeeGap = demands.agentFee - offer.agentFee;
  const counterAgentFee = agentFeeGap > 0
    ? offer.agentFee + Math.round(agentFeeGap * (1 - totalFlex))
    : offer.agentFee;

  // Add required clauses if missing
  const counterClauses = [...offer.clauses];
  for (const reqType of demands.requiredClauses) {
    if (!counterClauses.some(c => c.type === reqType)) {
      counterClauses.push({
        type: reqType,
        value: getDefaultClauseValue(reqType),
        description: getClauseDescription(reqType, getDefaultClauseValue(reqType)),
      });
    }
  }

  // Counter yearly wage rise if aggressive
  const counterWageRise = strategy === 'aggressive'
    ? Math.max(offer.yearlyWageRise, 5)
    : offer.yearlyWageRise;

  return {
    salary: counterSalary,
    contractLength: counterLength,
    signingBonus: Math.max(offer.signingBonus, counterBonus),
    performanceBonuses: offer.performanceBonuses,
    releaseClause: demands.releaseClause,
    agentFee: Math.max(offer.agentFee, counterAgentFee),
    clauses: counterClauses,
    squadRole: demands.desiredRole,
    loyaltyBonus: offer.loyaltyBonus,
    yearlyWageRise: counterWageRise,
  };
}

// =============================================================================
// NEGOTIATION MANAGEMENT
// =============================================================================

/**
 * Creates a new contract negotiation
 *
 * @param player - Player being negotiated with
 * @param initialOffer - Initial contract offer
 * @param currentWeek - Current week number
 * @param negotiationType - Type of negotiation
 * @param transferFee - Optional transfer fee for transfers
 * @param division - User's division (1-10) for accurate role expectations
 */
export function createNegotiation(
  player: Player,
  initialOffer: ContractOffer,
  currentWeek: number,
  negotiationType: 'new_signing' | 'renewal' | 'transfer' = 'new_signing',
  transferFee?: number,
  division?: number
): ContractNegotiation {
  const strategy = determineNegotiationStrategy(player, false, true);
  const marketValue = calculatePlayerMarketValue(player);
  const calculatedSalary = calculateAnnualSalary(marketValue);

  // Use division-based role expectations if division is provided
  // This ensures players like a 59 OVR in Division 7 expect to be star players
  const demands = division !== undefined
    ? generatePlayerDemands(player, calculatedSalary, strategy, division, true)
    : generatePlayerDemands(player, calculatedSalary, strategy);

  return {
    id: `neg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    playerId: player.id,
    teamId: 'user',
    status: 'in_progress',
    currentRound: 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
    playerDemands: demands,
    playerStrategy: strategy,
    currentOffer: initialOffer,
    history: [],
    deadlineWeek: currentWeek + NEGOTIATION_DEADLINE_WEEKS,
    negotiationType,
    transferFee,
  };
}

/**
 * Processes a negotiation round
 */
export function processNegotiationRound(
  negotiation: ContractNegotiation,
  teamOffer: ContractOffer
): {
  negotiation: ContractNegotiation;
  outcome: NegotiationOutcome;
  message: string;
} {
  const satisfaction = evaluateOfferSatisfaction(
    teamOffer,
    negotiation.playerDemands,
    negotiation.currentRound,
    negotiation.playerStrategy
  );

  const outcome = determineNegotiationOutcome(
    satisfaction,
    negotiation.currentRound,
    negotiation.maxRounds,
    negotiation.playerStrategy
  );

  const message = generateResponseMessage(
    satisfaction,
    outcome,
    negotiation.playerDemands,
    teamOffer
  );

  // Create history entry
  const historyEntry: NegotiationRound = {
    round: negotiation.currentRound,
    offer: teamOffer,
    from: 'team',
    outcome,
    responseMessage: message,
    timestamp: new Date(),
  };

  // Update negotiation state
  let updatedNegotiation: ContractNegotiation = {
    ...negotiation,
    currentOffer: teamOffer,
    history: [...negotiation.history, historyEntry],
  };

  if (outcome === 'accepted') {
    updatedNegotiation.status = 'accepted';
  } else if (outcome === 'rejected') {
    updatedNegotiation.status = 'rejected';
  } else {
    // Generate counter-offer
    const counterOffer = generateCounterOffer(
      teamOffer,
      negotiation.playerDemands,
      negotiation.currentRound,
      negotiation.playerStrategy
    );
    updatedNegotiation.counterOffer = counterOffer;
    updatedNegotiation.currentRound += 1;

    // Add player's counter to history
    updatedNegotiation.history.push({
      round: updatedNegotiation.currentRound,
      offer: counterOffer,
      from: 'player',
      outcome: 'considering',
      timestamp: new Date(),
    });
  }

  return {
    negotiation: updatedNegotiation,
    outcome,
    message,
  };
}

// =============================================================================
// CONTRACT CREATION
// =============================================================================

/**
 * Creates a signed contract from an accepted offer
 */
export function createContractFromOffer(
  playerId: string,
  teamId: string,
  offer: ContractOffer
): Contract {
  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + offer.contractLength);

  // Calculate salary increases array
  const salaryIncreases: number[] = [];
  for (let i = 0; i < offer.contractLength; i++) {
    salaryIncreases.push(offer.yearlyWageRise);
  }

  return {
    id: `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    teamId,
    salary: offer.salary,
    signingBonus: offer.signingBonus,
    contractLength: offer.contractLength,
    startDate,
    expiryDate,
    performanceBonuses: offer.performanceBonuses,
    releaseClause: offer.releaseClause,
    salaryIncreases,
    agentFee: offer.agentFee,
    clauses: offer.clauses,
    squadRole: offer.squadRole,
    loyaltyBonus: offer.loyaltyBonus,
  };
}

/**
 * Calculates total upfront cost of signing (salary + bonus + agent fee)
 */
export function calculateSigningCost(offer: ContractOffer): number {
  return offer.salary + offer.signingBonus + offer.agentFee;
}

/**
 * Calculates total contract value over its duration
 */
export function calculateTotalContractValue(offer: ContractOffer): number {
  let totalSalary = 0;
  let currentSalary = offer.salary;

  for (let year = 0; year < offer.contractLength; year++) {
    totalSalary += currentSalary;
    currentSalary = Math.round(currentSalary * (1 + offer.yearlyWageRise / 100));
  }

  return totalSalary + offer.signingBonus + offer.agentFee + offer.loyaltyBonus;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Gets default value for a clause type
 */
function getDefaultClauseValue(type: ContractClauseType): number {
  switch (type) {
    case 'optional_extension':
      return 1; // 1 year extension option
    case 'player_extension_option':
      return 1; // Player option for 1 year
    default:
      return 0;
  }
}

/**
 * Gets human-readable description for a clause
 */
export function getClauseDescription(type: ContractClauseType, value: number): string {
  switch (type) {
    case 'squad_role':
      return `Promised role in the squad`;
    case 'no_release_clause':
      return `No release clause allowed`;
    case 'optional_extension':
      return `Club option for ${value} year extension`;
    case 'player_extension_option':
      return `Player option for 1 year extension`;
    case 'highest_paid':
      return `Guaranteed highest paid player at club`;
    case 'relegation_termination':
      return `Player may terminate contract if club is relegated`;
    default:
      return type;
  }
}

/**
 * Gets display name for squad role
 */
export function getSquadRoleDisplayName(role: SquadRole): string {
  const names: Record<SquadRole, string> = {
    star_player: 'Star Player',
    important_player: 'Important Player',
    rotation_player: 'Rotation Player',
    squad_player: 'Squad Player',
    youth_prospect: 'Youth Prospect',
    backup: 'Backup',
  };
  return names[role];
}

/**
 * Formats salary for display
 */
export function formatSalary(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  return `$${(amount / 1000).toFixed(0)}K`;
}

// Backwards compatibility wrapper - returns object like old API expected
export function calculatePlayerValuation(
  overallRating: number,
  age: number,
  averagePotential: number,
  sportsAbove50: number
): { marketValue: number; annualSalary: number } {
  const marketValue = calculateMarketValue(overallRating, age, averagePotential, sportsAbove50);
  const annualSalary = calculateAnnualSalary(marketValue);
  return { marketValue, annualSalary };
}
