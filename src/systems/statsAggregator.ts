/**
 * Stats Aggregator
 *
 * Utility functions for aggregating player and team statistics
 * from completed match box scores.
 * Supports basketball, baseball (batting/pitching), and soccer (outfield/goalkeeper).
 */

import type { Match, Player } from '../data/types';
import type { BaseballBattingLine, BaseballPitchingLine, BaseballBoxScore } from '../simulation/baseball/types';
import type { SoccerPlayerStats, SoccerBoxScore } from '../simulation/soccer/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Per-player stats from a single game box score
 */
export interface GamePlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  steals: number;
  blocks: number;
  personalFouls: number;
  plusMinus: number;
}

/**
 * Aggregated player stats across all games
 */
export interface AggregatedPlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  // Totals
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  minutesPlayed: number;
  personalFouls: number;
  plusMinus: number;
  // Averages (calculated)
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number; // turnovers per game
  mpg: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  // Per-36 Weighted Efficiency: (PTS + 1.2*REB + 1.5*AST + 2*STL + 1.5*BLK - 2*TO) / MIN * 36
  eff: number;
}

/**
 * Aggregated team stats across all games
 */
export interface AggregatedTeamStats {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  // Totals
  pointsFor: number;
  pointsAgainst: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  // Averages
  ppg: number;
  oppPpg: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  winPct: number;
}

/**
 * Single game log entry for a player
 */
export interface GameLog {
  matchId: string;
  date: Date;
  opponent: string;
  opponentId: string;
  homeAway: 'home' | 'away';
  result: 'W' | 'L';
  teamScore: number;
  opponentScore: number;
  stats: GamePlayerStats;
  minutesPlayed: number;
}

// =============================================================================
// BASEBALL TYPES
// =============================================================================

/**
 * Aggregated baseball batting stats across all games
 */
export interface AggregatedBaseballBattingStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  // Totals
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  caughtStealing: number;
  // Calculated
  battingAvg: number;
  obp: number;
  slg: number;
  ops: number;
  // RC27: Runs Created per 27 outs - estimates runs a lineup of 9 of this player would produce
  rc27: number;
}

/**
 * Aggregated baseball pitching stats across all games
 */
export interface AggregatedBaseballPitchingStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  // Totals
  inningsPitched: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  wins: number;
  losses: number;
  saves: number;
  // Calculated
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  // FIP: Fielding Independent Pitching - isolates pitcher performance from defense
  fip: number;
}

/**
 * Aggregated baseball team stats across all games
 */
export interface AggregatedBaseballTeamStats {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  // Totals
  runsFor: number;
  runsAgainst: number;
  hits: number;
  homeRuns: number;
  stolenBases: number;
  // Calculated
  runsPerGame: number;
  runsAgainstPerGame: number;
  battingAvg: number;
  era: number;
  winPct: number;
}

// =============================================================================
// SOCCER TYPES
// =============================================================================

/**
 * Aggregated soccer outfield player stats across all games
 */
export interface AggregatedSoccerPlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  // Totals
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  minutesPlayed: number;
  yellowCards: number;
  redCards: number;
  plusMinus: number;
  // Calculated
  goalsPerGame: number;
  assistsPerGame: number;
  shotAccuracy: number;
  plusMinusPer90: number;
  // Relative +/-: Player's +/- per 90 minus team's goal diff per game
  relPlusMinus: number;
  // Rating: Relative +/- - shows player's impact compared to team average
  rating: number;
}

/**
 * Aggregated soccer goalkeeper stats across all games
 */
export interface AggregatedSoccerGoalkeeperStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  // Totals
  saves: number;
  goalsAgainst: number;
  cleanSheets: number;
  minutesPlayed: number;
  yellowCards: number;
  redCards: number;
  plusMinus: number;
  // Calculated
  savesPerGame: number;
  savePercentage: number;
  goalsAgainstPerGame: number;
  plusMinusPer90: number;
  // Relative +/-: Player's +/- per 90 minus team's goal diff per game
  relPlusMinus: number;
  // Rating: Relative +/- - shows player's impact compared to team average
  rating: number;
}

/**
 * Aggregated soccer team stats across all games
 */
export interface AggregatedSoccerTeamStats {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  // Totals
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  shotsOnTarget: number;
  possession: number;
  // Calculated
  goalsPerGame: number;
  goalsAgainstPerGame: number;
  shotsPerGame: number;
  winPct: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build a map from player name to player ID for fast lookups
 */
function buildPlayerNameToIdMap(players: Record<string, Player>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [playerId, player] of Object.entries(players)) {
    map.set(player.name, playerId);
  }
  return map;
}

/**
 * Get team name by ID
 */
function getTeamName(
  teamId: string,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): string {
  if (teamId === 'user') return userTeamName;
  const team = teams.find(t => t.id === teamId);
  return team?.name || 'Unknown Team';
}

/**
 * Calculate percentage safely (returns 0 if denominator is 0)
 */
function calcPct(made: number, attempted: number): number {
  if (attempted === 0) return 0;
  return Math.round((made / attempted) * 1000) / 10; // One decimal place
}

// =============================================================================
// MAIN AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Aggregate player stats from all completed matches
 */
export function aggregatePlayerStats(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedPlayerStats[] {
  const nameToId = buildPlayerNameToIdMap(players);
  const statsMap = new Map<string, AggregatedPlayerStats>();

  // Process each completed match
  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore) continue;

    const boxScore = match.result.boxScore;
    const minutesPlayed = boxScore.minutesPlayed || {};

    // Process home team player stats
    const homePlayerStats = boxScore.homePlayerStats || {};
    for (const [playerName, stats] of Object.entries(homePlayerStats)) {
      const playerId = nameToId.get(playerName);
      if (!playerId) continue;

      const player = players[playerId];
      if (!player) continue;

      accumulatePlayerStats(
        statsMap,
        playerId,
        playerName,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats as GamePlayerStats,
        minutesPlayed[playerName] || 0
      );
    }

    // Process away team player stats
    const awayPlayerStats = boxScore.awayPlayerStats || {};
    for (const [playerName, stats] of Object.entries(awayPlayerStats)) {
      const playerId = nameToId.get(playerName);
      if (!playerId) continue;

      const player = players[playerId];
      if (!player) continue;

      accumulatePlayerStats(
        statsMap,
        playerId,
        playerName,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats as GamePlayerStats,
        minutesPlayed[playerName] || 0
      );
    }
  }

  // Calculate averages for each player
  const results: AggregatedPlayerStats[] = [];
  for (const stats of statsMap.values()) {
    const gp = stats.gamesPlayed || 1;
    stats.ppg = Math.round((stats.points / gp) * 10) / 10;
    stats.rpg = Math.round((stats.rebounds / gp) * 10) / 10;
    stats.apg = Math.round((stats.assists / gp) * 10) / 10;
    stats.spg = Math.round((stats.steals / gp) * 10) / 10;
    stats.bpg = Math.round((stats.blocks / gp) * 10) / 10;
    stats.tpg = Math.round((stats.turnovers / gp) * 10) / 10;
    stats.mpg = Math.round((stats.minutesPlayed / gp) * 10) / 10;
    stats.fgPct = calcPct(stats.fgm, stats.fga);
    stats.fg3Pct = calcPct(stats.fg3m, stats.fg3a);
    stats.ftPct = calcPct(stats.ftm, stats.fta);

    // Calculate Per-36 Weighted Efficiency: (PTS + 1.2*REB + 1.5*AST + 2*STL + 1.5*BLK - 2*TO) / MIN * 36
    const totalMinutes = stats.minutesPlayed || 1;
    const weightedTotal = stats.points
                        + 1.2 * stats.rebounds
                        + 1.5 * stats.assists
                        + 2.0 * stats.steals
                        + 1.5 * stats.blocks
                        - 2.0 * stats.turnovers;
    stats.eff = Math.round((weightedTotal / totalMinutes) * 36 * 10) / 10;

    results.push(stats);
  }

  return results;
}

/**
 * Accumulate stats for a single player
 */
function accumulatePlayerStats(
  statsMap: Map<string, AggregatedPlayerStats>,
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  gameStats: GamePlayerStats,
  minutes: number
): void {
  let stats = statsMap.get(playerId);

  if (!stats) {
    stats = {
      playerId,
      playerName,
      teamId,
      teamName,
      gamesPlayed: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      minutesPlayed: 0,
      personalFouls: 0,
      plusMinus: 0,
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      tpg: 0,
      mpg: 0,
      fgPct: 0,
      fg3Pct: 0,
      ftPct: 0,
      eff: 0,
    };
    statsMap.set(playerId, stats);
  }

  stats.gamesPlayed += 1;
  stats.points += gameStats.points || 0;
  stats.rebounds += gameStats.rebounds || 0;
  stats.assists += gameStats.assists || 0;
  stats.steals += gameStats.steals || 0;
  stats.blocks += gameStats.blocks || 0;
  stats.turnovers += gameStats.turnovers || 0;
  stats.fgm += gameStats.fgm || 0;
  stats.fga += gameStats.fga || 0;
  stats.fg3m += gameStats.fg3m || 0;
  stats.fg3a += gameStats.fg3a || 0;
  stats.ftm += gameStats.ftm || 0;
  stats.fta += gameStats.fta || 0;
  stats.personalFouls += gameStats.personalFouls || 0;
  stats.plusMinus += gameStats.plusMinus || 0;
  stats.minutesPlayed += minutes;
}

/**
 * Aggregate team stats from all completed matches
 */
export function aggregateTeamStats(
  matches: Match[],
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedTeamStats[] {
  const statsMap = new Map<string, AggregatedTeamStats>();

  // Initialize all teams
  const allTeamIds = ['user', ...teams.filter(t => t.id !== 'user').map(t => t.id)];
  for (const teamId of allTeamIds) {
    statsMap.set(teamId, {
      teamId,
      teamName: getTeamName(teamId, userTeamName, teams),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      ppg: 0,
      oppPpg: 0,
      fgPct: 0,
      fg3Pct: 0,
      ftPct: 0,
      winPct: 0,
    });
  }

  // Process each completed match
  for (const match of matches) {
    if (match.status !== 'completed' || !match.result) continue;

    const { homeScore, awayScore, boxScore } = match.result;
    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;

    // Update home team stats
    const homeStats = statsMap.get(homeTeamId);
    if (homeStats) {
      homeStats.gamesPlayed += 1;
      homeStats.pointsFor += homeScore;
      homeStats.pointsAgainst += awayScore;
      if (homeScore > awayScore) {
        homeStats.wins += 1;
      } else {
        homeStats.losses += 1;
      }

      // Add team totals from box score if available
      if (boxScore?.homeStats) {
        const ts = boxScore.homeStats;
        homeStats.fgm += ts.fgm || 0;
        homeStats.fga += ts.fga || 0;
        homeStats.fg3m += ts.fg3m || 0;
        homeStats.fg3a += ts.fg3a || 0;
        homeStats.rebounds += (ts.oreb || 0) + (ts.dreb || 0);
        homeStats.assists += ts.ast || 0;
        homeStats.turnovers += ts.tov || 0;
      }
    }

    // Update away team stats
    const awayStats = statsMap.get(awayTeamId);
    if (awayStats) {
      awayStats.gamesPlayed += 1;
      awayStats.pointsFor += awayScore;
      awayStats.pointsAgainst += homeScore;
      if (awayScore > homeScore) {
        awayStats.wins += 1;
      } else {
        awayStats.losses += 1;
      }

      // Add team totals from box score if available
      if (boxScore?.awayStats) {
        const ts = boxScore.awayStats;
        awayStats.fgm += ts.fgm || 0;
        awayStats.fga += ts.fga || 0;
        awayStats.fg3m += ts.fg3m || 0;
        awayStats.fg3a += ts.fg3a || 0;
        awayStats.rebounds += (ts.oreb || 0) + (ts.dreb || 0);
        awayStats.assists += ts.ast || 0;
        awayStats.turnovers += ts.tov || 0;
      }
    }
  }

  // Calculate averages for each team
  const results: AggregatedTeamStats[] = [];
  for (const stats of statsMap.values()) {
    if (stats.gamesPlayed === 0) continue; // Skip teams with no games

    const gp = stats.gamesPlayed;
    stats.ppg = Math.round((stats.pointsFor / gp) * 10) / 10;
    stats.oppPpg = Math.round((stats.pointsAgainst / gp) * 10) / 10;
    stats.fgPct = calcPct(stats.fgm, stats.fga);
    stats.fg3Pct = calcPct(stats.fg3m, stats.fg3a);
    stats.ftPct = calcPct(stats.ftm, stats.fta);
    stats.winPct = Math.round((stats.wins / gp) * 1000) / 10;
    results.push(stats);
  }

  return results;
}

/**
 * Get game log for a specific player
 */
export function getPlayerGameLog(
  playerId: string,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): GameLog[] {
  const player = players[playerId];
  if (!player) return [];

  const playerName = player.name;
  const playerTeamId = player.teamId;
  const gameLogs: GameLog[] = [];

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore) continue;

    const boxScore = match.result.boxScore;
    const minutesPlayed = boxScore.minutesPlayed || {};
    const isHome = match.homeTeamId === playerTeamId;
    const isAway = match.awayTeamId === playerTeamId;

    if (!isHome && !isAway) continue;

    // Find player's stats in the appropriate team's player stats
    const teamPlayerStats = isHome
      ? boxScore.homePlayerStats
      : boxScore.awayPlayerStats;

    if (!teamPlayerStats || !teamPlayerStats[playerName]) continue;

    const stats = teamPlayerStats[playerName] as GamePlayerStats;
    const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
    const teamScore = isHome ? match.result.homeScore : match.result.awayScore;
    const opponentScore = isHome ? match.result.awayScore : match.result.homeScore;

    gameLogs.push({
      matchId: match.id,
      date: match.scheduledDate,
      opponent: getTeamName(opponentId, userTeamName, teams),
      opponentId,
      homeAway: isHome ? 'home' : 'away',
      result: teamScore > opponentScore ? 'W' : 'L',
      teamScore,
      opponentScore,
      stats,
      minutesPlayed: minutesPlayed[playerName] || 0,
    });
  }

  // Sort by date (most recent first)
  gameLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return gameLogs;
}

/**
 * Format stat value for display
 */
export function formatStat(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Format percentage for display
 */
export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// =============================================================================
// BASEBALL AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Aggregate baseball batting stats from completed matches
 * Note: Baseball box scores use player IDs as keys, not player names
 */
export function aggregateBaseballBattingStats(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedBaseballBattingStats[] {
  const statsMap = new Map<string, AggregatedBaseballBattingStats>();

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore || match.sport !== 'baseball') continue;

    const boxScore = match.result.boxScore as BaseballBoxScore;

    // Process home team batting (keys are player IDs)
    const homeBatting = boxScore.homeBatting || {};
    for (const [playerId, stats] of Object.entries(homeBatting)) {
      const player = players[playerId];
      if (!player) continue;

      accumulateBaseballBattingStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }

    // Process away team batting (keys are player IDs)
    const awayBatting = boxScore.awayBatting || {};
    for (const [playerId, stats] of Object.entries(awayBatting)) {
      const player = players[playerId];
      if (!player) continue;

      accumulateBaseballBattingStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }
  }

  // Calculate derived stats
  const results: AggregatedBaseballBattingStats[] = [];
  for (const stats of statsMap.values()) {
    const ab = stats.atBats || 1;
    const pa = ab + stats.walks;
    stats.battingAvg = Math.round((stats.hits / ab) * 1000) / 1000;
    stats.obp = Math.round(((stats.hits + stats.walks) / pa) * 1000) / 1000;
    const totalBases = stats.hits + stats.doubles + (stats.triples * 2) + (stats.homeRuns * 3);
    stats.slg = Math.round((totalBases / ab) * 1000) / 1000;
    stats.ops = Math.round((stats.obp + stats.slg) * 1000) / 1000;

    // RC27: Runs Created per 27 outs (Bill James formula)
    // RC = ((H + BB) × TB) / (AB + BB), then RC27 = RC / Outs × 27
    const rc = ((stats.hits + stats.walks) * totalBases) / pa;
    const outs = ab - stats.hits + stats.caughtStealing; // Approximate outs
    stats.rc27 = outs > 0 ? Math.round((rc / outs) * 27 * 10) / 10 : 0;

    results.push(stats);
  }

  return results;
}

function accumulateBaseballBattingStats(
  statsMap: Map<string, AggregatedBaseballBattingStats>,
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  gameStats: BaseballBattingLine
): void {
  let stats = statsMap.get(playerId);
  if (!stats) {
    stats = {
      playerId, playerName, teamId, teamName,
      gamesPlayed: 0, atBats: 0, runs: 0, hits: 0, doubles: 0, triples: 0,
      homeRuns: 0, rbi: 0, walks: 0, strikeouts: 0, stolenBases: 0, caughtStealing: 0,
      battingAvg: 0, obp: 0, slg: 0, ops: 0, rc27: 0,
    };
    statsMap.set(playerId, stats);
  }

  stats.gamesPlayed += 1;
  stats.atBats += gameStats.atBats || 0;
  stats.runs += gameStats.runs || 0;
  stats.hits += gameStats.hits || 0;
  stats.doubles += gameStats.doubles || 0;
  stats.triples += gameStats.triples || 0;
  stats.homeRuns += gameStats.homeRuns || 0;
  stats.rbi += gameStats.rbi || 0;
  stats.walks += gameStats.walks || 0;
  stats.strikeouts += gameStats.strikeouts || 0;
  stats.stolenBases += gameStats.stolenBases || 0;
  stats.caughtStealing += gameStats.caughtStealing || 0;
}

/**
 * Aggregate baseball pitching stats from completed matches
 * Note: Baseball box scores use player IDs as keys, not player names
 */
export function aggregateBaseballPitchingStats(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedBaseballPitchingStats[] {
  const statsMap = new Map<string, AggregatedBaseballPitchingStats>();

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore || match.sport !== 'baseball') continue;

    const boxScore = match.result.boxScore as BaseballBoxScore;

    // Process home team pitching (keys are player IDs)
    const homePitching = boxScore.homePitching || {};
    for (const [playerId, stats] of Object.entries(homePitching)) {
      const player = players[playerId];
      if (!player) continue;

      accumulateBaseballPitchingStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }

    // Process away team pitching (keys are player IDs)
    const awayPitching = boxScore.awayPitching || {};
    for (const [playerId, stats] of Object.entries(awayPitching)) {
      const player = players[playerId];
      if (!player) continue;

      accumulateBaseballPitchingStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }
  }

  // Calculate derived stats
  const results: AggregatedBaseballPitchingStats[] = [];
  for (const stats of statsMap.values()) {
    const ip = stats.inningsPitched || 1;
    stats.era = Math.round((stats.earnedRuns / ip) * 9 * 100) / 100;
    stats.whip = Math.round(((stats.walks + stats.hits) / ip) * 100) / 100;
    stats.k9 = Math.round((stats.strikeouts / ip) * 9 * 10) / 10;
    stats.bb9 = Math.round((stats.walks / ip) * 9 * 10) / 10;

    // FIP: Fielding Independent Pitching - isolates pitcher performance from defense
    // FIP = ((13×HR + 3×BB - 2×K) / IP) + 3.1 (constant approximates league average)
    stats.fip = Math.round(((13 * stats.homeRuns + 3 * stats.walks - 2 * stats.strikeouts) / ip + 3.1) * 100) / 100;

    results.push(stats);
  }

  return results;
}

function accumulateBaseballPitchingStats(
  statsMap: Map<string, AggregatedBaseballPitchingStats>,
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  gameStats: BaseballPitchingLine
): void {
  let stats = statsMap.get(playerId);
  if (!stats) {
    stats = {
      playerId, playerName, teamId, teamName,
      gamesPlayed: 0, inningsPitched: 0, hits: 0, runs: 0, earnedRuns: 0,
      walks: 0, strikeouts: 0, homeRuns: 0, wins: 0, losses: 0, saves: 0,
      era: 0, whip: 0, k9: 0, bb9: 0, fip: 0,
    };
    statsMap.set(playerId, stats);
  }

  stats.gamesPlayed += 1;
  stats.inningsPitched += gameStats.inningsPitched || 0;
  stats.hits += gameStats.hits || 0;
  stats.runs += gameStats.runs || 0;
  stats.earnedRuns += gameStats.earnedRuns || 0;
  stats.walks += gameStats.walks || 0;
  stats.strikeouts += gameStats.strikeouts || 0;
  stats.homeRuns += gameStats.homeRuns || 0;
  if (gameStats.decision === 'W') stats.wins += 1;
  if (gameStats.decision === 'L') stats.losses += 1;
  if (gameStats.decision === 'S') stats.saves += 1;
}

/**
 * Aggregate baseball team stats from completed matches
 */
export function aggregateBaseballTeamStats(
  matches: Match[],
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedBaseballTeamStats[] {
  const statsMap = new Map<string, AggregatedBaseballTeamStats>();

  // Initialize all teams
  const allTeamIds = ['user', ...teams.filter(t => t.id !== 'user').map(t => t.id)];
  for (const teamId of allTeamIds) {
    statsMap.set(teamId, {
      teamId,
      teamName: getTeamName(teamId, userTeamName, teams),
      gamesPlayed: 0, wins: 0, losses: 0,
      runsFor: 0, runsAgainst: 0, hits: 0, homeRuns: 0, stolenBases: 0,
      runsPerGame: 0, runsAgainstPerGame: 0, battingAvg: 0, era: 0, winPct: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result || match.sport !== 'baseball') continue;

    const { homeScore, awayScore, boxScore } = match.result;
    const baseballBox = boxScore as BaseballBoxScore;

    // Update home team
    const homeStats = statsMap.get(match.homeTeamId);
    if (homeStats) {
      homeStats.gamesPlayed += 1;
      homeStats.runsFor += homeScore;
      homeStats.runsAgainst += awayScore;
      homeStats.hits += baseballBox.homeHits || 0;
      homeStats.stolenBases += baseballBox.homeStolenBases || 0;
      if (homeScore > awayScore) homeStats.wins += 1;
      else homeStats.losses += 1;

      // Accumulate home runs from batting lines
      for (const batting of Object.values(baseballBox.homeBatting || {})) {
        homeStats.homeRuns += batting.homeRuns || 0;
      }
    }

    // Update away team
    const awayStats = statsMap.get(match.awayTeamId);
    if (awayStats) {
      awayStats.gamesPlayed += 1;
      awayStats.runsFor += awayScore;
      awayStats.runsAgainst += homeScore;
      awayStats.hits += baseballBox.awayHits || 0;
      awayStats.stolenBases += baseballBox.awayStolenBases || 0;
      if (awayScore > homeScore) awayStats.wins += 1;
      else awayStats.losses += 1;

      for (const batting of Object.values(baseballBox.awayBatting || {})) {
        awayStats.homeRuns += batting.homeRuns || 0;
      }
    }
  }

  // Calculate averages
  const results: AggregatedBaseballTeamStats[] = [];
  for (const stats of statsMap.values()) {
    if (stats.gamesPlayed === 0) continue;
    const gp = stats.gamesPlayed;
    stats.runsPerGame = Math.round((stats.runsFor / gp) * 10) / 10;
    stats.runsAgainstPerGame = Math.round((stats.runsAgainst / gp) * 10) / 10;
    stats.winPct = Math.round((stats.wins / gp) * 1000) / 10;
    results.push(stats);
  }

  return results;
}

// =============================================================================
// SOCCER AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Aggregate soccer outfield player stats from completed matches
 */
export function aggregateSoccerPlayerStats(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedSoccerPlayerStats[] {
  const statsMap = new Map<string, AggregatedSoccerPlayerStats>();

  // First pass: Calculate team goal differentials per game
  // teamGoalDiff[teamId] = { goalsFor, goalsAgainst, gamesPlayed }
  const teamGoalDiff = new Map<string, { goalsFor: number; goalsAgainst: number; gamesPlayed: number }>();

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result || match.sport !== 'soccer') continue;

    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    const homeScore = match.result.homeScore;
    const awayScore = match.result.awayScore;

    // Update home team
    const homeStats = teamGoalDiff.get(homeTeamId) || { goalsFor: 0, goalsAgainst: 0, gamesPlayed: 0 };
    homeStats.goalsFor += homeScore;
    homeStats.goalsAgainst += awayScore;
    homeStats.gamesPlayed += 1;
    teamGoalDiff.set(homeTeamId, homeStats);

    // Update away team
    const awayStats = teamGoalDiff.get(awayTeamId) || { goalsFor: 0, goalsAgainst: 0, gamesPlayed: 0 };
    awayStats.goalsFor += awayScore;
    awayStats.goalsAgainst += homeScore;
    awayStats.gamesPlayed += 1;
    teamGoalDiff.set(awayTeamId, awayStats);
  }

  // Calculate team goal diff per game for each team
  const teamGoalDiffPerGame = new Map<string, number>();
  for (const [teamId, stats] of teamGoalDiff) {
    const diffPerGame = stats.gamesPlayed > 0
      ? (stats.goalsFor - stats.goalsAgainst) / stats.gamesPlayed
      : 0;
    teamGoalDiffPerGame.set(teamId, diffPerGame);
  }

  // Second pass: Accumulate player stats
  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore || match.sport !== 'soccer') continue;

    const boxScore = match.result.boxScore as SoccerBoxScore;

    // Process home team player stats (excluding goalkeepers)
    const homePlayerStats = boxScore.homePlayerStats || {};
    for (const [playerId, stats] of Object.entries(homePlayerStats)) {
      const player = players[playerId];
      if (!player) continue;
      // Skip goalkeepers (they go in goalkeeper aggregation)
      if (player.position === 'GK' || (stats.saves !== undefined && stats.saves > 0)) continue;

      accumulateSoccerPlayerStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }

    // Process away team player stats
    const awayPlayerStats = boxScore.awayPlayerStats || {};
    for (const [playerId, stats] of Object.entries(awayPlayerStats)) {
      const player = players[playerId];
      if (!player) continue;
      if (player.position === 'GK' || (stats.saves !== undefined && stats.saves > 0)) continue;

      accumulateSoccerPlayerStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats
      );
    }
  }

  // Calculate derived stats
  const results: AggregatedSoccerPlayerStats[] = [];
  for (const stats of statsMap.values()) {
    const gp = stats.gamesPlayed || 1;
    stats.goalsPerGame = Math.round((stats.goals / gp) * 10) / 10;
    stats.assistsPerGame = Math.round((stats.assists / gp) * 10) / 10;
    stats.shotAccuracy = stats.shots > 0 ? Math.round((stats.shotsOnTarget / stats.shots) * 1000) / 10 : 0;

    // Plus/minus per 90 minutes
    const minutes = stats.minutesPlayed || 1;
    stats.plusMinusPer90 = Math.round((stats.plusMinus / minutes) * 90 * 10) / 10;

    // Relative +/-: Player's +/- per 90 minus team's goal diff per game
    // This shows how much better/worse a player performs compared to their team average
    const teamAvg = teamGoalDiffPerGame.get(stats.teamId) || 0;
    stats.relPlusMinus = Math.round((stats.plusMinusPer90 - teamAvg) * 10) / 10;

    // Rating: Use relative +/- as the rating
    // Positive = player outperforms team, Negative = player underperforms team
    stats.rating = stats.relPlusMinus;

    results.push(stats);
  }

  return results;
}

function accumulateSoccerPlayerStats(
  statsMap: Map<string, AggregatedSoccerPlayerStats>,
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  gameStats: SoccerPlayerStats
): void {
  let stats = statsMap.get(playerId);
  if (!stats) {
    stats = {
      playerId, playerName, teamId, teamName,
      gamesPlayed: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
      minutesPlayed: 0, yellowCards: 0, redCards: 0, plusMinus: 0,
      goalsPerGame: 0, assistsPerGame: 0, shotAccuracy: 0, plusMinusPer90: 0, relPlusMinus: 0, rating: 0,
    };
    statsMap.set(playerId, stats);
  }

  stats.gamesPlayed += 1;
  stats.goals += gameStats.goals || 0;
  stats.assists += gameStats.assists || 0;
  stats.shots += gameStats.shots || 0;
  stats.shotsOnTarget += gameStats.shotsOnTarget || 0;
  stats.minutesPlayed += gameStats.minutesPlayed || 0;
  stats.yellowCards += gameStats.yellowCards || 0;
  stats.redCards += gameStats.redCards || 0;
  stats.plusMinus += gameStats.plusMinus || 0;
}

/**
 * Aggregate soccer goalkeeper stats from completed matches
 */
export function aggregateSoccerGoalkeeperStats(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedSoccerGoalkeeperStats[] {
  const statsMap = new Map<string, AggregatedSoccerGoalkeeperStats>();

  // First pass: Calculate team goal differentials per game
  const teamGoalDiff = new Map<string, { goalsFor: number; goalsAgainst: number; gamesPlayed: number }>();

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result || match.sport !== 'soccer') continue;

    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    const homeScore = match.result.homeScore;
    const awayScore = match.result.awayScore;

    // Update home team
    const homeStats = teamGoalDiff.get(homeTeamId) || { goalsFor: 0, goalsAgainst: 0, gamesPlayed: 0 };
    homeStats.goalsFor += homeScore;
    homeStats.goalsAgainst += awayScore;
    homeStats.gamesPlayed += 1;
    teamGoalDiff.set(homeTeamId, homeStats);

    // Update away team
    const awayStats = teamGoalDiff.get(awayTeamId) || { goalsFor: 0, goalsAgainst: 0, gamesPlayed: 0 };
    awayStats.goalsFor += awayScore;
    awayStats.goalsAgainst += homeScore;
    awayStats.gamesPlayed += 1;
    teamGoalDiff.set(awayTeamId, awayStats);
  }

  // Calculate team goal diff per game for each team
  const teamGoalDiffPerGame = new Map<string, number>();
  for (const [teamId, stats] of teamGoalDiff) {
    const diffPerGame = stats.gamesPlayed > 0
      ? (stats.goalsFor - stats.goalsAgainst) / stats.gamesPlayed
      : 0;
    teamGoalDiffPerGame.set(teamId, diffPerGame);
  }

  // Second pass: Accumulate goalkeeper stats
  for (const match of matches) {
    if (match.status !== 'completed' || !match.result?.boxScore || match.sport !== 'soccer') continue;

    const boxScore = match.result.boxScore as SoccerBoxScore;
    const homeGoalsAgainst = match.result.awayScore;
    const awayGoalsAgainst = match.result.homeScore;

    // Process home team goalkeepers
    const homePlayerStats = boxScore.homePlayerStats || {};
    for (const [playerId, stats] of Object.entries(homePlayerStats)) {
      const player = players[playerId];
      if (!player) continue;
      // Only include goalkeepers
      if (player.position !== 'GK' && (stats.saves === undefined || stats.saves === 0)) continue;

      accumulateSoccerGoalkeeperStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats,
        homeGoalsAgainst
      );
    }

    // Process away team goalkeepers
    const awayPlayerStats = boxScore.awayPlayerStats || {};
    for (const [playerId, stats] of Object.entries(awayPlayerStats)) {
      const player = players[playerId];
      if (!player) continue;
      if (player.position !== 'GK' && (stats.saves === undefined || stats.saves === 0)) continue;

      accumulateSoccerGoalkeeperStats(
        statsMap,
        playerId,
        player.name,
        player.teamId,
        getTeamName(player.teamId, userTeamName, teams),
        stats,
        awayGoalsAgainst
      );
    }
  }

  // Calculate derived stats
  const results: AggregatedSoccerGoalkeeperStats[] = [];
  for (const stats of statsMap.values()) {
    const gp = stats.gamesPlayed || 1;
    stats.savesPerGame = Math.round((stats.saves / gp) * 10) / 10;
    stats.goalsAgainstPerGame = Math.round((stats.goalsAgainst / gp) * 10) / 10;
    const totalFaced = stats.saves + stats.goalsAgainst;
    stats.savePercentage = totalFaced > 0 ? Math.round((stats.saves / totalFaced) * 1000) / 10 : 0;

    // Plus/minus per 90 minutes
    const minutes = stats.minutesPlayed || 1;
    stats.plusMinusPer90 = Math.round((stats.plusMinus / minutes) * 90 * 10) / 10;

    // Relative +/-: Player's +/- per 90 minus team's goal diff per game
    const teamAvg = teamGoalDiffPerGame.get(stats.teamId) || 0;
    stats.relPlusMinus = Math.round((stats.plusMinusPer90 - teamAvg) * 10) / 10;

    // Rating: Use relative +/- as the rating
    stats.rating = stats.relPlusMinus;

    results.push(stats);
  }

  return results;
}

function accumulateSoccerGoalkeeperStats(
  statsMap: Map<string, AggregatedSoccerGoalkeeperStats>,
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  gameStats: SoccerPlayerStats,
  goalsAgainst: number
): void {
  let stats = statsMap.get(playerId);
  if (!stats) {
    stats = {
      playerId, playerName, teamId, teamName,
      gamesPlayed: 0, saves: 0, goalsAgainst: 0, cleanSheets: 0,
      minutesPlayed: 0, yellowCards: 0, redCards: 0, plusMinus: 0,
      savesPerGame: 0, savePercentage: 0, goalsAgainstPerGame: 0, plusMinusPer90: 0, relPlusMinus: 0, rating: 0,
    };
    statsMap.set(playerId, stats);
  }

  stats.gamesPlayed += 1;
  stats.saves += gameStats.saves || 0;
  stats.goalsAgainst += goalsAgainst;
  if (goalsAgainst === 0) stats.cleanSheets += 1;
  stats.minutesPlayed += gameStats.minutesPlayed || 0;
  stats.yellowCards += gameStats.yellowCards || 0;
  stats.redCards += gameStats.redCards || 0;
  stats.plusMinus += gameStats.plusMinus || 0;
}

/**
 * Aggregate soccer team stats from completed matches
 */
export function aggregateSoccerTeamStats(
  matches: Match[],
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): AggregatedSoccerTeamStats[] {
  const statsMap = new Map<string, AggregatedSoccerTeamStats>();

  // Initialize all teams
  const allTeamIds = ['user', ...teams.filter(t => t.id !== 'user').map(t => t.id)];
  for (const teamId of allTeamIds) {
    statsMap.set(teamId, {
      teamId,
      teamName: getTeamName(teamId, userTeamName, teams),
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
      goalsFor: 0, goalsAgainst: 0, shots: 0, shotsOnTarget: 0, possession: 0,
      goalsPerGame: 0, goalsAgainstPerGame: 0, shotsPerGame: 0, winPct: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== 'completed' || !match.result || match.sport !== 'soccer') continue;

    const { homeScore, awayScore, boxScore } = match.result;
    const soccerBox = boxScore as SoccerBoxScore;

    // Update home team
    const homeStats = statsMap.get(match.homeTeamId);
    if (homeStats) {
      homeStats.gamesPlayed += 1;
      homeStats.goalsFor += homeScore;
      homeStats.goalsAgainst += awayScore;
      homeStats.shots += soccerBox.shots?.home || 0;
      homeStats.shotsOnTarget += soccerBox.shotsOnTarget?.home || 0;
      homeStats.possession += soccerBox.possession?.home || 50;

      if (homeScore > awayScore) homeStats.wins += 1;
      else if (homeScore < awayScore) homeStats.losses += 1;
      else homeStats.draws += 1;
    }

    // Update away team
    const awayStats = statsMap.get(match.awayTeamId);
    if (awayStats) {
      awayStats.gamesPlayed += 1;
      awayStats.goalsFor += awayScore;
      awayStats.goalsAgainst += homeScore;
      awayStats.shots += soccerBox.shots?.away || 0;
      awayStats.shotsOnTarget += soccerBox.shotsOnTarget?.away || 0;
      awayStats.possession += soccerBox.possession?.away || 50;

      if (awayScore > homeScore) awayStats.wins += 1;
      else if (awayScore < homeScore) awayStats.losses += 1;
      else awayStats.draws += 1;
    }
  }

  // Calculate averages
  const results: AggregatedSoccerTeamStats[] = [];
  for (const stats of statsMap.values()) {
    if (stats.gamesPlayed === 0) continue;
    const gp = stats.gamesPlayed;
    stats.goalsPerGame = Math.round((stats.goalsFor / gp) * 10) / 10;
    stats.goalsAgainstPerGame = Math.round((stats.goalsAgainst / gp) * 10) / 10;
    stats.shotsPerGame = Math.round((stats.shots / gp) * 10) / 10;
    stats.possession = Math.round(stats.possession / gp);
    stats.winPct = Math.round((stats.wins / gp) * 1000) / 10;
    results.push(stats);
  }

  return results;
}
