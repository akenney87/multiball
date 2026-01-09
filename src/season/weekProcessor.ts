/**
 * Week Processor
 *
 * Handles week-by-week season progression:
 * - Advancing to next week
 * - Getting matches for current week
 * - Processing match results
 * - Updating standings
 *
 * Week 2: Basic functionality
 * Week 4: Add AI decision triggers, events, training
 */

import type { Season, Match, MatchResult, TeamStanding } from '../data/types';

// =============================================================================
// STANDINGS MANAGEMENT
// =============================================================================

/**
 * Create initial standings for all teams
 *
 * @param teamIds - Array of team IDs
 * @returns Initial standings with all stats at zero
 */
export function createInitialStandings(teamIds: string[]): Record<string, TeamStanding> {
  const standings: Record<string, TeamStanding> = {};

  teamIds.forEach((teamId, idx) => {
    standings[teamId] = {
      teamId,
      wins: 0,
      losses: 0,
      basketball: { wins: 0, losses: 0 },
      baseball: { wins: 0, losses: 0 },
      soccer: { wins: 0, losses: 0 },
      rank: idx + 1,
    };
  });

  return standings;
}

/**
 * Calculate W-L percentage (0-1)
 */
function getWinPct(wins: number, losses: number): number {
  const total = wins + losses;
  return total === 0 ? 0 : wins / total;
}

/**
 * Update standings rankings based on total W-L%
 *
 * @param standings - Current standings
 * @returns Updated standings with recalculated ranks
 */
export function updateStandings(
  standings: Record<string, TeamStanding>
): Record<string, TeamStanding> {
  // Sort teams by W-L% (desc), then total wins (desc), then teamId (for stability)
  const sorted = Object.values(standings).sort((a, b) => {
    const aWinPct = getWinPct(a.wins, a.losses);
    const bWinPct = getWinPct(b.wins, b.losses);
    if (bWinPct !== aWinPct) return bWinPct - aWinPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamId.localeCompare(b.teamId);
  });

  // Assign ranks
  const updated: Record<string, TeamStanding> = {};
  sorted.forEach((standing, idx) => {
    updated[standing.teamId] = {
      ...standing,
      rank: idx + 1,
    };
  });

  return updated;
}

// =============================================================================
// WEEK ADVANCEMENT
// =============================================================================

/**
 * Advance season to next week
 *
 * @param season - Current season state
 * @returns Season with incremented week
 */
export function advanceWeek(season: Season): Season {
  return {
    ...season,
    currentWeek: season.currentWeek + 1,
  };
}

/**
 * Get all matches scheduled for a specific week
 *
 * Uses date-based calculation to determine which week a match falls in.
 *
 * @param season - Current season
 * @param weekNumber - Week number to get matches for
 * @returns Array of matches for that week
 */
export function getWeekMatches(season: Season, weekNumber: number): Match[] {
  const startDate = season.startDate;

  return season.matches.filter((match) => {
    const matchWeek = calculateMatchWeek(match.scheduledDate, startDate);
    return matchWeek === weekNumber;
  });
}

/**
 * Calculate which week a match falls in based on its scheduled date
 */
function calculateMatchWeek(matchDate: Date, seasonStart: Date): number {
  const diffMs = matchDate.getTime() - seasonStart.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

// =============================================================================
// MATCH PROCESSING
// =============================================================================

/**
 * Process a completed match result
 *
 * Updates match status, stores result, and updates standings.
 *
 * @param season - Current season state
 * @param matchId - ID of completed match
 * @param result - Match result data
 * @returns Updated season with match result and standings
 */
export function processMatchResult(
  season: Season,
  matchId: string,
  result: MatchResult
): Season {
  // Find and update the match
  const matchIndex = season.matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) {
    throw new Error(`Match not found: ${matchId}`);
  }

  const match = season.matches[matchIndex];
  if (!match) {
    throw new Error(`Match not found at index: ${matchIndex}`);
  }

  // Create updated matches array
  const updatedMatches: Match[] = [...season.matches];
  updatedMatches[matchIndex] = {
    ...match,
    status: 'completed' as const,
    result,
  };

  // Update standings
  const updatedStandings = applyMatchResultToStandings(
    season.standings,
    match,
    result
  );

  // Recalculate rankings
  const rankedStandings = updateStandings(updatedStandings);

  return {
    ...season,
    matches: updatedMatches,
    standings: rankedStandings,
  };
}

/**
 * Apply match result to standings
 *
 * Updates total W-L and sport-specific W-L records.
 * No draws - penalty shootouts determine winner for soccer ties.
 */
function applyMatchResultToStandings(
  standings: Record<string, TeamStanding>,
  match: Match,
  result: MatchResult
): Record<string, TeamStanding> {
  const updated = { ...standings };
  const homeTeam = match.homeTeamId;
  const awayTeam = match.awayTeamId;
  const sport = match.sport as 'basketball' | 'baseball' | 'soccer';

  // Penalty shootout determines winner if draw in regulation
  const homeWins = result.homeScore > result.awayScore ||
    (result.homeScore === result.awayScore &&
      result.penaltyShootout !== undefined &&
      (result.penaltyShootout.homeScore ?? 0) > (result.penaltyShootout.awayScore ?? 0));

  const homeStanding = updated[homeTeam];
  const awayStanding = updated[awayTeam];

  if (!homeStanding || !awayStanding) {
    return updated;
  }

  if (homeWins) {
    // Home win
    updated[homeTeam] = {
      ...homeStanding,
      wins: homeStanding.wins + 1,
      [sport]: {
        wins: homeStanding[sport].wins + 1,
        losses: homeStanding[sport].losses,
      },
    };
    updated[awayTeam] = {
      ...awayStanding,
      losses: awayStanding.losses + 1,
      [sport]: {
        wins: awayStanding[sport].wins,
        losses: awayStanding[sport].losses + 1,
      },
    };
  } else {
    // Away win
    updated[awayTeam] = {
      ...awayStanding,
      wins: awayStanding.wins + 1,
      [sport]: {
        wins: awayStanding[sport].wins + 1,
        losses: awayStanding[sport].losses,
      },
    };
    updated[homeTeam] = {
      ...homeStanding,
      losses: homeStanding.losses + 1,
      [sport]: {
        wins: homeStanding[sport].wins,
        losses: homeStanding[sport].losses + 1,
      },
    };
  }

  return updated;
}

// =============================================================================
// WEEK PROCESSING (FULL CYCLE)
// =============================================================================

/**
 * Get current week's matches from season
 *
 * @param season - Current season
 * @returns Matches for current week
 */
export function getCurrentWeekMatches(season: Season): Match[] {
  return getWeekMatches(season, season.currentWeek);
}

/**
 * Check if all matches for current week are completed
 *
 * @param season - Current season
 * @returns True if all current week matches are completed
 */
export function isWeekComplete(season: Season): boolean {
  const weekMatches = getCurrentWeekMatches(season);
  return weekMatches.every((m) => m.status === 'completed');
}

/**
 * Get pending matches for current week
 *
 * @param season - Current season
 * @returns Matches that haven't been played yet
 */
export function getPendingMatches(season: Season): Match[] {
  const weekMatches = getCurrentWeekMatches(season);
  return weekMatches.filter((m) => m.status === 'scheduled');
}
