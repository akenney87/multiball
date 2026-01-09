/**
 * Soccer Simulation Module
 *
 * Exports for soccer match simulation.
 *
 * @module simulation/soccer
 */

// Types
export type {
  SoccerPosition,
  SoccerTeamState,
  SoccerEventType,
  SoccerEvent,
  SoccerPlayerStats,
  SoccerBoxScore,
  SoccerMatchInput,
  SoccerMatchResult,
  PenaltyShootoutResult,
} from './types';

// Constants
export {
  FORMATION_MODIFIERS,
  FORMATION_POSITIONS,
  GOAL_POSITION_WEIGHTS,
  ASSIST_POSITION_WEIGHTS,
  BASE_EXPECTED_GOALS,
  ASSIST_PROBABILITY,
  AVERAGE_YELLOW_CARDS,
  BASE_SHOTS_PER_TEAM,
  SHOTS_ON_TARGET_RATE,
  BASE_CORNERS_PER_TEAM,
  BASE_FOULS_PER_TEAM,
  // New tactical constants
  ATTACKING_STYLE_MODIFIERS,
  PRESSING_MODIFIERS,
  WIDTH_MODIFIERS,
  HOME_ADVANTAGE_XG_MODIFIER,
  // Card system constants
  YELLOW_CARD_PER_FOUL_RATE,
  STRAIGHT_RED_CARD_RATE,
  CARD_TIMING_WEIGHTS,
  POSITION_FOUL_WEIGHTS,
  // GK system constants
  BASE_SAVE_RATE,
  GK_RATING_SAVE_IMPACT,
  SHOT_QUALITY_SAVE_MODIFIERS,
  // Form constants
  HOT_STREAK_CHANCE,
  HOT_STREAK_MULTIPLIER,
  COLD_STREAK_CHANCE,
  COLD_STREAK_MULTIPLIER,
} from './constants';

// Simulation
export { simulateSoccerMatch, simulateSoccerMatchV2, simulatePenaltyShootout } from './game/matchSimulation';
export { generateBoxScore } from './game/boxScore';

// Systems
export { generateCardEvents, getCardCounts } from './systems/cardSystem';
export { processShots, calculateSaveChance } from './systems/goalkeeperSystem';
export type { ShotQuality, ShotDetail, ShotProcessingResult } from './systems/goalkeeperSystem';

// Play-by-Play
export {
  generateGoalNarrative,
  generateSaveNarrative,
  generateMissNarrative,
  generateCardNarrative,
  generatePlayByPlay,
} from './playByPlay/soccerPlayByPlay';
