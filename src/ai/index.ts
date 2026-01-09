/**
 * AI Module
 *
 * Exports all AI-related functionality:
 * - AI personalities and configurations
 * - Player evaluation
 * - Roster decisions
 * - Tactical decisions
 */

// Types from AI module
export type {
  AIConfig,
  DecisionContext,
  TeamPersonality,
  PlayerEvaluation,
  ReleaseDecision,
  ContractOffer,
  LineupSelection,
  PaceDecision,
  DefenseDecision,
  MinutesAllocation,
} from './types';

// Types from personality module
export type {
  DecisionThresholds,
  ScoutingPreferences,
  MinutesDistribution,
} from './personality';

// Re-export AIPersonality from data/types for convenience
export type { AIPersonality } from '../data/types';

// Personality
export {
  createAIConfig,
  getDecisionThresholds,
  getContractValuation,
  getScoutingPreferences,
  getMinutesDistribution,
} from './personality';

// Evaluation
export {
  calculateOverallRating,
  calculateAgeFactor,
  calculatePotentialFactor,
  evaluatePlayer,
  comparePlayersByPosition,
} from './evaluation';

// Roster Decisions
export {
  shouldReleasePlayer,
  shouldOfferContract,
  prioritizeScouting,
  shouldPromoteYouth,
} from './roster';

// Tactical Decisions
export {
  selectStartingLineup,
  choosePaceStrategy,
  setDefenseStrategy,
  allocateMinutes,
} from './tactical';
