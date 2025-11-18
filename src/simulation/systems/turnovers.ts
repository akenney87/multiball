/**
 * Basketball Simulator - Turnover Detection and Handling System
 *
 * Implements complete turnover mechanics including:
 * - Turnover probability calculation with tactical modifiers
 * - Type selection (bad_pass, lost_ball, offensive_foul, violation)
 * - Steal attribution
 * - Transition trigger detection
 *
 * All calculations use weighted sigmoid formulas per basketball_sim.md Section 6.
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/turnovers
 */

import {
  calculateComposite,
  sigmoid,
  weightedRandomChoice,
  applyModifier,
  applyConsistencyVariance,
} from '../core/probability';
import type { PossessionContext, SimulationPlayer, SimulationTacticalSettings, TurnoverType } from '../core/types';
import {
  BASE_TURNOVER_RATE,
  WEIGHTS_TURNOVER_PREVENTION,
  TURNOVER_PACE_FAST_BONUS,
  TURNOVER_PACE_SLOW_PENALTY,
  TURNOVER_TYPE_BAD_PASS,
  TURNOVER_TYPE_LOST_BALL,
  TURNOVER_TYPE_OFFENSIVE_FOUL,
  TURNOVER_TYPE_SHOT_CLOCK,
  TURNOVER_TYPE_OTHER_VIOLATION,
  SIGMOID_K,
  WEIGHTS_STEAL_DEFENSE,
  SHOT_CLOCK_VIOLATION_SLOW_PACE_BONUS,
  SHOT_CLOCK_VIOLATION_FAST_PACE_PENALTY,
} from '../constants';

// =============================================================================
// TURNOVER RESULT INTERFACE
// =============================================================================

/**
 * Turnover check result
 */
export interface TurnoverResult {
  /** Ball handler name */
  ball_handler_name: string;

  /** Defender name */
  defender_name: string;

  /** Ball handler's turnover prevention composite */
  ball_handler_composite: number;

  /** Defender's steal/pressure composite */
  defender_composite?: number;

  /** Base turnover rate */
  base_turnover_rate: number;

  /** Pace modifier */
  pace_modifier: number;

  /** Transition modifier */
  transition_modifier: number;

  /** Total modifier */
  total_modifier: number;

  /** Sigmoid value */
  sigmoid_value?: number;

  /** Attribute adjustment */
  attribute_adjustment?: number;

  /** Adjusted turnover rate */
  adjusted_turnover_rate: number;

  /** Was rate capped? */
  capped?: boolean;

  /** Uncapped rate (if capped) */
  uncapped_rate?: number;

  /** Random roll value */
  roll_value: number;

  /** Did turnover occur? */
  turnover_occurred: boolean;

  /** Turnover type (if occurred) */
  turnover_type: TurnoverType | null;

  /** Player credited with steal (if applicable) */
  steal_credited_to: string | null;

  /** Does this trigger transition? */
  triggers_transition: boolean;
}

// =============================================================================
// TURNOVER FUNCTIONS
// =============================================================================

/**
 * Determine if turnover occurs on this possession.
 *
 * Algorithm (Section 6.1):
 * 1. Start with BASE_TURNOVER_RATE (8%)
 * 2. Apply pace modifiers (+2.5% fast, -2.5% slow)
 * 3. Apply zone defense bonus (+3% if applicable)
 * 4. Apply transition reduction (-2% if transition possession)
 * 5. Calculate ball handler's turnover prevention composite
 * 6. Adjust rate using sigmoid based on composite quality
 * 7. Roll dice to determine outcome
 * 8. If turnover: select type, check steal credit, check transition trigger
 *
 * @param ballHandler - Offensive player with ball
 * @param defender - Primary defensive matchup
 * @param tacticalSettings - Team tactical settings (pace, defense type)
 * @param possessionContext - Possession state (is_transition, etc.)
 * @param defenseType - Actual defense type for this possession ('zone' or 'man')
 * @returns Turnover result with debug information
 */
export function checkTurnover(
  ballHandler: SimulationPlayer,
  defender: SimulationPlayer,
  tacticalSettings: SimulationTacticalSettings,
  possessionContext: PossessionContext,
  defenseType: string = 'man'
): TurnoverResult {
  const debugInfo: Partial<TurnoverResult> = {
    ball_handler_name: ballHandler.name,
    defender_name: defender.name,
  };

  // 1. Calculate ball handler's turnover prevention composite
  const ballHandlerComposite = calculateComposite(ballHandler, WEIGHTS_TURNOVER_PREVENTION);
  debugInfo.ball_handler_composite = ballHandlerComposite;

  // 2. Start with base rate
  const baseRate = BASE_TURNOVER_RATE;
  debugInfo.base_turnover_rate = baseRate;

  // 3. Apply tactical modifiers (additive)
  let totalModifier = 0.0;
  let paceModifier = 0.0;
  let transitionModifier = 0.0;

  // Pace adjustment
  if (tacticalSettings.pace === 'fast') {
    paceModifier = TURNOVER_PACE_FAST_BONUS;
  } else if (tacticalSettings.pace === 'slow') {
    paceModifier = TURNOVER_PACE_SLOW_PENALTY;
  }

  totalModifier += paceModifier;
  debugInfo.pace_modifier = paceModifier;

  // M4.6 REMOVED: Zone defense turnover bonus (spec was backwards)
  // Man defense is aggressive (forces turnovers), zone is passive (protects paint)
  // No tactical modifier for man/zone defense on turnovers

  // Transition reduces turnovers (open court, fewer defenders)
  if (possessionContext.isTransition) {
    transitionModifier = -0.02; // -2% in transition
    totalModifier += transitionModifier;
  }
  debugInfo.transition_modifier = transitionModifier;

  debugInfo.total_modifier = totalModifier;

  // 4. Apply modifiers to base rate
  let modifiedRate = baseRate + totalModifier;

  // 5. Calculate defender's steal/pressure composite
  // Use same weights as turnover prevention (logical mirror)
  const defenderComposite = calculateComposite(defender, WEIGHTS_TURNOVER_PREVENTION);
  debugInfo.defender_composite = defenderComposite;

  // 6. BUG FIX v5: Use balanced offense vs defense weighted sigmoid
  // Previous: Pure multiplier created 4.5x variance (elite 18%, poor 82%)
  // New: Weighted sigmoid with ±3% range for balanced matchups
  // Formula: adjusted_rate = modified_rate + range * weighted_sigmoid(def - off)
  // Range: ±3% (±0.03) instead of multiplicative ±82%
  const compositeDiff = defenderComposite - ballHandlerComposite;
  const sigmoidValue = sigmoid(SIGMOID_K * compositeDiff);

  // Sigmoid output (0.5 = even, >0.5 = defense advantage, <0.5 = offense advantage)
  // Convert to ±3% adjustment
  const adjustment = 0.03 * (sigmoidValue - 0.5) * 2; // Range: -0.03 to +0.03

  let adjustedRate = modifiedRate + adjustment;

  // Clamp to valid probability range
  adjustedRate = Math.max(0.0, Math.min(1.0, adjustedRate));

  // BUG FIX v7: Cap turnover rate to prevent extreme outliers
  // Game 6 showed 21.4% rate in edge cases despite formula fixes
  // This safety cap prevents catastrophic turnover spirals
  // REALISM FIX: Reduced from 0.15 to 0.10, then M4.6 raised to 0.12
  // M4.6: Raised from 0.10 to 0.12 after increasing BASE_TURNOVER_RATE to 0.08
  const MAX_TURNOVER_RATE = 0.12; // 12% hard cap per possession (general turnovers only, drive adds more)
  if (adjustedRate > MAX_TURNOVER_RATE) {
    debugInfo.capped = true;
    debugInfo.uncapped_rate = adjustedRate;
    adjustedRate = MAX_TURNOVER_RATE;
  } else {
    debugInfo.capped = false;
  }

  debugInfo.sigmoid_value = sigmoidValue;
  debugInfo.attribute_adjustment = adjustment;
  debugInfo.adjusted_turnover_rate = adjustedRate;

  // PHASE 3D: Apply consistency variance
  adjustedRate = applyConsistencyVariance(adjustedRate, ballHandler, 'turnover');

  // 7. Roll dice
  const rollValue = Math.random();
  debugInfo.roll_value = rollValue;

  const turnoverOccurred = rollValue < adjustedRate;
  debugInfo.turnover_occurred = turnoverOccurred;

  // 8. If turnover, determine details
  if (turnoverOccurred) {
    // Select turnover type (M5.0: Pass defense_type)
    const turnoverType = selectTurnoverType(possessionContext, tacticalSettings, defenseType);
    debugInfo.turnover_type = turnoverType;

    // Check for steal credit
    const stealCredited = determineStealCredit(defender, turnoverType);
    debugInfo.steal_credited_to = stealCredited ? defender.name : null;

    // Check if triggers transition
    const transitionTrigger = triggersTransition(turnoverType);
    debugInfo.triggers_transition = transitionTrigger;
  } else {
    debugInfo.turnover_type = null;
    debugInfo.steal_credited_to = null;
    debugInfo.triggers_transition = false;
  }

  return debugInfo as TurnoverResult;
}

/**
 * Select turnover type using weighted distribution.
 *
 * Base distribution (M5.0 - split violations):
 * - bad_pass: 40%
 * - lost_ball: 30%
 * - offensive_foul: 20%
 * - shot_clock: 5%
 * - other_violation: 5%
 *
 * Context adjustments:
 * - Zone defense: +10% to bad_pass (more complex passing)
 * - Fast pace: +5% to lost_ball (rushed plays), -2% to shot_clock
 * - Slow pace: +3% to shot_clock
 * - Low shot clock (<5 sec): +5% to shot_clock
 *
 * @param possessionContext - Current possession state
 * @param tacticalSettings - Team tactical settings
 * @param defenseType - Actual defense type for this possession ('zone' or 'man')
 * @returns Turnover type string
 */
export function selectTurnoverType(
  possessionContext: PossessionContext,
  tacticalSettings: SimulationTacticalSettings,
  defenseType: string = 'man'
): TurnoverType {
  // Start with base weights
  const weights: Record<string, number> = {
    bad_pass: TURNOVER_TYPE_BAD_PASS,
    lost_ball: TURNOVER_TYPE_LOST_BALL,
    offensive_foul: TURNOVER_TYPE_OFFENSIVE_FOUL,
    shot_clock: TURNOVER_TYPE_SHOT_CLOCK,
    other_violation: TURNOVER_TYPE_OTHER_VIOLATION,
  };

  // Context adjustments
  // M5.0 FIX: Use actual defense_type (not team percentage)
  if (defenseType === 'zone') {
    weights.bad_pass += 0.1;
  }

  // Fast pace increases lost balls, decreases shot clock violations
  if (tacticalSettings.pace === 'fast') {
    weights.lost_ball += 0.05;
    weights.shot_clock += SHOT_CLOCK_VIOLATION_FAST_PACE_PENALTY;
  }

  // Slow pace increases shot clock violations
  if (tacticalSettings.pace === 'slow') {
    weights.shot_clock += SHOT_CLOCK_VIOLATION_SLOW_PACE_BONUS;
  }

  // Low shot clock increases shot clock violations
  if (possessionContext.shotClock < 5) {
    weights.shot_clock += 0.05;
  }

  // Normalize and select
  const types = Object.keys(weights);
  const weightValues = Object.values(weights);

  return weightedRandomChoice(types, weightValues) as TurnoverType;
}

/**
 * Determine if defender gets credited with a steal.
 *
 * Steal probability depends on turnover type and defender quality.
 *
 * Algorithm:
 * 1. Only certain types can be steals (bad_pass, lost_ball)
 * 2. PHASE 2: Calculate defender's steal composite using WEIGHTS_STEAL_DEFENSE
 *    (grip_strength: 30%, reactions: 25%, awareness: 20%, agility: 15%, determination: 10%)
 * 3. Use sigmoid to determine steal probability
 * 4. Roll dice
 *
 * @param defender - Defensive player
 * @param turnoverType - Type of turnover that occurred
 * @returns True if steal credited, False otherwise
 */
export function determineStealCredit(
  defender: SimulationPlayer,
  turnoverType: TurnoverType
): boolean {
  // Only live ball turnovers can be steals
  if (!['bad_pass', 'lost_ball'].includes(turnoverType)) {
    return false;
  }

  // Calculate defender composite for steal probability
  const defenderComposite = calculateComposite(defender, WEIGHTS_STEAL_DEFENSE);

  // Steal probability based on defender quality
  // Elite defender (90): ~70% steal credit
  // Average defender (50): ~82% steal credit (tuned from 0.50 to increase steals 5.0 → 7.5 per team)
  // Poor defender (30): ~62% steal credit
  const baseStealProb = 0.82;
  const compositeDiff = defenderComposite - 50;
  const stealAdjustment = compositeDiff * 0.004; // ±0.16 for ±40 composite diff

  let stealProb = baseStealProb + stealAdjustment;
  stealProb = Math.max(0.0, Math.min(1.0, stealProb));

  // PHASE 3D: Apply consistency variance (defender's consistency)
  stealProb = applyConsistencyVariance(stealProb, defender, 'steal');

  return Math.random() < stealProb;
}

/**
 * Determine if turnover triggers fast break opportunity.
 *
 * Live ball turnovers trigger transition:
 * - bad_pass: YES (defender can grab and run)
 * - lost_ball: YES (loose ball recovery)
 * - offensive_foul: YES (inbound but quick)
 *
 * Dead ball turnovers do NOT trigger transition:
 * - violation: NO (dead ball, defense sets up)
 *
 * @param turnoverType - Type of turnover
 * @returns True if triggers transition, False otherwise
 */
export function triggersTransition(turnoverType: TurnoverType): boolean {
  const liveBallTurnovers: TurnoverType[] = ['bad_pass', 'lost_ball', 'offensive_foul'];
  return liveBallTurnovers.includes(turnoverType);
}

/**
 * Generate human-readable turnover description.
 *
 * @param turnoverType - Type of turnover
 * @param ballHandlerName - Player who committed turnover
 * @param stealCreditedTo - Defender name if steal credited
 * @param defenderName - Primary defender (for offensive foul context)
 * @param foulEvent - FoulEvent if this is an offensive foul (for tracking)
 * @returns Descriptive string for play-by-play
 */
export function getTurnoverDescription(
  turnoverType: TurnoverType,
  ballHandlerName: string,
  stealCreditedTo: string | null = null,
  defenderName: string | null = null,
  foulEvent: any = null
): string {
  // USER FIX: Make turnover descriptions explicit about live/dead ball status
  if (turnoverType === 'bad_pass') {
    if (stealCreditedTo) {
      // LIVE BALL: steal, play continues
      return `${ballHandlerName} throws a bad pass! Stolen by ${stealCreditedTo}! TURNOVER! (live ball)`;
    } else {
      // DEAD BALL: out of bounds
      return `${ballHandlerName} throws a bad pass out of bounds! TURNOVER! (dead ball)`;
    }
  } else if (turnoverType === 'lost_ball') {
    if (stealCreditedTo) {
      // LIVE BALL: stripped, play continues
      return `${ballHandlerName} loses the ball! Stripped by ${stealCreditedTo}! TURNOVER! (live ball)`;
    } else {
      // DEAD BALL: lost control, rolled out of bounds
      return `${ballHandlerName} loses control! Ball rolls out of bounds! TURNOVER! (dead ball)`;
    }
  } else if (turnoverType === 'offensive_foul') {
    // BUG FIX: Include foul tracking information
    // DEAD BALL: whistle blown for foul
    if (foulEvent) {
      // Format with foul counts
      const foulInfo = `[Team fouls: ${foulEvent.team_fouls_after}] (${ballHandlerName}: ${foulEvent.personal_fouls_after} personal fouls)`;
      if (defenderName) {
        return `FOUL! Offensive foul on ${ballHandlerName}! ${defenderName} drew the charge! ${foulInfo} TURNOVER! (dead ball)`;
      } else {
        return `FOUL! Offensive foul on ${ballHandlerName}! ${foulInfo} TURNOVER! (dead ball)`;
      }
    } else {
      // Fallback if no foul event (shouldn't happen with fix)
      if (defenderName) {
        return `${ballHandlerName} commits an offensive foul! ${defenderName} drew the charge! TURNOVER! (dead ball)`;
      } else {
        return `${ballHandlerName} commits an offensive foul! TURNOVER! (dead ball)`;
      }
    }
  } else if (turnoverType === 'shot_clock') {
    // DEAD BALL: whistle blown for shot clock violation
    return `Shot clock violation! ${ballHandlerName} couldn't get a shot off in time! TURNOVER! (dead ball)`;
  } else if (turnoverType === 'other_violation') {
    // DEAD BALL: whistle blown for violation
    return `${ballHandlerName} commits a violation (traveling/carry)! TURNOVER! (dead ball)`;
  } else {
    // Fallback for unknown types
    return `${ballHandlerName} turns the ball over! TURNOVER!`;
  }
}
