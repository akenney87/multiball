/**
 * Youth Academy System
 *
 * Manages youth prospect scouting, trials, and academy roster.
 *
 * Key Concepts:
 * - Academy starts EMPTY - user signs prospects to fill it
 * - Every 2 weeks, new scouting reports are presented
 * - Attributes shown as RANGES (e.g., 20-40), not exact values
 * - User can "Continue Scouting" to narrow ranges (risk: rival may sign)
 * - Signing costs $10k one-time fee + $10k/year (~$192/week) per prospect
 * - No positions - Multiball is positionless until user assigns
 * - Potential is HIDDEN from user (system only)
 *
 * Regional Scouting:
 * - 7 world regions with different attribute tendencies
 * - Distance from user's home region affects scouting depth
 * - Each region has nationality pools and attribute modifiers
 *
 * Trial System:
 * - Optional monthly trials ($25k, 4-week cooldown)
 * - Discovers 3-5 local prospects from home region
 * - User can invite prospects to subsequent trials to narrow ranges
 * - Indefinite invitations until signed or passed
 *
 * Youth League:
 * - Weekly matches for signed academy prospects
 * - Tracks per-sport stats (basketball/baseball/soccer)
 * - Visible to user to evaluate prospect performance
 *
 * Rival Interest:
 * - Notifications when rival teams notice prospects
 * - Higher chance for high-potential prospects
 *
 * Scouting Timeline:
 * - Week 0: Initial report (20-point range)
 * - Week 2: First refinement (14-point range)
 * - Week 4: Second refinement (10-point range)
 * - Week 6: Final refinement (6-point range)
 */

import { Nationality, FranchiseCountryCode } from '../data/types';
import { generateSeededName } from '../data/nameGenerator';

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

  // =========== NEW FIELDS ===========

  /** Region where this prospect was scouted */
  region: ScoutingRegion;

  /** Rival team interest (if any) */
  rivalInterest: RivalInterest | null;
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

  // Training progress
  weeklyXP: {
    physical: number;
    mental: number;
    technical: number;
  };

  // Snapshot of attributes when signed (for progress tracking)
  seasonStartAttributes: Record<string, number>;

  // Academy tracking
  signedWeek: number;                    // When signed to academy
  yearsInAcademy: number;
  weeklyCost: number;                    // ~$192/week ($10k/year)

  status: 'active' | 'promoted' | 'released';

  // =========== NEW FIELDS ===========

  /** Individual training focus for this prospect */
  trainingFocus: ProspectTrainingFocus | null;

  /** Youth league performance stats */
  youthLeagueStats: YouthLeagueStats | null;

  /** Rival team interest (if any) */
  rivalInterest: RivalInterest | null;

  /** How the prospect was discovered */
  source: 'scouting' | 'trial';

  /** Region where the prospect was scouted from */
  scoutedRegion: ScoutingRegion;
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
// REGIONAL SCOUTING TYPES
// =============================================================================

/**
 * World regions for scouting network
 */
export type ScoutingRegion =
  | 'north_america'
  | 'south_america'
  | 'western_europe'
  | 'eastern_europe'
  | 'africa'
  | 'asia'
  | 'oceania';

/**
 * Configuration for a scouting region
 */
export interface RegionConfig {
  id: ScoutingRegion;
  displayName: string;
  /** Attribute tendency multipliers (affects generated prospects) */
  tendencies: {
    physical: number;
    technical: number;
    mental: number;
  };
  /** Nationalities commonly found in this region */
  nationalities: Nationality[];
}

/**
 * Rival team interest in a prospect
 */
export interface RivalInterest {
  teamName: string;
  week: number;
}

// =============================================================================
// TRIAL SYSTEM TYPES
// =============================================================================

/**
 * Trial prospect - discovered through monthly trials
 * Extends ScoutingReport with trial-specific tracking
 */
export interface TrialProspect {
  id: string;
  name: string;
  age: number;
  height: number;
  weight: number;
  nationality: Nationality;

  // Attribute ranges narrow with each trial attended
  attributeRanges: Record<string, AttributeRange>;
  actualAttributes: Record<string, number>;

  potentials: {
    physical: number;
    mental: number;
    technical: number;
  };

  // Trial tracking
  trialsAttended: number;              // 1, 2, 3, etc.
  invitedToNextTrial: boolean;         // User can invite indefinitely
  firstTrialWeek: number;              // When first discovered

  // Status
  status: 'available' | 'invited' | 'signed' | 'passed';
}

// =============================================================================
// YOUTH LEAGUE TYPES
// =============================================================================

/**
 * Youth league stats for basketball
 */
export interface YouthBasketballStats {
  gamesPlayed: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
}

/**
 * Youth league stats for baseball
 */
export interface YouthBaseballStats {
  gamesPlayed: number;
  atBats: number;
  hits: number;
  homeRuns: number;
  rbi: number;
  strikeouts: number;
}

/**
 * Youth league stats for soccer
 */
export interface YouthSoccerStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  yellowCards: number;
  redCards: number;
}

/**
 * Combined youth league stats for all sports
 */
export interface YouthLeagueStats {
  basketball: YouthBasketballStats;
  baseball: YouthBaseballStats;
  soccer: YouthSoccerStats;
  season: number;
}

/**
 * Training focus options for individual prospect development
 */
export type ProspectTrainingFocus = 'balanced' | 'physical' | 'technical' | 'mental';

// =============================================================================
// CONSTANTS
// =============================================================================

// Academy capacity (based on budget)
export const BASE_CAPACITY = 3;                    // Minimum slots
export const SLOTS_PER_BUDGET_TIER = 2;            // Additional slots per budget tier
export const BUDGET_TIER_COST = 100000;            // $100k per tier

// Scouting
export const SCOUTING_CYCLE_WEEKS = 2;             // New reports every 2 weeks
export const BASE_REPORTS_PER_CYCLE = 2;           // Minimum reports shown
export const MAX_REPORTS_PER_CYCLE = 6;            // Maximum reports shown
export const MAX_SCOUTING_WEEKS = 6;               // Maximum scouting duration

// Attribute range narrowing (points of uncertainty)
export const INITIAL_RANGE = 20;                   // Starting range (e.g., 30-50)
export const RANGE_AFTER_2_WEEKS = 14;
export const RANGE_AFTER_4_WEEKS = 10;
export const RANGE_AFTER_6_WEEKS = 6;

// Rival signing risk (per 2-week period while scouting)
export const RIVAL_SIGN_CHANCE_BASE = 0.10;        // 10% base chance
export const RIVAL_SIGN_CHANCE_HIGH_POTENTIAL = 0.20; // 20% for high potential

// Signing costs (revised: $10k signing fee + $10k/year maintenance)
export const SIGNING_FEE = 10000;                  // $10k one-time signing fee
export const ANNUAL_ACADEMY_FEE = 10000;           // $10k/year per prospect
export const WEEKLY_ACADEMY_FEE = Math.round(ANNUAL_ACADEMY_FEE / 52); // ~$192/week

// Legacy cost constants (for compatibility during migration)
export const YEARLY_PROSPECT_COST = ANNUAL_ACADEMY_FEE;
export const WEEKLY_PROSPECT_COST = WEEKLY_ACADEMY_FEE;

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
// NOTE: 'height' is a special case - it's a 1-100 rating derived from physical height
// The physical height (in cm/inches) is stored separately on the prospect
export const PHYSICAL_ATTRIBUTES = [
  'grip_strength', 'arm_strength', 'core_strength', 'agility',
  'acceleration', 'top_speed', 'jumping', 'reactions',
  'stamina', 'balance', 'durability', 'height',
];

export const MENTAL_ATTRIBUTES = [
  'awareness', 'creativity', 'determination', 'bravery',
  'consistency', 'composure', 'patience', 'teamwork',
];

export const TECHNICAL_ATTRIBUTES = [
  'hand_eye_coordination', 'throw_accuracy', 'form_technique',
  'finesse', 'deception', 'footwork',
];

export const ALL_ATTRIBUTES = [
  ...PHYSICAL_ATTRIBUTES,
  ...MENTAL_ATTRIBUTES,
  ...TECHNICAL_ATTRIBUTES,
];

// =============================================================================
// REGIONAL SCOUTING CONSTANTS
// =============================================================================

/**
 * Region configurations with attribute tendencies
 *
 * Tendencies affect how prospects are generated:
 * - Values > 1.0 mean higher average attributes in that category
 * - Values < 1.0 mean lower average attributes in that category
 */
export const REGION_CONFIGS: Record<ScoutingRegion, RegionConfig> = {
  north_america: {
    id: 'north_america',
    displayName: 'North America',
    tendencies: { physical: 1.1, technical: 1.0, mental: 1.0 },
    nationalities: ['American', 'Canadian', 'Mexican'],
  },
  south_america: {
    id: 'south_america',
    displayName: 'South America',
    tendencies: { physical: 0.95, technical: 1.2, mental: 1.0 },
    nationalities: ['Brazilian', 'Argentinian', 'Colombian'],
  },
  western_europe: {
    id: 'western_europe',
    displayName: 'Western Europe',
    tendencies: { physical: 1.0, technical: 1.1, mental: 1.1 },
    nationalities: ['German', 'French', 'Spanish', 'Italian', 'Dutch', 'British'],
  },
  eastern_europe: {
    id: 'eastern_europe',
    displayName: 'Eastern Europe',
    tendencies: { physical: 1.15, technical: 1.0, mental: 0.95 },
    nationalities: ['Russian', 'Polish', 'Serbian', 'Croatian'],
  },
  africa: {
    id: 'africa',
    displayName: 'Africa',
    tendencies: { physical: 1.25, technical: 0.9, mental: 0.95 },
    nationalities: ['Nigerian', 'South African', 'Egyptian', 'Kenyan'],
  },
  asia: {
    id: 'asia',
    displayName: 'Asia',
    tendencies: { physical: 0.9, technical: 1.1, mental: 1.15 },
    nationalities: ['Japanese', 'Chinese', 'Korean', 'Indian'],
  },
  oceania: {
    id: 'oceania',
    displayName: 'Oceania',
    tendencies: { physical: 1.1, technical: 1.0, mental: 1.0 },
    nationalities: ['Australian'],
  },
};

/**
 * Map user's franchise country to their home region
 */
export const COUNTRY_TO_REGION: Record<FranchiseCountryCode, ScoutingRegion> = {
  'US': 'north_america',
  'CA': 'north_america',
  'UK': 'western_europe',
  'DE': 'western_europe',
  'FR': 'western_europe',
  'ES': 'western_europe',
  'IT': 'western_europe',
  'AU': 'oceania',
};

/**
 * Distance multipliers between regions
 *
 * Affects scouting depth: closer regions yield more prospects
 * Values: 1.0 = home (full depth), 0.4 = farthest (reduced depth)
 */
export const REGION_DISTANCE: Record<ScoutingRegion, Record<ScoutingRegion, number>> = {
  north_america: {
    north_america: 1.0,
    south_america: 0.8,
    western_europe: 0.6,
    eastern_europe: 0.5,
    africa: 0.4,
    asia: 0.5,
    oceania: 0.5,
  },
  south_america: {
    north_america: 0.8,
    south_america: 1.0,
    western_europe: 0.6,
    eastern_europe: 0.5,
    africa: 0.5,
    asia: 0.4,
    oceania: 0.5,
  },
  western_europe: {
    north_america: 0.6,
    south_america: 0.6,
    western_europe: 1.0,
    eastern_europe: 0.8,
    africa: 0.7,
    asia: 0.5,
    oceania: 0.4,
  },
  eastern_europe: {
    north_america: 0.5,
    south_america: 0.5,
    western_europe: 0.8,
    eastern_europe: 1.0,
    africa: 0.6,
    asia: 0.6,
    oceania: 0.4,
  },
  africa: {
    north_america: 0.5,
    south_america: 0.5,
    western_europe: 0.7,
    eastern_europe: 0.6,
    africa: 1.0,
    asia: 0.6,
    oceania: 0.4,
  },
  asia: {
    north_america: 0.5,
    south_america: 0.4,
    western_europe: 0.5,
    eastern_europe: 0.6,
    africa: 0.6,
    asia: 1.0,
    oceania: 0.7,
  },
  oceania: {
    north_america: 0.5,
    south_america: 0.5,
    western_europe: 0.4,
    eastern_europe: 0.4,
    africa: 0.4,
    asia: 0.7,
    oceania: 1.0,
  },
};

// =============================================================================
// TRIAL SYSTEM CONSTANTS
// =============================================================================

export const TRIAL_COOLDOWN_WEEKS = 4;             // 4 weeks between trials
export const TRIAL_COST = 25000;                   // $25k per trial event

// Number of prospects discovered per trial
export const TRIAL_PROSPECTS_MIN = 3;
export const TRIAL_PROSPECTS_MAX = 5;

// Attribute range narrowing for trials (starts wide, narrows each trial)
export const TRIAL_INITIAL_RANGE = 24;             // First trial: wide range
export const TRIAL_RANGE_REDUCTION = 5;            // Each subsequent trial narrows by 5

// Minimum range after multiple trials
export const TRIAL_MIN_RANGE = 6;

// =============================================================================
// RIVAL INTEREST CONSTANTS
// =============================================================================

export const RIVAL_INTEREST_BASE_CHANCE = 0.10;    // 10% base chance per week
export const RIVAL_INTEREST_HIGH_POTENTIAL = 0.20; // 20% for high potential prospects

/** Sample rival team names for notifications */
export const RIVAL_TEAM_NAMES = [
  'Barcelona B',
  'Real Madrid Castilla',
  'Bayern Munich II',
  'Manchester United U21',
  'Ajax Youth',
  'PSG Academy',
  'Juventus Next Gen',
  'Borussia Dortmund II',
  'Chelsea Development',
  'AC Milan Primavera',
];

// =============================================================================
// SPORT-SPECIFIC SCOUT WEIGHT TABLES
// =============================================================================

/**
 * Sport focus options for scouting
 */
export type ScoutSportFocus = 'basketball' | 'baseball' | 'soccer' | 'balanced';

/**
 * Weight multipliers for sport-specific scouting
 * Values > 1.0 mean the attribute is more important for that sport
 * Used to score prospects and select the best matches for the focus
 */
export const SCOUT_WEIGHTS_BASKETBALL: Record<string, number> = {
  // Physical - height and jumping are king in basketball
  height: 1.5,
  jumping: 1.4,
  agility: 1.2,
  reactions: 1.2,
  acceleration: 1.1,
  top_speed: 1.0,
  stamina: 1.1,
  balance: 1.0,
  grip_strength: 1.0,
  arm_strength: 1.0,
  core_strength: 1.1,
  durability: 1.0,
  // Mental
  awareness: 1.2,
  composure: 1.2,
  consistency: 1.1,
  teamwork: 1.1,
  creativity: 1.0,
  determination: 1.0,
  bravery: 1.0,
  patience: 1.0,
  // Technical - shooting and ball handling
  hand_eye_coordination: 1.3,
  throw_accuracy: 1.3,
  form_technique: 1.2,
  footwork: 1.1,
  finesse: 1.1,
  deception: 1.0,
};

export const SCOUT_WEIGHTS_BASEBALL: Record<string, number> = {
  // Physical - arm strength and reactions crucial
  arm_strength: 1.4,
  reactions: 1.3,
  grip_strength: 1.2,
  core_strength: 1.2,
  agility: 1.1,
  top_speed: 1.1,
  acceleration: 1.0,
  jumping: 1.0,
  height: 1.0,
  stamina: 1.0,
  balance: 1.1,
  durability: 1.0,
  // Mental - patience and composure for batting
  patience: 1.3,
  composure: 1.2,
  consistency: 1.2,
  awareness: 1.1,
  determination: 1.0,
  creativity: 1.0,
  teamwork: 1.0,
  bravery: 1.0,
  // Technical - hand-eye and throw accuracy
  hand_eye_coordination: 1.5,
  throw_accuracy: 1.4,
  form_technique: 1.1,
  finesse: 1.0,
  deception: 1.2,
  footwork: 1.0,
};

export const SCOUT_WEIGHTS_SOCCER: Record<string, number> = {
  // Physical - stamina and speed dominate
  stamina: 1.5,
  top_speed: 1.3,
  agility: 1.4,
  acceleration: 1.2,
  balance: 1.2,
  core_strength: 1.1,
  jumping: 1.0,
  height: 1.0,
  reactions: 1.1,
  grip_strength: 1.0,
  arm_strength: 1.0,
  durability: 1.1,
  // Mental - awareness and teamwork key
  awareness: 1.3,
  teamwork: 1.3,
  creativity: 1.2,
  composure: 1.1,
  determination: 1.1,
  bravery: 1.0,
  consistency: 1.0,
  patience: 1.0,
  // Technical - footwork is essential
  footwork: 1.4,
  finesse: 1.2,
  deception: 1.1,
  hand_eye_coordination: 1.0,
  throw_accuracy: 1.0,
  form_technique: 1.0,
};

/**
 * Get scout weights for a given sport focus
 */
export function getScoutWeights(focus: ScoutSportFocus): Record<string, number> {
  switch (focus) {
    case 'basketball':
      return SCOUT_WEIGHTS_BASKETBALL;
    case 'baseball':
      return SCOUT_WEIGHTS_BASEBALL;
    case 'soccer':
      return SCOUT_WEIGHTS_SOCCER;
    case 'balanced':
    default:
      // Return all weights as 1.0 for balanced
      return ALL_ATTRIBUTES.reduce((acc, attr) => {
        acc[attr] = 1.0;
        return acc;
      }, {} as Record<string, number>);
  }
}

/**
 * Calculate a prospect's sport-specific score using weight tables
 * Higher scores mean better suited for that sport
 */
export function calculateProspectSportScore(
  attributes: Record<string, number>,
  focus: ScoutSportFocus
): number {
  const weights = getScoutWeights(focus);
  let totalScore = 0;
  let totalWeight = 0;

  for (const attr of ALL_ATTRIBUTES) {
    const value = attributes[attr] ?? 50;
    const weight = weights[attr] ?? 1.0;
    totalScore += value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 50;
}

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
 * Calculate height attribute rating (1-100) from physical height in inches
 *
 * Uses the same formula as factories.ts for consistency:
 * - 66" (5'6") → 1
 * - 77" (6'5") → 50
 * - 88" (7'4") → 99
 *
 * This makes taller players have higher height ratings, which is
 * used in simulation for rebounding, blocking, etc.
 */
export function calculateHeightRating(heightInches: number): number {
  // Formula from factories.ts: ((heightInches - 66) * 98 / 22) + 1
  // Range: 66" (5'6") to 88" (7'4")
  const heightAttr = Math.round(((heightInches - 66) * 98 / 22) + 1);
  return Math.max(1, Math.min(99, heightAttr));
}

/**
 * Calculate range width based on weeks scouted
 */
export function getRangeWidth(weeksScouted: number): number {
  if (weeksScouted >= 6) return RANGE_AFTER_6_WEEKS;
  if (weeksScouted >= 4) return RANGE_AFTER_4_WEEKS;
  if (weeksScouted >= 2) return RANGE_AFTER_2_WEEKS;
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
 * Get home region from franchise country code
 */
export function getHomeRegion(country: FranchiseCountryCode): ScoutingRegion {
  return COUNTRY_TO_REGION[country] ?? 'north_america';
}

/**
 * Get depth multiplier for scouting a target region from home region
 */
export function getRegionDepthMultiplier(
  homeRegion: ScoutingRegion,
  targetRegion: ScoutingRegion
): number {
  return REGION_DISTANCE[homeRegion]?.[targetRegion] ?? 0.5;
}

/**
 * Create empty youth league stats for a new season
 */
export function createEmptyYouthLeagueStats(season: number): YouthLeagueStats {
  return {
    basketball: {
      gamesPlayed: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
    },
    baseball: {
      gamesPlayed: 0,
      atBats: 0,
      hits: 0,
      homeRuns: 0,
      rbi: 0,
      strikeouts: 0,
    },
    soccer: {
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      minutesPlayed: 0,
      yellowCards: 0,
      redCards: 0,
    },
    season,
  };
}

/**
 * Get trial attribute range width based on trials attended
 * Starts at 24, narrows by 5 each trial, minimum 6
 */
export function getTrialRangeWidth(trialsAttended: number): number {
  const reduction = (trialsAttended - 1) * TRIAL_RANGE_REDUCTION;
  return Math.max(TRIAL_MIN_RANGE, TRIAL_INITIAL_RANGE - reduction);
}

/**
 * Check if a trial can be held
 */
export function canHoldTrial(
  lastTrialWeek: number,
  currentWeek: number,
  availableBudget: number
): { canHold: boolean; weeksRemaining: number; reason?: string } {
  const weeksSinceLastTrial = currentWeek - lastTrialWeek;
  const weeksRemaining = Math.max(0, TRIAL_COOLDOWN_WEEKS - weeksSinceLastTrial);

  if (weeksRemaining > 0) {
    return {
      canHold: false,
      weeksRemaining,
      reason: `Trial cooldown: ${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} remaining`,
    };
  }

  if (availableBudget < TRIAL_COST) {
    return {
      canHold: false,
      weeksRemaining: 0,
      reason: `Insufficient budget: need $${TRIAL_COST.toLocaleString()}`,
    };
  }

  return { canHold: true, weeksRemaining: 0 };
}

/**
 * Get a random rival team name
 */
export function getRandomRivalName(seed: number): string {
  const index = Math.floor(seededRandom(seed) * RIVAL_TEAM_NAMES.length);
  return RIVAL_TEAM_NAMES[index] ?? RIVAL_TEAM_NAMES[0]!;
}

/**
 * Check if rival interest should be generated for a prospect
 */
export function checkRivalInterest(
  avgPotential: number,
  currentWeek: number,
  seed: number
): RivalInterest | null {
  const chance = avgPotential > 80
    ? RIVAL_INTEREST_HIGH_POTENTIAL
    : RIVAL_INTEREST_BASE_CHANCE;

  if (seededRandom(seed) < chance) {
    return {
      teamName: getRandomRivalName(seed + 1),
      week: currentWeek,
    };
  }

  return null;
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
// REGIONAL SCOUTING FUNCTIONS
// =============================================================================

/**
 * Calculate number of scouting reports based on region distance
 *
 * Closer regions yield more prospects (full depth at home region)
 * Distant regions yield fewer prospects (40% at farthest)
 */
export function calculateRegionalReports(
  baseReports: number,
  homeRegion: ScoutingRegion,
  targetRegion: ScoutingRegion
): number {
  const depthMultiplier = getRegionDepthMultiplier(homeRegion, targetRegion);
  const reports = Math.round(baseReports * depthMultiplier);
  return Math.max(1, reports); // Always at least 1 report
}

/**
 * Apply regional tendencies to prospect attributes
 *
 * Modifies attribute values based on region's physical/technical/mental tendencies
 */
export function applyRegionalTendencies(
  attributes: Record<string, number>,
  region: ScoutingRegion
): Record<string, number> {
  const config = REGION_CONFIGS[region];
  if (!config) return attributes;

  const { tendencies } = config;
  const modified = { ...attributes };

  // Apply physical tendency
  PHYSICAL_ATTRIBUTES.forEach(attr => {
    if (attr in modified) {
      modified[attr] = Math.round(modified[attr]! * tendencies.physical);
      modified[attr] = Math.max(1, Math.min(99, modified[attr]!));
    }
  });

  // Apply mental tendency
  MENTAL_ATTRIBUTES.forEach(attr => {
    if (attr in modified) {
      modified[attr] = Math.round(modified[attr]! * tendencies.mental);
      modified[attr] = Math.max(1, Math.min(99, modified[attr]!));
    }
  });

  // Apply technical tendency
  TECHNICAL_ATTRIBUTES.forEach(attr => {
    if (attr in modified) {
      modified[attr] = Math.round(modified[attr]! * tendencies.technical);
      modified[attr] = Math.max(1, Math.min(99, modified[attr]!));
    }
  });

  return modified;
}

/**
 * Get a random nationality from a region
 */
export function getRandomRegionalNationality(
  region: ScoutingRegion,
  seed: number
): Nationality {
  const config = REGION_CONFIGS[region];
  if (!config || config.nationalities.length === 0) {
    return 'American';
  }

  const index = Math.floor(seededRandom(seed) * config.nationalities.length);
  return (config.nationalities[index] ?? 'American') as Nationality;
}

// =============================================================================
// TRIAL SYSTEM FUNCTIONS
// =============================================================================

/**
 * Generate trial prospects for a trial event
 *
 * Trials discover local talent from the user's home region.
 * Attribute ranges start wide and narrow with each trial attended.
 */
export function generateTrialProspects(
  currentWeek: number,
  homeRegion: ScoutingRegion,
  qualityMultiplier: number,
  seed: number
): TrialProspect[] {
  // Determine number of prospects (3-5)
  const count = randomInt(TRIAL_PROSPECTS_MIN, TRIAL_PROSPECTS_MAX, seed);
  const prospects: TrialProspect[] = [];

  for (let i = 0; i < count; i++) {
    const prospectSeed = seed + i * 1000;
    const age = randomInt(MIN_PROSPECT_AGE, MAX_PROSPECT_AGE, prospectSeed);

    // Generate height and weight
    const heightInches = generateYouthHeight(prospectSeed + 1);
    const height = inchesToCm(heightInches);
    const weightLbs = generateYouthWeight(heightInches, prospectSeed + 2);
    const weight = lbsToKg(weightLbs);

    // Use home region for nationality
    const nationality = getRandomRegionalNationality(homeRegion, prospectSeed + 3);
    const name = generateSeededName(nationality, prospectSeed + 4);

    // Generate base attributes
    const baseMin = Math.round(YOUTH_ATTRIBUTE_MIN * qualityMultiplier);
    const baseMax = Math.round(YOUTH_ATTRIBUTE_MAX * qualityMultiplier);

    const baseAttributes: Record<string, number> = {};
    ALL_ATTRIBUTES.forEach((attr, index) => {
      if (attr === 'height') {
        baseAttributes[attr] = calculateHeightRating(heightInches);
      } else {
        baseAttributes[attr] = randomInt(
          Math.max(1, baseMin),
          Math.min(99, baseMax),
          prospectSeed + 100 + index
        );
      }
    });

    // Apply regional tendencies
    const actualAttributes = applyRegionalTendencies(baseAttributes, homeRegion);
    actualAttributes['height'] = baseAttributes['height']!;

    // Generate potentials
    const physicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, prospectSeed + 200);
    const mentalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, prospectSeed + 201);
    const technicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, prospectSeed + 202);

    // First trial has wide attribute ranges
    const rangeWidth = getTrialRangeWidth(1);
    const attributeRanges: Record<string, AttributeRange> = {};
    ALL_ATTRIBUTES.forEach((attr) => {
      attributeRanges[attr] = generateAttributeRange(actualAttributes[attr] ?? 30, rangeWidth);
    });

    prospects.push({
      id: `trial_${currentWeek}_${i}`,
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
      trialsAttended: 1,
      invitedToNextTrial: false,
      firstTrialWeek: currentWeek,
      status: 'available',
    });
  }

  return prospects;
}

/**
 * Invite a trial prospect to the next trial
 */
export function inviteToNextTrial(prospect: TrialProspect): TrialProspect {
  return {
    ...prospect,
    invitedToNextTrial: true,
    status: 'invited',
  };
}

/**
 * Advance a trial prospect to the next trial (narrow their ranges)
 */
export function advanceTrialProspect(
  prospect: TrialProspect
): TrialProspect {
  if (!prospect.invitedToNextTrial) {
    return prospect;
  }

  const newTrialsAttended = prospect.trialsAttended + 1;
  const newRangeWidth = getTrialRangeWidth(newTrialsAttended);

  // Narrow attribute ranges
  const newRanges: Record<string, AttributeRange> = {};
  ALL_ATTRIBUTES.forEach((attr) => {
    newRanges[attr] = generateAttributeRange(
      prospect.actualAttributes[attr] ?? 30,
      newRangeWidth
    );
  });

  return {
    ...prospect,
    trialsAttended: newTrialsAttended,
    attributeRanges: newRanges,
    invitedToNextTrial: false, // Reset - user must invite again if wanted
    status: 'available',
  };
}

/**
 * Mark a trial prospect as passed (declined)
 */
export function passTrialProspect(prospect: TrialProspect): TrialProspect {
  return {
    ...prospect,
    status: 'passed',
    invitedToNextTrial: false,
  };
}

// =============================================================================
// YOUTH LEAGUE SIMULATION
// =============================================================================

/**
 * Simulate a youth league basketball game for a prospect
 * Returns stats generated based on prospect attributes
 */
export function simulateYouthBasketballGame(
  prospect: AcademyProspect,
  seed: number
): Partial<YouthBasketballStats> {
  const attrs = prospect.attributes;

  // Points based on shooting + coordination
  const shootingAbility = ((attrs['throw_accuracy'] ?? 50) + (attrs['hand_eye_coordination'] ?? 50)) / 2;
  const basePoints = Math.round((shootingAbility / 100) * 25); // Max ~25 points
  const points = basePoints + randomInt(-5, 5, seed);

  // Rebounds based on height + jumping
  const reboundAbility = ((attrs['height'] ?? 50) + (attrs['jumping'] ?? 50)) / 2;
  const rebounds = Math.round((reboundAbility / 100) * 12) + randomInt(-2, 2, seed + 1);

  // Assists based on awareness + creativity
  const passingAbility = ((attrs['awareness'] ?? 50) + (attrs['creativity'] ?? 50)) / 2;
  const assists = Math.round((passingAbility / 100) * 8) + randomInt(-2, 2, seed + 2);

  // Steals based on agility + reactions
  const stealAbility = ((attrs['agility'] ?? 50) + (attrs['reactions'] ?? 50)) / 2;
  const steals = Math.round((stealAbility / 100) * 4) + randomInt(-1, 1, seed + 3);

  // Blocks based on height + jumping
  const blockAbility = ((attrs['height'] ?? 50) + (attrs['jumping'] ?? 50)) / 2;
  const blocks = Math.round((blockAbility / 100) * 3) + randomInt(-1, 1, seed + 4);

  return {
    gamesPlayed: 1,
    points: Math.max(0, points),
    rebounds: Math.max(0, rebounds),
    assists: Math.max(0, assists),
    steals: Math.max(0, steals),
    blocks: Math.max(0, blocks),
  };
}

/**
 * Simulate a youth league baseball game for a prospect
 */
export function simulateYouthBaseballGame(
  prospect: AcademyProspect,
  seed: number
): Partial<YouthBaseballStats> {
  const attrs = prospect.attributes;

  // At bats (typically 3-5 per game)
  const atBats = randomInt(3, 5, seed);

  // Hits based on hand-eye + patience
  const battingAbility = ((attrs['hand_eye_coordination'] ?? 50) + (attrs['patience'] ?? 50)) / 2;
  const hitChance = battingAbility / 100 * 0.4; // Max ~40% batting average
  let hits = 0;
  for (let i = 0; i < atBats; i++) {
    if (seededRandom(seed + 10 + i) < hitChance) {
      hits++;
    }
  }

  // Home runs (rare, based on arm strength + core strength)
  const powerAbility = ((attrs['arm_strength'] ?? 50) + (attrs['core_strength'] ?? 50)) / 2;
  const hrChance = (powerAbility / 100) * 0.05; // Max ~5% HR rate
  let homeRuns = 0;
  for (let i = 0; i < hits; i++) {
    if (seededRandom(seed + 20 + i) < hrChance) {
      homeRuns++;
    }
  }

  // RBI
  const rbi = homeRuns + (hits > homeRuns ? randomInt(0, 2, seed + 30) : 0);

  // Strikeouts (inverse of patience + composure)
  const disciplineAbility = ((attrs['patience'] ?? 50) + (attrs['composure'] ?? 50)) / 2;
  const strikeoutChance = (1 - disciplineAbility / 100) * 0.3;
  let strikeouts = 0;
  for (let i = 0; i < atBats - hits; i++) {
    if (seededRandom(seed + 40 + i) < strikeoutChance) {
      strikeouts++;
    }
  }

  return {
    gamesPlayed: 1,
    atBats,
    hits: Math.max(0, hits),
    homeRuns: Math.max(0, homeRuns),
    rbi: Math.max(0, rbi),
    strikeouts: Math.max(0, strikeouts),
  };
}

/**
 * Simulate a youth league soccer game for a prospect
 */
export function simulateYouthSoccerGame(
  prospect: AcademyProspect,
  seed: number
): Partial<YouthSoccerStats> {
  const attrs = prospect.attributes;

  // Minutes played (based on stamina)
  const staminaAbility = attrs['stamina'] ?? 50;
  const baseMinutes = 45 + Math.round((staminaAbility / 100) * 45); // 45-90 minutes
  const minutesPlayed = baseMinutes + randomInt(-10, 10, seed);

  // Goals based on finesse + footwork
  const scoringAbility = ((attrs['finesse'] ?? 50) + (attrs['footwork'] ?? 50)) / 2;
  const goalChance = (scoringAbility / 100) * 0.15; // Max ~15% chance of scoring
  const goals = seededRandom(seed + 1) < goalChance ? (seededRandom(seed + 2) < 0.3 ? 2 : 1) : 0;

  // Assists based on creativity + awareness
  const passingAbility = ((attrs['creativity'] ?? 50) + (attrs['awareness'] ?? 50)) / 2;
  const assistChance = (passingAbility / 100) * 0.2;
  const assists = seededRandom(seed + 3) < assistChance ? 1 : 0;

  // Cards based on bravery + composure (inverse)
  const cardChance = 0.05; // 5% base chance
  const yellowCards = seededRandom(seed + 4) < cardChance ? 1 : 0;
  const redCards = yellowCards && seededRandom(seed + 5) < 0.1 ? 1 : 0; // 10% of yellows become reds

  return {
    gamesPlayed: 1,
    goals: Math.max(0, goals),
    assists: Math.max(0, assists),
    minutesPlayed: Math.max(0, Math.min(90, minutesPlayed)),
    yellowCards,
    redCards,
  };
}

/**
 * Simulate a week of youth league games for all active prospects
 * Returns updates to be applied to each prospect's stats
 */
export function simulateYouthLeagueWeek(
  prospects: AcademyProspect[],
  currentWeek: number,
  seed: number
): Array<{ prospectId: string; basketball: Partial<YouthBasketballStats>; baseball: Partial<YouthBaseballStats>; soccer: Partial<YouthSoccerStats> }> {
  const activeProspects = prospects.filter(p => p.status === 'active');

  return activeProspects.map((prospect, index) => {
    const prospectSeed = seed + currentWeek * 1000 + index * 100;

    return {
      prospectId: prospect.id,
      basketball: simulateYouthBasketballGame(prospect, prospectSeed),
      baseball: simulateYouthBaseballGame(prospect, prospectSeed + 1),
      soccer: simulateYouthSoccerGame(prospect, prospectSeed + 2),
    };
  });
}

/**
 * Merge youth league stats update into existing stats
 */
export function mergeYouthLeagueStats(
  existing: YouthLeagueStats,
  update: {
    basketball?: Partial<YouthBasketballStats>;
    baseball?: Partial<YouthBaseballStats>;
    soccer?: Partial<YouthSoccerStats>;
  }
): YouthLeagueStats {
  return {
    ...existing,
    basketball: {
      gamesPlayed: existing.basketball.gamesPlayed + (update.basketball?.gamesPlayed ?? 0),
      points: existing.basketball.points + (update.basketball?.points ?? 0),
      rebounds: existing.basketball.rebounds + (update.basketball?.rebounds ?? 0),
      assists: existing.basketball.assists + (update.basketball?.assists ?? 0),
      steals: existing.basketball.steals + (update.basketball?.steals ?? 0),
      blocks: existing.basketball.blocks + (update.basketball?.blocks ?? 0),
    },
    baseball: {
      gamesPlayed: existing.baseball.gamesPlayed + (update.baseball?.gamesPlayed ?? 0),
      atBats: existing.baseball.atBats + (update.baseball?.atBats ?? 0),
      hits: existing.baseball.hits + (update.baseball?.hits ?? 0),
      homeRuns: existing.baseball.homeRuns + (update.baseball?.homeRuns ?? 0),
      rbi: existing.baseball.rbi + (update.baseball?.rbi ?? 0),
      strikeouts: existing.baseball.strikeouts + (update.baseball?.strikeouts ?? 0),
    },
    soccer: {
      gamesPlayed: existing.soccer.gamesPlayed + (update.soccer?.gamesPlayed ?? 0),
      goals: existing.soccer.goals + (update.soccer?.goals ?? 0),
      assists: existing.soccer.assists + (update.soccer?.assists ?? 0),
      minutesPlayed: existing.soccer.minutesPlayed + (update.soccer?.minutesPlayed ?? 0),
      yellowCards: existing.soccer.yellowCards + (update.soccer?.yellowCards ?? 0),
      redCards: existing.soccer.redCards + (update.soccer?.redCards ?? 0),
    },
  };
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
  seed: number,
  region: ScoutingRegion = 'north_america'
): ScoutingReport {
  // Generate basic info
  const age = randomInt(MIN_PROSPECT_AGE, MAX_PROSPECT_AGE, seed);

  // Generate height with normal distribution (most common 5'10", range 5'0" to 6'8")
  const heightInches = generateYouthHeight(seed + 1);
  const height = inchesToCm(heightInches);

  // Generate weight correlated with height
  const weightLbs = generateYouthWeight(heightInches, seed + 2);
  const weight = lbsToKg(weightLbs);

  // Generate nationality based on region
  const nationality = getRandomRegionalNationality(region, seed + 3);

  // Generate nationality-appropriate name using seeded generation
  const name = generateSeededName(nationality, seed + 4);

  // Generate actual attributes (hidden from user)
  const baseMin = Math.round(YOUTH_ATTRIBUTE_MIN * qualityMultiplier);
  const baseMax = Math.round(YOUTH_ATTRIBUTE_MAX * qualityMultiplier);

  const baseAttributes: Record<string, number> = {};
  ALL_ATTRIBUTES.forEach((attr, index) => {
    if (attr === 'height') {
      // Height attribute is derived from physical height, not randomly generated
      baseAttributes[attr] = calculateHeightRating(heightInches);
    } else {
      baseAttributes[attr] = randomInt(
        Math.max(1, baseMin),
        Math.min(99, baseMax),
        seed + 100 + index
      );
    }
  });

  // Apply regional tendencies to attributes (except height which is physical)
  const actualAttributes = applyRegionalTendencies(baseAttributes, region);
  // Preserve height rating (physical height doesn't change based on region)
  actualAttributes['height'] = baseAttributes['height']!;

  // Generate potentials (hidden from user)
  const physicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 200);
  const mentalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 201);
  const technicalPotential = randomInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX, seed + 202);

  // Generate initial attribute ranges (what user sees) - based on modified attributes
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
    // New fields
    region,
    rivalInterest: null,
  };
}

/**
 * Generate batch of scouting reports for a cycle
 *
 * Uses weighted selection based on sport focus:
 * - Generates 2x the requested count of prospects
 * - Scores each against sport-specific weight tables
 * - Returns the top N that best match the focus
 *
 * Regional scouting affects prospect pool:
 * - Closer regions yield more prospects (full depth at home)
 * - Regional tendencies affect attribute generation
 *
 * @param currentWeek - Current game week
 * @param count - Number of reports to return
 * @param qualityMultiplier - Quality modifier based on budget
 * @param seed - Random seed for reproducibility
 * @param sportFocus - Which sport to prioritize (default: balanced)
 * @param region - Scouting region (default: north_america)
 */
export function generateScoutingReports(
  currentWeek: number,
  count: number,
  qualityMultiplier: number,
  seed: number,
  sportFocus: ScoutSportFocus = 'balanced',
  region: ScoutingRegion = 'north_america'
): ScoutingReport[] {
  // Generate 2x prospects for selection pool
  const poolSize = count * 2;
  const candidateReports: ScoutingReport[] = [];

  for (let i = 0; i < poolSize; i++) {
    const report = generateScoutingReport(
      `scout_${currentWeek}_${i}`,
      currentWeek,
      qualityMultiplier,
      seed + i * 1000,
      region
    );
    candidateReports.push(report);
  }

  // If balanced, just return the first N (no preference)
  if (sportFocus === 'balanced') {
    return candidateReports.slice(0, count);
  }

  // Score each prospect against sport weights and sort
  const scoredReports = candidateReports.map((report) => ({
    report,
    score: calculateProspectSportScore(report.actualAttributes, sportFocus),
  }));

  // Sort by score descending (best matches first)
  scoredReports.sort((a, b) => b.score - a.score);

  // Return top N prospects that best match the sport focus
  return scoredReports.slice(0, count).map((sr) => sr.report);
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
  currentWeek: number,
  currentSeason: number = 1
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
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    seasonStartAttributes: { ...report.actualAttributes },
    signedWeek: currentWeek,
    yearsInAcademy: 0,
    weeklyCost: WEEKLY_ACADEMY_FEE,
    status: 'active',
    // New fields
    trainingFocus: null,
    youthLeagueStats: createEmptyYouthLeagueStats(currentSeason),
    rivalInterest: report.rivalInterest,
    source: 'scouting',
    scoutedRegion: report.region,
  };
}

/**
 * Sign a trial prospect to the academy
 */
export function signTrialProspectToAcademy(
  trialProspect: TrialProspect,
  currentWeek: number,
  currentSeason: number,
  homeRegion: ScoutingRegion
): AcademyProspect {
  return {
    id: trialProspect.id,
    name: trialProspect.name,
    age: trialProspect.age,
    height: trialProspect.height,
    weight: trialProspect.weight,
    nationality: trialProspect.nationality,
    attributes: { ...trialProspect.actualAttributes },
    potentials: { ...trialProspect.potentials },
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    seasonStartAttributes: { ...trialProspect.actualAttributes },
    signedWeek: currentWeek,
    yearsInAcademy: 0,
    weeklyCost: WEEKLY_ACADEMY_FEE,
    status: 'active',
    // New fields
    trainingFocus: null,
    youthLeagueStats: createEmptyYouthLeagueStats(currentSeason),
    rivalInterest: null,
    source: 'trial',
    scoutedRegion: homeRegion, // Trials always discover local talent
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
 * Only returns prospects who are 18+ (about to turn 19 and must be promoted or released)
 */
export function getProspectsNeedingAction(prospects: AcademyProspect[]): AcademyProspect[] {
  return prospects.filter(p => p.age >= PROMOTION_AGE && p.status === 'active');
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
