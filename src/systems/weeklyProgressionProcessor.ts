/**
 * Weekly Progression Processor
 *
 * Orchestrates the existing training and regression systems.
 * Called during advanceWeek() to process all roster players.
 *
 * Order of operations:
 * 1. Apply regression first (age-based decline)
 * 2. Apply training second (XP accumulation and gains)
 *
 * This ensures older players can still train but decline outpaces growth.
 */

import type { Player, TrainingFocus, AttributeSnapshot, PlayerAttributes, LegacyTrainingFocus } from '../data/types';
import { isLegacyTrainingFocus } from '../data/types';
import type { AcademyProspect } from './youthAcademySystem';
import {
  calculateBasketballOverall,
  calculateBaseballOverall,
  calculateSoccerOverall,
  calculateSimpleOverall,
} from '../utils/overallRating';
import {
  calculateWeeklyXP,
  applyWeeklyTraining,
  DEFAULT_TRAINING_FOCUS,
  type WeeklyXP,
  type AttributeImprovement,
} from './trainingSystem';
import {
  applyWeeklyRegression,
  processYearlyPhysicalGrowth,
  adjustStrengthForWeightGain,
  type AttributeRegressionResult,
  type PhysicalGrowthResult,
} from './playerProgressionSystem';

/**
 * Result of weekly progression for a single player
 */
export interface PlayerProgressionResult {
  playerId: string;
  playerName: string;
  updatedAttributes: Record<string, number>;
  updatedXP: WeeklyXP;
  improvements: AttributeImprovement[];
  regressions: AttributeRegressionResult[];
  /** Attribute snapshot for growth chart (generated after updates) */
  snapshot?: AttributeSnapshot;
}

/**
 * Non-trainable attributes (these should never change from training/regression)
 */
const NON_TRAINABLE_ATTRIBUTES = ['height'];

// Attribute category definitions for calculating averages
const PHYSICAL_ATTRS = [
  'grip_strength', 'arm_strength', 'core_strength', 'agility', 'acceleration',
  'top_speed', 'jumping', 'reactions', 'stamina', 'balance', 'height', 'durability',
];
const MENTAL_ATTRS = [
  'awareness', 'creativity', 'determination', 'bravery',
  'consistency', 'composure', 'patience', 'teamwork',
];
const TECHNICAL_ATTRS = [
  'hand_eye_coordination', 'throw_accuracy', 'form_technique',
  'finesse', 'deception', 'footwork',
];

/**
 * Converts any training focus to legacy format for backwards compatibility
 * New format focuses are converted to balanced legacy format
 */
function toLegacyTrainingFocus(focus: TrainingFocus | null): LegacyTrainingFocus {
  if (!focus) {
    return DEFAULT_TRAINING_FOCUS as LegacyTrainingFocus;
  }
  if (isLegacyTrainingFocus(focus)) {
    return focus;
  }
  // New format - use balanced distribution for legacy system
  // The new per-attribute system will be used when fully implemented
  return DEFAULT_TRAINING_FOCUS as LegacyTrainingFocus;
}

/**
 * Creates an attribute snapshot for growth/regression charts
 *
 * @param attributes - Current player attributes
 * @param gameDay - Current game day
 * @param season - Current season number
 * @returns Attribute snapshot
 */
export function createAttributeSnapshot(
  attributes: Record<string, number>,
  gameDay: number,
  season: number
): AttributeSnapshot {
  // Convert Record to PlayerAttributes for overall calculations
  const playerAttrs = attributes as unknown as PlayerAttributes;

  // Calculate category averages
  const physicalSum = PHYSICAL_ATTRS.reduce((sum, attr) => sum + (attributes[attr] ?? 0), 0);
  const mentalSum = MENTAL_ATTRS.reduce((sum, attr) => sum + (attributes[attr] ?? 0), 0);
  const technicalSum = TECHNICAL_ATTRS.reduce((sum, attr) => sum + (attributes[attr] ?? 0), 0);

  return {
    gameDay,
    season,
    overalls: {
      basketball: calculateBasketballOverall(playerAttrs),
      baseball: calculateBaseballOverall(playerAttrs),
      soccer: calculateSoccerOverall(playerAttrs),
      simple: calculateSimpleOverall(playerAttrs),
    },
    categoryAverages: {
      physical: Math.round(physicalSum / PHYSICAL_ATTRS.length),
      mental: Math.round(mentalSum / MENTAL_ATTRS.length),
      technical: Math.round(technicalSum / TECHNICAL_ATTRS.length),
    },
  };
}

/**
 * Calculates training quality multiplier from actual budget dollars
 *
 * Uses logarithmic scaling so actual spending determines quality, not percentage.
 * A rich Division 1 team spending $500K gets better training than a poor
 * Division 10 team allocating 100% of their $50K budget.
 *
 * @param budgetDollars - Actual training budget in dollars
 * @returns Multiplier (0.5x at $0 to 2.0x at $5M+)
 *
 * Scaling:
 * - $0-$25K: 0.5x (minimal training)
 * - $100K: ~0.74x
 * - $250K: ~1.0x (Division 7 baseline)
 * - $500K: ~1.12x
 * - $1M: ~1.24x
 * - $2.5M: ~1.48x
 * - $5M+: 2.0x (capped - elite training)
 */
export function calculateTrainingQualityMultiplier(budgetDollars: number): number {
  if (budgetDollars <= 0) return 0.5;
  // Logarithmic scale: $25K = 0.5x baseline, scaling up to 2.0x cap
  // log10($250K / $25K) = log10(10) = 1.0 → multiplier = 0.5 + 0.5 = 1.0x
  // log10($2.5M / $25K) = log10(100) = 2.0 → multiplier = 0.5 + 1.0 = 1.5x
  const logValue = Math.log10(Math.max(1, budgetDollars / 25000));
  return 0.5 + Math.min(1.5, 0.5 * logValue);
}

/**
 * Processes weekly progression for a single player
 *
 * @param player - Player to process
 * @param teamTrainingFocus - Team-wide training focus (fallback)
 * @param trainingQualityMultiplier - Budget-based multiplier
 * @param weekNumber - Current week (used as seed for determinism)
 * @param minutesPlayed - Minutes played this week (for bonus XP)
 * @returns Progression result with updated attributes and XP
 */
export function processPlayerProgression(
  player: Player,
  teamTrainingFocus: TrainingFocus,
  trainingQualityMultiplier: number,
  weekNumber: number,
  minutesPlayed: number = 0
): PlayerProgressionResult {
  // Use player-specific training focus if set, otherwise team default
  // Convert to legacy format for backwards compatibility with existing training system
  const trainingFocus = toLegacyTrainingFocus(player.trainingFocus || teamTrainingFocus);

  // Convert PlayerAttributes to Record<string, number> for processing
  const currentAttributes: Record<string, number> = { ...player.attributes };

  // Store original height (never changes) - default to 50 if somehow missing
  const originalHeight = currentAttributes.height ?? 50;

  // Get current XP (or initialize if missing)
  const currentXP: WeeklyXP = player.weeklyXP || { physical: 0, mental: 0, technical: 0 };

  // Create deterministic seed from player ID and week
  const seed = hashString(player.id) + weekNumber;

  // Step 1: Apply regression (age-based decline)
  const regressionResult = applyWeeklyRegression(currentAttributes, player.age, seed);
  let processedAttributes = regressionResult.updatedAttributes;

  // Filter out height from regressions (restore original)
  processedAttributes.height = originalHeight;
  const filteredRegressions = regressionResult.regressions.filter(
    r => !NON_TRAINABLE_ATTRIBUTES.includes(r.attributeName)
  );

  // Step 2: Calculate weekly XP
  const weeklyXP = calculateWeeklyXP(
    trainingFocus,
    trainingQualityMultiplier,
    player.age,
    minutesPlayed
  );

  // Step 3: Apply training (XP accumulation and attribute gains)
  // Default potentials if not set (allows growth up to 70 in each category)
  const potentials = player.potentials || { physical: 70, mental: 70, technical: 70 };
  const trainingResult = applyWeeklyTraining(
    processedAttributes,
    currentXP,
    weeklyXP,
    potentials
  );

  // Restore height again (in case training touched it)
  trainingResult.updatedAttributes.height = originalHeight;

  // Filter out height from improvements
  const filteredImprovements = trainingResult.improvements.filter(
    i => !NON_TRAINABLE_ATTRIBUTES.includes(i.attributeName)
  );

  return {
    playerId: player.id,
    playerName: player.name,
    updatedAttributes: trainingResult.updatedAttributes,
    updatedXP: trainingResult.updatedXP,
    improvements: filteredImprovements,
    regressions: filteredRegressions,
  };
}

/**
 * Processes weekly progression for all roster players
 *
 * @param players - All players in the game
 * @param rosterIds - IDs of players on user's roster
 * @param teamTrainingFocus - Team-wide training focus
 * @param trainingBudgetPct - Training budget percentage (0-100)
 * @param weekNumber - Current week number
 * @returns Array of progression results for each roster player
 */
export function processWeeklyProgression(
  players: Record<string, Player>,
  rosterIds: string[],
  teamTrainingFocus: TrainingFocus | null,
  trainingBudgetPct: number,
  weekNumber: number,
  gameDay: number = 0,
  season: number = 1
): PlayerProgressionResult[] {
  const results: PlayerProgressionResult[] = [];
  const qualityMultiplier = calculateTrainingQualityMultiplier(trainingBudgetPct);
  const focus = teamTrainingFocus || DEFAULT_TRAINING_FOCUS;

  for (const playerId of rosterIds) {
    const player = players[playerId];
    if (!player) continue;

    // Skip injured players (they don't train)
    if (player.injury) continue;

    const result = processPlayerProgression(
      player,
      focus,
      qualityMultiplier,
      weekNumber,
      0 // TODO: Pass actual minutes played when match stats are tracked
    );

    // Generate attribute snapshot for growth chart
    // Only generate snapshots every 4 weeks to reduce data size
    if (weekNumber % 4 === 0 || weekNumber === 1) {
      result.snapshot = createAttributeSnapshot(
        result.updatedAttributes,
        gameDay,
        season
      );
    }

    results.push(result);
  }

  return results;
}

/**
 * Simple string hash for deterministic seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// =============================================================================
// ACADEMY PROSPECT TRAINING
// =============================================================================

/**
 * Result of weekly training for an academy prospect
 */
export interface AcademyProgressionResult {
  prospectId: string;
  prospectName: string;
  updatedAttributes: Record<string, number>;
  updatedXP: { physical: number; mental: number; technical: number };
  improvements: AttributeImprovement[];
}

/**
 * Academy training multiplier - youth academies focus on development
 * Higher than main squad training
 */
const ACADEMY_TRAINING_MULTIPLIER = 1.5;

/**
 * Default balanced training focus for academy prospects
 */
const ACADEMY_TRAINING_FOCUS: LegacyTrainingFocus = {
  physical: 34,
  mental: 33,
  technical: 33,
};

/**
 * Processes weekly training for a single academy prospect
 * Academy prospects train faster than main squad (focused development)
 */
export function processAcademyProspectProgression(
  prospect: AcademyProspect,
  youthBudgetPct: number,
  weekNumber: number
): AcademyProgressionResult {
  // weekNumber reserved for future use (e.g., seeding)
  void weekNumber;

  // Convert attributes for processing
  const currentAttributes: Record<string, number> = { ...prospect.attributes };

  // Store original height (never changes)
  const originalHeight = currentAttributes.height ?? 50;

  // Get current XP
  const currentXP = prospect.weeklyXP || { physical: 0, mental: 0, technical: 0 };

  // Calculate budget multiplier (youth development budget)
  const budgetMultiplier = calculateTrainingQualityMultiplier(youthBudgetPct);

  // Academy prospects are young, so they get the young age multiplier (1.5x)
  // Plus the academy training bonus
  const totalMultiplier = budgetMultiplier * ACADEMY_TRAINING_MULTIPLIER;

  // Calculate weekly XP with academy bonuses
  const weeklyXP = calculateWeeklyXP(
    ACADEMY_TRAINING_FOCUS,
    totalMultiplier,
    prospect.age, // Young prospects get age bonus too
    0 // No playing time bonus for academy
  );

  // Apply training (no regression for youth prospects - they're still developing)
  const potentials = prospect.potentials || { physical: 70, mental: 70, technical: 70 };
  const trainingResult = applyWeeklyTraining(
    currentAttributes,
    currentXP,
    weeklyXP,
    potentials
  );

  // Restore height (never changes)
  trainingResult.updatedAttributes.height = originalHeight;

  // Filter out height from improvements
  const filteredImprovements = trainingResult.improvements.filter(
    i => !NON_TRAINABLE_ATTRIBUTES.includes(i.attributeName)
  );

  return {
    prospectId: prospect.id,
    prospectName: prospect.name,
    updatedAttributes: trainingResult.updatedAttributes,
    updatedXP: trainingResult.updatedXP,
    improvements: filteredImprovements,
  };
}

/**
 * Processes weekly training for all academy prospects
 */
export function processAcademyTraining(
  prospects: AcademyProspect[],
  youthBudgetPct: number,
  weekNumber: number
): AcademyProgressionResult[] {
  const results: AcademyProgressionResult[] = [];

  for (const prospect of prospects) {
    // Only train active prospects
    if (prospect.status !== 'active') continue;

    const result = processAcademyProspectProgression(
      prospect,
      youthBudgetPct,
      weekNumber
    );

    results.push(result);
  }

  return results;
}

// =============================================================================
// YEARLY PHYSICAL GROWTH (Called at season end when players age up)
// =============================================================================

/**
 * Result of yearly physical growth processing for a player
 */
export interface YearlyGrowthResult {
  playerId: string;
  playerName: string;
  growth: PhysicalGrowthResult | null;
  strengthAdjustments: {
    core_strength: { old: number; new: number };
    grip_strength: { old: number; new: number };
    arm_strength: { old: number; new: number };
  } | null;
}

/**
 * Processes yearly physical growth for a single player
 *
 * Called when a player ages up at season end.
 * Updates height (until 18), weight (until 24), and adjusts strength ceiling.
 *
 * @param player - The player to process
 * @param sport - Sport type (affects late growth for basketball)
 * @param currentGameDay - Current game day number
 * @returns Growth result with updated player data
 */
export function processPlayerYearlyGrowth(
  player: Player,
  sport: 'basketball' | 'baseball' | 'soccer' = 'basketball',
  currentGameDay: number = 0
): {
  result: YearlyGrowthResult;
  updatedPlayer: Partial<Player>;
} {
  const growthResult = processYearlyPhysicalGrowth(player, sport, currentGameDay);

  let strengthAdjustments: YearlyGrowthResult['strengthAdjustments'] = null;
  let updatedAttributes = { ...player.attributes };

  // If weight changed, adjust strength attributes toward new ceiling
  if (growthResult.result && growthResult.result.weightChanged) {
    const oldWeight = growthResult.result.oldWeight;
    const newWeight = growthResult.result.newWeight;

    const oldCore = player.attributes.core_strength;
    const oldGrip = player.attributes.grip_strength;
    const oldArm = player.attributes.arm_strength;

    const newCore = adjustStrengthForWeightGain(oldCore, oldWeight, newWeight);
    const newGrip = adjustStrengthForWeightGain(oldGrip, oldWeight, newWeight);
    const newArm = adjustStrengthForWeightGain(oldArm, oldWeight, newWeight);

    strengthAdjustments = {
      core_strength: { old: oldCore, new: newCore },
      grip_strength: { old: oldGrip, new: newGrip },
      arm_strength: { old: oldArm, new: newArm },
    };

    updatedAttributes = {
      ...updatedAttributes,
      core_strength: newCore,
      grip_strength: newGrip,
      arm_strength: newArm,
    };
  }

  return {
    result: {
      playerId: player.id,
      playerName: player.name,
      growth: growthResult.result,
      strengthAdjustments,
    },
    updatedPlayer: {
      ...growthResult.updatedPlayer,
      attributes: updatedAttributes,
    },
  };
}

/**
 * Processes yearly physical growth for all players under 24
 *
 * Called at season end when players age up.
 *
 * @param players - All players in the game
 * @param sport - Sport type
 * @param currentGameDay - Current game day
 * @returns Array of growth results for each developing player
 */
export function processYearlyGrowthForAllPlayers(
  players: Record<string, Player>,
  sport: 'basketball' | 'baseball' | 'soccer' = 'basketball',
  currentGameDay: number = 0
): YearlyGrowthResult[] {
  const results: YearlyGrowthResult[] = [];

  for (const player of Object.values(players)) {
    // Only process players under 24 with youth development data
    if (player.age >= 24 || !player.youthDevelopment) continue;

    const { result } = processPlayerYearlyGrowth(player, sport, currentGameDay);
    results.push(result);
  }

  return results;
}
