/**
 * Player Progression System
 *
 * Manages age-based attribute regression for players past their peak.
 * - Category-specific peak ages (Physical: 26, Technical: 28, Mental: 30)
 * - Probabilistic weekly regression checks
 * - Regression chance increases with age
 * - Regression amount weighted toward -1 point
 * - Creates realistic career arcs
 *
 * Design Philosophy:
 * - Gradual, probabilistic decline (not sudden cliff)
 * - Older players decline faster
 * - Different categories peak at different ages
 * - Regression doesn't affect potential values (only current attributes)
 * - Apply regression before training within same week
 */

import { getAttributeCategory } from './trainingSystem';
import type { Player, YouthPhysicalDevelopment } from '../data/types';
import {
  processYouthGrowth,
  getStrengthRange,
} from '../data/factories';

/**
 * Category peak ages
 */
export interface CategoryPeakAges {
  physical: number;
  technical: number;
  mental: number;
}

/**
 * Regression check result for a single attribute
 */
export interface AttributeRegressionResult {
  attributeName: string;
  regressed: boolean;
  oldValue: number;
  newValue: number;
  regressionAmount: number;
}

/**
 * Weekly regression result for a player
 */
export interface WeeklyRegressionResult {
  playerName: string;
  age: number;
  regressions: AttributeRegressionResult[];
  totalRegressions: number;
}

/**
 * Regression probability calculation result
 */
export interface RegressionProbability {
  category: 'physical' | 'mental' | 'technical';
  age: number;
  peakAge: number;
  yearsOverPeak: number;
  regressionChance: number;
  shouldRegress: boolean;
}

// Peak age constants
export const PEAK_AGES: CategoryPeakAges = {
  physical: 26,   // Peak at 26, decline starts at 30
  technical: 28,  // Peak at 28, decline starts at 32
  mental: 30,     // Peak at 30, decline starts at 34
};

// Regression constants
export const BASE_REGRESSION_CHANCE = 0.05;      // 5% base chance
export const REGRESSION_CHANCE_PER_YEAR = 0.03;  // +3% per year over peak (reduced from 5% for realism)
export const MAX_REGRESSION_CHANCE = 0.40;       // Cap at 40% to prevent catastrophic decline
export const DECLINE_START_OFFSET = 4;           // Decline starts 4 years after peak

// Regression amount weights (total = 100)
export const REGRESSION_AMOUNT_WEIGHTS = {
  one: 60,    // 60% chance of -1 point
  two: 30,    // 30% chance of -2 points
  three: 10,  // 10% chance of -3 points
};

// Attribute floor (minimum value to prevent unrealistic decline)
export const ATTRIBUTE_FLOOR = 30;  // Elite athletes maintain baseline competency

/**
 * Gets peak age for a category
 *
 * @param category - Attribute category
 * @returns Peak age
 */
export function getPeakAge(category: 'physical' | 'mental' | 'technical'): number {
  return PEAK_AGES[category];
}

/**
 * Calculates years over peak for regression calculation
 *
 * @param age - Player age
 * @param peakAge - Category peak age
 * @returns Years over peak (0 if not declining yet)
 */
export function calculateYearsOverPeak(age: number, peakAge: number): number {
  const declineStartAge = peakAge + DECLINE_START_OFFSET;
  if (age <= declineStartAge) {
    return 0;
  }
  return age - declineStartAge;
}

/**
 * Calculates regression chance for a category
 *
 * Formula: regressionChance = 5% + (yearsOverPeak × 3%)
 * Capped at 40% to prevent catastrophic decline
 *
 * @param age - Player age
 * @param peakAge - Category peak age
 * @returns Regression chance (0.0 to 0.40)
 */
export function calculateRegressionChance(age: number, peakAge: number): number {
  const yearsOverPeak = calculateYearsOverPeak(age, peakAge);
  if (yearsOverPeak === 0) {
    return 0.0;
  }

  const chance = BASE_REGRESSION_CHANCE + (yearsOverPeak * REGRESSION_CHANCE_PER_YEAR);
  return Math.min(MAX_REGRESSION_CHANCE, chance); // Cap at MAX_REGRESSION_CHANCE
}

/**
 * Generates a weighted random regression amount (1-3 points)
 *
 * Weighted toward 1 point:
 * - 60% chance: -1 point
 * - 30% chance: -2 points
 * - 10% chance: -3 points
 *
 * @param seed - Random seed
 * @returns Regression amount (1-3)
 */
export function generateRegressionAmount(seed: number): number {
  const random = (Math.abs(Math.sin(seed)) % 1) * 100;

  if (random < REGRESSION_AMOUNT_WEIGHTS.one) {
    return 1;
  } else if (random < REGRESSION_AMOUNT_WEIGHTS.one + REGRESSION_AMOUNT_WEIGHTS.two) {
    return 2;
  } else {
    return 3;
  }
}

/**
 * Checks if regression should occur for a category
 *
 * @param age - Player age
 * @param category - Attribute category
 * @param seed - Random seed for probabilistic check
 * @returns Regression probability details
 */
export function checkRegressionProbability(
  age: number,
  category: 'physical' | 'mental' | 'technical',
  seed: number
): RegressionProbability {
  const peakAge = getPeakAge(category);
  const yearsOverPeak = calculateYearsOverPeak(age, peakAge);
  const regressionChance = calculateRegressionChance(age, peakAge);

  // Probabilistic check
  const random = Math.abs(Math.sin(seed)) % 1;
  const shouldRegress = random < regressionChance;

  return {
    category,
    age,
    peakAge,
    yearsOverPeak,
    regressionChance,
    shouldRegress,
  };
}

/**
 * Applies regression to a single attribute
 *
 * @param attributeName - Attribute name
 * @param currentValue - Current attribute value
 * @param regressionAmount - Amount to regress (1-3 points)
 * @returns Regression result
 */
export function applyAttributeRegression(
  attributeName: string,
  currentValue: number,
  regressionAmount: number
): AttributeRegressionResult {
  // Apply floor to prevent unrealistic decline
  const newValue = Math.max(ATTRIBUTE_FLOOR, currentValue - regressionAmount);

  return {
    attributeName,
    regressed: true,
    oldValue: currentValue,
    newValue,
    regressionAmount,
  };
}

/**
 * Processes weekly regression for a player
 *
 * Checks each attribute category for regression and applies to random attribute if triggered
 *
 * @param playerName - Player name
 * @param age - Player age
 * @param currentAttributes - Current attribute values
 * @param seed - Random seed for determinism
 * @returns Weekly regression result
 */
export function processWeeklyRegression(
  playerName: string,
  age: number,
  currentAttributes: Record<string, number>,
  seed: number
): WeeklyRegressionResult {
  const regressions: AttributeRegressionResult[] = [];

  // Check each category for regression
  const categories: Array<'physical' | 'mental' | 'technical'> = ['physical', 'mental', 'technical'];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const categorySeed = seed + i * 1000;

    // Check if this category should regress
    const probability = checkRegressionProbability(age, category, categorySeed);

    if (probability.shouldRegress) {
      // Find all attributes in this category
      const categoryAttributes = Object.keys(currentAttributes).filter(attrName => {
        const attrCategory = getAttributeCategory(attrName);
        return attrCategory === category;
      });

      if (categoryAttributes.length > 0) {
        // Pick a random attribute from this category
        const attrIndex = Math.floor((Math.abs(Math.sin(categorySeed * 2)) % 1) * categoryAttributes.length);
        const selectedAttr = categoryAttributes[attrIndex];

        // Generate regression amount
        const regressionAmount = generateRegressionAmount(categorySeed * 3);

        // Apply regression
        const result = applyAttributeRegression(
          selectedAttr,
          currentAttributes[selectedAttr],
          regressionAmount
        );

        regressions.push(result);

        // Update the attribute in the record
        currentAttributes[selectedAttr] = result.newValue;
      }
    }
  }

  return {
    playerName,
    age,
    regressions,
    totalRegressions: regressions.length,
  };
}

/**
 * Applies weekly regression and returns updated attributes
 *
 * @param currentAttributes - Current attribute values
 * @param age - Player age
 * @param seed - Random seed
 * @returns Updated attributes and regression results
 */
export function applyWeeklyRegression(
  currentAttributes: Record<string, number>,
  age: number,
  seed: number
): {
  updatedAttributes: Record<string, number>;
  regressions: AttributeRegressionResult[];
} {
  const attributes = { ...currentAttributes };
  const regressions: AttributeRegressionResult[] = [];

  const categories: Array<'physical' | 'mental' | 'technical'> = ['physical', 'mental', 'technical'];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const categorySeed = seed + i * 1000;

    const probability = checkRegressionProbability(age, category, categorySeed);

    if (probability.shouldRegress) {
      const categoryAttributes = Object.keys(attributes).filter(attrName => {
        const attrCategory = getAttributeCategory(attrName);
        return attrCategory === category;
      });

      if (categoryAttributes.length > 0) {
        const attrIndex = Math.floor((Math.abs(Math.sin(categorySeed * 2)) % 1) * categoryAttributes.length);
        const selectedAttr = categoryAttributes[attrIndex];
        const regressionAmount = generateRegressionAmount(categorySeed * 3);

        const result = applyAttributeRegression(
          selectedAttr,
          attributes[selectedAttr],
          regressionAmount
        );

        regressions.push(result);
        attributes[selectedAttr] = result.newValue;
      }
    }
  }

  return {
    updatedAttributes: attributes,
    regressions,
  };
}

/**
 * Checks if a player is past peak in any category
 *
 * @param age - Player age
 * @returns Object indicating which categories are past peak
 */
export function getCategoryDeclineStatus(age: number): {
  physical: boolean;
  technical: boolean;
  mental: boolean;
} {
  return {
    physical: age > PEAK_AGES.physical + DECLINE_START_OFFSET,
    technical: age > PEAK_AGES.technical + DECLINE_START_OFFSET,
    mental: age > PEAK_AGES.mental + DECLINE_START_OFFSET,
  };
}

/**
 * Gets the career stage for a player based on age
 *
 * @param age - Player age
 * @returns Career stage description
 */
export function getCareerStage(age: number): string {
  if (age < 20) return 'Youth';
  if (age < 23) return 'Developing';
  if (age < 27) return 'Prime (Physical Peak)';
  if (age < 29) return 'Prime (Technical Peak)';
  if (age < 31) return 'Prime (Mental Peak)';
  if (age < 33) return 'Experienced';
  if (age < 36) return 'Veteran (Declining)';
  return 'Late Career (Rapid Decline)';
}

/**
 * Simulates attribute regression over multiple years
 *
 * Useful for testing and demonstrating career arcs
 *
 * @param startAge - Starting age
 * @param endAge - Ending age
 * @param startAttributes - Starting attribute values
 * @param weeksPerYear - Weeks per year (default: 52)
 * @param seed - Random seed
 * @returns Attribute values at each age
 */
export function simulateCareerProgression(
  startAge: number,
  endAge: number,
  startAttributes: Record<string, number>,
  weeksPerYear: number = 52,
  seed: number = 0
): Array<{
  age: number;
  attributes: Record<string, number>;
  regressions: AttributeRegressionResult[];
}> {
  const progression: Array<{
    age: number;
    attributes: Record<string, number>;
    regressions: AttributeRegressionResult[];
  }> = [];

  let currentAttributes = { ...startAttributes };
  let currentAge = startAge;

  // Add starting point
  progression.push({
    age: currentAge,
    attributes: { ...currentAttributes },
    regressions: [],
  });

  // Simulate each year
  for (let age = startAge + 1; age <= endAge; age++) {
    const yearRegressions: AttributeRegressionResult[] = [];

    // Simulate each week in the year
    for (let week = 0; week < weeksPerYear; week++) {
      const weekSeed = seed + (age * 1000) + week;
      const result = applyWeeklyRegression(currentAttributes, age, weekSeed);
      currentAttributes = result.updatedAttributes;
      yearRegressions.push(...result.regressions);
    }

    progression.push({
      age,
      attributes: { ...currentAttributes },
      regressions: yearRegressions,
    });

    currentAge = age;
  }

  return progression;
}

/**
 * Calculates average attribute value for a category
 *
 * @param attributes - Attribute values
 * @param category - Category to average
 * @returns Average attribute value
 */
export function calculateCategoryAverage(
  attributes: Record<string, number>,
  category: 'physical' | 'mental' | 'technical'
): number {
  const categoryAttrs = Object.keys(attributes).filter(attrName => {
    const attrCategory = getAttributeCategory(attrName);
    return attrCategory === category;
  });

  if (categoryAttrs.length === 0) return 0;

  const sum = categoryAttrs.reduce((total, attrName) => total + attributes[attrName], 0);
  return Math.round(sum / categoryAttrs.length);
}

// =============================================================================
// YOUTH PHYSICAL GROWTH SYSTEM
// =============================================================================

/**
 * Result of processing physical growth for a youth player
 */
export interface PhysicalGrowthResult {
  heightChanged: boolean;
  weightChanged: boolean;
  oldHeight: number;
  newHeight: number;
  oldWeight: number;
  newWeight: number;
  strengthCeilingIncreased: boolean;
  oldStrengthCeiling: { min: number; max: number };
  newStrengthCeiling: { min: number; max: number };
}

/**
 * Process yearly physical growth for a player
 *
 * Called when a player ages up (typically at season end).
 * - Height grows until age 18 (with rare late growth for basketball until 21)
 * - Weight grows until age 24
 * - Strength ceiling adjusts with weight changes
 *
 * @param player - The player to process
 * @param sport - The sport type (affects late growth eligibility)
 * @param currentGameDay - Current game day number
 * @returns Growth result and whether youthDevelopment should be cleared
 */
export function processYearlyPhysicalGrowth(
  player: Player,
  sport: 'basketball' | 'baseball' | 'soccer' = 'basketball',
  currentGameDay: number = 0
): {
  result: PhysicalGrowthResult | null;
  updatedPlayer: Partial<Player>;
  clearYouthDevelopment: boolean;
} {
  // No growth processing for players 24+
  if (player.age >= 24) {
    return {
      result: null,
      updatedPlayer: {},
      clearYouthDevelopment: player.youthDevelopment !== undefined,
    };
  }

  // No youth development data means no growth tracking
  if (!player.youthDevelopment) {
    return {
      result: null,
      updatedPlayer: {},
      clearYouthDevelopment: false,
    };
  }

  const dev = player.youthDevelopment;
  const oldHeight = player.height;
  const oldWeight = player.weight;
  const oldStrengthCeiling = getStrengthRange(oldWeight);

  // Process growth using the factory function
  const { newHeight, newWeight } = processYouthGrowth(
    player.height,
    player.weight,
    player.age,
    dev.heightPercentile,
    dev.targetAdultBMI,
    dev.projectedAdultHeight,
    sport,
    dev.growthPattern
  );

  const newStrengthCeiling = getStrengthRange(newWeight);

  const result: PhysicalGrowthResult = {
    heightChanged: newHeight !== oldHeight,
    weightChanged: newWeight !== oldWeight,
    oldHeight,
    newHeight,
    oldWeight,
    newWeight,
    strengthCeilingIncreased: newStrengthCeiling.max > oldStrengthCeiling.max,
    oldStrengthCeiling,
    newStrengthCeiling,
  };

  // Update youth development tracking
  const updatedYouthDev: YouthPhysicalDevelopment = {
    ...dev,
    lastGrowthGameDay: currentGameDay,
  };

  // Check if we should clear youth development (player reached 24)
  const newAge = player.age + 1;
  const clearYouthDevelopment = newAge >= 24;

  return {
    result,
    updatedPlayer: {
      height: newHeight,
      weight: newWeight,
      youthDevelopment: clearYouthDevelopment ? undefined : updatedYouthDev,
    },
    clearYouthDevelopment,
  };
}

/**
 * Calculate projected adult weight for display
 *
 * @param player - The player
 * @returns Projected adult weight in pounds, or current weight if no youth dev data
 */
export function getProjectedAdultWeight(player: Player): number {
  if (!player.youthDevelopment) {
    return player.weight;
  }

  const dev = player.youthDevelopment;
  // Calculate weight at projected height with target BMI
  return Math.round((dev.targetAdultBMI * dev.projectedAdultHeight * dev.projectedAdultHeight) / 703);
}

/**
 * Calculate projected adult height for display
 *
 * @param player - The player
 * @returns Projected adult height in inches, or current height if no youth dev data
 */
export function getProjectedAdultHeightForPlayer(player: Player): number {
  if (!player.youthDevelopment) {
    return player.height;
  }
  return player.youthDevelopment.projectedAdultHeight;
}

/**
 * Check if a player is still physically developing
 *
 * @param player - The player
 * @returns true if player has youth development data and is under 24
 */
export function isStillDeveloping(player: Player): boolean {
  return player.age < 24 && player.youthDevelopment !== undefined;
}

/**
 * Get growth stage description for UI display
 *
 * @param player - The player
 * @returns Human-readable growth stage
 */
export function getGrowthStage(player: Player): string {
  if (player.age >= 24) return 'Fully Developed';
  if (!player.youthDevelopment) return 'Fully Developed';

  if (player.age < 16) return 'Early Growth';
  if (player.age < 18) return 'Growth Spurt';
  if (player.age < 21) return 'Late Growth Phase';
  return 'Filling Out';
}

/**
 * Process strength ceiling adjustment when weight changes
 *
 * When a player's weight increases to cross a weight class threshold,
 * their strength attribute ceiling increases. However, actual strength
 * doesn't auto-increase - it moves 20% toward the new ceiling each season.
 *
 * @param currentStrength - Current strength attribute value
 * @param oldWeight - Previous weight
 * @param newWeight - New weight after growth
 * @returns Updated strength value (moves 20% toward new ceiling)
 */
export function adjustStrengthForWeightGain(
  currentStrength: number,
  oldWeight: number,
  newWeight: number
): number {
  const oldCeiling = getStrengthRange(oldWeight);
  const newCeiling = getStrengthRange(newWeight);

  // If ceiling increased, move 20% toward new ceiling
  if (newCeiling.max > oldCeiling.max) {
    const ceilingIncrease = newCeiling.max - oldCeiling.max;
    const strengthGain = Math.round(ceilingIncrease * 0.2);
    return Math.min(newCeiling.max, currentStrength + strengthGain);
  }

  return currentStrength;
}
