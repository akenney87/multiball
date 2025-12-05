/**
 * GameContext
 *
 * Main context provider for game state management.
 * Connects UI to game engine and persistence.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import type {
  GameContextValue,
  LineupConfig,
  OperationsBudget,
  GameSettings,
  SimulationMatch,
  ScoutInstructions,
} from './types';
import { gameReducer, initialGameState } from './gameReducer';
import { initializeNewGame } from '../integration/gameInitializer';
import { GameStorage } from '../persistence/gameStorage';
import type { NewGameConfig } from '../screens/NewGameScreen';
import type { Player, Match, MatchResult, TeamStanding, TrainingFocus, NewsItem, TacticalSettings } from '../../data/types';
import { GameSimulator } from '../../simulation';
import {
  generateScoutReport,
  calculateDepthPercent,
  calculateTransferValue,
  calculatePlayersScoutedPerWeek,
  type ScoutingSettings,
} from '../../systems/scoutingSystem';

/**
 * Convert camelCase TacticalSettings to snake_case format expected by simulation.
 * The simulation code (ported from Python) uses snake_case property names.
 */
function convertTacticsToSimulationFormat(tactics: TacticalSettings): any {
  return {
    pace: tactics.pace,
    man_defense_pct: tactics.manDefensePct,
    scoring_option_1: tactics.scoringOptions[0],
    scoring_option_2: tactics.scoringOptions[1],
    scoring_option_3: tactics.scoringOptions[2],
    minutes_allotment: tactics.minutesAllotment,
    rebounding_strategy: tactics.reboundingStrategy,
    closers: tactics.closers,
    timeout_strategy: tactics.timeoutStrategy,
  };
}

// =============================================================================
// CONTEXT
// =============================================================================

const GameContext = createContext<GameContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface GameProviderProps {
  children: React.ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);

  // Keep stateRef updated with latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // =========================================================================
  // AUTO-SAVE EFFECT
  // =========================================================================

  // Auto-save when important state changes (matches, standings, roster)
  useEffect(() => {
    // Skip initial mount and non-initialized state
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!state.initialized) {
      return;
    }

    // Debounce saves to avoid excessive writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Use stateRef to get the latest state
        await GameStorage.saveFullGameState(stateRef.current);
        console.log('[AutoSave] Game state saved');
      } catch (err) {
        console.error('[AutoSave] Failed to save:', err);
      }
    }, 500); // Wait 500ms after last change before saving

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.season.matches, state.season.standings, state.userTeam.rosterIds, state.initialized]);

  // =========================================================================
  // GAME MANAGEMENT
  // =========================================================================

  const startNewGame = useCallback(async (config: NewGameConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = initializeNewGame(config);
      dispatch({ type: 'INITIALIZE_GAME', payload });

      // Build the full state to save (matching what INITIALIZE_GAME creates)
      const fullStateToSave = {
        initialized: true,
        version: 1,
        lastSaved: null,
        userTeam: payload.userTeam,
        players: payload.players,
        league: payload.league,
        season: payload.season,
        market: {
          transferOffers: [],
          incomingOffers: [],
          outgoingOffers: [],
        },
        events: [],
        settings: {
          difficulty: config.difficulty,
          simulationSpeed: 'normal',
          soundEnabled: true,
          notificationsEnabled: true,
          autoSaveEnabled: true,
          theme: 'system',
        },
      };

      // Save the FULL game state for proper restoration
      await GameStorage.saveFullGameState(fullStateToSave);

      dispatch({ type: 'MARK_SAVED', payload: { timestamp: new Date() } });
    } catch (err) {
      console.error('Failed to start new game:', err);
      setError(err instanceof Error ? err.message : 'Failed to start new game');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadGame = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to load the full game state first
      const fullResult = await GameStorage.loadFullGameState();

      if (fullResult.success && fullResult.data) {
        // Restore the complete game state
        const savedState = fullResult.data as typeof state;
        dispatch({ type: 'LOAD_GAME', payload: savedState });
        setIsLoading(false);
        return true;
      }

      // Fallback: No saved game found
      setIsLoading(false);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
      setIsLoading(false);
      return false;
    }
  }, []);

  const saveGame = useCallback(async () => {
    if (!state.initialized) return;

    setIsLoading(true);
    setError(null);

    try {
      // Save the FULL game state for proper restoration
      await GameStorage.saveFullGameState(state);

      dispatch({ type: 'MARK_SAVED', payload: { timestamp: new Date() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game');
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const resetGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Clear all saved game data (both old and new formats)
      await GameStorage.clearAllData();
      dispatch({ type: 'RESET_GAME' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset game');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // =========================================================================
  // SEASON ACTIONS
  // =========================================================================

  const advanceWeek = useCallback(async () => {
    // Process AI responses to user's transfer offers
    dispatch({ type: 'PROCESS_TRANSFER_RESPONSES', payload: { currentWeek: state.season.currentWeek } });

    // Use a short delay to let the state update, then process accepted offers
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for accepted/rejected/countered offers and create news events
    const currentState = stateRef.current;
    for (const offer of currentState.market.outgoingOffers) {
      const player = currentState.players[offer.playerId];
      const playerName = player?.name || 'Unknown Player';

      if (offer.status === 'accepted') {
        // FM-style: Start contract negotiation instead of auto-completing
        // The player only joins once a contract is signed
        dispatch({
          type: 'START_NEGOTIATION',
          payload: {
            playerId: offer.playerId,
            negotiationType: 'transfer' as const,
            transferFee: offer.transferFee,
          },
        });

        // Add news event prompting user to negotiate contract
        const event: NewsItem = {
          id: `event-${Date.now()}-${offer.id}`,
          type: 'transfer',
          priority: 'important',
          title: 'Transfer Fee Agreed!',
          message: `Your $${(offer.transferFee / 1000000).toFixed(1)}M offer for ${playerName} has been accepted! Now negotiate a contract with the player.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: offer.playerId,
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      } else if (offer.status === 'rejected') {
        // Add news event for rejected offer
        const event: NewsItem = {
          id: `event-${Date.now()}-${offer.id}`,
          type: 'transfer',
          priority: 'info',
          title: 'Transfer Rejected',
          message: `Your $${(offer.transferFee / 1000000).toFixed(1)}M offer for ${playerName} has been rejected.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: offer.playerId,
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      } else if (offer.status === 'countered') {
        // Get counter amount from negotiation history
        const counterEntry = offer.negotiationHistory[offer.negotiationHistory.length - 1];
        const counterAmount = counterEntry?.amount || offer.transferFee;

        // Add news event for counter offer
        const event: NewsItem = {
          id: `event-${Date.now()}-${offer.id}`,
          type: 'transfer',
          priority: 'important',
          title: 'Counter Offer Received',
          message: `The team has countered your offer for ${playerName} with $${(counterAmount / 1000000).toFixed(1)}M. Check your transfer offers to respond.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: offer.playerId,
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      }
    }

    // Expire old offers
    dispatch({ type: 'EXPIRE_OFFERS' });

    // =========================================================================
    // SCOUTING SYSTEM - New priority-based approach
    // =========================================================================
    const scoutingState = stateRef.current;
    const scoutingPct = scoutingState.userTeam.operationsBudget.scouting;
    const depthSlider = scoutingState.scoutingDepthSlider ?? 0.5;
    const scoutInstructions = scoutingState.scoutInstructions;
    const alreadyScouted = new Set(scoutingState.scoutedPlayerIds || []);
    const existingReportIds = new Set((scoutingState.scoutingReports || []).map(r => r.playerId));

    // Calculate scouting capacity based on budget and depth
    const budgetMultiplier = 0.5 + (scoutingPct / 100) * 1.5;
    const simultaneousScouts = Math.max(1, Math.floor(scoutingPct / 10));
    const playersPerWeek = calculatePlayersScoutedPerWeek(simultaneousScouts, depthSlider);
    const depthPercent = calculateDepthPercent(depthSlider);

    const scoutingSettings: ScoutingSettings = {
      depthSlider,
      scoutingBudgetMultiplier: budgetMultiplier,
      simultaneousScouts,
    };

    let scoutedThisWeek = 0;

    // Phase 1: Scout TARGETED players at 100% depth (exact values)
    const scoutingTargets = scoutingState.scoutingTargetIds || [];
    for (const playerId of scoutingTargets) {
      if (scoutedThisWeek >= playersPerWeek) break;
      if (alreadyScouted.has(playerId) || existingReportIds.has(playerId)) continue;

      const player = scoutingState.players[playerId];
      if (!player) continue;

      const attributes = player.attributes as unknown as Record<string, number>;
      const overall = calculatePlayerOverall(player);
      const sportRatings: Record<string, number> = { Basketball: overall };

      const report = generateScoutReport(
        player.id,
        player.name,
        player.age,
        player.position || 'PG',
        'Basketball',
        attributes,
        sportRatings,
        scoutingSettings,
        scoutingState.season.currentWeek,
        { scoutingDepth: 100, isTargeted: true }
      );

      dispatch({ type: 'ADD_SCOUTING_REPORT', payload: { report } });
      dispatch({ type: 'SCOUT_PLAYER', payload: { playerId } });

      const event: NewsItem = {
        id: `event-scout-${Date.now()}-${playerId}`,
        type: 'transfer',
        priority: 'info',
        title: 'Scouting Report Complete',
        message: `Your scouts have completed a full report on ${player.name}. All attributes are now visible.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: playerId,
      };
      dispatch({ type: 'ADD_EVENT', payload: event });
      scoutedThisWeek++;
      existingReportIds.add(playerId);
    }

    // Phase 2: If capacity remaining, auto-scout filtered/random players at depth %
    if (scoutedThisWeek < playersPerWeek) {
      // Get all available players (non-user team, not already scouted/reported)
      const availablePlayers: Player[] = [];

      // Add free agents
      for (const playerId of scoutingState.league.freeAgentIds) {
        if (!alreadyScouted.has(playerId) && !existingReportIds.has(playerId)) {
          const player = scoutingState.players[playerId];
          if (player) availablePlayers.push(player);
        }
      }

      // Add AI team players
      for (const team of scoutingState.league.teams) {
        if (team.id === 'user') continue;
        for (const playerId of team.rosterIds) {
          if (!alreadyScouted.has(playerId) && !existingReportIds.has(playerId)) {
            const player = scoutingState.players[playerId];
            if (player) availablePlayers.push(player);
          }
        }
      }

      // Apply ScoutInstructions filters
      const filteredPlayers = availablePlayers.filter(player => {
        // Age filter
        if (scoutInstructions.ageMin !== undefined && player.age < scoutInstructions.ageMin) return false;
        if (scoutInstructions.ageMax !== undefined && player.age > scoutInstructions.ageMax) return false;

        // Height filter
        if (scoutInstructions.heightMin !== undefined && player.height < scoutInstructions.heightMin) return false;
        if (scoutInstructions.heightMax !== undefined && player.height > scoutInstructions.heightMax) return false;

        // Weight filter
        if (scoutInstructions.weightMin !== undefined && player.weight < scoutInstructions.weightMin) return false;
        if (scoutInstructions.weightMax !== undefined && player.weight > scoutInstructions.weightMax) return false;

        // Nationality filter
        if (scoutInstructions.nationalities && scoutInstructions.nationalities.length > 0) {
          if (!scoutInstructions.nationalities.includes(player.nationality)) return false;
        }

        // Free agent filter
        const isFreeAgent = player.teamId === 'free_agent';
        if (scoutInstructions.freeAgentsOnly && !isFreeAgent) return false;

        // Salary filter (only for non-free agents)
        if (!isFreeAgent && player.contract) {
          if (scoutInstructions.salaryMin !== undefined && player.contract.salary < scoutInstructions.salaryMin) return false;
          if (scoutInstructions.salaryMax !== undefined && player.contract.salary > scoutInstructions.salaryMax) return false;
        }

        // Transfer value filter (only for non-free agents)
        if (!isFreeAgent) {
          const overall = calculatePlayerOverall(player);
          const transferValue = calculateTransferValue(overall, player.age);
          if (scoutInstructions.transferValueMin !== undefined && transferValue < scoutInstructions.transferValueMin) return false;
          if (scoutInstructions.transferValueMax !== undefined && transferValue > scoutInstructions.transferValueMax) return false;
        }

        return true;
      });

      // Shuffle to get random selection from filtered pool
      const shuffled = [...filteredPlayers].sort(() => Math.random() - 0.5);

      // Scout remaining capacity at depth percentage
      for (const player of shuffled) {
        if (scoutedThisWeek >= playersPerWeek) break;

        const attributes = player.attributes as unknown as Record<string, number>;
        const overall = calculatePlayerOverall(player);
        const sportRatings: Record<string, number> = { Basketball: overall };

        const report = generateScoutReport(
          player.id,
          player.name,
          player.age,
          player.position || 'PG',
          'Basketball',
          attributes,
          sportRatings,
          scoutingSettings,
          currentState.season.currentWeek,
          { scoutingDepth: depthPercent, isTargeted: false }
        );

        dispatch({ type: 'ADD_SCOUTING_REPORT', payload: { report } });

        // Only mark as fully scouted if depth is 100%
        if (depthPercent >= 100) {
          dispatch({ type: 'SCOUT_PLAYER', payload: { playerId: player.id } });
        }

        const depthLabel = depthPercent >= 100 ? 'full' : `${depthPercent}%`;
        const event: NewsItem = {
          id: `event-scout-${Date.now()}-${player.id}`,
          type: 'transfer',
          priority: 'info',
          title: 'New Scouting Report',
          message: `Your scouts have completed a ${depthLabel} report on ${player.name}.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: player.id,
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
        scoutedThisWeek++;
      }
    }

    // Advance the week
    dispatch({ type: 'ADVANCE_WEEK' });

    // Auto-save if enabled
    if (state.settings.autoSaveEnabled) {
      await saveGame();
    }
  }, [state.settings.autoSaveEnabled, state.season.currentWeek, state.players, saveGame]);

  const simulateMatch = useCallback(async (matchId: string): Promise<MatchResult> => {
    // Find the match
    const match = state.season.matches.find((m) => m.id === matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // Get rosters for both teams
    const isUserHome = match.homeTeamId === 'user';
    const isUserAway = match.awayTeamId === 'user';

    let homeRoster: Player[];
    let awayRoster: Player[];
    let homeTeamName: string;
    let awayTeamName: string;
    let homeTactics: TacticalSettings;
    let awayTactics: TacticalSettings;

    // Default tactics for AI teams
    const defaultTactics: TacticalSettings = {
      pace: 'standard',
      manDefensePct: 70,
      scoringOptions: [undefined, undefined, undefined],
      minutesAllotment: {},
      reboundingStrategy: 'standard',
      closers: [],
      timeoutStrategy: 'standard',
    };

    // Get home team data
    if (isUserHome) {
      homeRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter((p): p is Player => p !== undefined);
      homeTeamName = state.userTeam.name;
      homeTactics = state.userTeam.tactics;
    } else {
      const homeTeam = state.league.teams.find((t) => t.id === match.homeTeamId);
      homeRoster = homeTeam
        ? homeTeam.rosterIds.map((id) => state.players[id]).filter((p): p is Player => p !== undefined)
        : [];
      homeTeamName = homeTeam?.name || 'Home Team';
      homeTactics = defaultTactics;
    }

    // Get away team data
    if (isUserAway) {
      awayRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter((p): p is Player => p !== undefined);
      awayTeamName = state.userTeam.name;
      awayTactics = state.userTeam.tactics;
    } else {
      const awayTeam = state.league.teams.find((t) => t.id === match.awayTeamId);
      awayRoster = awayTeam
        ? awayTeam.rosterIds.map((id) => state.players[id]).filter((p): p is Player => p !== undefined)
        : [];
      awayTeamName = awayTeam?.name || 'Away Team';
      awayTactics = defaultTactics;
    }

    // Run actual game simulation
    let homeScore: number;
    let awayScore: number;
    let boxScore: Record<string, unknown> = {};
    let playByPlay: string[] = [];

    try {
      // Convert tactics from camelCase to snake_case format expected by simulation
      const homeTacticsConverted = convertTacticsToSimulationFormat(homeTactics);
      const awayTacticsConverted = convertTacticsToSimulationFormat(awayTactics);

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        homeTacticsConverted,
        awayTacticsConverted,
        homeTeamName,
        awayTeamName
      );
      const gameResult = simulator.simulateGame();

      homeScore = gameResult.homeScore;
      awayScore = gameResult.awayScore;
      boxScore = {
        ...gameResult.gameStatistics,
        minutesPlayed: gameResult.minutesPlayed,
      };
      playByPlay = gameResult.playByPlayText.split('\n').filter((line: string) => line.length > 0);
    } catch (err) {
      // Fallback to random if simulation fails (e.g., roster issues)
      console.warn('Simulation failed, using random result:', err);
      homeScore = Math.floor(Math.random() * 40) + 80;
      awayScore = Math.floor(Math.random() * 40) + 80;
      playByPlay = [`Final Score: ${homeScore} - ${awayScore}`];
    }

    const winner = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;

    const result: MatchResult = {
      matchId,
      homeScore,
      awayScore,
      winner,
      boxScore,
      playByPlay,
    };

    // Update state
    dispatch({ type: 'COMPLETE_MATCH', payload: { matchId, result } });

    // Update standings - use stateRef to get latest standings after dispatch
    // This is critical for quick succession calls (like quickSimWeek)
    const newStandings = { ...stateRef.current.season.standings };
    const homeStanding = newStandings[match.homeTeamId];
    const awayStanding = newStandings[match.awayTeamId];

    if (homeStanding && awayStanding) {
      if (homeScore > awayScore) {
        homeStanding.wins += 1;
        homeStanding.points += 3;
        awayStanding.losses += 1;
      } else {
        awayStanding.wins += 1;
        awayStanding.points += 3;
        homeStanding.losses += 1;
      }

      // Update ranks
      const sorted = Object.values(newStandings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.teamId.localeCompare(b.teamId);
      });
      sorted.forEach((s, i) => {
        const standing = newStandings[s.teamId];
        if (standing) {
          standing.rank = i + 1;
        }
      });

      dispatch({ type: 'UPDATE_STANDINGS', payload: newStandings });
    }

    // Auto-advance week if ALL user matches for this week are now complete
    const currentWeek = state.season.currentWeek;

    // Get all user matches sorted by date, then calculate week for matches without it
    const allUserMatches = state.season.matches
      .filter((m) => m.homeTeamId === 'user' || m.awayTeamId === 'user')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    // Assign week numbers (fallback to index-based: 3 matches per week)
    const userMatchesWithWeek = allUserMatches.map((m, index) => ({
      ...m,
      calculatedWeek: m.week ?? Math.floor(index / 3) + 1,
    }));

    const userMatchesThisWeek = userMatchesWithWeek.filter(
      (m) => m.calculatedWeek === currentWeek
    );
    const remainingUserMatches = userMatchesThisWeek.filter(
      (m) => m.status === 'scheduled' && m.id !== matchId // Exclude the one we just simmed
    );

    if (remainingUserMatches.length === 0) {
      // All user matches for this week are complete, advance the week
      await new Promise(resolve => setTimeout(resolve, 100));
      await advanceWeek();
    }

    return result;
  }, [state.season.matches, state.season.currentWeek, state.userTeam, state.league.teams, state.players, advanceWeek]);

  const quickSimWeek = useCallback(async () => {
    const weekMatches = state.season.matches.filter(
      (m) => m.status === 'scheduled'
    ).slice(0, 10); // Sim first 10 scheduled matches

    for (const match of weekMatches) {
      await simulateMatch(match.id);
      // Small delay to allow state updates to process before next simulation
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await advanceWeek();
  }, [state.season.matches, simulateMatch, advanceWeek]);

  const getNextMatch = useCallback((): Match | null => {
    return state.season.matches.find(
      (m) =>
        m.status === 'scheduled' &&
        (m.homeTeamId === 'user' || m.awayTeamId === 'user')
    ) || null;
  }, [state.season.matches]);

  const getSimulationMatch = useCallback((matchId: string): SimulationMatch | null => {
    const match = state.season.matches.find((m) => m.id === matchId);
    if (!match) return null;

    const isUserHome = match.homeTeamId === 'user';
    const opponentId = isUserHome ? match.awayTeamId : match.homeTeamId;

    const userRoster = state.userTeam.rosterIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined);

    const opponentTeam = state.league.teams.find((t) => t.id === opponentId);
    const opponentRoster = opponentTeam
      ? opponentTeam.rosterIds
          .map((id) => state.players[id])
          .filter((p): p is Player => p !== undefined)
      : [];

    return {
      match,
      userRoster,
      opponentRoster,
      userLineup: state.userTeam.lineup,
      isUserHome,
    };
  }, [state.season.matches, state.userTeam, state.league.teams, state.players]);

  // =========================================================================
  // ROSTER ACTIONS
  // =========================================================================

  const setLineup = useCallback((lineup: LineupConfig) => {
    dispatch({ type: 'SET_LINEUP', payload: lineup });
  }, []);

  const releasePlayer = useCallback((playerId: string) => {
    // Get player info BEFORE dispatching
    const player = state.players[playerId];
    const playerName = player?.name || 'Unknown Player';

    dispatch({ type: 'RELEASE_PLAYER', payload: { playerId } });

    // Add news event
    const event: NewsItem = {
      id: `event-${Date.now()}`,
      type: 'transfer',
      priority: 'info',
      title: 'Player Released',
      message: `${playerName} has been released from the team.`,
      timestamp: new Date(),
      read: false,
      relatedEntityId: playerId,
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
  }, [state.players]);

  const signPlayer = useCallback((player: Player) => {
    dispatch({ type: 'SIGN_PLAYER', payload: { player } });

    // Add news event
    const event: NewsItem = {
      id: `event-${Date.now()}`,
      type: 'youth',
      priority: 'important',
      title: 'Youth Prospect Promoted',
      message: `${player.name} has been promoted from the academy to the main squad.`,
      timestamp: new Date(),
      read: false,
      relatedEntityId: player.id,
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
  }, []);

  const setTrainingFocus = useCallback((focus: TrainingFocus, playerId?: string) => {
    dispatch({ type: 'SET_TRAINING_FOCUS', payload: { focus, playerId } });
  }, []);

  const getUserRoster = useCallback((): Player[] => {
    return state.userTeam.rosterIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined);
  }, [state.userTeam.rosterIds, state.players]);

  const getPlayer = useCallback((playerId: string): Player | null => {
    return state.players[playerId] || null;
  }, [state.players]);

  // =========================================================================
  // MARKET ACTIONS
  // =========================================================================

  const makeTransferOffer = useCallback((playerId: string, amount: number) => {
    dispatch({ type: 'MAKE_OFFER', payload: { playerId, amount } });
  }, []);

  const respondToOffer = useCallback((offerId: string, accept: boolean) => {
    dispatch({ type: 'RESPOND_TO_OFFER', payload: { offerId, accept } });
  }, []);

  const signFreeAgent = useCallback((playerId: string, salary: number) => {
    const player = state.players[playerId];
    if (!player || player.teamId !== 'free_agent') return;

    const signedPlayer: Player = {
      ...player,
      teamId: 'user',
      contract: {
        id: `contract-${Date.now()}`,
        playerId,
        teamId: 'user',
        salary,
        signingBonus: 0,
        contractLength: 1,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        performanceBonuses: {},
        releaseClause: null,
        salaryIncreases: [],
        agentFee: 0,
        clauses: [],
        squadRole: 'squad_player',
        loyaltyBonus: 0,
      },
      acquisitionType: 'free_agent',
      acquisitionDate: new Date(),
    };

    dispatch({ type: 'SIGN_PLAYER', payload: { player: signedPlayer } });

    // Add news event
    const event: NewsItem = {
      id: `event-${Date.now()}`,
      type: 'transfer',
      priority: 'important',
      title: 'Free Agent Signed',
      message: `${player.name} has signed with the team for $${(salary / 1000000).toFixed(1)}M/year.`,
      timestamp: new Date(),
      read: false,
      relatedEntityId: playerId,
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
  }, [state.players]);

  const getTransferTargets = useCallback((): Player[] => {
    // Get players from AI teams
    const targets: Player[] = [];
    for (const team of state.league.teams) {
      for (const playerId of team.rosterIds) {
        const player = state.players[playerId];
        if (player) targets.push(player);
      }
    }
    return targets.slice(0, 50); // Limit for performance
  }, [state.league.teams, state.players]);

  const getFreeAgents = useCallback((): Player[] => {
    return state.league.freeAgentIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined);
  }, [state.league.freeAgentIds, state.players]);

  // =========================================================================
  // SCOUTING ACTIONS
  // =========================================================================

  const addScoutingTarget = useCallback((playerId: string) => {
    dispatch({ type: 'ADD_SCOUTING_TARGET', payload: { playerId } });
  }, []);

  const removeScoutingTarget = useCallback((playerId: string) => {
    dispatch({ type: 'REMOVE_SCOUTING_TARGET', payload: { playerId } });
  }, []);

  const setScoutInstructions = useCallback((instructions: ScoutInstructions) => {
    dispatch({ type: 'SET_SCOUT_INSTRUCTIONS', payload: instructions });
  }, []);

  const setScoutingDepthSlider = useCallback((value: number) => {
    dispatch({ type: 'SET_SCOUTING_DEPTH_SLIDER', payload: value });
  }, []);

  // =========================================================================
  // CONTRACT NEGOTIATION ACTIONS (FM-STYLE)
  // =========================================================================

  const startNegotiation = useCallback((
    playerId: string,
    negotiationType: 'new_signing' | 'renewal' | 'transfer',
    transferFee?: number
  ) => {
    dispatch({
      type: 'START_NEGOTIATION',
      payload: { playerId, negotiationType, transferFee },
    });
  }, []);

  const submitContractOffer = useCallback((offer: import('../../data/types').ContractOffer) => {
    dispatch({
      type: 'SUBMIT_CONTRACT_OFFER',
      payload: { offer },
    });
  }, []);

  const acceptPlayerCounter = useCallback(() => {
    dispatch({ type: 'ACCEPT_PLAYER_COUNTER' });
  }, []);

  const cancelNegotiation = useCallback(() => {
    dispatch({ type: 'CANCEL_NEGOTIATION' });
  }, []);

  const completeSigning = useCallback(() => {
    dispatch({ type: 'COMPLETE_SIGNING' });

    // Add news event for the signing
    const negotiation = stateRef.current.market.activeNegotiation;
    if (negotiation) {
      const player = stateRef.current.players[negotiation.playerId];
      const event: NewsItem = {
        id: `event-${Date.now()}`,
        type: 'transfer',
        priority: 'important',
        title: 'Contract Signed!',
        message: `${player?.name || 'A new player'} has signed a ${negotiation.currentOffer.contractLength}-year contract worth ${(negotiation.currentOffer.salary / 1000000).toFixed(1)}M/year.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: negotiation.playerId,
      };
      dispatch({ type: 'ADD_EVENT', payload: event });
    }
  }, []);

  const getActiveNegotiation = useCallback(() => {
    return state.market.activeNegotiation;
  }, [state.market.activeNegotiation]);

  // =========================================================================
  // BUDGET ACTIONS
  // =========================================================================

  const setOperationsBudget = useCallback((allocation: OperationsBudget) => {
    dispatch({ type: 'SET_OPERATIONS_BUDGET', payload: allocation });
  }, []);

  // =========================================================================
  // SETTINGS ACTIONS
  // =========================================================================

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  // =========================================================================
  // SELECTORS
  // =========================================================================

  const getStandings = useCallback((): Array<TeamStanding & { teamName: string }> => {
    const standings = Object.values(state.season.standings);

    // Add team names
    return standings
      .map((s) => {
        let teamName = 'Unknown';
        if (s.teamId === 'user') {
          teamName = state.userTeam.name;
        } else {
          const team = state.league.teams.find((t) => t.id === s.teamId);
          if (team) teamName = team.name;
        }
        return { ...s, teamName };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [state.season.standings, state.userTeam.name, state.league.teams]);

  const getMatchesByWeek = useCallback((week: number): Match[] => {
    // For now, return first 10 matches for each "week"
    const startIdx = (week - 1) * 10;
    return state.season.matches.slice(startIdx, startIdx + 10);
  }, [state.season.matches]);

  const getRecentEvents = useCallback((count: number = 10): NewsItem[] => {
    return state.events.slice(0, count);
  }, [state.events]);

  const getUserStanding = useCallback((): TeamStanding | null => {
    return state.season.standings['user'] || null;
  }, [state.season.standings]);

  // =========================================================================
  // CONTEXT VALUE
  // =========================================================================

  const value: GameContextValue = useMemo(
    () => ({
      state,
      isLoading,
      error,

      // Game Management
      startNewGame,
      loadGame,
      saveGame,
      resetGame,

      // Season Actions
      advanceWeek,
      simulateMatch,
      quickSimWeek,
      getNextMatch,
      getSimulationMatch,

      // Roster Actions
      setLineup,
      releasePlayer,
      signPlayer,
      setTrainingFocus,
      getUserRoster,
      getPlayer,

      // Market Actions
      makeTransferOffer,
      respondToOffer,
      signFreeAgent,
      getTransferTargets,
      getFreeAgents,

      // Scouting Actions
      addScoutingTarget,
      removeScoutingTarget,
      setScoutInstructions,
      setScoutingDepthSlider,

      // Contract Negotiation Actions (FM-style)
      startNegotiation,
      submitContractOffer,
      acceptPlayerCounter,
      cancelNegotiation,
      completeSigning,
      getActiveNegotiation,

      // Budget Actions
      setOperationsBudget,

      // Settings Actions
      updateSettings,

      // Selectors
      getStandings,
      getMatchesByWeek,
      getRecentEvents,
      getUserStanding,
    }),
    [
      state,
      isLoading,
      error,
      startNewGame,
      loadGame,
      saveGame,
      resetGame,
      advanceWeek,
      simulateMatch,
      quickSimWeek,
      getNextMatch,
      getSimulationMatch,
      setLineup,
      releasePlayer,
      setTrainingFocus,
      getUserRoster,
      getPlayer,
      makeTransferOffer,
      respondToOffer,
      signFreeAgent,
      getTransferTargets,
      getFreeAgents,
      addScoutingTarget,
      removeScoutingTarget,
      setScoutInstructions,
      setScoutingDepthSlider,
      startNegotiation,
      submitContractOffer,
      acceptPlayerCounter,
      cancelNegotiation,
      completeSigning,
      getActiveNegotiation,
      setOperationsBudget,
      updateSettings,
      getStandings,
      getMatchesByWeek,
      getRecentEvents,
      getUserStanding,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access game context
 *
 * @throws Error if used outside GameProvider
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  return context;
}

export default GameContext;

/**
 * Calculate player overall rating (simplified)
 * Uses weighted average of attributes
 */
function calculatePlayerOverall(player: Player): number {
  const attrs = player.attributes;
  if (!attrs) return 50;

  // Key attributes for overall calculation
  const weights: Record<string, number> = {
    // Physical (40%)
    height: 4,
    jumping: 4,
    agility: 4,
    acceleration: 3,
    top_speed: 3,
    core_strength: 3,
    arm_strength: 3,
    grip_strength: 2,
    reactions: 3,
    stamina: 3,
    balance: 3,
    durability: 2,
    // Technical (35%)
    throw_accuracy: 8,
    hand_eye_coordination: 7,
    form_technique: 7,
    finesse: 5,
    deception: 4,
    teamwork: 4,
    // Mental (25%)
    awareness: 5,
    composure: 4,
    consistency: 4,
    determination: 3,
    creativity: 3,
    bravery: 2,
    patience: 2,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [attr, weight] of Object.entries(weights)) {
    const value = (attrs as unknown as Record<string, number>)[attr];
    if (typeof value === 'number') {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
}
