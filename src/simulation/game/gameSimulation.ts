/**
 * Basketball Simulator - Full Game Simulation System
 *
 * Main orchestrator for complete 48-minute game (4 quarters).
 *
 * Integrates:
 * 1. QuarterSimulator - runs each quarter
 * 2. Halftime stamina recovery
 * 3. Full game statistics aggregation
 * 4. Game-level box score
 * 5. Quarter-to-quarter state management
 *
 * Main Loop:
 * 1. Initialize game state (rosters, tactical settings)
 * 2. Simulate Quarter 1
 * 3. Simulate Quarter 2
 * 4. Halftime (full stamina recovery)
 * 5. Simulate Quarter 3
 * 6. Simulate Quarter 4
 * 7. Aggregate statistics
 * 8. Generate final box score
 *
 * @module simulation/game/gameSimulation
 */

import type { Player, TacticalSettings } from '../../data/types';
import { QuarterSimulator, type QuarterResult } from './quarterSimulation';
import { recoverStamina } from '../stamina/staminaManager';
import { TimeoutManager } from '../systems/timeoutManager';
import { FoulSystem } from '../systems/fouls';

// =============================================================================
// GAME RESULT DATA STRUCTURE
// =============================================================================

export interface GameResult {
  homeScore: number;
  awayScore: number;
  quarterScores: [number, number][]; // [(Q1_home, Q1_away), ...]
  playByPlayText: string;
  gameStatistics: Record<string, any>;
  quarterResults: QuarterResult[];
  finalStamina: Record<string, number>;
  minutesPlayed: Record<string, number>;
}

// =============================================================================
// GAME SIMULATOR CLASS
// =============================================================================

export class GameSimulator {
  private homeRoster: Player[];
  private awayRoster: Player[];
  private tacticalHome: TacticalSettings;
  private tacticalAway: TacticalSettings;
  private homeTeamName: string;
  private awayTeamName: string;

  private homeScore: number = 0;
  private awayScore: number = 0;
  private quarterScores: [number, number][] = [];
  private quarterResults: QuarterResult[] = [];

  constructor(
    homeRoster: Player[],
    awayRoster: Player[],
    tacticalHome: TacticalSettings,
    tacticalAway: TacticalSettings,
    homeTeamName: string = "Home",
    awayTeamName: string = "Away"
  ) {
    this.homeRoster = homeRoster;
    this.awayRoster = awayRoster;
    this.tacticalHome = tacticalHome;
    this.tacticalAway = tacticalAway;
    this.homeTeamName = homeTeamName;
    this.awayTeamName = awayTeamName;
  }

  /**
   * Simulate complete 48-minute game (4 quarters).
   */
  public simulateGame(seed?: number): GameResult {
    // Track cumulative stamina and minutes
    let cumulativeStamina: Record<string, number> | null = null;
    const cumulativeMinutes: Record<string, number> = {};
    [...this.homeRoster, ...this.awayRoster].forEach(p => {
      cumulativeMinutes[p.name] = 0.0;
    });

    // Track ending lineups for Q2+ restoration
    let cumulativeHomeLineup: Player[] | null = null;
    let cumulativeAwayLineup: Player[] | null = null;

    // Initialize timeout manager (persists across quarters)
    const timeoutManager = new TimeoutManager(
      this.tacticalHome.timeout_strategy,
      7
    );

    // Initialize foul system (persists across quarters)
    const foulSystem = new FoulSystem(this.homeRoster, this.awayRoster);

    // Simulate all 4 quarters
    for (let quarterNum = 1; quarterNum <= 4; quarterNum++) {
      // Apply recovery BEFORE next quarter starts
      if (quarterNum === 2) {
        console.log("\nQuarter break (2:10): Players recovering stamina...");
        cumulativeStamina = this.applyQuarterBreakRecovery(cumulativeStamina);
      } else if (quarterNum === 3) {
        console.log("\nHalftime (15 min): All players fully recovering stamina...");
        cumulativeStamina = this.applyHalftimeRecovery(cumulativeStamina);
      } else if (quarterNum === 4) {
        console.log("\nQuarter break (2:10): Players recovering stamina...");
        cumulativeStamina = this.applyQuarterBreakRecovery(cumulativeStamina);
      }

      console.log(`\nSimulating Quarter ${quarterNum}...`);

      // Get starting lineups (Q1 uses default, Q2+ restores previous ending)
      const homeStarting = quarterNum > 1 ? cumulativeHomeLineup : null;
      const awayStarting = quarterNum > 1 ? cumulativeAwayLineup : null;

      // Create quarter simulator
      const quarterSim = new QuarterSimulator(
        this.homeRoster,
        this.awayRoster,
        this.tacticalHome,
        this.tacticalAway,
        this.homeTeamName,
        this.awayTeamName,
        quarterNum,
        this.homeScore,
        this.awayScore,
        timeoutManager,
        foulSystem,
        homeStarting,
        awayStarting
      );

      // Reset scoring runs for new quarter
      timeoutManager.resetForQuarter(quarterNum);

      // Reset team fouls (personal fouls persist)
      foulSystem.resetTeamFoulsForQuarter(quarterNum);

      // Restore stamina from previous quarter (if not Q1)
      if (quarterNum > 1 && cumulativeStamina !== null) {
        this.restoreStamina(quarterSim, cumulativeStamina);
      }

      // Restore minutes from previous quarters
      for (const [playerName, minutes] of Object.entries(cumulativeMinutes)) {
        quarterSim['staminaTracker'].minutesPlayed[playerName] = minutes;
      }

      // Simulate quarter
      const quarterResult = quarterSim.simulateQuarter(seed);

      // Store result
      this.quarterResults.push(quarterResult);
      this.quarterScores.push([quarterResult.homeScore, quarterResult.awayScore]);

      // Update cumulative score
      this.homeScore += quarterResult.homeScore;
      this.awayScore += quarterResult.awayScore;

      // Save stamina state for next quarter
      cumulativeStamina = { ...quarterResult.staminaFinal };

      // Save ending lineups for next quarter
      cumulativeHomeLineup = [...quarterResult.homeEndingLineup];
      cumulativeAwayLineup = [...quarterResult.awayEndingLineup];

      // Update cumulative minutes
      for (const [playerName, minutes] of Object.entries(quarterResult.minutesPlayed)) {
        cumulativeMinutes[playerName] = minutes;
      }

      console.log(
        `Quarter ${quarterNum} complete: ${this.homeTeamName} ${this.homeScore}, ` +
        `${this.awayTeamName} ${this.awayScore}`
      );
    }

    // Build final game result
    return this.buildGameResult(cumulativeStamina!, cumulativeMinutes);
  }

  private restoreStamina(quarterSim: QuarterSimulator, staminaValues: Record<string, number>): void {
    for (const [playerName, stamina] of Object.entries(staminaValues)) {
      if (quarterSim['staminaTracker'].staminaState[playerName] !== undefined) {
        quarterSim['staminaTracker'].staminaState[playerName] = stamina;
      }
    }
  }

  private applyQuarterBreakRecovery(staminaValues: Record<string, number> | null): Record<string, number> {
    if (!staminaValues) {
      // Initialize all players at 100
      const initial: Record<string, number> = {};
      [...this.homeRoster, ...this.awayRoster].forEach(p => {
        initial[p.name] = 100.0;
      });
      return initial;
    }

    const QUARTER_BREAK_MINUTES = 2.17; // 130 seconds

    const playerLookup: Record<string, Player> = {};
    [...this.homeRoster, ...this.awayRoster].forEach(p => {
      playerLookup[p.name] = p;
    });

    const recovered: Record<string, number> = {};
    for (const [playerName, currentStamina] of Object.entries(staminaValues)) {
      const player = playerLookup[playerName];
      const playerStaminaAttr = player?.stamina || 50;

      const recovery = recoverStamina(currentStamina, QUARTER_BREAK_MINUTES, playerStaminaAttr);
      const newStamina = Math.min(100.0, currentStamina + recovery);
      recovered[playerName] = newStamina;
    }

    return recovered;
  }

  private applyHalftimeRecovery(staminaValues: Record<string, number> | null): Record<string, number> {
    if (!staminaValues) {
      const initial: Record<string, number> = {};
      [...this.homeRoster, ...this.awayRoster].forEach(p => {
        initial[p.name] = 100.0;
      });
      return initial;
    }

    // Full recovery for all players
    const recovered: Record<string, number> = {};
    for (const playerName of Object.keys(staminaValues)) {
      recovered[playerName] = 100.0;
    }
    return recovered;
  }

  private buildGameResult(
    finalStamina: Record<string, number>,
    finalMinutes: Record<string, number>
  ): GameResult {
    // Aggregate play-by-play
    const playByPlaySections: string[] = [];
    playByPlaySections.push("=".repeat(80));
    playByPlaySections.push(
      `         FULL GAME - ${this.homeTeamName} vs ${this.awayTeamName}         `.padStart(80)
    );
    playByPlaySections.push("=".repeat(80));
    playByPlaySections.push("");

    for (const quarterResult of this.quarterResults) {
      playByPlaySections.push(quarterResult.playByPlayText);
      playByPlaySections.push("");
    }

    // Add final summary
    playByPlaySections.push("=".repeat(80));
    playByPlaySections.push("                           FULL GAME COMPLETE                           ".padStart(80));
    playByPlaySections.push("=".repeat(80));
    playByPlaySections.push("");
    playByPlaySections.push(
      `FINAL SCORE: ${this.homeTeamName} ${this.homeScore}, ${this.awayTeamName} ${this.awayScore}`
    );
    playByPlaySections.push("");

    // Add quarter-by-quarter scoring
    playByPlaySections.push("SCORING BY QUARTER:");
    playByPlaySections.push("-".repeat(80));
    playByPlaySections.push(
      `${'Team'.padEnd(20)} ${'Q1'.padStart(6)} ${'Q2'.padStart(6)} ${'Q3'.padStart(6)} ${'Q4'.padStart(6)} ${'FINAL'.padStart(8)}`
    );
    playByPlaySections.push("-".repeat(80));
    playByPlaySections.push(
      `${this.homeTeamName.padEnd(20)} ` +
      `${this.quarterScores[0][0].toString().padStart(6)} ` +
      `${this.quarterScores[1][0].toString().padStart(6)} ` +
      `${this.quarterScores[2][0].toString().padStart(6)} ` +
      `${this.quarterScores[3][0].toString().padStart(6)} ` +
      `${this.homeScore.toString().padStart(8)}`
    );
    playByPlaySections.push(
      `${this.awayTeamName.padEnd(20)} ` +
      `${this.quarterScores[0][1].toString().padStart(6)} ` +
      `${this.quarterScores[1][1].toString().padStart(6)} ` +
      `${this.quarterScores[2][1].toString().padStart(6)} ` +
      `${this.quarterScores[3][1].toString().padStart(6)} ` +
      `${this.awayScore.toString().padStart(8)}`
    );
    playByPlaySections.push("-".repeat(80));
    playByPlaySections.push("");

    // Aggregate statistics
    const gameStats = this.aggregateQuarterStatistics();

    // Add full game box score
    playByPlaySections.push(this.generateFullGameBoxScore(finalMinutes));
    playByPlaySections.push("");

    const playByPlayText = playByPlaySections.join("\n");

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      quarterScores: this.quarterScores,
      playByPlayText,
      gameStatistics: gameStats,
      quarterResults: this.quarterResults,
      finalStamina,
      minutesPlayed: finalMinutes
    };
  }

  private aggregateQuarterStatistics(): Record<string, any> {
    const homeStats = {
      points: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      tov: 0,
      stl: 0,
      blk: 0,
      pf: 0,
    };
    const awayStats = { ...homeStats };

    // Aggregate from each quarter (simplified)
    for (const quarterResult of this.quarterResults) {
      homeStats.points += quarterResult.homeScore;
      awayStats.points += quarterResult.awayScore;
      // Would aggregate detailed stats from possession results
    }

    return {
      homeTeam: this.homeTeamName,
      awayTeam: this.awayTeamName,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      homeStats,
      awayStats,
      totalPossessions: this.quarterResults.reduce((sum, qr) => sum + qr.possessionCount, 0),
    };
  }

  private generateFullGameBoxScore(minutesPlayed: Record<string, number>): string {
    const lines: string[] = [];
    lines.push("FULL GAME BOX SCORE:");
    lines.push("=".repeat(80));
    lines.push("");

    // Simplified box score (full implementation would aggregate detailed player stats)
    lines.push(`${this.homeTeamName}`);
    lines.push("-".repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ` +
      `${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'FG%'.padStart(5)}`
    );
    lines.push("-".repeat(80));

    const homePlayers = [...this.homeRoster].sort((a, b) => {
      const aMin = minutesPlayed[a.name] || 0;
      const bMin = minutesPlayed[b.name] || 0;
      return bMin - aMin;
    });

    for (const player of homePlayers) {
      const mins = minutesPlayed[player.name] || 0;
      lines.push(
        `${player.name.padEnd(20)} ${Math.round(mins).toString().padStart(4)} ` +
        `${'0'.padStart(4)} ${'0'.padStart(4)} ${'0'.padStart(4)} ${'0'.padStart(3)} ` +
        `${'0/0'.padStart(7)} ${'0.0'.padStart(5)}`
      );
    }

    lines.push("");
    lines.push(`${this.awayTeamName}`);
    lines.push("-".repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ` +
      `${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'FG%'.padStart(5)}`
    );
    lines.push("-".repeat(80));

    const awayPlayers = [...this.awayRoster].sort((a, b) => {
      const aMin = minutesPlayed[a.name] || 0;
      const bMin = minutesPlayed[b.name] || 0;
      return bMin - aMin;
    });

    for (const player of awayPlayers) {
      const mins = minutesPlayed[player.name] || 0;
      lines.push(
        `${player.name.padEnd(20)} ${Math.round(mins).toString().padStart(4)} ` +
        `${'0'.padStart(4)} ${'0'.padStart(4)} ${'0'.padStart(4)} ${'0'.padStart(3)} ` +
        `${'0/0'.padStart(7)} ${'0.0'.padStart(5)}`
      );
    }

    lines.push("");
    lines.push("=".repeat(80));

    return lines.join("\n");
  }
}
