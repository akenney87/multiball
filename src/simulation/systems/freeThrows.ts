/**
 * Basketball Simulator - Free Throws System (M3 Phase 2a)
 *
 * Handles free throw shooting mechanics and execution.
 *
 * Key Responsibilities:
 * 1. Execute free throw attempts with attribute-driven probabilities
 * 2. Apply pressure modifiers (bonus, clutch, and-1)
 * 3. Track free throw results (made/missed)
 * 4. Generate play-by-play descriptions
 *
 * Integrates with:
 * - src/systems/fouls.ts (receives free throw allocation)
 * - src/systems/possession.ts (free throw outcomes affect score)
 * - src/core/probability.ts (sigmoid formula)
 *
 * Formula (from basketball_sim.md Section 4.7):
 * - BaseRate: 40%
 * - Same attribute weights as 3PT shooting
 * - Pressure modifiers: bonus (-3%), clutch (-5%), and-1 (+5%)
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/freeThrows
 */

import { calculateComposite, sigmoid, applyConsistencyVariance } from '../core/probability';
import { SIGMOID_K } from '../constants';
import type { SimulationPlayer } from '../core/types';

// =============================================================================
// FREE THROW DATA STRUCTURES
// =============================================================================

/**
 * Result of free throw attempt(s).
 */
export interface FreeThrowResult {
  /** Name of player shooting */
  shooter: string;

  /** Number of free throws attempted */
  attempts: number;

  /** Number of free throws made */
  made: number;

  /** Points scored (sum of makes) */
  points_scored: number;

  /** List of individual results (true=made, false=missed) */
  results: boolean[];

  /** Situation: 'bonus', 'clutch', 'and_1', or 'normal' */
  situation: string;
}

// =============================================================================
// FREE THROW PROBABILITY CONSTANTS
// =============================================================================

/**
 * Base rate (from basketball_sim.md Section 4.7)
 * M4.1 RECALIBRATION: Increased from 0.50 to 0.55 to achieve NBA-realistic 75-78% team average
 * M4 validation showed 70.9% with 0.50, need +5% to reach target
 */
export const FREE_THROW_BASE_RATE = 0.55;

/**
 * Sigmoid k value for free throws (tuned for NBA realism)
 * k=0.02 (standard sigmoid) produces more realistic spread across player composites
 * For rosters with avg composite ~75: produces team FT% ~77%
 * Elite shooters (90): ~80%, Poor shooters (50): ~67%
 * Previously k=0.03 and k=0.04 were too high
 */
export const FREE_THROW_K = 0.02;

/**
 * Attribute weights (same as 3PT shooting)
 */
export const FREE_THROW_WEIGHTS: Record<string, number> = {
  form_technique: 0.25,
  throw_accuracy: 0.2,
  finesse: 0.15,
  hand_eye_coordination: 0.12,
  balance: 0.1,
  composure: 0.08,
  consistency: 0.06,
  agility: 0.04,
};

/**
 * Pressure modifiers (from FOULS_AND_INJURIES_SPEC.md)
 */
export const PRESSURE_MODIFIERS: Record<string, number> = {
  bonus: -0.03, // Slight pressure (-3%)
  clutch: -0.05, // Q4, <2 min, close game (-5%)
  and_1: 0.05, // Confidence boost (+5%)
  normal: 0.0, // No modifier
};

// =============================================================================
// FREE THROW SHOOTER CLASS
// =============================================================================

/**
 * Executes free throw attempts with NBA-realistic probabilities.
 */
export class FreeThrowShooter {
  /**
   * Execute free throw attempt(s).
   *
   * @param shooter - Player shooting free throws
   * @param attempts - Number of free throws (1, 2, or 3)
   * @param situation - 'and_1', 'bonus', 'clutch', or 'normal'
   * @param quarter - Current quarter (for clutch detection)
   * @param timeRemaining - Seconds remaining in quarter (for clutch detection)
   * @param scoreDifferential - Score difference (for clutch detection)
   * @returns FreeThrowResult with outcomes
   */
  static shootFreeThrows(
    shooter: SimulationPlayer,
    attempts: number,
    situation: string = 'normal',
    quarter: number = 1,
    timeRemaining: number = 720,
    scoreDifferential: number = 0
  ): FreeThrowResult {
    // Detect clutch situation
    const isClutch = quarter === 4 && timeRemaining <= 120 && Math.abs(scoreDifferential) <= 5;

    // Determine pressure situation
    let pressureSituation: string;
    if (isClutch) {
      pressureSituation = 'clutch';
    } else if (situation === 'and_1') {
      pressureSituation = 'and_1';
    } else if (situation === 'bonus') {
      pressureSituation = 'bonus';
    } else {
      pressureSituation = 'normal';
    }

    // Calculate free throw probability
    const ftProbability = this.calculateFreeThrowProbability(shooter, pressureSituation);

    // Shoot free throws
    const results: boolean[] = [];
    let madeCount = 0;

    for (let i = 0; i < attempts; i++) {
      // PHASE 3D: Apply consistency variance to each FT
      const ftProbWithVariance = applyConsistencyVariance(ftProbability, shooter, 'free_throw');
      const made = Math.random() < ftProbWithVariance;
      results.push(made);
      if (made) {
        madeCount += 1;
      }
    }

    return {
      shooter: shooter.name,
      attempts,
      made: madeCount,
      points_scored: madeCount, // Each FT worth 1 point
      results,
      situation: pressureSituation,
    };
  }

  /**
   * Calculate free throw success probability.
   *
   * @param shooter - Player shooting
   * @param situation - 'bonus', 'clutch', 'and_1', or 'normal'
   * @returns Probability of making free throw (0.0-1.0)
   *
   * Formula (from basketball_sim.md Section 4.7):
   *     FT_Composite = weighted_sum(shooter_attributes, FREE_THROW_WEIGHTS)
   *     P_make = BaseRate + (1 - BaseRate) * sigmoid(k * (FT_Composite - 50))
   *     P_make += Pressure_Modifier
   *     P_make = clamp(P_make, 0.0, 1.0)
   *
   * Where:
   *     BaseRate = 0.55 (55%)
   *     k = 0.02 (FREE_THROW_K)
   *     50 = league average composite (centering)
   *     Elite shooters (90+ composite) reach ~92%
   *     Average shooters (70 composite) reach ~77%
   *     Poor shooters (50 composite) reach ~65%
   */
  private static calculateFreeThrowProbability(
    shooter: SimulationPlayer,
    situation: string
  ): number {
    // Calculate attribute composite
    const ftComposite = calculateComposite(shooter, FREE_THROW_WEIGHTS);

    // M4.5 PHASE 4 DEBUG: Log actual composite being used (DISABLED for validation)
    // const shooterName = shooter.name ?? 'Unknown';
    // console.log(`DEBUG FT CALC: ${shooterName} composite=${ftComposite.toFixed(1)}, form=${(shooter.form_technique ?? 50).toFixed(1)}`);

    // Apply weighted sigmoid formula (center around league average of 50)
    // P = BaseRate + (1 - BaseRate) * sigmoid(k * (composite - 50))
    const compositeDiff = ftComposite - 50.0; // Center around league average
    const sigmoidInput = FREE_THROW_K * compositeDiff;
    const sigmoidOutput = sigmoid(sigmoidInput);

    // Weighted sigmoid: multiply by (1 - BaseRate) = 0.45
    const attributeBonus = (1.0 - FREE_THROW_BASE_RATE) * sigmoidOutput;

    // Get pressure modifier
    const pressureModifier = PRESSURE_MODIFIERS[situation] ?? 0.0;

    // Final probability
    let probability = FREE_THROW_BASE_RATE + attributeBonus + pressureModifier;

    // Clamp to valid range
    probability = Math.max(0.0, Math.min(1.0, probability));

    return probability;
  }

  /**
   * Generate play-by-play description of free throws.
   *
   * @param ftResult - Free throw result
   * @param foulType - 'shooting', 'and_1', 'bonus'
   * @param currentScore - [home_score, away_score] before free throws
   * @returns Formatted play-by-play string
   */
  static generateFreeThrowDescription(
    ftResult: FreeThrowResult,
    foulType: string,
    currentScore: [number, number]
  ): string {
    const lines: string[] = [];

    // Header
    if (foulType === 'and_1') {
      lines.push(`${ftResult.shooter} to the line for the and-1...`);
    } else if (ftResult.attempts === 3) {
      lines.push(`${ftResult.shooter} to the line for 3 free throws...`);
    } else if (ftResult.attempts === 2) {
      lines.push(`${ftResult.shooter} to the line for 2 free throws...`);
    } else {
      lines.push(`${ftResult.shooter} to the line for 1 free throw...`);
    }

    // Individual results
    for (let i = 0; i < ftResult.results.length; i++) {
      const made = ftResult.results[i];
      if (made) {
        lines.push(`  FT ${i + 1}/${ftResult.attempts}: GOOD`);
      } else {
        lines.push(`  FT ${i + 1}/${ftResult.attempts}: MISS`);
      }
    }

    // Summary
    lines.push(`${ftResult.shooter} makes ${ftResult.made}/${ftResult.attempts} from the line.`);

    return lines.join('\n');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convenience function to simulate free throw sequence.
 *
 * @param shooter - Player shooting
 * @param freeThrows - Number of free throws (1, 2, or 3)
 * @param andOne - True if this is an and-1 situation
 * @param quarter - Current quarter
 * @param timeRemaining - Seconds remaining
 * @param scoreDifferential - Score difference
 * @returns FreeThrowResult
 */
export function simulateFreeThrowSequence(
  shooter: SimulationPlayer,
  freeThrows: number,
  andOne: boolean = false,
  quarter: number = 1,
  timeRemaining: number = 720,
  scoreDifferential: number = 0
): FreeThrowResult {
  const situation = andOne ? 'and_1' : 'normal';

  return FreeThrowShooter.shootFreeThrows(
    shooter,
    freeThrows,
    situation,
    quarter,
    timeRemaining,
    scoreDifferential
  );
}
