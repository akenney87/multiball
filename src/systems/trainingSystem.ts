/**
 * Training System
 *
 * Manages weekly training progression for players.
 * - Attribute improvement based on training focus
 * - Soft caps tied to category potentials
 * - Age-based multipliers (young players improve faster)
 * - Playing time bonus (game experience accelerates learning)
 * - Team-wide or per-player customization
 *
 * Design Philosophy:
 * - Simple defaults (team-wide training)
 * - Optional depth (per-player customization)
 * - Soft caps based on hidden potentials
 * - Linear XP cost prevents runaway growth
 *
 * New Training Focus System (v2):
 * - Balanced: Even distribution across all trainable attributes
 * - Sport: Train attributes weighted by sport overall impact
 * - Skill: Train attributes weighted by specific skill composite
 */

import {
  type TrainingFocus as TrainingFocusType,
  type NewTrainingFocus,
  isNewTrainingFocus,
} from '../data/types';
import { getAttributeWeights, createBalancedFocus } from '../utils/trainingFocusMapper';

/**
 * Training focus allocation (percentages must sum to 100)
 * @deprecated Use NewTrainingFocus from types.ts instead
 */
export interface TrainingFocus {
  physical: number;   // 0-100%
  mental: number;     // 0-100%
  technical: number;  // 0-100%
}

/**
 * Weekly XP earned per category
 */
export interface WeeklyXP {
  physical: number;
  mental: number;
  technical: number;
}

/**
 * Category potentials (hidden from user)
 */
export interface CategoryPotentials {
  physical: number;    // Max potential for physical attributes (0-100)
  mental: number;      // Max potential for mental attributes (0-100)
  technical: number;   // Max potential for technical attributes (0-100)
}

/**
 * Training result showing improvements
 */
export interface TrainingResult {
  playerName: string;
  xpEarned: WeeklyXP;
  improvements: AttributeImprovement[];
  totalImprovements: number;
}

/**
 * Individual attribute improvement
 */
export interface AttributeImprovement {
  attributeName: string;
  oldValue: number;
  newValue: number;
  xpProgress: number;    // XP toward next improvement
  xpRequired: number;    // XP needed for next improvement
}

// Training constants
export const BASE_XP_PER_WEEK = 15;           // Base XP earned per week
export const MAX_PLAYING_TIME_BONUS = 0.5;    // +50% max bonus from playing time
export const PLAYING_TIME_FOR_MAX_BONUS = 1000; // Minutes needed for max bonus

// Default team-wide training focus (balanced)
export const DEFAULT_TRAINING_FOCUS: TrainingFocus = {
  physical: 33,
  mental: 33,
  technical: 34,
};

// Age multipliers (younger players improve faster)
export const AGE_MULTIPLIERS = {
  young: 1.5,      // Age < 23
  prime: 1.0,      // Age 23-27
  veteran: 0.7,    // Age 28-31
  aging: 0.5,      // Age >= 32
};

// Soft cap multipliers
export const SOFT_CAP_MULTIPLIER = 2.0;      // 2x harder when at potential
export const HARD_CAP_MULTIPLIER = 5.0;      // 5x harder when 10+ over potential

// Physical attributes (12 total)
export const PHYSICAL_ATTRIBUTES = [
  'grip_strength',
  'arm_strength',
  'core_strength',
  'agility',
  'acceleration',
  'top_speed',
  'jumping',
  'reactions',
  'stamina',
  'balance',
  'height',
  'durability',
];

// Mental attributes (8 total)
export const MENTAL_ATTRIBUTES = [
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
  'teamwork',
];

// Technical attributes (6 total)
export const TECHNICAL_ATTRIBUTES = [
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'footwork',
];

/**
 * Validates training focus allocation
 *
 * @param focus - Training focus percentages
 * @returns Validation result with errors
 */
export function validateTrainingFocus(focus: TrainingFocus): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check each category is 0-100
  if (focus.physical < 0 || focus.physical > 100) {
    errors.push('Physical focus must be between 0% and 100%');
  }
  if (focus.mental < 0 || focus.mental > 100) {
    errors.push('Mental focus must be between 0% and 100%');
  }
  if (focus.technical < 0 || focus.technical > 100) {
    errors.push('Technical focus must be between 0% and 100%');
  }

  // Check total equals 100
  const total = focus.physical + focus.mental + focus.technical;
  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Training focus must sum to 100% (currently ${total.toFixed(1)}%)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets age multiplier for training progression
 *
 * @param age - Player age
 * @returns Age multiplier (0.5x to 1.5x)
 */
export function getAgeMultiplier(age: number): number {
  if (age < 23) return AGE_MULTIPLIERS.young;
  if (age < 28) return AGE_MULTIPLIERS.prime;
  if (age < 32) return AGE_MULTIPLIERS.veteran;
  return AGE_MULTIPLIERS.aging;
}

/**
 * Calculates playing time bonus
 *
 * @param minutesPlayed - Minutes played this week
 * @returns Bonus multiplier (1.0 to 1.5)
 */
export function calculatePlayingTimeBonus(minutesPlayed: number): number {
  const bonus = Math.min(MAX_PLAYING_TIME_BONUS, minutesPlayed / PLAYING_TIME_FOR_MAX_BONUS);
  return 1.0 + bonus;
}

/**
 * Calculates weekly XP earned for each category
 *
 * @param trainingFocus - Training focus percentages
 * @param trainingQualityMultiplier - From budget allocation (0.5x to 2.0x)
 * @param age - Player age
 * @param minutesPlayed - Minutes played this week
 * @returns Weekly XP earned per category
 */
export function calculateWeeklyXP(
  trainingFocus: TrainingFocus,
  trainingQualityMultiplier: number,
  age: number,
  minutesPlayed: number
): WeeklyXP {
  const baseXP = BASE_XP_PER_WEEK;
  const ageMultiplier = getAgeMultiplier(age);
  const playingTimeMultiplier = calculatePlayingTimeBonus(minutesPlayed);

  // Total multiplier
  const totalMultiplier = trainingQualityMultiplier * ageMultiplier * playingTimeMultiplier;

  return {
    physical: (baseXP * totalMultiplier * trainingFocus.physical) / 100,
    mental: (baseXP * totalMultiplier * trainingFocus.mental) / 100,
    technical: (baseXP * totalMultiplier * trainingFocus.technical) / 100,
  };
}

/**
 * Calculates XP required to improve an attribute
 *
 * Implements soft cap system:
 * - Below potential: currentValue × 1
 * - At potential: currentValue × 2 (2x harder)
 * - 10+ over potential: currentValue × 5 (5x harder)
 *
 * With BASE_XP_PER_WEEK = 15 and balanced training:
 * - Young player (~9 XP/week/category) improves 30-rated attr in ~3 weeks
 * - Over a 40-week season, expect ~12-18 total attribute points for young players
 *
 * @param currentValue - Current attribute value
 * @param potential - Category potential
 * @returns XP required for next improvement
 */
export function calculateXPRequired(currentValue: number, potential: number): number {
  const baseXP = currentValue * 1;

  if (currentValue >= potential + 10) {
    // Hard cap (10+ over potential)
    return baseXP * HARD_CAP_MULTIPLIER;
  } else if (currentValue >= potential) {
    // Soft cap (at or above potential)
    return baseXP * SOFT_CAP_MULTIPLIER;
  }

  // Below potential (normal progression)
  return baseXP;
}

/**
 * Gets the category for a given attribute
 *
 * @param attributeName - Attribute name
 * @returns Category name ('physical', 'mental', or 'technical')
 */
export function getAttributeCategory(attributeName: string): 'physical' | 'mental' | 'technical' | null {
  if (PHYSICAL_ATTRIBUTES.includes(attributeName)) return 'physical';
  if (MENTAL_ATTRIBUTES.includes(attributeName)) return 'mental';
  if (TECHNICAL_ATTRIBUTES.includes(attributeName)) return 'technical';
  return null;
}

/**
 * Applies weekly training to a player's attributes
 *
 * @param currentAttributes - Player's current attribute values
 * @param currentXP - Player's current XP progress per category
 * @param weeklyXP - XP earned this week
 * @param potentials - Player's category potentials
 * @returns Updated attributes and XP progress
 */
export function applyWeeklyTraining(
  currentAttributes: Record<string, number>,
  currentXP: WeeklyXP,
  weeklyXP: WeeklyXP,
  potentials: CategoryPotentials
): {
  updatedAttributes: Record<string, number>;
  updatedXP: WeeklyXP;
  improvements: AttributeImprovement[];
} {
  const updatedAttributes = { ...currentAttributes };
  const updatedXP = {
    physical: currentXP.physical + weeklyXP.physical,
    mental: currentXP.mental + weeklyXP.mental,
    technical: currentXP.technical + weeklyXP.technical,
  };
  const improvements: AttributeImprovement[] = [];

  // Process each category
  const categories: Array<'physical' | 'mental' | 'technical'> = ['physical', 'mental', 'technical'];

  for (const category of categories) {
    const attributes = category === 'physical' ? PHYSICAL_ATTRIBUTES
      : category === 'mental' ? MENTAL_ATTRIBUTES
      : TECHNICAL_ATTRIBUTES;

    const potential = potentials[category];

    // Try to improve attributes in this category
    for (const attrName of attributes) {
      if (!(attrName in updatedAttributes)) continue;

      const currentValue = updatedAttributes[attrName];
      if (currentValue === undefined) continue;

      const xpRequired = calculateXPRequired(currentValue, potential);

      // Check if we can improve this attribute
      if (updatedXP[category] >= xpRequired) {
        const oldValue = currentValue;
        const newValue = Math.min(100, currentValue + 1); // Cap at 100

        updatedAttributes[attrName] = newValue;
        updatedXP[category] -= xpRequired;

        improvements.push({
          attributeName: attrName,
          oldValue,
          newValue,
          xpProgress: updatedXP[category],
          xpRequired: calculateXPRequired(newValue, potential),
        });

        // Only improve one attribute per category per week
        break;
      }
    }
  }

  return {
    updatedAttributes,
    updatedXP,
    improvements,
  };
}

/**
 * Simulates a full training week for a player
 *
 * @param playerName - Player name
 * @param currentAttributes - Current attribute values
 * @param currentXP - Current XP progress
 * @param trainingFocus - Training focus percentages
 * @param trainingQualityMultiplier - Budget allocation multiplier
 * @param potentials - Category potentials
 * @param age - Player age
 * @param minutesPlayed - Minutes played this week
 * @returns Training result with improvements
 */
export function simulateTrainingWeek(
  playerName: string,
  currentAttributes: Record<string, number>,
  currentXP: WeeklyXP,
  trainingFocus: TrainingFocus,
  trainingQualityMultiplier: number,
  potentials: CategoryPotentials,
  age: number,
  minutesPlayed: number
): TrainingResult {
  // Calculate XP earned
  const xpEarned = calculateWeeklyXP(
    trainingFocus,
    trainingQualityMultiplier,
    age,
    minutesPlayed
  );

  // Apply training (updatedAttributes and updatedXP are handled by caller)
  const { improvements } = applyWeeklyTraining(
    currentAttributes,
    currentXP,
    xpEarned,
    potentials
  );

  return {
    playerName,
    xpEarned,
    improvements,
    totalImprovements: improvements.length,
  };
}

// =============================================================================
// NEW PER-ATTRIBUTE TRAINING SYSTEM
// =============================================================================

/**
 * Per-attribute XP tracking for new training system
 */
export interface AttributeXP {
  [attributeName: string]: number;
}

/**
 * Training result for per-attribute system
 */
export interface PerAttributeTrainingResult {
  playerName: string;
  xpEarnedPerAttribute: AttributeXP;
  improvements: AttributeImprovement[];
  totalImprovements: number;
}

/** Trainable attributes (excludes height) */
const TRAINABLE_ATTRIBUTES = [
  ...PHYSICAL_ATTRIBUTES.filter(a => a !== 'height'),
  ...MENTAL_ATTRIBUTES,
  ...TECHNICAL_ATTRIBUTES,
];

/**
 * Converts any training focus to the new format
 * Handles backwards compatibility with legacy format
 */
export function normalizeTrainingFocus(focus: TrainingFocusType | TrainingFocus | null): NewTrainingFocus {
  if (!focus) {
    return createBalancedFocus();
  }

  // Check if it's already new format
  if (isNewTrainingFocus(focus as TrainingFocusType)) {
    return focus as NewTrainingFocus;
  }

  // Legacy format - convert to balanced (since we can't map physical/mental/technical to the new system)
  return createBalancedFocus();
}

/**
 * Calculates per-attribute XP earned based on new training focus
 *
 * @param focus - Training focus (new or legacy format)
 * @param trainingQualityMultiplier - From budget allocation (0.5x to 2.0x)
 * @param age - Player age
 * @param minutesPlayed - Minutes played this week
 * @returns XP earned per attribute
 */
export function calculatePerAttributeXP(
  focus: TrainingFocusType | TrainingFocus | null,
  trainingQualityMultiplier: number,
  age: number,
  minutesPlayed: number
): AttributeXP {
  const normalizedFocus = normalizeTrainingFocus(focus);

  // Calculate total XP
  const baseXP = BASE_XP_PER_WEEK;
  const ageMultiplier = getAgeMultiplier(age);
  const playingTimeMultiplier = calculatePlayingTimeBonus(minutesPlayed);
  const totalXP = baseXP * trainingQualityMultiplier * ageMultiplier * playingTimeMultiplier;

  // Get attribute weights from focus
  const weights = getAttributeWeights(normalizedFocus);

  // Distribute XP according to weights
  const xpPerAttribute: AttributeXP = {};
  for (const attr of TRAINABLE_ATTRIBUTES) {
    const weight = weights[attr] ?? 0;
    xpPerAttribute[attr] = totalXP * weight;
  }

  return xpPerAttribute;
}

/**
 * Applies per-attribute training to a player's attributes
 *
 * @param currentAttributes - Player's current attribute values
 * @param currentXP - Player's current XP progress per attribute
 * @param weeklyXP - XP earned this week per attribute
 * @param potentials - Player's category potentials
 * @returns Updated attributes and XP progress
 */
export function applyPerAttributeTraining(
  currentAttributes: Record<string, number>,
  currentXP: AttributeXP,
  weeklyXP: AttributeXP,
  potentials: CategoryPotentials
): {
  updatedAttributes: Record<string, number>;
  updatedXP: AttributeXP;
  improvements: AttributeImprovement[];
} {
  const updatedAttributes = { ...currentAttributes };
  const updatedXP: AttributeXP = { ...currentXP };
  const improvements: AttributeImprovement[] = [];

  // Add weekly XP to accumulated XP
  for (const attr of TRAINABLE_ATTRIBUTES) {
    updatedXP[attr] = (updatedXP[attr] ?? 0) + (weeklyXP[attr] ?? 0);
  }

  // Try to improve each attribute
  for (const attrName of TRAINABLE_ATTRIBUTES) {
    if (!(attrName in updatedAttributes)) continue;

    const currentValue = updatedAttributes[attrName];
    if (currentValue === undefined) continue;

    const category = getAttributeCategory(attrName);
    if (!category) continue;

    const potential = potentials[category];
    const xpRequired = calculateXPRequired(currentValue, potential);
    const attrXP = updatedXP[attrName] ?? 0;

    // Check if we can improve this attribute
    if (attrXP >= xpRequired) {
      const oldValue = currentValue;
      const newValue = Math.min(100, currentValue + 1); // Cap at 100

      updatedAttributes[attrName] = newValue;
      updatedXP[attrName] = attrXP - xpRequired;

      improvements.push({
        attributeName: attrName,
        oldValue,
        newValue,
        xpProgress: updatedXP[attrName] ?? 0,
        xpRequired: calculateXPRequired(newValue, potential),
      });
    }
  }

  return {
    updatedAttributes,
    updatedXP,
    improvements,
  };
}

/**
 * Converts per-attribute XP to category-based WeeklyXP for compatibility
 */
export function convertToWeeklyXP(attributeXP: AttributeXP): WeeklyXP {
  let physical = 0;
  let mental = 0;
  let technical = 0;

  for (const [attr, xp] of Object.entries(attributeXP)) {
    const category = getAttributeCategory(attr);
    if (category === 'physical') physical += xp;
    else if (category === 'mental') mental += xp;
    else if (category === 'technical') technical += xp;
  }

  return { physical, mental, technical };
}

/**
 * Initializes per-attribute XP tracking from legacy WeeklyXP
 * Distributes category XP evenly across attributes in that category
 */
export function initializeAttributeXP(weeklyXP: WeeklyXP): AttributeXP {
  const attributeXP: AttributeXP = {};

  // Distribute physical XP
  const physicalAttrs = PHYSICAL_ATTRIBUTES.filter(a => a !== 'height');
  const physicalXPPerAttr = weeklyXP.physical / physicalAttrs.length;
  for (const attr of physicalAttrs) {
    attributeXP[attr] = physicalXPPerAttr;
  }

  // Distribute mental XP
  const mentalXPPerAttr = weeklyXP.mental / MENTAL_ATTRIBUTES.length;
  for (const attr of MENTAL_ATTRIBUTES) {
    attributeXP[attr] = mentalXPPerAttr;
  }

  // Distribute technical XP
  const technicalXPPerAttr = weeklyXP.technical / TECHNICAL_ATTRIBUTES.length;
  for (const attr of TECHNICAL_ATTRIBUTES) {
    attributeXP[attr] = technicalXPPerAttr;
  }

  return attributeXP;
}
