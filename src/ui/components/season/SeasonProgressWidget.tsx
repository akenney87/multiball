/**
 * Season Progress Widget
 *
 * Compact display of season progress:
 * - Current week indicator
 * - Season phase (pre/regular/post/off)
 * - Progress bar
 * - Quick actions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';

export type SeasonPhase = 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

export interface SeasonProgressData {
  currentWeek: number;
  totalWeeks: number;
  phase: SeasonPhase;
  seasonNumber: number;
  matchesPlayed: number;
  totalMatches: number;
  nextMatchDate?: Date;
}

interface SeasonProgressWidgetProps {
  data: SeasonProgressData;
  onAdvanceWeek?: () => void;
  onViewSchedule?: () => void;
}

const phaseLabels: Record<SeasonPhase, string> = {
  pre_season: 'Pre-Season',
  regular_season: 'Regular Season',
  post_season: 'Playoffs',
  off_season: 'Off-Season',
};

const phaseColors: Record<SeasonPhase, string> = {
  pre_season: '#8B5CF6',
  regular_season: '#10B981',
  post_season: '#F59E0B',
  off_season: '#6B7280',
};

export function SeasonProgressWidget({
  data,
  onAdvanceWeek,
  onViewSchedule,
}: SeasonProgressWidgetProps) {
  const colors = useColors();

  const progressPercent = Math.round((data.currentWeek / data.totalWeeks) * 100);
  const matchProgressPercent = Math.round((data.matchesPlayed / data.totalMatches) * 100);

  const formatNextMatch = (date: Date | undefined) => {
    if (!date) return 'No upcoming matches';
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.sm]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.seasonLabel, { color: colors.textMuted }]}>
            Season {data.seasonNumber}
          </Text>
          <View style={styles.phaseRow}>
            <View
              style={[
                styles.phaseBadge,
                { backgroundColor: phaseColors[data.phase] },
              ]}
            >
              <Text style={styles.phaseText}>{phaseLabels[data.phase]}</Text>
            </View>
          </View>
        </View>
        <View style={styles.weekDisplay}>
          <Text style={[styles.weekNumber, { color: colors.primary }]}>
            {data.currentWeek}
          </Text>
          <Text style={[styles.weekLabel, { color: colors.textMuted }]}>
            of {data.totalWeeks}
          </Text>
        </View>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Season Progress
          </Text>
          <Text style={[styles.progressValue, { color: colors.text }]}>
            {progressPercent}%
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        <View style={[styles.progressRow, { marginTop: spacing.sm }]}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Matches Played
          </Text>
          <Text style={[styles.progressValue, { color: colors.text }]}>
            {data.matchesPlayed}/{data.totalMatches}
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${matchProgressPercent}%`,
                backgroundColor: colors.success,
              },
            ]}
          />
        </View>
      </View>

      {/* Next Match */}
      <View style={[styles.nextMatch, { borderTopColor: colors.border }]}>
        <Text style={[styles.nextMatchLabel, { color: colors.textMuted }]}>
          Next Match
        </Text>
        <Text style={[styles.nextMatchValue, { color: colors.text }]}>
          {formatNextMatch(data.nextMatchDate)}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={onAdvanceWeek}
        >
          <Text style={styles.actionButtonText}>Advance Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.secondaryButton,
            { borderColor: colors.border },
          ]}
          onPress={onViewSchedule}
        >
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            View Schedule
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  seasonLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  phaseRow: {
    flexDirection: 'row',
  },
  phaseBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  phaseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  weekDisplay: {
    alignItems: 'center',
  },
  weekNumber: {
    fontSize: 36,
    fontWeight: '800',
  },
  weekLabel: {
    fontSize: 12,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: 12,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  nextMatch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
  nextMatchLabel: {
    fontSize: 12,
  },
  nextMatchValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SeasonProgressWidget;
