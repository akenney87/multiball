/**
 * Game Loop Orchestrator
 *
 * Main game loop for season simulation:
 * - Week-by-week progression
 * - Match execution with hooks
 * - Event emission
 * - State management
 *
 * Week 4: Core game loop
 */

import type { Player, Season, Match, Franchise } from '../data/types';
import type { AIConfig } from '../ai/types';
import { createAIConfig } from '../ai/personality';
import { getWeekMatches, advanceWeek, isWeekComplete, processMatchResult } from './weekProcessor';
import { isSeasonComplete, getSeasonProgress, calculatePromotionRelegation } from './seasonManager';
import { executeMatch, createDecisionContext, createTacticalSettings, type TeamBudget } from './matchRunner';
import {
  HookRegistry,
  createDefaultHookRegistry,
  type PreMatchContext,
  type PostMatchContext,
  type PreWeekContext,
  type PostWeekContext,
} from './hooks';
import {
  GameEventEmitter,
  gameEvents,
  createSeasonWeekAdvancedEvent,
  createTeamStandingsChangedEvent,
} from './events';

// =============================================================================
// GAME LOOP CONFIGURATION
// =============================================================================

/**
 * Game loop configuration options
 */
export interface GameLoopConfig {
  /** Hook registry to use (defaults to global) */
  hookRegistry?: HookRegistry;
  /** Event emitter to use (defaults to global) */
  eventEmitter?: GameEventEmitter;
  /** Whether to process AI team matches automatically */
  autoProcessAIMatches?: boolean;
  /** Callback for user match (allows manual control) */
  onUserMatch?: (match: Match, context: UserMatchContext) => Promise<void>;
  /** Speed multiplier for simulation (1.0 = normal) */
  simulationSpeed?: number;
}

/**
 * Context passed to user match callback
 */
export interface UserMatchContext {
  season: Season;
  homeRoster: Player[];
  awayRoster: Player[];
  homeTactics: ReturnType<typeof createTacticalSettings>;
  awayTactics: ReturnType<typeof createTacticalSettings>;
}

/**
 * Result of processing a single week
 */
export interface WeekResult {
  weekNumber: number;
  matchesPlayed: number;
  standings: Season['standings'];
  injuries: Array<{ playerId: string; injuryName: string }>;
  recoveries: string[];
  xpDistributed: Record<string, { physical: number; mental: number; technical: number }>;
}

/**
 * Result of advancing to next week
 */
export interface AdvanceResult {
  success: boolean;
  newWeek: number;
  weekResult?: WeekResult;
  errors: string[];
}

// =============================================================================
// GAME LOOP STATE
// =============================================================================

/**
 * Game loop state container
 */
export interface GameLoopState {
  season: Season;
  players: Player[];
  teams: Franchise[];
  userTeamId: string;
  isRunning: boolean;
  isPaused: boolean;
  currentWeekProcessed: boolean;
}

// =============================================================================
// GAME LOOP CLASS
// =============================================================================

/**
 * Game Loop Orchestrator
 *
 * Manages the main game loop for season simulation.
 * Coordinates matches, hooks, events, and state updates.
 */
export class GameLoop {
  private state: GameLoopState;
  private config: Required<GameLoopConfig>;
  private hookRegistry: HookRegistry;
  private eventEmitter: GameEventEmitter;

  constructor(
    season: Season,
    players: Player[],
    teams: Franchise[],
    userTeamId: string,
    config: GameLoopConfig = {}
  ) {
    this.state = {
      season,
      players,
      teams,
      userTeamId,
      isRunning: false,
      isPaused: false,
      currentWeekProcessed: false,
    };

    this.config = {
      hookRegistry: config.hookRegistry ?? createDefaultHookRegistry(),
      eventEmitter: config.eventEmitter ?? gameEvents,
      autoProcessAIMatches: config.autoProcessAIMatches ?? true,
      onUserMatch: config.onUserMatch ?? (async () => {}),
      simulationSpeed: config.simulationSpeed ?? 1.0,
    };

    this.hookRegistry = this.config.hookRegistry;
    this.eventEmitter = this.config.eventEmitter;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get season(): Season {
    return this.state.season;
  }

  get players(): Player[] {
    return this.state.players;
  }

  get teams(): Franchise[] {
    return this.state.teams;
  }

  get currentWeek(): number {
    return this.state.season.currentWeek;
  }

  get isRunning(): boolean {
    return this.state.isRunning;
  }

  get isPaused(): boolean {
    return this.state.isPaused;
  }

  // ---------------------------------------------------------------------------
  // Player Management
  // ---------------------------------------------------------------------------

  /**
   * Get roster for a team
   */
  getTeamRoster(teamId: string): Player[] {
    return this.state.players.filter((p) => p.teamId === teamId);
  }

  /**
   * Get AI config for a team
   */
  getTeamConfig(teamId: string): AIConfig {
    const team = this.state.teams.find((t) => t.id === teamId);
    if (team?.aiPersonality) {
      // Map AI personality traits to AI config
      const traits = team.aiPersonality.traits;
      if (traits.defensive_preference > 70) {
        return createAIConfig('conservative');
      } else if (traits.risk_tolerance > 70) {
        return createAIConfig('aggressive');
      }
    }
    return createAIConfig('balanced');
  }

  /**
   * Get team budget
   */
  getTeamBudget(teamId: string): TeamBudget {
    const team = this.state.teams.find((t) => t.id === teamId);
    if (team) {
      return {
        available: team.budget.available,
        total: team.budget.total,
      };
    }
    return { available: 5000000, total: 20000000 };
  }

  // ---------------------------------------------------------------------------
  // Week Processing
  // ---------------------------------------------------------------------------

  /**
   * Process the current week
   */
  async processCurrentWeek(): Promise<WeekResult> {
    const weekNumber = this.state.season.currentWeek;
    const matches = getWeekMatches(this.state.season, weekNumber);

    // Execute pre-week hooks
    const preWeekContext: PreWeekContext = {
      season: this.state.season,
      weekNumber,
      allPlayers: this.state.players,
    };
    const preWeekResult = this.hookRegistry.executePreWeek(preWeekContext);

    // Update players with recovery
    this.state.players = preWeekResult.updatedPlayers;

    const injuries: Array<{ playerId: string; injuryName: string }> = [];

    // Process each match
    for (const match of matches) {
      if (match.status !== 'scheduled') continue;

      const isUserMatch =
        match.homeTeamId === this.state.userTeamId ||
        match.awayTeamId === this.state.userTeamId;

      if (isUserMatch && !this.config.autoProcessAIMatches) {
        // Let user handle this match
        const homeRoster = this.getTeamRoster(match.homeTeamId);
        const awayRoster = this.getTeamRoster(match.awayTeamId);
        const homeConfig = this.getTeamConfig(match.homeTeamId);
        const awayConfig = this.getTeamConfig(match.awayTeamId);
        const homeContext = createDecisionContext(
          this.state.season,
          match.homeTeamId,
          this.getTeamBudget(match.homeTeamId)
        );
        const awayContext = createDecisionContext(
          this.state.season,
          match.awayTeamId,
          this.getTeamBudget(match.awayTeamId)
        );

        await this.config.onUserMatch(match, {
          season: this.state.season,
          homeRoster,
          awayRoster,
          homeTactics: createTacticalSettings(homeRoster, homeContext, homeConfig),
          awayTactics: createTacticalSettings(awayRoster, awayContext, awayConfig),
        });
      } else {
        // Auto-process match
        const matchResult = await this.processMatch(match);
        injuries.push(...matchResult.injuries.map((inj) => ({
          playerId: inj.playerId,
          injuryName: inj.injuryName,
        })));
      }
    }

    // Execute post-week hooks
    const completedMatches = matches.filter((m) => m.status === 'completed' ||
      this.state.season.matches.find((sm) => sm.id === m.id)?.status === 'completed');

    const postWeekContext: PostWeekContext = {
      season: this.state.season,
      weekNumber,
      allPlayers: this.state.players,
      matchesCompleted: completedMatches,
    };
    const postWeekResult = this.hookRegistry.executePostWeek(postWeekContext);

    // Update players with XP
    this.state.players = postWeekResult.updatedPlayers;

    this.state.currentWeekProcessed = true;

    return {
      weekNumber,
      matchesPlayed: matches.length,
      standings: this.state.season.standings,
      injuries,
      recoveries: preWeekResult.recoveredPlayers,
      xpDistributed: postWeekResult.xpDistributed,
    };
  }

  /**
   * Process a single match
   */
  private async processMatch(match: Match): Promise<{
    injuries: Array<{ playerId: string; injuryName: string }>;
  }> {
    const homeRoster = this.getTeamRoster(match.homeTeamId);
    const awayRoster = this.getTeamRoster(match.awayTeamId);
    const homeConfig = this.getTeamConfig(match.homeTeamId);
    const awayConfig = this.getTeamConfig(match.awayTeamId);

    // Pre-match hooks
    const preMatchContext: PreMatchContext = {
      season: this.state.season,
      match,
      homeRoster,
      awayRoster,
      homeConfig,
      awayConfig,
    };
    const preMatchResult = this.hookRegistry.executePreMatch(preMatchContext);

    if (!preMatchResult.canProceed) {
      console.warn(`Match ${match.id} cannot proceed:`, preMatchResult.warnings);
      return { injuries: [] };
    }

    // Execute match
    const effectiveHomeRoster = preMatchResult.modifiedHomeRoster ?? homeRoster;
    const effectiveAwayRoster = preMatchResult.modifiedAwayRoster ?? awayRoster;

    try {
      this.state.season = executeMatch(
        this.state.season,
        match.id,
        effectiveHomeRoster,
        effectiveAwayRoster,
        homeConfig,
        awayConfig
      );
    } catch (error) {
      console.error(`Error executing match ${match.id}:`, error);
      return { injuries: [] };
    }

    // Get the result from updated season
    const completedMatch = this.state.season.matches.find((m) => m.id === match.id);
    if (!completedMatch?.result) {
      return { injuries: [] };
    }

    // Post-match hooks
    const postMatchContext: PostMatchContext = {
      season: this.state.season,
      match: completedMatch,
      result: completedMatch.result,
      homeRoster: effectiveHomeRoster,
      awayRoster: effectiveAwayRoster,
      minutesPlayed: completedMatch.result.boxScore?.minutesPlayed ?? {},
    };
    const postMatchResult = this.hookRegistry.executePostMatch(postMatchContext);

    // Update players with injuries
    if (postMatchResult.updatedPlayers.length > 0) {
      const updatedMap = new Map(postMatchResult.updatedPlayers.map((p) => [p.id, p]));
      this.state.players = this.state.players.map((p) => updatedMap.get(p.id) ?? p);
    }

    return {
      injuries: postMatchResult.injuries.map((inj) => ({
        playerId: inj.playerId,
        injuryName: inj.injuryName,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Week Advancement
  // ---------------------------------------------------------------------------

  /**
   * Advance to the next week
   */
  async advanceWeek(): Promise<AdvanceResult> {
    const errors: string[] = [];

    // Check if current week is complete
    if (!isWeekComplete(this.state.season, this.state.season.currentWeek)) {
      errors.push('Current week is not complete. Process remaining matches first.');
      return { success: false, newWeek: this.state.season.currentWeek, errors };
    }

    // Store previous standings for comparison
    const previousStandings = { ...this.state.season.standings };

    // Advance the week
    this.state.season = advanceWeek(this.state.season);
    this.state.currentWeekProcessed = false;

    // Emit standings change events
    for (const [teamId, standing] of Object.entries(this.state.season.standings)) {
      const prev = previousStandings[teamId];
      if (prev && (prev.rank !== standing.rank || prev.points !== standing.points)) {
        this.eventEmitter.emit(
          createTeamStandingsChangedEvent(
            teamId,
            prev.rank,
            standing.rank,
            prev.points,
            standing.points
          )
        );
      }
    }

    return {
      success: true,
      newWeek: this.state.season.currentWeek,
      errors,
    };
  }

  // ---------------------------------------------------------------------------
  // Season Control
  // ---------------------------------------------------------------------------

  /**
   * Check if the season is complete
   */
  isSeasonComplete(): boolean {
    return isSeasonComplete(this.state.season);
  }

  /**
   * Get season progress
   */
  getSeasonProgress(): ReturnType<typeof getSeasonProgress> {
    return getSeasonProgress(this.state.season);
  }

  /**
   * Get promotion/relegation results (at end of season)
   */
  getPromotionRelegation(): ReturnType<typeof calculatePromotionRelegation> {
    return calculatePromotionRelegation(this.state.season.standings);
  }

  // ---------------------------------------------------------------------------
  // Simulation Control
  // ---------------------------------------------------------------------------

  /**
   * Start automatic simulation
   */
  async startSimulation(): Promise<void> {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;

    while (this.state.isRunning && !this.isSeasonComplete()) {
      if (this.state.isPaused) {
        await this.delay(100);
        continue;
      }

      // Process current week
      await this.processCurrentWeek();

      // Delay between weeks (affected by simulation speed)
      await this.delay(1000 / this.config.simulationSpeed);

      // Advance to next week
      await this.advanceWeek();
    }

    this.state.isRunning = false;
  }

  /**
   * Pause simulation
   */
  pauseSimulation(): void {
    this.state.isPaused = true;
  }

  /**
   * Resume simulation
   */
  resumeSimulation(): void {
    this.state.isPaused = false;
  }

  /**
   * Stop simulation
   */
  stopSimulation(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // State Updates
  // ---------------------------------------------------------------------------

  /**
   * Update season state
   */
  updateSeason(season: Season): void {
    this.state.season = season;
  }

  /**
   * Update players
   */
  updatePlayers(players: Player[]): void {
    this.state.players = players;
  }

  /**
   * Update teams
   */
  updateTeams(teams: Franchise[]): void {
    this.state.teams = teams;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new game loop
 */
export function createGameLoop(
  season: Season,
  players: Player[],
  teams: Franchise[],
  userTeamId: string,
  config?: GameLoopConfig
): GameLoop {
  return new GameLoop(season, players, teams, userTeamId, config);
}
