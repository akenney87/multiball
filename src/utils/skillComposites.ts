/**
 * Skill Composite System
 *
 * Defines skill composites for each sport that aggregate underlying attributes
 * into meaningful, user-facing skill ratings.
 *
 * Each sport has 5 key skill composites with weighted attribute contributions.
 */

import type { PlayerAttributes } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

export type Sport = 'basketball' | 'baseball' | 'soccer';

/**
 * Definition of a skill composite
 */
export interface SkillComposite {
  /** Display name (e.g., "Shooting") */
  name: string;
  /** Brief description of what this skill represents */
  description: string;
  /** Attribute weights (must sum to 1.0) */
  attributes: Partial<Record<keyof PlayerAttributes, number>>;
}

/**
 * Calculated skill value
 */
export interface CalculatedSkill {
  name: string;
  description: string;
  value: number;
}

// =============================================================================
// BASKETBALL SKILLS
// =============================================================================

export const BASKETBALL_SKILLS: SkillComposite[] = [
  {
    name: 'Shooting',
    description: 'Ability to score from all areas of the court',
    attributes: {
      form_technique: 0.25,
      throw_accuracy: 0.25,
      finesse: 0.20,
      composure: 0.15,
      consistency: 0.15,
    },
  },
  {
    name: 'Rebounding',
    description: 'Ability to secure boards on both ends',
    attributes: {
      height: 0.25,
      jumping: 0.20,
      awareness: 0.20,
      determination: 0.15,
      grip_strength: 0.10,
      arm_strength: 0.10,
    },
  },
  {
    name: 'Playmaking',
    description: 'Court vision, passing, and ball handling',
    attributes: {
      awareness: 0.25,
      creativity: 0.25,
      throw_accuracy: 0.20,
      teamwork: 0.15,
      composure: 0.15,
    },
  },
  {
    name: 'Defense',
    description: 'Ability to stop opponents and contest shots',
    attributes: {
      reactions: 0.25,
      agility: 0.20,
      determination: 0.15,
      awareness: 0.15,
      height: 0.15,
      balance: 0.10,
    },
  },
  {
    name: 'Athleticism',
    description: 'Physical tools and explosiveness',
    attributes: {
      acceleration: 0.20,
      top_speed: 0.20,
      jumping: 0.20,
      agility: 0.20,
      stamina: 0.10,
      core_strength: 0.10,
    },
  },
];

// =============================================================================
// BASEBALL SKILLS
// =============================================================================

export const BASEBALL_SKILLS: SkillComposite[] = [
  {
    name: 'Contact',
    description: 'Ability to make contact with the ball',
    attributes: {
      hand_eye_coordination: 0.30,
      form_technique: 0.20,
      reactions: 0.20,
      composure: 0.15,
      patience: 0.15,
    },
  },
  {
    name: 'Power',
    description: 'Extra-base hit and home run ability',
    attributes: {
      core_strength: 0.35,
      arm_strength: 0.20,
      grip_strength: 0.15,
      form_technique: 0.15,
      height: 0.15,
    },
  },
  {
    name: 'Plate Discipline',
    description: 'Working counts and drawing walks',
    attributes: {
      patience: 0.35,
      awareness: 0.25,
      composure: 0.20,
      consistency: 0.10,
      determination: 0.10,
    },
  },
  {
    name: 'Fielding',
    description: 'Defensive ability and range',
    attributes: {
      reactions: 0.25,
      agility: 0.20,
      throw_accuracy: 0.20,
      arm_strength: 0.15,
      awareness: 0.10,
      hand_eye_coordination: 0.10,
    },
  },
  {
    name: 'Pitching',
    description: 'Pitching effectiveness and control',
    attributes: {
      arm_strength: 0.25,
      throw_accuracy: 0.25,
      deception: 0.20,
      composure: 0.15,
      stamina: 0.15,
    },
  },
];

// =============================================================================
// SOCCER SKILLS
// =============================================================================

export const SOCCER_SKILLS: SkillComposite[] = [
  {
    name: 'Finishing',
    description: 'Goal scoring ability',
    attributes: {
      finesse: 0.30,
      composure: 0.25,
      footwork: 0.20,
      form_technique: 0.15,
      bravery: 0.10,
    },
  },
  {
    name: 'Passing',
    description: 'Distribution and vision',
    attributes: {
      footwork: 0.25,
      awareness: 0.25,
      creativity: 0.20,
      throw_accuracy: 0.15, // Maps to passing accuracy
      composure: 0.15,
    },
  },
  {
    name: 'Defending',
    description: 'Defensive prowess and tackling',
    attributes: {
      awareness: 0.25,
      core_strength: 0.20,
      agility: 0.20,
      determination: 0.15,
      bravery: 0.10,
      reactions: 0.10,
    },
  },
  {
    name: 'Physical',
    description: 'Athletic ability and endurance',
    attributes: {
      stamina: 0.25,
      top_speed: 0.20,
      acceleration: 0.20,
      core_strength: 0.15,
      balance: 0.10,
      jumping: 0.10,
    },
  },
  {
    name: 'Technical',
    description: 'Ball control and skill moves',
    attributes: {
      footwork: 0.30,
      finesse: 0.25,
      deception: 0.20,
      hand_eye_coordination: 0.15,
      balance: 0.10,
    },
  },
];

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Get skill definitions for a sport
 */
export function getSkillsForSport(sport: Sport): SkillComposite[] {
  switch (sport) {
    case 'basketball':
      return BASKETBALL_SKILLS;
    case 'baseball':
      return BASEBALL_SKILLS;
    case 'soccer':
      return SOCCER_SKILLS;
  }
}

/**
 * Calculate a single skill composite value from player attributes
 *
 * @param attributes - Player's attribute values
 * @param skill - Skill definition with weights
 * @returns Calculated skill value (0-100)
 */
export function calculateSkillComposite(
  attributes: PlayerAttributes,
  skill: SkillComposite
): number {
  let value = 0;

  for (const [attr, weight] of Object.entries(skill.attributes)) {
    const attrValue = attributes[attr as keyof PlayerAttributes];
    if (typeof attrValue === 'number' && typeof weight === 'number') {
      value += attrValue * weight;
    }
  }

  return Math.round(value);
}

/**
 * Calculate all skill composites for a player in a specific sport
 *
 * @param attributes - Player's attribute values
 * @param sport - Sport to calculate skills for
 * @returns Array of calculated skill values
 */
export function calculateAllSkills(
  attributes: PlayerAttributes,
  sport: Sport
): CalculatedSkill[] {
  const skillDefs = getSkillsForSport(sport);

  return skillDefs.map((skill) => ({
    name: skill.name,
    description: skill.description,
    value: calculateSkillComposite(attributes, skill),
  }));
}

/**
 * Get a player's top skill for a sport
 *
 * @param attributes - Player's attribute values
 * @param sport - Sport to check
 * @returns The highest-rated skill
 */
export function getTopSkill(
  attributes: PlayerAttributes,
  sport: Sport
): CalculatedSkill {
  const skills = calculateAllSkills(attributes, sport);
  return skills.reduce((best, current) =>
    current.value > best.value ? current : best
  );
}

/**
 * Get a player's weakest skill for a sport
 *
 * @param attributes - Player's attribute values
 * @param sport - Sport to check
 * @returns The lowest-rated skill
 */
export function getWeakestSkill(
  attributes: PlayerAttributes,
  sport: Sport
): CalculatedSkill {
  const skills = calculateAllSkills(attributes, sport);
  return skills.reduce((worst, current) =>
    current.value < worst.value ? current : worst
  );
}

/**
 * Get color for a skill value (for UI display)
 *
 * @param value - Skill value (0-100)
 * @returns Color category
 */
export function getSkillColor(value: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (value >= 85) return 'excellent';
  if (value >= 70) return 'good';
  if (value >= 55) return 'average';
  return 'poor';
}
