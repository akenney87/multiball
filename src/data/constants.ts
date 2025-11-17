/**
 * Data Constants for Multiball
 *
 * Constants that align with game rules and basketball-sim implementation.
 * Single source of truth for validation ranges and game parameters.
 *
 * @module data/constants
 */

// =============================================================================
// ATTRIBUTE CONSTANTS
// =============================================================================

/**
 * All 25 player attributes (must match basketball-sim exactly)
 */
export const ALL_ATTRIBUTES = [
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
] as const;

/** Physical attributes */
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
] as const;

/** Mental attributes */
export const MENTAL_ATTRIBUTES = [
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
] as const;

/** Technical attributes */
export const TECHNICAL_ATTRIBUTES = [
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'teamwork',
] as const;

/** Total attribute count */
export const ATTRIBUTE_COUNT = 25;

/** Minimum attribute value */
export const ATTRIBUTE_MIN = 1;

/** Maximum attribute value */
export const ATTRIBUTE_MAX = 100;

// =============================================================================
// PLAYER CONSTANTS
// =============================================================================

/** Basketball positions */
export const BASKETBALL_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

/** Minimum player age */
export const PLAYER_AGE_MIN = 15;

/** Maximum player age */
export const PLAYER_AGE_MAX = 45;

/** Youth prospect minimum age */
export const YOUTH_AGE_MIN = 15;

/** Youth prospect maximum age */
export const YOUTH_AGE_MAX = 18;

/** Youth prospect promotion age (must promote before 19th birthday) */
export const YOUTH_PROMOTION_AGE = 19;

/** Peak age ranges by category */
export const PEAK_AGE_RANGES = {
  physical: { min: 22, max: 30, peak: 26 },
  technical: { min: 24, max: 32, peak: 28 },
  mental: { min: 26, max: 34, peak: 30 },
} as const;

/** Starting roster size */
export const STARTING_ROSTER_SIZE = 50;

/** Starting player attribute range (poor quality) */
export const STARTING_PLAYER_ATTRIBUTES = {
  min: 1,
  max: 25,
} as const;

// =============================================================================
// FRANCHISE CONSTANTS
// =============================================================================

/** Number of divisions */
export const DIVISION_COUNT = 5;

/** Teams per division */
export const TEAMS_PER_DIVISION = 20;

/** User's team ID */
export const USER_TEAM_ID = 'user';

/** Teams promoted per season */
export const TEAMS_PROMOTED = 3;

/** Teams relegated per season */
export const TEAMS_RELEGATED = 3;

// =============================================================================
// BUDGET CONSTANTS
// =============================================================================

/** Starting budget (Division 5) */
export const STARTING_BUDGET = 1_000_000;

/** Minimum youth academy budget */
export const YOUTH_ACADEMY_MIN_BUDGET = 100_000;

/** Youth academy budget increment */
export const YOUTH_ACADEMY_BUDGET_INCREMENT = 50_000;

// =============================================================================
// SEASON CONSTANTS
// =============================================================================

/** Opponents per division */
export const OPPONENTS_PER_DIVISION = 19;

/** Sports per season */
export const SPORTS_PER_SEASON = 3;

/** Total matches per season (19 opponents × 3 sports) */
export const MATCHES_PER_SEASON = OPPONENTS_PER_DIVISION * SPORTS_PER_SEASON;

/** Season statuses */
export const SEASON_STATUSES = [
  'pre_season',
  'regular_season',
  'post_season',
  'off_season',
] as const;

/** Transfer window open date (month) */
export const TRANSFER_WINDOW_OPEN_MONTH = 7; // July

/** Transfer window close date (month) */
export const TRANSFER_WINDOW_CLOSE_MONTH = 1; // January

// =============================================================================
// CONTRACT CONSTANTS
// =============================================================================

/** Minimum contract length (years) */
export const CONTRACT_LENGTH_MIN = 1;

/** Maximum contract length (years) */
export const CONTRACT_LENGTH_MAX = 5;

// =============================================================================
// TACTICAL CONSTANTS
// =============================================================================

/** Valid pace settings */
export const PACE_SETTINGS = ['fast', 'standard', 'slow'] as const;

/** Valid rebounding strategies */
export const REBOUNDING_STRATEGIES = [
  'crash_glass',
  'standard',
  'prevent_transition',
] as const;

/** Valid timeout strategies */
export const TIMEOUT_STRATEGIES = ['aggressive', 'standard', 'conservative'] as const;

/** Minutes per game (basketball) */
export const MINUTES_PER_GAME = 48;

/** Total minutes allotment (5 players × 48 minutes) */
export const TOTAL_MINUTES_ALLOTMENT = 240;

/** Maximum minutes per player */
export const MAX_MINUTES_PER_PLAYER = 48;

// =============================================================================
// INJURY CONSTANTS
// =============================================================================

/** Injury types */
export const INJURY_TYPES = ['minor', 'moderate', 'severe'] as const;

/** Injury recovery ranges (weeks) */
export const INJURY_RECOVERY_WEEKS = {
  minor: { min: 1, max: 2 },
  moderate: { min: 3, max: 6 },
  severe: { min: 7, max: 12 },
} as const;

// =============================================================================
// SCOUTING CONSTANTS
// =============================================================================

/** Scouting quality range (0-100) */
export const SCOUTING_QUALITY_MIN = 0;
export const SCOUTING_QUALITY_MAX = 100;

/** Depth vs breadth slider range (0-100) */
export const DEPTH_VS_BREADTH_MIN = 0;
export const DEPTH_VS_BREADTH_MAX = 100;

// =============================================================================
// NEWS CONSTANTS
// =============================================================================

/** News types */
export const NEWS_TYPES = [
  'injury',
  'contract',
  'scouting',
  'transfer',
  'match',
  'youth',
  'general',
] as const;

/** News priorities */
export const NEWS_PRIORITIES = ['critical', 'important', 'info'] as const;

// =============================================================================
// SPORT CONSTANTS
// =============================================================================

/** Available sports */
export const SPORTS = ['basketball', 'baseball', 'soccer'] as const;

/** MVP sports (basketball only for now) */
export const MVP_SPORTS = ['basketball'] as const;

// =============================================================================
// VERSION CONSTANTS
// =============================================================================

/** Current game version */
export const GAME_VERSION = '0.1.0';

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if value is valid attribute name
 */
export function isValidAttribute(attr: string): boolean {
  return ALL_ATTRIBUTES.includes(attr as any);
}

/**
 * Check if value is valid basketball position
 */
export function isValidPosition(pos: string): boolean {
  return BASKETBALL_POSITIONS.includes(pos as any);
}

/**
 * Check if value is valid division
 */
export function isValidDivision(div: number): boolean {
  return div >= 1 && div <= DIVISION_COUNT;
}

/**
 * Check if value is valid pace setting
 */
export function isValidPace(pace: string): boolean {
  return PACE_SETTINGS.includes(pace as any);
}

/**
 * Check if value is valid sport
 */
export function isValidSport(sport: string): boolean {
  return SPORTS.includes(sport as any);
}

/**
 * Check if value is valid injury type
 */
export function isValidInjuryType(type: string): boolean {
  return INJURY_TYPES.includes(type as any);
}

/**
 * Check if value is valid news type
 */
export function isValidNewsType(type: string): boolean {
  return NEWS_TYPES.includes(type as any);
}

/**
 * Check if value is valid news priority
 */
export function isValidNewsPriority(priority: string): boolean {
  return NEWS_PRIORITIES.includes(priority as any);
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type AttributeName = typeof ALL_ATTRIBUTES[number];
export type PhysicalAttributeName = typeof PHYSICAL_ATTRIBUTES[number];
export type MentalAttributeName = typeof MENTAL_ATTRIBUTES[number];
export type TechnicalAttributeName = typeof TECHNICAL_ATTRIBUTES[number];
export type BasketballPosition = typeof BASKETBALL_POSITIONS[number];
export type PaceSetting = typeof PACE_SETTINGS[number];
export type ReboundingStrategy = typeof REBOUNDING_STRATEGIES[number];
export type TimeoutStrategy = typeof TIMEOUT_STRATEGIES[number];
export type InjuryType = typeof INJURY_TYPES[number];
export type NewsType = typeof NEWS_TYPES[number];
export type NewsPriority = typeof NEWS_PRIORITIES[number];
export type Sport = typeof SPORTS[number];
export type SeasonStatus = typeof SEASON_STATUSES[number];
