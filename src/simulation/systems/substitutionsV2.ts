/**
 * Basketball Simulator - SubstitutionManagerV2
 *
 * Simplified substitution manager focused on hitting minutes targets.
 * Uses quarterly rotation system with auto-calculated minutes from player ratings.
 *
 * Key Differences from V1:
 * - Priority 1: Starters hit minutes targets (±2 min)
 * - Priority 2: Bench players hit targets (±5 min)
 * - Minutes-deficit based matching (not perfect player matching)
 * - No position matching (simplicity over perfection)
 * - Emergency subs for stamina < 30
 * - Minute redistribution for foul-outs/injuries
 *
 * @module simulation/systems/substitutionsV2
 */

import type { Player } from '../../data/types';
import type { StaminaTracker } from '../stamina/staminaManager';
import {
  calculateMinutesTargets,
  calculateQuarterlyRotations,
  type QuarterlyRotationPlan,
} from './substitutions';
import { LineupManager } from './substitutions';
import type { SubstitutionEvent } from './substitutions';

// =============================================================================
// TYPES
// =============================================================================

interface PlayerWithMinutes extends Player {
  minutesTarget: number;
  quarterTarget: number;
}

// =============================================================================
// SUBSTITUTION MANAGER V2
// =============================================================================

export class SubstitutionManagerV2 {
  // Core data
  private homeRosterWithMinutes: PlayerWithMinutes[];
  private awayRosterWithMinutes: PlayerWithMinutes[];

  // Rotation plans
  private homeRotationPlans: QuarterlyRotationPlan[];
  private awayRotationPlans: QuarterlyRotationPlan[];

  // Minutes tracking
  private actualMinutesHome: Record<string, number>;
  private actualMinutesAway: Record<string, number>;

  // Lineup management
  private homeLineupManager: LineupManager;
  private awayLineupManager: LineupManager;

  // Deduplication
  private lastCheckTime: number;
  private subsExecutedThisCheck: Set<string>;

  // Event history
  private substitutionEvents: SubstitutionEvent[];

  /**
   * Initialize SubstitutionManagerV2 with team rosters.
   *
   * @param homeRoster - Home team roster
   * @param awayRoster - Away team roster
   * @param homeStartingLineup - Optional starting lineup for home (defaults to top 5 by minutes target)
   * @param awayStartingLineup - Optional starting lineup for away (defaults to top 5 by minutes target)
   */
  constructor(
    homeRoster: Player[],
    awayRoster: Player[],
    homeStartingLineup?: Player[],
    awayStartingLineup?: Player[]
  ) {
    this.lastCheckTime = -1;
    this.subsExecutedThisCheck = new Set();
    this.substitutionEvents = [];

    // Calculate minutes targets
    this.homeRosterWithMinutes = calculateMinutesTargets(homeRoster);
    this.awayRosterWithMinutes = calculateMinutesTargets(awayRoster);

    // Initialize actual minutes tracking
    this.actualMinutesHome = {};
    this.actualMinutesAway = {};
    for (const player of this.homeRosterWithMinutes) {
      this.actualMinutesHome[player.name] = 0;
    }
    for (const player of this.awayRosterWithMinutes) {
      this.actualMinutesAway[player.name] = 0;
    }

    // Determine starters (top 5 by minutes target)
    const homeStarters =
      homeStartingLineup ||
      [...this.homeRosterWithMinutes]
        .sort((a, b) => b.minutesTarget - a.minutesTarget)
        .slice(0, 5);

    const awayStarters =
      awayStartingLineup ||
      [...this.awayRosterWithMinutes]
        .sort((a, b) => b.minutesTarget - a.minutesTarget)
        .slice(0, 5);

    // Initialize lineup managers
    this.homeLineupManager = new LineupManager(homeRoster, homeStarters);
    this.awayLineupManager = new LineupManager(awayRoster, awayStarters);

    // Initialize rotation plans (will be set in startQuarter)
    this.homeRotationPlans = [];
    this.awayRotationPlans = [];
  }

  /**
   * Start a new quarter and calculate rotation plans.
   *
   * @param quarter - Quarter number (1-4)
   */
  startQuarter(quarter: number): void {
    // Calculate rotation plans for this quarter
    this.homeRotationPlans = calculateQuarterlyRotations(
      this.homeRosterWithMinutes,
      quarter,
      this.actualMinutesHome
    );

    this.awayRotationPlans = calculateQuarterlyRotations(
      this.awayRosterWithMinutes,
      quarter,
      this.actualMinutesAway
    );
  }

  /**
   * Check and execute substitutions based on rotation plans and stamina.
   *
   * @param staminaTracker - Stamina tracker instance
   * @param gameTimeStr - Current game time string (e.g., "3:45")
   * @param timeRemainingSeconds - Time remaining in quarter (seconds)
   * @param quarterNumber - Current quarter number
   * @returns Array of substitution events executed
   */
  checkAndExecuteSubstitutions(
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingSeconds: number,
    _quarterNumber: number
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    const timeRemaining = timeRemainingSeconds / 60.0;

    // Deduplication: reset if new time window (>6 seconds since last check)
    if (Math.abs(timeRemaining - this.lastCheckTime) > 0.1) {
      this.subsExecutedThisCheck.clear();
      this.lastCheckTime = timeRemaining;
    }

    // Phase 0: Emergency substitutions (stamina < 30)
    events.push(
      ...this.checkEmergencySubstitutions(
        this.homeLineupManager,
        this.homeRosterWithMinutes,
        staminaTracker,
        'home',
        gameTimeStr
      )
    );

    events.push(
      ...this.checkEmergencySubstitutions(
        this.awayLineupManager,
        this.awayRosterWithMinutes,
        staminaTracker,
        'away',
        gameTimeStr
      )
    );

    // Phase 1 & 2: Rotation-based substitutions
    events.push(
      ...this.checkTeamRotations(
        this.homeLineupManager,
        this.homeRotationPlans,
        this.homeRosterWithMinutes,
        'home',
        timeRemaining,
        gameTimeStr
      )
    );

    events.push(
      ...this.checkTeamRotations(
        this.awayLineupManager,
        this.awayRotationPlans,
        this.awayRosterWithMinutes,
        'away',
        timeRemaining,
        gameTimeStr
      )
    );

    // Store events
    this.substitutionEvents.push(...events);

    return events;
  }

  /**
   * Update minutes played for a player.
   * Method name matches V1 interface for compatibility.
   *
   * @param playerName - Player name
   * @param minutes - Minutes to add
   * @param team - Team ('home' or 'away')
   */
  addMinutesPlayed(playerName: string, minutes: number, team: 'home' | 'away'): void {
    if (team === 'home') {
      this.actualMinutesHome[playerName] = (this.actualMinutesHome[playerName] || 0) + minutes;
    } else {
      this.actualMinutesAway[playerName] = (this.actualMinutesAway[playerName] || 0) + minutes;
    }
  }

  /**
   * No-op method for compatibility with V1 interface.
   * V2 doesn't track continuous time on court, only total minutes.
   */
  updateTimeOnCourt(_staminaTracker: StaminaTracker, _durationSeconds: number): void {
    // V2 doesn't track continuous time on court
    // This method exists for interface compatibility only
  }

  /**
   * Get home team active players.
   */
  getHomeActive(): Player[] {
    return this.homeLineupManager.getActivePlayers();
  }

  /**
   * Get away team active players.
   */
  getAwayActive(): Player[] {
    return this.awayLineupManager.getActivePlayers();
  }

  /**
   * Get home team bench players.
   */
  getHomeBench(): Player[] {
    return this.homeLineupManager.getBenchPlayers();
  }

  /**
   * Get away team bench players.
   */
  getAwayBench(): Player[] {
    return this.awayLineupManager.getBenchPlayers();
  }

  /**
   * Get all substitution events.
   */
  getSubstitutionEvents(): SubstitutionEvent[] {
    return [...this.substitutionEvents];
  }

  /**
   * Handle a player fouling out.
   *
   * @param playerName - Name of player who fouled out
   * @param team - Team ('home' or 'away')
   * @param currentTime - Current game time string
   * @returns Substitution event or null if failed
   */
  handleFoulOut(
    playerName: string,
    team: 'home' | 'away',
    currentTime: string
  ): SubstitutionEvent | null {
    // Redistribute this player's remaining minutes
    this.redistributeMinutes(playerName, team);

    // Execute immediate substitution
    return this.forceSubstitution(playerName, team, currentTime, 'fouled_out');
  }

  /**
   * Handle a player injury.
   *
   * @param playerName - Name of injured player
   * @param team - Team ('home' or 'away')
   * @param currentTime - Current game time string
   * @returns Substitution event or null if failed
   */
  handleInjury(
    playerName: string,
    team: 'home' | 'away',
    currentTime: string
  ): SubstitutionEvent | null {
    // Redistribute this player's remaining minutes
    this.redistributeMinutes(playerName, team);

    // Execute immediate substitution
    return this.forceSubstitution(playerName, team, currentTime, 'injury');
  }

  /**
   * Verify minutes targets at end of game.
   *
   * @returns Array of players with significant discrepancies
   */
  verifyMinutesTargets(): Array<{
    player: string;
    team: string;
    actual: number;
    target: number;
    diff: number;
  }> {
    const discrepancies: Array<{
      player: string;
      team: string;
      actual: number;
      target: number;
      diff: number;
    }> = [];

    // Check home team
    for (const player of this.homeRosterWithMinutes) {
      const actual = this.actualMinutesHome[player.name] || 0;
      const target = player.minutesTarget;
      const diff = actual - target;

      // Determine if discrepancy is significant (±2 for starters, ±5 for bench)
      const threshold = target >= 30 ? 2 : 5; // Starters typically have 30+ min targets
      if (Math.abs(diff) > threshold) {
        discrepancies.push({
          player: player.name,
          team: 'home',
          actual,
          target,
          diff,
        });
      }
    }

    // Check away team
    for (const player of this.awayRosterWithMinutes) {
      const actual = this.actualMinutesAway[player.name] || 0;
      const target = player.minutesTarget;
      const diff = actual - target;

      const threshold = target >= 30 ? 2 : 5;
      if (Math.abs(diff) > threshold) {
        discrepancies.push({
          player: player.name,
          team: 'away',
          actual,
          target,
          diff,
        });
      }
    }

    return discrepancies;
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  /**
   * Check for emergency substitutions (stamina < 30).
   */
  private checkEmergencySubstitutions(
    lineupManager: LineupManager,
    _roster: PlayerWithMinutes[],
    staminaTracker: StaminaTracker,
    team: 'home' | 'away',
    currentTime: string
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    const active = lineupManager.getActivePlayers();
    const bench = lineupManager.getBenchPlayers();

    if (bench.length === 0) return events; // No bench available

    for (const player of active) {
      if (this.subsExecutedThisCheck.has(player.name)) continue;

      const stamina = staminaTracker.getCurrentStamina(player.name);

      // Emergency: stamina critically low
      if (stamina < 30) {
        // Find any available bench player
        const sub = bench[0];
        if (sub) {
          const event = this.executeSubstitution(
            player,
            sub,
            lineupManager,
            team,
            currentTime,
            'stamina'
          );
          if (event) {
            events.push(event);
            this.subsExecutedThisCheck.add(player.name);
            this.subsExecutedThisCheck.add(sub.name);
          }
        }
      }
    }

    return events;
  }

  /**
   * Check rotation-based substitutions for a team.
   */
  private checkTeamRotations(
    lineupManager: LineupManager,
    rotationPlans: QuarterlyRotationPlan[],
    roster: PlayerWithMinutes[],
    team: 'home' | 'away',
    timeRemaining: number,
    currentTime: string
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    const active = lineupManager.getActivePlayers();
    const bench = lineupManager.getBenchPlayers();
    const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

    // PHASE 1: Sub OUT players who have hit their quota
    for (const player of active) {
      if (this.subsExecutedThisCheck.has(player.name)) continue;

      const plan = rotationPlans.find((p) => p.playerName === player.name);
      if (!plan) continue;

      const played = actualMinutes[player.name] || 0;
      const playerWithMinutes = roster.find((p) => p.name === player.name);
      const target = playerWithMinutes?.minutesTarget || 0;

      // Check if player should be subbed out
      const shouldSubOut =
        (plan.subOutAt !== null && Math.abs(timeRemaining - plan.subOutAt) <= 0.1) ||
        played >= target - 0.5; // Within 30 seconds of target

      if (shouldSubOut && bench.length > 0) {
        // Find bench player who needs most minutes
        const playerIn = this.findBenchPlayerNeedingMinutes(bench, rotationPlans, actualMinutes, roster);

        if (playerIn) {
          const event = this.executeSubstitution(player, playerIn, lineupManager, team, currentTime, 'minutes');
          if (event) {
            events.push(event);
            this.subsExecutedThisCheck.add(player.name);
            this.subsExecutedThisCheck.add(playerIn.name);
          }
        }
      }
    }

    // PHASE 2: Sub IN players who need minutes (scheduled sub-ins)
    for (const plan of rotationPlans) {
      if (this.subsExecutedThisCheck.has(plan.playerName)) continue;

      // Check if this player should sub in
      if (plan.subInAt !== null && Math.abs(timeRemaining - plan.subInAt) <= 0.1) {
        const playerIn = bench.find((p) => p.name === plan.playerName);
        if (playerIn && active.length > 0) {
          // Find active player who has played most (relative to target)
          const playerOut = this.findActivePlayerToRest(active, actualMinutes, roster);

          if (playerOut) {
            const event = this.executeSubstitution(playerOut, playerIn, lineupManager, team, currentTime, 'minutes');
            if (event) {
              events.push(event);
              this.subsExecutedThisCheck.add(playerOut.name);
              this.subsExecutedThisCheck.add(playerIn.name);
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Find bench player who needs the most minutes.
   */
  private findBenchPlayerNeedingMinutes(
    bench: Player[],
    _rotationPlans: QuarterlyRotationPlan[],
    actualMinutes: Record<string, number>,
    roster: PlayerWithMinutes[]
  ): Player | null {
    if (bench.length === 0) return null;

    // Find bench player with biggest minutes deficit
    const benchWithDeficit = bench
      .map((p) => {
        const played = actualMinutes[p.name] || 0;
        const playerWithMinutes = roster.find((rp) => rp.name === p.name);
        const target = playerWithMinutes?.minutesTarget || 0;
        const deficit = target - played;
        return { player: p, deficit };
      })
      .filter((pd) => pd.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit); // Biggest deficit first

    if (benchWithDeficit.length > 0 && benchWithDeficit[0]) {
      return benchWithDeficit[0].player;
    }
    return bench.length > 0 && bench[0] ? bench[0] : null;
  }

  /**
   * Find active player who should rest (played most relative to target).
   */
  private findActivePlayerToRest(
    active: Player[],
    actualMinutes: Record<string, number>,
    roster: PlayerWithMinutes[]
  ): Player | null {
    if (active.length === 0) return null;

    // Find active player who has played most (relative to target)
    const activeWithRatio = active
      .map((p) => {
        const played = actualMinutes[p.name] || 0;
        const playerWithMinutes = roster.find((rp) => rp.name === p.name);
        const target = playerWithMinutes?.minutesTarget || 1; // Avoid division by zero
        const ratio = played / target;
        return { player: p, ratio };
      })
      .sort((a, b) => b.ratio - a.ratio); // Highest ratio first

    if (activeWithRatio.length > 0 && activeWithRatio[0]) {
      return activeWithRatio[0].player;
    }
    return null;
  }

  /**
   * Execute a substitution with safety checks.
   */
  private executeSubstitution(
    playerOut: Player,
    playerIn: Player,
    lineupManager: LineupManager,
    team: 'home' | 'away',
    currentTime: string,
    reason: SubstitutionEvent['reason']
  ): SubstitutionEvent | null {
    // Safety check: playerOut must be on court
    const active = lineupManager.getActivePlayers();
    if (!active.find((p) => p.name === playerOut.name)) {
      console.warn(`[SUB V2] Cannot sub out ${playerOut.name} - not on court`);
      return null;
    }

    // Safety check: playerIn must be on bench
    const bench = lineupManager.getBenchPlayers();
    if (!bench.find((p) => p.name === playerIn.name)) {
      console.warn(`[SUB V2] Cannot sub in ${playerIn.name} - not on bench`);
      return null;
    }

    // Execute substitution
    const success = lineupManager.substitute(playerOut, playerIn);

    if (!success) {
      console.warn(`[SUB V2] Substitution failed: ${playerOut.name} OUT, ${playerIn.name} IN`);
      return null;
    }

    // Create event
    return {
      quarterTime: currentTime,
      playerOut: playerOut.name,
      playerIn: playerIn.name,
      reason,
      staminaOut: 0, // V2 doesn't track stamina in events
      staminaIn: 0,
      team,
    };
  }

  /**
   * Force a substitution (for foul-outs/injuries).
   */
  private forceSubstitution(
    playerName: string,
    team: 'home' | 'away',
    currentTime: string,
    reason: 'fouled_out' | 'injury'
  ): SubstitutionEvent | null {
    const lineupManager = team === 'home' ? this.homeLineupManager : this.awayLineupManager;
    const roster = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;

    const playerOut = lineupManager.getActivePlayers().find((p) => p.name === playerName);
    if (!playerOut) {
      console.warn(`[SUB V2] Cannot force sub - ${playerName} not on court`);
      return null;
    }

    const bench = lineupManager.getBenchPlayers();
    if (bench.length === 0) {
      console.error(`[SUB V2] Cannot force sub - no bench players available for ${team}`);
      return null;
    }

    // Find best available bench player (biggest minutes deficit)
    const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;
    const playerIn = this.findBenchPlayerNeedingMinutes(bench, [], actualMinutes, roster);

    if (!playerIn) {
      console.error(`[SUB V2] Cannot find bench player for forced sub`);
      return null;
    }

    return this.executeSubstitution(playerOut, playerIn, lineupManager, team, currentTime, reason);
  }

  /**
   * Redistribute minutes when a player fouls out or gets injured.
   */
  private redistributeMinutes(playerName: string, team: 'home' | 'away'): void {
    const roster = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
    const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

    // Find the player's remaining minutes
    const player = roster.find((p) => p.name === playerName);
    if (!player) return;

    const played = actualMinutes[playerName] || 0;
    const remaining = Math.max(0, player.minutesTarget - played);

    if (remaining === 0) return;

    // Redistribute using weighted formula
    const eligiblePlayers = roster.filter((p) => p.name !== playerName);
    const minOverall = Math.min(
      ...eligiblePlayers.map((p) => Object.values(p.attributes).reduce((a, b) => a + b, 0) / 25)
    );

    // Calculate weights
    const playersWithWeights = eligiblePlayers.map((p) => {
      const overall = Object.values(p.attributes).reduce((a, b) => a + b, 0) / 25;
      return {
        player: p,
        weight: Math.pow(overall - minOverall + 1, 1.6),
      };
    });

    const totalWeight = playersWithWeights.reduce((sum, p) => sum + p.weight, 0);

    // Add redistributed minutes to each player's target
    for (const pw of playersWithWeights) {
      const additionalMinutes = remaining * (pw.weight / totalWeight);
      pw.player.minutesTarget += additionalMinutes;

      // Recalculate quarter target
      pw.player.quarterTarget = pw.player.minutesTarget / 4;
    }

    // Mark player as unavailable (their new target is what they've already played)
    player.minutesTarget = played;
    player.quarterTarget = 0;
  }
}
