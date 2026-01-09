/**
 * Baseball Pitching System
 *
 * Handles pitching calculations including velocity, control, movement, and fatigue.
 * Uses weighted attribute composites + sigmoid probability following basketball patterns.
 *
 * @module simulation/baseball/systems/pitching
 */

import type { Player } from '../../../data/types';
import { calculateComposite, weightedSigmoidProbability, rollSuccess } from '../../core/probability';
import {
  WEIGHTS_PITCHING_VELOCITY,
  WEIGHTS_PITCHING_CONTROL,
  WEIGHTS_PITCHING_MOVEMENT,
  WEIGHTS_PITCHER_STAMINA,
  WEIGHTS_FIELDING_CATCHER,
  PITCH_COUNT_THRESHOLD,
  DEGRADATION_RATE,
  MAX_DEGRADATION,
  PITCH_COUNT_SUBSTITUTION_THRESHOLD,
  BASE_RATE_WILD_PITCH,
  BASE_RATE_PASSED_BALL,
  SIGMOID_K,
} from '../constants';

// =============================================================================
// COMPOSITE CALCULATIONS
// =============================================================================

/**
 * Flatten player attributes for composite calculation
 */
function flattenAttributes(player: Player): Record<string, number> {
  return player.attributes as unknown as Record<string, number>;
}

/**
 * Calculate pitcher's velocity composite
 *
 * Velocity determines fastball effectiveness and strikeout potential.
 * High velocity = more strikeouts, harder to hit.
 *
 * @param pitcher - Pitcher player
 * @returns Velocity composite (0-100)
 */
export function calculateVelocityComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, WEIGHTS_PITCHING_VELOCITY);
}

/**
 * Calculate pitcher's control composite
 *
 * Control determines ability to throw strikes and locate pitches.
 * High control = fewer walks, fewer wild pitches, more efficient innings.
 *
 * @param pitcher - Pitcher player
 * @returns Control composite (0-100)
 */
export function calculateControlComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, WEIGHTS_PITCHING_CONTROL);
}

/**
 * Calculate pitcher's movement composite
 *
 * Movement determines pitch deception and break.
 * High movement = more swinging strikes, harder to barrel up.
 *
 * @param pitcher - Pitcher player
 * @returns Movement composite (0-100)
 */
export function calculateMovementComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, WEIGHTS_PITCHING_MOVEMENT);
}

/**
 * Calculate pitcher's stamina composite
 *
 * Stamina determines ability to pitch deep into games.
 * High stamina = more pitches before fatigue, less degradation.
 *
 * @param pitcher - Pitcher player
 * @returns Stamina composite (0-100)
 */
export function calculatePitcherStaminaComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, WEIGHTS_PITCHER_STAMINA);
}

/**
 * Calculate combined velocity + movement composite
 *
 * Used for determining strikeout probability in batting matchups.
 *
 * @param pitcher - Pitcher player
 * @returns Combined velocity/movement composite (0-100)
 */
export function calculateVelocityMovementComposite(pitcher: Player): number {
  const velocity = calculateVelocityComposite(pitcher);
  const movement = calculateMovementComposite(pitcher);
  // Weighted average: velocity slightly more important
  return velocity * 0.55 + movement * 0.45;
}

/**
 * Calculate overall pitcher effectiveness
 *
 * Combines all pitching skills for general pitcher rating.
 *
 * @param pitcher - Pitcher player
 * @returns Overall effectiveness (0-100)
 */
export function calculateOverallEffectiveness(pitcher: Player): number {
  const velocity = calculateVelocityComposite(pitcher);
  const control = calculateControlComposite(pitcher);
  const movement = calculateMovementComposite(pitcher);
  // Balanced average of all three skills
  return velocity * 0.35 + control * 0.35 + movement * 0.30;
}

// =============================================================================
// FATIGUE SYSTEM
// =============================================================================

export interface PitcherFatigueState {
  /** Current pitch count */
  pitchCount: number;
  /** Current degradation factor (0.0 to MAX_DEGRADATION) */
  degradation: number;
  /** Whether pitcher has reached substitution threshold */
  needsSubstitution: boolean;
  /** Pitches until substitution threshold */
  pitchesUntilSubstitution: number;
}

/**
 * Calculate pitcher fatigue degradation based on pitch count
 *
 * Degradation formula:
 * - Under threshold (80): No degradation
 * - Over threshold: 0.5% per pitch, capped at 30%
 *
 * @param pitchCount - Current number of pitches thrown
 * @param staminaComposite - Pitcher's stamina composite (affects threshold)
 * @returns Degradation factor (0.0 to MAX_DEGRADATION)
 */
export function calculateFatigueDegradation(
  pitchCount: number,
  staminaComposite: number
): number {
  // High stamina extends threshold (up to +20 pitches at stamina 100)
  const staminaBonus = Math.floor((staminaComposite - 50) / 2.5);
  const adjustedThreshold = PITCH_COUNT_THRESHOLD + staminaBonus;

  if (pitchCount <= adjustedThreshold) {
    return 0.0;
  }

  const pitchesOverThreshold = pitchCount - adjustedThreshold;
  const degradation = pitchesOverThreshold * DEGRADATION_RATE;

  return Math.min(degradation, MAX_DEGRADATION);
}

/**
 * Get full fatigue state for pitcher
 *
 * @param pitcher - Pitcher player
 * @param pitchCount - Current pitch count
 * @returns Complete fatigue state
 */
export function getPitcherFatigueState(
  pitcher: Player,
  pitchCount: number
): PitcherFatigueState {
  const staminaComposite = calculatePitcherStaminaComposite(pitcher);
  const degradation = calculateFatigueDegradation(pitchCount, staminaComposite);

  // Stamina also affects substitution threshold
  const staminaBonus = Math.floor((staminaComposite - 50) / 2.5);
  const adjustedSubThreshold = PITCH_COUNT_SUBSTITUTION_THRESHOLD + staminaBonus;

  return {
    pitchCount,
    degradation,
    needsSubstitution: pitchCount >= adjustedSubThreshold,
    pitchesUntilSubstitution: Math.max(0, adjustedSubThreshold - pitchCount),
  };
}

/**
 * Apply fatigue degradation to pitcher's composites
 *
 * @param baseComposite - Original composite value
 * @param degradation - Degradation factor (0.0 to 0.30)
 * @returns Degraded composite value
 */
export function applyFatigue(baseComposite: number, degradation: number): number {
  return baseComposite * (1 - degradation);
}

/**
 * Get all pitcher composites with fatigue applied
 *
 * @param pitcher - Pitcher player
 * @param pitchCount - Current pitch count
 * @returns Object with all fatigued composites
 */
export function getFatiguedComposites(
  pitcher: Player,
  pitchCount: number
): {
  velocity: number;
  control: number;
  movement: number;
  velocityMovement: number;
  overall: number;
  fatigueState: PitcherFatigueState;
} {
  const fatigueState = getPitcherFatigueState(pitcher, pitchCount);
  const { degradation } = fatigueState;

  return {
    velocity: applyFatigue(calculateVelocityComposite(pitcher), degradation),
    control: applyFatigue(calculateControlComposite(pitcher), degradation),
    movement: applyFatigue(calculateMovementComposite(pitcher), degradation),
    velocityMovement: applyFatigue(calculateVelocityMovementComposite(pitcher), degradation),
    overall: applyFatigue(calculateOverallEffectiveness(pitcher), degradation),
    fatigueState,
  };
}

// =============================================================================
// WILD PITCH / PASSED BALL
// =============================================================================

export interface WildPitchResult {
  /** Whether a wild pitch/passed ball occurred */
  occurred: boolean;
  /** Type of event */
  type: 'wild_pitch' | 'passed_ball' | null;
  /** Debug information */
  debug: {
    pitcherControl: number;
    catcherComposite: number;
    wildPitchProb: number;
    passedBallProb: number;
  };
}

/**
 * Check for wild pitch or passed ball
 *
 * Wild pitches are caused by low pitcher control.
 * Passed balls are caused by low catcher skill.
 *
 * @param pitcher - Pitcher player
 * @param catcher - Catcher player
 * @param pitchCount - Current pitch count (affects via fatigue)
 * @returns Wild pitch result
 */
export function checkWildPitchOrPassedBall(
  pitcher: Player,
  catcher: Player,
  pitchCount: number
): WildPitchResult {
  const fatiguedComposites = getFatiguedComposites(pitcher, pitchCount);
  const pitcherControl = fatiguedComposites.control;

  // Calculate catcher's receiving/blocking composite using proper weights
  const catcherAttrs = flattenAttributes(catcher);
  const catcherComposite = calculateComposite(catcherAttrs, WEIGHTS_FIELDING_CATCHER);

  // Wild pitch probability inversely related to control
  // Lower control = higher wild pitch chance
  const controlDeficit = 50 - pitcherControl; // Positive when below average
  const wildPitchProb = weightedSigmoidProbability(
    BASE_RATE_WILD_PITCH,
    controlDeficit,
    SIGMOID_K
  );

  // Passed ball probability inversely related to catcher receiving skill
  const catcherDeficit = 50 - catcherComposite;
  const passedBallProb = weightedSigmoidProbability(
    BASE_RATE_PASSED_BALL,
    catcherDeficit,
    SIGMOID_K
  );

  const debug = {
    pitcherControl,
    catcherComposite,
    wildPitchProb,
    passedBallProb,
  };

  // Check for wild pitch first (more common)
  if (rollSuccess(wildPitchProb)) {
    return { occurred: true, type: 'wild_pitch', debug };
  }

  // Check for passed ball
  if (rollSuccess(passedBallProb)) {
    return { occurred: true, type: 'passed_ball', debug };
  }

  return { occurred: false, type: null, debug };
}

// =============================================================================
// PITCH ESTIMATION
// =============================================================================

/**
 * Estimate pitches for an at-bat based on discipline matchup
 *
 * Higher batter discipline + lower pitcher control = more pitches
 *
 * @param batterDiscipline - Batter's plate discipline composite
 * @param pitcherControl - Pitcher's control composite
 * @returns Estimated pitch count for at-bat (3-12 range)
 */
export function estimateAtBatPitchCount(
  batterDiscipline: number,
  pitcherControl: number
): number {
  // Base pitch count: 4-5 pitches
  const basePitches = 4.5;

  // Discipline adds pitches (patient hitters see more)
  const disciplineBonus = (batterDiscipline - 50) / 25; // ±2 at extremes

  // Poor control adds pitches (more balls thrown)
  const controlPenalty = (50 - pitcherControl) / 25; // ±2 at extremes

  // Random variance (±1 pitch)
  const variance = (Math.random() - 0.5) * 2;

  const totalPitches = basePitches + disciplineBonus + controlPenalty + variance;

  // Clamp to realistic range
  return Math.max(3, Math.min(12, Math.round(totalPitches)));
}

// =============================================================================
// PITCHER TYPE DETECTION
// =============================================================================

export type PitcherType = 'power' | 'finesse' | 'balanced';

/**
 * Determine pitcher type based on composites
 *
 * Power pitchers: Velocity > Control + 10
 * Finesse pitchers: Control > Velocity + 10
 * Balanced: Neither dominates
 *
 * @param pitcher - Pitcher player
 * @returns Pitcher type classification
 */
export function determinePitcherType(pitcher: Player): PitcherType {
  const velocity = calculateVelocityComposite(pitcher);
  const control = calculateControlComposite(pitcher);

  if (velocity > control + 10) {
    return 'power';
  } else if (control > velocity + 10) {
    return 'finesse';
  }
  return 'balanced';
}

/**
 * Get pitcher scouting report
 *
 * Provides human-readable assessment of pitcher's skills.
 *
 * @param pitcher - Pitcher player
 * @returns Scouting report object
 */
export function getPitcherScoutingReport(pitcher: Player): {
  type: PitcherType;
  velocity: { value: number; grade: string };
  control: { value: number; grade: string };
  movement: { value: number; grade: string };
  stamina: { value: number; grade: string };
  overall: number;
  summary: string;
} {
  const velocity = calculateVelocityComposite(pitcher);
  const control = calculateControlComposite(pitcher);
  const movement = calculateMovementComposite(pitcher);
  const stamina = calculatePitcherStaminaComposite(pitcher);
  const overall = calculateOverallEffectiveness(pitcher);
  const type = determinePitcherType(pitcher);

  const gradeValue = (v: number): string => {
    if (v >= 80) return 'Elite';
    if (v >= 70) return 'Above Average';
    if (v >= 55) return 'Average';
    if (v >= 40) return 'Below Average';
    return 'Poor';
  };

  const typeDescriptions: Record<PitcherType, string> = {
    power: 'Power pitcher who overpowers hitters with velocity',
    finesse: 'Finesse pitcher who relies on location and command',
    balanced: 'Well-rounded pitcher with balanced skills',
  };

  return {
    type,
    velocity: { value: velocity, grade: gradeValue(velocity) },
    control: { value: control, grade: gradeValue(control) },
    movement: { value: movement, grade: gradeValue(movement) },
    stamina: { value: stamina, grade: gradeValue(stamina) },
    overall,
    summary: typeDescriptions[type],
  };
}
