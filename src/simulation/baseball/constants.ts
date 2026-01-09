/**
 * Baseball Simulation Constants
 *
 * Weight tables, base rates, and tuning constants for baseball simulation.
 * Follows the same patterns as basketball simulation constants.
 *
 * @module simulation/baseball/constants
 */

// =============================================================================
// SIGMOID TUNING
// =============================================================================

/**
 * Sigmoid steepness constant for baseball
 * Slightly lower than basketball (0.025) due to higher variance in baseball
 */
export const SIGMOID_K = 0.02;

// =============================================================================
// BATTING WEIGHT TABLES
// =============================================================================

/**
 * Contact ability - making contact with the ball
 */
export const WEIGHTS_BATTING_CONTACT: Record<string, number> = {
  hand_eye_coordination: 0.30,
  form_technique: 0.15,
  reactions: 0.15,
  composure: 0.15,
  patience: 0.10,
  consistency: 0.10,
  awareness: 0.05,
};

/**
 * Power - extra base hit potential
 */
export const WEIGHTS_BATTING_POWER: Record<string, number> = {
  core_strength: 0.35,
  arm_strength: 0.15,
  grip_strength: 0.15,
  form_technique: 0.15,
  balance: 0.10,
  height: 0.10,
};

/**
 * Plate discipline - working counts, drawing walks
 */
export const WEIGHTS_PLATE_DISCIPLINE: Record<string, number> = {
  patience: 0.35,
  awareness: 0.25,
  composure: 0.20,
  consistency: 0.10,
  determination: 0.10,
};

// =============================================================================
// PITCHING WEIGHT TABLES
// =============================================================================

/**
 * Velocity - fastball effectiveness
 */
export const WEIGHTS_PITCHING_VELOCITY: Record<string, number> = {
  arm_strength: 0.30,
  core_strength: 0.20,
  acceleration: 0.15,
  stamina: 0.15,
  form_technique: 0.10,
  balance: 0.10,
};

/**
 * Control - throwing strikes, locating pitches
 */
export const WEIGHTS_PITCHING_CONTROL: Record<string, number> = {
  throw_accuracy: 0.30,
  composure: 0.20,
  consistency: 0.20,
  form_technique: 0.15,
  hand_eye_coordination: 0.10,
  patience: 0.05,
};

/**
 * Movement - pitch deception, break
 */
export const WEIGHTS_PITCHING_MOVEMENT: Record<string, number> = {
  deception: 0.30,
  finesse: 0.25,
  hand_eye_coordination: 0.20,
  creativity: 0.15,
  form_technique: 0.10,
};

/**
 * Pitcher stamina - pitching deep into games
 */
export const WEIGHTS_PITCHER_STAMINA: Record<string, number> = {
  stamina: 0.50,
  durability: 0.25,
  determination: 0.15,
  composure: 0.10,
};

// =============================================================================
// FIELDING WEIGHT TABLES
// =============================================================================

/**
 * Infield defense (SS, 2B, 3B)
 */
export const WEIGHTS_FIELDING_INFIELD: Record<string, number> = {
  reactions: 0.25,
  agility: 0.20,
  throw_accuracy: 0.20,
  arm_strength: 0.15,
  hand_eye_coordination: 0.10,
  awareness: 0.10,
};

/**
 * Outfield defense
 */
export const WEIGHTS_FIELDING_OUTFIELD: Record<string, number> = {
  top_speed: 0.25,
  acceleration: 0.20,
  arm_strength: 0.20,
  awareness: 0.15,
  reactions: 0.10,
  jumping: 0.10,
};

/**
 * First base defense
 */
export const WEIGHTS_FIELDING_FIRST: Record<string, number> = {
  height: 0.25,
  hand_eye_coordination: 0.25,
  reactions: 0.20,
  footwork: 0.15,
  agility: 0.15,
};

/**
 * Catcher defense (blocking/receiving pitches)
 */
export const WEIGHTS_FIELDING_CATCHER: Record<string, number> = {
  reactions: 0.30,
  hand_eye_coordination: 0.25,
  agility: 0.20,
  awareness: 0.15,
  composure: 0.10,
};

/**
 * Catcher arm (throwing out base stealers)
 */
export const WEIGHTS_CATCHER_ARM: Record<string, number> = {
  throw_accuracy: 0.30,
  arm_strength: 0.25,
  reactions: 0.20,
  footwork: 0.10,
  awareness: 0.10,
  composure: 0.05,
};

/**
 * Pitcher ability to hold runners
 */
export const WEIGHTS_HOLD_RUNNERS: Record<string, number> = {
  awareness: 0.30,
  composure: 0.25,
  reactions: 0.20,
  throw_accuracy: 0.15,
  deception: 0.10,
};

// =============================================================================
// BASERUNNING WEIGHT TABLES
// =============================================================================

/**
 * Stolen base ability
 */
export const WEIGHTS_STEALING: Record<string, number> = {
  acceleration: 0.30,
  top_speed: 0.25,
  reactions: 0.20,
  awareness: 0.15,
  bravery: 0.10,
};

/**
 * Taking extra bases
 */
export const WEIGHTS_BASERUNNING_AGGRESSION: Record<string, number> = {
  top_speed: 0.25,
  awareness: 0.25,
  bravery: 0.20,
  acceleration: 0.15,
  determination: 0.15,
};

// =============================================================================
// BASE RATES
// =============================================================================

// At-bat outcomes (before attribute modifiers)
export const BASE_RATE_STRIKEOUT = 0.22;
export const BASE_RATE_WALK = 0.08;
export const BASE_RATE_HIT_BY_PITCH = 0.01;
export const BASE_RATE_CONTACT = 0.69;

// Hit distribution (when contact is made, ball in play)
export const BASE_RATE_SINGLE = 0.65;
export const BASE_RATE_DOUBLE = 0.20;
export const BASE_RATE_TRIPLE = 0.02;
export const BASE_RATE_HOME_RUN = 0.13;

// Out distribution (when contact results in out)
export const BASE_RATE_GROUNDOUT = 0.45;
export const BASE_RATE_FLYOUT = 0.35;
export const BASE_RATE_LINEOUT = 0.15;
export const BASE_RATE_POPUP = 0.05;

// Fielding
export const BASE_RATE_ERROR = 0.02;
export const BASE_RATE_DOUBLE_PLAY = 0.10;

// Triple play - ~1 in 450 games, only possible with 2+ runners on base
// With ~38 PAs per game and 2+ runners on ~1.5% of PAs:
// Per-PA rate when eligible: 1/(450 * 38 * 0.015) ≈ 0.004
export const BASE_RATE_TRIPLE_PLAY = 0.004;

// Baserunning
export const BASE_RATE_STEAL_ATTEMPT = 0.05;      // 5% of opportunities
export const BASE_RATE_STEAL_SUCCESS = 0.75;      // 75% when attempted
export const BASE_RATE_STEAL_HOME_DESPERATION = 0.02;  // Only in desperation situations

// Situational (per at-bat with runners on, not per pitch)
export const BASE_RATE_WILD_PITCH = 0.01;         // ~1% per at-bat with runners
export const BASE_RATE_PASSED_BALL = 0.005;       // ~0.5% per at-bat with runners
export const BASE_RATE_SAC_FLY_SUCCESS = 0.85;

// Wild pitch / passed ball advancement rates
// Runners ALWAYS attempt to advance on WP/PB (100% attempt rate)
// These are the base rates for SUCCESS (modified by runner speed vs catcher arm)
export const WP_ADVANCE_FIRST_TO_SECOND = 0.75;
export const WP_ADVANCE_SECOND_TO_THIRD = 0.75;
export const WP_ADVANCE_THIRD_TO_HOME = 0.75;
export const BASE_RATE_SAC_BUNT_SUCCESS = 0.80;

// Ground out advancement rates (with < 2 outs)
export const GROUNDOUT_SCORE_FROM_THIRD = 0.08;    // 5-10% range
export const GROUNDOUT_ADVANCE_FROM_SECOND = 0.25; // 20-30% range

// Fly out tag-up rates (when runner attempts to tag)
// These are SUCCESS rates - failure means thrown out
export const TAGUP_SCORE_FROM_THIRD = 0.96;        // 96% success when attempting sac fly
export const TAGUP_ADVANCE_FROM_SECOND = 0.88;     // 88% success when attempting 2nd→3rd

// Tag-up decision rates (whether to attempt based on fly ball depth/situation)
// These modify the above - runner won't attempt if fly is too shallow
export const TAGUP_ATTEMPT_FROM_THIRD = 0.85;      // 85% of fly outs with runner on 3rd, runner attempts
export const TAGUP_ATTEMPT_FROM_SECOND = 0.35;     // 35% of fly outs with runner on 2nd, runner attempts

// Failure to tag up properly (leaves early or doesn't get back) - leads to DP
export const FAILURE_TO_TAG_RATE = 1/350;          // ~0.29% of fly outs

// Double play modifiers
export const DP_BATTER_SPEED_FACTOR = 0.15;        // Fast batter reduces DP chance by up to 15%
export const DP_RUNNER_SPEED_FACTOR = 0.15;        // Fast runner reduces DP chance by up to 15%

// Runner scoring from 3rd during DP (0 outs only, bases loaded or 1st & 3rd)
// Defense decision to throw home vs take sure DP
export const DP_THROW_HOME_BASE_RATE = 0.40;       // 40% of time defense tries for lead runner
export const DP_THROW_HOME_SUCCESS = 0.70;         // 70% success when throwing home first
export const DP_RUNNER_SCORES_IF_SURE_DP = 0.85;   // 85% runner scores if defense takes sure DP

// =============================================================================
// PLATOON ADVANTAGE
// =============================================================================

/**
 * Bonus for favorable L/R matchup
 * Applied as multiplier to contact/power composites
 */
export const PLATOON_ADVANTAGE_MODIFIER = 0.05;

// =============================================================================
// CLUTCH SITUATIONS
// =============================================================================

/**
 * Definition of high-leverage situations
 */
export const CLUTCH_SITUATION_THRESHOLD = {
  minInning: 7,
  maxRunDifferential: 2,
};

/**
 * Composure weight increase in clutch situations
 */
export const CLUTCH_COMPOSURE_MULTIPLIER = 1.5;

// =============================================================================
// PITCHER FATIGUE
// =============================================================================

/**
 * Pitch count at which degradation begins
 */
export const PITCH_COUNT_THRESHOLD = 80;

/**
 * Degradation per pitch over threshold (0.5%)
 */
export const DEGRADATION_RATE = 0.005;

/**
 * Maximum degradation cap (30%)
 */
export const MAX_DEGRADATION = 0.30;

/**
 * Pitch count for mandatory substitution consideration
 */
export const PITCH_COUNT_SUBSTITUTION_THRESHOLD = 100;

// =============================================================================
// PITCHER SUBSTITUTION - DYNAMIC ROPE SYSTEM
// =============================================================================

/**
 * Default strategy values for pitcher management
 */
export const DEFAULT_STARTER_MAX_RUNS_INNING = 4;      // Base rope before adjustments
export const DEFAULT_RELIEVER_MAX_RUNS_INNING = 3;    // Relievers on shorter leash
export const DEFAULT_STARTER_MAX_PITCH_COUNT = 100;   // Hard cap

/**
 * Meltdown detection - too many hits in one inning
 */
export const MELTDOWN_HITS_THRESHOLD = 4;

/**
 * Rope adjustment thresholds based on pitch count
 * Rope tightens as pitcher throws more pitches
 */
export const ROPE_PITCH_COUNT_TIERS = {
  TIER_1_THRESHOLD: 60,   // 0-59 pitches: no adjustment
  TIER_1_ADJUSTMENT: 0,
  TIER_2_THRESHOLD: 80,   // 60-79 pitches: -0.5 rope
  TIER_2_ADJUSTMENT: -0.5,
  TIER_3_THRESHOLD: 100,  // 80-99 pitches: -1.0 rope
  TIER_3_ADJUSTMENT: -1.0,
  TIER_4_ADJUSTMENT: -1.5, // 100+ pitches: -1.5 rope
};

/**
 * Rope adjustment thresholds based on inning
 * Rope tightens in late innings
 */
export const ROPE_INNING_TIERS = {
  LATE_INNING_THRESHOLD: 6,    // Innings 6-7: -0.5 rope
  LATE_INNING_ADJUSTMENT: -0.5,
  CLOSING_INNING_THRESHOLD: 8, // Innings 8-9+: -1.0 rope
  CLOSING_INNING_ADJUSTMENT: -1.0,
};

/**
 * Situational rope adjustments
 */
export const ROPE_SITUATIONAL = {
  RUNNERS_ON_THRESHOLD: 2,     // 2+ runners on base
  RUNNERS_ON_ADJUSTMENT: -0.5,
  CLOSE_GAME_THRESHOLD: 2,     // Within 2 runs
  CLOSE_GAME_ADJUSTMENT: -0.5,
  BASES_LOADED_WITH_DAMAGE: 1, // Pull if bases loaded AND 1+ runs allowed
};

/**
 * Closer usage settings
 */
export const CLOSER_SETTINGS = {
  MIN_INNING: 9,              // Only use closer in 9th or later
  MIN_LEAD: 1,                // Need at least 1 run lead
  MAX_LEAD: 3,                // Don't waste closer if ahead by 4+
};

/**
 * Minimum rope value (always give pitcher a chance)
 */
export const MIN_ROPE = 1;

// =============================================================================
// BATTING STRATEGY MODIFIERS
// =============================================================================

/**
 * Plate approach modifiers
 * Aggressive: Swing at bad pitches - more Ks, fewer BBs
 * Patient: Wait for your pitch - more BBs, better contact
 */
export const PLATE_APPROACH_MODIFIERS = {
  aggressive: {
    contactRate: -0.05,      // -5% contact (swinging at bad pitches)
    strikeoutRate: 0.15,     // +15% strikeouts (chasing)
    walkRate: -0.40,         // -40% walks (never taking)
  },
  patient: {
    contactRate: 0.05,       // +5% contact (better pitch selection)
    strikeoutRate: -0.05,    // -5% strikeouts
    walkRate: 0.50,          // +50% walks (willing to take ball 4)
  },
  balanced: {
    contactRate: 0,
    strikeoutRate: 0,
    walkRate: 0,
  },
};

/**
 * Swing style modifiers
 * Contact: More singles, fewer HRs, more GIDPs
 * Power: More HRs, more strikeouts, more flyouts
 */
export const SWING_STYLE_MODIFIERS = {
  contact: {
    singleRate: 0.15,        // +15% singles
    homeRunRate: -0.30,      // -30% home runs
    extraBaseHitRate: -0.15, // -15% doubles/triples
    strikeoutRate: -0.15,    // -15% strikeouts
    doublePlayRate: 0.20,    // +20% GIDPs (more groundballs)
    babipModifier: 0.05,     // +5% BABIP (better contact)
  },
  power: {
    singleRate: -0.15,       // -15% singles
    homeRunRate: 0.30,       // +30% home runs
    extraBaseHitRate: 0.20,  // +20% doubles/triples (when hitting well)
    strikeoutRate: 0.20,     // +20% strikeouts
    doublePlayRate: -0.10,   // -10% GIDPs (more fly balls)
    babipModifier: -0.05,    // -5% BABIP (more whiffs)
  },
  balanced: {
    singleRate: 0,
    homeRunRate: 0,
    extraBaseHitRate: 0,
    strikeoutRate: 0,
    doublePlayRate: 0,
    babipModifier: 0,
  },
};

/**
 * Baserunning style modifiers (additive, not multiplicative)
 * Aggressive: More attempts, worse success rate
 * Conservative: Fewer attempts, better success rate
 */
export const BASERUNNING_STYLE_MODIFIERS = {
  aggressive: {
    stealAttemptRate: 0.08,   // +8 percentage points
    stealSuccessRate: -0.05,  // -5 percentage points (worse jumps)
    extraBaseRate: 0.15,      // +15 percentage points
  },
  conservative: {
    stealAttemptRate: -0.06,  // -6 percentage points
    stealSuccessRate: 0.05,   // +5 percentage points (only sure things)
    extraBaseRate: -0.10,     // -10 percentage points
  },
  balanced: {
    stealAttemptRate: 0,
    stealSuccessRate: 0,
    extraBaseRate: 0,
  },
};

// =============================================================================
// GAME STRUCTURE
// =============================================================================

/**
 * Innings in a regulation game
 */
export const INNINGS_PER_GAME = 9;

/**
 * Outs per half-inning
 */
export const OUTS_PER_HALF_INNING = 3;

/**
 * Strikes for strikeout
 */
export const STRIKES_FOR_OUT = 3;

/**
 * Balls for walk
 */
export const BALLS_FOR_WALK = 4;
