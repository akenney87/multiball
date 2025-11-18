/**
 * Basketball Simulator - Quarter Simulation System
 *
 * Main orchestrator for complete 12-minute quarter.
 *
 * Integrates all M2 systems:
 * 1. Stamina tracking (staminaManager)
 * 2. Substitution logic (substitutions)
 * 3. Clock management (gameClock)
 * 4. Play-by-play logging (playByPlay)
 * 5. Possession simulation (possession from M1)
 *
 * Main Loop:
 * 1. Check substitutions (both teams)
 * 2. Determine possession (alternate)
 * 3. Apply stamina degradation to active players
 * 4. Simulate possession
 * 5. Update score
 * 6. Apply stamina cost
 * 7. Recover bench stamina
 * 8. Log play-by-play
 * 9. Update clock
 * 10. Update minutes played
 * 11. Repeat until quarter ends
 *
 * @module simulation/game/quarterSimulation
 */

import type { Player, TacticalSettings } from '../../data/types';
import { GameClock, calculatePossessionDuration } from '../clock/gameClock';
import { StaminaTracker, getDegradedTeam } from '../stamina/staminaManager';
import { SubstitutionManager } from '../systems/substitutions';
import { TimeoutManager, applyTimeoutStaminaRecovery } from '../systems/timeoutManager';
import { PlayByPlayLogger } from '../playByPlay/playByPlay';
import { PossessionState, DeadBallReason } from '../possession/possessionState';
import type { FoulSystem } from '../systems/fouls';
import * as possession from '../possession/possession';

// =============================================================================
// QUARTER RESULT DATA STRUCTURE
// =============================================================================

export interface QuarterResult {
  homeScore: number;
  awayScore: number;
  possessionCount: number;
  playByPlayText: string;
  quarterStatistics: Record<string, any>;
  possessionResults: possession.PossessionResult[];
  staminaFinal: Record<string, number>;
  minutesPlayed: Record<string, number>;
  homeEndingLineup: Player[];
  awayEndingLineup: Player[];
}

// =============================================================================
// QUARTER SIMULATOR CLASS
// =============================================================================

export class QuarterSimulator {
  private homeRoster: Player[];
  private awayRoster: Player[];
  private tacticalHome: TacticalSettings;
  private tacticalAway: TacticalSettings;
  private homeTeamName: string;
  private awayTeamName: string;
  private quarterNumber: number;
  private cumulativeHomeScore: number;
  private cumulativeAwayScore: number;

  private gameClock: GameClock;
  private staminaTracker: StaminaTracker;
  private substitutionManager: SubstitutionManager;
  private foulSystem: FoulSystem | null;
  private timeoutManager: TimeoutManager | null;
  private playByPlayLogger: PlayByPlayLogger;

  private homeScore: number = 0;
  private awayScore: number = 0;
  private possessionCount: number = 0;
  private minutesPlayed: Record<string, number> = {};
  private possessionResults: possession.PossessionResult[] = [];

  constructor(
    homeRoster: Player[],
    awayRoster: Player[],
    tacticalHome: TacticalSettings,
    tacticalAway: TacticalSettings,
    homeTeamName: string = "Home",
    awayTeamName: string = "Away",
    quarterNumber: number = 1,
    cumulativeHomeScore: number = 0,
    cumulativeAwayScore: number = 0,
    timeoutManager: TimeoutManager | null = null,
    foulSystem: FoulSystem | null = null,
    homeStartingLineup: Player[] | null = null,
    awayStartingLineup: Player[] | null = null
  ) {
    this.homeRoster = homeRoster;
    this.awayRoster = awayRoster;
    this.tacticalHome = tacticalHome;
    this.tacticalAway = tacticalAway;
    this.homeTeamName = homeTeamName;
    this.awayTeamName = awayTeamName;
    this.quarterNumber = quarterNumber;
    this.cumulativeHomeScore = cumulativeHomeScore;
    this.cumulativeAwayScore = cumulativeAwayScore;

    // Select starting lineups
    const homeStarting = homeStartingLineup || this.selectStartingLineup(homeRoster, tacticalHome);
    const awayStarting = awayStartingLineup || this.selectStartingLineup(awayRoster, tacticalAway);

    // Initialize subsystems
    this.gameClock = new GameClock(12);
    this.staminaTracker = new StaminaTracker([...homeRoster, ...awayRoster]);
    this.substitutionManager = new SubstitutionManager(
      homeRoster,
      awayRoster,
      this.extractMinutesAllocation(tacticalHome),
      this.extractMinutesAllocation(tacticalAway),
      homeStarting,
      awayStarting,
      tacticalHome,
      tacticalAway
    );

    this.foulSystem = foulSystem;
    this.timeoutManager = timeoutManager;

    // Initialize minutes played
    [...homeRoster, ...awayRoster].forEach(p => {
      this.minutesPlayed[p.name] = 0.0;
    });

    // Initialize play-by-play logger
    this.playByPlayLogger = new PlayByPlayLogger(
      homeTeamName,
      awayTeamName,
      quarterNumber,
      this.minutesPlayed,
      cumulativeHomeScore,
      cumulativeAwayScore,
      foulSystem
    );

    this.playByPlayLogger.initializePlayerTeamMapping(homeRoster, awayRoster);
  }

  /**
   * Simulate complete 12-minute quarter.
   */
  public simulateQuarter(seed?: number): QuarterResult {
    if (seed !== undefined) {
      // Set random seed if provided (for deterministic testing)
      Math.random = (() => {
        let s = seed;
        return () => {
          s = Math.sin(s) * 10000;
          return s - Math.floor(s);
        };
      })();
    }

    // Track possession ownership (home starts)
    let homeHasPossession = true;
    let possessionCount = 0;

    // Initialize possession state machine
    const possessionState = new PossessionState('home');

    // Between-quarter substitution window (Q2-Q4)
    if (this.quarterNumber > 1) {
      possessionState.deadBallReason = DeadBallReason.QUARTER_END;
      if (possessionState.canSubstitute()) {
        const currentTime = this.gameClock.formatTime();
        const timeRemaining = this.gameClock.getTimeRemaining();
        const subEvents = this.substitutionManager.checkAndExecuteSubstitutions(
          this.staminaTracker,
          currentTime,
          timeRemaining,
          this.quarterNumber,
          this.cumulativeHomeScore + this.homeScore,
          this.cumulativeAwayScore + this.awayScore
        );

        for (const event of subEvents) {
          const teamStr = event.team === 'home' ? 'Home' : 'Away';
          this.playByPlayLogger.addSubstitution(
            this.gameClock.getTimeRemaining(),
            teamStr,
            event.playerOut,
            event.playerIn,
            event.reason,
            event.staminaOut
          );
        }
      }
    }

    // Main quarter loop
    while (!this.gameClock.isQuarterOver()) {
      // Check timeouts BEFORE possession
      const timeoutExecuted = this.checkTimeouts(possessionState);

      if (timeoutExecuted) {
        this.gameClock.tick(1);
        possessionState.startNewPossession();
        continue;
      }

      // Sync possession with state
      const possessionTeam = possessionState.getPossessionTeam();
      homeHasPossession = (possessionTeam === 'home');

      // Check substitutions if legal
      const quarterStart = (possessionCount === 0);
      const allowSubstitutions = quarterStart || possessionState.canSubstitute();

      if (allowSubstitutions) {
        // Execute substitutions for both teams
        // (Simplified - full implementation would match Python's complex end-game logic)
      }

      // Get active lineups
      const homeActive = this.substitutionManager.getHomeActive();
      const awayActive = this.substitutionManager.getAwayActive();

      // Determine offensive/defensive teams
      const offensiveTeam = homeHasPossession ? homeActive : awayActive;
      const defensiveTeam = homeHasPossession ? awayActive : homeActive;
      const offensiveTactical = homeHasPossession ? this.tacticalHome : this.tacticalAway;
      const defensiveTactical = homeHasPossession ? this.tacticalAway : this.tacticalHome;

      // Apply stamina degradation
      const degradedOffense = getDegradedTeam(offensiveTeam, this.staminaTracker);
      const degradedDefense = getDegradedTeam(defensiveTeam, this.staminaTracker);

      // Build possession context
      const context = this.buildPossessionContext(homeHasPossession);

      // Determine defending team name
      const defendingTeamName = homeHasPossession ? 'Away' : 'Home';
      const offensiveTeamName = homeHasPossession ? 'Home' : 'Away';

      // Get original rosters for FT shooting
      const originalOffenseRoster = homeHasPossession ? this.homeRoster : this.awayRoster;
      const originalDefenseRoster = homeHasPossession ? this.awayRoster : this.homeRoster;

      // Simulate possession
      const possessionResult = possession.simulatePossession(
        degradedOffense,
        degradedDefense,
        offensiveTactical,
        defensiveTactical,
        context,
        this.foulSystem,
        this.quarterNumber,
        this.gameClock.formatTime(),
        defendingTeamName,
        offensiveTeamName,
        originalOffenseRoster,
        originalDefenseRoster
      );

      // Update score
      if (homeHasPossession) {
        this.homeScore += possessionResult.pointsScored;
      } else {
        this.awayScore += possessionResult.pointsScored;
      }

      // Apply stamina cost
      const activePlayers = [...offensiveTeam, ...defensiveTeam];
      const scoringOptions = [
        offensiveTactical.scoring_option_1,
        offensiveTactical.scoring_option_2,
        offensiveTactical.scoring_option_3
      ].filter((opt): opt is string => opt !== null && opt !== undefined);

      this.staminaTracker.applyPossessionCost(
        activePlayers,
        offensiveTactical.pace,
        scoringOptions,
        context.isTransition
      );

      // Calculate possession duration
      const possessionDurationSec = possessionResult.elapsedTimeSeconds !== undefined
        ? Math.floor(possessionResult.elapsedTimeSeconds)
        : calculatePossessionDuration(offensiveTactical.pace, context.isTransition);
      const possessionDurationMin = possessionDurationSec / 60.0;

      // Recover bench stamina
      const homeBench = this.substitutionManager.getHomeBench();
      this.staminaTracker.recoverBenchStamina(homeBench, possessionDurationMin);

      const awayBench = this.substitutionManager.getAwayBench();
      this.staminaTracker.recoverBenchStamina(awayBench, possessionDurationMin);

      // Log play-by-play
      const offenseTeamStr = homeHasPossession ? 'Home' : 'Away';
      this.playByPlayLogger.addPossession(
        this.gameClock.getTimeRemaining(),
        offenseTeamStr,
        possessionResult
      );

      // Update clock
      this.gameClock.tick(possessionDurationSec);

      // Update minutes played
      for (const player of activePlayers) {
        this.staminaTracker.addMinutes(player.name, possessionDurationSec);
      }

      this.substitutionManager.updateTimeOnCourt(this.staminaTracker, possessionDurationSec);

      // Track possession result
      this.possessionResults.push(possessionResult);

      // Update possession state
      const scoringTeamState = homeHasPossession ? 'home' : 'away';

      if (possessionResult.possessionOutcome === 'made_shot') {
        possessionState.updateAfterMadeBasket(scoringTeamState);
      } else if (possessionResult.possessionOutcome === 'missed_shot') {
        const reboundingTeam = homeHasPossession ? 'away' : 'home';
        possessionState.updateAfterDefensiveRebound(reboundingTeam);
      } else if (possessionResult.possessionOutcome === 'offensive_rebound') {
        possessionState.updateAfterOffensiveRebound(scoringTeamState);
      } else if (possessionResult.possessionOutcome === 'turnover') {
        const teamThatGotBall = homeHasPossession ? 'away' : 'home';
        const turnoverType = possessionResult.debug.turnoverType || 'violation';
        const wasStolen = possessionResult.debug.stealPlayer !== undefined;
        possessionState.updateAfterTurnover(teamThatGotBall, turnoverType, wasStolen);
      } else if (possessionResult.possessionOutcome === 'foul') {
        const teamWithBall = homeHasPossession ? 'home' : 'away';
        possessionState.updateAfterFoul(teamWithBall);
      }

      // Update scoring run trackers
      if (this.timeoutManager) {
        const scoringTeamStr = homeHasPossession ? 'Home' : 'Away';
        this.timeoutManager.updateScoringRun('Home', possessionResult.pointsScored, scoringTeamStr);
        this.timeoutManager.updateScoringRun('Away', possessionResult.pointsScored, scoringTeamStr);
      }

      // Switch possession
      if (!['offensive_rebound', 'foul'].includes(possessionResult.possessionOutcome)) {
        homeHasPossession = !homeHasPossession;
      }

      // Check for mid-quarter substitutions
      if (possessionState.canSubstitute()) {
        const currentTimeStr = this.gameClock.formatTime();
        const timeRemaining = this.gameClock.getTimeRemaining();
        const subEvents = this.substitutionManager.checkAndExecuteSubstitutions(
          this.staminaTracker,
          currentTimeStr,
          timeRemaining,
          this.quarterNumber,
          this.cumulativeHomeScore + this.homeScore,
          this.cumulativeAwayScore + this.awayScore
        );

        for (const event of subEvents) {
          const teamStr = event.team === 'home' ? 'Home' : 'Away';
          this.playByPlayLogger.addSubstitution(
            timeRemaining,
            teamStr,
            event.playerOut,
            event.playerIn,
            event.reason,
            event.staminaOut
          );
        }
      }

      // Start new possession
      possessionState.startNewPossession();
      possessionCount++;

      // Safety: prevent infinite loops
      if (possessionCount > 100) break;
    }

    // Build final result
    return this.buildQuarterResult();
  }

  private checkTimeouts(possessionState: PossessionState): boolean {
    // Simplified timeout check (full implementation would match Python)
    return false;
  }

  private selectStartingLineup(roster: Player[], tactical: TacticalSettings): Player[] {
    // Sort by minutes allocation
    const minutesAlloc = tactical.minutes_allotment;
    const sorted = [...roster].sort((a, b) => {
      const aMin = minutesAlloc[a.name] || 0;
      const bMin = minutesAlloc[b.name] || 0;
      return bMin - aMin;
    });

    return sorted.slice(0, 5);
  }

  private extractMinutesAllocation(tactical: TacticalSettings): Record<string, number> {
    const quarterAlloc: Record<string, number> = {};
    for (const [playerName, totalMinutes] of Object.entries(tactical.minutes_allotment)) {
      quarterAlloc[playerName] = totalMinutes / 4.0;
    }
    return quarterAlloc;
  }

  private buildPossessionContext(homeHasPossession: boolean): possession.PossessionContext {
    const cumulativeHome = this.cumulativeHomeScore + this.homeScore;
    const cumulativeAway = this.cumulativeAwayScore + this.awayScore;

    const scoreDiff = homeHasPossession
      ? cumulativeHome - cumulativeAway
      : cumulativeAway - cumulativeHome;

    return {
      isTransition: false,
      shotClock: 24,
      scoreDifferential: scoreDiff,
      gameTimeRemaining: this.gameClock.getTimeRemaining(),
      quarter: this.quarterNumber,
      offensiveTeam: homeHasPossession ? 'home' : 'away'
    };
  }

  private buildQuarterResult(): QuarterResult {
    // Update minutes played from stamina tracker
    for (const player of [...this.homeRoster, ...this.awayRoster]) {
      this.minutesPlayed[player.name] = this.staminaTracker.getMinutesPlayed(player.name);
    }

    // Render play-by-play
    const playByPlayText = this.playByPlayLogger.renderToText();

    // Get final stamina
    const staminaFinal = this.staminaTracker.getAllStaminaValues();

    // Capture ending lineups
    const homeEndingLineup = this.substitutionManager.getHomeActive();
    const awayEndingLineup = this.substitutionManager.getAwayActive();

    // Build quarter statistics
    const quarterStats = {
      homeTeam: this.homeTeamName,
      awayTeam: this.awayTeamName,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      possessionCount: this.possessionResults.length,
      substitutionCount: 0, // Would track from logger
      homeStats: {}, // Would aggregate from logger
      awayStats: {}, // Would aggregate from logger
    };

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      possessionCount: this.possessionResults.length,
      playByPlayText,
      quarterStatistics: quarterStats,
      possessionResults: this.possessionResults,
      staminaFinal,
      minutesPlayed: this.minutesPlayed,
      homeEndingLineup,
      awayEndingLineup
    };
  }
}
