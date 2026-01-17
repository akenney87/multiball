/**
 * Player Training Row
 *
 * Row component for displaying a player's training focus
 * in the team training screen list.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { Player, NewTrainingFocus } from '../../../data/types';
import { isNewTrainingFocus } from '../../../data/types';
import {
  getTrainingFocusDisplayName,
  createBalancedFocus,
} from '../../../utils/trainingFocusMapper';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF6B35', // Orange
  baseball: '#3B82F6',   // Blue
  soccer: '#10B981',     // Green
  balanced: '#8B5CF6',   // Purple
};

const SPORT_ICONS: Record<string, string> = {
  basketball: '🏀',
  baseball: '⚾',
  soccer: '⚽',
  balanced: '⚖️',
};

// =============================================================================
// TYPES
// =============================================================================

interface PlayerTrainingRowProps {
  player: Player;
  teamFocus: NewTrainingFocus;
  onEditPress: () => void;
  onResetToTeam: () => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert any training focus to NewTrainingFocus
 */
function normalizeToNewFocus(focus: any): NewTrainingFocus {
  if (!focus) return createBalancedFocus();
  if (isNewTrainingFocus(focus)) return focus;
  // Legacy format - convert to balanced
  return createBalancedFocus();
}

/**
 * Get icon and color for a focus
 */
function getFocusVisuals(focus: NewTrainingFocus): { icon: string; color: string } {
  const BALANCED_ICON = '⚖️';
  const BALANCED_COLOR = '#8B5CF6';

  if (focus.level === 'balanced') {
    return { icon: BALANCED_ICON, color: BALANCED_COLOR };
  }

  const sport = focus.sport ?? 'basketball';
  return {
    icon: SPORT_ICONS[sport] ?? BALANCED_ICON,
    color: SPORT_COLORS[sport] ?? BALANCED_COLOR,
  };
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

  // Normalize team focus
  const normalizedTeamFocus = useMemo(
    () => normalizeToNewFocus(teamFocus),
    [teamFocus]
  );

  // Get current focus
  const currentFocus = useMemo(
    () => normalizeToNewFocus(player.trainingFocus) ?? normalizedTeamFocus,
    [player.trainingFocus, normalizedTeamFocus]
  );

  const isUsingTeamDefault = player.trainingFocus === null || player.trainingFocus === undefined;

  // Get display values
  const focusDisplayName = useMemo(
    () => getTrainingFocusDisplayName(currentFocus),
    [currentFocus]
  );

  const { icon, color } = useMemo(
    () => getFocusVisuals(currentFocus),
    [currentFocus]
  );

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

      {/* Training Focus Display */}
      <View style={styles.focusContainer}>
        <View
          style={[
            styles.focusChip,
            {
              backgroundColor: color + '20',
              borderColor: color,
            },
          ]}
        >
          <Text style={styles.focusIcon}>{icon}</Text>
          <Text
            style={[styles.focusText, { color }]}
            numberOfLines={1}
          >
            {focusDisplayName}
          </Text>
        </View>
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
  focusContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  focusIcon: {
    fontSize: 12,
  },
  focusText: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 100,
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
