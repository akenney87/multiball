/**
 * Award System
 *
 * Calculates and grants player awards:
 * - Player of the Week (weekly, per sport)
 * - Player of the Month (monthly, per sport)
 * - Player of the Year (end of season, per sport)
 * - Rookie of the Year (end of season, per sport)
 * - Championships (granted to winning team's players)
 */

import type { Match, Player, NewsItem } from '../data/types';
import type {
  AggregatedPlayerStats,
  AggregatedBaseballBattingStats,
  AggregatedBaseballPitchingStats,
  AggregatedSoccerPlayerStats,
  AggregatedSoccerGoalkeeperStats,
  GamePlayerStats,
} from './statsAggregator';
import {
  aggregatePlayerStats,
  aggregateBaseballBattingStats,
  aggregateBaseballPitchingStats,
  aggregateSoccerPlayerStats,
  aggregateSoccerGoalkeeperStats,
} from './statsAggregator';
import type { BaseballBoxScore } from '../simulation/baseball/types';
import type { SoccerBoxScore } from '../simulation/soccer/types';

// =============================================================================
// TYPES
// =============================================================================

export type Sport = 'basketball' | 'baseball' | 'soccer';

export interface AwardCandidate {
  playerId: string;
  playerName: string;
  teamId: string;
  score: number;      // Performance score for ranking
  stats: string;      // Human-readable stat line
}

export interface WeeklyAwardResult {
  sport: Sport;
  week: number;
  winner: AwardCandidate | null;
  candidates: AwardCandidate[];
}

export interface MonthlyAwardResult {
  sport: Sport;
  month: number;      // Month number in season (1-12)
  winner: AwardCandidate | null;
  candidates: AwardCandidate[];
}

export interface SeasonAwardResult {
  sport: Sport;
  awardType: 'player_of_the_year' | 'rookie_of_the_year';
  winner: AwardCandidate | null;
  candidates: AwardCandidate[];
}

// =============================================================================
// BASKETBALL SCORING
// =============================================================================

/**
 * Calculate basketball game score for a single game performance
 * Uses total production (no per-36 normalization):
 * PTS + 1.2*REB + 1.5*AST + 2*STL + 1.5*BLK - 2*TO
 *
 * Total production rewards players who dominate over full games
 */
function calculateBasketballGameScore(stats: GamePlayerStats, minutes: number): number {
  if (minutes < 10) return 0; // Minimum minutes threshold

  // Raw total production - no normalization
  return stats.points
    + 1.2 * stats.rebounds
    + 1.5 * stats.assists
    + 2.0 * stats.steals
    + 1.5 * stats.blocks
    - 2.0 * stats.turnovers;
}

/**
 * Calculate basketball season score from aggregated stats
 */
function calculateBasketballSeasonScore(stats: AggregatedPlayerStats): number {
  if (stats.gamesPlayed < 5) return 0; // Minimum games threshold
  return stats.eff; // Per-36 weighted efficiency is already calculated
}

/**
 * Format basketball stat line for display
 */
function formatBasketballStatLine(stats: GamePlayerStats): string {
  return `${stats.points} PTS, ${stats.rebounds} REB, ${stats.assists} AST`;
}

function formatBasketballSeasonStatLine(stats: AggregatedPlayerStats): string {
  return `${stats.ppg} PPG, ${stats.rpg} RPG, ${stats.apg} APG`;
}

// =============================================================================
// BASEBALL SCORING
// =============================================================================

/**
 * Calculate baseball batting game score
 * Uses total bases + walks + RBI with bonus for extra-base hits
 */
function calculateBaseballBattingGameScore(
  atBats: number,
  hits: number,
  doubles: number,
  triples: number,
  homeRuns: number,
  rbi: number,
  walks: number,
  runs: number
): number {
  if (atBats < 2) return 0; // Minimum at-bats threshold

  const totalBases = hits + doubles + (triples * 2) + (homeRuns * 3);
  return totalBases + walks * 0.5 + rbi * 1.5 + runs * 0.5 + homeRuns * 2;
}

/**
 * Calculate baseball pitching game score
 * Balanced to compete fairly with batting scores (both typically 5-25 range)
 *
 * No baseline - pure performance-based:
 * - IP rewards length (more outs = more value)
 * - K rewards dominance
 * - ER heavily penalized (runs allowed hurt)
 * - H/BB penalized (baserunners are bad)
 */
function calculateBaseballPitchingGameScore(
  inningsPitched: number,
  strikeouts: number,
  earnedRuns: number,
  hits: number,
  walks: number
): number {
  if (inningsPitched < 3) return 0; // Minimum innings threshold

  // No baseline - score purely on performance
  let score = 0;
  score += inningsPitched * 2;      // ~12-18 for a full start
  score += strikeouts * 1.5;        // Reward dominance
  score -= earnedRuns * 5;          // Heavy penalty for runs
  score -= hits * 0.5;              // Moderate penalty for hits
  score -= walks * 1;               // Penalty for free passes

  // Small bonus for quality starts (6+ IP, 3 or fewer ER)
  if (inningsPitched >= 6 && earnedRuns <= 3) {
    score += 3;
  }

  return Math.max(0, score);
}

/**
 * Calculate baseball season batting score (OPS+ inspired)
 */
function calculateBaseballSeasonBattingScore(stats: AggregatedBaseballBattingStats): number {
  if (stats.gamesPlayed < 5 || stats.atBats < 20) return 0;
  return stats.rc27; // Runs Created per 27 outs
}

/**
 * Calculate baseball season pitching score (ERA+ inspired)
 */
function calculateBaseballSeasonPitchingScore(stats: AggregatedBaseballPitchingStats): number {
  if (stats.gamesPlayed < 3 || stats.inningsPitched < 15) return 0;
  // FIP inverted (lower is better, so we subtract from baseline)
  return Math.max(0, 6.0 - stats.fip);
}

function formatBaseballBattingStatLine(
  hits: number,
  atBats: number,
  homeRuns: number,
  rbi: number
): string {
  return `${hits}-${atBats}, ${homeRuns} HR, ${rbi} RBI`;
}

/**
 * Format innings pitched in baseball notation (6.2 = 6 and 2/3 innings)
 */
function formatInningsPitched(ip: number): string {
  const whole = Math.floor(ip);
  const partial = ip - whole;

  if (partial < 0.1) {
    return `${whole}.0`;
  } else if (partial < 0.4) {
    return `${whole}.1`;  // 1/3 inning
  } else if (partial < 0.7) {
    return `${whole}.2`;  // 2/3 innings
  } else {
    return `${whole + 1}.0`;
  }
}

function formatBaseballPitchingStatLine(
  inningsPitched: number,
  strikeouts: number,
  earnedRuns: number
): string {
  return `${formatInningsPitched(inningsPitched)} IP, ${strikeouts} K, ${earnedRuns} ER`;
}

function formatBaseballSeasonBattingStatLine(stats: AggregatedBaseballBattingStats): string {
  return `.${Math.round(stats.battingAvg * 1000)} AVG, ${stats.homeRuns} HR, ${stats.rbi} RBI`;
}

function formatBaseballSeasonPitchingStatLine(stats: AggregatedBaseballPitchingStats): string {
  return `${stats.era.toFixed(2)} ERA, ${stats.wins}-${stats.losses}, ${stats.strikeouts} K`;
}

// =============================================================================
// SOCCER SCORING
// =============================================================================

/**
 * Calculate soccer game score
 * Goals/assists weighted heavily, plus raw +/- for team impact
 *
 * Note: Relative +/- doesn't work for single games because all full-90
 * players have the same +/- as the team's goal diff (making rel +/- = 0).
 * Raw +/- still rewards being on winning teams.
 *
 * Outfield: goals * 10 + assists * 5 + plusMinus * 2
 * GK: saves * 2 + cleanSheet * 10 - goalsAgainst * 3 + plusMinus * 2
 */
function calculateSoccerGameScore(
  goals: number,
  assists: number,
  saves: number,
  minutesPlayed: number,
  goalsAgainst: number,
  isGoalkeeper: boolean,
  plusMinus: number = 0
): number {
  if (minutesPlayed < 45) return 0; // Minimum minutes threshold

  if (isGoalkeeper) {
    // Goalkeeper scoring: saves + clean sheet bonus - goals against penalty + team impact
    let score = saves * 2;
    if (goalsAgainst === 0 && minutesPlayed >= 90) {
      score += 10; // Clean sheet bonus
    }
    score -= goalsAgainst * 3;
    score += plusMinus * 2;           // Reward being on field when team scores
    return Math.max(0, score);
  }

  // Outfield player scoring: goals/assists + team impact
  let score = goals * 10 + assists * 5;
  score += plusMinus * 2;             // +/- rewards being on winning teams
  return Math.max(0, score);
}

/**
 * Calculate soccer season score
 */
function calculateSoccerSeasonScore(stats: AggregatedSoccerPlayerStats): number {
  if (stats.gamesPlayed < 5) return 0;
  // Use goals + assists per game, weighted
  return (stats.goals * 1.5 + stats.assists) / stats.gamesPlayed * 10;
}

function calculateSoccerGoalkeeperSeasonScore(stats: AggregatedSoccerGoalkeeperStats): number {
  if (stats.gamesPlayed < 5) return 0;
  // Clean sheets + save percentage
  return stats.cleanSheets * 2 + stats.savePercentage / 10;
}

function formatSoccerStatLine(goals: number, assists: number): string {
  return `${goals} G, ${assists} A`;
}

function formatSoccerGoalkeeperStatLine(saves: number, goalsAgainst: number): string {
  return `${saves} saves, ${goalsAgainst} GA`;
}

function formatSoccerSeasonStatLine(stats: AggregatedSoccerPlayerStats): string {
  return `${stats.goals} G, ${stats.assists} A in ${stats.gamesPlayed} games`;
}

function formatSoccerGoalkeeperSeasonStatLine(stats: AggregatedSoccerGoalkeeperStats): string {
  return `${stats.cleanSheets} CS, ${stats.savePercentage.toFixed(1)}% saves`;
}

// =============================================================================
// WEEKLY AWARDS
// =============================================================================

/**
 * Calculate Player of the Week for a specific sport
 * Finds the best single-game performance from the week's matches
 */
export function calculateWeeklyAward(
  week: number,
  sport: Sport,
  matches: Match[],
  players: Record<string, Player>,
  _userTeamName: string,
  _teams: Array<{ id: string; name: string }>
): WeeklyAwardResult {
  const weekMatches = matches.filter(
    m => m.week === week && m.sport === sport && m.status === 'completed' && m.result?.boxScore
  );

  const candidates: AwardCandidate[] = [];

  if (sport === 'basketball') {
    for (const match of weekMatches) {
      const boxScore = match.result!.boxScore;
      const minutesPlayed = boxScore.minutesPlayed || {};

      // Process both teams
      for (const teamStats of [boxScore.homePlayerStats, boxScore.awayPlayerStats]) {
        if (!teamStats) continue;
        for (const [playerName, stats] of Object.entries(teamStats)) {
          const player = Object.values(players).find(p => p.name === playerName);
          if (!player) continue;

          const minutes = minutesPlayed[playerName] || 0;
          const gameStats = stats as GamePlayerStats;
          const score = calculateBasketballGameScore(gameStats, minutes);

          if (score > 0) {
            candidates.push({
              playerId: player.id,
              playerName: player.name,
              teamId: player.teamId,
              score,
              stats: formatBasketballStatLine(gameStats),
            });
          }
        }
      }
    }
  } else if (sport === 'baseball') {
    for (const match of weekMatches) {
      const boxScore = match.result!.boxScore as BaseballBoxScore;

      // Process batting from both teams
      for (const batting of [boxScore.homeBatting, boxScore.awayBatting]) {
        if (!batting) continue;
        for (const [playerId, stats] of Object.entries(batting)) {
          const player = players[playerId];
          if (!player) continue;

          const score = calculateBaseballBattingGameScore(
            stats.atBats || 0,
            stats.hits || 0,
            stats.doubles || 0,
            stats.triples || 0,
            stats.homeRuns || 0,
            stats.rbi || 0,
            stats.walks || 0,
            stats.runs || 0
          );

          if (score > 0) {
            candidates.push({
              playerId: player.id,
              playerName: player.name,
              teamId: player.teamId,
              score,
              stats: formatBaseballBattingStatLine(
                stats.hits || 0,
                stats.atBats || 0,
                stats.homeRuns || 0,
                stats.rbi || 0
              ),
            });
          }
        }
      }

      // Process pitching from both teams
      for (const pitching of [boxScore.homePitching, boxScore.awayPitching]) {
        if (!pitching) continue;
        for (const [playerId, stats] of Object.entries(pitching)) {
          const player = players[playerId];
          if (!player) continue;

          const score = calculateBaseballPitchingGameScore(
            stats.inningsPitched || 0,
            stats.strikeouts || 0,
            stats.earnedRuns || 0,
            stats.hits || 0,
            stats.walks || 0
          );

          if (score > 0) {
            candidates.push({
              playerId: player.id,
              playerName: player.name,
              teamId: player.teamId,
              score,
              stats: formatBaseballPitchingStatLine(
                stats.inningsPitched || 0,
                stats.strikeouts || 0,
                stats.earnedRuns || 0
              ),
            });
          }
        }
      }
    }
  } else if (sport === 'soccer') {
    for (const match of weekMatches) {
      const boxScore = match.result!.boxScore as SoccerBoxScore;
      const homeGoalsAgainst = match.result!.awayScore;
      const awayGoalsAgainst = match.result!.homeScore;

      // Process home team
      const homeStats = boxScore.homePlayerStats || {};
      for (const [playerId, stats] of Object.entries(homeStats)) {
        const player = players[playerId];
        if (!player) continue;

        const isGK = player.position === 'GK' || (stats.saves !== undefined && stats.saves > 0);
        const score = calculateSoccerGameScore(
          stats.goals || 0,
          stats.assists || 0,
          stats.saves || 0,
          stats.minutesPlayed || 0,
          homeGoalsAgainst,
          isGK,
          stats.plusMinus || 0
        );

        if (score > 0) {
          candidates.push({
            playerId: player.id,
            playerName: player.name,
            teamId: player.teamId,
            score,
            stats: isGK
              ? formatSoccerGoalkeeperStatLine(stats.saves || 0, homeGoalsAgainst)
              : formatSoccerStatLine(stats.goals || 0, stats.assists || 0),
          });
        }
      }

      // Process away team
      const awayStats = boxScore.awayPlayerStats || {};
      for (const [playerId, stats] of Object.entries(awayStats)) {
        const player = players[playerId];
        if (!player) continue;

        const isGK = player.position === 'GK' || (stats.saves !== undefined && stats.saves > 0);
        const score = calculateSoccerGameScore(
          stats.goals || 0,
          stats.assists || 0,
          stats.saves || 0,
          stats.minutesPlayed || 0,
          awayGoalsAgainst,
          isGK,
          stats.plusMinus || 0
        );

        if (score > 0) {
          candidates.push({
            playerId: player.id,
            playerName: player.name,
            teamId: player.teamId,
            score,
            stats: isGK
              ? formatSoccerGoalkeeperStatLine(stats.saves || 0, awayGoalsAgainst)
              : formatSoccerStatLine(stats.goals || 0, stats.assists || 0),
          });
        }
      }
    }
  }

  // Sort by score and take winner
  candidates.sort((a, b) => b.score - a.score);

  return {
    sport,
    week,
    winner: candidates[0] || null,
    candidates: candidates.slice(0, 5),
  };
}

// =============================================================================
// MONTHLY AWARDS
// =============================================================================

/**
 * Calculate Player of the Month
 * Aggregates performance over 4 weeks
 */
export function calculateMonthlyAward(
  month: number,
  startWeek: number,
  sport: Sport,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): MonthlyAwardResult {
  // Get matches from the 4-week period
  const monthMatches = matches.filter(
    m => m.week >= startWeek && m.week < startWeek + 4 && m.sport === sport && m.status === 'completed'
  );

  const candidates: AwardCandidate[] = [];

  if (sport === 'basketball') {
    const aggregated = aggregatePlayerStats(monthMatches, players, userTeamName, teams);
    for (const stats of aggregated) {
      const score = calculateBasketballSeasonScore(stats);
      if (score > 0) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBasketballSeasonStatLine(stats),
        });
      }
    }
  } else if (sport === 'baseball') {
    // Batting
    const batting = aggregateBaseballBattingStats(monthMatches, players, userTeamName, teams);
    for (const stats of batting) {
      const score = calculateBaseballSeasonBattingScore(stats);
      if (score > 0) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonBattingStatLine(stats),
        });
      }
    }

    // Pitching
    const pitching = aggregateBaseballPitchingStats(monthMatches, players, userTeamName, teams);
    for (const stats of pitching) {
      const score = calculateBaseballSeasonPitchingScore(stats);
      if (score > 0) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonPitchingStatLine(stats),
        });
      }
    }
  } else if (sport === 'soccer') {
    // Outfield players
    const outfield = aggregateSoccerPlayerStats(monthMatches, players, userTeamName, teams);
    for (const stats of outfield) {
      const score = calculateSoccerSeasonScore(stats);
      if (score > 0) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerSeasonStatLine(stats),
        });
      }
    }

    // Goalkeepers
    const keepers = aggregateSoccerGoalkeeperStats(monthMatches, players, userTeamName, teams);
    for (const stats of keepers) {
      const score = calculateSoccerGoalkeeperSeasonScore(stats);
      if (score > 0) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerGoalkeeperSeasonStatLine(stats),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    sport,
    month,
    winner: candidates[0] || null,
    candidates: candidates.slice(0, 5),
  };
}

// =============================================================================
// SEASON AWARDS
// =============================================================================

/**
 * Calculate Player of the Year for a specific sport
 */
export function calculatePlayerOfTheYear(
  sport: Sport,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): SeasonAwardResult {
  const sportMatches = matches.filter(m => m.sport === sport && m.status === 'completed');
  const candidates: AwardCandidate[] = [];

  if (sport === 'basketball') {
    const aggregated = aggregatePlayerStats(sportMatches, players, userTeamName, teams);
    for (const stats of aggregated) {
      const score = calculateBasketballSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 10) { // Minimum games for season award
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBasketballSeasonStatLine(stats),
        });
      }
    }
  } else if (sport === 'baseball') {
    // Consider both batting and pitching
    const batting = aggregateBaseballBattingStats(sportMatches, players, userTeamName, teams);
    for (const stats of batting) {
      const score = calculateBaseballSeasonBattingScore(stats);
      if (score > 0 && stats.gamesPlayed >= 10) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonBattingStatLine(stats),
        });
      }
    }

    const pitching = aggregateBaseballPitchingStats(sportMatches, players, userTeamName, teams);
    for (const stats of pitching) {
      const score = calculateBaseballSeasonPitchingScore(stats);
      if (score > 0 && stats.gamesPlayed >= 5) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonPitchingStatLine(stats),
        });
      }
    }
  } else if (sport === 'soccer') {
    const outfield = aggregateSoccerPlayerStats(sportMatches, players, userTeamName, teams);
    for (const stats of outfield) {
      const score = calculateSoccerSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 10) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerSeasonStatLine(stats),
        });
      }
    }

    const keepers = aggregateSoccerGoalkeeperStats(sportMatches, players, userTeamName, teams);
    for (const stats of keepers) {
      const score = calculateSoccerGoalkeeperSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 10) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerGoalkeeperSeasonStatLine(stats),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    sport,
    awardType: 'player_of_the_year',
    winner: candidates[0] || null,
    candidates: candidates.slice(0, 5),
  };
}

/**
 * Calculate Rookie of the Year for a specific sport
 * Only considers players in their first season (acquisitionType === 'draft' or 'youth' and age <= 22)
 */
export function calculateRookieOfTheYear(
  sport: Sport,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): SeasonAwardResult {
  // Filter to rookies (first year players, typically young)
  const rookies = Object.values(players).filter(p => {
    const isFirstYear = p.acquisitionType === 'draft' || p.acquisitionType === 'youth';
    const isYoung = p.age <= 22;
    return isFirstYear && isYoung;
  });

  const rookieIds = new Set(rookies.map(r => r.id));
  const sportMatches = matches.filter(m => m.sport === sport && m.status === 'completed');
  const candidates: AwardCandidate[] = [];

  if (sport === 'basketball') {
    const aggregated = aggregatePlayerStats(sportMatches, players, userTeamName, teams);
    for (const stats of aggregated) {
      if (!rookieIds.has(stats.playerId)) continue;
      const score = calculateBasketballSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 5) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBasketballSeasonStatLine(stats),
        });
      }
    }
  } else if (sport === 'baseball') {
    const batting = aggregateBaseballBattingStats(sportMatches, players, userTeamName, teams);
    for (const stats of batting) {
      if (!rookieIds.has(stats.playerId)) continue;
      const score = calculateBaseballSeasonBattingScore(stats);
      if (score > 0 && stats.gamesPlayed >= 5) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonBattingStatLine(stats),
        });
      }
    }

    const pitching = aggregateBaseballPitchingStats(sportMatches, players, userTeamName, teams);
    for (const stats of pitching) {
      if (!rookieIds.has(stats.playerId)) continue;
      const score = calculateBaseballSeasonPitchingScore(stats);
      if (score > 0 && stats.gamesPlayed >= 3) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatBaseballSeasonPitchingStatLine(stats),
        });
      }
    }
  } else if (sport === 'soccer') {
    const outfield = aggregateSoccerPlayerStats(sportMatches, players, userTeamName, teams);
    for (const stats of outfield) {
      if (!rookieIds.has(stats.playerId)) continue;
      const score = calculateSoccerSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 5) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerSeasonStatLine(stats),
        });
      }
    }

    const keepers = aggregateSoccerGoalkeeperStats(sportMatches, players, userTeamName, teams);
    for (const stats of keepers) {
      if (!rookieIds.has(stats.playerId)) continue;
      const score = calculateSoccerGoalkeeperSeasonScore(stats);
      if (score > 0 && stats.gamesPlayed >= 5) {
        candidates.push({
          playerId: stats.playerId,
          playerName: stats.playerName,
          teamId: stats.teamId,
          score,
          stats: formatSoccerGoalkeeperSeasonStatLine(stats),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    sport,
    awardType: 'rookie_of_the_year',
    winner: candidates[0] || null,
    candidates: candidates.slice(0, 5),
  };
}

// =============================================================================
// AWARD GRANTING
// =============================================================================

/**
 * Grant a Player of the Week award to a player
 * Updates the player's awards record for the specific sport
 */
export function grantWeeklyAward(player: Player, sport: Sport): Player {
  const playerOfTheWeek = { ...player.awards.playerOfTheWeek };
  playerOfTheWeek[sport] += 1;

  return {
    ...player,
    awards: {
      ...player.awards,
      playerOfTheWeek,
    },
  };
}

/**
 * Grant a Player of the Month award to a player
 */
export function grantMonthlyAward(player: Player, sport: Sport): Player {
  const playerOfTheMonth = { ...player.awards.playerOfTheMonth };
  playerOfTheMonth[sport] += 1;

  return {
    ...player,
    awards: {
      ...player.awards,
      playerOfTheMonth,
    },
  };
}

/**
 * Grant a Player of the Year award to a player
 */
export function grantPlayerOfTheYearAward(player: Player, sport: Sport): Player {
  const awards = { ...player.awards };

  if (sport === 'basketball') {
    awards.basketballPlayerOfTheYear += 1;
  } else if (sport === 'baseball') {
    awards.baseballPlayerOfTheYear += 1;
  } else if (sport === 'soccer') {
    awards.soccerPlayerOfTheYear += 1;
  }

  return { ...player, awards };
}

/**
 * Grant a Rookie of the Year award to a player
 */
export function grantRookieOfTheYearAward(player: Player): Player {
  return {
    ...player,
    awards: {
      ...player.awards,
      rookieOfTheYear: player.awards.rookieOfTheYear + 1,
    },
  };
}

/**
 * Grant a Championship to a player
 */
export function grantChampionship(player: Player): Player {
  return {
    ...player,
    awards: {
      ...player.awards,
      championships: player.awards.championships + 1,
    },
  };
}

// =============================================================================
// NEWS EVENT GENERATION
// =============================================================================

/**
 * Create a news item for an award
 */
export function createAwardNewsItem(
  awardType: 'weekly' | 'monthly' | 'player_of_year' | 'rookie_of_year' | 'championship',
  sport: Sport,
  winner: AwardCandidate,
  teamId: string,
  userTeamId: string
): NewsItem {
  const isUserTeam = teamId === userTeamId;
  const scope = isUserTeam ? 'team' : 'division';

  let title: string;
  let priority: 'critical' | 'important' | 'info';

  switch (awardType) {
    case 'weekly':
      title = `${winner.playerName} wins ${sport.charAt(0).toUpperCase() + sport.slice(1)} Player of the Week`;
      priority = isUserTeam ? 'important' : 'info';
      break;
    case 'monthly':
      title = `${winner.playerName} wins ${sport.charAt(0).toUpperCase() + sport.slice(1)} Player of the Month`;
      priority = isUserTeam ? 'important' : 'info';
      break;
    case 'player_of_year':
      title = `${winner.playerName} wins ${sport.charAt(0).toUpperCase() + sport.slice(1)} Player of the Year`;
      priority = 'critical';
      break;
    case 'rookie_of_year':
      title = `${winner.playerName} wins Rookie of the Year`;
      priority = isUserTeam ? 'critical' : 'important';
      break;
    case 'championship':
      title = `${winner.playerName} wins Championship`;
      priority = 'critical';
      break;
  }

  return {
    id: `award-${awardType}-${sport}-${Date.now()}`,
    type: 'award',
    priority,
    title,
    message: `${winner.playerName} has been named ${title.split(' wins ')[1]} with ${winner.stats}.`,
    timestamp: new Date(),
    read: false,
    relatedEntityId: winner.playerId,
    scope,
    teamId,
    sport,
  };
}

// =============================================================================
// MAIN PROCESSING FUNCTIONS
// =============================================================================

/**
 * Process weekly awards for all sports
 * Should be called at the end of each week
 */
export function processWeeklyAwards(
  week: number,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): { updatedPlayers: Record<string, Player>; newsItems: NewsItem[] } {
  const updatedPlayers = { ...players };
  const newsItems: NewsItem[] = [];

  for (const sport of ['basketball', 'baseball', 'soccer'] as Sport[]) {
    const result = calculateWeeklyAward(week, sport, matches, players, userTeamName, teams);

    if (result.winner) {
      const winnerId = result.winner.playerId;
      if (updatedPlayers[winnerId]) {
        updatedPlayers[winnerId] = grantWeeklyAward(updatedPlayers[winnerId], sport);
        newsItems.push(createAwardNewsItem(
          'weekly',
          sport,
          result.winner,
          result.winner.teamId,
          'user'
        ));
      }
    }
  }

  return { updatedPlayers, newsItems };
}

/**
 * Process monthly awards for all sports
 * Should be called at the end of each month (every 4 weeks)
 */
export function processMonthlyAwards(
  month: number,
  startWeek: number,
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): { updatedPlayers: Record<string, Player>; newsItems: NewsItem[] } {
  const updatedPlayers = { ...players };
  const newsItems: NewsItem[] = [];

  for (const sport of ['basketball', 'baseball', 'soccer'] as Sport[]) {
    const result = calculateMonthlyAward(month, startWeek, sport, matches, players, userTeamName, teams);

    if (result.winner) {
      const winnerId = result.winner.playerId;
      if (updatedPlayers[winnerId]) {
        updatedPlayers[winnerId] = grantMonthlyAward(updatedPlayers[winnerId], sport);
        newsItems.push(createAwardNewsItem(
          'monthly',
          sport,
          result.winner,
          result.winner.teamId,
          'user'
        ));
      }
    }
  }

  return { updatedPlayers, newsItems };
}

/**
 * Process end-of-season awards for all sports
 * Should be called at the end of the season
 */
export function processSeasonAwards(
  matches: Match[],
  players: Record<string, Player>,
  userTeamName: string,
  teams: Array<{ id: string; name: string }>
): { updatedPlayers: Record<string, Player>; newsItems: NewsItem[] } {
  const updatedPlayers = { ...players };
  const newsItems: NewsItem[] = [];

  for (const sport of ['basketball', 'baseball', 'soccer'] as Sport[]) {
    // Player of the Year
    const poyResult = calculatePlayerOfTheYear(sport, matches, players, userTeamName, teams);
    if (poyResult.winner) {
      const winnerId = poyResult.winner.playerId;
      if (updatedPlayers[winnerId]) {
        updatedPlayers[winnerId] = grantPlayerOfTheYearAward(updatedPlayers[winnerId], sport);
        newsItems.push(createAwardNewsItem(
          'player_of_year',
          sport,
          poyResult.winner,
          poyResult.winner.teamId,
          'user'
        ));
      }
    }

    // Rookie of the Year
    const royResult = calculateRookieOfTheYear(sport, matches, updatedPlayers, userTeamName, teams);
    if (royResult.winner) {
      const winnerId = royResult.winner.playerId;
      if (updatedPlayers[winnerId]) {
        updatedPlayers[winnerId] = grantRookieOfTheYearAward(updatedPlayers[winnerId]);
        newsItems.push(createAwardNewsItem(
          'rookie_of_year',
          sport,
          royResult.winner,
          royResult.winner.teamId,
          'user'
        ));
      }
    }
  }

  return { updatedPlayers, newsItems };
}

/**
 * Process championship awards for a winning team
 * Should be called when a team wins a championship
 */
export function processChampionshipAwards(
  winningTeamId: string,
  sport: Sport,
  players: Record<string, Player>,
  teams: Array<{ id: string; name: string }>
): { updatedPlayers: Record<string, Player>; newsItems: NewsItem[] } {
  const updatedPlayers = { ...players };
  const newsItems: NewsItem[] = [];

  // Find all players on the winning team
  const teamPlayers = Object.values(players).filter(p => p.teamId === winningTeamId);

  for (const player of teamPlayers) {
    updatedPlayers[player.id] = grantChampionship(player);
  }

  // Create a single news item for the team championship
  const teamName = winningTeamId === 'user'
    ? teams.find(t => t.id === 'user')?.name || 'Your Team'
    : teams.find(t => t.id === winningTeamId)?.name || 'Unknown Team';

  newsItems.push({
    id: `championship-${sport}-${Date.now()}`,
    type: 'award',
    priority: 'critical',
    title: `${teamName} wins ${sport.charAt(0).toUpperCase() + sport.slice(1)} Championship!`,
    message: `${teamName} has won the ${sport} championship! All players on the roster have been awarded championship rings.`,
    timestamp: new Date(),
    read: false,
    scope: winningTeamId === 'user' ? 'team' : 'global',
    teamId: winningTeamId,
    sport,
  });

  return { updatedPlayers, newsItems };
}
