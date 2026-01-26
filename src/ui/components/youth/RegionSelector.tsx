/**
 * Region Selector Component
 *
 * Displays 7 world regions for youth scouting with distance-based depth indicators.
 * Shows scouting depth percentage based on distance from user's home region.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
  type ScoutingRegion,
  REGION_CONFIGS,
  getRegionDepthMultiplier,
} from '../../../systems/youthAcademySystem';

interface RegionSelectorProps {
  selectedRegion: ScoutingRegion;
  homeRegion: ScoutingRegion;
  onChange: (region: ScoutingRegion) => void;
  style?: ViewStyle;
}

const REGIONS: ScoutingRegion[] = [
  'north_america',
  'south_america',
  'western_europe',
  'eastern_europe',
  'africa',
  'asia',
  'oceania',
];

export function RegionSelector({
  selectedRegion,
  homeRegion,
  onChange,
  style,
}: RegionSelectorProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.header, { color: colors.textMuted }]}>
        SCOUTING REGION
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {REGIONS.map((region) => {
          const config = REGION_CONFIGS[region];
          const isSelected = region === selectedRegion;
          const isHome = region === homeRegion;
          const depth = getRegionDepthMultiplier(homeRegion, region);
          const depthPercent = Math.round(depth * 100);

          return (
            <TouchableOpacity
              key={region}
              style={[
                styles.regionCard,
                {
                  backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
                isSelected && glowShadows.cardSubtle,
              ]}
              onPress={() => onChange(region)}
              activeOpacity={0.7}
            >
              {isHome && (
                <View style={[styles.homeBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.homeBadgeText}>HOME</Text>
                </View>
              )}

              <Text
                style={[
                  styles.regionName,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {config?.displayName ?? region}
              </Text>

              <View style={styles.depthContainer}>
                <View
                  style={[
                    styles.depthBar,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.depthFill,
                      {
                        backgroundColor: getDepthColor(depthPercent, colors),
                        width: `${depthPercent}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.depthText,
                    { color: getDepthColor(depthPercent, colors) },
                  ]}
                >
                  {depthPercent}%
                </Text>
              </View>

              <Text style={[styles.tendencyText, { color: colors.textMuted }]}>
                {getTendencyLabel(config?.tendencies)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getDepthColor(depth: number, colors: ReturnType<typeof useColors>): string {
  if (depth >= 80) return colors.success;
  if (depth >= 60) return colors.primary;
  if (depth >= 40) return colors.warning;
  return colors.error;
}

function getTendencyLabel(tendencies?: { physical: number; technical: number; mental: number }): string {
  if (!tendencies) return '';

  const { physical, technical, mental } = tendencies;
  const labels: string[] = [];

  if (physical > 1.1) labels.push('Physical+');
  else if (physical < 0.95) labels.push('Physical-');

  if (technical > 1.1) labels.push('Technical+');
  else if (technical < 0.95) labels.push('Technical-');

  if (mental > 1.1) labels.push('Mental+');
  else if (mental < 0.95) labels.push('Mental-');

  return labels.length > 0 ? labels.join(' ') : 'Balanced';
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    ...textStyles.labelSmall,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  regionCard: {
    width: 120,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  homeBadge: {
    position: 'absolute',
    top: -6,
    right: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  homeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  regionName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  depthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  depthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  depthFill: {
    height: '100%',
    borderRadius: 2,
  },
  depthText: {
    fontSize: 11,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  tendencyText: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});

export default RegionSelector;
