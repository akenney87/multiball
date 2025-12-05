/**
 * Youth Academy System
 *
 * Manages youth prospect scouting and academy roster.
 *
 * Key Concepts:
 * - Academy starts EMPTY - user signs prospects to fill it
 * - Every 4 weeks, new scouting reports are presented
 * - Attributes shown as RANGES (e.g., 20-40), not exact values
 * - User can "Continue Scouting" to narrow ranges (risk: rival may sign)
 * - Signing costs $100k/year (~$2k/week) per prospect
 * - No positions - Multiball is positionless until user assigns
 * - Potential is HIDDEN from user (system only)
 *
 * Scouting Timeline:
 * - Week 0: Initial report (20-point range)
 * - Week 4: First refinement (14-point range)
 * - Week 8: Second refinement (10-point range)
 * - Week 12: Final refinement (6-point range)
 */

import { Nationality, NATIONALITIES } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Attribute range shown in scouting reports
 */
export interface AttributeRange {
  min: number;
  max: number;
}

/**
 * Scouting report - prospect being evaluated (not yet signed)
 */
export interface ScoutingReport {
  id: string;
  name: string;
  age: number;
  height: number;                        // cm
  weight: number;                        // kg
  nationality: Nationality;

  // Attribute ranges (what user sees)
  attributeRanges: Record<string, AttributeRange>;

  // Hidden actual values (revealed when signed)
  actualAttributes: Record<string, number>;

  // Hidden potential (never shown to user)
  potentials: {
    physical: number;
    mental: number;
    technical: number;
  };

  // Scouting progress
  weeksScouted: number;                  // 0, 4, 8, or 12
  scoutingStartWeek: number;             // When scouting began
  lastUpdatedWeek: number;               // When the report was last updated
  continueScouting: boolean;             // User wants to keep scouting (persists until max)

  // Status
  status: 'available' | 'scouting' | 'signed_by_rival' | 'signed';
}

/**
 * Academy prospect - signed to the academy
 */
export interface AcademyProspect {
  id: string;
  name: string;
  age: number;
  height: number;                        // cm
  weight: number;                        // kg
  nationality: Nationality;

  // Actual attributes (revealed after signing)
  attributes: Record<string, number>;

  // Hidden potential (never shown to user)
  potentials: {
    physical: number;
    mental: number;
    technical: number;
  };

  // Academy tracking
  signedWeek: number;                    // When signed to academy
  yearsInAcademy: number;
  weeklyCost: number;                    // ~$2k/week ($100k/year)

  status: 'active' | 'promoted' | 'released';
}

/**
 * Academy capacity and costs
 */
export interface AcademyInfo {
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  weeklyMaintenanceCost: number;         // Total cost of all signed prospects
  yearlyMaintenanceCost: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Academy capacity (based on budget)
export const BASE_CAPACITY = 3;                    // Minimum slots
export const SLOTS_PER_BUDGET_TIER = 2;            // Additional slots per budget tier
export const BUDGET_TIER_COST = 100000;            // $100k per tier

// Scouting
export const SCOUTING_CYCLE_WEEKS = 4;             // New reports every 4 weeks
export const BASE_REPORTS_PER_CYCLE = 2;           // Minimum reports shown
export const MAX_REPORTS_PER_CYCLE = 6;            // Maximum reports shown
export const MAX_SCOUTING_WEEKS = 12;              // Maximum scouting duration

// Attribute range narrowing (points of uncertainty)
export const INITIAL_RANGE = 20;                   // Starting range (e.g., 30-50)
export const RANGE_AFTER_4_WEEKS = 14;
export const RANGE_AFTER_8_WEEKS = 10;
export const RANGE_AFTER_12_WEEKS = 6;

// Rival signing risk (per 4-week period while scouting)
export const RIVAL_SIGN_CHANCE_BASE = 0.10;        // 10% base chance
export const RIVAL_SIGN_CHANCE_HIGH_POTENTIAL = 0.20; // 20% for high potential

// Signing costs
export const YEARLY_PROSPECT_COST = 100000;        // $100k/year per prospect
export const WEEKLY_PROSPECT_COST = Math.round(YEARLY_PROSPECT_COST / 52); // ~$1,923/week

// Age constants
export const MIN_PROSPECT_AGE = 14;
export const MAX_PROSPECT_AGE = 17;
export const PROMOTION_AGE = 18;                   // Must promote/release at 18

// Attribute constants
export const YOUTH_ATTRIBUTE_MIN = 15;
export const YOUTH_ATTRIBUTE_MAX = 45;
export const YOUTH_POTENTIAL_MIN = 60;
export const YOUTH_POTENTIAL_MAX = 95;

// Physical attributes - YOUTH (ages 14-17, still growing)
// Using inches internally, convert to cm for display
// Youth are shorter than pros: mean 70" (5'10") vs pro mean 74" (6'2")
export const YOUTH_HEIGHT_MEAN_INCHES = 70;        // 5'10" mean for youth
export const YOUTH_HEIGHT_STDDEV_INCHES = 4;       // 4" standard deviation
export const YOUTH_HEIGHT_MIN_INCHES = 60;         // 5'0" minimum
export const YOUTH_HEIGHT_MAX_INCHES = 80;         // 6'8" maximum (youth rarely taller)

// Attribute categories
export const PHYSICAL_ATTRIBUTES = [
  'grip_strength', 'arm_strength', 'core_strength', 'agility',
  'acceleration', 'top_speed', 'jumping', 'reactions',
  'stamina', 'balance', 'durability',
];

export const MENTAL_ATTRIBUTES = [
  'awareness', 'creativity', 'determination', 'bravery',
  'consistency', 'composure', 'patience',
];

export const TECHNICAL_ATTRIBUTES = [
  'hand_eye_coordination', 'throw_accuracy', 'form_technique',
  'finesse', 'deception', 'teamwork',
];

export const ALL_ATTRIBUTES = [
  ...PHYSICAL_ATTRIBUTES,
  ...MENTAL_ATTRIBUTES,
  ...TECHNICAL_ATTRIBUTES,
];

// =============================================================================
// NAME GENERATION
// =============================================================================

const FIRST_NAMES = [
  'Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Oliver', 'James', 'Benjamin', 'Elijah', 'William',
  'Michael', 'Alexander', 'Daniel', 'Matthew', 'Anthony', 'Joseph', 'David', 'Andrew', 'Joshua', 'Christopher',
  'Marcus', 'Jordan', 'Tyler', 'Brandon', 'Austin', 'Jaylen', 'Malik', 'Darius', 'Terrence', 'Isaiah',
];

const LAST_NAMES = [
  'Wilson', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez',
  'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King',
  'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Moore', 'Taylor', 'Johnson',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): number {
  return Math.abs(Math.sin(seed * 9999)) % 1;
}

/**
 * Generate random integer in range (uniform distribution)
 */
function randomInt(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

/**
 * Generate normal distribution value using Box-Muller transform (seeded)
 * Returns value with given mean and standard deviation
 */
function seededNormalRandom(mean: number, stdDev: number, seed: number): number {
  const u1 = Math.max(0.0001, seededRandom(seed));     // Avoid log(0)
  const u2 = seededRandom(seed + 1);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Generate youth prospect height using normal distribution
 * Youth (15-18) are shorter than pros: mean 5'10" vs pro mean 6'2"
 * Returns height in inches
 */
function generateYouthHeight(seed: number): number {
  const height = Math.round(seededNormalRandom(
    YOUTH_HEIGHT_MEAN_INCHES,
    YOUTH_HEIGHT_STDDEV_INCHES,
    seed
  ));
  // Clamp to realistic youth range
  return Math.max(YOUTH_HEIGHT_MIN_INCHES, Math.min(YOUTH_HEIGHT_MAX_INCHES, height));
}

/**
 * Generate weight correlated with height
 * Youth are 10-20 lbs lighter than adults
 * Returns weight in pounds
 */
function generateYouthWeight(heightInches: number, seed: number): number {
  // Base formula: ~4.5 lbs per inch above 60"
  // Starting lower for youth (they're still developing)
  const baseWeight = 120 + (heightInches - 60) * 4.0;

  // Variance based on height
  const varianceRange = 10 + Math.round((heightInches - 60) * 0.5);

  // Generate weight with variance
  const variance = randomInt(-varianceRange, varianceRange, seed);
  const weight = Math.round(baseWeight + variance);

  // Clamp to realistic range (100-250 lbs for youth)
  return Math.max(100, Math.min(250, weight));
}

/**
 * Convert inches to centimeters
 */
function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54);
}

/**
 * Convert pounds to kilograms
 */
function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.205);
}

/**
 * Calculate range width based on weeks scouted
 */
export function getRangeWidth(weeksScouted: number): number {
  if (weeksScouted >= 12) return RANGE_AFTER_12_WEEKS;
  if (weeksScouted >= 8) return RANGE_AFTER_8_WEEKS;
  if (weeksScouted >= 4) return RANGE_AFTER_4_WEEKS;
  return INITIAL_RANGE;
}

/**
 * Generate attribute range centered on actual value
 */
function generateAttributeRange(actualValue: number, rangeWidth: number): AttributeRange {
  const halfRange = Math.floor(rangeWidth / 2);
  let min = actualValue - halfRange;
  let max = actualValue + halfRange;

  // Clamp to valid range
  if (min < 1) {
    min = 1;
    max = min + rangeWidth;
  }
  if (max > 99) {
    max = 99;
    min = max - rangeWidth;
  }

  return { min, max };
}

/**
 * Calculate academy capacity based on budget
 */
export function calculateAcademyCapacity(budgetAmount: number): number {
  if (budgetAmount < BUDGET_TIER_COST) {
    return BASE_CAPACITY;
  }
  const additionalTiers = Math.floor(budgetAmount / BUDGET_TIER_COST);
  return BASE_CAPACITY + (additionalTiers * SLOTS_PER_BUDGET_TIER);
}

/**
 * Calculate number of scouting reports per cycle based on budget
 */
export function calculateReportsPerCycle(budgetAmount: number): number {
  const tiers = Math.floor(budgetAmount / BUDGET_TIER_COST);
  const reports = BASE_REPORTS_PER_CYCLE + tiers;
  return Math.min(reports, MAX_REPORTS_PER_CYCLE);
}

// =============================================================================
// SCOUTING REPORT GENERATION
// =============================================================================

/**
 * Generate a new scouting report (prospect to evaluate)
 */
export function generateScoutingReport(
  id: string,
  currentWeek: number,
  qualityMultiplier: number = 1.0,
  seed: number
): ScoutingReport {
  // Generate basic info
  const age = randomInt(MIN_PROSPECT_AGE, MAX_PROSPECT_AGE, seed);

  // Generate height with normal distribution (most common 5'10", range 5'0" to 6'8")
  const heightInches = generateYouthHeight(seed + 1);
  const height = inchesToCm(heightInches);

  // Generate weight correlated with height
  const weightLbs = generateYouthWeight(heightInches, seed + 2);
  const weight = lbsToKg(weightLbs);

  // Generate nationality
  const nationalityIndex = randomInt(0, NATIONALITIES.length - 1, seed + 3);
  const nationality = NATIONALITIES[nationalityIndex] || 'American';

  // Generate name
  const firstNameIndex = randomInt(0, FIRST_NAMES.length - 1, seed + 4);
  const lastNameIndex = randomInt(0, LAST_NAMES.length - 1, seed + 5);
  const firstName = FIRST_NAMES[firstNameIndex] || 'John';
  const lastName = LAST_NAMES[lastNameIndex] || 'Smith';
  const name = `${firstName} ${lastName}`;

  // Generate actual attributes (hidden from user)
  const baseMin = Math.round(YOUTH_ATTRIBUTE_MIN * qualityMultiplier);
  const baseMax = Math.round(YOUTH_ATTRIBUTE_MAX * qualityMultiplier);

  const actualAttributes: Record<string, number> = {};
  ALL_ATTRIBUTES.forEach((attr, index) => {
    actualAttributes[attr] = randomInt(
      Math.max(1, baseMin),
      Math.min(99, baseMax),
      seed + 100 + index
    );
  });

  // Generate potentials (hidden from user)
  const physicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 200);
  const mentalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 201);
  const technicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 202);

  // Generate initial attribute ranges (what user sees)
  const rangeWidth = getRangeWidth(0);
  const attributeRanges: Record<string, AttributeRange> = {};
  ALL_ATTRIBUTES.forEach((attr) => {
    attributeRanges[attr] = generateAttributeRange(actualAttributes[attr] ?? 30, rangeWidth);
  });

  return {
    id,
    name,
    age,
    height,
    weight,
    nationality,
    attributeRanges,
    actualAttributes,
    potentials: {
      physical: physicalPotential,
      mental: mentalPotential,
      technical: technicalPotential,
    },
    weeksScouted: 0,
    scoutingStartWeek: currentWeek,
    lastUpdatedWeek: currentWeek,
    continueScouting: false,
    status: 'available',
  };
}

/**
 * Generate batch of scouting reports for a cycle
 */
export function generateScoutingReports(
  currentWeek: number,
  count: number,
  qualityMultiplier: number,
  seed: number
): ScoutingReport[] {
  const reports: ScoutingReport[] = [];
  for (let i = 0; i < count; i++) {
    const report = generateScoutingReport(
      `scout_${currentWeek}_${i}`,
      currentWeek,
      qualityMultiplier,
      seed + i * 1000
    );
    reports.push(report);
  }
  return reports;
}

// =============================================================================
// SCOUTING PROGRESSION
// =============================================================================

/**
 * Advance scouting by 4 weeks (narrow ranges or check for rival signing)
 * Returns the updated report. Check status === 'signed_by_rival' to detect rival signing.
 */
export function advanceScoutingReport(
  report: ScoutingReport,
  currentWeek: number,
  seed: number
): ScoutingReport {
  // If not continuing scouting, mark as replaced (will be filtered out)
  if (!report.continueScouting) {
    return report;
  }

  // Check if rival signed the prospect
  const avgPotential = (report.potentials.physical + report.potentials.mental + report.potentials.technical) / 3;
  const rivalChance = avgPotential > 80 ? RIVAL_SIGN_CHANCE_HIGH_POTENTIAL : RIVAL_SIGN_CHANCE_BASE;

  if (seededRandom(seed) < rivalChance) {
    return {
      ...report,
      status: 'signed_by_rival',
      continueScouting: false,
      lastUpdatedWeek: currentWeek,
    };
  }

  // Advance scouting
  const newWeeksScouted = Math.min(report.weeksScouted + SCOUTING_CYCLE_WEEKS, MAX_SCOUTING_WEEKS);
  const newRangeWidth = getRangeWidth(newWeeksScouted);

  // Narrow attribute ranges
  const newRanges: Record<string, AttributeRange> = {};
  ALL_ATTRIBUTES.forEach((attr) => {
    newRanges[attr] = generateAttributeRange(report.actualAttributes[attr] ?? 30, newRangeWidth);
  });

  // Continue scouting stays true until max scouting reached
  const reachedMax = newWeeksScouted >= MAX_SCOUTING_WEEKS;

  return {
    ...report,
    weeksScouted: newWeeksScouted,
    attributeRanges: newRanges,
    lastUpdatedWeek: currentWeek,
    continueScouting: reachedMax ? false : true, // Keep scouting until max
    status: reachedMax ? 'available' : 'scouting', // Back to available when max reached
  };
}

/**
 * Mark report for continued scouting (persists until max reached)
 */
export function requestContinueScouting(report: ScoutingReport): ScoutingReport {
  if (report.weeksScouted >= MAX_SCOUTING_WEEKS) {
    return report; // Already at max scouting
  }
  return {
    ...report,
    continueScouting: true,
    status: 'scouting',
  };
}

/**
 * Stop scouting a prospect (user can cancel)
 */
export function stopScouting(report: ScoutingReport): ScoutingReport {
  return {
    ...report,
    continueScouting: false,
    status: 'available',
  };
}

/**
 * Get the age of a report in weeks (since last update)
 */
export function getReportAge(report: ScoutingReport, currentWeek: number): number {
  return currentWeek - report.lastUpdatedWeek;
}

/**
 * Check if report is at max scouting depth
 */
export function isMaxScouted(report: ScoutingReport): boolean {
  return report.weeksScouted >= MAX_SCOUTING_WEEKS;
}

// =============================================================================
// SIGNING PROSPECTS
// =============================================================================

/**
 * Sign a scouted prospect to the academy
 */
export function signProspectToAcademy(
  report: ScoutingReport,
  currentWeek: number
): AcademyProspect {
  return {
    id: report.id,
    name: report.name,
    age: report.age,
    height: report.height,
    weight: report.weight,
    nationality: report.nationality,
    attributes: { ...report.actualAttributes },
    potentials: { ...report.potentials },
    signedWeek: currentWeek,
    yearsInAcademy: 0,
    weeklyCost: WEEKLY_PROSPECT_COST,
    status: 'active',
  };
}

/**
 * Check if academy has capacity for a new prospect
 */
export function canSignProspect(
  academyProspects: AcademyProspect[],
  capacity: number
): boolean {
  const activeCount = academyProspects.filter(p => p.status === 'active').length;
  return activeCount < capacity;
}

// =============================================================================
// ACADEMY MANAGEMENT
// =============================================================================

/**
 * Get academy info
 */
export function getAcademyInfo(
  budgetAmount: number,
  academyProspects: AcademyProspect[]
): AcademyInfo {
  const totalSlots = calculateAcademyCapacity(budgetAmount);
  const activeProspects = academyProspects.filter(p => p.status === 'active');
  const usedSlots = activeProspects.length;
  const weeklyMaintenanceCost = activeProspects.reduce((sum, p) => sum + p.weeklyCost, 0);

  return {
    totalSlots,
    usedSlots,
    availableSlots: Math.max(0, totalSlots - usedSlots),
    weeklyMaintenanceCost,
    yearlyMaintenanceCost: weeklyMaintenanceCost * 52,
  };
}

/**
 * Promote prospect to main squad
 */
export function promoteProspect(prospect: AcademyProspect): AcademyProspect {
  return {
    ...prospect,
    status: 'promoted',
  };
}

/**
 * Release prospect from academy
 */
export function releaseProspect(prospect: AcademyProspect): AcademyProspect {
  return {
    ...prospect,
    status: 'released',
  };
}

/**
 * Advance prospect age by one year
 */
export function advanceProspectAge(prospect: AcademyProspect): AcademyProspect {
  return {
    ...prospect,
    age: prospect.age + 1,
    yearsInAcademy: prospect.yearsInAcademy + 1,
  };
}

/**
 * Get prospects that need action (turning 19)
 */
export function getProspectsNeedingAction(prospects: AcademyProspect[]): AcademyProspect[] {
  return prospects.filter(p => p.age >= MAX_PROSPECT_AGE && p.status === 'active');
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Format attribute range for display
 */
export function formatAttributeRange(range: AttributeRange): string {
  return `${range.min}-${range.max}`;
}

/**
 * Format height for display (cm to ft'in")
 */
export function formatHeight(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

/**
 * Format weight for display (kg to lbs)
 */
export function formatWeight(kg: number): string {
  const lbs = Math.round(kg * 2.205);
  return `${lbs} lbs`;
}

/**
 * Get scouting progress description
 */
export function getScoutingProgressDescription(weeksScouted: number): string {
  if (weeksScouted === 0) return 'Initial Report';
  if (weeksScouted === 4) return 'Moderate Insight';
  if (weeksScouted === 8) return 'Good Understanding';
  if (weeksScouted >= 12) return 'Comprehensive Report';
  return 'In Progress';
}

/**
 * Get range uncertainty description
 */
export function getRangeUncertaintyDescription(weeksScouted: number): string {
  const width = getRangeWidth(weeksScouted);
  if (width >= 20) return 'Very uncertain';
  if (width >= 14) return 'Uncertain';
  if (width >= 10) return 'Somewhat certain';
  return 'Fairly accurate';
}
