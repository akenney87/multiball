/**
 * Soccer Goalkeeper Save System
 *
 * Provides a distinct mechanism for determining if shots on target are saved.
 * This creates a two-stage goal process:
 * 1. xG determines how many shot opportunities are created
 * 2. GK rating directly affects save probability for each shot
 *
 * @module simulation/soccer/systems/goalkeeperSystem
 */

import { Player } from '../../../data/types';
import { SoccerTeamState } from '../types';
import {
  BASE_SAVE_RATE,
  GK_RATING_SAVE_IMPACT,
  SHOT_QUALITY_SAVE_MODIFIERS,
  GOAL_POSITION_WEIGHTS,
} from '../constants';
import { calculateSoccerPositionOverall } from '../utils/positionRatings';

// =============================================================================
// TYPES
// =============================================================================

export type ShotQuality = 'fullChance' | 'halfChance' | 'longRange';

export interface ShotDetail {
  minute: number;
  quality: ShotQuality;
  saved: boolean;
  shooter: Player;
}

export interface ShotProcessingResult {
  goals: number;
  shotsOnTarget: number;
  saves: number;
  shotDetails: ShotDetail[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get goalkeeper from team lineup
 */
function getGoalkeeper(team: SoccerTeamState): Player | null {
  for (const player of team.lineup) {
    if (team.positions[player.id] === 'GK') {
      return player;
    }
  }
  // Fallback to first player if no GK found
  return team.lineup[0] || null;
}

/**
 * Get goalkeeper rating using position-specific calculation
 */
function getGoalkeeperRating(goalkeeper: Player): number {
  return calculateSoccerPositionOverall(goalkeeper, 'GK');
}

/**
 * Select shooter based on position weights and player ratings
 */
function selectShooter(team: SoccerTeamState): Player {
  const weights = team.lineup.map(player => {
    const pos = team.positions[player.id] || 'CM';
    const positionWeight = GOAL_POSITION_WEIGHTS[pos] || 1.0;
    const playerRating = calculateSoccerPositionOverall(player, pos);

    return {
      player,
      weight: Math.max(0.1, positionWeight * (playerRating / 50)),
    };
  });

  const totalWeight = weights.reduce((sum, { weight }) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { player, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return player;
  }

  // Fallback - guaranteed to have at least one player
  const fallback = team.lineup[0] ?? weights[0]?.player;
  if (!fallback) {
    throw new Error('selectShooter: No players in lineup');
  }
  return fallback;
}

/**
 * Calculate save probability for a shot
 *
 * @param gkRating - Goalkeeper's position-specific rating (0-100)
 * @param shotQuality - Quality of the shot opportunity
 * @returns Save probability (0.15-0.85 range)
 */
export function calculateSaveChance(
  gkRating: number,
  shotQuality: ShotQuality
): number {
  // Base save rate modified by GK skill
  // Rating 50 = base rate, 100 = +25% saves, 0 = -25% saves
  const ratingModifier = (gkRating - 50) * GK_RATING_SAVE_IMPACT;
  let saveChance = BASE_SAVE_RATE + ratingModifier;

  // Apply shot quality modifier
  // fullChance = harder to save (0.75x), longRange = easier (1.30x)
  const qualityMod = SHOT_QUALITY_SAVE_MODIFIERS[shotQuality] || 1.0;
  saveChance *= qualityMod;

  // Clamp to realistic range (no shot is 100% save or 100% goal)
  return Math.max(0.15, Math.min(0.85, saveChance));
}

/**
 * Determine shot quality based on xG and randomness
 *
 * Higher xG = more quality chances
 */
function determineShotQuality(xG: number): ShotQuality {
  // Higher xG teams get more high-quality chances
  const qualityBoost = (xG - 1.4) * 0.1; // ±0.1 for each 0.1 xG difference from base
  const qualityRoll = Math.random() + qualityBoost;

  if (qualityRoll < 0.25) {
    return 'fullChance';
  } else if (qualityRoll < 0.65) {
    return 'halfChance';
  } else {
    return 'longRange';
  }
}

// =============================================================================
// MAIN SHOT PROCESSING
// =============================================================================

/**
 * Process shots and determine goals using GK save system
 *
 * Replaces pure Poisson xG approach with:
 * 1. Generate shot opportunities from xG
 * 2. Determine quality of each shot
 * 3. GK save roll for each shot on target
 *
 * @param xG - Expected goals for this team
 * @param shootingTeam - Team taking the shots
 * @param defendingTeam - Team defending (with goalkeeper)
 * @returns Shot processing result with goals, saves, and details
 */
export function processShots(
  xG: number,
  shootingTeam: SoccerTeamState,
  defendingTeam: SoccerTeamState
): ShotProcessingResult {
  const goalkeeper = getGoalkeeper(defendingTeam);

  // Fallback if no goalkeeper found
  if (!goalkeeper) {
    const goals = Math.round(xG + (Math.random() - 0.5));
    return {
      goals: Math.max(0, goals),
      shotsOnTarget: Math.max(goals + 2, 4),
      saves: 2,
      shotDetails: [],
    };
  }

  const gkRating = getGoalkeeperRating(goalkeeper);

  // Generate shot opportunities based on xG
  // Each xG point ≈ 8 opportunities, some become shots on target
  const opportunities = Math.round(xG * 8 + (Math.random() - 0.5) * 4);

  let goals = 0;
  let shotsOnTarget = 0;
  let saves = 0;
  const shotDetails: ShotDetail[] = [];

  for (let i = 0; i < opportunities; i++) {
    // ~35% of opportunities become shots on target
    if (Math.random() > 0.35) continue;

    shotsOnTarget++;

    // Determine shot quality
    const quality = determineShotQuality(xG);

    // Select shooter
    const shooter = selectShooter(shootingTeam);

    // Calculate save chance and roll
    const saveChance = calculateSaveChance(gkRating, quality);
    const saved = Math.random() < saveChance;

    // Generate minute for this shot
    const half = Math.random() > 0.45 ? 2 : 1;
    const baseMinute = half === 1 ? 0 : 45;
    const minute = baseMinute + Math.floor(Math.random() * 45) + 1;

    shotDetails.push({ minute, quality, saved, shooter });

    if (saved) {
      saves++;
    } else {
      goals++;
    }
  }

  // Ensure minimum reasonable stats
  shotsOnTarget = Math.max(shotsOnTarget, goals + 1);
  saves = shotsOnTarget - goals;

  return { goals, shotsOnTarget, saves, shotDetails };
}

/**
 * Get detailed save statistics for a goalkeeper
 */
export function getGoalkeeperStats(
  result: ShotProcessingResult,
  _goalkeeper: Player  // Reserved for future per-player stat tracking
): {
  saves: number;
  savePercentage: number;
  fullChanceSaves: number;
  halfChanceSaves: number;
  longRangeSaves: number;
} {
  const fullChanceSaves = result.shotDetails.filter(
    s => s.quality === 'fullChance' && s.saved
  ).length;
  const halfChanceSaves = result.shotDetails.filter(
    s => s.quality === 'halfChance' && s.saved
  ).length;
  const longRangeSaves = result.shotDetails.filter(
    s => s.quality === 'longRange' && s.saved
  ).length;

  const savePercentage = result.shotsOnTarget > 0
    ? (result.saves / result.shotsOnTarget) * 100
    : 100;

  return {
    saves: result.saves,
    savePercentage: Math.round(savePercentage),
    fullChanceSaves,
    halfChanceSaves,
    longRangeSaves,
  };
}
