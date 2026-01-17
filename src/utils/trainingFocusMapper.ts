/**
 * Training Focus Mapper
 *
 * Converts the new hierarchical training focus system into per-attribute
 * XP weights. Used by the training system to distribute training XP
 * based on the player's chosen focus.
 *
 * @module utils/trainingFocusMapper
 */

import type { PlayerAttributes, NewTrainingFocus, SportFocusType, SkillFocusType } from '../data/types';
import {
  BASKETBALL_SKILLS,
  BASEBALL_SKILLS,
  SOCCER_SKILLS,
  type SkillComposite,
} from './skillComposites';

// =============================================================================
// CONSTANTS
// =============================================================================

/** All 26 attributes */
const ALL_ATTRIBUTES: (keyof PlayerAttributes)[] = [
  // Physical (12)
  'grip_strength', 'arm_strength', 'core_strength', 'agility', 'acceleration',
  'top_speed', 'jumping', 'reactions', 'stamina', 'balance', 'height', 'durability',
  // Mental (8)
  'awareness', 'creativity', 'determination', 'bravery', 'consistency',
  'composure', 'patience', 'teamwork',
  // Technical (6)
  'hand_eye_coordination', 'throw_accuracy', 'form_technique', 'finesse',
  'deception', 'footwork',
];

/** Trainable attributes (excludes height which cannot be trained) */
const TRAINABLE_ATTRIBUTES = ALL_ATTRIBUTES.filter(a => a !== 'height');

// =============================================================================
// SPORT WEIGHTS (from overallRating.ts calculations)
// =============================================================================

/**
 * Basketball attribute weights (from calculateBasketballOverall)
 * These sum to 1.0 (excluding height since it's not trainable)
 */
const BASKETBALL_WEIGHTS: Record<string, number> = {
  // Physical
  grip_strength: 0.04,
  arm_strength: 0.04,
  core_strength: 0.04,
  agility: 0.05,
  acceleration: 0.05,
  top_speed: 0.01,
  jumping: 0.05,
  reactions: 0.05,
  stamina: 0.05,
  balance: 0.04,
  // height: 0.08, // Not trainable
  durability: 0.00,
  // Mental
  awareness: 0.02,
  creativity: 0.02,
  determination: 0.02,
  bravery: 0.01,
  consistency: 0.02,
  composure: 0.02,
  patience: 0.01,
  teamwork: 0.03,
  // Technical
  hand_eye_coordination: 0.07,
  throw_accuracy: 0.09,
  form_technique: 0.07,
  finesse: 0.06,
  deception: 0.02,
  footwork: 0.04,
};

/**
 * Baseball attribute weights (aggregated from all position weights)
 * Normalized to sum to 1.0 excluding height
 */
const BASEBALL_WEIGHTS: Record<string, number> = {
  // Physical - baseball heavily uses arm strength and reactions
  grip_strength: 0.04,
  arm_strength: 0.10,
  core_strength: 0.08,
  agility: 0.05,
  acceleration: 0.04,
  top_speed: 0.04,
  jumping: 0.02,
  reactions: 0.06,
  stamina: 0.04,
  balance: 0.03,
  durability: 0.02,
  // Mental - composure and awareness key for batters
  awareness: 0.04,
  creativity: 0.02,
  determination: 0.03,
  bravery: 0.02,
  consistency: 0.04,
  composure: 0.05,
  patience: 0.04,
  teamwork: 0.02,
  // Technical - hand-eye, throw accuracy, form critical
  hand_eye_coordination: 0.08,
  throw_accuracy: 0.06,
  form_technique: 0.04,
  finesse: 0.02,
  deception: 0.04,
  footwork: 0.02,
};

/**
 * Soccer attribute weights (aggregated from all position weights)
 * Normalized to sum to 1.0 excluding height
 */
const SOCCER_WEIGHTS: Record<string, number> = {
  // Physical - stamina, speed, agility crucial
  grip_strength: 0.01,
  arm_strength: 0.01,
  core_strength: 0.05,
  agility: 0.07,
  acceleration: 0.06,
  top_speed: 0.06,
  jumping: 0.04,
  reactions: 0.05,
  stamina: 0.08,
  balance: 0.04,
  durability: 0.02,
  // Mental - awareness, creativity, teamwork
  awareness: 0.06,
  creativity: 0.05,
  determination: 0.04,
  bravery: 0.03,
  consistency: 0.03,
  composure: 0.05,
  patience: 0.02,
  teamwork: 0.04,
  // Technical - footwork and finesse define soccer
  hand_eye_coordination: 0.02,
  throw_accuracy: 0.02,
  form_technique: 0.03,
  finesse: 0.05,
  deception: 0.03,
  footwork: 0.08,
};

// =============================================================================
// ADDITIONAL SKILL DEFINITIONS
// =============================================================================

// Note: Speed and Goalkeeping skills are now defined in skillComposites.ts
// with weights matching simulation constants

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get attribute weights for a training focus
 * Returns a map of attribute name -> weight (all weights sum to 1.0)
 *
 * @param focus - The training focus configuration
 * @returns Record of attribute weights
 */
export function getAttributeWeights(focus: NewTrainingFocus): Record<string, number> {
  switch (focus.level) {
    case 'balanced':
      return getBalancedWeights();
    case 'sport':
      if (!focus.sport) return getBalancedWeights();
      return getSportWeights(focus.sport);
    case 'skill':
      if (!focus.skill) return getBalancedWeights();
      return getSkillWeights(focus.skill);
    default:
      return getBalancedWeights();
  }
}

/**
 * Get balanced weights - even distribution across all trainable attributes
 */
export function getBalancedWeights(): Record<string, number> {
  const weight = 1 / TRAINABLE_ATTRIBUTES.length;
  const weights: Record<string, number> = {};
  for (const attr of TRAINABLE_ATTRIBUTES) {
    weights[attr] = weight;
  }
  return weights;
}

/**
 * Get sport-specific weights
 */
export function getSportWeights(sport: SportFocusType): Record<string, number> {
  let baseWeights: Record<string, number>;

  switch (sport) {
    case 'basketball':
      baseWeights = BASKETBALL_WEIGHTS;
      break;
    case 'baseball':
      baseWeights = BASEBALL_WEIGHTS;
      break;
    case 'soccer':
      baseWeights = SOCCER_WEIGHTS;
      break;
    default:
      return getBalancedWeights();
  }

  // Normalize to ensure weights sum to 1.0 (excluding height)
  return normalizeWeights(baseWeights);
}

/**
 * Get skill-specific weights based on skill composite definition
 */
export function getSkillWeights(skillFocus: SkillFocusType): Record<string, number> {
  const skillDef = findSkillDefinition(skillFocus);
  if (!skillDef) {
    // Fallback to sport weights if skill not found
    return getSportWeights(skillFocus.sport);
  }

  // Convert skill attributes to full attribute weights
  const weights: Record<string, number> = {};

  // Initialize all trainable attributes to 0
  for (const attr of TRAINABLE_ATTRIBUTES) {
    weights[attr] = 0;
  }

  // Apply skill weights
  for (const [attr, weight] of Object.entries(skillDef.attributes)) {
    if (attr !== 'height' && weight !== undefined) {
      weights[attr] = weight;
    }
  }

  // Normalize to ensure they sum to 1.0
  return normalizeWeights(weights);
}

/**
 * Find skill definition by sport and skill name
 */
function findSkillDefinition(skillFocus: SkillFocusType): SkillComposite | undefined {
  const { sport, skill } = skillFocus;

  // Get skill composites for sport (all skills now defined in skillComposites.ts)
  let skills: SkillComposite[];
  switch (sport) {
    case 'basketball':
      skills = BASKETBALL_SKILLS;
      break;
    case 'baseball':
      skills = BASEBALL_SKILLS;
      break;
    case 'soccer':
      skills = SOCCER_SKILLS;
      break;
    default:
      return undefined;
  }

  return skills.find(s => s.name === skill);
}

/**
 * Normalize weights to ensure they sum to 1.0
 */
function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  // Filter out height and zero weights, then calculate sum
  let sum = 0;
  for (const [attr, weight] of Object.entries(weights)) {
    if (attr !== 'height' && weight > 0) {
      sum += weight;
    }
  }

  if (sum === 0) {
    return getBalancedWeights();
  }

  // Normalize
  const normalized: Record<string, number> = {};
  for (const attr of TRAINABLE_ATTRIBUTES) {
    const weight = weights[attr] ?? 0;
    normalized[attr] = weight / sum;
  }

  return normalized;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get list of available skills for a sport
 */
export function getSkillsForSport(sport: SportFocusType): string[] {
  switch (sport) {
    case 'basketball':
      return ['Shooting', 'Finishing', 'Rebounding', 'Playmaking', 'Defense', 'Athleticism'];
    case 'baseball':
      return ['Contact', 'Power', 'Plate Discipline', 'Speed', 'Fielding', 'Pitching'];
    case 'soccer':
      return ['Finishing', 'Passing', 'Defending', 'Physical', 'Technical', 'Goalkeeping'];
    default:
      return [];
  }
}

/**
 * Get display name for a training focus
 */
export function getTrainingFocusDisplayName(focus: NewTrainingFocus): string {
  switch (focus.level) {
    case 'balanced':
      return 'Balanced';
    case 'sport':
      if (!focus.sport) return 'Balanced';
      return focus.sport.charAt(0).toUpperCase() + focus.sport.slice(1);
    case 'skill':
      if (!focus.skill) return 'Balanced';
      return `${focus.skill.skill} (${focus.skill.sport.charAt(0).toUpperCase() + focus.skill.sport.slice(1)})`;
    default:
      return 'Balanced';
  }
}

/**
 * Create a default balanced training focus
 */
export function createBalancedFocus(): NewTrainingFocus {
  return { level: 'balanced' };
}

/**
 * Create a sport-level training focus
 */
export function createSportFocus(sport: SportFocusType): NewTrainingFocus {
  return { level: 'sport', sport };
}

/**
 * Create a skill-level training focus
 */
export function createSkillFocus(sport: SportFocusType, skill: string): NewTrainingFocus {
  return {
    level: 'skill',
    sport,
    skill: { sport, skill } as SkillFocusType,
  };
}
