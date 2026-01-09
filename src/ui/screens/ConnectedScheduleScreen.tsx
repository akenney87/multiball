/**
 * Connected Schedule Screen
 *
 * Schedule screen connected to GameContext for real match data.
 * Shows past results and upcoming matches.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useGame } from '../context/GameContext';

interface ConnectedScheduleScreenProps {
  onMatchPress?: (matchId: string) => void;
}

export function ConnectedScheduleScreen({ onMatchPress }: ConnectedScheduleScreenProps) {
  const colors = useColors();
  const { state } = useGame();

  // Get user matches from schedule
  const userMatches = useMemo(() => {
    // Filter user matches and sort by date for consistent ordering
    const filtered = state.season.matches
      .filter((m) => m.homeTeamId === 'user' || m.awayTeamId === 'user')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    // Calculate week from match.week or fallback to position-based calculation
    // Assuming 3 matches per week per team (as per schedule generator)
    return filtered.map((match, index) => {
        const isHome = match.homeTeamId === 'user';
        const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
        const opponent = state.league.teams.find((t) => t.id === opponentId);

        // Use match.week if available, otherwise calculate from index (3 matches per week)
        const week = match.week ?? Math.floor(index / 3) + 1;

        return {
          id: match.id,
          week,
          opponent: opponent?.name || 'Unknown',
          isHome,
          status: match.status,
          sport: match.sport,
          result: match.result,
        };
      });
  }, [state.season.matches, state.league.teams]);

  // Split into completed and upcoming
  const { completed, upcoming } = useMemo(() => {
    return {
      completed: userMatches.filter((m) => m.status === 'completed'),
      upcoming: userMatches.filter((m) => m.status === 'scheduled'),
    };
  }, [userMatches]);

  // Calculate record
  const record = useMemo(() => {
    let wins = 0;
    let losses = 0;
    completed.forEach((match) => {
      if (match.result) {
        const userScore = match.isHome ? match.result.homeScore : match.result.awayScore;
        const oppScore = match.isHome ? match.result.awayScore : match.result.homeScore;
        if (userScore > oppScore) wins++;
        else losses++;
      }
    });
    return { wins, losses };
  }, [completed]);

  const handleMatchPress = useCallback(
    (matchId: string) => {
      onMatchPress?.(matchId);
    },
    [onMatchPress]
  );

  const getResultColor = (match: typeof userMatches[0]) => {
    if (!match.result) return colors.textMuted;
    const userScore = match.isHome ? match.result.homeScore : match.result.awayScore;
    const oppScore = match.isHome ? match.result.awayScore : match.result.homeScore;
    return userScore > oppScore ? colors.success : colors.error;
  };

  const getResultText = (match: typeof userMatches[0]) => {
    if (!match.result) return 'vs';
    const userScore = match.isHome ? match.result.homeScore : match.result.awayScore;
    const oppScore = match.isHome ? match.result.awayScore : match.result.homeScore;
    return userScore > oppScore ? 'W' : 'L';
  };

  const renderMatch = ({ item }: { item: typeof userMatches[0] }) => (
    <TouchableOpacity
      style={[styles.matchCard, { backgroundColor: colors.card }, shadows.sm]}
      onPress={() => handleMatchPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.matchHeader}>
        <Text style={[styles.weekText, { color: colors.textMuted }]}>
          Week {item.week}
        </Text>
        <View style={[styles.sportBadge, { backgroundColor: colors.basketball }]}>
          <Text style={styles.sportText}>
            {item.sport.charAt(0).toUpperCase() + item.sport.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.matchContent}>
        <Text style={[styles.locationText, { color: colors.textMuted }]}>
          {item.isHome ? 'HOME' : 'AWAY'}
        </Text>
        <Text style={[styles.opponentText, { color: colors.text }]}>
          {item.isHome ? 'vs' : '@'} {item.opponent}
        </Text>
      </View>

      {item.result ? (
        <View style={styles.resultContainer}>
          <Text style={[styles.resultLabel, { color: getResultColor(item) }]}>
            {getResultText(item)}
          </Text>
          <Text style={[styles.scoreText, { color: colors.text }]}>
            {item.isHome
              ? `${item.result.homeScore}-${item.result.awayScore}`
              : `${item.result.awayScore}-${item.result.homeScore}`}
          </Text>
        </View>
      ) : (
        <View style={styles.upcomingContainer}>
          <Text style={[styles.upcomingText, { color: colors.primary }]}>
            Upcoming
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Record Header */}
      <View style={[styles.recordHeader, { backgroundColor: colors.card }]}>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.text }]}>
            {record.wins}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Wins</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.text }]}>
            {record.losses}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Losses</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.text }]}>
            {completed.length}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Played</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: colors.text }]}>
            {upcoming.length}
          </Text>
          <Text style={[styles.recordLabel, { color: colors.textMuted }]}>Remaining</Text>
        </View>
      </View>

      {/* Match List */}
      <FlatList
        data={userMatches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No matches scheduled
            </Text>
          </View>
        }
      />
    </View>
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
  recordHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
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
    fontSize: 11,
    textTransform: 'uppercase',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  sportText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  matchContent: {
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  opponentText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upcomingContainer: {},
  upcomingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ConnectedScheduleScreen;
