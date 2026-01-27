/**
 * Game Initializer
 *
 * Creates initial game state for new games.
 * Generates players, teams, and season schedule.
 */

// Simple UUID generator for React Native compatibility
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type { Player, Contract, YouthPhysicalDevelopment, PlayerAttributes } from '../../data/types';
import type {
  UserTeamState,
  LeagueState,
  SeasonState,
  AITeamState,
  AITeamSeasonStrategy,
  InitializeGamePayload,
  BaseballLineupConfig,
  BaseballPosition,
  SoccerLineupConfig,
  LineupConfig,
} from '../context/types';
import {
  type BaseballGameStrategy,
  type PlateApproach,
  type SwingStyle,
  type BaserunningStyle,
  DEFAULT_PITCHING_STRATEGY,
  DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY,
} from '../../simulation/baseball/types';
import {
  DEFAULT_OPERATIONS_BUDGET,
  DEFAULT_TRAINING_FOCUS,
} from '../context/types';
import type { NewGameConfig } from '../screens/NewGameScreen';
import {
  createRandomAttributes,
  createRandomPotentials,
  createRandomPeakAges,
  createEmptyWeeklyXP,
  createEmptyCareerStats,
  createDefaultTacticalSettings,
  // Youth physical development functions
  generateHeightPercentile,
  getHeightForAgeAndPercentile,
  getProjectedAdultHeight,
  generateGrowthPattern,
  generateTargetAdultBMI,
  calculateCurrentWeight,
  // Role expectation system
  generateAmbition,
} from '../../data/factories';
import { generateName } from '../../data/nameGenerator';
import { createAIConfig } from '../../ai/personality';
import { generateSeasonSchedule, createInitialStandings } from '../../season';
import { generateLeagueTeams, type TeamAssignment } from '../../data/teamNameGenerator';
import { generateCareerHistory, assignCareerStartAge } from '../../systems/careerHistoryGenerator';

// =============================================================================
// CONSTANTS
// =============================================================================

import {
  BASE_BUDGET,
  DIFFICULTY_BUDGET_MULTIPLIER,
  DIVISION_COUNT,
  TEAMS_PER_DIVISION,
} from '../../data/constants';
import { getDivisionBudgetMultiplier } from '../../ai/divisionManager';

/** Number of free agents to generate */
const FREE_AGENT_COUNT = 500;

/**
 * Free agent talent tiers with distribution weights
 * - Washed: Declining players, low attributes (division 7-8 level)
 * - Journeyman: Average players (division 5-6 level)
 * - Quality: Good players, worth a look (division 4-5 level)
 * - Excellent: Very good players (division 2-3 level)
 */
const FREE_AGENT_TIERS = [
  { name: 'washed', weight: 50, attrRange: { min: 15, max: 35 } },      // 50% - struggling
  { name: 'journeyman', weight: 30, attrRange: { min: 35, max: 55 } },  // 30% - decent
  { name: 'quality', weight: 15, attrRange: { min: 55, max: 70 } },     // 15% - good
  { name: 'excellent', weight: 5, attrRange: { min: 70, max: 85 } },    // 5% - rare gems
] as const;

/**
 * Age distribution for free agents
 * Heavily skewed toward older players (tail-end of career)
 * Young free agents are rare and usually lower quality
 */
const FREE_AGENT_AGE_DISTRIBUTION = [
  { ageRange: { min: 20, max: 24 }, weight: 5 },   // 5% - very rare young
  { ageRange: { min: 25, max: 27 }, weight: 10 },  // 10% - uncommon prime
  { ageRange: { min: 28, max: 30 }, weight: 25 },  // 25% - late prime
  { ageRange: { min: 31, max: 33 }, weight: 35 },  // 35% - declining
  { ageRange: { min: 34, max: 36 }, weight: 25 },  // 25% - tail-end
] as const;

/** Season length in weeks */
const SEASON_WEEKS = 40;

// =============================================================================
// POSITIONS
// =============================================================================

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(array: readonly T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index] as T;
}

// =============================================================================
// PLAYER GENERATION
// =============================================================================

/**
 * Generate height (in inches) - POSITION-INDEPENDENT
 * Uses normal distribution: most common 5'10"-6'2" (70"-74")
 * Range: 5'6" to 7'4" (66" to 88"), with extremes being very rare
 *
 * Minimum 5'6" (66") - realistic floor for multi-sport pro athletes
 */
function generateHeight(): number {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Mean: 74" (6'2"), Standard deviation: 3" (tighter for pro athletes)
  const mean = 74;
  const stdDev = 3;
  const height = Math.round(mean + z * stdDev);

  // Clamp to realistic range: 5'6" to 7'4" (66" to 88")
  return Math.max(66, Math.min(88, height));
}

/**
 * Generate weight based on height (in pounds) with BMI enforcement
 *
 * Pro Athletes: BMI 20-30 (enforced)
 * Weight correlates with height within realistic BMI bounds.
 *
 * @param height - Height in inches
 * @param isYouth - Whether this is a youth prospect (uses BMI 19-28)
 */
function generateWeight(height: number, isYouth: boolean = false): number {
  const minBMI = isYouth ? 19 : 20;
  const maxBMI = isYouth ? 28 : 30;

  const minWeight = Math.round((minBMI * height * height) / 703);
  const maxWeight = Math.round((maxBMI * height * height) / 703);

  // Generate weight with slight bias toward middle of range
  const midWeight = (minWeight + maxWeight) / 2;
  const variance = (maxWeight - minWeight) / 2;

  // Normal-ish distribution around midpoint
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const weight = Math.round(midWeight + z * variance * 0.4);

  // Clamp to valid BMI range
  return Math.max(minWeight, Math.min(maxWeight, weight));
}

/**
 * Generate nationality with realistic distribution
 * Returns values matching NAME_POOLS keys (adjective form)
 */
function generateNationality(): string {
  const nationalities = [
    { name: 'American', weight: 70 },        // 70% American
    { name: 'Spanish', weight: 5 },
    { name: 'French', weight: 5 },
    { name: 'Canadian', weight: 4 },
    { name: 'Serbian', weight: 3 },
    { name: 'Australian', weight: 3 },
    { name: 'German', weight: 2 },
    { name: 'Lithuanian', weight: 2 },
    { name: 'Argentine', weight: 2 },
    { name: 'Greek', weight: 2 },
    { name: 'Croatian', weight: 1 },
    { name: 'Nigerian', weight: 1 },
  ];

  const totalWeight = nationalities.reduce((sum, n) => sum + n.weight, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  for (const nationality of nationalities) {
    cumulative += nationality.weight;
    if (random <= cumulative) {
      return nationality.name;
    }
  }

  return 'American';
}

/**
 * Generate a player with given attribute range
 *
 * Players under 24 get youth development data tracking their physical growth.
 * Height grows until 18, weight until 24.
 *
 * @param teamId - Team ID for contract
 * @param attrRange - Min/max attribute range for this division
 * @param position - Player position
 * @param usedNames - Set of already used names to avoid duplicates
 * @param targetAvgSalary - Target average salary for this division (for budget fitting)
 * @param sport - Sport type for position-based height generation
 */
function generatePlayer(
  teamId: string,
  attrRange: { min: number; max: number },
  position: string,
  usedNames: Set<string>,
  targetAvgSalary: number,
  sport: 'basketball' | 'baseball' | 'soccer' = 'basketball'
): Player {
  const id = uuidv4();
  const age = randomInt(20, 32);

  // Generate height and weight using youth development system
  let height: number;
  let weight: number;
  let youthDevelopment: YouthPhysicalDevelopment | undefined;

  if (age < 24) {
    // Use percentile-based growth system for younger players
    const heightPercentile = generateHeightPercentile(position, sport);
    const growthPattern = generateGrowthPattern();
    const targetAdultBMI = generateTargetAdultBMI();

    // Calculate projected adult height with variance (±2")
    const baseProjectedHeight = getProjectedAdultHeight(heightPercentile);
    const heightVariance = 2;
    const varianceRoll = (Math.random() - 0.5) * 2 * heightVariance;
    const projectedAdultHeight = Math.round(baseProjectedHeight + varianceRoll);

    // Calculate current height based on age
    if (age < 18) {
      height = getHeightForAgeAndPercentile(age, heightPercentile);
      // Apply variance toward projected
      const varianceTowardProjected = (projectedAdultHeight - baseProjectedHeight) * ((age - 14) / 4);
      height = Math.max(66, Math.round(height + varianceTowardProjected));
    } else {
      // At 18+, use projected adult height (growth complete)
      height = projectedAdultHeight;
    }

    // Ensure height meets minimum
    height = Math.max(66, height);

    // Calculate weight based on age-appropriate BMI
    weight = calculateCurrentWeight(age, height, targetAdultBMI);

    // Create youth development data
    youthDevelopment = {
      projectedAdultHeight,
      heightVariance,
      targetAdultBMI,
      growthPattern,
      lastGrowthGameDay: 0,
      heightPercentile,
    };
  } else {
    // 24+: Use standard generation (no youth development tracking)
    height = generateHeight();
    weight = generateWeight(height);
    youthDevelopment = undefined;
  }

  const nationality = generateNationality();
  const attributes = createRandomAttributes(attrRange.min, attrRange.max, height, weight);
  const potentials = createRandomPotentials(attributes);

  // Generate nationality-appropriate name
  const name = generateName(nationality, usedNames);
  usedNames.add(name);

  // Calculate player's actual overall rating from attributes
  const attrValues = Object.values(attributes).filter(v => typeof v === 'number') as number[];
  const overallRating = attrValues.reduce((a, b) => a + b, 0) / attrValues.length;

  // Calculate salary based on division's target average and player quality
  // Better players earn more, worse players earn less, averaging to targetAvgSalary
  // Quality modifier: 0.4x to 1.6x based on where player falls in attribute range
  const range = attrRange.max - attrRange.min;
  const qualityModifier = 0.4 + 1.2 * ((overallRating - attrRange.min) / range);

  // Age modifier: prime players (25-30) earn more
  let ageModifier: number;
  if (age < 23) {
    ageModifier = 0.7;   // Young - cheaper
  } else if (age < 25) {
    ageModifier = 0.85;  // Developing
  } else if (age < 30) {
    ageModifier = 1.15;  // Prime - premium
  } else if (age < 33) {
    ageModifier = 0.9;   // Veteran - slight discount
  } else {
    ageModifier = 0.7;   // Aging - cheaper
  }

  // Add variance (±20%) for realism
  const variance = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

  // Final salary calculation
  const salary = Math.round(targetAvgSalary * qualityModifier * ageModifier * variance);

  const contractLength = randomInt(1, 3);
  const contract: Contract = {
    id: uuidv4(),
    playerId: id,
    teamId,
    salary,
    signingBonus: 0,
    contractLength,
    startDate: new Date(),
    expiryDate: new Date(Date.now() + contractLength * 365 * 24 * 60 * 60 * 1000),
    performanceBonuses: {},
    releaseClause: null,
    salaryIncreases: [],
    agentFee: 0,
    clauses: [],
    squadRole: 'rotation_player',
    loyaltyBonus: 0,
  };

  // Generate career start age
  const careerStartAge = Math.min(assignCareerStartAge(), age);

  const player: Player = {
    id,
    name,
    age,
    careerStartAge,
    dateOfBirth: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
    position,
    height,
    weight,
    nationality,
    attributes,
    potentials,
    peakAges: createRandomPeakAges(),
    contract,
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    teamId,
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
    // Match fitness - persistent stamina between matches
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    // Youth physical development (only for players under 24)
    youthDevelopment,
    // Season history (will be populated below)
    seasonHistory: [],
    // Awards
    awards: {
      playerOfTheWeek: { basketball: 0, baseball: 0, soccer: 0 },
      playerOfTheMonth: { basketball: 0, baseball: 0, soccer: 0 },
      basketballPlayerOfTheYear: 0,
      baseballPlayerOfTheYear: 0,
      soccerPlayerOfTheYear: 0,
      rookieOfTheYear: 0,
      championships: 0,
    },
    // Morale system
    morale: 75,
    recentMatchResults: [],
    transferRequestActive: false,
    transferRequestDate: null,
    weeksDisgruntled: 0,
    // Role expectation system
    ambition: generateAmbition(),
  };

  // Generate career history and aggregate stats
  if (player.age > player.careerStartAge) {
    player.seasonHistory = generateCareerHistory(player, 1);

    // Aggregate career stats from history
    for (const season of player.seasonHistory) {
      // Aggregate basketball stats
      if (season.basketball && player.careerStats.basketball) {
        player.careerStats.basketball.fieldGoalsMade += season.basketball.fieldGoalsMade;
        player.careerStats.basketball.fieldGoalsAttempted += season.basketball.fieldGoalsAttempted;
        player.careerStats.basketball.threePointersMade += season.basketball.threePointersMade;
        player.careerStats.basketball.threePointersAttempted += season.basketball.threePointersAttempted;
        player.careerStats.basketball.freeThrowsMade += season.basketball.freeThrowsMade;
        player.careerStats.basketball.freeThrowsAttempted += season.basketball.freeThrowsAttempted;
        player.careerStats.basketball.rebounds += season.basketball.rebounds;
        player.careerStats.basketball.assists += season.basketball.assists;
        player.careerStats.basketball.steals += season.basketball.steals;
        player.careerStats.basketball.blocks += season.basketball.blocks;
        player.careerStats.basketball.turnovers += season.basketball.turnovers;
      }

      // Aggregate baseball stats
      if (season.baseball && player.careerStats.baseball) {
        player.careerStats.baseball.atBats += season.baseball.atBats;
        player.careerStats.baseball.runs += season.baseball.runs;
        player.careerStats.baseball.hits += season.baseball.hits;
        player.careerStats.baseball.doubles += season.baseball.doubles;
        player.careerStats.baseball.triples += season.baseball.triples;
        player.careerStats.baseball.homeRuns += season.baseball.homeRuns;
        player.careerStats.baseball.rbi += season.baseball.rbi;
        player.careerStats.baseball.walks += season.baseball.walks;
        player.careerStats.baseball.strikeouts += season.baseball.strikeouts;
        player.careerStats.baseball.stolenBases += season.baseball.stolenBases;
        player.careerStats.baseball.caughtStealing += season.baseball.caughtStealing;
        player.careerStats.baseball.gamesStarted += season.baseball.gamesStarted;
        player.careerStats.baseball.inningsPitched += season.baseball.inningsPitched;
        player.careerStats.baseball.hitsAllowed += season.baseball.hitsAllowed;
        player.careerStats.baseball.runsAllowed += season.baseball.runsAllowed;
        player.careerStats.baseball.earnedRuns += season.baseball.earnedRuns;
        player.careerStats.baseball.walksAllowed += season.baseball.walksAllowed;
        player.careerStats.baseball.strikeoutsThrown += season.baseball.strikeoutsThrown;
        player.careerStats.baseball.homeRunsAllowed += season.baseball.homeRunsAllowed;
        player.careerStats.baseball.wins += season.baseball.wins;
        player.careerStats.baseball.losses += season.baseball.losses;
        player.careerStats.baseball.saves += season.baseball.saves;
        player.careerStats.baseball.putouts += season.baseball.putouts;
        player.careerStats.baseball.assists += season.baseball.assists;
        player.careerStats.baseball.errors += season.baseball.errors;
      }

      // Aggregate soccer stats
      if (season.soccer && player.careerStats.soccer) {
        player.careerStats.soccer.goals += season.soccer.goals;
        player.careerStats.soccer.assists += season.soccer.assists;
        player.careerStats.soccer.shots += season.soccer.shots;
        player.careerStats.soccer.shotsOnTarget += season.soccer.shotsOnTarget;
        player.careerStats.soccer.minutesPlayed += season.soccer.minutesPlayed;
        player.careerStats.soccer.yellowCards += season.soccer.yellowCards;
        player.careerStats.soccer.redCards += season.soccer.redCards;
        if (season.soccer.saves !== undefined) {
          player.careerStats.soccer.saves = (player.careerStats.soccer.saves || 0) + season.soccer.saves;
        }
        if (season.soccer.cleanSheets !== undefined) {
          player.careerStats.soccer.cleanSheets = (player.careerStats.soccer.cleanSheets || 0) + season.soccer.cleanSheets;
        }
        if (season.soccer.goalsAgainst !== undefined) {
          player.careerStats.soccer.goalsAgainst = (player.careerStats.soccer.goalsAgainst || 0) + season.soccer.goalsAgainst;
        }
      }

      // Aggregate games/minutes/points
      player.careerStats.gamesPlayed.basketball += season.gamesPlayed.basketball;
      player.careerStats.gamesPlayed.baseball += season.gamesPlayed.baseball;
      player.careerStats.gamesPlayed.soccer += season.gamesPlayed.soccer;
      player.careerStats.minutesPlayed.basketball += season.minutesPlayed.basketball;
      player.careerStats.minutesPlayed.baseball += season.minutesPlayed.baseball;
      player.careerStats.minutesPlayed.soccer += season.minutesPlayed.soccer;
      player.careerStats.totalPoints.basketball += season.totalPoints.basketball;
      player.careerStats.totalPoints.baseball += season.totalPoints.baseball;
      player.careerStats.totalPoints.soccer += season.totalPoints.soccer;
    }
  }

  return player;
}

/** Roster size (35 players: 7 per position) */
const ROSTER_SIZE = 35;

/** Target percentage of budget to spend on wages (75%) */
const TARGET_WAGE_PERCENTAGE = 0.75;

/**
 * Generate a roster of players for a team
 * Generates 35 players: 7 per position (PG, SG, SF, PF, C)
 *
 * @param teamId - Team ID for contracts
 * @param attrRange - Min/max attribute range for this division
 * @param usedNames - Set of already used names
 * @param teamBudget - Total team budget for salary scaling
 */
function generateRoster(
  teamId: string,
  attrRange: { min: number; max: number },
  usedNames: Set<string>,
  teamBudget: number
): Player[] {
  const players: Player[] = [];

  // Calculate target average salary: 75% of budget divided by roster size
  const targetWageBill = teamBudget * TARGET_WAGE_PERCENTAGE;
  const targetAvgSalary = targetWageBill / ROSTER_SIZE;

  // Generate 7 players at each position = 35 total
  // This provides a full starting 5 + 30 bench players for rotation depth
  const positionCounts = { PG: 7, SG: 7, SF: 7, PF: 7, C: 7 };

  for (const [position, count] of Object.entries(positionCounts)) {
    for (let i = 0; i < count; i++) {
      players.push(generatePlayer(teamId, attrRange, position, usedNames, targetAvgSalary));
    }
  }

  return players;
}

/**
 * Select from weighted distribution
 */
function selectWeighted<T extends { weight: number }>(items: readonly T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[items.length - 1] as T;
}

/**
 * Generate a free agent with specific age
 * Used to create players with controlled age/talent distribution
 */
function generateFreeAgentPlayer(
  age: number,
  attrRange: { min: number; max: number },
  position: string,
  usedNames: Set<string>
): Player {
  const id = uuidv4();
  const nationality = generateNationality();

  // For older players (28+), use standard generation (no youth tracking)
  const height = generateHeight();
  const weight = generateWeight(height);

  const attributes = createRandomAttributes(attrRange.min, attrRange.max, height, weight);
  const potentials = createRandomPotentials(attributes);

  // Generate nationality-appropriate name
  const name = generateName(nationality, usedNames);
  usedNames.add(name);

  // Career start age - ensure it's not greater than current age
  const careerStartAge = Math.min(assignCareerStartAge(), age);

  const player: Player = {
    id,
    name,
    age,
    careerStartAge,
    dateOfBirth: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
    position,
    height,
    weight,
    nationality,
    attributes,
    potentials,
    peakAges: createRandomPeakAges(),
    contract: null, // Free agents have no contract
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    teamId: 'free_agent',
    acquisitionType: 'free_agent',
    acquisitionDate: new Date(),
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    seasonHistory: [],
    // Awards
    awards: {
      playerOfTheWeek: { basketball: 0, baseball: 0, soccer: 0 },
      playerOfTheMonth: { basketball: 0, baseball: 0, soccer: 0 },
      basketballPlayerOfTheYear: 0,
      baseballPlayerOfTheYear: 0,
      soccerPlayerOfTheYear: 0,
      rookieOfTheYear: 0,
      championships: 0,
    },
    // Morale system
    morale: 75,
    recentMatchResults: [],
    transferRequestActive: false,
    transferRequestDate: null,
    weeksDisgruntled: 0,
    // Role expectation system
    ambition: generateAmbition(),
  };

  // Generate career history and aggregate stats
  if (player.age > player.careerStartAge) {
    player.seasonHistory = generateCareerHistory(player, 1);

    // Aggregate career stats from history
    for (const season of player.seasonHistory) {
      // Aggregate basketball stats
      if (season.basketball && player.careerStats.basketball) {
        player.careerStats.basketball.fieldGoalsMade += season.basketball.fieldGoalsMade;
        player.careerStats.basketball.fieldGoalsAttempted += season.basketball.fieldGoalsAttempted;
        player.careerStats.basketball.threePointersMade += season.basketball.threePointersMade;
        player.careerStats.basketball.threePointersAttempted += season.basketball.threePointersAttempted;
        player.careerStats.basketball.freeThrowsMade += season.basketball.freeThrowsMade;
        player.careerStats.basketball.freeThrowsAttempted += season.basketball.freeThrowsAttempted;
        player.careerStats.basketball.rebounds += season.basketball.rebounds;
        player.careerStats.basketball.assists += season.basketball.assists;
        player.careerStats.basketball.steals += season.basketball.steals;
        player.careerStats.basketball.blocks += season.basketball.blocks;
        player.careerStats.basketball.turnovers += season.basketball.turnovers;
      }

      // Aggregate baseball stats
      if (season.baseball && player.careerStats.baseball) {
        player.careerStats.baseball.atBats += season.baseball.atBats;
        player.careerStats.baseball.runs += season.baseball.runs;
        player.careerStats.baseball.hits += season.baseball.hits;
        player.careerStats.baseball.doubles += season.baseball.doubles;
        player.careerStats.baseball.triples += season.baseball.triples;
        player.careerStats.baseball.homeRuns += season.baseball.homeRuns;
        player.careerStats.baseball.rbi += season.baseball.rbi;
        player.careerStats.baseball.walks += season.baseball.walks;
        player.careerStats.baseball.strikeouts += season.baseball.strikeouts;
        player.careerStats.baseball.stolenBases += season.baseball.stolenBases;
        player.careerStats.baseball.caughtStealing += season.baseball.caughtStealing;
        player.careerStats.baseball.gamesStarted += season.baseball.gamesStarted;
        player.careerStats.baseball.inningsPitched += season.baseball.inningsPitched;
        player.careerStats.baseball.hitsAllowed += season.baseball.hitsAllowed;
        player.careerStats.baseball.runsAllowed += season.baseball.runsAllowed;
        player.careerStats.baseball.earnedRuns += season.baseball.earnedRuns;
        player.careerStats.baseball.walksAllowed += season.baseball.walksAllowed;
        player.careerStats.baseball.strikeoutsThrown += season.baseball.strikeoutsThrown;
        player.careerStats.baseball.homeRunsAllowed += season.baseball.homeRunsAllowed;
        player.careerStats.baseball.wins += season.baseball.wins;
        player.careerStats.baseball.losses += season.baseball.losses;
        player.careerStats.baseball.saves += season.baseball.saves;
        player.careerStats.baseball.putouts += season.baseball.putouts;
        player.careerStats.baseball.assists += season.baseball.assists;
        player.careerStats.baseball.errors += season.baseball.errors;
      }

      // Aggregate soccer stats
      if (season.soccer && player.careerStats.soccer) {
        player.careerStats.soccer.goals += season.soccer.goals;
        player.careerStats.soccer.assists += season.soccer.assists;
        player.careerStats.soccer.shots += season.soccer.shots;
        player.careerStats.soccer.shotsOnTarget += season.soccer.shotsOnTarget;
        player.careerStats.soccer.minutesPlayed += season.soccer.minutesPlayed;
        player.careerStats.soccer.yellowCards += season.soccer.yellowCards;
        player.careerStats.soccer.redCards += season.soccer.redCards;
        if (season.soccer.saves !== undefined) {
          player.careerStats.soccer.saves = (player.careerStats.soccer.saves || 0) + season.soccer.saves;
        }
        if (season.soccer.cleanSheets !== undefined) {
          player.careerStats.soccer.cleanSheets = (player.careerStats.soccer.cleanSheets || 0) + season.soccer.cleanSheets;
        }
        if (season.soccer.goalsAgainst !== undefined) {
          player.careerStats.soccer.goalsAgainst = (player.careerStats.soccer.goalsAgainst || 0) + season.soccer.goalsAgainst;
        }
      }

      // Aggregate games/minutes/points
      player.careerStats.gamesPlayed.basketball += season.gamesPlayed.basketball;
      player.careerStats.gamesPlayed.baseball += season.gamesPlayed.baseball;
      player.careerStats.gamesPlayed.soccer += season.gamesPlayed.soccer;
      player.careerStats.minutesPlayed.basketball += season.minutesPlayed.basketball;
      player.careerStats.minutesPlayed.baseball += season.minutesPlayed.baseball;
      player.careerStats.minutesPlayed.soccer += season.minutesPlayed.soccer;
      player.careerStats.totalPoints.basketball += season.totalPoints.basketball;
      player.careerStats.totalPoints.baseball += season.totalPoints.baseball;
      player.careerStats.totalPoints.soccer += season.totalPoints.soccer;
    }
  }

  return player;
}

/**
 * Generate free agents with realistic distributions
 *
 * Key behaviors:
 * - 500 free agents with varying talent levels
 * - Most are older (28-36), young free agents are rare
 * - Young + talented is VERY rare (about 1-2% of pool)
 * - Salary expectations scale with quality and age
 */
function generateFreeAgents(count: number, usedNames: Set<string>): Player[] {
  const players: Player[] = [];

  for (let i = 0; i < count; i++) {
    const position = randomElement(POSITIONS);

    // Select talent tier
    const tier = selectWeighted(FREE_AGENT_TIERS);

    // Select age bracket
    const ageBracket = selectWeighted(FREE_AGENT_AGE_DISTRIBUTION);
    let age = randomInt(ageBracket.ageRange.min, ageBracket.ageRange.max);

    // SPECIAL RULE: Young + Excellent is very rare
    // If we rolled excellent tier AND young age, 80% chance to downgrade
    if (tier.name === 'excellent' && age < 28) {
      if (Math.random() < 0.8) {
        // Downgrade to quality tier instead
        const player = generateFreeAgentPlayer(
          age,
          FREE_AGENT_TIERS[2].attrRange, // quality tier
          position,
          usedNames
        );
        players.push(player);
        continue;
      }
      // 20% chance: they stay excellent and young (the rare gem!)
    }

    // SPECIAL RULE: Young + Quality also somewhat rare
    // If we rolled quality tier AND young age (20-24), 50% chance to downgrade
    if (tier.name === 'quality' && age < 25) {
      if (Math.random() < 0.5) {
        // Downgrade to journeyman tier
        const player = generateFreeAgentPlayer(
          age,
          FREE_AGENT_TIERS[1].attrRange, // journeyman tier
          position,
          usedNames
        );
        players.push(player);
        continue;
      }
    }

    // Generate the player with selected tier and age
    const player = generateFreeAgentPlayer(age, tier.attrRange, position, usedNames);
    players.push(player);
  }

  return players;
}

// =============================================================================
// LINEUP GENERATION
// =============================================================================

/**
 * Calculate baseball-specific score for position assignment
 * Uses attribute weights appropriate for each defensive position
 */
export function calculateBaseballPositionScore(player: Player, position: BaseballPosition): number {
  const attrs = player.attributes;

  switch (position) {
    case 'P':
      // Pitcher: arm strength, stamina, accuracy, composure
      return attrs.arm_strength * 2 + attrs.stamina * 1.5 + attrs.throw_accuracy * 1.5 + attrs.composure;
    case 'C':
      // Catcher: durability, reactions, arm strength, awareness
      return attrs.durability * 1.5 + attrs.reactions * 1.5 + attrs.arm_strength + attrs.awareness;
    case '1B':
      // First base: height-related (grip strength for catching), reactions
      return player.height * 0.5 + attrs.grip_strength * 1.5 + attrs.reactions;
    case '2B':
    case 'SS':
      // Middle infield: agility, reactions, speed, throw accuracy
      return attrs.agility * 1.5 + attrs.reactions * 1.5 + attrs.top_speed + attrs.throw_accuracy;
    case '3B':
      // Third base: reactions, arm strength, bravery
      return attrs.reactions * 2 + attrs.arm_strength * 1.5 + attrs.bravery;
    case 'LF':
    case 'RF':
      // Corner outfield: speed, arm strength, reactions
      return attrs.top_speed * 1.5 + attrs.arm_strength * 1.5 + attrs.acceleration + attrs.reactions;
    case 'CF':
      // Center field: speed and range
      return attrs.top_speed * 2 + attrs.acceleration * 1.5 + attrs.agility + attrs.reactions;
    case 'DH':
      // DH: hitting attributes (using hand-eye, composure, patience for batting)
      return attrs.hand_eye_coordination * 2 + attrs.composure * 1.5 + attrs.patience + attrs.grip_strength;
    default:
      return calculatePlayerOverall(player);
  }
}

/**
 * Generate optimal baseball lineup from roster
 * Assigns positions based on attributes and creates batting order by overall rating
 */
function generateBaseballLineup(
  rosterIds: string[],
  players: Record<string, Player>
): BaseballLineupConfig {
  // Get player objects and sort by overall rating
  const rosterPlayers = rosterIds
    .map((id) => players[id])
    .filter((p): p is Player => p !== undefined)
    .map((p) => ({ player: p, overall: calculatePlayerOverall(p) }))
    .sort((a, b) => b.overall - a.overall);

  // First, find the best pitcher from the entire roster
  let bestPitcher: Player | null = null;
  let bestPitcherScore = -Infinity;
  for (const { player } of rosterPlayers) {
    const score = calculateBaseballPositionScore(player, 'P');
    if (score > bestPitcherScore) {
      bestPitcherScore = score;
      bestPitcher = player;
    }
  }

  const startingPitcher = bestPitcher?.id ?? rosterPlayers[0]?.player.id ?? '';
  const positions: Record<string, BaseballPosition> = {};
  positions[startingPitcher] = 'P';

  // Get batting candidates (EXCLUDE the pitcher - DH rule)
  const battingCandidates = rosterPlayers.filter(({ player }) => player.id !== startingPitcher);

  // Take top 9 players for batting order
  const battingPlayers = battingCandidates.slice(0, 9);

  // Defensive positions to fill (excluding P which is already assigned, and DH which doesn't field)
  const defensivePositions: BaseballPosition[] = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
  const assignedPlayers = new Set<string>([startingPitcher]);

  // Assign defensive positions to 8 of the 9 batters
  for (const pos of defensivePositions) {
    let bestPlayer: Player | null = null;
    let bestScore = -Infinity;

    for (const { player } of battingPlayers) {
      if (assignedPlayers.has(player.id)) continue;

      const score = calculateBaseballPositionScore(player, pos);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }

    if (bestPlayer) {
      positions[bestPlayer.id] = pos;
      assignedPlayers.add(bestPlayer.id);
    }
  }

  // The remaining batter (not assigned a defensive position) is the DH
  for (const { player } of battingPlayers) {
    if (!positions[player.id]) {
      positions[player.id] = 'DH';
      break;
    }
  }

  // Batting order is the 9 batters (pitcher NOT included - DH bats instead)
  const battingOrder = battingPlayers.map(({ player }) => player.id);

  // Build bullpen from remaining pitchers (players not in batting order or starting pitcher)
  // Sort by pitching attributes (arm_strength, stamina, throw_accuracy)
  const usedPlayerIds = new Set([startingPitcher, ...battingOrder]);
  const bullpenCandidates = rosterPlayers
    .filter(({ player }) => !usedPlayerIds.has(player.id))
    .map(({ player }) => ({
      player,
      pitchingScore: calculateBaseballPositionScore(player, 'P'),
    }))
    .sort((a, b) => b.pitchingScore - a.pitchingScore);

  // Assign bullpen roles: 2 long relievers, 4 short relievers, 1 closer
  // Best pitching score goes to closer, next 4 to short relievers, next 2 to long relievers
  const bullpen = {
    longRelievers: [
      bullpenCandidates[5]?.player.id ?? '',
      bullpenCandidates[6]?.player.id ?? '',
    ] as [string, string],
    shortRelievers: [
      bullpenCandidates[1]?.player.id ?? '',
      bullpenCandidates[2]?.player.id ?? '',
      bullpenCandidates[3]?.player.id ?? '',
      bullpenCandidates[4]?.player.id ?? '',
    ] as [string, string, string, string],
    closer: bullpenCandidates[0]?.player.id ?? '',
  };

  return {
    battingOrder,
    positions,
    startingPitcher,
    bullpen,
  };
}

/**
 * Generate soccer lineup from roster
 * Simple: top 11 players by overall, default 4-4-2 formation
 */
function generateSoccerLineup(
  rosterIds: string[],
  players: Record<string, Player>
): SoccerLineupConfig {
  // Get player objects and sort by overall rating
  const rosterPlayers = rosterIds
    .map((id) => players[id])
    .filter((p): p is Player => p !== undefined)
    .map((p) => ({ player: p, overall: calculatePlayerOverall(p) }))
    .sort((a, b) => b.overall - a.overall);

  // Take top 11 for starting lineup
  const starters = rosterPlayers.slice(0, 11).map(({ player }) => player.id);

  // Assign positions by slot index (0-10 for 4-4-2)
  const positions: Record<string, number> = {};
  starters.forEach((playerId, idx) => {
    positions[playerId] = idx;
  });

  return {
    starters,
    formation: '4-4-2',
    positions,
  };
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validation result for lineup checks
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate baseball lineup before simulation
 * DH Rule: Pitcher does NOT bat - 9 batters (including DH) + pitcher on defense
 * Checks: minimum players, pitcher on roster, defensive positions, no duplicates
 */
export function validateBaseballLineup(
  lineup: BaseballLineupConfig,
  roster: Player[]
): ValidationResult {
  const rosterIds = new Set(roster.map(p => p.id));

  // 1. Check minimum players in batting order (9 batters, NOT including pitcher with DH rule)
  const validBatters = lineup.battingOrder.filter(id => rosterIds.has(id));
  if (validBatters.length < 9) {
    return {
      valid: false,
      error: `Need at least 9 batters for baseball (have ${validBatters.length})`
    };
  }

  // 2. Check starting pitcher exists on roster (but NOT in batting order - DH rule)
  if (!lineup.startingPitcher) {
    return { valid: false, error: 'No starting pitcher assigned' };
  }
  if (!rosterIds.has(lineup.startingPitcher)) {
    return { valid: false, error: 'Starting pitcher not on roster' };
  }
  // With DH rule, pitcher should NOT be in batting order
  if (validBatters.includes(lineup.startingPitcher)) {
    return { valid: false, error: 'With DH rule, pitcher should not be in batting order' };
  }

  // 3. Check all 9 defensive positions are assigned (pitcher must be at P)
  const REQUIRED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const assignedPositions = new Set(
    Object.entries(lineup.positions)
      .filter(([playerId, pos]) => pos !== 'DH' && rosterIds.has(playerId))
      .map(([, pos]) => pos)
  );

  const missingPositions = REQUIRED_POSITIONS.filter(p => !assignedPositions.has(p as BaseballPosition));
  if (missingPositions.length > 0) {
    return {
      valid: false,
      error: `Missing defensive positions: ${missingPositions.join(', ')}`
    };
  }

  // 4. Check no duplicate position assignments (except DH)
  const positionCounts: Record<string, number> = {};
  for (const [playerId, pos] of Object.entries(lineup.positions)) {
    if (pos !== 'DH' && rosterIds.has(playerId)) {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      if (positionCounts[pos] > 1) {
        return { valid: false, error: `Duplicate assignment for position: ${pos}` };
      }
    }
  }

  // 5. Pitcher at P position matches startingPitcher
  const pitcherAtP = Object.entries(lineup.positions).find(([, pos]) => pos === 'P')?.[0];
  if (pitcherAtP !== lineup.startingPitcher) {
    return { valid: false, error: 'Starting pitcher must be assigned to P position' };
  }

  return { valid: true };
}

/**
 * Validate basketball lineup before simulation
 * Checks: minimum 5 valid starters
 */
export function validateBasketballLineup(
  starters: string[],
  roster: Player[]
): ValidationResult {
  const rosterIds = new Set(roster.map(p => p.id));
  const validStarters = starters.filter(id => rosterIds.has(id));

  if (validStarters.length < 5) {
    return {
      valid: false,
      error: `Need at least 5 players for basketball (have ${validStarters.length})`
    };
  }

  return { valid: true };
}

/**
 * Regenerate basketball lineup from remaining roster
 * Used after player release to maintain valid lineup
 */
export function regenerateBasketballLineup(
  currentLineup: LineupConfig,
  remainingRosterIds: string[],
  players: Record<string, Player>
): LineupConfig {
  const validIds = remainingRosterIds.filter(id => players[id]);
  const sorted = validIds
    .map(id => ({ id, overall: calculatePlayerOverall(players[id]!) }))
    .sort((a, b) => b.overall - a.overall);

  // Top 5 become starters
  const starters = sorted.slice(0, 5).map(p => p.id);
  const bench = sorted.slice(5).map(p => p.id);

  // Validate before cast - throws if < 5 players
  if (starters.length < 5) {
    throw new Error(`Cannot create basketball lineup: need 5 starters (have ${starters.length})`);
  }

  return {
    ...currentLineup,
    basketballStarters: starters as [string, string, string, string, string],
    bench,
  };
}

// =============================================================================
// TEAM GENERATION
// =============================================================================

/**
 * Create user team state
 */
function createUserTeam(
  config: NewGameConfig,
  rosterIds: string[],
  players: Record<string, Player>,
  totalSalary: number
): UserTeamState {
  const startingDivision = (config.startingDivision || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  // Calculate budget: BASE × divisionMultiplier × difficultyMultiplier
  const divisionMultiplier = getDivisionBudgetMultiplier(startingDivision);
  const difficultyMultiplier = DIFFICULTY_BUDGET_MULTIPLIER[config.difficulty];
  const totalBudget = Math.round(BASE_BUDGET * divisionMultiplier * difficultyMultiplier);

  // Generate sport-specific lineups
  const baseballLineup = generateBaseballLineup(rosterIds, players);
  const soccerLineup = generateSoccerLineup(rosterIds, players);

  // Basketball: pick 5 starters by overall rating (top 5 who aren't duplicated)
  const sortedByOverall = rosterIds
    .map((id) => ({ id, overall: players[id] ? calculatePlayerOverall(players[id]) : 0 }))
    .sort((a, b) => b.overall - a.overall);

  const basketballStarters = sortedByOverall
    .slice(0, 5)
    .map(({ id }) => id) as [string, string, string, string, string];

  // Bench is top 9 non-starters by overall (rest are reserves)
  const startersSet = new Set(basketballStarters);
  const bench = sortedByOverall
    .filter(({ id }) => !startersSet.has(id))
    .slice(0, 9)
    .map(({ id }) => id);

  return {
    id: 'user',
    name: config.teamName,
    colors: {
      primary: config.primaryColor,
      secondary: config.secondaryColor,
    },
    country: config.country,
    city: config.city,
    cityRegion: config.cityRegion,
    startingDivision,
    division: startingDivision,
    totalBudget,
    salaryCommitment: totalSalary,
    availableBudget: totalBudget - totalSalary,
    operationsBudget: DEFAULT_OPERATIONS_BUDGET,
    rosterIds,
    lineup: {
      basketballStarters,
      basketballFormation: '2-2-1',
      baseballLineup,
      soccerLineup,
      bench,
      minutesAllocation: {},
      soccerMinutesAllocation: {},
    },
    gamedayLineup: null,
    trainingFocus: DEFAULT_TRAINING_FOCUS,
    tactics: createDefaultTacticalSettings(),
    baseballStrategy: DEFAULT_BASEBALL_STRATEGY,
    shortlistedPlayerIds: [],
    transferListPlayerIds: [],
    transferListAskingPrices: {},
  };
}

/**
 * Generate random team colors
 */
function generateTeamColors(): { primary: string; secondary: string } {
  const primaryColors = [
    '#1D428A', '#552583', '#CE1141', '#007A33', '#98002E',
    '#007AC1', '#C4CED4', '#00538C', '#E03A3E', '#1D1160',
    '#006BB6', '#000000', '#0E2240', '#002B5C', '#C8102E',
    '#5A2D81', '#0C2340', '#2D3436', '#6C5CE7', '#00B894',
  ];
  const secondaryColors = [
    '#FFC72C', '#FDB927', '#000000', '#FFFFFF', '#F9A01B',
    '#EF3B24', '#F58426', '#002B5E', '#C1D32F', '#E56020',
    '#FEC524', '#00471B', '#C8102E', '#63727A', '#F9A825',
  ];

  return {
    primary: randomElement(primaryColors),
    secondary: randomElement(secondaryColors),
  };
}

/**
 * Create AI team state from a TeamAssignment
 */
function createAITeam(
  teamAssignment: TeamAssignment,
  rosterIds: string[],
  salaryCommitment: number,
  index: number
): AITeamState {
  const personalities = ['conservative', 'balanced', 'aggressive'] as const;

  // Calculate budget based on division
  const divisionMultiplier = getDivisionBudgetMultiplier(teamAssignment.division);
  const totalBudget = Math.round(BASE_BUDGET * divisionMultiplier);
  // Available = total minus actual salary commitment
  const availableBudget = Math.max(0, totalBudget - salaryCommitment);

  return {
    id: `ai-team-${index}`,
    name: teamAssignment.teamName,
    colors: generateTeamColors(),
    city: teamAssignment.city.name,
    cityRegion: teamAssignment.city.region,
    division: teamAssignment.division as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    rosterIds,
    aiConfig: createAIConfig(randomElement(personalities)),
    budget: {
      total: totalBudget,
      available: availableBudget,
    },
  };
}

// =============================================================================
// AI TEAM STRATEGY GENERATION
// =============================================================================

/**
 * Generate a randomized baseball strategy for an AI team
 * Stays consistent throughout the season
 */
function generateRandomBaseballStrategy(): BaseballGameStrategy {
  const plateApproaches: PlateApproach[] = ['balanced', 'aggressive', 'patient'];
  const swingStyles: SwingStyle[] = ['balanced', 'power', 'contact'];
  const baserunningStyles: BaserunningStyle[] = ['balanced', 'aggressive', 'conservative'];

  return {
    pitching: {
      ...DEFAULT_PITCHING_STRATEGY,
      // Randomize some pitching settings
      quickHookEnabled: Math.random() < 0.3,
      longLeashEnabled: Math.random() < 0.3,
    },
    batting: {
      plateApproach: randomElement(plateApproaches),
      swingStyle: randomElement(swingStyles),
      baserunningStyle: randomElement(baserunningStyles),
    },
  };
}

/**
 * Generate a randomized soccer strategy for an AI team
 * Stays consistent throughout the season
 */
function generateRandomSoccerStrategy(): { attackingStyle: 'possession' | 'direct' | 'counter'; pressing: 'high' | 'balanced' | 'low'; width: 'wide' | 'balanced' | 'tight' } {
  const attackingStyles: Array<'possession' | 'direct' | 'counter'> = ['possession', 'direct', 'counter'];
  const pressingOptions: Array<'high' | 'balanced' | 'low'> = ['high', 'balanced', 'low'];
  const widthOptions: Array<'wide' | 'balanced' | 'tight'> = ['wide', 'balanced', 'tight'];

  return {
    attackingStyle: randomElement(attackingStyles),
    pressing: randomElement(pressingOptions),
    width: randomElement(widthOptions),
  };
}

/**
 * Generate a randomized basketball strategy for an AI team
 * Stays consistent throughout the season
 */
function generateRandomBasketballStrategy(): { pace: 'fast' | 'standard' | 'slow'; defense: 'man' | 'mixed' | 'zone'; rebounding: 'crash_glass' | 'standard' | 'prevent_transition' } {
  const paceOptions: Array<'fast' | 'standard' | 'slow'> = ['fast', 'standard', 'slow'];
  const defenseOptions: Array<'man' | 'mixed' | 'zone'> = ['man', 'mixed', 'zone'];
  const reboundingOptions: Array<'crash_glass' | 'standard' | 'prevent_transition'> = ['crash_glass', 'standard', 'prevent_transition'];

  return {
    pace: randomElement(paceOptions),
    defense: randomElement(defenseOptions),
    rebounding: randomElement(reboundingOptions),
  };
}

/**
 * Generate AI team strategies for all teams in the league
 */
function generateAITeamStrategies(teamIds: string[]): Record<string, AITeamSeasonStrategy> {
  const strategies: Record<string, AITeamSeasonStrategy> = {};

  for (const teamId of teamIds) {
    // Skip user team - they choose their own strategies
    if (teamId === 'user') continue;

    strategies[teamId] = {
      baseball: generateRandomBaseballStrategy(),
      soccer: generateRandomSoccerStrategy(),
      basketball: generateRandomBasketballStrategy(),
    };
  }

  return strategies;
}

// =============================================================================
// SEASON GENERATION
// =============================================================================

/**
 * Create season state with schedule
 */
function createSeasonState(teamIds: string[]): SeasonState {
  const seasonId = uuidv4();

  // Generate schedule
  const schedule = generateSeasonSchedule(teamIds, seasonId, {
    totalWeeks: SEASON_WEEKS,
    startDate: new Date(),
  });

  // Create initial standings
  const standings = createInitialStandings(teamIds);

  // Generate AI team strategies for the season
  const aiTeamStrategies = generateAITeamStrategies(teamIds);

  return {
    id: seasonId,
    number: 1,
    currentWeek: 1,
    status: 'regular_season',
    transferWindowOpen: true,
    matches: schedule.matches,
    standings,
    aiTeamStrategies,
  };
}

// =============================================================================
// MAIN INITIALIZATION
// =============================================================================

/**
 * Get attribute range based on division
 * Higher divisions = better players
 */
function getDivisionAttrRange(division: number): { min: number; max: number } {
  // Division 1 = best (60-90), Division 10 = worst (15-40)
  const ranges: { [key: number]: { min: number; max: number } } = {
    1: { min: 60, max: 90 },
    2: { min: 55, max: 85 },
    3: { min: 50, max: 80 },
    4: { min: 45, max: 75 },
    5: { min: 40, max: 70 },
    6: { min: 35, max: 65 },
    7: { min: 30, max: 55 },
    8: { min: 25, max: 50 },
    9: { min: 20, max: 45 },
    10: { min: 15, max: 40 },
  };
  return ranges[division] ?? { min: 30, max: 55 };
}

/**
 * Initialize a new game
 *
 * @param config - New game configuration from onboarding
 * @returns Initial game state payload
 */
export function initializeNewGame(config: NewGameConfig): InitializeGamePayload {
  console.time('initializeNewGame');
  const usedNames = new Set<string>();
  const players: Record<string, Player> = {};

  // Get user's starting division
  const userDivision = config.startingDivision || 7;

  // Calculate division budget for salary scaling (user gets difficulty modifier)
  const userDivisionMultiplier = getDivisionBudgetMultiplier(userDivision);
  const difficultyMultiplier = DIFFICULTY_BUDGET_MULTIPLIER[config.difficulty];
  const userTeamBudget = Math.round(BASE_BUDGET * userDivisionMultiplier * difficultyMultiplier);

  // Generate all league teams from the country's cities (200 teams across 10 divisions)
  console.time('generateLeagueTeams');
  const allTeamAssignments = generateLeagueTeams(config.country);
  console.timeEnd('generateLeagueTeams');

  // Validate we have the expected number of teams
  const expectedTeams = DIVISION_COUNT * TEAMS_PER_DIVISION;
  if (allTeamAssignments.length !== expectedTeams) {
    console.warn(`Expected ${expectedTeams} team assignments, got ${allTeamAssignments.length}`);
  }

  // Generate user team roster with division-appropriate attributes and budget-scaled salaries
  const userAttrRange = getDivisionAttrRange(userDivision);
  console.time('generateUserRoster');
  const userPlayers = generateRoster('user', userAttrRange, usedNames, userTeamBudget);
  console.timeEnd('generateUserRoster');
  const userRosterIds = userPlayers.map((p) => p.id);

  // Calculate user team salary
  let userTotalSalary = 0;
  for (const player of userPlayers) {
    players[player.id] = player;
    userTotalSalary += player.contract?.salary || 0;
  }

  // Create user team (passing players for lineup generation)
  const userTeam = createUserTeam(config, userRosterIds, players, userTotalSalary);

  // Generate ALL AI teams across ALL divisions (199 AI teams total)
  const aiTeams: AITeamState[] = [];
  const teamIds = ['user'];
  let globalTeamIndex = 0;

  console.time('generateAllAITeams');
  for (let division = 1; division <= DIVISION_COUNT; division++) {
    // Get teams for this division
    const divisionTeams = allTeamAssignments.filter(t => t.division === division);

    // For user's division, exclude the user's city
    const aiTeamAssignments = division === userDivision
      ? divisionTeams.filter(
          t => !(t.city.name === config.city && t.city.region === config.cityRegion)
        )
      : divisionTeams;

    // Calculate budget for this division (no difficulty modifier for AI)
    const divisionMultiplier = getDivisionBudgetMultiplier(division);
    const aiTeamBudget = Math.round(BASE_BUDGET * divisionMultiplier);

    // Get attribute range for this division
    const divisionAttrRange = getDivisionAttrRange(division);

    // Create teams for this division
    // User's division gets 19 AI teams (user is the 20th), others get 20
    const teamsToCreate = division === userDivision
      ? TEAMS_PER_DIVISION - 1
      : TEAMS_PER_DIVISION;

    for (let i = 0; i < teamsToCreate && i < aiTeamAssignments.length; i++) {
      const teamAssignment = aiTeamAssignments[i];
      if (!teamAssignment) continue; // Safety check for TypeScript

      // Use global index for unique team IDs across all divisions
      const teamId = `ai-team-${globalTeamIndex}`;

      // Generate roster with division-appropriate attributes and budget-scaled salaries
      const aiPlayers = generateRoster(teamId, divisionAttrRange, usedNames, aiTeamBudget);
      const aiRosterIds = aiPlayers.map((p) => p.id);

      // Calculate salary commitment for this team
      let aiTeamSalary = 0;
      for (const player of aiPlayers) {
        // Update player's teamId reference
        player.teamId = teamId;
        player.contract = player.contract
          ? { ...player.contract, teamId }
          : null;
        players[player.id] = player;
        aiTeamSalary += player.contract?.salary || 0;
      }

      // Create AI team with correct division and actual salary commitment
      const aiTeam = createAITeam(teamAssignment, aiRosterIds, aiTeamSalary, globalTeamIndex);
      aiTeams.push(aiTeam);
      teamIds.push(teamId);
      globalTeamIndex++;
    }
  }
  console.timeEnd('generateAllAITeams');

  console.log(`Created ${aiTeams.length} AI teams across ${DIVISION_COUNT} divisions`);
  console.log(`Total players: ${Object.keys(players).length}`);

  // Generate free agents
  console.time('generateFreeAgents');
  const freeAgents = generateFreeAgents(FREE_AGENT_COUNT, usedNames);
  const freeAgentIds: string[] = [];
  for (const player of freeAgents) {
    players[player.id] = player;
    freeAgentIds.push(player.id);
  }
  console.timeEnd('generateFreeAgents');

  // Create league state
  const league: LeagueState = {
    country: config.country,
    teams: aiTeams,
    freeAgentIds,
  };

  // Create season with schedule (only teams in user's division play each other)
  // Other divisions simulate in background
  const userDivisionTeamIds = teamIds.filter(id => {
    if (id === 'user') return true;
    const team = aiTeams.find(t => t.id === id);
    return team?.division === userDivision;
  });
  console.time('createSeasonState');
  const season = createSeasonState(userDivisionTeamIds);
  console.timeEnd('createSeasonState');

  console.timeEnd('initializeNewGame');

  return {
    config,
    userTeam,
    players,
    league,
    season,
  };
}

/**
 * Get overall rating for a player (simplified calculation)
 */
export function calculatePlayerOverall(player: Player): number {
  const attrs = player.attributes || {};

  // Helper to safely get attribute value
  const get = (key: keyof PlayerAttributes): number => (attrs as PlayerAttributes)[key] ?? 0;

  // Physical average
  const physical = (
    get('grip_strength') +
    get('arm_strength') +
    get('core_strength') +
    get('agility') +
    get('acceleration') +
    get('top_speed') +
    get('jumping') +
    get('reactions') +
    get('stamina') +
    get('balance') +
    get('durability')
  ) / 11;

  // Mental average
  const mental = (
    get('awareness') +
    get('creativity') +
    get('determination') +
    get('bravery') +
    get('consistency') +
    get('composure') +
    get('patience')
  ) / 7;

  // Technical average
  const technical = (
    get('hand_eye_coordination') +
    get('throw_accuracy') +
    get('form_technique') +
    get('finesse') +
    get('deception') +
    get('teamwork')
  ) / 6;

  // Weighted average (technical most important for basketball)
  return Math.round((physical * 0.3 + mental * 0.3 + technical * 0.4));
}

// Re-export soccer position utilities from their proper location
// (kept here for backward compatibility)
export {
  SoccerPositionType,
  getSoccerPositionType,
  calculateSoccerPositionOverall,
} from '../../simulation/soccer/utils/positionRatings';

export default initializeNewGame;
