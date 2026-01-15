/**
 * Budget Allocation Modal
 *
 * Required popup shown at game start before scouting/simming is allowed.
 * User must allocate their operations budget before proceeding.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
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
    description: 'Player development speed scales with $ spent',
    color: '#3B82F6',
  },
  scouting: {
    label: 'Scouting',
    description: 'Scout capacity and accuracy scale with $ spent',
    color: '#10B981',
  },
  medical: {
    label: 'Medical',
    description: 'Fitness recovery speed scales with $ spent',
    color: '#8B5CF6',
  },
  youthDevelopment: {
    label: 'Youth Development',
    description: 'Prospect quality scales with $ spent',
    color: '#F59E0B',
  },
};

// +/- Stepper Component
interface AllocationStepperProps {
  value: number;
  color: string;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}

function AllocationStepper({ value, color, canIncrement, onDecrement, onIncrement }: AllocationStepperProps) {
  const colors = useColors();
  const canDecrement = value > 0;

  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={[
          styles.stepperButton,
          {
            backgroundColor: canDecrement ? colors.surface : colors.background,
            borderColor: canDecrement ? color : colors.border,
          }
        ]}
        onPress={onDecrement}
        disabled={!canDecrement}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.stepperText,
          { color: canDecrement ? color : colors.textMuted }
        ]}>−</Text>
      </TouchableOpacity>

      <View style={[styles.valueDisplay, { borderColor: color }]}>
        <Text style={[styles.valueText, { color: color }]}>{value}%</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.stepperButton,
          {
            backgroundColor: canIncrement ? colors.surface : colors.background,
            borderColor: canIncrement ? color : colors.border,
          }
        ]}
        onPress={onIncrement}
        disabled={!canIncrement}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.stepperText,
          { color: canIncrement ? color : colors.textMuted }
        ]}>+</Text>
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
    return allocation.training + allocation.scouting + allocation.medical + allocation.youthDevelopment;
  }, [allocation]);

  const isValid = totalAllocation === 100;

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  // Check if increment is allowed (total must stay <= 100)
  const canIncrement = totalAllocation < 100;

  const handleIncrement = (category: keyof OperationsBudget) => {
    if (canIncrement) {
      setAllocation((prev) => ({ ...prev, [category]: Math.min(100, prev[category] + 5) }));
    }
  };

  const handleDecrement = (category: keyof OperationsBudget) => {
    if (allocation[category] >= 5) {
      setAllocation((prev) => ({ ...prev, [category]: prev[category] - 5 }));
    }
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

          {/* Allocation Controls */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Operations Allocation</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Must total 100% — Currently: {totalAllocation}%
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
                <View style={styles.categoryRow}>
                  <View style={[styles.colorDot, { backgroundColor: info.color }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryLabel, { color: colors.text }]}>{info.label}</Text>
                    <Text style={[styles.categoryDesc, { color: colors.textMuted }]}>
                      {info.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.allocationRow}>
                  <AllocationStepper
                    value={value}
                    color={info.color}
                    canIncrement={canIncrement}
                    onDecrement={() => handleDecrement(category)}
                    onIncrement={() => handleIncrement(category)}
                  />
                  <Text style={[styles.dollarAmount, { color: colors.textMuted }]}>
                    {formatCurrency(dollarAmount)}
                  </Text>
                </View>
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 22,
    fontWeight: '600',
  },
  valueDisplay: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    minWidth: 70,
    alignItems: 'center',
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
  },
  dollarAmount: {
    fontSize: 14,
    fontWeight: '500',
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
