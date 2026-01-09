/**
 * Match Simulation Screen
 *
 * Shows live match simulation with real-time event streaming:
 * - Score display
 * - Half/period/inning indicator
 * - Play-by-play feed from real simulation
 * - Sim controls (pause, speed, skip)
 * - Supports soccer, basketball, and baseball
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useGame } from '../context/GameContext';
import { simulateSoccerMatchV2 } from '../../simulation/soccer/engine/matchEngine';
import { simulatePenaltyShootout } from '../../simulation/soccer/game/matchSimulation';
import type { SoccerEvent, SoccerMatchResult, SoccerTeamState, SoccerPosition } from '../../simulation/soccer/types';
import { FORMATION_POSITIONS } from '../../simulation/soccer/constants';
import { GameSimulator, type GameResult as BasketballGameResult } from '../../simulation';
import { simulateGame as simulateBaseballGame, createTeamGameState, type GameOutput as BaseballGameOutput } from '../../simulation/baseball/game/gameSimulation';
import type { FieldingPosition } from '../../simulation/baseball/systems/fielding';
import type { MatchResult, TacticalSettings } from '../../data/types';

interface PlayByPlayItem {
  id: string;
  minute: number;  // For soccer/basketball. For baseball, this is the inning number
  description: string;
  type: 'goal' | 'shot' | 'foul' | 'card' | 'substitution' | 'half' | 'score' | 'out' | 'hit' | 'walk' | 'strikeout' | 'other';
  team?: 'home' | 'away';
}

// Soccer strategy type
interface SoccerStrategy {
  attackingStyle: 'possession' | 'direct' | 'counter';
  pressing: 'high' | 'balanced' | 'low';
  width: 'wide' | 'balanced' | 'tight';
}

const DEFAULT_SOCCER_STRATEGY: SoccerStrategy = {
  attackingStyle: 'direct',
  pressing: 'balanced',
  width: 'balanced',
};

interface MatchSimulationScreenProps {
  matchId: string;
  onComplete?: () => void;
  onBack?: () => void;
  /** User's soccer strategy for the match */
  soccerStrategy?: SoccerStrategy;
}

/**
 * Map soccer event type to display type
 */
function mapEventType(type: SoccerEvent['type']): PlayByPlayItem['type'] {
  switch (type) {
    case 'goal':
    case 'penalty_scored':
      return 'goal';
    case 'shot_saved':
    case 'shot_missed':
    case 'shot_blocked':
    case 'penalty_saved':
      return 'shot';
    case 'foul':
    case 'corner':
    case 'offside':
      return 'foul';
    case 'yellow_card':
    case 'red_card':
      return 'card';
    case 'substitution':
      return 'substitution';
    case 'half_time':
    case 'full_time':
      return 'half';
    default:
      return 'other';
  }
}

export function MatchSimulationScreen({
  matchId,
  onComplete,
  soccerStrategy = DEFAULT_SOCCER_STRATEGY,
}: MatchSimulationScreenProps) {
  const colors = useColors();
  const { state, saveMatchResult } = useGame();
  const scrollRef = useRef<FlatList>(null);

  // Find the match
  const match = state.season.matches.find((m) => m.id === matchId);
  const userTeam = state.userTeam;

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [currentMinute, setCurrentMinute] = useState(0);
  const [period, setPeriod] = useState(1);  // Half for soccer, quarter for basketball, inning for baseball
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [plays, setPlays] = useState<PlayByPlayItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Store the full simulation results (one per sport type)
  const soccerResultRef = useRef<SoccerMatchResult | null>(null);
  const basketballResultRef = useRef<BasketballGameResult | null>(null);
  const baseballResultRef = useRef<BaseballGameOutput | null>(null);
  const currentEventIndexRef = useRef(0);

  // Store soccer team states for penalty shootout (V2 engine doesn't include it)
  const soccerHomeTeamRef = useRef<SoccerTeamState | null>(null);
  const soccerAwayTeamRef = useRef<SoccerTeamState | null>(null);

  // For basketball, we parse playByPlayText into individual entries
  const basketballPlaysRef = useRef<string[]>([]);
  // For baseball, use the playByPlay array directly
  const baseballPlaysRef = useRef<string[]>([]);
  // Track current baseball half-inning ('top' or 'bottom') for score attribution
  const baseballCurrentHalfRef = useRef<'top' | 'bottom'>('top');

  // Get team names from league data
  const getTeamName = (teamId: string | undefined): string => {
    if (!teamId) return 'Unknown';
    if (teamId === userTeam.id) return userTeam.name;
    const aiTeam = state.league.teams.find(t => t.id === teamId);
    return aiTeam?.name || teamId;
  };

  const homeTeamName = getTeamName(match?.homeTeamId);
  const awayTeamName = getTeamName(match?.awayTeamId);

  // Run the simulation once on mount
  useEffect(() => {
    console.log('[MatchSimulationScreen] Match:', match?.id, 'Sport:', match?.sport);

    if (!match) {
      setIsLoading(false);
      return;
    }

    // Get rosters - convert rosterIds to Player objects
    const isUserHome = match.homeTeamId === userTeam.id;
    const opponentTeamId = isUserHome ? match.awayTeamId : match.homeTeamId;

    // Get user team roster
    const userRoster = userTeam.rosterIds
      .map(id => state.players[id])
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // Get opponent team roster from league data
    const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
    const opponentRoster = opponentTeam
      ? opponentTeam.rosterIds
          .map(id => state.players[id])
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
      : [];

    const homeRoster = isUserHome ? userRoster : opponentRoster;
    const awayRoster = isUserHome ? opponentRoster : userRoster;

    try {
      if (match.sport === 'soccer') {
        // --- SOCCER SIMULATION ---
        const createSoccerTeamState = (
          roster: typeof userRoster,
          teamId: string,
          teamName: string,
          isUser: boolean
        ): SoccerTeamState => {
          const lineup = roster.slice(0, 11);
          const bench = roster.slice(11, 18);
          const formation = '4-4-2';
          const formationPositions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2'];

          const positions: Record<string, SoccerPosition> = {};
          lineup.forEach((player: typeof roster[0], index: number) => {
            const posArray = formationPositions || [];
            positions[player.id] = (posArray[index] || 'CM') as SoccerPosition;
          });

          // Get AI team's soccer strategy from season state, or use defaults
          const aiTeamSoccerStrategy = state.season.aiTeamStrategies[teamId]?.soccer;
          const aiTactics = aiTeamSoccerStrategy ? {
            attackingStyle: aiTeamSoccerStrategy.attackingStyle,
            pressing: aiTeamSoccerStrategy.pressing,
            width: aiTeamSoccerStrategy.width,
          } : {
            attackingStyle: 'direct' as const,
            pressing: 'balanced' as const,
            width: 'balanced' as const,
          };

          return {
            teamId,
            teamName,
            lineup,
            bench,
            formation,
            positions,
            // Use user's tactical settings for user team, AI's persistent strategy for AI teams
            tactics: isUser ? {
              attackingStyle: soccerStrategy.attackingStyle,
              pressing: soccerStrategy.pressing,
              width: soccerStrategy.width,
            } : aiTactics,
            isUserTeam: isUser,
          };
        };

        const homeTeam = createSoccerTeamState(homeRoster, match.homeTeamId, homeTeamName, isUserHome);
        const awayTeam = createSoccerTeamState(awayRoster, match.awayTeamId, awayTeamName, !isUserHome);

        // Store team states for penalty shootout
        soccerHomeTeamRef.current = homeTeam;
        soccerAwayTeamRef.current = awayTeam;

        console.log('[MatchSimulationScreen] Running soccer simulation...');
        const result = simulateSoccerMatchV2({ homeTeam, awayTeam });
        console.log('[MatchSimulationScreen] Simulation complete, events:', result.events.length);

        // If scores are tied, run penalty shootout (V2 engine doesn't include it)
        if (result.homeScore === result.awayScore) {
          console.log('[MatchSimulationScreen] Match tied, running penalty shootout...');
          const shootoutEvents: SoccerEvent[] = [];
          const penaltyResult = simulatePenaltyShootout(homeTeam, awayTeam, shootoutEvents);
          console.log('[MatchSimulationScreen] Penalty shootout result:', penaltyResult.homeScore, '-', penaltyResult.awayScore);

          // Add shootout events to the main events list
          const eventsWithShootout = [...result.events, ...shootoutEvents];

          // Update result with penalty shootout
          soccerResultRef.current = {
            ...result,
            events: eventsWithShootout,
            penaltyShootout: penaltyResult,
            winner: penaltyResult.winner,
          };
        } else {
          soccerResultRef.current = result;
        }

      } else if (match.sport === 'basketball') {
        // --- BASKETBALL SIMULATION ---
        const defaultTactical: TacticalSettings = {
          pace: 'standard',
          manDefensePct: 50,
          scoringOptions: [undefined, undefined, undefined],
          minutesAllotment: {},
          reboundingStrategy: 'standard',
          closers: [],
          timeoutStrategy: 'standard',
        };

        // Helper to convert AI basketball strategy to TacticalSettings
        const getTeamTactics = (teamId: string, isUserTeam: boolean): TacticalSettings => {
          if (isUserTeam) {
            // Use user's tactics from global state
            return state.userTeam.tactics;
          }
          // Get AI team's basketball strategy
          const aiStrategy = state.season.aiTeamStrategies[teamId]?.basketball;
          if (!aiStrategy) {
            return defaultTactical;
          }
          // Convert defense type to manDefensePct
          const defenseToManPct = (defense: 'man' | 'mixed' | 'zone'): number => {
            switch (defense) {
              case 'man': return 90;
              case 'zone': return 10;
              default: return 50;
            }
          };
          return {
            ...defaultTactical,
            pace: aiStrategy.pace,
            manDefensePct: defenseToManPct(aiStrategy.defense),
            reboundingStrategy: aiStrategy.rebounding,
          };
        };

        const homeTactics = getTeamTactics(match.homeTeamId, isUserHome);
        const awayTactics = getTeamTactics(match.awayTeamId, !isUserHome);

        console.log('[MatchSimulationScreen] Running basketball simulation...');
        const simulator = new GameSimulator(
          homeRoster,
          awayRoster,
          homeTactics,
          awayTactics,
          homeTeamName,
          awayTeamName
        );
        const result = simulator.simulateGame();
        console.log('[MatchSimulationScreen] Basketball simulation complete');
        basketballResultRef.current = result;

        // Parse playByPlayText into individual lines for streaming
        // Filter out empty lines and header/separator lines
        const lines = result.playByPlayText.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 &&
                 !trimmed.startsWith('=') &&
                 !trimmed.startsWith('-') &&
                 !trimmed.includes('BOX SCORE') &&
                 !trimmed.includes('Player') &&
                 trimmed.length < 200;  // Skip very long lines (box score tables)
        });
        basketballPlaysRef.current = lines;

      } else if (match.sport === 'baseball') {
        // --- BASEBALL SIMULATION ---
        // Baseball needs at least 10 players (8 fielders + pitcher + DH)
        if (homeRoster.length < 10 || awayRoster.length < 10) {
          console.error('[MatchSimulationScreen] Not enough players for baseball (need 10+)');
          setIsLoading(false);
          return;
        }

        // Get user's baseball lineup configuration
        const userBaseballLineup = state.userTeam.lineup.baseballLineup;

        // Create defensive positions from user's lineup config (for user team)
        // For AI teams, fall back to roster order
        const createDefenseFromConfig = (
          roster: typeof userRoster,
          lineupConfig: typeof userBaseballLineup | null,
          startingPitcher: typeof userRoster[0]
        ): Record<FieldingPosition, typeof userRoster[0]> => {
          const defense: Record<string, typeof userRoster[0]> = {};

          if (lineupConfig && Object.keys(lineupConfig.positions).length > 0) {
            // Use configured positions
            for (const [playerId, position] of Object.entries(lineupConfig.positions)) {
              const player = roster.find(p => p.id === playerId);
              if (player && position !== 'DH') {
                defense[position] = player;
              }
            }
          } else {
            // Fall back to roster order: 0=C, 1=1B, 2=2B, 3=SS, 4=3B, 5=LF, 6=CF, 7=RF
            const positions: FieldingPosition[] = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
            positions.forEach((pos, idx) => {
              if (roster[idx]) {
                defense[pos] = roster[idx];
              }
            });
          }

          // Always set pitcher in defense
          defense['P'] = startingPitcher;
          return defense as Record<FieldingPosition, typeof userRoster[0]>;
        };

        // Create batting lineup from config or fall back to roster order
        const createLineupFromConfig = (
          roster: typeof userRoster,
          lineupConfig: typeof userBaseballLineup | null,
          startingPitcherId: string
        ): typeof userRoster => {
          if (lineupConfig && lineupConfig.battingOrder.length >= 9) {
            // Use configured batting order (excludes pitcher due to DH rule)
            return lineupConfig.battingOrder
              .filter(id => id !== startingPitcherId) // Ensure pitcher not in lineup
              .slice(0, 9)
              .map(id => roster.find(p => p.id === id))
              .filter((p): p is NonNullable<typeof p> => p !== undefined);
          }
          // Fall back: 8 fielders (indices 0-7) + DH (index 9), excluding pitcher
          const fielders = roster.slice(0, 8);
          const dh = roster[9];
          return dh ? [...fielders, dh] : fielders.slice(0, 9);
        };

        // Get bullpen from config
        // IMPORTANT: Only use explicitly configured bullpen players for user team
        // Reserve players (not on bench) should NEVER be available to play
        const getBullpen = (
          roster: typeof userRoster,
          lineupConfig: typeof userBaseballLineup | null,
          benchIds: string[] | null // User team bench, null for AI teams
        ): typeof userRoster => {
          if (lineupConfig && lineupConfig.bullpen) {
            const bullpenIds = [
              ...lineupConfig.bullpen.longRelievers,
              ...lineupConfig.bullpen.shortRelievers,
              lineupConfig.bullpen.closer,
            ].filter(id => id); // Filter out empty strings

            if (bullpenIds.length > 0) {
              return bullpenIds
                .map(id => roster.find(p => p.id === id))
                .filter((p): p is NonNullable<typeof p> => p !== undefined);
            }
          }

          // Fallback for AI teams only - use roster indices 10-13
          // For user teams with no configured bullpen, we shouldn't silently grab reserves
          if (benchIds === null) {
            // AI team - use fallback
            return roster.slice(10, 14).filter((p): p is NonNullable<typeof p> => p !== undefined);
          }

          // User team with no configured bullpen - only use players on the bench
          // This ensures reserve players are never used
          const benchSet = new Set(benchIds);
          const startingPitcher = lineupConfig?.startingPitcher;
          const battingOrderSet = new Set(lineupConfig?.battingOrder.filter(id => id) || []);

          return roster
            .filter(p =>
              benchSet.has(p.id) && // Must be on bench (not reserves)
              p.id !== startingPitcher && // Not the starting pitcher
              !battingOrderSet.has(p.id) // Not in batting order
            )
            .slice(0, 5); // Limit to 5 relievers
        };

        // Get starting pitcher from config or fall back to roster[8]
        const getStartingPitcher = (
          roster: typeof userRoster,
          lineupConfig: typeof userBaseballLineup | null
        ): typeof userRoster[0] => {
          if (lineupConfig && lineupConfig.startingPitcher) {
            const pitcher = roster.find(p => p.id === lineupConfig.startingPitcher);
            if (pitcher) return pitcher;
          }
          // Fall back to roster index 8
          return roster[8]!;
        };

        // Determine which team is user's and apply their lineup config
        const userLineupConfig = isUserHome ? userBaseballLineup : null;
        const opponentLineupConfig = isUserHome ? null : userBaseballLineup;

        const homeStartingPitcher = getStartingPitcher(homeRoster, isUserHome ? userLineupConfig : null);
        const awayStartingPitcher = getStartingPitcher(awayRoster, !isUserHome ? opponentLineupConfig : null);

        console.log('[MatchSimulationScreen] Running baseball simulation...');
        console.log('[MatchSimulationScreen] Home starting pitcher:', homeStartingPitcher?.name);
        console.log('[MatchSimulationScreen] Away starting pitcher:', awayStartingPitcher?.name);

        // Get the user's bench array (for filtering out reserve players)
        const userBench = state.userTeam.lineup.bench;

        const homeTeamState = createTeamGameState(
          match.homeTeamId,
          homeTeamName,
          createLineupFromConfig(homeRoster, isUserHome ? userLineupConfig : null, homeStartingPitcher.id),
          homeStartingPitcher,
          getBullpen(homeRoster, isUserHome ? userLineupConfig : null, isUserHome ? userBench : null),
          createDefenseFromConfig(homeRoster, isUserHome ? userLineupConfig : null, homeStartingPitcher)
        );
        const awayTeamState = createTeamGameState(
          match.awayTeamId,
          awayTeamName,
          createLineupFromConfig(awayRoster, !isUserHome ? opponentLineupConfig : null, awayStartingPitcher.id),
          awayStartingPitcher,
          getBullpen(awayRoster, !isUserHome ? opponentLineupConfig : null, !isUserHome ? userBench : null),
          createDefenseFromConfig(awayRoster, !isUserHome ? opponentLineupConfig : null, awayStartingPitcher)
        );

        // Get baseball strategies - user's from global state, AI's from persistent strategies
        const getBaseballStrategy = (teamId: string, isUserTeam: boolean) => {
          if (isUserTeam) {
            // TODO: Add user baseball strategy to state when implemented
            return undefined; // Will use default
          }
          return state.season.aiTeamStrategies[teamId]?.baseball;
        };

        const result = simulateBaseballGame({
          homeTeam: homeTeamState,
          awayTeam: awayTeamState,
          homeStrategy: getBaseballStrategy(match.homeTeamId, isUserHome),
          awayStrategy: getBaseballStrategy(match.awayTeamId, !isUserHome),
        });
        console.log('[MatchSimulationScreen] Baseball simulation complete, plays:', result.result.playByPlay.length);
        baseballResultRef.current = result;
        baseballPlaysRef.current = result.result.playByPlay;

      } else {
        console.log('[MatchSimulationScreen] Unknown sport:', match.sport);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsRunning(true);
    } catch (error) {
      console.error('[MatchSimulationScreen] Simulation error:', error);
      setIsLoading(false);
    }
  }, [match, userTeam]);

  // Stream events based on speed - handles all sports
  useEffect(() => {
    if (!isRunning || isComplete) return;

    const sport = match?.sport;
    // Speed settings: slow = readable pace, normal = moderate, fast = quick
    const speedMs = speed === 'slow' ? 4000 : speed === 'fast' ? 1000 : 2000;

    const interval = setInterval(() => {
      const currentIndex = currentEventIndexRef.current;

      if (sport === 'soccer' && soccerResultRef.current) {
        // --- SOCCER STREAMING ---
        const events = soccerResultRef.current.events;

        if (currentIndex >= events.length) {
          setIsComplete(true);
          setIsRunning(false);
          return;
        }

        const event = events[currentIndex];
        if (!event) return;

        setCurrentMinute(event.minute);
        if (event.minute > 45 && period === 1) {
          setPeriod(2);
        }

        if (event.type === 'goal') {
          if (event.team === 'home') {
            setHomeScore((s) => s + 1);
          } else {
            setAwayScore((s) => s + 1);
          }
        }

        const play: PlayByPlayItem = {
          id: `${currentIndex}`,
          minute: event.minute,
          description: event.description,
          type: mapEventType(event.type),
          team: event.team,
        };

        setPlays((prev) => [play, ...prev]);

      } else if (sport === 'basketball' && basketballResultRef.current) {
        // --- BASKETBALL STREAMING ---
        const lines = basketballPlaysRef.current;

        if (currentIndex >= lines.length) {
          // All lines shown - set final scores
          setHomeScore(basketballResultRef.current.homeScore);
          setAwayScore(basketballResultRef.current.awayScore);
          setIsComplete(true);
          setIsRunning(false);
          return;
        }

        const line = lines[currentIndex];
        if (!line) return;

        // Try to detect quarter from line content
        const quarterMatch = line.match(/Quarter (\d)/i) || line.match(/Q(\d)/i) || line.match(/Overtime (\d)/i);
        if (quarterMatch) {
          const qNum = parseInt(quarterMatch[1] || '1', 10);
          setPeriod(qNum);
        }

        // Try to detect time from line (format like "11:45" or "Q1 11:45")
        const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1] || '0', 10);
          // Convert to elapsed time in quarter (12 - remaining)
          const elapsedInQ = 12 - mins;
          const totalMins = (period - 1) * 12 + elapsedInQ;
          setCurrentMinute(totalMins);
        }

        // Try to extract scores from lines that show score updates
        const scoreMatch = line.match(/(\d+)\s*-\s*(\d+)/);
        if (scoreMatch) {
          setHomeScore(parseInt(scoreMatch[1] || '0', 10));
          setAwayScore(parseInt(scoreMatch[2] || '0', 10));
        }

        // Determine play type from content
        let playType: PlayByPlayItem['type'] = 'other';
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('scores') || lowerLine.includes('makes') || lowerLine.includes('3-pointer')) {
          playType = 'score';
        } else if (lowerLine.includes('miss') || lowerLine.includes('blocked')) {
          playType = 'shot';
        } else if (lowerLine.includes('foul')) {
          playType = 'foul';
        } else if (lowerLine.includes('substitution') || lowerLine.includes('enters')) {
          playType = 'substitution';
        }

        const play: PlayByPlayItem = {
          id: `${currentIndex}`,
          minute: currentMinute,
          description: line,
          type: playType,
        };

        setPlays((prev) => [play, ...prev]);

      } else if (sport === 'baseball' && baseballResultRef.current) {
        // --- BASEBALL STREAMING ---
        const lines = baseballPlaysRef.current;
        const boxScore = baseballResultRef.current.result.boxScore;

        if (currentIndex >= lines.length) {
          // All plays shown - set final scores
          setHomeScore(baseballResultRef.current.result.homeScore);
          setAwayScore(baseballResultRef.current.result.awayScore);
          setIsComplete(true);
          setIsRunning(false);
          return;
        }

        const line = lines[currentIndex];
        if (!line) return;

        const lowerLine = line.toLowerCase();

        // Track half-inning markers for score attribution
        const topMatch = line.match(/Top of (?:the )?(\d+)/i);
        const bottomMatch = line.match(/Bottom of (?:the )?(\d+)/i);

        if (topMatch) {
          const inningNum = parseInt(topMatch[1] || '1', 10);
          setPeriod(inningNum);
          baseballCurrentHalfRef.current = 'top';
          // At start of top of inning N, set scores based on completed innings
          const awayRunsThrough = boxScore.awayRunsByInning.slice(0, inningNum - 1).reduce((a, b) => a + b, 0);
          const homeRunsThrough = boxScore.homeRunsByInning.slice(0, inningNum - 1).reduce((a, b) => a + b, 0);
          setAwayScore(awayRunsThrough);
          setHomeScore(homeRunsThrough);
        } else if (bottomMatch) {
          const inningNum = parseInt(bottomMatch[1] || '1', 10);
          setPeriod(inningNum);
          baseballCurrentHalfRef.current = 'bottom';
          // At start of bottom of inning N, away has completed this inning's top
          const awayRunsThrough = boxScore.awayRunsByInning.slice(0, inningNum).reduce((a, b) => a + b, 0);
          const homeRunsThrough = boxScore.homeRunsByInning.slice(0, inningNum - 1).reduce((a, b) => a + b, 0);
          setAwayScore(awayRunsThrough);
          setHomeScore(homeRunsThrough);
        } else if (lowerLine.includes('scores') || lowerLine.includes('run scores') || lowerLine.includes('runs score')) {
          // Immediate score update when runs are scored
          // Parse how many runs scored
          let runsOnPlay = 1;
          const multiRunMatch = line.match(/(\d+) runs? score/i);
          if (multiRunMatch) {
            runsOnPlay = parseInt(multiRunMatch[1] || '1', 10);
          }

          // Attribute runs based on current half-inning
          if (baseballCurrentHalfRef.current === 'top') {
            setAwayScore(prev => prev + runsOnPlay);
          } else {
            setHomeScore(prev => prev + runsOnPlay);
          }
        } else if (lowerLine.includes('home run')) {
          // Home runs always score at least the batter
          // Check for multi-run HR indicators
          let runsOnPlay = 1;
          if (lowerLine.includes('grand slam') || line.match(/4 runs? score/i)) {
            runsOnPlay = 4;
          } else if (line.match(/3 runs? score/i)) {
            runsOnPlay = 3;
          } else if (line.match(/2 runs? score/i)) {
            runsOnPlay = 2;
          }

          if (baseballCurrentHalfRef.current === 'top') {
            setAwayScore(prev => prev + runsOnPlay);
          } else {
            setHomeScore(prev => prev + runsOnPlay);
          }
        }

        // Determine play type for display styling
        let playType: PlayByPlayItem['type'] = 'other';
        if (lowerLine.includes('home run') || lowerLine.includes('scores') || lowerLine.includes('runs')) {
          playType = 'score';
        } else if (lowerLine.includes('out') || lowerLine.includes('flies out') || lowerLine.includes('grounds out')) {
          playType = 'out';
        } else if (lowerLine.includes('single') || lowerLine.includes('double') || lowerLine.includes('triple')) {
          playType = 'hit';
        } else if (lowerLine.includes('walk') || lowerLine.includes('base on balls')) {
          playType = 'walk';
        } else if (lowerLine.includes('strikeout') || lowerLine.includes('strikes out')) {
          playType = 'strikeout';
        }

        const play: PlayByPlayItem = {
          id: `${currentIndex}`,
          minute: period,  // Use inning as "minute" for baseball
          description: line,
          type: playType,
        };

        setPlays((prev) => [play, ...prev]);

      } else {
        // No valid result
        setIsComplete(true);
        setIsRunning(false);
        return;
      }

      currentEventIndexRef.current++;
    }, speedMs);

    return () => clearInterval(interval);
  }, [isRunning, isComplete, speed, period, match?.sport, currentMinute]);

  // Handle skip - show all remaining events instantly (handles all sports)
  const handleSkip = useCallback(() => {
    const sport = match?.sport;

    if (sport === 'soccer' && soccerResultRef.current) {
      const result = soccerResultRef.current;
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setCurrentMinute(90);
      setPeriod(2);
      setIsComplete(true);
      setIsRunning(false);

      const allPlays: PlayByPlayItem[] = result.events.map((event, index) => ({
        id: `${index}`,
        minute: event.minute,
        description: event.description,
        type: mapEventType(event.type),
        team: event.team,
      })).reverse();
      setPlays(allPlays);

    } else if (sport === 'basketball' && basketballResultRef.current) {
      const result = basketballResultRef.current;
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setCurrentMinute(48);
      setPeriod(4);
      setIsComplete(true);
      setIsRunning(false);

      const allPlays: PlayByPlayItem[] = basketballPlaysRef.current.map((line, index) => ({
        id: `${index}`,
        minute: 0,
        description: line,
        type: 'other' as const,
      })).reverse();
      setPlays(allPlays);

    } else if (sport === 'baseball' && baseballResultRef.current) {
      const result = baseballResultRef.current.result;
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setPeriod(result.innings);
      setIsComplete(true);
      setIsRunning(false);

      const allPlays: PlayByPlayItem[] = result.playByPlay.map((line, index) => ({
        id: `${index}`,
        minute: 0,
        description: line,
        type: 'other' as const,
      })).reverse();
      setPlays(allPlays);
    }
  }, [match?.sport]);

  // Handle finishing and saving result (handles all sports)
  const handleFinish = useCallback(() => {
    if (!match) {
      onComplete?.();
      return;
    }

    let matchResult: MatchResult;
    const sport = match.sport;

    if (sport === 'soccer' && soccerResultRef.current) {
      const soccerResult = soccerResultRef.current;

      // Determine winner: use penalty shootout winner if available, otherwise check scores
      let winner: string;
      if (soccerResult.penaltyShootout) {
        winner = soccerResult.penaltyShootout.winner;
      } else if (soccerResult.homeScore > soccerResult.awayScore) {
        winner = match.homeTeamId;
      } else if (soccerResult.awayScore > soccerResult.homeScore) {
        winner = match.awayTeamId;
      } else {
        // This shouldn't happen (draws should have penalty shootout), but handle gracefully
        winner = 'draw';
      }

      matchResult = {
        matchId,
        homeScore: soccerResult.homeScore,
        awayScore: soccerResult.awayScore,
        winner,
        boxScore: {
          ...soccerResult.boxScore,
          halfTimeScore: soccerResult.halfTimeScore,
          events: soccerResult.events,
        },
        playByPlay: soccerResult.playByPlay,
        // Add penalty shootout at top level (not inside boxScore)
        penaltyShootout: soccerResult.penaltyShootout ? {
          homeScore: soccerResult.penaltyShootout.homeScore,
          awayScore: soccerResult.penaltyShootout.awayScore,
        } : undefined,
      };

    } else if (sport === 'basketball' && basketballResultRef.current) {
      const bbResult = basketballResultRef.current;
      const winner = bbResult.homeScore > bbResult.awayScore
        ? match.homeTeamId
        : match.awayTeamId;

      // Extract player stats from gameStatistics for the boxScore
      const gameStats = bbResult.gameStatistics;

      matchResult = {
        matchId,
        homeScore: bbResult.homeScore,
        awayScore: bbResult.awayScore,
        winner,
        boxScore: {
          quarterScores: bbResult.quarterScores,
          homePlayerStats: gameStats.homePlayerStats,
          awayPlayerStats: gameStats.awayPlayerStats,
          minutesPlayed: bbResult.minutesPlayed,
          homeStats: gameStats.homeStats,
          awayStats: gameStats.awayStats,
        },
        playByPlay: basketballPlaysRef.current,
      };

    } else if (sport === 'baseball' && baseballResultRef.current) {
      const baseResult = baseballResultRef.current.result;
      const winner = baseResult.homeScore > baseResult.awayScore
        ? match.homeTeamId
        : match.awayTeamId;

      matchResult = {
        matchId,
        homeScore: baseResult.homeScore,
        awayScore: baseResult.awayScore,
        winner,
        boxScore: baseResult.boxScore,
        playByPlay: baseResult.playByPlay,
      };

    } else {
      onComplete?.();
      return;
    }

    // Save the pre-computed result (no re-simulation)
    saveMatchResult(matchId, matchResult).then(() => {
      onComplete?.();
    }).catch((error: Error) => {
      console.error('Error saving match result:', error);
      onComplete?.();
    });
  }, [match, matchId, saveMatchResult, onComplete]);

  const getPlayColor = (type: PlayByPlayItem['type']) => {
    switch (type) {
      case 'goal':
      case 'score':
      case 'hit':
        return colors.success;
      case 'card':
      case 'strikeout':
      case 'out':
        return colors.error;
      case 'substitution':
      case 'walk':
        return colors.primary;
      case 'half':
        return colors.warning;
      case 'shot':
        return colors.info || colors.primary;
      default:
        return colors.textMuted;
    }
  };

  // Get period label based on sport
  const getPeriodLabel = () => {
    const sport = match?.sport;
    if (sport === 'soccer') {
      return period === 1 ? '1st Half' : '2nd Half';
    } else if (sport === 'basketball') {
      if (period <= 4) return `Q${period}`;
      return `OT${period - 4}`;
    } else if (sport === 'baseball') {
      return `Inning ${period}`;
    }
    return `Period ${period}`;
  };

  // Get time display based on sport
  const getTimeDisplay = () => {
    const sport = match?.sport;
    if (sport === 'soccer') {
      return `${currentMinute}'`;
    } else if (sport === 'basketball') {
      // Show game time format
      const quarterMins = 12;
      const elapsedInQuarter = currentMinute - (period - 1) * quarterMins;
      const remaining = quarterMins - elapsedInQuarter;
      return `${Math.max(0, remaining)}:00`;
    } else if (sport === 'baseball') {
      return ''; // Baseball doesn't show time, just inning
    }
    return `${currentMinute}`;
  };

  const renderPlay = ({ item }: { item: PlayByPlayItem }) => {
    // Format time based on sport
    const timeLabel = match?.sport === 'baseball'
      ? '' // Baseball doesn't show time per play
      : match?.sport === 'basketball'
        ? '' // Basketball shows time in the description itself
        : `${item.minute}'`;

    return (
      <View style={[styles.playItem, { borderLeftColor: getPlayColor(item.type) }]}>
        {timeLabel ? (
          <Text style={[styles.playTime, { color: colors.textMuted }]}>
            {timeLabel}
          </Text>
        ) : null}
        <Text style={[styles.playDescription, { color: colors.text }]}>
          {item.description}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Preparing match...
        </Text>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Match not found.
        </Text>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.primary, marginTop: spacing.lg }]}
          onPress={onComplete}
        >
          <Text style={styles.controlText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Scoreboard */}
      <View style={[styles.scoreboard, { backgroundColor: colors.card }, shadows.md]}>
        <View style={styles.teamScore}>
          <Text style={[styles.teamLabel, { color: colors.textMuted }]}>HOME</Text>
          <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
            {homeTeamName}
          </Text>
          <Text style={[styles.score, { color: colors.text }]}>{homeScore}</Text>
        </View>

        <View style={styles.gameInfo}>
          <View style={[styles.halfBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.halfText}>{getPeriodLabel()}</Text>
          </View>
          {getTimeDisplay() ? (
            <Text style={[styles.gameTime, { color: colors.text }]}>{getTimeDisplay()}</Text>
          ) : null}
          {isRunning && (
            <View style={[styles.liveBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.teamScore}>
          <Text style={[styles.teamLabel, { color: colors.textMuted }]}>AWAY</Text>
          <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
            {awayTeamName}
          </Text>
          <Text style={[styles.score, { color: colors.text }]}>{awayScore}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: colors.card }]}>
        {!isComplete ? (
          <>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isRunning ? colors.warning : colors.success },
              ]}
              onPress={() => setIsRunning(!isRunning)}
            >
              <Text style={styles.controlText}>{isRunning ? 'Pause' : 'Play'}</Text>
            </TouchableOpacity>

            <View style={styles.speedControls}>
              {(['slow', 'normal', 'fast'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.speedButton,
                    {
                      backgroundColor: speed === s ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSpeed(s)}
                >
                  <Text
                    style={[
                      styles.speedText,
                      { color: speed === s ? colors.textInverse : colors.text },
                    ]}
                  >
                    {s === 'slow' ? '0.5x' : s === 'fast' ? '2x' : '1x'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.error }]}
              onPress={handleSkip}
            >
              <Text style={styles.controlText}>Skip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.finishButton, { backgroundColor: colors.primary }]}
            onPress={handleFinish}
          >
            <Text style={styles.controlText}>View Full Result</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Play-by-Play */}
      <View style={[styles.playByPlay, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {match.sport === 'basketball' ? 'Game Events' : match.sport === 'baseball' ? 'Play-by-Play' : 'Match Events'}
        </Text>
        {plays.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {match.sport === 'basketball'
                ? 'Waiting for tip-off...'
                : match.sport === 'baseball'
                  ? 'Waiting for first pitch...'
                  : 'Waiting for kickoff...'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={plays}
            renderItem={renderPlay}
            keyExtractor={(item) => item.id}
            style={styles.playList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  scoreboard: {
    flexDirection: 'row',
    padding: spacing.lg,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  score: {
    fontSize: 36,
    fontWeight: '700',
  },
  gameInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  halfBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  halfText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  gameTime: {
    fontSize: 24,
    fontWeight: '700',
  },
  liveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    margin: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  controlButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  finishButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  controlText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  speedControls: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  speedButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  playByPlay: {
    flex: 1,
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  playList: {
    flex: 1,
  },
  playItem: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
  },
  playTime: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  playDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default MatchSimulationScreen;
