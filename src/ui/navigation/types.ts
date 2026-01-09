/**
 * Navigation Types
 *
 * Type definitions for navigation parameters.
 */

// Tab Navigator - Consolidated 2-tab structure
export type TabParamList = {
  PlayTab: undefined;
  ManageTab: undefined;
};

// Home Stack
export type HomeStackParamList = {
  Dashboard: undefined;
  MatchPreview: { matchId: string };
  MatchSimulation: { matchId: string };
  MatchResult: { matchId: string };
};

// Roster Stack
export type RosterStackParamList = {
  RosterList: undefined;
  PlayerDetail: { playerId: string };
  LineupBuilder: undefined;
  Training: undefined;
};

// Season Stack
export type SeasonStackParamList = {
  Schedule: undefined;
  Standings: undefined;
  SeasonSummary: undefined;
};

// Market Stack
export type MarketStackParamList = {
  TransferMarket: undefined;
  FreeAgentMarket: undefined;
  Budget: undefined;
  Scouting: undefined;
  PlayerOffer: { playerId: string };
};

// Settings Stack
export type SettingsStackParamList = {
  SettingsMain: undefined;
  About: undefined;
};

// Combined root param list (for type-safe navigation)
export type RootStackParamList = HomeStackParamList &
  RosterStackParamList &
  SeasonStackParamList &
  MarketStackParamList &
  SettingsStackParamList;
