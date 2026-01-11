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
import {
  initializeNewGame,
  validateBaseballLineup,
  validateBasketballLineup,
  calculatePlayerOverall,
  calculateBaseballPositionScore,
} from '../integration/gameInitializer';
import type { BaseballPosition } from './types';
import { GameStorage } from '../persistence/gameStorage';
import type { NewGameConfig } from '../screens/NewGameScreen';
import type { Player, Match, MatchResult, TeamStanding, TrainingFocus, NewsItem, TacticalSettings } from '../../data/types';
import { GameSimulator } from '../../simulation';
import {
  simulateGame as simulateBaseballGame,
  type GameInput as BaseballGameInput,
  type TeamGameState as BaseballTeamState,
  type BaseballGameStrategy,
  DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY,
} from '../../simulation/baseball';
import type { FieldingPosition } from '../../simulation/baseball/systems/fielding';
import {
  generateScoutReport,
  calculateDepthPercent,
  calculateTransferValue,
  calculatePlayersScoutedPerWeek,
  type ScoutingSettings,
} from '../../systems/scoutingSystem';
import { processWeeklyProgression, processAcademyTraining } from '../../systems/weeklyProgressionProcessor';
import {
  type AcademyProspect,
  type ScoutingReport as YouthScoutingReport,
  YEARLY_PROSPECT_COST,
  SCOUTING_CYCLE_WEEKS,
  generateScoutingReports as generateYouthScoutingReports,
  advanceScoutingReport as advanceYouthScoutingReport,
  calculateReportsPerCycle,
} from '../../systems/youthAcademySystem';
import {
  simulateSoccerMatchV2,
  FORMATION_POSITIONS,
  type SoccerTeamState,
  type SoccerPosition,
} from '../../simulation/soccer';
import { calculateMatchDrain } from '../../systems/matchFitnessSystem';
import {
  processWeeklyAI,
  processBatchedWeeklyAI,
  type WeeklyProcessorInput,
  type ExtendedWeeklyProcessorInput,
  type AITeam,
} from '../../ai/weeklyProcessor';
import {
  getDivisionManager,
  type TeamReference,
} from '../../ai/divisionManager';
import {
  processWeeklyAwards,
  processMonthlyAwards,
  processSeasonAwards,
} from '../../systems/awardSystem';
import {
  processWeeklyMorale,
  applyMoraleToRoster,
  type PlayingTimeData,
} from '../../systems/moraleSystem';
import type { MatchOutcome } from '../../data/types';
import {
  processSeasonEnd,
  initializeNewSeason,
  OFFSEASON_WEEKS,
  REGULAR_SEASON_WEEKS,
} from '../../systems/offseasonProcessor';
import {
  calculateSeasonRating,
  updateManagerCareer,
} from '../../systems/managerRatingSystem';
import type { TrophyRecord } from '../../data/types';

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? 'th';
}

/**
 * Normalize TacticalSettings with fallback defaults for old saves.
 * Ensures all required fields exist with valid values.
 */
function convertTacticsToSimulationFormat(tactics: TacticalSettings): TacticalSettings {
  // Ensure all fields have valid defaults (handles old saves with missing fields)
  return {
    pace: tactics.pace || 'standard',
    manDefensePct: tactics.manDefensePct ?? 50,
    scoringOptions: tactics.scoringOptions || [undefined, undefined, undefined],
    minutesAllotment: tactics.minutesAllotment || {},
    reboundingStrategy: tactics.reboundingStrategy || 'standard',
    closers: tactics.closers || [],
    timeoutStrategy: tactics.timeoutStrategy || 'standard',
  };
}

/**
 * Build BaseballTeamState from roster for baseball simulation
 * Assigns positions based on positional attributes if no specific lineup is provided
 * @param benchIds - Array of player IDs on the bench (not reserves). Null for AI teams.
 *                   When provided, bullpen will only include players on the bench.
 */
function buildBaseballTeamState(
  teamId: string,
  teamName: string,
  roster: Player[],
  lineupConfig?: {
    battingOrder: string[];
    positions: Record<string, string>;
    startingPitcher: string;
  },
  benchIds?: string[] | null
): BaseballTeamState {
  // Sort roster by overall rating
  const sortedRoster = [...roster].sort((a, b) => {
    const overallA = calculatePlayerOverall(a);
    const overallB = calculatePlayerOverall(b);
    return overallB - overallA;
  });

  // Ensure we have at least one player
  const fallbackPlayer = sortedRoster[0];
  if (!fallbackPlayer) {
    throw new Error('Cannot build baseball team state: no players in roster');
  }

  // Determine starting pitcher FIRST (before building batting order)
  let pitcher: Player;
  if (lineupConfig?.startingPitcher) {
    const configPitcher = roster.find((p) => p.id === lineupConfig.startingPitcher);
    pitcher = configPitcher ?? fallbackPlayer;
  } else {
    // Find player with best pitching score using positional attributes
    let bestPitcher = fallbackPlayer;
    let bestPitchScore = -Infinity;
    for (const player of sortedRoster) {
      const score = calculateBaseballPositionScore(player, 'P');
      if (score > bestPitchScore) {
        bestPitchScore = score;
        bestPitcher = player;
      }
    }
    pitcher = bestPitcher;
  }

  // Get lineup from config or generate (EXCLUDING pitcher - DH rule)
  let lineup: Player[];
  let positionMap: Record<string, FieldingPosition>;

  if (lineupConfig && lineupConfig.battingOrder.length >= 9) {
    // Use provided batting order (should already exclude pitcher with DH rule)
    lineup = lineupConfig.battingOrder
      .filter((id) => id !== pitcher.id) // Ensure pitcher not in batting order
      .slice(0, 9)
      .map((id) => roster.find((p) => p.id === id))
      .filter((p): p is Player => p !== undefined);

    // Use provided position mapping
    positionMap = {} as Record<string, FieldingPosition>;
    for (const [playerId, pos] of Object.entries(lineupConfig.positions)) {
      positionMap[playerId] = pos as FieldingPosition;
    }
  } else {
    // Default: top 9 players EXCLUDING the pitcher (DH rule)
    lineup = sortedRoster.filter((p) => p.id !== pitcher.id).slice(0, 9);
    positionMap = {};
  }

  // Ensure we have 9 batters (not including pitcher)
  while (lineup.length < 9) {
    const nextPlayer = sortedRoster.find((p) => !lineup.includes(p) && p.id !== pitcher.id);
    if (nextPlayer) lineup.push(nextPlayer);
    else break;
  }

  // Determine catcher (player with position C or best catcher score)
  let catcher: Player;
  const catcherFromLineup = Object.entries(positionMap).find(([, pos]) => pos === 'C');
  if (catcherFromLineup) {
    catcher = roster.find((p) => p.id === catcherFromLineup[0]) ?? lineup[1] ?? fallbackPlayer;
  } else {
    // Find player with best catcher positional score
    let bestCatcher = fallbackPlayer;
    let bestCatcherScore = -Infinity;
    for (const player of lineup) {
      const score = calculateBaseballPositionScore(player, 'C');
      if (score > bestCatcherScore) {
        bestCatcherScore = score;
        bestCatcher = player;
      }
    }
    catcher = bestCatcher;
  }

  // Build defense assignment
  const defensivePositions: FieldingPosition[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const defense: Record<FieldingPosition, Player> = {} as Record<FieldingPosition, Player>;
  const assignedPlayers = new Set<string>();

  // First assign from position map (skip DH which is not a defensive position)
  for (const [playerId, pos] of Object.entries(positionMap)) {
    if (defensivePositions.includes(pos as FieldingPosition)) {
      const player = lineup.find((p) => p.id === playerId);
      if (player) {
        defense[pos as FieldingPosition] = player;
        assignedPlayers.add(player.id);
      }
    }
  }

  // Fill remaining positions using positional scoring
  for (const pos of defensivePositions) {
    if (!defense[pos]) {
      if (pos === 'P') {
        defense[pos] = pitcher;
        assignedPlayers.add(pitcher.id);
      } else if (pos === 'C') {
        defense[pos] = catcher;
        assignedPlayers.add(catcher.id);
      } else {
        // Find best available player for this position
        let bestPlayer: Player | null = null;
        let bestScore = -Infinity;
        for (const player of lineup) {
          if (assignedPlayers.has(player.id)) continue;
          const score = calculateBaseballPositionScore(player, pos as BaseballPosition);
          if (score > bestScore) {
            bestScore = score;
            bestPlayer = player;
          }
        }
        if (bestPlayer) {
          defense[pos] = bestPlayer;
          assignedPlayers.add(bestPlayer.id);
        } else {
          // Fallback to any player
          defense[pos] = fallbackPlayer;
        }
      }
    }
  }

  // Bullpen: remaining players not in starting lineup, sorted by pitching score
  // For user teams (benchIds provided), only include players on the bench (not reserves)
  const benchSet = benchIds ? new Set(benchIds) : null;
  const bullpenCandidates = roster
    .filter((p) => {
      // Must not be in starting lineup or pitcher
      if (lineup.includes(p) || p.id === pitcher.id) return false;
      // For user teams, must be on bench (not in reserves)
      if (benchSet !== null && !benchSet.has(p.id)) return false;
      return true;
    })
    .map((p) => ({ player: p, pitchScore: calculateBaseballPositionScore(p, 'P') }))
    .sort((a, b) => b.pitchScore - a.pitchScore);
  const bullpen = bullpenCandidates.slice(0, 5).map((c) => c.player);

  return {
    teamId,
    teamName,
    lineup,
    pitcher,
    bullpen,
    catcher,
    defense,
    battingOrderPosition: 0,
    pitchCount: 0,
    pitcherPitchCounts: {},
  };
}

/**
 * Build SoccerTeamState from roster for soccer simulation
 * Assigns positions based on overall rating if no specific lineup is provided
 */
function buildSoccerTeamState(
  teamId: string,
  teamName: string,
  roster: Player[],
  lineupConfig?: {
    starters: string[];
    formation: string;
    positions: Record<string, number>;  // Slot index, not position string
  },
  tactics?: {
    attackingStyle: 'possession' | 'direct' | 'counter';
    pressing: 'high' | 'balanced' | 'low';
    width: 'wide' | 'balanced' | 'tight';
  }
): SoccerTeamState {
  // Sort roster by overall rating
  const sortedRoster = [...roster].sort((a, b) => {
    const overallA = Object.values(a.attributes).reduce((sum, v) => sum + v, 0) / 26;
    const overallB = Object.values(b.attributes).reduce((sum, v) => sum + v, 0) / 26;
    return overallB - overallA;
  });

  // Ensure we have at least one player
  if (sortedRoster.length === 0) {
    throw new Error('Cannot build soccer team state: no players in roster');
  }

  let lineup: Player[];
  let formation: string;
  let positions: Record<string, SoccerPosition>;

  if (lineupConfig && lineupConfig.starters && lineupConfig.starters.length >= 11) {
    // Use provided lineup
    lineup = lineupConfig.starters
      .slice(0, 11)
      .map((id) => roster.find((p) => p.id === id))
      .filter((p): p is Player => p !== undefined);
    formation = lineupConfig.formation || '4-4-2';

    // Convert slot indices to position strings using formation template
    const positionTemplate = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2'] || [];
    positions = {};
    for (const [playerId, slotIndex] of Object.entries(lineupConfig.positions)) {
      const positionString = positionTemplate[slotIndex];
      if (positionString) {
        positions[playerId] = positionString as SoccerPosition;
      }
    }
  } else {
    // Auto-generate: top 11 players
    lineup = sortedRoster.slice(0, 11);
    formation = '4-4-2';
    positions = autoAssignSoccerPositions(lineup, formation);
  }

  // Ensure we have 11 players
  while (lineup.length < 11 && sortedRoster.length > lineup.length) {
    const nextPlayer = sortedRoster.find((p) => !lineup.includes(p));
    if (nextPlayer) lineup.push(nextPlayer);
    else break;
  }

  // Ensure all players in lineup have positions assigned
  // (players added in the while loop above may not have positions)
  for (const player of lineup) {
    if (!positions[player.id]) {
      // Assign a default position based on the player's natural position or CM
      const naturalPos = player.position as SoccerPosition | undefined;
      const validSoccerPositions: SoccerPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      positions[player.id] = (naturalPos && validSoccerPositions.includes(naturalPos)) ? naturalPos : 'CM';
    }
  }

  return {
    teamId,
    teamName,
    lineup,
    formation,
    positions,
    tactics: tactics ?? {
      attackingStyle: 'direct',
      pressing: 'balanced',
      width: 'balanced',
    },
  };
}

/**
 * Get position category for sorting players
 */
function getPositionCategory(pos: string): 'gk' | 'def' | 'mid' | 'att' {
  if (pos === 'GK') return 'gk';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'def';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'mid';
  return 'att'; // ST, CF, LW, RW
}

/**
 * Auto-assign soccer positions based on player attributes and formation
 */
function autoAssignSoccerPositions(lineup: Player[], formation: string = '4-4-2'): Record<string, SoccerPosition> {
  const positions: Record<string, SoccerPosition> = {};
  const assigned = new Set<string>();

  // Get position template for formation (default to 4-4-2)
  const DEFAULT_POSITIONS = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const positionTemplate = FORMATION_POSITIONS[formation] || DEFAULT_POSITIONS;

  // Sort players by different attributes for different position types
  const sortedByGK = [...lineup].sort((a, b) => {
    const gkA = a.attributes.reactions + a.attributes.height + a.attributes.agility;
    const gkB = b.attributes.reactions + b.attributes.height + b.attributes.agility;
    return gkB - gkA;
  });

  const sortedByDefense = [...lineup].sort((a, b) => {
    const defA = a.attributes.awareness + a.attributes.reactions + a.attributes.core_strength;
    const defB = b.attributes.awareness + b.attributes.reactions + b.attributes.core_strength;
    return defB - defA;
  });

  const sortedByMidfield = [...lineup].sort((a, b) => {
    const midA = a.attributes.creativity + a.attributes.awareness + a.attributes.stamina;
    const midB = b.attributes.creativity + b.attributes.awareness + b.attributes.stamina;
    return midB - midA;
  });

  const sortedByAttack = [...lineup].sort((a, b) => {
    const atkA = a.attributes.finesse + a.attributes.composure + a.attributes.top_speed;
    const atkB = b.attributes.finesse + b.attributes.composure + b.attributes.top_speed;
    return atkB - atkA;
  });

  // Assign each position from template
  for (const pos of positionTemplate) {
    const category = getPositionCategory(pos);
    let sortedList: Player[];

    switch (category) {
      case 'gk':
        sortedList = sortedByGK;
        break;
      case 'def':
        sortedList = sortedByDefense;
        break;
      case 'mid':
        sortedList = sortedByMidfield;
        break;
      case 'att':
        sortedList = sortedByAttack;
        break;
    }

    const player = sortedList.find((p) => !assigned.has(p.id));
    if (player) {
      positions[player.id] = pos as SoccerPosition;
      assigned.add(player.id);
    }
  }

  return positions;
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
  }, [state.season.matches, state.season.standings, state.userTeam.rosterIds, state.userTeam.lineup, state.userTeam.tactics, state.initialized]);

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
          scope: 'team',
          teamId: 'user',
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
          scope: 'team',
          teamId: 'user',
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
          scope: 'team',
          teamId: 'user',
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
        type: 'scouting',
        priority: 'info',
        title: 'Scouting Report Complete',
        message: `Your scouts have completed a full report on ${player.name}. All attributes are now visible.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: playerId,
        scope: 'team',
        teamId: 'user',
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
          type: 'scouting',
          priority: 'info',
          title: 'New Scouting Report',
          message: `Your scouts have completed a ${depthLabel} report on ${player.name}.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: player.id,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
        scoutedThisWeek++;
      }
    }

    // =========================================================================
    // TRAINING AND PROGRESSION
    // =========================================================================
    const progressionState = stateRef.current;
    const trainingBudgetPct = progressionState.userTeam.operationsBudget.training;
    const progressionResults = processWeeklyProgression(
      progressionState.players,
      progressionState.userTeam.rosterIds,
      progressionState.userTeam.trainingFocus,
      trainingBudgetPct,
      progressionState.season.currentWeek
    );

    // Apply progression results
    if (progressionResults.length > 0) {
      // Debug: Log training progress
      const improvements = progressionResults.filter(r => r.improvements.length > 0);
      if (improvements.length > 0) {
        console.log(`[Training] Week ${progressionState.season.currentWeek}: ${improvements.length} players improved`);
        improvements.forEach(r => {
          r.improvements.forEach(i => {
            console.log(`  ${r.playerName}: ${i.attributeName} ${i.oldValue} → ${i.newValue}`);
          });
        });
      }
      dispatch({ type: 'APPLY_WEEKLY_PROGRESSION', payload: { results: progressionResults } });
    }

    // =========================================================================
    // YOUTH ACADEMY SCOUTING CYCLE
    // =========================================================================
    // Generate new scouting reports every 4 weeks (SCOUTING_CYCLE_WEEKS)
    const youthState = stateRef.current;
    const youthAcademy = youthState.youthAcademy;
    const youthBudgetPct = youthState.userTeam.operationsBudget.youthDevelopment;
    const youthBudgetAmount = (youthBudgetPct / 100) * 500000;
    const youthQualityMultiplier = 0.5 + (youthBudgetPct / 100) * 1.0;
    const reportsPerCycle = calculateReportsPerCycle(youthBudgetAmount);

    // Check if it's time for new reports (every 4 weeks)
    const weeksSinceLastReport = youthState.season.currentWeek - (youthAcademy?.lastReportWeek || 0);
    const shouldGenerateReports = weeksSinceLastReport >= SCOUTING_CYCLE_WEEKS || !youthAcademy?.initialized;

    if (shouldGenerateReports) {
      const seed = Date.now() + youthState.season.currentWeek;
      const sportFocus = youthAcademy?.scoutSportFocus || 'balanced';
      const existingReports = youthAcademy?.scoutingReports || [];

      // Advance continuing reports (narrow ranges, check for rival signing)
      const updatedReports = existingReports.map((report, index) =>
        advanceYouthScoutingReport(report, youthState.season.currentWeek, seed + index * 100)
      );

      // Check for rival signings and create news events
      const rivalSigned = updatedReports.filter(r => r.status === 'signed_by_rival');
      rivalSigned.forEach(report => {
        const event: NewsItem = {
          id: `event-rival-sign-${Date.now()}-${report.id}`,
          type: 'youth',
          priority: 'important',
          title: 'Prospect Signed by Rival',
          message: `${report.name} has been signed by another club while you were scouting him.`,
          timestamp: new Date(),
          read: false,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      });

      // Keep reports that are continuing scouting (status = 'scouting')
      const continuingReports = updatedReports.filter(r => r.status === 'scouting');

      // Calculate how many new report slots are available
      const availableSlots = Math.max(0, reportsPerCycle - continuingReports.length);

      // Generate new reports only for available slots
      const newReports = availableSlots > 0
        ? generateYouthScoutingReports(
            youthState.season.currentWeek,
            availableSlots,
            youthQualityMultiplier,
            seed + 10000,
            sportFocus
          )
        : [];

      // Dispatch updates to youth academy state
      const allReports = [...continuingReports, ...newReports];
      dispatch({
        type: 'SET_YOUTH_ACADEMY_STATE',
        payload: {
          ...youthAcademy,
          scoutingReports: allReports,
          academyProspects: youthAcademy?.academyProspects || [],
          lastReportWeek: youthState.season.currentWeek,
          initialized: true,
          scoutSportFocus: sportFocus,
        },
      });

      // Add news event for new reports
      if (newReports.length > 0) {
        const event: NewsItem = {
          id: `event-youth-reports-${Date.now()}`,
          type: 'youth',
          priority: 'info',
          title: 'New Youth Prospects Available',
          message: `Your youth scouts have identified ${newReports.length} new prospect${newReports.length > 1 ? 's' : ''} for evaluation.`,
          timestamp: new Date(),
          read: false,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      }

      console.log(`[Youth Academy] Week ${youthState.season.currentWeek}: Generated ${newReports.length} new reports, ${continuingReports.length} continuing`);
    }

    // =========================================================================
    // ACADEMY TRAINING
    // =========================================================================
    const academyBudgetPct = stateRef.current.userTeam.operationsBudget.youthDevelopment;
    const academyProspects = stateRef.current.youthAcademy?.academyProspects || [];
    const academyResults = processAcademyTraining(
      academyProspects,
      academyBudgetPct,
      stateRef.current.season.currentWeek
    );

    // Apply academy training results
    if (academyResults.length > 0) {
      // Debug: Log academy training progress
      const academyImprovements = academyResults.filter(r => r.improvements.length > 0);
      if (academyImprovements.length > 0) {
        console.log(`[Academy] Week ${stateRef.current.season.currentWeek}: ${academyImprovements.length} prospects improved`);
        academyImprovements.forEach(r => {
          r.improvements.forEach(i => {
            console.log(`  ${r.prospectName}: ${i.attributeName} ${i.oldValue} → ${i.newValue}`);
          });
        });
      }
      dispatch({ type: 'APPLY_ACADEMY_TRAINING', payload: { results: academyResults } });
    }

    // =========================================================================
    // MATCH FITNESS RECOVERY
    // =========================================================================
    // Apply fitness recovery based on actual rest days
    // Count how many games were played this week to calculate rest days
    const fitnessState = stateRef.current;
    const currentWeek = fitnessState.season.currentWeek;

    // Count user matches played this week (each game day = 1 less rest day)
    const userMatchesThisWeek = fitnessState.season.matches.filter(
      m => (m.homeTeamId === 'user' || m.awayTeamId === 'user') &&
           m.week === currentWeek &&
           m.status === 'completed'
    ).length;

    // Base: 7 days minus game days (assume 1 day per match for travel/game day)
    // Minimum 2 rest days even with heavy schedule
    const restDays = Math.max(2, 7 - userMatchesThisWeek);

    const medicalPct = fitnessState.userTeam.operationsBudget.facilities; // Use facilities as medical proxy
    dispatch({
      type: 'APPLY_FITNESS_RECOVERY',
      payload: {
        daysSinceAdvance: restDays,
        medicalBudgetPct: medicalPct,
      },
    });

    // =========================================================================
    // WEEKLY MORALE PROCESSING
    // =========================================================================
    // Process morale changes for all user roster players
    const moraleState = stateRef.current;
    const userMoralePlayers: Player[] = moraleState.userTeam.rosterIds
      .map(id => moraleState.players[id])
      .filter((p): p is Player => p !== undefined);

    // Build playing time data from completed matches this week
    const playingTimeMap = new Map<string, PlayingTimeData>();

    // Get user matches from last 5 games for playing time calculation
    const completedUserMatches = moraleState.season.matches
      .filter(m =>
        (m.homeTeamId === 'user' || m.awayTeamId === 'user') &&
        m.status === 'completed' &&
        m.result
      )
      .slice(-5); // Last 5 completed matches

    // Aggregate playing time per player
    for (const match of completedUserMatches) {
      const boxScore = match.result?.boxScore;
      if (!boxScore) continue;

      for (const player of userMoralePlayers) {
        let minutes = 0;
        const existing = playingTimeMap.get(player.id) || {
          minutesPlayed: 0,
          gamesPlayed: 0,
          sport: match.sport,
        };

        if (match.sport === 'basketball') {
          const minutesPlayed = boxScore.minutesPlayed as Record<string, number> | undefined;
          minutes = minutesPlayed?.[player.name] ?? 0;
        } else if (match.sport === 'soccer') {
          const homeStats = boxScore.homePlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
          const awayStats = boxScore.awayPlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
          const playerStats = homeStats?.[player.id] || awayStats?.[player.id];
          minutes = playerStats?.minutesPlayed ?? 0;
        } else if (match.sport === 'baseball') {
          // Baseball uses innings - check if player participated
          const homeBatting = boxScore.homeBatting as Record<string, unknown> | undefined;
          const awayBatting = boxScore.awayBatting as Record<string, unknown> | undefined;
          const homePitching = boxScore.homePitching as Record<string, { inningsPitched?: number }> | undefined;
          const awayPitching = boxScore.awayPitching as Record<string, { inningsPitched?: number }> | undefined;
          const pitcherStats = homePitching?.[player.id] || awayPitching?.[player.id];

          if (pitcherStats) {
            minutes = pitcherStats.inningsPitched || 0;
          } else if (homeBatting?.[player.id] !== undefined || awayBatting?.[player.id] !== undefined) {
            minutes = 9; // Full game for position players
          }
        }

        if (minutes > 0) {
          playingTimeMap.set(player.id, {
            minutesPlayed: existing.minutesPlayed + minutes,
            gamesPlayed: existing.gamesPlayed + 1,
            sport: match.sport,
          });
        }
      }
    }

    // Process morale for all user players
    const moraleResults = processWeeklyMorale(
      userMoralePlayers,
      new Map(), // Match results already recorded in player.recentMatchResults
      playingTimeMap
    );

    // Generate news events for transfer requests
    const transferRequestEvents: NewsItem[] = [];
    for (const result of moraleResults) {
      if (result.transferRequestTriggered) {
        const player = moraleState.players[result.playerId];
        if (player) {
          transferRequestEvents.push({
            id: `event-transfer-request-${Date.now()}-${player.id}`,
            type: 'transfer',
            priority: 'critical',
            title: 'Transfer Request!',
            message: `${player.name} has publicly requested a transfer. His morale has dropped to ${result.newMorale}.`,
            timestamp: new Date(),
            read: false,
            relatedEntityId: player.id,
            scope: 'team',
            teamId: 'user',
          });
        }
      }
    }

    // Dispatch morale updates
    if (moraleResults.length > 0) {
      dispatch({
        type: 'APPLY_MORALE_UPDATE',
        payload: moraleResults.map(r => ({
          playerId: r.playerId,
          newMorale: r.newMorale,
          weeksDisgruntled: r.weeksDisgruntled,
          transferRequestTriggered: r.transferRequestTriggered,
        })),
      });
    }

    // Dispatch transfer request events
    for (const event of transferRequestEvents) {
      dispatch({ type: 'ADD_EVENT', payload: event });
    }

    // =========================================================================
    // CONTRACT EXPIRATION ALERTS
    // =========================================================================
    const contractState = stateRef.current;
    const userRoster: Player[] = contractState.userTeam.rosterIds
      .map(id => contractState.players[id])
      .filter((p): p is Player => p !== undefined);
    const expiringInFourWeeks = userRoster.filter(p => {
      if (!p.contract) return false;
      const expiryDate = new Date(p.contract.expiryDate);
      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
      return expiryDate <= fourWeeksFromNow && expiryDate > new Date();
    });

    // Generate events for contracts expiring in 4 weeks (only once when hitting threshold)
    expiringInFourWeeks.forEach(player => {
      if (!player.contract) return;
      const weeksLeft = Math.ceil(
        (new Date(player.contract.expiryDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
      );
      // Only alert at 4, 2, and 1 week marks
      if (weeksLeft === 4 || weeksLeft === 2 || weeksLeft === 1) {
        const urgency: 'critical' | 'important' | 'info' = weeksLeft === 1 ? 'critical' : weeksLeft === 2 ? 'important' : 'info';
        const event: NewsItem = {
          id: `event-contract-expiring-${Date.now()}-${player.id}-${weeksLeft}`,
          type: 'contract',
          priority: urgency,
          title: weeksLeft === 1 ? 'Contract Expiring!' : 'Contract Expiring Soon',
          message: `${player.name}'s contract expires in ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''}. Renew or risk losing them.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: player.id,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      }
    });

    // =========================================================================
    // AI TEAM WEEKLY PROCESSING
    // =========================================================================
    const aiState = stateRef.current;

    // Build free agent pool for AI consideration
    const freeAgentPool = aiState.league.freeAgentIds
      .map(id => aiState.players[id])
      .filter((p): p is Player => p !== undefined)
      .map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        overallRating: calculatePlayerOverall(p),
        age: p.age,
        annualSalary: p.contract?.salary || Math.round(calculatePlayerOverall(p) * 50000),
      }));

    // Build incoming offers by AI team (user's outgoing offers to AI teams)
    const incomingOffersByTeam: Record<string, Array<{ offerId: string; playerId: string; offerAmount: number }>> = {};
    for (const offer of aiState.market.outgoingOffers) {
      if (offer.status === 'pending' && offer.receivingTeamId !== 'user') {
        const teamId = offer.receivingTeamId;
        if (!incomingOffersByTeam[teamId]) {
          incomingOffersByTeam[teamId] = [];
        }
        incomingOffersByTeam[teamId].push({
          offerId: offer.id,
          playerId: offer.playerId,
          offerAmount: offer.transferFee,
        });
      }
    }

    // Process AI teams
    // Use batched processing for large leagues (>30 teams) for performance
    const useBatchedProcessing = aiState.league.teams.length > 30;

    let aiResolvedActions;

    if (useBatchedProcessing) {
      // Initialize division manager if needed (for 200-team leagues)
      const dm = getDivisionManager();

      // Register teams with division manager if not already done
      if (dm.getSummary().totalTeams === 0) {
        const teamRefs: TeamReference[] = aiState.league.teams.map(team => ({
          id: team.id,
          name: team.name,
          division: team.division,
          isUserTeam: team.id === 'user',
        }));
        // Add user team
        teamRefs.push({
          id: 'user',
          name: aiState.userTeam.name,
          division: aiState.userTeam.division,
          isUserTeam: true,
        });
        dm.registerTeams(teamRefs);
      }

      // Build teams lookup by ID
      const allTeamsById: Record<string, AITeam> = {};
      for (const team of aiState.league.teams) {
        allTeamsById[team.id] = team;
      }

      const extendedInput: ExtendedWeeklyProcessorInput = {
        teams: aiState.league.teams, // Still needed for basic input
        allTeamsById,
        players: aiState.players,
        freeAgentPool,
        currentWeek: aiState.season.currentWeek,
        isTransferWindowOpen: aiState.season.transferWindowOpen,
        incomingOffersByTeam,
        userDivision: aiState.userTeam.division,
        divisionManager: dm,
        // Pass transfer-listed players so AI knows they're motivated sellers
        transferListedPlayerIds: aiState.userTeam.transferListPlayerIds || [],
      };

      const batchResult = processBatchedWeeklyAI(extendedInput);
      aiResolvedActions = batchResult.resolved;
      // Batch processing stats: batchResult.teamsProcessed teams processed
    } else {
      // Standard processing for small leagues (backwards compatible)
      const aiInput: WeeklyProcessorInput = {
        teams: aiState.league.teams,
        players: aiState.players,
        freeAgentPool,
        currentWeek: aiState.season.currentWeek,
        isTransferWindowOpen: aiState.season.transferWindowOpen,
        incomingOffersByTeam,
        // Pass transfer-listed players so AI knows they're motivated sellers
        transferListedPlayerIds: aiState.userTeam.transferListPlayerIds || [],
      };

      aiResolvedActions = processWeeklyAI(aiInput);
    }

    // Execute AI signings
    for (const signing of aiResolvedActions.signings) {
      dispatch({
        type: 'AI_SIGN_FREE_AGENT',
        payload: {
          teamId: signing.teamId,
          playerId: signing.playerId,
          salary: signing.salary,
          years: signing.years,
        },
      });

      // Create news event (division scope - other team activity)
      const event: NewsItem = {
        id: `event-ai-signing-${Date.now()}-${signing.playerId}`,
        type: 'transfer',
        priority: 'info',
        title: 'Transfer News',
        message: `${signing.teamName} have signed ${signing.playerName} on a ${signing.years}-year deal worth $${(signing.salary / 1000).toFixed(0)}k/year.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: signing.playerId,
        scope: 'division',
        teamId: signing.teamId,
      };
      dispatch({ type: 'ADD_EVENT', payload: event });
    }

    // Execute AI transfer bids (against user)
    for (const bid of aiResolvedActions.transferBids) {
      if (bid.sellerTeamId === 'user') {
        dispatch({
          type: 'AI_MAKE_TRANSFER_BID',
          payload: {
            buyerTeamId: bid.buyerTeamId,
            sellerTeamId: bid.sellerTeamId,
            playerId: bid.playerId,
            bidAmount: bid.bidAmount,
          },
        });

        // Create news event for incoming offer (team scope - affects user)
        const event: NewsItem = {
          id: `event-ai-bid-${Date.now()}-${bid.playerId}`,
          type: 'transfer',
          priority: 'important',
          title: 'Transfer Offer Received!',
          message: `${bid.buyerTeamName} have made a $${(bid.bidAmount / 1000000).toFixed(1)}M offer for ${bid.playerName}. Check your incoming offers to respond.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: bid.playerId,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });
      }
    }

    // Execute AI responses to user's transfer offers
    for (const response of aiResolvedActions.offerResponses) {
      dispatch({
        type: 'AI_RESPOND_TO_TRANSFER',
        payload: {
          offerId: response.offerId,
          decision: response.decision,
          counterAmount: response.counterAmount,
        },
      });
    }

    // Execute AI releases
    for (const release of aiResolvedActions.releases) {
      dispatch({
        type: 'AI_RELEASE_PLAYER',
        payload: {
          teamId: release.teamId,
          playerId: release.playerId,
        },
      });

      // Create news event (division scope - other team activity)
      const event: NewsItem = {
        id: `event-ai-release-${Date.now()}-${release.playerId}`,
        type: 'transfer',
        priority: 'info',
        title: 'Player Released',
        message: `${release.playerName} has been released and is now a free agent.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: release.playerId,
        scope: 'division',
        teamId: release.teamId,
      };
      dispatch({ type: 'ADD_EVENT', payload: event });
    }

    // Log AI activity summary
    if (aiResolvedActions.signings.length > 0 ||
        aiResolvedActions.transferBids.length > 0 ||
        aiResolvedActions.releases.length > 0) {
      console.log(`[AI Activity] Week ${aiState.season.currentWeek}: ` +
        `${aiResolvedActions.signings.length} signings, ` +
        `${aiResolvedActions.transferBids.length} bids, ` +
        `${aiResolvedActions.releases.length} releases, ` +
        `${aiResolvedActions.blockedActions.length} blocked`);
    }

    // =========================================================================
    // PLAYER AWARDS
    // =========================================================================
    const awardState = stateRef.current;
    const awardWeek = awardState.season.currentWeek;

    // Process weekly awards (Player of the Week for each sport)
    const weeklyAwardResult = processWeeklyAwards(
      awardWeek,
      awardState.season.matches,
      awardState.players,
      awardState.userTeam.name,
      awardState.league.teams
    );

    // Apply player updates from awards
    for (const [playerId, updatedPlayer] of Object.entries(weeklyAwardResult.updatedPlayers)) {
      if (awardState.players[playerId]?.awards !== updatedPlayer.awards) {
        dispatch({ type: 'UPDATE_PLAYER', payload: { playerId, updates: { awards: updatedPlayer.awards } } });
      }
    }

    // Add award news events
    for (const newsItem of weeklyAwardResult.newsItems) {
      dispatch({ type: 'ADD_EVENT', payload: newsItem });
    }

    // Process monthly awards every 4 weeks (Player of the Month for each sport)
    if (awardWeek > 0 && awardWeek % 4 === 0) {
      const month = Math.floor(awardWeek / 4);
      const monthStartWeek = (month - 1) * 4 + 1;

      const monthlyAwardResult = processMonthlyAwards(
        month,
        monthStartWeek,
        awardState.season.matches,
        awardState.players,
        awardState.userTeam.name,
        awardState.league.teams
      );

      // Apply monthly award updates
      for (const [playerId, updatedPlayer] of Object.entries(monthlyAwardResult.updatedPlayers)) {
        if (awardState.players[playerId]?.awards !== updatedPlayer.awards) {
          dispatch({ type: 'UPDATE_PLAYER', payload: { playerId, updates: { awards: updatedPlayer.awards } } });
        }
      }

      // Add monthly award news events
      for (const newsItem of monthlyAwardResult.newsItems) {
        dispatch({ type: 'ADD_EVENT', payload: newsItem });
      }

      console.log(`[Awards] Month ${month}: Processed monthly awards for all sports`);
    }

    console.log(`[Awards] Week ${awardWeek}: Processed weekly awards`);

    // =========================================================================
    // SEASON END AWARDS (Player of the Year, Rookie of the Year)
    // =========================================================================
    // Process at the end of week 40 (last week of season)
    if (awardWeek === 40) {
      const seasonAwardResult = processSeasonAwards(
        awardState.season.matches,
        awardState.players,
        awardState.userTeam.name,
        awardState.league.teams
      );

      // Apply season award updates
      for (const [playerId, updatedPlayer] of Object.entries(seasonAwardResult.updatedPlayers)) {
        if (awardState.players[playerId]?.awards !== updatedPlayer.awards) {
          dispatch({ type: 'UPDATE_PLAYER', payload: { playerId, updates: { awards: updatedPlayer.awards } } });
        }
      }

      // Add season award news events
      for (const newsItem of seasonAwardResult.newsItems) {
        dispatch({ type: 'ADD_EVENT', payload: newsItem });
      }

      console.log(`[Awards] Season End: Processed Player of the Year and Rookie of the Year awards for all sports`);
    }

    // =========================================================================
    // WEEK ADVANCEMENT AND OFFSEASON HANDLING
    // =========================================================================
    const preAdvanceState = stateRef.current;
    const wasRegularSeason = preAdvanceState.season.status === 'regular_season';
    const preAdvanceWeek = preAdvanceState.season.currentWeek;

    // Check if we're in offseason
    if (preAdvanceState.season.status === 'off_season') {
      // We're in offseason - handle offseason week advancement
      const currentOffseasonWeek = preAdvanceWeek - REGULAR_SEASON_WEEKS;

      if (currentOffseasonWeek >= OFFSEASON_WEEKS) {
        // End of offseason - start new season
        console.log('[Offseason] Week 12 complete - initializing new season');

        // Get promotion/relegation data from standings
        const standings = preAdvanceState.season.standings;
        const sorted = Object.values(standings)
          .sort((a, b) => a.rank - b.rank)
          .map((s) => s.teamId);
        const promotedTeams = sorted.slice(0, 3);
        const relegatedTeams = sorted.slice(-3);

        // Initialize new season
        const newSeasonResult = initializeNewSeason(
          preAdvanceState,
          promotedTeams,
          relegatedTeams
        );

        // Dispatch new season start
        dispatch({
          type: 'START_NEW_SEASON',
          payload: newSeasonResult,
        });

        // Add news event
        const userPromoted = promotedTeams.includes('user');
        const userRelegated = relegatedTeams.includes('user');

        let seasonStartMessage = `Season ${newSeasonResult.season.number} has begun!`;
        if (userPromoted) {
          seasonStartMessage += ` Congratulations on your promotion to Division ${newSeasonResult.userDivision}!`;
        } else if (userRelegated) {
          seasonStartMessage += ` You've been relegated to Division ${newSeasonResult.userDivision}.`;
        }

        const event: NewsItem = {
          id: `event-new-season-${Date.now()}`,
          type: 'league',
          priority: 'critical',
          title: `Season ${newSeasonResult.season.number} Begins`,
          message: seasonStartMessage,
          timestamp: new Date(),
          read: false,
          scope: 'global',
        };
        dispatch({ type: 'ADD_EVENT', payload: event });

        console.log(`[Season] New season ${newSeasonResult.season.number} started. User in Division ${newSeasonResult.userDivision}`);
      } else {
        // Continue offseason - just advance the week
        dispatch({ type: 'ADVANCE_OFFSEASON_WEEK' });
        console.log(`[Offseason] Advanced to week ${currentOffseasonWeek + 1} of ${OFFSEASON_WEEKS}`);
      }
    } else {
      // Regular season - advance normally
      dispatch({ type: 'ADVANCE_WEEK' });

      // Check if we just transitioned to offseason
      await new Promise(resolve => setTimeout(resolve, 50));
      const postAdvanceState = stateRef.current;

      if (wasRegularSeason && postAdvanceState.season.status === 'off_season') {
        // Just entered offseason - process season end
        console.log('[Season] Season complete - processing end of season');

        const seasonEndResult = processSeasonEnd(postAdvanceState);

        // Dispatch season end processing
        dispatch({
          type: 'PROCESS_SEASON_END',
          payload: seasonEndResult,
        });

        // Get standings record for trophy
        const userStanding = postAdvanceState.season.standings['user'];
        const userRecord = userStanding ? {
          wins: userStanding.wins,
          losses: userStanding.losses,
        } : { wins: 0, losses: 0 };

        // Award trophies
        const userWonChampionship = seasonEndResult.userFinishPosition === 1;
        const userWasPromoted = seasonEndResult.promotedTeams.includes('user');
        const userWasRelegated = seasonEndResult.relegatedTeams.includes('user');

        if (userWonChampionship) {
          const championshipTrophy: TrophyRecord = {
            type: 'championship',
            seasonNumber: postAdvanceState.season.number,
            division: postAdvanceState.userTeam.division,
            record: userRecord,
            date: new Date(),
          };
          dispatch({ type: 'ADD_TROPHY', payload: championshipTrophy });
        }

        if (userWasPromoted && !userWonChampionship) {
          // Only add promotion trophy if not already a championship
          const promotionTrophy: TrophyRecord = {
            type: 'promotion',
            seasonNumber: postAdvanceState.season.number,
            division: postAdvanceState.userTeam.division,
            record: userRecord,
            date: new Date(),
          };
          dispatch({ type: 'ADD_TROPHY', payload: promotionTrophy });
        }

        // Calculate and update manager career rating
        const seasonRating = calculateSeasonRating(
          postAdvanceState.season.number,
          postAdvanceState.userTeam.division,
          seasonEndResult.userFinishPosition,
          userWasPromoted,
          userWasRelegated
        );

        // Get the new division after promotion/relegation
        let newDivision = postAdvanceState.userTeam.division;
        if (userWasPromoted) {
          newDivision = Math.max(1, newDivision - 1) as typeof newDivision;
        } else if (userWasRelegated) {
          newDivision = Math.min(10, newDivision + 1) as typeof newDivision;
        }

        const updatedCareer = updateManagerCareer(
          postAdvanceState.managerCareer,
          seasonRating,
          newDivision
        );
        dispatch({ type: 'UPDATE_MANAGER_CAREER', payload: updatedCareer });

        console.log(`[Manager Rating] Season ${postAdvanceState.season.number} points: ${seasonRating.totalPoints} (Total: ${updatedCareer.totalPoints})`);

        // Create news events for season end
        const userTeamName = postAdvanceState.userTeam.name;
        const champion = postAdvanceState.league.teams.find((t) => t.id === seasonEndResult.champion);
        const championName = seasonEndResult.champion === 'user' ? userTeamName : champion?.name || 'Unknown';

        // Championship news
        const championEvent: NewsItem = {
          id: `event-champion-${Date.now()}`,
          type: 'league',
          priority: 'critical',
          title: 'Season Complete!',
          message: `${championName} are the Division ${postAdvanceState.userTeam.division} Champions!`,
          timestamp: new Date(),
          read: false,
          scope: 'global',
        };
        dispatch({ type: 'ADD_EVENT', payload: championEvent });

        // Prize money news for user
        const prizeEvent: NewsItem = {
          id: `event-prize-${Date.now()}`,
          type: 'finance',
          priority: 'important',
          title: 'Prize Money Received',
          message: `You finished ${seasonEndResult.userFinishPosition}${getOrdinalSuffix(seasonEndResult.userFinishPosition)} and received $${(seasonEndResult.userPrizeMoney / 1000000).toFixed(2)}M in prize money.`,
          timestamp: new Date(),
          read: false,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: prizeEvent });

        // Promotion/relegation news
        if (seasonEndResult.promotedTeams.includes('user')) {
          const promoEvent: NewsItem = {
            id: `event-promoted-${Date.now()}`,
            type: 'league',
            priority: 'critical',
            title: 'PROMOTED!',
            message: `Congratulations! You've been promoted to Division ${Math.max(1, postAdvanceState.userTeam.division - 1)}!`,
            timestamp: new Date(),
            read: false,
            scope: 'team',
            teamId: 'user',
          };
          dispatch({ type: 'ADD_EVENT', payload: promoEvent });
        } else if (seasonEndResult.relegatedTeams.includes('user')) {
          const relegEvent: NewsItem = {
            id: `event-relegated-${Date.now()}`,
            type: 'league',
            priority: 'critical',
            title: 'Relegated',
            message: `You've been relegated to Division ${Math.min(10, postAdvanceState.userTeam.division + 1)}.`,
            timestamp: new Date(),
            read: false,
            scope: 'team',
            teamId: 'user',
          };
          dispatch({ type: 'ADD_EVENT', payload: relegEvent });
        }

        // Contract expiration news
        if (seasonEndResult.expiredContracts.length > 0) {
          const expiredNames = seasonEndResult.expiredContracts
            .map((id) => postAdvanceState.players[id]?.name || 'Unknown')
            .slice(0, 3);
          const moreCount = seasonEndResult.expiredContracts.length - 3;
          const namesText = expiredNames.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '');

          const contractEvent: NewsItem = {
            id: `event-contracts-expired-${Date.now()}`,
            type: 'contract',
            priority: 'important',
            title: 'Contracts Expired',
            message: `The following players are now free agents: ${namesText}`,
            timestamp: new Date(),
            read: false,
            scope: 'team',
            teamId: 'user',
          };
          dispatch({ type: 'ADD_EVENT', payload: contractEvent });
        }

        // Offseason begins news
        const offseasonEvent: NewsItem = {
          id: `event-offseason-${Date.now()}`,
          type: 'league',
          priority: 'info',
          title: 'Offseason Begins',
          message: `The offseason has begun. You have ${OFFSEASON_WEEKS} weeks to prepare for next season.`,
          timestamp: new Date(),
          read: false,
          scope: 'team',
          teamId: 'user',
        };
        dispatch({ type: 'ADD_EVENT', payload: offseasonEvent });

        console.log(`[Season End] Position: ${seasonEndResult.userFinishPosition}, Prize: $${seasonEndResult.userPrizeMoney}, Morale: ${seasonEndResult.userMoraleChange > 0 ? '+' : ''}${seasonEndResult.userMoraleChange}`);
      }
    }

    // Auto-save if enabled
    if (state.settings.autoSaveEnabled) {
      await saveGame();
    }
  }, [state.settings.autoSaveEnabled, state.season.currentWeek, state.season.status, state.players, saveGame]);

  /**
   * Simulate all AI-vs-AI matches for the current week
   * Called after the user simulates their match to ensure fair stamina/fatigue
   */
  const simulateAIMatchesForWeek = useCallback(async () => {
    const matches = stateRef.current.season.matches;
    const players = stateRef.current.players;
    const league = stateRef.current.league;
    const aiTeamStrategies = stateRef.current.season.aiTeamStrategies || {};

    // Count how many games the user has completed per sport
    const userGameCounts = {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    };
    for (const m of matches) {
      if ((m.homeTeamId === 'user' || m.awayTeamId === 'user') && m.status === 'completed') {
        const sport = m.sport as keyof typeof userGameCounts;
        userGameCounts[sport]++;
      }
    }

    // Count games played by each AI team per sport
    const aiTeamGameCounts: Record<string, { basketball: number; baseball: number; soccer: number }> = {};
    for (const team of league.teams) {
      aiTeamGameCounts[team.id] = { basketball: 0, baseball: 0, soccer: 0 };
    }
    for (const m of matches) {
      if (m.status === 'completed') {
        const sport = m.sport as keyof typeof userGameCounts;
        const homeTeamCounts = aiTeamGameCounts[m.homeTeamId];
        const awayTeamCounts = aiTeamGameCounts[m.awayTeamId];
        if (m.homeTeamId !== 'user' && homeTeamCounts) {
          homeTeamCounts[sport]++;
        }
        if (m.awayTeamId !== 'user' && awayTeamCounts) {
          awayTeamCounts[sport]++;
        }
      }
    }

    // Find AI matches where at least one team is behind the user's pace
    // Sort by week to simulate in chronological order
    const aiMatchesToSimulate = matches
      .filter((m) => {
        if (m.homeTeamId === 'user' || m.awayTeamId === 'user') return false;
        if (m.status !== 'scheduled') return false;

        const sport = m.sport as keyof typeof userGameCounts;
        const userCount = userGameCounts[sport];
        const homeTeamCounts = aiTeamGameCounts[m.homeTeamId];
        const awayTeamCounts = aiTeamGameCounts[m.awayTeamId];
        const homeCount = homeTeamCounts?.[sport] ?? 0;
        const awayCount = awayTeamCounts?.[sport] ?? 0;

        // Simulate if either team is behind the user
        return homeCount < userCount || awayCount < userCount;
      })
      .sort((a, b) => a.week - b.week); // Simulate earlier weeks first

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

    // Track all fatigue updates across AI matches
    const allFatigueUpdates: Array<{
      playerId: string;
      drain: number;
      matchDate: Date;
      sport: 'basketball' | 'baseball' | 'soccer';
    }> = [];

    // Track standings updates
    const standingsUpdates: Record<string, {
      wins: number;
      losses: number;
      basketball: { wins: number; losses: number };
      baseball: { wins: number; losses: number };
      soccer: { wins: number; losses: number };
    }> = {};

    for (const match of aiMatchesToSimulate) {
      const sport = match.sport as keyof typeof userGameCounts;
      const homeTeamCounts = aiTeamGameCounts[match.homeTeamId];
      const awayTeamCounts = aiTeamGameCounts[match.awayTeamId];

      // Update counts as we simulate (so we don't over-simulate)
      if (homeTeamCounts) {
        homeTeamCounts[sport]++;
      }
      if (awayTeamCounts) {
        awayTeamCounts[sport]++;
      }

      // Skip if either team would go ahead of the user's pace
      // (counts were already incremented above, so check if > userCount)
      const userCount = userGameCounts[sport];
      const homeCount = homeTeamCounts?.[sport] ?? 0;
      const awayCount = awayTeamCounts?.[sport] ?? 0;
      if (homeCount > userCount || awayCount > userCount) {
        // At least one team would be ahead of user - don't simulate yet
        // Revert the counts we just added
        if (homeTeamCounts) {
          homeTeamCounts[sport]--;
        }
        if (awayTeamCounts) {
          awayTeamCounts[sport]--;
        }
        continue;
      }
      // Get home team roster
      const homeTeam = league.teams.find((t) => t.id === match.homeTeamId);
      const homeRoster = homeTeam
        ? homeTeam.rosterIds.map((id) => players[id]).filter((p): p is Player => p !== undefined)
        : [];

      // Get away team roster
      const awayTeam = league.teams.find((t) => t.id === match.awayTeamId);
      const awayRoster = awayTeam
        ? awayTeam.rosterIds.map((id) => players[id]).filter((p): p is Player => p !== undefined)
        : [];

      // Skip if either team has no players
      if (homeRoster.length < 5 || awayRoster.length < 5) continue;

      // Get AI strategies for this match (all sports)
      const homeBaseballStrategy = aiTeamStrategies[match.homeTeamId]?.baseball || DEFAULT_BASEBALL_STRATEGY;
      const awayBaseballStrategy = aiTeamStrategies[match.awayTeamId]?.baseball || DEFAULT_BASEBALL_STRATEGY;
      const homeBasketballStrategy = aiTeamStrategies[match.homeTeamId]?.basketball;
      const awayBasketballStrategy = aiTeamStrategies[match.awayTeamId]?.basketball;
      const homeSoccerStrategy = aiTeamStrategies[match.homeTeamId]?.soccer;
      const awaySoccerStrategy = aiTeamStrategies[match.awayTeamId]?.soccer;

      let homeScore: number;
      let awayScore: number;
      let boxScore: Record<string, unknown> = {};

      // Apply morale effects to mental attributes before simulation (all sports)
      const moraleAdjustedHomeRoster = applyMoraleToRoster(homeRoster);
      const moraleAdjustedAwayRoster = applyMoraleToRoster(awayRoster);

      try {
        if (match.sport === 'basketball') {
          // Convert AI basketball strategies to TacticalSettings format
          const defenseToManPct = (defense: 'man' | 'mixed' | 'zone'): number => {
            switch (defense) {
              case 'man': return 90;
              case 'zone': return 10;
              default: return 50;
            }
          };

          const homeTactics: TacticalSettings = homeBasketballStrategy ? {
            ...defaultTactics,
            pace: homeBasketballStrategy.pace || 'standard',
            manDefensePct: defenseToManPct(homeBasketballStrategy.defense || 'mixed'),
            reboundingStrategy: homeBasketballStrategy.rebounding || 'standard',
          } : defaultTactics;

          const awayTactics: TacticalSettings = awayBasketballStrategy ? {
            ...defaultTactics,
            pace: awayBasketballStrategy.pace || 'standard',
            manDefensePct: defenseToManPct(awayBasketballStrategy.defense || 'mixed'),
            reboundingStrategy: awayBasketballStrategy.rebounding || 'standard',
          } : defaultTactics;

          const homeTacticsConverted = convertTacticsToSimulationFormat(homeTactics);
          const awayTacticsConverted = convertTacticsToSimulationFormat(awayTactics);

          const simulator = new GameSimulator(
            moraleAdjustedHomeRoster,
            moraleAdjustedAwayRoster,
            homeTacticsConverted,
            awayTacticsConverted,
            match.homeTeamId,
            match.awayTeamId
          );
          const result = simulator.simulateGame();
          homeScore = result.homeScore;
          awayScore = result.awayScore;
          // Structure boxScore to match watch sim format for consistent display
          const gameStats = result.gameStatistics;
          boxScore = {
            quarterScores: result.quarterScores,
            homePlayerStats: gameStats.homePlayerStats,
            awayPlayerStats: gameStats.awayPlayerStats,
            minutesPlayed: result.minutesPlayed,
            homeStats: gameStats.homeStats,
            awayStats: gameStats.awayStats,
          };
        } else if (match.sport === 'baseball') {
          // AI vs AI games - pass null for benchIds (AI teams use all non-starters)
          // Use morale-adjusted rosters for mental attribute effects
          const homeTeamState = buildBaseballTeamState(match.homeTeamId, homeTeam?.name || match.homeTeamId, moraleAdjustedHomeRoster, undefined, null);
          const awayTeamState = buildBaseballTeamState(match.awayTeamId, awayTeam?.name || match.awayTeamId, moraleAdjustedAwayRoster, undefined, null);

          const baseballInput: BaseballGameInput = {
            homeTeam: homeTeamState,
            awayTeam: awayTeamState,
            useMercyRule: false,
            maxExtraInnings: 18,
            homeStrategy: homeBaseballStrategy,
            awayStrategy: awayBaseballStrategy,
          };

          const gameOutput = simulateBaseballGame(baseballInput);
          homeScore = gameOutput.result.homeScore;
          awayScore = gameOutput.result.awayScore;
          boxScore = gameOutput.result.boxScore as unknown as Record<string, unknown>;
        } else if (match.sport === 'soccer') {
          // Soccer simulation - use AI team strategies
          // Use morale-adjusted rosters for mental attribute effects
          const homeTeamName = homeTeam?.name || match.homeTeamId;
          const awayTeamName = awayTeam?.name || match.awayTeamId;
          const homeTeamState = buildSoccerTeamState(match.homeTeamId, homeTeamName, moraleAdjustedHomeRoster, undefined, homeSoccerStrategy);
          const awayTeamState = buildSoccerTeamState(match.awayTeamId, awayTeamName, moraleAdjustedAwayRoster, undefined, awaySoccerStrategy);

          const soccerResult = simulateSoccerMatchV2({
            homeTeam: homeTeamState,
            awayTeam: awayTeamState,
          });
          homeScore = soccerResult.homeScore;
          awayScore = soccerResult.awayScore;
          boxScore = soccerResult.boxScore as unknown as Record<string, unknown>;

          // Use simulation's winner (accounts for penalty shootout)
          const winner = soccerResult.winner || (homeScore > awayScore ? match.homeTeamId : match.awayTeamId);

          // Build match result with penalty shootout if applicable
          const matchResult: MatchResult = {
            matchId: match.id,
            homeScore,
            awayScore,
            winner,
            boxScore,
            playByPlay: soccerResult.playByPlay || [],
            ...(soccerResult.penaltyShootout && {
              penaltyShootout: {
                homeScore: soccerResult.penaltyShootout.homeScore,
                awayScore: soccerResult.penaltyShootout.awayScore,
              },
            }),
          };

          // Dispatch match completion and continue (soccer has special handling)
          dispatch({ type: 'COMPLETE_MATCH', payload: { matchId: match.id, result: matchResult } });

          // Apply soccer fatigue
          const soccerParticipants = [...homeRoster, ...awayRoster];
          const soccerFatigueUpdates: Array<{
            playerId: string;
            drain: number;
            matchDate: Date;
            sport: 'basketball' | 'baseball' | 'soccer';
          }> = [];

          for (const player of soccerParticipants) {
            const minutesPlayed = 90; // Full match for now
            const staminaAttr = player.attributes?.stamina ?? 50;
            const drain = calculateMatchDrain('soccer', player.position || 'CM', minutesPlayed, staminaAttr, false);
            soccerFatigueUpdates.push({
              playerId: player.id,
              drain,
              matchDate: match.scheduledDate,
              sport: 'soccer',
            });
          }

          if (soccerFatigueUpdates.length > 0) {
            dispatch({ type: 'APPLY_MATCH_FATIGUE', payload: soccerFatigueUpdates });
          }
          continue; // Soccer handled completely, skip common logic
        } else {
          continue; // Skip unknown sports
        }

        // Calculate winner (for basketball/baseball)
        const winner = homeScore > awayScore ? match.homeTeamId : (awayScore > homeScore ? match.awayTeamId : 'draw');

        // Build match result (for basketball/baseball)
        const matchResult: MatchResult = {
          matchId: match.id,
          homeScore,
          awayScore,
          winner,
          boxScore,
          playByPlay: [],
        };

        // Dispatch match completion
        dispatch({ type: 'COMPLETE_MATCH', payload: { matchId: match.id, result: matchResult } });

        // Calculate fatigue for all participants
        const allParticipants = [...homeRoster, ...awayRoster];
        for (const player of allParticipants) {
          let minutesOrInnings = 0;
          let position = player.position || 'SF';
          let isReliefPitcher = false;

          if (match.sport === 'basketball') {
            const minutesPlayed = boxScore.minutesPlayed as Record<string, number> | undefined;
            minutesOrInnings = minutesPlayed?.[player.id] ?? 0;
          } else if (match.sport === 'baseball') {
            const homePositions = boxScore.homePositions as Record<string, string> | undefined;
            const awayPositions = boxScore.awayPositions as Record<string, string> | undefined;
            const baseballPosition = homePositions?.[player.id] || awayPositions?.[player.id];

            const homePitching = boxScore.homePitching as Record<string, { inningsPitched?: number }> | undefined;
            const awayPitching = boxScore.awayPitching as Record<string, { inningsPitched?: number }> | undefined;
            const pitcherStats = homePitching?.[player.id] || awayPitching?.[player.id];

            if (pitcherStats) {
              position = 'P';
              minutesOrInnings = pitcherStats.inningsPitched || 0;
              isReliefPitcher = minutesOrInnings < 5;
            } else {
              const homeBatting = boxScore.homeBatting as Record<string, unknown> | undefined;
              const awayBatting = boxScore.awayBatting as Record<string, unknown> | undefined;
              const playerBatted = homeBatting?.[player.id] !== undefined || awayBatting?.[player.id] !== undefined;
              if (playerBatted) {
                minutesOrInnings = 9;
                position = baseballPosition || 'DH';
              }
            }
          } else if (match.sport === 'soccer') {
            // Check if player actually played by looking at player stats
            const homePlayerStats = boxScore.homePlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
            const awayPlayerStats = boxScore.awayPlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
            const playerStats = homePlayerStats?.[player.id] || awayPlayerStats?.[player.id];
            minutesOrInnings = playerStats?.minutesPlayed ?? 0;

            const positionMap = boxScore.positions as Record<string, string> | undefined;
            position = positionMap?.[player.id] || player.position || 'CM';
          }

          if (minutesOrInnings > 0) {
            const drain = calculateMatchDrain(
              match.sport,
              position,
              minutesOrInnings,
              player.attributes.stamina,
              isReliefPitcher
            );

            if (drain > 0) {
              allFatigueUpdates.push({
                playerId: player.id,
                drain,
                matchDate: match.scheduledDate,
                sport: match.sport,
              });
            }
          }
        }

        // Track standings updates - ensure entries exist
        if (!standingsUpdates[match.homeTeamId]) {
          standingsUpdates[match.homeTeamId] = {
            wins: 0, losses: 0,
            basketball: { wins: 0, losses: 0 },
            baseball: { wins: 0, losses: 0 },
            soccer: { wins: 0, losses: 0 },
          };
        }
        if (!standingsUpdates[match.awayTeamId]) {
          standingsUpdates[match.awayTeamId] = {
            wins: 0, losses: 0,
            basketball: { wins: 0, losses: 0 },
            baseball: { wins: 0, losses: 0 },
            soccer: { wins: 0, losses: 0 },
          };
        }

        const homeUpdate = standingsUpdates[match.homeTeamId]!;
        const awayUpdate = standingsUpdates[match.awayTeamId]!;
        const sport = match.sport as 'basketball' | 'baseball' | 'soccer';

        if (homeScore > awayScore) {
          homeUpdate.wins += 1;
          homeUpdate[sport].wins += 1;
          awayUpdate.losses += 1;
          awayUpdate[sport].losses += 1;
        } else {
          // Away wins (no draws in this system)
          awayUpdate.wins += 1;
          awayUpdate[sport].wins += 1;
          homeUpdate.losses += 1;
          homeUpdate[sport].losses += 1;
        }
      } catch (err) {
        // Log error but continue with other matches
        console.warn(`Failed to simulate AI match ${match.id}:`, err);
      }
    }

    // Apply all fatigue updates at once
    if (allFatigueUpdates.length > 0) {
      dispatch({ type: 'APPLY_MATCH_FATIGUE', payload: allFatigueUpdates });
    }

    // Update standings with all AI match results
    if (Object.keys(standingsUpdates).length > 0) {
      const newStandings = { ...stateRef.current.season.standings };

      for (const [teamId, update] of Object.entries(standingsUpdates)) {
        const standing = newStandings[teamId];
        if (standing) {
          standing.wins += update.wins;
          standing.losses += update.losses;
          standing.basketball.wins += update.basketball.wins;
          standing.basketball.losses += update.basketball.losses;
          standing.baseball.wins += update.baseball.wins;
          standing.baseball.losses += update.baseball.losses;
          standing.soccer.wins += update.soccer.wins;
          standing.soccer.losses += update.soccer.losses;
        }
      }

      // Recalculate ranks by W-L%
      const getWinPct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));
      const sorted = Object.values(newStandings).sort((a, b) => {
        const aWinPct = getWinPct(a.wins, a.losses);
        const bWinPct = getWinPct(b.wins, b.losses);
        if (bWinPct !== aWinPct) return bWinPct - aWinPct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses; // Fewer losses is better
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
  }, []);

  const simulateMatch = useCallback(async (
    matchId: string,
    baseballStrategy?: BaseballGameStrategy,
    soccerStrategy?: { attackingStyle: 'possession' | 'direct' | 'counter'; pressing: 'high' | 'balanced' | 'low'; width: 'wide' | 'balanced' | 'tight' },
    basketballStrategy?: { pace: 'fast' | 'standard' | 'slow'; defense: 'man' | 'mixed' | 'zone'; rebounding: 'crash_glass' | 'standard' | 'prevent_transition'; scoringOptions: string[] }
  ): Promise<MatchResult> => {
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
      // Use AI team's persistent basketball strategy if available
      const homeAiBbStrategy = state.season.aiTeamStrategies[match.homeTeamId]?.basketball;
      if (homeAiBbStrategy) {
        const defenseToManPct = (defense: 'man' | 'mixed' | 'zone'): number => {
          switch (defense) {
            case 'man': return 90;
            case 'zone': return 10;
            default: return 50;
          }
        };
        homeTactics = {
          ...defaultTactics,
          pace: homeAiBbStrategy.pace || 'standard',
          manDefensePct: defenseToManPct(homeAiBbStrategy.defense || 'mixed'),
          reboundingStrategy: homeAiBbStrategy.rebounding || 'standard',
        };
      } else {
        homeTactics = defaultTactics;
      }
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
      // Use AI team's persistent basketball strategy if available
      const awayAiBbStrategy = state.season.aiTeamStrategies[match.awayTeamId]?.basketball;
      if (awayAiBbStrategy) {
        const defenseToManPct = (defense: 'man' | 'mixed' | 'zone'): number => {
          switch (defense) {
            case 'man': return 90;
            case 'zone': return 10;
            default: return 50;
          }
        };
        awayTactics = {
          ...defaultTactics,
          pace: awayAiBbStrategy.pace || 'standard',
          manDefensePct: defenseToManPct(awayAiBbStrategy.defense || 'mixed'),
          reboundingStrategy: awayAiBbStrategy.rebounding || 'standard',
        };
      } else {
        awayTactics = defaultTactics;
      }
    }

    // Run sport-specific game simulation
    let homeScore: number;
    let awayScore: number;
    let boxScore: Record<string, unknown> = {};
    let playByPlay: string[] = [];
    let soccerWinner: string | null = null;
    let soccerPenaltyShootout: { homeScore: number; awayScore: number } | undefined;

    // Apply morale effects to mental attributes before simulation (all sports)
    const moraleAdjustedHomeRoster = applyMoraleToRoster(homeRoster);
    const moraleAdjustedAwayRoster = applyMoraleToRoster(awayRoster);

    try {
      if (match.sport === 'basketball') {
        // Validate user lineup before simulation
        if (isUserHome || isUserAway) {
          const userRoster = getUserRoster();
          const validation = validateBasketballLineup(
            state.userTeam.lineup.basketballStarters,
            userRoster
          );
          if (!validation.valid) {
            throw new Error(validation.error || 'Invalid basketball lineup');
          }
        }

        // Apply user's basketball strategy if provided
        let effectiveHomeTactics = homeTactics;
        let effectiveAwayTactics = awayTactics;

        if (basketballStrategy) {
          // Convert player IDs to player names for scoring options
          const convertScoringOptions = (ids: string[]): [string?, string?, string?] => {
            return ids.slice(0, 3).map(id => {
              const player = state.players[id];
              return player?.name;
            }) as [string?, string?, string?];
          };

          // Convert defense type to manDefensePct
          const defenseToManPct = (defense: 'man' | 'mixed' | 'zone'): number => {
            switch (defense) {
              case 'man': return 90;
              case 'zone': return 10;
              default: return 50;
            }
          };

          const userTacticsOverride: TacticalSettings = {
            ...state.userTeam.tactics,
            pace: basketballStrategy.pace,
            manDefensePct: defenseToManPct(basketballStrategy.defense),
            reboundingStrategy: basketballStrategy.rebounding,
            scoringOptions: convertScoringOptions(basketballStrategy.scoringOptions),
          };

          if (isUserHome) {
            effectiveHomeTactics = userTacticsOverride;
          } else if (isUserAway) {
            effectiveAwayTactics = userTacticsOverride;
          }
        }

        // Basketball simulation
        const homeTacticsConverted = convertTacticsToSimulationFormat(effectiveHomeTactics);
        const awayTacticsConverted = convertTacticsToSimulationFormat(effectiveAwayTactics);

        // Get user's minutes allocation if this is a user team match
        const homeMinutesAllocation = isUserHome ? state.userTeam.lineup.minutesAllocation : null;
        const awayMinutesAllocation = isUserAway ? state.userTeam.lineup.minutesAllocation : null;

        // Get user's starting lineup (convert IDs to Player objects)
        const userStartingLineup = state.userTeam.lineup.basketballStarters
          .map(id => state.players[id])
          .filter((p): p is Player => p !== undefined);

        // Only use user's starting lineup if all 5 players are found
        const validUserStarting = userStartingLineup.length === 5 ? userStartingLineup : null;
        const homeStartingLineup = isUserHome ? validUserStarting : null;
        const awayStartingLineup = isUserAway ? validUserStarting : null;

        // Apply morale effects to starters (rosters already adjusted above)
        const moraleAdjustedHomeStarters = homeStartingLineup ? applyMoraleToRoster(homeStartingLineup) : null;
        const moraleAdjustedAwayStarters = awayStartingLineup ? applyMoraleToRoster(awayStartingLineup) : null;

        const simulator = new GameSimulator(
          moraleAdjustedHomeRoster,
          moraleAdjustedAwayRoster,
          homeTacticsConverted,
          awayTacticsConverted,
          homeTeamName,
          awayTeamName,
          homeMinutesAllocation,
          awayMinutesAllocation,
          moraleAdjustedHomeStarters,
          moraleAdjustedAwayStarters
        );
        const gameResult = simulator.simulateGame();

        homeScore = gameResult.homeScore;
        awayScore = gameResult.awayScore;
        // Structure boxScore to match watch sim format for consistent display
        const gameStats = gameResult.gameStatistics;
        boxScore = {
          quarterScores: gameResult.quarterScores,
          homePlayerStats: gameStats.homePlayerStats,
          awayPlayerStats: gameStats.awayPlayerStats,
          minutesPlayed: gameResult.minutesPlayed,
          homeStats: gameStats.homeStats,
          awayStats: gameStats.awayStats,
        };
        playByPlay = gameResult.playByPlayText.split('\n').filter((line: string) => line.length > 0);

      } else if (match.sport === 'baseball') {
        // Validate user lineup - if invalid, auto-generate a new one
        let useUserLineup = false;
        if (isUserHome || isUserAway) {
          const userRoster = getUserRoster();
          const validation = validateBaseballLineup(
            state.userTeam.lineup.baseballLineup,
            userRoster
          );
          if (validation.valid) {
            useUserLineup = true;
          } else {
            // Old lineup format or invalid - will auto-generate
            console.warn('Baseball lineup invalid, auto-generating:', validation.error);
          }
        }

        // Baseball simulation - only use user config if valid
        const homeLineupConfig = (isUserHome && useUserLineup) ? {
          battingOrder: state.userTeam.lineup.baseballLineup.battingOrder,
          positions: state.userTeam.lineup.baseballLineup.positions,
          startingPitcher: state.userTeam.lineup.baseballLineup.startingPitcher,
        } : undefined;

        const awayLineupConfig = (isUserAway && useUserLineup) ? {
          battingOrder: state.userTeam.lineup.baseballLineup.battingOrder,
          positions: state.userTeam.lineup.baseballLineup.positions,
          startingPitcher: state.userTeam.lineup.baseballLineup.startingPitcher,
        } : undefined;

        // Pass bench array for user teams to filter out reserve players from bullpen
        // Use morale-adjusted rosters for mental attribute effects
        const userBench = state.userTeam.lineup.bench;
        const homeTeamState = buildBaseballTeamState(match.homeTeamId, homeTeamName, moraleAdjustedHomeRoster, homeLineupConfig, isUserHome ? userBench : null);
        const awayTeamState = buildBaseballTeamState(match.awayTeamId, awayTeamName, moraleAdjustedAwayRoster, awayLineupConfig, isUserAway ? userBench : null);

        // Get strategies for each team - user's from param, AI's from season-persistent strategies
        const userStrategy = baseballStrategy || DEFAULT_BASEBALL_STRATEGY;
        const homeAiBaseballStrategy = state.season.aiTeamStrategies[match.homeTeamId]?.baseball || DEFAULT_BASEBALL_STRATEGY;
        const awayAiBaseballStrategy = state.season.aiTeamStrategies[match.awayTeamId]?.baseball || DEFAULT_BASEBALL_STRATEGY;

        const baseballInput: BaseballGameInput = {
          homeTeam: homeTeamState,
          awayTeam: awayTeamState,
          useMercyRule: false,
          maxExtraInnings: 18,
          homeStrategy: isUserHome ? userStrategy : homeAiBaseballStrategy,
          awayStrategy: isUserAway ? userStrategy : awayAiBaseballStrategy,
        };

        const gameOutput = simulateBaseballGame(baseballInput);
        const gameResult = gameOutput.result;

        homeScore = gameResult.homeScore;
        awayScore = gameResult.awayScore;

        // Build box score from baseball result
        // Include positions from lineup configs for display purposes
        const homePositionsMap: Record<string, string> = {};
        const awayPositionsMap: Record<string, string> = {};

        // First, use the user's lineup config positions (includes DH)
        if (isUserHome && homeLineupConfig?.positions) {
          Object.entries(homeLineupConfig.positions).forEach(([playerId, pos]) => {
            homePositionsMap[playerId] = pos;
          });
        }
        if (isUserAway && awayLineupConfig?.positions) {
          Object.entries(awayLineupConfig.positions).forEach(([playerId, pos]) => {
            awayPositionsMap[playerId] = pos;
          });
        }

        // Then fill in from team states (for AI teams or missing positions)
        // Use the defense map which maps position -> player
        if (homeTeamState.defense) {
          Object.entries(homeTeamState.defense).forEach(([pos, player]) => {
            if (player && !homePositionsMap[player.id]) {
              homePositionsMap[player.id] = pos;
            }
          });
        }
        if (homeTeamState.pitcher) {
          homePositionsMap[homeTeamState.pitcher.id] = 'P';
        }

        if (awayTeamState.defense) {
          Object.entries(awayTeamState.defense).forEach(([pos, player]) => {
            if (player && !awayPositionsMap[player.id]) {
              awayPositionsMap[player.id] = pos;
            }
          });
        }
        if (awayTeamState.pitcher) {
          awayPositionsMap[awayTeamState.pitcher.id] = 'P';
        }

        boxScore = {
          innings: gameResult.innings,
          homeRunsByInning: gameResult.boxScore.homeRunsByInning,
          awayRunsByInning: gameResult.boxScore.awayRunsByInning,
          homeHits: gameResult.boxScore.homeHits,
          awayHits: gameResult.boxScore.awayHits,
          homeErrors: gameResult.boxScore.homeErrors,
          awayErrors: gameResult.boxScore.awayErrors,
          homeErrorsByFielder: gameResult.boxScore.homeErrorsByFielder,
          awayErrorsByFielder: gameResult.boxScore.awayErrorsByFielder,
          homeBatting: gameResult.boxScore.homeBatting,
          awayBatting: gameResult.boxScore.awayBatting,
          homePitching: gameResult.boxScore.homePitching,
          awayPitching: gameResult.boxScore.awayPitching,
          homePositions: homePositionsMap,
          awayPositions: awayPositionsMap,
        };

        // Use play-by-play from result
        playByPlay = gameResult.playByPlay;

      } else if (match.sport === 'soccer') {
        // Soccer simulation
        // Build soccer team states
        const homeSoccerLineup = isUserHome ? {
          starters: state.userTeam.lineup.soccerLineup.starters,
          formation: state.userTeam.lineup.soccerLineup.formation,
          positions: state.userTeam.lineup.soccerLineup.positions,
        } : undefined;

        const awaySoccerLineup = isUserAway ? {
          starters: state.userTeam.lineup.soccerLineup.starters,
          formation: state.userTeam.lineup.soccerLineup.formation,
          positions: state.userTeam.lineup.soccerLineup.positions,
        } : undefined;

        // Get tactics for each team - user's from strategy param or global state, AI's from season-persistent strategies
        const homeAiSoccerStrategy = state.season.aiTeamStrategies[match.homeTeamId]?.soccer;
        const awayAiSoccerStrategy = state.season.aiTeamStrategies[match.awayTeamId]?.soccer;

        // Build user's soccer strategy from global state if not passed as param
        const userSoccerStrategyFromState = {
          attackingStyle: state.userTeam.tactics.soccerAttackingStyle || 'direct',
          pressing: state.userTeam.tactics.soccerPressing || 'balanced',
          width: state.userTeam.tactics.soccerWidth || 'balanced',
        } as const;

        // Use passed strategy if available, otherwise use global state
        const userSoccerTactics = soccerStrategy || userSoccerStrategyFromState;

        const homeTacticsForSoccer = isUserHome ? userSoccerTactics : homeAiSoccerStrategy;
        const awayTacticsForSoccer = isUserAway ? userSoccerTactics : awayAiSoccerStrategy;

        // Use morale-adjusted rosters for mental attribute effects
        const homeSoccerState = buildSoccerTeamState(match.homeTeamId, homeTeamName, moraleAdjustedHomeRoster, homeSoccerLineup, homeTacticsForSoccer);
        const awaySoccerState = buildSoccerTeamState(match.awayTeamId, awayTeamName, moraleAdjustedAwayRoster, awaySoccerLineup, awayTacticsForSoccer);

        const soccerResult = simulateSoccerMatchV2({
          homeTeam: homeSoccerState,
          awayTeam: awaySoccerState,
        });

        homeScore = soccerResult.homeScore;
        awayScore = soccerResult.awayScore;

        // Capture penalty shootout and winner for result building
        soccerWinner = soccerResult.winner;
        if (soccerResult.penaltyShootout) {
          soccerPenaltyShootout = {
            homeScore: soccerResult.penaltyShootout.homeScore,
            awayScore: soccerResult.penaltyShootout.awayScore,
          };
        }

        // Build box score from soccer result
        boxScore = {
          ...soccerResult.boxScore,
          halfTimeScore: soccerResult.halfTimeScore,
          events: soccerResult.events,
        };

        playByPlay = soccerResult.playByPlay;

      } else {
        // Unknown sport - fallback
        throw new Error(`Unknown sport: ${match.sport}`);
      }
    } catch (err) {
      // Fallback to random if simulation fails (e.g., roster issues)
      console.warn('Simulation failed, using random result:', err);
      if (match.sport === 'baseball') {
        homeScore = Math.floor(Math.random() * 8) + 1;
        awayScore = Math.floor(Math.random() * 8) + 1;
      } else if (match.sport === 'soccer') {
        homeScore = Math.floor(Math.random() * 4);
        awayScore = Math.floor(Math.random() * 4);
      } else {
        homeScore = Math.floor(Math.random() * 40) + 80;
        awayScore = Math.floor(Math.random() * 40) + 80;
      }
      playByPlay = [`Final Score: ${homeScore} - ${awayScore}`];
    }

    // Determine winner - for soccer, use simulation's winner (accounts for penalties)
    const winner = match.sport === 'soccer' && soccerWinner
      ? soccerWinner
      : (homeScore > awayScore ? match.homeTeamId : match.awayTeamId);

    const result: MatchResult = {
      matchId,
      homeScore,
      awayScore,
      winner,
      boxScore,
      playByPlay,
      ...(soccerPenaltyShootout && { penaltyShootout: soccerPenaltyShootout }),
    };

    // Update state
    dispatch({ type: 'COMPLETE_MATCH', payload: { matchId, result } });

    // =========================================================================
    // MATCH FITNESS DRAIN
    // =========================================================================
    // Apply fatigue to all players who played in this match
    const fatigueUpdates: Array<{
      playerId: string;
      drain: number;
      matchDate: Date;
      sport: 'basketball' | 'baseball' | 'soccer';
    }> = [];

    // Combine both rosters for fatigue calculation
    const allParticipants = [...homeRoster, ...awayRoster];

    for (const player of allParticipants) {
      // Get minutes/innings played from box score
      let minutesOrInnings = 0;
      let position = player.position || 'SF'; // Default position
      let isReliefPitcher = false;

      if (match.sport === 'basketball') {
        // Basketball: Get minutes from boxScore.minutesPlayed (keyed by player name)
        const minutesPlayed = boxScore.minutesPlayed as Record<string, number> | undefined;
        minutesOrInnings = minutesPlayed?.[player.name] ?? 0;
      } else if (match.sport === 'baseball') {
        // Baseball: Get position from box score positions
        const homePositions = boxScore.homePositions as Record<string, string> | undefined;
        const awayPositions = boxScore.awayPositions as Record<string, string> | undefined;
        const baseballPosition = homePositions?.[player.id] || awayPositions?.[player.id];

        // Check if pitcher first - pitching stats are Record<string, PitchingLine>
        const homePitching = boxScore.homePitching as Record<string, { inningsPitched?: number }> | undefined;
        const awayPitching = boxScore.awayPitching as Record<string, { inningsPitched?: number }> | undefined;
        const pitcherStats = homePitching?.[player.id] || awayPitching?.[player.id];
        if (pitcherStats) {
          position = 'P';
          minutesOrInnings = pitcherStats.inningsPitched || 0;
          isReliefPitcher = minutesOrInnings < 5; // Relief if < 5 innings
        } else {
          // Non-pitcher: use defensive position from box score
          // homeBatting/awayBatting are Record<string, BattingLine>, not arrays
          const homeBatting = boxScore.homeBatting as Record<string, unknown> | undefined;
          const awayBatting = boxScore.awayBatting as Record<string, unknown> | undefined;
          const playerBatted = homeBatting?.[player.id] !== undefined || awayBatting?.[player.id] !== undefined;
          if (playerBatted) {
            minutesOrInnings = 9; // Full game
            // Use the baseball position from box score, default to DH (lowest drain)
            position = baseballPosition || 'DH';
          }
        }
      } else if (match.sport === 'soccer') {
        // Soccer: Check if player actually played by looking at player stats
        // homePlayerStats and awayPlayerStats contain minutesPlayed for each player in the lineup
        const homePlayerStats = boxScore.homePlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
        const awayPlayerStats = boxScore.awayPlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
        const playerStats = homePlayerStats?.[player.id] || awayPlayerStats?.[player.id];

        // Only players in the lineup have stats - use their minutesPlayed
        minutesOrInnings = playerStats?.minutesPlayed ?? 0;

        // Get actual position from positions mapping or default
        const positionMap = boxScore.positions as Record<string, string> | undefined;
        position = positionMap?.[player.id] || player.position || 'CM';
      }

      // Only apply drain if player actually played
      if (minutesOrInnings > 0) {
        const drain = calculateMatchDrain(
          match.sport,
          position,
          minutesOrInnings,
          player.attributes.stamina,
          isReliefPitcher
        );

        if (drain > 0) {
          fatigueUpdates.push({
            playerId: player.id,
            drain,
            matchDate: match.scheduledDate,
            sport: match.sport,
          });
        }
      }
    }

    // Dispatch fatigue updates
    if (fatigueUpdates.length > 0) {
      dispatch({ type: 'APPLY_MATCH_FATIGUE', payload: fatigueUpdates });
    }

    // Update standings - use stateRef to get latest standings after dispatch
    // This is critical for quick succession calls (like quickSimWeek)
    const newStandings = { ...stateRef.current.season.standings };
    const homeStanding = newStandings[match.homeTeamId];
    const awayStanding = newStandings[match.awayTeamId];
    const sport = match.sport as 'basketball' | 'baseball' | 'soccer';

    if (homeStanding && awayStanding) {
      if (homeScore > awayScore) {
        homeStanding.wins += 1;
        homeStanding[sport].wins += 1;
        awayStanding.losses += 1;
        awayStanding[sport].losses += 1;
      } else {
        awayStanding.wins += 1;
        awayStanding[sport].wins += 1;
        homeStanding.losses += 1;
        homeStanding[sport].losses += 1;
      }

      // Update ranks by W-L%
      const getWinPct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));
      const sorted = Object.values(newStandings).sort((a, b) => {
        const aWinPct = getWinPct(a.wins, a.losses);
        const bWinPct = getWinPct(b.wins, b.losses);
        if (bWinPct !== aWinPct) return bWinPct - aWinPct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses; // Fewer losses is better
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

    // =========================================================================
    // MORALE - RECORD MATCH RESULT
    // =========================================================================
    // Record match outcome for all participating players' morale tracking
    const homeOutcome: MatchOutcome = homeScore > awayScore ? 'win' : (homeScore < awayScore ? 'loss' : 'draw');
    const awayOutcome: MatchOutcome = awayScore > homeScore ? 'win' : (awayScore < homeScore ? 'loss' : 'draw');

    const moraleUpdates: Array<{ playerId: string; outcome: MatchOutcome }> = [];

    // Record for all players who played (same logic as fatigue - check minutes > 0)
    for (const update of fatigueUpdates) {
      // Find which team this player was on
      const isHome = homeRoster.some(p => p.id === update.playerId);
      moraleUpdates.push({
        playerId: update.playerId,
        outcome: isHome ? homeOutcome : awayOutcome,
      });
    }

    // Dispatch morale updates
    if (moraleUpdates.length > 0) {
      dispatch({ type: 'RECORD_MATCH_RESULTS', payload: moraleUpdates });
    }

    // Auto-advance week if ALL user matches for this week are now complete
    // Use stateRef to get fresh state after dispatch
    const currentWeek = stateRef.current.season.currentWeek;
    const currentMatches = stateRef.current.season.matches;

    // Get all user matches for the current week
    const userMatchesThisWeek = currentMatches.filter(
      (m) => (m.homeTeamId === 'user' || m.awayTeamId === 'user') && m.week === currentWeek
    );

    // Check for remaining scheduled matches (exclude the one we just simmed by ID)
    const remainingUserMatches = userMatchesThisWeek.filter(
      (m) => m.status === 'scheduled' && m.id !== matchId
    );

    // Simulate AI matches to keep all teams at the same pace as the user
    // This runs after EVERY user match so opponents don't have stamina advantage
    // Small delay to allow React state to update (stateRef is updated in useEffect after render)
    await new Promise(resolve => setTimeout(resolve, 50));
    await simulateAIMatchesForWeek();

    if (remainingUserMatches.length === 0) {
      // All user matches for this week are complete - advance the week
      await new Promise(resolve => setTimeout(resolve, 100));
      await advanceWeek();
    }

    return result;
  }, [state.season.matches, state.season.currentWeek, state.userTeam, state.league.teams, state.players, advanceWeek, simulateAIMatchesForWeek]);

  /**
   * Save a pre-computed match result (used by live simulation screen)
   * This saves the result WITHOUT running a new simulation
   */
  const saveMatchResult = useCallback(async (
    matchId: string,
    result: MatchResult
  ): Promise<void> => {
    // Find the match
    const match = state.season.matches.find((m) => m.id === matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // Dispatch the result
    dispatch({ type: 'COMPLETE_MATCH', payload: { matchId, result } });

    // Get rosters for fatigue calculation
    const isUserHome = match.homeTeamId === 'user';
    const isUserAway = match.awayTeamId === 'user';

    let homeRoster: Player[];
    let awayRoster: Player[];

    if (isUserHome) {
      homeRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter((p): p is Player => p !== undefined);
    } else {
      const homeTeam = state.league.teams.find((t) => t.id === match.homeTeamId);
      homeRoster = homeTeam
        ? homeTeam.rosterIds.map((id) => state.players[id]).filter((p): p is Player => p !== undefined)
        : [];
    }

    if (isUserAway) {
      awayRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter((p): p is Player => p !== undefined);
    } else {
      const awayTeam = state.league.teams.find((t) => t.id === match.awayTeamId);
      awayRoster = awayTeam
        ? awayTeam.rosterIds.map((id) => state.players[id]).filter((p): p is Player => p !== undefined)
        : [];
    }

    // Apply fatigue to players (soccer-specific for now since that's what uses this)
    const fatigueUpdates: Array<{
      playerId: string;
      drain: number;
      matchDate: Date;
      sport: 'basketball' | 'baseball' | 'soccer';
    }> = [];

    const boxScore = result.boxScore;
    const allParticipants = [...homeRoster, ...awayRoster];

    for (const player of allParticipants) {
      // Soccer: Check if player actually played by looking at player stats
      const homePlayerStats = boxScore.homePlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
      const awayPlayerStats = boxScore.awayPlayerStats as Record<string, { minutesPlayed?: number }> | undefined;
      const playerStats = homePlayerStats?.[player.id] || awayPlayerStats?.[player.id];
      const minutesPlayed = playerStats?.minutesPlayed ?? 0;

      const positionMap = boxScore.positions as Record<string, string> | undefined;
      const position = positionMap?.[player.id] || player.position || 'CM';

      if (minutesPlayed > 0) {
        const drain = calculateMatchDrain(
          match.sport,
          position,
          minutesPlayed,
          player.attributes.stamina,
          false
        );

        if (drain > 0) {
          fatigueUpdates.push({
            playerId: player.id,
            drain,
            matchDate: match.scheduledDate,
            sport: match.sport,
          });
        }
      }
    }

    if (fatigueUpdates.length > 0) {
      dispatch({ type: 'APPLY_MATCH_FATIGUE', payload: fatigueUpdates });
    }

    // Update standings
    const newStandings = { ...stateRef.current.season.standings };
    const homeStanding = newStandings[match.homeTeamId];
    const awayStanding = newStandings[match.awayTeamId];
    const sport = match.sport as 'basketball' | 'baseball' | 'soccer';

    if (homeStanding && awayStanding) {
      // Penalty shootout determines winner if draw in regulation
      const homeWins = result.homeScore > result.awayScore ||
        (result.homeScore === result.awayScore &&
          result.penaltyShootout !== undefined &&
          (result.penaltyShootout.homeScore ?? 0) > (result.penaltyShootout.awayScore ?? 0));

      if (homeWins) {
        homeStanding.wins += 1;
        homeStanding[sport].wins += 1;
        awayStanding.losses += 1;
        awayStanding[sport].losses += 1;
      } else {
        awayStanding.wins += 1;
        awayStanding[sport].wins += 1;
        homeStanding.losses += 1;
        homeStanding[sport].losses += 1;
      }

      // Recalculate ranks by W-L%
      const getWinPct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));
      const sorted = Object.values(newStandings).sort((a, b) => {
        const aWinPct = getWinPct(a.wins, a.losses);
        const bWinPct = getWinPct(b.wins, b.losses);
        if (bWinPct !== aWinPct) return bWinPct - aWinPct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses; // Fewer losses is better
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

    // Auto-advance week if all user matches for this week are complete
    const currentWeek = stateRef.current.season.currentWeek;
    const currentMatches = stateRef.current.season.matches;

    const userMatchesThisWeek = currentMatches.filter(
      (m) => (m.homeTeamId === 'user' || m.awayTeamId === 'user') && m.week === currentWeek
    );

    const remainingUserMatches = userMatchesThisWeek.filter(
      (m) => m.status === 'scheduled' && m.id !== matchId
    );

    // Simulate AI matches to keep all teams at the same pace as the user
    // This runs after EVERY user match so opponents don't have stamina advantage
    // Small delay to allow React state to update (stateRef is updated in useEffect after render)
    await new Promise(resolve => setTimeout(resolve, 50));
    await simulateAIMatchesForWeek();

    if (remainingUserMatches.length === 0) {
      // All user matches for this week are complete - advance the week
      await new Promise(resolve => setTimeout(resolve, 100));
      await advanceWeek();
    }
  }, [state.season.matches, state.userTeam, state.league.teams, state.players, advanceWeek, simulateAIMatchesForWeek]);

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

  const setTactics = useCallback((tactics: TacticalSettings) => {
    dispatch({ type: 'SET_TACTICS', payload: tactics });
  }, []);

  const setBaseballStrategy = useCallback((strategy: BaseballGameStrategy) => {
    dispatch({ type: 'SET_BASEBALL_STRATEGY', payload: strategy });
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
      scope: 'team',
      teamId: 'user',
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
      scope: 'team',
      teamId: 'user',
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
  }, []);

  const signProspectToAcademy = useCallback((prospect: AcademyProspect) => {
    // Sign prospect to academy and deduct $100k signing cost from budget
    dispatch({ type: 'SIGN_PROSPECT_TO_ACADEMY', payload: { prospect, signingCost: YEARLY_PROSPECT_COST } });
  }, []);

  const updateYouthScoutingReport = useCallback((reportId: string, report: YouthScoutingReport) => {
    dispatch({ type: 'UPDATE_YOUTH_SCOUTING_REPORT', payload: { reportId, report } });
  }, []);

  const setYouthScoutSportFocus = useCallback((focus: 'basketball' | 'baseball' | 'soccer' | 'balanced') => {
    dispatch({ type: 'SET_SCOUT_SPORT_FOCUS', payload: { focus } });
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
      scope: 'team',
      teamId: 'user',
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
  // SHORTLIST & TRANSFER LIST ACTIONS
  // =========================================================================

  const addToShortlist = useCallback((playerId: string) => {
    dispatch({ type: 'ADD_TO_SHORTLIST', payload: { playerId } });
  }, []);

  const removeFromShortlist = useCallback((playerId: string) => {
    dispatch({ type: 'REMOVE_FROM_SHORTLIST', payload: { playerId } });
  }, []);

  const getShortlistedPlayers = useCallback((): Player[] => {
    const ids = state.userTeam.shortlistedPlayerIds || [];
    return ids
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined);
  }, [state.userTeam.shortlistedPlayerIds, state.players]);

  const addToTransferList = useCallback((playerId: string, askingPrice: number) => {
    dispatch({ type: 'ADD_TO_TRANSFER_LIST', payload: { playerId, askingPrice } });
  }, []);

  const removeFromTransferList = useCallback((playerId: string) => {
    dispatch({ type: 'REMOVE_FROM_TRANSFER_LIST', payload: { playerId } });
  }, []);

  const getTransferListedPlayers = useCallback((): Player[] => {
    const ids = state.userTeam.transferListPlayerIds || [];
    return ids
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined);
  }, [state.userTeam.transferListPlayerIds, state.players]);

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
        type: 'contract',
        priority: 'important',
        title: 'Contract Signed!',
        message: `${player?.name || 'A new player'} has signed a ${negotiation.currentOffer.contractLength}-year contract worth ${(negotiation.currentOffer.salary / 1000000).toFixed(1)}M/year.`,
        timestamp: new Date(),
        read: false,
        relatedEntityId: negotiation.playerId,
        scope: 'team',
        teamId: 'user',
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

  const confirmBudgetAllocation = useCallback(() => {
    dispatch({ type: 'CONFIRM_BUDGET_ALLOCATION' });
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

  const getRecentEvents = useCallback((count: number = 10, scope?: 'team' | 'division' | 'global'): NewsItem[] => {
    let events = state.events;
    if (scope) {
      events = events.filter(e => e.scope === scope);
    }
    return events.slice(0, count);
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
      saveMatchResult,
      quickSimWeek,
      getNextMatch,
      getSimulationMatch,

      // Roster Actions
      setLineup,
      setTactics,
      setBaseballStrategy,
      releasePlayer,
      signPlayer,
      signProspectToAcademy,
      updateYouthScoutingReport,
      setYouthScoutSportFocus,
      setTrainingFocus,
      getUserRoster,
      getPlayer,

      // Market Actions
      makeTransferOffer,
      respondToOffer,
      signFreeAgent,
      getTransferTargets,
      getFreeAgents,
      addToShortlist,
      removeFromShortlist,
      getShortlistedPlayers,
      addToTransferList,
      removeFromTransferList,
      getTransferListedPlayers,

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
      confirmBudgetAllocation,

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
      saveMatchResult,
      quickSimWeek,
      getNextMatch,
      getSimulationMatch,
      setLineup,
      setTactics,
      setBaseballStrategy,
      releasePlayer,
      signPlayer,
      signProspectToAcademy,
      updateYouthScoutingReport,
      setYouthScoutSportFocus,
      setTrainingFocus,
      getUserRoster,
      getPlayer,
      makeTransferOffer,
      respondToOffer,
      signFreeAgent,
      getTransferTargets,
      getFreeAgents,
      addToShortlist,
      removeFromShortlist,
      getShortlistedPlayers,
      addToTransferList,
      removeFromTransferList,
      getTransferListedPlayers,
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
      confirmBudgetAllocation,
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
