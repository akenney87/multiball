/**
 * Match Fitness System
 *
 * Handles persistent fatigue between matches - separate from in-match stamina.
 * Players drain fitness after matches and recover over time.
 *
 * Key Concepts:
 * - `matchFitness` (0-100%): Current fitness level, depletes after games, recovers daily
 * - `attributes.stamina` (1-100): Player attribute affecting drain/recovery RATES
 * - In-match stamina (StaminaTracker): Unchanged, handles within-game fatigue
 *
 * @module systems/matchFitnessSystem
 */

import type { Player } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

export type SportType = 'basketball' | 'baseball' | 'soccer';

export type SoccerPositionType =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export type BaseballPositionType =
  | 'P'
  | 'C'
  | '1B'
  | '2B'
  | '3B'
  | 'SS'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'DH';

export type WarningLevel = 'none' | 'yellow' | 'red';

export interface FitnessDrainResult {
  /** New fitness level after drain */
  newFitness: number;
  /** Amount drained */
  drainAmount: number;
}

export interface FitnessRecoveryResult {
  /** New fitness level after recovery */
  newFitness: number;
  /** Amount recovered */
  recoveryAmount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Base drain percentages per full game/match by sport
 * These represent drain for 100% playing time at neutral stamina (50)
 */
const BASE_DRAIN: Record<SportType, number> = {
  basketball: 40, // 48 minutes
  soccer: 20, // 90 minutes
  baseball: 10, // 9 innings (base, before position mods)
};

/**
 * Soccer position drain modifiers
 * Higher = more drain (midfielders run the most)
 */
const SOCCER_POSITION_MOD: Record<SoccerPositionType, number> = {
  GK: 0.5, // Goalkeeper: 10% drain for 90 min
  CB: 0.85, // Center back
  LB: 1.0, // Left back
  RB: 1.0, // Right back
  CDM: 1.1, // Defensive mid
  CM: 1.25, // Central mid (highest)
  CAM: 1.15, // Attacking mid
  LW: 1.1, // Left wing
  RW: 1.1, // Right wing
  ST: 0.95, // Striker
};

/**
 * Baseball position drain modifiers
 * Pitcher is extreme; 1B/DH are minimal
 */
const BASEBALL_POSITION_MOD: Record<BaseballPositionType, number> = {
  P: 8.0, // Starting pitcher: 80% drain for 9 innings
  C: 1.5, // Catcher: 15% drain
  '1B': 0.5, // First base: 5% drain
  DH: 0.3, // Designated hitter: 3% drain
  '2B': 1.0, // Second base
  SS: 1.0, // Shortstop
  '3B': 1.0, // Third base
  CF: 1.1, // Center field (covers most ground)
  LF: 0.9, // Left field
  RF: 0.9, // Right field
};

/** Relief pitcher intensity multiplier (higher intensity per inning) */
const RELIEF_PITCHER_MOD = 1.25;

/** Base daily recovery percentage (~30% per week) */
const BASE_DAILY_RECOVERY = 4.3;

/**
 * Stamina attribute modifier ranges
 * A player with stamina 90 drains 40% slower than stamina 10
 * A player with stamina 90 recovers 30% faster than stamina 10
 */
const STAMINA_ATTR_DRAIN_MOD = 0.4; // ±40% at extremes
const STAMINA_ATTR_RECOVERY_MOD = 0.3; // ±30% at extremes

/** Minimum fitness floor (player can't go below this) */
const MIN_FITNESS = 10;

/** Maximum fitness ceiling */
const MAX_FITNESS = 100;

/** Full game durations for playing time ratio calculation */
const FULL_GAME_DURATION: Record<SportType, number> = {
  basketball: 48, // minutes
  soccer: 90, // minutes
  baseball: 9, // innings
};

// =============================================================================
// DRAIN CALCULATION
// =============================================================================

/**
 * Calculate match fitness drain for a player
 *
 * @param sport - Sport type
 * @param position - Position played (soccer/baseball specific)
 * @param minutesOrInningsPlayed - Playing time (minutes for basketball/soccer, innings for baseball)
 * @param staminaAttribute - Player's stamina attribute (1-100)
 * @param isReliefPitcher - For baseball pitchers: relief vs starter (default false)
 * @returns Fitness drain amount (percentage points)
 */
export function calculateMatchDrain(
  sport: SportType,
  position: string,
  minutesOrInningsPlayed: number,
  staminaAttribute: number,
  isReliefPitcher: boolean = false
): number {
  const baseDrain = BASE_DRAIN[sport];

  // Position modifier (soccer and baseball only)
  let positionMod = 1.0;
  if (sport === 'soccer') {
    positionMod =
      SOCCER_POSITION_MOD[position as SoccerPositionType] ?? 1.0;
  } else if (sport === 'baseball') {
    positionMod =
      BASEBALL_POSITION_MOD[position as BaseballPositionType] ?? 1.0;
    if (position === 'P' && isReliefPitcher) {
      positionMod *= RELIEF_PITCHER_MOD;
    }
  }

  // Playing time ratio (0-1, can exceed 1 for overtime)
  const fullGame = FULL_GAME_DURATION[sport];
  const playedRatio = Math.min(minutesOrInningsPlayed / fullGame, 1.5); // Cap at 150%

  // Stamina attribute modifier
  // Low stamina (10) = 1.4x drain (drains faster)
  // Average stamina (50) = 1.0x drain
  // High stamina (90) = 0.6x drain (drains slower)
  const staminaNormalized = (50 - staminaAttribute) / 50; // -0.8 to 0.8
  const drainMod = 1.0 + staminaNormalized * STAMINA_ATTR_DRAIN_MOD;

  // Calculate final drain
  const drain = baseDrain * positionMod * playedRatio * drainMod;

  // Cap at 80% max drain per match (prevent complete exhaustion from single game)
  return Math.min(drain, 80);
}

/**
 * Apply fitness drain to a player after a match
 *
 * @param currentFitness - Current fitness level (0-100)
 * @param drainAmount - Amount to drain
 * @returns New fitness level and actual drain applied
 */
export function applyFitnessDrain(
  currentFitness: number,
  drainAmount: number
): FitnessDrainResult {
  const newFitness = Math.max(MIN_FITNESS, currentFitness - drainAmount);
  const actualDrain = currentFitness - newFitness;

  return {
    newFitness,
    drainAmount: actualDrain,
  };
}

// =============================================================================
// RECOVERY CALCULATION
// =============================================================================

/**
 * Calculate fitness recovery for a player over time
 *
 * @param daysSinceLastMatch - Number of days since last match
 * @param staminaAttribute - Player's stamina attribute (1-100)
 * @param medicalBudgetPct - Medical budget allocation percentage (0-100, default 50)
 * @returns Recovery amount (percentage points)
 */
export function calculateRecovery(
  daysSinceLastMatch: number,
  staminaAttribute: number,
  medicalBudgetPct: number = 50
): number {
  // Stamina attribute modifier
  // Low stamina (10) = 0.7x recovery (recovers slower)
  // Average stamina (50) = 1.0x recovery
  // High stamina (90) = 1.3x recovery (recovers faster)
  const staminaNormalized = (staminaAttribute - 50) / 50; // -0.8 to 0.8
  const recoveryMod = 1.0 + staminaNormalized * STAMINA_ATTR_RECOVERY_MOD;

  // Medical budget bonus: 0-20% based on allocation
  // 0% allocation = 1.0x, 50% = 1.1x, 100% = 1.2x
  const medicalBonus = 1.0 + (medicalBudgetPct / 500);

  // Calculate total recovery
  return BASE_DAILY_RECOVERY * daysSinceLastMatch * recoveryMod * medicalBonus;
}

/**
 * Apply fitness recovery to a player
 *
 * @param currentFitness - Current fitness level (0-100)
 * @param recoveryAmount - Amount to recover
 * @returns New fitness level and actual recovery applied
 */
export function applyFitnessRecovery(
  currentFitness: number,
  recoveryAmount: number
): FitnessRecoveryResult {
  const newFitness = Math.min(MAX_FITNESS, currentFitness + recoveryAmount);
  const actualRecovery = newFitness - currentFitness;

  return {
    newFitness,
    recoveryAmount: actualRecovery,
  };
}

// =============================================================================
// PERFORMANCE DEGRADATION
// =============================================================================

/**
 * Physical attributes that are affected by fitness
 */
const PHYSICAL_ATTRIBUTES = [
  'grip_strength',
  'arm_strength',
  'core_strength',
  'agility',
  'acceleration',
  'top_speed',
  'jumping',
  'reactions',
  'balance',
  'durability',
] as const;

/**
 * Calculate attribute multiplier based on match fitness
 *
 * Linear degradation:
 * - 100% fitness = 1.0x (no penalty)
 * - 75% fitness = 0.875x (12.5% reduction)
 * - 50% fitness = 0.75x (25% reduction)
 * - 0% fitness = 0.5x (50% reduction)
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Attribute multiplier (0.5 to 1.0)
 */
export function calculateAttributeMultiplier(matchFitness: number): number {
  // Formula: 0.5 + (matchFitness / 200)
  // At 100: 0.5 + 0.5 = 1.0
  // At 50: 0.5 + 0.25 = 0.75
  // At 0: 0.5 + 0 = 0.5
  return 0.5 + matchFitness / 200;
}

/**
 * Apply fitness degradation to a player's attributes
 * Returns a copy of the player with degraded physical attributes
 *
 * @param player - Player to apply degradation to
 * @returns Player with degraded attributes (original unchanged)
 */
export function applyFitnessDegradation(player: Player): Player {
  const multiplier = calculateAttributeMultiplier(player.matchFitness);

  // If fully fit, no degradation needed
  if (multiplier >= 1.0) {
    return player;
  }

  // Create degraded attributes copy
  const degradedAttrs = { ...player.attributes };

  for (const attr of PHYSICAL_ATTRIBUTES) {
    const original = degradedAttrs[attr];
    if (typeof original === 'number') {
      // Round to avoid floating point issues
      degradedAttrs[attr] = Math.round(original * multiplier);
    }
  }

  return {
    ...player,
    attributes: degradedAttrs,
  };
}

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Get warning level for a fitness value
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Warning level for UI display
 */
export function getWarningLevel(matchFitness: number): WarningLevel {
  if (matchFitness >= 75) return 'none';
  if (matchFitness >= 50) return 'yellow';
  return 'red';
}

/**
 * Get warning message for a fitness level
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Human-readable warning message
 */
export function getWarningMessage(matchFitness: number): string | null {
  const level = getWarningLevel(matchFitness);

  switch (level) {
    case 'yellow':
      return 'Fatigued - performance reduced';
    case 'red':
      return 'Exhausted - performance severely reduced';
    default:
      return null;
  }
}

/**
 * Check if player should be considered fatigued (for lineup warnings)
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Whether player is fatigued
 */
export function isFatigued(matchFitness: number): boolean {
  return matchFitness < 75;
}

/**
 * Check if player is exhausted (severe fatigue)
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Whether player is exhausted
 */
export function isExhausted(matchFitness: number): boolean {
  return matchFitness < 50;
}

// =============================================================================
// INJURY RISK
// =============================================================================

/**
 * Calculate injury risk multiplier based on match fitness
 *
 * At 100% fitness: 1.0x base injury rate
 * At 50% fitness: 1.5x injury rate
 * At 0% fitness: 2.0x injury rate
 *
 * @param matchFitness - Current match fitness (0-100)
 * @returns Injury risk multiplier (1.0 to 2.0)
 */
export function calculateInjuryRiskMultiplier(matchFitness: number): number {
  // Formula: 1.0 + ((100 - matchFitness) / 100)
  // At 100: 1.0 + 0 = 1.0
  // At 50: 1.0 + 0.5 = 1.5
  // At 0: 1.0 + 1.0 = 2.0
  return 1.0 + (100 - matchFitness) / 100;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Calculate days between two dates
 *
 * @param from - Start date
 * @param to - End date
 * @returns Number of days between dates
 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Process weekly fitness recovery for all players
 *
 * @param players - Record of all players
 * @param medicalBudgetPct - Medical budget allocation (0-100)
 * @returns Updated players record
 */
export function processWeeklyFitnessRecovery(
  players: Record<string, Player>,
  medicalBudgetPct: number = 50
): Record<string, Player> {
  const updatedPlayers: Record<string, Player> = {};
  const daysInWeek = 7;

  for (const [playerId, player] of Object.entries(players)) {
    // Skip if already at max fitness
    if (player.matchFitness >= MAX_FITNESS) {
      updatedPlayers[playerId] = player;
      continue;
    }

    // Calculate recovery (7 days worth)
    const recovery = calculateRecovery(
      daysInWeek,
      player.attributes.stamina,
      medicalBudgetPct
    );

    const result = applyFitnessRecovery(player.matchFitness, recovery);

    updatedPlayers[playerId] = {
      ...player,
      matchFitness: result.newFitness,
    };
  }

  return updatedPlayers;
}

// =============================================================================
// EXPORTS (for testing)
// =============================================================================

export const CONSTANTS = {
  BASE_DRAIN,
  SOCCER_POSITION_MOD,
  BASEBALL_POSITION_MOD,
  RELIEF_PITCHER_MOD,
  BASE_DAILY_RECOVERY,
  STAMINA_ATTR_DRAIN_MOD,
  STAMINA_ATTR_RECOVERY_MOD,
  MIN_FITNESS,
  MAX_FITNESS,
  FULL_GAME_DURATION,
  PHYSICAL_ATTRIBUTES,
};
