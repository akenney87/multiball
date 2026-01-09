/**
 * Training Focus Slider
 *
 * Reusable component for adjusting Physical/Mental/Technical
 * training allocation with dynamic rebalancing.
 * Uses custom slider implementation with smooth touch handling.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { useColors, spacing } from '../../theme';
import type { TrainingFocus } from '../../../systems/trainingSystem';

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

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 8;
const TOUCH_AREA_HEIGHT = 44; // iOS recommended touch target

// =============================================================================
// TYPES
// =============================================================================

interface TrainingFocusSliderProps {
  focus: TrainingFocus;
  onChange: (focus: TrainingFocus) => void;
  disabled?: boolean;
  compact?: boolean;
}

type Category = 'physical' | 'mental' | 'technical';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Rebalance training focus when one slider changes.
 * Other categories adjust proportionally to maintain sum = 100.
 */
function rebalanceFocus(
  category: Category,
  newValue: number,
  currentFocus: TrainingFocus
): TrainingFocus {
  // Clamp to valid range
  const clampedValue = Math.max(0, Math.min(100, Math.round(newValue)));
  const remaining = 100 - clampedValue;

  // Handle each category explicitly to satisfy TypeScript
  if (category === 'physical') {
    const otherSum = currentFocus.mental + currentFocus.technical;
    if (otherSum === 0) {
      return {
        physical: clampedValue,
        mental: Math.round(remaining / 2),
        technical: remaining - Math.round(remaining / 2),
      };
    }
    const mentalProportion = currentFocus.mental / otherSum;
    const newMental = Math.max(0, Math.round(remaining * mentalProportion));
    return {
      physical: clampedValue,
      mental: newMental,
      technical: Math.max(0, remaining - newMental),
    };
  }

  if (category === 'mental') {
    const otherSum = currentFocus.physical + currentFocus.technical;
    if (otherSum === 0) {
      return {
        physical: Math.round(remaining / 2),
        mental: clampedValue,
        technical: remaining - Math.round(remaining / 2),
      };
    }
    const physicalProportion = currentFocus.physical / otherSum;
    const newPhysical = Math.max(0, Math.round(remaining * physicalProportion));
    return {
      physical: newPhysical,
      mental: clampedValue,
      technical: Math.max(0, remaining - newPhysical),
    };
  }

  // category === 'technical'
  const otherSum = currentFocus.physical + currentFocus.mental;
  if (otherSum === 0) {
    return {
      physical: Math.round(remaining / 2),
      mental: remaining - Math.round(remaining / 2),
      technical: clampedValue,
    };
  }
  const physicalProportion = currentFocus.physical / otherSum;
  const newPhysical = Math.max(0, Math.round(remaining * physicalProportion));
  return {
    physical: newPhysical,
    mental: Math.max(0, remaining - newPhysical),
    technical: clampedValue,
  };
}

// =============================================================================
// CUSTOM SLIDER COMPONENT
// =============================================================================

interface CustomSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  color: string;
  disabled?: boolean;
  trackColor: string;
}

function CustomSlider({
  value,
  onValueChange,
  color,
  disabled,
  trackColor,
}: CustomSliderProps) {
  const [isActive, setIsActive] = useState(false);
  const trackLayoutRef = useRef({ x: 0, width: 0 });
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Store callbacks in refs so PanResponder always has latest versions
  const onValueChangeRef = useRef(onValueChange);
  const disabledRef = useRef(disabled);

  // Update refs on every render
  onValueChangeRef.current = onValueChange;
  disabledRef.current = disabled;

  // Calculate value from touch position (no dependencies - uses refs)
  const calculateValueFromPosition = (pageX: number): number | null => {
    const { x, width } = trackLayoutRef.current;
    if (width <= 0) return null;

    const relativeX = pageX - x;
    const percentage = Math.max(0, Math.min(100, (relativeX / width) * 100));
    return Math.round(percentage);
  };

  // Animate thumb scale
  const animateThumb = (active: boolean) => {
    Animated.spring(thumbScale, {
      toValue: active ? 1.3 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        setIsActive(true);
        animateThumb(true);
        const newValue = calculateValueFromPosition(evt.nativeEvent.pageX);
        if (newValue !== null) {
          onValueChangeRef.current(newValue);
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const newValue = calculateValueFromPosition(evt.nativeEvent.pageX);
        if (newValue !== null) {
          onValueChangeRef.current(newValue);
        }
      },

      onPanResponderRelease: () => {
        setIsActive(false);
        animateThumb(false);
      },

      onPanResponderTerminate: () => {
        setIsActive(false);
        animateThumb(false);
      },
    })
  ).current;

  // Measure track position on layout
  const handleTrackLayout = useCallback((event: any) => {
    event.target.measure(
      (_x: number, _y: number, width: number, _height: number, pageX: number, _pageY: number) => {
        trackLayoutRef.current = { x: pageX, width };
      }
    );
  }, []);

  return (
    <View
      style={styles.sliderTouchArea}
      {...panResponder.panHandlers}
    >
      <View
        style={[styles.sliderTrack, { backgroundColor: trackColor }]}
        onLayout={handleTrackLayout}
      >
        {/* Fill */}
        <View
          style={[
            styles.sliderFill,
            {
              width: `${value}%` as any,
              backgroundColor: color,
              opacity: isActive ? 1 : 0.9,
            },
          ]}
        />

        {/* Thumb */}
        <Animated.View
          style={[
            styles.sliderThumb,
            {
              left: `${value}%` as any,
              backgroundColor: color,
              marginLeft: -THUMB_SIZE / 2,
              opacity: disabled ? 0.5 : 1,
              transform: [{ scale: thumbScale }],
              // Active glow effect
              shadowOpacity: isActive ? 0.5 : 0.25,
              shadowRadius: isActive ? 6 : 3,
            },
          ]}
        />
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TrainingFocusSlider({
  focus,
  onChange,
  disabled = false,
  compact = false,
}: TrainingFocusSliderProps) {
  const colors = useColors();

  const handleSliderChange = useCallback(
    (category: Category, value: number) => {
      const newFocus = rebalanceFocus(category, value, focus);
      onChange(newFocus);
    },
    [focus, onChange]
  );

  const categories: Category[] = ['physical', 'mental', 'technical'];

  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {categories.map((category) => (
        <View
          key={category}
          style={compact ? styles.sliderRowCompact : styles.sliderRow}
        >
          {/* Category Label */}
          <View style={styles.labelContainer}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: CATEGORY_COLORS[category] },
              ]}
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

          {/* Slider */}
          <View style={styles.sliderContainer}>
            <CustomSlider
              value={focus[category]}
              onValueChange={(value) => handleSliderChange(category, value)}
              color={CATEGORY_COLORS[category]}
              trackColor={colors.border}
              disabled={disabled}
            />
          </View>

          {/* Value */}
          <Text
            style={[
              compact ? styles.valueCompact : styles.value,
              { color: CATEGORY_COLORS[category] },
            ]}
          >
            {focus[category]}%
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  containerCompact: {
    gap: spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },
  valueCompact: {
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  // Custom slider styles
  sliderTouchArea: {
    height: TOUCH_AREA_HEIGHT,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    top: -(THUMB_SIZE - TRACK_HEIGHT) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    // Border for better visibility
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default TrainingFocusSlider;
