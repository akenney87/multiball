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
  TrophyRecord,
  PlayerAwardRecord,
  ManagerCareer,
  Injury,
} from '../../data/types';
import type { BaseballGameStrategy } from '../../simulation/baseball/types';
import type {
  ScoutingReport as YouthScoutingReport,
  AcademyProspect,
  ScoutSportFocus,
} from '../../systems/youthAcademySystem';
import type { AIConfig } from '../../ai/types';
import type { Difficulty, NewGameConfig } from '../screens/NewGameScreen';
import type { ScoutReport } from '../../systems/scoutingSystem';
import type { CountryCode } from '../../data/countries';
import type { PlayerProgressionResult, AcademyProgressionResult } from '../../systems/weeklyProgressionProcessor';

// =============================================================================
// GAME STATE
// =============================================================================

// =============================================================================
// LINEUP CONFIGURATIONS (Multi-Sport)
// =============================================================================

/**
 * Baseball defensive positions
 */
export type BaseballPosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';

/**
 * Soccer formations
 */
export type SoccerFormation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2' | '4-1-4-1';

/**
 * Baseball bullpen role types
 */
export type BullpenRole = 'longReliever' | 'shortReliever' | 'closer';

/**
 * Baseball bullpen configuration
 */
export interface BaseballBullpenConfig {
  /** Long relievers (2 slots) - can pitch multiple innings */
  longRelievers: [string, string];
  /** Short relievers (2 slots) - typically 1-2 innings */
  shortRelievers: [string, string];
  /** Closer (1 slot) - finishes games */
  closer: string;
}

/**
 * Baseball lineup configuration
 */
export interface BaseballLineupConfig {
  /** Batting order (9-10 players) - player IDs. Validated at runtime by validateBaseballLineup() */
  battingOrder: string[];

  /** Defensive position assignments (player ID -> position) */
  positions: Record<string, BaseballPosition>;

  /** Starting pitcher ID */
  startingPitcher: string;

  /** Bullpen configuration */
  bullpen: BaseballBullpenConfig;

  /**
   * Ohtani Rule: Starting pitcher is also the DH in the batting order.
   * When enabled, the starting pitcher can be included in battingOrder.
   * If the pitcher is replaced on the mound, they remain in the batting order as DH.
   */
  pitcherAsDH?: boolean;
}

/**
 * Soccer lineup configuration
 */
export interface SoccerLineupConfig {
  /** Starting 11 player IDs */
  starters: string[];

  /** Formation */
  formation: SoccerFormation;

  /**
   * Position assignments (player ID -> slot index 0-10)
   * The slot index maps to the formation's position array.
   * E.g., for 4-4-2: 0=GK, 1=LB, 2=CB, 3=CB, 4=RB, etc.
   */
  positions: Record<string, number>;
}

/**
 * Lineup configuration for matches (supports all sports)
 */
export interface LineupConfig {
  /** Basketball: Starting 5 player IDs in position order (PG, SG, SF, PF, C) */
  basketballStarters: [string, string, string, string, string];

  /** Baseball lineup configuration */
  baseballLineup: BaseballLineupConfig;

  /** Soccer lineup configuration */
  soccerLineup: SoccerLineupConfig;

  /** Bench player IDs (shared across sports - players not starting) */
  bench: string[];

  /** Minutes allocation for basketball (player ID -> target minutes) */
  minutesAllocation: Record<string, number>;

  /** Minutes allocation for soccer (player ID -> target minutes) */
  soccerMinutesAllocation: Record<string, number>;
}

/**
 * Budget allocation for operations (percentages 0-100, must sum to 100)
 */
export interface OperationsBudget {
  training: number;
  scouting: number;
  medical: number;
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

  /** Country code for the league */
  country: CountryCode;

  /** Home city name */
  city: string;

  /** Home city region (state/province for disambiguation) */
  cityRegion?: string;

  /** Division user started in (for leaderboard calculations) */
  startingDivision: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  /** Current division (1-10, starts at 7) */
  division: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

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

  /** Current lineup configuration (the "default" lineup set via Squad > Lineups) */
  lineup: LineupConfig;

  /**
   * Gameday lineup (temporary, for match-day edits only)
   * This is a working copy that doesn't persist to the default lineup.
   * When null, matches use the default lineup.
   */
  gamedayLineup: LineupConfig | null;

  /** Team-wide training focus */
  trainingFocus: TrainingFocus;

  /** Tactical settings (basketball) */
  tactics: TacticalSettings;

  /** Baseball strategy settings */
  baseballStrategy: BaseballGameStrategy;

  /** Shortlisted player IDs (players from other teams user is interested in) */
  shortlistedPlayerIds: string[];

  /** Transfer listed player IDs (user's players available for transfer) */
  transferListPlayerIds: string[];

  /** Asking prices for transfer listed players (playerId -> askingPrice) */
  transferListAskingPrices: Record<string, number>;
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

  /** Home city name */
  city: string;

  /** Home city region (state/province for disambiguation) */
  cityRegion?: string;

  /** Current division (1-10) */
  division: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  /** Roster player IDs */
  rosterIds: string[];

  /** AI configuration */
  aiConfig: AIConfig;
}

/**
 * Soccer strategy for a team
 */
export interface SoccerTeamStrategy {
  attackingStyle: 'possession' | 'direct' | 'counter';
  pressing: 'high' | 'balanced' | 'low';
  width: 'wide' | 'balanced' | 'tight';
}

/**
 * Basketball strategy for a team
 */
export interface BasketballTeamStrategy {
  pace: 'fast' | 'standard' | 'slow';
  defense: 'man' | 'mixed' | 'zone';
  rebounding: 'crash_glass' | 'standard' | 'prevent_transition';
}

/**
 * AI team's season-long strategy settings (randomized at season start, persistent)
 */
export interface AITeamSeasonStrategy {
  /** Baseball strategy (plate approach, swing style, baserunning) */
  baseball: BaseballGameStrategy;
  /** Soccer strategy */
  soccer: SoccerTeamStrategy;
  /** Basketball strategy */
  basketball: BasketballTeamStrategy;
}

/**
 * League state
 */
export interface LeagueState {
  /** Country code for the league */
  country: CountryCode;

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

  /** AI team strategies for this season (team ID -> strategy) */
  aiTeamStrategies: Record<string, AITeamSeasonStrategy>;
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
 * Youth Academy state
 * Manages scouting reports and signed academy prospects
 */
export interface YouthAcademyState {
  /** Current scouting reports (prospects being evaluated) */
  scoutingReports: YouthScoutingReport[];

  /** Signed academy prospects */
  academyProspects: AcademyProspect[];

  /** Week when last batch of scouting reports was generated */
  lastReportWeek: number;

  /** Whether the academy has been initialized */
  initialized: boolean;

  /** Scout focus - which sport to prioritize when scouting */
  scoutSportFocus: ScoutSportFocus;
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

  /** Youth Academy state */
  youthAcademy: YouthAcademyState;

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

  /** Whether user has completed initial budget allocation (required before scouting/simming) */
  budgetConfigured: boolean;

  /** Trophy case - championships and promotions */
  trophies: TrophyRecord[];

  /** Player awards received by user team players */
  playerAwards: PlayerAwardRecord[];

  /** Manager career tracking for leaderboards */
  managerCareer: ManagerCareer;
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
  | { type: 'INCREMENT_STANDINGS'; payload: { homeTeamId: string; awayTeamId: string; homeWon: boolean; sport: 'basketball' | 'baseball' | 'soccer' } }
  | { type: 'COMPLETE_MATCH'; payload: { matchId: string; result: MatchResult } }

  // Roster
  | { type: 'SET_LINEUP'; payload: LineupConfig }
  | { type: 'SET_GAMEDAY_LINEUP'; payload: LineupConfig }
  | { type: 'CLEAR_GAMEDAY_LINEUP' }
  | { type: 'SET_TACTICS'; payload: TacticalSettings }
  | { type: 'SET_BASEBALL_STRATEGY'; payload: BaseballGameStrategy }
  | { type: 'RELEASE_PLAYER'; payload: { playerId: string } }
  | { type: 'SIGN_PLAYER'; payload: { player: Player } }
  | { type: 'SET_TRAINING_FOCUS'; payload: { playerId?: string; focus: TrainingFocus } }

  // Market
  | { type: 'MAKE_OFFER'; payload: { playerId: string; amount: number } }
  | { type: 'RESPOND_TO_OFFER'; payload: { offerId: string; accept: boolean } }
  | { type: 'COUNTER_TRANSFER_OFFER'; payload: { offerId: string; counterAmount: number } }
  | { type: 'AI_RESPOND_TO_COUNTER'; payload: { offerId: string; decision: 'accept' | 'counter' | 'walk_away'; newAmount?: number; reason: string } }
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
  | { type: 'CONFIRM_BUDGET_ALLOCATION' }

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

  // Youth Academy
  | { type: 'SET_YOUTH_ACADEMY_STATE'; payload: YouthAcademyState }
  | { type: 'ADD_YOUTH_SCOUTING_REPORT'; payload: { report: YouthScoutingReport } }
  | { type: 'UPDATE_YOUTH_SCOUTING_REPORT'; payload: { reportId: string; report: YouthScoutingReport } }
  | { type: 'REMOVE_YOUTH_SCOUTING_REPORT'; payload: { reportId: string } }
  | { type: 'SIGN_PROSPECT_TO_ACADEMY'; payload: { prospect: AcademyProspect; signingCost?: number } }
  | { type: 'UPDATE_ACADEMY_PROSPECT'; payload: { prospectId: string; prospect: AcademyProspect } }
  | { type: 'REMOVE_ACADEMY_PROSPECT'; payload: { prospectId: string } }
  | { type: 'SET_LAST_REPORT_WEEK'; payload: { week: number } }
  | { type: 'SET_SCOUT_SPORT_FOCUS'; payload: { focus: ScoutSportFocus } }

  // Player Progression
  | { type: 'SNAPSHOT_SEASON_ATTRIBUTES' }
  | { type: 'APPLY_WEEKLY_PROGRESSION'; payload: { results: PlayerProgressionResult[] } }
  | { type: 'APPLY_ACADEMY_TRAINING'; payload: { results: AcademyProgressionResult[] } }
  | { type: 'UPDATE_PLAYER'; payload: { playerId: string; updates: Partial<Player> } }

  // Injuries
  | {
      type: 'APPLY_INJURY';
      payload: {
        playerId: string;
        injury: import('../../data/types').Injury;
        conditionPenalty: number; // Amount to subtract from matchFitness
      };
    }

  // Match Fitness
  | {
      type: 'APPLY_MATCH_FATIGUE';
      payload: Array<{
        playerId: string;
        drain: number;
        matchDate: Date;
        sport: 'basketball' | 'baseball' | 'soccer';
      }>;
    }
  | {
      type: 'APPLY_FITNESS_RECOVERY';
      payload: {
        daysSinceAdvance: number;
        medicalBudgetDollars: number;
      };
    }

  // Morale System
  | {
      type: 'RECORD_MATCH_RESULTS';
      payload: Array<{
        playerId: string;
        outcome: 'win' | 'loss' | 'draw';
      }>;
    }
  | {
      type: 'APPLY_MORALE_UPDATE';
      payload: Array<{
        playerId: string;
        newMorale: number;
        weeksDisgruntled: number;
        transferRequestTriggered: boolean;
      }>;
    }

  // AI Actions
  | {
      type: 'AI_SIGN_FREE_AGENT';
      payload: {
        teamId: string;
        playerId: string;
        salary: number;
        years: number;
      };
    }
  | {
      type: 'AI_MAKE_TRANSFER_BID';
      payload: {
        buyerTeamId: string;
        sellerTeamId: string;
        playerId: string;
        bidAmount: number;
      };
    }
  | {
      type: 'AI_RELEASE_PLAYER';
      payload: {
        teamId: string;
        playerId: string;
      };
    }
  | {
      type: 'AI_RESPOND_TO_TRANSFER';
      payload: {
        offerId: string;
        decision: 'accept' | 'reject' | 'counter';
        counterAmount?: number;
      };
    }

  // Shortlist & Transfer List
  | { type: 'ADD_TO_SHORTLIST'; payload: { playerId: string } }
  | { type: 'REMOVE_FROM_SHORTLIST'; payload: { playerId: string } }
  | { type: 'ADD_TO_TRANSFER_LIST'; payload: { playerId: string; askingPrice: number } }
  | { type: 'REMOVE_FROM_TRANSFER_LIST'; payload: { playerId: string } }

  // Offseason
  | {
      type: 'PROCESS_SEASON_END';
      payload: {
        promotedTeams: string[];
        relegatedTeams: string[];
        champion: string;
        expiredContracts: string[];
        userPrizeMoney: number;
        userFinishPosition: number;
        userMoraleChange: number;
      };
    }
  | {
      type: 'START_NEW_SEASON';
      payload: {
        season: SeasonState;
        teams: AITeamState[];
        userDivision: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
      };
    }
  | { type: 'ADVANCE_OFFSEASON_WEEK' }

  // Trophy Case & Manager Rating
  | { type: 'ADD_TROPHY'; payload: TrophyRecord }
  | { type: 'ADD_PLAYER_AWARD'; payload: PlayerAwardRecord }
  | { type: 'UPDATE_MANAGER_CAREER'; payload: ManagerCareer }

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
   * @param matchId - The match ID to simulate
   * @param baseballStrategy - Optional baseball strategy for the user team
   * @param soccerStrategy - Optional soccer strategy for the user team
   * @param basketballStrategy - Optional basketball strategy for the user team
   * @returns Match result
   */
  simulateMatch: (
    matchId: string,
    baseballStrategy?: BaseballGameStrategy,
    soccerStrategy?: { attackingStyle: 'possession' | 'direct' | 'counter'; pressing: 'high' | 'balanced' | 'low'; width: 'wide' | 'balanced' | 'tight' },
    basketballStrategy?: { pace: 'fast' | 'standard' | 'slow'; defense: 'man' | 'mixed' | 'zone'; rebounding: 'crash_glass' | 'standard' | 'prevent_transition'; scoringOptions: string[] }
  ) => Promise<MatchResult>;

  /**
   * Save a pre-computed match result (used by live simulation screen)
   * @param matchId - The match ID
   * @param result - The pre-computed match result
   */
  saveMatchResult: (matchId: string, result: MatchResult) => Promise<void>;

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
   * Set starting lineup and rotation (the "default" lineup)
   */
  setLineup: (lineup: LineupConfig) => void;

  /**
   * Set gameday lineup (temporary, for match-day edits only)
   */
  setGamedayLineup: (lineup: LineupConfig) => void;

  /**
   * Clear gameday lineup (reset to null, use default lineup)
   */
  clearGamedayLineup: () => void;

  /**
   * Initialize gameday lineup from default lineup
   * Call this when opening match preview to create a working copy
   */
  initializeGamedayLineup: () => void;

  /**
   * Set tactical settings (basketball)
   */
  setTactics: (tactics: TacticalSettings) => void;

  /**
   * Set baseball strategy
   */
  setBaseballStrategy: (strategy: BaseballGameStrategy) => void;

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
   * Apply an injury to a player - sets injury status, reduces condition,
   * and automatically removes from lineup.
   */
  applyInjury: (playerId: string, injury: Injury) => void;

  /**
   * Sign a prospect to the youth academy
   * Deducts $100k signing cost from available budget
   */
  signProspectToAcademy: (prospect: AcademyProspect) => void;

  /**
   * Update a youth scouting report (for continue/stop scouting)
   */
  updateYouthScoutingReport: (reportId: string, report: YouthScoutingReport) => void;

  /**
   * Set the sport focus for youth scouts
   */
  setYouthScoutSportFocus: (focus: 'basketball' | 'baseball' | 'soccer' | 'balanced') => void;

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
   * Counter an incoming transfer offer with a new amount
   */
  counterTransferOffer: (offerId: string, counterAmount: number) => void;

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

  /**
   * Add a player to the shortlist (players from other teams user is interested in)
   */
  addToShortlist: (playerId: string) => void;

  /**
   * Remove a player from the shortlist
   */
  removeFromShortlist: (playerId: string) => void;

  /**
   * Get shortlisted players
   */
  getShortlistedPlayers: () => Player[];

  /**
   * Add a player to the transfer list (user's players available for transfer)
   * @param playerId - The player to add
   * @param askingPrice - The asking price for the player
   */
  addToTransferList: (playerId: string, askingPrice: number) => void;

  /**
   * Remove a player from the transfer list
   */
  removeFromTransferList: (playerId: string) => void;

  /**
   * Get transfer listed players
   */
  getTransferListedPlayers: () => Player[];

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

  /**
   * Confirm budget allocation has been completed (enables scouting/simming)
   */
  confirmBudgetAllocation: () => void;

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
   * Get recent events/news filtered by scope
   */
  getRecentEvents: (count?: number, scope?: 'team' | 'division' | 'global') => NewsItem[];

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
  medical: 25,
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
 * Default youth academy state
 */
export const DEFAULT_YOUTH_ACADEMY_STATE: YouthAcademyState = {
  scoutingReports: [],
  academyProspects: [],
  lastReportWeek: 0,
  initialized: false,
  scoutSportFocus: 'balanced',
};

/**
 * Current save version
 */
export const SAVE_VERSION = '1.0.0';

// Re-export ScoutSportFocus type for convenience
export type { ScoutSportFocus } from '../../systems/youthAcademySystem';
