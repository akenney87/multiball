/**
 * Season Module
 *
 * Exports all season-related functionality:
 * - Schedule generation
 * - Week processing
 * - Season management
 */

// Schedule Generator
export {
  generateSeasonSchedule,
  generateTeamSchedule,
  distributeMatchesToWeeks,
  type GeneratedSchedule,
  type ScheduleOptions,
} from './scheduleGenerator';

// Week Processor
export {
  createInitialStandings,
  updateStandings,
  advanceWeek,
  getWeekMatches,
  processMatchResult,
  getCurrentWeekMatches,
  isWeekComplete,
  getPendingMatches,
} from './weekProcessor';

// Season Manager
export {
  createNewSeason,
  getSeasonPhase,
  updateSeasonPhase,
  isTransferWindowOpen,
  openTransferWindow,
  closeTransferWindow,
  calculatePromotionRelegation,
  getTeamsByRank,
  isSeasonComplete,
  getSeasonProgress,
  getRemainingMatchCount,
  type SeasonOptions,
  type SeasonPhase,
  type PromotionRelegationResult,
} from './seasonManager';

// Match Runner
export {
  createDecisionContext,
  createTacticalSettings,
  convertGameResultToMatchResult,
  executeMatch,
  executeWeekMatches,
  type TeamBudget,
} from './matchRunner';

// Events
export {
  GameEventEmitter,
  gameEvents,
  createMatchCompletedEvent,
  createPlayerInjuredEvent,
  createSeasonWeekAdvancedEvent,
  createTeamStandingsChangedEvent,
  createPlayerTrainingEvent,
  eventToNewsItem,
  type GameEventType,
  type GameEvent,
  type MatchCompletedEvent,
  type PlayerInjuredEvent,
  type SeasonWeekAdvancedEvent,
  type TeamStandingsChangedEvent,
  type PlayerTrainingEvent,
  type EventListener,
} from './events';

// Hooks
export {
  HookRegistry,
  createDefaultHookRegistry,
  gameHooks,
  validateRosterHook,
  checkFatigueHook,
  injuryRollHook,
  recoveryProcessingHook,
  trainingXpHook,
  type PreMatchContext,
  type PreMatchResult,
  type PostMatchContext,
  type PostMatchResult,
  type PreWeekContext,
  type PreWeekResult,
  type PostWeekContext,
  type PostWeekResult,
  type PreMatchHook,
  type PostMatchHook,
  type PreWeekHook,
  type PostWeekHook,
} from './hooks';

// Game Loop
export {
  GameLoop,
  createGameLoop,
  type GameLoopConfig,
  type UserMatchContext,
  type WeekResult,
  type AdvanceResult,
  type GameLoopState,
} from './gameLoop';

// Transfer Integration
export {
  createTransferMarketState,
  openTransferWindow as openTransferMarket,
  closeTransferWindow as closeTransferMarket,
  getPlayerMarketValue,
  getPlayerValuationDetails,
  submitTransferOffer,
  processOfferWithAI,
  completeTransfer,
  identifyTransferTargets,
  shouldAIMakeOffer,
  determineAIUrgency,
  processWeeklyTransfers,
  getTeamPendingOffers,
  getPlayerTransferHistory,
  getMarketActivitySummary,
  type TransferMarketState,
  type TransferTarget,
  type PlayerValuationDetails,
  type TransferOfferedEvent,
  type TransferAcceptedEvent,
  type TransferRejectedEvent,
  type TransferCompletedEvent,
} from './transferIntegration';

// Contract Integration
// Note: FM-style negotiations now flow through GameContext/reducer
// This module provides event emission utilities and helpers
export {
  // Helper functions
  calculatePlayerValuation,
  generatePlayerDemands,
  getRecommendedOffer,
  calculateContractUpfrontCost,
  getExpiringContracts,
  isContractExpiring,
  // Event emission
  emitContractOfferedEvent,
  emitContractSignedEvent,
  emitContractRejectedEvent,
  // Event types
  type ContractOfferedEvent,
  type ContractSignedEvent,
  type ContractRejectedEvent,
  type ContractExpiringEvent,
  type ContractExpiredEvent,
  type ExpiringContractInfo,
} from './contractIntegration';

// Free Agent Integration
export {
  createFreeAgentMarketState,
  signFreeAgent,
  releaseToFreeAgency,
  processWeeklyPoolRefresh,
  identifyFreeAgentTargets,
  shouldAISignFreeAgent,
  searchFreeAgents,
  getTopAvailableFreeAgents,
  getFreeAgentsByPosition,
  getAffordableFreeAgents,
  getFreeAgentMarketSummary,
  type FreeAgentMarketState,
  type FreeAgentTarget,
  type FreeAgentSignedEvent,
  type FreeAgentReleasedEvent,
  type FreeAgentPoolRefreshedEvent,
} from './freeAgentIntegration';

// Re-export FreeAgent type from systems
export { type FreeAgent } from '../systems/freeAgentSystem';
