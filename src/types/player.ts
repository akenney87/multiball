/**
 * Player Type Utilities
 *
 * Provides type-safe player data normalization and validation.
 * Handles dual format player data (nested attributes vs flat attributes).
 */

import { Player, PlayerAttributes } from '../data/types';

/**
 * Flat player format (legacy/test format)
 * Used in some test fixtures where attributes are at top level
 */
export interface FlatPlayer {
  id: string;
  name: string;
  age?: number;
  position: string;

  // Attributes at top level (flat structure)
  stamina: number;
  shooting: number;
  threePointShooting: number;
  freeThrowShooting: number;
  postScoring: number;
  midRangeShooting: number;
  layupDunking: number;
  offensiveRebounding: number;
  defensiveRebounding: number;
  passing: number;
  ballHandling: number;
  onBallDefense: number;
  offBallDefense: number;
  perimeterDefense: number;
  postDefense: number;
  blocking: number;
  stealing: number;
  speed: number;
  acceleration: number;
  verticalLeap: number;
  strength: number;
  agility: number;
  coordination: number;
  bbiq: number;
  consistency: number;

  // Optional nested fields
  contract?: any;
  injury?: any;
  [key: string]: any; // Allow other fields
}

/**
 * Type guard: Check if player has nested attributes structure
 */
export function hasNestedAttributes(player: any): player is Player {
  return 'attributes' in player &&
         player.attributes !== null &&
         typeof player.attributes === 'object';
}

/**
 * Type guard: Check if player has flat attributes structure
 */
export function hasFlatAttributes(player: any): player is FlatPlayer {
  return 'stamina' in player &&
         typeof player.stamina === 'number';
}

/**
 * Normalize player data to canonical format (nested attributes)
 *
 * Handles two input formats:
 * 1. Nested format (canonical): { attributes: { stamina: 75, ... } }
 * 2. Flat format (legacy): { stamina: 75, shooting: 80, ... }
 *
 * @param player - Player data in nested or flat format
 * @returns Player with nested attributes structure (canonical format)
 *
 * @example
 * // Nested format (passes through)
 * const nested = { id: '1', name: 'Player', attributes: { stamina: 75 } };
 * normalizePlayer(nested); // Returns as-is
 *
 * @example
 * // Flat format (normalizes to nested)
 * const flat = { id: '1', name: 'Player', stamina: 75, shooting: 80 };
 * normalizePlayer(flat); // Returns { id: '1', name: 'Player', attributes: { stamina: 75, shooting: 80 } }
 */
export function normalizePlayer(player: any): Player {
  // If already in nested format, return as-is
  if (hasNestedAttributes(player)) {
    return player as Player;
  }

  // If in flat format, convert to nested
  if (hasFlatAttributes(player)) {
    const {
      id,
      name,
      age,
      dateOfBirth,
      position,
      contract,
      injury,
      trainingFocus,
      weeklyXP,
      potentials,
      peakAges,
      careerStats,
      currentSeasonStats,
      teamId,
      acquisitionType,
      acquisitionDate,
      // Extract all 25 attributes from top level
      stamina,
      shooting,
      threePointShooting,
      freeThrowShooting,
      postScoring,
      midRangeShooting,
      layupDunking,
      offensiveRebounding,
      defensiveRebounding,
      passing,
      ballHandling,
      onBallDefense,
      offBallDefense,
      perimeterDefense,
      postDefense,
      blocking,
      stealing,
      speed,
      acceleration,
      verticalLeap,
      strength,
      agility,
      coordination,
      bbiq,
      consistency,
      ...rest
    } = player;

    // Construct nested attributes object
    const attributes: PlayerAttributes = {
      stamina,
      shooting,
      threePointShooting,
      freeThrowShooting,
      postScoring,
      midRangeShooting,
      layupDunking,
      offensiveRebounding,
      defensiveRebounding,
      passing,
      ballHandling,
      onBallDefense,
      offBallDefense,
      perimeterDefense,
      postDefense,
      blocking,
      stealing,
      speed,
      acceleration,
      verticalLeap,
      strength,
      agility,
      coordination,
      bbiq,
      consistency
    };

    // Return normalized player with nested attributes
    return {
      id,
      name,
      age: age ?? 25, // Default age if missing
      dateOfBirth: dateOfBirth ?? new Date(),
      position,
      attributes,
      potentials: potentials ?? createDefaultPotentials(attributes),
      peakAges: peakAges ?? createDefaultPeakAges(),
      contract: contract ?? null,
      injury: injury ?? null,
      trainingFocus: trainingFocus ?? null,
      weeklyXP: weeklyXP ?? createDefaultWeeklyXP(),
      careerStats: careerStats ?? createDefaultCareerStats(),
      currentSeasonStats: currentSeasonStats ?? createDefaultSeasonStats(),
      teamId: teamId ?? 'free_agent',
      acquisitionType: acquisitionType ?? 'free_agent',
      acquisitionDate: acquisitionDate ?? new Date(),
      ...rest // Preserve any extra fields
    } as Player;
  }

  // Invalid format - throw error
  throw new Error(
    'Invalid player format: Player must have either nested attributes or flat attributes. ' +
    `Received: ${JSON.stringify(Object.keys(player))}`
  );
}

/**
 * Extract attributes from player (handles both formats)
 *
 * Convenience function for getting attributes without full normalization.
 * Useful when only attributes are needed (e.g., stamina calculations).
 *
 * @param player - Player data in any format
 * @returns PlayerAttributes object
 */
export function getPlayerAttributes(player: any): PlayerAttributes {
  if (hasNestedAttributes(player)) {
    return player.attributes;
  }

  if (hasFlatAttributes(player)) {
    const {
      stamina, shooting, threePointShooting, freeThrowShooting, postScoring,
      midRangeShooting, layupDunking, offensiveRebounding, defensiveRebounding,
      passing, ballHandling, onBallDefense, offBallDefense, perimeterDefense,
      postDefense, blocking, stealing, speed, acceleration, verticalLeap,
      strength, agility, coordination, bbiq, consistency
    } = player;

    return {
      stamina, shooting, threePointShooting, freeThrowShooting, postScoring,
      midRangeShooting, layupDunking, offensiveRebounding, defensiveRebounding,
      passing, ballHandling, onBallDefense, offBallDefense, perimeterDefense,
      postDefense, blocking, stealing, speed, acceleration, verticalLeap,
      strength, agility, coordination, bbiq, consistency
    };
  }

  throw new Error('Invalid player format: Cannot extract attributes');
}

/**
 * Convert nested player to flat format (for legacy compatibility)
 *
 * @param player - Player with nested attributes
 * @returns Player with flat attributes at top level
 */
export function flattenPlayer(player: Player): FlatPlayer {
  return {
    ...player,
    ...player.attributes // Spread attributes to top level
  };
}

/**
 * Create default potentials matching current attributes
 * (Used when converting flat format that lacks potentials)
 */
function createDefaultPotentials(attributes: PlayerAttributes): any {
  // Simple default: potentials = attributes + 10 (capped at 100)
  const potentials: any = {};
  Object.keys(attributes).forEach(key => {
    const currentValue = (attributes as any)[key];
    potentials[key] = Math.min(100, currentValue + 10);
  });
  return potentials;
}

/**
 * Create default peak ages (mid-20s for most attributes)
 */
function createDefaultPeakAges(): any {
  return {
    physical: 26,
    technical: 28,
    mental: 30
  };
}

/**
 * Create default weekly XP (zero accumulation)
 */
function createDefaultWeeklyXP(): any {
  return {
    physical: 0,
    technical: 0,
    mental: 0
  };
}

/**
 * Create default career stats (zero values)
 */
function createDefaultCareerStats(): any {
  return {
    gamesPlayed: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0
  };
}

/**
 * Create default season stats (zero values)
 */
function createDefaultSeasonStats(): any {
  return {
    gamesPlayed: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0
  };
}

/**
 * Validate player attributes (all values 1-100)
 *
 * @param player - Player to validate
 * @returns true if valid, throws error if invalid
 */
export function validatePlayerAttributes(player: any): boolean {
  const attributes = getPlayerAttributes(player);

  Object.entries(attributes).forEach(([key, value]) => {
    if (typeof value !== 'number') {
      throw new Error(`Attribute ${key} must be a number, got ${typeof value}`);
    }
    if (value < 1 || value > 100) {
      throw new Error(`Attribute ${key} must be 1-100, got ${value}`);
    }
  });

  return true;
}
