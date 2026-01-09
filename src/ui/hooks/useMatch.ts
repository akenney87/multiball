/**
 * useMatch Hook
 *
 * Provides match-related data and actions from GameContext.
 */

import { useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { calculatePlayerOverall, calculateSoccerPositionOverall } from '../integration/gameInitializer';
import { FORMATION_POSITIONS } from './useLineup';
import type { Match, Player } from '../../data/types';
import {
  calculateBasketballOverall,
  calculateBaseballPositionOverall,
  type BaseballPositionType,
} from '../../utils/overallRating';
import type { BaseballGameStrategy } from '../../simulation/baseball';

export interface MatchTeamData {
  id: string;
  name: string;
  record: string;
  roster: Array<{
    id: string;
    name: string;
    position: string;
    overall: number;
    age: number;
  }>;
  isUser: boolean;
}

export interface MatchData {
  match: Match;
  sport: string;
  week: number;
  homeTeam: MatchTeamData;
  awayTeam: MatchTeamData;
  userIsHome: boolean;
}

export function useMatch(matchId: string | undefined) {
  const {
    state,
    simulateMatch,
    getUserRoster,
  } = useGame();

  // Find the match
  const match = useMemo(() => {
    if (!matchId) return null;
    return state.season.matches.find((m) => m.id === matchId) || null;
  }, [matchId, state.season.matches]);

  // Get team data
  const getTeamData = useCallback(
    (teamId: string): MatchTeamData | null => {
      if (teamId === 'user') {
        const roster = getUserRoster();
        const standing = state.season.standings['user'];
        return {
          id: 'user',
          name: state.userTeam.name,
          record: standing ? `${standing.wins}-${standing.losses}` : '0-0',
          roster: roster.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            overall: calculatePlayerOverall(p),
            age: p.age,
          })),
          isUser: true,
        };
      }

      const team = state.league.teams.find((t) => t.id === teamId);
      if (!team) return null;

      const standing = state.season.standings[teamId];
      const roster = team.rosterIds
        .map((id) => state.players[id])
        .filter((p): p is Player => p !== undefined);

      return {
        id: teamId,
        name: team.name,
        record: standing ? `${standing.wins}-${standing.losses}` : '0-0',
        roster: roster.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          overall: calculatePlayerOverall(p),
          age: p.age,
        })),
        isUser: false,
      };
    },
    [state.userTeam, state.league.teams, state.season.standings, state.players, getUserRoster]
  );

  // Build match data
  const matchData = useMemo((): MatchData | null => {
    if (!match) return null;

    const homeTeam = getTeamData(match.homeTeamId);
    const awayTeam = getTeamData(match.awayTeamId);

    if (!homeTeam || !awayTeam) return null;

    return {
      match,
      sport: match.sport.charAt(0).toUpperCase() + match.sport.slice(1),
      week: state.season.currentWeek,
      homeTeam,
      awayTeam,
      userIsHome: match.homeTeamId === 'user',
    };
  }, [match, getTeamData, state.season.currentWeek]);

  // Get basketball lineup data
  const basketballLineup = useMemo(() => {
    const starterIds = state.userTeam.lineup.basketballStarters;
    const benchIds = state.userTeam.lineup.bench;

    const starters = starterIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        overall: calculateBasketballOverall(p.attributes),
        matchFitness: p.matchFitness ?? 100,
      }));

    const bench = benchIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        overall: calculateBasketballOverall(p.attributes),
        matchFitness: p.matchFitness ?? 100,
      }));

    return { starters, bench };
  }, [state.userTeam.lineup, state.players]);

  // Get baseball lineup data
  const baseballLineup = useMemo(() => {
    const { battingOrder, positions, startingPitcher } = state.userTeam.lineup.baseballLineup;

    const battingOrderWithDetails = battingOrder
      .map((id) => {
        const player = state.players[id];
        if (!player) return null;
        const position = (positions[player.id] || 'DH') as BaseballPositionType;
        return {
          id: player.id,
          name: player.name,
          position,
          overall: calculateBaseballPositionOverall(player.attributes, position),
          matchFitness: player.matchFitness ?? 100,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const pitcher = state.players[startingPitcher];
    const pitcherData = pitcher ? {
      id: pitcher.id,
      name: pitcher.name,
      overall: calculateBaseballPositionOverall(pitcher.attributes, 'P'),
      matchFitness: pitcher.matchFitness ?? 100,
    } : null;

    return {
      battingOrder: battingOrderWithDetails,
      positions,
      startingPitcher: pitcherData,
    };
  }, [state.userTeam.lineup.baseballLineup, state.players]);

  // Get soccer lineup data
  const soccerLineup = useMemo(() => {
    const { starters, formation, positions } = state.userTeam.lineup.soccerLineup;
    const formationPositions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2'];

    const startersWithDetails = starters
      .map((id) => {
        const player = state.players[id];
        if (!player) return null;
        const slotIndex = positions[player.id];
        // Map slot index to position name from formation
        const positionName = slotIndex !== undefined
          ? formationPositions[slotIndex] || '?'
          : '?';
        return {
          id: player.id,
          name: player.name,
          position: positionName,
          overall: calculateSoccerPositionOverall(player, positionName),
          matchFitness: player.matchFitness ?? 100,
          slotIndex: slotIndex ?? 99, // For sorting - unassigned go to end
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      // Sort by slotIndex to maintain formation order (GK first, then defenders, mids, forwards)
      .sort((a, b) => a.slotIndex - b.slotIndex);

    return {
      starters: startersWithDetails,
      formation,
      positions,
    };
  }, [state.userTeam.lineup.soccerLineup, state.players]);

  // Combined lineup (for backward compatibility) - returns sport-appropriate lineup
  const userLineup = useMemo(() => {
    const sport = match?.sport || 'basketball';

    switch (sport) {
      case 'baseball':
        return {
          starters: baseballLineup.battingOrder,
          bench: basketballLineup.bench, // Use basketball bench for now
        };
      case 'soccer':
        return {
          starters: soccerLineup.starters,
          bench: basketballLineup.bench,
        };
      case 'basketball':
      default:
        return basketballLineup;
    }
  }, [match?.sport, basketballLineup, baseballLineup, soccerLineup]);

  // Simulate this match
  const simulate = useCallback(async (
    baseballStrategy?: BaseballGameStrategy,
    soccerStrategy?: { attackingStyle: 'possession' | 'direct' | 'counter'; pressing: 'high' | 'balanced' | 'low'; width: 'wide' | 'balanced' | 'tight' },
    basketballStrategy?: { pace: 'fast' | 'standard' | 'slow'; defense: 'man' | 'mixed' | 'zone'; rebounding: 'crash_glass' | 'standard' | 'prevent_transition'; scoringOptions: string[] }
  ) => {
    if (!matchId) return null;
    return simulateMatch(matchId, baseballStrategy, soccerStrategy, basketballStrategy);
  }, [matchId, simulateMatch]);

  return {
    match,
    matchData,
    userLineup,
    basketballLineup,
    baseballLineup,
    soccerLineup,
    simulate,
    isReady: matchData !== null,
    tactics: state.userTeam.tactics,
  };
}

export default useMatch;
