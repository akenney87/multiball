/**
 * Basketball Simulator - Substitution System
 *
 * Manages player substitutions based on:
 * 1. Stamina thresholds (< 75 triggers immediate substitution)
 * 2. Minutes allocation (from tactical settings)
 * 3. Position matching (prefer position-compatible subs)
 *
 * Key Logic:
 * - Check after EVERY possession
 * - Substitution priority: stamina < 75 overrides minutes allocation
 * - Edge cases: all bench exhausted, no valid substitutes
 *
 * Integrates with:
 * - staminaManager.ts (current stamina values)
 * - quarter_simulation (active lineup management)
 *
 * @module simulation/systems/substitutions
 */

import type { Player } from '../../data/types';
import type { StaminaTracker } from '../stamina/staminaManager';

// =============================================================================
// DATA STRUCTURES
// =============================================================================

/**
 * Record of a substitution occurrence
 */
export interface SubstitutionEvent {
  /** Quarter time in "MM:SS" format */
  quarterTime: string;
  /** Name of player exiting */
  playerOut: string;
  /** Name of player entering */
  playerIn: string;
  /** Reason for substitution */
  reason: 'stamina' | 'minutes' | 'injury' | 'fouled_out' | 'stamina_rule2' | 'starter_return_rule1' | 'blowout_rest' | 'garbage_time' | 'close_game_insert_closer';
  /** Stamina of exiting player */
  staminaOut: number;
  /** Stamina of entering player */
  staminaIn: number;
  /** Team making substitution */
  team: 'home' | 'away';
}

/**
 * Q4 rotation decision for a starter
 */
interface Q4Decision {
  /** Action to take */
  action: 'STAY_IN' | 'WILL_FATIGUE' | 'INSERT_AT';
  /** Minutes playable from current stamina before dropping to 70 */
  playableMinutes: number;
  /** Current stamina value */
  currentStamina: number;
  /** Time into Q4 when stamina hits 70 (WILL_FATIGUE only) */
  subOutAt?: number;
  /** Time remaining when to insert player (INSERT_AT only) */
  insertAt?: number;
}

/**
 * Tactical settings interface (simplified)
 */
interface TacticalSettings {
  pace: 'fast' | 'standard' | 'slow';
  scoringOption1?: string;
  scoringOption2?: string;
  scoringOption3?: string;
}

/**
 * Player with calculated minutes target
 */
interface PlayerWithMinutes extends Player {
  minutesTarget: number;
  quarterTarget: number;
}

// =============================================================================
// MINUTES ALLOCATION CALCULATOR
// =============================================================================

/**
 * Calculate basketball overall rating (weighted average of all 25 attributes).
 *
 * Weights emphasize attributes most critical for basketball:
 * - Physical (40%): Height, jumping, agility, acceleration prioritized
 * - Technical (35%): Throw accuracy, hand-eye, form technique prioritized
 * - Mental (25%): Awareness, composure, consistency prioritized
 *
 * @param player - Player object with attributes
 * @returns Overall rating (0-100)
 */
function calculateBasketballOverall(player: any): number {
  // Handle both nested attributes (real data) and flat attributes (test data)
  const attrs = ('attributes' in player && player.attributes) ? player.attributes : player;

  // Weighted attribute system for basketball (totals 100%)
  const weights = {
    // Physical: 40% total
    grip_strength: 0.025,
    arm_strength: 0.020,
    core_strength: 0.030,
    agility: 0.045,
    acceleration: 0.040,
    top_speed: 0.030,
    jumping: 0.045,
    reactions: 0.040,
    stamina: 0.040,
    balance: 0.025,
    height: 0.045,
    durability: 0.015,
    // Mental: 25% total
    awareness: 0.050,
    creativity: 0.035,
    determination: 0.030,
    bravery: 0.025,
    consistency: 0.040,
    composure: 0.045,
    patience: 0.025,
    // Technical: 35% total
    hand_eye_coordination: 0.070,
    throw_accuracy: 0.080,
    form_technique: 0.070,
    finesse: 0.040,
    deception: 0.045,
    teamwork: 0.045,
  };

  // Calculate weighted sum
  let totalScore = 0;
  totalScore += attrs.grip_strength * weights.grip_strength;
  totalScore += attrs.arm_strength * weights.arm_strength;
  totalScore += attrs.core_strength * weights.core_strength;
  totalScore += attrs.agility * weights.agility;
  totalScore += attrs.acceleration * weights.acceleration;
  totalScore += attrs.top_speed * weights.top_speed;
  totalScore += attrs.jumping * weights.jumping;
  totalScore += attrs.reactions * weights.reactions;
  totalScore += attrs.stamina * weights.stamina;
  totalScore += attrs.balance * weights.balance;
  totalScore += attrs.height * weights.height;
  totalScore += attrs.durability * weights.durability;
  totalScore += attrs.awareness * weights.awareness;
  totalScore += attrs.creativity * weights.creativity;
  totalScore += attrs.determination * weights.determination;
  totalScore += attrs.bravery * weights.bravery;
  totalScore += attrs.consistency * weights.consistency;
  totalScore += attrs.composure * weights.composure;
  totalScore += attrs.patience * weights.patience;
  totalScore += attrs.hand_eye_coordination * weights.hand_eye_coordination;
  totalScore += attrs.throw_accuracy * weights.throw_accuracy;
  totalScore += attrs.form_technique * weights.form_technique;
  totalScore += attrs.finesse * weights.finesse;
  totalScore += attrs.deception * weights.deception;
  totalScore += attrs.teamwork * weights.teamwork;

  return totalScore;
}

/**
 * Apply user-provided minutes allocation to roster.
 *
 * Takes user's explicit minutes targets and converts to PlayerWithMinutes format.
 * Used when user has configured custom minutes in the lineup editor.
 *
 * @param roster - Team roster
 * @param userMinutesAllocation - User-provided minutes (player ID or name -> target minutes)
 * @returns Array of players with minutesTarget and quarterTarget fields
 */
export function applyUserMinutesAllocation(
  roster: Player[],
  userMinutesAllocation: Record<string, number>
): PlayerWithMinutes[] {
  return roster.map(player => {
    // Try to find allocation by player ID first, then by name
    const minutesTarget = userMinutesAllocation[player.id] ?? userMinutesAllocation[player.name] ?? 0;

    return {
      ...player,
      minutesTarget: Math.round(minutesTarget * 10) / 10,
      quarterTarget: Math.round((minutesTarget / 4) * 10) / 10
    } as PlayerWithMinutes;
  });
}

/**
 * Calculate minutes targets for all players using weighted formula.
 *
 * Algorithm:
 * 1. Calculate weight_i = (overall_i - minOverall + 1) ^ 1.6
 * 2. Calculate minutes_i = (weight_i / sum(weights)) * 240
 * 3. Apply ceiling of 42 minutes
 * 4. Redistribute excess proportionally
 *
 * @param roster - Team roster (10+ players)
 * @returns Array of players with minutesTarget and quarterTarget fields
 */
export function calculateMinutesTargets(roster: Player[]): PlayerWithMinutes[] {
  const EXPONENT = 1.0;
  const MAX_MINUTES = 40;
  const TOTAL_MINUTES = 240;

  // Calculate overall ratings
  const playersWithOverall = roster.map(p => ({
    player: p,
    overall: calculateBasketballOverall(p)
  }));

  // Find minimum overall
  const minOverall = Math.min(...playersWithOverall.map(p => p.overall));

  // Calculate weights
  const playersWithWeights = playersWithOverall.map(p => ({
    ...p,
    weight: Math.pow(p.overall - minOverall + 1, EXPONENT)
  }));

  // Calculate total weight
  const totalWeight = playersWithWeights.reduce((sum, p) => sum + p.weight, 0);

  // Calculate initial minutes
  let playersWithMinutes = playersWithWeights.map(p => ({
    ...p,
    minutesTarget: (p.weight / totalWeight) * TOTAL_MINUTES
  }));

  // Iteratively redistribute until no player exceeds MAX_MINUTES
  let hasExcess = true;
  let iterations = 0;
  const MAX_ITERATIONS = 20; // Safety limit to prevent infinite loops

  while (hasExcess && iterations < MAX_ITERATIONS) {
    iterations++;

    // Apply 42-minute ceiling and calculate excess
    let excess = 0;
    playersWithMinutes = playersWithMinutes.map(p => {
      if (p.minutesTarget > MAX_MINUTES) {
        excess += p.minutesTarget - MAX_MINUTES;
        return { ...p, minutesTarget: MAX_MINUTES };
      }
      return p;
    });

    // If there's excess, redistribute to eligible players
    if (excess > 0) {
      const eligible = playersWithMinutes.filter(p => p.minutesTarget < MAX_MINUTES);

      if (eligible.length === 0) {
        // No eligible players to receive excess, we're done (all at 42 minutes)
        hasExcess = false;
      } else {
        const eligibleWeight = eligible.reduce((sum, p) => sum + p.weight, 0);

        playersWithMinutes = playersWithMinutes.map(p => {
          if (p.minutesTarget < MAX_MINUTES) {
            const additionalMinutes = excess * (p.weight / eligibleWeight);
            return { ...p, minutesTarget: p.minutesTarget + additionalMinutes };
          }
          return p;
        });

        // Check if any player now exceeds MAX_MINUTES (need another iteration)
        hasExcess = playersWithMinutes.some(p => p.minutesTarget > MAX_MINUTES);
      }
    } else {
      // No excess, we're done
      hasExcess = false;
    }
  }

  // Calculate quarter targets and create final result
  return playersWithMinutes.map(p => ({
    ...p.player,
    minutesTarget: Math.round(p.minutesTarget * 10) / 10,  // Round to 0.1
    quarterTarget: Math.round((p.minutesTarget / 4) * 10) / 10
  } as PlayerWithMinutes));
}

// =============================================================================
// QUARTERLY ROTATION SYSTEM
// =============================================================================

/**
 * Rotation plan for a player in a specific quarter
 */
export interface QuarterlyRotationPlan {
  /** Player name */
  playerName: string;
  /** Should start the quarter */
  startsQuarter: boolean;
  /** Time remaining when player should sub out (null if plays full quarter) */
  subOutAt: number | null;
  /** Time remaining when player should sub in (null if doesn't sub in) */
  subInAt: number | null;
  /** Minutes needed this quarter */
  minutesNeeded: number;
}

/**
 * Calculate quarterly rotation plans for all players.
 *
 * Q1-Q3: Use quarter targets
 * Q4: Use remaining minutes needed
 *
 * @param roster - Team roster with minutes targets
 * @param quarter - Current quarter (1-4)
 * @param actualMinutes - Map of player name -> actual minutes played so far
 * @returns Array of rotation plans for this quarter
 */
export function calculateQuarterlyRotations(
  roster: PlayerWithMinutes[],
  quarter: number,
  actualMinutes: Record<string, number>,
  starterNames?: Set<string>
): QuarterlyRotationPlan[] {
  // Use provided starter names (from rating-based selection) if available,
  // otherwise fall back to top 5 by minutesTarget.
  // This ensures starters with low minutes (e.g., resting due to condition) are still
  // treated as starters for rotation purposes (play start of Q1/Q3, end of Q2/Q4).
  let starters: Set<string>;
  if (starterNames && starterNames.size === 5) {
    starters = starterNames;
  } else {
    const sorted = [...roster].sort((a, b) => b.minutesTarget - a.minutesTarget);
    starters = new Set(sorted.slice(0, 5).map(p => p.name));
  }

  // Calculate remaining minutes needed for each player based on actual minutes played
  // This accounts for cumulative error from previous quarters
  const remainingMinutes = (quarter - 1) * 12; // Minutes that should have been played so far
  const adjustedRoster = roster.map(p => {
    const actual = actualMinutes[p.name] || 0;
    const expectedSoFar = (p.minutesTarget / 4) * (quarter - 1);
    const error = actual - expectedSoFar; // Positive if played too much, negative if played too little

    // Adjust this quarter's target to compensate for error
    // If player played 2 min too much, reduce this quarter's target by 2 min
    const adjustedQuarterTarget = Math.max(0, p.quarterTarget - error);

    // Also cap so player doesn't exceed their total game target
    const remainingForGame = Math.max(0, p.minutesTarget - actual);
    const cappedTarget = Math.min(adjustedQuarterTarget, remainingForGame, 12); // Can't play more than 12 min in a quarter

    return {
      ...p,
      quarterTarget: cappedTarget,
      originalQuarterTarget: p.quarterTarget
    };
  });

  // Use adjusted roster for all calculations below
  const rosterToUse = adjustedRoster;

  if (quarter === 1) {
    // Q1: SIMPLE PRIORITY SYSTEM
    // - All 5 starters begin the quarter
    // - Each starter plays until they reach their quarterTarget
    // - When a starter hits their target, they sub out for the highest-minutes bench player
    // - Priority: Starters' minutes are SACRED

    const starterPlayers = rosterToUse.filter(p => starters.has(p.name));
    // Filter out bench players with 0 target - they should not enter the game
    const benchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget > 0);

    // Sort starters by quarterTarget (lowest minutes first - they sub out first)
    const startersSorted = [...starterPlayers].sort((a, b) => a.quarterTarget - b.quarterTarget);

    // Sort bench by quarterTarget (highest minutes first - they sub in first)
    const benchSorted = [...benchPlayers].sort((a, b) => b.quarterTarget - a.quarterTarget);

    // Create starter plans: they sub out when they've played their quarterTarget
    const starterPlans = startersSorted.map(p => {
      // Starter subs out at: 12.0 - quarterTarget remaining
      // E.g., if needs 7.6 min, subs out at 12 - 7.6 = 4.4 min remaining
      const subOutAt = 12.0 - p.quarterTarget;

      return {
        playerName: p.name,
        startsQuarter: true,
        subOutAt: subOutAt > 0 ? subOutAt : null,  // null if plays full quarter
        subInAt: null,
        minutesNeeded: p.quarterTarget
      };
    });

    // Create bench plans: they sub in when a starter comes out, play to end of quarter
    const benchPlans = benchSorted.map(p => {
      return {
        playerName: p.name,
        startsQuarter: false,
        subOutAt: null,  // Play to end of quarter
        subInAt: null,   // Will be determined dynamically when starter comes out
        minutesNeeded: p.quarterTarget
      };
    });

    // FIX: Create plans for bench players with 0 quarterTarget who might still be on court
    // These players have exceeded their allocation and should be subbed out immediately
    const exceededBenchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget <= 0);
    const exceededPlans = exceededBenchPlayers.map(p => {
      return {
        playerName: p.name,
        startsQuarter: true,  // Mark as starting so they can be subbed out
        subOutAt: 12.0,       // Sub out immediately (at quarter start)
        subInAt: null,
        minutesNeeded: 0      // They don't need any more minutes
      };
    });

    const allPlans = [...starterPlans, ...benchPlans, ...exceededPlans];

    // DEBUG: Log Q1 rotation plans
    console.log(`\n[Q1 SIMPLE ROTATION PLANS]`);
    console.log('  Starters (sub out order):');
    for (const plan of starterPlans.filter(p => p.subOutAt !== null)) {
      console.log(`    ${plan.playerName}: plays ${plan.minutesNeeded.toFixed(1)} min, subs out at ${plan.subOutAt.toFixed(1)} remaining`);
    }
    console.log('  Bench (sub in order):');
    for (const plan of benchPlans) {
      console.log(`    ${plan.playerName}: ${plan.minutesNeeded.toFixed(1)} min target`);
    }

    return allPlans;
  } else if (quarter === 2 || quarter === 4) {
    // Q2 & Q4: SIMPLE PRIORITY SYSTEM (bench starts, starters sub in)
    // - Bench continues from previous quarter
    // - Each starter subs IN after 12 - quarterTarget minutes to play their target
    // - When a starter needs to come IN, the bench player with LOWEST minutes subs OUT
    // - Priority: Starters' minutes are SACRED

    const starterPlayers = rosterToUse.filter(p => starters.has(p.name));
    // Filter out bench players with 0 target - they should not enter the game
    const benchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget > 0);

    // Sort starters by quarterTarget (highest minutes first - they sub in first)
    const startersSorted = [...starterPlayers].sort((a, b) => b.quarterTarget - a.quarterTarget);

    // Sort bench by quarterTarget (lowest minutes first - they sub out first)
    const benchSorted = [...benchPlayers].sort((a, b) => a.quarterTarget - b.quarterTarget);

    // Bench players start the quarter (continuing from Q1/Q3)
    // They don't have fixed sub-out times - they sub out when a starter needs to come in
    const benchPlans = benchSorted.map(p => {
      return {
        playerName: p.name,
        startsQuarter: true,  // Continues from previous quarter
        subOutAt: null,  // No fixed time - subs out when replaced by starter
        subInAt: null,
        minutesNeeded: p.quarterTarget
      };
    });

    // Starters sub in when bench players come out
    const starterPlans = startersSorted.map(p => {
      // Starter subs in at: quarterTarget remaining
      // E.g., LeBron needs 10 min, so he subs in at 10:00 remaining, plays until 0:00 = 10 min total
      const subInAt = p.quarterTarget;

      return {
        playerName: p.name,
        startsQuarter: false,
        subOutAt: null,  // Play to end of quarter
        subInAt: subInAt > 0 && subInAt < 12.0 ? subInAt : null,  // Only if they don't play full quarter
        minutesNeeded: p.quarterTarget
      };
    });

    // FIX: Create plans for bench players with 0 quarterTarget who might still be on court
    // These players have exceeded their allocation and should be subbed out immediately
    const exceededBenchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget <= 0);
    const exceededPlans = exceededBenchPlayers.map(p => {
      return {
        playerName: p.name,
        startsQuarter: true,  // Mark as starting so they can be subbed out
        subOutAt: 12.0,       // Sub out immediately (at quarter start)
        subInAt: null,
        minutesNeeded: 0      // They don't need any more minutes
      };
    });

    const allPlans = [...benchPlans, ...starterPlans, ...exceededPlans];

    // DEBUG: Log Q2/Q4 rotation plans
    console.log(`\n[Q${quarter} SIMPLE ROTATION PLANS]`);
    console.log('  Bench (continue from previous quarter, lowest minutes sub out first):');
    for (const plan of benchPlans) {
      console.log(`    ${plan.playerName}: ${plan.minutesNeeded.toFixed(1)} min target`);
    }
    console.log('  Starters (sub in order by highest minutes first):');
    for (const plan of starterPlans.filter(p => p.subInAt !== null)) {
      console.log(`    ${plan.playerName}: ${plan.minutesNeeded.toFixed(1)} min target, subs in at ${plan.subInAt.toFixed(1)} remaining`);
    }

    return allPlans;
  } else if (quarter === 3) {
    // Q3: Same as Q1 - starters begin, sub out in priority order
    const starterPlayers = rosterToUse.filter(p => starters.has(p.name));
    // Filter out bench players with 0 target - they should not enter the game
    const benchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget > 0);

    // Sort starters by quarterTarget (lowest minutes first - they sub out first)
    const startersSorted = [...starterPlayers].sort((a, b) => a.quarterTarget - b.quarterTarget);

    // Sort bench by quarterTarget (highest minutes first - they sub in first)
    const benchSorted = [...benchPlayers].sort((a, b) => b.quarterTarget - a.quarterTarget);

    // Create starter plans: they sub out when they've played their quarterTarget
    const starterPlans = startersSorted.map(p => {
      const subOutAt = 12.0 - p.quarterTarget;

      return {
        playerName: p.name,
        startsQuarter: true,
        subOutAt: subOutAt > 0 ? subOutAt : null,
        subInAt: null,
        minutesNeeded: p.quarterTarget
      };
    });

    // Create bench plans: they sub in when a starter comes out, play to end of quarter
    const benchPlans = benchSorted.map(p => {
      return {
        playerName: p.name,
        startsQuarter: false,
        subOutAt: null,
        subInAt: null,  // Will be determined dynamically when starter comes out
        minutesNeeded: p.quarterTarget
      };
    });

    // FIX: Create plans for bench players with 0 quarterTarget who might still be on court
    // These players have exceeded their allocation and should be subbed out immediately
    const exceededBenchPlayers = rosterToUse.filter(p => !starters.has(p.name) && p.quarterTarget <= 0);
    const exceededPlans = exceededBenchPlayers.map(p => {
      return {
        playerName: p.name,
        startsQuarter: true,  // Mark as starting so they can be subbed out
        subOutAt: 12.0,       // Sub out immediately (at quarter start)
        subInAt: null,
        minutesNeeded: 0      // They don't need any more minutes
      };
    });

    const allPlans = [...starterPlans, ...benchPlans, ...exceededPlans];

    // DEBUG: Log Q3 rotation plans
    console.log(`\n[Q3 SIMPLE ROTATION PLANS]`);
    console.log('  Starters (sub out order):');
    for (const plan of starterPlans.filter(p => p.subOutAt !== null)) {
      console.log(`    ${plan.playerName}: plays ${plan.minutesNeeded.toFixed(1)} min, subs out at ${plan.subOutAt.toFixed(1)} remaining`);
    }
    console.log('  Bench (sub in order):');
    for (const plan of benchPlans) {
      console.log(`    ${plan.playerName}: ${plan.minutesNeeded.toFixed(1)} min target`);
    }

    return allPlans;
  } else {
    // Fallback: Use adjusted targets for any quarter not explicitly handled
    // This uses the cumulative error-adjusted targets calculated above
    return rosterToUse.map(p => {
      const actual = actualMinutes[p.name] || 0;
      const remaining = Math.max(0, p.minutesTarget - actual);
      const isPlayerStarter = starters.has(p.name);

      if (remaining > 0 && p.quarterTarget > 0) {
        // Sub in at appropriate time (capped at 12 minutes and at adjusted target)
        const minutesToPlay = Math.min(p.quarterTarget, remaining, 12.0);
        return {
          playerName: p.name,
          startsQuarter: !isPlayerStarter,  // Bench continues, starters sub in
          subOutAt: isPlayerStarter ? null : minutesToPlay,  // Bench subs out when starters return
          subInAt: isPlayerStarter ? minutesToPlay : null,  // Starters sub in
          minutesNeeded: minutesToPlay
        };
      } else {
        // Don't play this quarter (target already met)
        return {
          playerName: p.name,
          startsQuarter: false,
          subOutAt: null,
          subInAt: null,
          minutesNeeded: 0
        };
      }
    });
  }
}

// =============================================================================
// SUBSTITUTION LOGIC
// =============================================================================

/**
 * Check if a player needs to be substituted.
 *
 * Priority:
 *   1. Stamina < threshold → immediate substitution
 *   2. Minutes played >= allocation → substitution
 *   3. Otherwise → no substitution
 *
 * M4.5 PHASE 4 FIX:
 *   - Raised threshold from 60 → 75 for NBA realism
 *   - Players should not play with stamina < 75 except in competitive end-game
 *   - Context-aware thresholds can be passed by caller:
 *     * Close game: 50-65 (let starters play tired)
 *     * Blowout: 80-85 (rest starters aggressively)
 *     * Foul trouble: 80 (prevent fouling out)
 *
 * @param player - Player object
 * @param currentStamina - Current stamina value (0-100)
 * @param minutesPlayed - Minutes played this quarter
 * @param minutesAllocation - Allocated minutes for quarter
 * @param staminaThreshold - Stamina threshold for substitution (default 75)
 * @returns Tuple of [needsSub, reason]
 */
export function checkSubstitutionNeeded(
  player: Player,
  currentStamina: number,
  minutesPlayed: number,
  minutesAllocation: number,
  staminaThreshold: number = 75.0
): [boolean, string] {
  // Priority 1: Stamina check (highest priority)
  if (currentStamina < staminaThreshold) {
    return [true, 'stamina'];
  }

  // Priority 2: Minutes allocation check
  // Allow small tolerance (0.1 minutes = 6 seconds)
  if (minutesPlayed >= minutesAllocation + 0.1) {
    return [true, 'minutes'];
  }

  // No substitution needed
  return [false, ''];
}

// =============================================================================
// M3: END-GAME SUBSTITUTION LOGIC
// =============================================================================

/**
 * Check if blowout substitution should occur (rest starters).
 *
 * Thresholds (from FOULS_AND_INJURIES_SPEC.md):
 * - Q4, <6 min, +20 points → rest starters
 * - Q4, <4 min, +18 points → rest starters
 * - Q4, <2 min, +15 points → rest starters
 * - Q4, <2 min, +30 points → garbage time (all subs)
 *
 * @param quarter - Current quarter (1-4)
 * @param timeRemainingSeconds - Seconds remaining in quarter
 * @param scoreDifferential - Point differential (positive if winning)
 * @param winning - True if team is winning
 * @returns Tuple of [shouldSub, reason]
 */
export function checkBlowoutSubstitution(
  quarter: number,
  timeRemainingSeconds: number,
  scoreDifferential: number,
  winning: boolean
): [boolean, string] {
  if (quarter !== 4) {
    return [false, ''];
  }

  if (!winning) {
    return [false, ''];
  }

  const minutesRemaining = timeRemainingSeconds / 60.0;

  // Garbage time (most extreme)
  if (minutesRemaining <= 2.0 && scoreDifferential >= 30) {
    return [true, 'garbage_time'];
  }

  // Blowout thresholds
  if (minutesRemaining <= 6.0 && scoreDifferential >= 20) {
    return [true, 'blowout_rest'];
  }
  if (minutesRemaining <= 4.0 && scoreDifferential >= 18) {
    return [true, 'blowout_rest'];
  }
  if (minutesRemaining <= 2.0 && scoreDifferential >= 15) {
    return [true, 'blowout_rest'];
  }

  return [false, ''];
}

/**
 * Check if starters/closers should be inserted in close game.
 *
 * Thresholds:
 * - Q4, <5 min, ±10 points → keep closers on floor
 * - Q4, <3 min, ±8 points → keep closers on floor
 * - Q4, <2 min, ±5 points → insert closers if benched
 *
 * @param quarter - Current quarter
 * @param timeRemainingSeconds - Seconds remaining
 * @param scoreDifferential - Point differential (abs value used)
 * @param player - Player object
 * @param isCloser - True if player is designated closer
 * @returns Tuple of [shouldInsert, reason]
 */
export function checkCloseGameSubstitution(
  quarter: number,
  timeRemainingSeconds: number,
  scoreDifferential: number,
  player: Player,
  isCloser: boolean
): [boolean, string] {
  if (quarter !== 4) {
    return [false, ''];
  }

  const minutesRemaining = timeRemainingSeconds / 60.0;

  // Check close game thresholds
  let isClose = false;
  if (minutesRemaining <= 5.0 && Math.abs(scoreDifferential) <= 10) {
    isClose = true;
  }
  if (minutesRemaining <= 3.0 && Math.abs(scoreDifferential) <= 8) {
    isClose = true;
  }
  if (minutesRemaining <= 2.0 && Math.abs(scoreDifferential) <= 5) {
    isClose = true;
  }

  if (!isClose) {
    return [false, ''];
  }

  // If closer and it's a close game in final 2 minutes, insert
  if (isCloser && minutesRemaining <= 2.0) {
    return [true, 'close_game_insert_closer'];
  }

  return [false, ''];
}

/**
 * Detect if blowout is becoming competitive (re-insert starters).
 *
 * Triggers:
 * - Lead shrinks by 10+ points
 * - Lead drops below blowout threshold
 *
 * @param previousDifferential - Previous score differential
 * @param currentDifferential - Current score differential
 * @param timeRemainingSeconds - Seconds remaining
 * @returns True if comeback detected (starters should be re-inserted)
 */
export function checkBlowoutComeback(
  previousDifferential: number,
  currentDifferential: number,
  timeRemainingSeconds: number
): boolean {
  const differentialChange = previousDifferential - currentDifferential;

  // Lead shrinks by 10+ points
  if (differentialChange >= 10) {
    return true;
  }

  // Lead drops below blowout threshold
  const minutesRemaining = timeRemainingSeconds / 60.0;
  if (minutesRemaining <= 4.0 && currentDifferential < 15) {
    return true;
  }

  return false;
}

/**
 * Select best substitute from bench.
 *
 * Selection criteria:
 * 1. Prefer position match (PG/SG interchangeable, SF/PF interchangeable, C isolated)
 * 2. Prefer players with stamina >= returnThreshold (90+) to prevent rapid rotation
 * 3. Highest stamina among position matches
 * 4. If no position match or no one above threshold, choose best available
 *
 * Position Compatibility:
 *   PG ↔ SG (guards interchangeable)
 *   SF ↔ PF (wings interchangeable)
 *   C (centers isolated)
 *
 * M4.5 PHASE 4 FIX:
 *   Added returnThreshold (90) to prevent rapid rotation. Bench players must recover
 *   to 90+ stamina before being eligible to return. Falls back to best available if
 *   no one meets threshold (edge case: whole bench is fatigued).
 *
 * @param benchPlayers - List of players currently on bench
 * @param positionOut - Position of player being substituted
 * @param staminaValues - Map of player name → current stamina
 * @param returnThreshold - Minimum stamina for bench players (default 90)
 * @returns Selected substitute or null if no valid subs
 */
export function selectSubstitute(
  benchPlayers: Player[],
  positionOut: string,
  staminaValues: Record<string, number>,
  returnThreshold: number = 90.0
): Player | null {
  if (benchPlayers.length === 0) {
    return null;
  }

  // M4.5 PHASE 4: Filter for position-compatible players
  const compatiblePlayers = benchPlayers.filter(p =>
    isPositionCompatible(positionOut, p.position)
  );

  // M4.5 PHASE 4: Prefer players above return threshold (90+ stamina)
  if (compatiblePlayers.length > 0) {
    // First try: players above threshold
    const wellRested = compatiblePlayers.filter(p =>
      (staminaValues[p.name] ?? 0) >= returnThreshold
    );

    if (wellRested.length > 0) {
      // Sort by stamina (highest first) among well-rested players
      wellRested.sort((a, b) =>
        (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
      );
      return wellRested[0];
    } else {
      // Fallback: no one above threshold, use best available
      compatiblePlayers.sort((a, b) =>
        (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
      );
      return compatiblePlayers[0];
    }
  }

  // No compatible players, choose best available from all bench (any position)
  const wellRestedAny = benchPlayers.filter(p =>
    (staminaValues[p.name] ?? 0) >= returnThreshold
  );

  if (wellRestedAny.length > 0) {
    wellRestedAny.sort((a, b) =>
      (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
    );
    return wellRestedAny[0];
  } else {
    // Absolute fallback: use best available regardless of stamina
    const sorted = [...benchPlayers].sort((a, b) =>
      (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
    );
    return sorted[0];
  }
}

/**
 * Check if two positions are interchangeable.
 *
 * Position compatibility rules:
 *   PG ↔ SG (guards)
 *   SF ↔ PF (wings)
 *   C ↔ C only (centers)
 *
 * @param positionOut - Position of player exiting
 * @param positionIn - Position of candidate substitute
 * @returns True if positions are compatible
 */
export function isPositionCompatible(positionOut: string, positionIn: string): boolean {
  // Guards are interchangeable
  const guards = new Set(['PG', 'SG']);
  if (guards.has(positionOut) && guards.has(positionIn)) {
    return true;
  }

  // Wings are interchangeable
  const wings = new Set(['SF', 'PF']);
  if (wings.has(positionOut) && wings.has(positionIn)) {
    return true;
  }

  // Centers only match with centers
  if (positionOut === 'C' && positionIn === 'C') {
    return true;
  }

  return false;
}

// =============================================================================
// LINEUP MANAGER CLASS
// =============================================================================

/**
 * Manages the 5 active players on court for a team.
 *
 * Responsibilities:
 * - Track current 5-player lineup
 * - Track bench players
 * - Execute substitutions
 * - Validate lineup integrity (always 5 players)
 */
export class LineupManager {
  private team: Player[];
  private activeLineup: Player[];
  private bench: Player[];

  /**
   * Initialize with starting lineup.
   *
   * @param team - Full team roster (10-13 players)
   * @param startingLineup - Optional list of 5 players to start
   * @throws Error if team has fewer than 5 players
   * @throws Error if startingLineup doesn't have exactly 5 players
   */
  constructor(team: Player[], startingLineup?: Player[]) {
    if (team.length < 5) {
      throw new Error(`Team must have at least 5 players, got ${team.length}`);
    }

    this.team = team;

    // Use provided starting lineup or default to first 5
    if (startingLineup !== undefined) {
      if (startingLineup.length !== 5) {
        throw new Error(`Starting lineup must have exactly 5 players, got ${startingLineup.length}`);
      }
      this.activeLineup = [...startingLineup];

      // Bench is everyone not in starting lineup
      const startingNames = new Set(startingLineup.map(p => p.name));
      this.bench = team.filter(p => !startingNames.has(p.name));
    } else {
      this.activeLineup = team.slice(0, 5);
      this.bench = team.length > 5 ? team.slice(5) : [];
    }
  }

  /**
   * Return current 5 players on court
   */
  getActivePlayers(): Player[] {
    return [...this.activeLineup];
  }

  /**
   * Return players on bench
   */
  getBenchPlayers(): Player[] {
    return [...this.bench];
  }

  /**
   * Find player in team by name
   *
   * @param name - Player name to search for
   * @returns Player object if found, null otherwise
   */
  getPlayerByName(name: string): Player | null {
    return this.team.find(p => p.name === name) ?? null;
  }

  /**
   * Replace playerOut with playerIn.
   *
   * Side Effects:
   *   Updates activeLineup and bench lists
   *
   * @param playerOut - Player to remove from active lineup
   * @param playerIn - Player to add to active lineup
   * @returns True if substitution successful, false otherwise
   */
  substitute(playerOut: Player, playerIn: Player): boolean {
    // Find playerOut in active lineup
    const playerOutIndex = this.activeLineup.findIndex(p => p.name === playerOut.name);
    if (playerOutIndex === -1) {
      // Player not in active lineup
      return false;
    }

    // Find playerIn on bench
    const playerInIndex = this.bench.findIndex(p => p.name === playerIn.name);
    if (playerInIndex === -1) {
      // Player not on bench
      return false;
    }

    // Execute substitution
    // Move playerOut to bench
    this.bench.push(this.activeLineup[playerOutIndex]);

    // Move playerIn to active lineup (replace playerOut)
    this.activeLineup[playerOutIndex] = this.bench[playerInIndex];

    // Remove playerIn from bench
    this.bench.splice(playerInIndex, 1);

    return true;
  }

  /**
   * Validate lineup integrity.
   *
   * @returns True if lineup is valid (exactly 5 active players)
   */
  validateLineup(): boolean {
    return this.activeLineup.length === 5;
  }
}

// =============================================================================
// SUBSTITUTION MANAGER CLASS
// =============================================================================

/**
 * Manages substitution logic for quarter simulation.
 *
 * Tracks active lineups, bench availability, and minutes allocation.
 * Coordinates substitutions for both teams based on stamina and minutes.
 */
export class SubstitutionManager {
  private homeRoster: Player[];
  private awayRoster: Player[];
  private homeRosterWithMinutes: PlayerWithMinutes[];
  private awayRosterWithMinutes: PlayerWithMinutes[];
  private homeRotationPlans: QuarterlyRotationPlan[];
  private awayRotationPlans: QuarterlyRotationPlan[];
  private currentQuarter: number;
  private actualMinutesHome: Record<string, number>;
  private actualMinutesAway: Record<string, number>;
  /** Minutes played at the start of current quarter (for minutes-based sub triggers) */
  private quarterStartMinutesHome: Record<string, number>;
  private quarterStartMinutesAway: Record<string, number>;
  /** PHASE 3: Track recent subs to prevent thrashing (player -> game seconds when they subbed) */
  private recentSubTime: Record<string, number>;
  private gameSecondsElapsed: number;
  private tacticalHome: TacticalSettings | null;
  private tacticalAway: TacticalSettings | null;
  private homeLineupManager: LineupManager;
  private awayLineupManager: LineupManager;
  private substitutionEvents: SubstitutionEvent[];
  private lastSubTime: Record<string, number>;
  private timeOnCourt: Record<string, number>;
  private homeStarters: Set<string>;
  private awayStarters: Set<string>;
  private starterReplacementMap: Record<string, string>;
  private q4StartProcessed: boolean;
  private q4DecisionsHome: Record<string, Q4Decision>;
  private q4DecisionsAway: Record<string, Q4Decision>;
  private minutesAllocationHome: Record<string, number>;
  private minutesAllocationAway: Record<string, number>;
  private paceHome: string;
  private paceAway: string;
  private scoringOptionsHome: string[];
  private scoringOptionsAway: string[];

  /**
   * Initialize substitution manager with new quarterly rotation system.
   *
   * @param homeRoster - Full home team roster (10+ players)
   * @param awayRoster - Full away team roster (10+ players)
   * @param homeStartingLineup - Optional starting 5 for home team
   * @param awayStartingLineup - Optional starting 5 for away team
   * @param tacticalHome - TacticalSettings for home team (optional)
   * @param tacticalAway - TacticalSettings for away team (optional)
   * @param homeMinutesAllocation - User-provided minutes allocation for home team (optional)
   * @param awayMinutesAllocation - User-provided minutes allocation for away team (optional)
   */
  constructor(
    homeRoster: Player[],
    awayRoster: Player[],
    homeStartingLineup?: Player[],
    awayStartingLineup?: Player[],
    tacticalHome?: TacticalSettings | null,
    tacticalAway?: TacticalSettings | null,
    homeMinutesAllocation?: Record<string, number> | null,
    awayMinutesAllocation?: Record<string, number> | null
  ) {
    this.homeRoster = homeRoster;
    this.awayRoster = awayRoster;
    this.tacticalHome = tacticalHome ?? null;
    this.tacticalAway = tacticalAway ?? null;

    // Use user-provided minutes allocation if available, otherwise calculate automatically
    const hasValidHomeAllocation = homeMinutesAllocation && Object.keys(homeMinutesAllocation).length > 0;
    const hasValidAwayAllocation = awayMinutesAllocation && Object.keys(awayMinutesAllocation).length > 0;

    this.homeRosterWithMinutes = hasValidHomeAllocation
      ? applyUserMinutesAllocation(homeRoster, homeMinutesAllocation)
      : calculateMinutesTargets(homeRoster);
    this.awayRosterWithMinutes = hasValidAwayAllocation
      ? applyUserMinutesAllocation(awayRoster, awayMinutesAllocation)
      : calculateMinutesTargets(awayRoster);

    // Initialize rotation plans (will be updated at start of each quarter)
    this.homeRotationPlans = [];
    this.awayRotationPlans = [];
    this.currentQuarter = 1;

    // Track actual minutes played
    this.actualMinutesHome = {};
    this.actualMinutesAway = {};
    this.quarterStartMinutesHome = {};
    this.quarterStartMinutesAway = {};
    for (const player of homeRoster) {
      this.actualMinutesHome[player.name] = 0;
      this.quarterStartMinutesHome[player.name] = 0;
    }
    for (const player of awayRoster) {
      this.actualMinutesAway[player.name] = 0;
      this.quarterStartMinutesAway[player.name] = 0;
    }

    // Determine starting lineups from minutes targets if not provided
    const homeStarters = homeStartingLineup ||
      [...this.homeRosterWithMinutes]
        .sort((a, b) => b.minutesTarget - a.minutesTarget)
        .slice(0, 5);

    const awayStarters = awayStartingLineup ||
      [...this.awayRosterWithMinutes]
        .sort((a, b) => b.minutesTarget - a.minutesTarget)
        .slice(0, 5);

    // Initialize lineup managers
    this.homeLineupManager = new LineupManager(homeRoster, homeStarters);
    this.awayLineupManager = new LineupManager(awayRoster, awayStarters);

    // Initialize starter sets for isStarter() method
    // Starters are determined by who starts Q1 (rating-based or explicitly selected)
    // NOT by minutes allocation. A starter with low minutes (e.g., 20 min due to condition)
    // should still be treated as a starter for rotation purposes (play start of Q1/Q3, end of Q2/Q4).
    this.homeStarters = new Set(homeStarters.map(p => p.name));
    this.awayStarters = new Set(awayStarters.map(p => p.name));

    // Track substitution events
    this.substitutionEvents = [];

    // Track last substitution time per player
    this.lastSubTime = {};
    for (const player of [...homeRoster, ...awayRoster]) {
      this.lastSubTime[player.name] = -999.0;
    }

    // PHASE 3: Track recent substitutions to prevent thrashing
    this.recentSubTime = {};
    this.gameSecondsElapsed = 0;

    // Track continuous time on court for each player
    this.timeOnCourt = {};
    for (const player of [...homeRoster, ...awayRoster]) {
      this.timeOnCourt[player.name] = 0.0;
    }

    // Track which backup replaced which starter
    this.starterReplacementMap = {};

    // Q4 closer system
    this.q4StartProcessed = false;
    this.q4DecisionsHome = {};
    this.q4DecisionsAway = {};

    // Initialize minutes allocation (quarter targets)
    this.minutesAllocationHome = {};
    this.minutesAllocationAway = {};
    for (const player of this.homeRosterWithMinutes) {
      this.minutesAllocationHome[player.name] = player.quarterTarget;
    }
    for (const player of this.awayRosterWithMinutes) {
      this.minutesAllocationAway[player.name] = player.quarterTarget;
    }

    // Extract pace and scoring options from tactical settings
    this.paceHome = (tacticalHome as any)?.pace || 'standard';
    this.paceAway = (tacticalAway as any)?.pace || 'standard';
    this.scoringOptionsHome = [
      (tacticalHome as any)?.scoring_option_1,
      (tacticalHome as any)?.scoring_option_2,
      (tacticalHome as any)?.scoring_option_3
    ].filter((opt): opt is string => opt !== null && opt !== undefined);
    this.scoringOptionsAway = [
      (tacticalAway as any)?.scoring_option_1,
      (tacticalAway as any)?.scoring_option_2,
      (tacticalAway as any)?.scoring_option_3
    ].filter((opt): opt is string => opt !== null && opt !== undefined);
  }

  /**
   * PHASE 2: Calculate minutes deficit for a player.
   *
   * Deficit = Target Minutes - Actual Minutes Played
   * - Positive: Player needs more minutes (behind target)
   * - Negative: Player has played too many minutes (over target)
   *
   * @param playerName - Player name
   * @param team - 'home' or 'away'
   * @returns Deficit in minutes (positive = needs more, negative = over target)
   */
  calculateDeficit(playerName: string, team: 'home' | 'away'): number {
    const rosterWithMinutes = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
    const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

    const playerData = rosterWithMinutes.find(p => p.name === playerName);
    const target = playerData?.minutesTarget ?? 0;
    const actual = actualMinutes[playerName] ?? 0;

    return target - actual;
  }

  /**
   * PHASE 2: Calculate remaining minutes needed this game.
   *
   * @param playerName - Player name
   * @param team - 'home' or 'away'
   * @returns Remaining minutes needed (clamped to >= 0)
   */
  getRemainingMinutesNeeded(playerName: string, team: 'home' | 'away'): number {
    return Math.max(0, this.calculateDeficit(playerName, team));
  }

  /**
   * Start a new quarter - calculate rotation plans based on quarterly rotation system.
   *
   * @param quarter - Quarter number (1-4)
   */
  startQuarter(quarter: number): void {
    this.currentQuarter = quarter;

    // PHASE 1 FIX: Snapshot minutes played at the start of this quarter
    // This enables minutes-based substitution triggers instead of time-based
    for (const player of this.homeRoster) {
      this.quarterStartMinutesHome[player.name] = this.actualMinutesHome[player.name] || 0;
    }
    for (const player of this.awayRoster) {
      this.quarterStartMinutesAway[player.name] = this.actualMinutesAway[player.name] || 0;
    }

    // Calculate rotation plans for this quarter
    // Pass actual starter names so rotation plans know who the real starters are
    // (rating-based, not minutes-based)
    this.homeRotationPlans = calculateQuarterlyRotations(
      this.homeRosterWithMinutes,
      quarter,
      this.actualMinutesHome,
      this.homeStarters
    );

    this.awayRotationPlans = calculateQuarterlyRotations(
      this.awayRosterWithMinutes,
      quarter,
      this.actualMinutesAway,
      this.awayStarters
    );

    // PHASE 2 FIX: Correct startsQuarter flag based on ACTUAL lineup state
    // The rotation plan calculation assumes ideal state, but if a player couldn't
    // sub out in the previous quarter (due to lack of bench players), they're still on court
    const homeActiveNames = new Set(this.homeLineupManager.getActivePlayers().map(p => p.name));
    const awayActiveNames = new Set(this.awayLineupManager.getActivePlayers().map(p => p.name));

    for (const plan of this.homeRotationPlans) {
      const isActuallyOnCourt = homeActiveNames.has(plan.playerName);
      if (plan.startsQuarter !== isActuallyOnCourt) {
        console.log(`  [LINEUP CORRECTION] ${plan.playerName}: startsQuarter ${plan.startsQuarter} -> ${isActuallyOnCourt}`);
        plan.startsQuarter = isActuallyOnCourt;
        // If player is on court but plan said bench, they need to sub out at some point
        if (isActuallyOnCourt && plan.subOutAt === null) {
          // Calculate when they should sub out based on remaining minutes needed
          const deficit = this.calculateDeficit(plan.playerName, 'home');
          if (deficit > 0) {
            // They still need minutes - sub out at end of quarter (or based on minutesNeeded)
            plan.subOutAt = Math.max(0, 12.0 - plan.minutesNeeded);
          } else {
            // They're at/over target - sub out immediately
            plan.subOutAt = 12.0;
          }
        }
      }
    }

    for (const plan of this.awayRotationPlans) {
      const isActuallyOnCourt = awayActiveNames.has(plan.playerName);
      if (plan.startsQuarter !== isActuallyOnCourt) {
        console.log(`  [LINEUP CORRECTION] ${plan.playerName}: startsQuarter ${plan.startsQuarter} -> ${isActuallyOnCourt}`);
        plan.startsQuarter = isActuallyOnCourt;
        if (isActuallyOnCourt && plan.subOutAt === null) {
          const deficit = this.calculateDeficit(plan.playerName, 'away');
          if (deficit > 0) {
            plan.subOutAt = Math.max(0, 12.0 - plan.minutesNeeded);
          } else {
            plan.subOutAt = 12.0;
          }
        }
      }
    }

    // DEBUG: Log rotation plans for key players
    const debugPlayers = ['LeBron James', 'Jaxson Hayes', 'Anthony Davis'];
    console.log(`\n[ROTATION PLANS] Q${quarter} Start`);

    const homePlansToLog = this.homeRotationPlans.filter(p => debugPlayers.includes(p.playerName));
    if (homePlansToLog.length > 0) {
      console.log('  Home Team:');
      for (const plan of homePlansToLog) {
        const actualMin = this.actualMinutesHome[plan.playerName] || 0;
        console.log(`    ${plan.playerName}: starts=${plan.startsQuarter}, ` +
          `subOut=${plan.subOutAt !== null ? plan.subOutAt.toFixed(1) : 'null'}, ` +
          `subIn=${plan.subInAt !== null ? plan.subInAt.toFixed(1) : 'null'}, ` +
          `need=${plan.minutesNeeded.toFixed(1)}, actual=${actualMin.toFixed(1)}`);
      }
    }

    const awayPlansToLog = this.awayRotationPlans.filter(p => debugPlayers.includes(p.playerName));
    if (awayPlansToLog.length > 0) {
      console.log('  Away Team:');
      for (const plan of awayPlansToLog) {
        const actualMin = this.actualMinutesAway[plan.playerName] || 0;
        console.log(`    ${plan.playerName}: starts=${plan.startsQuarter}, ` +
          `subOut=${plan.subOutAt !== null ? plan.subOutAt.toFixed(1) : 'null'}, ` +
          `subIn=${plan.subInAt !== null ? plan.subInAt.toFixed(1) : 'null'}, ` +
          `need=${plan.minutesNeeded.toFixed(1)}, actual=${actualMin.toFixed(1)}`);
      }
    }
  }

  /**
   * Update actual minutes played for a player.
   *
   * @param playerName - Player name
   * @param minutesPlayed - Minutes to add
   * @param team - 'home' or 'away'
   */
  addMinutesPlayed(playerName: string, minutesPlayed: number, team: 'home' | 'away'): void {
    if (team === 'home') {
      this.actualMinutesHome[playerName] = (this.actualMinutesHome[playerName] || 0) + minutesPlayed;
    } else {
      this.actualMinutesAway[playerName] = (this.actualMinutesAway[playerName] || 0) + minutesPlayed;
    }
  }

  /**
   * Check all active players for substitution needs and execute.
   *
   * Side Effects:
   *   Updates lineup managers if substitutions occur
   *
   * @param staminaTracker - StaminaTracker instance
   * @param gameTimeStr - Current game time string
   * @param timeRemainingInQuarter - Seconds remaining in quarter
   * @param quarterNumber - Current quarter (1-4)
   * @param homeScore - Current home team score
   * @param awayScore - Current away team score
   * @param foulSystem - FoulSystem instance to check for fouled-out players
   * @param debug - If true, print debug information
   * @returns List of substitution events that occurred
   */
  checkAndExecuteSubstitutions(
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingInQuarter: number = 0,
    quarterNumber: number = 1,
    homeScore: number = 0,
    awayScore: number = 0,
    foulSystem: any = null,
    debug: boolean = false
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];

    // Q4 CLOSER SYSTEM: REMOVED
    // All substitutions now handled uniformly by rotation plans across all quarters

    // PRIORITY 1: Check rotation-based substitutions FIRST
    const homeRotationEvents = this.checkRotationPlanSubstitutions(
      this.homeLineupManager,
      this.homeRotationPlans,
      staminaTracker,
      gameTimeStr,
      timeRemainingInQuarter,
      'home',
      foulSystem
    );
    events.push(...homeRotationEvents);

    const awayRotationEvents = this.checkRotationPlanSubstitutions(
      this.awayLineupManager,
      this.awayRotationPlans,
      staminaTracker,
      gameTimeStr,
      timeRemainingInQuarter,
      'away',
      foulSystem
    );
    events.push(...awayRotationEvents);

    // PRIORITY 2: DISABLED - Old substitution system conflicts with rotation plans
    // The rotation plan system now handles all substitutions
    // const homeEvents = this.checkTeamSubstitutions(
    //   this.homeLineupManager,
    //   this.minutesAllocationHome,
    //   staminaTracker,
    //   gameTimeStr,
    //   timeRemainingInQuarter,
    //   quarterNumber,
    //   homeScore - awayScore,
    //   'home',
    //   foulSystem
    // );
    // events.push(...homeEvents);

    // const awayEvents = this.checkTeamSubstitutions(
    //   this.awayLineupManager,
    //   this.minutesAllocationAway,
    //   staminaTracker,
    //   gameTimeStr,
    //   timeRemainingInQuarter,
    //   quarterNumber,
    //   awayScore - homeScore,
    //   'away',
    //   foulSystem
    // );
    // events.push(...awayEvents);

    // Store events
    this.substitutionEvents.push(...events);

    if (debug && events.length > 0) {
      console.log(`[DEBUG SUB CHECK] ${gameTimeStr}: ${events.length} substitutions executed`);
    }

    return events;
  }

  /**
   * Check and execute rotation-based substitutions for one team.
   * Uses the quarterly rotation plans calculated at the start of each quarter.
   *
   * @param lineupManager - LineupManager for this team
   * @param rotationPlans - Quarterly rotation plans for this team
   * @param staminaTracker - StaminaTracker instance
   * @param gameTimeStr - Current game time string
   * @param timeRemainingInQuarter - Seconds remaining in quarter
   * @param team - 'home' or 'away'
   * @param foulSystem - FoulSystem instance to check for fouled-out players
   * @returns List of substitution events
   */
  private checkRotationPlanSubstitutions(
    lineupManager: LineupManager,
    rotationPlans: QuarterlyRotationPlan[],
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingInQuarter: number,
    team: 'home' | 'away',
    foulSystem: any = null
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    const timeRemainingMin = timeRemainingInQuarter / 60.0;
    const staminaValues = staminaTracker.getAllStaminaValues();
    const activePlayers = lineupManager.getActivePlayers();
    const benchPlayers = lineupManager.getBenchPlayers();
    const activeNames = new Set(activePlayers.map(p => p.name));

    // DEBUG: Log rotation check state for key players
    const debugPlayers = ['LeBron James', 'Jaxson Hayes', 'Anthony Davis'];
    const shouldDebug = rotationPlans.some(p => debugPlayers.includes(p.playerName));
    if (shouldDebug) {
      console.log(`\n[ROTATION DEBUG] Q${this.currentQuarter} @ ${gameTimeStr} (${timeRemainingMin.toFixed(2)} min remaining)`);
      console.log(`  Active: ${activePlayers.map(p => p.name).join(', ')}`);
      console.log(`  Bench: ${benchPlayers.map(p => p.name).join(', ')}`);
    }

    // Get quarter-start minutes for this team (for minutes-based triggers)
    const quarterStartMinutes = team === 'home' ? this.quarterStartMinutesHome : this.quarterStartMinutesAway;
    const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

    // Execute the appropriate substitution pattern based on quarter
    if (this.currentQuarter === 1 || this.currentQuarter === 3) {
      // Q1/Q3 PATTERN: Starters sub OUT, bench players (highest minutes) sub IN

      // Find starters who need to sub OUT
      // PHASE 2: Use minutes-played triggers AND check for over-target players
      const startersToSubOut: Array<{player: Player, plan: QuarterlyRotationPlan}> = [];
      for (const plan of rotationPlans) {
        if (plan.startsQuarter && activeNames.has(plan.playerName)) {
          const totalMinutes = actualMinutes[plan.playerName] || 0;
          const quarterStartMin = quarterStartMinutes[plan.playerName] || 0;
          const minutesThisQuarter = totalMinutes - quarterStartMin;
          const deficit = this.calculateDeficit(plan.playerName, team);

          // PHASE 2: Two conditions to trigger sub-out:
          // 1. Player has hit their quarterly target (original logic)
          // 2. Player is at or over their GAME target (deficit <= 0)
          const hitQuarterTarget = plan.subOutAt !== null && minutesThisQuarter >= plan.minutesNeeded;
          const overGameTarget = deficit <= 0;
          const shouldSubOut = hitQuarterTarget || overGameTarget;

          if (debugPlayers.includes(plan.playerName)) {
            console.log(`  [${plan.playerName}] SUB OUT: minutesThisQ=${minutesThisQuarter.toFixed(2)}, qTarget=${plan.minutesNeeded.toFixed(2)}, deficit=${deficit.toFixed(2)}, shouldSub=${shouldSubOut}`);
          }

          if (shouldSubOut) {
            const player = activePlayers.find(p => p.name === plan.playerName);
            if (player) {
              startersToSubOut.push({player, plan});
            }
          }
        }
      }

      // Get bench players sorted by minutes (highest first), excluding those already playing
      // IMPORTANT: Exclude starters who already played their target minutes this quarter
      const starterNames = new Set(rotationPlans.filter(p => p.startsQuarter).map(p => p.playerName));

      // Get roster with minutes targets to filter out 0-allocation players
      const rosterWithMinutes = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
      const gameMinutesTargetByName: Record<string, number> = {};
      for (const p of rosterWithMinutes) {
        gameMinutesTargetByName[p.name] = p.minutesTarget;
      }

      // PHASE 2: Sort bench players by DEFICIT (descending)
      // Players with LARGEST deficit (most behind target) should sub IN first
      const availableBench = benchPlayers
        .filter(p => {
          if (foulSystem && foulSystem.isFouledOut(p.name)) return false;
          // Don't allow starters who already played their target to sub back in
          if (starterNames.has(p.name)) return false;
          // CRITICAL: Don't allow DNP players (0 game minutes allocation) to enter
          const gameTarget = gameMinutesTargetByName[p.name] ?? 0;
          if (gameTarget <= 0) return false;
          return true;
        })
        .map(p => {
          const deficit = this.calculateDeficit(p.name, team);
          return {player: p, deficit};
        })
        .sort((a, b) => b.deficit - a.deficit);  // PHASE 2: Largest deficit first

      // PHASE 2: Sort starters to sub out by DEFICIT (ascending)
      // Starters with SMALLEST deficit (closest to/over target) should sub out FIRST
      // This ensures players who are ahead of pace rest first, keeping behind-pace players on court
      startersToSubOut.sort((a, b) => {
        const aDeficit = this.calculateDeficit(a.player.name, team);
        const bDeficit = this.calculateDeficit(b.player.name, team);
        return aDeficit - bDeficit;  // Smallest deficit first (most ahead of target)
      });

      // Match each starter subbing out with next available bench player
      // Only attempt as many substitutions as we have bench players available
      let benchIndex = 0;
      for (const {player: starterOut, plan} of startersToSubOut) {
        if (benchIndex >= availableBench.length) break;

        const benchIn = availableBench[benchIndex];
        if (!benchIn) break;

        const success = lineupManager.substitute(starterOut, benchIn.player);

        if (success) {
          // PHASE 3: Record sub time for cooldown tracking
          this.recentSubTime[starterOut.name] = this.gameSecondsElapsed;
          this.recentSubTime[benchIn.player.name] = this.gameSecondsElapsed;

          console.log(`  → SUB: ${starterOut.name} OUT (played ${plan.minutesNeeded.toFixed(1)} min), ${benchIn.player.name} IN`);
          events.push({
            quarterTime: gameTimeStr,
            playerOut: starterOut.name,
            playerIn: benchIn.player.name,
            reason: 'minutes',
            staminaOut: staminaValues[starterOut.name] ?? 0,
            staminaIn: staminaValues[benchIn.player.name] ?? 0,
            team
          });
          benchIndex++;
        }
      }
    } else if (this.currentQuarter === 2 || this.currentQuarter === 4) {
      // Q2/Q4 PATTERN: Starters sub IN, bench players (lowest minutes) sub OUT

      // Get roster with minutes targets for sorting
      const rosterWithMinutes = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
      const gameMinutesTargetByName: Record<string, number> = {};
      for (const p of rosterWithMinutes) {
        gameMinutesTargetByName[p.name] = p.minutesTarget;
      }

      // PHASE 3: Find ALL active players who need to sub OUT
      // This includes anyone who has hit their quarterly target OR is over their GAME target
      const playersToSubOut: Array<{player: Player, plan: QuarterlyRotationPlan, minutesPlayed: number, deficit: number}> = [];

      for (const player of activePlayers) {
        const plan = rotationPlans.find(rp => rp.playerName === player.name);
        if (!plan) continue;

        const totalMinutes = actualMinutes[player.name] || 0;
        const quarterStartMin = quarterStartMinutes[player.name] || 0;
        const minutesThisQuarter = totalMinutes - quarterStartMin;
        const deficit = this.calculateDeficit(player.name, team);

        // PHASE 3: Three conditions to trigger sub-out:
        // 1. Hit quarterly target (original logic)
        // 2. Over GAME target (deficit <= 0)
        // 3. Significantly over target (deficit < -2) - emergency
        const hitQuarterTarget = plan.startsQuarter && minutesThisQuarter >= plan.minutesNeeded;
        const overGameTarget = deficit <= 0;
        const emergencyOver = deficit < -2;
        const shouldSubOut = hitQuarterTarget || overGameTarget || emergencyOver;

        if (debugPlayers.includes(player.name)) {
          console.log(`  [${player.name}] SUB OUT CHECK: minutesThisQ=${minutesThisQuarter.toFixed(2)}, qTarget=${plan.minutesNeeded.toFixed(2)}, deficit=${deficit.toFixed(2)}, shouldSub=${shouldSubOut}`);
        }

        if (shouldSubOut) {
          playersToSubOut.push({player, plan, minutesPlayed: minutesThisQuarter, deficit});
        }
      }

      // PHASE 3: Sort players to sub out by DEFICIT (ascending)
      // Players with SMALLEST deficit (most over target) sub out FIRST
      playersToSubOut.sort((a, b) => a.deficit - b.deficit);

      // Renamed for clarity (was benchPlayersToSubOut)
      const benchPlayersToSubOut = playersToSubOut;

      // PHASE 3: Find ALL bench players who need to sub IN (not just "starters")
      // Any player on bench with positive deficit (needs more minutes) can sub in
      const SUB_COOLDOWN_SECONDS = 120; // Prevent thrashing: 2 minute cooldown after subbing
      const playersToSubIn: Array<{player: Player, deficit: number}> = [];
      for (const player of benchPlayers) {
        if (foulSystem && foulSystem.isFouledOut(player.name)) continue;

        const deficit = this.calculateDeficit(player.name, team);
        const gameTarget = gameMinutesTargetByName[player.name] ?? 0;

        // PHASE 3: Check cooldown - skip if player just subbed recently
        const lastSubTime = this.recentSubTime[player.name] ?? -999;
        const secondsSinceLastSub = this.gameSecondsElapsed - lastSubTime;
        if (secondsSinceLastSub < SUB_COOLDOWN_SECONDS) {
          continue; // Player just subbed, skip them
        }

        // Player can sub in if:
        // 1. They have a game target > 0 (not DNP)
        // 2. They still need minutes (deficit > 0)
        if (gameTarget > 0 && deficit > 0) {
          playersToSubIn.push({player, deficit});
        }
      }

      // PHASE 3: Sort by DEFICIT (descending)
      // Players most behind their target get priority
      playersToSubIn.sort((a, b) => b.deficit - a.deficit);

      // Renamed for compatibility
      const startersToSubIn = playersToSubIn;

      // PHASE 3: Match players to sub out with players to sub in
      // Prioritize: most over-target OUT, most under-target IN
      let subInIndex = 0;
      for (const {player: playerOut, deficit: deficitOut, minutesPlayed} of benchPlayersToSubOut) {
        if (subInIndex >= startersToSubIn.length) break;

        const playerInEntry = startersToSubIn[subInIndex];
        if (!playerInEntry) break;

        const success = lineupManager.substitute(playerOut, playerInEntry.player);

        if (success) {
          // PHASE 3: Record sub time for cooldown tracking
          this.recentSubTime[playerOut.name] = this.gameSecondsElapsed;
          this.recentSubTime[playerInEntry.player.name] = this.gameSecondsElapsed;

          console.log(`  → SUB: ${playerOut.name} OUT (deficit: ${deficitOut.toFixed(1)}) -> ${playerInEntry.player.name} IN (deficit: ${playerInEntry.deficit.toFixed(1)})`);
          events.push({
            quarterTime: gameTimeStr,
            playerOut: playerOut.name,
            playerIn: playerInEntry.player.name,
            reason: 'minutes',
            staminaOut: staminaValues[playerOut.name] ?? 0,
            staminaIn: staminaValues[playerInEntry.player.name] ?? 0,
            team
          });
          subInIndex++;
        }
      }
    }

    return events;
  }

  /**
   * Check and execute substitutions for one team.
   *
   * M4.5 PHASE 4: USER RULES FOR SUBSTITUTIONS:
   *   Rule #1: If a starter has 90+ stamina AND the player at their position
   *            has been on court 6+ minutes → sub the starter in
   *   Rule #2: If a starter drops below 70 stamina → sub out immediately
   *            Try position match first (PG→PG), then position group
   *            (Guards: PG/SG, Wings: SF/PF, Bigs: C)
   *   Rule #3 (CRUNCH TIME): In final 2 min of close games (±5 pts),
   *            only sub out starters if stamina < 50 (play exhausted stars)
   *
   * @param lineupManager - LineupManager for this team
   * @param minutesAllocation - Minutes allocation dict
   * @param staminaTracker - StaminaTracker instance
   * @param gameTimeStr - Current game time string
   * @param timeRemainingInQuarter - Seconds remaining in quarter
   * @param quarterNumber - Current quarter (1-4)
   * @param scoreDifferential - Score difference (positive if winning)
   * @param team - 'home' or 'away'
   * @returns List of substitution events
   */
  private checkTeamSubstitutions(
    lineupManager: LineupManager,
    minutesAllocation: Record<string, number>,
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingInQuarter: number = 0,
    quarterNumber: number = 1,
    scoreDifferential: number = 0,
    team: 'home' | 'away',
    foulSystem: any = null
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    let activePlayers = lineupManager.getActivePlayers();
    let benchPlayers = lineupManager.getBenchPlayers();
    const staminaValues = staminaTracker.getAllStaminaValues();

    // RULE #2: Emergency stamina substitution
    // Only triggers for critically low stamina (players who missed their rotation substitution)
    // Single unified threshold: 35% stamina
    const EMERGENCY_STAMINA_THRESHOLD = 35.0;

    for (const player of activePlayers) {
      const playerName = player.name;
      const currentStamina = staminaTracker.getCurrentStamina(playerName);
      const isStarter = this.isStarter(playerName);

      if (isStarter && currentStamina < EMERGENCY_STAMINA_THRESHOLD && benchPlayers.length > 0) {
        // Find substitute: prefer position match with 90+ stamina
        const substitute = this.selectSubstituteByRules(
          benchPlayers,
          player.position,
          staminaValues,
          true,
          90.0,
          team
        );

        if (substitute) {
          const success = lineupManager.substitute(player, substitute);
          if (success) {
            const event: SubstitutionEvent = {
              quarterTime: gameTimeStr,
              playerOut: playerName,
              playerIn: substitute.name,
              reason: 'stamina',
              staminaOut: currentStamina,
              staminaIn: staminaTracker.getCurrentStamina(substitute.name),
              team,
            };
            events.push(event);

            // BUG FIX: Track that this backup replaced this starter
            this.starterReplacementMap[playerName] = substitute.name;

            // Reset time on court
            this.timeOnCourt[playerName] = 0.0;
            this.timeOnCourt[substitute.name] = 0.0;

            // Update bench list for next iteration
            benchPlayers = lineupManager.getBenchPlayers();
            activePlayers = lineupManager.getActivePlayers();
          }
        }
      }
    }

    // RULE #1: REMOVED - Q4 closer system disabled
    // All substitutions now handled by rotation plans + emergency stamina checks
    // This removes the conflicting 6-minute rule that was causing minutes allocation issues

    return events;
  }

  /**
   * Calculate how many minutes a player can play from current stamina
   * before dropping to 70 stamina.
   *
   * @param player - Player object with attributes
   * @param currentStamina - Current stamina value
   * @param pace - 'fast', 'standard', 'slow'
   * @param isScoringOption - True if player is scoring option #1/2/3
   * @returns Minutes playable (float)
   */
  private calculatePlayableMinutes(
    player: Player,
    currentStamina: number,
    pace: string,
    isScoringOption: boolean
  ): number {
    // Import stamina calculation (would need to be exported from staminaManager)
    // For now, using simplified logic

    // Stamina budget: current → 70
    const staminaBudget = currentStamina - 70.0;

    if (staminaBudget <= 0) {
      return 0.0; // Already below threshold
    }

    // Simplified stamina cost calculation
    // (In real implementation, would import from staminaManager)
    const baseCost = isScoringOption ? 1.5 : 1.0;
    const paceMod = pace === 'fast' ? 1.3 : pace === 'slow' ? 0.8 : 1.0;
    const avgCost = baseCost * paceMod;

    // Pace-specific possession rate
    const possessionsPerMinute = pace === 'fast' ? 2.8 : pace === 'slow' ? 2.2 : 2.5;

    // Calculate drain per minute
    const drainPerMinute = avgCost * possessionsPerMinute;

    // Calculate playable minutes
    const playableMinutes = staminaBudget / drainPerMinute;

    return playableMinutes;
  }

  /**
   * At Q4 start, evaluate every starter and calculate optimal rotation.
   *
   * For each starter:
   * - If on bench: calculate when to insert
   * - If on court: check if can finish Q4, if not calculate bench time needed
   *
   * Stores decisions in q4DecisionsHome and q4DecisionsAway
   */
  private processQ4Start(
    staminaTracker: StaminaTracker,
    homeScore: number,
    awayScore: number
  ): void {
    // Process home team
    this.processQ4TeamDecisions(
      staminaTracker,
      this.homeLineupManager,
      this.homeStarters,
      this.homeRoster,
      this.paceHome,
      this.scoringOptionsHome,
      this.q4DecisionsHome
    );

    // Process away team
    this.processQ4TeamDecisions(
      staminaTracker,
      this.awayLineupManager,
      this.awayStarters,
      this.awayRoster,
      this.paceAway,
      this.scoringOptionsAway,
      this.q4DecisionsAway
    );
  }

  /**
   * Process Q4 decisions for one team's starters.
   */
  private processQ4TeamDecisions(
    staminaTracker: StaminaTracker,
    lineupManager: LineupManager,
    starters: Set<string>,
    roster: Player[],
    pace: string,
    scoringOptions: string[],
    decisionsDict: Record<string, Q4Decision>
  ): void {
    const activePlayers = lineupManager.getActivePlayers();
    const activeNames = new Set(activePlayers.map(p => p.name));

    for (const starterName of starters) {
      // Find player in roster
      const player = roster.find(p => p.name === starterName);
      if (!player) {
        continue;
      }

      const currentStamina = staminaTracker.getCurrentStamina(starterName);
      const isScoringOption = scoringOptions.includes(starterName);
      const isActive = activeNames.has(starterName);

      // Calculate playable minutes from current stamina
      const playableMinutes = this.calculatePlayableMinutes(
        player,
        currentStamina,
        pace,
        isScoringOption
      );

      if (isActive) {
        // CASE 2: Starter on court
        // Can they play all 12 minutes of Q4?
        if (playableMinutes >= 12.0) {
          // Can finish - stay in
          decisionsDict[starterName] = {
            action: 'STAY_IN',
            playableMinutes,
            currentStamina,
          };
        } else {
          // Cannot finish - will need to sub out
          decisionsDict[starterName] = {
            action: 'WILL_FATIGUE',
            playableMinutes,
            currentStamina,
            subOutAt: 12.0 - playableMinutes,
          };
        }
      } else {
        // CASE 1: Starter on bench
        // Calculate when to insert
        // BUG FIX: If playableMinutes >= 12, insert at Q4 start
        let insertAtTime: number;
        if (playableMinutes >= 12.0) {
          insertAtTime = 12.0; // Insert at Q4 start (full stamina, can finish)
        } else {
          insertAtTime = 12.0 - playableMinutes; // Insert so they can play until end
        }

        decisionsDict[starterName] = {
          action: 'INSERT_AT',
          playableMinutes,
          currentStamina,
          insertAt: insertAtTime,
        };
      }
    }
  }

  /**
   * Get current home team active lineup
   */
  getHomeActive(): Player[] {
    return this.homeLineupManager.getActivePlayers();
  }

  /**
   * Get current away team active lineup
   */
  getAwayActive(): Player[] {
    return this.awayLineupManager.getActivePlayers();
  }

  /**
   * Get current home team bench
   */
  getHomeBench(): Player[] {
    return this.homeLineupManager.getBenchPlayers();
  }

  /**
   * Get current away team bench
   */
  getAwayBench(): Player[] {
    return this.awayLineupManager.getBenchPlayers();
  }

  /**
   * Get all substitution events recorded
   */
  getAllSubstitutionEvents(): SubstitutionEvent[] {
    return [...this.substitutionEvents];
  }

  /**
   * M4.5 FIX: Manual substitution for special cases (foul outs, injuries).
   *
   * @param team - 'home' or 'away'
   * @param playerOutName - Name of player to remove
   * @param playerInName - Name of player to add
   * @param quarterTime - Current quarter time (e.g., "8:32")
   * @param reason - Reason for substitution
   * @returns True if substitution successful, false otherwise
   */
  makeSubstitution(
    team: 'home' | 'away',
    playerOutName: string,
    playerInName: string,
    quarterTime: string = '0:00',
    reason: 'injury' | 'fouled_out' = 'fouled_out'
  ): boolean {
    // Get the appropriate lineup manager and roster
    const lineupManager = team === 'home' ? this.homeLineupManager : this.awayLineupManager;
    const roster = team === 'home' ? this.homeRoster : this.awayRoster;

    // Find player dictionaries
    const playerOut = lineupManager.getPlayerByName(playerOutName);
    if (playerOut === null) {
      return false; // Player not found in active lineup
    }

    const playerIn = roster.find(p => p.name === playerInName);
    if (!playerIn) {
      return false; // Substitute not found in roster
    }

    // Use reasonable default stamina values for event recording
    const staminaOut = 50.0; // Player coming off court
    const staminaIn = 100.0; // Player coming in fresh from bench

    // Execute substitution
    const success = lineupManager.substitute(playerOut, playerIn);

    if (success) {
      // Record substitution event
      const event: SubstitutionEvent = {
        quarterTime,
        playerOut: playerOutName,
        playerIn: playerIn.name,
        reason,
        staminaOut,
        staminaIn,
        team,
      };
      this.substitutionEvents.push(event);

      // Reset time on court for both players
      this.timeOnCourt[playerOutName] = 0.0;
      this.timeOnCourt[playerIn.name] = 0.0;
    }

    return success;
  }

  /**
   * Update continuous time on court for all active players.
   *
   * Call this after EVERY possession to track how long players have been
   * on court without rest.
   *
   * Side Effects:
   *   Updates timeOnCourt for all active players
   *
   * @param staminaTracker - StaminaTracker instance (unused but kept for compatibility)
   * @param durationSeconds - Possession duration in seconds
   */
  updateTimeOnCourt(staminaTracker: StaminaTracker, durationSeconds: number): void {
    const durationMinutes = durationSeconds / 60.0;

    // PHASE 3: Track total game time for cooldown checks
    this.gameSecondsElapsed += durationSeconds;

    const homeActive = this.homeLineupManager.getActivePlayers();
    const awayActive = this.awayLineupManager.getActivePlayers();

    // Track time on court for stamina-based substitutions
    for (const player of [...homeActive, ...awayActive]) {
      this.timeOnCourt[player.name] = (this.timeOnCourt[player.name] ?? 0) + durationMinutes;
    }

    // Track actual minutes for rotation plan adjustments (critical for Q3 to rotate different starters)
    for (const player of homeActive) {
      this.addMinutesPlayed(player.name, durationMinutes, 'home');
    }
    for (const player of awayActive) {
      this.addMinutesPlayed(player.name, durationMinutes, 'away');
    }
  }

  /**
   * Check if player is a starter (high minutes allocation).
   *
   * @param playerName - Player name
   * @returns True if player is in top 5 for their team (starter)
   */
  private isStarter(playerName: string): boolean {
    return this.homeStarters.has(playerName) || this.awayStarters.has(playerName);
  }

  /**
   * Check if two positions are compatible for substitution.
   *
   * M4.5 PHASE 4: User's position groupings:
   * - Guards: PG, SG
   * - Wings: SF, PF
   * - Bigs: C
   *
   * @param pos1 - First position
   * @param pos2 - Second position
   * @returns True if positions are in same group
   */
  private positionsCompatible(pos1: string, pos2: string): boolean {
    const guards = new Set(['PG', 'SG']);
    const wings = new Set(['SF', 'PF']);

    // Same position always compatible
    if (pos1 === pos2) {
      return true;
    }

    // Guards compatible with guards
    if (guards.has(pos1) && guards.has(pos2)) {
      return true;
    }

    // Wings compatible with wings
    if (wings.has(pos1) && wings.has(pos2)) {
      return true;
    }

    // Center only compatible with center (already handled by pos1 === pos2)
    return false;
  }

  /**
   * Select substitute following user's rules.
   *
   * M4.5 PHASE 4: Selection priority:
   * 1. Exact position match with stamina >= minimumStamina (90+)
   * 2. Position group match with stamina >= minimumStamina
   * 3. If no one meets minimum, use best available from position group
   * 4. Last resort: best available from entire bench
   *
   * BUG FIX: Avoid selecting starters whose tracked backup is still on court.
   *
   * @param benchPlayers - Available bench players
   * @param positionOut - Position of player being replaced
   * @param staminaValues - Current stamina for all players
   * @param isReplacingStarter - True if replacing a starter
   * @param minimumStamina - Minimum stamina requirement (default 90)
   * @returns Selected player or null
   */
  private selectSubstituteByRules(
    benchPlayers: Player[],
    positionOut: string,
    staminaValues: Record<string, number>,
    isReplacingStarter: boolean,
    minimumStamina: number = 90.0,
    team: 'home' | 'away' = 'home'
  ): Player | null {
    if (benchPlayers.length === 0) {
      return null;
    }

    // Get the roster with minutes targets to filter out 0-allocation players
    const rosterWithMinutes = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
    const minutesTargetByName: Record<string, number> = {};
    for (const p of rosterWithMinutes) {
      minutesTargetByName[p.name] = p.minutesTarget;
    }

    // BUG FIX: Filter out starters whose tracked replacement is still on court
    // AND filter out players with 0 minutes allocation (DNP)
    const eligibleBench = benchPlayers.filter(p => {
      // CRITICAL: Exclude players with 0 minutes allocation (DNP)
      const minutesTarget = minutesTargetByName[p.name] ?? 0;
      if (minutesTarget <= 0) {
        return false;
      }
      // Check if this player is a starter with a tracked replacement
      if (this.starterReplacementMap[p.name]) {
        // This starter has a tracked backup - check if backup is still on court
        const backupName = this.starterReplacementMap[p.name];
        const homeActiveNames = new Set(this.homeLineupManager.getActivePlayers().map(p => p.name));
        const awayActiveNames = new Set(this.awayLineupManager.getActivePlayers().map(p => p.name));
        const allActiveNames = new Set([...homeActiveNames, ...awayActiveNames]);

        if (allActiveNames.has(backupName)) {
          // Backup is still on court - don't use this starter yet
          return false;
        }
      }

      // Player is eligible
      return true;
    });

    // If no eligible players after filtering, fall back to original bench
    const finalBench = eligibleBench.length > 0 ? eligibleBench : benchPlayers;

    // Priority 1: Exact position match with 90+ stamina
    const exactMatchReady = finalBench.filter(p =>
      p.position === positionOut && (staminaValues[p.name] ?? 0) >= minimumStamina
    );
    if (exactMatchReady.length > 0) {
      return exactMatchReady.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 2: Position group match with 90+ stamina
    const groupMatchReady = finalBench.filter(p =>
      this.positionsCompatible(p.position, positionOut) &&
      (staminaValues[p.name] ?? 0) >= minimumStamina
    );
    if (groupMatchReady.length > 0) {
      return groupMatchReady.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 3: Position group match (any stamina)
    const groupMatchAny = finalBench.filter(p =>
      this.positionsCompatible(p.position, positionOut)
    );
    if (groupMatchAny.length > 0) {
      return groupMatchAny.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 4: Best available from entire bench (last resort)
    return finalBench.reduce((best, p) =>
      (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR MINUTES ALLOCATION
// =============================================================================

/**
 * Convert game minutes to quarter targets.
 *
 * Simple division: allocation / 4 for each quarter
 *
 * @param totalAllocations - Map of player name → 48-minute allocation
 * @param quarterNumber - Quarter number (1-4)
 * @returns Map of player name → minutes for THIS quarter
 */
export function calculateQuarterAllocations(
  totalAllocations: Record<string, number>,
  quarterNumber: number
): Record<string, number> {
  const quarterAllocations: Record<string, number> = {};

  for (const [playerName, totalMinutes] of Object.entries(totalAllocations)) {
    const quarterMinutes = totalMinutes / 4.0;
    quarterAllocations[playerName] = quarterMinutes;
  }

  return quarterAllocations;
}

/**
 * Validate minutes allocation dictionary.
 *
 * Validation rules:
 *   - Must total exactly 240 minutes (5 players * 48 minutes)
 *   - No player can have more than 48 minutes
 *   - No player can have negative minutes
 *
 * @param allocations - Map of player name → minutes
 * @param teamSize - Number of players on team
 * @returns Tuple of [isValid, errorMessage]
 */
export function validateMinutesAllocation(
  allocations: Record<string, number>,
  teamSize: number
): [boolean, string] {
  // Check for negative values first (clearly invalid)
  for (const [playerName, minutes] of Object.entries(allocations)) {
    if (minutes < 0) {
      return [false, `Player ${playerName} has negative minutes: ${minutes}`];
    }
  }

  // Check total
  const total = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  if (Math.abs(total - 240) > 0.1) {
    // Allow tiny floating point error
    return [false, `Total minutes must be 240, got ${total}`];
  }

  // Check for excessive values (> 48 minutes)
  for (const [playerName, minutes] of Object.entries(allocations)) {
    if (minutes > 48) {
      return [false, `Player ${playerName} exceeds 48 minutes: ${minutes}`];
    }
  }

  return [true, ''];
}
