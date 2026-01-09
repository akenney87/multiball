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
import { flattenPlayer, getPlayerAttributes } from '../../types/player';

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
  private plusMinus: Record<string, number> = {};
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
    awayStartingLineup: Player[] | null = null,
    homeMinutesAllocation: Record<string, number> | null = null,
    awayMinutesAllocation: Record<string, number> | null = null,
    quarterLengthMinutes: number = 12
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
    this.gameClock = new GameClock(quarterLengthMinutes);
    this.staminaTracker = new StaminaTracker([...homeRoster, ...awayRoster]);
    this.substitutionManager = new SubstitutionManager(
      homeRoster,
      awayRoster,
      homeStarting,
      awayStarting,
      tacticalHome,
      tacticalAway,
      homeMinutesAllocation,
      awayMinutesAllocation
    );

    this.foulSystem = foulSystem;
    this.timeoutManager = timeoutManager;

    // Initialize minutes played and plus/minus
    [...homeRoster, ...awayRoster].forEach(p => {
      this.minutesPlayed[p.name] = 0.0;
      this.plusMinus[p.name] = 0;
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

    // Calculate rotation plans for this quarter
    this.substitutionManager.startQuarter(this.quarterNumber);

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
          this.cumulativeAwayScore + this.awayScore,
          this.foulSystem
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

    // Track pending substitutions to log before next possession
    let pendingSubstitutions: Array<{team: string, playerOut: string, playerIn: string, reason: string, stamina: number, time: number}> = [];

    // Main quarter loop
    while (!this.gameClock.isQuarterOver()) {
      // Log pending substitutions from previous possession BEFORE starting new one
      if (pendingSubstitutions.length > 0) {
        for (const sub of pendingSubstitutions) {
          this.playByPlayLogger.addSubstitution(
            sub.time,
            sub.team,
            sub.playerOut,
            sub.playerIn,
            sub.reason,
            sub.stamina
          );
        }
        pendingSubstitutions = [];
      }

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

      // Transform players to flat structure for simulation compatibility
      // Data model has nested attributes, simulation expects flat access
      // Use centralized player normalization utility
      const flatOffense = degradedOffense.map(flattenPlayer);
      const flatDefense = degradedDefense.map(flattenPlayer);

      // Build possession context
      const context = this.buildPossessionContext(homeHasPossession);

      // Capture time BEFORE possession for accurate substitution timestamps
      const timeBeforePossession = this.gameClock.getTimeRemaining();

      // Determine defending team name
      const defendingTeamName = homeHasPossession ? 'Away' : 'Home';
      const offensiveTeamName = homeHasPossession ? 'Home' : 'Away';

      // Get original rosters for FT shooting
      const originalOffenseRoster = homeHasPossession ? this.homeRoster : this.awayRoster;
      const originalDefenseRoster = homeHasPossession ? this.awayRoster : this.homeRoster;

      // Simulate possession with flattened players
      const possessionResult = possession.simulatePossession(
        flatOffense,
        flatDefense,
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

      // Update plus/minus for all players on court
      if (possessionResult.pointsScored > 0) {
        const pts = possessionResult.pointsScored;
        // Home players: +pts if home scored, -pts if away scored
        // Away players: -pts if home scored, +pts if away scored
        for (const player of offensiveTeam) {
          this.plusMinus[player.name] = (this.plusMinus[player.name] || 0) + pts;
        }
        for (const player of defensiveTeam) {
          this.plusMinus[player.name] = (this.plusMinus[player.name] || 0) - pts;
        }
      }

      // Apply stamina cost
      const activePlayers = [...offensiveTeam, ...defensiveTeam];
      const scoringOptions = (offensiveTactical.scoringOptions || [])
        .filter((opt): opt is string => opt !== null && opt !== undefined);

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
        // Check if this was an and-1 with a missed free throw
        if (possessionResult.freeThrowResult && possessionResult.reboundPlayer) {
          // And-1 with missed FT - rebound determines possession
          const reboundEvent = possessionResult.debug?.rebound;
          if (reboundEvent) {
            if (reboundEvent.offensive_rebound) {
              // Offensive rebound - possession stays with offensive team
              possessionState.updateAfterOffensiveRebound(scoringTeamState);
            } else {
              // Defensive rebound - possession switches
              const reboundingTeam = homeHasPossession ? 'away' : 'home';
              possessionState.updateAfterDefensiveRebound(reboundingTeam);
              homeHasPossession = !homeHasPossession;
            }
          } else {
            // No rebound debug info - assume defensive rebound
            console.warn('[AND-1 FT REBOUND] Missing rebound debug info, assuming defensive rebound');
            const reboundingTeam = homeHasPossession ? 'away' : 'home';
            possessionState.updateAfterDefensiveRebound(reboundingTeam);
            homeHasPossession = !homeHasPossession;
          }
        } else {
          // Regular made basket - possession switches
          possessionState.updateAfterMadeBasket(scoringTeamState);
        }
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

        // Check if free throws were shot
        if (possessionResult.freeThrowResult) {
          const ftResult = possessionResult.freeThrowResult;
          const lastFTMade = ftResult.results && ftResult.results.length > 0
            ? ftResult.results[ftResult.results.length - 1]
            : ftResult.made > 0;

          if (lastFTMade) {
            // Made FT - possession switches to defense
            possessionState.updateAfterMadeFT(teamWithBall);
            homeHasPossession = !homeHasPossession;
          } else {
            // Missed FT - rebound determines possession
            // Check if there was a rebound and whether it was offensive or defensive
            if (possessionResult.reboundPlayer) {
              // Rebound occurred - check if offensive or defensive
              const reboundEvent = possessionResult.debug?.rebound;
              if (reboundEvent) {
                if (reboundEvent.offensive_rebound) {
                  // Offensive rebound - possession stays with offensive team
                  possessionState.updateAfterOffensiveRebound(teamWithBall);
                  // No change to homeHasPossession
                } else {
                  // Defensive rebound - possession switches to defensive team
                  const reboundingTeam = homeHasPossession ? 'away' : 'home';
                  possessionState.updateAfterDefensiveRebound(reboundingTeam);
                  homeHasPossession = !homeHasPossession;
                }
              } else {
                // Rebound exists but no debug info - assume defensive rebound
                console.warn('[FT REBOUND] Rebound player exists but no debug info, assuming defensive rebound');
                const reboundingTeam = homeHasPossession ? 'away' : 'home';
                possessionState.updateAfterDefensiveRebound(reboundingTeam);
                homeHasPossession = !homeHasPossession;
              }
            } else {
              // No rebound captured (shouldn't happen) - default to possession switch
              console.warn('[FT REBOUND] No rebound player after missed FT, defaulting to possession switch');
              possessionState.updateAfterMissedFT();
              homeHasPossession = !homeHasPossession;
            }
          }
        } else {
          // Non-shooting foul - possession stays with offense
          possessionState.updateAfterFoul(teamWithBall);
          // Don't switch possession for non-shooting fouls
        }
      }

      // Update scoring run trackers
      if (this.timeoutManager) {
        const scoringTeamStr = homeHasPossession ? 'Home' : 'Away';
        this.timeoutManager.updateScoringRun('Home', possessionResult.pointsScored, scoringTeamStr);
        this.timeoutManager.updateScoringRun('Away', possessionResult.pointsScored, scoringTeamStr);
      }

      // Switch possession (excluding offensive rebounds and fouls, which are handled above)
      if (possessionResult.possessionOutcome === 'made_shot' || possessionResult.possessionOutcome === 'missed_shot' || possessionResult.possessionOutcome === 'turnover') {
        homeHasPossession = !homeHasPossession;
      }

      // Check for mid-quarter substitutions
      // Only check during dead ball situations when substitutions are legal
      if (possessionState.canSubstitute()) {
        const currentTimeStr = this.gameClock.formatTime();
        const timeRemaining = this.gameClock.getTimeRemaining();
        const subEvents = this.substitutionManager.checkAndExecuteSubstitutions(
          this.staminaTracker,
          currentTimeStr,
          timeRemaining,
          this.quarterNumber,
          this.cumulativeHomeScore + this.homeScore,
          this.cumulativeAwayScore + this.awayScore,
          this.foulSystem
        );

        // Buffer substitutions to log BEFORE next possession starts
        // Use timeBeforePossession so subs appear at the END of the previous possession
        const stateDebug = possessionState.getStateSummary();
        for (const event of subEvents) {
          const teamStr = event.team === 'home' ? 'Home' : 'Away';
          // Add dead ball reason to substitution for clarity
          const reasonWithTrigger = `${event.reason} (after ${stateDebug.deadBallReason})`;
          pendingSubstitutions.push({
            team: teamStr,
            playerOut: event.playerOut,
            playerIn: event.playerIn,
            reason: reasonWithTrigger,
            stamina: event.staminaOut ?? 0,
            time: timeBeforePossession  // Use time from BEFORE this possession started
          });
        }
      }

      // Check for fouled-out players and force substitution
      if (possessionResult.foulEvent && possessionResult.foulEvent.fouled_out) {
        const fouledOutPlayer = possessionResult.foulEvent.fouling_player;
        const foulingTeamStr = possessionResult.foulEvent.fouling_team;
        const isHomeTeam = foulingTeamStr === this.homeTeamName;

        // Log foul-out to console (play-by-play will show in substitution message)
        console.log(`\n[FOUL OUT] ${fouledOutPlayer} has fouled out (6 personal fouls)`);

        // Get the appropriate lineup manager and bench
        const lineupManager = isHomeTeam ? this.substitutionManager['homeLineupManager'] : this.substitutionManager['awayLineupManager'];
        const benchPlayers = isHomeTeam ? this.substitutionManager.getHomeBench() : this.substitutionManager.getAwayBench();

        // Find the fouled-out player in active lineup
        const activePlayers = lineupManager.getActivePlayers();
        const playerOut = activePlayers.find(p => p.name === fouledOutPlayer);

        if (playerOut && benchPlayers.length > 0) {
          // Select best available substitute (highest stamina)
          // IMPORTANT: Filter out players with 0 minutes allocation (DNP)
          const staminaValues = this.staminaTracker.getAllStaminaValues();
          const minutesAllocation = isHomeTeam
            ? this.substitutionManager['minutesAllocationHome']
            : this.substitutionManager['minutesAllocationAway'];

          // Filter out DNP players (0 allocation) and fouled-out players from eligibility
          const eligibleBench = benchPlayers.filter(p => {
            // CRITICAL: Never sub in a player who has already fouled out
            if (this.foulSystem && this.foulSystem.isFouledOut(p.name)) {
              return false;
            }
            // Check quarter allocation - if 0, player shouldn't play
            const allocation = minutesAllocation[p.name] ?? 0;
            // Also check full game allocation from roster with minutes
            const rosterWithMinutes = isHomeTeam
              ? this.substitutionManager['homeRosterWithMinutes']
              : this.substitutionManager['awayRosterWithMinutes'];
            const playerData = rosterWithMinutes.find((rp: any) => rp.name === p.name);
            const gameTarget = playerData?.minutesTarget ?? 0;
            return gameTarget > 0;
          });

          // Select substitute from eligible players (or fallback to all bench in emergency)
          const benchToUse = eligibleBench.length > 0 ? eligibleBench : benchPlayers;
          if (eligibleBench.length === 0) {
            console.warn(`[WARNING] No eligible substitutes for fouled-out player ${fouledOutPlayer} (all have 0 allocation) - using fallback`);
          }

          const substitute = benchToUse.reduce((best, p) =>
            (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
          );

          // Force substitution
          const success = lineupManager.substitute(playerOut, substitute);

          if (success) {
            // Buffer foul-out substitution to log before next possession
            pendingSubstitutions.push({
              team: foulingTeamStr,
              playerOut: fouledOutPlayer,
              playerIn: substitute.name,
              reason: 'fouled_out',
              stamina: staminaValues[fouledOutPlayer] ?? 0,
              time: this.gameClock.getTimeRemaining()
            });
            console.log(`[FOUL OUT] ${fouledOutPlayer} replaced by ${substitute.name}`);
          } else {
            console.error(`[ERROR] Failed to substitute fouled-out player ${fouledOutPlayer}`);
          }
        } else if (!playerOut) {
          console.warn(`[WARNING] Fouled-out player ${fouledOutPlayer} not found in active lineup`);
        } else {
          console.error(`[CRITICAL] No substitutes available for fouled-out player ${fouledOutPlayer}`);
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
    // Calculate overall rating for each player (average of all attributes)
    const calculateOverall = (player: any): number => {
      // Handle both nested attributes (real data) and flat attributes (test data)
      const attrs = getPlayerAttributes(player);

      const allAttributes = [
        attrs.grip_strength, attrs.arm_strength, attrs.core_strength,
        attrs.agility, attrs.acceleration, attrs.top_speed,
        attrs.jumping, attrs.reactions, attrs.stamina, attrs.balance,
        attrs.height, attrs.durability, attrs.awareness, attrs.creativity,
        attrs.determination, attrs.bravery, attrs.consistency, attrs.composure,
        attrs.patience, attrs.hand_eye_coordination, attrs.throw_accuracy,
        attrs.form_technique, attrs.finesse, attrs.deception, attrs.teamwork
      ];
      return allAttributes.reduce((sum, val) => sum + val, 0) / allAttributes.length;
    };

    // Sort by overall rating (descending) - top 5 are starters
    const sorted = [...roster].sort((a, b) => {
      return calculateOverall(b) - calculateOverall(a);
    });

    return sorted.slice(0, 5);
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
    const homePlayerStats = this.playByPlayLogger.getPlayerStatsForTeam('Home');
    const awayPlayerStats = this.playByPlayLogger.getPlayerStatsForTeam('Away');

    // Merge plusMinus into player stats
    const homeStatsWithPlusMinus: Record<string, any> = {};
    for (const [playerName, stats] of homePlayerStats) {
      homeStatsWithPlusMinus[playerName] = {
        ...stats,
        plusMinus: this.plusMinus[playerName] || 0
      };
    }

    const awayStatsWithPlusMinus: Record<string, any> = {};
    for (const [playerName, stats] of awayPlayerStats) {
      awayStatsWithPlusMinus[playerName] = {
        ...stats,
        plusMinus: this.plusMinus[playerName] || 0
      };
    }

    const quarterStats = {
      homeTeam: this.homeTeamName,
      awayTeam: this.awayTeamName,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      possessionCount: this.possessionResults.length,
      substitutionCount: 0, // Would track from logger
      homeStats: homeStatsWithPlusMinus,
      awayStats: awayStatsWithPlusMinus,
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
