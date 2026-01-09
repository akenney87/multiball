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
import type { Player, Contract, YouthPhysicalDevelopment } from '../../data/types';
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
import type { NewGameConfig, Difficulty } from '../screens/NewGameScreen';
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
} from '../../data/factories';
import { generateName } from '../../data/nameGenerator';
import { createAIConfig } from '../../ai/personality';
import { generateSeasonSchedule, createInitialStandings } from '../../season';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of AI teams (plus user = 20 total) */
const AI_TEAM_COUNT = 19;

/** Starting budget based on difficulty */
const STARTING_BUDGET: Record<Difficulty, number> = {
  easy: 25000000,    // $25M
  normal: 20000000,  // $20M
  hard: 15000000,    // $15M
};

/** Player attribute range based on difficulty (user team) */
const USER_ATTR_RANGE: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 40, max: 70 },
  normal: { min: 30, max: 60 },
  hard: { min: 20, max: 50 },
};

/** AI team attribute range (slightly better than user on hard) */
const AI_ATTR_RANGE: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 25, max: 55 },
  normal: { min: 30, max: 60 },
  hard: { min: 35, max: 65 },
};

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
// TEAM NAMES
// =============================================================================

const TEAM_NAMES = [
  'Warriors', 'Lakers', 'Bulls', 'Celtics', 'Heat',
  'Thunder', 'Rockets', 'Spurs', 'Mavericks', 'Blazers',
  'Suns', 'Knicks', 'Nets', 'Hawks', 'Wizards',
  'Clippers', 'Nuggets', 'Jazz', 'Pelicans', 'Kings',
];

const TEAM_COLORS: Array<{ primary: string; secondary: string }> = [
  { primary: '#1D428A', secondary: '#FFC72C' }, // Warriors
  { primary: '#552583', secondary: '#FDB927' }, // Lakers
  { primary: '#CE1141', secondary: '#000000' }, // Bulls
  { primary: '#007A33', secondary: '#FFFFFF' }, // Celtics
  { primary: '#98002E', secondary: '#F9A01B' }, // Heat
  { primary: '#007AC1', secondary: '#EF3B24' }, // Thunder
  { primary: '#CE1141', secondary: '#000000' }, // Rockets
  { primary: '#C4CED4', secondary: '#000000' }, // Spurs
  { primary: '#00538C', secondary: '#002B5E' }, // Mavericks
  { primary: '#E03A3E', secondary: '#000000' }, // Blazers
  { primary: '#1D1160', secondary: '#E56020' }, // Suns
  { primary: '#006BB6', secondary: '#F58426' }, // Knicks
  { primary: '#000000', secondary: '#FFFFFF' }, // Nets
  { primary: '#E03A3E', secondary: '#C1D32F' }, // Hawks
  { primary: '#002B5C', secondary: '#E31837' }, // Wizards
  { primary: '#C8102E', secondary: '#1D428A' }, // Clippers
  { primary: '#0E2240', secondary: '#FEC524' }, // Nuggets
  { primary: '#002B5C', secondary: '#00471B' }, // Jazz
  { primary: '#0C2340', secondary: '#C8102E' }, // Pelicans
  { primary: '#5A2D81', secondary: '#63727A' }, // Kings
];

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
 */
function generatePlayer(
  teamId: string,
  attrRange: { min: number; max: number },
  position: string,
  usedNames: Set<string>,
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

  // Calculate market-based salary (same formula as free agents)
  // Market Value = (rating / 100) × $1M × ageMultiplier × potentialModifier
  let ageMultiplier: number;
  if (age < 23) {
    ageMultiplier = 1.5;  // Young
  } else if (age < 29) {
    ageMultiplier = 2.0;  // Prime
  } else if (age < 33) {
    ageMultiplier = 1.5;  // Veteran
  } else {
    ageMultiplier = 1.0;  // Aging
  }

  const avgPotential = (potentials.physical + potentials.mental + potentials.technical) / 3;
  const potentialModifier = 1.0 + (avgPotential - overallRating) / 100;
  const marketValue = (overallRating / 100) * 1000000 * ageMultiplier * potentialModifier;
  const baseSalary = marketValue * 0.20; // 20% of market value

  // Add small variance (±15%) for realism
  const variance = 0.85 + Math.random() * 0.30; // 0.85 to 1.15
  const salary = Math.round(baseSalary * variance);

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

  return {
    id,
    name,
    age,
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
    // Season history (empty for new players)
    seasonHistory: [],
  };
}

/**
 * Generate a roster of players for a team
 * Generates 35 players: 7 per position (PG, SG, SF, PF, C)
 */
function generateRoster(
  teamId: string,
  attrRange: { min: number; max: number },
  usedNames: Set<string>
): Player[] {
  const players: Player[] = [];

  // Generate 7 players at each position = 35 total
  // This provides a full starting 5 + 30 bench players for rotation depth
  const positionCounts = { PG: 7, SG: 7, SF: 7, PF: 7, C: 7 };

  for (const [position, count] of Object.entries(positionCounts)) {
    for (let i = 0; i < count; i++) {
      players.push(generatePlayer(teamId, attrRange, position, usedNames));
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

  return {
    id,
    name,
    age,
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
  };
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

  // Assign bullpen roles: 2 long relievers, 2 short relievers, 1 closer
  // Best pitching score goes to closer, next 2 to short relievers, next 2 to long relievers
  const bullpen = {
    longRelievers: [
      bullpenCandidates[3]?.player.id ?? '',
      bullpenCandidates[4]?.player.id ?? '',
    ] as [string, string],
    shortRelievers: [
      bullpenCandidates[1]?.player.id ?? '',
      bullpenCandidates[2]?.player.id ?? '',
    ] as [string, string],
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
  const totalBudget = STARTING_BUDGET[config.difficulty];

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
    division: 5,
    totalBudget,
    salaryCommitment: totalSalary,
    availableBudget: totalBudget - totalSalary,
    operationsBudget: DEFAULT_OPERATIONS_BUDGET,
    rosterIds,
    lineup: {
      basketballStarters,
      baseballLineup,
      soccerLineup,
      bench,
      minutesAllocation: {},
    },
    trainingFocus: DEFAULT_TRAINING_FOCUS,
    tactics: createDefaultTacticalSettings(),
    baseballStrategy: DEFAULT_BASEBALL_STRATEGY,
    shortlistedPlayerIds: [],
    transferListPlayerIds: [],
    transferListAskingPrices: {},
  };
}

/**
 * Create AI team state
 */
function createAITeam(
  index: number,
  rosterIds: string[]
): AITeamState {
  const personalities = ['conservative', 'balanced', 'aggressive'] as const;

  return {
    id: `ai-team-${index}`,
    name: TEAM_NAMES[index] || `Team ${index + 1}`,
    colors: TEAM_COLORS[index] || { primary: '#333333', secondary: '#FFFFFF' },
    division: 5,
    rosterIds,
    aiConfig: createAIConfig(randomElement(personalities)),
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
 * Initialize a new game
 *
 * @param config - New game configuration from onboarding
 * @returns Initial game state payload
 */
export function initializeNewGame(config: NewGameConfig): InitializeGamePayload {
  const usedNames = new Set<string>();
  const players: Record<string, Player> = {};

  // Generate user team roster
  const userAttrRange = USER_ATTR_RANGE[config.difficulty];
  const userPlayers = generateRoster('user', userAttrRange, usedNames);
  const userRosterIds = userPlayers.map((p) => p.id);

  // Calculate user team salary
  let userTotalSalary = 0;
  for (const player of userPlayers) {
    players[player.id] = player;
    userTotalSalary += player.contract?.salary || 0;
  }

  // Create user team (passing players for lineup generation)
  const userTeam = createUserTeam(config, userRosterIds, players, userTotalSalary);

  // Generate AI teams
  const aiAttrRange = AI_ATTR_RANGE[config.difficulty];
  const aiTeams: AITeamState[] = [];
  const teamIds = ['user'];

  for (let i = 0; i < AI_TEAM_COUNT; i++) {
    const teamId = `ai-team-${i}`;
    const aiPlayers = generateRoster(teamId, aiAttrRange, usedNames);
    const aiRosterIds = aiPlayers.map((p) => p.id);

    for (const player of aiPlayers) {
      // Update player's teamId reference
      player.teamId = teamId;
      player.contract = player.contract
        ? { ...player.contract, teamId }
        : null;
      players[player.id] = player;
    }

    aiTeams.push(createAITeam(i, aiRosterIds));
    teamIds.push(teamId);
  }

  // Generate free agents
  const freeAgents = generateFreeAgents(FREE_AGENT_COUNT, usedNames);
  const freeAgentIds: string[] = [];
  for (const player of freeAgents) {
    players[player.id] = player;
    freeAgentIds.push(player.id);
  }

  // Create league state
  const league: LeagueState = {
    teams: aiTeams,
    freeAgentIds,
  };

  // Create season with schedule
  const season = createSeasonState(teamIds);

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
  const attrs = player.attributes;

  // Physical average
  const physical = (
    attrs.grip_strength +
    attrs.arm_strength +
    attrs.core_strength +
    attrs.agility +
    attrs.acceleration +
    attrs.top_speed +
    attrs.jumping +
    attrs.reactions +
    attrs.stamina +
    attrs.balance +
    attrs.durability
  ) / 11;

  // Mental average
  const mental = (
    attrs.awareness +
    attrs.creativity +
    attrs.determination +
    attrs.bravery +
    attrs.consistency +
    attrs.composure +
    attrs.patience
  ) / 7;

  // Technical average
  const technical = (
    attrs.hand_eye_coordination +
    attrs.throw_accuracy +
    attrs.form_technique +
    attrs.finesse +
    attrs.deception +
    attrs.teamwork
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
