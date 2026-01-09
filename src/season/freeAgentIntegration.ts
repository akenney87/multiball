/**
 * Free Agent Integration
 *
 * Connects the Free Agent System with the Season/Event infrastructure:
 * - Free agent pool management
 * - Signing workflow with events
 * - AI free agent decisions
 * - Pool refresh integration
 *
 * Week 5: Free Agent Market Integration
 */

import type { Player } from '../data/types';
import type { AIConfig } from '../ai/types';
import {
  FreeAgent,
  refreshFreeAgentPool,
  filterFreeAgents,
  getTopFreeAgents,
  generateFreeAgent,
  DEFAULT_POOL_CONFIG,
  type FreeAgentFilter,
  type PoolConfig,
} from '../systems/freeAgentSystem';
import { calculateOverallRating } from '../ai/evaluation';
import { GameEventEmitter, gameEvents, type GameEvent } from './events';

// =============================================================================
// FREE AGENT EVENT TYPES
// =============================================================================

/**
 * Free agent signed event
 */
export interface FreeAgentSignedEvent {
  type: 'freeAgent:signed';
  timestamp: Date;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  salary: number;
}

/**
 * Free agent released event
 */
export interface FreeAgentReleasedEvent {
  type: 'freeAgent:released';
  timestamp: Date;
  playerId: string;
  playerName: string;
  previousTeamId: string;
}

/**
 * Free agent pool refreshed event
 */
export interface FreeAgentPoolRefreshedEvent {
  type: 'freeAgent:poolRefreshed';
  timestamp: Date;
  newPlayersAdded: number;
  totalPoolSize: number;
}

// =============================================================================
// FREE AGENT MARKET STATE
// =============================================================================

/**
 * Free agent market state
 */
export interface FreeAgentMarketState {
  pool: FreeAgent[];
  signingHistory: Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    week: number;
    salary: number;
  }>;
  currentWeek: number;
}

/**
 * Create initial free agent market state
 */
export function createFreeAgentMarketState(
  currentWeek: number = 1,
  initialPoolSize: number = 50
): FreeAgentMarketState {
  // Generate initial pool
  const pool: FreeAgent[] = [];
  for (let i = 0; i < initialPoolSize; i++) {
    const id = `fa_init_${i}`;
    const seed = currentWeek * 1000 + i;
    pool.push(generateFreeAgent(id, currentWeek, seed));
  }

  return {
    pool,
    signingHistory: [],
    currentWeek,
  };
}

// =============================================================================
// FREE AGENT SIGNING
// =============================================================================

/**
 * Convert FreeAgent to Player
 */
function freeAgentToPlayer(freeAgent: FreeAgent, teamId: string): Player {
  const rating = freeAgent.overallRating;
  const potential = freeAgent.averagePotential;

  return {
    id: freeAgent.id,
    name: freeAgent.name,
    age: freeAgent.age,
    dateOfBirth: new Date(Date.now() - freeAgent.age * 365.25 * 24 * 60 * 60 * 1000),
    position: freeAgent.position,
    attributes: {
      grip_strength: rating,
      arm_strength: rating,
      core_strength: rating,
      agility: rating,
      acceleration: rating,
      top_speed: rating,
      jumping: rating,
      reactions: rating,
      stamina: rating,
      balance: rating,
      height: 65,
      durability: rating,
      awareness: rating,
      creativity: rating,
      determination: rating,
      bravery: rating,
      consistency: rating,
      composure: rating,
      patience: rating,
      hand_eye_coordination: rating,
      throw_accuracy: rating,
      form_technique: rating,
      finesse: rating,
      deception: rating,
      teamwork: rating,
    },
    potentials: {
      physical: potential,
      mental: potential,
      technical: potential,
    },
    peakAges: { physical: 26, technical: 28, mental: 30 },
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    careerStats: {
      gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    },
    currentSeasonStats: {
      gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    },
    teamId,
    acquisitionType: 'free_agent',
    acquisitionDate: new Date(),
  };
}

/**
 * Sign a free agent to a team
 */
export function signFreeAgent(
  state: FreeAgentMarketState,
  players: Player[],
  playerId: string,
  teamId: string,
  teamName: string,
  salary: number,
  eventEmitter: GameEventEmitter = gameEvents
): { state: FreeAgentMarketState; players: Player[] } {
  const freeAgentIndex = state.pool.findIndex((fa) => fa.id === playerId);
  if (freeAgentIndex === -1) {
    throw new Error('Player not found in free agent pool');
  }

  const freeAgent = state.pool[freeAgentIndex];

  // Remove from pool
  const updatedPool = [...state.pool];
  updatedPool.splice(freeAgentIndex, 1);

  // Convert to Player and add to players list
  const signedPlayer = freeAgentToPlayer(freeAgent, teamId);
  const updatedPlayers = [...players, signedPlayer];

  // Record signing
  const signingRecord = {
    playerId,
    playerName: freeAgent.name,
    teamId,
    week: state.currentWeek,
    salary,
  };

  // Emit event
  const event: FreeAgentSignedEvent = {
    type: 'freeAgent:signed',
    timestamp: new Date(),
    playerId,
    playerName: freeAgent.name,
    teamId,
    teamName,
    salary,
  };
  eventEmitter.emit(event as unknown as GameEvent);

  return {
    state: {
      ...state,
      pool: updatedPool,
      signingHistory: [...state.signingHistory, signingRecord],
    },
    players: updatedPlayers,
  };
}

/**
 * Release a player to free agency
 */
export function releaseToFreeAgency(
  state: FreeAgentMarketState,
  players: Player[],
  playerId: string,
  eventEmitter: GameEventEmitter = gameEvents
): { state: FreeAgentMarketState; players: Player[] } {
  const playerIndex = players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found');
  }

  const player = players[playerIndex];
  const previousTeamId = player.teamId;

  // Convert to FreeAgent
  const overallRating = Math.round(calculateOverallRating(player));
  const averagePotential = Math.round(
    (player.potentials.physical + player.potentials.mental + player.potentials.technical) / 3
  );
  const annualSalary = player.contract?.salary ?? Math.round(overallRating * 10000);
  const marketValue = annualSalary * 5;

  const freeAgent: FreeAgent = {
    id: player.id,
    name: player.name,
    age: player.age,
    overallRating,
    position: player.position,
    primarySport: 'basketball',
    sportsRatings: { basketball: overallRating },
    averagePotential,
    marketValue,
    annualSalary,
    demands: {
      minAnnualSalary: Math.round(annualSalary * 1.1),
      preferredLength: player.age < 25 ? 4 : player.age < 30 ? 3 : 2,
      minSigningBonus: Math.round(annualSalary * 0.15),
    },
    addedDate: state.currentWeek,
  };

  // Add to pool
  const updatedPool = [...state.pool, freeAgent];

  // Remove from team roster (mark as free agent)
  const updatedPlayers = players.filter((p) => p.id !== playerId);

  // Emit event
  const event: FreeAgentReleasedEvent = {
    type: 'freeAgent:released',
    timestamp: new Date(),
    playerId,
    playerName: player.name,
    previousTeamId,
  };
  eventEmitter.emit(event as unknown as GameEvent);

  return {
    state: {
      ...state,
      pool: updatedPool,
    },
    players: updatedPlayers,
  };
}

// =============================================================================
// POOL MANAGEMENT
// =============================================================================

/**
 * Process weekly pool refresh
 */
export function processWeeklyPoolRefresh(
  state: FreeAgentMarketState,
  currentWeek: number,
  eventEmitter: GameEventEmitter = gameEvents,
  config: PoolConfig = DEFAULT_POOL_CONFIG,
  seed: number = Date.now()
): FreeAgentMarketState {
  const result = refreshFreeAgentPool(state.pool, currentWeek, config, seed);

  // Emit event if players were added
  if (result.added.length > 0) {
    const event: FreeAgentPoolRefreshedEvent = {
      type: 'freeAgent:poolRefreshed',
      timestamp: new Date(),
      newPlayersAdded: result.added.length,
      totalPoolSize: result.poolSize,
    };
    eventEmitter.emit(event as unknown as GameEvent);
  }

  // Build updated pool: existing (minus removed) plus added
  const removedIds = new Set(result.removed.map((fa) => fa.id));
  const updatedPool = [
    ...state.pool.filter((fa) => !removedIds.has(fa.id)),
    ...result.added,
  ];

  return {
    ...state,
    pool: updatedPool,
    currentWeek,
  };
}

// =============================================================================
// AI FREE AGENT DECISIONS
// =============================================================================

/**
 * Free agent target for AI
 */
export interface FreeAgentTarget {
  freeAgent: FreeAgent;
  rating: number;
  marketValue: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Identify free agent targets for AI team
 */
export function identifyFreeAgentTargets(
  state: FreeAgentMarketState,
  aiRoster: Player[],
  config: AIConfig,
  budget: number,
  maxTargets: number = 5
): FreeAgentTarget[] {
  const targets: FreeAgentTarget[] = [];

  // Analyze team needs
  const positionCounts: Record<string, number> = {};
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  for (const player of aiRoster) {
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
  }

  const neededPositions = positions.filter((pos) => (positionCounts[pos] || 0) < 2);

  // Calculate average team rating
  const avgRating =
    aiRoster.length > 0
      ? aiRoster.reduce((sum, p) => sum + calculateOverallRating(p), 0) / aiRoster.length
      : 50;

  // Evaluate free agents
  for (const freeAgent of state.pool) {
    const rating = freeAgent.overallRating;
    const estimatedSalary = freeAgent.annualSalary;
    const marketValue = freeAgent.marketValue;

    // Skip if can't afford
    if (estimatedSalary > budget * 0.3) continue;

    let priority: 'high' | 'medium' | 'low' = 'low';
    let reason = '';

    // High priority: fills need AND improves team
    if (neededPositions.includes(freeAgent.position) && rating > avgRating) {
      priority = 'high';
      reason = `Fills needed ${freeAgent.position} position and improves team`;
    }
    // Medium priority: fills need OR significantly better
    else if (neededPositions.includes(freeAgent.position)) {
      priority = 'medium';
      reason = `Fills needed ${freeAgent.position} position`;
    } else if (rating > avgRating + 5) {
      priority = 'medium';
      reason = `Better than team average (${rating} vs ${avgRating.toFixed(0)})`;
    }
    // Low priority: young with potential
    else if (freeAgent.age < 23 && freeAgent.averagePotential > 70) {
      priority = 'low';
      reason = 'Young with development potential';
    } else {
      continue;
    }

    // Personality adjustments
    if (config.personality === 'conservative' && freeAgent.age > 28) {
      continue;
    }

    targets.push({
      freeAgent,
      rating,
      marketValue,
      priority,
      reason,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  targets.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return targets.slice(0, maxTargets);
}

/**
 * Decide if AI should sign a free agent
 */
export function shouldAISignFreeAgent(
  target: FreeAgentTarget,
  budget: number,
  rosterSize: number,
  maxRosterSize: number = 15,
  config: AIConfig
): boolean {
  // Must have roster space
  if (rosterSize >= maxRosterSize) return false;

  const estimatedSalary = target.freeAgent.annualSalary;

  // Must have budget
  if (estimatedSalary > budget * 0.25) return false;

  // Personality affects decision
  switch (config.personality) {
    case 'aggressive':
      return target.priority !== 'low';
    case 'conservative':
      return target.priority === 'high';
    case 'balanced':
    default:
      return target.priority !== 'low' || rosterSize < 10;
  }
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Search free agents with filters
 */
export function searchFreeAgents(
  state: FreeAgentMarketState,
  filters: FreeAgentFilter
): FreeAgent[] {
  return filterFreeAgents(state.pool, filters);
}

/**
 * Get top free agents by rating
 */
export function getTopAvailableFreeAgents(
  state: FreeAgentMarketState,
  count: number = 10
): FreeAgent[] {
  return getTopFreeAgents(state.pool, count);
}

/**
 * Get free agents by position
 */
export function getFreeAgentsByPosition(
  state: FreeAgentMarketState,
  position: string
): FreeAgent[] {
  return filterFreeAgents(state.pool, { position });
}

/**
 * Get affordable free agents
 */
export function getAffordableFreeAgents(
  state: FreeAgentMarketState,
  budget: number
): FreeAgent[] {
  return state.pool.filter((fa) => fa.annualSalary <= budget);
}

/**
 * Get free agent market summary
 */
export function getFreeAgentMarketSummary(state: FreeAgentMarketState): {
  totalPlayers: number;
  averageRating: number;
  averageAge: number;
  signingsThisWeek: number;
  topRatedPlayer: FreeAgent | null;
} {
  const players = state.pool;

  if (players.length === 0) {
    return {
      totalPlayers: 0,
      averageRating: 0,
      averageAge: 0,
      signingsThisWeek: 0,
      topRatedPlayer: null,
    };
  }

  const totalRating = players.reduce((sum, p) => sum + p.overallRating, 0);
  const totalAge = players.reduce((sum, p) => sum + p.age, 0);
  const signingsThisWeek = state.signingHistory.filter(
    (s) => s.week === state.currentWeek
  ).length;

  // Find top rated
  let topRated = players[0];
  for (const player of players) {
    if (player.overallRating > topRated.overallRating) {
      topRated = player;
    }
  }

  return {
    totalPlayers: players.length,
    averageRating: Math.round(totalRating / players.length),
    averageAge: Math.round(totalAge / players.length),
    signingsThisWeek,
    topRatedPlayer: topRated,
  };
}
