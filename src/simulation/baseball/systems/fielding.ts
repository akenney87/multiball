/**
 * Baseball Fielding System
 *
 * Handles fielding calculations including position-specific composites,
 * error rates, double play potential, and outfield assists.
 *
 * @module simulation/baseball/systems/fielding
 */

import type { Player } from '../../../data/types';
import { calculateComposite, weightedSigmoidProbability, rollSuccess, weightedRandomChoice } from '../../core/probability';
import {
  WEIGHTS_FIELDING_INFIELD,
  WEIGHTS_FIELDING_OUTFIELD,
  WEIGHTS_FIELDING_FIRST,
  WEIGHTS_FIELDING_CATCHER,
  BASE_RATE_ERROR,
  BASE_RATE_DOUBLE_PLAY,
  BASE_RATE_TRIPLE_PLAY,
  DP_BATTER_SPEED_FACTOR,
  DP_RUNNER_SPEED_FACTOR,
  SIGMOID_K,
} from '../constants';
import type { HitLocation } from '../types';

// =============================================================================
// POSITION TYPES
// =============================================================================

export type FieldingPosition =
  | 'P'   // Pitcher
  | 'C'   // Catcher
  | '1B'  // First Base
  | '2B'  // Second Base
  | '3B'  // Third Base
  | 'SS'  // Shortstop
  | 'LF'  // Left Field
  | 'CF'  // Center Field
  | 'RF'; // Right Field

export type InfieldPosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS';
export type OutfieldPosition = 'LF' | 'CF' | 'RF';

// =============================================================================
// POSITION-SPECIFIC WEIGHT TABLES
// =============================================================================

/**
 * Get appropriate weight table for position
 */
function getPositionWeights(position: FieldingPosition): Record<string, number> {
  switch (position) {
    case 'C':
      return WEIGHTS_FIELDING_CATCHER;
    case '1B':
      return WEIGHTS_FIELDING_FIRST;
    case '2B':
    case '3B':
    case 'SS':
      return WEIGHTS_FIELDING_INFIELD;
    case 'LF':
    case 'CF':
    case 'RF':
      return WEIGHTS_FIELDING_OUTFIELD;
    case 'P':
      // Pitchers use simplified fielding weights
      return {
        reactions: 0.30,
        agility: 0.25,
        throw_accuracy: 0.20,
        awareness: 0.15,
        composure: 0.10,
      };
    default:
      return WEIGHTS_FIELDING_INFIELD;
  }
}

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
 * Calculate fielding composite for a specific position
 *
 * @param player - Player object
 * @param position - Fielding position
 * @returns Position-specific fielding composite (0-100)
 */
export function calculateFieldingComposite(
  player: Player,
  position: FieldingPosition
): number {
  const attrs = flattenAttributes(player);
  const weights = getPositionWeights(position);
  return calculateComposite(attrs, weights);
}

/**
 * Calculate range factor for fielder
 *
 * Range determines ability to reach balls in play.
 * Important for infielders (SS, 2B) and center fielders.
 *
 * @param player - Player object
 * @returns Range composite (0-100)
 */
export function calculateRangeComposite(player: Player): number {
  const attrs = flattenAttributes(player);
  return calculateComposite(attrs, {
    top_speed: 0.30,
    acceleration: 0.25,
    agility: 0.20,
    reactions: 0.15,
    awareness: 0.10,
  });
}

/**
 * Calculate arm strength for throws
 *
 * Important for outfielders and catcher.
 *
 * @param player - Player object
 * @returns Arm composite (0-100)
 */
export function calculateArmComposite(player: Player): number {
  const attrs = flattenAttributes(player);
  return calculateComposite(attrs, {
    arm_strength: 0.40,
    throw_accuracy: 0.35,
    form_technique: 0.15,
    balance: 0.10,
  });
}

// =============================================================================
// ERROR CALCULATIONS
// =============================================================================

export interface ErrorResult {
  /** Whether an error occurred */
  isError: boolean;
  /** Type of error */
  errorType: 'throwing' | 'fielding' | 'dropped' | null;
  /** Debug info */
  debug: {
    fieldingComposite: number;
    errorProbability: number;
    position: FieldingPosition;
  };
}

/**
 * Check if fielder commits an error on a routine play
 *
 * @param player - Fielder player
 * @param position - Fielding position
 * @param difficulty - Play difficulty (0 = routine, 1 = difficult)
 * @returns Error result
 */
export function checkForError(
  player: Player,
  position: FieldingPosition,
  difficulty: number = 0
): ErrorResult {
  const fieldingComposite = calculateFieldingComposite(player, position);

  // Higher difficulty increases error chance
  const adjustedBaseRate = BASE_RATE_ERROR * (1 + difficulty * 2);

  // Lower fielding composite = higher error chance
  const attrDiff = 50 - fieldingComposite; // Positive when below average
  const errorProb = weightedSigmoidProbability(adjustedBaseRate, attrDiff, SIGMOID_K);

  const debug = {
    fieldingComposite,
    errorProbability: errorProb,
    position,
  };

  if (rollSuccess(errorProb)) {
    // Determine error type based on situation
    const errorTypes: ('throwing' | 'fielding' | 'dropped')[] = ['throwing', 'fielding', 'dropped'];
    const errorWeights = position === 'C' || position === '1B'
      ? [0.20, 0.30, 0.50] // Catchers/1B more likely to drop
      : [0.40, 0.40, 0.20]; // Infielders more throwing errors

    const errorType = weightedRandomChoice(errorTypes, errorWeights);
    return { isError: true, errorType, debug };
  }

  return { isError: false, errorType: null, debug };
}

/**
 * Calculate error probability for display purposes
 *
 * @param player - Fielder player
 * @param position - Fielding position
 * @returns Error probability per chance
 */
export function getErrorProbability(
  player: Player,
  position: FieldingPosition
): number {
  const fieldingComposite = calculateFieldingComposite(player, position);
  const attrDiff = 50 - fieldingComposite;
  return weightedSigmoidProbability(BASE_RATE_ERROR, attrDiff, SIGMOID_K);
}

// =============================================================================
// DOUBLE PLAY CALCULATIONS
// =============================================================================

export interface DoublePlayResult {
  /** Whether double play was turned */
  success: boolean;
  /** Type of double play */
  type: '6-4-3' | '4-6-3' | '5-4-3' | '3-6-3' | '1-6-3' | null;
  /** Debug info */
  debug: {
    initiatorComposite: number;
    pivotComposite: number;
    firstBaseComposite: number;
    batterSpeedPenalty: number;
    runnerSpeedPenalty: number;
    doublePlayProb: number;
  };
}

/**
 * Calculate speed composite for a player
 */
function calculateSpeedComposite(player: Player): number {
  const attrs = player.attributes as unknown as Record<string, number>;
  return calculateComposite(attrs, {
    top_speed: 0.50,
    acceleration: 0.30,
    agility: 0.20,
  });
}

/**
 * Attempt to turn a double play
 *
 * Requires runner on first, less than 2 outs, ground ball.
 * Batter and runner speed affect the probability of turning the DP.
 *
 * @param shortstop - Shortstop player (or initiating fielder)
 * @param secondBaseman - Second baseman (pivot man)
 * @param firstBaseman - First baseman (completing the play)
 * @param groundBallTo - Where the ball was hit
 * @param batter - Batter (speed affects DP probability)
 * @param runnerOnFirst - Runner on first (speed affects DP probability)
 * @returns Double play result
 */
export function attemptDoublePlay(
  shortstop: Player,
  secondBaseman: Player,
  firstBaseman: Player,
  groundBallTo: 'SS' | '2B' | '3B' | 'P' | '1B',
  batter?: Player,
  runnerOnFirst?: Player
): DoublePlayResult {
  // Determine who initiates and pivots based on where ball was hit
  let initiator: Player;
  let pivot: Player;
  let dpType: '6-4-3' | '4-6-3' | '5-4-3' | '3-6-3' | '1-6-3';

  switch (groundBallTo) {
    case 'SS':
      initiator = shortstop;
      pivot = secondBaseman;
      dpType = '6-4-3';
      break;
    case '2B':
      initiator = secondBaseman;
      pivot = shortstop;
      dpType = '4-6-3';
      break;
    case '3B':
      initiator = shortstop; // 3B throws to SS typically
      pivot = secondBaseman;
      dpType = '5-4-3';
      break;
    case 'P':
      initiator = shortstop; // Pitcher to SS
      pivot = secondBaseman;
      dpType = '1-6-3';
      break;
    case '1B':
      initiator = firstBaseman;
      pivot = shortstop;
      dpType = '3-6-3';
      break;
    default:
      initiator = shortstop;
      pivot = secondBaseman;
      dpType = '6-4-3';
  }

  const initiatorComposite = calculateFieldingComposite(initiator, 'SS');
  const pivotComposite = calculateFieldingComposite(pivot, '2B');
  const firstBaseComposite = calculateFieldingComposite(firstBaseman, '1B');

  // Combined fielding composite for DP success
  const combinedComposite = (initiatorComposite * 0.35 + pivotComposite * 0.40 + firstBaseComposite * 0.25);

  // Speed penalties - fast batter/runner reduce DP probability
  // Speed above 50 reduces DP chance, below 50 increases it
  const batterSpeed = batter ? calculateSpeedComposite(batter) : 50;
  const runnerSpeed = runnerOnFirst ? calculateSpeedComposite(runnerOnFirst) : 50;

  // Penalty is proportional to how much speed exceeds 50 (average)
  // Max penalty is DP_BATTER_SPEED_FACTOR (15%) for 100 speed
  const batterSpeedPenalty = ((batterSpeed - 50) / 50) * DP_BATTER_SPEED_FACTOR;
  const runnerSpeedPenalty = ((runnerSpeed - 50) / 50) * DP_RUNNER_SPEED_FACTOR;

  const attrDiff = combinedComposite - 50;
  let dpProb = weightedSigmoidProbability(BASE_RATE_DOUBLE_PLAY, attrDiff, SIGMOID_K);

  // Apply speed penalties (reduce DP probability for fast runners/batters)
  dpProb = dpProb * (1 - batterSpeedPenalty) * (1 - runnerSpeedPenalty);
  dpProb = Math.max(0.01, Math.min(0.95, dpProb)); // Clamp to reasonable range

  const debug = {
    initiatorComposite,
    pivotComposite,
    firstBaseComposite,
    batterSpeedPenalty,
    runnerSpeedPenalty,
    doublePlayProb: dpProb,
  };

  if (rollSuccess(dpProb)) {
    return { success: true, type: dpType, debug };
  }

  return { success: false, type: null, debug };
}

/**
 * Attempt to turn a triple play
 *
 * Requires 2+ runners on base, less than 2 outs, ground ball.
 * Very rare - about 1 in 450 games.
 *
 * @param defense - Defensive players
 * @param groundBallTo - Where the ball was hit
 * @returns Whether triple play was turned
 */
export function attemptTriplePlay(
  defense: Record<FieldingPosition, Player>,
  _groundBallTo: FieldingPosition
): boolean {
  // Triple plays are extremely rare
  const ss = defense['SS'];
  const secondBase = defense['2B'];
  const firstBase = defense['1B'];

  if (!ss || !secondBase || !firstBase) return false;

  const ssComposite = calculateFieldingComposite(ss, 'SS');
  const secondComposite = calculateFieldingComposite(secondBase, '2B');
  const firstComposite = calculateFieldingComposite(firstBase, '1B');

  // Combined composite affects triple play chance
  const combinedComposite = (ssComposite + secondComposite + firstComposite) / 3;
  const attrDiff = combinedComposite - 50;

  const tpProb = weightedSigmoidProbability(BASE_RATE_TRIPLE_PLAY, attrDiff, SIGMOID_K);

  return rollSuccess(tpProb);
}

// =============================================================================
// OUTFIELD PLAYS
// =============================================================================

export interface OutfieldPlayResult {
  /** Whether the ball was caught */
  caught: boolean;
  /** Whether runner can tag and advance */
  canTag: boolean;
  /** Outfielder's throw rating (affects runner advancement) */
  throwRating: number;
  /** Debug info */
  debug: {
    rangeComposite: number;
    armComposite: number;
    catchDifficulty: number;
  };
}

/**
 * Resolve outfield fly ball
 *
 * @param outfielder - Outfielder player
 * @param position - Outfield position
 * @param flyBallDepth - How deep the fly ball is (0 = shallow, 1 = warning track)
 * @returns Outfield play result
 */
export function resolveOutfieldFlyBall(
  outfielder: Player,
  _position: OutfieldPosition,
  flyBallDepth: number
): OutfieldPlayResult {
  const rangeComposite = calculateRangeComposite(outfielder);
  const armComposite = calculateArmComposite(outfielder);

  // Catch difficulty based on depth and range
  // 0 depth = routine, 1 depth = warning track
  const catchDifficulty = flyBallDepth;

  // Base catch rate is very high (95%), modified by difficulty and range
  const baseCatchRate = 0.95 - (catchDifficulty * 0.30);
  const attrDiff = rangeComposite - 50;
  const catchProb = weightedSigmoidProbability(baseCatchRate, attrDiff, SIGMOID_K);

  const caught = rollSuccess(catchProb);

  // If caught, can runner tag?
  // Deeper fly balls with weaker arms = better tag chances
  const canTag = caught && flyBallDepth > 0.3;

  const debug = {
    rangeComposite,
    armComposite,
    catchDifficulty,
  };

  return {
    caught,
    canTag,
    throwRating: armComposite,
    debug,
  };
}

/**
 * Check if outfielder can throw out runner attempting to advance
 *
 * @param outfielder - Outfielder player
 * @param runnerSpeed - Runner's speed composite
 * @param baseDistance - Distance to throw (1 = one base, 2 = two bases)
 * @returns True if runner is thrown out
 */
export function attemptOutfieldAssist(
  outfielder: Player,
  runnerSpeed: number,
  baseDistance: number
): boolean {
  const armComposite = calculateArmComposite(outfielder);

  // Base rate depends on distance (harder to throw out from deeper)
  const baseRate = baseDistance === 1 ? 0.30 : 0.15;

  // Arm vs speed matchup
  const attrDiff = armComposite - runnerSpeed;
  const throwOutProb = weightedSigmoidProbability(baseRate, attrDiff, SIGMOID_K);

  return rollSuccess(throwOutProb);
}

// =============================================================================
// HIT LOCATION TO FIELDER
// =============================================================================

/**
 * Map hit location to primary fielder responsible
 */
export function getResponsibleFielder(location: HitLocation): FieldingPosition {
  const locationMap: Record<HitLocation, FieldingPosition> = {
    left_field: 'LF',
    center_field: 'CF',
    right_field: 'RF',
    left_line: 'LF',
    right_line: 'RF',
    shortstop_hole: 'SS',
    up_the_middle: '2B',
    third_base_line: '3B',
    first_base_line: '1B',
  };

  return locationMap[location];
}

/**
 * Determine hit location based on batter tendency and randomness
 *
 * @returns Random hit location with realistic distribution
 */
export function generateHitLocation(): HitLocation {
  const locations: HitLocation[] = [
    'left_field',
    'center_field',
    'right_field',
    'left_line',
    'right_line',
    'shortstop_hole',
    'up_the_middle',
    'third_base_line',
    'first_base_line',
  ];

  // Roughly realistic distribution
  const weights = [
    0.15, // left_field
    0.20, // center_field
    0.15, // right_field
    0.05, // left_line
    0.05, // right_line
    0.12, // shortstop_hole
    0.13, // up_the_middle
    0.08, // third_base_line
    0.07, // first_base_line
  ];

  return weightedRandomChoice(locations, weights);
}

// =============================================================================
// FIELDER SCOUTING REPORT
// =============================================================================

/**
 * Get fielder scouting report for a position
 */
export function getFielderScoutingReport(
  player: Player,
  position: FieldingPosition
): {
  position: FieldingPosition;
  fielding: { value: number; grade: string };
  range: { value: number; grade: string };
  arm: { value: number; grade: string };
  errorRate: number;
  summary: string;
} {
  const fieldingComposite = calculateFieldingComposite(player, position);
  const rangeComposite = calculateRangeComposite(player);
  const armComposite = calculateArmComposite(player);
  const errorRate = getErrorProbability(player, position);

  const gradeValue = (v: number): string => {
    if (v >= 80) return 'Gold Glove';
    if (v >= 70) return 'Above Average';
    if (v >= 55) return 'Average';
    if (v >= 40) return 'Below Average';
    return 'Liability';
  };

  const isOutfield = ['LF', 'CF', 'RF'].includes(position);
  const summary = isOutfield
    ? `${gradeValue(rangeComposite)} range with ${gradeValue(armComposite).toLowerCase()} arm`
    : `${gradeValue(fieldingComposite)} glove, ${(errorRate * 100).toFixed(1)}% error rate`;

  return {
    position,
    fielding: { value: fieldingComposite, grade: gradeValue(fieldingComposite) },
    range: { value: rangeComposite, grade: gradeValue(rangeComposite) },
    arm: { value: armComposite, grade: gradeValue(armComposite) },
    errorRate,
    summary,
  };
}
