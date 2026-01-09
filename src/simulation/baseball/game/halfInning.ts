/**
 * Baseball Half-Inning Simulation
 *
 * Simulates a complete half-inning (top or bottom) until 3 outs are recorded.
 * Manages batting order, base state, and pitch counts.
 * Supports mid-inning pitcher substitutions via the dynamic rope system.
 *
 * @module simulation/baseball/game/halfInning
 */

import type { Player } from '../../../data/types';
import type {
  BaseState,
  HalfInningResult,
  AtBatResult,
  HalfInningEvent,
  BaserunningEvent,
  PitcherChangeEvent,
  PitchingStrategy,
  BattingStrategy,
  BaserunningStyle,
  ReachedBaseVia,
  RunnerOrigin,
} from '../types';
import { DEFAULT_PITCHING_STRATEGY, DEFAULT_BATTING_STRATEGY } from '../types';
import { simulateAtBat, type AtBatInput } from '../systems/atBat';
import { type FieldingPosition } from '../systems/fielding';
import { checkWildPitchOrPassedBall } from '../systems/pitching';
import { PitcherManager } from '../systems/pitcherManager';
import { calculateComposite } from '../../core/probability';
import {
  OUTS_PER_HALF_INNING,
  WEIGHTS_STEALING,
  WEIGHTS_CATCHER_ARM,
  WEIGHTS_HOLD_RUNNERS,
  BASE_RATE_STEAL_ATTEMPT,
  BASE_RATE_STEAL_SUCCESS,
  BASE_RATE_STEAL_HOME_DESPERATION,
  WP_ADVANCE_FIRST_TO_SECOND,
  WP_ADVANCE_SECOND_TO_THIRD,
  WP_ADVANCE_THIRD_TO_HOME,
  SIGMOID_K,
  BASERUNNING_STYLE_MODIFIERS,
} from '../constants';
import { weightedSigmoidProbability, rollSuccess } from '../../core/probability';
import { calculateContactComposite, calculatePowerComposite } from '../systems/batting';

// =============================================================================
// TYPES
// =============================================================================

export interface HalfInningInput {
  /** Inning number (1-9+) */
  inning: number;
  /** Top or bottom of inning */
  half: 'top' | 'bottom';
  /** Batting team lineup (9 players in batting order) */
  battingLineup: Player[];
  /** Current position in batting order (0-8) */
  battingOrderPosition: number;
  /** Pitching team's current pitcher */
  pitcher: Player;
  /** Pitching team's catcher */
  catcher: Player;
  /** Pitching team's defensive alignment */
  defense: Record<FieldingPosition, Player>;
  /** Current pitch count for pitcher */
  pitchCount: number;
  /** Score differential from batting team's perspective (negative = fielding team ahead) */
  scoreDiff: number;
  /** Bullpen (available relief pitchers) - NEW */
  bullpen?: Player[];
  /** Pitching strategy - NEW */
  pitchingStrategy?: PitchingStrategy;
  /** Batting strategy - NEW */
  battingStrategy?: BattingStrategy;
}

export interface HalfInningOutput {
  /** Complete half-inning result */
  result: HalfInningResult;
  /** New batting order position after half-inning */
  newBattingOrderPosition: number;
  /** New pitch count for pitcher */
  newPitchCount: number;
  /** Whether pitcher needs substitution (end of inning check) */
  pitcherNeedsSubstitution: boolean;
  /** Updated bullpen after any mid-inning changes */
  remainingBullpen: Player[];
  /** All pitcher pitch counts from this half-inning */
  pitcherPitchCounts: Record<string, number>;
  /** Current pitcher at end of half-inning (may have changed mid-inning) */
  currentPitcher: Player;
}

// =============================================================================
// HALF-INNING SIMULATION
// =============================================================================

/**
 * Simulate a complete half-inning
 *
 * Continues until 3 outs are recorded, tracking all at-bats,
 * runs scored, hits, errors, and pitch counts.
 * Supports mid-inning pitcher substitutions via the dynamic rope system.
 * Includes intentional walks, wild pitches, passed balls, and stolen bases.
 *
 * @param input - Half-inning input parameters
 * @returns Complete half-inning output
 */
export function simulateHalfInning(input: HalfInningInput): HalfInningOutput {
  const {
    inning,
    half,
    battingLineup,
    battingOrderPosition,
    pitcher,
    catcher,
    defense,
    pitchCount,
    scoreDiff,
    bullpen = [],
    pitchingStrategy = DEFAULT_PITCHING_STRATEGY,
    battingStrategy = DEFAULT_BATTING_STRATEGY,
  } = input;

  // Initialize pitcher manager for mid-inning substitution logic
  const pitcherManager = new PitcherManager(pitcher, bullpen, pitchingStrategy);
  // Set initial pitch count if pitcher is continuing from previous inning
  if (pitchCount > 0) {
    pitcherManager.addPitches(pitchCount);
  }

  // Initialize state
  let currentOuts = 0;
  let currentBatterIndex = battingOrderPosition;
  let baseState: BaseState = [null, null, null];
  let currentPitcher = pitcher;

  // Track how each runner reached base and which pitcher is responsible
  // Map of player ID -> runner origin info (how they reached + responsible pitcher)
  let runnerOrigins: Record<string, RunnerOrigin> = {};

  // Track results
  const atBats: AtBatResult[] = [];
  const events: HalfInningEvent[] = [];
  let totalRuns = 0;
  let totalHits = 0;
  let totalErrors = 0;
  let totalStolenBases = 0;
  let totalCaughtStealing = 0;
  let totalWildPitches = 0;
  let totalPassedBalls = 0;

  // Track runs/hits allowed by current pitcher THIS inning (for substitution logic)
  let currentPitcherRunsThisInning = 0;
  let currentPitcherHitsThisInning = 0;

  // =========================================================================
  // CHECK FOR CLOSER AT START OF INNING
  // =========================================================================
  // In save situations (9th+ inning, 1-3 run lead), bring in the closer
  // before any at-bats occur. The scoreDiff is from batting team's perspective,
  // so we negate it to get the fielding team's perspective.
  const fieldingTeamLeadAtStart = -scoreDiff;
  if (pitcherManager.shouldBringInCloserAtInningStart(inning, fieldingTeamLeadAtStart)) {
    const oldPitcher = currentPitcher;
    const newPitcher = pitcherManager.substitute('closer');

    if (newPitcher) {
      // Create pitcher change event
      const changeEvent: PitcherChangeEvent = {
        type: 'pitcher_change',
        oldPitcher,
        newPitcher,
        atBatIndex: 0, // Before first at-bat
        inheritedRunners: 0, // Start of inning, no inherited runners
        reason: 'closer',
      };
      events.push(changeEvent);

      // Update current pitcher
      currentPitcher = newPitcher;

      // Reset inning stats for new pitcher
      currentPitcherRunsThisInning = 0;
      currentPitcherHitsThisInning = 0;
    }
  }

  // Simulate at-bats until 3 outs
  while (currentOuts < OUTS_PER_HALF_INNING) {
    // Get current batter and next batter (for IBB decision)
    const batter = battingLineup[currentBatterIndex];
    const nextBatterIndex = (currentBatterIndex + 1) % 9;
    const nextBatter = battingLineup[nextBatterIndex];

    if (!batter || !nextBatter) {
      throw new Error(`Invalid batting order position: ${currentBatterIndex}`);
    }

    // Calculate current score differential for clutch situations
    // scoreDiff is from batting team's perspective, so negate for fielding team's perspective
    const currentScoreDiff = scoreDiff + totalRuns;
    const fieldingTeamScoreDiff = -currentScoreDiff;

    // =========================================================================
    // CHECK FOR INTENTIONAL WALK (before at-bat)
    // =========================================================================
    if (shouldIntentionallyWalk(batter, nextBatter, baseState, currentOuts, inning, currentScoreDiff)) {
      const ibbResult = executeIntentionalWalk(batter, baseState);

      // Create IBB event
      events.push({
        type: 'intentional_walk',
        batter,
        pitcher: currentPitcher,
      });

      // Update state
      baseState = ibbResult.newBaseState;
      totalRuns += ibbResult.runsScored;
      currentPitcherRunsThisInning += ibbResult.runsScored;

      // Track that batter reached via intentional walk (counts same as walk for earned runs)
      // The current pitcher is responsible for this batter
      runnerOrigins[batter.id] = {
        reachedVia: 'walk',
        responsiblePitcherId: currentPitcher.id,
      };

      // Remove scoring runners from origins (they're no longer on base)
      for (const runner of ibbResult.scoringRunners) {
        delete runnerOrigins[runner.id];
      }

      // Advance batting order
      currentBatterIndex = nextBatterIndex;

      // No pitches thrown for IBB (in modern rules)
      continue;
    }

    // =========================================================================
    // CHECK FOR WILD PITCH / PASSED BALL (during at-bat, before outcome)
    // =========================================================================
    const hasRunnersOn = baseState[0] !== null || baseState[1] !== null || baseState[2] !== null;

    if (hasRunnersOn) {
      const wpCheck = checkWildPitchOrPassedBall(currentPitcher, catcher, pitcherManager.getCurrentPitchCount());

      if (wpCheck.occurred && wpCheck.type) {
        const wpAdvancement = advanceOnWildPitch(baseState, wpCheck.type);

        if (wpAdvancement.runnersAdvanced.length > 0) {
          if (wpCheck.type === 'wild_pitch') {
            events.push({
              type: 'wild_pitch',
              pitcher: currentPitcher,
              runnersAdvanced: wpAdvancement.runnersAdvanced,
              advancements: wpAdvancement.advancements,
              runsScored: wpAdvancement.runsScored,
            });
            totalWildPitches++;
            currentPitcherRunsThisInning += wpAdvancement.runsScored;
          } else {
            events.push({
              type: 'passed_ball',
              catcher,
              runnersAdvanced: wpAdvancement.runnersAdvanced,
              advancements: wpAdvancement.advancements,
              runsScored: wpAdvancement.runsScored,
            });
            totalPassedBalls++;
            // Passed ball runs don't count against pitcher's inning total for substitution
          }

          baseState = wpAdvancement.newBaseState;
          totalRuns += wpAdvancement.runsScored;

          // Remove any runners who scored from origins tracking
          for (const adv of wpAdvancement.advancements) {
            if (adv.to === 4) {
              delete runnerOrigins[adv.runner.id];
            }
          }
        }
      }
    }

    // =========================================================================
    // CHECK FOR STOLEN BASE (during at-bat, after WP check)
    // =========================================================================
    const stealEvent = checkStealAttempt(baseState, currentPitcher, catcher, currentOuts, inning, currentScoreDiff, battingStrategy.baserunningStyle);

    if (stealEvent) {
      events.push(stealEvent);
      baseState = applyStealResult(baseState, stealEvent);

      if (stealEvent.type === 'stolen_base') {
        totalStolenBases++;
        // Check if stole home (run scored)
        if (stealEvent.targetBase === 4) {
          totalRuns++;
          // Stealing home counts against pitcher for substitution purposes
          currentPitcherRunsThisInning++;
          // Remove runner from origins (they scored)
          delete runnerOrigins[stealEvent.runner.id];
        }
      } else if (stealEvent.type === 'caught_stealing') {
        totalCaughtStealing++;
        currentOuts++;
        // Remove runner from origins (they're no longer on base)
        delete runnerOrigins[stealEvent.runner.id];

        // Check if inning ended on caught stealing
        if (currentOuts >= OUTS_PER_HALF_INNING) {
          break;
        }
      }
    }

    // =========================================================================
    // SIMULATE THE AT-BAT
    // =========================================================================
    const atBatInput: AtBatInput = {
      batter,
      pitcher: currentPitcher,
      catcher,
      defense,
      baseState,
      pitchCount: pitcherManager.getCurrentPitchCount(),
      outs: currentOuts,
      inning,
      scoreDiff: currentScoreDiff,
      battingStrategy,
      runnerOrigins,
    };

    const atBatOutput = simulateAtBat(atBatInput);

    // Update runner origins based on at-bat outcome (track responsible pitcher)
    runnerOrigins = updateRunnerOrigins(runnerOrigins, batter, atBatOutput.result, atBatOutput.newBaseState, currentPitcher.id);

    // Add at-bat to events
    events.push({ type: 'at_bat', result: atBatOutput.result });

    // Update state from at-bat result
    atBats.push(atBatOutput.result);
    baseState = atBatOutput.newBaseState;
    currentOuts = atBatOutput.newOuts;
    pitcherManager.addPitches(atBatOutput.pitchesThrown);

    // Track runs, hits, errors
    totalRuns += atBatOutput.result.runsScored;
    currentPitcherRunsThisInning += atBatOutput.result.runsScored;

    if (isHit(atBatOutput.result.outcome)) {
      totalHits++;
      currentPitcherHitsThisInning++;
    }

    if (atBatOutput.result.isError) {
      totalErrors++;
    }

    // Advance batting order
    currentBatterIndex = (currentBatterIndex + 1) % 9;

    // Check if inning ended
    if (atBatOutput.inningOver) {
      break;
    }

    // =========================================================================
    // CHECK FOR MID-INNING PITCHER SUBSTITUTION (after at-bat)
    // =========================================================================
    const subContext = pitcherManager.createContext(
      inning,
      currentOuts,
      baseState,
      currentPitcherRunsThisInning,
      currentPitcherHitsThisInning,
      fieldingTeamScoreDiff
    );

    const subReason = pitcherManager.shouldSubstitute(subContext);

    if (subReason) {
      const oldPitcher = currentPitcher;
      const inheritedRunners = countRunnersOnBase(baseState);
      const newPitcher = pitcherManager.substitute(subReason);

      if (newPitcher) {
        // Create pitcher change event
        const changeEvent: PitcherChangeEvent = {
          type: 'pitcher_change',
          oldPitcher,
          newPitcher,
          atBatIndex: atBats.length,
          inheritedRunners,
          reason: subReason,
        };
        events.push(changeEvent);

        // Update current pitcher
        currentPitcher = newPitcher;

        // Reset inning-specific tracking for new pitcher
        currentPitcherRunsThisInning = 0;
        currentPitcherHitsThisInning = 0;

        // Update defense with new pitcher
        // Note: defense object should be updated by caller if needed
      }
    }
  }

  // Calculate left on base
  const leftOnBase = countRunnersOnBase(baseState);

  // Get all pitch counts
  const pitchCounts = pitcherManager.getAllPitchCounts();

  // Create result
  const result: HalfInningResult = {
    inning,
    half,
    runs: totalRuns,
    hits: totalHits,
    errors: totalErrors,
    leftOnBase,
    atBats,
    events,
    pitchCounts,
    stolenBases: totalStolenBases,
    caughtStealing: totalCaughtStealing,
    wildPitches: totalWildPitches,
    passedBalls: totalPassedBalls,
  };

  // Calculate final score differential for end-of-inning check
  const finalScoreDiff = scoreDiff + totalRuns;
  const finalFieldingTeamScoreDiff = -finalScoreDiff;

  // End-of-inning substitution check (for game simulation to use)
  const endSubContext = pitcherManager.createContext(
    inning,
    currentOuts,
    baseState,
    currentPitcherRunsThisInning,
    currentPitcherHitsThisInning,
    finalFieldingTeamScoreDiff
  );
  const pitcherNeedsSubstitution = pitcherManager.shouldSubstitute(endSubContext) !== null;

  return {
    result,
    newBattingOrderPosition: currentBatterIndex,
    newPitchCount: pitcherManager.getCurrentPitchCount(),
    pitcherNeedsSubstitution,
    remainingBullpen: bullpen.filter(p => !pitcherManager.getAllPitchCounts()[p.id]),
    pitcherPitchCounts: pitchCounts,
    currentPitcher,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if outcome is a hit
 */
function isHit(outcome: string): boolean {
  return ['single', 'double', 'triple', 'home_run'].includes(outcome);
}

/**
 * Count runners currently on base
 */
function countRunnersOnBase(baseState: BaseState): number {
  let count = 0;
  if (baseState[0]) count++;
  if (baseState[1]) count++;
  if (baseState[2]) count++;
  return count;
}

/**
 * Options for generating half-inning summary
 */
export interface HalfInningSummaryOptions {
  /** Name of the batting team */
  battingTeamName?: string;
  /** Name of the pitcher on the mound */
  pitcherName?: string;
}

/**
 * Get play-by-play summary for half-inning
 */
export function getHalfInningSummary(
  result: HalfInningResult,
  options: HalfInningSummaryOptions = {}
): string[] {
  const summary: string[] = [];
  const { battingTeamName, pitcherName } = options;

  // Header with team info
  const halfLabel = result.half === 'top' ? 'Top' : 'Bottom';
  const teamInfo = battingTeamName ? ` - ${battingTeamName} batting` : '';
  summary.push(`--- ${halfLabel} of the ${getOrdinal(result.inning)}${teamInfo} ---`);

  // Pitcher announcement at start of inning
  if (pitcherName) {
    summary.push(`${pitcherName} on the mound.`);
  }

  // Each at-bat (include events like stolen bases, wild pitches, etc.)
  for (const event of result.events) {
    if (event.type === 'at_bat') {
      summary.push(event.result.playByPlayText);
    } else if (event.type === 'stolen_base') {
      summary.push(`${event.runner.name} steals ${getBaseName(event.targetBase)}!`);
    } else if (event.type === 'caught_stealing') {
      summary.push(`${event.runner.name} caught stealing ${getBaseName(event.targetBase)}.`);
    } else if (event.type === 'wild_pitch') {
      const advancementText = formatRunnerAdvancements(event.advancements);
      if (advancementText) {
        summary.push(`Wild pitch!${advancementText}`);
      } else {
        // Wild pitch occurred but no runners advanced (blocked bases or failed advance attempts)
        summary.push('Wild pitch! No runners advance.');
      }
    } else if (event.type === 'passed_ball') {
      const advancementText = formatRunnerAdvancements(event.advancements);
      if (advancementText) {
        summary.push(`Passed ball.${advancementText}`);
      } else {
        summary.push('Passed ball. No runners advance.');
      }
    } else if (event.type === 'intentional_walk') {
      summary.push(`${event.batter.name} is intentionally walked.`);
    } else if (event.type === 'pitcher_change') {
      // Provide context-specific message for pitcher changes
      if (event.reason === 'closer') {
        summary.push(`${event.newPitcher.name} enters to close out the game.`);
      } else if (event.reason === 'meltdown') {
        summary.push(`Pitching change: ${event.newPitcher.name} enters after ${event.oldPitcher.name} struggles.`);
      } else if (event.reason === 'pitch_count') {
        summary.push(`Pitching change: ${event.newPitcher.name} enters as ${event.oldPitcher.name} reaches pitch limit.`);
      } else {
        summary.push(`Pitching change: ${event.newPitcher.name} enters the game.`);
      }
    }
  }

  // Summary line with proper grammar
  const runsText = result.runs === 1 ? '1 run' : `${result.runs} runs`;
  const hitsText = result.hits === 1 ? '1 hit' : `${result.hits} hits`;
  const errorsText = result.errors === 1 ? '1 error' : `${result.errors} errors`;
  summary.push(`${runsText}, ${hitsText}, ${errorsText}, ${result.leftOnBase} LOB`);

  return summary;
}

/**
 * Get base name for stolen base events
 */
function getBaseName(targetBase: number): string {
  switch (targetBase) {
    case 2: return 'second';
    case 3: return 'third';
    case 4: return 'home';
    default: return 'a base';
  }
}

/**
 * Runner advancement info for formatting
 */
interface AdvancementInfo {
  runner: Player;
  from: number;
  to: number;
}

/**
 * Format runner advancement descriptions for wild pitch/passed ball
 */
function formatRunnerAdvancements(advancements?: AdvancementInfo[]): string {
  if (!advancements || advancements.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const adv of advancements) {
    const baseName = adv.to === 4 ? 'home' : adv.to === 3 ? 'third' : adv.to === 2 ? 'second' : 'first';
    if (adv.to === 4) {
      parts.push(`${adv.runner.name} scores`);
    } else {
      parts.push(`${adv.runner.name} advances to ${baseName}`);
    }
  }

  if (parts.length === 0) {
    return '';
  }

  return ' ' + parts.join('. ') + '.';
}

/**
 * Get ordinal suffix for inning number
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th';
  return n + suffix;
}

// =============================================================================
// INTENTIONAL WALK
// =============================================================================

/**
 * Flatten player attributes for composite calculation
 */
function flattenAttributes(player: Player): Record<string, number> {
  return player.attributes as unknown as Record<string, number>;
}

/**
 * Calculate batter threat level (contact + power)
 */
function calculateBatterThreat(batter: Player): number {
  return calculateContactComposite(batter) + calculatePowerComposite(batter);
}

/**
 * Determine if pitcher should intentionally walk the batter
 */
export function shouldIntentionallyWalk(
  batter: Player,
  nextBatter: Player,
  baseState: BaseState,
  outs: number,
  inning: number,
  scoreDiff: number
): boolean {
  // REQUIRED: First base must be open
  if (baseState[0] !== null) return false;

  // Don't walk in a run (bases loaded)
  if (baseState[0] !== null && baseState[1] !== null && baseState[2] !== null) return false;

  // Only consider in late innings, close games
  if (inning < 7) return false;
  if (Math.abs(scoreDiff) > 2) return false;

  // More likely with 2 outs and runner in scoring position
  const hasRISP = baseState[1] !== null || baseState[2] !== null;
  if (outs < 2 && !hasRISP) return false;

  // Compare batter threat vs next batter
  const batterThreat = calculateBatterThreat(batter);
  const nextBatterThreat = calculateBatterThreat(nextBatter);

  // Walk if current batter is significantly more dangerous (20+ points)
  return batterThreat - nextBatterThreat > 20;
}

/**
 * Execute an intentional walk
 */
export function executeIntentionalWalk(
  batter: Player,
  baseState: BaseState
): { newBaseState: BaseState; runsScored: number; scoringRunners: Player[] } {
  const newState: BaseState = [...baseState];
  let runsScored = 0;
  const scoringRunners: Player[] = [];

  // Advance forced runners
  if (baseState[2] && baseState[1] && baseState[0]) {
    // Bases loaded - run scores
    scoringRunners.push(baseState[2]);
    runsScored++;
  }

  if (baseState[1] && baseState[0]) {
    // Runners on 1st and 2nd - runner to 3rd
    newState[2] = baseState[1];
  }

  if (baseState[0]) {
    // Runner on 1st - runner to 2nd
    newState[1] = baseState[0];
  }

  // Batter to first
  newState[0] = batter;

  return { newBaseState: newState, runsScored, scoringRunners };
}

// =============================================================================
// WILD PITCH / PASSED BALL ADVANCEMENT
// =============================================================================

/**
 * Runner advancement detail for wild pitch/passed ball
 */
interface WildPitchAdvancement {
  runner: Player;
  from: 1 | 2 | 3;
  to: 2 | 3 | 4;  // 4 = home (scored)
}

/**
 * Advance runners on wild pitch or passed ball
 */
export function advanceOnWildPitch(
  baseState: BaseState,
  _type: 'wild_pitch' | 'passed_ball'
): { newBaseState: BaseState; runsScored: number; runnersAdvanced: Player[]; advancements: WildPitchAdvancement[] } {
  const newState: BaseState = [...baseState];
  let runsScored = 0;
  const runnersAdvanced: Player[] = [];
  const advancements: WildPitchAdvancement[] = [];

  // 3rd → Home: 50% (catcher can recover)
  if (baseState[2] && rollSuccess(WP_ADVANCE_THIRD_TO_HOME)) {
    runnersAdvanced.push(baseState[2]);
    advancements.push({ runner: baseState[2], from: 3, to: 4 });
    runsScored++;
    newState[2] = null;
  }

  // 2nd → 3rd: 85%
  if (baseState[1] && rollSuccess(WP_ADVANCE_SECOND_TO_THIRD)) {
    runnersAdvanced.push(baseState[1]);
    // Only advance if 3rd is now open
    if (newState[2] === null) {
      advancements.push({ runner: baseState[1], from: 2, to: 3 });
      newState[2] = baseState[1];
      newState[1] = null;
    }
  }

  // 1st → 2nd: 95%
  if (baseState[0] && rollSuccess(WP_ADVANCE_FIRST_TO_SECOND)) {
    runnersAdvanced.push(baseState[0]);
    // Only advance if 2nd is now open
    if (newState[1] === null) {
      advancements.push({ runner: baseState[0], from: 1, to: 2 });
      newState[1] = baseState[0];
      newState[0] = null;
    }
  }

  return { newBaseState: newState, runsScored, runnersAdvanced, advancements };
}

// =============================================================================
// STOLEN BASE SYSTEM
// =============================================================================

interface StealCandidate {
  runner: Player;
  fromBase: 1 | 2 | 3;
  targetBase: 2 | 3 | 4;
}

/**
 * Get runners eligible to steal
 */
function getStealCandidates(baseState: BaseState): StealCandidate[] {
  const candidates: StealCandidate[] = [];

  // Runner on 1st can steal 2nd (if 2nd is open)
  if (baseState[0] && !baseState[1]) {
    candidates.push({ runner: baseState[0], fromBase: 1, targetBase: 2 });
  }

  // Runner on 2nd can steal 3rd (if 3rd is open)
  if (baseState[1] && !baseState[2]) {
    candidates.push({ runner: baseState[1], fromBase: 2, targetBase: 3 });
  }

  // Runner on 3rd can steal home (rare, desperation only)
  if (baseState[2]) {
    candidates.push({ runner: baseState[2], fromBase: 3, targetBase: 4 });
  }

  return candidates;
}

/**
 * Calculate runner's stealing composite
 */
function calculateStealingComposite(runner: Player): number {
  const attrs = flattenAttributes(runner);
  return calculateComposite(attrs, WEIGHTS_STEALING);
}

/**
 * Calculate catcher's arm composite for throwing out runners
 */
function calculateCatcherArmComposite(catcher: Player): number {
  const attrs = flattenAttributes(catcher);
  return calculateComposite(attrs, WEIGHTS_CATCHER_ARM);
}

/**
 * Calculate pitcher's ability to hold runners
 */
function calculateHoldRunnersComposite(pitcher: Player): number {
  const attrs = flattenAttributes(pitcher);
  return calculateComposite(attrs, WEIGHTS_HOLD_RUNNERS);
}

/**
 * Check for steal attempt and resolve it
 *
 * @param baseState - Current base state
 * @param pitcher - Current pitcher
 * @param catcher - Catcher
 * @param outs - Current outs
 * @param inning - Current inning
 * @param scoreDiff - Score differential
 * @param baserunningStyle - Baserunning strategy style (aggressive/conservative/balanced)
 */
export function checkStealAttempt(
  baseState: BaseState,
  pitcher: Player,
  catcher: Player,
  outs: number,
  inning: number,
  scoreDiff: number,
  baserunningStyle: BaserunningStyle = 'balanced'
): BaserunningEvent | null {
  const candidates = getStealCandidates(baseState);
  if (candidates.length === 0) return null;

  // Situational gates
  if (outs === 2 && scoreDiff < -3) return null; // Don't risk it down big
  if (scoreDiff > 5) return null; // Don't bother when way ahead

  // Select fastest runner as most likely candidate
  let bestCandidate: StealCandidate | null = null;
  let bestSpeed = 0;

  for (const candidate of candidates) {
    const speed = calculateStealingComposite(candidate.runner);
    if (speed > bestSpeed) {
      bestSpeed = speed;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) return null;

  // Get baserunning style modifiers
  const styleMods = BASERUNNING_STYLE_MODIFIERS[baserunningStyle];

  // Stealing home: only in desperation (9th+, down by 1, 2 outs)
  if (bestCandidate.targetBase === 4) {
    const isDesperation = inning >= 9 && scoreDiff === -1 && outs === 2;
    if (!isDesperation) return null;

    // Very low attempt rate even in desperation (aggressive style slightly more likely)
    // Clamp to [0, 1] to prevent negative probabilities from style modifiers
    const homeAttemptProb = Math.max(0, Math.min(1, BASE_RATE_STEAL_HOME_DESPERATION + (styleMods.stealAttemptRate * 0.5)));
    if (!rollSuccess(homeAttemptProb)) return null;
  } else {
    // Regular steal attempt probability (speed-modified) with baserunning style modifier
    const baseAttemptProb = BASE_RATE_STEAL_ATTEMPT * (bestSpeed / 50);
    // Clamp to [0, 1] to prevent negative probabilities from style modifiers
    const attemptProb = Math.max(0, Math.min(1, baseAttemptProb + styleMods.stealAttemptRate));
    if (!rollSuccess(attemptProb)) return null;
  }

  // Resolve the steal attempt
  const catcherArm = calculateCatcherArmComposite(catcher);
  const pitcherHold = calculateHoldRunnersComposite(pitcher);
  const defenseComposite = (catcherArm * 0.7) + (pitcherHold * 0.3);

  // Apply baserunning style modifier to success probability
  const baseSuccessProb = weightedSigmoidProbability(
    BASE_RATE_STEAL_SUCCESS,
    bestSpeed - defenseComposite,
    SIGMOID_K
  );
  // Clamp to [0, 1] to prevent negative probabilities from style modifiers
  const successProb = Math.max(0, Math.min(1, baseSuccessProb + styleMods.stealSuccessRate));

  if (rollSuccess(successProb)) {
    return {
      type: 'stolen_base',
      runner: bestCandidate.runner,
      targetBase: bestCandidate.targetBase,
      success: true,
    };
  } else {
    return {
      type: 'caught_stealing',
      runner: bestCandidate.runner,
      targetBase: bestCandidate.targetBase,
      catcher,
    };
  }
}

/**
 * Apply steal result to base state
 */
export function applyStealResult(
  baseState: BaseState,
  event: BaserunningEvent
): BaseState {
  const newState: BaseState = [...baseState];

  if (event.type === 'stolen_base') {
    // Runner successfully advanced
    if (event.targetBase === 2) {
      newState[1] = event.runner;
      newState[0] = null;
    } else if (event.targetBase === 3) {
      newState[2] = event.runner;
      newState[1] = null;
    } else if (event.targetBase === 4) {
      // Stole home - runner scored (handled separately)
      newState[2] = null;
    }
  } else if (event.type === 'caught_stealing') {
    // Runner is out
    if (event.targetBase === 2) {
      newState[0] = null;
    } else if (event.targetBase === 3) {
      newState[1] = null;
    } else if (event.targetBase === 4) {
      newState[2] = null;
    }
  }

  return newState;
}

// =============================================================================
// RUNNER ORIGINS TRACKING (for earned run and inherited runner calculation)
// =============================================================================

/**
 * Update runner origins after an at-bat
 *
 * This tracks how each runner on base reached (hit, walk, error, etc.)
 * and which pitcher is responsible for them (for inherited runner tracking).
 * Runners who reached on error never score earned runs.
 */
function updateRunnerOrigins(
  currentOrigins: Record<string, RunnerOrigin>,
  batter: Player,
  result: AtBatResult,
  newBaseState: BaseState,
  currentPitcherId: string
): Record<string, RunnerOrigin> {
  const newOrigins: Record<string, RunnerOrigin> = {};

  // Copy origins for runners still on base
  for (let i = 0; i < 3; i++) {
    const runner = newBaseState[i];
    if (runner) {
      // If this is the batter, set their origin based on outcome
      if (runner.id === batter.id) {
        newOrigins[batter.id] = {
          reachedVia: getReachedBaseVia(result.outcome),
          responsiblePitcherId: currentPitcherId,
        };
      } else {
        // Preserve existing origin for runners who were already on base
        const existingOrigin = currentOrigins[runner.id];
        if (existingOrigin) {
          newOrigins[runner.id] = existingOrigin;
        }
      }
    }
  }

  return newOrigins;
}

/**
 * Determine how a batter reached base based on at-bat outcome
 */
function getReachedBaseVia(outcome: string): ReachedBaseVia {
  switch (outcome) {
    case 'single':
    case 'double':
    case 'triple':
    case 'home_run':
      return 'hit';
    case 'walk':
    case 'hit_by_pitch':
    case 'intentional_walk':
      return 'walk';
    case 'error':
      return 'error';
    case 'fielders_choice':
      return 'fielders_choice';
    default:
      // Strikeout, outs - batter didn't reach
      return 'hit'; // Shouldn't be called for outs, but default to hit
  }
}
