/**
 * Connected Budget Screen
 *
 * Connects BudgetScreen to real game data via GameContext.
 * Shows actual team finances and handles budget allocation changes.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGame } from '../context/GameContext';
import { BudgetScreen, BudgetData, BudgetAllocation } from './BudgetScreen';
import { useColors, spacing } from '../theme';
import type { OperationsBudget } from '../context/types';

interface ConnectedBudgetScreenProps {
  /** Callback when allocation is saved */
  onAllocationSaved?: () => void;
}

export function ConnectedBudgetScreen({ onAllocationSaved }: ConnectedBudgetScreenProps) {
  const colors = useColors();
  const { state, setOperationsBudget } = useGame();

  // Convert context settings to persistence format (for SettingsScreen)
  const budgetData = useMemo((): BudgetData => ({
    totalBudget: state.userTeam.totalBudget,
    salaryCommitment: state.userTeam.salaryCommitment,
    allocation: {
      training: state.userTeam.operationsBudget.training,
      scouting: state.userTeam.operationsBudget.scouting,
      facilities: state.userTeam.operationsBudget.facilities,
      youth: state.userTeam.operationsBudget.youthDevelopment,
    },
  }), [
    state.userTeam.totalBudget,
    state.userTeam.salaryCommitment,
    state.userTeam.operationsBudget,
  ]);

  // Handle saving allocation
  const handleSaveAllocation = useCallback(
    (allocation: BudgetAllocation) => {
      // Convert BudgetAllocation back to OperationsBudget
      const operationsBudget: OperationsBudget = {
        training: allocation.training,
        scouting: allocation.scouting,
        facilities: allocation.facilities,
        youthDevelopment: allocation.youth,
      };

      setOperationsBudget(operationsBudget);
      onAllocationSaved?.();
    },
    [setOperationsBudget, onAllocationSaved]
  );

  // Loading state - after all hooks
  if (!state.initialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading budget...
        </Text>
      </View>
    );
  }

  return <BudgetScreen data={budgetData} onSaveAllocation={handleSaveAllocation} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
});

export default ConnectedBudgetScreen;
