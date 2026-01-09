/**
 * AI Tactical Decision System
 *
 * Handles AI decisions for game tactics:
 * - Starting lineup selection
 * - Pace strategy (fast/normal/slow)
 * - Defense strategy (man/zone/press)
 * - Minutes allocation
 *
 * Week 1: Simple rating-based decisions with personality modifiers
 * Week 6: Add opponent analysis, matchup optimization, fatigue management
 */

import type { Player } from '../data/types';
import type {
  DecisionContext,
  AIConfig,
  Position,
  LineupSelection,
  PaceDecision,
  PaceStrategy,
  DefenseDecision,
  DefenseStrategy,
  MinutesAllocation,
} from './types';
import { calculateOverallRating } from './evaluation';
import { getMinutesDistribution } from './personality';

// =============================================================================
// STARTING LINEUP SELECTION
// =============================================================================

/**
 * Select starting lineup based on player ratings
 *
 * Chooses the highest-rated player at each position.
 * Remaining players go to bench, sorted by rating.
 *
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns LineupSelection with starters and bench
 */
export function selectStartingLineup(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): LineupSelection {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const starters: Player[] = [];
  const missingPositions: Position[] = [];
  const usedPlayerIds = new Set<string>();

  // Select best player at each position
  for (const pos of positions) {
    const positionPlayers = roster.filter(
      (p) => p.position === pos && !usedPlayerIds.has(p.id)
    );

    if (positionPlayers.length === 0) {
      missingPositions.push(pos);
      continue;
    }

    // Sort by overall rating (highest first)
    const sorted = positionPlayers
      .map((p) => ({ player: p, rating: calculateOverallRating(p) }))
      .sort((a, b) => b.rating - a.rating);

    const bestPlayer = sorted[0].player;
    starters.push(bestPlayer);
    usedPlayerIds.add(bestPlayer.id);
  }

  // Remaining players go to bench, sorted by rating
  const benchPlayers = roster
    .filter((p) => !usedPlayerIds.has(p.id))
    .map((p) => ({ player: p, rating: calculateOverallRating(p) }))
    .sort((a, b) => b.rating - a.rating)
    .map((item) => item.player);

  // Build reason string
  let reason = `Selected ${starters.length} starters by position rating`;
  if (missingPositions.length > 0) {
    reason += `. Missing players at: ${missingPositions.join(', ')}`;
  }

  return {
    starters,
    bench: benchPlayers,
    reason,
  };
}

// =============================================================================
// PACE STRATEGY
// =============================================================================

/**
 * Calculate average athleticism for pace decisions
 *
 * Athleticism = average of agility, acceleration, top_speed, stamina
 */
function calculateAverageAthleticism(roster: Player[]): number {
  if (roster.length === 0) return 50;

  const totalAthleticism = roster.reduce((sum, player) => {
    const attrs = player.attributes;
    const athleticism =
      (attrs.agility + attrs.acceleration + attrs.top_speed + attrs.stamina) / 4;
    return sum + athleticism;
  }, 0);

  return totalAthleticism / roster.length;
}

/**
 * Choose pace strategy based on roster athleticism and AI personality
 *
 * Athletic teams play faster, less athletic teams play slower.
 * Personality provides bias:
 * - Aggressive: +5 athleticism for pace calculation
 * - Conservative: -5 athleticism for pace calculation
 *
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns PaceDecision with pace and reasoning
 */
export function choosePaceStrategy(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): PaceDecision {
  const avgAthleticism = calculateAverageAthleticism(roster);

  // Apply personality modifier
  let adjustedAthleticism = avgAthleticism;
  if (config.personality === 'aggressive') {
    adjustedAthleticism += 5; // Bias toward fast
  } else if (config.personality === 'conservative') {
    adjustedAthleticism -= 5; // Bias toward slow
  }

  // Determine pace based on adjusted athleticism
  let pace: PaceStrategy;
  let reason: string;

  if (adjustedAthleticism >= 75) {
    pace = 'fast';
    reason = `High athleticism (${avgAthleticism.toFixed(1)}) supports fast pace`;
  } else if (adjustedAthleticism < 65) {
    pace = 'slow';
    reason = `Lower athleticism (${avgAthleticism.toFixed(1)}) favors slower pace`;
  } else {
    pace = 'normal';
    reason = `Moderate athleticism (${avgAthleticism.toFixed(1)}) suits normal pace`;
  }

  // Add personality context to reason
  if (config.personality !== 'balanced') {
    reason += ` (${config.personality} bias applied)`;
  }

  return {
    pace,
    reason,
    avgAthleticism: Math.round(avgAthleticism * 10) / 10,
  };
}

// =============================================================================
// DEFENSE STRATEGY
// =============================================================================

/**
 * Set defense strategy based on AI personality
 *
 * - Aggressive: Press defense (high risk/reward)
 * - Conservative: Zone defense (protect the paint)
 * - Balanced: Man-to-man defense (standard)
 *
 * Week 1: Simple personality mapping
 * Week 6: Add opponent analysis, roster defensive capabilities
 *
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns DefenseDecision with defense and reasoning
 */
export function setDefenseStrategy(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): DefenseDecision {
  let defense: DefenseStrategy;
  let reason: string;

  switch (config.personality) {
    case 'aggressive':
      defense = 'press';
      reason = 'Aggressive personality favors press defense for turnovers';
      break;

    case 'conservative':
      defense = 'zone';
      reason = 'Conservative personality prefers zone to protect the paint';
      break;

    case 'balanced':
    default:
      defense = 'man';
      reason = 'Balanced personality uses standard man-to-man defense';
      break;
  }

  // Note match importance for future expansion
  if (context.matchImportance === 'high') {
    reason += ' (high importance match)';
  }

  return {
    defense,
    reason,
  };
}

// =============================================================================
// MINUTES ALLOCATION
// =============================================================================

/**
 * Allocate minutes across the roster
 *
 * Total minutes per game = 240 (48 minutes * 5 players on court)
 *
 * Distribution based on personality:
 * - Conservative: Heavy starter minutes
 * - Balanced: Standard rotation
 * - Aggressive: Even distribution (develop depth)
 *
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns MinutesAllocation with player minutes mapping
 */
export function allocateMinutes(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): MinutesAllocation {
  const TOTAL_MINUTES = 240;

  // Get lineup selection to determine starters
  const lineup = selectStartingLineup(roster, context, config);

  // Edge case: exactly 5 players, everyone plays 48 minutes
  if (roster.length <= 5) {
    const allocation: Record<string, number> = {};
    const minutesEach = TOTAL_MINUTES / roster.length;

    roster.forEach((player) => {
      allocation[player.id] = minutesEach;
    });

    return {
      allocation,
      totalMinutes: TOTAL_MINUTES,
      starters: roster.map((p) => p.id),
      rotation: [],
      deepBench: [],
    };
  }

  // Get personality-based distribution
  const distribution = getMinutesDistribution(config);

  // Calculate minutes allocation
  const allocation: Record<string, number> = {};
  const starterIds: string[] = [];
  const rotationIds: string[] = [];
  const deepBenchIds: string[] = [];

  // Starters get starter minutes
  lineup.starters.forEach((player) => {
    allocation[player.id] = distribution.starterMinutes;
    starterIds.push(player.id);
  });

  // Bench players: split between rotation and deep bench
  // First 3 bench = rotation, rest = deep bench
  const benchWithRatings = lineup.bench.map((p) => ({
    player: p,
    rating: calculateOverallRating(p),
  }));

  benchWithRatings.forEach((item, index) => {
    if (index < 3) {
      // Rotation players
      allocation[item.player.id] = distribution.rotationMinutes;
      rotationIds.push(item.player.id);
    } else {
      // Deep bench
      allocation[item.player.id] = distribution.benchMinutes;
      deepBenchIds.push(item.player.id);
    }
  });

  // Verify total and adjust if needed
  let currentTotal = Object.values(allocation).reduce((a, b) => a + b, 0);

  // Adjust to hit exactly 240 minutes
  if (currentTotal !== TOTAL_MINUTES) {
    const diff = TOTAL_MINUTES - currentTotal;
    // Distribute difference evenly among starters
    const adjustment = diff / starterIds.length;
    starterIds.forEach((id) => {
      allocation[id] = Math.round((allocation[id] + adjustment) * 10) / 10;
    });

    // Final validation - round to whole numbers
    let finalTotal = 0;
    Object.keys(allocation).forEach((id) => {
      allocation[id] = Math.round(allocation[id]);
      finalTotal += allocation[id];
    });

    // If still off, adjust first starter
    if (finalTotal !== TOTAL_MINUTES) {
      allocation[starterIds[0]] += TOTAL_MINUTES - finalTotal;
    }
  }

  return {
    allocation,
    totalMinutes: TOTAL_MINUTES,
    starters: starterIds,
    rotation: rotationIds,
    deepBench: deepBenchIds,
  };
}
