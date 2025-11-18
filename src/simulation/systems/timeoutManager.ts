/**
 * Basketball Simulator - Timeout Management System (M3 Phase 2c)
 *
 * Handles timeout strategy and execution for realistic game flow.
 *
 * Key Responsibilities:
 * 1. Detect momentum situations (scoring runs: 8-0, 10-2, 12-0)
 * 2. Trigger timeouts to stop opponent momentum
 * 3. Manage end-game timeout strategy
 * 4. Track timeout usage (7 per team per game)
 * 5. Apply timeout effects (stamina recovery, substitution window)
 *
 * Integrates with:
 * - quarter_simulation (timeout triggers)
 * - staminaManager (stamina recovery during timeout)
 * - substitutions (substitution window)
 *
 * From FOULS_AND_INJURIES_SPEC.md Section 2:
 * - Momentum threshold: 8-0, 10-2, 12-0 runs
 * - End-game strategy: Save 1-2 timeouts for final 3 minutes
 * - Stamina recovery: +5 stamina for full timeout, +3 for short timeout
 *
 * @module simulation/systems/timeoutManager
 */

import type { StaminaTracker } from '../stamina/staminaManager';

// =============================================================================
// TIMEOUT DATA STRUCTURES
// =============================================================================

/**
 * Record of a timeout occurrence
 */
export interface TimeoutEvent {
  /** Team calling timeout */
  team: 'Home' | 'Away';
  /** Quarter number (1-4) */
  quarter: number;
  /** Game clock when timeout was called */
  gameTime: string;
  /** Reason for timeout */
  reason: 'momentum' | 'substitution' | 'end_game' | 'advance_ball' | 'end_game_3pt_setup' | 'end_game_final_possession' | 'end_game_desperation';
  /** Scoring run that triggered timeout */
  scoringRun?: [number, number];
  /** Timeouts remaining after this timeout */
  timeoutsRemainingAfter: number;
}

/**
 * Tracks current scoring run for momentum detection
 */
export class ScoringRun {
  /** Points scored by this team in current run */
  teamPoints: number = 0;
  /** Points scored by opponent in current run */
  opponentPoints: number = 0;
  /** Number of possessions in this run */
  possessionsInRun: number = 0;

  /**
   * Reset run tracker after timeout or run broken
   */
  reset(): void {
    this.teamPoints = 0;
    this.opponentPoints = 0;
    this.possessionsInRun = 0;
  }

  /**
   * Update run tracker after possession.
   *
   * @param pointsScored - Points scored this possession
   * @param byTeam - True if scored by this team, false if by opponent
   */
  update(pointsScored: number, byTeam: boolean): void {
    if (byTeam) {
      this.teamPoints += pointsScored;
    } else {
      this.opponentPoints += pointsScored;
    }

    this.possessionsInRun += 1;
  }

  /**
   * Get current run as [teamPoints, opponentPoints]
   */
  getRun(): [number, number] {
    return [this.teamPoints, this.opponentPoints];
  }
}

// =============================================================================
// TIMEOUT MANAGER CLASS
// =============================================================================

/**
 * Strategy parameters for timeout usage
 */
interface StrategyParams {
  /** Momentum threshold (points behind in run to trigger timeout) */
  momentumThreshold: number;
  /** Number of timeouts to save for Q4 */
  saveForEndgame: number;
}

/**
 * Manages timeout strategy and detection for a full game.
 *
 * Tracks timeouts remaining, scoring runs, and determines when to call timeouts.
 */
export class TimeoutManager {
  private timeoutsRemainingHome: number;
  private timeoutsRemainingAway: number;
  private timeoutsPerGame: number;
  private timeoutEvents: TimeoutEvent[];
  private homeRun: ScoringRun;
  private awayRun: ScoringRun;
  private timeoutStrategy: string;
  private strategyParams: StrategyParams;
  private lastTimeoutTimeHome: number;
  private lastTimeoutTimeAway: number;
  private minTimeoutGapSeconds: number;

  /**
   * Initialize timeout manager.
   *
   * @param timeoutStrategy - 'aggressive', 'standard', or 'conservative'
   * @param timeoutsPerGame - Number of timeouts each team starts with (default 7)
   */
  constructor(timeoutStrategy: string = 'standard', timeoutsPerGame: number = 7) {
    // Timeout counters
    this.timeoutsRemainingHome = timeoutsPerGame;
    this.timeoutsRemainingAway = timeoutsPerGame;
    this.timeoutsPerGame = timeoutsPerGame;

    // Timeout events history
    this.timeoutEvents = [];

    // Scoring run trackers
    this.homeRun = new ScoringRun();
    this.awayRun = new ScoringRun();

    // Strategy settings
    this.timeoutStrategy = timeoutStrategy;
    this.strategyParams = this.getStrategyParams(timeoutStrategy);

    // BUG FIX: Timeout cooldown tracking to prevent spam
    this.lastTimeoutTimeHome = -999; // Game time in seconds when last timeout was called
    this.lastTimeoutTimeAway = -999;
    this.minTimeoutGapSeconds = 15; // Minimum 15 seconds between timeouts
  }

  /**
   * Get strategy parameters for timeout usage.
   *
   * @param strategy - 'aggressive', 'standard', or 'conservative'
   * @returns Strategy parameters
   */
  private getStrategyParams(strategy: string): StrategyParams {
    const strategies: Record<string, StrategyParams> = {
      aggressive: {
        momentumThreshold: 8,
        saveForEndgame: 2,
      },
      standard: {
        momentumThreshold: 10,
        saveForEndgame: 1,
      },
      conservative: {
        momentumThreshold: 12,
        saveForEndgame: 3,
      },
    };
    return strategies[strategy] ?? strategies['standard'];
  }

  /**
   * Update scoring run trackers after a possession.
   *
   * @param team - 'Home' or 'Away' (team whose run we're tracking)
   * @param pointsScored - Points scored this possession
   * @param scoringTeam - 'Home' or 'Away' (team that scored)
   */
  updateScoringRun(team: 'Home' | 'Away', pointsScored: number, scoringTeam: 'Home' | 'Away'): void {
    if (team === 'Home') {
      this.homeRun.update(pointsScored, scoringTeam === 'Home');
    } else {
      this.awayRun.update(pointsScored, scoringTeam === 'Away');
    }
  }

  /**
   * Check if team should call momentum timeout to stop opponent run.
   *
   * @param team - 'Home' or 'Away' (team considering timeout)
   * @param quarter - Current quarter (1-4)
   * @param timeRemaining - Seconds remaining in quarter
   * @param scoreDifferential - Score difference (positive = team winning)
   * @param teamJustScored - True if this team just scored
   * @returns Tuple of [shouldCallTimeout, reason]
   */
  checkMomentumTimeout(
    team: 'Home' | 'Away',
    quarter: number,
    timeRemaining: number,
    scoreDifferential: number,
    teamJustScored: boolean = false
  ): [boolean, string] {
    // BUG FIX: Enforce timeout cooldown to prevent spam
    const gameTime = (4 - quarter) * 720 + timeRemaining;
    const lastTimeoutTime = team === 'Home' ? this.lastTimeoutTimeHome : this.lastTimeoutTimeAway;

    if (gameTime > lastTimeoutTime - this.minTimeoutGapSeconds) {
      // Too soon since last timeout
      return [false, ''];
    }

    // CRITICAL FIX: Don't call timeout if YOU just scored
    if (teamJustScored) {
      return [false, ''];
    }

    // Get team's run tracker and timeouts
    const run = team === 'Home' ? this.homeRun : this.awayRun;
    const timeoutsRemaining = team === 'Home' ? this.timeoutsRemainingHome : this.timeoutsRemainingAway;

    // Get current run
    const [teamPoints, opponentPoints] = run.getRun();

    // Check if opponent is on a run
    const isOpponentRun = (opponentPoints - teamPoints) >= this.strategyParams.momentumThreshold;

    if (!isOpponentRun) {
      return [false, ''];
    }

    // Don't call timeout if we don't have enough timeouts remaining
    const minTimeoutsNeeded = this.strategyParams.saveForEndgame + 1;
    if (timeoutsRemaining < minTimeoutsNeeded) {
      return [false, ''];
    }

    // Check specific run patterns
    const currentlyLosing = scoreDifferential < 0;

    // 8-0 or 10-0 run
    if (opponentPoints >= 8 && teamPoints === 0) {
      if (currentlyLosing && timeoutsRemaining >= 3) {
        return [true, 'momentum'];
      } else if (timeoutsRemaining >= 4) {
        return [true, 'momentum'];
      }
    }

    // 10-2 or 12-0 run
    if (opponentPoints >= 10 && opponentPoints - teamPoints >= 8) {
      if (currentlyLosing && timeoutsRemaining >= 3) {
        return [true, 'momentum'];
      } else if (timeoutsRemaining >= 4) {
        return [true, 'momentum'];
      }
    }

    return [false, ''];
  }

  /**
   * Check if team should call end-game timeout.
   *
   * @param team - 'Home' or 'Away'
   * @param quarter - Current quarter (1-4)
   * @param timeRemaining - Seconds remaining in quarter
   * @param scoreDifferential - Score difference (positive = team winning)
   * @param teamHasBall - True if team has possession
   * @returns Tuple of [shouldCallTimeout, reason]
   */
  checkEndGameTimeout(
    team: 'Home' | 'Away',
    quarter: number,
    timeRemaining: number,
    scoreDifferential: number,
    teamHasBall: boolean
  ): [boolean, string] {
    if (quarter !== 4) {
      return [false, ''];
    }

    // BUG FIX: Enforce timeout cooldown to prevent spam
    const gameTime = (4 - quarter) * 720 + timeRemaining;
    const lastTimeoutTime = team === 'Home' ? this.lastTimeoutTimeHome : this.lastTimeoutTimeAway;

    if (gameTime > lastTimeoutTime - this.minTimeoutGapSeconds) {
      // Too soon since last timeout
      return [false, ''];
    }

    // Get timeouts remaining
    const timeoutsRemaining = team === 'Home' ? this.timeoutsRemainingHome : this.timeoutsRemainingAway;

    if (timeoutsRemaining === 0) {
      return [false, ''];
    }

    // Down 3, <30 seconds, have ball → draw up 3PT play
    if (scoreDifferential >= -5 && scoreDifferential <= -3 && timeRemaining <= 30 && teamHasBall) {
      return [true, 'end_game_3pt_setup'];
    }

    // Down 1-2, <10 seconds, have ball → last possession setup
    if (scoreDifferential >= -2 && scoreDifferential <= -1 && timeRemaining <= 10 && teamHasBall) {
      return [true, 'end_game_final_possession'];
    }

    // Losing, <5 seconds, opponent has ball → prevent clock runout
    if (scoreDifferential < 0 && timeRemaining <= 5 && !teamHasBall) {
      return [true, 'end_game_desperation'];
    }

    return [false, ''];
  }

  /**
   * Execute a timeout call.
   *
   * Side Effects:
   *   - Decrements timeoutsRemaining
   *   - Resets scoring run trackers
   *   - Records timeout event
   *   - Updates lastTimeoutTime for cooldown tracking
   *
   * @param team - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock string
   * @param reason - Reason for timeout
   * @param scoringRun - Optional [teamPoints, opponentPoints] that triggered timeout
   * @param timeRemaining - Seconds remaining in quarter (for cooldown tracking)
   * @returns TimeoutEvent
   */
  callTimeout(
    team: 'Home' | 'Away',
    quarter: number,
    gameTime: string,
    reason: TimeoutEvent['reason'],
    scoringRun?: [number, number],
    timeRemaining: number = 0
  ): TimeoutEvent {
    // Decrement timeouts
    if (team === 'Home') {
      this.timeoutsRemainingHome -= 1;
    } else {
      this.timeoutsRemainingAway -= 1;
    }

    const timeoutsAfter = team === 'Home' ? this.timeoutsRemainingHome : this.timeoutsRemainingAway;

    // BUG FIX: Update last timeout time for cooldown tracking
    const totalGameTime = (4 - quarter) * 720 + timeRemaining;
    if (team === 'Home') {
      this.lastTimeoutTimeHome = totalGameTime;
    } else {
      this.lastTimeoutTimeAway = totalGameTime;
    }

    // Reset scoring runs (timeout breaks momentum)
    this.homeRun.reset();
    this.awayRun.reset();

    // Create timeout event
    const timeoutEvent: TimeoutEvent = {
      team,
      quarter,
      gameTime,
      reason,
      scoringRun,
      timeoutsRemainingAfter: timeoutsAfter,
    };

    // Record event
    this.timeoutEvents.push(timeoutEvent);

    return timeoutEvent;
  }

  /**
   * Get timeouts remaining for team.
   *
   * @param team - 'Home' or 'Away'
   * @returns Number of timeouts remaining
   */
  getTimeoutsRemaining(team: 'Home' | 'Away'): number {
    return team === 'Home' ? this.timeoutsRemainingHome : this.timeoutsRemainingAway;
  }

  /**
   * Reset state for new quarter (scoring runs, not timeouts).
   *
   * @param quarter - New quarter number (1-4)
   */
  resetForQuarter(quarter: number): void {
    // Reset scoring runs at start of each quarter
    this.homeRun.reset();
    this.awayRun.reset();
  }

  /**
   * Get summary of timeout usage.
   *
   * @returns Object with timeout statistics
   */
  getTimeoutSummary(): {
    homeTimeoutsRemaining: number;
    awayTimeoutsRemaining: number;
    homeTimeoutsUsed: number;
    awayTimeoutsUsed: number;
    totalTimeouts: number;
    timeoutEvents: TimeoutEvent[];
  } {
    const homeTimeoutsUsed = this.timeoutsPerGame - this.timeoutsRemainingHome;
    const awayTimeoutsUsed = this.timeoutsPerGame - this.timeoutsRemainingAway;

    return {
      homeTimeoutsRemaining: this.timeoutsRemainingHome,
      awayTimeoutsRemaining: this.timeoutsRemainingAway,
      homeTimeoutsUsed,
      awayTimeoutsUsed,
      totalTimeouts: this.timeoutEvents.length,
      timeoutEvents: this.timeoutEvents,
    };
  }
}

// =============================================================================
// TIMEOUT EFFECTS
// =============================================================================

/**
 * Apply stamina recovery to all players during timeout.
 *
 * @param staminaTracker - StaminaTracker instance
 * @param timeoutDuration - 'full' (75s, +5 stamina) or 'short' (20s, +3 stamina)
 */
export function applyTimeoutStaminaRecovery(
  staminaTracker: StaminaTracker,
  timeoutDuration: 'full' | 'short' = 'full'
): void {
  const recoveryAmount = timeoutDuration === 'full' ? 5 : 3;

  // Recover stamina for all players (active and bench)
  const staminaState = staminaTracker.getAllStaminaValues();
  for (const playerName of Object.keys(staminaState)) {
    const currentStamina = staminaTracker.getCurrentStamina(playerName);
    const newStamina = Math.min(100, currentStamina + recoveryAmount);
    staminaTracker.setStamina(playerName, newStamina);
  }
}
