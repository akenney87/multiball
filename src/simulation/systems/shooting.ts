/**
 * Basketball Simulator - Shooting System
 *
 * Complete shooting mechanics for Milestone 1:
 * - Shot type selection with player/tactical modifiers
 * - Two-stage success calculation (base + contest)
 * - All 5 shot types (3PT, midrange short/long, dunk, layup)
 * - Contest penalty system with distance tiers
 * - Help defense rotation logic
 * - Transition bonuses
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/shooting
 */

import {
  calculateComposite,
  weightedSigmoidProbability,
  rollSuccess,
  weightedRandomChoice,
  normalizeProbabilities,
  sigmoid,
  applyConsistencyVariance,
  calculateRubberBandModifier,
} from '../core/probability';
import type { PossessionContext, SimulationPlayer, SimulationTacticalSettings, ShotType, ContestTier } from '../core/types';
import {
  // Base rates
  BASE_RATE_3PT,
  BASE_RATE_MIDRANGE_SHORT,
  BASE_RATE_MIDRANGE_LONG,
  BASE_RATE_DUNK,
  BASE_RATE_LAYUP,
  // Attribute weights
  WEIGHTS_3PT,
  WEIGHTS_MIDRANGE,
  WEIGHTS_DUNK,
  WEIGHTS_LAYUP,
  WEIGHTS_CONTEST,
  WEIGHTS_TRANSITION_SUCCESS,
  // Shot distribution
  SHOT_DISTRIBUTION_BASELINE,
  SHOT_DISTRIBUTION_PLAYER_MOD,
  SHOT_DISTRIBUTION_TACTICAL_MOD,
  ZONE_DEFENSE_3PT_ATTEMPT_BONUS,
  // Contest penalties
  CONTEST_DISTANCE_WIDE_OPEN,
  CONTEST_DISTANCE_CONTESTED,
  CONTEST_PENALTIES,
  CONTEST_DEFENDER_MOD_SCALE,
  PATIENCE_CONTEST_REDUCTION_SCALE,
  // Help defense
  HELP_DEFENSE_TRIGGER_THRESHOLD,
  HELP_DEFENSE_AWARENESS_K,
  // Transition bonuses
  TRANSITION_BONUS_RIM,
  TRANSITION_BONUS_MIDRANGE,
  TRANSITION_BONUS_3PT,
  // Zone defense
  ZONE_DEFENSE_CONTEST_PENALTY,
  // Blocking
  BLOCK_BASE_RATES,
  BLOCK_DISTANCE_THRESHOLD_FAR,
  BLOCK_DISTANCE_THRESHOLD_MID,
  WEIGHTS_BLOCK_DEFENDER,
  WEIGHTS_BLOCK_SHOOTER,
  BLOCK_OUTCOME_STAYS_IN_PLAY,
  BLOCK_OUTCOME_OUT_OFF_SHOOTER,
  BLOCK_OUTCOME_OUT_OFF_BLOCKER,
  WEIGHTS_BLOCK_CONTROL,
  WEIGHTS_BLOCK_SHOOTER_RECOVER,
  WEIGHTS_OUT_OFF_SHOOTER,
  WEIGHTS_OUT_OFF_BLOCKER,
  // Sigmoid constant
  SIGMOID_K,
  // PHASE 3C: Bravery modifier
  BRAVERY_RIM_TENDENCY_SCALE,
} from '../constants';

// =============================================================================
// SHOT TYPE SELECTION
// =============================================================================

/**
 * Determine shot type using weighted distribution.
 *
 * Algorithm:
 * 1. Start with baseline (40% 3PT, 20% mid, 40% rim)
 * 2. Apply player modifiers (±5% based on shooting strengths)
 * 3. Apply tactical modifiers (±10% from pace)
 * 4. If zone defense: +5% to 3PT
 * 5. If transition: +20% to rim (from midrange/3PT)
 * 6. M3 End-game: Apply end-game 3PT adjustment (±20% from desperation/conserve modes)
 * 7. Normalize to 100%
 * 8. Weighted random selection
 *
 * @param shooter - Shooter player object
 * @param tacticalSettings - Tactical settings for offense
 * @param possessionContext - Current possession context
 * @param defenseType - 'man' or 'zone'
 * @param endgame3ptAdjustment - End-game 3PT% adjustment (+0.20 = desperation, -0.10 = conserve)
 * @returns Shot type: '3pt', 'midrange', or 'rim'
 */
export function selectShotType(
  shooter: Record<string, number>,
  tacticalSettings: { pace: string },
  possessionContext: PossessionContext,
  defenseType: string = 'man',
  endgame3ptAdjustment: number = 0.0
): string {
  // Start with baseline distribution
  const distribution: Record<string, number> = { ...SHOT_DISTRIBUTION_BASELINE };

  // BUG FIX: Position-based shot distribution adjustments
  const position = (shooter as any).position || 'SF';
  if (position === 'C') {
    // Centers: Still favor rim, but less aggressively (modern NBA centers)
    distribution['3pt'] -= 0.25;
    distribution['rim'] += 0.15;
    distribution['midrange'] += 0.10;
  } else if (position === 'PF') {
    // Power forwards: Fewer 3PT, more balanced rim/mid
    distribution['3pt'] -= 0.10;
    distribution['rim'] += 0.05;
    distribution['midrange'] += 0.05;
  }

  // Calculate shooter composites for each shot type
  const composite3pt = calculateComposite(shooter, WEIGHTS_3PT);
  const compositeMid = calculateComposite(shooter, WEIGHTS_MIDRANGE);
  const compositeRim = (calculateComposite(shooter, WEIGHTS_DUNK) +
                       calculateComposite(shooter, WEIGHTS_LAYUP)) / 2.0;

  // M4.7: Non-linear composite-based shot selection
  // 3PT shot selection modifier
  const compositeDiff3pt = composite3pt - 50;

  let threePtBonus = 0.0;
  if (compositeDiff3pt >= 0) {
    // Above average: only guards/forwards get bonus
    if (position !== 'C' && position !== 'PF') {
      threePtBonus = compositeDiff3pt * 0.008; // ~32% bonus at composite=90
    }
  } else {
    // Below average: ALL positions get exponential decay
    threePtBonus = -0.50 * (1.0 - Math.exp(0.08 * compositeDiff3pt));
  }

  distribution['3pt'] += threePtBonus;
  distribution['midrange'] -= threePtBonus * 0.6;
  distribution['rim'] -= threePtBonus * 0.4;

  // Rim shot selection modifier
  const compositeDiffRim = compositeRim - 50;
  let rimBonus = 0.0;

  if (compositeDiffRim >= 0) {
    rimBonus = compositeDiffRim * 0.005; // ~20% bonus at composite=90
  } else {
    rimBonus = -0.50 * (1.0 - Math.exp(0.08 * compositeDiffRim));
  }

  distribution['rim'] += rimBonus;
  distribution['3pt'] -= rimBonus * 0.5;
  distribution['midrange'] -= rimBonus * 0.5;

  // Tactical modifiers: Pace affects shot selection
  if (tacticalSettings.pace === 'fast') {
    distribution['rim'] += SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5;
    distribution['midrange'] -= SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5;
  } else if (tacticalSettings.pace === 'slow') {
    distribution['midrange'] += SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5;
    distribution['rim'] -= SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5;
  }

  // Zone defense: +5% to 3PT attempts
  if (defenseType === 'zone') {
    distribution['3pt'] += ZONE_DEFENSE_3PT_ATTEMPT_BONUS;
    distribution['rim'] -= ZONE_DEFENSE_3PT_ATTEMPT_BONUS * 0.5;
    distribution['midrange'] -= ZONE_DEFENSE_3PT_ATTEMPT_BONUS * 0.5;
  }

  // Transition: Heavy rim emphasis
  if (possessionContext.isTransition) {
    distribution['rim'] += 0.20;
    distribution['3pt'] -= 0.10;
    distribution['midrange'] -= 0.10;
  }

  // PHASE 3C: Bravery Drive Tendency
  const bravery = shooter.bravery ?? 50;
  const braveryRimBonus = (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE;
  distribution['rim'] += braveryRimBonus;
  distribution['3pt'] -= braveryRimBonus * 0.6;
  distribution['midrange'] -= braveryRimBonus * 0.4;

  // M3 END-GAME: Apply end-game 3PT adjustment
  if (endgame3ptAdjustment !== 0.0) {
    distribution['3pt'] += endgame3ptAdjustment;
    distribution['midrange'] -= endgame3ptAdjustment * 0.6;
    distribution['rim'] -= endgame3ptAdjustment * 0.4;
  }

  // M4.7: Floor distributions at 0.0 to prevent negative values
  for (const shotType in distribution) {
    distribution[shotType] = Math.max(0.0, distribution[shotType]);
  }

  // Normalize to 100%
  const normalizedDistribution = normalizeProbabilities(distribution);

  // Weighted random selection
  const shotTypes = Object.keys(normalizedDistribution);
  const weights = Object.values(normalizedDistribution);

  return weightedRandomChoice(shotTypes, weights);
}

// =============================================================================
// CONTEST PENALTY CALCULATION
// =============================================================================

/**
 * Calculate shot contest penalty based on distance, defender quality, and shot type.
 *
 * M4 FIX ITERATION 7: Shot-type-specific contest penalties
 *
 * @param contestDistance - Distance in feet (0-10)
 * @param defenderComposite - Defender's contest composite (1-100)
 * @param shotType - Shot type key ('3PT', 'midrange_short', 'midrange_long', 'rim')
 * @param defenseType - 'man' or 'zone'
 * @param shooter - Optional shooter (for patience modifier)
 * @returns Penalty as negative float (e.g., -0.18 = -18% penalty)
 */
export function calculateContestPenalty(
  contestDistance: number,
  defenderComposite: number,
  shotType: string,
  defenseType: string = 'man',
  shooter?: Record<string, number>
): number {
  // Normalize shot_type to match CONTEST_PENALTIES keys
  let penaltyKey: string;
  if (shotType === 'layup' || shotType === 'dunk') {
    penaltyKey = 'rim';
  } else if (shotType.startsWith('midrange')) {
    penaltyKey = shotType;
  } else if (shotType === '3pt' || shotType === '3PT') {
    penaltyKey = '3PT';
  } else {
    penaltyKey = 'rim';
  }

  // Get shot-type-specific penalties
  const penalties = (CONTEST_PENALTIES as any)[penaltyKey];

  // Determine base penalty from distance and shot type
  let basePenalty: number;
  if (contestDistance >= CONTEST_DISTANCE_WIDE_OPEN) {
    basePenalty = penalties.wide_open; // 0%
  } else if (contestDistance >= CONTEST_DISTANCE_CONTESTED) {
    basePenalty = penalties.contested;
  } else {
    basePenalty = penalties.heavy;
  }

  // Defender quality modifier (±5%)
  let defenderModifier = (defenderComposite - 50) * CONTEST_DEFENDER_MOD_SCALE;

  // Zone defense reduces contest effectiveness on 3PT shots
  if (defenseType === 'zone' && penaltyKey === '3PT') {
    defenderModifier *= (1.0 + ZONE_DEFENSE_CONTEST_PENALTY);
  }

  // Total penalty (more negative = harder shot)
  let totalPenalty = basePenalty - defenderModifier;

  // Ensure penalty doesn't become positive
  totalPenalty = Math.min(0.0, totalPenalty);

  return totalPenalty;
}

// =============================================================================
// HELP DEFENSE
// =============================================================================

/**
 * Determine if help defense rotates to contest shot.
 *
 * @param primaryDefenderComposite - Primary defender's contest composite
 * @param contestDistance - How far primary defender is (feet)
 * @param helpDefenders - List of potential help defenders
 * @returns Help defender who rotates, or null if no help
 */
export function checkHelpDefense(
  primaryDefenderComposite: number,
  contestDistance: number,
  helpDefenders: Record<string, number>[]
): Record<string, number> | null {
  // Calculate primary contest quality (0-1 scale)
  let contestQuality: number;
  if (contestDistance >= CONTEST_DISTANCE_WIDE_OPEN) {
    contestQuality = 0.0;
  } else if (contestDistance <= 0.5) {
    contestQuality = 1.0;
  } else {
    contestQuality = (CONTEST_DISTANCE_WIDE_OPEN - contestDistance) / CONTEST_DISTANCE_WIDE_OPEN;
  }

  // Adjust by defender composite
  const defenderFactor = primaryDefenderComposite / 100.0;
  contestQuality = contestQuality * (0.5 + 0.5 * defenderFactor);

  // Check if help needed
  if (contestQuality >= HELP_DEFENSE_TRIGGER_THRESHOLD) {
    return null; // Primary defender doing fine
  }

  // No help defenders available
  if (!helpDefenders || helpDefenders.length === 0) {
    return null;
  }

  // Check each help defender for rotation
  for (const helpDefender of helpDefenders) {
    const awareness = helpDefender.awareness ?? 50;

    // Help rotation probability based on awareness
    const sigmoidInput = -HELP_DEFENSE_AWARENESS_K * (awareness - 50);
    const helpProbability = sigmoid(sigmoidInput);

    if (rollSuccess(helpProbability)) {
      return helpDefender;
    }
  }

  return null;
}

// =============================================================================
// SHOT BLOCKING
// =============================================================================

/**
 * Block outcome info
 */
export interface BlockOutcomeInfo {
  defenderControlComposite: number;
  shooterRecoverComposite: number;
  defenderAggressionComposite: number;
  shooterRedirectComposite: number;
  staysInPlayProbability: number;
  outOffShooterProbability: number;
  outOffBlockerProbability: number;
  selectedOutcome: string;
}

/**
 * Determine what happens to blocked shot based on player attributes.
 *
 * @param shooter - Shooter player object
 * @param defender - Defender player object
 * @param shotType - Shot type (for context/future enhancements)
 * @returns Tuple of [outcome_string, debug_info]
 */
export function determineBlockOutcome(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  shotType: string
): [string, BlockOutcomeInfo] {
  // Calculate composites for each outcome factor
  const defenderControl = calculateComposite(defender, WEIGHTS_BLOCK_CONTROL);
  const shooterRecover = calculateComposite(shooter, WEIGHTS_BLOCK_SHOOTER_RECOVER);
  const defenderAggression = calculateComposite(defender, WEIGHTS_OUT_OFF_SHOOTER);
  const shooterRedirect = calculateComposite(shooter, WEIGHTS_OUT_OFF_BLOCKER);

  // Calculate raw scores using sigmoid
  const staysInPlayScore = sigmoid(SIGMOID_K * (defenderControl - 50));
  const outShooterDiff = defenderAggression - shooterRecover;
  const outShooterScore = sigmoid(SIGMOID_K * outShooterDiff);
  const outBlockerDiff = shooterRedirect - defenderControl;
  const outBlockerScore = sigmoid(SIGMOID_K * outBlockerDiff);

  // Weight by baseline probabilities
  const weightedStay = staysInPlayScore * BLOCK_OUTCOME_STAYS_IN_PLAY;
  const weightedOutShooter = outShooterScore * BLOCK_OUTCOME_OUT_OFF_SHOOTER;
  const weightedOutBlocker = outBlockerScore * BLOCK_OUTCOME_OUT_OFF_BLOCKER;

  // Normalize to probabilities
  const total = weightedStay + weightedOutShooter + weightedOutBlocker;

  let probabilities: number[];
  if (total <= 0) {
    probabilities = [
      BLOCK_OUTCOME_STAYS_IN_PLAY,
      BLOCK_OUTCOME_OUT_OFF_SHOOTER,
      BLOCK_OUTCOME_OUT_OFF_BLOCKER
    ];
  } else {
    probabilities = [
      weightedStay / total,
      weightedOutShooter / total,
      weightedOutBlocker / total
    ];
  }

  // Select outcome using weighted random choice
  const outcomes = ['stays_in_play', 'out_off_shooter', 'out_off_blocker'];
  const selectedOutcome = weightedRandomChoice(outcomes, probabilities);

  // Build debug info
  const debugInfo: BlockOutcomeInfo = {
    defenderControlComposite: Math.round(defenderControl * 100) / 100,
    shooterRecoverComposite: Math.round(shooterRecover * 100) / 100,
    defenderAggressionComposite: Math.round(defenderAggression * 100) / 100,
    shooterRedirectComposite: Math.round(shooterRedirect * 100) / 100,
    staysInPlayProbability: Math.round(probabilities[0] * 10000) / 10000,
    outOffShooterProbability: Math.round(probabilities[1] * 10000) / 10000,
    outOffBlockerProbability: Math.round(probabilities[2] * 10000) / 10000,
    selectedOutcome: selectedOutcome
  };

  return [selectedOutcome, debugInfo];
}

/**
 * Block check result
 */
export interface BlockCheckResult {
  blocked: boolean;
  blockingPlayer: string;
  blockProbability: number;
  baseBlockRate: number;
  defenderComposite: number;
  shooterComposite: number;
  attributeDiff: number;
  distanceModifier: number;
  rollValue: number;
  blockOutcome: string;
  blockOutcomeDebug: BlockOutcomeInfo;
}

/**
 * Determine if defender blocks the shot.
 *
 * @param shooter - Shooter player object
 * @param defender - Contesting defender player object
 * @param shotType - Shot type string ('3pt', 'midrange', 'dunk', 'layup', etc.)
 * @param contestDistance - How far defender is from shooter (feet)
 * @returns Block info if block occurred, null otherwise
 */
export function checkForBlock(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  shotType: string,
  contestDistance: number
): BlockCheckResult | null {
  // Step 1: Check distance eligibility
  if (contestDistance >= BLOCK_DISTANCE_THRESHOLD_FAR) {
    return null;
  }

  // Step 2: Get base block rate for shot type
  const baseBlockRate = (BLOCK_BASE_RATES as any)[shotType] ?? 0.0;

  if (baseBlockRate === 0.0) {
    return null;
  }

  // Step 3: Calculate composites
  const defenderBlockComposite = calculateComposite(defender, WEIGHTS_BLOCK_DEFENDER);
  const shooterAvoidComposite = calculateComposite(shooter, WEIGHTS_BLOCK_SHOOTER);

  // Step 4: Calculate attribute differential
  const attributeDiff = defenderBlockComposite - shooterAvoidComposite;

  // Step 5: Calculate block probability
  const attributeModifier = 1.0 + (attributeDiff / 100.0) * 1.0;
  let blockProbability = baseBlockRate * attributeModifier;

  // Step 6: Apply distance modifier
  let distanceModifier: number;
  if (contestDistance >= BLOCK_DISTANCE_THRESHOLD_MID) {
    distanceModifier = 0.5;
  } else {
    distanceModifier = 1.0;
  }

  const finalBlockProbability = Math.max(0.0, Math.min(1.0, blockProbability * distanceModifier));

  // Step 7: Roll for block
  const rollValue = Math.random();
  const blockOccurred = rollValue < finalBlockProbability;

  if (!blockOccurred) {
    return null;
  }

  // Block occurred! Determine outcome
  const [blockOutcome, blockOutcomeDebug] = determineBlockOutcome(shooter, defender, shotType);

  return {
    blocked: true,
    blockingPlayer: (defender as any).name || 'Unknown',
    blockProbability: Math.round(finalBlockProbability * 10000) / 10000,
    baseBlockRate: baseBlockRate,
    defenderComposite: Math.round(defenderBlockComposite * 100) / 100,
    shooterComposite: Math.round(shooterAvoidComposite * 100) / 100,
    attributeDiff: Math.round(attributeDiff * 100) / 100,
    distanceModifier: distanceModifier,
    rollValue: Math.round(rollValue * 10000) / 10000,
    blockOutcome: blockOutcome,
    blockOutcomeDebug: blockOutcomeDebug
  };
}

// =============================================================================
// DUNK VS LAYUP SELECTION
// =============================================================================

/**
 * Determine if rim attempt is a dunk or layup.
 *
 * @param shooter - Shooter player object
 * @returns 'dunk' or 'layup'
 */
export function determineRimAttemptType(shooter: Record<string, number>): string {
  const dunkComposite = calculateComposite(shooter, WEIGHTS_DUNK);
  const height = shooter.height ?? 50;
  const jumping = shooter.jumping ?? 50;

  // Can only dunk if physically capable
  if (dunkComposite > 62 && (height >= 60 || jumping >= 65)) {
    return 'dunk';
  } else {
    return 'layup';
  }
}

// =============================================================================
// SHOT ATTEMPT DEBUG INFO
// =============================================================================

/**
 * Shot attempt debug info
 */
export interface ShotDebugInfo {
  shotType: string;
  shooterName: string;
  defenderName: string;
  shooterComposite: number;
  defenderComposite: number;
  attributeDiff: number;
  baseRate: number;
  baseSuccess: number;
  contestDistance: number;
  contestPenalty: number;
  transitionBonus: number;
  speedBonus: number;
  finalSuccessRate: number;
  rollValue: number;
  result: string;
  defenseType: string;
  outcome?: string;
  blockInfo?: BlockCheckResult;
  blockingPlayer?: string;
  blockOutcome?: string;
  shotDetail?: string;
}

// =============================================================================
// THREE-POINT SHOT
// =============================================================================

/**
 * Simulate 3PT shot attempt with two-stage calculation.
 *
 * @param shooter - Shooter player object
 * @param defender - Contest defender player object
 * @param contestDistance - Defender distance in feet
 * @param possessionContext - Current possession context
 * @param defenseType - 'man' or 'zone'
 * @returns [success: boolean, debug_info: ShotDebugInfo]
 */
export function attempt3ptShot(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  contestDistance: number,
  possessionContext: PossessionContext,
  defenseType: string = 'man'
): [boolean, ShotDebugInfo] {
  // Stage 1: Calculate base success (uncontested)
  const shooterComposite = calculateComposite(shooter, WEIGHTS_3PT);
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
  const attributeDiff = shooterComposite - defenderComposite;

  // Base success using weighted sigmoid
  const baseSuccess = weightedSigmoidProbability(
    BASE_RATE_3PT,
    attributeDiff,
    SIGMOID_K
  );

  // Stage 2: Apply contest penalty
  const contestPenalty = calculateContestPenalty(
    contestDistance,
    defenderComposite,
    '3pt',
    defenseType,
    shooter
  );

  // Calculate final success rate
  let finalSuccess = baseSuccess + contestPenalty;

  // Apply transition bonus if applicable
  let transitionBonus = 0.0;
  let speedBonus = 0.0;
  if (possessionContext.isTransition) {
    transitionBonus = TRANSITION_BONUS_3PT;

    // PHASE 1: Speed attributes enhance transition 3PT attempts
    const speedComposite = calculateComposite(shooter, WEIGHTS_TRANSITION_SUCCESS);
    speedBonus = (speedComposite - 50) * 0.0008;

    finalSuccess += transitionBonus + speedBonus;
  }

  // M4.6: Apply rubber band modifier
  const teamIsTrailing = possessionContext.scoreDifferential < 0;
  const rubberBandModifier = calculateRubberBandModifier(
    Math.abs(possessionContext.scoreDifferential),
    teamIsTrailing
  );
  finalSuccess += rubberBandModifier;

  // Clamp to [0, 1]
  finalSuccess = Math.max(0.0, Math.min(1.0, finalSuccess));

  // PHASE 3D: Apply consistency variance
  finalSuccess = applyConsistencyVariance(finalSuccess, shooter, '3pt_shot');

  // Roll for success
  const rollValue = Math.random();
  const success = rollValue < finalSuccess;

  // Build debug info
  const debugInfo: ShotDebugInfo = {
    shotType: '3pt',
    shooterName: (shooter as any).name || 'Unknown',
    defenderName: (defender as any).name || 'Unknown',
    shooterComposite: Math.round(shooterComposite * 100) / 100,
    defenderComposite: Math.round(defenderComposite * 100) / 100,
    attributeDiff: Math.round(attributeDiff * 100) / 100,
    baseRate: BASE_RATE_3PT,
    baseSuccess: Math.round(baseSuccess * 10000) / 10000,
    contestDistance: Math.round(contestDistance * 100) / 100,
    contestPenalty: Math.round(contestPenalty * 10000) / 10000,
    transitionBonus: Math.round(transitionBonus * 10000) / 10000,
    speedBonus: Math.round(speedBonus * 10000) / 10000,
    finalSuccessRate: Math.round(finalSuccess * 10000) / 10000,
    rollValue: Math.round(rollValue * 10000) / 10000,
    result: success ? 'make' : 'miss',
    defenseType: defenseType,
  };

  return [success, debugInfo];
}

// =============================================================================
// MIDRANGE SHOT
// =============================================================================

/**
 * Simulate midrange shot attempt.
 *
 * @param shooter - Shooter player object
 * @param defender - Contest defender player object
 * @param contestDistance - Defender distance in feet
 * @param possessionContext - Current possession context
 * @param rangeType - 'short' or 'long'
 * @param defenseType - 'man' or 'zone'
 * @returns [success: boolean, debug_info: ShotDebugInfo]
 */
export function attemptMidrangeShot(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  contestDistance: number,
  possessionContext: PossessionContext,
  rangeType: string = 'short',
  defenseType: string = 'man'
): [boolean, ShotDebugInfo] {
  // Determine base rate by range
  const baseRate = rangeType === 'short' ? BASE_RATE_MIDRANGE_SHORT : BASE_RATE_MIDRANGE_LONG;

  // Stage 1: Calculate base success
  const shooterComposite = calculateComposite(shooter, WEIGHTS_MIDRANGE);
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
  const attributeDiff = shooterComposite - defenderComposite;

  const baseSuccess = weightedSigmoidProbability(baseRate, attributeDiff, SIGMOID_K);

  // Stage 2: Apply contest penalty
  const contestPenalty = calculateContestPenalty(
    contestDistance,
    defenderComposite,
    `midrange_${rangeType}`,
    defenseType,
    shooter
  );

  // Calculate final success rate
  let finalSuccess = baseSuccess + contestPenalty;

  // Apply transition bonus if applicable
  let transitionBonus = 0.0;
  let speedBonus = 0.0;
  if (possessionContext.isTransition) {
    transitionBonus = TRANSITION_BONUS_MIDRANGE;

    // PHASE 1: Speed attributes enhance transition midrange attempts
    const speedComposite = calculateComposite(shooter, WEIGHTS_TRANSITION_SUCCESS);
    speedBonus = (speedComposite - 50) * 0.001;

    finalSuccess += transitionBonus + speedBonus;
  }

  // M4.6: Apply rubber band modifier
  const teamIsTrailing = possessionContext.scoreDifferential < 0;
  const rubberBandModifier = calculateRubberBandModifier(
    Math.abs(possessionContext.scoreDifferential),
    teamIsTrailing
  );
  finalSuccess += rubberBandModifier;

  // Clamp to [0, 1]
  finalSuccess = Math.max(0.0, Math.min(1.0, finalSuccess));

  // PHASE 3D: Apply consistency variance
  finalSuccess = applyConsistencyVariance(finalSuccess, shooter, 'midrange_shot');

  // Roll for success
  const rollValue = Math.random();
  const success = rollValue < finalSuccess;

  // Build debug info
  const debugInfo: ShotDebugInfo = {
    shotType: `midrange_${rangeType}`,
    shooterName: (shooter as any).name || 'Unknown',
    defenderName: (defender as any).name || 'Unknown',
    shooterComposite: Math.round(shooterComposite * 100) / 100,
    defenderComposite: Math.round(defenderComposite * 100) / 100,
    attributeDiff: Math.round(attributeDiff * 100) / 100,
    baseRate: baseRate,
    baseSuccess: Math.round(baseSuccess * 10000) / 10000,
    contestDistance: Math.round(contestDistance * 100) / 100,
    contestPenalty: Math.round(contestPenalty * 10000) / 10000,
    transitionBonus: Math.round(transitionBonus * 10000) / 10000,
    speedBonus: Math.round(speedBonus * 10000) / 10000,
    finalSuccessRate: Math.round(finalSuccess * 10000) / 10000,
    rollValue: Math.round(rollValue * 10000) / 10000,
    result: success ? 'make' : 'miss',
    defenseType: defenseType,
  };

  return [success, debugInfo];
}

// =============================================================================
// RIM ATTEMPT (DUNK OR LAYUP)
// =============================================================================

/**
 * Simulate rim attempt (dunk or layup).
 *
 * @param shooter - Shooter player object
 * @param defender - Contest defender player object
 * @param contestDistance - Defender distance in feet
 * @param possessionContext - Current possession context
 * @param attemptType - 'dunk' or 'layup' (null = auto-determine)
 * @param defenseType - 'man' or 'zone'
 * @returns [success: boolean, debug_info: ShotDebugInfo]
 */
export function attemptRimShot(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  contestDistance: number,
  possessionContext: PossessionContext,
  attemptType?: string,
  defenseType: string = 'man'
): [boolean, ShotDebugInfo] {
  // Auto-determine dunk vs layup if not specified
  const finalAttemptType = attemptType || determineRimAttemptType(shooter);

  // Select appropriate weights and base rate
  const weights = finalAttemptType === 'dunk' ? WEIGHTS_DUNK : WEIGHTS_LAYUP;
  const baseRate = finalAttemptType === 'dunk' ? BASE_RATE_DUNK : BASE_RATE_LAYUP;

  // Stage 1: Calculate base success
  const shooterComposite = calculateComposite(shooter, weights);
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
  const attributeDiff = shooterComposite - defenderComposite;

  const baseSuccess = weightedSigmoidProbability(baseRate, attributeDiff, SIGMOID_K);

  // Stage 2: Apply contest penalty
  const contestPenalty = calculateContestPenalty(
    contestDistance,
    defenderComposite,
    finalAttemptType,
    defenseType,
    shooter
  );

  // Calculate final success rate
  let finalSuccess = baseSuccess + contestPenalty;

  // Apply transition bonus if applicable
  let transitionBonus = 0.0;
  let speedBonus = 0.0;
  if (possessionContext.isTransition) {
    transitionBonus = TRANSITION_BONUS_RIM;

    // PHASE 1: Speed attributes enhance transition effectiveness
    const speedComposite = calculateComposite(shooter, WEIGHTS_TRANSITION_SUCCESS);
    speedBonus = (speedComposite - 50) * 0.0015;

    finalSuccess += transitionBonus + speedBonus;
  }

  // M4.6: Apply rubber band modifier
  const teamIsTrailing = possessionContext.scoreDifferential < 0;
  const rubberBandModifier = calculateRubberBandModifier(
    Math.abs(possessionContext.scoreDifferential),
    teamIsTrailing
  );
  finalSuccess += rubberBandModifier;

  // Clamp to [0, 1]
  finalSuccess = Math.max(0.0, Math.min(1.0, finalSuccess));

  // PHASE 3D: Apply consistency variance
  finalSuccess = applyConsistencyVariance(finalSuccess, shooter, 'rim_shot');

  // Roll for success
  const rollValue = Math.random();
  const success = rollValue < finalSuccess;

  // Build debug info
  const debugInfo: ShotDebugInfo = {
    shotType: finalAttemptType,
    shooterName: (shooter as any).name || 'Unknown',
    defenderName: (defender as any).name || 'Unknown',
    shooterComposite: Math.round(shooterComposite * 100) / 100,
    defenderComposite: Math.round(defenderComposite * 100) / 100,
    attributeDiff: Math.round(attributeDiff * 100) / 100,
    baseRate: baseRate,
    baseSuccess: Math.round(baseSuccess * 10000) / 10000,
    contestDistance: Math.round(contestDistance * 100) / 100,
    contestPenalty: Math.round(contestPenalty * 10000) / 10000,
    transitionBonus: Math.round(transitionBonus * 10000) / 10000,
    speedBonus: Math.round(speedBonus * 10000) / 10000,
    finalSuccessRate: Math.round(finalSuccess * 10000) / 10000,
    rollValue: Math.round(rollValue * 10000) / 10000,
    result: success ? 'make' : 'miss',
    defenseType: defenseType,
  };

  return [success, debugInfo];
}

// =============================================================================
// UNIFIED SHOT ATTEMPT INTERFACE
// =============================================================================

/**
 * Unified interface for all shot attempts.
 *
 * Routes to appropriate shot function based on shot_type.
 * Also checks for blocks BEFORE shot attempt.
 *
 * @param shooter - Shooter player object
 * @param defender - Contest defender player object
 * @param shotType - '3pt', 'midrange', or 'rim'
 * @param contestDistance - Defender distance in feet
 * @param possessionContext - Current possession context
 * @param defenseType - 'man' or 'zone'
 * @returns [success: boolean, debug_info: ShotDebugInfo]
 */
export function attemptShot(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  shotType: string,
  contestDistance: number,
  possessionContext: PossessionContext,
  defenseType: string = 'man'
): [boolean, ShotDebugInfo] {
  // Determine specific shot detail for rim attempts (needed for block check)
  let shotDetail = shotType;
  if (shotType === 'rim') {
    shotDetail = determineRimAttemptType(shooter);
  }

  // CRITICAL: Check for block BEFORE shot attempt
  const blockResult = checkForBlock(shooter, defender, shotDetail, contestDistance);

  if (blockResult) {
    // Shot was blocked!
    // Calculate attribute composites for tracking even though shot was blocked
    let shooterComposite: number;
    let defenderComposite: number;

    if (shotType === '3pt') {
      shooterComposite = calculateComposite(shooter, WEIGHTS_3PT);
      defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
    } else if (shotType === 'midrange') {
      shooterComposite = calculateComposite(shooter, WEIGHTS_MIDRANGE);
      defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
    } else if (shotType === 'rim') {
      if (shotDetail === 'dunk') {
        shooterComposite = calculateComposite(shooter, WEIGHTS_DUNK);
      } else {
        shooterComposite = calculateComposite(shooter, WEIGHTS_LAYUP);
      }
      defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
    } else {
      shooterComposite = 50.0;
      defenderComposite = 50.0;
    }

    const attributeDiff = shooterComposite - defenderComposite;

    // Return as a "miss" with special outcome flag
    const debugInfo: ShotDebugInfo = {
      shotType: shotType,
      shotDetail: shotDetail,
      shooterName: (shooter as any).name || 'Unknown',
      defenderName: (defender as any).name || 'Unknown',
      shooterComposite: Math.round(shooterComposite * 100) / 100,
      defenderComposite: Math.round(defenderComposite * 100) / 100,
      attributeDiff: Math.round(attributeDiff * 100) / 100,
      contestDistance: Math.round(contestDistance * 100) / 100,
      defenseType: defenseType,
      outcome: 'blocked_shot',
      blockInfo: blockResult,
      blockingPlayer: blockResult.blockingPlayer,
      blockOutcome: blockResult.blockOutcome,
      result: 'blocked',
      baseRate: 0,
      baseSuccess: 0,
      contestPenalty: 0,
      transitionBonus: 0,
      speedBonus: 0,
      finalSuccessRate: 0,
      rollValue: 0,
    };

    return [false, debugInfo];
  }

  // No block - proceed with normal shot attempt
  if (shotType === '3pt') {
    return attempt3ptShot(shooter, defender, contestDistance, possessionContext, defenseType);
  } else if (shotType === 'midrange') {
    // Randomly choose short vs long
    const rangeType = Math.random() < 0.5 ? 'short' : 'long';
    return attemptMidrangeShot(shooter, defender, contestDistance, possessionContext, rangeType, defenseType);
  } else if (shotType === 'rim') {
    return attemptRimShot(shooter, defender, contestDistance, possessionContext, shotDetail, defenseType);
  } else {
    throw new Error(`Invalid shot_type: ${shotType}`);
  }
}

// =============================================================================
// CONTEST DISTANCE SIMULATION
// =============================================================================

/**
 * Simulate how close defender gets to contest the shot.
 *
 * @param shooter - Shooter player object (not used in M1, future: speed affects separation)
 * @param defender - Defender player object
 * @returns Distance in feet (0.5-10.0)
 */
export function simulateContestDistance(
  shooter: Record<string, number>,
  defender: Record<string, number>
): number {
  // Calculate defender's contest ability
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);

  // Base distance: 4.0 ft (contested)
  let baseDistance = 4.0;

  // Adjust by defender composite
  const compositeAdjustment = (defenderComposite - 50) * 0.05;
  let distance = baseDistance - compositeAdjustment;

  // Add randomness (±1.0 ft)
  const randomness = (Math.random() * 2) - 1.0;
  distance += randomness;

  // Clamp to valid range
  distance = Math.max(0.5, Math.min(10.0, distance));

  return distance;
}
