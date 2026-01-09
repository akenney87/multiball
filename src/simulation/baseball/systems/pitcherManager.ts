/**
 * Baseball Pitcher Manager
 *
 * Manages pitcher substitutions during a game using the dynamic "rope" system.
 * The rope (tolerance for runs allowed) shortens based on:
 * - Pitch count
 * - Inning number
 * - Runners on base
 * - Score differential
 *
 * @module simulation/baseball/systems/pitcherManager
 */

import type { Player } from '../../../data/types';
import type {
  PitchingStrategy,
  SubstitutionContext,
  BaseState,
  PitcherChangeEvent,
} from '../types';
import { DEFAULT_PITCHING_STRATEGY } from '../types';
import {
  ROPE_PITCH_COUNT_TIERS,
  ROPE_INNING_TIERS,
  ROPE_SITUATIONAL,
  CLOSER_SETTINGS,
  MIN_ROPE,
  MELTDOWN_HITS_THRESHOLD,
} from '../constants';

// =============================================================================
// PITCHER MANAGER
// =============================================================================

/**
 * Manages pitcher substitutions and bullpen usage
 */
export class PitcherManager {
  private currentPitcher: Player;
  private bullpen: Player[];
  private strategy: PitchingStrategy;
  private isCurrentPitcherStarter: boolean;
  private pitchersUsed: Set<string>;
  private pitcherPitchCounts: Map<string, number>;

  constructor(
    starter: Player,
    bullpen: Player[],
    strategy: PitchingStrategy = DEFAULT_PITCHING_STRATEGY
  ) {
    this.currentPitcher = starter;
    this.bullpen = [...bullpen]; // Clone to avoid mutation
    this.strategy = strategy;
    this.isCurrentPitcherStarter = true;
    this.pitchersUsed = new Set([starter.id]);
    this.pitcherPitchCounts = new Map([[starter.id, 0]]);
  }

  /**
   * Get the current pitcher
   */
  getCurrentPitcher(): Player {
    return this.currentPitcher;
  }

  /**
   * Check if current pitcher is the starter
   */
  isStarter(): boolean {
    return this.isCurrentPitcherStarter;
  }

  /**
   * Get remaining bullpen size
   */
  getBullpenSize(): number {
    return this.bullpen.length;
  }

  /**
   * Check if bullpen has available pitchers
   */
  hasBullpenAvailable(): boolean {
    return this.bullpen.length > 0;
  }

  /**
   * Record pitches thrown by current pitcher
   */
  addPitches(count: number): void {
    const currentCount = this.pitcherPitchCounts.get(this.currentPitcher.id) || 0;
    this.pitcherPitchCounts.set(this.currentPitcher.id, currentCount + count);
  }

  /**
   * Get pitch count for current pitcher
   */
  getCurrentPitchCount(): number {
    return this.pitcherPitchCounts.get(this.currentPitcher.id) || 0;
  }

  /**
   * Get all pitcher pitch counts
   */
  getAllPitchCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    this.pitcherPitchCounts.forEach((count, id) => {
      result[id] = count;
    });
    return result;
  }

  /**
   * Calculate the current "rope" (tolerance for runs) based on context
   *
   * The rope shortens as:
   * - Pitch count increases
   * - Innings progress
   * - Runners accumulate
   * - Game gets close
   */
  calculateRope(context: SubstitutionContext): number {
    // Start with base rope from strategy
    const baseRope = context.isStarter
      ? this.strategy.starterMaxRunsInning
      : this.strategy.relieverMaxRunsInning;

    let rope = baseRope;

    // Apply quick hook / long leash modifiers
    if (this.strategy.quickHookEnabled) {
      rope -= 1;
    }
    if (this.strategy.longLeashEnabled) {
      rope += 1;
    }

    // Pitch count adjustment
    if (context.pitchCount >= ROPE_PITCH_COUNT_TIERS.TIER_3_THRESHOLD) {
      rope += ROPE_PITCH_COUNT_TIERS.TIER_4_ADJUSTMENT;
    } else if (context.pitchCount >= ROPE_PITCH_COUNT_TIERS.TIER_2_THRESHOLD) {
      rope += ROPE_PITCH_COUNT_TIERS.TIER_3_ADJUSTMENT;
    } else if (context.pitchCount >= ROPE_PITCH_COUNT_TIERS.TIER_1_THRESHOLD) {
      rope += ROPE_PITCH_COUNT_TIERS.TIER_2_ADJUSTMENT;
    }

    // Inning adjustment
    if (context.inning >= ROPE_INNING_TIERS.CLOSING_INNING_THRESHOLD) {
      rope += ROPE_INNING_TIERS.CLOSING_INNING_ADJUSTMENT;
    } else if (context.inning >= ROPE_INNING_TIERS.LATE_INNING_THRESHOLD) {
      rope += ROPE_INNING_TIERS.LATE_INNING_ADJUSTMENT;
    }

    // Runners on base adjustment
    const runnersOn = countRunnersOnBase(context.baseState);
    if (runnersOn >= ROPE_SITUATIONAL.RUNNERS_ON_THRESHOLD) {
      rope += ROPE_SITUATIONAL.RUNNERS_ON_ADJUSTMENT;
    }

    // Close game adjustment
    if (Math.abs(context.scoreDiff) <= ROPE_SITUATIONAL.CLOSE_GAME_THRESHOLD) {
      rope += ROPE_SITUATIONAL.CLOSE_GAME_ADJUSTMENT;
    }

    // Enforce minimum rope
    return Math.max(MIN_ROPE, rope);
  }

  /**
   * Determine if the current pitcher should be substituted
   *
   * Returns the reason for substitution, or null if no substitution needed
   */
  shouldSubstitute(context: SubstitutionContext): PitcherChangeEvent['reason'] | null {
    // Can't substitute if no bullpen available
    if (!context.bullpenAvailable) {
      return null;
    }

    // Hard pitch count cap (mandatory for starters)
    if (context.isStarter && context.pitchCount >= this.strategy.starterMaxPitchCount) {
      return 'pitch_count';
    }

    // Meltdown detection: too many hits in one inning
    if (context.hitsAllowedThisInning >= MELTDOWN_HITS_THRESHOLD) {
      return 'meltdown';
    }

    // Bases loaded with damage: pull before it gets worse
    const basesLoaded = isBasesLoaded(context.baseState);
    if (basesLoaded && context.runsAllowedThisInning >= ROPE_SITUATIONAL.BASES_LOADED_WITH_DAMAGE) {
      return 'bases_loaded';
    }

    // Calculate dynamic rope and check against runs allowed
    const rope = this.calculateRope(context);
    if (context.runsAllowedThisInning >= rope) {
      return 'runs_allowed';
    }

    // Closer situation: bring in closer in save spots
    if (this.strategy.useCloserInSaveSpots && this.shouldBringInCloser(context)) {
      return 'closer';
    }

    return null;
  }

  /**
   * Check if this is a save situation where we should bring in the closer
   */
  private shouldBringInCloser(context: SubstitutionContext): boolean {
    // Only in 9th inning or later
    if (context.inning < CLOSER_SETTINGS.MIN_INNING) {
      return false;
    }

    // Must have a lead within the save range
    if (context.scoreDiff < CLOSER_SETTINGS.MIN_LEAD || context.scoreDiff > CLOSER_SETTINGS.MAX_LEAD) {
      return false;
    }

    // Don't bring in closer if current pitcher is already a reliever doing well
    if (!context.isStarter && context.runsAllowedThisInning === 0) {
      return false;
    }

    // Must have bullpen available
    if (!context.bullpenAvailable) {
      return false;
    }

    return true;
  }

  /**
   * Execute a pitcher substitution
   *
   * @param reason - The reason for substitution (affects pitcher selection)
   * @returns The new pitcher, or null if substitution failed
   */
  substitute(reason?: PitcherChangeEvent['reason']): Player | null {
    if (this.bullpen.length === 0) {
      return null;
    }

    let newPitcher: Player | undefined;

    // For closer situations, select the closer (last reliever in bullpen)
    // The closer is conventionally saved for last and placed at the end
    if (reason === 'closer' && this.bullpen.length > 0) {
      // Pop the closer from the end of the bullpen
      newPitcher = this.bullpen.pop();
    } else {
      // Normal substitution: FIFO order (first available reliever)
      newPitcher = this.bullpen.shift();
    }

    if (!newPitcher) {
      return null;
    }

    // Update state
    this.currentPitcher = newPitcher;
    this.isCurrentPitcherStarter = false;
    this.pitchersUsed.add(newPitcher.id);
    this.pitcherPitchCounts.set(newPitcher.id, 0);

    return newPitcher;
  }

  /**
   * Check if this is a save situation at the START of an inning
   * (used to proactively bring in closer before any at-bats)
   */
  shouldBringInCloserAtInningStart(
    inning: number,
    scoreDiff: number
  ): boolean {
    // Only in 9th inning or later
    if (inning < CLOSER_SETTINGS.MIN_INNING) {
      return false;
    }

    // Must have a lead within the save range
    if (scoreDiff < CLOSER_SETTINGS.MIN_LEAD || scoreDiff > CLOSER_SETTINGS.MAX_LEAD) {
      return false;
    }

    // Only if closer strategy is enabled
    if (!this.strategy.useCloserInSaveSpots) {
      return false;
    }

    // Don't bring in closer if current pitcher is already a reliever
    // (they were probably just brought in)
    if (!this.isCurrentPitcherStarter) {
      return false;
    }

    // Must have bullpen available
    if (!this.hasBullpenAvailable()) {
      return false;
    }

    return true;
  }

  /**
   * Create a substitution context from current game state
   */
  createContext(
    inning: number,
    outs: number,
    baseState: BaseState,
    runsAllowedThisInning: number,
    hitsAllowedThisInning: number,
    scoreDiff: number
  ): SubstitutionContext {
    return {
      pitcher: this.currentPitcher,
      isStarter: this.isCurrentPitcherStarter,
      pitchCount: this.getCurrentPitchCount(),
      inning,
      outs,
      baseState,
      runsAllowedThisInning,
      hitsAllowedThisInning,
      scoreDiff,
      bullpenAvailable: this.hasBullpenAvailable(),
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Count runners currently on base
 */
function countRunnersOnBase(baseState: BaseState): number {
  return baseState.filter((runner) => runner !== null).length;
}

/**
 * Check if bases are loaded
 */
function isBasesLoaded(baseState: BaseState): boolean {
  return baseState[0] !== null && baseState[1] !== null && baseState[2] !== null;
}

/**
 * Get a description of why the pitcher was pulled
 */
export function getSubstitutionReasonText(reason: PitcherChangeEvent['reason']): string {
  switch (reason) {
    case 'pitch_count':
      return 'reached pitch count limit';
    case 'runs_allowed':
      return 'allowed too many runs';
    case 'meltdown':
      return 'hit hard in the inning';
    case 'closer':
      return 'closer entering in save situation';
    case 'bases_loaded':
      return 'bases loaded after allowing runs';
    default:
      return 'pitching change';
  }
}
