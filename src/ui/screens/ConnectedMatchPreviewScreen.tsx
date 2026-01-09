/**
 * Connected Match Preview Screen
 *
 * Match preview connected to GameContext for real match data.
 * Shows lineup, tactics, and match simulation options.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useMatch } from '../hooks/useMatch';
import { useGame } from '../context/GameContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import {
  type BaseballGameStrategy,
  type PlateApproach,
  type SwingStyle,
  type BaserunningStyle,
  DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY,
} from '../../simulation/baseball';

// Soccer strategy types
type SoccerAttackingStyle = 'possession' | 'direct' | 'counter';
type SoccerPressing = 'high' | 'balanced' | 'low';
type SoccerWidth = 'wide' | 'balanced' | 'tight';

interface SoccerStrategy {
  attackingStyle: SoccerAttackingStyle;
  pressing: SoccerPressing;
  width: SoccerWidth;
}

const DEFAULT_SOCCER_STRATEGY: SoccerStrategy = {
  attackingStyle: 'direct',
  pressing: 'balanced',
  width: 'balanced',
};

// Basketball strategy types
type BasketballPace = 'fast' | 'standard' | 'slow';
type BasketballDefense = 'man' | 'mixed' | 'zone';
type BasketballRebounding = 'crash_glass' | 'standard' | 'prevent_transition';

interface BasketballStrategy {
  pace: BasketballPace;
  defense: BasketballDefense;
  rebounding: BasketballRebounding;
  /** Player IDs for primary scoring options (up to 3) */
  scoringOptions: string[];
}

const DEFAULT_BASKETBALL_STRATEGY: BasketballStrategy = {
  pace: 'standard',
  defense: 'mixed',
  rebounding: 'standard',
  scoringOptions: [],
};

interface ConnectedMatchPreviewScreenProps {
  matchId: string;
  onStartMatch?: (matchId: string) => void;
  onQuickSimComplete?: (matchId: string) => void;
  onBack?: () => void;
  onEditLineup?: () => void;
  onPlayerPress?: (playerId: string) => void;
  /** Baseball strategy (controlled from parent to persist across modal transitions) */
  baseballStrategy?: BaseballGameStrategy;
  /** Callback to update baseball strategy */
  onBaseballStrategyChange?: (strategy: BaseballGameStrategy) => void;
  /** Soccer strategy (controlled from parent to persist across modal transitions) */
  soccerStrategy?: SoccerStrategy;
  /** Callback to update soccer strategy */
  onSoccerStrategyChange?: (strategy: SoccerStrategy) => void;
  /** Basketball strategy (controlled from parent to persist across modal transitions) */
  basketballStrategy?: BasketballStrategy;
  /** Callback to update basketball strategy */
  onBasketballStrategyChange?: (strategy: BasketballStrategy) => void;
}

export function ConnectedMatchPreviewScreen({
  matchId,
  onStartMatch,
  onQuickSimComplete,
  onBack,
  onEditLineup,
  onPlayerPress,
  baseballStrategy: externalBaseballStrategy,
  onBaseballStrategyChange,
  soccerStrategy: externalSoccerStrategy,
  onSoccerStrategyChange,
  basketballStrategy: externalBasketballStrategy,
  onBasketballStrategyChange,
}: ConnectedMatchPreviewScreenProps) {
  const colors = useColors();
  const { isLoading, state, setBaseballStrategy: contextSetBaseballStrategy } = useGame();
  const {
    match,
    matchData,
    userLineup,
    baseballLineup,
    soccerLineup,
    simulate,
    isReady,
  } = useMatch(matchId);

  const [showQuickSimConfirm, setShowQuickSimConfirm] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Baseball strategy - use external state if provided, otherwise use context state
  const baseballStrategy = externalBaseballStrategy ?? state.userTeam.baseballStrategy ?? DEFAULT_BASEBALL_STRATEGY;
  const setBaseballStrategy = useCallback((strategy: BaseballGameStrategy) => {
    if (onBaseballStrategyChange) {
      onBaseballStrategyChange(strategy);
    } else {
      contextSetBaseballStrategy(strategy);
    }
  }, [onBaseballStrategyChange, contextSetBaseballStrategy]);

  // Soccer strategy - use external state if provided, otherwise use internal state
  const [internalSoccerStrategy, setInternalSoccerStrategy] = useState<SoccerStrategy>(DEFAULT_SOCCER_STRATEGY);
  const soccerStrategy = externalSoccerStrategy ?? internalSoccerStrategy;
  const setSoccerStrategy = useCallback((strategy: SoccerStrategy) => {
    if (onSoccerStrategyChange) {
      onSoccerStrategyChange(strategy);
    } else {
      setInternalSoccerStrategy(strategy);
    }
  }, [onSoccerStrategyChange]);

  // Basketball strategy - use external state if provided, otherwise use internal state
  const [internalBasketballStrategy, setInternalBasketballStrategy] = useState<BasketballStrategy>(DEFAULT_BASKETBALL_STRATEGY);
  const basketballStrategy = externalBasketballStrategy ?? internalBasketballStrategy;
  const setBasketballStrategy = useCallback((strategy: BasketballStrategy) => {
    if (onBasketballStrategyChange) {
      onBasketballStrategyChange(strategy);
    } else {
      setInternalBasketballStrategy(strategy);
    }
  }, [onBasketballStrategyChange]);

  // Get sport color
  const sportColor = useMemo(() => {
    if (!match) return colors.primary;
    switch (match.sport) {
      case 'basketball':
        return colors.basketball;
      case 'baseball':
        return colors.baseball;
      case 'soccer':
        return colors.soccer;
      default:
        return colors.primary;
    }
  }, [match, colors]);

  // Handle quick simulation
  const handleQuickSim = useCallback(() => {
    setShowQuickSimConfirm(true);
  }, []);

  const confirmQuickSim = useCallback(async () => {
    setShowQuickSimConfirm(false);
    setIsSimulating(true);
    setLoadingMessage('Simulating match...');
    try {
      // Pass sport-specific strategy
      await simulate(
        match?.sport === 'baseball' ? baseballStrategy : undefined,
        match?.sport === 'soccer' ? soccerStrategy : undefined,
        match?.sport === 'basketball' ? basketballStrategy : undefined
      );
      setLoadingMessage('Processing week...');
      // Short delay to show the processing message
      await new Promise(resolve => setTimeout(resolve, 500));
      onQuickSimComplete?.(matchId);
    } catch (err) {
      // Show user-friendly error for lineup validation failures
      const message = err instanceof Error ? err.message : 'Failed to simulate match';
      Alert.alert(
        'Cannot Simulate Match',
        message,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsSimulating(false);
      setLoadingMessage('');
    }
  }, [simulate, matchId, onQuickSimComplete, match?.sport, baseballStrategy, soccerStrategy, basketballStrategy]);

  const handleStartMatch = useCallback(() => {
    onStartMatch?.(matchId);
  }, [matchId, onStartMatch]);

  // Format tactic display for basketball
  const formatPace = (pace: BasketballPace) => {
    switch (pace) {
      case 'fast':
        return 'Fast Break';
      case 'slow':
        return 'Half-Court';
      default:
        return 'Balanced';
    }
  };

  const formatDefense = (defense: BasketballDefense) => {
    switch (defense) {
      case 'man':
        return 'Man-to-Man';
      case 'zone':
        return 'Zone';
      default:
        return 'Mixed';
    }
  };

  const formatRebounding = (strategy: BasketballRebounding) => {
    switch (strategy) {
      case 'crash_glass':
        return 'Crash Glass';
      case 'prevent_transition':
        return 'Get Back';
      default:
        return 'Balanced';
    }
  };

  // Format a single scoring option display
  const formatScoringOption = (index: number) => {
    const playerId = basketballStrategy.scoringOptions[index];
    if (!playerId) {
      return 'None';
    }
    const player = userLineup.starters.find(p => p.id === playerId);
    return player?.name?.split(' ').pop() || '?';
  };

  // Cycle functions for basketball
  const cyclePace = useCallback(() => {
    const options: BasketballPace[] = ['standard', 'fast', 'slow'];
    const currentIndex = options.indexOf(basketballStrategy.pace);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'standard';
    setBasketballStrategy({
      ...basketballStrategy,
      pace: nextValue,
    });
  }, [basketballStrategy, setBasketballStrategy]);

  const cycleDefense = useCallback(() => {
    const options: BasketballDefense[] = ['mixed', 'man', 'zone'];
    const currentIndex = options.indexOf(basketballStrategy.defense);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'mixed';
    setBasketballStrategy({
      ...basketballStrategy,
      defense: nextValue,
    });
  }, [basketballStrategy, setBasketballStrategy]);

  const cycleRebounding = useCallback(() => {
    const options: BasketballRebounding[] = ['standard', 'crash_glass', 'prevent_transition'];
    const currentIndex = options.indexOf(basketballStrategy.rebounding);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'standard';
    setBasketballStrategy({
      ...basketballStrategy,
      rebounding: nextValue,
    });
  }, [basketballStrategy, setBasketballStrategy]);

  // Cycle a specific scoring option slot through starters (or None)
  const cycleScoringOption = useCallback((slotIndex: number) => {
    const starterIds = userLineup.starters.map(p => p.id);
    const currentOptions = [...basketballStrategy.scoringOptions];
    const currentPlayerId = currentOptions[slotIndex];

    // Get IDs already used in other slots
    const usedIds = currentOptions.filter((id, idx) => id && idx !== slotIndex);

    // Available options: None + starters not used in other slots
    const availableIds = starterIds.filter(id => !usedIds.includes(id));

    if (!currentPlayerId) {
      // Currently None, move to first available starter
      const firstAvailable = availableIds[0];
      if (firstAvailable) {
        currentOptions[slotIndex] = firstAvailable;
      }
    } else {
      // Find next available starter or wrap to None
      const currentIndex = availableIds.indexOf(currentPlayerId);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= availableIds.length) {
        // Wrap to None
        currentOptions[slotIndex] = undefined as unknown as string;
      } else {
        currentOptions[slotIndex] = availableIds[nextIndex]!;
      }
    }

    // Clean up: remove trailing undefined values
    while (currentOptions.length > 0 && !currentOptions[currentOptions.length - 1]) {
      currentOptions.pop();
    }

    setBasketballStrategy({
      ...basketballStrategy,
      scoringOptions: currentOptions.filter(Boolean),
    });
  }, [basketballStrategy, setBasketballStrategy, userLineup.starters]);

  // Baseball strategy formatters
  const formatPlateApproach = (approach: PlateApproach) => {
    switch (approach) {
      case 'aggressive': return 'Aggressive';
      case 'patient': return 'Patient';
      default: return 'Balanced';
    }
  };

  const formatSwingStyle = (style: SwingStyle) => {
    switch (style) {
      case 'power': return 'Power';
      case 'contact': return 'Contact';
      default: return 'Balanced';
    }
  };

  const formatBaserunning = (style: BaserunningStyle) => {
    switch (style) {
      case 'aggressive': return 'Aggressive';
      case 'conservative': return 'Conservative';
      default: return 'Balanced';
    }
  };

  // Cycle through options for baseball strategy
  const cyclePlateApproach = useCallback(() => {
    const options: PlateApproach[] = ['balanced', 'aggressive', 'patient'];
    const currentIndex = options.indexOf(baseballStrategy.batting.plateApproach);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] as PlateApproach;
    setBaseballStrategy({
      ...baseballStrategy,
      batting: { ...baseballStrategy.batting, plateApproach: nextValue },
    });
  }, [baseballStrategy, setBaseballStrategy]);

  const cycleSwingStyle = useCallback(() => {
    const options: SwingStyle[] = ['balanced', 'power', 'contact'];
    const currentIndex = options.indexOf(baseballStrategy.batting.swingStyle);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] as SwingStyle;
    setBaseballStrategy({
      ...baseballStrategy,
      batting: { ...baseballStrategy.batting, swingStyle: nextValue },
    });
  }, [baseballStrategy, setBaseballStrategy]);

  const cycleBaserunning = useCallback(() => {
    const options: BaserunningStyle[] = ['balanced', 'aggressive', 'conservative'];
    const currentIndex = options.indexOf(baseballStrategy.batting.baserunningStyle);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] as BaserunningStyle;
    setBaseballStrategy({
      ...baseballStrategy,
      batting: { ...baseballStrategy.batting, baserunningStyle: nextValue },
    });
  }, [baseballStrategy, setBaseballStrategy]);

  // Format soccer strategy values for display
  const formatAttackingStyle = (style: SoccerAttackingStyle) => {
    switch (style) {
      case 'possession': return 'Possession';
      case 'direct': return 'Direct';
      case 'counter': return 'Counter';
      default: return 'Direct';
    }
  };

  const formatPressing = (pressing: SoccerPressing) => {
    switch (pressing) {
      case 'high': return 'High';
      case 'low': return 'Low';
      default: return 'Balanced';
    }
  };

  const formatWidth = (width: SoccerWidth) => {
    switch (width) {
      case 'wide': return 'Wide';
      case 'tight': return 'Tight';
      default: return 'Balanced';
    }
  };

  // Cycle through options for soccer strategy
  const cycleAttackingStyle = useCallback(() => {
    const options: SoccerAttackingStyle[] = ['direct', 'possession', 'counter'];
    const currentIndex = options.indexOf(soccerStrategy.attackingStyle);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'direct';
    setSoccerStrategy({
      ...soccerStrategy,
      attackingStyle: nextValue,
    });
  }, [soccerStrategy, setSoccerStrategy]);

  const cyclePressing = useCallback(() => {
    const options: SoccerPressing[] = ['balanced', 'high', 'low'];
    const currentIndex = options.indexOf(soccerStrategy.pressing);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'balanced';
    setSoccerStrategy({
      ...soccerStrategy,
      pressing: nextValue,
    });
  }, [soccerStrategy, setSoccerStrategy]);

  const cycleWidth = useCallback(() => {
    const options: SoccerWidth[] = ['balanced', 'wide', 'tight'];
    const currentIndex = options.indexOf(soccerStrategy.width);
    const nextIndex = (currentIndex + 1) % options.length;
    const nextValue = options[nextIndex] ?? 'balanced';
    setSoccerStrategy({
      ...soccerStrategy,
      width: nextValue,
    });
  }, [soccerStrategy, setSoccerStrategy]);

  // Loading state
  if (!isReady || !matchData) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading match...
        </Text>
      </View>
    );
  }

  // Match already completed
  if (match?.status === 'completed') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.completedText, { color: colors.text }]}>
          Match Completed
        </Text>
        <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
          {match.result?.homeScore} - {match.result?.awayScore}
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Match Header */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
          <Text style={styles.sportText}>{matchData.sport}</Text>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.team}>
            <Text style={[styles.teamName, { color: colors.text }]}>
              {matchData.homeTeam.name}
            </Text>
            <Text style={[styles.record, { color: colors.textSecondary }]}>
              {matchData.homeTeam.record}
            </Text>
            <Text style={[styles.homeAway, { color: colors.textMuted }]}>HOME</Text>
          </View>

          <Text style={[styles.vs, { color: colors.textMuted }]}>VS</Text>

          <View style={styles.team}>
            <Text style={[styles.teamName, { color: colors.text }]}>
              {matchData.awayTeam.name}
            </Text>
            <Text style={[styles.record, { color: colors.textSecondary }]}>
              {matchData.awayTeam.record}
            </Text>
            <Text style={[styles.homeAway, { color: colors.textMuted }]}>AWAY</Text>
          </View>
        </View>

        <Text style={[styles.weekLabel, { color: colors.textMuted }]}>
          Week {matchData.week}
        </Text>
      </View>

      {/* Starting Lineup - Sport-Specific */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {match?.sport === 'baseball' ? 'Batting Order' : 'Starting Lineup'}
        </Text>

        {/* Basketball Lineup */}
        {match?.sport === 'basketball' && (
          <View style={styles.lineupGrid}>
            {userLineup.starters.map((player, index) => {
              const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
              const position = positions[index] || `#${index + 1}`;
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.positionSlot, { borderColor: colors.border }]}
                  onPress={() => onPlayerPress?.(player.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.positionLabel, { color: colors.primary }]}>
                    {position}
                  </Text>
                  <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]}>
                    {player.name}
                  </Text>
                  <View style={styles.playerStatsRow}>
                    <Text style={[styles.playerOverall, { color: colors.primary }]}>
                      {player.overall}
                    </Text>
                    <Text
                      style={[
                        styles.playerFitness,
                        {
                          color:
                            player.matchFitness >= 75
                              ? colors.textMuted
                              : player.matchFitness >= 50
                              ? colors.warning
                              : colors.error,
                        },
                      ]}
                    >
                      {Math.round(player.matchFitness)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Baseball Lineup */}
        {match?.sport === 'baseball' && (
          <>
            {/* Starting Pitcher */}
            {baseballLineup.startingPitcher && (
              <TouchableOpacity
                style={[styles.pitcherSlot, { borderColor: sportColor, backgroundColor: sportColor + '10' }]}
                onPress={() => onPlayerPress?.(baseballLineup.startingPitcher!.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pitcherLabel, { color: sportColor }]}>STARTING PITCHER</Text>
                <Text style={[styles.pitcherName, styles.tappableName, { color: colors.text }]}>
                  {baseballLineup.startingPitcher.name}
                </Text>
                <View style={styles.playerStatsRow}>
                  <Text style={[styles.pitcherOverall, { color: sportColor }]}>
                    {baseballLineup.startingPitcher.overall}
                  </Text>
                  <Text
                    style={[
                      styles.playerFitness,
                      {
                        color:
                          baseballLineup.startingPitcher.matchFitness >= 75
                            ? colors.textMuted
                            : baseballLineup.startingPitcher.matchFitness >= 50
                            ? colors.warning
                            : colors.error,
                      },
                    ]}
                  >
                    {Math.round(baseballLineup.startingPitcher.matchFitness)}%
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Batting Order */}
            <View style={styles.lineupGrid}>
              {baseballLineup.battingOrder.map((player, index) => (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.positionSlot, { borderColor: colors.border }]}
                  onPress={() => onPlayerPress?.(player.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.positionLabel, { color: colors.textMuted }]}>
                    #{index + 1}
                  </Text>
                  <Text style={[styles.positionBadge, { color: sportColor }]}>
                    {player.position}
                  </Text>
                  <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]}>
                    {player.name}
                  </Text>
                  <View style={styles.playerStatsRow}>
                    <Text style={[styles.playerOverall, { color: colors.primary }]}>
                      {player.overall}
                    </Text>
                    <Text
                      style={[
                        styles.playerFitness,
                        {
                          color:
                            player.matchFitness >= 75
                              ? colors.textMuted
                              : player.matchFitness >= 50
                              ? colors.warning
                              : colors.error,
                        },
                      ]}
                    >
                      {Math.round(player.matchFitness)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Soccer Lineup */}
        {match?.sport === 'soccer' && (
          <>
            <View style={[styles.formationBadge, { backgroundColor: sportColor + '20' }]}>
              <Text style={[styles.formationText, { color: sportColor }]}>
                Formation: {soccerLineup.formation}
              </Text>
            </View>
            <View style={styles.lineupGrid}>
              {soccerLineup.starters.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.positionSlot, { borderColor: colors.border }]}
                  onPress={() => onPlayerPress?.(player.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.positionBadge, { color: sportColor }]}>
                    {player.position || '?'}
                  </Text>
                  <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]}>
                    {player.name}
                  </Text>
                  <View style={styles.playerStatsRow}>
                    <Text style={[styles.playerOverall, { color: colors.primary }]}>
                      {player.overall}
                    </Text>
                    <Text
                      style={[
                        styles.playerFitness,
                        {
                          color:
                            player.matchFitness >= 75
                              ? colors.textMuted
                              : player.matchFitness >= 50
                              ? colors.warning
                              : colors.error,
                        },
                      ]}
                    >
                      {Math.round(player.matchFitness)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Bench Preview */}
        {userLineup.bench.length > 0 && (
          <View style={styles.benchSection}>
            <Text style={[styles.benchLabel, { color: colors.textMuted }]}>
              BENCH ({userLineup.bench.length})
            </Text>
            <Text style={[styles.benchNames, { color: colors.textSecondary }]}>
              {userLineup.bench.slice(0, 3).map((p) => p.name).join(', ')}
              {userLineup.bench.length > 3 && ` +${userLineup.bench.length - 3} more`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.editButton, { borderColor: colors.primary }]}
          activeOpacity={0.7}
          onPress={onEditLineup}
        >
          <Text style={[styles.editButtonText, { color: colors.primary }]}>
            Edit Lineup
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tactics - Sport-Specific */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {match?.sport === 'basketball' ? 'Tactics' : 'Strategy'}
        </Text>

        {/* Basketball Tactics - Tappable to cycle through options */}
        {match?.sport === 'basketball' && (
          <>
            <View style={styles.tacticsRow}>
              <TouchableOpacity style={styles.tacticItem} onPress={cyclePace} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Pace</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatPace(basketballStrategy.pace)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tacticItem} onPress={cycleDefense} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Defense</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatDefense(basketballStrategy.defense)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tacticItem} onPress={cycleRebounding} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Boards</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatRebounding(basketballStrategy.rebounding)}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.tacticsRow, { marginTop: spacing.md }]}>
              <TouchableOpacity style={styles.tacticItem} onPress={() => cycleScoringOption(0)} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Option #1</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatScoringOption(0)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tacticItem} onPress={() => cycleScoringOption(1)} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Option #2</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatScoringOption(1)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tacticItem} onPress={() => cycleScoringOption(2)} activeOpacity={0.6}>
                <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Option #3</Text>
                <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                  {formatScoringOption(2)}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Baseball Strategy - Tappable to cycle through options */}
        {match?.sport === 'baseball' && (
          <View style={styles.tacticsRow}>
            <TouchableOpacity style={styles.tacticItem} onPress={cyclePlateApproach} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Approach</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatPlateApproach(baseballStrategy.batting.plateApproach)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tacticItem} onPress={cycleSwingStyle} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Swing</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatSwingStyle(baseballStrategy.batting.swingStyle)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tacticItem} onPress={cycleBaserunning} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Baserunning</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatBaserunning(baseballStrategy.batting.baserunningStyle)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Soccer Strategy - Tappable to cycle through options */}
        {match?.sport === 'soccer' && (
          <View style={styles.tacticsRow}>
            <TouchableOpacity style={styles.tacticItem} onPress={cycleAttackingStyle} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Style</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatAttackingStyle(soccerStrategy.attackingStyle)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tacticItem} onPress={cyclePressing} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Pressing</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatPressing(soccerStrategy.pressing)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tacticItem} onPress={cycleWidth} activeOpacity={0.6}>
              <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Width</Text>
              <Text style={[styles.tacticValue, styles.tappableTactic, { color: sportColor }]}>
                {formatWidth(soccerStrategy.width)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Team Comparison */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Matchup</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonTeam}>
            <Text style={[styles.comparisonName, { color: colors.text }]}>
              {matchData.userIsHome ? matchData.homeTeam.name : matchData.awayTeam.name}
            </Text>
            <Text style={[styles.comparisonStat, { color: colors.primary }]}>
              {Math.round(
                (matchData.userIsHome ? matchData.homeTeam : matchData.awayTeam).roster.reduce(
                  (sum, p) => sum + p.overall,
                  0
                ) / (matchData.userIsHome ? matchData.homeTeam : matchData.awayTeam).roster.length
              )} AVG
            </Text>
          </View>
          <Text style={[styles.comparisonVs, { color: colors.textMuted }]}>vs</Text>
          <View style={styles.comparisonTeam}>
            <Text style={[styles.comparisonName, { color: colors.text }]}>
              {matchData.userIsHome ? matchData.awayTeam.name : matchData.homeTeam.name}
            </Text>
            <Text style={[styles.comparisonStat, { color: colors.textSecondary }]}>
              {Math.round(
                (matchData.userIsHome ? matchData.awayTeam : matchData.homeTeam).roster.reduce(
                  (sum, p) => sum + p.overall,
                  0
                ) / (matchData.userIsHome ? matchData.awayTeam : matchData.homeTeam).roster.length
              )} AVG
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: isLoading || isSimulating ? 0.5 : 1 },
          ]}
          onPress={handleStartMatch}
          activeOpacity={0.8}
          disabled={isLoading || isSimulating}
        >
          <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
            Watch Match
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { borderColor: colors.border, opacity: isLoading || isSimulating ? 0.5 : 1 },
          ]}
          onPress={handleQuickSim}
          activeOpacity={0.7}
          disabled={isLoading || isSimulating}
        >
          {isSimulating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Quick Sim
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Sim Confirmation */}
      <ConfirmationModal
        visible={showQuickSimConfirm}
        title="Quick Simulate?"
        message="The match will be simulated instantly and you'll see the final result."
        confirmText="Simulate"
        cancelText="Cancel"
        onConfirm={confirmQuickSim}
        onCancel={() => setShowQuickSimConfirm(false)}
      />

      {/* Loading Overlay */}
      {isSimulating && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background + 'F0' }]}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card }, shadows.lg]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingOverlayText, { color: colors.text }]}>
              {loadingMessage || 'Loading...'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  completedText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  sportBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  sportText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  record: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  homeAway: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  vs: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: spacing.md,
  },
  weekLabel: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  lineupGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  positionSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  positionLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: '600',
  },
  playerName: {
    flex: 1,
    fontSize: 14,
  },
  tappableName: {
    textDecorationLine: 'underline',
  },
  playerOverall: {
    fontSize: 14,
    fontWeight: '700',
  },
  playerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerFitness: {
    fontSize: 11,
    fontWeight: '600',
  },
  positionBadge: {
    width: 32,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  pitcherSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  pitcherLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: spacing.md,
  },
  pitcherName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  pitcherOverall: {
    fontSize: 16,
    fontWeight: '700',
  },
  formationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  formationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  benchSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  benchLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  benchNames: {
    fontSize: 13,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tacticsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tacticItem: {
    flex: 1,
  },
  tacticLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  tacticValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tappableTactic: {
    textDecorationLine: 'underline',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonTeam: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  comparisonStat: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonVs: {
    fontSize: 14,
    marginHorizontal: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingOverlayText: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConnectedMatchPreviewScreen;
