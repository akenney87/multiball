/**
 * Player Card Component
 *
 * Reusable compact player display for:
 * - Roster lists
 * - Lineup slots
 * - Top performers
 * - Transfer targets
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';

export interface PlayerCardData {
  id: string;
  name: string;
  overall: number;
  age: number;
  salary?: number;
  isInjured?: boolean;
  // Match fitness (0-100)
  matchFitness?: number;
  // Sport-specific overalls
  basketballOvr?: number;
  baseballOvr?: number;
  soccerOvr?: number;
  // Key attributes for sorting
  height?: number;
  top_speed?: number;
  core_strength?: number;
  agility?: number;
  stamina?: number;
  awareness?: number;
}

interface PlayerCardProps {
  player: PlayerCardData;
  variant?: 'default' | 'compact' | 'detailed';
  showSalary?: boolean;
  onPress?: (player: PlayerCardData) => void;
}

export function PlayerCard({
  player,
  variant = 'default',
  showSalary = false,
  onPress,
}: PlayerCardProps) {
  const colors = useColors();

  // Color scale for overalls - avoids red (error) since low skill isn't an "error"
  const getOverallColor = (overall: number) => {
    if (overall >= 80) return colors.success;   // Elite - green
    if (overall >= 70) return colors.primary;   // Good - primary accent
    if (overall >= 55) return colors.warning;   // Average - amber
    return colors.textMuted;                    // Developing - muted
  };

  // Get fitness warning level
  const getFitnessWarning = (fitness?: number) => {
    if (!fitness || fitness >= 75) return null;
    if (fitness >= 50) return { color: colors.warning, label: 'FTG' };
    return { color: colors.error, label: 'EXH' };
  };

  const fitnessWarning = getFitnessWarning(player.matchFitness);

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    return `$${(salary / 1000).toFixed(0)}K`;
  };

  const content = (
    <View
      style={[
        styles.container,
        variant === 'compact' && styles.containerCompact,
        { backgroundColor: colors.card },
        shadows.sm,
      ]}
    >
      {/* Player info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              variant === 'compact' && styles.nameCompact,
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {player.name}
          </Text>
          {player.isInjured && (
            <View style={[styles.injuryBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.injuryText}>INJ</Text>
            </View>
          )}
          {!player.isInjured && fitnessWarning && (
            <View style={[styles.injuryBadge, { backgroundColor: fitnessWarning.color }]}>
              <Text style={styles.injuryText}>{fitnessWarning.label}</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsRow}>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Age {player.age}
          </Text>
          {showSalary && player.salary && (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              {formatSalary(player.salary)}
            </Text>
          )}
        </View>
      </View>

      {/* Sport-specific overalls */}
      <View style={styles.sportOverallsContainer}>
        {player.basketballOvr !== undefined && (
          <View style={styles.sportOverall}>
            <Text style={[styles.sportOverallValue, { color: getOverallColor(player.basketballOvr) }]}>
              {player.basketballOvr}
            </Text>
            <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>BBL</Text>
          </View>
        )}
        {player.baseballOvr !== undefined && (
          <View style={styles.sportOverall}>
            <Text style={[styles.sportOverallValue, { color: getOverallColor(player.baseballOvr) }]}>
              {player.baseballOvr}
            </Text>
            <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>BSB</Text>
          </View>
        )}
        {player.soccerOvr !== undefined && (
          <View style={styles.sportOverall}>
            <Text style={[styles.sportOverallValue, { color: getOverallColor(player.soccerOvr) }]}>
              {player.soccerOvr}
            </Text>
            <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>SOC</Text>
          </View>
        )}
      </View>

      {/* Overall rating */}
      <View style={styles.ratingContainer}>
        <Text style={[styles.rating, { color: getOverallColor(player.overall) }]}>
          {player.overall}
        </Text>
        <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>OVR</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(player)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  containerCompact: {
    padding: spacing.sm,
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  nameCompact: {
    fontSize: 14,
  },
  injuryBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  injuryText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detail: {
    fontSize: 12,
  },
  sportOverallsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  sportOverall: {
    alignItems: 'center',
    minWidth: 32,
  },
  sportOverallValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sportOverallLabel: {
    fontSize: 8,
    fontWeight: '500',
  },
  ratingContainer: {
    alignItems: 'center',
    marginLeft: spacing.md,
    minWidth: 36,
  },
  rating: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingLabel: {
    fontSize: 8,
    fontWeight: '500',
  },
});

export default PlayerCard;
