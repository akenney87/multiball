/**
 * Segment Control Component
 *
 * iOS-style horizontal pill segments with NEON PITCH styling.
 * Used for sub-navigation within screens.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ViewStyle,
} from 'react-native';
import { useColors, spacing, borderRadius, glowShadows } from '../../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface Segment<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

interface SegmentControlProps<T extends string> {
  segments: Segment<T>[];
  selectedKey: T;
  onChange: (key: T) => void;
  size?: 'default' | 'compact';
  style?: ViewStyle;
}

export function SegmentControl<T extends string>({
  segments,
  selectedKey,
  onChange,
  size = 'default',
  style,
}: SegmentControlProps<T>) {
  const colors = useColors();

  const handlePress = (key: T) => {
    if (key !== selectedKey) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onChange(key);
    }
  };

  const isCompact = size === 'compact';

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {segments.map((segment) => {
        const isSelected = segment.key === selectedKey;

        return (
          <TouchableOpacity
            key={segment.key}
            style={[
              styles.segment,
              isCompact && styles.segmentCompact,
              isSelected && [
                styles.segmentActive,
                {
                  backgroundColor: colors.primary,
                },
                glowShadows.primary,
              ],
            ]}
            onPress={() => handlePress(segment.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                isCompact && styles.segmentTextCompact,
                {
                  color: isSelected ? colors.textInverse : colors.textMuted,
                },
                isSelected && styles.segmentTextActive,
              ]}
            >
              {segment.label}
            </Text>

            {segment.badge !== undefined && segment.badge > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected ? colors.secondary : colors.error,
                  },
                ]}
              >
                <Text style={styles.badgeText}>
                  {segment.badge > 99 ? '99+' : segment.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  containerCompact: {
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  segmentCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  segmentActive: {
    // Glow effect applied via glowShadows.primary
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  segmentTextCompact: {
    fontSize: 12,
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default SegmentControl;
