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
import type { InjuryData } from '../../systems/injurySystem';

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
  /** Post-game injuries to apply (from game-ending in-game injuries) */
  postGameInjuries: Array<{ playerId: string; injury: InjuryData }>;
  /** Players removed from game due to injury */
  injuredOutPlayers: string[];
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
  private homeMinutesAllocation: Record<string, number> | null;
  private awayMinutesAllocation: Record<string, number> | null;
  private homeStartingLineup: Player[] | null;
  private awayStartingLineup: Player[] | null;

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
    awayTeamName: string = "Away",
    homeMinutesAllocation: Record<string, number> | null = null,
    awayMinutesAllocation: Record<string, number> | null = null,
    homeStartingLineup: Player[] | null = null,
    awayStartingLineup: Player[] | null = null
  ) {
    this.homeRoster = homeRoster;
    this.awayRoster = awayRoster;
    this.tacticalHome = tacticalHome;
    this.tacticalAway = tacticalAway;
    this.homeTeamName = homeTeamName;
    this.awayTeamName = awayTeamName;
    this.homeMinutesAllocation = homeMinutesAllocation;
    this.awayMinutesAllocation = awayMinutesAllocation;
    this.homeStartingLineup = homeStartingLineup;
    this.awayStartingLineup = awayStartingLineup;
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
      this.tacticalHome.timeoutStrategy,
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

      // Get starting lineups
      // Q1: Use user's starting lineup if provided, otherwise null (auto-select)
      // Q2: Use Q1 ending lineup (continuity - bench continues)
      // Q3: Use user's starting lineup if provided (reset after halftime)
      // Q4: Use Q3 ending lineup (continuity - bench continues)
      let homeStarting: Player[] | null;
      let awayStarting: Player[] | null;

      if (quarterNum === 2 || quarterNum === 4) {
        // Continue from previous quarter's ending lineup
        homeStarting = cumulativeHomeLineup;
        awayStarting = cumulativeAwayLineup;
      } else {
        // Q1 and Q3: Use user's starting lineup if provided
        homeStarting = this.homeStartingLineup;
        awayStarting = this.awayStartingLineup;
      }

      // CRITICAL: Filter out fouled-out players from starting lineups (Q3 especially)
      if (quarterNum > 1) {
        if (homeStarting) {
          const fouledOutHome = homeStarting.filter(p => foulSystem.isFouledOut(p.name));
          if (fouledOutHome.length > 0) {
            console.log(`[Q${quarterNum}] Filtering ${fouledOutHome.length} fouled-out player(s) from home starting lineup`);
            // Replace fouled-out players with available bench players
            const availableHome = this.homeRoster.filter(p =>
              !foulSystem.isFouledOut(p.name) && !homeStarting!.some(s => s.name === p.name)
            );
            homeStarting = homeStarting.filter(p => !foulSystem.isFouledOut(p.name));
            for (let i = 0; i < fouledOutHome.length && availableHome.length > 0; i++) {
              homeStarting.push(availableHome.shift()!);
            }
          }
        }
        if (awayStarting) {
          const fouledOutAway = awayStarting.filter(p => foulSystem.isFouledOut(p.name));
          if (fouledOutAway.length > 0) {
            console.log(`[Q${quarterNum}] Filtering ${fouledOutAway.length} fouled-out player(s) from away starting lineup`);
            const availableAway = this.awayRoster.filter(p =>
              !foulSystem.isFouledOut(p.name) && !awayStarting!.some(s => s.name === p.name)
            );
            awayStarting = awayStarting.filter(p => !foulSystem.isFouledOut(p.name));
            for (let i = 0; i < fouledOutAway.length && availableAway.length > 0; i++) {
              awayStarting.push(availableAway.shift()!);
            }
          }
        }
      }

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
        awayStarting,
        this.homeMinutesAllocation,
        this.awayMinutesAllocation
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
        quarterSim['staminaTracker'].minutesPlayed.set(playerName, minutes);
      }

      // Update substitution manager with cumulative minutes from previous quarters
      if (quarterNum > 1) {
        for (const [playerName, minutes] of Object.entries(cumulativeMinutes)) {
          // Determine if player is on home or away team
          const isHome = this.homeRoster.some(p => p.name === playerName);
          const team = isHome ? 'home' : 'away';
          // Set the actual minutes (not add, since cumulativeMinutes is already total)
          quarterSim['substitutionManager']['actualMinutesHome'][playerName] = isHome ? minutes : 0;
          quarterSim['substitutionManager']['actualMinutesAway'][playerName] = isHome ? 0 : minutes;
        }
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

    // Overtime: If tied after regulation, play 5-minute OT periods until winner
    let overtimePeriod = 0;
    while (this.homeScore === this.awayScore) {
      overtimePeriod++;
      console.log(`\nOvertime ${overtimePeriod} break (2:10): Players recovering stamina...`);
      cumulativeStamina = this.applyQuarterBreakRecovery(cumulativeStamina);

      console.log(`\nSimulating Overtime ${overtimePeriod} (5 minutes)...`);

      // Create overtime quarter simulator (5 minutes instead of 12)
      const otQuarterNum = 4 + overtimePeriod; // OT1 = quarter 5, OT2 = quarter 6, etc.
      const otSim = new QuarterSimulator(
        this.homeRoster,
        this.awayRoster,
        this.tacticalHome,
        this.tacticalAway,
        this.homeTeamName,
        this.awayTeamName,
        otQuarterNum,
        this.homeScore,
        this.awayScore,
        timeoutManager,
        foulSystem,
        cumulativeHomeLineup,  // Continue from Q4 ending lineup
        cumulativeAwayLineup,
        this.homeMinutesAllocation,
        this.awayMinutesAllocation,
        5  // 5 minute overtime period
      );

      // Reset team fouls for OT
      foulSystem.resetTeamFoulsForQuarter(otQuarterNum);

      // Restore stamina from previous period
      if (cumulativeStamina !== null) {
        this.restoreStamina(otSim, cumulativeStamina);
      }

      // Restore minutes from previous periods
      for (const [playerName, minutes] of Object.entries(cumulativeMinutes)) {
        otSim['staminaTracker'].minutesPlayed.set(playerName, minutes);
      }

      // Update substitution manager with cumulative minutes
      for (const [playerName, minutes] of Object.entries(cumulativeMinutes)) {
        const isHome = this.homeRoster.some(p => p.name === playerName);
        otSim['substitutionManager']['actualMinutesHome'][playerName] = isHome ? minutes : 0;
        otSim['substitutionManager']['actualMinutesAway'][playerName] = isHome ? 0 : minutes;
      }

      // Simulate overtime period
      const otResult = otSim.simulateQuarter(seed);

      // Store result
      this.quarterResults.push(otResult);
      this.quarterScores.push([otResult.homeScore, otResult.awayScore]);

      // Update cumulative score
      this.homeScore += otResult.homeScore;
      this.awayScore += otResult.awayScore;

      // Save state for potential next OT
      cumulativeStamina = { ...otResult.staminaFinal };
      cumulativeHomeLineup = [...otResult.homeEndingLineup];
      cumulativeAwayLineup = [...otResult.awayEndingLineup];

      // Update cumulative minutes
      for (const [playerName, minutes] of Object.entries(otResult.minutesPlayed)) {
        cumulativeMinutes[playerName] = minutes;
      }

      console.log(
        `OT${overtimePeriod} complete: ${this.homeTeamName} ${this.homeScore}, ` +
        `${this.awayTeamName} ${this.awayScore}`
      );

      // Safety valve: prevent infinite loops (max 10 OT periods)
      if (overtimePeriod >= 10) {
        console.warn('Maximum overtime periods reached (10). Ending game.');
        break;
      }
    }

    // Build final game result
    return this.buildGameResult(cumulativeStamina!, cumulativeMinutes, overtimePeriod);
  }

  private restoreStamina(quarterSim: QuarterSimulator, staminaValues: Record<string, number>): void {
    // Access the private staminaState Map and use proper Map methods
    const staminaMap = quarterSim['staminaTracker']['staminaState'] as Map<string, number>;
    for (const [playerName, stamina] of Object.entries(staminaValues)) {
      if (staminaMap.has(playerName)) {
        staminaMap.set(playerName, stamina);
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
      const playerStaminaAttr = player?.attributes?.stamina ?? 50;

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
    finalMinutes: Record<string, number>,
    overtimePeriods: number = 0
  ): GameResult {
    // Apply hard cap to all minutes (48 + 5 per OT for player, 240 + 25 per OT for team)
    const MAX_GAME_MINUTES = 48.0 + (overtimePeriods * 5);
    const MAX_TEAM_MINUTES = 240.0 + (overtimePeriods * 25); // 5 players * 5 min OT
    const cappedMinutes: Record<string, number> = {};

    // First pass: cap individual minutes
    for (const [playerName, minutes] of Object.entries(finalMinutes)) {
      cappedMinutes[playerName] = Math.min(minutes, MAX_GAME_MINUTES);
    }

    // Second pass: ensure team totals don't exceed 240
    // Group players by team (home roster vs away roster)
    const homeNames = new Set(this.homeRoster.map(p => p.name));
    const awayNames = new Set(this.awayRoster.map(p => p.name));

    const normalizeTeamMinutes = (teamNames: Set<string>) => {
      let total = 0;
      for (const name of teamNames) {
        total += cappedMinutes[name] || 0;
      }
      if (total > MAX_TEAM_MINUTES) {
        // Scale down proportionally, but preserve zeros
        const scaleFactor = MAX_TEAM_MINUTES / total;
        for (const name of teamNames) {
          if (cappedMinutes[name] && cappedMinutes[name] > 0) {
            cappedMinutes[name] = Math.round(cappedMinutes[name] * scaleFactor * 100) / 100;
          }
        }
      }
    };

    normalizeTeamMinutes(homeNames);
    normalizeTeamMinutes(awayNames);

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

    // Add quarter-by-quarter scoring (with overtime if applicable)
    playByPlaySections.push(overtimePeriods > 0 ? "SCORING BY PERIOD:" : "SCORING BY QUARTER:");
    playByPlaySections.push("-".repeat(80));

    // Build header dynamically based on overtime periods
    let header = `${'Team'.padEnd(20)} ${'Q1'.padStart(6)} ${'Q2'.padStart(6)} ${'Q3'.padStart(6)} ${'Q4'.padStart(6)}`;
    for (let ot = 1; ot <= overtimePeriods; ot++) {
      header += ` ${'OT' + ot}`.padStart(6);
    }
    header += ` ${'FINAL'.padStart(8)}`;
    playByPlaySections.push(header);
    playByPlaySections.push("-".repeat(80));

    // Build home team scoring line
    let homeScoreLine = `${this.homeTeamName.padEnd(20)} `;
    for (let i = 0; i < this.quarterScores.length; i++) {
      const score = this.quarterScores[i]?.[0] ?? 0;
      homeScoreLine += `${score.toString().padStart(6)} `;
    }
    homeScoreLine += `${this.homeScore.toString().padStart(8)}`;
    playByPlaySections.push(homeScoreLine);

    // Build away team scoring line
    let awayScoreLine = `${this.awayTeamName.padEnd(20)} `;
    for (let i = 0; i < this.quarterScores.length; i++) {
      const score = this.quarterScores[i]?.[1] ?? 0;
      awayScoreLine += `${score.toString().padStart(6)} `;
    }
    awayScoreLine += `${this.awayScore.toString().padStart(8)}`;
    playByPlaySections.push(awayScoreLine);

    playByPlaySections.push("-".repeat(80));
    playByPlaySections.push("");

    // Aggregate statistics
    const gameStats = this.aggregateQuarterStatistics();

    // Add full game box score
    playByPlaySections.push(this.generateFullGameBoxScore(cappedMinutes));
    playByPlaySections.push("");

    const playByPlayText = playByPlaySections.join("\n");

    // Aggregate injuries from all quarters
    const allPostGameInjuries: Array<{ playerId: string; injury: InjuryData }> = [];
    const allInjuredOutPlayers: string[] = [];
    for (const qr of this.quarterResults) {
      if (qr.postGameInjuries) {
        allPostGameInjuries.push(...qr.postGameInjuries);
      }
      if (qr.injuredOutPlayers) {
        for (const playerId of qr.injuredOutPlayers) {
          if (!allInjuredOutPlayers.includes(playerId)) {
            allInjuredOutPlayers.push(playerId);
          }
        }
      }
    }

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      quarterScores: this.quarterScores,
      playByPlayText,
      gameStatistics: gameStats,
      quarterResults: this.quarterResults,
      finalStamina,
      minutesPlayed: cappedMinutes,
      postGameInjuries: allPostGameInjuries,
      injuredOutPlayers: allInjuredOutPlayers
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

    // Aggregate player stats from all quarters
    const homePlayerStats: Record<string, any> = {};
    const awayPlayerStats: Record<string, any> = {};

    for (const quarterResult of this.quarterResults) {
      homeStats.points += quarterResult.homeScore;
      awayStats.points += quarterResult.awayScore;

      const qStats = quarterResult.quarterStatistics;

      // Aggregate home team player stats
      if (qStats.homeStats) {
        for (const [playerName, stats] of Object.entries(qStats.homeStats)) {
          if (!homePlayerStats[playerName]) {
            homePlayerStats[playerName] = {
              points: 0,
              rebounds: 0,
              assists: 0,
              turnovers: 0,
              fgm: 0,
              fga: 0,
              fg3m: 0,
              fg3a: 0,
              ftm: 0,
              fta: 0,
              steals: 0,
              blocks: 0,
              personalFouls: 0,
              plusMinus: 0,
            };
          }
          const pStats = stats as any;
          homePlayerStats[playerName].points += pStats.points || 0;
          homePlayerStats[playerName].rebounds += pStats.rebounds || 0;
          homePlayerStats[playerName].assists += pStats.assists || 0;
          homePlayerStats[playerName].turnovers += pStats.turnovers || 0;
          homePlayerStats[playerName].fgm += pStats.fgm || 0;
          homePlayerStats[playerName].fga += pStats.fga || 0;
          homePlayerStats[playerName].fg3m += pStats.fg3m || 0;
          homePlayerStats[playerName].fg3a += pStats.fg3a || 0;
          homePlayerStats[playerName].ftm += pStats.ftm || 0;
          homePlayerStats[playerName].fta += pStats.fta || 0;
          homePlayerStats[playerName].steals += pStats.steals || 0;
          homePlayerStats[playerName].blocks += pStats.blocks || 0;
          homePlayerStats[playerName].personalFouls += pStats.personalFouls || 0;
          homePlayerStats[playerName].plusMinus += pStats.plusMinus || 0;
        }
      }

      // Aggregate away team player stats
      if (qStats.awayStats) {
        for (const [playerName, stats] of Object.entries(qStats.awayStats)) {
          if (!awayPlayerStats[playerName]) {
            awayPlayerStats[playerName] = {
              points: 0,
              rebounds: 0,
              assists: 0,
              turnovers: 0,
              fgm: 0,
              fga: 0,
              fg3m: 0,
              fg3a: 0,
              ftm: 0,
              fta: 0,
              steals: 0,
              blocks: 0,
              personalFouls: 0,
              plusMinus: 0,
            };
          }
          const pStats = stats as any;
          awayPlayerStats[playerName].points += pStats.points || 0;
          awayPlayerStats[playerName].rebounds += pStats.rebounds || 0;
          awayPlayerStats[playerName].assists += pStats.assists || 0;
          awayPlayerStats[playerName].turnovers += pStats.turnovers || 0;
          awayPlayerStats[playerName].fgm += pStats.fgm || 0;
          awayPlayerStats[playerName].fga += pStats.fga || 0;
          awayPlayerStats[playerName].fg3m += pStats.fg3m || 0;
          awayPlayerStats[playerName].fg3a += pStats.fg3a || 0;
          awayPlayerStats[playerName].ftm += pStats.ftm || 0;
          awayPlayerStats[playerName].fta += pStats.fta || 0;
          awayPlayerStats[playerName].steals += pStats.steals || 0;
          awayPlayerStats[playerName].blocks += pStats.blocks || 0;
          awayPlayerStats[playerName].personalFouls += pStats.personalFouls || 0;
          awayPlayerStats[playerName].plusMinus += pStats.plusMinus || 0;
        }
      }
    }

    return {
      homeTeam: this.homeTeamName,
      awayTeam: this.awayTeamName,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      homeStats,
      awayStats,
      homePlayerStats,
      awayPlayerStats,
      quarterScores: this.quarterScores,
      totalPossessions: this.quarterResults.reduce((sum, qr) => sum + qr.possessionCount, 0),
    };
  }

  private generateFullGameBoxScore(minutesPlayed: Record<string, number>): string {
    const lines: string[] = [];
    lines.push("FULL GAME BOX SCORE:");
    lines.push("=".repeat(80));
    lines.push("");

    // Aggregate player stats from all quarters
    const homePlayerStats: Record<string, any> = {};
    const awayPlayerStats: Record<string, any> = {};

    for (const quarterResult of this.quarterResults) {
      const qStats = quarterResult.quarterStatistics;

      // Aggregate home team stats
      if (qStats.homeStats) {
        for (const [playerName, stats] of Object.entries(qStats.homeStats)) {
          if (!homePlayerStats[playerName]) {
            homePlayerStats[playerName] = {
              points: 0,
              rebounds: 0,
              assists: 0,
              turnovers: 0,
              fgm: 0,
              fga: 0,
              fg3m: 0,
              fg3a: 0,
              ftm: 0,
              fta: 0,
              personalFouls: 0,
            };
          }
          const pStats = stats as any;
          homePlayerStats[playerName].points += pStats.points || 0;
          homePlayerStats[playerName].rebounds += pStats.rebounds || 0;
          homePlayerStats[playerName].assists += pStats.assists || 0;
          homePlayerStats[playerName].turnovers += pStats.turnovers || 0;
          homePlayerStats[playerName].fgm += pStats.fgm || 0;
          homePlayerStats[playerName].fga += pStats.fga || 0;
          homePlayerStats[playerName].fg3m += pStats.fg3m || 0;
          homePlayerStats[playerName].fg3a += pStats.fg3a || 0;
          homePlayerStats[playerName].ftm += pStats.ftm || 0;
          homePlayerStats[playerName].fta += pStats.fta || 0;
          homePlayerStats[playerName].personalFouls += pStats.personalFouls || 0;
        }
      }

      // Aggregate away team stats
      if (qStats.awayStats) {
        for (const [playerName, stats] of Object.entries(qStats.awayStats)) {
          if (!awayPlayerStats[playerName]) {
            awayPlayerStats[playerName] = {
              points: 0,
              rebounds: 0,
              assists: 0,
              turnovers: 0,
              fgm: 0,
              fga: 0,
              fg3m: 0,
              fg3a: 0,
              ftm: 0,
              fta: 0,
              personalFouls: 0,
            };
          }
          const pStats = stats as any;
          awayPlayerStats[playerName].points += pStats.points || 0;
          awayPlayerStats[playerName].rebounds += pStats.rebounds || 0;
          awayPlayerStats[playerName].assists += pStats.assists || 0;
          awayPlayerStats[playerName].turnovers += pStats.turnovers || 0;
          awayPlayerStats[playerName].fgm += pStats.fgm || 0;
          awayPlayerStats[playerName].fga += pStats.fga || 0;
          awayPlayerStats[playerName].fg3m += pStats.fg3m || 0;
          awayPlayerStats[playerName].fg3a += pStats.fg3a || 0;
          awayPlayerStats[playerName].ftm += pStats.ftm || 0;
          awayPlayerStats[playerName].fta += pStats.fta || 0;
          awayPlayerStats[playerName].personalFouls += pStats.personalFouls || 0;
        }
      }
    }

    // Home team box score
    lines.push(`${this.homeTeamName}`);
    lines.push("-".repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ` +
      `${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'3P'.padStart(7)} ` +
      `${'FT'.padStart(7)} ${'PF'.padStart(3)}`
    );
    lines.push("-".repeat(80));

    // Only show players who actually played (minutes > 0)
    const homePlayers = [...this.homeRoster]
      .filter(p => (minutesPlayed[p.name] || 0) > 0)
      .sort((a, b) => {
        const aStats = homePlayerStats[a.name];
        const bStats = homePlayerStats[b.name];
        const aPoints = aStats?.points || 0;
        const bPoints = bStats?.points || 0;
        return bPoints - aPoints;
      });

    for (const player of homePlayers) {
      const mins = minutesPlayed[player.name] || 0;
      const stats = homePlayerStats[player.name] || {
        points: 0, rebounds: 0, assists: 0, turnovers: 0,
        fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, personalFouls: 0
      };

      lines.push(
        `${player.name.padEnd(20)} ${Math.round(mins).toString().padStart(4)} ` +
        `${stats.points.toString().padStart(4)} ${stats.rebounds.toString().padStart(4)} ` +
        `${stats.assists.toString().padStart(4)} ${stats.turnovers.toString().padStart(3)} ` +
        `${`${stats.fgm}/${stats.fga}`.padStart(7)} ${`${stats.fg3m}/${stats.fg3a}`.padStart(7)} ` +
        `${`${stats.ftm}/${stats.fta}`.padStart(7)} ${stats.personalFouls.toString().padStart(3)}`
      );
    }

    lines.push("");
    lines.push(`${this.awayTeamName}`);
    lines.push("-".repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ` +
      `${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'3P'.padStart(7)} ` +
      `${'FT'.padStart(7)} ${'PF'.padStart(3)}`
    );
    lines.push("-".repeat(80));

    // Only show players who actually played (minutes > 0)
    const awayPlayers = [...this.awayRoster]
      .filter(p => (minutesPlayed[p.name] || 0) > 0)
      .sort((a, b) => {
        const aStats = awayPlayerStats[a.name];
        const bStats = awayPlayerStats[b.name];
        const aPoints = aStats?.points || 0;
        const bPoints = bStats?.points || 0;
        return bPoints - aPoints;
      });

    for (const player of awayPlayers) {
      const mins = minutesPlayed[player.name] || 0;
      const stats = awayPlayerStats[player.name] || {
        points: 0, rebounds: 0, assists: 0, turnovers: 0,
        fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, personalFouls: 0
      };

      lines.push(
        `${player.name.padEnd(20)} ${Math.round(mins).toString().padStart(4)} ` +
        `${stats.points.toString().padStart(4)} ${stats.rebounds.toString().padStart(4)} ` +
        `${stats.assists.toString().padStart(4)} ${stats.turnovers.toString().padStart(3)} ` +
        `${`${stats.fgm}/${stats.fga}`.padStart(7)} ${`${stats.fg3m}/${stats.fg3a}`.padStart(7)} ` +
        `${`${stats.ftm}/${stats.fta}`.padStart(7)} ${stats.personalFouls.toString().padStart(3)}`
      );
    }

    lines.push("");
    lines.push("=".repeat(80));

    return lines.join("\n");
  }
}
