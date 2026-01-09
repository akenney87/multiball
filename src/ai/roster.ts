/**
 * AI Roster Management System
 *
 * Handles AI decisions for roster management:
 * - Player release decisions
 * - Contract offer generation
 * - Scouting prioritization
 * - Youth player promotion
 *
 * Week 1: Simple threshold-based decisions
 * Week 6: Add advanced factors (team chemistry, budget optimization, etc.)
 */

import type { Player, SquadRole } from '../data/types';
import type {
  DecisionContext,
  AIConfig,
  ReleaseDecision,
  ContractOffer,
  Position,
} from './types';
import { evaluatePlayer, calculateOverallRating } from './evaluation';
import { getDecisionThresholds, getContractValuation } from './personality';
import { getRoleForDivision, compareRoles } from '../systems/roleExpectationSystem';

// =============================================================================
// RELEASE DECISIONS
// =============================================================================

/**
 * Determine if a player should be released from the roster
 *
 * Considers:
 * - Player's overall rating vs personality threshold
 * - Player's rank at their position on the roster
 * - Team needs (don't release last player at position)
 *
 * @param player - Player to evaluate for release
 * @param roster - Current team roster
 * @param context - Decision context (week, finances, etc.)
 * @param config - AI configuration
 * @returns Release decision with reasoning
 */
export function shouldReleasePlayer(
  player: Player,
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): ReleaseDecision {
  const thresholds = getDecisionThresholds(config);
  const evaluation = evaluatePlayer(player, context, config);
  const rating = evaluation.overall;

  // Calculate roster rank at position
  const positionPlayers = roster.filter((p) => p.position === player.position);
  const rankedPlayers = positionPlayers
    .map((p) => ({
      id: p.id,
      rating: calculateOverallRating(p),
    }))
    .sort((a, b) => b.rating - a.rating);

  const playerRank = rankedPlayers.findIndex((p) => p.id === player.id) + 1;
  const isLastAtPosition = positionPlayers.length <= 1;
  const isBestAtPosition = playerRank === 1;

  // Never release if:
  // 1. Last player at position
  // 2. Best player at position (regardless of rating)
  if (isLastAtPosition) {
    return {
      shouldRelease: false,
      reason: `Last player at ${player.position} position`,
      rating,
      rosterRank: playerRank,
    };
  }

  if (isBestAtPosition) {
    return {
      shouldRelease: false,
      reason: `Best player at ${player.position} position`,
      rating,
      rosterRank: playerRank,
    };
  }

  // Check against threshold
  if (rating < thresholds.releasePlayerRating) {
    return {
      shouldRelease: true,
      reason: `Rating ${rating.toFixed(1)} below threshold ${thresholds.releasePlayerRating}`,
      rating,
      rosterRank: playerRank,
    };
  }

  return {
    shouldRelease: false,
    reason: `Rating ${rating.toFixed(1)} above threshold ${thresholds.releasePlayerRating}`,
    rating,
    rosterRank: playerRank,
  };
}

// =============================================================================
// CONTRACT OFFERS
// =============================================================================

/**
 * Determine the squad role a player would likely get on a team
 *
 * Compares player rating to current roster at their position to determine
 * what role they'd realistically fill.
 *
 * @param player - Player to evaluate
 * @param roster - Current team roster
 * @param context - Decision context (includes division)
 * @returns The squad role the player would likely receive
 */
function determineOfferedRole(
  player: Player,
  roster: Player[],
  context: DecisionContext
): SquadRole {
  const playerRating = calculateOverallRating(player);
  const positionPlayers = roster.filter(p => p.position === player.position);

  // If no players at position, they'd be the starter
  if (positionPlayers.length === 0) {
    return getRoleForDivision(playerRating, context.division);
  }

  // Calculate how they'd rank at their position
  const positionRatings = positionPlayers
    .map(p => calculateOverallRating(p))
    .sort((a, b) => b - a); // Highest first

  // Find where they'd slot in
  let rank = 0;
  for (const rating of positionRatings) {
    if (playerRating >= rating) break;
    rank++;
  }

  // Map position rank to role (1st = star/important, 2nd = rotation, etc.)
  const roleByRank: SquadRole[] = [
    'star_player',        // Best at position
    'important_player',   // 2nd best
    'rotation_player',    // 3rd best
    'squad_player',       // 4th best
    'backup',             // 5th+
  ];

  return roleByRank[Math.min(rank, roleByRank.length - 1)] ?? 'backup';
}

/**
 * Determine if AI should offer a contract to a free agent
 *
 * Considers:
 * - Free agent's rating vs personality threshold
 * - Available budget
 * - Transfer window status
 * - Division-based role expectations vs what team can actually offer
 *
 * @param freeAgent - Free agent to evaluate
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns Contract offer or null if not interested
 */
export function shouldOfferContract(
  freeAgent: Player,
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): ContractOffer | null {
  // Check transfer window
  if (!context.transferWindowOpen) {
    return null;
  }

  // Check budget
  if (context.finance.available <= 0) {
    return null;
  }

  const thresholds = getDecisionThresholds(config);
  const rating = calculateOverallRating(freeAgent);

  // Check if player meets signing threshold
  if (rating < thresholds.signPlayerRating) {
    return null;
  }

  // Check if player's expected role aligns with what we can offer
  // Don't sign players who expect more than we can give (leads to unhappy players)
  const expectedRole = getRoleForDivision(rating, context.division);
  const offeredRole = determineOfferedRole(freeAgent, roster, context);
  const roleDiff = compareRoles(expectedRole, offeredRole);

  // If player expects significantly higher role than we'd offer, skip them
  // (They'd be unhappy and request a transfer)
  if (roleDiff > 1) {
    // Player expects 2+ levels higher than we'd offer
    // Only aggressive personalities take this risk
    if (config.personality !== 'aggressive') {
      return null;
    }
  }

  // Calculate contract value based on rating and personality
  const annualSalary = getContractValuation(rating, config);

  // Check if we can afford them
  if (annualSalary > context.finance.available) {
    // Can we afford a reduced offer?
    const reducedOffer = Math.min(annualSalary * 0.8, context.finance.available);
    if (reducedOffer < annualSalary * 0.6) {
      // Too much of a discount, don't offer
      return null;
    }

    return {
      playerId: freeAgent.id,
      annualSalary: Math.round(reducedOffer / 10000) * 10000, // Round to $10k
      duration: 1, // Short deal when budget-constrained
    };
  }

  // Full offer
  const duration = calculateContractDuration(freeAgent, config);

  return {
    playerId: freeAgent.id,
    annualSalary,
    duration,
  };
}

/**
 * Calculate contract duration based on player age and AI personality
 *
 * @param player - Player to sign
 * @param config - AI configuration
 * @returns Contract duration in years
 */
function calculateContractDuration(player: Player, config: AIConfig): number {
  const age = player.age;

  // Young players: Longer contracts to lock them up
  if (age < 25) {
    if (config.personality === 'aggressive') {
      return 4; // Aggressive locks up young talent
    }
    if (config.personality === 'conservative') {
      return 2; // Conservative is cautious even with youth
    }
    return 3; // Balanced
  }

  // Prime players (25-30): Standard contracts
  if (age <= 30) {
    if (config.personality === 'aggressive') {
      return 3;
    }
    if (config.personality === 'conservative') {
      return 2;
    }
    return 2;
  }

  // Older players: Short contracts
  if (config.personality === 'conservative') {
    return 1; // Conservative very cautious with older players
  }
  return 1;
}

// =============================================================================
// SCOUTING PRIORITIES
// =============================================================================

/**
 * Determine scouting priorities based on roster needs
 *
 * Positions with fewer or weaker players get higher priority.
 *
 * @param roster - Current team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns Positions sorted by scouting priority (highest first)
 */
export function prioritizeScouting(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): Position[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  // Calculate score for each position (lower = higher priority)
  const positionScores: { position: Position; score: number }[] = positions.map((pos) => {
    const positionPlayers = roster.filter((p) => p.position === pos);

    // No players at position = highest priority (score 0)
    if (positionPlayers.length === 0) {
      return { position: pos, score: 0 };
    }

    // Calculate average rating at position
    const avgRating =
      positionPlayers.reduce((sum, p) => sum + calculateOverallRating(p), 0) /
      positionPlayers.length;

    // Score = count * avgRating (more players + higher ratings = lower priority)
    const score = positionPlayers.length * avgRating;

    return { position: pos, score };
  });

  // Sort by score (lowest first = highest priority)
  positionScores.sort((a, b) => a.score - b.score);

  return positionScores.map((ps) => ps.position);
}

// =============================================================================
// YOUTH PROMOTION
// =============================================================================

/**
 * Determine if a youth player should be promoted to the main roster
 *
 * @param youthPlayer - Youth player to evaluate
 * @param roster - Current main roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns True if player should be promoted
 */
export function shouldPromoteYouth(
  youthPlayer: Player,
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): boolean {
  const thresholds = getDecisionThresholds(config);
  const rating = calculateOverallRating(youthPlayer);

  // Simple threshold check
  return rating >= thresholds.promoteYouthRating;
}
