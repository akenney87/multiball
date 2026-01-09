/**
 * AI Personality Core
 *
 * Provides AI personality configuration and decision-making foundations.
 * Maps personality types (conservative/balanced/aggressive) to decision thresholds.
 *
 * Week 1: Simple threshold mapping
 * Week 6: Full AIPersonality trait integration
 */

import type { TeamPersonality, AIConfig } from './types';

// =============================================================================
// PERSONALITY CONFIGURATION
// =============================================================================

/**
 * Create AI configuration for a given personality type
 *
 * Week 1: Simple trait values based on personality
 * Week 6: Will integrate with full AIPersonality from data/types.ts
 *
 * @param personality - Team personality type
 * @returns Complete AI configuration
 */
export function createAIConfig(personality: TeamPersonality): AIConfig {
  switch (personality) {
    case 'conservative':
      return {
        personality: 'conservative',
        youthDevelopmentFocus: 30, // Prefers experienced players
        spendingAggression: 35, // Cautious spending
        defensivePreference: 60, // Values defense
        riskTolerance: 25, // Low risk appetite
      };

    case 'balanced':
      return {
        personality: 'balanced',
        youthDevelopmentFocus: 50, // Balanced approach
        spendingAggression: 50, // Moderate spending
        defensivePreference: 50, // Balanced tactics
        riskTolerance: 50, // Moderate risk
      };

    case 'aggressive':
      return {
        personality: 'aggressive',
        youthDevelopmentFocus: 70, // Focuses on youth/potential
        spendingAggression: 75, // Free spending
        defensivePreference: 35, // Offensive focus
        riskTolerance: 80, // High risk, high reward
      };
  }
}

// =============================================================================
// DECISION THRESHOLDS
// =============================================================================

/**
 * Decision thresholds derived from AI configuration
 */
export interface DecisionThresholds {
  /** Minimum rating to keep player (below this = release) */
  releasePlayerRating: number;

  /** Minimum rating to sign free agent */
  signPlayerRating: number;

  /** Minimum rating to promote youth player */
  promoteYouthRating: number;

  /** Minimum rating to be considered for starting lineup */
  starterMinimumRating: number;
}

/**
 * Get decision thresholds for AI configuration
 *
 * Conservative: High standards, keeps proven players
 * Balanced: Moderate standards
 * Aggressive: Low standards, high turnover
 *
 * @param config - AI configuration
 * @returns Decision thresholds (0-100 scale)
 */
export function getDecisionThresholds(config: AIConfig): DecisionThresholds {
  // Conservative AI keeps players longer, signs only stars
  if (config.personality === 'conservative') {
    return {
      releasePlayerRating: 55, // Release below 55 (keep more players)
      signPlayerRating: 70, // Sign only 70+ (high standards)
      promoteYouthRating: 65, // Promote only proven youth (65+)
      starterMinimumRating: 70, // Starters must be 70+ (quality focus)
    };
  }

  // Balanced AI uses moderate thresholds
  if (config.personality === 'balanced') {
    return {
      releasePlayerRating: 60, // Release below 60 (standard threshold)
      signPlayerRating: 65, // Sign 65+ players (good standard)
      promoteYouthRating: 60, // Promote 60+ youth (balanced)
      starterMinimumRating: 65, // Starters should be 65+ (decent standard)
    };
  }

  // Aggressive AI churns roster frequently
  return {
    releasePlayerRating: 65, // Release below 65 (ruthless cuts)
    signPlayerRating: 60, // Sign 60+ players (lower bar)
    promoteYouthRating: 55, // Promote 55+ youth (give them a chance)
    starterMinimumRating: 60, // Starters can be 60+ (depth focus)
  };
}

// =============================================================================
// CONTRACT VALUATION
// =============================================================================

/**
 * Calculate contract value based on player rating and AI personality
 *
 * Week 1: Simple linear valuation (rating × multiplier)
 * Week 6: Add age, potential, position factors
 *
 * @param rating - Player overall rating (0-100)
 * @param config - AI configuration
 * @returns Annual salary in dollars
 */
export function getContractValuation(rating: number, config: AIConfig): number {
  // Base valuation: $50k per rating point
  // Example: 70 rating = $3.5M, 80 rating = $4M
  let baseValue = rating * 50000;

  // Apply personality multiplier
  // Conservative: 0.85x (pays less)
  // Balanced: 1.0x (market rate)
  // Aggressive: 1.2x (overpays to attract players)
  let multiplier = 1.0;

  if (config.personality === 'conservative') {
    multiplier = 0.85;
  } else if (config.personality === 'aggressive') {
    multiplier = 1.2;
  }

  // Apply multiplier
  const finalValue = baseValue * multiplier;

  // Round to nearest $10k
  return Math.round(finalValue / 10000) * 10000;
}

// =============================================================================
// SCOUTING PREFERENCES
// =============================================================================

/**
 * Scouting focus weights
 */
export interface ScoutingPreferences {
  /** Weight for young players (0-100) */
  focusOnYouth: number;

  /** Weight for experienced players (0-100) */
  focusOnExperience: number;

  /** Weight for high potential (0-100) */
  focusOnPotential: number;

  /** Weight for proven performance (0-100) */
  focusOnProvenPerformance: number;
}

/**
 * Get scouting preferences for AI configuration
 *
 * Determines what types of players the AI prioritizes when scouting
 *
 * @param config - AI configuration
 * @returns Scouting preference weights
 */
export function getScoutingPreferences(config: AIConfig): ScoutingPreferences {
  // Conservative: Proven players, avoid risk
  if (config.personality === 'conservative') {
    return {
      focusOnYouth: 30,
      focusOnExperience: 70,
      focusOnPotential: 35,
      focusOnProvenPerformance: 65,
    };
  }

  // Balanced: Equal consideration
  if (config.personality === 'balanced') {
    return {
      focusOnYouth: 50,
      focusOnExperience: 50,
      focusOnPotential: 50,
      focusOnProvenPerformance: 50,
    };
  }

  // Aggressive: Young high-potential players
  return {
    focusOnYouth: 75,
    focusOnExperience: 25,
    focusOnPotential: 70,
    focusOnProvenPerformance: 30,
  };
}

// =============================================================================
// MINUTES DISTRIBUTION
// =============================================================================

/**
 * Minutes distribution preferences
 */
export interface MinutesDistribution {
  /** Minutes per game for starters */
  starterMinutes: number;

  /** Minutes per game for rotation players */
  rotationMinutes: number;

  /** Minutes per game for bench players */
  benchMinutes: number;
}

/**
 * Get minutes distribution preferences for AI configuration
 *
 * Conservative: Play starters heavy minutes (trust proven players)
 * Balanced: Standard rotation
 * Aggressive: Distribute minutes more evenly (develop depth)
 *
 * @param config - AI configuration
 * @returns Minutes distribution (total = 240 = 5 players × 48 min game)
 */
export function getMinutesDistribution(config: AIConfig): MinutesDistribution {
  // Conservative: Starters play 34 min, rotation 10 min, bench 2 min
  // Total: (34*5) + (10*3) + (2*2) = 170 + 30 + 4 = 204... wait that's not 240
  // Let me recalculate: Game is 48 minutes, 5 players on court at once
  // Total player-minutes per game = 48 * 5 = 240 minutes

  // Conservative: Heavy starter usage
  if (config.personality === 'conservative') {
    return {
      starterMinutes: 34, // Starters: 34 min × 5 = 170 min
      rotationMinutes: 14, // Rotation: 14 min × 3 = 42 min
      benchMinutes: 14, // Bench: 14 min × 2 = 28 min
      // Total: 170 + 42 + 28 = 240 ✓
    };
  }

  // Balanced: Standard distribution
  if (config.personality === 'balanced') {
    return {
      starterMinutes: 32, // Starters: 32 min × 5 = 160 min
      rotationMinutes: 16, // Rotation: 16 min × 3 = 48 min
      benchMinutes: 16, // Bench: 16 min × 2 = 32 min
      // Total: 160 + 48 + 32 = 240 ✓
    };
  }

  // Aggressive: More even distribution
  return {
    starterMinutes: 30, // Starters: 30 min × 5 = 150 min
    rotationMinutes: 18, // Rotation: 18 min × 3 = 54 min
    benchMinutes: 18, // Bench: 18 min × 2 = 36 min
    // Total: 150 + 54 + 36 = 240 ✓
  };
}
