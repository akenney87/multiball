/**
 * AI Player Evaluation System
 *
 * Evaluates players for AI decision-making (roster moves, scouting, tactics).
 * Week 1: Simple rating-based evaluation
 * Week 6: Add advanced factors (form, matchups, team fit)
 */

import type { Player, PlayerAttributes } from '../data/types';
import type { DecisionContext, AIConfig, PlayerEvaluation, Position } from './types';

// =============================================================================
// OVERALL RATING CALCULATION
// =============================================================================

/**
 * Calculate overall basketball rating for player
 *
 * Uses weighted average of 25 general attributes.
 * Matches basketball simulation's weighting system.
 *
 * Weights emphasize attributes most critical for basketball:
 * - Physical (40%): Height, jumping, agility, acceleration prioritized
 * - Technical (35%): Throw accuracy, hand-eye, form technique prioritized
 * - Mental (25%): Awareness, composure, consistency prioritized
 *
 * @param player - Player to evaluate
 * @returns Overall rating (0-100)
 */
export function calculateOverallRating(player: Player): number {
  const attrs = player.attributes;

  // Weighted attribute system for basketball (totals 100%)
  const weights = {
    // Physical: 38% total (12 attributes)
    grip_strength: 0.025,
    arm_strength: 0.020,
    core_strength: 0.030,
    agility: 0.040,
    acceleration: 0.035,
    top_speed: 0.030,
    jumping: 0.045,
    reactions: 0.035,
    stamina: 0.040,
    balance: 0.020,
    height: 0.045,
    durability: 0.015,
    // Mental: 29.5% total (8 attributes)
    awareness: 0.050,
    creativity: 0.035,
    determination: 0.030,
    bravery: 0.025,
    consistency: 0.040,
    composure: 0.045,
    patience: 0.025,
    teamwork: 0.045,
    // Technical: 32.5% total (6 attributes)
    hand_eye_coordination: 0.065,
    throw_accuracy: 0.080,
    form_technique: 0.065,
    finesse: 0.035,
    deception: 0.040,
    footwork: 0.040,
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
  totalScore += attrs.teamwork * weights.teamwork;
  totalScore += attrs.hand_eye_coordination * weights.hand_eye_coordination;
  totalScore += attrs.throw_accuracy * weights.throw_accuracy;
  totalScore += attrs.form_technique * weights.form_technique;
  totalScore += attrs.finesse * weights.finesse;
  totalScore += attrs.deception * weights.deception;
  totalScore += attrs.footwork * weights.footwork;

  // Round to 1 decimal place
  return Math.round(totalScore * 10) / 10;
}

// =============================================================================
// AGE FACTOR CALCULATION
// =============================================================================

/**
 * Calculate age-based value factor
 *
 * Players in prime (25-28) get 100
 * Young players (< 21) slightly penalized (still developing)
 * Old players (> 32) more heavily penalized (declining)
 *
 * @param age - Player age
 * @returns Age factor (0-100)
 */
export function calculateAgeFactor(age: number): number {
  // Prime years: 25-28
  if (age >= 25 && age <= 28) {
    return 100;
  }

  // Young players (18-24): Slight penalty for inexperience
  if (age < 25) {
    // 18 years old: 70 factor
    // 21 years old: 85 factor
    // 24 years old: 95 factor
    const yearsFromPrime = 25 - age;
    const penalty = yearsFromPrime * 4; // 4 points per year
    return Math.max(60, 100 - penalty);
  }

  // Older players (29+): Increasing penalty for age
  // 29: 95 factor
  // 32: 80 factor
  // 35: 60 factor
  // 40: 30 factor
  const yearsOverPrime = age - 28;
  const penalty = yearsOverPrime * 5; // 5 points per year (steeper decline)
  return Math.max(20, 100 - penalty);
}

// =============================================================================
// POTENTIAL FACTOR CALCULATION
// =============================================================================

/**
 * Calculate potential upside factor
 *
 * Measures gap between current category averages and potential ceilings.
 * Higher potential = more valuable to development-focused teams.
 *
 * Week 1: Simple average of category gaps
 * Week 6: Weight by personality focus (aggressive AI values potential more)
 *
 * @param player - Player to evaluate
 * @returns Potential factor (0-100, 0 = at ceiling, 100 = massive upside)
 */
export function calculatePotentialFactor(player: Player): number {
  const attrs = player.attributes;
  const potentials = player.potentials;

  if (!potentials) {
    return 0; // No potential data
  }

  // Calculate current category averages
  const physicalAttrs = [
    attrs.grip_strength, attrs.arm_strength, attrs.core_strength,
    attrs.agility, attrs.acceleration, attrs.top_speed,
    attrs.jumping, attrs.reactions, attrs.stamina,
    attrs.balance, attrs.height, attrs.durability,
  ];
  const mentalAttrs = [
    attrs.awareness, attrs.creativity, attrs.determination,
    attrs.bravery, attrs.consistency, attrs.composure, attrs.patience, attrs.teamwork,
  ];
  const technicalAttrs = [
    attrs.hand_eye_coordination, attrs.throw_accuracy, attrs.form_technique,
    attrs.finesse, attrs.deception, attrs.footwork,
  ];

  const physicalAvg = physicalAttrs.reduce((sum, val) => sum + val, 0) / physicalAttrs.length;
  const mentalAvg = mentalAttrs.reduce((sum, val) => sum + val, 0) / mentalAttrs.length;
  const technicalAvg = technicalAttrs.reduce((sum, val) => sum + val, 0) / technicalAttrs.length;

  // Calculate gaps between current averages and potential ceilings
  const physicalGap = Math.max(0, potentials.physical - physicalAvg);
  const mentalGap = Math.max(0, potentials.mental - mentalAvg);
  const technicalGap = Math.max(0, potentials.technical - technicalAvg);

  // Average gap across three categories
  const averageGap = (physicalGap + mentalGap + technicalGap) / 3;

  // Convert to 0-100 scale
  // 0 gap = 0 factor
  // 25 gap = 100 factor (maximum expected)
  const factor = (averageGap / 25) * 100;

  return Math.min(100, Math.max(0, factor));
}

// =============================================================================
// PLAYER EVALUATION
// =============================================================================

/**
 * Evaluate player for AI decision-making
 *
 * Combines multiple factors:
 * - Overall rating (current skill level)
 * - Age factor (prime vs young vs old)
 * - Potential factor (upside for development)
 * - Position fit (exact match = 100, Week 1 simplified)
 * - Value factor (contract considerations, Week 6)
 *
 * @param player - Player to evaluate
 * @param context - Decision context
 * @param config - AI configuration
 * @returns Complete player evaluation
 */
export function evaluatePlayer(
  player: Player,
  context: DecisionContext,
  config: AIConfig
): PlayerEvaluation {
  // Calculate base factors
  const overall = calculateOverallRating(player);
  const ageFactor = calculateAgeFactor(player.age);
  const potential = calculatePotentialFactor(player);

  // Position fit (Week 1: Simple 100 for exact match)
  // Week 6: Add position versatility (SF/PF interchangeable, etc.)
  const positionFit = 100;

  // Value factor (Week 1: Simple 100, no contract considerations)
  // Week 6: Factor in contract length, salary vs performance
  const valueFactor = 100;

  // Calculate composite score (weighted average)
  // Weights vary by AI personality
  let compositeScore = 0;

  if (config.personality === 'conservative') {
    // Conservative: Heavily weight current performance and age
    compositeScore =
      overall * 0.5 + // Current skill: 50%
      ageFactor * 0.3 + // Age (prefers prime): 30%
      potential * 0.1 + // Potential (low priority): 10%
      positionFit * 0.05 + // Position fit: 5%
      valueFactor * 0.05; // Value: 5%
  } else if (config.personality === 'aggressive') {
    // Aggressive: Weight potential and youth highly
    compositeScore =
      overall * 0.35 + // Current skill: 35%
      ageFactor * 0.15 + // Age (youth bonus): 15%
      potential * 0.35 + // Potential (high priority): 35%
      positionFit * 0.075 + // Position fit: 7.5%
      valueFactor * 0.075; // Value: 7.5%
  } else {
    // Balanced: Equal consideration
    compositeScore =
      overall * 0.4 + // Current skill: 40%
      ageFactor * 0.25 + // Age: 25%
      potential * 0.2 + // Potential: 20%
      positionFit * 0.075 + // Position fit: 7.5%
      valueFactor * 0.075; // Value: 7.5%
  }

  return {
    playerId: player.id,
    overall: Math.round(overall * 10) / 10,
    positionFit: Math.round(positionFit * 10) / 10,
    ageFactor: Math.round(ageFactor * 10) / 10,
    potential: Math.round(potential * 10) / 10,
    valueFactor: Math.round(valueFactor * 10) / 10,
    compositeScore: Math.round(compositeScore * 10) / 10,
  };
}

// =============================================================================
// PLAYER COMPARISON
// =============================================================================

/**
 * Compare multiple players at a position
 *
 * Filters players by position, evaluates each, and sorts by composite score.
 * Used for roster decisions, scouting priorities, and lineup selection.
 *
 * @param players - Players to compare
 * @param position - Position to filter by
 * @param context - Decision context
 * @param config - AI configuration
 * @returns Sorted evaluations (highest rated first)
 */
export function comparePlayersByPosition(
  players: Player[],
  position: Position,
  context: DecisionContext,
  config: AIConfig
): PlayerEvaluation[] {
  // Filter players by position
  const positionPlayers = players.filter((p) => p.position === position);

  // Evaluate each player
  const evaluations = positionPlayers.map((player) => evaluatePlayer(player, context, config));

  // Sort by composite score (highest first)
  evaluations.sort((a, b) => b.compositeScore - a.compositeScore);

  return evaluations;
}
