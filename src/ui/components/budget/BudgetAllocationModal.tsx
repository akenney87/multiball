/**
 * Budget Allocation Modal
 *
 * Required popup shown at game start before scouting/simming is allowed.
 * User must allocate their operations budget before proceeding.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { OperationsBudget } from '../../context/types';

interface BudgetAllocationModalProps {
  visible: boolean;
  totalBudget: number;
  salaryCommitment: number;
  initialAllocation: OperationsBudget;
  onConfirm: (allocation: OperationsBudget) => void;
}

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
  youthDevelopment: {
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
        if (trackWidth.current > 0) {
          const touchX = evt.nativeEvent.locationX;
          const newValue = Math.round((touchX / trackWidth.current) * 100);
          onValueChange(Math.max(0, Math.min(100, newValue)));
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
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

export function BudgetAllocationModal({
  visible,
  totalBudget,
  salaryCommitment,
  initialAllocation,
  onConfirm,
}: BudgetAllocationModalProps) {
  const colors = useColors();
  const [allocation, setAllocation] = useState<OperationsBudget>(initialAllocation);

  const operationsPool = totalBudget - salaryCommitment;

  // Calculate total allocation
  const totalAllocation = useMemo(() => {
    return allocation.training + allocation.scouting + allocation.facilities + allocation.youthDevelopment;
  }, [allocation]);

  const isValid = totalAllocation === 100;

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  // Handle slider changes with normalization
  const handleSliderChange = (category: keyof OperationsBudget, newValue: number) => {
    const currentTotal = totalAllocation;
    const currentCategoryValue = allocation[category];
    const delta = newValue - currentCategoryValue;
    const otherCategories = Object.keys(allocation).filter(
      (k) => k !== category
    ) as (keyof OperationsBudget)[];

    if (currentTotal + delta <= 100 && newValue >= 0) {
      // Simply set the new value if it doesn't exceed 100
      setAllocation((prev) => ({ ...prev, [category]: newValue }));
    } else if (delta > 0) {
      // Need to reduce other categories proportionally
      const otherTotal = otherCategories.reduce((sum, k) => sum + allocation[k], 0);
      if (otherTotal > 0) {
        const reduction = Math.min(delta, otherTotal);
        const newAlloc = { ...allocation, [category]: newValue };
        let remaining = reduction;

        for (const key of otherCategories) {
          const proportion = allocation[key] / otherTotal;
          const keyReduction = Math.min(Math.round(reduction * proportion), allocation[key]);
          newAlloc[key] = allocation[key] - keyReduction;
          remaining -= keyReduction;
        }

        // Handle any rounding errors
        if (remaining > 0) {
          for (const key of otherCategories) {
            if (newAlloc[key] > 0) {
              const reduction = Math.min(remaining, newAlloc[key]);
              newAlloc[key] -= reduction;
              remaining -= reduction;
              if (remaining <= 0) break;
            }
          }
        }

        setAllocation(newAlloc);
      }
    }
  };

  const handleIncrement = (category: keyof OperationsBudget) => {
    if (totalAllocation < 100) {
      setAllocation((prev) => ({ ...prev, [category]: Math.min(100, prev[category] + 5) }));
    }
  };

  const handleDecrement = (category: keyof OperationsBudget) => {
    setAllocation((prev) => ({ ...prev, [category]: Math.max(0, prev[category] - 5) }));
  };

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(allocation);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Set Your Budget</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Allocate your operations budget before starting the season
            </Text>
          </View>

          {/* Budget Overview */}
          <View style={[styles.overviewCard, { backgroundColor: colors.surface, ...shadows.sm }]}>
            <View style={styles.overviewRow}>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Total Budget</Text>
              <Text style={[styles.overviewValue, { color: colors.text }]}>
                {formatCurrency(totalBudget)}
              </Text>
            </View>
            <View style={styles.overviewRow}>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Salary Commitment</Text>
              <Text style={[styles.overviewValue, { color: colors.warning }]}>
                -{formatCurrency(salaryCommitment)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.overviewRow}>
              <Text style={[styles.overviewLabel, { color: colors.text, fontWeight: '600' }]}>
                Operations Pool
              </Text>
              <Text style={[styles.overviewValue, { color: colors.primary, fontWeight: '700' }]}>
                {formatCurrency(operationsPool)}
              </Text>
            </View>
          </View>

          {/* Allocation Sliders */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Operations Allocation</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Must total 100% - Currently: {totalAllocation}%
          </Text>

          {(Object.keys(categoryInfo) as (keyof typeof categoryInfo)[]).map((category) => {
            const info = categoryInfo[category];
            const value = allocation[category];
            const dollarAmount = (operationsPool * value) / 100;

            return (
              <View
                key={category}
                style={[styles.categoryCard, { backgroundColor: colors.surface, ...shadows.sm }]}
              >
                <View style={styles.categoryHeader}>
                  <View style={[styles.colorDot, { backgroundColor: info.color }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryLabel, { color: colors.text }]}>{info.label}</Text>
                    <Text style={[styles.categoryDesc, { color: colors.textMuted }]}>
                      {info.description}
                    </Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={[styles.percentValue, { color: info.color }]}>{value}%</Text>
                    <Text style={[styles.dollarValue, { color: colors.textMuted }]}>
                      {formatCurrency(dollarAmount)}
                    </Text>
                  </View>
                </View>
                <DraggableSlider
                  value={value}
                  color={info.color}
                  onValueChange={(v) => handleSliderChange(category, v)}
                  onDecrement={() => handleDecrement(category)}
                  onIncrement={() => handleIncrement(category)}
                />
              </View>
            );
          })}

          {/* Validation Message */}
          {!isValid && (
            <View style={[styles.validationMessage, { backgroundColor: colors.warning + '20' }]}>
              <Text style={[styles.validationText, { color: colors.warning }]}>
                Allocation must total 100% ({100 - totalAllocation}% remaining)
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Confirm Button */}
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: isValid ? colors.primary : colors.border },
            ]}
            onPress={handleConfirm}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.confirmText, { color: isValid ? '#000000' : colors.textMuted }]}>
              Confirm Allocation
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  overviewCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  overviewLabel: {
    fontSize: 14,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
  categoryCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  percentValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  dollarValue: {
    fontSize: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustText: {
    fontSize: 20,
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    top: -6,
    marginLeft: -10,
  },
  validationMessage: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  validationText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  confirmButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BudgetAllocationModal;
