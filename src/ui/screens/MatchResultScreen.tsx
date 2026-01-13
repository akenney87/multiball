/**
 * Match Result Screen
 *
 * Shows match results after completion:
 * - Final score
 * - Quarter scores
 * - Top performers
 * - Continue button
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';

interface PlayerStat {
  id: string;
  name: string;
  points: number;
  rebounds: number;
  assists: number;
}

interface MatchResultScreenProps {
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  quarterScores?: [number, number][];
  topPerformers?: PlayerStat[];
  onContinue?: () => void;
}

export function MatchResultScreen({
  matchId,
  homeTeam = 'My Team',
  awayTeam = 'Opponent',
  homeScore = 105,
  awayScore = 98,
  quarterScores = [[28, 24], [25, 26], [27, 23], [25, 25]],
  topPerformers = [
    { id: '1', name: 'Player A', points: 28, rebounds: 8, assists: 6 },
    { id: '2', name: 'Player B', points: 22, rebounds: 12, assists: 3 },
    { id: '3', name: 'Player C', points: 18, rebounds: 4, assists: 9 },
  ],
  onContinue,
}: MatchResultScreenProps) {
  const colors = useColors();

  const isWin = homeScore > awayScore;
  const resultColor = isWin ? colors.success : colors.error;
  const resultText = isWin ? 'VICTORY' : 'DEFEAT';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Result Banner */}
      <View style={[styles.resultBanner, { backgroundColor: resultColor }]}>
        <Text style={styles.resultText}>{resultText}</Text>
      </View>

      {/* Final Score */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>FINAL SCORE</Text>

        {/* Team names row */}
        <View style={styles.teamNamesRow}>
          <Text style={[styles.teamName, { color: colors.text }]}>{homeTeam}</Text>
          <Text style={[styles.teamName, { color: colors.text }]}>{awayTeam}</Text>
        </View>

        {/* Scores row */}
        <View style={styles.scoresRow}>
          <Text style={[styles.finalScore, { color: colors.text }]}>{homeScore}</Text>
          <Text style={[styles.dash, { color: colors.textMuted }]}>-</Text>
          <Text style={[styles.finalScore, { color: colors.text }]}>{awayScore}</Text>
        </View>
      </View>

      {/* Quarter Scores */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>QUARTER SCORES</Text>

        <View style={styles.quarterTable}>
          <View style={styles.quarterRow}>
            <Text style={[styles.quarterTeamLabel, { color: colors.textMuted }]}>Team</Text>
            {quarterScores.map((_, i) => (
              <Text key={i} style={[styles.quarterLabel, { color: colors.textMuted }]}>
                Q{i + 1}
              </Text>
            ))}
            <Text style={[styles.quarterLabel, { color: colors.textMuted }]}>Total</Text>
          </View>

          <View style={[styles.quarterRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[styles.quarterTeam, { color: colors.text }]}>{homeTeam}</Text>
            {quarterScores.map(([home], i) => (
              <Text key={i} style={[styles.quarterScore, { color: colors.text }]}>
                {home}
              </Text>
            ))}
            <Text style={[styles.quarterTotal, { color: colors.text }]}>{homeScore}</Text>
          </View>

          <View style={styles.quarterRow}>
            <Text style={[styles.quarterTeam, { color: colors.text }]}>{awayTeam}</Text>
            {quarterScores.map(([, away], i) => (
              <Text key={i} style={[styles.quarterScore, { color: colors.text }]}>
                {away}
              </Text>
            ))}
            <Text style={[styles.quarterTotal, { color: colors.text }]}>{awayScore}</Text>
          </View>
        </View>
      </View>

      {/* Top Performers */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>TOP PERFORMERS</Text>

        {topPerformers.map((player, index) => (
          <View
            key={player.id}
            style={[
              styles.performerRow,
              index < topPerformers.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.performerInfo}>
              <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <Text style={[styles.performerName, { color: colors.text }]}>
                {player.name}
              </Text>
            </View>

            <View style={styles.performerStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{player.points}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>PTS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{player.rebounds}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>REB</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{player.assists}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>AST</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        activeOpacity={0.8}
      >
        <Text style={[styles.continueText, { color: colors.textInverse }]}>
          Continue
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  resultBanner: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  teamNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalScore: {
    fontSize: 48,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'center',
  },
  dash: {
    fontSize: 32,
    fontWeight: '300',
    marginHorizontal: spacing.md,
  },
  quarterTable: {
    gap: spacing.sm,
  },
  quarterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  quarterLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  quarterTeamLabel: {
    flex: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  quarterTeam: {
    flex: 2,
    fontSize: 14,
    fontWeight: '500',
  },
  quarterScore: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  quarterTotal: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  performerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  performerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  performerStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  continueButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MatchResultScreen;
