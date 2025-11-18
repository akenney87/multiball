/**
 * Basketball Simulator - End-Game Logic System (M3)
 *
 * Implements 6 end-game modes for realistic late-game strategy:
 * 1. Clock Kill Mode - Leading team burns clock in final 35 seconds
 * 2. Last Second Shot - Tied - Hold for last shot when tied
 * 3. Last Second Shot - Losing - Hold for last shot when trailing 1-3
 * 4. Desperation Mode - Increase 3PT volume when down 9+ with <10 mins
 * 5. Conserve Lead Mode - Slow pace when up 15+ with <3 mins
 * 6. Intentional Fouling - Foul worst FT shooter when down 3-8 with <60s
 *
 * Key Design Decisions:
 * - Shot timing uses simple random (not attribute-driven) for speed
 * - No forced shooter - normal weighted usage distribution applies
 * - No bonus state check - teams foul regardless (will be in bonus eventually)
 * - Modes can stack additively (e.g., Desperation + Last Shot Losing)
 * - Clock Kill/Last Shot override user pace (basketball logic dictates)
 *
 * @module simulation/systems/endGameModes
 */

import type { Player } from '../../data/types';
import { calculateComposite } from '../core/probability';

// =============================================================================
// END GAME MODIFIERS
// =============================================================================

/**
 * End game modifiers that affect possession behavior
 */
export interface EndGameModifiers {
  /** List of active mode names */
  activeModes: string[];
  /** Target shot clock time (seconds) to wait before shooting */
  shotClockTarget: number | null;
  /** Target game clock time (seconds) to wait before shooting */
  gameClockTarget: number | null;
  /** Force specific shot type (e.g., '3pt') */
  forceShotType: '3pt' | null;
  /** Additive adjustment to 3PT shot distribution (-1.0 to +1.0) */
  shotDistribution3ptAdj: number;
  /** Pace multiplier (1.0 = normal, >1.0 = faster, <1.0 = slower) */
  paceMultiplier: number;
}

/**
 * Create empty end game modifiers
 */
export function createEmptyModifiers(): EndGameModifiers {
  return {
    activeModes: [],
    shotClockTarget: null,
    gameClockTarget: null,
    forceShotType: null,
    shotDistribution3ptAdj: 0.0,
    paceMultiplier: 1.0,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Select target for intentional foul.
 *
 * When teams know intentional fouling is coming, the offense protects the ball
 * with their best FT shooter. Distribution:
 * - 50% of the time: Best FT shooter gets fouled
 * - 50% of the time: One of the other 4 players (12.5% each)
 *
 * Uses FT composite:
 * - throw_accuracy: 40%
 * - composure: 25%
 * - consistency: 20%
 * - hand_eye_coordination: 15%
 *
 * @param roster - Team roster
 * @returns Name of player selected for intentional foul
 */
export function selectIntentionalFoulTarget(roster: Player[]): string {
  const ftWeights = {
    throw_accuracy: 0.40,
    composure: 0.25,
    consistency: 0.20,
    hand_eye_coordination: 0.15,
  };

  // Calculate FT composite for all players
  const playerComposites: [string, number][] = roster.map(player => {
    const ftComposite = calculateComposite(player, ftWeights);
    return [player.name, ftComposite];
  });

  // Sort by FT composite (highest first = best FT shooter)
  playerComposites.sort((a, b) => b[1] - a[1]);

  // 50% chance: Best FT shooter gets the ball
  if (Math.random() < 0.5) {
    return playerComposites[0][0];
  }

  // 50% chance: One of the other 4 players
  const otherPlayers = playerComposites.slice(1).map(([name]) => name);
  return otherPlayers.length > 0
    ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)]
    : playerComposites[0][0];
}

/**
 * Select player to commit intentional foul.
 *
 * Prioritizes players with fewest personal fouls to avoid foul-outs.
 *
 * @param defensiveRoster - Defensive team's roster
 * @param foulSystem - FoulSystem instance to check personal foul counts
 * @returns Name of player to commit foul
 */
export function selectFouler(defensiveRoster: Player[], foulSystem: any): string {
  // Get current personal fouls for all players
  const foulCounts: [string, number][] = [];
  for (const player of defensiveRoster) {
    const playerName = player.name;
    const fouls = foulSystem.personal_fouls?.[playerName] ?? 0;
    // Skip players with 5 fouls (would foul out)
    if (fouls < 5) {
      foulCounts.push([playerName, fouls]);
    }
  }

  // If everyone has 5 fouls (edge case), just use first player
  if (foulCounts.length === 0) {
    return defensiveRoster[0].name;
  }

  // Sort by fewest fouls
  foulCounts.sort((a, b) => a[1] - b[1]);

  // Return player with fewest fouls
  return foulCounts[0][0];
}

// =============================================================================
// MODE DETECTION
// =============================================================================

/**
 * Detect active end-game modes and return modifiers.
 *
 * Modes can stack additively (shot_distribution_3pt_adj and pace_multiplier
 * accumulate from multiple modes).
 *
 * @param gameTimeRemaining - Seconds left in game (0-2880)
 * @param scoreDifferential - Point difference (positive = team ahead, negative = behind)
 * @param quarter - Current quarter (1-4)
 * @param teamHasPossession - True if evaluating team has ball
 * @param offensiveRoster - Offensive team's roster (for FT composite calculation)
 * @param defensiveRoster - Defensive team's roster (for fouler selection)
 * @returns EndGameModifiers with appropriate values set
 */
export function detectEndGameMode(
  gameTimeRemaining: number,
  scoreDifferential: number,
  quarter: number,
  teamHasPossession: boolean,
  offensiveRoster: Player[],
  defensiveRoster: Player[]
): EndGameModifiers {
  const mods = createEmptyModifiers();

  // Only check end-game modes in Q4
  if (quarter !== 4) {
    return mods;
  }

  // =========================================================================
  // MODE 1: CLOCK KILL MODE
  // Leading team burns shot clock in final 35 seconds
  // =========================================================================
  if (
    gameTimeRemaining <= 35 &&
    scoreDifferential >= 1 &&
    scoreDifferential <= 8 &&
    teamHasPossession
  ) {
    mods.activeModes.push('clock_kill');

    // Shot clock target varies by lead size
    if (scoreDifferential >= 7) {
      mods.shotClockTarget = 3.0; // Big lead: shoot at 3 sec
    } else if (scoreDifferential >= 4) {
      mods.shotClockTarget = 5.0; // Medium lead: shoot at 5 sec
    } else {
      mods.shotClockTarget = 7.0; // Small lead: shoot at 7 sec
    }
  }

  // =========================================================================
  // MODE 2: LAST SECOND SHOT - TIED GAME
  // Hold for final shot when tied
  // =========================================================================
  if (gameTimeRemaining <= 24 && scoreDifferential === 0 && teamHasPossession) {
    mods.activeModes.push('last_shot_tied');
    mods.gameClockTarget = 3.0; // Shoot at 3 seconds game clock
  }

  // =========================================================================
  // MODE 3: LAST SECOND SHOT - LOSING
  // Hold for final shot when trailing by 1-3 points
  // =========================================================================
  if (
    gameTimeRemaining <= 24 &&
    scoreDifferential >= -3 &&
    scoreDifferential <= -1 &&
    teamHasPossession
  ) {
    mods.activeModes.push('last_shot_losing');

    // Random timing 5-8 seconds (allows time for OREB and immediate foul)
    mods.gameClockTarget = Math.random() * 3 + 5; // 5.0 to 8.0

    // Force 3PT attempt if down 3 (need to tie)
    if (scoreDifferential === -3) {
      mods.forceShotType = '3pt';
    }
  }

  // =========================================================================
  // MODE 4: DESPERATION MODE
  // Increase 3PT volume and pace when trailing badly with <10 mins
  // =========================================================================
  if (gameTimeRemaining < 600 && scoreDifferential <= -9 && teamHasPossession) {
    // Calculate desperation magnitude
    const timeRemainingMinutes = gameTimeRemaining / 60;
    const magnitude = Math.abs(scoreDifferential) / (timeRemainingMinutes + 1);

    // Only trigger if magnitude exceeds threshold
    if (magnitude > 1.5) {
      mods.activeModes.push('desperation');

      // Scale effects by magnitude strength (cap at 1.0)
      const strength = Math.min(1.0, (magnitude - 1.5) / 2.0);

      // Additive adjustments (can stack with other modes)
      mods.shotDistribution3ptAdj += strength * 0.20; // Up to +20% 3PT
      mods.paceMultiplier *= 1.0 + strength * 0.10; // Up to +10% pace
    }
  }

  // =========================================================================
  // MODE 5: CONSERVE LEAD MODE
  // Slow pace and reduce 3PT when leading comfortably with <3 mins
  // =========================================================================
  if (gameTimeRemaining < 180 && scoreDifferential >= 15 && teamHasPossession) {
    // Calculate conserve magnitude
    const timeRemainingMinutes = gameTimeRemaining / 60;
    const magnitude = scoreDifferential / (timeRemainingMinutes + 1);

    // Only trigger if magnitude exceeds threshold
    if (magnitude > 1.5) {
      mods.activeModes.push('conserve_lead');

      // Scale effects by magnitude strength (cap at 1.0)
      const strength = Math.min(1.0, (magnitude - 1.5) / 2.0);

      // Additive adjustments (can stack with other modes)
      mods.shotDistribution3ptAdj += -(strength * 0.10); // Up to -10% 3PT
      mods.paceMultiplier *= 1.0 - strength * 0.15; // Up to -15% pace
    }
  }

  // =========================================================================
  // NOTE: Intentional Fouling (Mode 6) handled separately in possession.py
  // after ball handler selection, since it requires knowing who has the ball
  // =========================================================================

  return mods;
}

/**
 * Check if defense should intentionally foul.
 *
 * Basketball strategy:
 * - Down 2-3 points with <24 seconds: Foul immediately (otherwise opponent runs clock)
 * - Down 2-3 points with >24 seconds: DON'T foul (play defense, try for stop)
 * - Down 4-6 points with <60 seconds: Foul (need multiple possessions)
 *
 * @param gameTimeRemaining - Seconds left in game
 * @param scoreDifferential - From offense perspective (positive = offense ahead)
 * @param quarter - Current quarter
 * @param offensiveTeamLeading - True if offensive team is ahead
 * @returns True if defense should intentionally foul
 */
export function shouldIntentionalFoul(
  gameTimeRemaining: number,
  scoreDifferential: number,
  quarter: number,
  offensiveTeamLeading: boolean
): boolean {
  if (!(quarter === 4 && offensiveTeamLeading)) {
    return false;
  }

  // Down 2-3 with <24 seconds: MUST foul to get ball back
  if (scoreDifferential >= 2 && scoreDifferential <= 3 && gameTimeRemaining <= 24) {
    return true;
  }

  // Down 4-6: Foul with <60 seconds (need multiple possessions)
  if (scoreDifferential >= 4 && scoreDifferential <= 6 && gameTimeRemaining <= 60) {
    return true;
  }

  return false;
}
