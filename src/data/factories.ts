/**
 * Test Data Factories for Multiball
 *
 * Factory functions for generating test/mock data.
 * Useful for testing, development, and generating initial game state.
 *
 * @module data/factories
 */

// Simple UUID generator for React Native compatibility
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import {
  Player,
  PlayerAttributes,
  PlayerPotentials,
  PeakAges,
  TrainingFocus,
  WeeklyXP,
  PlayerCareerStats,
  Contract,
  Injury,
  Franchise,
  TacticalSettings,
  Budget,
  TeamColors,
  Season,
  YouthProspect,
  NewsItem,
  GameSave,
  AIPersonality,
} from './types';
import {
  STARTING_ROSTER_SIZE,
  DIVISION_COUNT,
  TEAMS_PER_DIVISION,
  USER_STARTING_DIVISION,
} from './constants';

// =============================================================================
// RANDOM UTILITIES
// =============================================================================

/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max
 */
// @ts-ignore - Utility function kept for future use
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Pick random element from array
 */
function randomElement<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot pick random element from empty array');
  }
  return array[Math.floor(Math.random() * array.length)]!;
}

// =============================================================================
// BODY-TYPE ATTRIBUTE CORRELATION SYSTEM
// =============================================================================

/**
 * Get strength attribute range based on weight
 *
 * Strength attributes (core_strength, grip_strength, arm_strength) are
 * constrained by body mass. Heavier players have higher strength ranges
 * with minimal overlap to ensure physical realism.
 *
 * Formula: min = (weight - 110) * 0.45, max = (weight - 110) * 0.65
 *
 * @param weight - Player weight in pounds
 * @returns { min, max } range for strength attributes
 */
export function getStrengthRange(weight: number): { min: number; max: number } {
  const min = Math.max(1, Math.round((weight - 110) * 0.45));
  const max = Math.min(99, Math.round((weight - 110) * 0.65));
  return { min, max };
}

/**
 * Get differentiated strength ranges by attribute type
 *
 * Not all strength types correlate equally with body mass:
 * - core_strength: 100% correlation (directly tied to torso mass)
 * - grip_strength: 70% correlation (hand/forearm size + technique)
 * - arm_strength: 50% correlation (biomechanics + fast-twitch, not just mass)
 *
 * @param weight - Player weight in pounds
 * @returns Ranges for each strength attribute type
 */
export function getDifferentiatedStrengthRanges(weight: number): {
  core: { min: number; max: number };
  grip: { min: number; max: number };
  arm: { min: number; max: number };
} {
  const baseRange = getStrengthRange(weight);

  // Core strength: full correlation (100%)
  const core = baseRange;

  // Grip strength: 70% correlation - wider range, shifted toward middle
  const gripMin = Math.max(1, Math.round(baseRange.min * 0.7 + 10));
  const gripMax = Math.min(99, Math.round(baseRange.max * 0.7 + 20));
  const grip = { min: gripMin, max: gripMax };

  // Arm strength: 50% correlation - widest range, most trainable
  const armMin = Math.max(1, Math.round(baseRange.min * 0.5 + 15));
  const armMax = Math.min(99, Math.round(baseRange.max * 0.5 + 30));
  const arm = { min: armMin, max: armMax };

  return { core, grip, arm };
}


/**
 * Generate weight with strict BMI enforcement
 *
 * Pro Athletes (age 19+): BMI 20-30
 * Youth Prospects (age 15-18): BMI 19-28
 *
 * @param height - Height in inches
 * @param isYouth - Whether this is a youth prospect (lighter BMI range)
 * @returns Weight in pounds within valid BMI range
 */
export function generateWeightWithBMI(height: number, isYouth: boolean = false): number {
  const minBMI = isYouth ? 19 : 20;
  const maxBMI = isYouth ? 28 : 30;

  const minWeight = Math.round((minBMI * height * height) / 703);
  const maxWeight = Math.round((maxBMI * height * height) / 703);

  // Generate weight with slight bias toward middle of range
  const midWeight = (minWeight + maxWeight) / 2;
  const variance = (maxWeight - minWeight) / 2;

  // Normal-ish distribution around midpoint
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const weight = Math.round(midWeight + z * variance * 0.4);

  // Clamp to valid BMI range
  return Math.max(minWeight, Math.min(maxWeight, weight));
}

// =============================================================================
// YOUTH PHYSICAL DEVELOPMENT SYSTEM
// =============================================================================

/**
 * Height at each age for 50th percentile male (CDC growth charts)
 * Values in inches
 */
const HEIGHT_BY_AGE_50TH_PERCENTILE: Record<number, number> = {
  14: 64.5, // 5'4.5"
  15: 67.0, // 5'7"
  16: 68.7, // 5'8.7"
  17: 69.5, // 5'9.5"
  18: 69.5, // Adult height reached
  19: 69.5,
  20: 69.5,
  21: 69.5,
};

/**
 * Percentile multipliers for height calculation
 * Applied to 50th percentile values to get other percentiles
 */
const HEIGHT_PERCENTILE_MULTIPLIERS: Record<number, number> = {
  5: 0.93,   // ~5'6" adult (shortest typical athletes)
  15: 0.96,  // ~5'7.5" adult
  25: 0.97,  // ~5'8" adult
  50: 1.00,  // 5'9.5" adult (baseline)
  75: 1.04,  // ~6'0" adult
  85: 1.06,  // ~6'1.5" adult
  95: 1.08,  // ~6'3" adult
  99: 1.12,  // ~6'6" adult (for basketball)
};

/**
 * BMI ranges by age (smooth progression, no discontinuities)
 */
const BMI_RANGES_BY_AGE: Record<number, { min: number; max: number }> = {
  14: { min: 19.0, max: 24.0 },
  15: { min: 19.0, max: 25.0 },
  16: { min: 19.5, max: 26.0 },
  17: { min: 19.5, max: 27.0 },
  18: { min: 20.0, max: 27.5 },
  19: { min: 20.0, max: 28.0 },
  20: { min: 20.0, max: 28.5 },
  21: { min: 20.0, max: 29.0 },
  22: { min: 20.0, max: 29.5 },
  23: { min: 20.0, max: 30.0 },
  24: { min: 20.0, max: 30.0 },
};

/**
 * Get BMI range for a given age
 */
export function getBMIRangeForAge(age: number): { min: number; max: number } {
  if (age < 14) return BMI_RANGES_BY_AGE[14]!;
  if (age >= 24) return BMI_RANGES_BY_AGE[24]!;
  return BMI_RANGES_BY_AGE[age] ?? BMI_RANGES_BY_AGE[24]!;
}

/**
 * Calculate weight from height and BMI
 * Formula: weight = (BMI * height²) / 703
 */
export function calculateWeightFromBMI(height: number, bmi: number): number {
  return Math.round((bmi * height * height) / 703);
}

/**
 * Calculate BMI from height and weight
 * Formula: BMI = (weight * 703) / height²
 */
export function calculateBMIFromWeight(height: number, weight: number): number {
  return (weight * 703) / (height * height);
}

// Note: getPercentileMultiplier was removed - using interpolatePercentileMultiplier instead

/**
 * Interpolate percentile multiplier for smoother height distribution
 */
function interpolatePercentileMultiplier(percentile: number): number {
  const percentiles = Object.keys(HEIGHT_PERCENTILE_MULTIPLIERS).map(Number).sort((a, b) => a - b);

  // Find surrounding percentiles for interpolation
  let lower = percentiles[0]!;
  let upper = percentiles[percentiles.length - 1]!;

  for (let i = 0; i < percentiles.length - 1; i++) {
    const current = percentiles[i]!;
    const next = percentiles[i + 1]!;
    if (percentile >= current && percentile <= next) {
      lower = current;
      upper = next;
      break;
    }
  }

  if (percentile <= lower) return HEIGHT_PERCENTILE_MULTIPLIERS[lower]!;
  if (percentile >= upper) return HEIGHT_PERCENTILE_MULTIPLIERS[upper]!;

  // Linear interpolation
  const lowerMult = HEIGHT_PERCENTILE_MULTIPLIERS[lower]!;
  const upperMult = HEIGHT_PERCENTILE_MULTIPLIERS[upper]!;
  const ratio = (percentile - lower) / (upper - lower);

  return lowerMult + (upperMult - lowerMult) * ratio;
}

/**
 * Get height for a given age and percentile
 *
 * @param age - Player age (14-21)
 * @param percentile - Height percentile (0-100)
 * @returns Height in inches
 */
export function getHeightForAgeAndPercentile(age: number, percentile: number): number {
  // Clamp age to valid range
  const clampedAge = Math.max(14, Math.min(21, age));

  // Get base height for 50th percentile at this age
  const baseHeight = HEIGHT_BY_AGE_50TH_PERCENTILE[clampedAge] ?? HEIGHT_BY_AGE_50TH_PERCENTILE[18]!;

  // Apply percentile multiplier
  const multiplier = interpolatePercentileMultiplier(percentile);

  return Math.round(baseHeight * multiplier);
}

/**
 * Get projected adult height for a given percentile
 *
 * @param percentile - Height percentile (0-100)
 * @returns Projected adult height in inches
 */
export function getProjectedAdultHeight(percentile: number): number {
  return getHeightForAgeAndPercentile(18, percentile);
}

/**
 * Generate a height percentile for a player based on position
 * Higher percentiles for positions that favor taller players
 *
 * @param position - Player position
 * @param sport - Sport type
 * @returns Height percentile (0-100)
 */
export function generateHeightPercentile(
  position: string,
  sport: 'basketball' | 'baseball' | 'soccer' = 'basketball'
): number {
  let baseMean = 50;
  let stdDev = 20;

  if (sport === 'basketball') {
    // Basketball positions have more extreme height differentiation
    switch (position) {
      case 'PG':
        baseMean = 30;
        stdDev = 15;
        break;
      case 'SG':
        baseMean = 45;
        stdDev = 15;
        break;
      case 'SF':
        baseMean = 65;
        stdDev = 15;
        break;
      case 'PF':
        baseMean = 80;
        stdDev = 12;
        break;
      case 'C':
        baseMean = 92;
        stdDev = 8;
        break;
    }
  } else if (sport === 'soccer') {
    // Soccer has less height variation
    switch (position) {
      case 'GK':
        baseMean = 75;
        stdDev = 12;
        break;
      case 'CB':
        baseMean = 65;
        stdDev = 15;
        break;
      default:
        baseMean = 45;
        stdDev = 18;
        break;
    }
  } else if (sport === 'baseball') {
    // Baseball varies by position
    switch (position) {
      case 'P':
        baseMean = 60;
        stdDev = 18;
        break;
      case 'C':
        baseMean = 40;
        stdDev = 15;
        break;
      case '1B':
        baseMean = 70;
        stdDev = 15;
        break;
      case 'SS':
      case '2B':
        baseMean = 35;
        stdDev = 15;
        break;
      default:
        baseMean = 50;
        stdDev = 18;
        break;
    }
  }

  // Generate percentile using normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const percentile = baseMean + z * stdDev;

  // Clamp to valid range
  return Math.max(1, Math.min(99, Math.round(percentile)));
}

/**
 * Generate a growth pattern (early/average/late bloomer)
 * Distribution: 25% early, 50% average, 25% late
 */
export function generateGrowthPattern(): 'early' | 'average' | 'late' {
  const roll = Math.random();
  if (roll < 0.25) return 'early';
  if (roll < 0.75) return 'average';
  return 'late';
}

/**
 * Generate target adult BMI for a player
 * Uses normal distribution around 24 (healthy athletic BMI)
 */
export function generateTargetAdultBMI(): number {
  const mean = 24;
  const stdDev = 2.5;

  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const bmi = mean + z * stdDev;

  // Clamp to adult BMI range (20-30)
  return Math.max(20, Math.min(30, Math.round(bmi * 10) / 10));
}

/**
 * Calculate current weight based on age, height, and target BMI
 * BMI progresses from youth range toward adult target
 *
 * @param age - Player age
 * @param height - Current height in inches
 * @param targetAdultBMI - Target BMI at age 24
 * @returns Current weight in pounds
 */
export function calculateCurrentWeight(age: number, height: number, targetAdultBMI: number): number {
  const bmiRange = getBMIRangeForAge(age);

  // Progress toward target BMI as player ages
  // At 14: closer to minimum, at 24: at target
  const progressRatio = Math.min(1, (age - 14) / 10);

  // Current BMI is blend of minimum and target
  const currentBMI = bmiRange.min + (targetAdultBMI - bmiRange.min) * progressRatio;

  // Clamp to valid range for age
  const clampedBMI = Math.max(bmiRange.min, Math.min(bmiRange.max, currentBMI));

  return calculateWeightFromBMI(height, clampedBMI);
}

/**
 * Calculate projected adult weight from projected height and target BMI
 */
export function calculateProjectedAdultWeight(projectedHeight: number, targetBMI: number): number {
  return calculateWeightFromBMI(projectedHeight, targetBMI);
}

/**
 * Check if a player qualifies for late growth (basketball only, ages 18-21)
 *
 * @param age - Player age
 * @param sport - Sport type
 * @param growthPattern - Player's growth pattern
 * @returns true if player might still grow
 */
export function canHaveLateGrowth(
  age: number,
  sport: string,
  growthPattern: 'early' | 'average' | 'late'
): boolean {
  // Only basketball players can have late growth
  if (sport !== 'basketball') return false;

  // Only ages 18-21
  if (age < 18 || age > 21) return false;

  // Late bloomers have higher chance
  const baseChance = growthPattern === 'late' ? 0.15 : growthPattern === 'average' ? 0.08 : 0.03;

  return Math.random() < baseChance;
}

/**
 * Calculate late growth amount (for basketball players 18-21)
 *
 * @param age - Player age
 * @param growthPattern - Player's growth pattern
 * @returns Additional inches to grow (0-2)
 */
export function calculateLateGrowthAmount(
  age: number,
  growthPattern: 'early' | 'average' | 'late'
): number {
  // Less growth possible as age increases
  const maxGrowth = age === 18 ? 2 : age === 19 ? 1.5 : age === 20 ? 1 : 0.5;

  // Late bloomers grow more
  const growthMultiplier = growthPattern === 'late' ? 1.0 : growthPattern === 'average' ? 0.7 : 0.5;

  return Math.round(Math.random() * maxGrowth * growthMultiplier * 2) / 2; // Round to nearest 0.5"
}

/**
 * Process physical growth for a youth player (called during season progression)
 *
 * @param currentHeight - Current height in inches
 * @param currentWeight - Current weight in pounds
 * @param age - Current age (will be incremented)
 * @param heightPercentile - Player's height percentile
 * @param targetAdultBMI - Target adult BMI
 * @param projectedAdultHeight - Projected adult height (may include variance)
 * @param sport - Sport type (for late growth eligibility)
 * @param growthPattern - Player's growth pattern
 * @returns New height and weight
 */
export function processYouthGrowth(
  currentHeight: number,
  currentWeight: number,
  age: number,
  heightPercentile: number,
  targetAdultBMI: number,
  projectedAdultHeight: number,
  sport: string,
  growthPattern: 'early' | 'average' | 'late'
): { newHeight: number; newWeight: number } {
  let newHeight = currentHeight;
  let newWeight = currentWeight;

  // Height growth (until 18, or late growth for basketball)
  if (age < 18) {
    // Normal growth based on percentile tables
    newHeight = getHeightForAgeAndPercentile(age + 1, heightPercentile);

    // Apply variance toward projected height
    const targetForAge = getHeightForAgeAndPercentile(age + 1, heightPercentile);
    const varianceTowardProjected = (projectedAdultHeight - getProjectedAdultHeight(heightPercentile)) *
      ((age + 1 - 14) / 4); // Gradually apply variance
    newHeight = Math.round(targetForAge + varianceTowardProjected);
  } else if (age >= 18 && age <= 21 && canHaveLateGrowth(age, sport, growthPattern)) {
    // Late growth for basketball
    const lateGrowth = calculateLateGrowthAmount(age, growthPattern);
    newHeight = currentHeight + lateGrowth;
  }

  // Ensure height doesn't decrease and respects minimum
  newHeight = Math.max(newHeight, currentHeight, 66);

  // Weight growth (until 24) - based on new height and age-appropriate BMI
  if (age < 24) {
    newWeight = calculateCurrentWeight(age + 1, newHeight, targetAdultBMI);
  }

  return { newHeight: Math.round(newHeight), newWeight };
}

// =============================================================================
// ATTRIBUTE VARIANCE SYSTEM
// =============================================================================

/**
 * Variance level determines how "spiky" a player's attribute profile is
 * - Low: Consistent, attributes within ±12 of base
 * - Moderate: Some spikes/valleys, more interesting profiles
 * - High: Extreme specialists, some very high and very low attributes
 */
type VarianceLevel = 'low' | 'moderate' | 'high';

/**
 * Randomly assign a variance level (33% each)
 */
function getVarianceLevel(): VarianceLevel {
  const roll = Math.random();
  if (roll < 0.33) return 'low';
  if (roll < 0.66) return 'moderate';
  return 'high';
}

/**
 * All 26 attribute names grouped by category
 */
const PHYSICAL_ATTR_NAMES = [
  'grip_strength', 'arm_strength', 'core_strength', 'agility',
  'acceleration', 'top_speed', 'jumping', 'reactions',
  'stamina', 'balance', 'height', 'durability',
] as const;

const MENTAL_ATTR_NAMES = [
  'awareness', 'creativity', 'determination', 'bravery',
  'consistency', 'composure', 'patience', 'teamwork',
] as const;

const TECHNICAL_ATTR_NAMES = [
  'hand_eye_coordination', 'throw_accuracy', 'form_technique',
  'finesse', 'deception', 'footwork',
] as const;

const ALL_ATTR_NAMES = [...PHYSICAL_ATTR_NAMES, ...MENTAL_ATTR_NAMES, ...TECHNICAL_ATTR_NAMES];

/**
 * Pick N random unique indices from an array
 */
function pickRandomIndices(totalCount: number, pickCount: number): number[] {
  const indices: number[] = [];
  const available = Array.from({ length: totalCount }, (_, i) => i);

  for (let i = 0; i < Math.min(pickCount, totalCount); i++) {
    const idx = Math.floor(Math.random() * available.length);
    indices.push(available[idx]!);
    available.splice(idx, 1);
  }

  return indices;
}

/**
 * Apply spikes and valleys to a base attribute array
 * Returns a new array with modifications applied
 */
function applySpikeValleyVariance(
  baseAttrs: number[],
  varianceLevel: VarianceLevel
): number[] {
  const attrs = [...baseAttrs];

  let spikeCount: number, spikeMin: number, spikeMax: number;
  let valleyCount: number, valleyMin: number, valleyMax: number;

  switch (varianceLevel) {
    case 'low':
      spikeCount = Math.random() < 0.5 ? 0 : 1;
      spikeMin = 10; spikeMax = 15;
      valleyCount = Math.random() < 0.5 ? 0 : 1;
      valleyMin = 10; valleyMax = 15;
      break;
    case 'moderate':
      spikeCount = randomInt(2, 3);
      spikeMin = 18; spikeMax = 25;
      valleyCount = randomInt(2, 3);
      valleyMin = 18; valleyMax = 25;
      break;
    case 'high':
      spikeCount = randomInt(3, 4);
      spikeMin = 25; spikeMax = 40;
      valleyCount = randomInt(3, 4);
      valleyMin = 20; valleyMax = 35;
      break;
  }

  // Apply spikes (avoid height attribute index 10, which is derived from physical height)
  const spikeIndices = pickRandomIndices(26, spikeCount + 2)
    .filter(i => i !== 10) // Skip height attribute
    .slice(0, spikeCount);

  for (const idx of spikeIndices) {
    const boost = randomInt(spikeMin, spikeMax);
    attrs[idx] = Math.min(99, attrs[idx]! + boost);
  }

  // Apply valleys (avoid same indices as spikes, and height)
  const availableForValleys = Array.from({ length: 26 }, (_, i) => i)
    .filter(i => i !== 10 && !spikeIndices.includes(i));
  const valleyIndices = pickRandomIndices(availableForValleys.length, valleyCount)
    .map(i => availableForValleys[i]!);

  for (const idx of valleyIndices) {
    const penalty = randomInt(valleyMin, valleyMax);
    attrs[idx] = Math.max(1, attrs[idx]! - penalty);
  }

  return attrs;
}

/**
 * Apply body type correlations (physics-based)
 *
 * This function now uses differentiated strength correlations:
 * - core_strength: 100% correlation with body mass
 * - grip_strength: 70% correlation
 * - arm_strength: 50% correlation
 *
 * Heavy/light build adjustments are applied on top of weight-based ranges.
 */
function applyBodyTypeCorrelations(
  attrs: Record<string, number>,
  heightInches: number,
  _weightLbs: number,
  bmi: number
): void {
  const isHeavy = bmi > 26;
  const isLight = bmi < 22;
  const isTall = heightInches > 76; // > 6'4"
  const isShort = heightInches < 70; // < 5'10"

  // Heavy build correlations - differentiated by strength type
  if (isHeavy) {
    // Core strength gets FULL boost (100% correlation)
    if (Math.random() > 0.10) {
      const coreBoost = randomInt(12, 18);
      const gripBoost = Math.round(coreBoost * 0.7); // 70% correlation
      const armBoost = Math.round(coreBoost * 0.5);  // 50% correlation

      attrs.core_strength = Math.min(99, (attrs.core_strength ?? 50) + coreBoost);
      attrs.grip_strength = Math.min(99, (attrs.grip_strength ?? 50) + gripBoost);
      attrs.arm_strength = Math.min(99, (attrs.arm_strength ?? 50) + armBoost);
    }
    // Speed/agility penalty (15% exception chance - "agile big man")
    if (Math.random() > 0.15) {
      const penalty = randomInt(8, 15);
      attrs.stamina = Math.max(1, (attrs.stamina ?? 50) - penalty);
      attrs.agility = Math.max(1, (attrs.agility ?? 50) - penalty);
      attrs.acceleration = Math.max(1, (attrs.acceleration ?? 50) - penalty);
    }
  }

  // Light build correlations - differentiated by strength type
  if (isLight) {
    // Agility/stamina boost (10% exception chance)
    if (Math.random() > 0.10) {
      const boost = randomInt(8, 12);
      attrs.stamina = Math.min(99, (attrs.stamina ?? 50) + boost);
      attrs.agility = Math.min(99, (attrs.agility ?? 50) + boost);
    }
    // Strength penalty - differentiated (15% exception chance - "strong guard")
    if (Math.random() > 0.15) {
      const corePenalty = randomInt(8, 14);      // 100% correlation
      const gripPenalty = Math.round(corePenalty * 0.7); // 70% correlation
      const armPenalty = Math.round(corePenalty * 0.5);  // 50% correlation

      attrs.core_strength = Math.max(1, (attrs.core_strength ?? 50) - corePenalty);
      attrs.grip_strength = Math.max(1, (attrs.grip_strength ?? 50) - gripPenalty);
      attrs.arm_strength = Math.max(1, (attrs.arm_strength ?? 50) - armPenalty);
    }
  }

  // Tall player correlations
  if (isTall) {
    // Speed penalty (12% exception chance - "fast big man")
    if (Math.random() > 0.12) {
      const penalty = randomInt(5, 12);
      attrs.top_speed = Math.max(1, (attrs.top_speed ?? 50) - penalty);
      attrs.acceleration = Math.max(1, (attrs.acceleration ?? 50) - penalty);
    }
    // Balance penalty (15% exception chance)
    if (Math.random() > 0.15) {
      const penalty = randomInt(3, 8);
      attrs.balance = Math.max(1, (attrs.balance ?? 50) - penalty);
    }
  }

  // Short player correlations
  if (isShort) {
    // Agility boost (10% exception chance)
    if (Math.random() > 0.10) {
      const boost = randomInt(5, 10);
      attrs.agility = Math.min(99, (attrs.agility ?? 50) + boost);
      attrs.acceleration = Math.min(99, (attrs.acceleration ?? 50) + boost);
    }
  }
}

/**
 * OVR calculation weights (must match evaluation.ts)
 */
const OVR_WEIGHTS: Record<string, number> = {
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
  awareness: 0.050,
  creativity: 0.035,
  determination: 0.030,
  bravery: 0.025,
  consistency: 0.040,
  composure: 0.045,
  patience: 0.025,
  teamwork: 0.045,
  hand_eye_coordination: 0.065,
  throw_accuracy: 0.080,
  form_technique: 0.065,
  finesse: 0.035,
  deception: 0.040,
  footwork: 0.040,
};

/**
 * Calculate OVR from attributes
 */
function calculateOVR(attrs: Record<string, number>): number {
  let total = 0;
  for (const [attr, weight] of Object.entries(OVR_WEIGHTS)) {
    total += (attrs[attr] ?? 50) * weight;
  }
  return Math.round(total * 10) / 10;
}

/**
 * Adjust attributes to hit target OVR (within ±2)
 * Uses iterative adjustment of highest/lowest attributes
 */
function adjustToTargetOVR(
  attrs: Record<string, number>,
  targetOVR: number,
  maxIterations: number = 20
): void {
  for (let i = 0; i < maxIterations; i++) {
    const currentOVR = calculateOVR(attrs);
    const diff = targetOVR - currentOVR;

    if (Math.abs(diff) <= 2) return; // Close enough

    // Get sortable attribute entries (excluding height which is derived)
    const adjustable = Object.entries(attrs)
      .filter(([key]) => key !== 'height')
      .sort((a, b) => a[1] - b[1]);

    if (diff > 0) {
      // Need to increase OVR - boost lowest attributes
      const toBoost = adjustable.slice(0, 3);
      for (const [key] of toBoost) {
        attrs[key] = Math.min(99, attrs[key]! + Math.ceil(diff / 2));
      }
    } else {
      // Need to decrease OVR - reduce highest attributes
      const toReduce = adjustable.slice(-3);
      for (const [key] of toReduce) {
        attrs[key] = Math.max(1, attrs[key]! - Math.ceil(Math.abs(diff) / 2));
      }
    }
  }
}

/**
 * Generate attributes with proper variance for realistic player profiles
 *
 * Creates "spiky" attribute distributions where players have clear
 * strengths and weaknesses, even at low overall ratings.
 *
 * IMPORTANT: Strength attributes (core_strength, grip_strength, arm_strength)
 * are now constrained by weight-based ranges to ensure physical realism.
 * A 124 lb player CANNOT have the same strength as a 200 lb player.
 *
 * @param targetOVR - Target overall rating (1-100)
 * @param heightInches - Player's height in inches
 * @param weightLbs - Player's weight in pounds
 * @returns Complete PlayerAttributes object
 */
export function generateAttributesWithVariance(
  targetOVR: number,
  heightInches: number,
  weightLbs: number
): PlayerAttributes {
  const varianceLevel = getVarianceLevel();
  const bmi = (weightLbs / (heightInches * heightInches)) * 703;

  // Calculate height attribute (direct correlation)
  const heightAttr = Math.round(((heightInches - 66) * 98 / 22) + 1);
  const clampedHeight = Math.max(1, Math.min(99, heightAttr));

  // Get weight-based strength ranges (differentiated by type)
  const strengthRanges = getDifferentiatedStrengthRanges(weightLbs);

  // Step 1: Generate base attributes around target OVR
  // Strength attributes use weight-based ranges instead of target OVR
  const baseAttrs: number[] = ALL_ATTR_NAMES.map((attr) => {
    if (attr === 'height') return clampedHeight;

    // Strength attributes: generate within weight-based range
    if (attr === 'core_strength') {
      return randomInt(strengthRanges.core.min, strengthRanges.core.max);
    }
    if (attr === 'grip_strength') {
      return randomInt(strengthRanges.grip.min, strengthRanges.grip.max);
    }
    if (attr === 'arm_strength') {
      return randomInt(strengthRanges.arm.min, strengthRanges.arm.max);
    }

    // Other attributes: use target OVR with small variance (±8 points)
    return Math.max(1, Math.min(99, targetOVR + randomInt(-8, 8)));
  });

  // Step 2: Apply spike/valley variance (but protect strength attributes)
  const variedAttrs = applySpikeValleyVariance(baseAttrs, varianceLevel);

  // Step 3: Convert to named attributes
  const attrs: Record<string, number> = {};
  ALL_ATTR_NAMES.forEach((name, idx) => {
    attrs[name] = name === 'height' ? clampedHeight : variedAttrs[idx]!;
  });

  // Step 4: Re-clamp strength attributes to their weight-based ranges
  // (spike/valley may have pushed them outside valid range)
  attrs.core_strength = Math.max(strengthRanges.core.min,
    Math.min(strengthRanges.core.max, attrs.core_strength ?? strengthRanges.core.min));
  attrs.grip_strength = Math.max(strengthRanges.grip.min,
    Math.min(strengthRanges.grip.max, attrs.grip_strength ?? strengthRanges.grip.min));
  attrs.arm_strength = Math.max(strengthRanges.arm.min,
    Math.min(strengthRanges.arm.max, attrs.arm_strength ?? strengthRanges.arm.min));

  // Step 5: Apply body type correlations (additional adjustments within ranges)
  applyBodyTypeCorrelations(attrs, heightInches, weightLbs, bmi);

  // Step 6: Re-clamp strength after body type correlations
  attrs.core_strength = Math.max(strengthRanges.core.min,
    Math.min(strengthRanges.core.max, attrs.core_strength));
  attrs.grip_strength = Math.max(strengthRanges.grip.min,
    Math.min(strengthRanges.grip.max, attrs.grip_strength));
  attrs.arm_strength = Math.max(strengthRanges.arm.min,
    Math.min(strengthRanges.arm.max, attrs.arm_strength));

  // Step 7: Adjust non-strength attributes to hit target OVR
  adjustToTargetOVR(attrs, targetOVR);

  // Step 8: Final clamp - strength stays in range, others 1-99
  for (const key of Object.keys(attrs)) {
    if (key === 'height') {
      attrs[key] = clampedHeight;
    } else if (key === 'core_strength') {
      attrs[key] = Math.max(strengthRanges.core.min, Math.min(strengthRanges.core.max, attrs[key]!));
    } else if (key === 'grip_strength') {
      attrs[key] = Math.max(strengthRanges.grip.min, Math.min(strengthRanges.grip.max, attrs[key]!));
    } else if (key === 'arm_strength') {
      attrs[key] = Math.max(strengthRanges.arm.min, Math.min(strengthRanges.arm.max, attrs[key]!));
    } else {
      attrs[key] = Math.max(1, Math.min(99, attrs[key]!));
    }
  }

  return attrs as unknown as PlayerAttributes;
}

/**
 * Generate height with normal distribution for professional athletes
 * Range: 5'6"-7'4" (66"-88"), Mean: 6'2" (74")
 *
 * Minimum 5'6" (66") - realistic floor for multi-sport pro athletes
 * (Muggsy Bogues 5'3" and José Altuve 5'6" are extreme outliers)
 */
function generateNormalHeight(): number {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Mean: 74" (6'2"), Standard deviation: 3" (tighter for pro athletes)
  const mean = 74;
  const stdDev = 3;
  const height = Math.round(mean + z * stdDev);

  // Clamp to 5'6" to 7'4" (66" to 88") - realistic pro athlete range
  return Math.max(66, Math.min(88, height));
}

/**
 * Generate weight based on height with strict BMI enforcement
 *
 * Pro Athletes: BMI 20-30 (enforced)
 * This replaces the old loose BMI 20-32 check with strict enforcement.
 *
 * @param height - Height in inches
 * @param isYouth - Whether this is a youth prospect (uses BMI 19-28)
 */
function generateWeightFromHeight(height: number, isYouth: boolean = false): number {
  return generateWeightWithBMI(height, isYouth);
}

/**
 * Generate random hex color
 */
function randomHexColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * Generate random name
 */
function randomName(): string {
  const firstNames = [
    'James', 'John', 'Michael', 'David', 'Chris', 'Tyler', 'Marcus', 'Kevin',
    'Stephen', 'Anthony', 'Paul', 'Jason', 'Brandon', 'Ryan', 'Eric', 'Jordan',
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
  ];

  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

/**
 * Generate random team name
 */
function randomTeamName(): string {
  const cities = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
    'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
    'Seattle', 'Denver', 'Boston', 'Portland', 'Miami', 'Atlanta',
  ];
  const nicknames = [
    'Warriors', 'Lakers', 'Bulls', 'Celtics', 'Rockets', 'Thunder', 'Blazers',
    'Mavericks', 'Spurs', 'Heat', 'Suns', 'Knicks', 'Hawks', 'Wizards', 'Kings',
  ];

  return `${randomElement(cities)} ${randomElement(nicknames)}`;
}

// =============================================================================
// ATTRIBUTE FACTORIES
// =============================================================================

/**
 * Create random player attributes with realistic correlations to physical measurements
 *
 * Physics-based correlations only - NO sport-specific or position-based bonuses.
 * Multiball is multi-sport: any athlete can play any position in any sport.
 *
 * @param min - Minimum attribute value (default: 1)
 * @param max - Maximum attribute value (default: 100)
 * @param heightInches - Player's actual height in inches (e.g., 78 = 6'6")
 * @param weightLbs - Player's actual weight in pounds
 */
export function createRandomAttributes(
  min: number = 1,
  max: number = 100,
  heightInches?: number,
  weightLbs?: number
): PlayerAttributes {
  // If no physical data provided, generate random
  if (!heightInches || !weightLbs) {
    return {
      grip_strength: randomInt(min, max),
      arm_strength: randomInt(min, max),
      core_strength: randomInt(min, max),
      agility: randomInt(min, max),
      acceleration: randomInt(min, max),
      top_speed: randomInt(min, max),
      jumping: randomInt(min, max),
      reactions: randomInt(min, max),
      stamina: randomInt(min, max),
      balance: randomInt(min, max),
      height: randomInt(min, max),
      durability: randomInt(min, max),
      awareness: randomInt(min, max),
      creativity: randomInt(min, max),
      determination: randomInt(min, max),
      bravery: randomInt(min, max),
      consistency: randomInt(min, max),
      composure: randomInt(min, max),
      patience: randomInt(min, max),
      teamwork: randomInt(min, max),
      hand_eye_coordination: randomInt(min, max),
      throw_accuracy: randomInt(min, max),
      form_technique: randomInt(min, max),
      finesse: randomInt(min, max),
      deception: randomInt(min, max),
      footwork: randomInt(min, max),
    };
  }

  // Calculate height attribute (direct correlation)
  // 66" (5'6") = 1, 88" (7'4") = 99, 77" (6'5") = ~50
  // NOTE: Height is NOT clamped to min/max since it's derived from physical height
  const heightAttr = Math.round(((heightInches - 66) * 98 / 22) + 1);
  const clampedHeight = Math.max(1, Math.min(99, heightAttr));

  // Calculate body type factors (PHYSICS-BASED ONLY)
  // BMI-like ratio: weight / (height^2) * 703
  const bodyMassIndex = (weightLbs / (heightInches * heightInches)) * 703;
  const isHeavy = bodyMassIndex > 26; // Over 26 BMI = heavy build
  const isLight = bodyMassIndex < 22; // Under 22 BMI = light/lean build

  // Strength attributes - influenced by weight (heavier = stronger)
  const strengthBase = isHeavy ? 15 : isLight ? -10 : 0;

  const grip_strength = Math.max(min, Math.min(max, randomInt(min, max) + strengthBase));
  const arm_strength = Math.max(min, Math.min(max, randomInt(min, max) + strengthBase));
  const core_strength = Math.max(min, Math.min(max, randomInt(min, max) + strengthBase));

  // Speed/agility attributes - inversely proportional to size (physics)
  const speedPenalty = Math.floor((heightInches - 72) * 1.5); // -1.5 per inch over 6'0"
  const weightPenalty = isHeavy ? 10 : 0;

  const agility = Math.max(min, Math.min(max, randomInt(min, max) - speedPenalty - weightPenalty));
  const acceleration = Math.max(min, Math.min(max, randomInt(min, max) - speedPenalty - weightPenalty));
  const top_speed = Math.max(min, Math.min(max, randomInt(min, max) - speedPenalty));

  // Jumping - random within range
  const jumping = randomInt(min, max);

  // Balance - harder for taller/heavier players (physics)
  const balancePenalty = Math.floor((heightInches - 72) / 2) + (isHeavy ? 5 : 0);
  const balance = Math.max(min, Math.min(max, randomInt(min, max) - balancePenalty));

  // Durability - heavier athletes tend to be more durable
  const durabilityBonus = isHeavy ? 10 : isLight ? -5 : 0;
  const durability = Math.max(min, Math.min(max, randomInt(min, max) + durabilityBonus));

  // Mental attributes - independent of physical build (pure random)
  const awareness = randomInt(min, max);
  const creativity = randomInt(min, max);
  const determination = randomInt(min, max);
  const bravery = randomInt(min, max);
  const consistency = randomInt(min, max);
  const composure = randomInt(min, max);
  const patience = randomInt(min, max);

  // Technical attributes - pure random (skill-based, not body-type dependent)
  const hand_eye_coordination = randomInt(min, max);
  const throw_accuracy = randomInt(min, max);
  const form_technique = randomInt(min, max);
  const finesse = randomInt(min, max);
  const deception = randomInt(min, max);
  const footwork = randomInt(min, max);

  // Mental attribute - teamwork
  const teamwork = randomInt(min, max);

  // Reactions - pure random
  const reactions = randomInt(min, max);

  // Stamina - lighter athletes have better endurance (physics-based)
  const stamina = Math.max(min, Math.min(max, randomInt(min, max) + (isLight ? 5 : isHeavy ? -5 : 0)));

  return {
    grip_strength,
    arm_strength,
    core_strength,
    agility,
    acceleration,
    top_speed,
    jumping,
    reactions,
    stamina,
    balance,
    height: clampedHeight,
    durability,
    awareness,
    creativity,
    determination,
    bravery,
    consistency,
    composure,
    patience,
    teamwork,
    hand_eye_coordination,
    throw_accuracy,
    form_technique,
    finesse,
    deception,
    footwork,
  };
}

/**
 * Create random potentials
 *
 * @param currentAttributes - Current attributes (potentials should be >= current)
 */
export function createRandomPotentials(currentAttributes?: PlayerAttributes): PlayerPotentials {
  if (!currentAttributes) {
    return {
      physical: randomInt(50, 100),
      mental: randomInt(50, 100),
      technical: randomInt(50, 100),
    };
  }

  // Calculate average current values
  const physicalAvg = Math.floor(
    (currentAttributes.grip_strength +
      currentAttributes.arm_strength +
      currentAttributes.core_strength +
      currentAttributes.agility +
      currentAttributes.acceleration +
      currentAttributes.top_speed +
      currentAttributes.jumping +
      currentAttributes.reactions +
      currentAttributes.stamina +
      currentAttributes.balance +
      currentAttributes.height +
      currentAttributes.durability) /
      12
  );

  const mentalAvg = Math.floor(
    (currentAttributes.awareness +
      currentAttributes.creativity +
      currentAttributes.determination +
      currentAttributes.bravery +
      currentAttributes.consistency +
      currentAttributes.composure +
      currentAttributes.patience +
      currentAttributes.teamwork) /
      8
  );

  const technicalAvg = Math.floor(
    (currentAttributes.hand_eye_coordination +
      currentAttributes.throw_accuracy +
      currentAttributes.form_technique +
      currentAttributes.finesse +
      currentAttributes.deception +
      currentAttributes.footwork) /
      6
  );

  return {
    physical: randomInt(physicalAvg, 100),
    mental: randomInt(mentalAvg, 100),
    technical: randomInt(technicalAvg, 100),
  };
}

/**
 * Create random peak ages
 */
export function createRandomPeakAges(): PeakAges {
  return {
    physical: randomInt(22, 30),
    technical: randomInt(24, 32),
    mental: randomInt(26, 34),
  };
}

/**
 * Create balanced training focus (33/33/34)
 */
export function createBalancedTrainingFocus(): TrainingFocus {
  return {
    physical: 33,
    mental: 33,
    technical: 34,
  };
}

/**
 * Create random training focus
 */
export function createRandomTrainingFocus(): TrainingFocus {
  const physical = randomInt(0, 100);
  const mental = randomInt(0, 100 - physical);
  const technical = 100 - physical - mental;

  return { physical, mental, technical };
}

/**
 * Create empty weekly XP
 */
export function createEmptyWeeklyXP(): WeeklyXP {
  return {
    physical: 0,
    mental: 0,
    technical: 0,
  };
}

/**
 * Create empty career stats
 */
export function createEmptyCareerStats(): PlayerCareerStats {
  return {
    gamesPlayed: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    totalPoints: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    minutesPlayed: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    basketball: {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
    },
  };
}

// =============================================================================
// PLAYER FACTORIES
// =============================================================================

/**
 * Create starter player (poor quality, OVR ~15-25 with variance)
 * Uses new variance system for "spiky" attribute profiles
 */
export function createStarterPlayer(overrides?: Partial<Player>): Player {
  const position = randomElement(['PG', 'SG', 'SF', 'PF', 'C']);

  // Generate height/weight with normal distribution
  const height = generateNormalHeight();
  const weight = generateWeightFromHeight(height);

  // Target OVR for starter players: 15-25 (poor quality)
  const targetOVR = randomInt(15, 25);
  const attributes = generateAttributesWithVariance(targetOVR, height, weight);
  const potentials = createRandomPotentials(attributes);
  const peakAges = createRandomPeakAges();

  return {
    id: uuidv4(),
    name: randomName(),
    age: randomInt(20, 28),
    dateOfBirth: new Date(Date.now() - randomInt(20, 28) * 365 * 24 * 60 * 60 * 1000),
    position,
    height,
    weight,
    nationality: 'USA',
    attributes,
    potentials,
    peakAges,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    seasonHistory: [],
    teamId: 'user',
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
    // Match fitness - persistent stamina between matches
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    ...overrides,
  };
}

/**
 * Create random player with target OVR range
 * Uses new variance system for "spiky" attribute profiles
 *
 * @param targetOVRMin - Minimum target OVR (default: 20)
 * @param targetOVRMax - Maximum target OVR (default: 80)
 * @param overrides - Optional property overrides
 */
export function createRandomPlayer(
  targetOVRMin: number = 20,
  targetOVRMax: number = 80,
  overrides?: Partial<Player>
): Player {
  const position = randomElement(['PG', 'SG', 'SF', 'PF', 'C']);

  // Generate height/weight with normal distribution
  const height = generateNormalHeight();
  const weight = generateWeightFromHeight(height);

  // Nationality
  const nationalities = [
    { name: 'USA', weight: 70 },
    { name: 'Spain', weight: 5 },
    { name: 'France', weight: 4 },
    { name: 'Germany', weight: 3 },
    { name: 'Serbia', weight: 3 },
    { name: 'Canada', weight: 3 },
    { name: 'Australia', weight: 3 },
    { name: 'Argentina', weight: 2 },
    { name: 'Lithuania', weight: 2 },
    { name: 'Greece', weight: 2 },
    { name: 'Brazil', weight: 1 },
    { name: 'Croatia', weight: 1 },
    { name: 'Turkey', weight: 1 },
  ];
  const totalWeight = nationalities.reduce((sum, n) => sum + n.weight, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  let nationality = 'USA';
  for (const n of nationalities) {
    cumulative += n.weight;
    if (rand <= cumulative) {
      nationality = n.name;
      break;
    }
  }

  // Generate attributes with variance for interesting profiles
  const targetOVR = randomInt(targetOVRMin, targetOVRMax);
  const attributes = generateAttributesWithVariance(targetOVR, height, weight);
  const potentials = createRandomPotentials(attributes);
  const peakAges = createRandomPeakAges();

  return {
    id: uuidv4(),
    name: randomName(),
    age: randomInt(18, 35),
    dateOfBirth: new Date(Date.now() - randomInt(18, 35) * 365 * 24 * 60 * 60 * 1000),
    position,
    height,
    weight,
    nationality,
    attributes,
    potentials,
    peakAges,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    seasonHistory: [],
    teamId: 'free_agent',
    acquisitionType: 'free_agent',
    acquisitionDate: new Date(),
    // Match fitness - persistent stamina between matches
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    ...overrides,
  };
}

/**
 * Create elite player (attributes 70-100)
 */
export function createElitePlayer(overrides?: Partial<Player>): Player {
  return createRandomPlayer(70, 100, {
    age: randomInt(25, 30),
    acquisitionType: 'trade',
    ...overrides,
  });
}

// =============================================================================
// CONTRACT FACTORIES
// =============================================================================

/**
 * Create random contract
 */
export function createRandomContract(
  playerId: string,
  teamId: string,
  overrides?: Partial<Contract>
): Contract {
  const contractLength = randomInt(1, 5);
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + contractLength);

  const salary = randomInt(50000, 500000);
  return {
    id: uuidv4(),
    playerId,
    teamId,
    salary,
    signingBonus: randomInt(0, 100000),
    contractLength,
    startDate,
    expiryDate,
    performanceBonuses: {},
    releaseClause: Math.random() > 0.5 ? randomInt(100000, 1000000) : null,
    salaryIncreases: Array(contractLength).fill(randomInt(0, 10)),
    agentFee: Math.round(salary * 0.05), // 5% agent fee
    clauses: [],
    squadRole: 'rotation_player' as const,
    loyaltyBonus: 0,
    ...overrides,
  };
}

// =============================================================================
// INJURY FACTORIES
// =============================================================================

/**
 * Create random injury
 */
export function createRandomInjury(playerId: string, overrides?: Partial<Injury>): Injury {
  const injuryType = randomElement(['minor', 'moderate', 'severe'] as const);
  const recoveryWeeks = injuryType === 'minor' ? randomInt(1, 2) : injuryType === 'moderate' ? randomInt(3, 6) : randomInt(7, 12);
  const occurredDate = new Date();
  const returnDate = new Date(occurredDate);
  returnDate.setDate(returnDate.getDate() + recoveryWeeks * 7);

  const injuryNames: Record<string, string[]> = {
    minor: ['Sprained Ankle', 'Bruised Knee', 'Minor Strain'],
    moderate: ['Hamstring Strain', 'Shoulder Sprain', 'Groin Pull'],
    severe: ['Torn ACL', 'Fractured Wrist', 'Herniated Disc'],
  };

  const names = (injuryNames[injuryType] || injuryNames.minor) as string[];

  return {
    id: uuidv4(),
    playerId,
    injuryType,
    injuryName: randomElement(names),
    occurredDate,
    recoveryWeeks,
    returnDate,
    doctorReport: `Player suffered ${injuryType} injury. Expected recovery: ${recoveryWeeks} weeks.`,
    ...overrides,
  };
}

// =============================================================================
// FRANCHISE FACTORIES
// =============================================================================

/**
 * Create default tactical settings
 */
export function createDefaultTacticalSettings(): TacticalSettings {
  return {
    pace: 'standard',
    manDefensePct: 50,
    scoringOptions: [],
    minutesAllotment: {},
    reboundingStrategy: 'standard',
    closers: [],
    timeoutStrategy: 'standard',
  };
}

/**
 * Create random team colors
 */
export function createRandomTeamColors(): TeamColors {
  return {
    primary: randomHexColor(),
    secondary: randomHexColor(),
  };
}

/**
 * Create starting budget ($1M total)
 */
export function createStartingBudget(): Budget {
  return {
    total: 1000000,
    allocated: {
      salaries: 0,
      coaching: 100000,
      medical: 50000,
      youthAcademy: 100000,
      scouting: 50000,
      freeAgentTryouts: 20000,
    },
    available: 680000,
  };
}

/**
 * Create random AI personality
 */
export function createRandomAIPersonality(): AIPersonality {
  const personalities = [
    {
      name: 'Develops Youth',
      traits: {
        youth_development_focus: randomInt(70, 90),
        spending_aggression: randomInt(20, 40),
        defensive_preference: randomInt(40, 60),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(30, 50),
        player_loyalty: randomInt(60, 80),
      },
    },
    {
      name: 'Splashes Cash',
      traits: {
        youth_development_focus: randomInt(10, 30),
        spending_aggression: randomInt(80, 100),
        defensive_preference: randomInt(30, 50),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(70, 90),
        player_loyalty: randomInt(30, 50),
      },
    },
    {
      name: 'Defensive Minded',
      traits: {
        youth_development_focus: randomInt(40, 60),
        spending_aggression: randomInt(40, 60),
        defensive_preference: randomInt(80, 100),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(20, 40),
        player_loyalty: randomInt(50, 70),
      },
    },
    {
      name: 'Multi-Sport Specialists',
      traits: {
        youth_development_focus: randomInt(50, 70),
        spending_aggression: randomInt(50, 70),
        defensive_preference: randomInt(40, 60),
        multi_sport_specialist: true,
        risk_tolerance: randomInt(60, 80),
        player_loyalty: randomInt(40, 60),
      },
    },
  ];

  return randomElement(personalities);
}

/**
 * Create user franchise
 */
export function createUserFranchise(
  name: string = 'My Team',
  colors?: TeamColors
): Franchise {
  return {
    id: 'user',
    name,
    colors: colors || createRandomTeamColors(),
    division: USER_STARTING_DIVISION, // Division 7 by default
    divisionHistory: [],
    budget: createStartingBudget(),
    rosterIds: [],
    youthAcademyIds: [],
    tacticalSettings: createDefaultTacticalSettings(),
    trainingSettings: {
      teamWide: createBalancedTrainingFocus(),
    },
    scoutingSettings: {
      budgetAllocation: 5, // 5%
      depthVsBreadth: 50, // Balanced
      targets: [],
    },
    aiPersonality: null,
    createdDate: new Date(),
    currentSeason: 1,
  };
}

/**
 * Create AI franchise
 *
 * @param division - Division number (1-10)
 */
export function createAIFranchise(division: number): Franchise {
  // Clamp division to valid range
  const validDivision = Math.max(1, Math.min(DIVISION_COUNT, division)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  // Scale budget based on division (higher divisions = more money)
  const budgetMultiplier = getDivisionBudgetMultiplier(validDivision);
  const baseBudget = createStartingBudget();

  return {
    id: uuidv4(),
    name: randomTeamName(),
    colors: createRandomTeamColors(),
    division: validDivision,
    divisionHistory: [],
    budget: {
      ...baseBudget,
      total: Math.round(baseBudget.total * budgetMultiplier),
      available: Math.round(baseBudget.available * budgetMultiplier),
    },
    rosterIds: [],
    youthAcademyIds: [],
    tacticalSettings: createDefaultTacticalSettings(),
    trainingSettings: {
      teamWide: createRandomTrainingFocus(),
    },
    scoutingSettings: {
      budgetAllocation: randomInt(3, 10),
      depthVsBreadth: randomInt(30, 70),
      targets: [],
    },
    aiPersonality: createRandomAIPersonality(),
    createdDate: new Date(),
    currentSeason: 1,
  };
}

/**
 * Get budget multiplier based on division tier
 *
 * Division 1 = 5x budget (elite teams)
 * Division 10 = 0.5x budget (developing teams)
 */
function getDivisionBudgetMultiplier(division: number): number {
  const multipliers: Record<number, number> = {
    1: 5.0,
    2: 4.0,
    3: 3.0,
    4: 2.5,
    5: 2.0,
    6: 1.5,
    7: 1.0,
    8: 0.8,
    9: 0.6,
    10: 0.5,
  };
  return multipliers[division] || 1.0;
}

/**
 * Get player OVR range based on division tier
 *
 * Division 1 = Elite players (60-90)
 * Division 10 = Developing players (15-40)
 */
function getDivisionPlayerQuality(division: number): { min: number; max: number } {
  const qualityRanges: Record<number, { min: number; max: number }> = {
    1: { min: 60, max: 90 },
    2: { min: 55, max: 85 },
    3: { min: 50, max: 80 },
    4: { min: 45, max: 75 },
    5: { min: 40, max: 70 },
    6: { min: 35, max: 65 },
    7: { min: 30, max: 55 },
    8: { min: 25, max: 50 },
    9: { min: 20, max: 45 },
    10: { min: 15, max: 40 },
  };
  return qualityRanges[division] || { min: 30, max: 55 };
}

// =============================================================================
// SEASON FACTORIES
// =============================================================================

/**
 * Create new season
 */
export function createNewSeason(seasonNumber: number): Season {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 6); // 6-month season

  return {
    id: uuidv4(),
    seasonNumber,
    startDate,
    endDate,
    status: 'pre_season',
    matches: [],
    standings: {},
    transferWindowOpen: true,
    currentWeek: 0,
  };
}

// =============================================================================
// YOUTH PROSPECT FACTORIES
// =============================================================================

/**
 * Create random youth prospect (15-18 years old)
 */
export function createYouthProspect(academyId: string): YouthProspect {
  const age = randomInt(15, 18);
  const position = randomElement(['PG', 'SG', 'SF', 'PF', 'C']);

  // Youth athletes: same height distribution but 10-20 lbs lighter (still growing)
  const height = generateNormalHeight();
  const adultWeight = generateWeightFromHeight(height);
  const weight = Math.round(adultWeight - randomInt(10, 20)); // Lighter, still developing

  // Nationality
  const nationalities = [
    { name: 'USA', weight: 70 },
    { name: 'Spain', weight: 5 },
    { name: 'France', weight: 4 },
    { name: 'Germany', weight: 3 },
    { name: 'Serbia', weight: 3 },
    { name: 'Canada', weight: 3 },
    { name: 'Australia', weight: 3 },
    { name: 'Argentina', weight: 2 },
    { name: 'Lithuania', weight: 2 },
    { name: 'Greece', weight: 2 },
    { name: 'Brazil', weight: 1 },
    { name: 'Croatia', weight: 1 },
    { name: 'Turkey', weight: 1 },
  ];
  const totalWeight = nationalities.reduce((sum, n) => sum + n.weight, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  let nationality = 'USA';
  for (const n of nationalities) {
    cumulative += n.weight;
    if (rand <= cumulative) {
      nationality = n.name;
      break;
    }
  }

  // Youth prospects: OVR 20-35 with variance (developing players)
  const targetOVR = randomInt(20, 35);
  const attributes = generateAttributesWithVariance(targetOVR, height, weight);
  const potentials = createRandomPotentials(attributes);
  const joinedDate = new Date();
  const mustPromoteBy = new Date();
  mustPromoteBy.setFullYear(mustPromoteBy.getFullYear() + (19 - age));

  return {
    id: uuidv4(),
    name: randomName(),
    age,
    dateOfBirth: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
    position,
    height,
    weight,
    nationality,
    attributes,
    potentials,
    joinedAcademyDate: joinedDate,
    mustPromoteBy,
    trainingFocus: null,
    academyId,
  };
}

// =============================================================================
// NEWS FACTORIES
// =============================================================================

/**
 * Create news item
 */
export function createNewsItem(
  type: NewsItem['type'],
  priority: NewsItem['priority'],
  title: string,
  message: string,
  scope: NewsItem['scope'] = 'team',
  teamId?: string,
  relatedEntityId?: string
): NewsItem {
  return {
    id: uuidv4(),
    type,
    priority,
    title,
    message,
    timestamp: new Date(),
    read: false,
    scope,
    teamId,
    relatedEntityId,
  };
}

// =============================================================================
// GAME SAVE FACTORIES
// =============================================================================

/**
 * Create new game save with initial state
 *
 * Creates a full 200-team league across 10 divisions.
 * User starts in Division 7 (middle tier, room to promote or relegate).
 *
 * @param saveName - Save name
 * @param teamName - User's team name
 * @param teamColors - User's team colors
 * @param fullLeague - If true, create all 200 teams (default). If false, create just user's division (20 teams).
 */
export function createNewGameSave(
  saveName: string,
  teamName: string,
  teamColors?: TeamColors,
  fullLeague: boolean = true
): GameSave {
  // Create user franchise (starts in division 7)
  const franchise = createUserFranchise(teamName, teamColors);
  franchise.division = USER_STARTING_DIVISION;

  const players: Player[] = [];
  const aiTeams: Franchise[] = [];

  // Create starter players for user team (division 7 quality)
  const userQuality = getDivisionPlayerQuality(USER_STARTING_DIVISION);
  for (let i = 0; i < STARTING_ROSTER_SIZE; i++) {
    const player = createRandomPlayer(userQuality.min, userQuality.max, {
      teamId: 'user',
      acquisitionType: 'starter',
    });
    players.push(player);
    franchise.rosterIds.push(player.id);
  }

  if (fullLeague) {
    // Create all 10 divisions × 20 teams = 200 teams total
    for (let division = 1; division <= DIVISION_COUNT; division++) {
      // Teams per division (minus 1 for user's division since user is there)
      const teamsInDivision = division === USER_STARTING_DIVISION
        ? TEAMS_PER_DIVISION - 1  // 19 AI teams + user
        : TEAMS_PER_DIVISION;     // 20 AI teams

      const quality = getDivisionPlayerQuality(division);

      for (let t = 0; t < teamsInDivision; t++) {
        const team = createAIFranchise(division);

        // Give each AI team the same starting roster size with division-appropriate quality
        for (let p = 0; p < STARTING_ROSTER_SIZE; p++) {
          const player = createRandomPlayer(quality.min, quality.max, {
            teamId: team.id,
            acquisitionType: 'starter',
          });
          players.push(player);
          team.rosterIds.push(player.id);
        }

        aiTeams.push(team);
      }
    }
  } else {
    // Create just user's division (19 AI teams)
    const quality = getDivisionPlayerQuality(USER_STARTING_DIVISION);
    for (let i = 0; i < TEAMS_PER_DIVISION - 1; i++) {
      const team = createAIFranchise(USER_STARTING_DIVISION);

      for (let j = 0; j < STARTING_ROSTER_SIZE; j++) {
        const player = createRandomPlayer(quality.min, quality.max, {
          teamId: team.id,
          acquisitionType: 'starter',
        });
        players.push(player);
        team.rosterIds.push(player.id);
      }

      aiTeams.push(team);
    }
  }

  // Create initial season
  const season = createNewSeason(1);

  // Initialize standings for all teams
  const allTeams = [franchise, ...aiTeams];
  for (const team of allTeams) {
    season.standings[team.id] = {
      teamId: team.id,
      wins: 0,
      losses: 0,
      basketball: { wins: 0, losses: 0 },
      baseball: { wins: 0, losses: 0 },
      soccer: { wins: 0, losses: 0 },
      rank: 0,
    };
  }

  // Create welcome news
  const totalTeams = fullLeague ? DIVISION_COUNT * TEAMS_PER_DIVISION : TEAMS_PER_DIVISION;
  const newsItems: NewsItem[] = [
    createNewsItem(
      'general',
      'important',
      'Welcome to Multiball!',
      `Welcome to your new franchise, the ${teamName}! You start in Division ${USER_STARTING_DIVISION} of ${DIVISION_COUNT} with ${STARTING_ROSTER_SIZE} athletes. ${totalTeams} teams compete across all divisions. Good luck!`
    ),
  ];

  return {
    version: '0.1.0',
    saveId: uuidv4(),
    saveName,
    lastSaved: new Date(),
    franchise,
    players,
    youthProspects: [],
    season,
    aiTeams,
    transferOffers: [],
    contractNegotiations: [],
    scoutingReports: [],
    scoutingTargets: [],
    newsItems,
    seasonHistory: [],
  };
}

/**
 * Create a lightweight game save for testing (20 teams only)
 */
export function createLightweightGameSave(
  saveName: string,
  teamName: string,
  teamColors?: TeamColors
): GameSave {
  return createNewGameSave(saveName, teamName, teamColors, false);
}

// =============================================================================
// FREE AGENT SALARY CALCULATION
// =============================================================================

/**
 * Calculate expected salary for a free agent based on quality and age
 *
 * Salary factors:
 * - Overall rating (primary factor) - higher OVR = higher salary
 * - Age modifier - prime age (26-30) commands premium, older players discount
 * - Potential modifier - young players with high potential get slight boost
 *
 * Salary ranges (annual):
 * - Washed (OVR 15-35): $50k - $200k
 * - Journeyman (OVR 35-55): $200k - $800k
 * - Quality (OVR 55-70): $800k - $3M
 * - Excellent (OVR 70-85): $3M - $10M
 * - Elite (OVR 85+): $10M+
 *
 * @param player - The player to calculate salary for
 * @param overallRating - Pre-calculated overall rating (optional)
 * @returns Expected annual salary in dollars
 */
export function calculateFreeAgentExpectedSalary(
  player: Player,
  overallRating?: number
): number {
  // Calculate overall if not provided
  const ovr = overallRating ?? calculateOVR(player.attributes as unknown as Record<string, number>);

  // Base salary from OVR using tiered scaling
  // Low OVR players are cheap, elite players are expensive
  let baseSalary: number;

  if (ovr < 35) {
    // Washed tier: $50k - $200k
    baseSalary = 50000 + (ovr - 15) * 7500;
  } else if (ovr < 55) {
    // Journeyman tier: $200k - $800k
    baseSalary = 200000 + (ovr - 35) * 30000;
  } else if (ovr < 70) {
    // Quality tier: $800k - $3M
    baseSalary = 800000 + (ovr - 55) * 146667;
  } else if (ovr < 85) {
    // Excellent tier: $3M - $10M
    baseSalary = 3000000 + (ovr - 70) * 466667;
  } else {
    // Elite tier: $10M+
    baseSalary = 10000000 + (ovr - 85) * 1000000;
  }

  // Age modifier
  // Prime (26-30): +10%
  // Young (20-25): base (potential upside balances inexperience)
  // Declining (31-33): -15%
  // Tail-end (34+): -30%
  let ageMultiplier = 1.0;
  if (player.age >= 26 && player.age <= 30) {
    ageMultiplier = 1.1; // Prime years premium
  } else if (player.age >= 31 && player.age <= 33) {
    ageMultiplier = 0.85; // Declining phase
  } else if (player.age >= 34) {
    ageMultiplier = 0.7; // Tail-end discount
  }

  // Young + high potential bonus
  // If under 25 with high potential average, small bump
  if (player.age < 25) {
    const potentialAvg = (
      player.potentials.physical +
      player.potentials.mental +
      player.potentials.technical
    ) / 3;

    if (potentialAvg >= 80) {
      ageMultiplier *= 1.15; // 15% premium for high potential youth
    } else if (potentialAvg >= 70) {
      ageMultiplier *= 1.08; // 8% premium for good potential
    }
  }

  // Apply modifier and round to nearest $10k
  const finalSalary = Math.round((baseSalary * ageMultiplier) / 10000) * 10000;

  // Minimum salary floor
  return Math.max(50000, finalSalary);
}

/**
 * Get salary tier label for display purposes
 */
export function getSalaryTierLabel(salary: number): string {
  if (salary >= 10000000) return 'Elite';
  if (salary >= 3000000) return 'Star';
  if (salary >= 800000) return 'Quality';
  if (salary >= 200000) return 'Rotation';
  return 'Minimum';
}

/**
 * Format salary for display (e.g., "$1.2M", "$500K")
 */
export function formatSalary(salary: number): string {
  if (salary >= 1000000) {
    const millions = salary / 1000000;
    return `$${millions.toFixed(1)}M`;
  }
  const thousands = salary / 1000;
  return `$${Math.round(thousands)}K`;
}
