/**
 * Connected Lineup Editor Screen
 *
 * Container component that connects the LineupEditorScreen to GameContext.
 * Handles lineup management for basketball and soccer.
 *
 * UX Pattern: Tap-to-select, then tap destination to assign.
 * - Tap a position slot in Starting XI to select it (highlighted)
 * - Tap a bench player to assign them to the selected slot
 * - OR tap a Starting XI slot, then tap another slot to swap
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { useColors, spacing, shadows } from '../theme';
import { useLineup, LineupPlayer, FORMATION_POSITIONS } from '../hooks/useLineup';
import { calculateSoccerPositionOverall } from '../integration/gameInitializer';
import { useGame } from '../context/GameContext';
import type { SoccerFormation, BaseballPosition } from '../context/types';
import type { BaseballPositionType } from '../../utils/overallRating';
import {
  aggregateSoccerPlayerStats,
  aggregateSoccerGoalkeeperStats,
  aggregatePlayerStats,
  type AggregatedPlayerStats,
} from '../../systems/statsAggregator';
import {
  calculateContactComposite,
  calculatePowerComposite,
  calculateDisciplineComposite,
} from '../../simulation/baseball/systems/batting';
import {
  calculateOverallEffectiveness as calculatePitchingComposite,
  calculateVelocityComposite,
  calculateControlComposite,
  calculateMovementComposite,
} from '../../simulation/baseball/systems/pitching';
import {
  calculateSpeedComposite,
} from '../../simulation/baseball/systems/baserunning';
import {
  calculateFieldingComposite,
  calculateArmComposite,
} from '../../simulation/baseball/systems/fielding';
import type { Player } from '../../data/types';

interface ConnectedLineupEditorScreenProps {
  sport: 'basketball' | 'baseball' | 'soccer';
  onSave: () => void;
  onCancel: () => void;
  onPlayerPress?: (playerId: string) => void;
}

const BASKETBALL_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const SOCCER_FORMATIONS: SoccerFormation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2', '4-1-4-1'];

/** Format height from inches to feet'inches" (e.g., 72 -> 6'0") */
function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

/** Get fitness color based on percentage */
function getFitnessColor(fitness: number, colors: ReturnType<typeof useColors>): string {
  if (fitness >= 75) return colors.success;
  if (fitness >= 50) return colors.warning;
  return colors.error;
}

// =============================================================================
// BASKETBALL STAT OPTIONS
// =============================================================================

/** Basketball stat options for dropdown */
type BasketballStatOption =
  | 'overall' | 'shooting' | 'athleticism' | 'defense' | 'playmaking' | 'fitness'
  | 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'fgPct' | 'fg3Pct' | 'ftPct' | 'eff' | 'mpg';

const BASKETBALL_STAT_OPTIONS: { value: BasketballStatOption; label: string }[] = [
  // Attributes
  { value: 'overall', label: 'Overall' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'athleticism', label: 'Athletic' },
  { value: 'defense', label: 'Defense' },
  { value: 'playmaking', label: 'Playmaking' },
  { value: 'fitness', label: 'Fitness' },
  // Per-game stats
  { value: 'ppg', label: 'PPG' },
  { value: 'rpg', label: 'RPG' },
  { value: 'apg', label: 'APG' },
  { value: 'spg', label: 'SPG' },
  { value: 'bpg', label: 'BPG' },
  { value: 'mpg', label: 'MPG' },
  // Efficiency stats
  { value: 'fgPct', label: 'FG%' },
  { value: 'fg3Pct', label: '3P%' },
  { value: 'ftPct', label: 'FT%' },
  { value: 'eff', label: 'EFF' },
];

/** Calculate basketball stat value for a player */
function getBasketballStatValue(
  player: LineupPlayer | null | undefined,
  stat: BasketballStatOption,
  playersRecord?: Record<string, Player>,
  aggregatedStatsMap?: Map<string, AggregatedPlayerStats>
): string {
  if (!player) return '-';

  // Get full player data if available
  let p: Player | undefined;
  if (playersRecord && player.id) {
    p = playersRecord[player.id];
  }

  // Get aggregated stats if available
  const aggStats = aggregatedStatsMap?.get(player.id);

  switch (stat) {
    case 'overall':
      return String(player.overall);
    case 'shooting':
      if (!p?.attributes) return String(player.overall);
      // Shooting composite: throw_accuracy + form_technique
      const shooting = Math.round(
        (p.attributes.throw_accuracy + p.attributes.form_technique) / 2
      );
      return String(shooting);
    case 'athleticism':
      if (!p?.attributes) return String(player.overall);
      // Athleticism: agility + top_speed + jumping
      const athleticism = Math.round(
        (p.attributes.agility + p.attributes.top_speed + p.attributes.jumping) / 3
      );
      return String(athleticism);
    case 'defense':
      if (!p?.attributes) return String(player.overall);
      // Defense: reactions + footwork + awareness
      const defense = Math.round(
        (p.attributes.reactions + p.attributes.footwork + p.attributes.awareness) / 3
      );
      return String(defense);
    case 'playmaking':
      if (!p?.attributes) return String(player.overall);
      // Playmaking: awareness + creativity + teamwork
      const playmaking = Math.round(
        (p.attributes.awareness + p.attributes.creativity + p.attributes.teamwork) / 3
      );
      return String(playmaking);
    case 'fitness':
      return `${Math.round(player.matchFitness)}%`;
    // Per-game stats from aggregated data
    case 'ppg':
      return aggStats ? aggStats.ppg.toFixed(1) : '-';
    case 'rpg':
      return aggStats ? aggStats.rpg.toFixed(1) : '-';
    case 'apg':
      return aggStats ? aggStats.apg.toFixed(1) : '-';
    case 'spg':
      return aggStats ? aggStats.spg.toFixed(1) : '-';
    case 'bpg':
      return aggStats ? aggStats.bpg.toFixed(1) : '-';
    case 'mpg':
      return aggStats ? aggStats.mpg.toFixed(1) : '-';
    // Efficiency stats
    case 'fgPct':
      return aggStats ? `${aggStats.fgPct.toFixed(1)}%` : '-';
    case 'fg3Pct':
      return aggStats ? `${aggStats.fg3Pct.toFixed(1)}%` : '-';
    case 'ftPct':
      return aggStats ? `${aggStats.ftPct.toFixed(1)}%` : '-';
    case 'eff':
      return aggStats ? aggStats.eff.toFixed(1) : '-';
    default:
      return String(player.overall);
  }
}

/** Get label for basketball stat option */
function getBasketballStatLabel(stat: BasketballStatOption): string {
  const option = BASKETBALL_STAT_OPTIONS.find(o => o.value === stat);
  return option?.label || stat;
}

// =============================================================================
// MINUTES SLIDER COMPONENT
// =============================================================================

interface MinutesSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  maxMinutes: number;
  /** Maximum value this slider can be set to (for enforcing total limits) */
  maxAllowed?: number;
  colors: ReturnType<typeof useColors>;
  step?: number;
  /** Sport type - affects preset values and UI */
  sport: 'basketball' | 'soccer' | 'baseball';
}

/**
 * Simple and reliable minutes slider using +/- buttons and preset buttons.
 */
function MinutesSlider({ value, onValueChange, maxMinutes, maxAllowed, colors, step = 5, sport }: MinutesSliderProps) {
  // The effective maximum is the lesser of maxMinutes and maxAllowed
  const effectiveMax = maxAllowed !== undefined ? Math.min(maxMinutes, maxAllowed) : maxMinutes;

  // Handle +/- button presses
  const handleIncrement = useCallback(() => {
    const newValue = Math.min(value + step, effectiveMax);
    onValueChange(newValue);
  }, [value, step, effectiveMax, onValueChange]);

  const handleDecrement = useCallback(() => {
    const newValue = Math.max(value - step, 0);
    onValueChange(newValue);
  }, [value, step, onValueChange]);

  // Quick set buttons for common values
  const handleQuickSet = useCallback((targetValue: number) => {
    const clampedValue = Math.min(targetValue, effectiveMax);
    onValueChange(clampedValue);
  }, [effectiveMax, onValueChange]);

  const fillPercentage = (value / maxMinutes) * 100;

  // Determine color based on minutes for visual feedback (soccer only)
  const getSliderColor = () => {
    if (value >= 60) return colors.primary; // Heavy minutes
    if (value >= 30) return colors.success; // Rotation player
    if (value > 0) return colors.warning; // Limited minutes
    return colors.textMuted; // DNP
  };

  // Preset values based on sport
  const presets = sport === 'basketball' ? [0, 10, 20, 30, 40] : [0, 45, 90];

  return (
    <View style={sliderStyles.container}>
      {/* Decrement button */}
      <TouchableOpacity
        onPress={handleDecrement}
        style={[sliderStyles.stepButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.6}
        disabled={value <= 0}
      >
        <Text style={[sliderStyles.stepButtonText, { color: value <= 0 ? colors.textMuted : colors.text }]}>−</Text>
      </TouchableOpacity>

      {/* Quick set buttons */}
      <View style={sliderStyles.quickSetContainer}>
        {presets.map((preset) => {
          const isSelected = value === preset;
          const isDisabled = preset > effectiveMax;
          return (
            <TouchableOpacity
              key={preset}
              onPress={() => handleQuickSet(preset)}
              style={[
                sliderStyles.presetButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
                isDisabled && { opacity: 0.4 },
              ]}
              activeOpacity={0.6}
              disabled={isDisabled}
            >
              <Text style={[
                sliderStyles.presetButtonText,
                { color: isSelected ? '#fff' : colors.text }
              ]}>
                {preset}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Visual bar indicator - only for soccer */}
      {sport === 'soccer' ? (
        <View style={[sliderStyles.track, { backgroundColor: colors.border }]}>
          <View
            style={[
              sliderStyles.fill,
              { width: `${fillPercentage}%`, backgroundColor: getSliderColor() },
            ]}
          />
        </View>
      ) : (
        /* Spacer for basketball to push elements apart */
        <View style={sliderStyles.spacer} />
      )}

      {/* Increment button */}
      <TouchableOpacity
        onPress={handleIncrement}
        style={[sliderStyles.stepButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.6}
        disabled={value >= effectiveMax}
      >
        <Text style={[sliderStyles.stepButtonText, { color: value >= effectiveMax ? colors.textMuted : colors.text }]}>+</Text>
      </TouchableOpacity>

      {/* Value display */}
      <Text style={[sliderStyles.valueText, { color: colors.text }]}>
        {value}m
      </Text>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 4,
    gap: 4,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  stepButtonText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  quickSetContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  presetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 32,
    alignItems: 'center',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  valueText: {
    width: 32,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
});

export function ConnectedLineupEditorScreen({
  sport,
  onSave,
  onCancel,
  onPlayerPress,
}: ConnectedLineupEditorScreenProps) {
  const colors = useColors();

  // Baseball
  if (sport === 'baseball') {
    return <BaseballLineupEditor colors={colors} onSave={onSave} onCancel={onCancel} onPlayerPress={onPlayerPress} />;
  }

  // Basketball
  if (sport === 'basketball') {
    return <BasketballLineupEditor colors={colors} onSave={onSave} onCancel={onCancel} onPlayerPress={onPlayerPress} />;
  }

  return <SoccerLineupEditor colors={colors} onSave={onSave} onCancel={onCancel} onPlayerPress={onPlayerPress} />;
}

// =============================================================================
// BASKETBALL LINEUP EDITOR
// =============================================================================

function BasketballLineupEditor({
  colors,
  onSave,
  onCancel,
  onPlayerPress,
}: {
  colors: ReturnType<typeof useColors>;
  onSave: () => void;
  onCancel: () => void;
  onPlayerPress?: (playerId: string) => void;
}) {
  const {
    starters,
    bench,
    reserves,
    setStarter,
    moveToBench,
    swapStarters,
    applyOptimalLineup,
    setTargetMinutes,
    getMaxAllowedMinutes,
    totalMinutesAllocated,
    isValidLineup,
    swapBenchWithReserve,
    addToBench,
  } = useLineup('basketball');

  const { state } = useGame();
  const allPlayers = state.players;

  // Compute aggregated player stats from completed basketball matches
  const aggregatedStatsMap = useMemo(() => {
    const basketballMatches = state.season.matches.filter(m => m.sport === 'basketball');
    const aggregatedStats = aggregatePlayerStats(
      basketballMatches,
      state.players,
      state.userTeam.name,
      state.league.teams
    );
    // Build a map for fast lookups by player ID
    const map = new Map<string, AggregatedPlayerStats>();
    for (const stats of aggregatedStats) {
      map.set(stats.playerId, stats);
    }
    return map;
  }, [state.season.matches, state.players, state.userTeam.name, state.league.teams]);

  // Selection state for tap-to-swap UX
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  // Selection state for bench/reserve swap - stores player id and whether they're on bench
  const [selectedBenchReserve, setSelectedBenchReserve] = useState<{ id: string; isBench: boolean } | null>(null);

  // Stat display selection for each section
  const [starterStatSelection, setStarterStatSelection] = useState<BasketballStatOption>('overall');
  const [benchStatSelection, setBenchStatSelection] = useState<BasketballStatOption>('overall');
  const [showStatPicker, setShowStatPicker] = useState<'starters' | 'bench' | null>(null);

  // Minutes adjustment modal state
  const [minutesModalPlayer, setMinutesModalPlayer] = useState<{
    id: string;
    name: string;
    current: number;
    maxAllowed: number;
  } | null>(null);

  // Handle tapping a bench or reserve player's badge for swap
  const handleBenchReserveBadgePress = (playerId: string, isBench: boolean) => {
    if (selectedBenchReserve === null) {
      // Nothing selected - select this player
      setSelectedBenchReserve({ id: playerId, isBench });
    } else if (selectedBenchReserve.id === playerId) {
      // Same player - deselect
      setSelectedBenchReserve(null);
    } else if (selectedBenchReserve.isBench === isBench) {
      // Same category (both bench or both reserve) - just switch selection
      setSelectedBenchReserve({ id: playerId, isBench });
    } else {
      // Different categories - perform atomic swap
      if (selectedBenchReserve.isBench) {
        // Selected was bench, tapped reserve -> swap bench player with reserve
        swapBenchWithReserve?.(selectedBenchReserve.id, playerId);
      } else {
        // Selected was reserve, tapped bench -> swap bench player with reserve
        swapBenchWithReserve?.(playerId, selectedBenchReserve.id);
      }
      setSelectedBenchReserve(null);
    }
  };

  // Auto-fill lineup on mount if empty or not properly configured
  useEffect(() => {
    // Count non-undefined starters
    const filledStarters = starters.filter(s => s !== undefined).length;
    if (filledStarters < 5 && applyOptimalLineup) {
      (applyOptimalLineup as () => void)();
    }
  }, []); // Only on mount

  // Insert optimal lineup - uses hook's applyOptimalLineup which handles minutes properly
  const insertOptimalLineup = useCallback(() => {
    if (applyOptimalLineup) {
      (applyOptimalLineup as () => void)();
    }
    setSelectedSlotIndex(null);
  }, [applyOptimalLineup]);

  // Handle tapping a position slot in Starting Five
  const handleSlotPress = (slotIndex: number, _currentPlayer: LineupPlayer | undefined) => {
    if (selectedSlotIndex === null) {
      // Nothing selected - select this slot
      setSelectedSlotIndex(slotIndex);
    } else if (selectedSlotIndex === slotIndex) {
      // Same slot - deselect
      setSelectedSlotIndex(null);
    } else {
      // Different slot selected - swap players
      if (swapStarters) {
        (swapStarters as (a: number, b: number) => void)(selectedSlotIndex, slotIndex);
      }
      setSelectedSlotIndex(null);
    }
  };

  // Handle tapping a bench player
  const handleBenchPlayerPress = (player: LineupPlayer, slotIndex: number) => {
    // Place bench player into specified position slot
    setStarter(player.id, slotIndex);
    setSelectedSlotIndex(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Top Actions Row */}
        <View style={styles.basketballActionsRow}>
          <TouchableOpacity
            style={[styles.optimalButton, { backgroundColor: colors.primary }]}
            onPress={insertOptimalLineup}
          >
            <Text style={styles.optimalButtonText}>Auto-fill Lineup</Text>
          </TouchableOpacity>
          {selectedSlotIndex !== null && (
            <Text style={[styles.swapHintText, { color: colors.primary }]}>
              Tap another position to swap
            </Text>
          )}
        </View>

        {/* Starting Five */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Starting Five</Text>
            <TouchableOpacity
              style={[styles.statDropdown, { borderColor: colors.border }]}
              onPress={() => setShowStatPicker('starters')}
            >
              <Text style={[styles.statDropdownText, { color: colors.primary }]}>
                {getBasketballStatLabel(starterStatSelection)} ▼
              </Text>
            </TouchableOpacity>
          </View>
          {BASKETBALL_POSITIONS.map((position, index) => {
            const starter = starters[index];
            const isSlotSelected = selectedSlotIndex === index;
            return (
              <TouchableOpacity
                key={position}
                style={[
                  styles.playerRow,
                  { borderBottomColor: colors.border },
                  isSlotSelected && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => handleSlotPress(index, starter)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.positionBadgeLarge,
                  { backgroundColor: isSlotSelected ? colors.primary : colors.primary + '20' },
                ]}>
                  <Text style={[
                    styles.positionBadgeTextLarge,
                    { color: isSlotSelected ? '#000' : colors.primary }
                  ]}>{position}</Text>
                </View>
                {starter ? (
                  <>
                    <TouchableOpacity
                      style={[styles.basketballMinutesButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setMinutesModalPlayer({
                          id: starter.id,
                          name: starter.name,
                          current: starter.targetMinutes,
                          maxAllowed: getMaxAllowedMinutes ? getMaxAllowedMinutes(starter.id) : 48,
                        });
                      }}
                    >
                      <Text style={[styles.basketballMinutesText, { color: colors.text }]}>
                        {starter.targetMinutes}m
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.basketballPlayerInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(starter.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {starter.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.primary, fontWeight: '600' }]}>
                          {starter.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(starter.matchFitness, colors) }]}>
                          {Math.round(starter.matchFitness)}%
                        </Text>
                        {starter.isInjured && (
                          <>
                            <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                            <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.basketballStatColumn}>
                      <Text style={[styles.basketballStatValue, { color: colors.primary }]}>
                        {getBasketballStatValue(starter, starterStatSelection, allPlayers, aggregatedStatsMap)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSlotSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bench */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Bench ({bench.length})
            </Text>
            <TouchableOpacity
              style={[styles.statDropdown, { borderColor: colors.border }]}
              onPress={() => setShowStatPicker('bench')}
            >
              <Text style={[styles.statDropdownText, { color: colors.primary }]}>
                {getBasketballStatLabel(benchStatSelection)} ▼
              </Text>
            </TouchableOpacity>
          </View>
          {selectedSlotIndex !== null && (
            <Text style={[styles.sectionSubtitle, { color: colors.primary }]}>
              Tap a player to assign to {BASKETBALL_POSITIONS[selectedSlotIndex]}
            </Text>
          )}
          {bench.length === 0 ? (
            <Text style={[styles.emptyBench, { color: colors.textMuted }]}>
              No bench players
            </Text>
          ) : (
            [...bench].sort((a, b) => b.overall - a.overall).map((player) => {
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && !selectedBenchReserve.isBench;
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primary + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.primary + '08' },
                  ]}
                  onPress={() => {
                    if (selectedSlotIndex !== null) {
                      handleBenchPlayerPress(player, selectedSlotIndex);
                    } else {
                      handleBenchReserveBadgePress(player.id, true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadgeLarge,
                      { backgroundColor: isSelected ? colors.primary : colors.primary + '20' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (selectedSlotIndex !== null) {
                        handleBenchPlayerPress(player, selectedSlotIndex);
                      } else {
                        handleBenchReserveBadgePress(player.id, true);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeTextLarge,
                      { color: isSelected ? '#000' : colors.primary }
                    ]}>BN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.basketballMinutesButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setMinutesModalPlayer({
                        id: player.id,
                        name: player.name,
                        current: player.targetMinutes,
                        maxAllowed: getMaxAllowedMinutes ? getMaxAllowedMinutes(player.id) : 48,
                      });
                    }}
                  >
                    <Text style={[styles.basketballMinutesText, { color: colors.text }]}>
                      {player.targetMinutes}m
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.basketballPlayerInfo}
                    onPress={(e) => {
                      e.stopPropagation();
                      onPlayerPress?.(player.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <View style={styles.playerStats}>
                      <Text style={[styles.statText, { color: colors.primary, fontWeight: '600' }]}>
                        {player.overall} OVR
                      </Text>
                      <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                      <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                        {Math.round(player.matchFitness)}%
                      </Text>
                      {player.isInjured && (
                        <>
                          <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                          <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.basketballStatColumn}>
                    <Text style={[styles.basketballStatValue, { color: colors.primary }]}>
                      {getBasketballStatValue(player, benchStatSelection, allPlayers, aggregatedStatsMap)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reserves */}
        {reserves.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Reserves ({reserves.length})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              {bench.length < 9
                ? 'Tap + to add to bench'
                : 'Tap RSV then BN to swap'}
            </Text>
            {reserves.map((player) => {
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && selectedBenchReserve.isBench;
              const canAddToBench = bench.length < 9;
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.textMuted + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.textMuted + '08' },
                  ]}
                  onPress={() => {
                    if (selectedSlotIndex !== null) {
                      handleBenchPlayerPress(player, selectedSlotIndex);
                    } else {
                      handleBenchReserveBadgePress(player.id, false);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadgeLarge,
                      { backgroundColor: isSelected ? colors.textMuted : colors.textMuted + '30' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (selectedSlotIndex !== null) {
                        handleBenchPlayerPress(player, selectedSlotIndex);
                      } else {
                        handleBenchReserveBadgePress(player.id, false);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeTextLarge,
                      { color: isSelected ? '#fff' : colors.textMuted }
                    ]}>RSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.basketballPlayerInfo}
                    onPress={(e) => {
                      e.stopPropagation();
                      onPlayerPress?.(player.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <View style={styles.playerStats}>
                      <Text style={[styles.statText, { color: colors.textMuted, fontWeight: '600' }]}>
                        {player.overall} OVR
                      </Text>
                      <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                      <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                        {Math.round(player.matchFitness)}%
                      </Text>
                      {player.isInjured && (
                        <>
                          <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                          <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                  {canAddToBench && (
                    <TouchableOpacity
                      style={[styles.addToBenchButton, { backgroundColor: colors.success + '20' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        addToBench?.(player.id);
                      }}
                    >
                      <Text style={[styles.addToBenchButtonText, { color: colors.success }]}>+</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky Minutes Summary - Always visible */}
      <View style={[styles.stickyMinutesSummary, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Text style={[styles.minutesSummaryLabel, { color: colors.textMuted }]}>
          Total Minutes
        </Text>
        <Text style={[
          styles.stickyMinutesValue,
          { color: totalMinutesAllocated === 240 ? colors.success : totalMinutesAllocated > 240 ? colors.error : colors.warning }
        ]}>
          {totalMinutesAllocated} / 240
        </Text>
        {totalMinutesAllocated > 240 && (
          <Text style={[styles.minutesWarning, { color: colors.error }]}>
            Over limit by {totalMinutesAllocated - 240}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={[styles.buttonRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            { backgroundColor: isValidLineup && totalMinutesAllocated <= 240 ? colors.primary : colors.textMuted },
          ]}
          onPress={onSave}
          disabled={!isValidLineup || totalMinutesAllocated > 240}
        >
          <Text style={[styles.buttonText, { color: '#000' }]}>
            {totalMinutesAllocated > 240 ? 'Over Limit' : 'Save Lineup'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stat Picker Modal */}
      <Modal
        visible={showStatPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatPicker(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStatPicker(null)}
        >
          <View style={[styles.positionPickerModal, { backgroundColor: colors.card }, shadows.lg]}>
            <Text style={[styles.positionPickerTitle, { color: colors.text }]}>
              Select Stat to Display
            </Text>
            <View style={styles.positionPickerGrid}>
              {BASKETBALL_STAT_OPTIONS.map((option) => {
                const currentSelection = showStatPicker === 'starters' ? starterStatSelection : benchStatSelection;
                const isSelected = currentSelection === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.positionPickerButton,
                      { borderColor: colors.border, minWidth: 80 },
                      isSelected && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      if (showStatPicker === 'starters') setStarterStatSelection(option.value);
                      else if (showStatPicker === 'bench') setBenchStatSelection(option.value);
                      setShowStatPicker(null);
                    }}
                  >
                    <Text style={[styles.positionPickerButtonText, { color: isSelected ? colors.primary : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.positionPickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowStatPicker(null)}
            >
              <Text style={[styles.positionPickerCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Minutes Adjustment Modal */}
      <Modal
        visible={minutesModalPlayer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMinutesModalPlayer(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMinutesModalPlayer(null)}
        >
          <View style={[styles.minutesModal, { backgroundColor: colors.card }, shadows.lg]}>
            <Text style={[styles.minutesModalTitle, { color: colors.text }]}>
              {minutesModalPlayer?.name}
            </Text>
            <Text style={[styles.minutesModalSubtitle, { color: colors.textMuted }]}>
              Set target minutes (max {minutesModalPlayer?.maxAllowed || 48})
            </Text>
            <View style={styles.minutesPresetGrid}>
              {[0, 8, 16, 24, 32, 40, 48].filter(m => m <= (minutesModalPlayer?.maxAllowed || 48)).map((mins) => {
                const isSelected = minutesModalPlayer?.current === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.minutesPresetButton,
                      { borderColor: colors.border },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      if (minutesModalPlayer) {
                        setTargetMinutes(minutesModalPlayer.id, mins);
                        setMinutesModalPlayer(null);
                      }
                    }}
                  >
                    <Text style={[
                      styles.minutesPresetText,
                      { color: isSelected ? '#fff' : colors.text }
                    ]}>
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.minutesCustomRow}>
              <TouchableOpacity
                style={[styles.minutesStepButton, { borderColor: colors.border }]}
                onPress={() => {
                  if (minutesModalPlayer && minutesModalPlayer.current > 0) {
                    const newValue = Math.max(0, minutesModalPlayer.current - 2);
                    setTargetMinutes(minutesModalPlayer.id, newValue);
                    setMinutesModalPlayer({ ...minutesModalPlayer, current: newValue });
                  }
                }}
              >
                <Text style={[styles.minutesStepButtonText, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.minutesCurrentValue, { color: colors.primary }]}>
                {minutesModalPlayer?.current || 0}m
              </Text>
              <TouchableOpacity
                style={[styles.minutesStepButton, { borderColor: colors.border }]}
                onPress={() => {
                  if (minutesModalPlayer && minutesModalPlayer.current < minutesModalPlayer.maxAllowed) {
                    const newValue = Math.min(minutesModalPlayer.maxAllowed, minutesModalPlayer.current + 2);
                    setTargetMinutes(minutesModalPlayer.id, newValue);
                    setMinutesModalPlayer({ ...minutesModalPlayer, current: newValue });
                  }
                }}
              >
                <Text style={[styles.minutesStepButtonText, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.minutesModalDone, { backgroundColor: colors.primary }]}
              onPress={() => setMinutesModalPlayer(null)}
            >
              <Text style={styles.minutesModalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// =============================================================================
// SOCCER LINEUP EDITOR
// =============================================================================

/**
 * Soccer position slot with unique index for formations with duplicate positions
 */
interface PositionSlot {
  position: string;
  slotIndex: number;
  player: LineupPlayer | undefined;
}

function SoccerLineupEditor({
  colors,
  onSave,
  onCancel,
  onPlayerPress,
}: {
  colors: ReturnType<typeof useColors>;
  onSave: () => void;
  onCancel: () => void;
  onPlayerPress?: (playerId: string) => void;
}) {
  const { state } = useGame();
  const {
    starters,
    bench,
    reserves,
    formation,
    formationPositions,
    setStarter,
    moveToBench,
    setFormation,
    swapStarters,
    isValidLineup,
    getFormationRatings,
    getCurrentLineupAverageOverall,
    applyOptimalLineup,
    swapBenchWithReserve,
    addToBench,
  } = useLineup('soccer');

  // Get formation ratings for comparison
  const formationRatings = useMemo((): Record<SoccerFormation, number> => {
    if (getFormationRatings) {
      return getFormationRatings();
    }
    // Return default 0 ratings if function not available
    return Object.keys(FORMATION_POSITIONS).reduce((acc, f) => {
      acc[f as SoccerFormation] = 0;
      return acc;
    }, {} as Record<SoccerFormation, number>);
  }, [getFormationRatings]);

  // Compute Relative +/- stats for all players (from completed soccer matches)
  const playerRelPlusMinus = useMemo((): Record<string, number> => {
    const soccerMatches = state.season.matches.filter(m => m.sport === 'soccer');
    const teams = [
      { id: 'user', name: state.userTeam.name },
      ...state.league.teams.filter(t => t.id !== 'user'),
    ];

    // Get outfield player stats (includes rel+/-)
    const outfieldStats = aggregateSoccerPlayerStats(
      soccerMatches,
      state.players,
      state.userTeam.name,
      teams
    );

    // Get goalkeeper stats (includes rel+/-)
    const gkStats = aggregateSoccerGoalkeeperStats(
      soccerMatches,
      state.players,
      state.userTeam.name,
      teams
    );

    // Build lookup map: playerId -> relPlusMinus
    const lookup: Record<string, number> = {};
    for (const stat of outfieldStats) {
      lookup[stat.playerId] = stat.relPlusMinus;
    }
    for (const stat of gkStats) {
      lookup[stat.playerId] = stat.relPlusMinus;
    }

    return lookup;
  }, [state.season.matches, state.players, state.userTeam.name, state.league.teams]);

  // Auto-fill lineup on mount if empty
  useEffect(() => {
    if (starters.length === 0 && applyOptimalLineup) {
      applyOptimalLineup();
    }
  }, []); // Only on mount

  // Selection state for tap-to-swap UX
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  // Selection state for bench/reserve swap
  const [selectedBenchReserve, setSelectedBenchReserve] = useState<{ id: string; isBench: boolean } | null>(null);
  // Position picker modal state - stores player ID and current slot
  const [positionPickerPlayer, setPositionPickerPlayer] = useState<{
    playerId: string;
    playerName: string;
    currentSlot: number;
  } | null>(null);

  // Handle tapping a bench or reserve player's badge for swap
  const handleBenchReserveBadgePress = (playerId: string, isBench: boolean) => {
    if (selectedBenchReserve === null) {
      setSelectedBenchReserve({ id: playerId, isBench });
    } else if (selectedBenchReserve.id === playerId) {
      setSelectedBenchReserve(null);
    } else if (selectedBenchReserve.isBench === isBench) {
      setSelectedBenchReserve({ id: playerId, isBench });
    } else {
      if (selectedBenchReserve.isBench) {
        swapBenchWithReserve?.(selectedBenchReserve.id, playerId);
      } else {
        swapBenchWithReserve?.(playerId, selectedBenchReserve.id);
      }
      setSelectedBenchReserve(null);
    }
  };

  // Calculate position-specific overall for a player at a given slot
  const getPositionOverall = (playerId: string, slotIndex: number): number => {
    const player = state.players[playerId];
    if (!player) return 0;
    const position = (formationPositions || FORMATION_POSITIONS['4-4-2'])[slotIndex] || 'CM';
    return calculateSoccerPositionOverall(player, position);
  };

  // Calculate "best fit" overall for bench players (shows their highest potential position)
  const getBenchPlayerBestOverall = (playerId: string): { overall: number; position: string } => {
    const player = state.players[playerId];
    if (!player) return { overall: 0, position: '?' };

    const positions = formationPositions || FORMATION_POSITIONS['4-4-2'];
    let bestOverall = 0;
    let bestPosition = positions[0] || 'CM';

    // Find the position where this player has the highest overall
    const uniquePositions = [...new Set(positions)];
    for (const pos of uniquePositions) {
      const ovr = calculateSoccerPositionOverall(player, pos);
      if (ovr > bestOverall) {
        bestOverall = ovr;
        bestPosition = pos;
      }
    }

    return { overall: bestOverall, position: bestPosition };
  };

  // Insert optimal lineup - uses the hook's applyOptimalLineup which factors in stamina
  const insertOptimalLineup = () => {
    if (applyOptimalLineup) {
      applyOptimalLineup();
    }
    setSelectedSlotIndex(null);
  };

  // Build position slots - each slot has a unique index (0-10)
  // Players are directly mapped by their slotIndex property
  const positionSlots: PositionSlot[] = (formationPositions || []).map((pos, idx) => {
    // Find the player assigned to this exact slot index
    const playerInSlot = starters.find((s) => s && s.slotIndex === idx);
    return { position: pos, slotIndex: idx, player: playerInSlot };
  });

  // Handle tapping a position slot in Starting XI
  const handleSlotPress = (slotIndex: number, currentPlayer: LineupPlayer | undefined) => {
    if (selectedSlotIndex === null) {
      // Nothing selected - select this slot
      setSelectedSlotIndex(slotIndex);
    } else if (selectedSlotIndex === slotIndex) {
      // Same slot - deselect
      setSelectedSlotIndex(null);
    } else {
      // Different slot selected - swap players using single state update
      const selectedSlot = positionSlots[selectedSlotIndex];
      if (selectedSlot?.player && currentPlayer) {
        // Both slots have players - swap them in one update
        if (swapStarters) {
          (swapStarters as (a: number, b: number) => void)(selectedSlotIndex, slotIndex);
        }
      } else if (selectedSlot?.player && !currentPlayer) {
        // Selected slot has player, current is empty - move player
        setStarter(selectedSlot.player.id, slotIndex);
      } else if (!selectedSlot?.player && currentPlayer) {
        // Selected is empty, current has player - move player
        setStarter(currentPlayer.id, selectedSlotIndex);
      }
      setSelectedSlotIndex(null);
    }
  };

  // Handle tapping the position badge to open position picker
  const handlePositionBadgePress = (player: LineupPlayer, slotIndex: number) => {
    setPositionPickerPlayer({
      playerId: player.id,
      playerName: player.name,
      currentSlot: slotIndex,
    });
  };

  // Handle tapping a bench player
  const handleBenchPlayerPress = (player: LineupPlayer) => {
    if (selectedSlotIndex !== null) {
      // A slot is selected - assign this player to it
      const selectedSlot = positionSlots[selectedSlotIndex];
      if (selectedSlot?.player) {
        // Swap: move current starter to bench, put bench player in slot
        moveToBench(selectedSlot.player.id);
      }
      setStarter(player.id, selectedSlotIndex);
      setSelectedSlotIndex(null);
    } else {
      // No slot selected - find first empty slot or show hint
      const emptySlotIndex = positionSlots.findIndex(s => !s.player);
      if (emptySlotIndex !== -1) {
        setStarter(player.id, emptySlotIndex);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Formation Picker */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.formationHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Formation</Text>
            {getCurrentLineupAverageOverall !== undefined && getCurrentLineupAverageOverall > 0 && (
              <View style={[styles.averageOverallBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.averageOverallText, { color: colors.primary }]}>
                  Avg: {getCurrentLineupAverageOverall}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.formationPicker}>
            {SOCCER_FORMATIONS.map((f) => {
              const rating = formationRatings[f] || 0;
              const isSelected = f === formation;
              const allRatings = Object.values(formationRatings) as number[];
              const maxRating = allRatings.length > 0 ? Math.max(...allRatings) : 0;
              const isBest = rating > 0 && rating === maxRating;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.formationButton,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + '20' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    if (applyOptimalLineup) {
                      // Apply optimal lineup for the new formation
                      (applyOptimalLineup as (formation: SoccerFormation) => void)(f);
                    } else if (setFormation) {
                      (setFormation as (formation: SoccerFormation) => void)(f);
                    }
                    setSelectedSlotIndex(null);
                  }}
                >
                  <Text
                    style={[
                      styles.formationButtonText,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                  >
                    {f}
                  </Text>
                  <Text
                    style={[
                      styles.formationRating,
                      { color: isBest ? colors.success : colors.textMuted },
                      isBest && { fontWeight: '700' },
                    ]}
                  >
                    {rating}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionBar, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.instructionText, { color: colors.primary }]}>
            {selectedSlotIndex !== null
              ? `Tap a bench player to assign, or tap another position to swap`
              : `Tap a position to select • Long press for position ratings`}
          </Text>
        </View>

        {/* Starting XI */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Starting XI ({starters.length}/11)
            </Text>
            <View style={styles.sectionHeaderButtons}>
              {!isValidLineup && starters.length < 11 && (
                <Text style={[styles.validationHint, { color: colors.warning }]}>
                  Need {11 - starters.length} more
                </Text>
              )}
              <TouchableOpacity
                style={[styles.optimalButton, { backgroundColor: colors.primary }]}
                onPress={insertOptimalLineup}
              >
                <Text style={styles.optimalButtonText}>Auto-fill</Text>
              </TouchableOpacity>
            </View>
          </View>

          {positionSlots.map(({ position, slotIndex, player }) => {
            const isSlotSelected = selectedSlotIndex === slotIndex;
            return (
              <TouchableOpacity
                key={`slot-${slotIndex}`}
                style={[
                  styles.playerRow,
                  { borderBottomColor: colors.border },
                  isSlotSelected && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => handleSlotPress(slotIndex, player)}
                activeOpacity={0.7}
              >
                {/* Position badge - tap to select for swap, long press to show position picker */}
                <TouchableOpacity
                  style={[
                    styles.positionBadgeLarge,
                    { backgroundColor: isSlotSelected ? colors.primary : colors.primary + '20' },
                    player && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    // Tap always selects slot for swapping
                    handleSlotPress(slotIndex, player);
                  }}
                  onLongPress={(e) => {
                    e.stopPropagation();
                    // Long press opens position picker (shows positional ratings)
                    if (player) {
                      handlePositionBadgePress(player, slotIndex);
                    }
                  }}
                  delayLongPress={300}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.positionBadgeTextLarge,
                    { color: isSlotSelected ? '#000' : colors.primary }
                  ]}>
                    {position}
                  </Text>
                </TouchableOpacity>

                {player ? (
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.primary, fontWeight: '600' }]}>
                          {getPositionOverall(player.id, slotIndex)} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}% fit
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: colors.textMuted }]}>±</Text>
                        {(() => {
                          const relPM = playerRelPlusMinus[player.id];
                          if (relPM === undefined) {
                            return <Text style={[styles.statText, { color: colors.textMuted }]}>--</Text>;
                          }
                          return (
                            <Text style={[
                              styles.statText,
                              {
                                color: relPM > 0 ? colors.success : relPM < 0 ? colors.error : colors.textMuted,
                                fontWeight: '600'
                              }
                            ]}>
                              {relPM > 0 ? '+' : ''}{relPM.toFixed(1)}
                            </Text>
                          );
                        })()}
                        {player.isInjured && (
                          <>
                            <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                            <Text style={[styles.statText, { color: colors.error, fontWeight: '600' }]}>INJ</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSlotSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bench */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Bench ({bench.length})
          </Text>
          {selectedSlotIndex !== null ? (
            <Text style={[styles.sectionSubtitle, { color: colors.primary }]}>
              Tap a player to assign to {positionSlots[selectedSlotIndex]?.position || ''}
            </Text>
          ) : (
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Tap BN then RSV to swap
            </Text>
          )}
          {bench.length === 0 ? (
            <Text style={[styles.emptyBench, { color: colors.textMuted }]}>
              All players are in starting lineup
            </Text>
          ) : (
            bench.map((player) => {
              const bestFit = getBenchPlayerBestOverall(player.id);
              const displayOverall = selectedSlotIndex !== null
                ? getPositionOverall(player.id, selectedSlotIndex)
                : bestFit.overall;
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && !selectedBenchReserve.isBench;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primary + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.primary + '08' },
                  ]}
                  onPress={() => {
                    if (selectedSlotIndex !== null) {
                      handleBenchPlayerPress(player);
                    } else {
                      handleBenchReserveBadgePress(player.id, true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadgeLarge,
                      { backgroundColor: isSelected ? colors.primary : colors.primary + '20' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      // If a starter slot is selected, assign this player to that slot
                      if (selectedSlotIndex !== null) {
                        handleBenchPlayerPress(player);
                      } else {
                        handleBenchReserveBadgePress(player.id, true);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeTextLarge,
                      { color: isSelected ? '#000' : colors.primary }
                    ]}>BN</Text>
                  </TouchableOpacity>
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <View style={[styles.naturalPosBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.naturalPosText, { color: colors.success }]}>
                            {bestFit.position}
                          </Text>
                        </View>
                        <Text style={[styles.statText, { color: colors.primary, fontWeight: '600' }]}>
                          {displayOverall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}% fit
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: colors.textMuted }]}>±</Text>
                        {(() => {
                          const relPM = playerRelPlusMinus[player.id];
                          if (relPM === undefined) {
                            return <Text style={[styles.statText, { color: colors.textMuted }]}>--</Text>;
                          }
                          return (
                            <Text style={[
                              styles.statText,
                              {
                                color: relPM > 0 ? colors.success : relPM < 0 ? colors.error : colors.textMuted,
                                fontWeight: '600'
                              }
                            ]}>
                              {relPM > 0 ? '+' : ''}{relPM.toFixed(1)}
                            </Text>
                          );
                        })()}
                        {player.isInjured && (
                          <>
                            <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                            <Text style={[styles.statText, { color: colors.error, fontWeight: '600' }]}>INJ</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reserves */}
        {reserves.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Reserves ({reserves.length})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              {bench.length < 9
                ? 'Tap + to add to bench, or RSV then BN to swap'
                : 'Players not on active roster • Tap RSV then BN to swap'}
            </Text>
            {reserves.map((player) => {
              const bestFit = getBenchPlayerBestOverall(player.id);
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && selectedBenchReserve.isBench;
              const canAddToBench = bench.length < 9;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.textMuted + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.textMuted + '08' },
                  ]}
                  onPress={() => {
                    // If a starter slot is selected, assign this player directly to that slot
                    if (selectedSlotIndex !== null) {
                      handleBenchPlayerPress(player);
                    } else {
                      handleBenchReserveBadgePress(player.id, false);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadgeLarge,
                      { backgroundColor: isSelected ? colors.textMuted : colors.textMuted + '30' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      // If a starter slot is selected, assign this player directly to that slot
                      if (selectedSlotIndex !== null) {
                        handleBenchPlayerPress(player);
                      } else {
                        handleBenchReserveBadgePress(player.id, false);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeTextLarge,
                      { color: isSelected ? '#fff' : colors.textMuted }
                    ]}>RSV</Text>
                  </TouchableOpacity>
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <View style={[styles.naturalPosBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.naturalPosText, { color: colors.success }]}>
                            {bestFit.position}
                          </Text>
                        </View>
                        <Text style={[styles.statText, { color: colors.primary, fontWeight: '600' }]}>
                          {bestFit.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}% fit
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: colors.textMuted }]}>±</Text>
                        {(() => {
                          const relPM = playerRelPlusMinus[player.id];
                          if (relPM === undefined) {
                            return <Text style={[styles.statText, { color: colors.textMuted }]}>--</Text>;
                          }
                          return (
                            <Text style={[
                              styles.statText,
                              {
                                color: relPM > 0 ? colors.success : relPM < 0 ? colors.error : colors.textMuted,
                                fontWeight: '600'
                              }
                            ]}>
                              {relPM > 0 ? '+' : ''}{relPM.toFixed(1)}
                            </Text>
                          );
                        })()}
                        {player.isInjured && (
                          <>
                            <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                            <Text style={[styles.statText, { color: colors.error, fontWeight: '600' }]}>INJ</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                    {canAddToBench && (
                      <TouchableOpacity
                        style={[styles.addToBenchButton, { backgroundColor: colors.success + '20' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          addToBench?.(player.id);
                        }}
                      >
                        <Text style={[styles.addToBenchButtonText, { color: colors.success }]}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.buttonRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            { backgroundColor: isValidLineup ? colors.primary : colors.textMuted },
          ]}
          onPress={onSave}
          disabled={!isValidLineup}
        >
          <Text style={[styles.buttonText, { color: '#000' }]}>
            {!isValidLineup ? `Need ${11 - starters.length} more` : 'Save Lineup'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Soccer Position Picker Modal */}
      <Modal
        visible={positionPickerPlayer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPositionPickerPlayer(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPositionPickerPlayer(null)}
        >
          <View style={[styles.positionPickerModal, { backgroundColor: colors.card }, shadows.lg]}>
            <Text style={[styles.positionPickerTitle, { color: colors.text }]}>
              Position Ratings for {positionPickerPlayer?.playerName || 'Player'}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md }]}>
              Tap a position to move player there
            </Text>
            <View style={styles.positionPickerGrid}>
              {(formationPositions || FORMATION_POSITIONS['4-4-2']).map((pos, idx) => {
                const isCurrentPosition = positionPickerPlayer?.currentSlot === idx;
                const rating = positionPickerPlayer
                  ? getPositionOverall(positionPickerPlayer.playerId, idx)
                  : 0;
                // Check if slot is occupied by another player
                const slotOccupied = positionSlots[idx]?.player &&
                  positionSlots[idx]?.player?.id !== positionPickerPlayer?.playerId;
                const occupyingPlayer = slotOccupied ? positionSlots[idx]?.player : null;

                return (
                  <TouchableOpacity
                    key={`pos-${idx}`}
                    style={[
                      styles.positionPickerButton,
                      { borderColor: colors.border },
                      isCurrentPosition && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      if (positionPickerPlayer && idx !== positionPickerPlayer.currentSlot) {
                        if (slotOccupied && swapStarters) {
                          // Swap with existing player
                          (swapStarters as (a: number, b: number) => void)(positionPickerPlayer.currentSlot, idx);
                        } else {
                          // Move to empty slot
                          setStarter(positionPickerPlayer.playerId, idx);
                        }
                      }
                      setPositionPickerPlayer(null);
                    }}
                  >
                    <Text style={[styles.positionPickerButtonText, { color: isCurrentPosition ? colors.primary : colors.text }]}>
                      {pos}
                    </Text>
                    <Text style={[styles.positionPickerButtonRating, { color: colors.primary, fontWeight: '600' }]}>
                      {rating}
                    </Text>
                    {occupyingPlayer && (
                      <Text style={[styles.positionPickerOccupied, { color: colors.textMuted }]} numberOfLines={1}>
                        {occupyingPlayer.name.split(' ').pop()}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.positionPickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setPositionPickerPlayer(null)}
            >
              <Text style={[styles.positionPickerCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// =============================================================================
// BASEBALL LINEUP EDITOR
// =============================================================================

/** Defensive position labels for baseball */
const DEFENSIVE_POSITIONS: BaseballPosition[] = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'];

/** Baseball stat options for dropdown */
type BaseballStatOption =
  | 'contact' | 'power' | 'discipline' | 'speed'
  | 'pitching' | 'velocity' | 'control' | 'movement'
  | 'fielding' | 'arm'
  | 'avg' | 'obp' | 'slg' | 'ops';

const BATTING_STAT_OPTIONS: { value: BaseballStatOption; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'power', label: 'Power' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'speed', label: 'Speed' },
  { value: 'fielding', label: 'Fielding' },
  { value: 'arm', label: 'Arm' },
  { value: 'avg', label: 'AVG' },
  { value: 'obp', label: 'OBP' },
  { value: 'slg', label: 'SLG' },
  { value: 'ops', label: 'OPS' },
];

const PITCHING_STAT_OPTIONS: { value: BaseballStatOption; label: string }[] = [
  { value: 'pitching', label: 'Pitching' },
  { value: 'velocity', label: 'Velocity' },
  { value: 'control', label: 'Control' },
  { value: 'movement', label: 'Movement' },
];

// Combined options for bench (includes both batting and pitching stats)
const BENCH_STAT_OPTIONS: { value: BaseballStatOption; label: string }[] = [
  ...BATTING_STAT_OPTIONS,
  ...PITCHING_STAT_OPTIONS,
];

/** Calculate stat value for a player */
function getBaseballStatValue(
  player: LineupPlayer | Player | null | undefined,
  stat: BaseballStatOption,
  playersRecord?: Record<string, Player>
): string {
  if (!player) return '-';

  // If we have a LineupPlayer (has 'id' but not 'attributes'), look up full Player
  let p: Player;
  if ('attributes' in player && player.attributes) {
    p = player as Player;
  } else if (playersRecord && player.id) {
    const fullPlayer = playersRecord[player.id];
    if (!fullPlayer || !fullPlayer.attributes) return '-';
    p = fullPlayer;
  } else {
    return '-';
  }

  switch (stat) {
    case 'contact':
      return Math.round(calculateContactComposite(p)).toString();
    case 'power':
      return Math.round(calculatePowerComposite(p)).toString();
    case 'discipline':
      return Math.round(calculateDisciplineComposite(p)).toString();
    case 'speed':
      return Math.round(calculateSpeedComposite(p)).toString();
    case 'pitching':
      return Math.round(calculatePitchingComposite(p)).toString();
    case 'velocity':
      return Math.round(calculateVelocityComposite(p)).toString();
    case 'control':
      return Math.round(calculateControlComposite(p)).toString();
    case 'movement':
      return Math.round(calculateMovementComposite(p)).toString();
    case 'fielding':
      return Math.round(calculateFieldingComposite(p, 'SS')).toString(); // Use SS as generic position
    case 'arm':
      return Math.round(calculateArmComposite(p)).toString();
    case 'avg':
    case 'obp':
    case 'slg':
    case 'ops': {
      // Calculate from career stats
      const stats = p.careerStats;
      if (!stats || stats.atBats === 0) return '.000';

      const hits = stats.hits || 0;
      const walks = stats.walks || 0;
      const hbp = 0; // Not tracked
      const ab = stats.atBats;
      const sf = 0; // Not tracked
      const doubles = stats.doubles || 0;
      const triples = stats.triples || 0;
      const hr = stats.homeRuns || 0;

      const avg = hits / ab;
      const obpVal = (hits + walks + hbp) / (ab + walks + hbp + sf);
      const tb = hits + doubles + (2 * triples) + (3 * hr);
      const slgVal = tb / ab;

      if (stat === 'avg') return avg.toFixed(3).replace('0.', '.');
      if (stat === 'obp') return obpVal.toFixed(3).replace('0.', '.');
      if (stat === 'slg') return slgVal.toFixed(3).replace('0.', '.');
      if (stat === 'ops') return (obpVal + slgVal).toFixed(3);
    }
    default:
      return '-';
  }
}

/** Get stat label for display */
function getStatLabel(stat: BaseballStatOption): string {
  const option = [...BATTING_STAT_OPTIONS, ...PITCHING_STAT_OPTIONS].find(o => o.value === stat);
  return option?.label || stat.toUpperCase();
}

function BaseballLineupEditor({
  colors,
  onSave,
  onCancel,
  onPlayerPress,
}: {
  colors: ReturnType<typeof useColors>;
  onSave: () => void;
  onCancel: () => void;
  onPlayerPress?: (playerId: string) => void;
}) {
  const { state } = useGame();
  const {
    players,
    battingOrder,
    startingPitcher,
    setStartingPitcher,
    setPosition,
    addToBattingOrder,
    removeFromBattingOrder,
    swapBattingOrder,
    getPositionOverall,
    getBestPosition,
    applyOptimalLineup,
    isValidLineup,
    bench,
    reserves,
    bullpen,
    setBullpenRole,
    removeFromBullpen,
    swapBullpenRoles,
    swapBullpenWithBatter,
    swapBenchWithReserve,
    addToBench,
  } = useLineup('baseball');

  // Full player records for looking up attributes
  const allPlayers = state.players;

  // Auto-fill lineup on mount if not properly configured
  useEffect(() => {
    // Check if lineup needs to be initialized (no pitcher or empty batting order)
    const hasNoPitcher = !startingPitcher;
    const hasEmptyBattingOrder = !battingOrder || battingOrder.length === 0 || battingOrder.every((id) => !id);
    if ((hasNoPitcher || hasEmptyBattingOrder) && applyOptimalLineup) {
      (applyOptimalLineup as () => void)();
    }
  }, []); // Only on mount

  // Suppress unused variable warning - players is used for type inference
  void players;

  // Unified selection state for tap-to-swap UX
  // Can select: batting slot, starting pitcher, or bullpen slot
  type SelectionType =
    | { type: 'batting'; slotIndex: number; playerId: string | null }
    | { type: 'pitcher'; playerId: string | null }
    | { type: 'bullpen'; role: 'longReliever' | 'shortReliever' | 'closer'; slotIndex?: number; playerId: string | null }
    | null;

  const [selection, setSelection] = useState<SelectionType>(null);
  // Selection state for bench/reserve swap
  const [selectedBenchReserve, setSelectedBenchReserve] = useState<{ id: string; isBench: boolean } | null>(null);

  // Position picker modal state - stores player ID whose position is being changed
  const [positionPickerPlayerId, setPositionPickerPlayerId] = useState<string | null>(null);

  // Stat selection state for each section
  const [battingStatSelection, setBattingStatSelection] = useState<BaseballStatOption>('contact');
  const [pitcherStatSelection, setPitcherStatSelection] = useState<BaseballStatOption>('pitching');
  const [bullpenStatSelection, setBullpenStatSelection] = useState<BaseballStatOption>('pitching');
  const [benchStatSelection, setBenchStatSelection] = useState<BaseballStatOption>('contact');
  const [showStatPicker, setShowStatPicker] = useState<'batting' | 'pitcher' | 'bullpen' | 'bench' | null>(null);

  // Helper to clear all selection
  const clearSelection = () => setSelection(null);

  // Handle tapping a bench or reserve player's badge for swap
  const handleBenchReserveBadgePress = (playerId: string, isBench: boolean) => {
    if (selectedBenchReserve === null) {
      setSelectedBenchReserve({ id: playerId, isBench });
    } else if (selectedBenchReserve.id === playerId) {
      setSelectedBenchReserve(null);
    } else if (selectedBenchReserve.isBench === isBench) {
      setSelectedBenchReserve({ id: playerId, isBench });
    } else {
      if (selectedBenchReserve.isBench) {
        swapBenchWithReserve?.(selectedBenchReserve.id, playerId);
      } else {
        swapBenchWithReserve?.(playerId, selectedBenchReserve.id);
      }
      setSelectedBenchReserve(null);
    }
  };

  // Insert optimal lineup - uses hook's applyOptimalLineup which handles bullpen too
  const insertOptimalLineup = useCallback(() => {
    if (applyOptimalLineup) {
      (applyOptimalLineup as () => void)();
    }
    clearSelection();
  }, [applyOptimalLineup]);

  // Handle tapping a batting order slot
  const handleBattingSlotPress = (slotIndex: number, playerId?: string) => {
    // If selecting a bullpen slot and clicking on a batter - swap them atomically
    if (selection?.type === 'bullpen' && selection.playerId && playerId) {
      const bullpenPlayerId = selection.playerId;
      const batterPlayerId = playerId;
      // Preserve the batter's defensive position
      const batterPosition = battingOrder?.[slotIndex]?.baseballPosition || 'DH';

      // Use atomic swap to avoid state batching issues
      swapBullpenWithBatter?.(
        bullpenPlayerId,
        selection.role,
        selection.slotIndex,
        batterPlayerId,
        slotIndex,
        batterPosition
      );
      clearSelection();
      return;
    }

    // If selecting pitcher and clicking on a batter - swap them
    if (selection?.type === 'pitcher' && selection.playerId && playerId) {
      const pitcherId = selection.playerId;
      const batterPlayerId = playerId;
      // Preserve the batter's defensive position
      const batterPosition = battingOrder?.[slotIndex]?.baseballPosition || 'DH';

      // Move batter to pitcher, pitcher to batting order with batter's position
      setStartingPitcher?.(batterPlayerId);
      addToBattingOrder?.(pitcherId, slotIndex, batterPosition);
      clearSelection();
      return;
    }

    // If there's a selected batting slot and we're clicking a different slot, swap them
    if (selection?.type === 'batting' && selection.slotIndex !== slotIndex) {
      swapBattingOrder?.(selection.slotIndex, slotIndex);
      clearSelection();
      return;
    }

    // Toggle selection
    if (selection?.type === 'batting' && selection.slotIndex === slotIndex) {
      clearSelection();
    } else {
      setSelection({ type: 'batting', slotIndex, playerId: playerId || null });
    }
  };

  // Handle tapping the starting pitcher
  const handlePitcherPress = () => {
    const pitcherId = startingPitcher?.id || null;

    // If selecting a batter and clicking on pitcher - swap them
    if (selection?.type === 'batting' && selection.playerId && pitcherId) {
      const batterPlayerId = selection.playerId;
      const batterSlot = selection.slotIndex;
      // Preserve the batter's defensive position
      const batterPosition = battingOrder?.[batterSlot]?.baseballPosition || 'DH';

      // Move batter to pitcher, pitcher to batting order with batter's position
      setStartingPitcher?.(batterPlayerId);
      addToBattingOrder?.(pitcherId, batterSlot, batterPosition);
      clearSelection();
      return;
    }

    // If selecting a bullpen slot and clicking on pitcher - swap them
    if (selection?.type === 'bullpen' && selection.playerId && pitcherId) {
      const bullpenPlayerId = selection.playerId;

      // Remove bullpen player from bullpen
      removeFromBullpen?.(bullpenPlayerId);
      // Add current pitcher to bullpen
      setBullpenRole?.(pitcherId, selection.role, selection.slotIndex);
      // Set bullpen player as starter
      setStartingPitcher?.(bullpenPlayerId);
      clearSelection();
      return;
    }

    // Toggle pitcher selection
    if (selection?.type === 'pitcher') {
      clearSelection();
    } else {
      setSelection({ type: 'pitcher', playerId: pitcherId });
    }
  };

  // Handle tapping a bench player
  const handleBenchPlayerPress = (player: LineupPlayer) => {
    if (selection?.type === 'pitcher') {
      setStartingPitcher?.(player.id);
      clearSelection();
    } else if (selection?.type === 'bullpen') {
      setBullpenRole?.(player.id, selection.role, selection.slotIndex);
      clearSelection();
    } else if (selection?.type === 'batting') {
      // Get the position from the player being displaced to preserve defensive assignment
      const displacedPosition = battingOrder?.[selection.slotIndex]?.baseballPosition || 'DH';
      addToBattingOrder?.(player.id, selection.slotIndex, displacedPosition);
      clearSelection();
    }
  };

  // Handle tapping a bullpen slot
  const handleBullpenSlotPress = (role: 'longReliever' | 'shortReliever' | 'closer', slotIndex: number | undefined, playerId: string | null) => {
    // If selecting pitcher and clicking bullpen - swap them
    if (selection?.type === 'pitcher' && selection.playerId && playerId) {
      const pitcherId = selection.playerId;

      // Remove bullpen player from bullpen
      removeFromBullpen?.(playerId);
      // Add current pitcher to bullpen
      setBullpenRole?.(pitcherId, role, slotIndex);
      // Set bullpen player as starter
      setStartingPitcher?.(playerId);
      clearSelection();
      return;
    }

    // If selecting a batter and clicking bullpen - swap them atomically
    if (selection?.type === 'batting' && selection.playerId && playerId) {
      const batterPlayerId = selection.playerId;
      const batterSlot = selection.slotIndex;
      // Preserve the batter's defensive position
      const batterPosition = battingOrder?.[batterSlot]?.baseballPosition || 'DH';

      // Use atomic swap to avoid state batching issues
      swapBullpenWithBatter?.(
        playerId,
        role,
        slotIndex,
        batterPlayerId,
        batterSlot,
        batterPosition
      );
      clearSelection();
      return;
    }

    // If selecting another bullpen slot - swap them using dedicated swap function
    if (selection?.type === 'bullpen' && selection.playerId && playerId &&
        (selection.role !== role || selection.slotIndex !== slotIndex)) {
      // Use dedicated swap function to handle both in single state update
      swapBullpenRoles?.(
        selection.playerId,
        selection.role,
        selection.slotIndex,
        playerId,
        role,
        slotIndex
      );
      clearSelection();
      return;
    }

    // Toggle selection
    if (selection?.type === 'bullpen' && selection.role === role && selection.slotIndex === slotIndex) {
      clearSelection();
    } else {
      setSelection({ type: 'bullpen', role, slotIndex, playerId });
    }
  };

  // Legacy compatibility
  const selectedBattingSlot = selection?.type === 'batting' ? selection.slotIndex : null;
  const selectedBattingPlayerId = selection?.type === 'batting' ? selection.playerId : null;
  const selectingPitcher = selection?.type === 'pitcher';
  const selectingBullpenRole = selection?.type === 'bullpen' ? { role: selection.role, slotIndex: selection.slotIndex } : null;

  // Get player name for position picker modal
  const positionPickerPlayer = positionPickerPlayerId
    ? battingOrder?.find(p => p.id === positionPickerPlayerId)
    : null;

  // Count filled batting slots
  const filledBattingSlots = battingOrder?.filter((p) => p.id).length || 0;

  // Count filled bullpen slots
  const filledBullpenSlots = (bullpen?.longRelievers?.filter(p => p)?.length || 0) +
    (bullpen?.shortRelievers?.filter(p => p)?.length || 0) +
    (bullpen?.closer ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Instructions */}
        <View style={[styles.instructionBar, { backgroundColor: colors.baseball + '15' }]}>
          <Text style={[styles.instructionText, { color: colors.baseball }]}>
            {selectingPitcher
              ? 'Tap a batter, bullpen pitcher, or bench player to swap'
              : selectingBullpenRole !== null
              ? `Tap pitcher, batter, other bullpen, or bench to swap`
              : selectedBattingPlayerId
              ? 'Tap another player to swap (pitcher, bullpen, or batter)'
              : selectedBattingSlot !== null
              ? 'Tap a bench player to add to lineup'
              : 'Tap any player to select, then tap another to swap'}
          </Text>
        </View>

        {/* Starting Pitcher */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Starting Pitcher</Text>
              <TouchableOpacity
                style={[styles.statDropdown, { borderColor: colors.border }]}
                onPress={() => setShowStatPicker('pitcher')}
              >
                <Text style={[styles.statDropdownText, { color: colors.baseball }]}>
                  {getStatLabel(pitcherStatSelection)} ▼
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.optimalButton, { backgroundColor: colors.baseball }]}
              onPress={insertOptimalLineup}
            >
              <Text style={styles.optimalButtonText}>Auto-fill</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.pitcherRow,
              { borderColor: selectingPitcher ? colors.baseball : colors.border },
              selectingPitcher && { backgroundColor: colors.baseball + '20' },
            ]}
            onPress={handlePitcherPress}
            activeOpacity={0.7}
          >
            <View style={[styles.positionBadgeLarge, { backgroundColor: selectingPitcher ? colors.baseball : colors.baseball + '30' }]}>
              <Text style={[styles.positionBadgeTextLarge, { color: selectingPitcher ? '#fff' : colors.baseball }]}>P</Text>
            </View>

            {startingPitcher ? (
              <View style={styles.playerRowContent}>
                <TouchableOpacity
                  style={styles.playerMainInfo}
                  onPress={(e) => {
                    e.stopPropagation();
                    onPlayerPress?.(startingPitcher.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                    {startingPitcher.name}
                  </Text>
                  <View style={styles.playerStats}>
                    <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                      {getPositionOverall?.(startingPitcher.id, 'P') ?? startingPitcher.overall} OVR
                    </Text>
                    <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                    <Text style={[styles.statText, { color: getFitnessColor(startingPitcher.matchFitness, colors) }]}>
                      {Math.round(startingPitcher.matchFitness)}%
                    </Text>
                    {startingPitcher.isInjured && (
                      <>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                  <Text style={[styles.statValueText, { color: colors.baseball }]}>
                    {getBaseballStatValue(startingPitcher, pitcherStatSelection, allPlayers)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptySlotContainer}>
                <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                  {selectingPitcher ? 'Select a player below' : 'Tap to select pitcher'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Batting Order */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Batting Order ({filledBattingSlots}/9)
              </Text>
              <TouchableOpacity
                style={[styles.statDropdown, { borderColor: colors.border }]}
                onPress={() => setShowStatPicker('batting')}
              >
                <Text style={[styles.statDropdownText, { color: colors.baseball }]}>
                  {getStatLabel(battingStatSelection)} ▼
                </Text>
              </TouchableOpacity>
            </View>
            {!isValidLineup && filledBattingSlots < 9 && (
              <Text style={[styles.validationHint, { color: colors.warning }]}>
                Need {9 - filledBattingSlots} more
              </Text>
            )}
          </View>

          {Array.from({ length: 9 }).map((_, slotIndex) => {
            const player = battingOrder?.[slotIndex];
            const isSlotSelected = selectedBattingSlot === slotIndex;
            const isPlayerSelected = player?.id && selectedBattingPlayerId === player.id;
            const assignedPosition = player?.baseballPosition;

            return (
              <TouchableOpacity
                key={`batting-${slotIndex}`}
                style={[
                  styles.playerRow,
                  { borderBottomColor: colors.border },
                  (isSlotSelected || isPlayerSelected) && { backgroundColor: colors.baseball + '20' },
                  isPlayerSelected && { borderLeftWidth: 3, borderLeftColor: colors.baseball },
                ]}
                onPress={() => handleBattingSlotPress(slotIndex, player?.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.battingOrderBadgeLarge, { backgroundColor: colors.baseball + '20' }]}>
                  <Text style={[styles.battingOrderTextLarge, { color: colors.baseball }]}>#{slotIndex + 1}</Text>
                </View>

                {player ? (
                  <View style={styles.playerRowContent}>
                    {/* Position dropdown - opens modal */}
                    <TouchableOpacity
                      style={[
                        styles.positionDropdownLarge,
                        { borderColor: colors.border },
                        positionPickerPlayerId === player.id && { borderColor: colors.baseball },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setPositionPickerPlayerId(player.id);
                      }}
                    >
                      <Text style={[styles.positionDropdownTextLarge, { color: assignedPosition ? colors.baseball : colors.textMuted }]}>
                        {assignedPosition || '?'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                          {getPositionOverall?.(player.id, assignedPosition || 'DH') ?? player.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}%
                        </Text>
                        {player.isInjured && (
                          <>
                            <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                            <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                      <Text style={[styles.statValueText, { color: colors.baseball }]}>
                        {getBaseballStatValue(player, battingStatSelection, allPlayers)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSlotSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bullpen */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Bullpen ({filledBullpenSlots}/5)
              </Text>
              <TouchableOpacity
                style={[styles.statDropdown, { borderColor: colors.border }]}
                onPress={() => setShowStatPicker('bullpen')}
              >
                <Text style={[styles.statDropdownText, { color: colors.baseball }]}>
                  {getStatLabel(bullpenStatSelection)} ▼
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Long Relievers */}
          <Text style={[styles.bullpenRoleLabel, { color: colors.textMuted }]}>Long Relievers</Text>
          {[0, 1].map((slotIndex) => {
            const player = bullpen?.longRelievers?.[slotIndex];
            const isSelected = selectingBullpenRole?.role === 'longReliever' && selectingBullpenRole?.slotIndex === slotIndex;
            return (
              <TouchableOpacity
                key={`long-${slotIndex}`}
                style={[
                  styles.bullpenRow,
                  { borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.baseball + '20' },
                ]}
                onPress={() => handleBullpenSlotPress('longReliever', slotIndex, player?.id || null)}
                activeOpacity={0.7}
              >
                <View style={[styles.bullpenBadgeLarge, { backgroundColor: colors.baseball + '30' }]}>
                  <Text style={[styles.bullpenBadgeTextLarge, { color: colors.baseball }]}>LR</Text>
                </View>
                {player ? (
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                          {getPositionOverall?.(player.id, 'P') ?? player.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                      <Text style={[styles.statValueText, { color: colors.baseball }]}>
                        {getBaseballStatValue(player, bullpenStatSelection, allPlayers)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Short Relievers */}
          <Text style={[styles.bullpenRoleLabel, { color: colors.textMuted, marginTop: spacing.sm }]}>Short Relievers</Text>
          {[0, 1].map((slotIndex) => {
            const player = bullpen?.shortRelievers?.[slotIndex];
            const isSelected = selectingBullpenRole?.role === 'shortReliever' && selectingBullpenRole?.slotIndex === slotIndex;
            return (
              <TouchableOpacity
                key={`short-${slotIndex}`}
                style={[
                  styles.bullpenRow,
                  { borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.baseball + '20' },
                ]}
                onPress={() => handleBullpenSlotPress('shortReliever', slotIndex, player?.id || null)}
                activeOpacity={0.7}
              >
                <View style={[styles.bullpenBadgeLarge, { backgroundColor: colors.baseball + '30' }]}>
                  <Text style={[styles.bullpenBadgeTextLarge, { color: colors.baseball }]}>SR</Text>
                </View>
                {player ? (
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                          {getPositionOverall?.(player.id, 'P') ?? player.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                      <Text style={[styles.statValueText, { color: colors.baseball }]}>
                        {getBaseballStatValue(player, bullpenStatSelection, allPlayers)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Closer */}
          <Text style={[styles.bullpenRoleLabel, { color: colors.textMuted, marginTop: spacing.sm }]}>Closer</Text>
          {(() => {
            const player = bullpen?.closer;
            const isSelected = selectingBullpenRole?.role === 'closer';
            return (
              <TouchableOpacity
                style={[
                  styles.bullpenRow,
                  { borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.baseball + '20' },
                ]}
                onPress={() => handleBullpenSlotPress('closer', undefined, player?.id || null)}
                activeOpacity={0.7}
              >
                <View style={[styles.bullpenBadgeLarge, { backgroundColor: colors.baseball }]}>
                  <Text style={[styles.bullpenBadgeTextLarge, { color: '#fff' }]}>CL</Text>
                </View>
                {player ? (
                  <View style={styles.playerRowContent}>
                    <TouchableOpacity
                      style={styles.playerMainInfo}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayerPress?.(player.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerStats}>
                        <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                          {getPositionOverall?.(player.id, 'P') ?? player.overall} OVR
                        </Text>
                        <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                        <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                          {Math.round(player.matchFitness)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                      <Text style={[styles.statValueText, { color: colors.baseball }]}>
                        {getBaseballStatValue(player, bullpenStatSelection, allPlayers)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptySlotContainer}>
                    <Text style={[styles.emptySlot, { color: colors.textMuted }]}>
                      {isSelected ? 'Select a player below' : 'Tap to select'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })()}
        </View>

        {/* Bench */}
        <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Bench ({bench?.length || 0})
              </Text>
              <TouchableOpacity
                style={[styles.statDropdown, { borderColor: colors.border }]}
                onPress={() => setShowStatPicker('bench')}
              >
                <Text style={[styles.statDropdownText, { color: colors.baseball }]}>
                  {getStatLabel(benchStatSelection)} ▼
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {(selectingPitcher || selectedBattingSlot !== null || selectingBullpenRole !== null) ? (
            <Text style={[styles.sectionSubtitle, { color: colors.baseball }]}>
              Tap a player to assign them
            </Text>
          ) : (
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Tap BN then RSV to swap
            </Text>
          )}
          {!bench || bench.length === 0 ? (
            <Text style={[styles.emptyBench, { color: colors.textMuted }]}>
              All players are in lineup
            </Text>
          ) : (
            bench.map((player) => {
              const best = getBestPosition?.(player.id);
              const displayPosition = best?.position || 'DH';
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && !selectedBenchReserve.isBench;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.baseball + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.baseball + '08' },
                  ]}
                  onPress={() => {
                    if (selectingPitcher || selectedBattingSlot !== null || selectingBullpenRole !== null) {
                      handleBenchPlayerPress(player);
                    } else {
                      handleBenchReserveBadgePress(player.id, true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadgeLarge,
                      { backgroundColor: isSelected ? colors.baseball : colors.baseball + '20' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      // If a selection is active, assign this player
                      if (selectingPitcher || selectedBattingSlot !== null || selectingBullpenRole !== null) {
                        handleBenchPlayerPress(player);
                      } else {
                        handleBenchReserveBadgePress(player.id, true);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeTextLarge,
                      { color: isSelected ? '#000' : colors.baseball }
                    ]}>BN</Text>
                  </TouchableOpacity>
                  <View style={styles.playerColumnContent}>
                    <View style={styles.playerRowContent}>
                      <TouchableOpacity
                        style={styles.playerMainInfo}
                        onPress={(e) => {
                          e.stopPropagation();
                          onPlayerPress?.(player.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                          {player.name}
                        </Text>
                        <View style={styles.playerStats}>
                          <Text style={[styles.statText, { color: colors.textMuted }]}>
                            {displayPosition}
                          </Text>
                          <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                          <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                            {getPositionOverall?.(player.id, displayPosition) ?? player.overall} OVR
                          </Text>
                          <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                          <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                            {Math.round(player.matchFitness)}%
                          </Text>
                          {player.isInjured && (
                            <>
                              <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                              <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                      <View style={[styles.statValueBadge, { backgroundColor: colors.baseball + '20' }]}>
                        <Text style={[styles.statValueText, { color: colors.baseball }]}>
                          {getBaseballStatValue(player, benchStatSelection, allPlayers)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reserves */}
        {reserves && reserves.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Reserves ({reserves.length})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              {(bench?.length || 0) < 9
                ? 'Tap + to add to bench, or RSV then BN to swap'
                : 'Players not on active roster • Tap RSV then BN to swap'}
            </Text>
            {reserves.map((player) => {
              const best = getBestPosition?.(player.id);
              const displayPosition = best?.position || 'DH';
              const displayOverall = best?.overall || player.overall;
              const isSelected = selectedBenchReserve?.id === player.id;
              const isSwapTarget = selectedBenchReserve !== null && selectedBenchReserve.isBench;
              const canAddToBench = (bench?.length || 0) < 9;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.textMuted + '20' },
                    isSwapTarget && !isSelected && { backgroundColor: colors.textMuted + '08' },
                  ]}
                  onPress={() => {
                    // If a selection is active, assign this player directly
                    if (selectingPitcher || selectedBattingSlot !== null || selectingBullpenRole !== null) {
                      handleBenchPlayerPress(player);
                    } else {
                      handleBenchReserveBadgePress(player.id, false);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.positionBadge,
                      { backgroundColor: isSelected ? colors.textMuted : colors.textMuted + '30' },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      // If a selection is active, assign this player directly
                      if (selectingPitcher || selectedBattingSlot !== null || selectingBullpenRole !== null) {
                        handleBenchPlayerPress(player);
                      } else {
                        handleBenchReserveBadgePress(player.id, false);
                      }
                    }}
                  >
                    <Text style={[
                      styles.positionBadgeText,
                      { color: isSelected ? '#fff' : colors.textMuted }
                    ]}>RSV</Text>
                  </TouchableOpacity>
                  <View style={styles.playerColumnContent}>
                    <View style={styles.playerRowContent}>
                      <TouchableOpacity
                        style={styles.playerMainInfo}
                        onPress={(e) => {
                          e.stopPropagation();
                          onPlayerPress?.(player.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.playerName, styles.tappableName, { color: colors.text }]} numberOfLines={1}>
                          {player.name}
                        </Text>
                        <View style={styles.playerStats}>
                          <Text style={[styles.statText, { color: colors.baseball, fontWeight: '600' }]}>
                            {displayOverall} {displayPosition}
                          </Text>
                          <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                          <Text style={[styles.statText, { color: getFitnessColor(player.matchFitness, colors) }]}>
                            {Math.round(player.matchFitness)}%
                          </Text>
                          {player.isInjured && (
                            <>
                              <Text style={[styles.statDivider, { color: colors.border }]}>|</Text>
                              <Text style={[styles.statText, { color: colors.error }]}>INJ</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                      {canAddToBench && (
                        <TouchableOpacity
                          style={[styles.addToBenchButton, { backgroundColor: colors.success + '20' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            addToBench?.(player.id);
                          }}
                        >
                          <Text style={[styles.addToBenchButtonText, { color: colors.success }]}>+</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.buttonRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            { backgroundColor: isValidLineup ? colors.baseball : colors.textMuted },
          ]}
          onPress={onSave}
          disabled={!isValidLineup}
        >
          <Text style={[styles.buttonText, { color: '#000' }]}>
            {isValidLineup ? 'Save Lineup' : `Need ${9 - filledBattingSlots} batters`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Position Picker Modal */}
      <Modal
        visible={positionPickerPlayerId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPositionPickerPlayerId(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPositionPickerPlayerId(null)}
        >
          <View style={[styles.positionPickerModal, { backgroundColor: colors.card }, shadows.lg]}>
            <Text style={[styles.positionPickerTitle, { color: colors.text }]}>
              Select Position for {positionPickerPlayer?.name || 'Player'}
            </Text>
            <View style={styles.positionPickerGrid}>
              {DEFENSIVE_POSITIONS.map((pos) => {
                const isCurrentPosition = positionPickerPlayer?.baseballPosition === pos;
                const rating = positionPickerPlayerId
                  ? getPositionOverall?.(positionPickerPlayerId, pos as BaseballPositionType) || 0
                  : 0;
                return (
                  <TouchableOpacity
                    key={pos}
                    style={[
                      styles.positionPickerButton,
                      { borderColor: colors.border },
                      isCurrentPosition && { backgroundColor: colors.baseball + '20', borderColor: colors.baseball },
                    ]}
                    onPress={() => {
                      if (positionPickerPlayerId) {
                        setPosition?.(positionPickerPlayerId, pos);
                      }
                      setPositionPickerPlayerId(null);
                    }}
                  >
                    <Text style={[styles.positionPickerButtonText, { color: isCurrentPosition ? colors.baseball : colors.text }]}>
                      {pos}
                    </Text>
                    <Text style={[styles.positionPickerButtonRating, { color: colors.textMuted }]}>
                      {rating}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.positionPickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setPositionPickerPlayerId(null)}
            >
              <Text style={[styles.positionPickerCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Stat Picker Modal */}
      <Modal
        visible={showStatPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatPicker(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStatPicker(null)}
        >
          <View style={[styles.positionPickerModal, { backgroundColor: colors.card }, shadows.lg]}>
            <Text style={[styles.positionPickerTitle, { color: colors.text }]}>
              Select Stat to Display
            </Text>
            <View style={styles.positionPickerGrid}>
              {(showStatPicker === 'pitcher' || showStatPicker === 'bullpen'
                ? PITCHING_STAT_OPTIONS
                : showStatPicker === 'bench'
                  ? BENCH_STAT_OPTIONS
                  : BATTING_STAT_OPTIONS
              ).map((option) => {
                const currentSelection = showStatPicker === 'batting' ? battingStatSelection
                  : showStatPicker === 'pitcher' ? pitcherStatSelection
                  : showStatPicker === 'bullpen' ? bullpenStatSelection
                  : benchStatSelection;
                const isSelected = currentSelection === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.positionPickerButton,
                      { borderColor: colors.border, minWidth: 80 },
                      isSelected && { backgroundColor: colors.baseball + '20', borderColor: colors.baseball },
                    ]}
                    onPress={() => {
                      if (showStatPicker === 'batting') setBattingStatSelection(option.value);
                      else if (showStatPicker === 'pitcher') setPitcherStatSelection(option.value);
                      else if (showStatPicker === 'bullpen') setBullpenStatSelection(option.value);
                      else if (showStatPicker === 'bench') setBenchStatSelection(option.value);
                      setShowStatPicker(null);
                    }}
                  >
                    <Text style={[styles.positionPickerButtonText, { color: isSelected ? colors.baseball : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.positionPickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowStatPicker(null)}
            >
              <Text style={[styles.positionPickerCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  minutesSummary: {
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  stickyMinutesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  minutesSummaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  minutesSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  stickyMinutesValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  minutesWarning: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    borderRadius: 12,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  formationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  averageOverallBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  averageOverallText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formationPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  formationButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 60,
  },
  formationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formationRating: {
    fontSize: 11,
    marginTop: 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  playerRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerColumnContent: {
    flex: 1,
    flexDirection: 'column',
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: '700',
    width: 32,
  },
  soccerPositionLabel: {
    width: 40,
  },
  playerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  playerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  tappableName: {
    textDecorationLine: 'underline' as const,
  },
  benchPosition: {
    fontSize: 12,
  },
  playerOverall: {
    fontSize: 12,
  },
  injuryBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  injuryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  minutesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minutesButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minutesButtonSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  minutesButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  minutesValue: {
    fontSize: 14,
    fontWeight: '600',
    width: 36,
    textAlign: 'center',
  },
  minutesValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    width: 32,
    textAlign: 'center',
  },
  emptySlot: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  benchPlayerRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  benchPlayerInfo: {
    gap: spacing.xs,
  },
  benchMinutesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  benchPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sliderRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  benchSliderRow: {
    marginTop: spacing.xs,
  },
  positionScroll: {
    flexShrink: 1,
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  positionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  positionButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyBench: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  addToBenchButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  addToBenchButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.md,
    borderRadius: 12,
    padding: spacing.xl,
  },
  placeholderText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Soccer-specific styles
  instructionBar: {
    padding: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  validationHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  optimalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  optimalButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 48,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playerMainInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 11,
  },
  statDivider: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  emptySlotContainer: {
    flex: 1,
  },
  naturalPosBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.xs,
  },
  naturalPosText: {
    fontSize: 10,
    fontWeight: '600',
  },
  assignHint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignHintText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Baseball-specific styles
  pitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderRadius: 10,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  battingOrderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  battingOrderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  positionDropdown: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  positionDropdownText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionPickerModal: {
    borderRadius: 12,
    padding: spacing.md,
    width: '80%',
    maxWidth: 320,
  },
  positionPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  positionPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  positionPickerButton: {
    width: 70,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  positionPickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  positionPickerButtonRating: {
    fontSize: 11,
    marginTop: 2,
  },
  positionPickerOccupied: {
    fontSize: 9,
    marginTop: 2,
  },
  positionPickerCancel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  positionPickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Bullpen-specific styles
  bullpenRoleLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  bullpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  bullpenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  bullpenBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Large badge variants for better touch targets
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  statDropdown: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 80,
  },
  statDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  positionBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 52,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  positionBadgeTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  positionDropdownLarge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  positionDropdownTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  battingOrderBadgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  battingOrderTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  bullpenBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  bullpenBadgeTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  statValueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  statValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Basketball-specific styles
  basketballActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  swapHintText: {
    fontSize: 13,
    fontWeight: '500',
  },
  basketballMinutesButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  basketballMinutesText: {
    fontSize: 13,
    fontWeight: '600',
  },
  basketballPlayerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  basketballStatColumn: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  basketballStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  minutesModal: {
    borderRadius: 12,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
  },
  minutesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  minutesModalSubtitle: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  minutesPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  minutesPresetButton: {
    width: 56,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  minutesPresetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  minutesCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  minutesStepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minutesStepButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  minutesCurrentValue: {
    fontSize: 28,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'center',
  },
  minutesModalDone: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  minutesModalDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});

export default ConnectedLineupEditorScreen;
