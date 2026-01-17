/**
 * Player Training Panel
 *
 * Unified training interface for individual players.
 * Combines focus selection, progress tracking, career trajectory,
 * and training suggestions into a cohesive, premium UI.
 *
 * Design: "Sports Broadcast Premium" - clean, data-forward,
 * with sport-specific accent colors and progressive disclosure.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import type { Player, NewTrainingFocus, SkillFocusType } from '../../../data/types';
import { isNewTrainingFocus } from '../../../data/types';
import { getAgeMultiplier } from '../../../systems/trainingSystem';
import {
  createBalancedFocus,
  getSkillsForSport,
} from '../../../utils/trainingFocusMapper';
import {
  generateTrainingSuggestions,
  type TrainingSuggestion,
} from '../../../utils/trainingAnalyzer';
import {
  PEAK_AGES,
  DECLINE_START_OFFSET,
  calculateRegressionChance,
} from '../../../systems/playerProgressionSystem';
import { calculateAllOveralls } from '../../../utils/overallRating';
import { calculateAllSkills } from '../../../utils/skillComposites';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// CONSTANTS
// =============================================================================

type SportType = 'basketball' | 'baseball' | 'soccer';
type FocusLevel = 'balanced' | 'sport' | 'skill';

const SPORT_CONFIG: Record<SportType, { icon: string; color: string; label: string }> = {
  basketball: { icon: '🏀', color: '#FF6B35', label: 'Basketball' },
  baseball: { icon: '⚾', color: '#3B82F6', label: 'Baseball' },
  soccer: { icon: '⚽', color: '#10B981', label: 'Soccer' },
};

const CATEGORY_COLORS = {
  physical: '#3B82F6',
  mental: '#8B5CF6',
  technical: '#10B981',
};

// =============================================================================
// TYPES
// =============================================================================

interface PlayerTrainingPanelProps {
  player: Player;
  teamFocus: NewTrainingFocus;
  onFocusChange: (focus: NewTrainingFocus) => void;
  onResetToTeam: () => void;
  budgetMultiplier?: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeToNewFocus(focus: any): NewTrainingFocus {
  if (!focus) return createBalancedFocus();
  if (isNewTrainingFocus(focus)) return focus;
  return createBalancedFocus();
}

function getEffectivenessLevel(multiplier: number): { label: string; color: string } {
  if (multiplier >= 1.5) return { label: 'Elite', color: '#10B981' };
  if (multiplier >= 1.0) return { label: 'Good', color: '#3B82F6' };
  if (multiplier >= 0.7) return { label: 'Average', color: '#F59E0B' };
  return { label: 'Poor', color: '#EF4444' };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PlayerTrainingPanel({
  player,
  teamFocus,
  onFocusChange,
  onResetToTeam,
  budgetMultiplier = 1.0,
}: PlayerTrainingPanelProps) {
  const colors = useColors();
  const [showChart, setShowChart] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Normalize focus
  const normalizedTeamFocus = useMemo(() => normalizeToNewFocus(teamFocus), [teamFocus]);
  const currentFocus = useMemo(
    () => normalizeToNewFocus(player.trainingFocus) ?? normalizedTeamFocus,
    [player.trainingFocus, normalizedTeamFocus]
  );
  const isUsingTeamDefault = player.trainingFocus === null || player.trainingFocus === undefined;

  // Calculate multipliers
  const ageMultiplier = useMemo(() => getAgeMultiplier(player.age), [player.age]);
  const totalMultiplier = budgetMultiplier * ageMultiplier;
  const effectiveness = getEffectivenessLevel(totalMultiplier);

  // Training suggestions (top 3 only)
  const suggestions = useMemo(() => {
    return generateTrainingSuggestions(player, undefined, 3);
  }, [player]);

  // Current sport for accent color
  const activeSport = currentFocus.sport || 'basketball';
  const accentColor = currentFocus.level === 'balanced'
    ? colors.primary
    : SPORT_CONFIG[activeSport].color;

  // Handlers
  const handleLevelChange = useCallback((level: FocusLevel) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (level === 'balanced') {
      onFocusChange({ level: 'balanced' });
    } else if (level === 'sport') {
      onFocusChange({ level: 'sport', sport: activeSport });
    } else {
      const skills = getSkillsForSport(activeSport);
      const defaultSkill = skills[0] || 'Shooting';
      onFocusChange({
        level: 'skill',
        sport: activeSport,
        skill: { sport: activeSport, skill: defaultSkill } as SkillFocusType,
      });
    }
  }, [activeSport, onFocusChange]);

  const handleSportChange = useCallback((sport: SportType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (currentFocus.level === 'skill') {
      const skills = getSkillsForSport(sport);
      const defaultSkill = skills[0] || 'Shooting';
      onFocusChange({
        level: 'skill',
        sport,
        skill: { sport, skill: defaultSkill } as SkillFocusType,
      });
    } else {
      onFocusChange({ level: 'sport', sport });
    }
  }, [currentFocus.level, onFocusChange]);

  const handleSkillChange = useCallback((skill: string) => {
    onFocusChange({
      level: 'skill',
      sport: activeSport,
      skill: { sport: activeSport, skill } as SkillFocusType,
    });
  }, [activeSport, onFocusChange]);

  const toggleChart = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowChart(prev => !prev);
  }, []);

  const toggleSuggestions = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowSuggestions(prev => !prev);
  }, []);

  // Skills for current sport
  const availableSkills = useMemo(() => getSkillsForSport(activeSport), [activeSport]);

  // Sport overalls for display
  const sportOveralls = useMemo(() => calculateAllOveralls(player), [player]);

  // Skill ratings for current sport
  const skillRatings = useMemo(() => {
    const skills = calculateAllSkills(player.attributes, activeSport);
    return Object.fromEntries(skills.map(s => [s.name, s.value]));
  }, [player.attributes, activeSport]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* ================================================================== */}
      {/* HEADER: Training Power Gauge */}
      {/* ================================================================== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Training</Text>
          {!isUsingTeamDefault && (
            <View style={[styles.customBadge, { backgroundColor: accentColor + '30' }]}>
              <Text style={[styles.customBadgeText, { color: accentColor }]}>Custom</Text>
            </View>
          )}
        </View>
        <View style={styles.powerGauge}>
          <View style={[styles.powerBar, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.powerFill,
                {
                  backgroundColor: effectiveness.color,
                  width: `${Math.min(100, totalMultiplier * 50)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.powerLabel, { color: effectiveness.color }]}>
            {totalMultiplier.toFixed(1)}x {effectiveness.label}
          </Text>
        </View>
      </View>

      {/* ================================================================== */}
      {/* FOCUS LEVEL SELECTOR */}
      {/* ================================================================== */}
      <View style={styles.section}>
        <View style={[styles.levelSelector, { backgroundColor: colors.surface }]}>
          {(['balanced', 'sport', 'skill'] as FocusLevel[]).map((level) => {
            const isActive = currentFocus.level === level;
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelButton,
                  isActive && { backgroundColor: accentColor },
                ]}
                onPress={() => handleLevelChange(level)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.levelButtonText,
                    { color: isActive ? '#000' : colors.textMuted },
                    isActive && styles.levelButtonTextActive,
                  ]}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ================================================================== */}
      {/* SPORT SELECTOR (when sport or skill level) */}
      {/* ================================================================== */}
      {(currentFocus.level === 'sport' || currentFocus.level === 'skill') && (
        <View style={styles.section}>
          <View style={styles.sportRow}>
            {(Object.keys(SPORT_CONFIG) as SportType[]).map((sport) => {
              const config = SPORT_CONFIG[sport];
              const isActive = activeSport === sport;
              const sportRating = sportOveralls[sport];
              return (
                <TouchableOpacity
                  key={sport}
                  style={[
                    styles.sportButton,
                    { borderColor: isActive ? config.color : colors.border },
                    isActive && { backgroundColor: config.color + '20' },
                  ]}
                  onPress={() => handleSportChange(sport)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sportIcon}>{config.icon}</Text>
                  <Text
                    style={[
                      styles.sportLabel,
                      { color: isActive ? config.color : colors.textMuted },
                    ]}
                  >
                    {config.label}
                  </Text>
                  <Text
                    style={[
                      styles.sportRating,
                      { color: isActive ? config.color : colors.textMuted },
                    ]}
                  >
                    {sportRating}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ================================================================== */}
      {/* SKILL SELECTOR (when skill level) */}
      {/* ================================================================== */}
      {currentFocus.level === 'skill' && (
        <View style={styles.section}>
          <View style={styles.skillGrid}>
            {availableSkills.map((skill) => {
              const isActive = currentFocus.skill?.skill === skill;
              const rating = skillRatings[skill] ?? 0;
              return (
                <TouchableOpacity
                  key={skill}
                  style={[
                    styles.skillChip,
                    { borderColor: isActive ? accentColor : colors.border },
                    isActive && { backgroundColor: accentColor + '20' },
                  ]}
                  onPress={() => handleSkillChange(skill)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.skillChipText,
                      { color: isActive ? accentColor : colors.text },
                    ]}
                  >
                    {skill}
                  </Text>
                  <Text
                    style={[
                      styles.skillChipRating,
                      { color: isActive ? accentColor : colors.textMuted },
                    ]}
                  >
                    {rating}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ================================================================== */}
      {/* FOCUS DESCRIPTION */}
      {/* ================================================================== */}
      <View style={[styles.focusDescription, { backgroundColor: colors.surface }]}>
        <Text style={[styles.focusDescriptionText, { color: colors.textSecondary }]}>
          {currentFocus.level === 'balanced' && 'Training evenly across all attributes'}
          {currentFocus.level === 'sport' && `Training weighted for ${SPORT_CONFIG[activeSport].label} performance`}
          {currentFocus.level === 'skill' && `Focused training on ${currentFocus.skill?.skill} attributes`}
        </Text>
      </View>

      {/* ================================================================== */}
      {/* CAREER TRAJECTORY (collapsible) */}
      {/* ================================================================== */}
      <TouchableOpacity
        style={[styles.expandableHeader, { borderTopColor: colors.border }]}
        onPress={toggleChart}
        activeOpacity={0.7}
      >
        <Text style={[styles.expandableTitle, { color: colors.text }]}>
          Career Trajectory
        </Text>
        <View style={styles.expandableRight}>
          <MiniSparkline player={player} color={accentColor} />
          <Text style={[styles.expandableArrow, { color: colors.textMuted }]}>
            {showChart ? '▲' : '▼'}
          </Text>
        </View>
      </TouchableOpacity>

      {showChart && (
        <View style={styles.chartContainer}>
          <CareerChart player={player} colors={colors} accentColor={accentColor} />
        </View>
      )}

      {/* ================================================================== */}
      {/* TRAINING SUGGESTIONS (collapsible) */}
      {/* ================================================================== */}
      <TouchableOpacity
        style={[styles.expandableHeader, { borderTopColor: colors.border }]}
        onPress={toggleSuggestions}
        activeOpacity={0.7}
      >
        <Text style={[styles.expandableTitle, { color: colors.text }]}>
          Priority Attributes
        </Text>
        <View style={styles.expandableRight}>
          <View style={styles.suggestionPreview}>
            {suggestions.slice(0, 3).map((s) => (
              <View
                key={s.attribute}
                style={[
                  styles.suggestionDot,
                  { backgroundColor: CATEGORY_COLORS[s.category as keyof typeof CATEGORY_COLORS] || colors.textMuted },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.expandableArrow, { color: colors.textMuted }]}>
            {showSuggestions ? '▲' : '▼'}
          </Text>
        </View>
      </TouchableOpacity>

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {suggestions.length === 0 ? (
            <Text style={[styles.noSuggestions, { color: colors.textMuted }]}>
              Player is well-rounded - no clear priorities
            </Text>
          ) : (
            suggestions.map((suggestion, idx) => (
              <SuggestionRow
                key={suggestion.attribute}
                suggestion={suggestion}
                rank={idx + 1}
                colors={colors}
              />
            ))
          )}
        </View>
      )}

      {/* ================================================================== */}
      {/* RESET BUTTON */}
      {/* ================================================================== */}
      {!isUsingTeamDefault && (
        <TouchableOpacity
          style={[styles.resetButton, { borderColor: colors.border }]}
          onPress={onResetToTeam}
          activeOpacity={0.7}
        >
          <Text style={[styles.resetButtonText, { color: colors.textMuted }]}>
            Reset to Team Default
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MiniSparklineProps {
  player: Player;
  color: string;
}

function MiniSparkline({ player, color }: MiniSparklineProps) {
  // Simple representation: current rating as dots
  const attrs = player.attributes as unknown as Record<string, number>;
  const overall = Math.round(
    (Object.values(attrs).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) /
      Object.values(attrs).filter(v => typeof v === 'number').length)
  );
  const peakAge = PEAK_AGES.technical;
  const isPastPeak = player.age > peakAge + DECLINE_START_OFFSET;

  return (
    <View style={styles.sparklineContainer}>
      <View style={[styles.sparklineDot, { backgroundColor: color, opacity: 0.4 }]} />
      <View style={[styles.sparklineDot, { backgroundColor: color, opacity: 0.6 }]} />
      <View style={[styles.sparklineDot, { backgroundColor: color }]} />
      <View
        style={[
          styles.sparklineDot,
          { backgroundColor: isPastPeak ? '#EF4444' : color, opacity: isPastPeak ? 0.8 : 0.6 },
        ]}
      />
      <Text style={[styles.sparklineValue, { color }]}>{overall}</Text>
    </View>
  );
}

interface CareerChartProps {
  player: Player;
  colors: ReturnType<typeof useColors>;
  accentColor: string;
}

function CareerChart({ player, colors, accentColor }: CareerChartProps) {
  const attrs = player.attributes as unknown as Record<string, number>;
  const currentOverall = Math.round(
    Object.values(attrs).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) /
      Object.values(attrs).filter(v => typeof v === 'number').length
  );

  const peakAge = PEAK_AGES.technical;
  const projectedColor = '#9CA3AF'; // Gray for projected

  // Generate projection points
  const points: { age: number; value: number; isProjected: boolean }[] = [];

  // Add past/current
  for (let age = Math.max(16, player.age - 5); age <= player.age; age++) {
    const yearsFromCurrent = player.age - age;
    // Rough estimation of past values
    const pastValue = Math.max(30, currentOverall - yearsFromCurrent * 2);
    points.push({ age, value: age === player.age ? currentOverall : pastValue, isProjected: false });
  }

  // Add projections
  let projectedValue = currentOverall;
  for (let age = player.age + 1; age <= Math.min(40, player.age + 8); age++) {
    const regressionChance = calculateRegressionChance(age, peakAge);
    if (regressionChance > 0) {
      projectedValue = Math.max(30, projectedValue - regressionChance * 1.4 * 52 / 4);
    }
    points.push({ age, value: Math.round(projectedValue), isProjected: true });
  }

  const minAge = points[0]?.age || 16;
  const maxAge = points[points.length - 1]?.age || 40;

  // Dynamic Y-axis: round max up to nearest 10, min down to nearest 10
  const rawMaxValue = Math.max(...points.map(p => p.value));
  const rawMinValue = Math.min(...points.map(p => p.value));
  const maxValue = Math.ceil(rawMaxValue / 10) * 10;
  const minValue = Math.floor(rawMinValue / 10) * 10;
  const midValue = Math.round((maxValue + minValue) / 2);

  return (
    <View style={styles.chartWrapper}>
      {/* Legend */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotSolid, { backgroundColor: accentColor }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Actual</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotHollow, { borderColor: projectedColor }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Projected</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {/* Y-axis labels */}
        <View style={styles.chartYAxis}>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>{maxValue}</Text>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>{midValue}</Text>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>{minValue}</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          <View style={[styles.chartGridLine, { backgroundColor: colors.border, top: '0%' }]} />
          <View style={[styles.chartGridLine, { backgroundColor: colors.border, top: '50%' }]} />
          <View style={[styles.chartGridLine, { backgroundColor: colors.border, top: '100%' }]} />

          {/* Data points */}
          {points.map((point, idx) => {
            const x = ((point.age - minAge) / (maxAge - minAge)) * 100;
            const y = ((maxValue - point.value) / (maxValue - minValue)) * 100;
            const isCurrentAge = point.age === player.age;

            return (
              <View
                key={idx}
                style={[
                  styles.chartPoint,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    backgroundColor: point.isProjected ? 'transparent' : accentColor,
                    borderColor: point.isProjected ? projectedColor : accentColor,
                    borderWidth: point.isProjected ? 1.5 : 0,
                    width: isCurrentAge ? 10 : 6,
                    height: isCurrentAge ? 10 : 6,
                    marginLeft: isCurrentAge ? -5 : -3,
                    marginTop: isCurrentAge ? -5 : -3,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={styles.chartXAxis}>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>{minAge}</Text>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>Age</Text>
          <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>{maxAge}</Text>
        </View>
      </View>
    </View>
  );
}

interface SuggestionRowProps {
  suggestion: TrainingSuggestion;
  rank: number;
  colors: ReturnType<typeof useColors>;
}

function SuggestionRow({ suggestion, rank, colors }: SuggestionRowProps) {
  const categoryColor = CATEGORY_COLORS[suggestion.category as keyof typeof CATEGORY_COLORS] || colors.textMuted;
  const potentialPct = Math.round(suggestion.potentialUsed * 100);
  const isNearCeiling = potentialPct > 90;

  return (
    <View style={[styles.suggestionRow, { backgroundColor: colors.surface }]}>
      <View style={styles.suggestionLeft}>
        <View style={[styles.suggestionRank, { backgroundColor: categoryColor }]}>
          <Text style={styles.suggestionRankText}>{rank}</Text>
        </View>
        <View style={styles.suggestionInfo}>
          <Text style={[styles.suggestionName, { color: colors.text }]}>
            {suggestion.displayName}
          </Text>
          {isNearCeiling && (
            <Text style={[styles.suggestionCeiling, { color: colors.warning }]}>
              {potentialPct >= 100 ? 'At ceiling' : `${potentialPct}% to cap`}
            </Text>
          )}
        </View>
      </View>
      <Text style={[styles.suggestionValue, { color: categoryColor }]}>
        {suggestion.currentValue}
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
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  customBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  powerGauge: {
    alignItems: 'flex-end',
    gap: 4,
  },
  powerBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  powerFill: {
    height: '100%',
    borderRadius: 2,
  },
  powerLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Sections
  section: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Level selector
  levelSelector: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
  },
  levelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md - 2,
    alignItems: 'center',
  },
  levelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  levelButtonTextActive: {
    fontWeight: '700',
  },

  // Sport selector
  sportRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sportButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  sportIcon: {
    fontSize: 16,
  },
  sportLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sportRating: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Skill selector
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  skillChipRating: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Focus description
  focusDescription: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  focusDescriptionText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Expandable sections
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  expandableTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  expandableRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expandableArrow: {
    fontSize: 10,
  },

  // Sparkline
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sparklineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  sparklineValue: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },

  // Suggestion preview dots
  suggestionPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  suggestionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Chart
  chartContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chartWrapper: {
    gap: spacing.sm,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDotSolid: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotHollow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chart: {
    flexDirection: 'row',
    height: 120,
  },
  chartYAxis: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  chartAxisLabel: {
    fontSize: 9,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  chartPoint: {
    position: 'absolute',
    borderRadius: 999,
  },
  chartXAxis: {
    position: 'absolute',
    bottom: -16,
    left: 30,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Suggestions
  suggestionsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  noSuggestions: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestionRank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionRankText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionInfo: {
    gap: 2,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionCeiling: {
    fontSize: 10,
  },
  suggestionValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Reset button
  resetButton: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default PlayerTrainingPanel;
