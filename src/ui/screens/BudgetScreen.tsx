/**
 * Budget Screen
 *
 * Manage team budget allocation:
 * - Budget breakdown display
 * - Draggable sliders for each category
 * - Impact preview
 * - Save allocation
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export interface BudgetAllocation {
  training: number;
  scouting: number;
  facilities: number;
  youth: number;
}

export interface BudgetData {
  totalBudget: number;
  salaryCommitment: number;
  allocation: BudgetAllocation;
}

interface BudgetScreenProps {
  data?: BudgetData;
  onSaveAllocation?: (allocation: BudgetAllocation) => void;
}

const defaultData: BudgetData = {
  totalBudget: 10000000,
  salaryCommitment: 7500000,
  allocation: {
    training: 30,
    scouting: 25,
    facilities: 25,
    youth: 20,
  },
};

const categoryInfo = {
  training: {
    label: 'Training',
    description: 'Improves player development and attribute growth',
    color: '#3B82F6',
  },
  scouting: {
    label: 'Scouting',
    description: 'Reveals more transfer targets and player attributes',
    color: '#10B981',
  },
  facilities: {
    label: 'Facilities',
    description: 'Reduces injury risk and recovery time',
    color: '#8B5CF6',
  },
  youth: {
    label: 'Youth Development',
    description: 'Produces better youth academy prospects',
    color: '#F59E0B',
  },
};

// Draggable Slider Component
interface DraggableSliderProps {
  value: number;
  color: string;
  onValueChange: (value: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}

function DraggableSlider({ value, color, onValueChange, onDecrement, onIncrement }: DraggableSliderProps) {
  const colors = useColors();
  const trackWidth = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        // When user first touches, calculate value from touch position
        if (trackWidth.current > 0) {
          const touchX = evt.nativeEvent.locationX;
          const newValue = Math.round((touchX / trackWidth.current) * 100);
          onValueChange(Math.max(0, Math.min(100, newValue)));
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (trackWidth.current > 0) {
          const touchX = evt.nativeEvent.locationX;
          const newValue = Math.round((touchX / trackWidth.current) * 100);
          onValueChange(Math.max(0, Math.min(100, newValue)));
        }
      },
    })
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
  };

  return (
    <View style={styles.sliderRow}>
      <TouchableOpacity
        style={[styles.adjustButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onDecrement}
        activeOpacity={0.7}
      >
        <Text style={[styles.adjustText, { color: colors.text }]}>-</Text>
      </TouchableOpacity>
      <View
        style={[styles.sliderTrack, { backgroundColor: colors.border }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.sliderFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            {
              left: `${value}%`,
              backgroundColor: color,
              borderColor: '#FFFFFF',
            },
          ]}
        />
      </View>
      <TouchableOpacity
        style={[styles.adjustButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onIncrement}
        activeOpacity={0.7}
      >
        <Text style={[styles.adjustText, { color: colors.text }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// Helper to normalize allocation to exactly 100%
const normalizeAllocation = (alloc: BudgetAllocation): BudgetAllocation => {
  const total = Object.values(alloc).reduce((sum, val) => sum + val, 0);
  if (total === 100) return alloc;
  if (total === 0) return { training: 25, scouting: 25, facilities: 25, youth: 25 };

  // Scale proportionally and fix rounding
  const scale = 100 / total;
  const normalized: BudgetAllocation = {
    training: Math.round(alloc.training * scale),
    scouting: Math.round(alloc.scouting * scale),
    facilities: Math.round(alloc.facilities * scale),
    youth: Math.round(alloc.youth * scale),
  };

  // Fix any rounding drift
  const newTotal = Object.values(normalized).reduce((sum, val) => sum + val, 0);
  if (newTotal !== 100) {
    // Find largest category and adjust
    const keys = Object.keys(normalized) as (keyof BudgetAllocation)[];
    const largest = keys.reduce((max, k) => normalized[k] > normalized[max] ? k : max, keys[0]);
    normalized[largest] += (100 - newTotal);
  }

  return normalized;
};

export function BudgetScreen({ data = defaultData, onSaveAllocation }: BudgetScreenProps) {
  const colors = useColors();
  const [allocation, setAllocation] = useState<BudgetAllocation>(() =>
    normalizeAllocation(data.allocation)
  );
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Re-normalize if data.allocation changes from parent
  useEffect(() => {
    setAllocation(normalizeAllocation(data.allocation));
  }, [data.allocation]);

  // Operations Pool = Total Budget - Player Salaries
  const operationsPool = data.totalBudget - data.salaryCommitment;
  const totalAllocated = Object.values(allocation).reduce((sum, val) => sum + val, 0);
  const isValid = totalAllocated === 100;

  const hasChanges = useMemo(() => {
    return Object.keys(allocation).some(
      (key) => allocation[key as keyof BudgetAllocation] !== data.allocation[key as keyof BudgetAllocation]
    );
  }, [allocation, data.allocation]);

  const formatBudget = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  // Helper to redistribute budget changes while maintaining 100% total
  const redistributeBudget = (
    category: keyof BudgetAllocation,
    targetValue: number
  ): BudgetAllocation => {
    const clampedValue = Math.max(0, Math.min(100, targetValue));
    const current = allocation[category];
    const diff = clampedValue - current;

    if (diff === 0) return allocation;

    const others = Object.keys(allocation).filter((k) => k !== category) as (keyof BudgetAllocation)[];
    const otherTotal = others.reduce((sum, k) => sum + allocation[k], 0);

    // Can't increase if nothing to take from
    if (otherTotal === 0 && diff > 0) return allocation;

    const newAllocation = { ...allocation, [category]: clampedValue };

    // Distribute the difference proportionally
    let distributed = 0;
    others.forEach((k, idx) => {
      if (idx === others.length - 1) {
        // Last one gets the remainder to ensure exact 100%
        newAllocation[k] = Math.max(0, Math.round(allocation[k] - diff - distributed));
      } else {
        const share = Math.round((allocation[k] / otherTotal) * (-diff));
        newAllocation[k] = Math.max(0, allocation[k] + share);
        distributed += share;
      }
    });

    // Final verification - adjust if rounding caused drift
    const total = Object.values(newAllocation).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      // Find the largest non-target category and adjust
      const largest = others.reduce((max, k) =>
        newAllocation[k] > newAllocation[max] ? k : max, others[0]);
      newAllocation[largest] = Math.max(0, newAllocation[largest] + (100 - total));
    }

    return newAllocation;
  };

  const adjustAllocation = (category: keyof BudgetAllocation, delta: number) => {
    const newValue = allocation[category] + delta;
    const result = redistributeBudget(category, newValue);
    if (result !== allocation) setAllocation(result);
  };

  const setDirectAllocation = (category: keyof BudgetAllocation, newValue: number) => {
    const result = redistributeBudget(category, newValue);
    if (result !== allocation) setAllocation(result);
  };

  const handleSave = () => {
    onSaveAllocation?.(allocation);
    setShowSaveConfirm(false);
  };

  const resetAllocation = () => {
    setAllocation(data.allocation);
  };

  const renderSlider = (category: keyof BudgetAllocation) => {
    const info = categoryInfo[category];
    const value = allocation[category];
    const amount = (operationsPool * value) / 100;

    return (
      <View key={category} style={[styles.sliderCard, { backgroundColor: colors.card }, shadows.sm]}>
        <View style={styles.sliderHeader}>
          <View style={[styles.categoryDot, { backgroundColor: info.color }]} />
          <Text style={[styles.categoryLabel, { color: colors.text }]}>
            {info.label}
          </Text>
          <View style={styles.categoryValues}>
            <Text style={[styles.categoryPercent, { color: info.color }]}>
              {value}%
            </Text>
            <Text style={[styles.categoryAmount, { color: colors.textSecondary }]}>
              {formatBudget(amount)}
            </Text>
          </View>
        </View>
        <Text style={[styles.categoryDescription, { color: colors.textMuted }]}>
          {info.description}
        </Text>
        <DraggableSlider
          value={value}
          color={info.color}
          onValueChange={(newValue) => setDirectAllocation(category, newValue)}
          onDecrement={() => adjustAllocation(category, -5)}
          onIncrement={() => adjustAllocation(category, 5)}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Budget Overview */}
      <View style={[styles.overviewCard, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.overviewTitle, { color: colors.text }]}>
          Budget Overview
        </Text>
        <View style={styles.overviewGrid}>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>
              Total Budget
            </Text>
            <Text style={[styles.overviewValue, { color: colors.text }]}>
              {formatBudget(data.totalBudget)}
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>
              Player Salaries
            </Text>
            <Text style={[styles.overviewValue, { color: colors.error }]}>
              -{formatBudget(data.salaryCommitment)}
            </Text>
          </View>
          <View style={[styles.overviewItem, styles.availableItem]}>
            <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>
              Operations Pool
            </Text>
            <Text style={[styles.overviewValue, styles.availableValue, { color: colors.success }]}>
              {formatBudget(operationsPool)}
            </Text>
          </View>
        </View>
        <Text style={[styles.overviewNote, { color: colors.textMuted }]}>
          Signing players increases salaries and reduces your operations pool
        </Text>
      </View>

      {/* Allocation Status */}
      <View
        style={[
          styles.statusBar,
          {
            backgroundColor: isValid ? colors.success + '15' : colors.error + '15',
            borderColor: isValid ? colors.success : colors.error,
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            { color: isValid ? colors.success : colors.error },
          ]}
        >
          {isValid
            ? `Fully allocated (100%)`
            : `Total: ${totalAllocated}% (must equal 100%)`}
        </Text>
      </View>

      {/* Allocation Sliders */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Budget Allocation
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        Drag the slider or tap +/- to adjust
      </Text>
      {(Object.keys(categoryInfo) as (keyof BudgetAllocation)[]).map(renderSlider)}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: isValid && hasChanges ? colors.primary : colors.surface,
              opacity: isValid && hasChanges ? 1 : 0.5,
            },
          ]}
          onPress={() => setShowSaveConfirm(true)}
          disabled={!isValid || !hasChanges}
        >
          <Text
            style={[
              styles.saveText,
              { color: isValid && hasChanges ? '#000000' : colors.textMuted },
            ]}
          >
            Save Allocation
          </Text>
        </TouchableOpacity>
        {hasChanges && (
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={resetAllocation}
          >
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>
              Reset
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Save Confirmation */}
      <ConfirmationModal
        visible={showSaveConfirm}
        title="Save Budget Allocation?"
        message="This will apply the new budget allocation to your team. Changes will take effect next season."
        confirmText="Save"
        cancelText="Cancel"
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  overviewCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  overviewGrid: {
    gap: spacing.sm,
  },
  overviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginTop: spacing.sm,
  },
  overviewLabel: {
    fontSize: 14,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  availableValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  overviewNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statusBar: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sectionHint: {
    fontSize: 12,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  sliderCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  categoryValues: {
    alignItems: 'flex-end',
  },
  categoryPercent: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryAmount: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryDescription: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustText: {
    fontSize: 20,
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    overflow: 'visible',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 12,
  },
  sliderThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    marginLeft: -14,
    top: -2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BudgetScreen;
