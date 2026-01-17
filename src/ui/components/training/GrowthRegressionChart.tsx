/**
 * Growth/Regression Chart
 *
 * Displays a career trajectory chart showing:
 * - Historical attribute snapshots (past)
 * - Current values
 * - Projected future trajectory based on peak ages and regression
 *
 * Category colors:
 * - Physical: Blue (#3B82F6)
 * - Mental: Purple (#8B5CF6)
 * - Technical: Green (#10B981)
 * - Overall: Cyan (#06B6D4)
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import { SegmentControl, type Segment } from '../common/SegmentControl';
import type { Player, AttributeSnapshot, PlayerAttributes } from '../../../data/types';
import {
  PEAK_AGES,
  DECLINE_START_OFFSET,
  calculateRegressionChance,
  calculateCategoryAverage,
} from '../../../systems/playerProgressionSystem';
import { calculateSimpleOverall } from '../../../utils/overallRating';

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_COLORS = {
  physical: '#3B82F6',  // Blue
  mental: '#8B5CF6',    // Purple
  technical: '#10B981', // Green
  overall: '#06B6D4',   // Cyan
};

const CATEGORY_SEGMENTS: Segment<CategoryType>[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'physical', label: 'Physical' },
  { key: 'mental', label: 'Mental' },
  { key: 'technical', label: 'Technical' },
];

// Chart dimensions
const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const Y_MIN = 30;
const Y_MAX = 100;
const Y_RANGE = Y_MAX - Y_MIN;

// Projection settings
const PROJECTION_YEARS = 8; // Project 8 years into the future

type CategoryType = 'physical' | 'mental' | 'technical' | 'overall';

// =============================================================================
// TYPES
// =============================================================================

interface GrowthRegressionChartProps {
  player: Player;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface DataPoint {
  age: number;
  value: number;
  isProjected: boolean;
  isPeak?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get peak age for a category (including overall)
 */
function getCategoryPeakAge(category: CategoryType): number {
  if (category === 'overall') {
    // Overall peaks around technical peak
    return PEAK_AGES.technical;
  }
  return PEAK_AGES[category];
}

/**
 * Get decline start age for a category
 */
function getDeclineStartAge(category: CategoryType): number {
  return getCategoryPeakAge(category) + DECLINE_START_OFFSET;
}

/**
 * Convert PlayerAttributes to Record<string, number> for calculations
 */
function attrsToRecord(attrs: PlayerAttributes): Record<string, number> {
  return attrs as unknown as Record<string, number>;
}

/**
 * Calculate current category value for a player
 */
function getCurrentCategoryValue(
  player: Player,
  category: CategoryType
): number {
  const attrs = attrsToRecord(player.attributes);

  if (category === 'overall') {
    // Use simple overall as the default
    return calculateSimpleOverall(player.attributes);
  }

  return calculateCategoryAverage(attrs, category);
}

/**
 * Calculate projected value for a future age
 * Uses regression probability to estimate decline
 */
function projectValue(
  currentValue: number,
  currentAge: number,
  targetAge: number,
  category: CategoryType
): number {
  if (targetAge <= currentAge) return currentValue;

  const peakAge = getCategoryPeakAge(category);
  let value = currentValue;

  // Simulate year by year
  for (let age = currentAge + 1; age <= targetAge; age++) {
    const regressionChance = calculateRegressionChance(age, peakAge);

    if (regressionChance > 0) {
      // Expected decline per year = chance * average regression (1.4 points)
      // But we apply it weekly, so multiply by ~52 weeks
      // However, for display purposes, we simplify to per-year
      const expectedDeclinePerYear = regressionChance * 1.4 * 52;
      value = Math.max(Y_MIN, value - expectedDeclinePerYear);
    }
  }

  return Math.round(value);
}

/**
 * Generate data points from history and projection
 */
function generateDataPoints(
  player: Player,
  category: CategoryType
): DataPoint[] {
  const points: DataPoint[] = [];
  const currentValue = getCurrentCategoryValue(player, category);
  const peakAge = getCategoryPeakAge(category);
  const declineStartAge = getDeclineStartAge(category);

  // Add historical points from attributeHistory
  if (player.attributeHistory && player.attributeHistory.length > 0) {
    // Group by season and take last snapshot per season for cleaner display
    const historyByAge: Map<number, AttributeSnapshot> = new Map();

    for (const snapshot of player.attributeHistory) {
      // Estimate age from season (rough approximation)
      const estimatedAge = player.age - (snapshot.season - 1);
      if (!historyByAge.has(estimatedAge) || historyByAge.get(estimatedAge)!.gameDay < snapshot.gameDay) {
        historyByAge.set(estimatedAge, snapshot);
      }
    }

    // Convert to data points
    for (const [age, snapshot] of historyByAge) {
      let value: number;
      if (category === 'overall') {
        value = snapshot.overalls.simple;
      } else {
        value = snapshot.categoryAverages[category];
      }

      points.push({
        age,
        value,
        isProjected: false,
        isPeak: age >= peakAge && age <= declineStartAge,
      });
    }
  }

  // Add current point
  points.push({
    age: player.age,
    value: currentValue,
    isProjected: false,
    isPeak: player.age >= peakAge && player.age <= declineStartAge,
  });

  // Add projected points
  for (let i = 1; i <= PROJECTION_YEARS; i++) {
    const futureAge = player.age + i;
    if (futureAge > 45) break; // Cap at age 45

    const projectedValue = projectValue(currentValue, player.age, futureAge, category);

    points.push({
      age: futureAge,
      value: projectedValue,
      isProjected: true,
      isPeak: futureAge >= peakAge && futureAge <= declineStartAge,
    });
  }

  // Sort by age
  points.sort((a, b) => a.age - b.age);

  return points;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GrowthRegressionChart({
  player,
  compact = false,
}: GrowthRegressionChartProps) {
  const colors = useColors();
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('overall');

  // Generate data points for selected category
  const dataPoints = useMemo(
    () => generateDataPoints(player, selectedCategory),
    [player, selectedCategory]
  );

  // Calculate age range for x-axis
  const { minAge, maxAge } = useMemo(() => {
    const ages = dataPoints.map((p) => p.age);
    return {
      minAge: Math.min(...ages),
      maxAge: Math.max(...ages),
    };
  }, [dataPoints]);

  // Get peak age markers
  const peakAge = getCategoryPeakAge(selectedCategory);
  const declineStartAge = getDeclineStartAge(selectedCategory);
  const categoryColor = CATEGORY_COLORS[selectedCategory];

  // Calculate current value for display
  const currentValue = useMemo(
    () => getCurrentCategoryValue(player, selectedCategory),
    [player, selectedCategory]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Career Trajectory
        </Text>
        <View style={styles.currentValue}>
          <Text style={[styles.currentValueLabel, { color: colors.textMuted }]}>
            Current
          </Text>
          <Text style={[styles.currentValueNumber, { color: categoryColor }]}>
            {currentValue}
          </Text>
        </View>
      </View>

      {/* Category Selector */}
      <SegmentControl
        segments={CATEGORY_SEGMENTS}
        selectedKey={selectedCategory}
        onChange={setSelectedCategory}
        size={compact ? 'compact' : 'default'}
        style={styles.segmentControl}
      />

      {/* Chart */}
      <View
        style={[styles.chartContainer, { backgroundColor: colors.surface }]}
      >
        {/* Y-Axis Labels */}
        <View style={styles.yAxisLabels}>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>100</Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>70</Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>40</Text>
        </View>

        {/* Chart Area */}
        <View style={styles.chartArea}>
          {/* Grid Lines */}
          <View style={[styles.gridLine, { backgroundColor: colors.border, top: '0%' }]} />
          <View style={[styles.gridLine, { backgroundColor: colors.border, top: '43%' }]} />
          <View style={[styles.gridLine, { backgroundColor: colors.border, top: '86%' }]} />

          {/* Peak Age Marker */}
          {peakAge >= minAge && peakAge <= maxAge && (
            <View
              style={[
                styles.peakMarker,
                {
                  left: `${((peakAge - minAge) / (maxAge - minAge)) * 100}%`,
                  backgroundColor: categoryColor + '40',
                },
              ]}
            >
              <Text style={[styles.peakMarkerText, { color: categoryColor }]}>
                Peak
              </Text>
            </View>
          )}

          {/* Decline Start Marker */}
          {declineStartAge >= minAge && declineStartAge <= maxAge && (
            <View
              style={[
                styles.declineMarker,
                {
                  left: `${((declineStartAge - minAge) / (maxAge - minAge)) * 100}%`,
                  borderColor: colors.error + '60',
                },
              ]}
            />
          )}

          {/* Data Points and Line */}
          {dataPoints.map((point, index) => {
            const xPercent = ((point.age - minAge) / (maxAge - minAge)) * 100;
            const yPercent = ((Y_MAX - point.value) / Y_RANGE) * 100;

            // Draw line to next point
            let lineElement = null;
            const nextPoint = dataPoints[index + 1];
            if (index < dataPoints.length - 1 && nextPoint) {
              const nextXPercent = ((nextPoint.age - minAge) / (maxAge - minAge)) * 100;
              const nextYPercent = ((Y_MAX - nextPoint.value) / Y_RANGE) * 100;

              // Calculate line angle and length for connecting dots
              const dx = nextXPercent - xPercent;
              const dy = nextYPercent - yPercent;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              lineElement = (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.line,
                    {
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      width: `${length}%`,
                      backgroundColor: nextPoint.isProjected
                        ? categoryColor + '60'
                        : categoryColor,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            }

            return (
              <React.Fragment key={`point-${index}`}>
                {lineElement}
                <View
                  style={[
                    styles.dataPoint,
                    {
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      backgroundColor: point.isProjected
                        ? 'transparent'
                        : categoryColor,
                      borderColor: categoryColor,
                      borderWidth: point.isProjected ? 2 : 0,
                      borderStyle: point.isProjected ? 'dashed' : 'solid',
                    },
                    point.age === player.age && styles.currentPoint,
                  ]}
                />
              </React.Fragment>
            );
          })}
        </View>

        {/* X-Axis Labels */}
        <View style={styles.xAxisLabels}>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
            {minAge}
          </Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
            Age
          </Text>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
            {maxAge}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>
            Historical
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              {
                backgroundColor: 'transparent',
                borderColor: categoryColor,
                borderWidth: 2,
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>
            Projected
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSquare,
              { backgroundColor: categoryColor + '40' },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>
            Peak Years
          </Text>
        </View>
      </View>

      {/* Peak Age Info */}
      <View style={[styles.peakInfo, { backgroundColor: colors.surface }]}>
        <Text style={[styles.peakInfoText, { color: colors.textSecondary }]}>
          {selectedCategory === 'overall' ? 'Overall' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} peaks at age {peakAge}, decline starts at {declineStartAge}
        </Text>
      </View>
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
  currentValue: {
    alignItems: 'flex-end',
  },
  currentValueLabel: {
    fontSize: 10,
  },
  currentValueNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  segmentControl: {
    marginBottom: spacing.md,
  },
  chartContainer: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: 30,
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  axisLabel: {
    fontSize: 10,
  },
  chartArea: {
    marginLeft: 35,
    height: CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  peakMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 30,
    marginLeft: -15,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 2,
  },
  peakMarkerText: {
    fontSize: 8,
    fontWeight: '600',
  },
  declineMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
  },
  currentPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    marginTop: -6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  line: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 35,
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendSquare: {
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
  peakInfo: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  peakInfoText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default GrowthRegressionChart;
