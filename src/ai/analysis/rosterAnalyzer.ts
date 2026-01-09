/**
 * Roster Analyzer
 *
 * Re-exports roster analysis functions from aiManager and adds additional utilities.
 * This module provides a clean API for analyzing team rosters.
 */

import type { Player, AIPersonality } from '../../data/types';
import type { Position } from '../types';
import {
  TeamNeeds,
  PositionNeed,
  AgingConcern,
  analyzeTeamNeeds,
  getAgingThreshold,
  getTraitValue,
} from '../aiManager';
import { calculateOverallRating } from '../evaluation';

// Re-export types
export type { TeamNeeds, PositionNeed, AgingConcern };

// Re-export main function
export { analyzeTeamNeeds };

// =============================================================================
// ADDITIONAL ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Get detailed position breakdown
 */
export interface PositionBreakdown {
  position: Position;
  players: Array<{
    id: string;
    name: string;
    rating: number;
    age: number;
    isStarter: boolean;
  }>;
  starterRating: number;
  backupRating: number;
  depth: number;
}

export function getPositionBreakdown(roster: Player[]): PositionBreakdown[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  return positions.map(pos => {
    const players = roster
      .filter(p => p.position === pos)
      .map(p => ({
        id: p.id,
        name: p.name,
        rating: calculateOverallRating(p),
        age: p.age,
        isStarter: false,
      }))
      .sort((a, b) => b.rating - a.rating);

    // Mark best player as starter
    const bestPlayer = players[0];
    if (bestPlayer) {
      bestPlayer.isStarter = true;
    }

    return {
      position: pos,
      players,
      starterRating: players[0]?.rating || 0,
      backupRating: players[1]?.rating || 0,
      depth: players.length,
    };
  });
}

/**
 * Calculate team's overall competitive level
 */
export interface CompetitiveAssessment {
  starterAverage: number;
  benchAverage: number;
  overallAverage: number;
  tier: 'elite' | 'contender' | 'playoff' | 'developing' | 'rebuilding';
  strengths: string[];
  weaknesses: string[];
}

export function assessCompetitiveness(roster: Player[]): CompetitiveAssessment {
  if (roster.length === 0) {
    return {
      starterAverage: 0,
      benchAverage: 0,
      overallAverage: 0,
      tier: 'rebuilding',
      strengths: [],
      weaknesses: ['No players on roster'],
    };
  }

  // Sort by rating
  const sorted = [...roster]
    .map(p => ({ player: p, rating: calculateOverallRating(p) }))
    .sort((a, b) => b.rating - a.rating);

  // Top 5 are starters, rest are bench
  const starters = sorted.slice(0, 5);
  const bench = sorted.slice(5);

  const starterAverage = starters.length > 0
    ? starters.reduce((sum, p) => sum + p.rating, 0) / starters.length
    : 0;

  const benchAverage = bench.length > 0
    ? bench.reduce((sum, p) => sum + p.rating, 0) / bench.length
    : 0;

  const overallAverage = sorted.reduce((sum, p) => sum + p.rating, 0) / sorted.length;

  // Determine tier
  let tier: CompetitiveAssessment['tier'];
  if (starterAverage >= 80) {
    tier = 'elite';
  } else if (starterAverage >= 72) {
    tier = 'contender';
  } else if (starterAverage >= 65) {
    tier = 'playoff';
  } else if (starterAverage >= 55) {
    tier = 'developing';
  } else {
    tier = 'rebuilding';
  }

  // Identify strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const breakdown = getPositionBreakdown(roster);

  for (const pos of breakdown) {
    if (pos.starterRating >= 75) {
      strengths.push(`Strong ${pos.position} (${pos.starterRating.toFixed(0)} rating)`);
    } else if (pos.starterRating < 55 || pos.depth === 0) {
      weaknesses.push(`Weak ${pos.position} (${pos.starterRating.toFixed(0)} rating, ${pos.depth} depth)`);
    }
  }

  if (bench.length < 5) {
    weaknesses.push(`Shallow bench (only ${bench.length} reserves)`);
  }

  // Age analysis
  const avgAge = roster.reduce((sum, p) => sum + p.age, 0) / roster.length;
  if (avgAge > 30) {
    weaknesses.push(`Aging roster (avg age ${avgAge.toFixed(1)})`);
  } else if (avgAge < 24) {
    strengths.push(`Young roster with upside (avg age ${avgAge.toFixed(1)})`);
  }

  return {
    starterAverage,
    benchAverage,
    overallAverage,
    tier,
    strengths,
    weaknesses,
  };
}

/**
 * Find players that could be trade candidates
 */
export interface TradeCandidateAssessment {
  player: Player;
  rating: number;
  tradeValue: 'high' | 'medium' | 'low';
  reasons: string[];
}

export function identifyTradeCandidates(
  roster: Player[],
  personality: AIPersonality
): TradeCandidateAssessment[] {
  const agingThreshold = getAgingThreshold(personality);
  const youthFocus = getTraitValue(personality, 'youth_development_focus');
  const loyalty = getTraitValue(personality, 'player_loyalty');

  const candidates: TradeCandidateAssessment[] = [];

  const breakdown = getPositionBreakdown(roster);

  for (const player of roster) {
    const rating = calculateOverallRating(player);
    const reasons: string[] = [];
    let isCandidate = false;

    // Check if surplus at position
    const positionPlayers = breakdown.find(b => b.position === player.position);
    if (positionPlayers && positionPlayers.depth > 2) {
      const playerRank = positionPlayers.players.findIndex(p => p.id === player.id) + 1;
      if (playerRank > 2) {
        reasons.push(`Surplus depth at ${player.position} (${playerRank} of ${positionPlayers.depth})`);
        isCandidate = true;
      }
    }

    // Check if aging (for youth-focused teams)
    if (youthFocus > 0.6 && player.age > agingThreshold - 2) {
      reasons.push(`Aging player (${player.age}yo) on youth-focused team`);
      isCandidate = true;
    }

    // Check if salary is too high relative to rating
    const salary = player.contract?.salary || 0;
    const expectedSalary = rating * 50000; // Rough benchmark
    if (salary > expectedSalary * 1.5) {
      reasons.push(`Overpaid ($${salary.toLocaleString()} vs $${expectedSalary.toLocaleString()} expected)`);
      isCandidate = true;
    }

    // High loyalty teams less likely to trade
    if (isCandidate && loyalty > 0.7) {
      // Still a candidate but note the reluctance
      reasons.push('Team has high loyalty (may demand premium)');
    }

    if (isCandidate) {
      // Determine trade value
      let tradeValue: TradeCandidateAssessment['tradeValue'];
      if (rating >= 75) {
        tradeValue = 'high';
      } else if (rating >= 65) {
        tradeValue = 'medium';
      } else {
        tradeValue = 'low';
      }

      candidates.push({
        player,
        rating,
        tradeValue,
        reasons,
      });
    }
  }

  return candidates.sort((a, b) => {
    // Sort by trade value (high first), then by rating
    const valueOrder = { high: 0, medium: 1, low: 2 };
    if (valueOrder[a.tradeValue] !== valueOrder[b.tradeValue]) {
      return valueOrder[a.tradeValue] - valueOrder[b.tradeValue];
    }
    return b.rating - a.rating;
  });
}

/**
 * Suggest ideal targets based on team needs
 */
export interface TargetSuggestion {
  position: Position;
  minRating: number;
  maxAge: number;
  maxSalary: number;
  urgency: 'critical' | 'moderate' | 'low';
  reason: string;
}

export function suggestTargets(
  roster: Player[],
  personality: AIPersonality,
  budget: number
): TargetSuggestion[] {
  const needs = analyzeTeamNeeds(roster, personality);
  const agingThreshold = getAgingThreshold(personality);
  const youthFocus = getTraitValue(personality, 'youth_development_focus');

  const suggestions: TargetSuggestion[] = [];

  for (const gap of needs.positionGaps) {
    if (gap.urgency === 'low') continue;

    // Calculate target criteria based on personality
    const maxAge = youthFocus > 0.6
      ? Math.min(26, agingThreshold - 2)
      : agingThreshold;

    const maxSalary = Math.round(budget * 0.15); // Max 15% of budget per player

    suggestions.push({
      position: gap.position,
      minRating: gap.targetRating,
      maxAge,
      maxSalary,
      urgency: gap.urgency,
      reason: gap.currentCount === 0
        ? `No players at ${gap.position}`
        : `Upgrade needed at ${gap.position} (current avg: ${gap.avgRating.toFixed(0)})`,
    });
  }

  // Sort by urgency
  suggestions.sort((a, b) => {
    const urgencyOrder = { critical: 0, moderate: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return suggestions;
}
