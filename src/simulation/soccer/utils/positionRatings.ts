/**
 * Soccer Position Rating Utilities
 *
 * Functions for calculating position-specific overall ratings.
 * Moved here from gameInitializer to avoid circular dependencies.
 */

import type { Player } from '../../../data/types';

/**
 * Soccer position types for overall calculation
 */
export type SoccerPositionType = 'GK' | 'CB' | 'FB' | 'CDM' | 'CM' | 'WM' | 'CAM' | 'W' | 'ST';

/**
 * Map soccer position names to position types
 * Supports L/R variants (LCB, RCB, LCM, RCM, etc.)
 */
export function getSoccerPositionType(position: string): SoccerPositionType {
  // Defensive check for undefined/null positions
  if (!position || typeof position !== 'string') {
    console.warn('[getSoccerPositionType] Invalid position:', position, '- defaulting to CM');
    return 'CM';
  }
  const pos = position.toUpperCase();

  // Goalkeeper
  if (pos === 'GK') return 'GK';

  // Center backs
  if (['CB', 'LCB', 'RCB'].includes(pos)) return 'CB';

  // Fullbacks / Wingbacks
  if (['LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'FB';

  // Defensive midfielders
  if (['CDM', 'LCDM', 'RCDM', 'DM'].includes(pos)) return 'CDM';

  // Central midfielders
  if (['CM', 'LCM', 'RCM'].includes(pos)) return 'CM';

  // Wide midfielders
  if (['LM', 'RM'].includes(pos)) return 'WM';

  // Attacking midfielders
  if (['CAM', 'AM'].includes(pos)) return 'CAM';

  // Wingers
  if (['LW', 'RW'].includes(pos)) return 'W';

  // Strikers
  if (['ST', 'LST', 'RST', 'CF'].includes(pos)) return 'ST';

  return 'CM'; // Default to central midfielder
}

/**
 * Calculate soccer position-specific overall rating
 *
 * Each position type has specific attribute weights that sum to 100%.
 * Weights are based on real-world importance of each attribute for the position.
 */
export function calculateSoccerPositionOverall(player: Player, position: string): number {
  const attrs = player.attributes;
  const posType = getSoccerPositionType(position);

  let score: number;

  switch (posType) {
    case 'GK':
      // Goalkeeper
      score = (
        attrs.grip_strength * 2 +
        attrs.arm_strength * 2 +
        attrs.core_strength * 2 +
        attrs.agility * 11 +
        attrs.acceleration * 0 +
        attrs.top_speed * 0 +
        attrs.jumping * 7 +
        attrs.reactions * 13 +
        attrs.stamina * 0 +
        attrs.balance * 4 +
        attrs.height * 13 +
        attrs.durability * 0 +
        attrs.awareness * 6 +
        attrs.creativity * 0 +
        attrs.determination * 2 +
        attrs.bravery * 3 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 6 +
        attrs.throw_accuracy * 4 +
        attrs.form_technique * 4 +
        attrs.finesse * 1 +
        attrs.deception * 1 +
        attrs.teamwork * 6 +
        attrs.footwork * 6
      ) / 100;
      break;

    case 'CB':
      // Center Back
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 13 +
        attrs.agility * 8 +
        attrs.acceleration * 6 +
        attrs.top_speed * 6 +
        attrs.jumping * 6 +
        attrs.reactions * 6 +
        attrs.stamina * 3 +
        attrs.balance * 5 +
        attrs.height * 6 +
        attrs.durability * 0 +
        attrs.awareness * 4 +
        attrs.creativity * 0 +
        attrs.determination * 3 +
        attrs.bravery * 3 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 4 +
        attrs.deception * 2 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'FB':
      // Fullback / Wingback (RB/LB/RWB/LWB)
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 7 +
        attrs.agility * 9 +
        attrs.acceleration * 10 +
        attrs.top_speed * 10 +
        attrs.jumping * 2 +
        attrs.reactions * 5 +
        attrs.stamina * 4 +
        attrs.balance * 6 +
        attrs.height * 2 +
        attrs.durability * 0 +
        attrs.awareness * 4 +
        attrs.creativity * 2 +
        attrs.determination * 3 +
        attrs.bravery * 3 +
        attrs.consistency * 2 +
        attrs.composure * 3 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 5 +
        attrs.deception * 4 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'CDM':
      // Defensive Midfielder
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 9 +
        attrs.agility * 8 +
        attrs.acceleration * 7 +
        attrs.top_speed * 5 +
        attrs.jumping * 4 +
        attrs.reactions * 6 +
        attrs.stamina * 3 +
        attrs.balance * 6 +
        attrs.height * 3 +
        attrs.durability * 0 +
        attrs.awareness * 6 +
        attrs.creativity * 2 +
        attrs.determination * 3 +
        attrs.bravery * 3 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 6 +
        attrs.deception * 4 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'CM':
      // Central Midfielder
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 5 +
        attrs.agility * 9 +
        attrs.acceleration * 7 +
        attrs.top_speed * 5 +
        attrs.jumping * 3 +
        attrs.reactions * 4 +
        attrs.stamina * 3 +
        attrs.balance * 6 +
        attrs.height * 3 +
        attrs.durability * 0 +
        attrs.awareness * 6 +
        attrs.creativity * 4 +
        attrs.determination * 3 +
        attrs.bravery * 3 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 5 +
        attrs.finesse * 8 +
        attrs.deception * 5 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'WM':
      // Wide Midfielder (LM/RM)
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 3 +
        attrs.agility * 10 +
        attrs.acceleration * 11 +
        attrs.top_speed * 11 +
        attrs.jumping * 1 +
        attrs.reactions * 4 +
        attrs.stamina * 4 +
        attrs.balance * 6 +
        attrs.height * 1 +
        attrs.durability * 0 +
        attrs.awareness * 4 +
        attrs.creativity * 4 +
        attrs.determination * 2 +
        attrs.bravery * 2 +
        attrs.consistency * 2 +
        attrs.composure * 2 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 8 +
        attrs.deception * 6 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'CAM':
      // Attacking Midfielder
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 2 +
        attrs.agility * 10 +
        attrs.acceleration * 8 +
        attrs.top_speed * 6 +
        attrs.jumping * 2 +
        attrs.reactions * 4 +
        attrs.stamina * 3 +
        attrs.balance * 6 +
        attrs.height * 2 +
        attrs.durability * 0 +
        attrs.awareness * 6 +
        attrs.creativity * 4 +
        attrs.determination * 3 +
        attrs.bravery * 2 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 6 +
        attrs.finesse * 9 +
        attrs.deception * 6 +
        attrs.teamwork * 6 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'W':
      // Winger (LW/RW)
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 2 +
        attrs.agility * 10 +
        attrs.acceleration * 11 +
        attrs.top_speed * 11 +
        attrs.jumping * 1 +
        attrs.reactions * 4 +
        attrs.stamina * 3 +
        attrs.balance * 6 +
        attrs.height * 1 +
        attrs.durability * 0 +
        attrs.awareness * 4 +
        attrs.creativity * 4 +
        attrs.determination * 3 +
        attrs.bravery * 2 +
        attrs.consistency * 2 +
        attrs.composure * 4 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 8 +
        attrs.deception * 6 +
        attrs.teamwork * 5 +
        attrs.footwork * 8
      ) / 100;
      break;

    case 'ST':
      // Striker
      score = (
        attrs.grip_strength * 0 +
        attrs.arm_strength * 0 +
        attrs.core_strength * 6 +
        attrs.agility * 7 +
        attrs.acceleration * 8 +
        attrs.top_speed * 7 +
        attrs.jumping * 5 +
        attrs.reactions * 6 +
        attrs.stamina * 2 +
        attrs.balance * 6 +
        attrs.height * 3 +
        attrs.durability * 0 +
        attrs.awareness * 4 +
        attrs.creativity * 4 +
        attrs.determination * 3 +
        attrs.bravery * 2 +
        attrs.consistency * 2 +
        attrs.composure * 6 +
        attrs.patience * 1 +
        attrs.hand_eye_coordination * 0 +
        attrs.throw_accuracy * 0 +
        attrs.form_technique * 4 +
        attrs.finesse * 7 +
        attrs.deception * 6 +
        attrs.teamwork * 3 +
        attrs.footwork * 8
      ) / 100;
      break;
  }

  return Math.round(score);
}
