// Multiball - Multi-Sport Franchise Management Game
// Main entry point

// Export data types (Agent 5)
export * from './data';

// Export simulation (Agent 1)
// Note: Some constants are exported from both simulation and data
// We re-export only the simulation-specific ones here to avoid conflicts
export {
  sigmoid,
  calculateComposite,
  calculateAttributeDiff,
  weightedSigmoidProbability,
  rollSuccess,
  applyConsistencyVariance,
  weightedRandomChoice,
  normalizeProbabilities,
  applyModifier,
  setSeed,
  resetRandom,
  calculateStaminaPenalty,
  applyStaminaToPlayer,
  calculateRubberBandModifier,
} from './simulation/core/probability';

export * from './simulation/core/types';

// Export simulation constants (re-exported to avoid duplication)
export {
  SIGMOID_K,
  BASE_RATE_3PT,
  BASE_RATE_MIDRANGE_SHORT,
  BASE_RATE_MIDRANGE_LONG,
  BASE_RATE_DUNK,
  BASE_RATE_LAYUP,
  BASE_RATE_FREE_THROW,
  WEIGHTS_3PT,
  WEIGHTS_MIDRANGE,
  WEIGHTS_DUNK,
  WEIGHTS_LAYUP,
  WEIGHTS_REBOUND,
  WEIGHTS_CONTEST,
  WEIGHTS_STEAL_DEFENSE,
  WEIGHTS_TURNOVER_PREVENTION,
  WEIGHTS_BALL_HANDLING,
  WEIGHTS_DRIVE_DUNK,
  WEIGHTS_DRIVE_LAYUP,
  WEIGHTS_DRIVE_KICKOUT,
  WEIGHTS_DRIVE_TURNOVER,
  WEIGHTS_TRANSITION_SUCCESS,
  WEIGHTS_TRANSITION_DEFENSE,
  WEIGHTS_SHOT_SEPARATION,
  WEIGHTS_FIND_OPEN_TEAMMATE,
  WEIGHTS_HELP_DEFENSE_ROTATION,
  WEIGHTS_BLOCK_DEFENDER,
  WEIGHTS_BLOCK_SHOOTER,
  WEIGHTS_BLOCK_CONTROL,
  WEIGHTS_BLOCK_SHOOTER_RECOVER,
  WEIGHTS_OUT_OFF_SHOOTER,
  WEIGHTS_OUT_OFF_BLOCKER,
  SHOT_DISTRIBUTION_BASELINE,
  CONTEST_PENALTIES,
  TRANSITION_BONUS_RIM,
  TRANSITION_BONUS_MIDRANGE,
  TRANSITION_BONUS_3PT,
  ZONE_DEFENSE_CONTEST_PENALTY,
  ZONE_DEFENSE_DRIVE_PENALTY,
  BASE_TURNOVER_RATE,
  STAMINA_THRESHOLD,
  STAMINA_DEGRADATION_POWER,
  STAMINA_DEGRADATION_SCALE,
} from './simulation/constants';

// Export Phase 2 Core Systems
export {
  // Shooting system
  selectShotType,
  calculateContestPenalty,
  attemptShot,
  attempt3ptShot,
  attemptMidrangeShot,
  attemptRimShot,
  checkForBlock,
  determineBlockOutcome,
  determineRimAttemptType,
  checkHelpDefense,
  simulateContestDistance,
} from './simulation/systems/shooting';

export {
  // Defense system
  assignDefender,
  assignZoneDefenderByLocation,
  getPrimaryDefender,
  calculateContestDistance,
  selectHelpDefender,
  applyZoneModifiers,
  getZoneDriveModifier,
  calculateContestQuality,
  formatDefenseDebug,
} from './simulation/systems/defense';

export {
  // Rebounding system
  getReboundersForStrategy,
  calculateTeamReboundingStrength,
  calculateOffensiveReboundProbability,
  selectRebounder,
  checkPutbackAttempt,
  simulateRebound,
  formatReboundDebug,
} from './simulation/systems/rebounding';

export {
  // Turnover system
  checkTurnover,
  selectTurnoverType,
  determineStealCredit,
  triggersTransition,
  getTurnoverDescription,
} from './simulation/systems/turnovers';

export {
  // Foul system
  FoulSystem,
  SHOOTING_FOUL_BASE_RATES,
  SHOT_TYPE_FOUL_MULTIPLIERS,
  NON_SHOOTING_FOUL_BASE_RATE,
  ACTION_FOUL_RATES,
} from './simulation/systems/fouls';

export {
  // Free throw system
  FreeThrowShooter,
  simulateFreeThrowSequence,
  FREE_THROW_BASE_RATE,
  FREE_THROW_K,
  FREE_THROW_WEIGHTS,
  PRESSURE_MODIFIERS,
} from './simulation/systems/freeThrows';

export type {
  // Rebounding types
  ReboundResult,
} from './simulation/systems/rebounding';

export type {
  // Turnover types
  TurnoverResult,
} from './simulation/systems/turnovers';

export type {
  // Foul types
  FoulEvent,
} from './simulation/systems/fouls';

export type {
  // Free throw types
  FreeThrowResult,
} from './simulation/systems/freeThrows';
