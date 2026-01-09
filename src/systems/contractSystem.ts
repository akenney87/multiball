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

// =============================================================================
// CONSTANTS
// =============================================================================

// Contract length limits
export const MIN_CONTRACT_LENGTH = 1;
export const MAX_CONTRACT_LENGTH = 5;

// Salary calculation
export const SALARY_PERCENTAGE = 0.20; // Salary = 20% of market value

// Agent fees
export const MIN_AGENT_FEE_PCT = 0.05; // 5% minimum
export const MAX_AGENT_FEE_PCT = 0.15; // 15% maximum
export const DEFAULT_AGENT_FEE_PCT = 0.10; // 10% default

// Age multipliers for valuation
export const AGE_MULTIPLIERS = {
  young: 1.5,    // Age < 23
  prime: 2.0,    // Age 23-28
  veteran: 1.5,  // Age 29-32
  aging: 1.0,    // Age >= 33
};

// Multi-sport bonus
export const MULTI_SPORT_BONUS = 0.2; // +20% per sport above 50 rating

// Negotiation limits
export const DEFAULT_MAX_ROUNDS = 5;
export const NEGOTIATION_DEADLINE_WEEKS = 4;

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
 */
export function calculateMarketValue(
  overallRating: number,
  age: number,
  averagePotential: number,
  sportsAbove50: number
): number {
  // Base value: (rating / 100) × $1,000,000
  const baseValue = (overallRating / 100) * 1000000;

  // Age multiplier
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

  // Potential modifier
  const potentialModifier = 1.0 + (averagePotential - overallRating) / 100;

  // Multi-sport bonus
  const multiSportBonus = 1.0 + (sportsAbove50 - 1) * MULTI_SPORT_BONUS;

  const marketValue = baseValue * ageMultiplier * potentialModifier * Math.max(1.0, multiSportBonus);
  return Math.round(marketValue);
}

/**
 * Calculates market value from a Player object
 */
export function calculatePlayerMarketValue(player: Player): number {
  const attrs = player.attributes;
  if (!attrs) return 500000; // Default minimum

  // Calculate overall as average of key attributes
  const attrValues = Object.values(attrs).filter(v => typeof v === 'number') as number[];
  const overall = attrValues.reduce((a, b) => a + b, 0) / attrValues.length;

  // Get potentials
  const potentials = player.potentials;
  const avgPotential = potentials
    ? (potentials.physical + potentials.mental + potentials.technical) / 3
    : overall;

  return calculateMarketValue(overall, player.age, avgPotential, 1);
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
 * Generates player's contract demands (FM-style)
 */
export function generatePlayerDemands(
  player: Player,
  calculatedSalary: number,
  strategy: NegotiationStrategy,
  teamAvgRating: number = 60
): ContractDemands {
  // Strategy affects demand multiplier
  const strategyMultipliers = {
    aggressive: 1.30,  // 30% above calculated
    moderate: 1.15,    // 15% above calculated
    passive: 1.05,     // 5% above calculated
    desperate: 0.95,   // 5% below calculated
  };

  const multiplier = strategyMultipliers[strategy];
  const randomFactor = 0.95 + Math.random() * 0.1; // ±5% randomness

  const idealSalary = Math.round(calculatedSalary * multiplier * randomFactor);
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

  // Squad role based on player quality vs team
  const attrs = player.attributes;
  const playerRating = attrs
    ? (Object.values(attrs).filter(v => typeof v === 'number') as number[]).reduce((a, b) => a + b, 0) / 25
    : 50;
  const desiredRole = determineSquadRole(playerRating, teamAvgRating);

  // Signing bonus (higher rated players want more)
  const signingBonus = Math.round(calculatedSalary * (0.1 + (playerRating / 100) * 0.2));

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
    releaseClause,
    requiredClauses,
    flexibility,
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
 */
export function evaluateOfferSatisfaction(
  offer: ContractOffer,
  demands: ContractDemands,
  round: number,
  strategy: NegotiationStrategy
): number {
  let satisfaction = 50; // Start neutral

  // Salary satisfaction (most important, 40% weight)
  if (offer.salary >= demands.idealSalary) {
    satisfaction += 40;
  } else if (offer.salary >= demands.minSalary) {
    const salaryRatio = (offer.salary - demands.minSalary) / (demands.idealSalary - demands.minSalary);
    satisfaction += Math.round(salaryRatio * 30);
  } else {
    const deficit = (demands.minSalary - offer.salary) / demands.minSalary;
    satisfaction -= Math.round(deficit * 50);
  }

  // Contract length satisfaction (15% weight)
  if (offer.contractLength >= demands.minContractLength &&
      offer.contractLength <= demands.maxContractLength) {
    satisfaction += 15;
  } else {
    satisfaction -= 10;
  }

  // Squad role satisfaction (20% weight)
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

  // Signing bonus (10% weight)
  if (offer.signingBonus >= demands.signingBonus) {
    satisfaction += 10;
  } else if (offer.signingBonus >= demands.signingBonus * 0.5) {
    satisfaction += 5;
  }

  // Required clauses check (5% weight)
  const hasAllClauses = demands.requiredClauses.every(
    req => offer.clauses.some(c => c.type === req)
  );
  if (hasAllClauses) {
    satisfaction += 5;
  } else {
    satisfaction -= 10;
  }

  // Flexibility increases with rounds
  const flexibilityBonus = round * STRATEGY_FLEXIBILITY[strategy] * 20;
  satisfaction += flexibilityBonus;

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
  if (offer.signingBonus < demands.signingBonus) {
    issues.push("a better signing bonus");
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
    agentFee: offer.agentFee,
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
 */
export function createNegotiation(
  player: Player,
  initialOffer: ContractOffer,
  currentWeek: number,
  negotiationType: 'new_signing' | 'renewal' | 'transfer' = 'new_signing',
  transferFee?: number
): ContractNegotiation {
  const strategy = determineNegotiationStrategy(player, false, true);
  const marketValue = calculatePlayerMarketValue(player);
  const calculatedSalary = calculateAnnualSalary(marketValue);
  const demands = generatePlayerDemands(player, calculatedSalary, strategy);

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
