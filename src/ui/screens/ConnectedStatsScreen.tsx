/**
 * Connected Stats Screen
 *
 * Stats screen connected to GameContext for real match data.
 * Aggregates player and team statistics from completed games.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useColors } from '../theme';
import { useGame } from '../context/GameContext';
import { StatsScreen } from './StatsScreen';
import {
  aggregatePlayerStats,
  aggregateTeamStats,
  aggregateBaseballBattingStats,
  aggregateBaseballPitchingStats,
  aggregateBaseballTeamStats,
  aggregateSoccerPlayerStats,
  aggregateSoccerGoalkeeperStats,
  aggregateSoccerTeamStats,
} from '../../systems/statsAggregator';

export type SportType = 'basketball' | 'baseball' | 'soccer';
export type BaseballStatType = 'batting' | 'pitching';
export type SoccerStatType = 'outfield' | 'goalkeeper';

export interface ConnectedStatsScreenProps {
  onPlayerPress: (playerId: string) => void;
}

export function ConnectedStatsScreen({ onPlayerPress }: ConnectedStatsScreenProps) {
  const colors = useColors();
  const { state } = useGame();

  // Local UI state
  const [selectedSport, setSelectedSport] = useState<SportType>('basketball');
  const [baseballStatType, setBaseballStatType] = useState<BaseballStatType>('batting');
  const [soccerStatType, setSoccerStatType] = useState<SoccerStatType>('outfield');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'totals' | 'pergame'>('pergame');
  const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
  const [sortBy, setSortBy] = useState('points');

  // Build teams list for filter dropdown
  const teams = useMemo(() => {
    const teamsList: Array<{ id: string; name: string }> = [
      { id: 'user', name: state.userTeam.name },
    ];
    for (const team of state.league.teams) {
      if (team.id !== 'user') {
        teamsList.push({ id: team.id, name: team.name });
      }
    }
    return teamsList;
  }, [state.userTeam.name, state.league.teams]);

  // Filter matches by selected sport
  const sportMatches = useMemo(() => {
    return state.season.matches.filter(m => m.sport === selectedSport);
  }, [state.season.matches, selectedSport]);

  // Aggregate player stats based on sport and stat type
  const allPlayerStats = useMemo(() => {
    if (selectedSport === 'basketball') {
      return aggregatePlayerStats(sportMatches, state.players, state.userTeam.name, teams);
    }
    if (selectedSport === 'baseball') {
      return baseballStatType === 'batting'
        ? aggregateBaseballBattingStats(sportMatches, state.players, state.userTeam.name, teams)
        : aggregateBaseballPitchingStats(sportMatches, state.players, state.userTeam.name, teams);
    }
    if (selectedSport === 'soccer') {
      return soccerStatType === 'outfield'
        ? aggregateSoccerPlayerStats(sportMatches, state.players, state.userTeam.name, teams)
        : aggregateSoccerGoalkeeperStats(sportMatches, state.players, state.userTeam.name, teams);
    }
    return [];
  }, [sportMatches, state.players, state.userTeam.name, teams, selectedSport, baseballStatType, soccerStatType]);

  // Aggregate team stats based on sport
  const allTeamStats = useMemo(() => {
    if (selectedSport === 'basketball') {
      return aggregateTeamStats(sportMatches, state.userTeam.name, teams);
    }
    if (selectedSport === 'baseball') {
      return aggregateBaseballTeamStats(sportMatches, state.userTeam.name, teams);
    }
    if (selectedSport === 'soccer') {
      return aggregateSoccerTeamStats(sportMatches, state.userTeam.name, teams);
    }
    return [];
  }, [sportMatches, state.userTeam.name, teams, selectedSport]);

  // Filter player stats by selected team
  const filteredPlayerStats = useMemo(() => {
    if (!selectedTeamId) return allPlayerStats;
    return allPlayerStats.filter((p) => p.teamId === selectedTeamId);
  }, [allPlayerStats, selectedTeamId]);

  // Map sort keys to per-game equivalents by sport
  const getPerGameKey = (key: string, sport: SportType, statType?: string): string | null => {
    // Basketball per-game mappings
    if (sport === 'basketball') {
      const basketballMap: Record<string, string> = {
        points: 'ppg',
        rebounds: 'rpg',
        assists: 'apg',
        steals: 'spg',
        blocks: 'bpg',
        turnovers: 'tpg',
        minutesPlayed: 'mpg',
        // eff, fgPct, fg3Pct, ftPct don't have per-game equivalents (they're already rates)
      };
      return basketballMap[key] || null;
    }

    // Soccer outfield per-game mappings
    if (sport === 'soccer' && statType !== 'goalkeeper') {
      const soccerOutfieldMap: Record<string, string> = {
        goals: 'goalsPerGame',
        assists: 'assistsPerGame',
      };
      return soccerOutfieldMap[key] || null;
    }

    // Soccer goalkeeper per-game mappings
    if (sport === 'soccer' && statType === 'goalkeeper') {
      const soccerGkMap: Record<string, string> = {
        saves: 'savesPerGame',
        goalsAgainst: 'goalsAgainstPerGame',
      };
      return soccerGkMap[key] || null;
    }

    // Baseball stats are already rate-based (AVG, ERA, OBP, etc.) or cumulative
    // No per-game conversion needed for baseball
    return null;
  };

  // Get the effective sort key based on viewMode
  const getEffectiveSortKey = (key: string, mode: 'totals' | 'pergame'): string => {
    if (mode === 'pergame') {
      const statType = selectedSport === 'soccer' ? soccerStatType : undefined;
      const perGameKey = getPerGameKey(key, selectedSport, statType);
      if (perGameKey) return perGameKey;
    }
    return key;
  };

  // Sort player stats - uses dynamic property access for multi-sport support
  const sortedPlayerStats = useMemo(() => {
    const sorted = [...filteredPlayerStats];
    const effectiveSortKey = getEffectiveSortKey(sortBy, viewMode);

    sorted.sort((a: any, b: any) => {
      // Get the value for the sort key, defaulting to 0
      const aVal = a[effectiveSortKey] ?? 0;
      const bVal = b[effectiveSortKey] ?? 0;

      // Lower is better for these stats
      const lowerIsBetter = ['era', 'fip', 'whip', 'goalsAgainst', 'runsAgainst', 'goalsAgainstPerGame'];
      if (lowerIsBetter.includes(sortBy)) {
        return aVal - bVal;
      }

      return bVal - aVal;
    });

    return sorted;
  }, [filteredPlayerStats, sortBy, viewMode]);

  // Sort team stats - uses dynamic property access for multi-sport support
  const sortedTeamStats = useMemo(() => {
    const sorted = [...allTeamStats];

    sorted.sort((a: any, b: any) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;

      // Lower is better for these stats
      const lowerIsBetter = ['oppPpg', 'pointsAgainst', 'runsAgainstPerGame', 'goalsAgainst', 'era'];
      if (lowerIsBetter.includes(sortBy)) {
        return aVal - bVal;
      }

      return bVal - aVal;
    });

    return sorted;
  }, [allTeamStats, sortBy]);

  // Handle tab change - reset sort to default for that tab
  const handleTabChange = useCallback((tab: 'players' | 'teams') => {
    setActiveTab(tab);
    // Reset to default sort for the new tab and sport
    if (tab === 'teams') {
      setSortBy('ppg');
    } else {
      // Default sort based on sport (use efficiency stat)
      switch (selectedSport) {
        case 'basketball': setSortBy('eff'); break;
        case 'baseball': setSortBy(baseballStatType === 'batting' ? 'rc27' : 'fip'); break;
        case 'soccer': setSortBy('rating'); break;
      }
    }
  }, [selectedSport, baseballStatType, soccerStatType]);

  // Handle sport change - reset sort to default for that sport
  const handleSportChange = useCallback((sport: SportType) => {
    setSelectedSport(sport);
    setActiveTab('players'); // Reset to players tab
    // Reset sort based on sport (use efficiency stat)
    switch (sport) {
      case 'basketball': setSortBy('eff'); break;
      case 'baseball': setSortBy('rc27'); break;
      case 'soccer': setSortBy('rating'); break;
    }
  }, []);

  // Handle baseball stat type change
  const handleBaseballStatTypeChange = useCallback((type: BaseballStatType) => {
    setBaseballStatType(type);
    setSortBy(type === 'batting' ? 'rc27' : 'fip');
  }, []);

  // Handle soccer stat type change
  const handleSoccerStatTypeChange = useCallback((type: SoccerStatType) => {
    setSoccerStatType(type);
    setSortBy('rating'); // Both outfield and goalkeeper use rating
  }, []);

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <StatsScreen
      // Sport selection
      selectedSport={selectedSport}
      baseballStatType={baseballStatType}
      soccerStatType={soccerStatType}
      onSportChange={handleSportChange}
      onBaseballStatTypeChange={handleBaseballStatTypeChange}
      onSoccerStatTypeChange={handleSoccerStatTypeChange}
      // Data
      playerStats={sortedPlayerStats}
      teamStats={sortedTeamStats}
      teams={teams}
      // Filters
      selectedTeamId={selectedTeamId}
      viewMode={viewMode}
      activeTab={activeTab}
      sortBy={sortBy}
      // Callbacks
      onTeamFilterChange={setSelectedTeamId}
      onViewModeChange={setViewMode}
      onTabChange={handleTabChange}
      onSortChange={setSortBy}
      onPlayerPress={onPlayerPress}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConnectedStatsScreen;
