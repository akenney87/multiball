/**
 * UI Module
 *
 * Main entry point for the React Native UI.
 */

// Main App
export { App } from './App';

// Navigation
export { AppNavigator, TabNavigator } from './navigation';

// Theme
export {
  ThemeProvider,
  useTheme,
  useColors,
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  shadows,
  layout,
  textStyles,
} from './theme';

// Components - Common
export { ErrorBoundary } from './components/common/ErrorBoundary';
export { ConfirmationModal } from './components/common/ConfirmationModal';
export { SaveIndicator } from './components/common/SaveIndicator';
export type { SaveStatus } from './components/common/SaveIndicator';

// Components - Roster
export { PlayerCard } from './components/roster/PlayerCard';
export type { PlayerCardData } from './components/roster/PlayerCard';

// Components - Season
export { SeasonProgressWidget } from './components/season/SeasonProgressWidget';
export type { SeasonProgressData, SeasonPhase } from './components/season/SeasonProgressWidget';

// Screens
export { DashboardScreen } from './screens/DashboardScreen';
export { PlaceholderScreen } from './screens/PlaceholderScreen';
export { MatchPreviewScreen } from './screens/MatchPreviewScreen';
export { MatchSimulationScreen } from './screens/MatchSimulationScreen';
export { MatchResultScreen } from './screens/MatchResultScreen';
export { RosterScreen } from './screens/RosterScreen';
export { PlayerDetailScreen } from './screens/PlayerDetailScreen';
export { ScheduleScreen } from './screens/ScheduleScreen';
export type { ScheduleMatch } from './screens/ScheduleScreen';
export { StandingsScreen } from './screens/StandingsScreen';
export type { TeamStanding } from './screens/StandingsScreen';
export { TransferMarketScreen } from './screens/TransferMarketScreen';
export type { TransferTarget, IncomingOffer } from './screens/TransferMarketScreen';
export { BudgetScreen } from './screens/BudgetScreen';
export type { BudgetAllocation, BudgetData } from './screens/BudgetScreen';
export { SettingsScreen } from './screens/SettingsScreen';
export { NewGameScreen } from './screens/NewGameScreen';
export type { NewGameConfig, Difficulty } from './screens/NewGameScreen';

// Persistence
export { GameStorage } from './persistence/gameStorage';
export type {
  SavedGameState,
  SavedPlayer,
  SavedMatch,
  GameSettings as PersistenceSettings,
  SaveResult,
  LoadResult,
} from './persistence/gameStorage';

// Context
export {
  GameProvider,
  useGame,
  GameContext,
  gameReducer,
  initialGameState,
  DEFAULT_SETTINGS,
  DEFAULT_OPERATIONS_BUDGET,
  DEFAULT_TRAINING_FOCUS,
  SAVE_VERSION,
} from './context';
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
} from './context';

// Integration
export {
  initializeNewGame,
  calculatePlayerOverall,
} from './integration';

// Connected Screens
export { ConnectedDashboardScreen } from './screens/ConnectedDashboardScreen';
export { ConnectedMatchPreviewScreen } from './screens/ConnectedMatchPreviewScreen';
export { ConnectedMatchResultScreen } from './screens/ConnectedMatchResultScreen';
export { ConnectedRosterScreen } from './screens/ConnectedRosterScreen';
export { ConnectedPlayerDetailScreen } from './screens/ConnectedPlayerDetailScreen';
export { ConnectedScheduleScreen } from './screens/ConnectedScheduleScreen';
export { ConnectedStandingsScreen } from './screens/ConnectedStandingsScreen';
export { ConnectedTransferMarketScreen } from './screens/ConnectedTransferMarketScreen';
export { ConnectedBudgetScreen } from './screens/ConnectedBudgetScreen';
export { ConnectedSettingsScreen } from './screens/ConnectedSettingsScreen';

// Hooks
export { useMatch, useLineup } from './hooks';
export type { MatchData, MatchTeamData, LineupPlayer } from './hooks';
