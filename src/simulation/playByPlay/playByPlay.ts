/**
 * Basketball Simulator - Play-by-Play Log System
 *
 * Generates complete quarter narrative with:
 * 1. Possession-by-possession play-by-play
 * 2. Substitution events with timestamps
 * 3. Score progression tracking
 * 4. Quarter summary statistics
 * 5. Readable text output to file
 *
 * This is a CRITICAL M2 component requiring USER SIGN-OFF.
 *
 * @module simulation/playByPlay/playByPlay
 */

import type { Player } from '../../data/types';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// EVENT DATA STRUCTURES
// =============================================================================

/**
 * Structured event for a single possession
 */
export interface PossessionEvent {
  /** Time remaining in quarter (seconds) */
  gameClock: number;
  /** Offense team */
  offenseTeam: 'Home' | 'Away';
  /** Score before possession */
  scoreBefore: [number, number];
  /** Narrative text from possession simulation */
  playByPlayText: string;
  /** Points scored this possession */
  pointsScored: number;
  /** Outcome type */
  outcome: 'made_shot' | 'missed_shot' | 'turnover' | 'offensive_rebound' | 'foul';
  /** Name of scorer (if made shot) */
  scoringPlayer?: string;
  /** Name of shooter (for both makes and misses) */
  shooter?: string;
  /** Name of assister (if assist occurred) */
  assistPlayer?: string;
  /** Name of rebounder (if missed shot) */
  reboundPlayer?: string;
  /** Type of shot */
  shotType?: '3pt' | 'midrange' | 'rim' | 'dunk' | 'layup';
  /** Whether miss resulted in offensive rebound */
  isOffensiveRebound: boolean;
  /** Whether this is an And-1 (made shot + foul) */
  isAndOne: boolean;
}

/**
 * Structured event for a substitution
 */
export interface SubstitutionEvent {
  /** Time remaining when sub occurred */
  gameClock: number;
  /** Team making substitution */
  team: 'Home' | 'Away';
  /** Name of player exiting */
  playerOut: string;
  /** Name of player entering */
  playerIn: string;
  /** Reason for substitution */
  reason: string;
  /** Stamina value of exiting player */
  staminaOut?: number;
}

/**
 * Structured event for a timeout
 */
export interface TimeoutEvent {
  /** Time remaining when timeout was called */
  gameClock: number;
  /** Team calling timeout */
  team: 'Home' | 'Away';
  /** Reason for timeout */
  reason: string;
  /** Timeouts remaining after this timeout */
  timeoutsRemaining: number;
}

// =============================================================================
// QUARTER STATISTICS
// =============================================================================

/**
 * Player statistics for a quarter
 */
interface PlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fgm: number;
  fga: number;
}

/**
 * Team statistics for a quarter
 */
interface TeamStats {
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
}

/**
 * FoulSystem interface (minimal for type compatibility)
 */
interface FoulSystem {
  getTeamFouls(team: string): number;
}

/**
 * Aggregate statistics for a quarter.
 *
 * Tracks team-level and player-level stats for summary.
 */
export class QuarterStatistics {
  private homeTeamName: string;
  private awayTeamName: string;
  private teamStats: Record<'Home' | 'Away', TeamStats>;
  private playerStats: Map<string, PlayerStats>;
  private playerToTeam: Map<string, 'Home' | 'Away'>;

  /**
   * Initialize statistics tracker.
   *
   * @param homeTeamName - Name of home team
   * @param awayTeamName - Name of away team
   */
  constructor(homeTeamName: string, awayTeamName: string) {
    this.homeTeamName = homeTeamName;
    this.awayTeamName = awayTeamName;

    // Team-level stats
    this.teamStats = {
      Home: {
        points: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        tov: 0,
      },
      Away: {
        points: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        tov: 0,
      },
    };

    // Player-level stats
    this.playerStats = new Map();

    // Player-to-team mapping
    this.playerToTeam = new Map();
  }

  /**
   * Initialize player-to-team mapping from rosters
   *
   * @param homeRoster - Home team roster
   * @param awayRoster - Away team roster
   */
  initializePlayerTeamMapping(homeRoster: Player[], awayRoster: Player[]): void {
    for (const player of homeRoster) {
      this.playerToTeam.set(player.name, 'Home');
    }
    for (const player of awayRoster) {
      this.playerToTeam.set(player.name, 'Away');
    }
  }

  /**
   * Get or create player stats entry
   */
  private getPlayerStats(playerName: string): PlayerStats {
    if (!this.playerStats.has(playerName)) {
      this.playerStats.set(playerName, {
        points: 0,
        rebounds: 0,
        assists: 0,
        turnovers: 0,
        fgm: 0,
        fga: 0,
      });
    }
    return this.playerStats.get(playerName)!;
  }

  /**
   * Update statistics from a possession event.
   *
   * @param offenseTeam - 'Home' or 'Away'
   * @param possessionEvent - PossessionEvent with complete possession data
   */
  addPossessionResult(offenseTeam: 'Home' | 'Away', possessionEvent: PossessionEvent): void {
    const defenseTeam: 'Home' | 'Away' = offenseTeam === 'Home' ? 'Away' : 'Home';

    // Update based on outcome
    if (possessionEvent.outcome === 'turnover') {
      this.teamStats[offenseTeam].tov += 1;
    } else if (possessionEvent.outcome === 'offensive_rebound') {
      // Offensive rebound + kickout scenario
      if (possessionEvent.reboundPlayer) {
        const stats = this.getPlayerStats(possessionEvent.reboundPlayer);
        stats.rebounds += 1;
        this.teamStats[offenseTeam].oreb += 1;
        this.playerToTeam.set(possessionEvent.reboundPlayer, offenseTeam);
      }
    }

    // BUG FIX v6: Handle And-1 situations (can have any outcome)
    if (possessionEvent.isAndOne) {
      const shotType = possessionEvent.shotType ?? 'midrange';

      // Add points (basket + any FTs made)
      if (possessionEvent.pointsScored > 0) {
        this.teamStats[offenseTeam].points += possessionEvent.pointsScored;

        if (possessionEvent.shooter) {
          const stats = this.getPlayerStats(possessionEvent.shooter);
          stats.points += possessionEvent.pointsScored;
          this.playerToTeam.set(possessionEvent.shooter, offenseTeam);
        }
      }

      // Team FG stats for the made basket
      this.teamStats[offenseTeam].fga += 1;
      this.teamStats[offenseTeam].fgm += 1;

      // 3PT stats
      if (shotType === '3pt') {
        this.teamStats[offenseTeam].fg3a += 1;
        this.teamStats[offenseTeam].fg3m += 1;
      }

      // Player FG stats
      if (possessionEvent.shooter) {
        const stats = this.getPlayerStats(possessionEvent.shooter);
        stats.fga += 1;
        stats.fgm += 1;
        this.playerToTeam.set(possessionEvent.shooter, offenseTeam);
      }
    }

    // Process outcome-specific stats
    if (possessionEvent.outcome === 'foul') {
      // Foul outcome - includes free throw points
      if (!possessionEvent.isAndOne && possessionEvent.pointsScored > 0) {
        this.teamStats[offenseTeam].points += possessionEvent.pointsScored;

        if (possessionEvent.scoringPlayer) {
          const stats = this.getPlayerStats(possessionEvent.scoringPlayer);
          stats.points += possessionEvent.pointsScored;
          this.playerToTeam.set(possessionEvent.scoringPlayer, offenseTeam);
        }
      }

      // Handle rebounds from missed free throws
      if (possessionEvent.reboundPlayer) {
        const stats = this.getPlayerStats(possessionEvent.reboundPlayer);
        stats.rebounds += 1;

        if (possessionEvent.isOffensiveRebound) {
          this.teamStats[offenseTeam].oreb += 1;
          this.playerToTeam.set(possessionEvent.reboundPlayer, offenseTeam);
        } else {
          this.teamStats[defenseTeam].dreb += 1;
          this.playerToTeam.set(possessionEvent.reboundPlayer, defenseTeam);
        }
      }
    }

    if (possessionEvent.outcome === 'made_shot' || possessionEvent.outcome === 'missed_shot') {
      // Shot attempt (skip if And-1, already processed above)
      if (!possessionEvent.isAndOne) {
        const shotType = possessionEvent.shotType ?? 'midrange';

        // Field goal attempt
        this.teamStats[offenseTeam].fga += 1;

        // 3PT attempt
        if (shotType === '3pt') {
          this.teamStats[offenseTeam].fg3a += 1;
        }

        // Made shot
        if (possessionEvent.outcome === 'made_shot') {
          this.teamStats[offenseTeam].fgm += 1;
          this.teamStats[offenseTeam].points += possessionEvent.pointsScored;

          if (shotType === '3pt') {
            this.teamStats[offenseTeam].fg3m += 1;
          }

          // Player scoring
          if (possessionEvent.scoringPlayer) {
            const stats = this.getPlayerStats(possessionEvent.scoringPlayer);
            stats.points += possessionEvent.pointsScored;
            stats.fgm += 1;
            this.playerToTeam.set(possessionEvent.scoringPlayer, offenseTeam);
          }

          // Track FGA using shooter field
          if (possessionEvent.shooter) {
            const stats = this.getPlayerStats(possessionEvent.shooter);
            stats.fga += 1;
            this.playerToTeam.set(possessionEvent.shooter, offenseTeam);
          }
        } else {
          // Missed shot (non-And-1)
          // Track FGA for the shooter even on missed shots
          if (possessionEvent.shooter) {
            const stats = this.getPlayerStats(possessionEvent.shooter);
            stats.fga += 1;
            this.playerToTeam.set(possessionEvent.shooter, offenseTeam);
          }
        }
      }

      // Assists and rebounds still apply for And-1s
      if (possessionEvent.outcome === 'made_shot') {
        // Assist
        if (possessionEvent.assistPlayer) {
          this.teamStats[offenseTeam].ast += 1;
          const stats = this.getPlayerStats(possessionEvent.assistPlayer);
          stats.assists += 1;
          this.playerToTeam.set(possessionEvent.assistPlayer, offenseTeam);
        }

        // Offensive rebound (for made putbacks)
        if (possessionEvent.reboundPlayer && possessionEvent.isOffensiveRebound) {
          const stats = this.getPlayerStats(possessionEvent.reboundPlayer);
          stats.rebounds += 1;
          this.teamStats[offenseTeam].oreb += 1;
          this.playerToTeam.set(possessionEvent.reboundPlayer, offenseTeam);
        }
      } else if (possessionEvent.outcome === 'missed_shot') {
        // Missed putback after made free throws
        if (!possessionEvent.isAndOne && possessionEvent.pointsScored > 0) {
          this.teamStats[offenseTeam].points += possessionEvent.pointsScored;

          if (possessionEvent.scoringPlayer) {
            const stats = this.getPlayerStats(possessionEvent.scoringPlayer);
            stats.points += possessionEvent.pointsScored;
          }
        }

        // Rebound
        if (possessionEvent.reboundPlayer) {
          const stats = this.getPlayerStats(possessionEvent.reboundPlayer);
          stats.rebounds += 1;

          if (possessionEvent.isOffensiveRebound) {
            this.teamStats[offenseTeam].oreb += 1;
            this.playerToTeam.set(possessionEvent.reboundPlayer, offenseTeam);
          } else {
            this.teamStats[defenseTeam].dreb += 1;
            this.playerToTeam.set(possessionEvent.reboundPlayer, defenseTeam);
          }
        }
      }
    }
  }

  /**
   * Generate team summary text.
   *
   * @param team - 'Home' or 'Away'
   * @returns Formatted string with team statistics
   */
  getTeamSummary(team: 'Home' | 'Away'): string {
    const stats = this.teamStats[team];

    // Calculate percentages
    const fgPct = stats.fga > 0 ? (stats.fgm / stats.fga) * 100 : 0;
    const fg3Pct = stats.fg3a > 0 ? (stats.fg3m / stats.fg3a) * 100 : 0;

    const totalReb = stats.oreb + stats.dreb;

    return (
      `FG: ${stats.fgm}/${stats.fga} (${fgPct.toFixed(1)}%), ` +
      `3PT: ${stats.fg3m}/${stats.fg3a} (${fg3Pct.toFixed(1)}%), ` +
      `REB: ${totalReb} (${stats.oreb} off, ${stats.dreb} def), ` +
      `AST: ${stats.ast}, TO: ${stats.tov}`
    );
  }

  /**
   * Get top N performers for a given stat, filtered by team.
   *
   * @param team - 'Home' or 'Away'
   * @param stat - 'points', 'rebounds', or 'assists'
   * @param topN - Number of top performers to return
   * @returns List of [playerName, statValue] tuples, sorted descending
   */
  getTopPerformers(team: 'Home' | 'Away', stat: keyof PlayerStats, topN: number = 3): [string, number][] {
    // Filter players with non-zero stat from the specified team
    const playersWithStat: [string, number][] = [];
    for (const [player, stats] of this.playerStats.entries()) {
      if (stats[stat] > 0 && this.playerToTeam.get(player) === team) {
        playersWithStat.push([player, stats[stat]]);
      }
    }

    // Sort by stat value descending
    playersWithStat.sort((a, b) => b[1] - a[1]);

    return playersWithStat.slice(0, topN);
  }

  /**
   * Get leading scorer for a team.
   *
   * @param team - 'Home' or 'Away'
   * @returns Tuple of [playerName, points] or [null, 0] if no scorers
   */
  getLeadingScorer(team: 'Home' | 'Away'): [string | null, number] {
    const scorers = this.getTopPerformers(team, 'points', 1);
    return scorers.length > 0 ? scorers[0] : [null, 0];
  }

  /**
   * Get all player stats for a team
   */
  getPlayerStatsForTeam(team: 'Home' | 'Away'): Map<string, PlayerStats> {
    const result = new Map<string, PlayerStats>();
    for (const [player, stats] of this.playerStats.entries()) {
      if (this.playerToTeam.get(player) === team) {
        result.set(player, stats);
      }
    }
    return result;
  }
}

// =============================================================================
// PLAY-BY-PLAY LOGGER
// =============================================================================

/**
 * Accumulates and formats play-by-play narrative for entire quarter.
 *
 * Main interface for quarter simulation to log events.
 */
export class PlayByPlayLogger {
  private homeTeamName: string;
  private awayTeamName: string;
  private quarterNumber: number;
  private minutesPlayed: Record<string, number>;
  private foulSystem: FoulSystem | null;
  private possessionEvents: PossessionEvent[];
  private substitutionEvents: SubstitutionEvent[];
  private timeoutEvents: TimeoutEvent[];
  private statistics: QuarterStatistics;
  private homeScore: number;
  private awayScore: number;
  private cumulativeHomeScore: number;
  private cumulativeAwayScore: number;

  /**
   * Initialize play-by-play logger.
   *
   * @param homeTeamName - Name of home team
   * @param awayTeamName - Name of away team
   * @param quarterNumber - Which quarter (1-4)
   * @param minutesPlayed - Map of player name → minutes (updated during quarter)
   * @param cumulativeHomeScore - Score entering this quarter (for display)
   * @param cumulativeAwayScore - Score entering this quarter (for display)
   * @param foulSystem - FoulSystem instance for displaying team fouls
   */
  constructor(
    homeTeamName: string,
    awayTeamName: string,
    quarterNumber: number = 1,
    minutesPlayed?: Record<string, number>,
    cumulativeHomeScore: number = 0,
    cumulativeAwayScore: number = 0,
    foulSystem?: FoulSystem | null
  ) {
    this.homeTeamName = homeTeamName;
    this.awayTeamName = awayTeamName;
    this.quarterNumber = quarterNumber;
    this.minutesPlayed = minutesPlayed ?? {};
    this.foulSystem = foulSystem ?? null;

    this.possessionEvents = [];
    this.substitutionEvents = [];
    this.timeoutEvents = [];

    this.statistics = new QuarterStatistics(homeTeamName, awayTeamName);

    // Current score tracking (quarter-level)
    this.homeScore = 0;
    this.awayScore = 0;
    // Cumulative score (game-level for display)
    this.cumulativeHomeScore = cumulativeHomeScore;
    this.cumulativeAwayScore = cumulativeAwayScore;
  }

  /**
   * Pre-populate player-to-team mapping from rosters
   *
   * @param homeRoster - List of home team players
   * @param awayRoster - List of away team players
   */
  initializePlayerTeamMapping(homeRoster: Player[], awayRoster: Player[]): void {
    this.statistics.initializePlayerTeamMapping(homeRoster, awayRoster);
  }

  /**
   * Add a possession event to the log.
   *
   * @param gameClock - Seconds remaining when possession started
   * @param offenseTeam - 'Home' or 'Away'
   * @param possessionResult - PossessionResult from possession simulation
   */
  addPossession(
    gameClock: number,
    offenseTeam: 'Home' | 'Away',
    possessionResult: any // Would be PossessionResult type
  ): void {
    // Capture current GAME score before possession (cumulative + quarter)
    const scoreBefore: [number, number] = [
      this.cumulativeHomeScore + this.homeScore,
      this.cumulativeAwayScore + this.awayScore,
    ];

    // Extract shot type from debug info
    let shotType: PossessionEvent['shotType'] | undefined;
    let isOffensiveRebound = false;

    if (possessionResult.debug?.shot_type) {
      shotType = possessionResult.debug.shot_type;
    }

    // Check for offensive rebound
    if (possessionResult.debug?.rebound) {
      isOffensiveRebound = possessionResult.debug.rebound.offensive_rebound ?? false;
    }

    // Prioritize scoring_player (correct for putbacks), fallback to debug.shooter
    const shooter = possessionResult.scoring_player ?? possessionResult.debug?.shooter;

    // Check for And-1 situations (made shot + foul)
    let isAndOne = false;
    if (possessionResult.foul_event?.and_one) {
      isAndOne = possessionResult.foul_event.and_one;
    }

    const event: PossessionEvent = {
      gameClock,
      offenseTeam,
      scoreBefore,
      playByPlayText: possessionResult.play_by_play_text,
      pointsScored: possessionResult.points_scored,
      outcome: possessionResult.possession_outcome,
      scoringPlayer: possessionResult.scoring_player,
      shooter,
      assistPlayer: possessionResult.assist_player,
      reboundPlayer: possessionResult.rebound_player,
      shotType,
      isOffensiveRebound,
      isAndOne,
    };

    // Update score
    if (offenseTeam === 'Home') {
      this.homeScore += possessionResult.points_scored;
    } else {
      this.awayScore += possessionResult.points_scored;
    }

    // Add to event log
    this.possessionEvents.push(event);

    // Update statistics
    this.statistics.addPossessionResult(offenseTeam, event);
  }

  /**
   * Add a substitution event to the log.
   *
   * @param gameClock - Seconds remaining when sub occurred
   * @param team - 'Home' or 'Away'
   * @param playerOut - Name of player exiting
   * @param playerIn - Name of player entering
   * @param reason - Reason code
   * @param staminaOut - Stamina of exiting player (optional)
   */
  addSubstitution(
    gameClock: number,
    team: 'Home' | 'Away',
    playerOut: string,
    playerIn: string,
    reason: string,
    staminaOut?: number
  ): void {
    const event: SubstitutionEvent = {
      gameClock,
      team,
      playerOut,
      playerIn,
      reason,
      staminaOut,
    };

    this.substitutionEvents.push(event);
  }

  /**
   * Add a timeout event to the log.
   *
   * @param gameClock - Seconds remaining when timeout was called
   * @param team - 'Home' or 'Away'
   * @param reason - Reason for timeout
   * @param timeoutsRemaining - Timeouts remaining after this timeout
   */
  addTimeout(gameClock: number, team: 'Home' | 'Away', reason: string, timeoutsRemaining: number): void {
    const event: TimeoutEvent = {
      gameClock,
      team,
      reason,
      timeoutsRemaining,
    };

    this.timeoutEvents.push(event);
  }

  /**
   * Render complete quarter narrative to text.
   *
   * Combines possession events, substitution events, and quarter summary
   * into a single readable narrative.
   *
   * @returns Multi-line string with complete play-by-play
   */
  renderToText(): string {
    const lines: string[] = [];

    // Header
    const quarterOrdinals: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };
    const quarterText = quarterOrdinals[this.quarterNumber] ?? `${this.quarterNumber}TH`;

    lines.push('='.repeat(80));
    lines.push(`${quarterText} QUARTER - ${this.homeTeamName} vs ${this.awayTeamName}`.padStart(40 + quarterText.length));
    lines.push('='.repeat(80));
    lines.push('');

    // Sort all events by game clock (descending = chronological)
    type EventTuple = ['possession' | 'substitution' | 'timeout', number, number, any];
    const allEvents: EventTuple[] = [];

    for (const poss of this.possessionEvents) {
      allEvents.push(['possession', poss.gameClock, 2, poss]);
    }

    for (const sub of this.substitutionEvents) {
      // Quarter-start subs (at 720 seconds): priority 0
      // Mid-quarter subs: priority 3
      const priority = sub.gameClock === 720 ? 0 : 3;
      allEvents.push(['substitution', sub.gameClock, priority, sub]);
    }

    for (const timeout of this.timeoutEvents) {
      allEvents.push(['timeout', timeout.gameClock, 1, timeout]);
    }

    // Sort by game clock descending, then by type priority ascending
    allEvents.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[2] - b[2];
    });

    // Render events
    for (const [eventType, , , eventData] of allEvents) {
      if (eventType === 'possession') {
        lines.push(this.renderPossessionEvent(eventData));
        lines.push('');
      } else if (eventType === 'substitution') {
        lines.push(this.renderSubstitutionEvent(eventData));
        lines.push('');
      } else if (eventType === 'timeout') {
        lines.push(this.renderTimeoutEvent(eventData));
        lines.push('');
      }
    }

    // Quarter complete banner
    lines.push('='.repeat(80));
    lines.push(`${quarterText} QUARTER COMPLETE`.padStart(40 + quarterText.length / 2));
    lines.push('='.repeat(80));
    lines.push('');

    // Quarter score
    const quarterOrdinal = quarterOrdinals[this.quarterNumber] ?? '';
    lines.push(`${quarterOrdinal} QUARTER SCORE: ${this.homeTeamName} ${this.homeScore}, ${this.awayTeamName} ${this.awayScore}`);
    lines.push('');

    // Box Score
    lines.push('BOX SCORE:');
    lines.push('='.repeat(80));
    lines.push('');

    // Home team box score
    lines.push(this.homeTeamName);
    lines.push('-'.repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'FG%'.padStart(5)} ${'3P'.padStart(7)} ${'3P%'.padStart(5)}`
    );
    lines.push('-'.repeat(80));

    const homePlayerStats = this.statistics.getPlayerStatsForTeam('Home');
    const homePlayers = Array.from(homePlayerStats.entries()).sort((a, b) => b[1].points - a[1].points);

    for (const [player, stats] of homePlayers) {
      const mins = this.minutesPlayed[player] ?? 0;
      const fgPct = stats.fga > 0 ? ((stats.fgm / stats.fga) * 100).toFixed(1) : '0.0';
      lines.push(
        `${player.padEnd(20)} ${mins.toFixed(0).padStart(4)} ${stats.points.toString().padStart(4)} ${stats.rebounds.toString().padStart(4)} ${stats.assists.toString().padStart(4)} ${stats.turnovers.toString().padStart(3)} ${`${stats.fgm}/${stats.fga}`.padStart(7)} ${fgPct.padStart(5)} ${'0/0'.padStart(7)} ${'0.0'.padStart(5)}`
      );
    }

    lines.push('');
    lines.push(`TEAM: ${this.statistics.getTeamSummary('Home')}`);

    // Display team foul count
    if (this.foulSystem) {
      const homeTeamFouls = this.foulSystem.getTeamFouls('Home');
      const awayInBonus = homeTeamFouls >= 5;
      if (awayInBonus) {
        lines.push(`TEAM FOULS: ${homeTeamFouls} [${this.awayTeamName} in BONUS]`);
      } else {
        lines.push(`TEAM FOULS: ${homeTeamFouls}`);
      }
    }

    lines.push('');
    lines.push('');

    // Away team box score
    lines.push(this.awayTeamName);
    lines.push('-'.repeat(80));
    lines.push(
      `${'Player'.padEnd(20)} ${'MIN'.padStart(4)} ${'PTS'.padStart(4)} ${'REB'.padStart(4)} ${'AST'.padStart(4)} ${'TO'.padStart(3)} ${'FG'.padStart(7)} ${'FG%'.padStart(5)} ${'3P'.padStart(7)} ${'3P%'.padStart(5)}`
    );
    lines.push('-'.repeat(80));

    const awayPlayerStats = this.statistics.getPlayerStatsForTeam('Away');
    const awayPlayers = Array.from(awayPlayerStats.entries()).sort((a, b) => b[1].points - a[1].points);

    for (const [player, stats] of awayPlayers) {
      const mins = this.minutesPlayed[player] ?? 0;
      const fgPct = stats.fga > 0 ? ((stats.fgm / stats.fga) * 100).toFixed(1) : '0.0';
      lines.push(
        `${player.padEnd(20)} ${mins.toFixed(0).padStart(4)} ${stats.points.toString().padStart(4)} ${stats.rebounds.toString().padStart(4)} ${stats.assists.toString().padStart(4)} ${stats.turnovers.toString().padStart(3)} ${`${stats.fgm}/${stats.fga}`.padStart(7)} ${fgPct.padStart(5)} ${'0/0'.padStart(7)} ${'0.0'.padStart(5)}`
      );
    }

    lines.push('');
    lines.push(`TEAM: ${this.statistics.getTeamSummary('Away')}`);

    // Display team foul count
    if (this.foulSystem) {
      const awayTeamFouls = this.foulSystem.getTeamFouls('Away');
      const homeInBonus = awayTeamFouls >= 5;
      if (homeInBonus) {
        lines.push(`TEAM FOULS: ${awayTeamFouls} [${this.homeTeamName} in BONUS]`);
      } else {
        lines.push(`TEAM FOULS: ${awayTeamFouls}`);
      }
    }

    lines.push('');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Write play-by-play narrative to text file.
   *
   * @param filepath - Path to output file
   */
  writeToFile(filepath: string): void {
    // Ensure output directory exists
    const directory = path.dirname(filepath);
    if (directory && !fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Render to text
    const narrative = this.renderToText();

    // Write to file
    fs.writeFileSync(filepath, narrative, 'utf-8');
  }

  /**
   * Format game clock as MM:SS
   */
  private formatGameClock(secondsRemaining: number): string {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Render a single possession event to text
   */
  private renderPossessionEvent(event: PossessionEvent): string {
    const lines: string[] = [];

    // Timestamp and possession header
    const timestamp = this.formatGameClock(event.gameClock);
    const [homeScore, awayScore] = event.scoreBefore;
    const teamName = event.offenseTeam === 'Home' ? this.homeTeamName : this.awayTeamName;

    lines.push(`[${timestamp}] ${teamName} possession (Score: ${homeScore}-${awayScore})`);

    // Play-by-play text
    lines.push(event.playByPlayText);

    // Score update (if points scored)
    if (event.pointsScored > 0) {
      // Calculate new score
      const newHome = event.offenseTeam === 'Home' ? homeScore + event.pointsScored : homeScore;
      const newAway = event.offenseTeam === 'Away' ? awayScore + event.pointsScored : awayScore;

      lines.push(`Score: ${newHome}-${newAway}`);
    }

    return lines.join('\n');
  }

  /**
   * Render a single substitution event to text
   */
  private renderSubstitutionEvent(event: SubstitutionEvent): string {
    const timestamp = this.formatGameClock(event.gameClock);
    const teamName = event.team === 'Home' ? this.homeTeamName : this.awayTeamName;

    // Format reason
    const reasonMap: Record<string, string> = {
      low_stamina: 'low stamina',
      minutes_allocation: 'minutes management',
      injury: 'injury',
    };
    const reasonText = reasonMap[event.reason] ?? event.reason;

    // Build substitution line
    if (event.staminaOut !== undefined) {
      return `[${timestamp}] Substitution (${teamName}): ${event.playerOut} OUT (stamina: ${event.staminaOut.toFixed(0)}) → ${event.playerIn} IN (${reasonText})`;
    } else {
      return `[${timestamp}] Substitution (${teamName}): ${event.playerOut} OUT → ${event.playerIn} IN (${reasonText})`;
    }
  }

  /**
   * Render a single timeout event to text
   */
  private renderTimeoutEvent(event: TimeoutEvent): string {
    const timestamp = this.formatGameClock(event.gameClock);
    const teamName = event.team === 'Home' ? this.homeTeamName : this.awayTeamName;

    // Format reason
    const reasonMap: Record<string, string> = {
      momentum: 'stop opponent momentum',
      end_game_3pt_setup: 'draw up 3PT play',
      end_game_final_possession: 'final possession setup',
      end_game_desperation: 'desperation timeout',
    };
    const reasonText = reasonMap[event.reason] ?? event.reason;

    return `[${timestamp}] TIMEOUT - ${teamName} (${reasonText}) - ${event.timeoutsRemaining} timeouts remaining`;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format shooting percentage
 */
export function formatPercentage(made: number, attempted: number): string {
  if (attempted === 0) {
    return '0/0 (0.0%)';
  }

  const percentage = (made / attempted) * 100;
  return `${made}/${attempted} (${percentage.toFixed(1)}%)`;
}

/**
 * Format quarter number as ordinal string
 */
export function formatQuarterOrdinal(quarterNumber: number): string {
  const ordinals: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };
  return ordinals[quarterNumber] ?? `${quarterNumber}TH`;
}
