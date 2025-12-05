/**
 * GameContext Types
 *
 * Type definitions for the game state management layer.
 * Bridges UI components with Phase 1-3 game engine.
 */

import type {
  Player,
  Match,
  MatchResult,
  TeamStanding,
  TransferOffer,
  NewsItem,
  TrainingFocus,
  TacticalSettings,
  ContractNegotiation,
  ContractOffer,
} from '../../data/types';
import type { AIConfig } from '../../ai/types';
import type { Difficulty, NewGameConfig } from '../screens/NewGameScreen';
import type { ScoutReport } from '../../systems/scoutingSystem';

// =============================================================================
// GAME STATE
// =============================================================================

/**
 * Lineup configuration for matches
 */
export interface LineupConfig {
  /** Starting 5 player IDs in position order (PG, SG, SF, PF, C) */
  starters: [string, string, string, string, string];

  /** Bench player IDs in rotation priority order */
  bench: string[];

  /** Minutes allocation (player ID -> target minutes) */
  minutesAllocation: Record<string, number>;
}

/**
 * Budget allocation for operations (percentages 0-100, must sum to 100)
 */
export interface OperationsBudget {
  training: number;
  scouting: number;
  facilities: number;
  youthDevelopment: number;
}

/**
 * Scout Instructions - filters for auto-scouting when no targets are set
 */
export interface ScoutInstructions {
  // Physical filters
  heightMin?: number;      // in inches (e.g., 72 = 6'0")
  heightMax?: number;
  weightMin?: number;      // in pounds
  weightMax?: number;
  ageMin?: number;
  ageMax?: number;

  // Geographic filter
  nationalities?: string[];  // empty/undefined = all nationalities

  // Contract filters
  freeAgentsOnly: boolean;
  salaryMin?: number;        // ignored if freeAgentsOnly
  salaryMax?: number;        // ignored if freeAgentsOnly
  transferValueMin?: number; // ignored if freeAgentsOnly
  transferValueMax?: number; // ignored if freeAgentsOnly
}

/**
 * Default scout instructions (no filters)
 */
export const DEFAULT_SCOUT_INSTRUCTIONS: ScoutInstructions = {
  freeAgentsOnly: false,
};

/**
 * User team state
 */
export interface UserTeamState {
  /** Team ID (always 'user') */
  id: 'user';

  /** Team name */
  name: string;

  /** Team colors */
  colors: {
    primary: string;
    secondary: string;
  };

  /** Current division (1-5, starts at 5) */
  division: 1 | 2 | 3 | 4 | 5;

  /** Total budget for season */
  totalBudget: number;

  /** Committed to salaries */
  salaryCommitment: number;

  /** Available for operations */
  availableBudget: number;

  /** Operations budget allocation */
  operationsBudget: OperationsBudget;

  /** Roster player IDs */
  rosterIds: string[];

  /** Current lineup configuration */
  lineup: LineupConfig;

  /** Team-wide training focus */
  trainingFocus: TrainingFocus;

  /** Tactical settings */
  tactics: TacticalSettings;
}

/**
 * AI team state (simplified from full Franchise)
 */
export interface AITeamState {
  /** Team ID */
  id: string;

  /** Team name */
  name: string;

  /** Team colors */
  colors: {
    primary: string;
    secondary: string;
  };

  /** Current division */
  division: 1 | 2 | 3 | 4 | 5;

  /** Roster player IDs */
  rosterIds: string[];

  /** AI configuration */
  aiConfig: AIConfig;
}

/**
 * League state
 */
export interface LeagueState {
  /** All teams (including user) */
  teams: AITeamState[];

  /** Free agent player IDs */
  freeAgentIds: string[];
}

/**
 * Season state
 */
export interface SeasonState {
  /** Season ID */
  id: string;

  /** Season number */
  number: number;

  /** Current week (1-40) */
  currentWeek: number;

  /** Season status */
  status: 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

  /** Is transfer window open */
  transferWindowOpen: boolean;

  /** All matches */
  matches: Match[];

  /** Current standings (team ID -> standing) */
  standings: Record<string, TeamStanding>;
}

/**
 * Market state
 */
export interface MarketState {
  /** Active transfer offers */
  transferOffers: TransferOffer[];

  /** Incoming offers (to user team) */
  incomingOffers: TransferOffer[];

  /** Outgoing offers (from user team) */
  outgoingOffers: TransferOffer[];

  /** Active contract negotiation (FM-style) */
  activeNegotiation: ContractNegotiation | null;

  /** Completed negotiations history */
  negotiationHistory: ContractNegotiation[];
}

/**
 * Game settings
 */
export interface GameSettings {
  /** Difficulty level */
  difficulty: Difficulty;

  /** Simulation speed */
  simulationSpeed: 'slow' | 'normal' | 'fast';

  /** Sound effects enabled */
  soundEnabled: boolean;

  /** Notifications enabled */
  notificationsEnabled: boolean;

  /** Auto-save enabled */
  autoSaveEnabled: boolean;

  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
}

/**
 * Complete game state
 */
export interface GameState {
  /** Is game initialized */
  initialized: boolean;

  /** Save version for migrations */
  version: string;

  /** Last saved timestamp */
  lastSaved: Date | null;

  /** User team */
  userTeam: UserTeamState;

  /** All players (keyed by ID for fast lookup) */
  players: Record<string, Player>;

  /** League state */
  league: LeagueState;

  /** Current season */
  season: SeasonState;

  /** Market state */
  market: MarketState;

  /** Recent events/news */
  events: NewsItem[];

  /** Game settings */
  settings: GameSettings;

  /** Player IDs that have been scouted (full attribute visibility) */
  scoutedPlayerIds: string[];

  /** Player IDs that are prioritized for scouting */
  scoutingTargetIds: string[];

  /** Generated scouting reports */
  scoutingReports: ScoutReport[];

  /** Scout instructions for auto-scouting filters */
  scoutInstructions: ScoutInstructions;

  /** Scouting depth slider value (0-1, breadth to depth) */
  scoutingDepthSlider: number;
}

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Game action types
 */
export type GameAction =
  // Initialization
  | { type: 'INITIALIZE_GAME'; payload: InitializeGamePayload }
  | { type: 'LOAD_GAME'; payload: GameState }
  | { type: 'RESET_GAME' }

  // Season
  | { type: 'ADVANCE_WEEK' }
  | { type: 'UPDATE_STANDINGS'; payload: Record<string, TeamStanding> }
  | { type: 'COMPLETE_MATCH'; payload: { matchId: string; result: MatchResult } }

  // Roster
  | { type: 'SET_LINEUP'; payload: LineupConfig }
  | { type: 'RELEASE_PLAYER'; payload: { playerId: string } }
  | { type: 'SIGN_PLAYER'; payload: { player: Player } }
  | { type: 'SET_TRAINING_FOCUS'; payload: { playerId?: string; focus: TrainingFocus } }

  // Market
  | { type: 'MAKE_OFFER'; payload: { playerId: string; amount: number } }
  | { type: 'RESPOND_TO_OFFER'; payload: { offerId: string; accept: boolean } }
  | { type: 'EXPIRE_OFFERS' }
  | { type: 'PROCESS_TRANSFER_RESPONSES'; payload: { currentWeek: number } }
  | { type: 'COMPLETE_TRANSFER'; payload: { offerId: string; playerId: string; fromTeamId: string; toTeamId: string; fee: number } }

  // Contract Negotiation (FM-style)
  | { type: 'START_NEGOTIATION'; payload: { playerId: string; transferFee?: number; negotiationType: 'new_signing' | 'renewal' | 'transfer' } }
  | { type: 'SUBMIT_CONTRACT_OFFER'; payload: { offer: ContractOffer } }
  | { type: 'ACCEPT_PLAYER_COUNTER' }
  | { type: 'CANCEL_NEGOTIATION' }
  | { type: 'COMPLETE_SIGNING' }

  // Budget
  | { type: 'SET_OPERATIONS_BUDGET'; payload: OperationsBudget }

  // Settings
  | { type: 'UPDATE_SETTINGS'; payload: Partial<GameSettings> }

  // Events
  | { type: 'ADD_EVENT'; payload: NewsItem }
  | { type: 'MARK_EVENT_READ'; payload: { eventId: string } }

  // Scouting
  | { type: 'SCOUT_PLAYER'; payload: { playerId: string } }
  | { type: 'ADD_SCOUTING_TARGET'; payload: { playerId: string } }
  | { type: 'REMOVE_SCOUTING_TARGET'; payload: { playerId: string } }
  | { type: 'ADD_SCOUTING_REPORT'; payload: { report: ScoutReport } }
  | { type: 'SET_SCOUT_INSTRUCTIONS'; payload: ScoutInstructions }
  | { type: 'SET_SCOUTING_DEPTH_SLIDER'; payload: number }

  // Save
  | { type: 'MARK_SAVED'; payload: { timestamp: Date } };

/**
 * Payload for initializing a new game
 */
export interface InitializeGamePayload {
  config: NewGameConfig;
  userTeam: UserTeamState;
  players: Record<string, Player>;
  league: LeagueState;
  season: SeasonState;
}

// =============================================================================
// CONTEXT VALUE
// =============================================================================

/**
 * Match to simulate
 */
export interface SimulationMatch {
  match: Match;
  userRoster: Player[];
  opponentRoster: Player[];
  userLineup: LineupConfig;
  isUserHome: boolean;
}

/**
 * GameContext value provided to consumers
 */
export interface GameContextValue {
  /** Current game state */
  state: GameState;

  /** Is game loading */
  isLoading: boolean;

  /** Current error (if any) */
  error: string | null;

  // =========================================================================
  // GAME MANAGEMENT
  // =========================================================================

  /**
   * Start a new game with the given configuration
   */
  startNewGame: (config: NewGameConfig) => Promise<void>;

  /**
   * Load saved game from storage
   * @returns true if game was loaded, false if no save exists
   */
  loadGame: () => Promise<boolean>;

  /**
   * Save current game to storage
   */
  saveGame: () => Promise<void>;

  /**
   * Reset game (delete save and clear state)
   */
  resetGame: () => Promise<void>;

  // =========================================================================
  // SEASON ACTIONS
  // =========================================================================

  /**
   * Advance to the next week
   * - Processes AI team actions
   * - Updates market
   * - Advances schedule
   */
  advanceWeek: () => Promise<void>;

  /**
   * Simulate a specific match
   * @returns Match result
   */
  simulateMatch: (matchId: string) => Promise<MatchResult>;

  /**
   * Quick simulate all matches in current week
   */
  quickSimWeek: () => Promise<void>;

  /**
   * Get the next upcoming match for user team
   */
  getNextMatch: () => Match | null;

  /**
   * Get match simulation data (rosters, lineups)
   */
  getSimulationMatch: (matchId: string) => SimulationMatch | null;

  // =========================================================================
  // ROSTER ACTIONS
  // =========================================================================

  /**
   * Set starting lineup and rotation
   */
  setLineup: (lineup: LineupConfig) => void;

  /**
   * Release a player from the roster
   */
  releasePlayer: (playerId: string) => void;

  /**
   * Sign a player (add to roster with contract)
   * Used for youth promotions, transfers, etc.
   */
  signPlayer: (player: Player) => void;

  /**
   * Set training focus (team-wide or per-player)
   */
  setTrainingFocus: (focus: TrainingFocus, playerId?: string) => void;

  /**
   * Get user team roster (full player objects)
   */
  getUserRoster: () => Player[];

  /**
   * Get a specific player by ID
   */
  getPlayer: (playerId: string) => Player | null;

  // =========================================================================
  // MARKET ACTIONS
  // =========================================================================

  /**
   * Make a transfer offer for a player
   */
  makeTransferOffer: (playerId: string, amount: number) => void;

  /**
   * Respond to an incoming offer
   */
  respondToOffer: (offerId: string, accept: boolean) => void;

  /**
   * Sign a free agent
   */
  signFreeAgent: (playerId: string, salary: number) => void;

  /**
   * Get available transfer targets
   */
  getTransferTargets: () => Player[];

  /**
   * Get available free agents
   */
  getFreeAgents: () => Player[];

  // =========================================================================
  // SCOUTING ACTIONS
  // =========================================================================

  /**
   * Add a player to the scouting targets list
   */
  addScoutingTarget: (playerId: string) => void;

  /**
   * Remove a player from the scouting targets list
   */
  removeScoutingTarget: (playerId: string) => void;

  /**
   * Set scout instructions for auto-scouting filters
   */
  setScoutInstructions: (instructions: ScoutInstructions) => void;

  /**
   * Set scouting depth slider (0-1, breadth to depth)
   */
  setScoutingDepthSlider: (value: number) => void;

  // =========================================================================
  // CONTRACT NEGOTIATION ACTIONS (FM-STYLE)
  // =========================================================================

  /**
   * Start a contract negotiation with a player
   */
  startNegotiation: (
    playerId: string,
    negotiationType: 'new_signing' | 'renewal' | 'transfer',
    transferFee?: number
  ) => void;

  /**
   * Submit a contract offer in the active negotiation
   */
  submitContractOffer: (offer: ContractOffer) => void;

  /**
   * Accept the player's counter-offer
   */
  acceptPlayerCounter: () => void;

  /**
   * Cancel/walk away from the active negotiation
   */
  cancelNegotiation: () => void;

  /**
   * Complete the signing (after acceptance)
   */
  completeSigning: () => void;

  /**
   * Get the active negotiation (if any)
   */
  getActiveNegotiation: () => ContractNegotiation | null;

  // =========================================================================
  // BUDGET ACTIONS
  // =========================================================================

  /**
   * Set operations budget allocation
   */
  setOperationsBudget: (allocation: OperationsBudget) => void;

  // =========================================================================
  // SETTINGS ACTIONS
  // =========================================================================

  /**
   * Update game settings
   */
  updateSettings: (settings: Partial<GameSettings>) => void;

  // =========================================================================
  // SELECTORS
  // =========================================================================

  /**
   * Get current standings sorted by rank
   */
  getStandings: () => Array<TeamStanding & { teamName: string }>;

  /**
   * Get matches for a specific week
   */
  getMatchesByWeek: (week: number) => Match[];

  /**
   * Get recent events/news
   */
  getRecentEvents: (count?: number) => NewsItem[];

  /**
   * Get user team standing
   */
  getUserStanding: () => TeamStanding | null;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default game settings
 */
export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'normal',
  simulationSpeed: 'normal',
  soundEnabled: true,
  notificationsEnabled: true,
  autoSaveEnabled: true,
  theme: 'system',
};

/**
 * Default operations budget (equal distribution)
 */
export const DEFAULT_OPERATIONS_BUDGET: OperationsBudget = {
  training: 30,
  scouting: 25,
  facilities: 25,
  youthDevelopment: 20,
};

/**
 * Default training focus (balanced)
 */
export const DEFAULT_TRAINING_FOCUS: TrainingFocus = {
  physical: 34,
  mental: 33,
  technical: 33,
};

/**
 * Current save version
 */
export const SAVE_VERSION = '1.0.0';
