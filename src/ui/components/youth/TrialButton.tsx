/**
 * Trial Button Component
 *
 * Button for holding youth academy trials with cooldown timer.
 * Shows cost and remaining cooldown weeks.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {
  useColors,
  spacing,
  borderRadius,
  glowShadows,
  textStyles,
} from '../../theme';
import {
  TRIAL_COST,
  canHoldTrial,
} from '../../../systems/youthAcademySystem';

interface TrialButtonProps {
  lastTrialWeek: number;
  currentWeek: number;
  availableBudget: number;
  onPress: () => void;
  style?: ViewStyle;
}

export function TrialButton({
  lastTrialWeek,
  currentWeek,
  availableBudget,
  onPress,
  style,
}: TrialButtonProps) {
  const colors = useColors();
  const { canHold, weeksRemaining } = canHoldTrial(
    lastTrialWeek,
    currentWeek,
    availableBudget
  );

  const formattedCost = `$${(TRIAL_COST / 1000).toFixed(0)}K`;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: canHold ? colors.primary : colors.surface,
          borderColor: canHold ? colors.primary : colors.border,
        },
        canHold && glowShadows.primary,
        style,
      ]}
      onPress={onPress}
      disabled={!canHold}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: canHold ? colors.textInverse : colors.textMuted },
          ]}
        >
          HOLD TRIAL
        </Text>

        {canHold ? (
          <Text
            style={[
              styles.cost,
              { color: colors.textInverse + 'CC' },
            ]}
          >
            {formattedCost}
          </Text>
        ) : (
          <View style={styles.cooldownContainer}>
            {weeksRemaining > 0 ? (
              <>
                <View style={[styles.cooldownIcon, { backgroundColor: colors.warning }]} />
                <Text style={[styles.cooldownText, { color: colors.warning }]}>
                  {weeksRemaining}w remaining
                </Text>
              </>
            ) : (
              <Text style={[styles.cooldownText, { color: colors.error }]}>
                Need {formattedCost}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 120,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    ...textStyles.buttonSmall,
    marginBottom: 2,
  },
  cost: {
    fontSize: 11,
    fontWeight: '500',
  },
  cooldownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cooldownIcon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cooldownText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default TrialButton;
