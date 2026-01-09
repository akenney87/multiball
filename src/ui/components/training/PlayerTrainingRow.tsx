/**
 * Player Training Row
 *
 * Row component for displaying a player's training focus
 * in the team training screen list.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { Player } from '../../../data/types';
import type { TrainingFocus } from '../../../systems/trainingSystem';
import { DEFAULT_TRAINING_FOCUS } from '../../../systems/trainingSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_COLORS = {
  physical: '#3B82F6',  // Blue
  mental: '#8B5CF6',    // Purple
  technical: '#10B981', // Green
};

// =============================================================================
// TYPES
// =============================================================================

interface PlayerTrainingRowProps {
  player: Player;
  teamFocus: TrainingFocus;
  onEditPress: () => void;
  onResetToTeam: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PlayerTrainingRow({
  player,
  teamFocus,
  onEditPress,
  onResetToTeam,
}: PlayerTrainingRowProps) {
  const colors = useColors();

  // Get current focus
  const currentFocus = useMemo(
    () => player.trainingFocus ?? teamFocus ?? DEFAULT_TRAINING_FOCUS,
    [player.trainingFocus, teamFocus]
  );

  const isUsingTeamDefault = player.trainingFocus === null || player.trainingFocus === undefined;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }, shadows.sm]}
      onPress={onEditPress}
      activeOpacity={0.7}
    >
      {/* Player Info */}
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
          {player.name}
        </Text>
        <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
          Age {player.age}
        </Text>
      </View>

      {/* Mini Training Bars */}
      <View style={styles.barsContainer}>
        {(['physical', 'mental', 'technical'] as const).map((category) => (
          <View key={category} style={styles.miniBarRow}>
            <View
              style={[
                styles.miniBarBg,
                { backgroundColor: colors.surface },
              ]}
            >
              <View
                style={[
                  styles.miniBarFill,
                  {
                    width: `${currentFocus[category]}%` as any,
                    backgroundColor: CATEGORY_COLORS[category],
                  },
                ]}
              />
            </View>
            <Text style={[styles.miniBarValue, { color: colors.textMuted }]}>
              {currentFocus[category]}%
            </Text>
          </View>
        ))}
      </View>

      {/* Status Badge */}
      <View style={styles.statusContainer}>
        {isUsingTeamDefault ? (
          <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              Team
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.success }]}>
                Custom
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: colors.border }]}
              onPress={(e) => {
                e.stopPropagation();
                onResetToTeam();
              }}
            >
              <Text style={[styles.resetText, { color: colors.textMuted }]}>
                Reset
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  playerInfo: {
    width: 100,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  playerMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  barsContainer: {
    flex: 1,
    gap: 4,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miniBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  miniBarValue: {
    fontSize: 9,
    width: 28,
    textAlign: 'right',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  resetText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default PlayerTrainingRow;
