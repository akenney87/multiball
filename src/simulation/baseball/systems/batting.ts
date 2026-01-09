/**
 * Baseball Batting System
 *
 * Handles batting calculations including contact, power, and plate discipline.
 * Uses weighted attribute composites + sigmoid probability following basketball patterns.
 *
 * @module simulation/baseball/systems/batting
 */

import type { Player } from '../../../data/types';
import { calculateComposite, weightedSigmoidProbability, rollSuccess, weightedRandomChoice } from '../../core/probability';
import type { HitType, BattingStrategy, SwingStyle } from '../types';
import { DEFAULT_BATTING_STRATEGY } from '../types';
// Re-export HitType for convenience
export type { HitType } from '../types';
import {
  WEIGHTS_BATTING_CONTACT,
  WEIGHTS_BATTING_POWER,
  WEIGHTS_PLATE_DISCIPLINE,
  BASE_RATE_STRIKEOUT,
  BASE_RATE_WALK,
  BASE_RATE_HIT_BY_PITCH,
  BASE_RATE_DOUBLE,
  BASE_RATE_TRIPLE,
  BASE_RATE_HOME_RUN,
  PLATOON_ADVANTAGE_MODIFIER,
  CLUTCH_COMPOSURE_MULTIPLIER,
  SIGMOID_K,
  PLATE_APPROACH_MODIFIERS,
  SWING_STYLE_MODIFIERS,
} from '../constants';

// =============================================================================
// HANDEDNESS
// =============================================================================

/**
 * Simple string hash for deterministic handedness generation
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

/**
 * Seeded random number generator for deterministic results
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Get player handedness, either from metadata or generated deterministically
 *
 * @param player - Player object
 * @returns Object with bats (L/R/S) and throws (L/R)
 */
export function getPlayerHandedness(player: Player): { bats: 'L' | 'R' | 'S'; throws: 'L' | 'R' } {
  // If explicitly set in sportMetadata, use it
  if (player.sportMetadata?.baseball) {
    return {
      bats: player.sportMetadata.baseball.bats,
      throws: player.sportMetadata.baseball.throws,
    };
  }

  // Generate deterministically from player ID
  const seed = hashString(player.id);
  const rand = seededRandom(seed);

  // Distribution: 88% right, 10% left, 2% switch
  const batsRoll = rand();
  const bats: 'L' | 'R' | 'S' = batsRoll < 0.10 ? 'L' : batsRoll < 0.12 ? 'S' : 'R';

  // Throwing: 90% right, 10% left
  const throws: 'L' | 'R' = rand() < 0.10 ? 'L' : 'R';

  return { bats, throws };
}

/**
 * Check if batter has platoon advantage over pitcher
 *
 * Platoon advantage occurs when:
 * - LHB vs RHP
 * - RHB vs LHP
 * - Switch hitters always have advantage
 *
 * @param batter - Batter player
 * @param pitcher - Pitcher player
 * @returns True if batter has platoon advantage
 */
export function hasPlatoonAdvantage(batter: Player, pitcher: Player): boolean {
  const batterHand = getPlayerHandedness(batter);
  const pitcherHand = getPlayerHandedness(pitcher);

  // Switch hitters always bat from favorable side
  if (batterHand.bats === 'S') {
    return true;
  }

  // Left-handed batter vs Right-handed pitcher = advantage
  if (batterHand.bats === 'L' && pitcherHand.throws === 'R') {
    return true;
  }

  // Right-handed batter vs Left-handed pitcher = advantage
  if (batterHand.bats === 'R' && pitcherHand.throws === 'L') {
    return true;
  }

  return false;
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
 * Calculate batter's contact composite
 *
 * Contact determines ability to make contact with the ball.
 * High contact = higher batting average, fewer strikeouts.
 *
 * @param batter - Batter player
 * @returns Contact composite (0-100)
 */
export function calculateContactComposite(batter: Player): number {
  const attrs = flattenAttributes(batter);
  return calculateComposite(attrs, WEIGHTS_BATTING_CONTACT);
}

/**
 * Calculate batter's power composite
 *
 * Power determines extra-base hit potential.
 * High power = more doubles, triples, home runs.
 *
 * @param batter - Batter player
 * @returns Power composite (0-100)
 */
export function calculatePowerComposite(batter: Player): number {
  const attrs = flattenAttributes(batter);
  return calculateComposite(attrs, WEIGHTS_BATTING_POWER);
}

/**
 * Calculate batter's plate discipline composite
 *
 * Plate discipline determines ability to work counts and draw walks.
 * High discipline = more walks, fewer chases at bad pitches.
 *
 * @param batter - Batter player
 * @returns Discipline composite (0-100)
 */
export function calculateDisciplineComposite(batter: Player): number {
  const attrs = flattenAttributes(batter);
  return calculateComposite(attrs, WEIGHTS_PLATE_DISCIPLINE);
}

/**
 * Apply clutch modifier to weights if in clutch situation
 *
 * In clutch situations (7th inning+, within 2 runs), composure becomes more important.
 *
 * @param weights - Original weight table
 * @param isClutch - Whether this is a clutch situation
 * @returns Modified weights (or original if not clutch)
 */
function applyClutchToWeights(
  weights: Record<string, number>,
  isClutch: boolean
): Record<string, number> {
  if (!isClutch || !('composure' in weights)) {
    return weights;
  }

  // Boost composure weight by 50%
  const modified = { ...weights };
  const originalComposure = modified.composure ?? 0;
  const boostedComposure = originalComposure * CLUTCH_COMPOSURE_MULTIPLIER;

  // Recalculate other weights to maintain sum of 1.0
  const composureDelta = boostedComposure - originalComposure;
  const otherKeys = Object.keys(modified).filter(k => k !== 'composure');
  const totalOther = otherKeys.reduce((sum, k) => sum + (modified[k] ?? 0), 0);

  for (const key of otherKeys) {
    const original = modified[key] ?? 0;
    modified[key] = original - (composureDelta * (original / totalOther));
  }
  modified.composure = boostedComposure;

  return modified;
}

// =============================================================================
// AT-BAT OUTCOMES
// =============================================================================

export interface BattingContext {
  /** Is this a clutch situation (7th+, within 2 runs)? */
  isClutch: boolean;
  /** Current inning */
  inning: number;
  /** Current outs */
  outs: number;
  /** Runners on base */
  runnersOn: boolean[];
}

export interface BattingResult {
  /** Outcome type */
  outcome: 'strikeout' | 'walk' | 'hit_by_pitch' | 'ball_in_play';
  /** Debug information */
  debug: {
    contactComposite: number;
    powerComposite: number;
    disciplineComposite: number;
    platoonAdvantage: boolean;
    clutchSituation: boolean;
    strikeoutProbability: number;
    walkProbability: number;
  };
}

/**
 * Calculate strikeout probability
 *
 * @param batter - Batter player
 * @param pitcherComposite - Pitcher's combined velocity + movement composite
 * @param context - Batting context
 * @returns Probability of strikeout (0-1)
 */
export function calculateStrikeoutProbability(
  batter: Player,
  pitcherComposite: number,
  context: BattingContext
): number {
  // Get contact composite (with clutch modifier if applicable)
  const weights = applyClutchToWeights(WEIGHTS_BATTING_CONTACT, context.isClutch);
  const attrs = flattenAttributes(batter);
  const contactComposite = calculateComposite(attrs, weights);

  // Attribute difference (negative means pitcher has advantage)
  const attrDiff = contactComposite - pitcherComposite;

  // Calculate probability using sigmoid
  return weightedSigmoidProbability(BASE_RATE_STRIKEOUT, -attrDiff, SIGMOID_K);
}

/**
 * Calculate walk probability
 *
 * @param batter - Batter player
 * @param pitcherControl - Pitcher's control composite
 * @param context - Batting context
 * @returns Probability of walk (0-1)
 */
export function calculateWalkProbability(
  batter: Player,
  pitcherControl: number,
  context: BattingContext
): number {
  // Get discipline composite (with clutch modifier if applicable)
  const weights = applyClutchToWeights(WEIGHTS_PLATE_DISCIPLINE, context.isClutch);
  const attrs = flattenAttributes(batter);
  const disciplineComposite = calculateComposite(attrs, weights);

  // Attribute difference (positive means batter has discipline advantage)
  const attrDiff = disciplineComposite - pitcherControl;

  // Calculate probability using sigmoid
  return weightedSigmoidProbability(BASE_RATE_WALK, attrDiff, SIGMOID_K);
}

/**
 * Determine at-bat outcome (before ball in play)
 *
 * @param batter - Batter player
 * @param pitcher - Pitcher player
 * @param pitcherVelocityMovement - Pitcher's combined velocity + movement composite
 * @param pitcherControl - Pitcher's control composite
 * @param context - Batting context
 * @param battingStrategy - Optional batting strategy for modifiers
 * @returns Batting result (strikeout, walk, HBP, or ball in play)
 */
export function determineAtBatOutcome(
  batter: Player,
  pitcher: Player,
  pitcherVelocityMovement: number,
  pitcherControl: number,
  context: BattingContext,
  battingStrategy: BattingStrategy = DEFAULT_BATTING_STRATEGY
): BattingResult {
  const platoonAdv = hasPlatoonAdvantage(batter, pitcher);

  // Calculate composites
  let contactComposite = calculateContactComposite(batter);
  let powerComposite = calculatePowerComposite(batter);
  let disciplineComposite = calculateDisciplineComposite(batter);

  // Apply platoon advantage (+5% to contact and power)
  if (platoonAdv) {
    contactComposite *= (1 + PLATOON_ADVANTAGE_MODIFIER);
    powerComposite *= (1 + PLATOON_ADVANTAGE_MODIFIER);
  }

  // Calculate base probabilities
  let strikeoutProb = calculateStrikeoutProbability(batter, pitcherVelocityMovement, context);
  let walkProb = calculateWalkProbability(batter, pitcherControl, context);
  // HBP probability: less control = more HBP, clamp to valid range [0.001, 0.03]
  const hbpProb = Math.max(0.001, Math.min(0.03, BASE_RATE_HIT_BY_PITCH * (1 + (50 - pitcherControl) / 100)));

  // Apply plate approach modifiers (multiplicative)
  const approachMods = PLATE_APPROACH_MODIFIERS[battingStrategy.plateApproach];
  strikeoutProb *= (1 + approachMods.strikeoutRate);
  walkProb *= (1 + approachMods.walkRate);

  // Clamp probabilities to valid range
  strikeoutProb = Math.max(0.01, Math.min(0.50, strikeoutProb));
  walkProb = Math.max(0.01, Math.min(0.30, walkProb));

  const debug = {
    contactComposite,
    powerComposite,
    disciplineComposite,
    platoonAdvantage: platoonAdv,
    clutchSituation: context.isClutch,
    strikeoutProbability: strikeoutProb,
    walkProbability: walkProb,
  };

  // Roll for outcomes (order matters - check rare events first)
  if (rollSuccess(hbpProb)) {
    return { outcome: 'hit_by_pitch', debug };
  }

  if (rollSuccess(strikeoutProb)) {
    return { outcome: 'strikeout', debug };
  }

  if (rollSuccess(walkProb)) {
    return { outcome: 'walk', debug };
  }

  // Ball in play - will determine hit/out separately
  return { outcome: 'ball_in_play', debug };
}

// =============================================================================
// HIT TYPE DETERMINATION
// =============================================================================

export interface HitTypeResult {
  hitType: HitType;
  debug: {
    powerComposite: number;
    singleProb: number;
    doubleProb: number;
    tripleProb: number;
    homeRunProb: number;
  };
}

/**
 * Determine hit type based on batter's power and swing style
 *
 * High power batters get more extra-base hits and home runs.
 * Swing style affects the trade-off between power and contact:
 * - Power swing: More HR/XBH but lower overall hit rate (handled in BABIP)
 * - Contact swing: More singles, fewer HR/XBH
 *
 * @param batter - Batter player
 * @param platoonAdvantage - Whether batter has platoon advantage
 * @param swingStyle - Swing style (power/contact/balanced)
 * @returns Hit type and debug info
 */
export function determineHitType(
  batter: Player,
  platoonAdvantage: boolean = false,
  swingStyle: SwingStyle = 'balanced'
): HitTypeResult {
  let powerComposite = calculatePowerComposite(batter);

  // Apply platoon advantage
  if (platoonAdvantage) {
    powerComposite *= (1 + PLATOON_ADVANTAGE_MODIFIER);
  }

  // Adjust hit distribution based on power
  // Power affects HR and XBH rates
  // Power 50 = base rates, Power 100 = 2x HR rate
  const powerFactor = powerComposite / 50; // 0.02 at power=1, 2.0 at power=100

  // Get swing style modifiers
  const styleMods = SWING_STYLE_MODIFIERS[swingStyle];

  // Calculate adjusted probabilities with swing style modifiers
  let homeRunProb = BASE_RATE_HOME_RUN * powerFactor * (1 + styleMods.homeRunRate);
  let tripleProb = BASE_RATE_TRIPLE * Math.sqrt(powerFactor) * (1 + styleMods.extraBaseHitRate);
  let doubleProb = BASE_RATE_DOUBLE * Math.pow(powerFactor, 0.7) * (1 + styleMods.extraBaseHitRate);
  let singleProb = 1 - homeRunProb - tripleProb - doubleProb;

  // Normalize to ensure they sum to 1
  const total = singleProb + doubleProb + tripleProb + homeRunProb;
  singleProb /= total;
  doubleProb /= total;
  tripleProb /= total;
  homeRunProb /= total;

  // Ensure minimum for each type
  singleProb = Math.max(0.30, singleProb); // At least 30% singles
  homeRunProb = Math.min(0.40, homeRunProb); // Cap at 40% HR

  // Re-normalize
  const reTotal = singleProb + doubleProb + tripleProb + homeRunProb;
  singleProb /= reTotal;
  doubleProb /= reTotal;
  tripleProb /= reTotal;
  homeRunProb /= reTotal;

  const hitTypes: HitType[] = ['single', 'double', 'triple', 'home_run'];
  const probs = [singleProb, doubleProb, tripleProb, homeRunProb];

  const hitType = weightedRandomChoice(hitTypes, probs);

  return {
    hitType,
    debug: {
      powerComposite,
      singleProb,
      doubleProb,
      tripleProb,
      homeRunProb,
    },
  };
}

/**
 * Determine if ball in play results in hit or out
 *
 * @param batter - Batter player
 * @param pitcherComposite - Pitcher's overall composite
 * @param fielderComposite - Relevant fielder's composite
 * @param context - Batting context
 * @param swingStyle - Swing style (affects BABIP)
 * @returns True if hit, false if out
 */
export function determineBallInPlayResult(
  batter: Player,
  pitcherComposite: number,
  fielderComposite: number,
  context: BattingContext,
  swingStyle: SwingStyle = 'balanced'
): boolean {
  // Contact composite vs (pitcher + fielding) determines hit probability
  let contactComposite = calculateContactComposite(batter);

  // Apply clutch modifier
  if (context.isClutch) {
    const weights = applyClutchToWeights(WEIGHTS_BATTING_CONTACT, true);
    const attrs = flattenAttributes(batter);
    contactComposite = calculateComposite(attrs, weights);
  }

  // Average of pitcher and fielder (fielder matters for balls in play)
  const defenseComposite = (pitcherComposite + fielderComposite) / 2;

  // Base rate for ball-in-play becoming a hit (~30% BABIP)
  // Apply swing style modifier - power swing reduces BABIP, contact swing increases it
  const styleMods = SWING_STYLE_MODIFIERS[swingStyle];
  const baseHitRate = 0.30 * (1 + styleMods.babipModifier);
  const attrDiff = contactComposite - defenseComposite;

  const hitProb = weightedSigmoidProbability(baseHitRate, attrDiff, SIGMOID_K);

  return rollSuccess(hitProb);
}
