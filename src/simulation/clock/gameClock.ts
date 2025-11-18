/**
 * Basketball Simulator - Game Clock System
 *
 * Manages quarter clock and possession duration calculation.
 *
 * Key Responsibilities:
 * 1. Track time remaining in quarter (12 minutes = 720 seconds)
 * 2. Calculate realistic possession durations (based on pace)
 * 3. Handle end-of-quarter logic
 * 4. Prevent negative time values
 *
 * Integrates with:
 * - src/simulation/game/quarterSimulation.ts (main loop)
 * - src/simulation/playByPlay/playByPlay.ts (timestamps)
 *
 * @module simulation/clock/gameClock
 */

// =============================================================================
// POSSESSION DURATION CALCULATION
// =============================================================================

/**
 * Calculate possession duration in seconds (probabilistic with variance).
 *
 * Uses triangular distribution to weight toward target averages while
 * allowing variance. Fast pace teams CAN have 20s possessions occasionally.
 *
 * @param pace - 'fast', 'standard', 'slow'
 * @param isTransition - True if possession is transition (faster)
 * @returns Possession duration in seconds (integer)
 *
 * Target Averages & Ranges (M4.5 TUNED, M4.6 UPDATED):
 *     Fast pace: 12.8s avg (range 7.7-17.9s, mode 12.8s) → 113 poss/team/game (+12.5%)
 *     Standard pace: 14.4s avg (range 8.6-20.2s, mode 14.4s) → 100 poss/team/game
 *     Slow pace: 16.5s avg (range 9.9-23.1s, mode 16.5s) → 87 poss/team/game (-12.5%)
 *     Transition: 8s avg (range 6-12s, fast break)
 *
 * Distribution: Triangular (weighted toward mode, allows outliers)
 *
 * M4.5 Tuning Notes:
 *     - Original settings produced ~88 possessions/team/game (standard pace)
 *     - Adjusted to match NBA target of ~100 possessions/team/game
 *     - Reduced average possession duration by ~12% across all pace settings
 *
 * M4.6 Tuning Notes:
 *     - Increased pace differentiation to meet specification (+/-10-15%)
 *     - FAST pace now 12.5% faster (was ~5%), SLOW pace now 12.5% slower (was ~5%)
 *     - Verified via tactical validation testing (150 games)
 *
 * @example
 * ```typescript
 * calculatePossessionDuration('standard', false) // Returns ~14 seconds
 * calculatePossessionDuration('fast', false) // Returns ~13 seconds
 * calculatePossessionDuration('slow', false) // Returns ~15 seconds
 * calculatePossessionDuration('standard', true) // Returns ~8 seconds (transition)
 * ```
 */
export function calculatePossessionDuration(
  pace: 'fast' | 'standard' | 'slow',
  isTransition: boolean = false
): number {
  // Transition possessions are fast breaks
  if (isTransition) {
    // Fast break: 6-12 seconds, mode at 8
    return Math.round(triangular(6, 12, 8));
  }

  // M4.5 TUNED: Pace-specific ranges targeting NBA possession counts
  // M4.6 UPDATE: Increased pace differentiation to meet +/-10-15% spec
  let duration: number;
  if (pace === 'fast') {
    // Fast pace: 7.7-17.9s, mode 12.8s → ~113 possessions/team/game (+12.5%)
    duration = triangular(7.7, 17.9, 12.8);
  } else if (pace === 'standard') {
    // Standard pace: 8.6-20.2s, mode 14.4s → ~100 possessions/team/game
    duration = triangular(8.6, 20.2, 14.4);
  } else if (pace === 'slow') {
    // Slow pace: 9.9-23.1s, mode 16.5s → ~87 possessions/team/game (-12.5%)
    duration = triangular(9.9, 23.1, 16.5);
  } else {
    throw new Error(`Invalid pace: ${pace}. Must be 'fast', 'standard', or 'slow'`);
  }

  return Math.round(duration);
}

/**
 * Triangular distribution random number generator.
 *
 * Generates random numbers with a triangular distribution, weighted toward the mode.
 *
 * @param low - Minimum value
 * @param high - Maximum value
 * @param mode - Most likely value (peak of distribution)
 * @returns Random number from triangular distribution
 *
 * @example
 * ```typescript
 * triangular(5, 15, 10) // Returns value between 5-15, most likely near 10
 * ```
 */
function triangular(low: number, high: number, mode: number): number {
  const u = Math.random();
  const c = (mode - low) / (high - low);

  if (u < c) {
    return low + Math.sqrt(u * (high - low) * (mode - low));
  } else {
    return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
  }
}

/**
 * Estimate total possessions for quarter based on pace.
 *
 * @param pace - 'fast', 'standard', 'slow'
 * @returns Estimated possession count (integer)
 *
 * Calculation (M4.5 TUNED, M4.6 UPDATED):
 *     12 minutes = 720 seconds
 *     - fast: 720/12.8 ≈ 56.3 possessions (total) → 28.1 per team (+12.5%)
 *     - standard: 720/14.4 = 50.0 possessions (total) → 25.0 per team
 *     - slow: 720/16.5 ≈ 43.6 possessions (total) → 21.8 per team (-12.5%)
 *
 * Note: M4.6 increased pace differentiation to meet +/-10-15% specification.
 *
 * @example
 * ```typescript
 * estimatePossessionsPerQuarter('fast') // Returns 56
 * estimatePossessionsPerQuarter('standard') // Returns 50
 * estimatePossessionsPerQuarter('slow') // Returns 44
 * ```
 */
export function estimatePossessionsPerQuarter(pace: 'fast' | 'standard' | 'slow'): number {
  const quarterSeconds = 720;

  let avgDuration: number;
  if (pace === 'fast') {
    avgDuration = 12.8; // M4.6 UPDATED for +12.5% possessions
  } else if (pace === 'standard') {
    avgDuration = 14.4; // M4.5 TUNED
  } else if (pace === 'slow') {
    avgDuration = 16.5; // M4.6 UPDATED for -12.5% possessions
  } else {
    throw new Error(`Invalid pace: ${pace}. Must be 'fast', 'standard', or 'slow'`);
  }

  return Math.round(quarterSeconds / avgDuration);
}

// =============================================================================
// GAME CLOCK CLASS
// =============================================================================

/**
 * Possession timing information for quarter simulation.
 */
export interface PossessionTiming {
  /** Possession number */
  possessionNum: number;
  /** Start time (formatted MM:SS) */
  startTime: string;
  /** Duration in seconds */
  duration: number;
  /** End time (formatted MM:SS) */
  endTime: string;
}

/**
 * Manages quarter clock and possession counting.
 *
 * Tracks time remaining and provides methods for time management.
 */
export class GameClock {
  private totalSeconds: number;
  private elapsedSeconds: number;

  /**
   * Initialize game clock.
   *
   * @param quarterLengthMinutes - Length of quarter in minutes (default 12)
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.getTimeRemaining() // Returns 720
   * clock.formatTime() // Returns '12:00'
   * ```
   */
  constructor(quarterLengthMinutes: number = 12) {
    this.totalSeconds = quarterLengthMinutes * 60;
    this.elapsedSeconds = 0;
  }

  /**
   * Advance clock by duration.
   *
   * @param duration - Seconds to deduct from clock
   * @returns Time remaining after tick (clamped to 0)
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.tick(30) // Returns 690
   * clock.tick(700) // Returns 0
   * clock.tick(10) // Returns 0 (already at 0)
   * ```
   */
  tick(duration: number): number {
    this.elapsedSeconds += duration;

    // Never go negative
    if (this.elapsedSeconds > this.totalSeconds) {
      this.elapsedSeconds = this.totalSeconds;
    }

    return this.getTimeRemaining();
  }

  /**
   * Get current time remaining.
   *
   * @returns Seconds remaining (0-720)
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.tick(120);
   * clock.getTimeRemaining() // Returns 600
   * ```
   */
  getTimeRemaining(): number {
    const remaining = this.totalSeconds - this.elapsedSeconds;
    return Math.max(0, remaining);
  }

  /**
   * Check if quarter has ended.
   *
   * @returns True if time_remaining <= 0
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.isQuarterOver() // Returns false
   * clock.tick(720);
   * clock.isQuarterOver() // Returns true
   * ```
   */
  isQuarterOver(): boolean {
    return this.getTimeRemaining() <= 0;
  }

  /**
   * Check if this is the final possession of quarter.
   *
   * Heuristic: If time_remaining < avg_possession_duration, it's likely final.
   *
   * @param avgPossessionDuration - Expected possession length (default 30 sec)
   * @returns True if this should be the last possession
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.isFinalPossession() // Returns false
   * clock.tick(695); // 25 seconds left
   * clock.isFinalPossession() // Returns true
   * ```
   */
  isFinalPossession(avgPossessionDuration: number = 30): boolean {
    return this.getTimeRemaining() < avgPossessionDuration;
  }

  /**
   * Reset clock to start of quarter.
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.tick(300);
   * clock.reset();
   * clock.getTimeRemaining() // Returns 720
   * ```
   */
  reset(): void {
    this.elapsedSeconds = 0;
  }

  /**
   * Format time remaining as MM:SS.
   *
   * @returns Formatted string (e.g., "11:45", "08:12", "00:23")
   *
   * @example
   * ```typescript
   * const clock = new GameClock();
   * clock.formatTime() // Returns '12:00'
   * clock.tick(195);
   * clock.formatTime() // Returns '08:45'
   * clock.tick(525);
   * clock.formatTime() // Returns '00:00'
   * ```
   */
  formatTime(): string {
    const remaining = this.getTimeRemaining();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Alias for formatTime() for backwards compatibility.
   *
   * @returns Formatted string (e.g., "11:45")
   */
  getTimeRemainingFormatted(): string {
    return this.formatTime();
  }

  /**
   * Alias for tick() for backwards compatibility.
   *
   * @param seconds - Seconds to advance
   */
  advanceClock(seconds: number): void {
    this.tick(seconds);
  }
}

// =============================================================================
// QUARTER FLOW HELPERS
// =============================================================================

/**
 * Determine if quarter should end.
 *
 * Rules:
 * - If possession not started and time < 25 sec: end quarter
 * - If possession started: allow it to complete
 * - Never cut off mid-possession
 *
 * @param clock - GameClock instance
 * @param possessionStarted - True if possession has begun
 * @returns True if quarter should end now
 *
 * @example
 * ```typescript
 * const clock = new GameClock();
 * clock.tick(695); // 25 seconds left
 * shouldEndQuarter(clock, false) // Returns false
 * clock.tick(5); // 20 seconds left
 * shouldEndQuarter(clock, false) // Returns true
 * shouldEndQuarter(clock, true) // Returns false (possession in progress)
 * ```
 */
export function shouldEndQuarter(clock: GameClock, possessionStarted: boolean): boolean {
  // If possession already started, let it finish
  if (possessionStarted) {
    return false;
  }

  // If time expired, end quarter
  if (clock.isQuarterOver()) {
    return true;
  }

  // If less than 25 seconds and no possession started, end quarter
  // (not enough time for a meaningful possession)
  if (clock.getTimeRemaining() < 25) {
    return true;
  }

  return false;
}

/**
 * Simulate possession timing for entire quarter.
 *
 * @param pace - 'fast', 'standard', 'slow'
 * @param seed - Random seed for reproducibility (optional)
 * @returns List of possession timing info
 *
 * @example
 * ```typescript
 * const results = simulateQuarterClock('standard', 42);
 * // Returns array of possession timings like:
 * // [
 * //   { possessionNum: 1, startTime: '12:00', duration: 28, endTime: '11:32' },
 * //   ...
 * // ]
 * ```
 */
export function simulateQuarterClock(
  pace: 'fast' | 'standard' | 'slow',
  seed?: number
): PossessionTiming[] {
  if (seed !== undefined) {
    // Note: JavaScript's Math.random() doesn't support seeding directly
    // This is a limitation - for deterministic results, use a seeded RNG library
    console.warn('Seeding not implemented in TypeScript version');
  }

  const clock = new GameClock();
  const possessions: PossessionTiming[] = [];
  let possessionNum = 1;

  while (!shouldEndQuarter(clock, false)) {
    const startTime = clock.formatTime();
    const duration = calculatePossessionDuration(pace);

    // Advance clock
    clock.tick(duration);
    const endTime = clock.formatTime();

    possessions.push({
      possessionNum,
      startTime,
      duration,
      endTime,
    });

    possessionNum++;
  }

  return possessions;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validation statistics for possession counts.
 */
export interface ValidationStats {
  /** Pace setting */
  pace: 'fast' | 'standard' | 'slow';
  /** Expected possession count */
  expected: number;
  /** Minimum observed count */
  min: number;
  /** Maximum observed count */
  max: number;
  /** Average observed count */
  avg: number;
  /** All observed counts */
  allCounts: number[];
}

/**
 * Validate that possession counts match expected ranges.
 *
 * @param pace - 'fast', 'standard', 'slow'
 * @param numSimulations - Number of quarters to simulate
 * @param seed - Random seed for reproducibility
 * @returns Validation statistics
 *
 * Expected Ranges:
 *     - Fast: 60-85 possessions (avg ~72)
 *     - Standard: 40-56 possessions (avg ~48)
 *     - Slow: 30-42 possessions (avg ~36)
 */
export function validatePossessionCounts(
  pace: 'fast' | 'standard' | 'slow',
  numSimulations: number = 100,
  seed?: number
): ValidationStats {
  if (seed !== undefined) {
    console.warn('Seeding not implemented in TypeScript version');
  }

  const counts: number[] = [];

  for (let i = 0; i < numSimulations; i++) {
    const possessions = simulateQuarterClock(pace);
    counts.push(possessions.length);
  }

  return {
    pace,
    expected: estimatePossessionsPerQuarter(pace),
    min: Math.min(...counts),
    max: Math.max(...counts),
    avg: counts.reduce((sum, count) => sum + count, 0) / counts.length,
    allCounts: counts,
  };
}
