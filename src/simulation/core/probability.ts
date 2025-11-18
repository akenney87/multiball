/**
 * Basketball Simulator - Probability Engine
 *
 * Core probability calculations using weighted sigmoid formulas.
 * All dice-roll mechanics flow through this module.
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/core/probability
 */

import seedrandom from 'seedrandom';
import { SIGMOID_K, CONSISTENCY_VARIANCE_SCALE, STAMINA_THRESHOLD, STAMINA_DEGRADATION_POWER, STAMINA_DEGRADATION_SCALE, ALL_ATTRIBUTES } from '../constants';

/**
 * Random number generator instance
 * Use seedrandom for deterministic randomness (validation requirement)
 */
let rng: (() => number) = Math.random;

/**
 * Logistic sigmoid function
 *
 * @param x - Input value
 * @returns 1 / (1 + exp(-x))
 *
 * Handles extreme values to prevent overflow.
 */
export function sigmoid(x: number): number {
  // Prevent overflow for extreme values
  if (x > 100) return 1.0;
  if (x < -100) return 0.0;

  try {
    return 1.0 / (1.0 + Math.exp(-x));
  } catch (error) {
    // Fallback for edge cases
    return x < 0 ? 0.0 : 1.0;
  }
}

/**
 * Calculate weighted attribute composite for a player
 *
 * @param player - Player object with all attributes
 * @param attributeWeights - Object mapping attribute names to weights (must sum to 1.0)
 * @returns Weighted average composite score (typically 1-100 range)
 *
 * @example
 * ```typescript
 * const weights = { form_technique: 0.25, throw_accuracy: 0.20, ... };
 * const composite = calculateComposite(curry, weights);
 * // Returns ~90.0 for elite shooter
 * ```
 */
export function calculateComposite(
  player: Record<string, number>,
  attributeWeights: Record<string, number>
): number {
  let composite = 0.0;

  for (const [attribute, weight] of Object.entries(attributeWeights)) {
    if (!(attribute in player)) {
      throw new Error(
        `Player ${(player as any).name || 'Unknown'} missing attribute '${attribute}'`
      );
    }

    const value = player[attribute];
    if (typeof value !== 'number') {
      throw new Error(
        `Player ${(player as any).name || 'Unknown'} attribute '${attribute}' is not a number`
      );
    }

    composite += value * weight;
  }

  return composite;
}

/**
 * Calculate offensive and defensive composites, then compute difference
 *
 * @param offensivePlayer - Offensive player object
 * @param defensivePlayer - Defensive player object
 * @param offensiveWeights - Attribute weights for offense
 * @param defensiveWeights - Attribute weights for defense
 * @returns Tuple of [offensiveComposite, defensiveComposite, attributeDiff]
 */
export function calculateAttributeDiff(
  offensivePlayer: Record<string, number>,
  defensivePlayer: Record<string, number>,
  offensiveWeights: Record<string, number>,
  defensiveWeights: Record<string, number>
): [number, number, number] {
  const offensiveComposite = calculateComposite(offensivePlayer, offensiveWeights);
  const defensiveComposite = calculateComposite(defensivePlayer, defensiveWeights);
  const attributeDiff = offensiveComposite - defensiveComposite;

  return [offensiveComposite, defensiveComposite, attributeDiff];
}

/**
 * Core probability formula using CENTERED weighted sigmoid
 *
 * Formula:
 *   centered = (sigmoid(k * AttributeDiff) - 0.5) * 2.0  // Range: -1 to +1
 *   if centered >= 0:
 *     P = BaseRate + (1 - BaseRate) * centered
 *   else:
 *     P = BaseRate * (1 + centered)
 *
 * At diff=0: sigmoid=0.5, centered=0, P=BaseRate (CORRECT)
 *
 * @param baseRate - Base success probability (e.g., 0.30 for 3PT)
 * @param attributeDiff - Offensive composite - Defensive composite
 * @param k - Sigmoid steepness (default from constants)
 * @returns Final probability in [0, 1]
 *
 * @example
 * ```typescript
 * // Equal players (diff=0)
 * weightedSigmoidProbability(0.30, 0, 0.02); // 0.30 - Base rate (correct)
 *
 * // Elite shooter (90) vs poor defender (30), 3PT shot
 * weightedSigmoidProbability(0.30, 60, 0.02); // ~0.72 - Higher success
 *
 * // Poor shooter (30) vs elite defender (90), 3PT shot
 * weightedSigmoidProbability(0.30, -60, 0.02); // ~0.09 - Lower success
 * ```
 *
 * TODO (Agent 4): Validate this formula produces IDENTICAL outputs to Python version
 * with same inputs and same random seed.
 */
export function weightedSigmoidProbability(
  baseRate: number,
  attributeDiff: number,
  k: number = SIGMOID_K
): number {
  // Cap attribute difference to prevent extreme outcomes
  // Even All-99 vs All-1 should produce realistic basketball outcomes
  // ±40 cap prevents probabilities from reaching 0% or 100%
  const cappedDiff = Math.max(-40.0, Math.min(40.0, attributeDiff));

  // Calculate sigmoid
  const sigmoidInput = k * cappedDiff;
  const sigmoidOutput = sigmoid(sigmoidInput);

  // Center sigmoid around base_rate
  // When diff=0: sigmoid=0.5, centered=0, probability=base_rate
  const centered = (sigmoidOutput - 0.5) * 2.0; // Range: -1 to +1

  let probability: number;
  if (centered >= 0) {
    // Positive advantage: scale toward 1.0
    probability = baseRate + (1.0 - baseRate) * centered;
  } else {
    // Negative advantage: scale toward 0.0
    probability = baseRate * (1.0 + centered);
  }

  // Apply realistic floor (5%) and ceiling (95%)
  // No shot should be impossible (0%) or guaranteed (100%) in basketball
  probability = Math.max(0.05, Math.min(0.95, probability));

  return probability;
}

/**
 * Roll weighted dice to determine success/failure
 *
 * @param probability - Success probability in [0, 1]
 * @returns True if successful, False otherwise
 */
export function rollSuccess(probability: number): boolean {
  if (probability < 0.0 || probability > 1.0) {
    throw new Error(`Probability ${probability} out of range [0, 1]`);
  }

  return rng() < probability;
}

/**
 * Apply consistency-based variance to final probability
 *
 * PHASE 3D: Consistency attribute affects variance in all probability rolls.
 * High consistency = tight variance (predictable)
 * Low consistency = wide variance (boom-or-bust)
 *
 * @param baseProbability - Base probability before variance (0.0-1.0)
 * @param player - Player object with 'consistency' attribute
 * @param actionType - Type of action (for future expansion, currently unused)
 * @returns Final probability with variance applied, clamped to [0,1]
 *
 * Formula:
 *   variance_scale = abs((consistency - 50) * CONSISTENCY_VARIANCE_SCALE)
 *   variance = random.uniform(-variance_scale, variance_scale)
 *   final_prob = base_probability + variance
 *   return clamp(final_prob, 0.0, 1.0)
 *
 * @example
 * ```typescript
 * // consistency=90, base=0.70 → final in [0.692, 0.708] (±0.8%)
 * // consistency=50, base=0.70 → final = 0.70 (±0%, baseline)
 * // consistency=10, base=0.70 → final in [0.620, 0.780] (±8%)
 * ```
 */
export function applyConsistencyVariance(
  baseProbability: number,
  player: Record<string, number>,
  _actionType: string = 'general'
): number {
  const consistency = player.consistency ?? 50;

  // Calculate variance scale based on consistency
  // High consistency (>50) = tight variance (±0.8% at 90)
  // Low consistency (<50) = wide variance (±8% at 10)
  // Use different scales for above/below baseline
  const distanceFromBaseline = Math.abs(consistency - 50);

  let varianceScale: number;
  if (consistency >= 50) {
    // High consistency: small scale (0.0002)
    varianceScale = distanceFromBaseline * CONSISTENCY_VARIANCE_SCALE;
  } else {
    // Low consistency: large scale (0.002 = 10x more variance)
    varianceScale = distanceFromBaseline * (CONSISTENCY_VARIANCE_SCALE * 10);
  }

  // Generate random variance within scale
  const variance = (rng() * 2 - 1) * varianceScale; // Uniform in [-varianceScale, varianceScale]

  // Apply variance to base probability
  const finalProb = baseProbability + variance;

  // Clamp to valid probability range [0, 1]
  return Math.max(0.0, Math.min(1.0, finalProb));
}

/**
 * Select item from list using weighted probabilities
 *
 * @param items - List of items to choose from
 * @param weights - Corresponding weights (need not sum to 1, will be normalized)
 * @returns Selected item
 * @throws Error if items/weights lengths don't match or weights are invalid
 */
export function weightedRandomChoice<T>(items: T[], weights: number[]): T {
  if (items.length !== weights.length) {
    throw new Error(
      `Items (${items.length}) and weights (${weights.length}) must have same length`
    );
  }

  if (items.length === 0) {
    throw new Error('Cannot choose from empty list');
  }

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    throw new Error(`Total weight must be positive, got ${totalWeight}`);
  }

  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Cumulative distribution
  const cumulative: number[] = [];
  let cumsum = 0.0;
  for (const w of normalizedWeights) {
    cumsum += w;
    cumulative.push(cumsum);
  }

  // Roll and select
  const roll = rng();
  for (let i = 0; i < cumulative.length; i++) {
    const threshold = cumulative[i];
    if (threshold !== undefined && roll <= threshold) {
      const selected = items[i];
      if (selected === undefined) {
        throw new Error('Selected item is undefined');
      }
      return selected;
    }
  }

  // Fallback (should never reach due to normalization)
  const lastItem = items[items.length - 1];
  if (lastItem === undefined) {
    throw new Error('Cannot select from empty array');
  }
  return lastItem;
}

/**
 * Normalize probabilities to sum to 1.0
 *
 * @param probabilities - Object mapping outcomes to probabilities
 * @returns Normalized object
 *
 * @example
 * ```typescript
 * normalizeProbabilities({ '3pt': 0.42, 'mid': 0.18, 'rim': 0.38 });
 * // Returns { '3pt': 0.43, 'mid': 0.18, 'rim': 0.39 } - Adjusted to sum to 1.0
 * ```
 */
export function normalizeProbabilities(
  probabilities: Record<string, number>
): Record<string, number> {
  const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);

  if (total <= 0) {
    throw new Error(`Total probability must be positive, got ${total}`);
  }

  const normalized: Record<string, number> = {};
  for (const [outcome, prob] of Object.entries(probabilities)) {
    normalized[outcome] = prob / total;
  }

  return normalized;
}

/**
 * Apply modifier to base probability
 *
 * @param baseProbability - Starting probability
 * @param modifier - Modifier value
 * @param modifierType - 'additive' (+modifier) or 'multiplicative' (*modifier)
 * @returns Modified probability, clamped to [0, 1]
 */
export function applyModifier(
  baseProbability: number,
  modifier: number,
  modifierType: 'additive' | 'multiplicative' = 'additive'
): number {
  let result: number;

  if (modifierType === 'additive') {
    result = baseProbability + modifier;
  } else if (modifierType === 'multiplicative') {
    result = baseProbability * modifier;
  } else {
    throw new Error(`Invalid modifier_type: ${modifierType}`);
  }

  return Math.max(0.0, Math.min(1.0, result));
}

/**
 * Set random seed for reproducibility (debug mode)
 *
 * @param seed - Random seed value (string or number)
 *
 * TODO (Agent 4): Validate that same seed produces identical sequences
 * in TypeScript (seedrandom) vs Python (random.seed)
 */
export function setSeed(seed: string | number): void {
  const prng = seedrandom(seed.toString());
  rng = () => prng();
}

/**
 * Reset to default random number generator (no seed)
 */
export function resetRandom(): void {
  rng = Math.random;
}

/**
 * Calculate attribute degradation penalty from stamina depletion
 *
 * Formula (Section 11.4):
 *   if stamina >= 80: penalty = 0
 *   if stamina < 80: penalty = 0.002 * (80 - stamina) ** 1.3
 *
 * @param currentStamina - Current stamina value (0-100)
 * @returns Penalty as decimal (e.g., 0.098 = 9.8% degradation)
 *
 * @example
 * ```typescript
 * calculateStaminaPenalty(80);  // 0.0 - At threshold
 * calculateStaminaPenalty(60);  // 0.036 - ~3.6% penalty
 * calculateStaminaPenalty(40);  // 0.098 - ~9.8% penalty
 * calculateStaminaPenalty(20);  // 0.192 - ~19.2% penalty
 * ```
 */
export function calculateStaminaPenalty(currentStamina: number): number {
  if (currentStamina >= STAMINA_THRESHOLD) {
    return 0.0;
  }

  const staminaDeficit = STAMINA_THRESHOLD - currentStamina;
  const penalty = STAMINA_DEGRADATION_SCALE * Math.pow(staminaDeficit, STAMINA_DEGRADATION_POWER);

  return Math.min(penalty, 1.0); // Cap at 100% degradation
}

/**
 * Create a copy of player with stamina degradation applied to all attributes
 *
 * @param player - Original player object
 * @param currentStamina - Current stamina level (0-100)
 * @returns New player object with degraded attributes
 *
 * Note: Does NOT modify original player object (functional approach).
 */
export function applyStaminaToPlayer(
  player: Record<string, number>,
  currentStamina: number
): Record<string, number> {
  const penalty = calculateStaminaPenalty(currentStamina);

  if (penalty === 0.0) {
    return player; // No degradation, return original
  }

  // Create copy with degraded attributes
  const degradedPlayer = { ...player };

  for (const attribute of ALL_ATTRIBUTES) {
    if (attribute in player) {
      const originalValue = player[attribute];
      if (typeof originalValue === 'number') {
        const degradedValue = originalValue * (1.0 - penalty);
        degradedPlayer[attribute] = Math.max(1.0, degradedValue); // Floor at 1
      }
    }
  }

  // Store current stamina in the degraded player for tracking
  degradedPlayer['current_stamina'] = currentStamina;

  return degradedPlayer;
}

/**
 * Calculate gentle rubber band modifier based on score differential
 *
 * Applies a small bonus to the trailing team when behind by significant margins.
 * This helps prevent runaway blowouts while maintaining realism. The bonus
 * automatically reverts as the score gets closer.
 *
 * M4.9: AGGRESSIVE rubber-band to reduce blowout rate from 37% to target 15-20%.
 * Previous moderate bonuses (17.5%/12.5%/7.5%) had minimal impact.
 *
 * Now using very aggressive bonuses to force comeback attempts:
 * - Trailing by 18+: +50% bonus (dramatic)
 * - Trailing by 13-17: +35% bonus (strong)
 * - Trailing by 8-12: +25% bonus (significant)
 * - Trailing by <8: No bonus (0%)
 *
 * @param scoreDifferential - Absolute point difference (always positive)
 * @param teamIsTrailing - True if this team is behind, False if winning/tied
 * @returns Modifier to apply (0.0 to 0.50)
 *
 * @example
 * ```typescript
 * // If trailing team shoots with 50% success rate and trailing by 18:
 * // Base rate: 0.50
 * // Modifier: +0.50 (50%)
 * // Adjusted rate: 1.00 (100% - clamped)
 * ```
 *
 * Note: Bonus only applies to trailing team. Leading team gets NO penalty.
 * These aggressive bonuses create artificial "momentum swings" to prevent
 * runaway blowouts while maintaining attribute-driven base gameplay.
 */
export function calculateRubberBandModifier(
  scoreDifferential: number,
  teamIsTrailing: boolean
): number {
  // No bonus if not trailing or differential is small
  if (!teamIsTrailing || scoreDifferential < 8) {
    return 0.0;
  }

  // Apply tiered bonuses (M4.9: VERY aggressive to force comebacks)
  if (scoreDifferential >= 18) {
    return 0.50; // +50% bonus (extreme deficit - nearly guaranteed makes)
  } else if (scoreDifferential >= 13) {
    return 0.35; // +35% bonus (large deficit - strong boost)
  } else {
    // 8-12 point deficit
    return 0.25; // +25% bonus (moderate deficit - solid boost)
  }
}
