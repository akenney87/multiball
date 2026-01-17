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
    // Based on average of WEIGHTS_3PT and WEIGHTS_MIDRANGE from simulation/constants.ts
    name: 'Shooting',
    description: 'Perimeter scoring ability (3PT and midrange)',
    attributes: {
      form_technique: 0.24,
      throw_accuracy: 0.19,
      finesse: 0.18,
      hand_eye_coordination: 0.13,
      balance: 0.11,
      composure: 0.08,
      consistency: 0.05,
      agility: 0.02,
    },
  },
  {
    // Based on average of modified WEIGHTS_LAYUP and WEIGHTS_DUNK
    // Layup: finesse .30, hand_eye .15, jumping .13, balance .12, acceleration .12, core_strength .10, footwork .08
    // Dunk: jumping .40, height .30, bravery .10, determination .10, agility .05, footwork .05
    name: 'Finishing',
    description: 'Rim attacks, layups, and dunks',
    attributes: {
      jumping: 0.26,
      finesse: 0.15,
      height: 0.15,
      hand_eye_coordination: 0.08,
      footwork: 0.06,
      balance: 0.06,
      acceleration: 0.06,
      core_strength: 0.05,
      bravery: 0.05,
      determination: 0.05,
      agility: 0.03,
    },
  },
  {
    // Matches WEIGHTS_REBOUND from simulation/constants.ts exactly
    name: 'Rebounding',
    description: 'Ability to secure boards on both ends',
    attributes: {
      height: 0.20,
      awareness: 0.17,
      jumping: 0.16,
      grip_strength: 0.10,
      arm_strength: 0.09,
      core_strength: 0.08,
      footwork: 0.08,
      determination: 0.07,
      reactions: 0.05,
    },
  },
  {
    // Based on average of WEIGHTS_FIND_OPEN_TEAMMATE and WEIGHTS_BALL_HANDLING from simulation/constants.ts
    name: 'Playmaking',
    description: 'Court vision, passing, and ball handling',
    attributes: {
      hand_eye_coordination: 0.18,
      awareness: 0.25,
      creativity: 0.13,
      composure: 0.13,
      throw_accuracy: 0.08,
      teamwork: 0.10,
      agility: 0.10,
      grip_strength: 0.03,
    },
  },
  {
    // Based on average of WEIGHTS_CONTEST and WEIGHTS_STEAL_DEFENSE from simulation/constants.ts
    name: 'Defense',
    description: 'Ability to stop opponents and contest shots',
    attributes: {
      reactions: 0.25,
      agility: 0.19,
      grip_strength: 0.15,
      height: 0.13,
      awareness: 0.10,
      determination: 0.10,
      balance: 0.05,
      footwork: 0.03,
    },
  },
  {
    // Based on WEIGHTS_TRANSITION_SUCCESS from simulation/constants.ts
    name: 'Athleticism',
    description: 'Physical tools and explosiveness',
    attributes: {
      acceleration: 0.28,
      top_speed: 0.23,
      awareness: 0.17,
      agility: 0.17,
      composure: 0.10,
      hand_eye_coordination: 0.05,
    },
  },
];

// =============================================================================
// BASEBALL SKILLS
// =============================================================================

export const BASEBALL_SKILLS: SkillComposite[] = [
  {
    // Matches WEIGHTS_BATTING_CONTACT from simulation/baseball/constants.ts exactly
    name: 'Contact',
    description: 'Ability to make contact with the ball',
    attributes: {
      hand_eye_coordination: 0.30,
      form_technique: 0.15,
      reactions: 0.15,
      composure: 0.15,
      patience: 0.10,
      consistency: 0.10,
      awareness: 0.05,
    },
  },
  {
    // Matches WEIGHTS_BATTING_POWER from simulation/baseball/constants.ts exactly
    name: 'Power',
    description: 'Extra-base hit and home run ability',
    attributes: {
      core_strength: 0.35,
      arm_strength: 0.15,
      grip_strength: 0.15,
      form_technique: 0.15,
      balance: 0.10,
      height: 0.10,
    },
  },
  {
    // Matches WEIGHTS_PLATE_DISCIPLINE from simulation/baseball/constants.ts exactly
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
    // Matches WEIGHTS_STEALING from simulation/baseball/constants.ts exactly
    name: 'Speed',
    description: 'Baserunning speed and stealing ability',
    attributes: {
      acceleration: 0.30,
      top_speed: 0.25,
      reactions: 0.20,
      awareness: 0.15,
      bravery: 0.10,
    },
  },
  {
    // Matches WEIGHTS_FIELDING_INFIELD from simulation/baseball/constants.ts exactly
    name: 'Fielding',
    description: 'Defensive ability and range',
    attributes: {
      reactions: 0.25,
      agility: 0.20,
      throw_accuracy: 0.20,
      arm_strength: 0.15,
      hand_eye_coordination: 0.10,
      awareness: 0.10,
    },
  },
  {
    // Based on average of WEIGHTS_PITCHING_VELOCITY, CONTROL, and MOVEMENT from simulation/baseball/constants.ts
    name: 'Pitching',
    description: 'Pitching effectiveness and control',
    attributes: {
      arm_strength: 0.15,
      throw_accuracy: 0.15,
      deception: 0.15,
      form_technique: 0.12,
      composure: 0.10,
      finesse: 0.10,
      hand_eye_coordination: 0.08,
      core_strength: 0.08,
      consistency: 0.07,
    },
  },
];

// =============================================================================
// SOCCER SKILLS
// =============================================================================

export const SOCCER_SKILLS: SkillComposite[] = [
  {
    // Matches getShootingAccuracy() from simulation/soccer/engine/matchEngine.ts exactly
    name: 'Finishing',
    description: 'Goal scoring ability',
    attributes: {
      form_technique: 0.25,
      finesse: 0.25,
      composure: 0.20,
      balance: 0.15,
      footwork: 0.15,
    },
  },
  {
    // Matches getPlaymakingRating() from simulation/soccer/engine/matchEngine.ts exactly
    name: 'Passing',
    description: 'Distribution and vision',
    attributes: {
      creativity: 0.30,
      awareness: 0.25,
      finesse: 0.20,
      composure: 0.15,
      teamwork: 0.10,
    },
  },
  {
    // Matches getDefensiveAbility() from simulation/soccer/engine/matchEngine.ts exactly
    name: 'Defending',
    description: 'Defensive prowess and tackling',
    attributes: {
      reactions: 0.25,
      awareness: 0.25,
      bravery: 0.20,
      agility: 0.15,
      jumping: 0.10,
      determination: 0.05,
    },
  },
  {
    // Based on common position rating weights for outfield players (acceleration, speed, stamina, strength)
    name: 'Physical',
    description: 'Athletic ability and endurance',
    attributes: {
      acceleration: 0.22,
      top_speed: 0.22,
      agility: 0.18,
      stamina: 0.15,
      core_strength: 0.13,
      balance: 0.10,
    },
  },
  {
    // Based on getShotQualityRating() attributes that measure technical skill
    name: 'Technical',
    description: 'Ball control and skill moves',
    attributes: {
      footwork: 0.25,
      finesse: 0.20,
      deception: 0.20,
      form_technique: 0.15,
      creativity: 0.10,
      balance: 0.10,
    },
  },
  {
    // Based on calculateSoccerPositionOverall() GK weights from simulation/soccer/utils/positionRatings.ts
    name: 'Goalkeeping',
    description: 'Shot stopping and distribution',
    attributes: {
      reactions: 0.22,
      height: 0.18,
      agility: 0.18,
      jumping: 0.12,
      hand_eye_coordination: 0.10,
      awareness: 0.10,
      composure: 0.07,
      throw_accuracy: 0.03,
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
