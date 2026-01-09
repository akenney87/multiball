/**
 * Standings Screen
 *
 * Displays league standings:
 * - League table with rank/W/L/Pts
 * - Highlight user team
 * - Promotion/relegation zone indicators
 * - Sport filter tabs
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';

type Sport = 'basketball' | 'baseball' | 'soccer';

export interface TeamStanding {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  draws?: number; // Soccer only
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  streak: string; // e.g., "W3", "L2"
}

interface StandingsScreenProps {
  userTeamId?: string;
  onTeamPress?: (team: TeamStanding) => void;
}

// Mock standings data
const mockStandings: Record<Sport, TeamStanding[]> = {
  basketball: [
    { teamId: 'user', teamName: 'My Team', played: 4, wins: 3, losses: 1, pointsFor: 420, pointsAgainst: 385, points: 6, streak: 'W2' },
    { teamId: '2', teamName: 'Warriors', played: 4, wins: 3, losses: 1, pointsFor: 415, pointsAgainst: 390, points: 6, streak: 'W1' },
    { teamId: '3', teamName: 'Thunder', played: 4, wins: 2, losses: 2, pointsFor: 395, pointsAgainst: 400, points: 4, streak: 'L1' },
    { teamId: '4', teamName: 'Panthers', played: 4, wins: 2, losses: 2, pointsFor: 388, pointsAgainst: 392, points: 4, streak: 'W1' },
    { teamId: '5', teamName: 'Rockets', played: 4, wins: 1, losses: 3, pointsFor: 375, pointsAgainst: 410, points: 2, streak: 'L2' },
    { teamId: '6', teamName: 'Blazers', played: 4, wins: 1, losses: 3, pointsFor: 360, pointsAgainst: 425, points: 2, streak: 'L3' },
  ],
  baseball: [
    { teamId: '2', teamName: 'Sluggers', played: 4, wins: 3, losses: 1, pointsFor: 32, pointsAgainst: 24, points: 6, streak: 'W2' },
    { teamId: 'user', teamName: 'My Team', played: 4, wins: 2, losses: 2, pointsFor: 28, pointsAgainst: 26, points: 4, streak: 'W1' },
    { teamId: '3', teamName: 'Aces', played: 4, wins: 2, losses: 2, pointsFor: 25, pointsAgainst: 27, points: 4, streak: 'L1' },
    { teamId: '4', teamName: 'Cardinals', played: 4, wins: 2, losses: 2, pointsFor: 24, pointsAgainst: 25, points: 4, streak: 'W1' },
    { teamId: '5', teamName: 'Giants', played: 4, wins: 1, losses: 3, pointsFor: 22, pointsAgainst: 30, points: 2, streak: 'L2' },
    { teamId: '6', teamName: 'Dodgers', played: 4, wins: 2, losses: 2, pointsFor: 26, pointsAgainst: 25, points: 4, streak: 'W2' },
  ],
  soccer: [
    { teamId: '2', teamName: 'United', played: 4, wins: 2, losses: 1, draws: 1, pointsFor: 8, pointsAgainst: 5, points: 7, streak: 'W1' },
    { teamId: '3', teamName: 'Eagles', played: 4, wins: 2, losses: 1, draws: 1, pointsFor: 7, pointsAgainst: 4, points: 7, streak: 'D1' },
    { teamId: 'user', teamName: 'My Team', played: 4, wins: 2, losses: 2, draws: 0, pointsFor: 6, pointsAgainst: 6, points: 6, streak: 'L1' },
    { teamId: '4', teamName: 'Rovers', played: 4, wins: 1, losses: 1, draws: 2, pointsFor: 5, pointsAgainst: 5, points: 5, streak: 'D2' },
    { teamId: '5', teamName: 'City', played: 4, wins: 1, losses: 2, draws: 1, pointsFor: 4, pointsAgainst: 7, points: 4, streak: 'L1' },
    { teamId: '6', teamName: 'Athletic', played: 4, wins: 0, losses: 3, draws: 1, pointsFor: 3, pointsAgainst: 9, points: 1, streak: 'L3' },
  ],
};

const sportColors: Record<Sport, string> = {
  basketball: '#FF6B35',
  baseball: '#1B998B',
  soccer: '#3498DB',
};

export function StandingsScreen({ userTeamId = 'user', onTeamPress }: StandingsScreenProps) {
  const colors = useColors();
  const [selectedSport, setSelectedSport] = useState<Sport>('basketball');

  const standings = useMemo(() => {
    return [...mockStandings[selectedSport]].sort((a, b) => {
      // Sort by points, then by point differential
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      return bDiff - aDiff;
    });
  }, [selectedSport]);

  const sports: Sport[] = ['basketball', 'baseball', 'soccer'];

  // Zone colors (top 3 = promotion, bottom 2 = relegation)
  const getZoneColor = (rank: number, total: number): string | undefined => {
    if (rank <= 3) return colors.success + '15'; // Promotion zone
    if (rank > total - 2) return colors.error + '15'; // Relegation zone
    return undefined;
  };

  const getStreakColor = (streak: string): string => {
    if (streak.startsWith('W')) return colors.success;
    if (streak.startsWith('L')) return colors.error;
    return colors.textMuted;
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
      <Text style={[styles.headerRank, { color: colors.textMuted }]}>#</Text>
      <Text style={[styles.headerTeam, { color: colors.textMuted }]}>Team</Text>
      <Text style={[styles.headerStat, { color: colors.textMuted }]}>P</Text>
      <Text style={[styles.headerStat, { color: colors.textMuted }]}>W</Text>
      {selectedSport === 'soccer' && (
        <Text style={[styles.headerStat, { color: colors.textMuted }]}>D</Text>
      )}
      <Text style={[styles.headerStat, { color: colors.textMuted }]}>L</Text>
      <Text style={[styles.headerStat, { color: colors.textMuted }]}>+/-</Text>
      <Text style={[styles.headerPts, { color: colors.textMuted }]}>Pts</Text>
    </View>
  );

  const renderTeamRow = ({ item, index }: { item: TeamStanding; index: number }) => {
    const rank = index + 1;
    const isUserTeam = item.teamId === userTeamId;
    const zoneColor = getZoneColor(rank, standings.length);
    const pointDiff = item.pointsFor - item.pointsAgainst;

    return (
      <TouchableOpacity
        style={[
          styles.teamRow,
          { borderBottomColor: colors.border },
          isUserTeam && [styles.userTeamRow, { borderLeftColor: colors.primary }],
          zoneColor && { backgroundColor: zoneColor },
        ]}
        onPress={() => onTeamPress?.(item)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.rank,
            { color: rank <= 3 ? colors.success : rank > standings.length - 2 ? colors.error : colors.text },
          ]}
        >
          {rank}
        </Text>
        <View style={styles.teamInfo}>
          <Text
            style={[
              styles.teamName,
              { color: colors.text },
              isUserTeam && styles.userTeamName,
            ]}
            numberOfLines={1}
          >
            {item.teamName}
          </Text>
          <View style={[styles.streakBadge, { backgroundColor: getStreakColor(item.streak) + '20' }]}>
            <Text style={[styles.streakText, { color: getStreakColor(item.streak) }]}>
              {item.streak}
            </Text>
          </View>
        </View>
        <Text style={[styles.stat, { color: colors.textSecondary }]}>{item.played}</Text>
        <Text style={[styles.stat, { color: colors.text }]}>{item.wins}</Text>
        {selectedSport === 'soccer' && (
          <Text style={[styles.stat, { color: colors.textSecondary }]}>{item.draws}</Text>
        )}
        <Text style={[styles.stat, { color: colors.text }]}>{item.losses}</Text>
        <Text
          style={[
            styles.stat,
            { color: pointDiff > 0 ? colors.success : pointDiff < 0 ? colors.error : colors.textMuted },
          ]}
        >
          {pointDiff > 0 ? '+' : ''}{pointDiff}
        </Text>
        <Text style={[styles.points, { color: colors.text }]}>{item.points}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sport Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
        {sports.map((sport) => (
          <TouchableOpacity
            key={sport}
            style={[
              styles.tab,
              selectedSport === sport && [
                styles.activeTab,
                { borderBottomColor: sportColors[sport] },
              ],
            ]}
            onPress={() => setSelectedSport(sport)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selectedSport === sport ? sportColors[sport] : colors.textMuted,
                },
                selectedSport === sport && styles.activeTabText,
              ]}
            >
              {sport.charAt(0).toUpperCase() + sport.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>
            Promotion Zone
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>
            Relegation Zone
          </Text>
        </View>
      </View>

      {/* Standings Table */}
      <View style={[styles.tableContainer, { backgroundColor: colors.card }, shadows.sm]}>
        {renderTableHeader()}
        <FlatList
          data={standings}
          renderItem={renderTeamRow}
          keyExtractor={(item) => item.teamId}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
  },
  activeTabText: {
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
  },
  tableContainer: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  headerRank: {
    width: 24,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerTeam: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerStat: {
    width: 28,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  headerPts: {
    width: 32,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  userTeamRow: {
    borderLeftWidth: 3,
  },
  rank: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamName: {
    fontSize: 14,
    flex: 1,
  },
  userTeamName: {
    fontWeight: '700',
  },
  streakBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stat: {
    width: 28,
    fontSize: 13,
    textAlign: 'center',
  },
  points: {
    width: 32,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default StandingsScreen;
