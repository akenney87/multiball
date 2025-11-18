/**
 * Basketball Simulator - Stamina Management System
 *
 * Handles stamina tracking, depletion, and recovery for all players across a quarter.
 *
 * Key Responsibilities:
 * 1. Track current stamina for all players (active + bench)
 * 2. Apply per-possession stamina costs (based on pace, role)
 * 3. Apply exponential bench recovery
 * 4. Generate degraded player copies (with reduced attributes)
 * 5. Validate stamina bounds [0, 100]
 *
 * Integrates with:
 * - src/simulation/core/probability.ts (applyStaminaToPlayer)
 * - src/simulation/game/quarterSimulation.ts (called each possession)
 *
 * @module simulation/stamina/staminaManager
 */

import { applyStaminaToPlayer } from '../core/probability';
import {
  STAMINA_RECOVERY_RATE,
  STAMINA_DRAIN_RATE_MAX_MODIFIER,
  STAMINA_RECOVERY_RATE_MAX_MODIFIER,
} from '../constants';

// =============================================================================
// STAMINA COST CALCULATION
// =============================================================================

/**
 * Calculate stamina cost for a single possession.
 *
 * @param pace - 'fast', 'standard', 'slow'
 * @param isScoringOption - True if player is scoring option #1/2/3
 * @param isTransition - True if possession is transition
 * @param playerStaminaAttribute - Player's stamina rating (1-100, default 50 for average)
 * @param playerAcceleration - Player's acceleration (1-100, default 50 for average)
 * @param playerTopSpeed - Player's top_speed (1-100, default 50 for average)
 * @returns Stamina cost (positive float)
 *
 * Formula (Milestone 2 specification + M4.5 Phase 4B + PHASE 1 + PHASE 3B):
 *     Base cost: 0.8 stamina per possession
 *     Pace modifier: fast +0.3, standard +0.0, slow -0.3
 *     Scoring option bonus: +0.2 (higher usage = more fatigue)
 *     Transition bonus: +0.1 (more running)
 *     PHASE 3B stamina drain rate modifier: ±15% based on player endurance
 *     Speed efficiency modifier: ±10% based on acceleration + top_speed
 *
 * PHASE 3B: Stamina Drain Rate Modifier (replaces M4.5 Phase 4B)
 *     - High stamina (90): cost × 0.88 (drains 12% slower)
 *     - Average stamina (50): cost × 1.00 (baseline)
 *     - Low stamina (10): cost × 1.12 (drains 12% faster)
 *
 * PHASE 1: Speed Efficiency Integration
 *     - Fast players (accel+speed avg 80): cost × 0.90 (10% more efficient)
 *     - Average players (accel+speed avg 50): cost × 1.00 (baseline)
 *     - Slow players (accel+speed avg 20): cost × 1.10 (10% less efficient)
 *
 * @example
 * ```typescript
 * // Standard pace, non-option, 50 stamina, 50 speed: 0.8 × 1.0 × 1.0 = 0.8
 * calculateStaminaCost('standard', false, false, 50, 50, 50) // Returns 0.8
 *
 * // Standard pace, non-option, 90 stamina, 80 speed: 0.8 × 0.88 × 0.9 = 0.634 (elite endurance + speed)
 * calculateStaminaCost('standard', false, false, 90, 80, 80) // Returns 0.634
 *
 * // Fast pace, scoring option #1, 50 stamina, 50 speed: (0.8 + 0.3 + 0.2) × 1.0 × 1.0 = 1.3
 * calculateStaminaCost('fast', true, false, 50, 50, 50) // Returns 1.3
 * ```
 */
export function calculateStaminaCost(
  pace: 'fast' | 'standard' | 'slow',
  isScoringOption: boolean = false,
  isTransition: boolean = false,
  playerStaminaAttribute: number = 50,
  playerAcceleration: number = 50,
  playerTopSpeed: number = 50
): number {
  const baseCost = 0.8;

  // Pace modifier
  let paceModifier = 0.0;
  if (pace === 'fast') {
    paceModifier = 0.3;
  } else if (pace === 'slow') {
    paceModifier = -0.3;
  }
  // 'standard' remains 0.0

  // Scoring option bonus
  const scoringOptionBonus = isScoringOption ? 0.2 : 0.0;

  // Transition bonus
  const transitionBonus = isTransition ? 0.1 : 0.0;

  const totalCost = baseCost + paceModifier + scoringOptionBonus + transitionBonus;

  // PHASE 3B: Apply stamina attribute DRAIN RATE modifier (±15% range)
  // Stamina attribute affects how fast a player fatigues, not outcomes
  // Formula: 1.0 + ((50 - stamina_attr) / 50) * STAMINA_DRAIN_RATE_MAX_MODIFIER
  // High stamina = slower drain (cost reduced)
  // Low stamina = faster drain (cost increased)
  const staminaDrainRateModifier =
    1.0 + ((50 - playerStaminaAttribute) / 50.0) * STAMINA_DRAIN_RATE_MAX_MODIFIER;
  // stamina=90: 1.0 + (-40/50)*0.15 = 1.0 - 0.12 = 0.88 (12% slower drain) ✓
  // stamina=50: 1.0 + (0/50)*0.15 = 1.0 (baseline) ✓
  // stamina=10: 1.0 + (40/50)*0.15 = 1.0 + 0.12 = 1.12 (12% faster drain) ✓

  // PHASE 1: Speed efficiency modifier (acceleration + top_speed)
  // Fast players are more efficient with their movements, use less energy
  // Formula: avg_speed = (acceleration + top_speed) / 2
  // speed_efficiency_modifier = 1.0 - (avg_speed - 50) * 0.002
  // avg_speed=80: 1.0 - 30*0.002 = 0.94 (6% more efficient)
  // avg_speed=50: 1.0 - 0 = 1.0 (baseline)
  // avg_speed=20: 1.0 - (-30)*0.002 = 1.06 (6% less efficient)
  const avgSpeed = (playerAcceleration + playerTopSpeed) / 2.0;
  const speedEfficiencyModifier = 1.0 - (avgSpeed - 50) * 0.002; // ±10% for ±50 difference

  const totalCostWithModifiers = totalCost * staminaDrainRateModifier * speedEfficiencyModifier;

  return Math.max(0.0, totalCostWithModifiers); // Cannot have negative cost
}

/**
 * Calculate stamina recovery for bench player (exponential curve).
 *
 * @param currentStamina - Current stamina value (0-100)
 * @param minutesOnBench - Time spent on bench in minutes
 * @param playerStaminaAttribute - Player's stamina rating (1-100, default 50 for average)
 * @returns Recovered stamina amount (positive float)
 *
 * Formula (from basketball_sim.md Section 11.3 + M4.5 Phase 4B + PHASE 3B):
 *     recovery_per_minute = 8 * (1 - current_stamina / 100) * recovery_rate_modifier
 *     total_recovery = recovery_per_minute * minutes_on_bench
 *
 * PHASE 3B: Stamina Recovery Rate Modifier (replaces M4.5 Phase 4B)
 *     - High stamina (90): recovery × 1.104 (recovers 10.4% faster)
 *     - Average stamina (50): recovery × 1.00 (baseline)
 *     - Low stamina (10): recovery × 0.896 (recovers 10.4% slower)
 *
 * Characteristics:
 *     - Exponential diminishing returns (recover faster when more tired)
 *     - Stamina attribute affects recovery RATE (high endurance = faster bounce-back)
 *     - At stamina=0, 50 attr: recover 8 per minute
 *     - At stamina=0, 90 attr: recover 8.83 per minute (elite recovery)
 *     - At stamina=50, 50 attr: recover 4 per minute
 *     - At stamina=90, 50 attr: recover 0.8 per minute
 *     - Never exceeds 100
 *
 * @example
 * ```typescript
 * // current=50, minutes=1.0, stamina_attr=50 → recovery = 8 * 0.5 * 1.0 * 1.0 = 4.0
 * recoverStamina(50, 1.0, 50) // Returns 4.0
 *
 * // current=50, minutes=1.0, stamina_attr=90 → recovery = 8 * 0.5 * 1.0 * 1.104 = 4.416
 * recoverStamina(50, 1.0, 90) // Returns 4.416
 *
 * // current=50, minutes=1.0, stamina_attr=10 → recovery = 8 * 0.5 * 1.0 * 0.896 = 3.584
 * recoverStamina(50, 1.0, 10) // Returns 3.584
 *
 * // current=80, minutes=2.0, stamina_attr=50 → recovery = 8 * 0.2 * 2.0 * 1.0 = 3.2
 * recoverStamina(80, 2.0, 50) // Returns 3.2
 * ```
 */
export function recoverStamina(
  currentStamina: number,
  minutesOnBench: number,
  playerStaminaAttribute: number = 50
): number {
  // Clamp current stamina to valid range
  currentStamina = Math.max(0.0, Math.min(100.0, currentStamina));

  // PHASE 3B: Apply stamina attribute RECOVERY RATE modifier (±13% range)
  // Stamina attribute affects how fast a player recovers on bench
  // Formula: 1.0 + ((stamina_attr - 50) / 50) * STAMINA_RECOVERY_RATE_MAX_MODIFIER
  // High stamina = faster recovery (recovery increased)
  // Low stamina = slower recovery (recovery decreased)
  const staminaRecoveryRateModifier =
    1.0 + ((playerStaminaAttribute - 50) / 50.0) * STAMINA_RECOVERY_RATE_MAX_MODIFIER;
  // stamina=90: 1.0 + (40/50)*0.13 = 1.0 + 0.104 = 1.104 (10.4% faster recovery) ✓
  // stamina=50: 1.0 + (0/50)*0.13 = 1.0 (baseline) ✓
  // stamina=10: 1.0 + (-40/50)*0.13 = 1.0 - 0.104 = 0.896 (10.4% slower recovery) ✓

  // Exponential recovery formula with stamina attribute modifier
  const recoveryPerMinute =
    STAMINA_RECOVERY_RATE * (1.0 - currentStamina / 100.0) * staminaRecoveryRateModifier;
  const totalRecovery = recoveryPerMinute * minutesOnBench;

  return Math.max(0.0, totalRecovery); // Cannot recover negative
}

// =============================================================================
// STAMINA TRACKER CLASS
// =============================================================================

/**
 * Player interface for stamina tracking
 */
interface Player {
  name: string;
  stamina: number;
  acceleration: number;
  top_speed: number;
  [key: string]: number | string;
}

/**
 * Centralized stamina management for all players in a quarter.
 *
 * Tracks current stamina for all players (active + bench) and provides
 * methods to apply costs, recover, and generate degraded player copies.
 */
export class StaminaTracker {
  private staminaState: Map<string, number>;
  private originalPlayers: Map<string, Player>;
  private minutesPlayed: Map<string, number>;

  /**
   * Initialize stamina tracker with full roster.
   *
   * @param allPlayers - List of all players (both teams, full roster)
   *                     Each player must have 'name' and 'stamina' attributes
   */
  constructor(allPlayers: Player[]) {
    this.staminaState = new Map();
    this.originalPlayers = new Map();
    this.minutesPlayed = new Map();

    for (const player of allPlayers) {
      const playerName = player.name;

      // BUG FIX: All players start at 100 stamina regardless of their stamina attribute
      // The stamina attribute only affects drain/recovery rates, not initial values
      const initialStamina = 100.0;
      this.staminaState.set(playerName, initialStamina);

      // Store original player dict for reference
      this.originalPlayers.set(playerName, player);

      // Initialize minutes played to 0
      this.minutesPlayed.set(playerName, 0.0);
    }
  }

  /**
   * Get current stamina value for a player.
   *
   * @param playerName - Name of player
   * @returns Current stamina (0-100)
   * @throws Error if player not found
   */
  getCurrentStamina(playerName: string): number {
    const stamina = this.staminaState.get(playerName);
    if (stamina === undefined) {
      throw new Error(`Player '${playerName}' not found in stamina tracker`);
    }
    return stamina;
  }

  /**
   * Apply stamina cost to all active players after a possession.
   *
   * Modifies staminaState in-place.
   *
   * @param activePlayers - List of 5 active players (offense + defense)
   * @param pace - 'fast', 'standard', 'slow'
   * @param scoringOptions - List of player names who are scoring options
   * @param isTransition - True if possession was transition
   */
  applyPossessionCost(
    activePlayers: Player[],
    pace: 'fast' | 'standard' | 'slow',
    scoringOptions: string[] = [],
    isTransition: boolean = false
  ): void {
    for (const player of activePlayers) {
      const playerName = player.name;

      // Check if player is a scoring option
      const isScoringOption = scoringOptions.includes(playerName);

      // M4.5 PHASE 4B: Get player's stamina attribute (endurance rating 1-100)
      const playerStaminaAttr = player.stamina;

      // PHASE 1: Get player's speed attributes for efficiency calculation
      const playerAccel = player.acceleration;
      const playerSpeed = player.top_speed;

      // Calculate stamina cost with player's attributes
      const cost = calculateStaminaCost(
        pace,
        isScoringOption,
        isTransition,
        playerStaminaAttr,
        playerAccel,
        playerSpeed
      );

      // Deduct from stamina state
      const current = this.getCurrentStamina(playerName);
      const newStamina = current - cost;

      // Clamp to [0, 100]
      this.staminaState.set(playerName, Math.max(0.0, Math.min(100.0, newStamina)));
    }
  }

  /**
   * Apply stamina recovery to all bench players.
   *
   * Modifies staminaState in-place.
   *
   * @param benchPlayers - List of players currently on bench
   * @param minutesElapsed - Time elapsed since last recovery (in minutes)
   */
  recoverBenchStamina(benchPlayers: Player[], minutesElapsed: number): void {
    for (const player of benchPlayers) {
      const playerName = player.name;

      // Get current stamina
      const current = this.getCurrentStamina(playerName);

      // M4.5 PHASE 4B: Get player's stamina attribute (endurance rating 1-100)
      const playerStaminaAttr = player.stamina;

      // Calculate recovery with player's stamina attribute
      const recovery = recoverStamina(current, minutesElapsed, playerStaminaAttr);

      // Add to stamina state
      const newStamina = current + recovery;

      // Clamp to [0, 100]
      this.staminaState.set(playerName, Math.max(0.0, Math.min(100.0, newStamina)));
    }
  }

  /**
   * Generate player copy with attributes degraded by current stamina.
   *
   * Uses applyStaminaToPlayer() from probability.ts.
   *
   * @param player - Original player dict
   * @returns New player dict with degraded attributes (if stamina < 80)
   *
   * Note:
   *     Does NOT modify staminaState or original player.
   *     Creates a new dict with current stamina value applied.
   */
  getDegradedPlayer(player: Player): Record<string, number | string> {
    const playerName = player.name;
    const currentStamina = this.getCurrentStamina(playerName);

    // Use the stamina degradation function from probability.ts
    const degradedPlayer = applyStaminaToPlayer(
      player as unknown as Record<string, number>,
      currentStamina
    );

    return degradedPlayer;
  }

  /**
   * Add playing time to a player's minutes tracker.
   *
   * @param playerName - Name of player
   * @param seconds - Seconds played to add
   * @throws Error if player not found
   */
  addMinutes(playerName: string, seconds: number): void {
    if (!this.minutesPlayed.has(playerName)) {
      throw new Error(`Player '${playerName}' not found in minutes tracker`);
    }

    // Convert seconds to minutes
    const minutes = seconds / 60.0;
    const current = this.minutesPlayed.get(playerName)!;
    this.minutesPlayed.set(playerName, current + minutes);
  }

  /**
   * Get total minutes played for a player.
   *
   * @param playerName - Name of player
   * @returns Minutes played (in minutes, not seconds)
   * @throws Error if player not found
   */
  getMinutesPlayed(playerName: string): number {
    const minutes = this.minutesPlayed.get(playerName);
    if (minutes === undefined) {
      throw new Error(`Player '${playerName}' not found in minutes tracker`);
    }
    return minutes;
  }

  /**
   * Reset player stamina to original value.
   *
   * Useful for testing or quarter breaks.
   *
   * @param playerName - Name of player to reset
   * @throws Error if player not found
   */
  resetStamina(playerName: string): void {
    const originalPlayer = this.originalPlayers.get(playerName);
    if (!originalPlayer) {
      throw new Error(`Player '${playerName}' not found in original players`);
    }

    const originalStamina = originalPlayer.stamina || 100.0;
    this.staminaState.set(playerName, originalStamina);
  }

  /**
   * Reset all stamina to 100 for new quarter, keep minutes played.
   *
   * Used at quarter breaks to refresh stamina while maintaining
   * game-long minutes tracking.
   */
  resetQuarter(): void {
    for (const playerName of this.staminaState.keys()) {
      this.staminaState.set(playerName, 100.0);
    }
  }

  /**
   * Reset all stamina to 100 and clear minutes played for new game.
   *
   * Used at game start to completely reset all tracking.
   */
  resetGame(): void {
    for (const playerName of this.staminaState.keys()) {
      this.staminaState.set(playerName, 100.0);
      this.minutesPlayed.set(playerName, 0.0);
    }
  }

  /**
   * Get current stamina for all players.
   *
   * @returns Object mapping player_name -> current_stamina
   */
  getAllStaminaValues(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [playerName, stamina] of this.staminaState.entries()) {
      result[playerName] = stamina;
    }
    return result;
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR INTEGRATION
// =============================================================================

/**
 * Deplete stamina for active players after possession.
 *
 * Convenience wrapper for StaminaTracker.applyPossessionCost().
 *
 * @param tracker - StaminaTracker instance
 * @param activePlayerNames - List of player names (strings) who were active
 * @param pace - 'fast', 'standard', 'slow'
 * @param scoringOptions - List of player names who are scoring options
 */
export function applyStaminaCost(
  tracker: StaminaTracker,
  activePlayerNames: string[],
  pace: 'fast' | 'standard' | 'slow',
  scoringOptions: string[]
): void {
  // Convert player names to player dicts
  const activePlayerDicts: Player[] = [];
  for (const playerName of activePlayerNames) {
    const player = (tracker as any).originalPlayers.get(playerName);
    if (player) {
      activePlayerDicts.push(player);
    }
  }

  tracker.applyPossessionCost(activePlayerDicts, pace, scoringOptions, false);
}

/**
 * Recover stamina for bench players.
 *
 * Note: This function assumes a default recovery period.
 * For precise control, use tracker.recoverBenchStamina() directly.
 *
 * @param tracker - StaminaTracker instance
 * @param benchPlayerNames - List of player names (strings) on bench
 */
export function recoverBenchStamina(
  tracker: StaminaTracker,
  benchPlayerNames: string[]
): void {
  // Default recovery period: 1 possession (~30 seconds = 0.5 minutes)
  const defaultRecoveryMinutes = 0.5;

  // Convert player names to player dicts
  const benchPlayerDicts: Player[] = [];
  for (const playerName of benchPlayerNames) {
    const player = (tracker as any).originalPlayers.get(playerName);
    if (player) {
      benchPlayerDicts.push(player);
    }
  }

  tracker.recoverBenchStamina(benchPlayerDicts, defaultRecoveryMinutes);
}

/**
 * Return team with stamina-degraded attributes.
 *
 * Creates new player dicts with attributes modified by current stamina.
 * Does NOT modify original team list.
 *
 * @param team - List of player dicts (original)
 * @param tracker - StaminaTracker instance
 * @returns List of degraded player dicts
 */
export function getDegradedTeam(
  team: Player[],
  tracker: StaminaTracker
): Array<Record<string, number | string>> {
  const degradedTeam: Array<Record<string, number | string>> = [];

  for (const player of team) {
    const degradedPlayer = tracker.getDegradedPlayer(player);
    degradedTeam.push(degradedPlayer);
  }

  return degradedTeam;
}
