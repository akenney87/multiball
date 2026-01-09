/**
 * Baseball At-Bat Orchestration
 *
 * Orchestrates a complete at-bat by combining batting, pitching,
 * fielding, and baserunning systems.
 *
 * @module simulation/baseball/systems/atBat
 */

import type { Player } from '../../../data/types';
import type { BaseState, AtBatResult, AtBatOutcome, HitLocation, BattingStrategy, ReachedBaseVia, RunnerOrigin } from '../types';
import { DEFAULT_BATTING_STRATEGY } from '../types';
import {
  determineAtBatOutcome,
  determineHitType,
  determineBallInPlayResult,
  hasPlatoonAdvantage,
  calculateContactComposite,
  calculatePowerComposite,
  calculateDisciplineComposite,
  type BattingContext,
} from './batting';
import {
  getFatiguedComposites,
  estimateAtBatPitchCount,
} from './pitching';
import {
  checkForError,
  attemptDoublePlay,
  attemptTriplePlay,
  generateHitLocation,
  getResponsibleFielder,
  calculateFieldingComposite,
  calculateArmComposite,
  type FieldingPosition,
} from './fielding';
import {
  calculateBaseAdvancement,
  advanceOnWalk,
  calculateSpeedComposite,
} from './baserunning';
import {
  BASE_RATE_GROUNDOUT,
  BASE_RATE_FLYOUT,
  BASE_RATE_LINEOUT,
  BASE_RATE_POPUP,
  CLUTCH_SITUATION_THRESHOLD,
  GROUNDOUT_SCORE_FROM_THIRD,
  GROUNDOUT_ADVANCE_FROM_SECOND,
  TAGUP_SCORE_FROM_THIRD,
  TAGUP_ADVANCE_FROM_SECOND,
  TAGUP_ATTEMPT_FROM_THIRD,
  TAGUP_ATTEMPT_FROM_SECOND,
  FAILURE_TO_TAG_RATE,
  DP_THROW_HOME_BASE_RATE,
  DP_THROW_HOME_SUCCESS,
  DP_RUNNER_SCORES_IF_SURE_DP,
  SIGMOID_K,
} from '../constants';
import { weightedRandomChoice, rollSuccess, weightedSigmoidProbability } from '../../core/probability';

// =============================================================================
// TYPES
// =============================================================================

export interface AtBatInput {
  /** Batter at the plate */
  batter: Player;
  /** Current pitcher */
  pitcher: Player;
  /** Catcher */
  catcher: Player;
  /** Defensive players by position */
  defense: Record<FieldingPosition, Player>;
  /** Current base state */
  baseState: BaseState;
  /** Current pitch count for pitcher */
  pitchCount: number;
  /** Current outs */
  outs: number;
  /** Current inning */
  inning: number;
  /** Score differential (positive = batting team ahead) */
  scoreDiff: number;
  /** Optional batting strategy for modifiers */
  battingStrategy?: BattingStrategy;
  /** Runner origin tracking (player ID -> origin info) for earned run and inherited runner calculation */
  runnerOrigins?: Record<string, RunnerOrigin>;
}

export interface AtBatOutput {
  /** Complete at-bat result */
  result: AtBatResult;
  /** Updated base state */
  newBaseState: BaseState;
  /** Updated outs */
  newOuts: number;
  /** Pitches thrown this at-bat */
  pitchesThrown: number;
  /** Whether inning is over (3 outs reached) */
  inningOver: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine if this is a clutch situation
 */
function isClutchSituation(inning: number, scoreDiff: number): boolean {
  return (
    inning >= CLUTCH_SITUATION_THRESHOLD.minInning &&
    Math.abs(scoreDiff) <= CLUTCH_SITUATION_THRESHOLD.maxRunDifferential
  );
}

/**
 * Result of calculating runs charged to pitchers
 */
interface RunsChargedResult {
  /** Total earned runs */
  earnedRuns: number;
  /** Players who scored earned runs */
  earnedScoringRunners: Player[];
  /** Runs charged to each pitcher (by pitcher ID) */
  runsChargedByPitcher: Record<string, number>;
  /** Earned runs charged to each pitcher (by pitcher ID) */
  earnedRunsChargedByPitcher: Record<string, number>;
}

/**
 * Calculate earned runs from scoring runners and attribute runs to responsible pitchers
 *
 * This handles inherited runners: if a reliever inherits a runner who scores,
 * the run is charged to the pitcher who originally allowed that runner.
 *
 * @param scoringRunners - Players who scored
 * @param runnerOrigins - Map of player ID to runner origin info (how they reached and responsible pitcher)
 * @param currentPitcherId - The current pitcher's ID (used for batters who score, e.g., on home run)
 * @param isErrorPlay - Whether this at-bat was an error (all runs on error plays are unearned)
 * @returns Object with earned runs, runs charged per pitcher, etc.
 */
function calculateRunsCharged(
  scoringRunners: Player[],
  runnerOrigins: Record<string, RunnerOrigin> = {},
  currentPitcherId: string,
  isErrorPlay: boolean = false
): RunsChargedResult {
  const runsChargedByPitcher: Record<string, number> = {};
  const earnedRunsChargedByPitcher: Record<string, number> = {};
  const earnedScoringRunners: Player[] = [];

  for (const runner of scoringRunners) {
    const origin = runnerOrigins[runner.id];

    // Determine which pitcher is responsible for this runner
    // If we have origin info, use the responsible pitcher; otherwise, it's the current pitcher
    const responsiblePitcherId = origin?.responsiblePitcherId ?? currentPitcherId;

    // Charge the run to the responsible pitcher
    runsChargedByPitcher[responsiblePitcherId] = (runsChargedByPitcher[responsiblePitcherId] ?? 0) + 1;

    // Check if this is an earned run (not on error play and runner didn't reach on error)
    const isEarned = !isErrorPlay && origin?.reachedVia !== 'error';

    if (isEarned) {
      earnedScoringRunners.push(runner);
      earnedRunsChargedByPitcher[responsiblePitcherId] = (earnedRunsChargedByPitcher[responsiblePitcherId] ?? 0) + 1;
    }
  }

  return {
    earnedRuns: earnedScoringRunners.length,
    earnedScoringRunners,
    runsChargedByPitcher,
    earnedRunsChargedByPitcher,
  };
}

/**
 * Determine out type when ball in play results in out
 */
function determineOutType(): 'groundout' | 'flyout' | 'lineout' | 'popup' {
  const types: ('groundout' | 'flyout' | 'lineout' | 'popup')[] = [
    'groundout', 'flyout', 'lineout', 'popup'
  ];
  const weights = [
    BASE_RATE_GROUNDOUT,
    BASE_RATE_FLYOUT,
    BASE_RATE_LINEOUT,
    BASE_RATE_POPUP,
  ];
  return weightedRandomChoice(types, weights);
}

/**
 * Format runs scored text with proper grammar
 */
function formatRunsScored(runsScored: number): string {
  if (runsScored === 1) {
    return ' 1 run scores.';
  }
  return ` ${runsScored} runs score.`;
}

/**
 * Map location to infielder position name (for groundouts/popups)
 * Returns only infield positions since groundouts can't go to outfield
 */
function getInfielderName(location: HitLocation): string {
  const infieldMap: Record<HitLocation, string> = {
    shortstop_hole: 'shortstop',
    up_the_middle: 'second baseman',
    third_base_line: 'third baseman',
    first_base_line: 'first baseman',
    left_line: 'third baseman',
    right_line: 'first baseman',
    // Outfield locations get mapped to nearest infielder
    left_field: 'shortstop',
    center_field: 'second baseman',
    right_field: 'first baseman',
  };
  return infieldMap[location] || 'shortstop';
}

/**
 * Map location to fielder position name for lineouts (can be anywhere)
 */
function getFielderName(location: HitLocation): string {
  const fielderMap: Record<HitLocation, string> = {
    left_field: 'left fielder',
    center_field: 'center fielder',
    right_field: 'right fielder',
    left_line: 'third baseman',
    right_line: 'first baseman',
    shortstop_hole: 'shortstop',
    up_the_middle: 'second baseman',
    third_base_line: 'third baseman',
    first_base_line: 'first baseman',
  };
  return fielderMap[location] || 'fielder';
}

/**
 * Convert fielding position code to readable position name
 */
function getPositionName(position: FieldingPosition): string {
  const positionMap: Record<FieldingPosition, string> = {
    'P': 'pitcher',
    'C': 'catcher',
    '1B': 'first baseman',
    '2B': 'second baseman',
    '3B': 'third baseman',
    'SS': 'shortstop',
    'LF': 'left fielder',
    'CF': 'center fielder',
    'RF': 'right fielder',
  };
  return positionMap[position] || position;
}

/**
 * Get outfield location name for fly outs
 */
function getOutfieldLocation(location: HitLocation): string {
  const outfieldLocations: Record<string, string> = {
    left_field: 'left field',
    center_field: 'center field',
    right_field: 'right field',
    left_line: 'left field',  // Foul line catches go to corner outfielder
    right_line: 'right field',
  };
  // For infield locations, fly ball goes to nearest outfielder
  const infieldToOutfield: Record<string, string> = {
    shortstop_hole: 'left field',
    up_the_middle: 'center field',
    third_base_line: 'left field',
    first_base_line: 'right field',
  };
  return outfieldLocations[location] || infieldToOutfield[location] || 'center field';
}

/**
 * Format hit location with proper grammar for singles
 * Maps locations to natural descriptions
 */
function formatHitLocation(location: HitLocation): string {
  // Map to natural field descriptions for hits
  const locationMap: Record<HitLocation, string> = {
    left_field: 'to left field',
    center_field: 'to center field',
    right_field: 'to right field',
    left_line: 'to left field',      // Down the left field line
    right_line: 'to right field',    // Down the right field line
    shortstop_hole: 'through the hole at short',
    up_the_middle: 'up the middle',  // No "to" prefix
    third_base_line: 'down the third base line',
    first_base_line: 'down the first base line',
  };
  return ' ' + (locationMap[location] || location.replace(/_/g, ' '));
}

/**
 * Format hit location for extra-base hits (doubles/triples)
 * Infield locations are converted to appropriate gap descriptions since
 * balls through the infield holes can only be singles.
 */
function formatExtraBaseHitLocation(location: HitLocation): string {
  // Extra-base hits go to outfield gaps or down the lines
  const extraBaseLocationMap: Record<HitLocation, string> = {
    left_field: 'to the left-center gap',
    center_field: 'to deep center field',
    right_field: 'to the right-center gap',
    left_line: 'down the left field line',
    right_line: 'down the right field line',
    // Infield locations get remapped to outfield gaps
    // (a ball through the hole can't be a double)
    shortstop_hole: 'to the left-center gap',
    up_the_middle: 'to deep center field',
    third_base_line: 'down the left field line',
    first_base_line: 'down the right field line',
  };
  return ' ' + (extraBaseLocationMap[location] || 'to the gap');
}

/**
 * Strikeout details for play-by-play
 */
interface StrikeoutDetails {
  /** Whether the batter struck out looking (called third strike) vs swinging */
  looking: boolean;
}

/**
 * Fielder's choice details for play-by-play
 */
interface FieldersChoiceDetails {
  /** The runner who was thrown out */
  runnerOut: Player;
  /** The base where the runner was thrown out (2 = second, 3 = third, 4 = home) */
  baseOut: 2 | 3 | 4;
}

/**
 * Get base name for display
 */
function getBaseName(base: 2 | 3 | 4): string {
  switch (base) {
    case 2: return 'second';
    case 3: return 'third';
    case 4: return 'home';
  }
}

/**
 * Generate play-by-play text for an at-bat
 */
function generatePlayByPlayText(
  batter: Player,
  outcome: AtBatOutcome,
  location?: HitLocation,
  runsScored?: number,
  errorFielder?: Player,
  errorPosition?: string,
  strikeoutDetails?: StrikeoutDetails,
  fieldersChoiceDetails?: FieldersChoiceDetails
): string {
  const batterName = batter.name;
  const runsText = runsScored && runsScored > 0 ? formatRunsScored(runsScored) : '';

  switch (outcome) {
    case 'strikeout':
      if (strikeoutDetails?.looking) {
        return `${batterName} strikes out looking.`;
      }
      return `${batterName} strikes out swinging.`;
    case 'walk':
      return `${batterName} draws a walk.${runsText}`;
    case 'hit_by_pitch':
      return `${batterName} is hit by a pitch.${runsText}`;
    case 'single':
      return `${batterName} singles${location ? formatHitLocation(location) : ''}.${runsText}`;
    case 'double':
      return `${batterName} doubles${location ? formatExtraBaseHitLocation(location) : ''}.${runsText}`;
    case 'triple':
      return `${batterName} triples${location ? formatExtraBaseHitLocation(location) : ''}.${runsText}`;
    case 'home_run':
      return `${batterName} hits a home run!${runsScored && runsScored > 1 ? formatRunsScored(runsScored) : ''}`;
    case 'groundout':
      // Ground outs go to infielders only
      return `${batterName} grounds out to the ${location ? getInfielderName(location) : 'shortstop'}.${runsText}`;
    case 'flyout':
      // Fly outs go to outfielders only (sac fly if run scores)
      return `${batterName} flies out to ${location ? getOutfieldLocation(location) : 'center field'}.${runsText}`;
    case 'lineout':
      // Line outs can go to any fielder
      return `${batterName} lines out to the ${location ? getFielderName(location) : 'shortstop'}.${runsText}`;
    case 'popup':
      // Popups are caught by infielders only
      return `${batterName} pops out to the ${location ? getInfielderName(location) : 'catcher'}.${runsText}`;
    case 'error':
      if (errorFielder && errorPosition) {
        return `${batterName} reaches on an error by ${errorPosition} ${errorFielder.name}.${runsText}`;
      }
      return `${batterName} reaches on an error.${runsText}`;
    case 'fielders_choice':
      if (fieldersChoiceDetails) {
        const runnerName = fieldersChoiceDetails.runnerOut.name;
        const baseName = getBaseName(fieldersChoiceDetails.baseOut);
        return `${batterName} reaches on a fielder's choice. ${runnerName} is thrown out at ${baseName}.${runsText}`;
      }
      return `${batterName} reaches on a fielder's choice.${runsText}`;
    case 'double_play':
      return `${batterName} grounds into a double play.`;
    default:
      return `${batterName} completes at-bat.`;
  }
}

// =============================================================================
// MAIN AT-BAT SIMULATION
// =============================================================================

/**
 * Simulate a complete at-bat
 *
 * This is the main entry point for at-bat simulation.
 * It orchestrates batting vs pitching, then handles ball-in-play outcomes.
 *
 * @param input - At-bat input parameters
 * @returns Complete at-bat output
 */
export function simulateAtBat(input: AtBatInput): AtBatOutput {
  const {
    batter,
    pitcher,
    // catcher is available for future wild pitch/passed ball implementation
    defense,
    baseState,
    pitchCount,
    outs,
    inning,
    scoreDiff,
    battingStrategy = DEFAULT_BATTING_STRATEGY,
    runnerOrigins = {},
  } = input;

  // Determine if clutch situation
  const isClutch = isClutchSituation(inning, scoreDiff);

  // Get fatigued pitcher composites
  const pitcherComposites = getFatiguedComposites(pitcher, pitchCount);

  // Create batting context
  const battingContext: BattingContext = {
    isClutch,
    inning,
    outs,
    runnersOn: [baseState[0] !== null, baseState[1] !== null, baseState[2] !== null],
  };

  // Estimate pitches for this at-bat
  const disciplineComposite = calculateDisciplineComposite(batter);
  const pitchesThrown = estimateAtBatPitchCount(disciplineComposite, pitcherComposites.control);

  // Determine initial at-bat outcome (K, BB, HBP, or ball in play)
  const battingResult = determineAtBatOutcome(
    batter,
    pitcher,
    pitcherComposites.velocityMovement,
    pitcherComposites.control,
    battingContext,
    battingStrategy
  );

  // Track debug info
  const debugInfo = {
    batterContact: calculateContactComposite(batter),
    batterPower: calculatePowerComposite(batter),
    batterDiscipline: disciplineComposite,
    pitcherVelocity: pitcherComposites.velocity,
    pitcherControl: pitcherComposites.control,
    pitcherMovement: pitcherComposites.movement,
    platoonAdvantage: hasPlatoonAdvantage(batter, pitcher),
    clutchSituation: isClutch,
    pitcherFatigue: pitcherComposites.fatigueState.degradation,
  };

  // Handle non-ball-in-play outcomes
  if (battingResult.outcome === 'strikeout') {
    // Determine if strikeout looking vs swinging
    // Higher discipline = more likely to go down looking (don't chase bad pitches)
    // Base rate ~25% looking, modified by discipline
    const lookingBaseRate = 0.25;
    const disciplineModifier = (disciplineComposite - 50) / 200; // +/-0.25 adjustment
    const lookingProbability = Math.max(0.10, Math.min(0.45, lookingBaseRate + disciplineModifier));
    const isLooking = rollSuccess(lookingProbability);

    const result: AtBatResult = {
      outcome: 'strikeout',
      batter,
      pitcher,
      runsScored: 0,
      earnedRunsScored: 0,
      rbi: 0,
      scoringRunners: [],
      earnedScoringRunners: [],
      runsChargedByPitcher: {},
      earnedRunsChargedByPitcher: {},
      isError: false,
      baseAdvancement: { first: baseState[0], second: baseState[1], third: baseState[2] },
      outsRecorded: 1,
      playByPlayText: generatePlayByPlayText(batter, 'strikeout', undefined, undefined, undefined, undefined, { looking: isLooking }),
      debugInfo,
    };

    return {
      result,
      newBaseState: baseState,
      newOuts: outs + 1,
      pitchesThrown,
      inningOver: outs + 1 >= 3,
    };
  }

  if (battingResult.outcome === 'walk' || battingResult.outcome === 'hit_by_pitch') {
    const advancement = advanceOnWalk(baseState, batter);
    const outcome = battingResult.outcome === 'walk' ? 'walk' : 'hit_by_pitch';
    const runsChargedCalc = calculateRunsCharged(advancement.scoringRunners, runnerOrigins, pitcher.id, false);

    const result: AtBatResult = {
      outcome,
      batter,
      pitcher,
      runsScored: advancement.runsScored,
      earnedRunsScored: runsChargedCalc.earnedRuns,
      rbi: advancement.runsScored, // Both walks and HBP can force runners home for RBIs
      scoringRunners: advancement.scoringRunners,
      earnedScoringRunners: runsChargedCalc.earnedScoringRunners,
      runsChargedByPitcher: runsChargedCalc.runsChargedByPitcher,
      earnedRunsChargedByPitcher: runsChargedCalc.earnedRunsChargedByPitcher,
      isError: false,
      baseAdvancement: {
        first: advancement.newBaseState[0],
        second: advancement.newBaseState[1],
        third: advancement.newBaseState[2],
      },
      outsRecorded: 0,
      playByPlayText: generatePlayByPlayText(batter, outcome, undefined, advancement.runsScored),
      debugInfo,
    };

    return {
      result,
      newBaseState: advancement.newBaseState,
      newOuts: outs,
      pitchesThrown,
      inningOver: false,
    };
  }

  // Ball in play - determine if hit or out
  const hitLocation = generateHitLocation();
  const responsiblePosition = getResponsibleFielder(hitLocation);
  const fielder = defense[responsiblePosition];
  const fielderComposite = fielder
    ? calculateFieldingComposite(fielder, responsiblePosition)
    : 50;

  const isHit = determineBallInPlayResult(
    batter,
    pitcherComposites.overall,
    fielderComposite,
    battingContext,
    battingStrategy.swingStyle
  );

  // Check for error (can turn out into safe, or safe into more bases)
  const errorCheck = fielder
    ? checkForError(fielder, responsiblePosition, isHit ? 0 : 0.2)
    : { isError: false, errorType: null, debug: { fieldingComposite: 50, errorProbability: 0, position: 'SS' as FieldingPosition } };

  if (isHit) {
    // It's a hit - determine hit type
    const hitTypeResult = determineHitType(batter, battingResult.debug.platoonAdvantage, battingStrategy.swingStyle);
    const hitType = hitTypeResult.hitType;

    // Calculate base advancement
    const outfielderArm = ['LF', 'CF', 'RF'].includes(responsiblePosition) && fielder
      ? calculateArmComposite(fielder)
      : 50;

    const advancement = calculateBaseAdvancement(baseState, batter, hitType, outfielderArm);

    const outcome: AtBatOutcome = hitType === 'home_run' ? 'home_run'
      : hitType === 'triple' ? 'triple'
      : hitType === 'double' ? 'double'
      : 'single';

    const runsChargedCalc = calculateRunsCharged(advancement.scoringRunners, runnerOrigins, pitcher.id, false);

    const result: AtBatResult = {
      outcome,
      batter,
      pitcher,
      runsScored: advancement.runsScored,
      earnedRunsScored: runsChargedCalc.earnedRuns,
      rbi: advancement.runsScored,
      scoringRunners: advancement.scoringRunners,
      earnedScoringRunners: runsChargedCalc.earnedScoringRunners,
      runsChargedByPitcher: runsChargedCalc.runsChargedByPitcher,
      earnedRunsChargedByPitcher: runsChargedCalc.earnedRunsChargedByPitcher,
      hitLocation,
      isError: false,
      baseAdvancement: {
        first: advancement.newBaseState[0],
        second: advancement.newBaseState[1],
        third: advancement.newBaseState[2],
      },
      outsRecorded: 0,
      playByPlayText: generatePlayByPlayText(batter, outcome, hitLocation, advancement.runsScored),
      debugInfo,
    };

    return {
      result,
      newBaseState: advancement.newBaseState,
      newOuts: outs,
      pitchesThrown,
      inningOver: false,
    };
  }

  // Ball in play resulted in out (or error)
  if (errorCheck.isError) {
    // Error - batter reaches, runners may advance
    // Treat like a single for advancement purposes
    const advancement = calculateBaseAdvancement(baseState, batter, 'single', 50);

    // All runs on error plays are unearned, but still charge to responsible pitcher
    const runsChargedCalc = calculateRunsCharged(advancement.scoringRunners, runnerOrigins, pitcher.id, true);

    const result: AtBatResult = {
      outcome: 'error',
      batter,
      pitcher,
      runsScored: advancement.runsScored,
      earnedRunsScored: 0,
      rbi: 0, // No RBI on error
      scoringRunners: advancement.scoringRunners,
      earnedScoringRunners: [],
      runsChargedByPitcher: runsChargedCalc.runsChargedByPitcher,
      earnedRunsChargedByPitcher: {}, // No earned runs on error
      hitLocation,
      isError: true,
      errorFielder: fielder,
      baseAdvancement: {
        first: advancement.newBaseState[0],
        second: advancement.newBaseState[1],
        third: advancement.newBaseState[2],
      },
      outsRecorded: 0,
      playByPlayText: generatePlayByPlayText(batter, 'error', hitLocation, advancement.runsScored, fielder, getPositionName(responsiblePosition)),
      debugInfo,
    };

    return {
      result,
      newBaseState: advancement.newBaseState,
      newOuts: outs,
      pitchesThrown,
      inningOver: false,
    };
  }

  // Regular out - determine type
  const outType = determineOutType();

  // Check for double/triple play opportunity
  const runnerOnFirst = baseState[0] !== null;
  const runnerOnSecond = baseState[1] !== null;
  const runnerOnThird = baseState[2] !== null;
  const lessThanTwoOuts = outs < 2;
  const isGroundBall = outType === 'groundout';

  if (runnerOnFirst && lessThanTwoOuts && isGroundBall) {
    const ss = defense['SS'];
    const secondBase = defense['2B'];
    const firstBase = defense['1B'];

    if (ss && secondBase && firstBase) {
      const groundBallTo = responsiblePosition as 'SS' | '2B' | '3B' | 'P' | '1B';

      // Check for triple play first (requires 2+ runners, 0 outs)
      const hasTwoOrMoreRunners = (runnerOnFirst ? 1 : 0) + (runnerOnSecond ? 1 : 0) + (runnerOnThird ? 1 : 0) >= 2;
      if (outs === 0 && hasTwoOrMoreRunners && attemptTriplePlay(defense, groundBallTo)) {
        // Triple play!
        const result: AtBatResult = {
          outcome: 'triple_play',
          batter,
          pitcher,
          runsScored: 0,
          earnedRunsScored: 0,
          rbi: 0,
          scoringRunners: [],
          earnedScoringRunners: [],
          runsChargedByPitcher: {},
          earnedRunsChargedByPitcher: {},
          hitLocation,
          isError: false,
          baseAdvancement: { first: null, second: null, third: null },
          outsRecorded: 3,
          playByPlayText: `${batter.name} grounds into a TRIPLE PLAY!`,
          debugInfo,
        };

        return {
          result,
          newBaseState: [null, null, null],
          newOuts: 3,
          pitchesThrown,
          inningOver: true,
        };
      }

      // Attempt double play with batter/runner speed factors
      const dpAttempt = attemptDoublePlay(
        ss, secondBase, firstBase, groundBallTo,
        batter, baseState[0] || undefined
      );

      if (dpAttempt.success) {
        // Double play turned
        // Check for runner on 3rd scoring (0 outs only, bases loaded or 1st & 3rd)
        let runsScored = 0;
        const scoringRunners: Player[] = [];
        let newThird: Player | null = baseState[2];

        if (outs === 0 && runnerOnThird) {
          // With 0 outs, defense must choose: throw home or take sure DP
          if (rollSuccess(DP_THROW_HOME_BASE_RATE)) {
            // Defense throws home first
            if (rollSuccess(DP_THROW_HOME_SUCCESS)) {
              // Runner out at home - still get DP (runner + batter)
              newThird = null;
            } else {
              // Failed to get runner at home, runner scores, only get 1 out on batter
              runsScored = 1;
              scoringRunners.push(baseState[2]!);
              newThird = null;

              // This becomes a fielder's choice with a run scored
              // Defense threw home, runner scored, but got the force at second
              const fcBaseState: BaseState = [batter, baseState[1], null];
              const runnerOnFirstPlayer = baseState[0]!;
              const runnerScored = baseState[2]!;
              const fcRunsChargedCalc = calculateRunsCharged(scoringRunners, runnerOrigins, pitcher.id, false);
              const result: AtBatResult = {
                outcome: 'fielders_choice',
                batter,
                pitcher,
                runsScored,
                earnedRunsScored: fcRunsChargedCalc.earnedRuns,
                rbi: 0, // No RBI on FC with run scoring
                scoringRunners,
                earnedScoringRunners: fcRunsChargedCalc.earnedScoringRunners,
                runsChargedByPitcher: fcRunsChargedCalc.runsChargedByPitcher,
                earnedRunsChargedByPitcher: fcRunsChargedCalc.earnedRunsChargedByPitcher,
                hitLocation,
                isError: false,
                baseAdvancement: { first: batter, second: fcBaseState[1], third: null },
                outsRecorded: 1,
                playByPlayText: `${batter.name} reaches on a fielder's choice. ${runnerOnFirstPlayer.name} is thrown out at second. ${runnerScored.name} scores on the throw.`,
                debugInfo,
              };

              return {
                result,
                newBaseState: fcBaseState,
                newOuts: outs + 1,
                pitchesThrown,
                inningOver: false,
              };
            }
          } else {
            // Defense takes sure DP, runner on 3rd may score
            if (rollSuccess(DP_RUNNER_SCORES_IF_SURE_DP)) {
              runsScored = 1;
              scoringRunners.push(baseState[2]!);
              newThird = null;
            }
          }
        }

        // Runner on 2nd advances to 3rd during DP (if 3rd is empty)
        let newSecond: Player | null = null;
        if (runnerOnSecond && newThird === null) {
          newThird = baseState[1];
        } else if (runnerOnSecond) {
          newSecond = baseState[1];
        }

        const dpBaseState: BaseState = [null, newSecond, newThird];
        const playText = runsScored > 0
          ? `${batter.name} grounds into a double play. ${runsScored} run scores.`
          : `${batter.name} grounds into a double play.`;

        const dpRunsChargedCalc = calculateRunsCharged(scoringRunners, runnerOrigins, pitcher.id, false);
        const result: AtBatResult = {
          outcome: 'double_play',
          batter,
          pitcher,
          runsScored,
          earnedRunsScored: dpRunsChargedCalc.earnedRuns,
          rbi: 0, // No RBI on GIDP
          scoringRunners,
          earnedScoringRunners: dpRunsChargedCalc.earnedScoringRunners,
          runsChargedByPitcher: dpRunsChargedCalc.runsChargedByPitcher,
          earnedRunsChargedByPitcher: dpRunsChargedCalc.earnedRunsChargedByPitcher,
          hitLocation,
          isError: false,
          baseAdvancement: { first: null, second: newSecond, third: newThird },
          outsRecorded: 2,
          playByPlayText: playText,
          debugInfo,
          isGIDP: true,
        };

        return {
          result,
          newBaseState: dpBaseState,
          newOuts: outs + 2,
          pitchesThrown,
          inningOver: outs + 2 >= 3,
        };
      }
    }

    // Double play failed - fielder's choice (runner on first out at second, batter safe)
    const runnerThrownOut = baseState[0]!; // Runner who was on first
    const fcNewBaseState: BaseState = [batter, baseState[1], baseState[2]];

    const result: AtBatResult = {
      outcome: 'fielders_choice',
      batter,
      pitcher,
      runsScored: 0,
      earnedRunsScored: 0,
      rbi: 0,
      scoringRunners: [],
      earnedScoringRunners: [],
      runsChargedByPitcher: {},
      earnedRunsChargedByPitcher: {},
      hitLocation,
      isError: false,
      baseAdvancement: {
        first: batter,
        second: baseState[1],
        third: baseState[2],
      },
      outsRecorded: 1,
      playByPlayText: generatePlayByPlayText(
        batter,
        'fielders_choice',
        hitLocation,
        0,
        undefined,
        undefined,
        undefined,
        { runnerOut: runnerThrownOut, baseOut: 2 }
      ),
      debugInfo,
    };

    return {
      result,
      newBaseState: fcNewBaseState,
      newOuts: outs + 1,
      pitchesThrown,
      inningOver: outs + 1 >= 3,
    };
  }

  // Regular out (no DP opportunity or not a ground ball)
  // Runners may advance on ground outs or tag up on fly balls
  let newBaseState: BaseState = [...baseState];
  let runsScored = 0;
  const scoringRunners: Player[] = [];
  const outfielderArm = fielder ? calculateArmComposite(fielder) : 50;

  if (outs < 2) {
    if (outType === 'groundout') {
      // Ground out advancement (with < 2 outs)
      // Runner on 3rd can score (~8% base rate)
      if (baseState[2] !== null) {
        const runner = baseState[2]!;
        const runnerSpeed = calculateSpeedComposite(runner);
        const attrDiff = runnerSpeed - outfielderArm;
        const scoreProb = weightedSigmoidProbability(GROUNDOUT_SCORE_FROM_THIRD, attrDiff, SIGMOID_K);

        if (rollSuccess(scoreProb)) {
          scoringRunners.push(runner);
          runsScored++;
          newBaseState[2] = null;
        }
      }

      // Runner on 2nd can advance to 3rd (~25% base rate)
      if (baseState[1] !== null && newBaseState[2] === null) {
        const runner = baseState[1]!;
        const runnerSpeed = calculateSpeedComposite(runner);
        const attrDiff = runnerSpeed - outfielderArm;
        const advanceProb = weightedSigmoidProbability(GROUNDOUT_ADVANCE_FROM_SECOND, attrDiff, SIGMOID_K);

        if (rollSuccess(advanceProb)) {
          newBaseState[2] = runner;
          newBaseState[1] = null;
        }
      }
    } else if (outType === 'flyout') {
      // Fly out tag-up logic (with < 2 outs)
      // First check for failure to tag up DP (1/350 fly outs)
      const hasRunnersOn = baseState[0] !== null || baseState[1] !== null || baseState[2] !== null;
      if (hasRunnersOn && rollSuccess(FAILURE_TO_TAG_RATE)) {
        // Runner leaves early or fails to return - double play!
        // Pick a random runner who is out
        const runnersOn = [
          baseState[2] ? { base: 2, runner: baseState[2] } : null,
          baseState[1] ? { base: 1, runner: baseState[1] } : null,
          baseState[0] ? { base: 0, runner: baseState[0] } : null,
        ].filter(r => r !== null);

        if (runnersOn.length > 0) {
          const outRunner = runnersOn[Math.floor(Math.random() * runnersOn.length)]!;
          newBaseState[outRunner.base as 0 | 1 | 2] = null;

          const result: AtBatResult = {
            outcome: 'double_play',
            batter,
            pitcher,
            runsScored: 0,
            earnedRunsScored: 0,
            rbi: 0,
            scoringRunners: [],
            earnedScoringRunners: [],
            runsChargedByPitcher: {},
            earnedRunsChargedByPitcher: {},
            hitLocation,
            isError: false,
            baseAdvancement: {
              first: newBaseState[0],
              second: newBaseState[1],
              third: newBaseState[2],
            },
            outsRecorded: 2,
            playByPlayText: `${batter.name} flies out. ${outRunner.runner.name} is doubled off for failing to tag up!`,
            debugInfo,
          };

          return {
            result,
            newBaseState,
            newOuts: outs + 2,
            pitchesThrown,
            inningOver: outs + 2 >= 3,
          };
        }
      }

      // Runner on 3rd - check if they attempt to tag (85% attempt rate)
      if (baseState[2] !== null && rollSuccess(TAGUP_ATTEMPT_FROM_THIRD)) {
        const runner = baseState[2]!;
        const runnerSpeed = calculateSpeedComposite(runner);
        const attrDiff = runnerSpeed - outfielderArm;
        // 96% base success rate when attempting
        const successProb = weightedSigmoidProbability(TAGUP_SCORE_FROM_THIRD, attrDiff, SIGMOID_K);

        if (rollSuccess(successProb)) {
          // Successful sac fly!
          scoringRunners.push(runner);
          runsScored++;
          newBaseState[2] = null;
        } else {
          // Thrown out at home - outfield double play!
          newBaseState[2] = null;

          const result: AtBatResult = {
            outcome: 'double_play',
            batter,
            pitcher,
            runsScored: 0,
            earnedRunsScored: 0,
            rbi: 0,
            scoringRunners: [],
            earnedScoringRunners: [],
            runsChargedByPitcher: {},
            earnedRunsChargedByPitcher: {},
            hitLocation,
            isError: false,
            baseAdvancement: {
              first: newBaseState[0],
              second: newBaseState[1],
              third: null,
            },
            outsRecorded: 2,
            playByPlayText: `${batter.name} flies out. ${runner.name} is thrown out at home trying to tag up!`,
            debugInfo,
          };

          return {
            result,
            newBaseState,
            newOuts: outs + 2,
            pitchesThrown,
            inningOver: outs + 2 >= 3,
          };
        }
      }

      // Runner on 2nd - check if they attempt to tag (35% attempt rate)
      if (baseState[1] !== null && newBaseState[2] === null && rollSuccess(TAGUP_ATTEMPT_FROM_SECOND)) {
        const runner = baseState[1]!;
        const runnerSpeed = calculateSpeedComposite(runner);
        const attrDiff = runnerSpeed - outfielderArm;
        // 88% base success rate when attempting
        const successProb = weightedSigmoidProbability(TAGUP_ADVANCE_FROM_SECOND, attrDiff, SIGMOID_K);

        if (rollSuccess(successProb)) {
          // Advances to 3rd
          newBaseState[2] = runner;
          newBaseState[1] = null;
        } else {
          // Thrown out at 3rd - outfield double play!
          newBaseState[1] = null;

          const result: AtBatResult = {
            outcome: 'double_play',
            batter,
            pitcher,
            runsScored: 0,
            earnedRunsScored: 0,
            rbi: 0,
            scoringRunners: [],
            earnedScoringRunners: [],
            runsChargedByPitcher: {},
            earnedRunsChargedByPitcher: {},
            hitLocation,
            isError: false,
            baseAdvancement: {
              first: newBaseState[0],
              second: null,
              third: newBaseState[2],
            },
            outsRecorded: 2,
            playByPlayText: `${batter.name} flies out. ${runner.name} is thrown out at third trying to tag up!`,
            debugInfo,
          };

          return {
            result,
            newBaseState,
            newOuts: outs + 2,
            pitchesThrown,
            inningOver: outs + 2 >= 3,
          };
        }
      }
    }
  }

  // Determine if this is a sacrifice fly (fly out that scores a run)
  const isSacrificeFly = outType === 'flyout' && runsScored > 0;

  const regularOutRunsChargedCalc = calculateRunsCharged(scoringRunners, runnerOrigins, pitcher.id, false);
  const result: AtBatResult = {
    outcome: outType,
    batter,
    pitcher,
    runsScored,
    earnedRunsScored: regularOutRunsChargedCalc.earnedRuns,
    rbi: runsScored, // Sac fly counts as RBI
    scoringRunners,
    earnedScoringRunners: regularOutRunsChargedCalc.earnedScoringRunners,
    runsChargedByPitcher: regularOutRunsChargedCalc.runsChargedByPitcher,
    earnedRunsChargedByPitcher: regularOutRunsChargedCalc.earnedRunsChargedByPitcher,
    hitLocation,
    isError: false,
    baseAdvancement: {
      first: newBaseState[0],
      second: newBaseState[1],
      third: newBaseState[2],
    },
    outsRecorded: 1,
    playByPlayText: generatePlayByPlayText(batter, outType, hitLocation, runsScored),
    debugInfo,
    isSacrificeFly,
  };

  return {
    result,
    newBaseState,
    newOuts: outs + 1,
    pitchesThrown,
    inningOver: outs + 1 >= 3,
  };
}
