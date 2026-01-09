/**
 * Training Suggestions Card
 *
 * Smart analysis of which attributes to train
 * for maximum efficiency, with impact breakdown.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { Player } from '../../../data/types';
import {
  generateTrainingSuggestions,
  getSuggestedTrainingFocus,
  type TrainingSuggestion,
} from '../../../utils/trainingAnalyzer';

// =============================================================================
// TYPES
// =============================================================================

interface TrainingSuggestionsCardProps {
  player: Player;
  /** If true, hide suggestions (for unscouted players) */
  hidden?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingSuggestionsCard({ player, hidden = false }: TrainingSuggestionsCardProps) {
  const colors = useColors();

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (hidden) return [];
    return generateTrainingSuggestions(player, undefined, 5);
  }, [player, hidden]);

  // Get recommended training focus
  const recommendedFocus = useMemo(() => {
    if (hidden) return null;
    return getSuggestedTrainingFocus(player);
  }, [player, hidden]);

  // Category colors
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'physical':
        return '#3B82F6'; // Blue
      case 'mental':
        return '#8B5CF6'; // Purple
      case 'technical':
        return '#10B981'; // Green
      default:
        return colors.textMuted;
    }
  };

  if (hidden) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.title, { color: colors.text }]}>Training Suggestions</Text>
        <View style={styles.hiddenContainer}>
          <Text style={[styles.hiddenText, { color: colors.textMuted }]}>
            Scout this player to reveal training suggestions
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
      {/* Header */}
      <Text style={[styles.title, { color: colors.text }]}>Training Suggestions</Text>

      {/* Recommended Focus */}
      {recommendedFocus && (
        <View style={[styles.focusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.focusLabel, { color: colors.textMuted }]}>
            RECOMMENDED FOCUS
          </Text>
          <View style={styles.focusRow}>
            <FocusBar
              label="Physical"
              value={recommendedFocus.physical}
              color="#3B82F6"
              bgColor={colors.background}
              textColor={colors.text}
            />
            <FocusBar
              label="Mental"
              value={recommendedFocus.mental}
              color="#8B5CF6"
              bgColor={colors.background}
              textColor={colors.text}
            />
            <FocusBar
              label="Technical"
              value={recommendedFocus.technical}
              color="#10B981"
              bgColor={colors.background}
              textColor={colors.text}
            />
          </View>
          <Text style={[styles.focusRationale, { color: colors.textSecondary }]}>
            {recommendedFocus.rationale}
          </Text>
        </View>
      )}

      {/* Suggestions List */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        TOP ATTRIBUTES TO TRAIN
      </Text>

      {suggestions.length === 0 ? (
        <Text style={[styles.noSuggestions, { color: colors.textMuted }]}>
          No clear training priorities - player is well-rounded.
        </Text>
      ) : (
        <View style={styles.suggestionsList}>
          {suggestions.map((suggestion, idx) => (
            <SuggestionItem
              key={suggestion.attribute}
              suggestion={suggestion}
              rank={idx + 1}
              categoryColor={getCategoryColor(suggestion.category)}
              textColor={colors.text}
              mutedColor={colors.textMuted}
              primaryColor={colors.primary}
              bgColor={colors.surface}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface FocusBarProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  textColor: string;
}

function FocusBar({ label, value, color, bgColor, textColor }: FocusBarProps) {
  return (
    <View style={styles.focusItem}>
      <Text style={[styles.focusItemLabel, { color: textColor }]}>{label}</Text>
      <View style={[styles.focusBarBg, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.focusBarFill,
            { backgroundColor: color, width: `${value}%` },
          ]}
        />
      </View>
      <Text style={[styles.focusItemValue, { color }]}>{value}%</Text>
    </View>
  );
}

interface SuggestionItemProps {
  suggestion: TrainingSuggestion;
  rank: number;
  categoryColor: string;
  textColor: string;
  mutedColor: string;
  primaryColor: string;
  bgColor: string;
}

function SuggestionItem({
  suggestion,
  rank,
  categoryColor,
  textColor,
  mutedColor,
  primaryColor,
  bgColor,
}: SuggestionItemProps) {
  // Format potential usage as a progress indicator
  const potentialPct = Math.round(suggestion.potentialUsed * 100);
  const isNearCeiling = potentialPct > 90;

  return (
    <View style={[styles.suggestionItem, { backgroundColor: bgColor }]}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionTitleRow}>
          <View style={[styles.rankBadge, { backgroundColor: primaryColor }]}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
          <Text style={[styles.suggestionName, { color: textColor }]}>
            {suggestion.displayName}
          </Text>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        </View>
        <Text style={[styles.currentValue, { color: primaryColor }]}>
          {suggestion.currentValue}
        </Text>
      </View>

      {/* Impact by sport */}
      <View style={styles.impactRow}>
        {suggestion.affectedSports.map((sport) => (
          <View key={sport.sport} style={styles.sportImpact}>
            <Text style={[styles.sportLabel, { color: mutedColor }]}>
              {sport.sport.charAt(0).toUpperCase() + sport.sport.slice(1)}
            </Text>
            <Text style={[styles.sportImprovement, { color: textColor }]}>
              +{sport.projectedImprovement.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Potential warning */}
      {isNearCeiling && (
        <Text style={[styles.ceilingWarning, { color: mutedColor }]}>
          {potentialPct >= 100 ? 'At ceiling - gains will be slow' : `${potentialPct}% to ceiling`}
        </Text>
      )}

      {/* Rationale */}
      <Text style={[styles.rationale, { color: mutedColor }]} numberOfLines={2}>
        {suggestion.rationale}
      </Text>
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  // Focus section
  focusCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  focusRow: {
    gap: spacing.sm,
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focusItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    width: 70,
  },
  focusBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  focusBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  focusItemValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  focusRationale: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  // Suggestions
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  noSuggestions: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  suggestionsList: {
    gap: spacing.sm,
  },
  suggestionItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  impactRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  sportImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sportLabel: {
    fontSize: 10,
  },
  sportImprovement: {
    fontSize: 12,
    fontWeight: '600',
  },
  ceilingWarning: {
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  rationale: {
    fontSize: 11,
  },
  hiddenContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  hiddenText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default TrainingSuggestionsCard;
