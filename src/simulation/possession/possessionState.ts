/**
 * Basketball Simulator - Possession State Machine (M3 Architecture Fix)
 *
 * CRITICAL SYSTEM for tracking possession and ball state throughout the game.
 *
 * This module is the FOUNDATION for fixing timeout and substitution violations.
 * It explicitly tracks:
 * 1. Who has possession at any moment
 * 2. Ball state (LIVE vs DEAD)
 * 3. Legal timeout opportunities
 * 4. Legal substitution opportunities
 *
 * This system MUST be consulted before ANY timeout or substitution decision.
 *
 * Integration Points:
 * - src/simulation/game/quarterSimulation.ts (main game loop)
 * - src/simulation/systems/timeoutManager.ts (timeout legality)
 * - src/simulation/systems/substitutions.ts (substitution legality)
 *
 * @module simulation/possession/possessionState
 */

// =============================================================================
// ENUMERATIONS
// =============================================================================

/**
 * Ball state during game flow.
 */
export enum BallState {
  /** Play is active, ball is live */
  LIVE = 'LIVE',
  /** Play is stopped, whistle has blown */
  DEAD = 'DEAD',
}

/**
 * Reason why ball is dead (if applicable).
 */
export enum DeadBallReason {
  /** Shot made, opponent inbounding */
  MADE_BASKET = 'made_basket',
  /** Final FT made, opponent inbounding */
  MADE_FREE_THROW = 'made_free_throw',
  /** Final FT missed, rebound situation */
  MISSED_FINAL_FT = 'missed_final_ft',
  /** Whistle for foul (before FTs) */
  FOUL = 'foul',
  /** Out of bounds, travel, etc. */
  VIOLATION = 'violation',
  /** Timeout called */
  TIMEOUT = 'timeout',
  /** Quarter/game over */
  QUARTER_END = 'quarter_end',
  /** Ball is live */
  NONE = 'none',
}

// =============================================================================
// POSSESSION STATE MACHINE
// =============================================================================

/**
 * State summary for debugging
 */
export interface PossessionStateSummary {
  possessionTeam: 'home' | 'away';
  ballState: string;
  deadBallReason: string | null;
  canTimeoutHome: boolean;
  canTimeoutAway: boolean;
  canSubstitute: boolean;
}

/**
 * Tracks current possession and ball state throughout game flow.
 *
 * This is the SINGLE SOURCE OF TRUTH for possession tracking.
 *
 * State Variables:
 *     currentPossessionTeam: 'home' or 'away' - who has the ball
 *     ballState: BallState.LIVE or BallState.DEAD
 *     deadBallReason: DeadBallReason enum (or NONE if ball is live)
 *
 * Critical Methods:
 *     canCallTimeout(team) -> bool: Is timeout legal for this team?
 *     canSubstitute() -> bool: Are substitutions legal right now?
 *     updateAfterX(): State transition methods for each possession outcome
 *
 * NBA Rules Enforced:
 *     1. LIVE BALL: Only team with possession can call timeout
 *     2. DEAD BALL: Either team can call timeout
 *     3. Substitutions: Only during specific dead ball situations
 *        - After foul (before FTs)
 *        - After timeout
 *        - After violation
 *        - Between quarters
 *        - After missed final FT
 *        - NOT after made basket (unless timeout)
 *        - NOT after made FT
 */
export class PossessionState {
  private currentPossessionTeam: 'home' | 'away';
  private ballState: BallState;
  private deadBallReason: DeadBallReason;

  /**
   * Initialize possession state machine.
   *
   * @param startingTeam - 'home' or 'away' - team that starts with possession
   * @throws Error if startingTeam is not 'home' or 'away'
   */
  constructor(startingTeam: 'home' | 'away') {
    if (startingTeam !== 'home' && startingTeam !== 'away') {
      throw new Error(`startingTeam must be 'home' or 'away', got: ${startingTeam}`);
    }

    this.currentPossessionTeam = startingTeam;
    this.ballState = BallState.LIVE; // Game starts with live ball (jump ball/inbound)
    this.deadBallReason = DeadBallReason.NONE;
  }

  // =========================================================================
  // STATE QUERY METHODS
  // =========================================================================

  /**
   * Check if team can legally call timeout RIGHT NOW.
   *
   * NBA Rules:
   * - LIVE BALL: Only team with possession can call timeout
   * - DEAD BALL: Either team can call timeout
   *
   * @param team - 'home' or 'away'
   * @returns True if team can legally call timeout
   * @throws Error if team is not 'home' or 'away'
   *
   * @example
   * After defensive rebound (live ball):
   *   - Rebounding team: True (has possession)
   *   - Other team: False (doesn't have ball)
   *
   * After made basket (dead ball):
   *   - Either team: True (both can call timeout during inbound)
   */
  canCallTimeout(team: 'home' | 'away'): boolean {
    if (team !== 'home' && team !== 'away') {
      throw new Error(`team must be 'home' or 'away', got: ${team}`);
    }

    if (this.ballState === BallState.LIVE) {
      // Live ball: only team with possession can timeout
      return team === this.currentPossessionTeam;
    } else {
      // DEAD BALL: either team can timeout
      return true;
    }
  }

  /**
   * Check if substitutions are legal RIGHT NOW.
   *
   * Simplified Substitution Rules (per user request):
   * - Only during specific dead balls:
   *   - After timeout
   *   - After violation (turnover, out of bounds)
   *   - Between quarters
   * - NOT during:
   *   - Live play
   *   - After fouls (including before/after free throws)
   *   - After made basket
   *   - After made FT
   *
   * @returns True if substitutions are legal
   *
   * @example
   * After made basket: False (dead ball, but NOT a legal sub window)
   * After foul: False (M4.5 PHASE 4: user decision - no subs after fouls)
   * After made FT: False (dead ball, but no sub opportunity)
   * After timeout: True (dead ball, legal sub window)
   * After violation: True (dead ball, legal sub window)
   */
  canSubstitute(): boolean {
    if (this.ballState === BallState.LIVE) {
      // Live play: no substitutions
      return false;
    }

    // Dead ball: check reason
    // SIMPLIFIED SUBSTITUTION RULES (per user request):
    // Substitutions allowed ONLY during:
    // - Timeouts
    // - Violations (turnovers, out of bounds)
    // - Offensive fouls (dead ball turnovers)
    // - Quarter breaks
    // NOT after shooting fouls, free throws, or made baskets
    const legalSubReasons = [
      DeadBallReason.TIMEOUT,
      DeadBallReason.VIOLATION,
      DeadBallReason.FOUL, // FIX: Allow subs after offensive fouls (dead ball)
      DeadBallReason.QUARTER_END,
    ];

    return legalSubReasons.includes(this.deadBallReason);
  }

  /**
   * Get team that currently has possession.
   *
   * @returns 'home' or 'away'
   */
  getPossessionTeam(): 'home' | 'away' {
    return this.currentPossessionTeam;
  }

  /**
   * Get current ball state.
   *
   * @returns BallState.LIVE or BallState.DEAD
   */
  getBallState(): BallState {
    return this.ballState;
  }

  /**
   * Get reason ball is dead (if applicable).
   *
   * @returns DeadBallReason enum or DeadBallReason.NONE if ball is live
   */
  getDeadBallReason(): DeadBallReason {
    return this.deadBallReason;
  }

  // =========================================================================
  // STATE TRANSITION METHODS
  // =========================================================================

  /**
   * Update state after made basket.
   *
   * Made basket:
   * - Ball state: DEAD (during inbound)
   * - Possession: Opponent gets ball
   * - Dead ball reason: 'made_basket'
   * - Can timeout: Yes (either team)
   * - Can substitute: No (unless timeout called)
   *
   * @param scoringTeam - 'home' or 'away' - team that scored
   * @throws Error if scoringTeam is not 'home' or 'away'
   */
  updateAfterMadeBasket(scoringTeam: 'home' | 'away'): void {
    if (scoringTeam !== 'home' && scoringTeam !== 'away') {
      throw new Error(`scoringTeam must be 'home' or 'away', got: ${scoringTeam}`);
    }

    // Possession switches to opponent
    this.currentPossessionTeam = scoringTeam === 'home' ? 'away' : 'home';
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.MADE_BASKET;
  }

  /**
   * Update state after defensive rebound.
   *
   * Defensive rebound:
   * - Ball state: LIVE (play continues)
   * - Possession: Rebounding team
   * - Can timeout: Yes (only rebounding team)
   * - Can substitute: No (live play)
   *
   * @param reboundingTeam - 'home' or 'away' - team that got rebound
   * @throws Error if reboundingTeam is not 'home' or 'away'
   */
  updateAfterDefensiveRebound(reboundingTeam: 'home' | 'away'): void {
    if (reboundingTeam !== 'home' && reboundingTeam !== 'away') {
      throw new Error(`reboundingTeam must be 'home' or 'away', got: ${reboundingTeam}`);
    }

    this.currentPossessionTeam = reboundingTeam;
    this.ballState = BallState.LIVE;
    this.deadBallReason = DeadBallReason.NONE;
  }

  /**
   * Update state after offensive rebound.
   *
   * Offensive rebound:
   * - Ball state: LIVE (play continues)
   * - Possession: Same team (no change)
   * - Can timeout: Yes (only team with ball)
   * - Can substitute: No (live play)
   *
   * @param reboundingTeam - 'home' or 'away' - team that got rebound (validation only)
   * @throws Error if reboundingTeam is not 'home' or 'away'
   */
  updateAfterOffensiveRebound(reboundingTeam: 'home' | 'away'): void {
    if (reboundingTeam !== 'home' && reboundingTeam !== 'away') {
      throw new Error(`reboundingTeam must be 'home' or 'away', got: ${reboundingTeam}`);
    }

    // Possession should NOT change (offensive rebound)
    // But we update it anyway for safety (in case previous state was wrong)
    this.currentPossessionTeam = reboundingTeam;
    this.ballState = BallState.LIVE;
    this.deadBallReason = DeadBallReason.NONE;
  }

  /**
   * Update state after turnover.
   *
   * Turnover Classification:
   * 1. LIVE BALL (no subs): Stolen bad pass, stripped lost ball
   * 2. DEAD BALL + VIOLATION (subs allowed): Out of bounds, traveling, carry, etc.
   * 3. DEAD BALL + FOUL (no subs): Offensive foul
   *
   * @param teamThatGotBall - 'home' or 'away' - team that gained possession
   * @param turnoverType - Type of turnover ('bad_pass', 'lost_ball', 'offensive_foul', 'violation')
   * @param wasStolen - True if turnover was a steal (live ball), False otherwise
   * @throws Error if teamThatGotBall is not 'home' or 'away'
   */
  updateAfterTurnover(
    teamThatGotBall: 'home' | 'away',
    turnoverType: string = 'violation',
    wasStolen: boolean = false
  ): void {
    if (teamThatGotBall !== 'home' && teamThatGotBall !== 'away') {
      throw new Error(`teamThatGotBall must be 'home' or 'away', got: ${teamThatGotBall}`);
    }

    this.currentPossessionTeam = teamThatGotBall;

    // USER FIX: Distinguish between live ball (steals) and dead ball (violations/fouls)
    //
    // Substitution rules (per user): ONLY during timeout/violation/quarter-start
    // - Steals (bad_pass/lost_ball + stolen) → LIVE BALL, no subs
    // - Out of bounds (bad_pass/lost_ball + not stolen) → DEAD BALL (VIOLATION), subs allowed
    // - Violation (traveling, carry) → DEAD BALL (VIOLATION), subs allowed
    // - Offensive foul → DEAD BALL (FOUL), no subs (it's a foul, not a violation)

    if (wasStolen) {
      // Live ball steal: play continues immediately
      this.ballState = BallState.LIVE;
      this.deadBallReason = DeadBallReason.NONE;
    } else if (turnoverType === 'offensive_foul') {
      // Dead ball foul: whistle blown, but it's a FOUL not a VIOLATION
      // User said subs only during violations, not fouls
      this.ballState = BallState.DEAD;
      this.deadBallReason = DeadBallReason.FOUL;
    } else {
      // Dead ball violation: out of bounds, traveling, carry, etc.
      // Substitutions allowed
      this.ballState = BallState.DEAD;
      this.deadBallReason = DeadBallReason.VIOLATION;
    }
  }

  /**
   * Update state after foul (whistle blown).
   *
   * Foul:
   * - Ball state: DEAD (whistle)
   * - Possession: Team that was fouled (usually)
   * - Can timeout: Yes (either team)
   * - Can substitute: Yes (before FTs)
   *
   * @param teamWithBall - 'home' or 'away' - team with possession after foul
   * @throws Error if teamWithBall is not 'home' or 'away'
   */
  updateAfterFoul(teamWithBall: 'home' | 'away'): void {
    if (teamWithBall !== 'home' && teamWithBall !== 'away') {
      throw new Error(`teamWithBall must be 'home' or 'away', got: ${teamWithBall}`);
    }

    this.currentPossessionTeam = teamWithBall;
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.FOUL;
  }

  /**
   * Update state after made final free throw.
   *
   * Made FT:
   * - Ball state: DEAD (during inbound)
   * - Possession: Opponent gets ball
   * - Can timeout: Yes (either team)
   * - Can substitute: No (treat like made basket)
   *
   * @param shootingTeam - 'home' or 'away' - team that shot FT
   * @throws Error if shootingTeam is not 'home' or 'away'
   */
  updateAfterMadeFT(shootingTeam: 'home' | 'away'): void {
    if (shootingTeam !== 'home' && shootingTeam !== 'away') {
      throw new Error(`shootingTeam must be 'home' or 'away', got: ${shootingTeam}`);
    }

    this.currentPossessionTeam = shootingTeam === 'home' ? 'away' : 'home';
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.MADE_FREE_THROW;
  }

  /**
   * Update state after missed final free throw.
   *
   * Missed final FT:
   * - Ball state: DEAD (rebound situation, whistle for positioning)
   * - Possession: TBD (determined by rebound)
   * - Can timeout: Yes (either team)
   * - Can substitute: Yes (dead ball before rebound)
   *
   * NOTE: Possession team is NOT updated here - it will be set by
   * updateAfterOffensiveRebound() or updateAfterDefensiveRebound()
   */
  updateAfterMissedFT(): void {
    // Don't update possession yet - rebound will determine it
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.MISSED_FINAL_FT;
  }

  /**
   * Update state after violation (out of bounds, travel, etc.).
   *
   * Violation:
   * - Ball state: DEAD (whistle)
   * - Possession: Opponent gets ball
   * - Can timeout: Yes (either team)
   * - Can substitute: Yes
   *
   * @param teamThatGotBall - 'home' or 'away' - team that gains possession
   * @throws Error if teamThatGotBall is not 'home' or 'away'
   */
  updateAfterViolation(teamThatGotBall: 'home' | 'away'): void {
    if (teamThatGotBall !== 'home' && teamThatGotBall !== 'away') {
      throw new Error(`teamThatGotBall must be 'home' or 'away', got: ${teamThatGotBall}`);
    }

    this.currentPossessionTeam = teamThatGotBall;
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.VIOLATION;
  }

  /**
   * Update state after ball goes out of bounds (blocked shots, etc.).
   *
   * Out of Bounds:
   * - Ball state: DEAD (whistle)
   * - Possession: Team that gets inbound
   * - Dead ball reason: VIOLATION (substitutions allowed)
   * - Can timeout: Yes (either team)
   * - Can substitute: Yes (violation window)
   *
   * @param teamThatGotBall - 'home' or 'away' - team that gets possession
   * @throws Error if teamThatGotBall is not 'home' or 'away'
   */
  updateAfterOutOfBounds(teamThatGotBall: 'home' | 'away'): void {
    if (teamThatGotBall !== 'home' && teamThatGotBall !== 'away') {
      throw new Error(`teamThatGotBall must be 'home' or 'away', got: ${teamThatGotBall}`);
    }

    this.currentPossessionTeam = teamThatGotBall;
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.VIOLATION;
  }

  /**
   * Update state after timeout.
   *
   * Timeout:
   * - Ball state: DEAD
   * - Possession: Same team (no change)
   * - Can timeout: No (already in timeout)
   * - Can substitute: Yes
   */
  updateAfterTimeout(): void {
    // Possession doesn't change during timeout
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.TIMEOUT;
  }

  /**
   * Start new possession (inbound, ball becomes live).
   *
   * Called when:
   * - After inbound pass is made (following made basket, violation, etc.)
   * - After jump ball
   * - After timeout ends and play resumes
   */
  startNewPossession(): void {
    this.ballState = BallState.LIVE;
    this.deadBallReason = DeadBallReason.NONE;
  }

  /**
   * Mark quarter as ended.
   *
   * Quarter end:
   * - Ball state: DEAD
   * - Possession: Preserved for next quarter (alternates)
   * - Can timeout: No (between quarters)
   * - Can substitute: Yes (quarter break)
   */
  endQuarter(): void {
    this.ballState = BallState.DEAD;
    this.deadBallReason = DeadBallReason.QUARTER_END;
  }

  // =========================================================================
  // DEBUGGING / INSPECTION
  // =========================================================================

  /**
   * Get human-readable summary of current state (for debugging).
   *
   * @returns Dict with current state info
   */
  getStateSummary(): PossessionStateSummary {
    return {
      possessionTeam: this.currentPossessionTeam,
      ballState: this.ballState,
      deadBallReason:
        this.deadBallReason !== DeadBallReason.NONE ? this.deadBallReason : null,
      canTimeoutHome: this.canCallTimeout('home'),
      canTimeoutAway: this.canCallTimeout('away'),
      canSubstitute: this.canSubstitute(),
    };
  }

  /**
   * String representation for debugging.
   */
  toString(): string {
    const reason =
      this.deadBallReason !== DeadBallReason.NONE ? this.deadBallReason : null;
    return `PossessionState(possession=${this.currentPossessionTeam}, ball=${this.ballState}, reason=${reason})`;
  }
}
