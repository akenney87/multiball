/**
 * Basketball Simulator - Rebounding System
 *
 * Complete rebounding mechanics from team strength calculations to individual
 * rebounder selection. Implements defensive advantage, rebounding strategy effects,
 * and putback logic.
 *
 * Key Mechanics:
 * - 15% defensive advantage (multiply defensive strength by 1.15)
 * - Rebounding strategy affects number of rebounders (5/4/3 for crash/standard/prevent)
 * - Individual selection weighted by rebounding composite
 * - Height threshold (75) determines putback vs kickout
 * - Shot clock resets to 14 seconds on OREB
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/rebounding
 */

import {
  calculateComposite,
  weightedRandomChoice,
  rollSuccess,
  weightedSigmoidProbability,
  applyConsistencyVariance,
} from '../core/probability';
import {
  WEIGHTS_REBOUND,
  WEIGHTS_LAYUP,
  DEFENSIVE_REBOUND_ADVANTAGE,
  REBOUND_STRATEGY_CRASH_GLASS_COUNT,
  REBOUND_STRATEGY_STANDARD_COUNT,
  REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
  OREB_PUTBACK_HEIGHT_THRESHOLD,
  OREB_SHOT_CLOCK_RESET,
  BASE_RATE_LAYUP,
  SIGMOID_K,
} from '../constants';
import type { SimulationPlayer } from '../core/types';

// =============================================================================
// OREB PROBABILITY CONSTANTS
// =============================================================================

/**
 * OREB base rate from spec (Section 7.1)
 * BUG FIX v5: Reduced from 0.06 to 0.055 to eliminate 35%+ extremes
 * BUG FIX v6: Reduced from 0.055 to 0.05 after v5 still showed 37.8% and 34.1% extremes
 * BUG FIX v7: Reduced from 0.05 to 0.045 after v6 showed Game 6: 38.3%, Game 7: 36.4%
 * Target 22-28% OREB rate (1:3 to 1:4 ratio)
 * Expected outcomes:
 *   - League average: ~25% OREB rate (1:3 ratio)
 *   - Elite teams with crash glass + rim shots: ~28-30% (1:2.5 ratio)
 *   - Poor teams with prevent transition: ~20-22% (1:4 to 1:5 ratio)
 */
export const OREB_BASE_RATE = 0.045; // NBA average ~22-28% offensive rebound rate

/**
 * Shot type modifiers to OREB rate (REALISM AGENT: reduced from previous values)
 */
export const OREB_MODIFIER_3PT = -0.03; // -3% (long rebound, harder to get)
export const OREB_MODIFIER_MIDRANGE = 0.0; // 0% (baseline)
export const OREB_MODIFIER_RIM = 0.02; // +2% (short rebound, easier to tip)

/**
 * Strategy modifiers to OREB rate (REALISM AGENT: reduced from previous values)
 */
export const OREB_STRATEGY_CRASH_GLASS = 0.05; // +5% when crashing glass
export const OREB_STRATEGY_PREVENT_TRANSITION = -0.03; // -3% when preventing transition

// =============================================================================
// REBOUND RESULTS INTERFACE
// =============================================================================

/**
 * Complete rebound result information
 */
export interface ReboundResult {
  /** Did shot make? (no rebound if true) */
  shot_made: boolean;

  /** Shot type attempted */
  shot_type: string;

  /** Did a rebound occur? */
  rebound_occurred: boolean;

  /** Was it an offensive rebound? */
  offensive_rebound: boolean;

  /** Which team got the rebound ('offense' or 'defense') */
  rebounding_team?: string;

  /** Name of player who got the rebound */
  rebounder_name?: string;

  /** Position of rebounder */
  rebounder_position?: string;

  /** Rebounder's composite score */
  rebounder_composite?: number;

  /** Number of offensive rebounders */
  num_offensive_rebounders?: number;

  /** Number of defensive rebounders */
  num_defensive_rebounders?: number;

  /** Names of offensive rebounders */
  offensive_rebounders?: string[];

  /** Names of defensive rebounders */
  defensive_rebounders?: string[];

  /** Offensive team composite */
  offensive_team_composite?: number;

  /** Defensive team composite (with advantage) */
  defensive_team_composite?: number;

  /** Is this a blocked shot scramble? */
  is_blocked_shot_scramble?: boolean;

  /** Base OREB rate */
  base_rate?: number;

  /** Shot type modifier */
  shot_type_modifier?: number;

  /** Strategy modifier */
  strategy_modifier?: number;

  /** Strength-based probability */
  strength_probability?: number;

  /** Base rate with modifiers */
  base_with_modifiers?: number;

  /** Final OREB probability */
  final_oreb_probability?: number;

  /** Random roll value */
  roll_value?: number;

  /** Was putback attempted? */
  putback_attempted?: boolean;

  /** Was putback made? */
  putback_made?: boolean;

  /** Putback debug info */
  putback_debug?: Record<string, any>;

  /** OREB outcome type ('putback', 'kickout', or 'foul') */
  oreb_outcome?: string | null;

  /** Shot clock reset value */
  shot_clock_reset?: number;

  /** Did a foul occur? */
  foul_occurred?: boolean;

  /** Loose ball foul event (if any) */
  loose_ball_foul?: any;

  /** Offensive strategy */
  offensive_strategy?: string;

  /** Defensive strategy */
  defensive_strategy?: string;
}

// =============================================================================
// REBOUNDING FUNCTIONS
// =============================================================================

/**
 * Select which players box out for rebounds based on strategy.
 *
 * @param team - List of 5 players on the team
 * @param strategy - 'crash_glass', 'standard', or 'prevent_transition'
 * @param isOffensive - True if this is the offensive team, False if defensive
 * @returns List of players crashing boards based on strategy
 *
 * Strategy determines number of rebounders:
 * - crash_glass: 5 offensive, 2 defensive (all-out attack/minimal box out)
 * - standard: 2 offensive, 3 defensive (balanced)
 * - prevent_transition: 1 offensive, 4 defensive (transition focus)
 *
 * Selection: Sort by rebounding composite, take top N
 */
export function getReboundersForStrategy(
  team: SimulationPlayer[],
  strategy: string,
  isOffensive: boolean
): SimulationPlayer[] {
  if (!['crash_glass', 'standard', 'prevent_transition'].includes(strategy)) {
    throw new Error(`Invalid rebounding strategy: ${strategy}`);
  }

  // Determine number of rebounders based on strategy
  let numRebounders: number;
  if (strategy === 'crash_glass') {
    numRebounders = isOffensive ? 5 : 2;
  } else if (strategy === 'standard') {
    numRebounders = isOffensive ? 2 : 3;
  } else {
    // prevent_transition
    numRebounders = isOffensive ? 1 : 4;
  }

  // Calculate rebounding composite for each player
  const playerComposites = team.map((player) => ({
    player,
    composite: calculateComposite(player, WEIGHTS_REBOUND),
  }));

  // Sort by composite (descending) and take top N
  playerComposites.sort((a, b) => b.composite - a.composite);
  const rebounders = playerComposites.slice(0, numRebounders).map((pc) => pc.player);

  return rebounders;
}

/**
 * Calculate aggregate rebounding strength for a team.
 *
 * @param rebounders - List of players boxing out
 * @param isDefense - True if this is the defensive team (applies 15% advantage)
 * @returns Team composite (0-100 range, but can exceed 100 with defensive advantage)
 *
 * Algorithm:
 * 1. Calculate each rebounder's composite using WEIGHTS_REBOUND
 * 2. Average all composites
 * 3. If isDefense: multiply by 1.15 (15% defensive advantage)
 */
export function calculateTeamReboundingStrength(
  rebounders: SimulationPlayer[],
  isDefense: boolean
): number {
  if (rebounders.length === 0) {
    return 0.0;
  }

  // Calculate composites for all rebounders
  const composites = rebounders.map((player) => calculateComposite(player, WEIGHTS_REBOUND));

  // Average composite
  let avgComposite = composites.reduce((sum, c) => sum + c, 0) / composites.length;

  // Apply defensive advantage
  if (isDefense) {
    avgComposite *= DEFENSIVE_REBOUND_ADVANTAGE;
  }

  return avgComposite;
}

/**
 * Calculate probability of offensive rebound.
 *
 * @param offensiveStrength - Offensive team's rebounding composite
 * @param defensiveStrength - Defensive team's rebounding composite (with advantage)
 * @param shotType - '3pt', 'midrange', 'rim' (includes layup/dunk)
 * @param offensiveStrategy - Offensive rebounding strategy
 * @param defensiveStrategy - Defensive rebounding strategy
 * @returns Tuple of [probability, debug_info]
 *
 * Algorithm:
 * 1. Start with base OREB rate (4.5%)
 * 2. Apply shot type modifier
 * 3. Apply offensive strategy modifier
 * 4. Calculate team strength ratio (offensive / (offensive + defensive))
 * 5. Blend base rate with strength ratio
 */
export function calculateOffensiveReboundProbability(
  offensiveStrength: number,
  defensiveStrength: number,
  shotType: string,
  offensiveStrategy: string,
  defensiveStrategy: string
): [number, Record<string, any>] {
  const debugInfo: Record<string, any> = {
    offensive_strength: offensiveStrength,
    defensive_strength: defensiveStrength,
    base_rate: OREB_BASE_RATE,
    shot_type: shotType,
    offensive_strategy: offensiveStrategy,
    defensive_strategy: defensiveStrategy,
  };

  // Apply shot type modifier
  let shotModifier: number;
  if (shotType === '3pt') {
    shotModifier = OREB_MODIFIER_3PT;
  } else if (shotType === 'midrange') {
    shotModifier = OREB_MODIFIER_MIDRANGE;
  } else {
    // rim (layup/dunk)
    shotModifier = OREB_MODIFIER_RIM;
  }

  debugInfo.shot_type_modifier = shotModifier;

  // Apply offensive strategy modifier
  let strategyModifier: number;
  if (offensiveStrategy === 'crash_glass') {
    strategyModifier = OREB_STRATEGY_CRASH_GLASS;
  } else if (offensiveStrategy === 'prevent_transition') {
    strategyModifier = OREB_STRATEGY_PREVENT_TRANSITION;
  } else {
    // standard
    strategyModifier = 0.0;
  }

  debugInfo.strategy_modifier = strategyModifier;

  // Calculate strength-based probability
  const totalStrength = offensiveStrength + defensiveStrength;
  let strengthProbability: number;
  if (totalStrength > 0) {
    strengthProbability = offensiveStrength / totalStrength;
  } else {
    strengthProbability = 0.5; // Fallback to 50/50
  }

  debugInfo.strength_probability = strengthProbability;

  // Blend base rate with strength probability
  // Use weighted average: 40% strength-based, 60% base rate
  // This ensures defensive advantage has stronger effect
  const baseWithModifiers = OREB_BASE_RATE + shotModifier + strategyModifier;
  let finalProbability = 0.4 * strengthProbability + 0.6 * baseWithModifiers;

  // Clamp to [0, 1]
  finalProbability = Math.max(0.0, Math.min(1.0, finalProbability));

  debugInfo.base_with_modifiers = baseWithModifiers;
  debugInfo.final_oreb_probability = finalProbability;

  return [finalProbability, debugInfo];
}

/**
 * Select which specific player gets the rebound.
 *
 * @param rebounders - List of players boxing out
 * @returns Tuple of [selected_player, player_composite]
 *
 * Selection is weighted by rebounding composite.
 * Player with 80 composite is 2x more likely than player with 40 composite.
 */
export function selectRebounder(
  rebounders: SimulationPlayer[]
): [SimulationPlayer, number] {
  if (rebounders.length === 0) {
    throw new Error('Cannot select rebounder from empty list');
  }

  // Calculate composites for all rebounders
  const composites = rebounders.map((player) => calculateComposite(player, WEIGHTS_REBOUND));

  // Select using weighted choice
  const selectedPlayer = weightedRandomChoice(rebounders, composites);

  // Get the composite of the selected player
  const selectedComposite = calculateComposite(selectedPlayer, WEIGHTS_REBOUND);

  return [selectedPlayer, selectedComposite];
}

/**
 * Determine if offensive rebounder attempts putback and if successful.
 *
 * @param rebounder - Player who got the offensive rebound
 * @param defendersNearby - Defensive players in position to contest
 * @returns Tuple of [attempted, made, debug_info]
 *
 * Height Threshold: 75
 * - If height > 75: Attempt putback
 * - If height <= 75: Kick out (no putback attempt)
 *
 * Putback success uses layup mechanics with scramble context (reduced contest).
 */
export function checkPutbackAttempt(
  rebounder: SimulationPlayer,
  defendersNearby: SimulationPlayer[]
): [boolean, boolean, Record<string, any>] {
  const debugInfo: Record<string, any> = {
    rebounder_name: rebounder.name,
    rebounder_height: rebounder.height,
    height_threshold: OREB_PUTBACK_HEIGHT_THRESHOLD,
  };

  // Check height threshold
  if (rebounder.height <= OREB_PUTBACK_HEIGHT_THRESHOLD) {
    debugInfo.putback_attempted = false;
    debugInfo.putback_made = false;
    debugInfo.reason = 'height_too_low_for_putback';
    return [false, false, debugInfo];
  }

  // Putback attempted
  debugInfo.putback_attempted = true;

  // Calculate rebounder's layup composite (putbacks are rim attempts)
  const rebounderComposite = calculateComposite(rebounder, WEIGHTS_LAYUP);
  debugInfo.rebounder_composite = rebounderComposite;

  // Calculate average defender composite if defenders nearby
  let avgDefenderComposite: number;
  if (defendersNearby.length > 0) {
    // Use layup weights for defenders too (defending a putback layup)
    const defenderComposites = defendersNearby.map((defender) =>
      calculateComposite(defender, WEIGHTS_LAYUP)
    );
    avgDefenderComposite =
      defenderComposites.reduce((sum, c) => sum + c, 0) / defenderComposites.length;

    // Scramble situation: defenders are out of position, reduce effectiveness by 40%
    avgDefenderComposite *= 0.6;
  } else {
    avgDefenderComposite = 0.0; // Wide open putback
  }

  debugInfo.avg_defender_composite = avgDefenderComposite;

  // Calculate attribute diff
  // Note: For putbacks, rebounder is offense, defenders are defense
  // But weighted_sigmoid expects defensive_composite - offensive_composite for the contest
  // So we flip it: defender - rebounder (negative diff = rebounder advantage)
  const attributeDiff = avgDefenderComposite - rebounderComposite;
  debugInfo.attribute_diff = attributeDiff;
  debugInfo.rebounder_advantage = rebounderComposite - avgDefenderComposite;

  // Use weighted sigmoid with layup base rate
  // When rebounder is better, attribute_diff is negative, increasing probability
  let putbackProbability = weightedSigmoidProbability(BASE_RATE_LAYUP, attributeDiff);

  // Putback bonus: +5% (close to rim, quick reaction)
  putbackProbability += 0.05;
  putbackProbability = Math.max(0.0, Math.min(1.0, putbackProbability));

  debugInfo.putback_probability = putbackProbability;

  // PHASE 3D: Apply consistency variance
  putbackProbability = applyConsistencyVariance(putbackProbability, rebounder, 'putback');

  // Roll for success
  const rollValue = Math.random();
  const putbackMade = rollValue < putbackProbability;

  debugInfo.roll_value = rollValue;
  debugInfo.putback_made = putbackMade;

  return [true, putbackMade, debugInfo];
}

/**
 * Complete rebound simulation.
 *
 * @param offensiveTeam - List of 5 offensive players
 * @param defensiveTeam - List of 5 defensive players
 * @param offensiveStrategy - Offensive rebounding strategy
 * @param defensiveStrategy - Defensive rebounding strategy
 * @param shotType - Type of shot taken ('3pt', 'midrange', 'rim')
 * @param shotMade - If True, no rebound occurs
 * @param foulSystem - Foul system instance
 * @param quarter - Current quarter
 * @param gameTime - Game time
 * @param defendingTeamName - Name of defending team
 * @param isBlockedShot - If True, this is a scramble situation (no defensive advantage)
 * @returns Complete debug dict with all rebound information
 *
 * Flow:
 * 1. If shot made: No rebound, return early
 * 2. Get rebounders based on strategies
 * 3. Calculate team strengths
 * 4. Determine OREB probability
 * 5. Roll to determine which team gets rebound
 * 6. Select individual rebounder
 * 7. If OREB: Check for putback attempt
 * 8. Return complete debug info
 */
export function simulateRebound(
  offensiveTeam: SimulationPlayer[],
  defensiveTeam: SimulationPlayer[],
  offensiveStrategy: string,
  defensiveStrategy: string,
  shotType: string,
  shotMade: boolean = false,
  foulSystem: any = null,
  quarter: number = 1,
  gameTime: string = '12:00',
  defendingTeamName: string = 'Away',
  isBlockedShot: boolean = false
): ReboundResult {
  const result: ReboundResult = {
    shot_made: shotMade,
    shot_type: shotType,
    rebound_occurred: false,
    offensive_rebound: false,
  };

  // If shot made, no rebound
  if (shotMade) {
    return result;
  }

  result.rebound_occurred = true;

  // Get rebounders based on strategies
  const offensiveRebounders = getReboundersForStrategy(offensiveTeam, offensiveStrategy, true);
  const defensiveRebounders = getReboundersForStrategy(defensiveTeam, defensiveStrategy, false);

  result.num_offensive_rebounders = offensiveRebounders.length;
  result.num_defensive_rebounders = defensiveRebounders.length;
  result.offensive_rebounders = offensiveRebounders.map((p) => p.name);
  result.defensive_rebounders = defensiveRebounders.map((p) => p.name);

  // Calculate team strengths
  const offensiveStrength = calculateTeamReboundingStrength(offensiveRebounders, false);

  // BUG FIX: For blocked shots (scramble situations), don't apply defensive advantage
  // Normal rebounds: defense has positioning advantage (1.15x)
  // Blocked shots: Both teams scrambling equally (1.0x)
  const applyDefensiveAdvantage = !isBlockedShot;
  const defensiveStrength = calculateTeamReboundingStrength(
    defensiveRebounders,
    applyDefensiveAdvantage
  );

  result.offensive_team_composite = offensiveStrength;
  result.defensive_team_composite = defensiveStrength;
  result.is_blocked_shot_scramble = isBlockedShot;

  // Calculate OREB probability
  const [orebProbability, orebDebug] = calculateOffensiveReboundProbability(
    offensiveStrength,
    defensiveStrength,
    shotType,
    offensiveStrategy,
    defensiveStrategy
  );

  Object.assign(result, orebDebug);

  // Roll to determine which team gets rebound
  const rollValue = Math.random();
  const offensiveRebound = rollValue < orebProbability;

  result.roll_value = rollValue;
  result.offensive_rebound = offensiveRebound;

  // M3 ISSUE #7 FIX: Check for loose ball foul during rebound battle
  // Loose ball fouls occur during physical box-out contests
  if (foulSystem) {
    // Get a random player from each team involved in rebound battle
    const offensiveRebounderForFoul =
      offensiveRebounders[Math.floor(Math.random() * offensiveRebounders.length)];
    const defensiveRebounderForFoul =
      defensiveRebounders[Math.floor(Math.random() * defensiveRebounders.length)];

    // Check for loose ball foul
    const looseBallFoul = foulSystem.check_non_shooting_foul(
      offensiveRebounderForFoul,
      defensiveRebounderForFoul,
      'rebound',
      defendingTeamName,
      quarter,
      gameTime
    );

    if (looseBallFoul) {
      // Loose ball foul occurred
      // Possession goes to fouled team, with FTs if in bonus
      result.loose_ball_foul = looseBallFoul;
      result.foul_occurred = true;

      // Determine which team gets possession based on who was fouled
      // If defensive player fouled, offense gets ball (and possibly FTs)
      result.rebounder_name = offensiveRebounderForFoul.name;
      result.rebounder_position = offensiveRebounderForFoul.position;
      result.rebounding_team = 'offense';
      result.offensive_rebound = true;
      result.putback_attempted = false;
      result.putback_made = false;
      result.oreb_outcome = 'foul';

      return result;
    }
  }

  // Select individual rebounder
  let rebounder: SimulationPlayer;
  let rebounderComposite: number;

  if (offensiveRebound) {
    [rebounder, rebounderComposite] = selectRebounder(offensiveRebounders);
    result.rebounding_team = 'offense';
  } else {
    [rebounder, rebounderComposite] = selectRebounder(defensiveRebounders);
    result.rebounding_team = 'defense';
  }

  result.rebounder_name = rebounder.name;
  result.rebounder_position = rebounder.position;
  result.rebounder_composite = rebounderComposite;
  result.foul_occurred = false;

  // If OREB, check for putback
  if (offensiveRebound) {
    // Get defenders who were rebounding (still nearby)
    const [putbackAttempted, putbackMade, putbackDebug] = checkPutbackAttempt(
      rebounder,
      defensiveRebounders
    );

    result.putback_attempted = putbackAttempted;
    result.putback_made = putbackMade;
    result.putback_debug = putbackDebug;

    // Determine outcome type
    if (putbackAttempted) {
      result.oreb_outcome = 'putback';
    } else {
      result.oreb_outcome = 'kickout';
    }

    // Shot clock resets to 14
    result.shot_clock_reset = OREB_SHOT_CLOCK_RESET;
  } else {
    result.putback_attempted = false;
    result.putback_made = false;
    result.oreb_outcome = null;
  }

  return result;
}

/**
 * Format rebound debug information for human readability.
 *
 * @param result - Debug dict from simulateRebound()
 * @returns Formatted debug string
 */
export function formatReboundDebug(result: ReboundResult): string {
  const lines: string[] = [];
  lines.push('=== REBOUND DEBUG ===');
  lines.push('');

  if (!result.rebound_occurred) {
    lines.push('Shot made - no rebound');
    return lines.join('\n');
  }

  lines.push(`Shot Type: ${result.shot_type}`);
  lines.push(`Offensive Strategy: ${result.offensive_strategy}`);
  lines.push(`Defensive Strategy: ${result.defensive_strategy}`);
  lines.push('');

  lines.push('[REBOUNDERS]');
  lines.push(
    `Offensive (${result.num_offensive_rebounders}): ${result.offensive_rebounders?.join(', ')}`
  );
  lines.push(
    `Defensive (${result.num_defensive_rebounders}): ${result.defensive_rebounders?.join(', ')}`
  );
  lines.push('');

  lines.push('[TEAM STRENGTH]');
  lines.push(`Offensive Composite: ${result.offensive_team_composite?.toFixed(2)}`);
  lines.push(
    `Defensive Composite: ${result.defensive_team_composite?.toFixed(2)} (includes 15% advantage)`
  );
  lines.push('');

  lines.push('[OREB PROBABILITY]');
  lines.push(`Base Rate: ${((result.base_rate ?? 0) * 100).toFixed(1)}%`);
  lines.push(`Shot Type Modifier: ${((result.shot_type_modifier ?? 0) * 100).toFixed(1)}%`);
  lines.push(`Strategy Modifier: ${((result.strategy_modifier ?? 0) * 100).toFixed(1)}%`);
  lines.push(`Strength Probability: ${((result.strength_probability ?? 0) * 100).toFixed(1)}%`);
  lines.push(
    `Final OREB Probability: ${((result.final_oreb_probability ?? 0) * 100).toFixed(1)}%`
  );
  lines.push('');

  lines.push('[RESULT]');
  lines.push(`Roll: ${result.roll_value?.toFixed(3)}`);
  lines.push(
    `Outcome: ${result.offensive_rebound ? 'OFFENSIVE REBOUND' : 'DEFENSIVE REBOUND'}`
  );
  lines.push(`Rebounder: ${result.rebounder_name} (${result.rebounder_position})`);
  lines.push(`Rebounder Composite: ${result.rebounder_composite?.toFixed(2)}`);
  lines.push('');

  if (result.offensive_rebound) {
    lines.push('[OFFENSIVE REBOUND OUTCOME]');
    if (result.putback_attempted) {
      lines.push(
        `Putback Attempted: YES (height ${result.putback_debug?.rebounder_height} > ${OREB_PUTBACK_HEIGHT_THRESHOLD})`
      );
      lines.push(
        `Putback Probability: ${((result.putback_debug?.putback_probability ?? 0) * 100).toFixed(1)}%`
      );
      lines.push(`Putback Made: ${result.putback_made ? 'YES' : 'NO'}`);
    } else {
      lines.push(
        `Putback Attempted: NO (height ${result.putback_debug?.rebounder_height} <= ${OREB_PUTBACK_HEIGHT_THRESHOLD})`
      );
      lines.push('Outcome: KICKOUT (new possession)');
    }
    lines.push(`Shot Clock Reset: ${result.shot_clock_reset} seconds`);
  }

  return lines.join('\n');
}
