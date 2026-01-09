/**
 * Basketball Simulator - Fouls System (M3 Phase 2a)
 *
 * Handles foul detection, tracking, and free throw allocation.
 *
 * Key Responsibilities:
 * 1. Detect shooting fouls (during shot attempts)
 * 2. Detect non-shooting fouls (during drives, rebounds, off-ball)
 * 3. Track personal fouls per player (6 = foul out)
 * 4. Track team fouls per quarter (bonus at 5, double bonus at 10)
 * 5. Allocate free throws based on foul type and bonus status
 * 6. Detect rare flagrant and technical fouls
 *
 * Integrates with:
 * - src/systems/possession.ts (foul checks during possessions)
 * - src/systems/shooting.ts (shooting foul checks)
 * - src/systems/freeThrows.ts (execute free throws)
 * - src/systems/substitutions.ts (foul out triggers substitution)
 *
 * NBA Rules:
 * - Personal fouls: 6 = disqualification
 * - Team fouls: Reset each quarter
 * - Bonus: 5+ team fouls → 2 free throws on non-shooting fouls
 * - Double bonus: 10+ team fouls (not used in NBA, but exists in college)
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/fouls
 */

import { calculateComposite, sigmoid } from '../core/probability';
import { SIGMOID_K } from '../constants';
import type { SimulationPlayer } from '../core/types';

// =============================================================================
// FOUL DATA STRUCTURES
// =============================================================================

/**
 * Record of a foul occurrence.
 */
export interface FoulEvent {
  /** Name of player who committed foul */
  fouling_player: string;

  /** Name of player who was fouled */
  fouled_player: string;

  /** Foul type: 'shooting', 'non_shooting', 'flagrant', 'technical', 'offensive' */
  foul_type: string;

  /** Quarter number (1-4) */
  quarter: number;

  /** Game clock when foul occurred */
  game_time: string;

  /** Number of free throws awarded (0, 1, 2, or 3) */
  free_throws_awarded: number;

  /** True if shot was made (and-1 opportunity) */
  and_one: boolean;

  /** Fouling team: 'Home' or 'Away' */
  fouling_team: string;

  /** Personal fouls for fouling player after this foul */
  personal_fouls_after: number;

  /** Team fouls after this foul */
  team_fouls_after: number;

  /** True if this was player's 6th foul */
  fouled_out: boolean;

  /** True if fouled team is in bonus (5+ team fouls) */
  bonus_triggered: boolean;
}

// =============================================================================
// FOUL PROBABILITY CONSTANTS
// =============================================================================

/**
 * Shooting foul base rates
 * MAJOR REALISM FIX: Previous rates (21-35%) were way too high, causing
 * 5+ players to foul out per game. Real NBA: ~0 foul outs per game on average.
 *
 * NBA targets: ~20 personal fouls per team, ~22 FTA per team
 * With ~100 possessions and ~1.5 shot attempts per possession, we need:
 * - Heavily contested (rim): ~10-12% foul rate on layups/dunks
 * - Contested: ~6-8% foul rate
 * - Wide open: ~1% (mostly jumpshots)
 */
export const SHOOTING_FOUL_BASE_RATES: Record<string, number> = {
  contested: 0.07, // 7% for contested (2-6 ft)
  heavily_contested: 0.12, // 12% for heavily contested (<2 ft, rim attacks)
  wide_open: 0.01, // 1% for wide open (6+ ft, rare reach-in)
};

/**
 * Shot type foul multipliers (USER FIX: Reduce 3PT foul frequency)
 * 3PT fouls should be RARE (1-2 per game max), rim fouls more common
 */
export const SHOT_TYPE_FOUL_MULTIPLIERS: Record<string, number> = {
  '3pt': 0.1, // 90% reduction for 3PT fouls (extremely rare)
  midrange: 0.3, // 70% reduction for midrange fouls
  layup: 1.0, // Baseline (no change)
  dunk: 1.1, // 10% increase for dunks (more contact at rim)
};

/**
 * Non-shooting foul base rates
 * MAJOR REALISM FIX: Reduced significantly to prevent excessive foul outs.
 * Target: ~8-10 non-shooting fouls per team per game
 */
export const NON_SHOOTING_FOUL_BASE_RATE = 0.025; // 2.5% per possession (generic)

/**
 * Action-specific rates (used for different non-shooting foul contexts)
 * MAJOR REALISM FIX: Reduced to realistic NBA levels
 */
export const ACTION_FOUL_RATES: Record<string, number> = {
  drive: 0.025, // 2.5% during drives (reach-in fouls)
  post_up: 0.02, // 2% during post-ups (holding)
  rebound: 0.012, // 1.2% during rebounds (loose ball fouls)
  off_ball: 0.006, // 0.6% during off-ball movement (hand-checking/holding)
};

/**
 * Rare fouls
 */
export const FLAGRANT_FOUL_RATE = 0.005; // 0.5% per game
export const TECHNICAL_FOUL_RATE = 0.003; // 0.3% per game

/**
 * Attribute weights for shooting fouls
 * PHASE 2: Removed patience, redistributed weight proportionally
 */
export const SHOOTING_FOUL_WEIGHTS_DEFENDER: Record<string, number> = {
  composure: 0.375, // +0.075 - staying calm under pressure
  awareness: 0.3125, // +0.0625 - knowing when NOT to foul
  agility: 0.1875, // +0.0375 - staying in front without contact
  reactions: 0.125, // +0.025 - quick hands without fouling
};

export const SHOOTING_FOUL_WEIGHTS_OFFENSE: Record<string, number> = {
  bravery: 0.4,
  agility: 0.3,
  core_strength: 0.3, // Finishing through contact
};

// =============================================================================
// FOUL SYSTEM CLASS
// =============================================================================

/**
 * Manages foul detection and tracking for a full game.
 *
 * Tracks personal fouls per player and team fouls per quarter.
 */
export class FoulSystem {
  /** Personal foul tracking (per player, cumulative across game) */
  private personalFouls: Map<string, number>;

  /** Team foul tracking (per quarter, resets each quarter) */
  private teamFoulsHome: number;
  private teamFoulsAway: number;

  /** Foul event history */
  private foulEvents: FoulEvent[];

  /** Track fouled-out players */
  private fouledOutPlayers: string[];

  /** Current quarter */
  private currentQuarter: number;

  /**
   * Initialize foul tracking system.
   *
   * @param homeRoster - Full home team roster
   * @param awayRoster - Full away team roster
   */
  constructor(homeRoster: SimulationPlayer[], awayRoster: SimulationPlayer[]) {
    // Personal foul tracking (per player, cumulative across game)
    this.personalFouls = new Map<string, number>();
    for (const player of [...homeRoster, ...awayRoster]) {
      this.personalFouls.set(player.name, 0);
    }

    // Team foul tracking (per quarter, resets each quarter)
    this.teamFoulsHome = 0;
    this.teamFoulsAway = 0;

    // Foul event history
    this.foulEvents = [];

    // Track fouled-out players
    this.fouledOutPlayers = [];

    // Current quarter
    this.currentQuarter = 1;
  }

  /**
   * Reset team fouls at start of new quarter.
   *
   * @param quarter - New quarter number (1-4)
   */
  resetTeamFoulsForQuarter(quarter: number): void {
    this.currentQuarter = quarter;
    this.teamFoulsHome = 0;
    this.teamFoulsAway = 0;
  }

  /**
   * Check if shooting foul occurred on shot attempt.
   *
   * @param shooter - Offensive player taking shot
   * @param defender - Primary defender
   * @param contestDistance - Distance to defender in feet
   * @param shotType - '3pt', 'midrange', 'layup', 'dunk'
   * @param shotMade - True if shot was made
   * @param defendingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent if foul occurred, null otherwise
   */
  checkShootingFoul(
    shooter: SimulationPlayer,
    defender: SimulationPlayer,
    contestDistance: number,
    shotType: string,
    shotMade: boolean,
    defendingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent | null {
    // Determine contest level
    let contestLevel: string;
    if (contestDistance >= 6.0) {
      contestLevel = 'wide_open';
    } else if (contestDistance >= 2.0) {
      contestLevel = 'contested';
    } else {
      contestLevel = 'heavily_contested';
    }

    // Get base rate
    const baseRate = SHOOTING_FOUL_BASE_RATES[contestLevel];

    // Calculate attribute composites
    const defenderComposite = calculateComposite(defender, SHOOTING_FOUL_WEIGHTS_DEFENDER);
    const offenseComposite = calculateComposite(shooter, SHOOTING_FOUL_WEIGHTS_OFFENSE);

    // Attribute modifier (offense draws fouls, defense avoids them)
    const attributeDiff = offenseComposite - defenderComposite;
    // Apply k=0.015 scaling before sigmoid
    const scaledDiff = attributeDiff * 0.015;
    const attributeModifier = sigmoid(scaledDiff) * baseRate;

    // Apply shot type multiplier (USER FIX: Reduce 3PT foul frequency)
    const shotMultiplier = SHOT_TYPE_FOUL_MULTIPLIERS[shotType] ?? 1.0;

    // Final probability
    let foulProbability = (baseRate + attributeModifier) * shotMultiplier;
    foulProbability = Math.max(0.0, Math.min(0.3, foulProbability)); // Cap at 30%

    // Roll for foul
    if (Math.random() < foulProbability) {
      // Foul occurred
      return this.recordShootingFoul(
        defender.name,
        shooter.name,
        shotType,
        shotMade,
        defendingTeam,
        quarter,
        gameTime
      );
    }

    return null;
  }

  /**
   * Check if non-shooting foul occurred during action.
   *
   * @param offensivePlayer - Offensive player
   * @param defensivePlayer - Defensive player
   * @param actionType - 'drive', 'post_up', 'rebound', 'off_ball'
   * @param defendingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent if foul occurred, null otherwise
   */
  checkNonShootingFoul(
    offensivePlayer: SimulationPlayer,
    defensivePlayer: SimulationPlayer,
    actionType: string,
    defendingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent | null {
    // Get base rate for action
    const baseRate = ACTION_FOUL_RATES[actionType] ?? NON_SHOOTING_FOUL_BASE_RATE;

    // Calculate attribute composites (same as shooting fouls)
    // Handle missing 'discipline' attribute (M3 new attribute)
    const defenderCopy = { ...defensivePlayer };
    if (!('discipline' in defenderCopy)) {
      (defenderCopy as any).discipline = 50; // Default value
    }

    const defenderComposite = calculateComposite(defenderCopy, SHOOTING_FOUL_WEIGHTS_DEFENDER);
    const offenseComposite = calculateComposite(offensivePlayer, SHOOTING_FOUL_WEIGHTS_OFFENSE);

    // Attribute modifier
    const attributeDiff = offenseComposite - defenderComposite;
    // Apply k=0.015 scaling before sigmoid
    const scaledDiff = attributeDiff * 0.015;
    const attributeModifier = sigmoid(scaledDiff) * baseRate;

    // Final probability
    let foulProbability = baseRate + attributeModifier;
    foulProbability = Math.max(0.0, Math.min(0.2, foulProbability)); // Cap at 20%

    // Roll for foul
    if (Math.random() < foulProbability) {
      // Foul occurred
      return this.recordNonShootingFoul(
        defensivePlayer.name,
        offensivePlayer.name,
        defendingTeam,
        quarter,
        gameTime
      );
    }

    return null;
  }

  /**
   * Record a shooting foul and allocate free throws.
   *
   * @param foulingPlayer - Name of player who fouled
   * @param fouledPlayer - Name of player who was fouled
   * @param shotType - '3pt', 'midrange', 'layup', 'dunk'
   * @param shotMade - True if shot was made (and-1)
   * @param foulingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent
   */
  private recordShootingFoul(
    foulingPlayer: string,
    fouledPlayer: string,
    shotType: string,
    shotMade: boolean,
    foulingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent {
    // Allocate free throws
    let freeThrows: number;
    let andOne: boolean;

    if (shotMade) {
      // And-1: 1 free throw
      freeThrows = 1;
      andOne = true;
    } else if (shotType === '3pt') {
      // 3PT attempt: 3 free throws
      freeThrows = 3;
      andOne = false;
    } else {
      // 2PT attempt: 2 free throws
      freeThrows = 2;
      andOne = false;
    }

    // Update personal fouls
    const currentFouls = this.personalFouls.get(foulingPlayer) ?? 0;
    this.personalFouls.set(foulingPlayer, currentFouls + 1);
    const personalFoulsAfter = currentFouls + 1;

    // Update team fouls
    let teamFoulsAfter: number;
    if (foulingTeam === 'Home') {
      this.teamFoulsHome += 1;
      teamFoulsAfter = this.teamFoulsHome;
    } else {
      this.teamFoulsAway += 1;
      teamFoulsAfter = this.teamFoulsAway;
    }

    // Check if fouled out
    const fouledOut = personalFoulsAfter >= 6;
    if (fouledOut) {
      this.fouledOutPlayers.push(foulingPlayer);
    }

    // Check if fouled team is in bonus (opponent has 5+ fouls)
    const bonusTriggered = teamFoulsAfter >= 5;

    // Create foul event
    const foulEvent: FoulEvent = {
      fouling_player: foulingPlayer,
      fouled_player: fouledPlayer,
      foul_type: 'shooting',
      quarter,
      game_time: gameTime,
      free_throws_awarded: freeThrows,
      and_one: andOne,
      fouling_team: foulingTeam,
      personal_fouls_after: personalFoulsAfter,
      team_fouls_after: teamFoulsAfter,
      fouled_out: fouledOut,
      bonus_triggered: bonusTriggered,
    };

    this.foulEvents.push(foulEvent);
    return foulEvent;
  }

  /**
   * Record a non-shooting foul and allocate free throws based on bonus.
   *
   * @param foulingPlayer - Name of player who fouled
   * @param fouledPlayer - Name of player who was fouled
   * @param foulingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent
   */
  private recordNonShootingFoul(
    foulingPlayer: string,
    fouledPlayer: string,
    foulingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent {
    // Update personal fouls
    const currentFouls = this.personalFouls.get(foulingPlayer) ?? 0;
    this.personalFouls.set(foulingPlayer, currentFouls + 1);
    const personalFoulsAfter = currentFouls + 1;

    // Update team fouls
    let teamFoulsAfter: number;
    if (foulingTeam === 'Home') {
      this.teamFoulsHome += 1;
      teamFoulsAfter = this.teamFoulsHome;
    } else {
      this.teamFoulsAway += 1;
      teamFoulsAfter = this.teamFoulsAway;
    }

    // Check if fouled team is in bonus (opponent has 5+ fouls)
    const bonusTriggered = teamFoulsAfter >= 5;

    // Determine free throws based on bonus status
    const freeThrows = bonusTriggered ? 2 : 0;

    // Check if fouled out
    const fouledOut = personalFoulsAfter >= 6;
    if (fouledOut) {
      this.fouledOutPlayers.push(foulingPlayer);
    }

    // Create foul event
    const foulEvent: FoulEvent = {
      fouling_player: foulingPlayer,
      fouled_player: fouledPlayer,
      foul_type: 'non_shooting',
      quarter,
      game_time: gameTime,
      free_throws_awarded: freeThrows,
      and_one: false,
      fouling_team: foulingTeam,
      personal_fouls_after: personalFoulsAfter,
      team_fouls_after: teamFoulsAfter,
      fouled_out: fouledOut,
      bonus_triggered: bonusTriggered,
    };

    this.foulEvents.push(foulEvent);
    return foulEvent;
  }

  /**
   * Record an offensive foul (charging, illegal screen, etc.).
   *
   * Offensive fouls count toward personal and team fouls but never result in free throws.
   *
   * @param foulingPlayer - Name of offensive player who fouled
   * @param defenderName - Name of defender who drew the charge/was fouled
   * @param foulingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent
   */
  recordOffensiveFoul(
    foulingPlayer: string,
    defenderName: string,
    foulingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent {
    // Update personal fouls
    const currentFouls = this.personalFouls.get(foulingPlayer) ?? 0;
    this.personalFouls.set(foulingPlayer, currentFouls + 1);
    const personalFoulsAfter = currentFouls + 1;

    // Update team fouls
    let teamFoulsAfter: number;
    if (foulingTeam === 'Home') {
      this.teamFoulsHome += 1;
      teamFoulsAfter = this.teamFoulsHome;
    } else {
      this.teamFoulsAway += 1;
      teamFoulsAfter = this.teamFoulsAway;
    }

    // Check if fouled out
    const fouledOut = personalFoulsAfter >= 6;
    if (fouledOut) {
      this.fouledOutPlayers.push(foulingPlayer);
    }

    // Create foul event
    const foulEvent: FoulEvent = {
      fouling_player: foulingPlayer,
      fouled_player: defenderName,
      foul_type: 'offensive',
      quarter,
      game_time: gameTime,
      free_throws_awarded: 0, // Offensive fouls never award FTs
      and_one: false,
      fouling_team: foulingTeam,
      personal_fouls_after: personalFoulsAfter,
      team_fouls_after: teamFoulsAfter,
      fouled_out: fouledOut,
      bonus_triggered: false, // Not applicable for offensive fouls
    };

    this.foulEvents.push(foulEvent);
    return foulEvent;
  }

  /**
   * Check if player has fouled out.
   *
   * @param playerName - Player to check
   * @returns True if player has 6+ personal fouls
   */
  isFouledOut(playerName: string): boolean {
    return this.fouledOutPlayers.includes(playerName);
  }

  /**
   * Get personal foul count for player.
   *
   * @param playerName - Player to check
   * @returns Number of personal fouls (0-6)
   */
  getPersonalFouls(playerName: string): number {
    return this.personalFouls.get(playerName) ?? 0;
  }

  /**
   * Get team foul count for current quarter.
   *
   * @param team - 'Home' or 'Away'
   * @returns Number of team fouls in current quarter
   */
  getTeamFouls(team: string): number {
    return team === 'Home' ? this.teamFoulsHome : this.teamFoulsAway;
  }

  /**
   * Check if team is in bonus (opponent has 5+ team fouls).
   *
   * @param team - 'Home' or 'Away' (offensive team)
   * @returns True if opponent is in bonus
   */
  isInBonus(team: string): boolean {
    const opponentTeam = team === 'Home' ? 'Away' : 'Home';
    return this.getTeamFouls(opponentTeam) >= 5;
  }

  /**
   * Get summary of foul statistics.
   *
   * @returns Dict with foul counts and rates
   */
  getFoulSummary(): {
    total_fouls: number;
    shooting_fouls: number;
    non_shooting_fouls: number;
    fouled_out_players: string[];
    fouled_out_count: number;
    foul_events: FoulEvent[];
  } {
    const totalFouls = this.foulEvents.length;
    const shootingFouls = this.foulEvents.filter((f) => f.foul_type === 'shooting').length;
    const nonShootingFouls = this.foulEvents.filter((f) => f.foul_type === 'non_shooting').length;
    const fouledOutCount = this.fouledOutPlayers.length;

    return {
      total_fouls: totalFouls,
      shooting_fouls: shootingFouls,
      non_shooting_fouls: nonShootingFouls,
      fouled_out_players: [...this.fouledOutPlayers],
      fouled_out_count: fouledOutCount,
      foul_events: this.foulEvents,
    };
  }

  /**
   * Trigger an intentional foul (M3 End-game Logic).
   *
   * Used when trailing team intentionally fouls to stop clock in final minute.
   * Always treated as non-shooting foul (awards FTs if in bonus, side out otherwise).
   *
   * @param foulingPlayer - Name of player committing intentional foul
   * @param fouledPlayer - Name of player being fouled
   * @param foulingTeam - 'Home' or 'Away'
   * @param quarter - Current quarter
   * @param gameTime - Game clock
   * @returns FoulEvent with appropriate FT allocation
   */
  triggerIntentionalFoul(
    foulingPlayer: string,
    fouledPlayer: string,
    foulingTeam: string,
    quarter: number,
    gameTime: string
  ): FoulEvent {
    // Intentional fouls are non-shooting fouls
    // Use existing non-shooting foul recording logic
    return this.recordNonShootingFoul(foulingPlayer, fouledPlayer, foulingTeam, quarter, gameTime);
  }
}
