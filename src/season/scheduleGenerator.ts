/**
 * Season Schedule Generator
 *
 * Generates a complete season schedule for a division:
 * - 20 teams per division
 * - Each team plays each opponent once per sport (3 sports)
 * - 57 matches per team (19 opponents × 3 sports)
 * - 570 total matches per season
 *
 * Schedule is distributed across ~40 weeks with:
 * - Max 3 matches per team per week
 * - Mix of all three sports each week
 * - Balanced home/away distribution
 */

import type { Match } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ScheduleOptions {
  /** Random seed for deterministic generation */
  seed?: number;
  /** Season start date (defaults to Jan 1 of current year) */
  startDate?: Date;
  /** Number of weeks to spread matches across */
  totalWeeks?: number;
}

export interface GeneratedSchedule {
  /** All matches for the season */
  matches: Match[];
  /** Matches grouped by week number */
  matchesByWeek: Map<number, Match[]>;
  /** Season start date */
  startDate: Date;
  /** Season end date */
  endDate: Date;
}

type Sport = 'basketball' | 'baseball' | 'soccer';

// =============================================================================
// SEEDED RANDOM
// =============================================================================

/**
 * Simple seeded random number generator (mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle array using Fisher-Yates with seeded random
 */
function shuffleArray<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// =============================================================================
// SCHEDULE GENERATION
// =============================================================================

/**
 * Generate a complete season schedule
 *
 * @param teamIds - Array of team IDs in the division
 * @param seasonId - Season identifier
 * @param options - Schedule generation options
 * @returns Generated schedule with all matches
 */
export function generateSeasonSchedule(
  teamIds: string[],
  seasonId: string,
  options: ScheduleOptions = {}
): GeneratedSchedule {
  const seed = options.seed ?? Date.now();
  const random = createSeededRandom(seed);
  const startDate = options.startDate ?? new Date(new Date().getFullYear(), 0, 1);
  const totalWeeks = options.totalWeeks ?? 40;

  const sports: Sport[] = ['basketball', 'baseball', 'soccer'];
  const matches: Match[] = [];

  // Generate all matchups (each pair plays once per sport)
  // First pass: create matchups without home/away assignment
  const rawMatchups: Array<{ team1: string; team2: string; sport: Sport }> = [];

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const team1 = teamIds[i];
      const team2 = teamIds[j];
      sports.forEach((sport) => {
        rawMatchups.push({ team1, team2, sport });
      });
    }
  }

  // Shuffle raw matchups to randomize assignment order
  const shuffledRaw = shuffleArray(rawMatchups, random);

  // Second pass: assign home/away while balancing
  const homeGameCounts = new Map<string, number>();
  teamIds.forEach((id) => homeGameCounts.set(id, 0));

  const matchups: Array<{ home: string; away: string; sport: Sport }> = [];

  shuffledRaw.forEach(({ team1, team2, sport }) => {
    const team1HomeCount = homeGameCounts.get(team1) ?? 0;
    const team2HomeCount = homeGameCounts.get(team2) ?? 0;

    let home: string;
    let away: string;

    if (team1HomeCount < team2HomeCount) {
      home = team1;
      away = team2;
    } else if (team2HomeCount < team1HomeCount) {
      home = team2;
      away = team1;
    } else {
      // Tie: use random
      if (random() > 0.5) {
        home = team1;
        away = team2;
      } else {
        home = team2;
        away = team1;
      }
    }

    matchups.push({ home, away, sport });
    homeGameCounts.set(home, (homeGameCounts.get(home) ?? 0) + 1);
  });

  // Shuffle matchups for variety
  const shuffledMatchups = shuffleArray(matchups, random);

  // Distribute matches across weeks
  const matchesByWeek = distributeMatchups(shuffledMatchups, teamIds, totalWeeks, random);

  // Convert to Match objects with dates, preserving week assignments
  let matchId = 1;
  const matchesByWeekResult = new Map<number, Match[]>();

  matchesByWeek.forEach((weekMatchups, weekNum) => {
    // Calculate week start date
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);

    const weekMatches: Match[] = [];
    weekMatchups.forEach((matchup, idx) => {
      // Spread matches across the week (Mon, Wed, Fri pattern)
      const dayOffset = idx % 3 === 0 ? 0 : idx % 3 === 1 ? 2 : 4;
      const matchDate = new Date(weekStart);
      matchDate.setDate(matchDate.getDate() + dayOffset);

      const match: Match = {
        id: `match-${seasonId}-${matchId++}`,
        seasonId,
        week: weekNum,
        homeTeamId: matchup.home,
        awayTeamId: matchup.away,
        sport: matchup.sport,
        scheduledDate: matchDate,
        status: 'scheduled',
        result: null,
      };

      matches.push(match);
      weekMatches.push(match);
    });

    matchesByWeekResult.set(weekNum, weekMatches);
  });

  // Calculate end date based on actual last week used
  const lastWeek = Math.max(...matchesByWeekResult.keys());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + lastWeek * 7);

  // Sort matches by date for the flat list
  const sortedMatches = [...matches].sort(
    (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()
  );

  return {
    matches: sortedMatches,
    matchesByWeek: matchesByWeekResult,
    startDate,
    endDate,
  };
}

/**
 * Distribute matchups across weeks ensuring constraints:
 * - Max 3 matches per team per week (STRICT)
 * - Mix of sports each week
 */
function distributeMatchups(
  matchups: Array<{ home: string; away: string; sport: Sport }>,
  teamIds: string[],
  totalWeeks: number,
  random: () => number
): Map<number, Array<{ home: string; away: string; sport: Sport }>> {
  const result = new Map<number, Array<{ home: string; away: string; sport: Sport }>>();
  const teamWeekCounts = new Map<string, Map<number, number>>();

  // Initialize weeks and team week counts
  for (let week = 1; week <= totalWeeks; week++) {
    result.set(week, []);
  }
  teamIds.forEach((teamId) => {
    teamWeekCounts.set(teamId, new Map());
  });

  // Helper to check if matchup can be assigned to week
  const canAssign = (
    matchup: { home: string; away: string },
    week: number
  ): boolean => {
    const homeCount = teamWeekCounts.get(matchup.home)?.get(week) ?? 0;
    const awayCount = teamWeekCounts.get(matchup.away)?.get(week) ?? 0;
    return homeCount < 3 && awayCount < 3;
  };

  // Helper to assign matchup to week
  const assign = (
    matchup: { home: string; away: string; sport: Sport },
    week: number
  ): void => {
    result.get(week)!.push(matchup);
    const homeCount = teamWeekCounts.get(matchup.home)?.get(week) ?? 0;
    const awayCount = teamWeekCounts.get(matchup.away)?.get(week) ?? 0;
    teamWeekCounts.get(matchup.home)!.set(week, homeCount + 1);
    teamWeekCounts.get(matchup.away)!.set(week, awayCount + 1);
  };

  // Assign each matchup to the earliest available week
  const shuffled = shuffleArray(matchups, random);

  shuffled.forEach((matchup) => {
    // Find first week where both teams have room
    for (let week = 1; week <= totalWeeks; week++) {
      if (canAssign(matchup, week)) {
        assign(matchup, week);
        return;
      }
    }

    // If no week found within limit, extend to additional weeks
    let extraWeek = totalWeeks + 1;
    while (!canAssign(matchup, extraWeek)) {
      extraWeek++;
      if (extraWeek > totalWeeks + 20) {
        // Safety limit - should never hit this
        break;
      }
    }
    if (!result.has(extraWeek)) {
      result.set(extraWeek, []);
    }
    assign(matchup, extraWeek);
  });

  return result;
}

// =============================================================================
// TEAM SCHEDULE
// =============================================================================

/**
 * Get schedule for a specific team, sorted by date
 *
 * @param matches - All season matches
 * @param teamId - Team to get schedule for
 * @returns Team's matches sorted by date
 */
export function generateTeamSchedule(matches: Match[], teamId: string): Match[] {
  return matches
    .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
}

// =============================================================================
// WEEK DISTRIBUTION
// =============================================================================

/**
 * Distribute matches to specific weeks (used for schedule adjustment)
 *
 * @param matches - Matches to distribute
 * @param totalWeeks - Number of weeks to distribute across
 * @returns Matches with updated scheduled dates
 */
export function distributeMatchesToWeeks(
  matches: Match[],
  totalWeeks: number,
  startDate: Date = new Date()
): Match[] {
  const matchesPerWeek = Math.ceil(matches.length / totalWeeks);
  const result: Match[] = [];

  let weekNum = 1;
  let weekMatchCount = 0;

  matches.forEach((match, idx) => {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);

    // Spread within week
    const dayOffset = weekMatchCount % 3 === 0 ? 0 : weekMatchCount % 3 === 1 ? 2 : 4;
    const matchDate = new Date(weekStart);
    matchDate.setDate(matchDate.getDate() + dayOffset);

    result.push({
      ...match,
      week: weekNum,
      scheduledDate: matchDate,
    });

    weekMatchCount++;
    if (weekMatchCount >= matchesPerWeek) {
      weekNum++;
      weekMatchCount = 0;
    }
  });

  return result;
}
