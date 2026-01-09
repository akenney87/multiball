/**
 * AI Decision Engine Types
 *
 * Type definitions for Phase 3 AI decision-making systems.
 * Defines AI personalities, decision contexts, and evaluation criteria.
 */

import type { Player, Budget } from '../data/types';

// =============================================================================
// AI PERSONALITY
// =============================================================================

/**
 * Team personality types (simplified for Week 1)
 * Week 6 will map to AIPersonality traits from types.ts
 */
export type TeamPersonality = 'conservative' | 'balanced' | 'aggressive';

/**
 * AI personality configuration
 * Maps to AIPersonality interface in data/types.ts
 */
export interface AIConfig {
  personality: TeamPersonality;
  youthDevelopmentFocus?: number; // 0-100 (Week 6)
  spendingAggression?: number; // 0-100 (Week 6)
  defensivePreference?: number; // 0-100 (Week 6)
  riskTolerance?: number; // 0-100 (Week 6)
}

// =============================================================================
// DECISION CONTEXT
// =============================================================================

/**
 * Context information for AI decision-making
 * Provides game state, finance, and league information to AI functions
 */
export interface DecisionContext {
  /** Current week number (1-40) */
  week: number;

  /** Is transfer window currently open? */
  transferWindowOpen: boolean;

  /** Team's division (1-10, affects player role expectations) */
  division: number;

  /** Team financial information */
  finance: {
    /** Available budget for spending */
    available: number;
    /** Total budget for season */
    total: number;
    /** Weekly revenue */
    weeklyRevenue?: number;
  };

  /** Current standings information (optional, Week 2+) */
  standings?: {
    /** Team's current position (1-20) */
    position: number;
    /** Points earned so far */
    points: number;
    /** Goal differential */
    goalDifferential: number;
    /** Wins, losses, draws */
    record: { wins: number; losses: number; draws: number };
  };

  /** Match importance (optional, for tactical decisions) */
  matchImportance?: 'low' | 'medium' | 'high';

  /** Season phase (optional, Week 2+) */
  seasonPhase?: 'pre_season' | 'early_season' | 'mid_season' | 'late_season' | 'playoffs';
}

// =============================================================================
// PLAYER EVALUATION
// =============================================================================

/**
 * Position-specific needs for scouting/recruitment
 */
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

/**
 * Player evaluation result
 * Used by AI to rank and compare players
 */
export interface PlayerEvaluation {
  /** Player ID */
  playerId: string;

  /** Overall rating (0-100) */
  overall: number;

  /** Position fit rating (0-100) */
  positionFit: number;

  /** Age factor (younger = higher, 0-100) */
  ageFactor: number;

  /** Potential rating (0-100) */
  potential: number;

  /** Contract value factor (lower = better, 0-100) */
  valueFactor: number;

  /** Composite score (weighted average) */
  compositeScore: number;
}

// =============================================================================
// ROSTER DECISIONS
// =============================================================================

/**
 * Result of shouldReleasePlayer decision
 */
export interface ReleaseDecision {
  /** Should player be released? */
  shouldRelease: boolean;

  /** Reason for decision */
  reason: string;

  /** Player's overall rating */
  rating: number;

  /** Player's roster rank (1 = best) */
  rosterRank?: number;
}

/**
 * Contract offer decision
 */
export interface ContractOffer {
  /** Player ID receiving offer */
  playerId: string;

  /** Annual salary */
  annualSalary: number;

  /** Contract duration (years) */
  duration: number;

  /** Signing bonus (optional) */
  signingBonus?: number;

  /** Performance bonuses (optional) */
  bonuses?: Array<{ condition: string; amount: number }>;
}

/**
 * Scouting priority result
 */
export interface ScoutingPriority {
  /** Positions to prioritize */
  positions: Position[];

  /** Reason for prioritization */
  reason: string;

  /** Urgency level */
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Youth promotion decision
 */
export interface PromotionDecision {
  /** Should youth player be promoted? */
  shouldPromote: boolean;

  /** Reason for decision */
  reason: string;

  /** Player's rating */
  rating: number;

  /** Player's age */
  age: number;
}

// =============================================================================
// TACTICAL DECISIONS
// =============================================================================

/**
 * Pace strategy options
 */
export type PaceStrategy = 'slow' | 'normal' | 'fast';

/**
 * Defense strategy options
 */
export type DefenseStrategy = 'man' | 'zone' | 'press';

/**
 * Starting lineup selection result
 */
export interface LineupSelection {
  /** Selected starting 5 */
  starters: Player[];

  /** Bench players in rotation order */
  bench: Player[];

  /** Reason for selections */
  reason: string;
}

/**
 * Pace strategy decision
 */
export interface PaceDecision {
  /** Selected pace */
  pace: PaceStrategy;

  /** Reason for decision */
  reason: string;

  /** Team average athleticism */
  avgAthleticism: number;
}

/**
 * Defense strategy decision
 */
export interface DefenseDecision {
  /** Selected defense */
  defense: DefenseStrategy;

  /** Reason for decision */
  reason: string;
}

/**
 * Minutes allocation result
 */
export interface MinutesAllocation {
  /** Player ID → minutes mapping */
  allocation: Record<string, number>;

  /** Total minutes allocated */
  totalMinutes: number;

  /** Starters (32 min each) */
  starters: string[];

  /** Rotation (12 min each) */
  rotation: string[];

  /** Deep bench (4 min each) */
  deepBench: string[];
}

// =============================================================================
// AI DECISION RESULTS
// =============================================================================

/**
 * Complete AI decision result (for testing/validation)
 */
export interface AIDecisionResult {
  /** Decision type */
  type: 'roster' | 'tactical' | 'scouting' | 'youth';

  /** Decision timestamp */
  timestamp: Date;

  /** Decision context */
  context: DecisionContext;

  /** Decision details (varies by type) */
  decision:
    | ReleaseDecision
    | ContractOffer
    | ScoutingPriority
    | PromotionDecision
    | LineupSelection
    | PaceDecision
    | DefenseDecision
    | MinutesAllocation;

  /** AI personality used */
  personality: TeamPersonality;
}
