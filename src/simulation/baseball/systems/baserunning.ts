/**
 * Baseball Baserunning System
 *
 * Handles baserunning calculations including stolen bases, tag-up plays,
 * and extra base advancement decisions.
 *
 * @module simulation/baseball/systems/baserunning
 */

import type { Player } from '../../../data/types';
import { calculateComposite, weightedSigmoidProbability, rollSuccess } from '../../core/probability';
import {
  WEIGHTS_STEALING,
  WEIGHTS_BASERUNNING_AGGRESSION,
  BASE_RATE_STEAL_SUCCESS,
  BASE_RATE_SAC_FLY_SUCCESS,
  SIGMOID_K,
} from '../constants';
import type { BaseState, HitType } from '../types';

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
 * Calculate runner's stealing composite
 *
 * Determines ability to steal bases successfully.
 * High stealing = good jump, fast acceleration.
 *
 * @param runner - Runner player
 * @returns Stealing composite (0-100)
 */
export function calculateStealingComposite(runner: Player): number {
  const attrs = flattenAttributes(runner);
  return calculateComposite(attrs, WEIGHTS_STEALING);
}

/**
 * Calculate runner's baserunning aggression composite
 *
 * Determines willingness and ability to take extra bases.
 *
 * @param runner - Runner player
 * @returns Aggression composite (0-100)
 */
export function calculateAggressionComposite(runner: Player): number {
  const attrs = flattenAttributes(runner);
  return calculateComposite(attrs, WEIGHTS_BASERUNNING_AGGRESSION);
}

/**
 * Calculate runner's raw speed composite
 *
 * Pure speed rating for baserunning calculations.
 *
 * @param runner - Runner player
 * @returns Speed composite (0-100)
 */
export function calculateSpeedComposite(runner: Player): number {
  const attrs = flattenAttributes(runner);
  return calculateComposite(attrs, {
    top_speed: 0.50,
    acceleration: 0.30,
    agility: 0.20,
  });
}

// =============================================================================
// STOLEN BASE SYSTEM
// =============================================================================

export interface StealAttemptResult {
  /** Whether the steal was attempted */
  attempted: boolean;
  /** Whether the steal was successful */
  success: boolean;
  /** Base stolen (2 = second, 3 = third, 4 = home) */
  targetBase: 2 | 3 | 4;
  /** Debug info */
  debug: {
    runnerStealing: number;
    runnerSpeed: number;
    catcherArm: number;
    pitcherHoldTime: number;
    stealProbability: number;
  };
}

/**
 * Calculate catcher's throw composite for stealing
 */
function calculateCatcherThrowComposite(catcher: Player): number {
  const attrs = flattenAttributes(catcher);
  return calculateComposite(attrs, {
    arm_strength: 0.35,
    throw_accuracy: 0.30,
    reactions: 0.20,
    composure: 0.15,
  });
}

/**
 * Calculate pitcher's ability to hold runners
 */
function calculatePitcherHoldComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, {
    awareness: 0.35,
    reactions: 0.25,
    deception: 0.20,
    composure: 0.20,
  });
}

/**
 * Attempt to steal a base
 *
 * @param runner - Runner attempting to steal
 * @param catcher - Catcher throwing
 * @param pitcher - Pitcher holding runner
 * @param targetBase - Base to steal (2, 3, or 4 for home)
 * @returns Steal attempt result
 */
export function attemptStolenBase(
  runner: Player,
  catcher: Player,
  pitcher: Player,
  targetBase: 2 | 3 | 4
): StealAttemptResult {
  const runnerStealing = calculateStealingComposite(runner);
  const runnerSpeed = calculateSpeedComposite(runner);
  const catcherArm = calculateCatcherThrowComposite(catcher);
  const pitcherHold = calculatePitcherHoldComposite(pitcher);

  // Stealing home is much harder
  const baseModifier = targetBase === 4 ? 0.4 : targetBase === 3 ? 0.9 : 1.0;

  // Runner's advantage is stealing composite vs catcher arm + pitcher hold
  const defenseComposite = (catcherArm * 0.7 + pitcherHold * 0.3);
  const attrDiff = runnerStealing - defenseComposite;

  // Calculate probability
  const baseRate = BASE_RATE_STEAL_SUCCESS * baseModifier;
  const stealProb = weightedSigmoidProbability(baseRate, attrDiff, SIGMOID_K);

  const debug = {
    runnerStealing,
    runnerSpeed,
    catcherArm,
    pitcherHoldTime: pitcherHold,
    stealProbability: stealProb,
  };

  const success = rollSuccess(stealProb);

  return {
    attempted: true,
    success,
    targetBase,
    debug,
  };
}

/**
 * Determine if a steal attempt should be made (AI decision)
 *
 * @param runner - Potential base stealer
 * @param catcher - Opposition catcher
 * @param pitcher - Opposition pitcher
 * @param targetBase - Base to steal
 * @param gameState - Current game situation (outs, inning, score)
 * @returns True if steal should be attempted
 */
export function shouldAttemptSteal(
  runner: Player,
  catcher: Player,
  _pitcher: Player,
  targetBase: 2 | 3 | 4,
  gameState: { outs: number; inning: number; scoreDiff: number }
): boolean {
  const runnerStealing = calculateStealingComposite(runner);
  const catcherArm = calculateCatcherThrowComposite(catcher);

  // Don't steal with 2 outs (too risky)
  if (gameState.outs === 2) {
    return runnerStealing >= 75; // Only elite base stealers
  }

  // Don't steal home unless desperate
  if (targetBase === 4) {
    return gameState.inning >= 9 && gameState.scoreDiff === -1 && runnerStealing >= 80;
  }

  // Calculate expected success rate
  const attrDiff = runnerStealing - catcherArm;
  const expectedSuccess = weightedSigmoidProbability(BASE_RATE_STEAL_SUCCESS, attrDiff, SIGMOID_K);

  // Only attempt if expected success > 70%
  return expectedSuccess > 0.70;
}

// =============================================================================
// BASE ADVANCEMENT
// =============================================================================

export interface BaseAdvancementResult {
  /** New base state after advancement */
  newBaseState: BaseState;
  /** Runs scored on the play */
  runsScored: number;
  /** Players who scored */
  scoringRunners: Player[];
  /** Any runners thrown out */
  runnersOut: Player[];
  /** Debug info */
  debug: {
    advancementDecisions: Array<{
      runner: string;
      from: number;
      to: number;
      success: boolean;
    }>;
  };
}

/**
 * Calculate standard base advancement on a hit
 *
 * @param currentBases - Current base state
 * @param batter - Batter who hit
 * @param hitType - Type of hit
 * @param outfieldArmRating - Outfielder's arm (affects extra bases)
 * @returns Advancement result
 */
export function calculateBaseAdvancement(
  currentBases: BaseState,
  batter: Player,
  hitType: HitType,
  outfieldArmRating: number = 50
): BaseAdvancementResult {
  const scoringRunners: Player[] = [];
  const runnersOut: Player[] = [];
  const advancementDecisions: Array<{
    runner: string;
    from: number;
    to: number;
    success: boolean;
  }> = [];

  // Copy current state
  const [first, second, third] = currentBases;
  let newFirst: Player | null = null;
  let newSecond: Player | null = null;
  let newThird: Player | null = null;

  // Base advancement rules by hit type
  switch (hitType) {
    case 'home_run':
      // Everyone scores, batter included
      if (third) scoringRunners.push(third);
      if (second) scoringRunners.push(second);
      if (first) scoringRunners.push(first);
      scoringRunners.push(batter);
      break;

    case 'triple':
      // Everyone scores, batter to third
      if (third) scoringRunners.push(third);
      if (second) scoringRunners.push(second);
      if (first) scoringRunners.push(first);
      newThird = batter;
      break;

    case 'double':
      // Runner from third: ALWAYS scores (100%)
      // Runner from second: ALWAYS scores (100%)
      // Runner from first: Scores 90% of the time (based on speed/acceleration/reaction vs arm)
      // Batter to second
      if (third) {
        scoringRunners.push(third);
        advancementDecisions.push({
          runner: third.name,
          from: 3,
          to: 4,
          success: true,
        });
      }

      if (second) {
        // Runner from 2nd ALWAYS scores on a double
        scoringRunners.push(second);
        advancementDecisions.push({
          runner: second.name,
          from: 2,
          to: 4,
          success: true,
        });
      }

      if (first) {
        // Runner from 1st scores 90% of the time on a double
        // Modified by runner speed vs outfielder arm
        const runnerSpeed = calculateSpeedComposite(first);
        const attrDiff = runnerSpeed - outfieldArmRating;
        const scoreProb = weightedSigmoidProbability(0.90, attrDiff, SIGMOID_K);

        if (rollSuccess(scoreProb)) {
          scoringRunners.push(first);
          advancementDecisions.push({
            runner: first.name,
            from: 1,
            to: 4,
            success: true,
          });
        } else {
          // Held at third
          newThird = first;
          advancementDecisions.push({
            runner: first.name,
            from: 1,
            to: 3,
            success: true,
          });
        }
      }

      newSecond = batter;
      break;

    case 'single':
      // Runner from third: ALWAYS scores (100%)
      // Runner from second: Scores 60% of the time (based on speed vs arm)
      // Runner from first: Advances to 3rd 25% of the time (otherwise to 2nd)
      // Batter to first
      if (third) {
        // Runner from 3rd ALWAYS scores on a single
        scoringRunners.push(third);
        advancementDecisions.push({
          runner: third.name,
          from: 3,
          to: 4,
          success: true,
        });
      }

      if (second) {
        // Runner from 2nd scores 60% of the time on a single
        // Modified by runner speed vs outfielder arm
        const runnerSpeed = calculateSpeedComposite(second);
        const attrDiff = runnerSpeed - outfieldArmRating;
        const scoreProb = weightedSigmoidProbability(0.60, attrDiff, SIGMOID_K);

        if (rollSuccess(scoreProb)) {
          scoringRunners.push(second);
          advancementDecisions.push({
            runner: second.name,
            from: 2,
            to: 4,
            success: true,
          });
        } else {
          // Held at third
          newThird = second;
          advancementDecisions.push({
            runner: second.name,
            from: 2,
            to: 3,
            success: true,
          });
        }
      }

      if (first) {
        // Runner from 1st advances to 3rd 25% of the time on a single
        // Otherwise advances to 2nd
        // Modified by runner speed vs outfielder arm
        const runnerSpeed = calculateSpeedComposite(first);
        const attrDiff = runnerSpeed - outfieldArmRating;
        const toThirdProb = weightedSigmoidProbability(0.25, attrDiff, SIGMOID_K);

        if (rollSuccess(toThirdProb) && !newThird) {
          // Advances to third
          newThird = first;
          advancementDecisions.push({
            runner: first.name,
            from: 1,
            to: 3,
            success: true,
          });
        } else {
          // Advances to second
          newSecond = first;
          advancementDecisions.push({
            runner: first.name,
            from: 1,
            to: 2,
            success: true,
          });
        }
      }

      newFirst = batter;
      break;
  }

  return {
    newBaseState: [newFirst, newSecond, newThird],
    runsScored: scoringRunners.length,
    scoringRunners,
    runnersOut,
    debug: { advancementDecisions },
  };
}

// =============================================================================
// TAG-UP PLAYS
// =============================================================================

export interface TagUpResult {
  /** Whether runner attempted to tag */
  attempted: boolean;
  /** Whether tag-up was successful */
  success: boolean;
  /** Base runner advanced to */
  newBase: 3 | 4;
  /** Debug info */
  debug: {
    runnerSpeed: number;
    outfielderArm: number;
    flyBallDepth: number;
    tagUpProbability: number;
  };
}

/**
 * Attempt tag-up on fly ball
 *
 * @param runner - Runner tagging up
 * @param outfielderArmRating - Outfielder's arm composite
 * @param flyBallDepth - How deep the fly ball was (0-1)
 * @param fromBase - Base runner is on (2 or 3)
 * @returns Tag-up result
 */
export function attemptTagUp(
  runner: Player,
  outfielderArmRating: number,
  flyBallDepth: number,
  fromBase: 2 | 3
): TagUpResult {
  const runnerSpeed = calculateSpeedComposite(runner);
  const runnerAggression = calculateAggressionComposite(runner);

  // Deeper fly = easier tag
  // Scoring from third is easier than second-to-third
  const depthBonus = flyBallDepth * 30; // Up to +30 for warning track
  const distanceModifier = fromBase === 3 ? 1.0 : 0.7; // Harder to advance 2nd to 3rd

  const effectiveRunner = runnerSpeed * 0.6 + runnerAggression * 0.4 + depthBonus;
  const attrDiff = effectiveRunner - outfielderArmRating;

  const baseRate = fromBase === 3 ? BASE_RATE_SAC_FLY_SUCCESS : 0.60;
  const tagUpProb = weightedSigmoidProbability(baseRate * distanceModifier, attrDiff, SIGMOID_K);

  const debug = {
    runnerSpeed,
    outfielderArm: outfielderArmRating,
    flyBallDepth,
    tagUpProbability: tagUpProb,
  };

  // Decide if tag should be attempted
  // Don't attempt if probability too low
  const shouldAttempt = tagUpProb > 0.50 || (fromBase === 3 && tagUpProb > 0.35);

  if (!shouldAttempt) {
    return {
      attempted: false,
      success: false,
      newBase: fromBase === 3 ? 4 : 3,
      debug,
    };
  }

  const success = rollSuccess(tagUpProb);
  return {
    attempted: true,
    success,
    newBase: fromBase === 3 ? 4 : 3,
    debug,
  };
}

// =============================================================================
// RUNNER SCOUTING
// =============================================================================

/**
 * Get baserunning scouting report for a player
 */
export function getRunnerScoutingReport(player: Player): {
  speed: { value: number; grade: string };
  stealing: { value: number; grade: string };
  aggression: { value: number; grade: string };
  baserunningGrade: string;
  summary: string;
} {
  const speed = calculateSpeedComposite(player);
  const stealing = calculateStealingComposite(player);
  const aggression = calculateAggressionComposite(player);

  const gradeValue = (v: number): string => {
    if (v >= 80) return 'Elite';
    if (v >= 70) return 'Above Average';
    if (v >= 55) return 'Average';
    if (v >= 40) return 'Below Average';
    return 'Poor';
  };

  const overall = (speed + stealing + aggression) / 3;
  const baserunningGrade = gradeValue(overall);

  let summary: string;
  if (stealing >= 75) {
    summary = 'Elite base stealer, major threat on the basepaths';
  } else if (speed >= 70) {
    summary = 'Fast runner who can take extra bases';
  } else if (speed <= 40) {
    summary = 'Below average speed, station-to-station baserunner';
  } else {
    summary = 'Average baserunner, occasional steal threat';
  }

  return {
    speed: { value: speed, grade: gradeValue(speed) },
    stealing: { value: stealing, grade: gradeValue(stealing) },
    aggression: { value: aggression, grade: gradeValue(aggression) },
    baserunningGrade,
    summary,
  };
}

// =============================================================================
// UTILITY: WALK/HBP BASE ADVANCEMENT
// =============================================================================

/**
 * Advance runners on walk or hit by pitch
 *
 * Runners only advance if forced.
 *
 * @param currentBases - Current base state
 * @param batter - Batter who walked/was hit
 * @returns New base state and runs scored
 */
export function advanceOnWalk(
  currentBases: BaseState,
  batter: Player
): { newBaseState: BaseState; runsScored: number; scoringRunners: Player[] } {
  const [first, second, third] = currentBases;
  let runsScored = 0;
  const scoringRunners: Player[] = [];

  let newFirst: Player | null = batter;
  let newSecond: Player | null = second;
  let newThird: Player | null = third;

  // Force runners if necessary
  if (first) {
    // First base occupied, runner forced to second
    if (second) {
      // Second occupied, runner forced to third
      if (third) {
        // Bases loaded, run scores
        scoringRunners.push(third);
        runsScored = 1;
      }
      newThird = second;
    }
    newSecond = first;
  }

  return {
    newBaseState: [newFirst, newSecond, newThird],
    runsScored,
    scoringRunners,
  };
}
