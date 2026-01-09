/**
 * XP Progress Display
 *
 * Visualizes training XP progress toward next attribute improvement
 * for each category (Physical/Mental/Technical).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import type { Player } from '../../../data/types';
import {
  PHYSICAL_ATTRIBUTES,
  MENTAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTES,
  calculateXPRequired,
} from '../../../systems/trainingSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_COLORS = {
  physical: '#3B82F6',  // Blue
  mental: '#8B5CF6',    // Purple
  technical: '#10B981', // Green
};

const CATEGORY_LABELS = {
  physical: 'Physical',
  mental: 'Mental',
  technical: 'Technical',
};

// =============================================================================
// TYPES
// =============================================================================

interface XPProgressDisplayProps {
  player: Player;
  compact?: boolean;
}

interface CategoryProgress {
  current: number;
  required: number;
  percentage: number;
  nearCeiling: boolean;
  atCeiling: boolean;
}

type Category = 'physical' | 'mental' | 'technical';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate average attribute value for a category
 */
function calculateCategoryAverage(
  player: Player,
  category: Category
): number {
  const attributes =
    category === 'physical'
      ? PHYSICAL_ATTRIBUTES
      : category === 'mental'
      ? MENTAL_ATTRIBUTES
      : TECHNICAL_ATTRIBUTES;

  // Filter out height for training purposes
  const trainableAttrs = attributes.filter((attr) => attr !== 'height');

  const sum = trainableAttrs.reduce((total, attr) => {
    const value = player.attributes[attr as keyof typeof player.attributes];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);

  return Math.round(sum / trainableAttrs.length);
}

/**
 * Calculate XP progress for a category
 */
function calculateProgress(
  player: Player,
  category: Category
): CategoryProgress {
  const currentXP = player.weeklyXP?.[category] ?? 0;
  const potential = player.potentials?.[category] ?? 70;
  const avgAttribute = calculateCategoryAverage(player, category);

  const required = calculateXPRequired(avgAttribute, potential);
  const percentage = Math.min(100, (currentXP / required) * 100);

  // Near ceiling: within 5 points of potential
  const nearCeiling = avgAttribute >= potential - 5;
  // At ceiling: at or above potential
  const atCeiling = avgAttribute >= potential;

  return {
    current: Math.round(currentXP * 10) / 10,
    required: Math.round(required),
    percentage,
    nearCeiling,
    atCeiling,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function XPProgressDisplay({ player, compact = false }: XPProgressDisplayProps) {
  const colors = useColors();

  // Calculate progress for all categories
  const progress = useMemo(() => {
    return {
      physical: calculateProgress(player, 'physical'),
      mental: calculateProgress(player, 'mental'),
      technical: calculateProgress(player, 'technical'),
    };
  }, [player]);

  const categories: Category[] = ['physical', 'mental', 'technical'];

  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {categories.map((category) => {
        const p = progress[category];
        const categoryColor = CATEGORY_COLORS[category];

        return (
          <View key={category} style={styles.progressRow}>
            {/* Category Label */}
            <View style={styles.labelContainer}>
              <View
                style={[styles.categoryDot, { backgroundColor: categoryColor }]}
              />
              <Text
                style={[
                  compact ? styles.labelCompact : styles.label,
                  { color: colors.text },
                ]}
              >
                {CATEGORY_LABELS[category]}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: colors.surface },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${p.percentage}%`,
                      backgroundColor: p.atCeiling
                        ? colors.warning
                        : categoryColor,
                    },
                  ]}
                />
              </View>

              {/* XP Values */}
              <Text
                style={[
                  compact ? styles.xpTextCompact : styles.xpText,
                  { color: colors.textMuted },
                ]}
              >
                {p.current}/{p.required} XP
              </Text>
            </View>

            {/* Ceiling Warning */}
            {p.atCeiling && (
              <View style={[styles.ceilingBadge, { backgroundColor: colors.warning + '30' }]}>
                <Text style={[styles.ceilingText, { color: colors.warning }]}>
                  CAP
                </Text>
              </View>
            )}
            {p.nearCeiling && !p.atCeiling && (
              <View style={[styles.ceilingBadge, { backgroundColor: colors.textMuted + '20' }]}>
                <Text style={[styles.ceilingText, { color: colors.textMuted }]}>
                  ~CAP
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  containerCompact: {
    gap: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    gap: spacing.xs,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelCompact: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBarContainer: {
    flex: 1,
    gap: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpText: {
    fontSize: 10,
  },
  xpTextCompact: {
    fontSize: 9,
  },
  ceilingBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    minWidth: 35,
    alignItems: 'center',
  },
  ceilingText: {
    fontSize: 9,
    fontWeight: '700',
  },
});

export default XPProgressDisplay;
