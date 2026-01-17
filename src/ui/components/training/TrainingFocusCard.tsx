/**
 * Training Focus Card
 *
 * Card component for managing individual player training focus.
 * Uses the new hierarchical training focus system:
 * - Balanced: Even distribution
 * - Sport: Sport-weighted training
 * - Skill: Specific skill training
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import { TrainingFocusSelector } from './TrainingFocusSelector';
import { GrowthRegressionChart } from './GrowthRegressionChart';
import { XPProgressDisplay } from './XPProgressDisplay';
import type { Player, NewTrainingFocus } from '../../../data/types';
import { isNewTrainingFocus } from '../../../data/types';
import { getAgeMultiplier } from '../../../systems/trainingSystem';
import { getTrainingFocusDisplayName, createBalancedFocus } from '../../../utils/trainingFocusMapper';

// =============================================================================
// TYPES
// =============================================================================

interface TrainingFocusCardProps {
  player: Player;
  teamFocus: NewTrainingFocus;
  onFocusChange: (focus: NewTrainingFocus) => void;
  onResetToTeam: () => void;
  /** Training quality multiplier from budget (0.5 to 2.0) */
  budgetMultiplier?: number;
  /** Show the growth chart (default: true) */
  showGrowthChart?: boolean;
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

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingFocusCard({
  player,
  teamFocus,
  onFocusChange,
  onResetToTeam,
  budgetMultiplier = 1.0,
  showGrowthChart = true,
}: TrainingFocusCardProps) {
  const colors = useColors();

  // Normalize team focus
  const normalizedTeamFocus = useMemo(
    () => normalizeToNewFocus(teamFocus),
    [teamFocus]
  );

  // Determine current focus (player-specific or team default)
  const currentFocus = useMemo(
    () => normalizeToNewFocus(player.trainingFocus) ?? normalizedTeamFocus,
    [player.trainingFocus, normalizedTeamFocus]
  );

  const isUsingTeamDefault = player.trainingFocus === null || player.trainingFocus === undefined;

  // Calculate training multipliers for display
  const ageMultiplier = useMemo(() => getAgeMultiplier(player.age), [player.age]);
  const totalMultiplier = useMemo(
    () => budgetMultiplier * ageMultiplier,
    [budgetMultiplier, ageMultiplier]
  );

  // Age category label
  const ageCategory = useMemo(() => {
    if (player.age < 23) return 'Young';
    if (player.age < 28) return 'Prime';
    if (player.age < 32) return 'Veteran';
    return 'Aging';
  }, [player.age]);

  // Get focus display name
  const focusDisplayName = useMemo(
    () => getTrainingFocusDisplayName(currentFocus),
    [currentFocus]
  );

  // Handle focus change
  const handleFocusChange = useCallback(
    (focus: NewTrainingFocus) => {
      onFocusChange(focus);
    },
    [onFocusChange]
  );

  return (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Training Focus</Text>
          {isUsingTeamDefault ? (
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                Team Default
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.success }]}>
                Custom
              </Text>
            </View>
          )}
        </View>

        {/* Current Focus Display */}
        <View style={[styles.focusDisplay, { backgroundColor: colors.surface }]}>
          <Text style={[styles.focusLabel, { color: colors.textMuted }]}>
            CURRENT FOCUS
          </Text>
          <Text style={[styles.focusValue, { color: colors.primary }]}>
            {focusDisplayName}
          </Text>
        </View>

        {/* Training Multipliers Info */}
        <View style={[styles.multipliersRow, { backgroundColor: colors.surface }]}>
          <View style={styles.multiplierItem}>
            <Text style={[styles.multiplierLabel, { color: colors.textMuted }]}>
              Age ({ageCategory})
            </Text>
            <Text
              style={[
                styles.multiplierValue,
                {
                  color:
                    ageMultiplier >= 1.0
                      ? colors.success
                      : ageMultiplier >= 0.7
                      ? colors.warning
                      : colors.error,
                },
              ]}
            >
              {ageMultiplier}x
            </Text>
          </View>
          <View style={styles.multiplierItem}>
            <Text style={[styles.multiplierLabel, { color: colors.textMuted }]}>
              Budget
            </Text>
            <Text
              style={[
                styles.multiplierValue,
                {
                  color:
                    budgetMultiplier >= 1.0
                      ? colors.success
                      : budgetMultiplier >= 0.75
                      ? colors.warning
                      : colors.error,
                },
              ]}
            >
              {budgetMultiplier.toFixed(1)}x
            </Text>
          </View>
          <View style={styles.multiplierItem}>
            <Text style={[styles.multiplierLabel, { color: colors.textMuted }]}>
              Total
            </Text>
            <Text
              style={[
                styles.multiplierValue,
                { color: colors.text, fontWeight: '700' },
              ]}
            >
              {totalMultiplier.toFixed(2)}x
            </Text>
          </View>
        </View>

        {/* Training Focus Selector */}
        <View style={styles.selectorSection}>
          <TrainingFocusSelector
            focus={currentFocus}
            onChange={handleFocusChange}
          />
        </View>

        {/* XP Progress */}
        <View style={styles.xpSection}>
          <Text style={[styles.xpLabel, { color: colors.textMuted }]}>
            XP PROGRESS (TO NEXT IMPROVEMENT)
          </Text>
          <XPProgressDisplay player={player} />
        </View>

        {/* Reset Button */}
        {!isUsingTeamDefault && (
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={onResetToTeam}
          >
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>
              Reset to Team Default
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Growth/Regression Chart */}
      {showGrowthChart && (
        <View style={styles.chartContainer}>
          <GrowthRegressionChart player={player} />
        </View>
      )}
    </ScrollView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  focusDisplay: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  focusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  multipliersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  multiplierItem: {
    alignItems: 'center',
  },
  multiplierLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  multiplierValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectorSection: {
    marginBottom: spacing.lg,
  },
  xpSection: {
    marginBottom: spacing.md,
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  resetButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chartContainer: {
    marginTop: spacing.md,
  },
});

export default TrainingFocusCard;
