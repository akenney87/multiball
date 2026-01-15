/**
 * Connected Scouting Screen
 *
 * Scouting screen connected to GameContext.
 * Scouting targets and reports are managed globally in GameState.
 * Reports are generated during week advancement.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useColors, spacing } from '../theme';
import { ScoutingScreen, ScoutTarget } from './ScoutingScreen';
import { useGame } from '../context/GameContext';
import {
  ScoutingSettings,
  calculatePlayersScoutedPerWeek,
  calculateAccuracyMultiplier,
} from '../../systems/scoutingSystem';
import type { ScoutInstructions } from '../context/types';
import { DEFAULT_SCOUT_INSTRUCTIONS } from '../context/types';

interface ConnectedScoutingScreenProps {
  onBack?: () => void;
  onNavigateToBudget?: () => void;
  onPlayerPress?: (playerId: string, playerList?: string[]) => void;
}

export function ConnectedScoutingScreen({
  onBack: _onBack,
  onNavigateToBudget,
  onPlayerPress,
}: ConnectedScoutingScreenProps) {
  // _onBack reserved for future navigation handling
  const colors = useColors();
  const {
    state,
    getTransferTargets,
    getFreeAgents,
    addScoutingTarget,
    removeScoutingTarget,
    setScoutInstructions,
    setScoutingDepthSlider,
  } = useGame();

  // Get depth slider from global state
  const depthSlider = state.scoutingDepthSlider ?? 0.5;

  // Use global scouting data from state
  const currentTargetIds = state.scoutingTargetIds || [];
  const scoutReports = state.scoutingReports || [];

  // Calculate scouting settings from budget allocation (using actual dollars)
  const scoutingSettings = useMemo((): ScoutingSettings => {
    const scoutingPct = state.userTeam.operationsBudget.scouting;
    // Calculate actual scouting budget in dollars
    const operationsPool = Math.max(0, state.userTeam.totalBudget - state.userTeam.salaryCommitment);
    const scoutingDollars = operationsPool * (scoutingPct / 100);

    // Budget multiplier based on dollars: $25K = 0.5x, $250K = 1.0x, $5M+ = 2.0x
    const budgetMultiplier = scoutingDollars <= 0
      ? 0.5
      : 0.5 + Math.min(1.5, 0.5 * Math.log10(Math.max(1, scoutingDollars / 25000)));

    // Scouts based on dollars: $50K = 1, $100K = 2, $250K = 3, $500K = 4, $1M+ = 5
    const simultaneousScouts = Math.max(1, Math.min(5, Math.floor(Math.log10(Math.max(1, scoutingDollars / 25000)) + 1)));

    return {
      depthSlider,
      scoutingBudgetMultiplier: budgetMultiplier,
      simultaneousScouts,
    };
  }, [state.userTeam.operationsBudget.scouting, state.userTeam.totalBudget, state.userTeam.salaryCommitment, depthSlider]);

  // Calculate derived values
  const playersScoutedPerWeek = useMemo(
    () =>
      calculatePlayersScoutedPerWeek(
        scoutingSettings.simultaneousScouts,
        scoutingSettings.depthSlider
      ),
    [scoutingSettings]
  );

  const accuracyMultiplier = useMemo(
    () =>
      calculateAccuracyMultiplier(
        scoutingSettings.scoutingBudgetMultiplier,
        scoutingSettings.depthSlider
      ),
    [scoutingSettings]
  );

  // Get available targets (free agents + AI team players)
  const availableTargets = useMemo((): ScoutTarget[] => {
    const targets: ScoutTarget[] = [];

    // Add free agents
    const freeAgents = getFreeAgents();
    for (const player of freeAgents) {
      targets.push({
        id: player.id,
        name: player.name,
        age: player.age,
        teamName: 'Free Agent',
        isScoutable: true,
      });
    }

    // Add AI team players
    const transferTargets = getTransferTargets();
    for (const player of transferTargets) {
      const team = state.league.teams.find((t) => t.id === player.teamId);
      targets.push({
        id: player.id,
        name: player.name,
        age: player.age,
        teamName: team?.name || 'Unknown Team',
        isScoutable: true,
      });
    }

    return targets;
  }, [getFreeAgents, getTransferTargets, state.league.teams]);

  // Handle depth slider change
  const handleDepthChange = useCallback((value: number) => {
    setScoutingDepthSlider(value);
  }, [setScoutingDepthSlider]);

  // Handle adding a target to scout
  const handleAddTarget = useCallback(
    (targetId: string) => {
      if (currentTargetIds.includes(targetId)) return;

      // Add to global scouting targets - reports are generated during week advancement
      addScoutingTarget(targetId);
    },
    [currentTargetIds, addScoutingTarget]
  );

  // Handle removing a target
  const handleRemoveTarget = useCallback((targetId: string) => {
    removeScoutingTarget(targetId);
  }, [removeScoutingTarget]);

  // Handle scout now action
  const handleScoutNow = useCallback(() => {
    // This would trigger weekly scouting in a full implementation
    // For now, reports are generated when targets are added
  }, []);

  // Handle budget press - navigate to budget screen or show info
  const handleBudgetPress = useCallback(() => {
    if (onNavigateToBudget) {
      onNavigateToBudget();
    } else {
      Alert.alert(
        'Scouting Budget',
        `Current allocation: ${state.userTeam.operationsBudget.scouting}%\n\nAdjust your scouting budget in the Budget settings to increase scout capacity.`,
        [{ text: 'OK' }]
      );
    }
  }, [onNavigateToBudget, state.userTeam.operationsBudget.scouting]);

  // Handle instructions change
  const handleInstructionsChange = useCallback(
    (instructions: ScoutInstructions) => {
      setScoutInstructions(instructions);
    },
    [setScoutInstructions]
  );

  // Get scout instructions from state
  const scoutInstructions = state.scoutInstructions || DEFAULT_SCOUT_INSTRUCTIONS;

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading scouting...
        </Text>
      </View>
    );
  }

  return (
    <ScoutingScreen
      depthSlider={depthSlider}
      budgetMultiplier={accuracyMultiplier}
      simultaneousScouts={scoutingSettings.simultaneousScouts}
      playersScoutedPerWeek={playersScoutedPerWeek}
      scoutingBudgetPct={state.userTeam.operationsBudget.scouting}
      scoutInstructions={scoutInstructions}
      scoutReports={scoutReports}
      availableTargets={availableTargets}
      currentTargetIds={currentTargetIds}
      onDepthChange={handleDepthChange}
      onAddTarget={handleAddTarget}
      onRemoveTarget={handleRemoveTarget}
      onScoutNow={handleScoutNow}
      onBudgetPress={handleBudgetPress}
      onInstructionsChange={handleInstructionsChange}
      onPlayerPress={(playerId) => {
        // Pass scouting target list for swipe navigation
        onPlayerPress?.(playerId, currentTargetIds);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
});

export default ConnectedScoutingScreen;
