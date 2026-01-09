/**
 * Soccer Simulation Constants
 *
 * Attribute weights and configuration for soccer simulation.
 *
 * @module simulation/soccer/constants
 */

// =============================================================================
// TACTICAL STYLE MODIFIERS
// =============================================================================

/**
 * Attacking style effects on xG and possession
 *
 * Possession style: High possession %, lower xG (patient play, fewer shots)
 * Direct style: Moderate possession, higher xG (more shots, less control)
 * Counter style: Low possession, moderate xG (efficient counters)
 */
export const ATTACKING_STYLE_MODIFIERS: Record<string, {
  xG: number;           // Multiplier on expected goals
  possession: number;   // Additive to possession calculation
}> = {
  possession: { xG: 0.95, possession: 8 },   // Patient buildup
  direct: { xG: 1.10, possession: -3 },      // More direct, fewer touches
  counter: { xG: 1.02, possession: -8 },     // Efficient counter-attacks
};

/**
 * Pressing intensity effects on xG, possession, and fatigue
 *
 * High pressing: More turnovers won, higher possession, but more tiring
 * Balanced pressing: Standard approach
 * Low pressing: Energy conservation, concede some territory
 */
export const PRESSING_MODIFIERS: Record<string, {
  xGConceded: number;   // Multiplier on opponent's xG (high pressing disrupts buildup)
  possession: number;   // Additive to possession calculation
  fatigue: number;      // Multiplier on fatigue accumulation
}> = {
  high: { xGConceded: 0.95, possession: 5, fatigue: 1.15 },       // Win ball back quicker but tire faster
  balanced: { xGConceded: 1.00, possession: 0, fatigue: 1.00 },   // Standard approach
  low: { xGConceded: 1.05, possession: -5, fatigue: 0.85 },       // Conserve energy, sit back
};

/**
 * Width effects on attacking style
 *
 * Wide: More crosses and wing play, but fewer chances through the middle
 * Balanced: Standard approach
 * Tight: More central play, better for short passing teams
 */
export const WIDTH_MODIFIERS: Record<string, {
  crossingBonus: number;   // Bonus for aerial chances (headers from crosses)
  centralBonus: number;    // Bonus for central chances (through balls, combinations)
}> = {
  wide: { crossingBonus: 1.20, centralBonus: 0.85 },    // More crosses, wing overloads
  balanced: { crossingBonus: 1.00, centralBonus: 1.00 }, // Standard approach
  tight: { crossingBonus: 0.80, centralBonus: 1.15 },    // Central focus, intricate passing
};

/**
 * Home advantage modifier
 * Real-world: ~55-60% home win rate in top leagues
 */
export const HOME_ADVANTAGE_XG_MODIFIER = 1.08;  // +8% xG for home team

// =============================================================================
// FORMATION MODIFIERS
// =============================================================================

/**
 * Formation attack/defense modifiers
 * Affects team composite calculations
 */
export const FORMATION_MODIFIERS: Record<string, { attack: number; defense: number }> = {
  '4-4-2': { attack: 1.00, defense: 1.00 },   // Balanced
  '4-3-3': { attack: 1.10, defense: 0.95 },   // Attacking
  '4-5-1': { attack: 0.90, defense: 1.10 },   // Defensive
  '3-5-2': { attack: 1.05, defense: 0.95 },   // Midfield control
  '5-3-2': { attack: 0.85, defense: 1.15 },   // Very defensive
  '4-2-3-1': { attack: 1.05, defense: 1.00 }, // Modern balanced
  '3-4-3': { attack: 1.15, defense: 0.85 },   // Very attacking
  '5-4-1': { attack: 0.80, defense: 1.20 },   // Ultra defensive
};

/**
 * Position templates for each formation
 * Defines the 11 positions in lineup order
 */
export const FORMATION_POSITIONS: Record<string, string[]> = {
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CDM', 'CM', 'RM', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CDM', 'CM', 'RWB', 'ST', 'ST'],
  '5-3-2': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CDM', 'CM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LW', 'CAM', 'RW', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '5-4-1': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'LM', 'CM', 'CM', 'RM', 'ST'],
};

// =============================================================================
// POSITION WEIGHTS FOR PLAYER ATTRIBUTION
// =============================================================================

/**
 * Multiplier for goal scoring probability by position
 * Strikers score most, goalkeepers almost never
 */
export const GOAL_POSITION_WEIGHTS: Record<string, number> = {
  ST: 3.0,
  CF: 2.8,
  LW: 2.0,
  RW: 2.0,
  CAM: 1.8,
  LM: 1.2,
  RM: 1.2,
  CM: 1.0,
  CDM: 0.5,
  LWB: 0.4,
  RWB: 0.4,
  LB: 0.3,
  RB: 0.3,
  CB: 0.2,
  GK: 0.01,
};

/**
 * Multiplier for assist probability by position
 * Creative midfielders and wingers most likely
 */
export const ASSIST_POSITION_WEIGHTS: Record<string, number> = {
  CAM: 2.5,
  CM: 2.0,
  LW: 1.8,
  RW: 1.8,
  LM: 1.6,
  RM: 1.6,
  ST: 1.5,
  CF: 1.4,
  CDM: 1.0,
  LWB: 0.9,
  RWB: 0.9,
  LB: 0.8,
  RB: 0.8,
  CB: 0.3,
  GK: 0.1,
};

// =============================================================================
// SIMULATION PARAMETERS
// =============================================================================

/**
 * Base expected goals per team per match
 * Typical real-world average is ~1.3-1.5
 */
export const BASE_EXPECTED_GOALS = 1.4;

/**
 * Probability that a goal has an assist (vs. solo effort)
 */
export const ASSIST_PROBABILITY = 0.70;

/**
 * Average yellow cards per match (total for both teams)
 */
export const AVERAGE_YELLOW_CARDS = 3.5;

/**
 * Base shots per team per match
 */
export const BASE_SHOTS_PER_TEAM = 12;

/**
 * Percentage of shots that are on target (typical ~35%)
 */
export const SHOTS_ON_TARGET_RATE = 0.35;

/**
 * Base corners per team per match
 */
export const BASE_CORNERS_PER_TEAM = 5;

/**
 * Base fouls per team per match
 */
export const BASE_FOULS_PER_TEAM = 12;

// =============================================================================
// CARD SYSTEM CONSTANTS
// =============================================================================

/**
 * Yellow card probability per foul
 * Target: ~1 yellow per 6 fouls (~16.7%)
 */
export const YELLOW_CARD_PER_FOUL_RATE = 0.167;

/**
 * Straight red card probability per foul
 * Real-world: Very rare (~0.5% of fouls)
 */
export const STRAIGHT_RED_CARD_RATE = 0.005;

/**
 * Card timing weights - more cards late in game due to fatigue and desperation
 * Probability distribution by 15-minute blocks
 */
export const CARD_TIMING_WEIGHTS: Record<string, number> = {
  '0-15': 0.10,    // Early game, calm
  '16-30': 0.12,
  '31-45': 0.15,   // End of first half tension
  '46-60': 0.13,
  '61-75': 0.20,   // Fatigue setting in
  '76-90': 0.30,   // Desperation fouls, late tackles
};

/**
 * Position-based foul rates
 * Defenders and defensive mids commit more tactical fouls
 */
export const POSITION_FOUL_WEIGHTS: Record<string, number> = {
  GK: 0.05,
  CB: 1.30,
  LB: 1.10,
  RB: 1.10,
  LWB: 1.00,
  RWB: 1.00,
  CDM: 1.40,  // Most tactical fouls
  CM: 1.20,
  LM: 0.90,
  RM: 0.90,
  CAM: 0.80,
  LW: 0.85,
  RW: 0.85,
  ST: 0.90,
  CF: 0.85,
};

/**
 * Aggression attribute weights for foul likelihood
 * High bravery + determination = more likely to commit fouls
 * High composure + patience = less likely to commit fouls
 */
export const AGGRESSION_ATTRIBUTES = {
  positive: { bravery: 0.30, determination: 0.25 },   // Makes player more aggressive
  negative: { composure: 0.25, patience: 0.20 },      // Makes player more disciplined
};

// =============================================================================
// GOALKEEPER SYSTEM CONSTANTS
// =============================================================================

/**
 * Base save rate before GK rating modifier
 * ~35% of shots on target result in goals (65% saved)
 */
export const BASE_SAVE_RATE = 0.65;

/**
 * GK rating impact on save probability
 * Rating 50 = base rate, 100 = +25% saves, 0 = -25% saves
 */
export const GK_RATING_SAVE_IMPACT = 0.005;  // Each point = 0.5% save rate change

/**
 * Shot quality modifiers (how hard to save)
 * Full chance (1v1, penalty box) = harder to save
 * Half chance (edge of box, deflection) = easier to save
 */
export const SHOT_QUALITY_SAVE_MODIFIERS: Record<string, number> = {
  fullChance: 0.75,     // 25% penalty on save rate (harder to stop)
  halfChance: 1.15,     // 15% bonus on save rate (easier to stop)
  longRange: 1.30,      // 30% bonus (easier to stop)
};

// =============================================================================
// PLAYER FORM / CONSISTENCY CONSTANTS
// =============================================================================

/**
 * Consistency attribute impact on performance variance
 * High consistency = reliable, low variance
 * Low consistency = boom-or-bust
 */
export const CONSISTENCY_VARIANCE_SCALE = 0.002;

/**
 * Hot streak probability (player in exceptional form)
 * When triggered, player gets significant bonus
 */
export const HOT_STREAK_CHANCE = 0.08;  // 8% chance per match
export const HOT_STREAK_MULTIPLIER = 1.35;  // +35% goal/assist weight

/**
 * Cold streak probability (player in poor form)
 */
export const COLD_STREAK_CHANCE = 0.05;  // 5% chance per match
export const COLD_STREAK_MULTIPLIER = 0.70;  // -30% goal/assist weight

/**
 * Skill vs position weight balance for player attribution
 * Higher individual skill weight = better players consistently outperform
 */
export const INDIVIDUAL_SKILL_WEIGHT = 0.6;  // 60% skill
export const POSITION_WEIGHT = 0.4;          // 40% position

// =============================================================================
// SET PIECE CONSTANTS
// =============================================================================

/**
 * Probability that a corner kick leads to a shot opportunity
 */
export const CORNER_TO_SHOT_PROBABILITY = 0.22;  // 22% of corners lead to shots

/**
 * Probability that a free kick (in attacking third) leads to a shot opportunity
 */
export const FREE_KICK_TO_SHOT_PROBABILITY = 0.15;  // 15% of free kicks lead to shots

/**
 * Height advantage multiplier for set piece scoring
 * Taller players have significant advantage on aerial set pieces
 */
export const SET_PIECE_HEIGHT_ADVANTAGE = 0.015;  // Each inch above avg = +1.5% scoring chance

/**
 * Average height used as baseline for set piece calculations (in inches)
 * Real world average soccer player height is ~5'10" (70 inches)
 */
export const AVERAGE_PLAYER_HEIGHT = 70;

/**
 * Set piece shot quality distribution
 * Most set piece chances are half chances (contested headers, scrambles)
 */
export const SET_PIECE_SHOT_QUALITY: Record<string, number> = {
  fullChance: 0.25,    // 25% are clear headers/volleys
  halfChance: 0.55,    // 55% are contested
  longRange: 0.20,     // 20% fall to edge of box
};

/**
 * Position weights for being the set piece target
 * CB/ST are primary headers, others are secondary
 */
export const SET_PIECE_TARGET_WEIGHTS: Record<string, number> = {
  ST: 2.5,
  CF: 2.3,
  CB: 2.0,    // CBs come up for corners
  CAM: 1.2,
  CM: 1.0,
  CDM: 0.9,
  LW: 0.8,
  RW: 0.8,
  LM: 0.7,
  RM: 0.7,
  LB: 0.5,
  RB: 0.5,
  LWB: 0.6,
  RWB: 0.6,
  GK: 0.01,   // GK rarely scores from set pieces
};
