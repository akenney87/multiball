/**
 * Schedule Screen
 *
 * Displays season schedule:
 * - Week-by-week match list
 * - Match cards with opponent, sport, result
 * - Filter by sport
 * - Past results vs upcoming
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

type Sport = 'basketball' | 'baseball' | 'soccer' | 'ALL';
type MatchStatus = 'scheduled' | 'completed';

export interface ScheduleMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: 'basketball' | 'baseball' | 'soccer';
  date: Date;
  week: number;
  status: MatchStatus;
  result?: {
    homeScore: number;
    awayScore: number;
    winner: 'home' | 'away';
  };
  isHomeGame: boolean;
}

interface ScheduleScreenProps {
  userTeamId?: string;
  onMatchPress?: (match: ScheduleMatch) => void;
}

// Mock schedule data
const mockSchedule: ScheduleMatch[] = [
  { id: '1', homeTeam: 'My Team', awayTeam: 'Warriors', sport: 'basketball', date: new Date('2025-01-06'), week: 1, status: 'completed', result: { homeScore: 105, awayScore: 98, winner: 'home' }, isHomeGame: true },
  { id: '2', homeTeam: 'Eagles', awayTeam: 'My Team', sport: 'soccer', date: new Date('2025-01-08'), week: 1, status: 'completed', result: { homeScore: 2, awayScore: 1, winner: 'home' }, isHomeGame: false },
  { id: '3', homeTeam: 'My Team', awayTeam: 'Sluggers', sport: 'baseball', date: new Date('2025-01-10'), week: 1, status: 'completed', result: { homeScore: 7, awayScore: 5, winner: 'home' }, isHomeGame: true },
  { id: '4', homeTeam: 'Panthers', awayTeam: 'My Team', sport: 'basketball', date: new Date('2025-01-13'), week: 2, status: 'completed', result: { homeScore: 88, awayScore: 92, winner: 'away' }, isHomeGame: false },
  { id: '5', homeTeam: 'My Team', awayTeam: 'United', sport: 'soccer', date: new Date('2025-01-15'), week: 2, status: 'scheduled', isHomeGame: true },
  { id: '6', homeTeam: 'Aces', awayTeam: 'My Team', sport: 'baseball', date: new Date('2025-01-17'), week: 2, status: 'scheduled', isHomeGame: false },
  { id: '7', homeTeam: 'My Team', awayTeam: 'Thunder', sport: 'basketball', date: new Date('2025-01-20'), week: 3, status: 'scheduled', isHomeGame: true },
  { id: '8', homeTeam: 'Rovers', awayTeam: 'My Team', sport: 'soccer', date: new Date('2025-01-22'), week: 3, status: 'scheduled', isHomeGame: false },
];

const sportColors: Record<Sport, string> = {
  basketball: '#FF6B35',
  baseball: '#1B998B',
  soccer: '#3498DB',
  ALL: '#6B7280',
};

const sportLabels: Record<Sport, string> = {
  basketball: 'BBall',
  baseball: 'Base',
  soccer: 'Soccer',
  ALL: 'All',
};

export function ScheduleScreen({ userTeamId, onMatchPress }: ScheduleScreenProps) {
  const colors = useColors();
  const [selectedSport, setSelectedSport] = useState<Sport>('ALL');
  const [currentWeek] = useState(2); // Mock current week

  const sports: Sport[] = ['ALL', 'basketball', 'baseball', 'soccer'];

  const filteredMatches = useMemo(() => {
    if (selectedSport === 'ALL') return mockSchedule;
    return mockSchedule.filter((m) => m.sport === selectedSport);
  }, [selectedSport]);

  // Group matches by week
  const matchesByWeek = useMemo(() => {
    const grouped = new Map<number, ScheduleMatch[]>();
    filteredMatches.forEach((match) => {
      if (!grouped.has(match.week)) {
        grouped.set(match.week, []);
      }
      grouped.get(match.week)!.push(match);
    });
    return grouped;
  }, [filteredMatches]);

  const weeks = Array.from(matchesByWeek.keys()).sort((a, b) => a - b);

  const stats = useMemo(() => {
    const completed = mockSchedule.filter((m) => m.status === 'completed');
    const wins = completed.filter((m) => {
      if (!m.result) return false;
      return (m.isHomeGame && m.result.winner === 'home') ||
             (!m.isHomeGame && m.result.winner === 'away');
    }).length;
    const losses = completed.length - wins;
    return { wins, losses, remaining: mockSchedule.length - completed.length };
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMatchCard = (match: ScheduleMatch) => {
    const opponent = match.isHomeGame ? match.awayTeam : match.homeTeam;
    const isWin = match.result && (
      (match.isHomeGame && match.result.winner === 'home') ||
      (!match.isHomeGame && match.result.winner === 'away')
    );
    const userScore = match.result
      ? (match.isHomeGame ? match.result.homeScore : match.result.awayScore)
      : null;
    const opponentScore = match.result
      ? (match.isHomeGame ? match.result.awayScore : match.result.homeScore)
      : null;

    return (
      <TouchableOpacity
        key={match.id}
        style={[styles.matchCard, { backgroundColor: colors.card }, shadows.sm]}
        onPress={() => onMatchPress?.(match)}
        activeOpacity={0.7}
      >
        <View style={[styles.sportBadge, { backgroundColor: sportColors[match.sport] }]}>
          <Text style={styles.sportBadgeText}>{sportLabels[match.sport]}</Text>
        </View>

        <View style={styles.matchInfo}>
          <Text style={[styles.opponentName, { color: colors.text }]}>
            {match.isHomeGame ? 'vs' : '@'} {opponent}
          </Text>
          <Text style={[styles.matchDate, { color: colors.textMuted }]}>
            {formatDate(match.date)} - {match.isHomeGame ? 'Home' : 'Away'}
          </Text>
        </View>

        {match.status === 'completed' && match.result ? (
          <View style={styles.resultContainer}>
            <Text
              style={[
                styles.resultText,
                { color: isWin ? colors.success : colors.error },
              ]}
            >
              {isWin ? 'W' : 'L'}
            </Text>
            <Text style={[styles.scoreText, { color: colors.text }]}>
              {userScore}-{opponentScore}
            </Text>
          </View>
        ) : (
          <View style={styles.upcomingBadge}>
            <Text style={[styles.upcomingText, { color: colors.primary }]}>
              Upcoming
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderWeekSection = ({ item: week }: { item: number }) => {
    const weekMatches = matchesByWeek.get(week) || [];
    const isCurrentWeek = week === currentWeek;

    return (
      <View style={styles.weekSection}>
        <View style={styles.weekHeader}>
          <Text style={[styles.weekTitle, { color: colors.text }]}>
            Week {week}
          </Text>
          {isCurrentWeek && (
            <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          )}
        </View>
        {weekMatches.map(renderMatchCard)}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Record Bar */}
      <View style={[styles.recordBar, { backgroundColor: colors.card }]}>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.success }]}>
            {stats.wins}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Wins</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.error }]}>
            {stats.losses}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Losses</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.text }]}>
            {stats.remaining}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Left</Text>
        </View>
      </View>

      {/* Sport Filter */}
      <View style={styles.filterContainer}>
        {sports.map((sport) => (
          <TouchableOpacity
            key={sport}
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  selectedSport === sport ? sportColors[sport] : colors.surface,
                borderColor: sportColors[sport],
              },
            ]}
            onPress={() => setSelectedSport(sport)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: selectedSport === sport ? '#FFFFFF' : colors.text,
                },
              ]}
            >
              {sportLabels[sport]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Schedule List */}
      <FlatList
        data={weeks}
        renderItem={renderWeekSection}
        keyExtractor={(item) => `week-${item}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  recordBar: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  recordItem: {
    flex: 1,
    alignItems: 'center',
  },
  recordValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  recordLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  weekSection: {
    marginBottom: spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  currentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  sportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  sportBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  matchInfo: {
    flex: 1,
  },
  opponentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchDate: {
    fontSize: 12,
    marginTop: 2,
  },
  resultContainer: {
    alignItems: 'center',
  },
  resultText: {
    fontSize: 16,
    fontWeight: '800',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  upcomingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  upcomingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ScheduleScreen;
