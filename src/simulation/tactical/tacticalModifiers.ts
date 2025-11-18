/**
 * Basketball Simulator - Tactical Modifiers Integration Layer
 *
 * Integrates all 5 tactical settings with game mechanics:
 * 1. Pace (possessions, stamina, shot distribution)
 * 2. Man vs Zone Defense (turnovers, contests, shot selection)
 * 3. Scoring Options (usage distribution)
 * 4. Minutes Allocation (player availability weights)
 * 5. Rebounding Strategy (number of rebounders, OREB modifier)
 *
 * This module ensures ALL tactical settings have observable, mechanical impact.
 * NO FAKE SLIDERS - every setting affects gameplay through specific formulas.
 *
 * @module simulation/tactical/tacticalModifiers
 */

import type { Player, TacticalSettings } from '../../data/types';
import { calculateComposite, weightedRandomChoice } from '../core/probability';
import {
  // Pace modifiers
  PACE_FAST_POSSESSION_MOD,
  PACE_FAST_STAMINA_DRAIN,
  PACE_SLOW_POSSESSION_MOD,
  PACE_SLOW_STAMINA_DRAIN,
  PACE_STANDARD_POSSESSION_MOD,
  PACE_STANDARD_STAMINA_DRAIN,

  // Zone defense effects (Note: TURNOVER_BONUS removed in M4.6)
  ZONE_DEFENSE_CONTEST_PENALTY,
  ZONE_DEFENSE_DRIVE_PENALTY,
  ZONE_DEFENSE_3PT_ATTEMPT_BONUS,

  // Usage distribution
  USAGE_SCORING_OPTION_1,
  USAGE_SCORING_OPTION_2,
  USAGE_SCORING_OPTION_3,
  USAGE_OTHERS,

  // Rebounding strategy
  REBOUND_STRATEGY_CRASH_GLASS_COUNT,
  REBOUND_STRATEGY_STANDARD_COUNT,
  REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,

  // Stamina costs
  STAMINA_COST_PER_POSSESSION_FAST,
  STAMINA_COST_PER_POSSESSION_STANDARD,
  STAMINA_COST_PER_POSSESSION_SLOW,

  // Pace turnover adjustments
  TURNOVER_PACE_FAST_BONUS,
  TURNOVER_PACE_SLOW_PENALTY,

  // Weight tables
  WEIGHTS_REBOUND,
} from '../constants';

// Zone defense turnover bonus removed in M4.6, define locally for backward compat
const ZONE_DEFENSE_TURNOVER_BONUS = 0.03;

// =============================================================================
// PACE SYSTEM
// =============================================================================

/**
 * Apply pace-based modifiers to possessions, stamina, or shot distribution.
 *
 * Pace Effects:
 * - Fast: +10% possessions, +15% stamina drain, +5% rim shots
 * - Standard: No modifiers (1.0x multipliers)
 * - Slow: -10% possessions, -15% stamina drain, +5% midrange shots
 */
export function applyPaceModifiers(
  baseValue: number,
  pace: 'fast' | 'standard' | 'slow',
  modifierType: 'possessions' | 'stamina' | 'shot_distribution'
): number {
  if (modifierType === 'possessions') {
    if (pace === 'fast') {
      return baseValue * PACE_FAST_POSSESSION_MOD;
    } else if (pace === 'slow') {
      return baseValue * PACE_SLOW_POSSESSION_MOD;
    } else {
      return baseValue * PACE_STANDARD_POSSESSION_MOD;
    }
  } else if (modifierType === 'stamina') {
    if (pace === 'fast') {
      return baseValue * PACE_FAST_STAMINA_DRAIN;
    } else if (pace === 'slow') {
      return baseValue * PACE_SLOW_STAMINA_DRAIN;
    } else {
      return baseValue * PACE_STANDARD_STAMINA_DRAIN;
    }
  } else if (modifierType === 'shot_distribution') {
    // Returns the adjustment value, not modified baseValue
    // Applied to specific shot types in select_shot_type
    if (pace === 'fast') {
      return 0.05; // +5% to rim attempts
    } else if (pace === 'slow') {
      return 0.05; // +5% to midrange attempts
    } else {
      return 0.0; // No adjustment
    }
  } else {
    throw new Error(`Unknown modifier_type: ${modifierType}`);
  }
}

/**
 * Return all pace-based modifiers as a dictionary.
 * Convenience function for getting all pace effects at once.
 */
export interface PaceModifiers {
  possessionMultiplier: number;
  staminaDrainMultiplier: number;
  turnoverAdjustment: number;
  rimShotAdjustment: number;
  midrangeShotAdjustment: number;
}

export function getPaceModifiers(pace: 'fast' | 'standard' | 'slow'): PaceModifiers {
  if (pace === 'fast') {
    return {
      possessionMultiplier: PACE_FAST_POSSESSION_MOD,
      staminaDrainMultiplier: PACE_FAST_STAMINA_DRAIN,
      turnoverAdjustment: TURNOVER_PACE_FAST_BONUS,
      rimShotAdjustment: 0.05,
      midrangeShotAdjustment: 0.0,
    };
  } else if (pace === 'slow') {
    return {
      possessionMultiplier: PACE_SLOW_POSSESSION_MOD,
      staminaDrainMultiplier: PACE_SLOW_STAMINA_DRAIN,
      turnoverAdjustment: TURNOVER_PACE_SLOW_PENALTY,
      rimShotAdjustment: 0.0,
      midrangeShotAdjustment: 0.05,
    };
  } else {
    return {
      possessionMultiplier: PACE_STANDARD_POSSESSION_MOD,
      staminaDrainMultiplier: PACE_STANDARD_STAMINA_DRAIN,
      turnoverAdjustment: 0.0,
      rimShotAdjustment: 0.0,
      midrangeShotAdjustment: 0.0,
    };
  }
}

/**
 * Get base stamina cost per possession based on pace.
 */
export function getStaminaCostPerPossession(pace: 'fast' | 'standard' | 'slow'): number {
  if (pace === 'fast') {
    return STAMINA_COST_PER_POSSESSION_FAST;
  } else if (pace === 'slow') {
    return STAMINA_COST_PER_POSSESSION_SLOW;
  } else {
    return STAMINA_COST_PER_POSSESSION_STANDARD;
  }
}

// =============================================================================
// ZONE DEFENSE SYSTEM
// =============================================================================

/**
 * Calculate zone defense modifiers based on man defense percentage.
 *
 * Zone percentage = 100 - man_defense_pct
 *
 * Zone Defense Effects:
 * - +3% to force turnovers (more passing required)
 * - -15% perimeter contest effectiveness (weaker closeouts on 3PT)
 * - -10% drive defense effectiveness (gaps in coverage)
 * - +5% to opponent 3PT shot attempts (open perimeter)
 *
 * All effects are proportional to zone percentage.
 */
export interface ZoneDefenseModifiers {
  turnoverBonus: number;
  contestPenalty: number;
  drivePenalty: number;
  shotAttemptBonus: number;
  zonePct: number;
}

export function getZoneDefenseModifiers(manDefensePct: number): ZoneDefenseModifiers {
  const zonePct = (100 - manDefensePct) / 100.0;

  return {
    turnoverBonus: ZONE_DEFENSE_TURNOVER_BONUS * zonePct,
    contestPenalty: ZONE_DEFENSE_CONTEST_PENALTY * zonePct,
    drivePenalty: ZONE_DEFENSE_DRIVE_PENALTY * zonePct,
    shotAttemptBonus: ZONE_DEFENSE_3PT_ATTEMPT_BONUS * zonePct,
    zonePct,
  };
}

/**
 * Per-possession random roll to determine defense type.
 *
 * Uses man_defense_pct to determine probability of man defense.
 * This function should be called ONCE per possession.
 */
export function determineDefenseType(manDefensePct: number): 'man' | 'zone' {
  const roll = Math.random();
  return roll < manDefensePct / 100.0 ? 'man' : 'zone';
}

// =============================================================================
// SCORING OPTIONS (USAGE DISTRIBUTION)
// =============================================================================

/**
 * Calculate usage distribution based on scoring options.
 *
 * Priority Usage:
 * - Scoring Option #1: 30%
 * - Scoring Option #2: 20%
 * - Scoring Option #3: 15%
 * - Others: 35% (split equally among remaining players)
 *
 * Fallback Logic:
 * If a scoring option is unavailable (stamina < min_stamina, not on team),
 * their usage is redistributed to the next option or others pool.
 */
export function calculateUsageDistribution(
  team: Player[],
  scoringOptions: [string?, string?, string?],
  minStamina: number = 20.0
): Record<string, number> {
  // Initialize usage dict
  const usage: Record<string, number> = {};
  for (const player of team) {
    usage[player.name] = 0.0;
  }

  // Track which players are available
  const availablePlayers: Record<string, boolean> = {};
  for (const player of team) {
    const currentStamina = player.attributes.stamina;
    if (currentStamina === undefined) {
      availablePlayers[player.name] = true; // No stamina defined, assume available
    } else {
      availablePlayers[player.name] = currentStamina >= minStamina;
    }
  }

  // Track remaining usage to distribute
  let remainingUsage = 1.0;

  // Assign scoring options in priority order
  const optionUsages = [USAGE_SCORING_OPTION_1, USAGE_SCORING_OPTION_2, USAGE_SCORING_OPTION_3];
  let carriedOverUsage = 0.0; // Track usage from unavailable options

  for (let i = 0; i < scoringOptions.length; i++) {
    const optionName = scoringOptions[i];
    const currentOptionUsage = optionUsages[i];
    if (currentOptionUsage === undefined) continue; // Should not happen but TypeScript safety

    const targetUsage = currentOptionUsage + carriedOverUsage;
    carriedOverUsage = 0.0; // Reset

    if (optionName && optionName in availablePlayers) {
      const isAvailable = availablePlayers[optionName];
      if (isAvailable !== undefined && isAvailable) {
        // Option is available - assign usage
        usage[optionName] = targetUsage;
        remainingUsage -= targetUsage;
      } else {
        // Option unavailable - carry over to next option
        carriedOverUsage = targetUsage;
      }
    } else {
      // Option not specified or not on team - carry over
      carriedOverUsage = targetUsage;
    }
  }

  // Add any carried-over usage to "others" pool
  const othersPoolUsage = USAGE_OTHERS + carriedOverUsage;

  // Identify "others" pool (players not in scoring options)
  const scoringOptionNames = scoringOptions.filter((opt): opt is string => opt !== undefined && opt !== null);
  const others: string[] = [];
  for (const player of team) {
    if (!scoringOptionNames.includes(player.name)) {
      others.push(player.name);
    }
  }

  // Also add unavailable scoring options to others pool
  for (const optionName of scoringOptionNames) {
    const isAvailable = availablePlayers[optionName];
    if (isAvailable !== undefined && !isAvailable) {
      others.push(optionName);
    }
  }

  // Distribute others pool equally
  if (others.length > 0) {
    const perOther = othersPoolUsage / others.length;
    for (const playerName of others) {
      usage[playerName] = perOther;
    }
  }

  // Sanity check: normalize to ensure sum = 1.0
  const totalUsage = Object.values(usage).reduce((sum, val) => sum + val, 0);
  if (totalUsage > 0) {
    for (const playerName in usage) {
      const currentUsage = usage[playerName];
      if (currentUsage !== undefined) {
        usage[playerName] = currentUsage / totalUsage;
      }
    }
  }

  return usage;
}

/**
 * Select shooter using usage distribution from tactical settings.
 *
 * Uses weighted random selection based on calculated usage percentages.
 */
export function selectShooter(
  offensiveTeam: Player[],
  tacticalSettings: TacticalSettings,
  minStamina: number = 20.0
): Player {
  const scoringOptions: [string?, string?, string?] = [
    tacticalSettings.scoringOptions[0],
    tacticalSettings.scoringOptions[1],
    tacticalSettings.scoringOptions[2],
  ];

  const usageDistribution = calculateUsageDistribution(offensiveTeam, scoringOptions, minStamina);

  // Filter to only available players
  const availableChoices: Player[] = [];
  const availableWeights: number[] = [];

  for (const player of offensiveTeam) {
    const playerStamina = player.attributes.stamina;
    const effectiveStamina = playerStamina !== undefined ? playerStamina : 100;
    const playerUsage = usageDistribution[player.name];
    if (playerUsage !== undefined && effectiveStamina >= minStamina && playerUsage > 0) {
      availableChoices.push(player);
      availableWeights.push(playerUsage);
    }
  }

  if (availableChoices.length === 0) {
    // Edge case: All players exhausted
    // Fall back to selecting from all players regardless of stamina
    const equalWeight = 1.0 / offensiveTeam.length;
    return weightedRandomChoice(offensiveTeam, offensiveTeam.map(() => equalWeight));
  }

  return weightedRandomChoice(availableChoices, availableWeights);
}

// =============================================================================
// MINUTES ALLOCATION
// =============================================================================

/**
 * Validate that minutes allocation sums to 240 (48 min × 5 positions).
 */
export function validateMinutesAllocation(minutesDict: Record<string, number>): [boolean, string] {
  if (!minutesDict || Object.keys(minutesDict).length === 0) {
    return [false, 'Minutes allotment is empty'];
  }

  // Check for negative minutes and exceeding 48 FIRST
  for (const [playerName, minutes] of Object.entries(minutesDict)) {
    if (minutes < 0) {
      return [false, `Player ${playerName} has negative minutes: ${minutes}`];
    }
    if (minutes > 48) {
      return [false, `Player ${playerName} exceeds 48 minutes: ${minutes}`];
    }
  }

  // Then check total
  const totalMinutes = Object.values(minutesDict).reduce((sum, val) => sum + val, 0);
  if (totalMinutes !== 240) {
    return [false, `Minutes allotment must sum to 240, got ${totalMinutes}`];
  }

  return [true, ''];
}

/**
 * Convert minutes allocation to availability weights.
 *
 * For Milestone 1 (single possession), minutes determine probability
 * of player being on court. In future milestones, this will drive
 * substitution patterns.
 */
export function getPlayerAvailabilityWeights(
  team: Player[],
  minutesAllotment: Record<string, number> | undefined
): Record<string, number> {
  if (!minutesAllotment || Object.keys(minutesAllotment).length === 0) {
    // No allocation specified - assume equal distribution
    const equalWeight = 1.0 / team.length;
    const weights: Record<string, number> = {};
    for (const player of team) {
      weights[player.name] = equalWeight;
    }
    return weights;
  }

  const weights: Record<string, number> = {};
  for (const player of team) {
    const playerName = player.name;
    const minutesForPlayer = minutesAllotment[playerName];
    if (minutesForPlayer !== undefined) {
      // Weight = minutes / 48 (max minutes per game)
      weights[playerName] = minutesForPlayer / 48.0;
    } else {
      // Player not in allocation - assume no minutes
      weights[playerName] = 0.0;
    }
  }

  return weights;
}

// =============================================================================
// REBOUNDING STRATEGY
// =============================================================================

/**
 * Get rebounding strategy parameters.
 *
 * Strategies:
 * - crash_glass: 5 offensive rebounders, +8% OREB chance
 * - standard: 4 offensive rebounders, baseline OREB chance
 * - prevent_transition: 3 offensive rebounders, -5% OREB chance
 */
export interface ReboundingStrategyParams {
  offensiveRebounders: number;
  defensiveRebounders: number;
  orebModifier: number;
}

export function getReboundingStrategyParams(
  strategy: 'crash_glass' | 'standard' | 'prevent_transition'
): ReboundingStrategyParams {
  if (strategy === 'crash_glass') {
    return {
      offensiveRebounders: REBOUND_STRATEGY_CRASH_GLASS_COUNT,
      defensiveRebounders: 5 - REBOUND_STRATEGY_CRASH_GLASS_COUNT,
      orebModifier: 0.08, // +8% OREB chance
    };
  } else if (strategy === 'prevent_transition') {
    return {
      offensiveRebounders: REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
      defensiveRebounders: 5 - REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
      orebModifier: -0.05, // -5% OREB chance
    };
  } else {
    return {
      offensiveRebounders: REBOUND_STRATEGY_STANDARD_COUNT,
      defensiveRebounders: 5 - REBOUND_STRATEGY_STANDARD_COUNT,
      orebModifier: 0.0, // No modifier
    };
  }
}

/**
 * Select which players box out for rebounds based on strategy.
 *
 * Selection Algorithm:
 * 1. Calculate rebounding composite for each player
 * 2. Sort by composite (best rebounders first)
 * 3. Take top N players based on strategy
 */
export function getRebounders(
  team: Player[],
  reboundingStrategy: 'crash_glass' | 'standard' | 'prevent_transition',
  isOffensiveTeam: boolean
): Player[] {
  const params = getReboundingStrategyParams(reboundingStrategy);

  const numRebounders = isOffensiveTeam ? params.offensiveRebounders : params.defensiveRebounders;

  // Calculate rebounding composite for each player
  const playerComposites: Array<[Player, number]> = [];
  for (const player of team) {
    // Convert Player to attribute dict for calculateComposite
    const attributeDict: Record<string, number> = { ...player.attributes };
    const composite = calculateComposite(attributeDict, WEIGHTS_REBOUND);
    playerComposites.push([player, composite]);
  }

  // Sort by composite (descending)
  playerComposites.sort((a, b) => b[1] - a[1]);

  // Take top N
  const rebounders = playerComposites.slice(0, numRebounders).map(([player]) => player);

  return rebounders;
}

// =============================================================================
// INTEGRATED TACTICAL APPLICATION
// =============================================================================

/**
 * Central function to apply ALL tactical modifiers to base probabilities.
 *
 * This ensures no tactical setting is ignored. Every setting has mechanical impact.
 */
export interface TacticalModifierResult {
  modifiedProbabilities: Record<string, number>;
  debug: {
    original: Record<string, number>;
    modifiersApplied: Record<string, number>;
    tacticalSettings: {
      pace: string;
      manDefensePct: number;
      reboundingStrategy: string;
    };
    final: Record<string, number>;
  };
}

export function applyAllTacticalModifiers(
  baseProbabilities: Record<string, number>,
  tacticalSettings: TacticalSettings,
  actionType: 'shot_selection' | 'turnover' | 'contest' | 'drive',
  defenseType: 'man' | 'zone' = 'man'
): TacticalModifierResult {
  const modified = { ...baseProbabilities };
  const debug = {
    original: { ...baseProbabilities },
    modifiersApplied: {} as Record<string, number>,
    tacticalSettings: {
      pace: tacticalSettings.pace,
      manDefensePct: tacticalSettings.manDefensePct,
      reboundingStrategy: tacticalSettings.reboundingStrategy,
    },
    final: {} as Record<string, number>,
  };

  // Apply pace modifiers
  const paceMods = getPaceModifiers(tacticalSettings.pace);

  if (actionType === 'shot_selection') {
    // Apply pace-based shot distribution adjustments
    if (paceMods.rimShotAdjustment > 0 && 'rim' in modified) {
      modified.rim += paceMods.rimShotAdjustment;
      debug.modifiersApplied.pace_rim_bonus = paceMods.rimShotAdjustment;
    }

    if (paceMods.midrangeShotAdjustment > 0 && 'midrange' in modified) {
      modified.midrange += paceMods.midrangeShotAdjustment;
      debug.modifiersApplied.pace_midrange_bonus = paceMods.midrangeShotAdjustment;
    }
  } else if (actionType === 'turnover') {
    // Apply pace adjustment to turnover rate
    if ('turnover_rate' in modified) {
      modified.turnover_rate += paceMods.turnoverAdjustment;
      debug.modifiersApplied.pace_turnover_adjustment = paceMods.turnoverAdjustment;
    }
  }

  // Apply zone defense modifiers
  const zoneMods = getZoneDefenseModifiers(tacticalSettings.manDefensePct);

  if (actionType === 'turnover' && 'turnover_rate' in modified) {
    modified.turnover_rate += zoneMods.turnoverBonus;
    debug.modifiersApplied.zone_turnover_bonus = zoneMods.turnoverBonus;
  } else if (actionType === 'contest' && defenseType === 'zone') {
    // Zone reduces 3PT contest effectiveness
    if ('defender_composite' in modified) {
      modified.defender_composite *= 1 + zoneMods.contestPenalty;
      debug.modifiersApplied.zone_contest_penalty = zoneMods.contestPenalty;
    }
  } else if (actionType === 'drive' && defenseType === 'zone') {
    // Zone reduces drive success
    if ('drive_success_rate' in modified) {
      modified.drive_success_rate *= 1 + zoneMods.drivePenalty;
      debug.modifiersApplied.zone_drive_penalty = zoneMods.drivePenalty;
    }
  } else if (actionType === 'shot_selection' && defenseType === 'zone' && '3pt' in modified) {
    // Zone increases 3PT attempt rate
    modified['3pt'] += zoneMods.shotAttemptBonus;
    debug.modifiersApplied.zone_3pt_attempt_bonus = zoneMods.shotAttemptBonus;
  }

  // Normalize probabilities if needed (for distributions)
  if (actionType === 'shot_selection') {
    // Ensure shot distribution sums to 1.0
    const total = Object.values(modified).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      for (const key in modified) {
        const currentValue = modified[key];
        if (currentValue !== undefined) {
          modified[key] = currentValue / total;
        }
      }
    }
  }

  debug.final = { ...modified };

  return { modifiedProbabilities: modified, debug };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Comprehensive validation of all tactical settings.
 */
export function validateTacticalSettings(tacticalSettings: TacticalSettings): [boolean, string[]] {
  const errors: string[] = [];

  // Validate pace
  if (!['fast', 'standard', 'slow'].includes(tacticalSettings.pace)) {
    errors.push(`Invalid pace: ${tacticalSettings.pace}`);
  }

  // Validate man_defense_pct
  if (tacticalSettings.manDefensePct < 0 || tacticalSettings.manDefensePct > 100) {
    errors.push(`Invalid man_defense_pct: ${tacticalSettings.manDefensePct}`);
  }

  // Validate rebounding strategy
  if (!['crash_glass', 'standard', 'prevent_transition'].includes(tacticalSettings.reboundingStrategy)) {
    errors.push(`Invalid rebounding_strategy: ${tacticalSettings.reboundingStrategy}`);
  }

  // Validate minutes allocation if provided
  const minutesAllotment = tacticalSettings.minutesAllotment;
  if (minutesAllotment !== undefined) {
    const [isValid, error] = validateMinutesAllocation(minutesAllotment);
    if (!isValid) {
      errors.push(error);
    }
  }

  return [errors.length === 0, errors];
}
