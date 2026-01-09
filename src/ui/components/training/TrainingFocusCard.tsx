/**
 * Training Focus Card
 *
 * Card component for managing individual player training focus.
 * Includes sliders, presets, and team default indicator.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import { TrainingFocusSlider } from './TrainingFocusSlider';
import { XPProgressDisplay } from './XPProgressDisplay';
import type { Player } from '../../../data/types';
import type { TrainingFocus } from '../../../systems/trainingSystem';
import { DEFAULT_TRAINING_FOCUS, getAgeMultiplier } from '../../../systems/trainingSystem';
import { getSuggestedTrainingFocus } from '../../../utils/trainingAnalyzer';

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESETS: { label: string; focus: TrainingFocus }[] = [
  { label: 'Balanced', focus: { physical: 34, mental: 33, technical: 33 } },
  { label: 'Physical', focus: { physical: 50, mental: 25, technical: 25 } },
  { label: 'Mental', focus: { physical: 25, mental: 50, technical: 25 } },
  { label: 'Technical', focus: { physical: 25, mental: 25, technical: 50 } },
];

// =============================================================================
// TYPES
// =============================================================================

interface TrainingFocusCardProps {
  player: Player;
  teamFocus: TrainingFocus;
  onFocusChange: (focus: TrainingFocus) => void;
  onResetToTeam: () => void;
  /** Training quality multiplier from budget (0.5 to 2.0) */
  budgetMultiplier?: number;
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
}: TrainingFocusCardProps) {
  const colors = useColors();

  // Determine current focus (player-specific or team default)
  const currentFocus = useMemo(
    () => player.trainingFocus ?? teamFocus ?? DEFAULT_TRAINING_FOCUS,
    [player.trainingFocus, teamFocus]
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

  // Get recommended training focus
  const recommendedFocus = useMemo(() => {
    return getSuggestedTrainingFocus(player);
  }, [player]);

  // Check if current focus matches recommendations
  const isUsingRecommended = useMemo(() => {
    return (
      currentFocus.physical === recommendedFocus.physical &&
      currentFocus.mental === recommendedFocus.mental &&
      currentFocus.technical === recommendedFocus.technical
    );
  }, [currentFocus, recommendedFocus]);

  // Handle preset selection
  const handlePresetPress = useCallback(
    (preset: TrainingFocus) => {
      onFocusChange(preset);
    },
    [onFocusChange]
  );

  // Apply recommended focus
  const handleApplyRecommendations = useCallback(() => {
    onFocusChange({
      physical: recommendedFocus.physical,
      mental: recommendedFocus.mental,
      technical: recommendedFocus.technical,
    });
  }, [onFocusChange, recommendedFocus]);

  return (
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

      {/* Training Focus Sliders */}
      <View style={styles.slidersSection}>
        <TrainingFocusSlider focus={currentFocus} onChange={onFocusChange} />
      </View>

      {/* Apply Recommendations Button */}
      <TouchableOpacity
        style={[
          styles.recommendButton,
          {
            backgroundColor: isUsingRecommended
              ? colors.success + '20'
              : colors.primary,
            borderColor: isUsingRecommended ? colors.success : colors.primary,
          },
        ]}
        onPress={handleApplyRecommendations}
        disabled={isUsingRecommended}
      >
        <Text
          style={[
            styles.recommendButtonText,
            { color: isUsingRecommended ? colors.success : '#FFFFFF' },
          ]}
        >
          {isUsingRecommended ? 'Using Recommended' : 'Apply Recommendations'}
        </Text>
        {!isUsingRecommended && (
          <Text style={[styles.recommendHint, { color: 'rgba(255,255,255,0.7)' }]}>
            {recommendedFocus.physical}% / {recommendedFocus.mental}% / {recommendedFocus.technical}%
          </Text>
        )}
      </TouchableOpacity>

      {/* Presets */}
      <View style={styles.presetsSection}>
        <Text style={[styles.presetsLabel, { color: colors.textMuted }]}>
          PRESETS
        </Text>
        <View style={styles.presetsRow}>
          {PRESETS.map((preset) => {
            const isActive =
              currentFocus.physical === preset.focus.physical &&
              currentFocus.mental === preset.focus.mental &&
              currentFocus.technical === preset.focus.technical;

            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  {
                    backgroundColor: isActive
                      ? colors.primary + '20'
                      : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handlePresetPress(preset.focus)}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isActive ? colors.primary : colors.text },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
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
  slidersSection: {
    marginBottom: spacing.md,
  },
  recommendButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recommendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendHint: {
    fontSize: 11,
    marginTop: 2,
  },
  presetsSection: {
    marginBottom: spacing.lg,
  },
  presetsLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '500',
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
});

export default TrainingFocusCard;
