/**
 * Scouting System
 *
 * Manages player scouting with attribute range accuracy.
 * - Scouting settings (budget, depth vs breadth)
 * - Attribute range calculator
 * - Overall sport rating ranges
 * - Weekly scouting throughput
 * - Scout report generation
 *
 * Design Philosophy:
 * - Breadth vs Depth tradeoff (scout many players broadly OR few players deeply)
 * - Budget affects accuracy
 * - Ranges provide uncertainty (no perfect information)
 * - Weekly scouting simulates ongoing process
 */

/**
 * Scouting settings
 */
export interface ScoutingSettings {
  depthSlider: number;              // 0.0 (breadth) to 1.0 (depth)
  scoutingBudgetMultiplier: number; // 0.5x to 2.0x (from budget allocation)
  simultaneousScouts: number;       // Number of scouts (from budget allocation)
}

/**
 * Attribute range (scouted value)
 */
export interface AttributeRange {
  attributeName: string;
  min: number;                      // Minimum estimated value
  max: number;                      // Maximum estimated value
  width: number;                    // Range width (max - min)
}

/**
 * Sport rating range
 */
export interface SportRatingRange {
  sport: string;
  min: number;
  max: number;
  width: number;
}

/**
 * Scout report for a player
 */
export interface ScoutReport {
  playerId: string;
  playerName: string;
  age: number;
  position: string;
  primarySport: string;

  // Attribute ranges (or exact values if scoutingDepth = 100)
  attributeRanges: AttributeRange[];

  // Sport rating ranges
  sportRatingRanges: SportRatingRange[];

  // Overall assessment
  estimatedOverallMin: number;
  estimatedOverallMax: number;

  // Metadata
  scoutedWeek: number;
  accuracyMultiplier: number;       // For UI display

  // Depth information
  scoutingDepth: number;            // 0-100, percentage of scouting completeness
  isTargeted: boolean;              // true if manually targeted (always 100% depth)
}

/**
 * Weekly scouting result
 */
export interface WeeklyScoutingResult {
  playersScoutedCount: number;
  reports: ScoutReport[];
}

// Scouting constants
export const BASE_RANGE_WIDTH = 20;                 // ±10 from true value
export const MIN_RANGE_WIDTH = 2;                   // Minimum range width
export const MAX_RANGE_WIDTH = 30;                  // Maximum range width
export const BASE_DEPTH_MULTIPLIER = 0.5;           // Base for depth calculation

// Standard attributes to scout (from player data model)
export const SCOUTABLE_ATTRIBUTES = [
  // Physical (12)
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
  // Mental (7)
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
  // Technical (6)
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'teamwork',
];

/**
 * Validates scouting settings
 *
 * @param settings - Scouting settings
 * @returns Validation result with errors
 */
export function validateScoutingSettings(settings: ScoutingSettings): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Depth slider must be 0.0 to 1.0
  if (settings.depthSlider < 0.0 || settings.depthSlider > 1.0) {
    errors.push('Depth slider must be between 0.0 (breadth) and 1.0 (depth)');
  }

  // Budget multiplier must be 0.5x to 2.0x
  if (settings.scoutingBudgetMultiplier < 0.5 || settings.scoutingBudgetMultiplier > 2.0) {
    errors.push('Scouting budget multiplier must be between 0.5x and 2.0x');
  }

  // Must have at least 1 scout
  if (settings.simultaneousScouts < 1) {
    errors.push('Must have at least 1 simultaneous scout');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates depth multiplier from depth slider
 *
 * @param depthSlider - Depth slider (0.0 to 1.0)
 * @returns Depth multiplier (0.5x to 1.5x)
 */
export function calculateDepthMultiplier(depthSlider: number): number {
  return BASE_DEPTH_MULTIPLIER + (depthSlider * 1.0);
}

// Maximum accuracy multiplier (corresponds to 100% display accuracy)
export const MAX_ACCURACY_MULTIPLIER = 2.5;

/**
 * Calculates accuracy multiplier
 *
 * Formula: accuracyMultiplier = scoutingBudgetMultiplier × depthMultiplier
 * Capped at 2.5x (100% accuracy) - no benefit to investing beyond this point.
 *
 * @param scoutingBudgetMultiplier - Budget multiplier (0.5x to 2.0x)
 * @param depthSlider - Depth slider (0.0 to 1.0)
 * @returns Accuracy multiplier (0.25x to 2.5x, capped)
 */
export function calculateAccuracyMultiplier(
  scoutingBudgetMultiplier: number,
  depthSlider: number
): number {
  const depthMultiplier = calculateDepthMultiplier(depthSlider);
  const rawMultiplier = scoutingBudgetMultiplier * depthMultiplier;
  // Cap at 2.5x (100% accuracy) - no benefit past this point
  return Math.min(rawMultiplier, MAX_ACCURACY_MULTIPLIER);
}

/**
 * Calculates range width for scouting
 *
 * Formula: rangeWidth = baseRangeWidth / accuracyMultiplier
 * Clamped to: [MIN_RANGE_WIDTH, MAX_RANGE_WIDTH]
 *
 * @param accuracyMultiplier - Accuracy multiplier
 * @returns Range width in points
 */
export function calculateRangeWidth(accuracyMultiplier: number): number {
  const rawWidth = BASE_RANGE_WIDTH / accuracyMultiplier;
  return Math.max(MIN_RANGE_WIDTH, Math.min(MAX_RANGE_WIDTH, rawWidth));
}

/**
 * Calculates number of players scouted per week
 *
 * Formula: playersScoutedPerWeek = simultaneousScouts / (depthSlider + 0.5)
 *
 * @param simultaneousScouts - Number of scouts
 * @param depthSlider - Depth slider (0.0 to 1.0)
 * @returns Players scouted per week (rounded down)
 */
export function calculatePlayersScoutedPerWeek(
  simultaneousScouts: number,
  depthSlider: number
): number {
  return Math.floor(simultaneousScouts / (depthSlider + 0.5));
}

/**
 * Generates an attribute range for a given true value
 *
 * @param attributeName - Attribute name
 * @param trueValue - True attribute value (0-100)
 * @param rangeWidth - Range width
 * @returns Attribute range
 */
export function generateAttributeRange(
  attributeName: string,
  trueValue: number,
  rangeWidth: number
): AttributeRange {
  const halfWidth = rangeWidth / 2;
  const rawMin = trueValue - halfWidth;
  const rawMax = trueValue + halfWidth;

  // Clamp to 0-100
  const min = Math.max(0, Math.round(rawMin));
  const max = Math.min(100, Math.round(rawMax));

  return {
    attributeName,
    min,
    max,
    width: max - min,
  };
}

/**
 * Generates a sport rating range for a given true value
 *
 * @param sport - Sport name
 * @param trueValue - True sport rating (0-100)
 * @param rangeWidth - Range width
 * @returns Sport rating range
 */
export function generateSportRatingRange(
  sport: string,
  trueValue: number,
  rangeWidth: number
): SportRatingRange {
  const halfWidth = rangeWidth / 2;
  const rawMin = trueValue - halfWidth;
  const rawMax = trueValue + halfWidth;

  // Clamp to 0-100
  const min = Math.max(0, Math.round(rawMin));
  const max = Math.min(100, Math.round(rawMax));

  return {
    sport,
    min,
    max,
    width: max - min,
  };
}

/**
 * Generates a complete scout report for a player
 *
 * @param playerId - Player ID
 * @param playerName - Player name
 * @param age - Player age
 * @param position - Player position
 * @param primarySport - Primary sport
 * @param trueAttributes - True attribute values
 * @param trueSportRatings - True sport ratings
 * @param settings - Scouting settings
 * @param currentWeek - Current game week
 * @param options - Optional depth/targeting settings
 * @returns Scout report
 */
export function generateScoutReport(
  playerId: string,
  playerName: string,
  age: number,
  position: string,
  primarySport: string,
  trueAttributes: Record<string, number>,
  trueSportRatings: Record<string, number>,
  settings: ScoutingSettings,
  currentWeek: number,
  options?: { scoutingDepth?: number; isTargeted?: boolean }
): ScoutReport {
  // Determine scouting depth - targeted players always get 100%
  const isTargeted = options?.isTargeted ?? false;
  const scoutingDepth = isTargeted ? 100 : (options?.scoutingDepth ?? 100);

  // Calculate accuracy and range width
  const accuracyMultiplier = calculateAccuracyMultiplier(
    settings.scoutingBudgetMultiplier,
    settings.depthSlider
  );

  // For 100% depth, range width is 0 (exact values)
  // For partial depth, scale range width based on depth percentage
  let rangeWidth: number;
  if (scoutingDepth >= 100) {
    rangeWidth = 0; // Exact values
  } else {
    // Lower depth = wider ranges
    // At 25% depth, range is at maximum (30)
    // At 75% depth, range is moderate
    const depthFactor = scoutingDepth / 100;
    const baseWidth = calculateRangeWidth(accuracyMultiplier);
    rangeWidth = Math.round(baseWidth * (1 + (1 - depthFactor) * 2));
    rangeWidth = Math.min(MAX_RANGE_WIDTH, rangeWidth);
  }

  // Generate attribute ranges (or exact values if rangeWidth is 0)
  const attributeRanges: AttributeRange[] = [];
  for (const attrName of SCOUTABLE_ATTRIBUTES) {
    const attrValue = trueAttributes[attrName];
    if (attrValue !== undefined) {
      if (rangeWidth === 0) {
        // Exact value - min and max are the same
        const value = Math.round(attrValue);
        attributeRanges.push({
          attributeName: attrName,
          min: value,
          max: value,
          width: 0,
        });
      } else {
        attributeRanges.push(
          generateAttributeRange(attrName, attrValue, rangeWidth)
        );
      }
    }
  }

  // Generate sport rating ranges
  const sportRatingRanges: SportRatingRange[] = [];
  for (const sport in trueSportRatings) {
    const sportValue = trueSportRatings[sport];
    if (sportValue !== undefined) {
      if (rangeWidth === 0) {
        // Exact value
        const value = Math.round(sportValue);
        sportRatingRanges.push({
          sport,
          min: value,
          max: value,
          width: 0,
        });
      } else {
        sportRatingRanges.push(
          generateSportRatingRange(sport, sportValue, rangeWidth)
        );
      }
    }
  }

  // Estimate overall rating range (average of sport ratings)
  const overallMin = sportRatingRanges.length > 0
    ? Math.round(sportRatingRanges.reduce((sum, r) => sum + r.min, 0) / sportRatingRanges.length)
    : 0;
  const overallMax = sportRatingRanges.length > 0
    ? Math.round(sportRatingRanges.reduce((sum, r) => sum + r.max, 0) / sportRatingRanges.length)
    : 0;

  return {
    playerId,
    playerName,
    age,
    position,
    primarySport,
    attributeRanges,
    sportRatingRanges,
    estimatedOverallMin: overallMin,
    estimatedOverallMax: overallMax,
    scoutedWeek: currentWeek,
    accuracyMultiplier,
    scoutingDepth,
    isTargeted,
  };
}

/**
 * Simulates a week of scouting
 *
 * @param availablePlayers - List of players available to scout
 * @param settings - Scouting settings
 * @param currentWeek - Current game week
 * @returns Weekly scouting result
 */
export function simulateWeeklyScouting(
  availablePlayers: Array<{
    id: string;
    name: string;
    age: number;
    position: string;
    primarySport: string;
    attributes: Record<string, number>;
    sportRatings: Record<string, number>;
  }>,
  settings: ScoutingSettings,
  currentWeek: number
): WeeklyScoutingResult {
  const playersToScout = calculatePlayersScoutedPerWeek(
    settings.simultaneousScouts,
    settings.depthSlider
  );

  // Scout up to playersToScout players
  const reports: ScoutReport[] = [];
  const count = Math.min(playersToScout, availablePlayers.length);

  for (let i = 0; i < count; i++) {
    const player = availablePlayers[i];
    if (!player) continue;
    const report = generateScoutReport(
      player.id,
      player.name,
      player.age,
      player.position,
      player.primarySport,
      player.attributes,
      player.sportRatings,
      settings,
      currentWeek
    );
    reports.push(report);
  }

  return {
    playersScoutedCount: count,
    reports,
  };
}

/**
 * Calculates confidence level based on range width
 *
 * @param rangeWidth - Range width
 * @returns Confidence level ('Low', 'Medium', 'High', 'Very High')
 */
export function getConfidenceLevel(rangeWidth: number): string {
  if (rangeWidth <= 5) return 'Very High';
  if (rangeWidth <= 10) return 'High';
  if (rangeWidth <= 20) return 'Medium';
  return 'Low';
}

/**
 * Calculates the expected value (midpoint) of a range
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Expected value (midpoint)
 */
export function getExpectedValue(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

/**
 * Formats an attribute range for display
 *
 * @param range - Attribute range
 * @returns Formatted string (e.g., "Agility: 68-82 (75)")
 */
export function formatAttributeRange(range: AttributeRange): string {
  const expected = getExpectedValue(range.min, range.max);
  return `${range.attributeName}: ${range.min}-${range.max} (${expected})`;
}

/**
 * Formats a sport rating range for display
 *
 * @param range - Sport rating range
 * @returns Formatted string (e.g., "Basketball: 70-85 (78)")
 */
export function formatSportRatingRange(range: SportRatingRange): string {
  const expected = getExpectedValue(range.min, range.max);
  return `${range.sport}: ${range.min}-${range.max} (${expected})`;
}

/**
 * Calculates scouting depth percentage from depth slider
 *
 * Depth slider 0-1 maps to:
 * - 0 (breadth) = 25% depth per player, scout many players
 * - 0.5 (balanced) = 62.5% depth
 * - 1 (depth) = 100% depth, scout fewer players
 *
 * @param depthSlider - Depth slider value (0.0 to 1.0)
 * @returns Depth percentage (25 to 100)
 */
export function calculateDepthPercent(depthSlider: number): number {
  return Math.round(25 + (depthSlider * 75));
}

/**
 * Gets display accuracy percentage, capped at 100%
 *
 * The accuracy multiplier internally can go higher, but for display
 * purposes we cap it at 100% since that's maximum useful accuracy.
 *
 * @param accuracyMultiplier - The raw accuracy multiplier
 * @returns Display percentage (0-100, capped)
 */
export function getDisplayAccuracy(accuracyMultiplier: number): number {
  // 1.0x accuracy = 40% display (base)
  // 2.5x accuracy = 100% display (max)
  const rawPercent = Math.round(accuracyMultiplier * 40);
  return Math.min(100, rawPercent);
}

/**
 * Calculates a player's estimated transfer value based on attributes and age
 *
 * Younger players with high attributes are most valuable.
 * Value decreases significantly after peak years (25-28).
 *
 * @param overall - Player's overall rating (0-100)
 * @param age - Player's age
 * @returns Estimated transfer value in dollars
 */
export function calculateTransferValue(overall: number, age: number): number {
  // Base value calculation based on overall rating
  // Rating 50 = ~$1M, Rating 80 = ~$15M, Rating 95 = ~$50M+
  const baseValue = Math.pow(overall / 50, 3) * 1000000;

  // Age multiplier - peak at 25-27, decreasing after
  const ageMultiplier = getAgeMultiplier(age);

  return Math.round(baseValue * ageMultiplier);
}

/**
 * Gets age multiplier for transfer value calculation
 *
 * @param age - Player's age
 * @returns Age multiplier (0.2 to 1.3)
 */
export function getAgeMultiplier(age: number): number {
  if (age <= 22) return 1.3;      // Young potential
  if (age <= 25) return 1.2;      // Prime approaching
  if (age <= 28) return 1.0;      // Peak years
  if (age <= 31) return 0.7;      // Declining
  if (age <= 34) return 0.4;      // Late career
  return 0.2;                      // Veteran
}

/**
 * Options for generating a scout report
 */
export interface ScoutReportOptions {
  /** Scouting depth percentage (0-100). 100 = exact values, <100 = ranges */
  scoutingDepth?: number;
  /** Whether this player was manually targeted (always 100% depth) */
  isTargeted?: boolean;
}
