/**
 * Context Module
 *
 * Exports game state management context and hooks.
 */

// Context and Provider
export { GameProvider, useGame, default as GameContext } from './GameContext';

// Reducer
export { gameReducer, initialGameState } from './gameReducer';

// Types
export type {
  GameState,
  GameAction,
  GameContextValue,
  UserTeamState,
  AITeamState,
  LeagueState,
  SeasonState,
  MarketState,
  GameSettings,
  LineupConfig,
  OperationsBudget,
  SimulationMatch,
  InitializeGamePayload,
} from './types';

export {
  DEFAULT_SETTINGS,
  DEFAULT_OPERATIONS_BUDGET,
  DEFAULT_TRAINING_FOCUS,
  SAVE_VERSION,
} from './types';
