/**
 * Overall Rating Calculations
 *
 * Provides multiple overall rating calculations:
 * 1. Simple average of all attributes (sport-neutral)
 * 2. Basketball-weighted overall
 * 3. Baseball-weighted overall (average across all positions)
 * 4. Soccer-weighted overall (average across all positions)
 *
 * @module utils/overallRating
 */

import type { Player, PlayerAttributes } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

export interface SportOveralls {
  /** Simple average of all 26 attributes */
  overall: number;
  /** Basketball-weighted overall */
  basketball: number;
  /** Baseball overall (average of all position ratings) */
  baseball: number;
  /** Soccer overall (average of all position ratings) */
  soccer: number;
}

// =============================================================================
// ATTRIBUTE LISTS
// =============================================================================

const PHYSICAL_ATTRS: (keyof PlayerAttributes)[] = [
  'grip_strength', 'arm_strength', 'core_strength', 'agility', 'acceleration',
  'top_speed', 'jumping', 'reactions', 'stamina', 'balance', 'height', 'durability',
];

const MENTAL_ATTRS: (keyof PlayerAttributes)[] = [
  'awareness', 'creativity', 'determination', 'bravery',
  'consistency', 'composure', 'patience', 'teamwork',
];

const TECHNICAL_ATTRS: (keyof PlayerAttributes)[] = [
  'hand_eye_coordination', 'throw_accuracy', 'form_technique',
  'finesse', 'deception', 'footwork',
];

const ALL_ATTRS = [...PHYSICAL_ATTRS, ...MENTAL_ATTRS, ...TECHNICAL_ATTRS];

// =============================================================================
// SIMPLE OVERALL (Average of all attributes)
// =============================================================================

/**
 * Calculate simple overall as average of all 26 attributes
 */
export function calculateSimpleOverall(attrs: PlayerAttributes): number {
  let sum = 0;
  for (const attr of ALL_ATTRS) {
    sum += attrs[attr] ?? 0;
  }
  return Math.round(sum / ALL_ATTRS.length);
}

// =============================================================================
// BASKETBALL OVERALL
// =============================================================================

/**
 * Basketball-weighted overall using percentage weights (sum to 100%)
 */
export function calculateBasketballOverall(attrs: PlayerAttributes): number {
  const score =
    // Physical
    attrs.grip_strength * 0.04 +
    attrs.arm_strength * 0.04 +
    attrs.core_strength * 0.04 +
    attrs.agility * 0.05 +
    attrs.acceleration * 0.05 +
    attrs.top_speed * 0.01 +
    attrs.jumping * 0.05 +
    attrs.reactions * 0.05 +
    attrs.stamina * 0.05 +
    attrs.balance * 0.04 +
    attrs.height * 0.08 +
    attrs.durability * 0.00 +
    // Mental
    attrs.awareness * 0.02 +
    attrs.creativity * 0.02 +
    attrs.determination * 0.02 +
    attrs.bravery * 0.01 +
    attrs.consistency * 0.02 +
    attrs.composure * 0.02 +
    attrs.patience * 0.01 +
    // Technical
    attrs.hand_eye_coordination * 0.07 +
    attrs.throw_accuracy * 0.09 +
    attrs.form_technique * 0.07 +
    attrs.finesse * 0.06 +
    attrs.deception * 0.02 +
    attrs.teamwork * 0.03 +
    attrs.footwork * 0.04;

  return Math.round(score);
}

// =============================================================================
// BASEBALL POSITION OVERALLS
// =============================================================================

export type BaseballPositionType = 'P' | 'C' | '1B' | '2B' | 'SS' | '3B' | 'LF' | 'CF' | 'RF' | 'DH';
type BaseballPosition = BaseballPositionType;

export const BASEBALL_POSITIONS: BaseballPositionType[] = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'];

/**
 * Calculate baseball position-specific overall
 */
export function calculateBaseballPositionOverall(attrs: PlayerAttributes, position: BaseballPosition): number {
  let score: number;
  let divisor: number;

  switch (position) {
    case 'P': // Pitcher
      score =
        attrs.arm_strength * 2.5 +
        attrs.throw_accuracy * 2.0 +
        attrs.stamina * 1.5 +
        attrs.composure * 1.5 +
        attrs.deception * 1.5 +
        attrs.form_technique * 1.0 +
        attrs.consistency * 1.0 +
        attrs.durability * 0.5;
      divisor = 11.5;
      break;

    case 'C': // Catcher
      score =
        attrs.durability * 2.0 +
        attrs.reactions * 2.0 +
        attrs.arm_strength * 1.5 +
        attrs.awareness * 1.5 +
        attrs.composure * 1.0 +
        attrs.grip_strength * 1.0 +
        attrs.agility * 0.5 +
        attrs.bravery * 0.5;
      divisor = 10.0;
      break;

    case '1B': // First Base
      score =
        attrs.grip_strength * 2.0 +
        attrs.reactions * 1.5 +
        attrs.height * 1.5 +
        attrs.hand_eye_coordination * 1.5 +
        attrs.balance * 1.0 +
        attrs.footwork * 0.5;
      divisor = 8.0;
      break;

    case '2B': // Second Base
      score =
        attrs.agility * 2.0 +
        attrs.reactions * 2.0 +
        attrs.throw_accuracy * 1.5 +
        attrs.footwork * 1.5 +
        attrs.top_speed * 1.0 +
        attrs.awareness * 1.0 +
        attrs.acceleration * 0.5;
      divisor = 9.5;
      break;

    case 'SS': // Shortstop
      score =
        attrs.agility * 2.0 +
        attrs.reactions * 2.0 +
        attrs.arm_strength * 1.5 +
        attrs.throw_accuracy * 1.5 +
        attrs.top_speed * 1.0 +
        attrs.awareness * 1.0 +
        attrs.footwork * 1.0 +
        attrs.acceleration * 0.5;
      divisor = 10.5;
      break;

    case '3B': // Third Base
      score =
        attrs.reactions * 2.5 +
        attrs.arm_strength * 2.0 +
        attrs.bravery * 1.5 +
        attrs.grip_strength * 1.0 +
        attrs.throw_accuracy * 1.0 +
        attrs.balance * 0.5;
      divisor = 8.5;
      break;

    case 'LF': // Left Field
    case 'RF': // Right Field
      score =
        attrs.arm_strength * 2.0 +
        attrs.top_speed * 1.5 +
        attrs.reactions * 1.5 +
        attrs.acceleration * 1.0 +
        attrs.throw_accuracy * 1.0 +
        attrs.awareness * 0.5 +
        attrs.jumping * 0.5;
      divisor = 8.0;
      break;

    case 'CF': // Center Field
      score =
        attrs.top_speed * 2.5 +
        attrs.acceleration * 2.0 +
        attrs.agility * 1.5 +
        attrs.reactions * 1.5 +
        attrs.awareness * 1.0 +
        attrs.jumping * 0.5;
      divisor = 9.0;
      break;

    case 'DH': // Designated Hitter (batting only)
      score =
        attrs.hand_eye_coordination * 2.5 +
        attrs.composure * 2.0 +
        attrs.patience * 1.5 +
        attrs.grip_strength * 1.5 +
        attrs.consistency * 1.0 +
        attrs.form_technique * 1.0;
      divisor = 9.5;
      break;
  }

  return Math.round(score / divisor);
}

/**
 * Calculate baseball overall as average of all position ratings
 */
export function calculateBaseballOverall(attrs: PlayerAttributes): number {
  let sum = 0;
  for (const pos of BASEBALL_POSITIONS) {
    sum += calculateBaseballPositionOverall(attrs, pos);
  }
  return Math.round(sum / BASEBALL_POSITIONS.length);
}

// =============================================================================
// SOCCER POSITION OVERALLS
// =============================================================================

type SoccerPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';

const SOCCER_POSITIONS: SoccerPosition[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

/**
 * Calculate soccer position-specific overall
 *
 * Key attributes for soccer:
 * - footwork: Technical ball control, passing, shooting accuracy
 * - finesse: Finishing, first touch, skill moves
 * - deception: Dribbling, feints, unpredictability
 * - awareness: Positioning, reading the game
 * - composure: Decision making under pressure
 */
function calculateSoccerPositionOverall(attrs: PlayerAttributes, position: SoccerPosition): number {
  let score: number;
  let divisor: number;

  switch (position) {
    case 'GK': // Goalkeeper
      score =
        attrs.reactions * 2.5 +
        attrs.jumping * 2.0 +
        attrs.agility * 1.5 +
        attrs.composure * 1.5 +
        attrs.awareness * 1.5 +
        attrs.bravery * 1.0 +
        attrs.arm_strength * 1.0 +  // Distribution
        attrs.height * 1.0 +
        attrs.durability * 0.5;
      divisor = 12.5;
      break;

    case 'CB': // Center Back
      score =
        attrs.awareness * 2.0 +
        attrs.jumping * 2.0 +
        attrs.core_strength * 1.5 +
        attrs.determination * 1.5 +
        attrs.bravery * 1.5 +
        attrs.footwork * 1.0 +      // Ball playing ability
        attrs.balance * 1.0 +
        attrs.height * 1.0 +
        attrs.top_speed * 0.5;
      divisor = 12.0;
      break;

    case 'LB': // Left Back
    case 'RB': // Right Back
      score =
        attrs.stamina * 2.0 +
        attrs.top_speed * 2.0 +
        attrs.acceleration * 1.5 +
        attrs.footwork * 1.5 +      // Crossing, passing
        attrs.awareness * 1.0 +
        attrs.determination * 1.0 +
        attrs.agility * 1.0 +
        attrs.balance * 0.5;
      divisor = 10.5;
      break;

    case 'CDM': // Defensive Midfielder
      score =
        attrs.awareness * 2.0 +
        attrs.stamina * 2.0 +
        attrs.footwork * 1.5 +      // Passing, tackling technique
        attrs.determination * 1.5 +
        attrs.composure * 1.5 +
        attrs.core_strength * 1.0 +
        attrs.teamwork * 1.0 +
        attrs.balance * 0.5;
      divisor = 11.0;
      break;

    case 'CM': // Central Midfielder
      score =
        attrs.stamina * 2.0 +
        attrs.footwork * 2.0 +      // Passing, ball control
        attrs.awareness * 1.5 +
        attrs.composure * 1.5 +
        attrs.teamwork * 1.5 +
        attrs.creativity * 1.0 +
        attrs.agility * 0.5 +
        attrs.determination * 0.5;
      divisor = 10.5;
      break;

    case 'CAM': // Attacking Midfielder
      score =
        attrs.creativity * 2.5 +
        attrs.footwork * 2.0 +      // Passing, through balls
        attrs.finesse * 1.5 +       // First touch, shooting
        attrs.awareness * 1.5 +
        attrs.composure * 1.5 +
        attrs.agility * 1.0 +
        attrs.deception * 0.5;
      divisor = 10.5;
      break;

    case 'LM': // Left Midfielder
    case 'RM': // Right Midfielder
      score =
        attrs.stamina * 2.0 +
        attrs.footwork * 1.5 +      // Crossing, passing
        attrs.top_speed * 1.5 +
        attrs.creativity * 1.5 +
        attrs.teamwork * 1.5 +
        attrs.agility * 1.0 +
        attrs.acceleration * 1.0 +
        attrs.awareness * 0.5;
      divisor = 10.5;
      break;

    case 'LW': // Left Winger
    case 'RW': // Right Winger
      score =
        attrs.acceleration * 2.0 +
        attrs.top_speed * 2.0 +
        attrs.agility * 1.5 +
        attrs.deception * 1.5 +     // Dribbling, skill moves
        attrs.finesse * 1.5 +       // Crossing, shooting
        attrs.footwork * 1.0 +      // Ball control
        attrs.creativity * 1.0;
      divisor = 10.5;
      break;

    case 'ST': // Striker
      score =
        attrs.finesse * 2.5 +       // Finishing, shooting
        attrs.composure * 2.0 +     // Clinical in front of goal
        attrs.footwork * 1.5 +      // First touch, control
        attrs.acceleration * 1.5 +
        attrs.deception * 1.0 +     // Movement, feints
        attrs.jumping * 1.0 +       // Aerial ability
        attrs.bravery * 0.5;
      divisor = 10.0;
      break;
  }

  return Math.round(score / divisor);
}

/**
 * Calculate soccer overall as average of all position ratings
 */
export function calculateSoccerOverall(attrs: PlayerAttributes): number {
  let sum = 0;
  for (const pos of SOCCER_POSITIONS) {
    sum += calculateSoccerPositionOverall(attrs, pos);
  }
  return Math.round(sum / SOCCER_POSITIONS.length);
}

// =============================================================================
// COMBINED CALCULATION
// =============================================================================

/**
 * Calculate all overall ratings for a player
 */
export function calculateAllOveralls(player: Player): SportOveralls {
  const attrs = player.attributes;
  return {
    overall: calculateSimpleOverall(attrs),
    basketball: calculateBasketballOverall(attrs),
    baseball: calculateBaseballOverall(attrs),
    soccer: calculateSoccerOverall(attrs),
  };
}

/**
 * Calculate all overall ratings from attributes directly
 * Accepts either PlayerAttributes or Record<string, number> for flexibility
 */
export function calculateAllOverallsFromAttrs(attrs: PlayerAttributes | Record<string, number>): SportOveralls {
  // Cast to PlayerAttributes - assumes all required keys exist
  const typedAttrs = attrs as PlayerAttributes;
  return {
    overall: calculateSimpleOverall(typedAttrs),
    basketball: calculateBasketballOverall(typedAttrs),
    baseball: calculateBaseballOverall(typedAttrs),
    soccer: calculateSoccerOverall(typedAttrs),
  };
}
