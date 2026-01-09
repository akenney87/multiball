/**
 * Week Processor Tests
 *
 * Tests for week-by-week season processing:
 * - Advancing to next week
 * - Getting matches for current week
 * - Processing match results
 * - Updating standings
 */

import type { Match, Season, TeamStanding } from '../../data/types';
import {
  advanceWeek,
  getWeekMatches,
  processMatchResult,
  updateStandings,
  createInitialStandings,
} from '../weekProcessor';
import { generateSeasonSchedule } from '../scheduleGenerator';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTeamIds(count: number = 20): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

function createMockSeason(teamIds: string[]): Season {
  const schedule = generateSeasonSchedule(teamIds, 'season-1', { seed: 12345 });

  return {
    id: 'season-1',
    seasonNumber: 1,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    status: 'regular_season',
    matches: schedule.matches,
    standings: createInitialStandings(teamIds),
    transferWindowOpen: false,
    currentWeek: 1,
  };
}

function createMockMatchResult(match: Match, homeScore: number, awayScore: number) {
  return {
    matchId: match.id,
    homeScore,
    awayScore,
    winner: homeScore > awayScore ? match.homeTeamId : match.awayTeamId,
    boxScore: {},
    playByPlay: [],
  };
}

// =============================================================================
// INITIAL STANDINGS TESTS
// =============================================================================

describe('createInitialStandings', () => {
  it('creates standings for all teams', () => {
    const teamIds = createTeamIds(20);
    const standings = createInitialStandings(teamIds);

    expect(Object.keys(standings)).toHaveLength(20);
    teamIds.forEach((teamId) => {
      expect(standings[teamId]).toBeDefined();
    });
  });

  it('initializes all stats to zero', () => {
    const teamIds = createTeamIds(5);
    const standings = createInitialStandings(teamIds);

    Object.values(standings).forEach((standing) => {
      expect(standing.wins).toBe(0);
      expect(standing.losses).toBe(0);
      expect(standing.points).toBe(0);
    });
  });

  it('assigns initial rank based on array order', () => {
    const teamIds = createTeamIds(5);
    const standings = createInitialStandings(teamIds);

    teamIds.forEach((teamId, idx) => {
      expect(standings[teamId].rank).toBe(idx + 1);
    });
  });
});

// =============================================================================
// ADVANCE WEEK TESTS
// =============================================================================

describe('advanceWeek', () => {
  it('increments current week by 1', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);

    expect(season.currentWeek).toBe(1);
    const updated = advanceWeek(season);
    expect(updated.currentWeek).toBe(2);
  });

  it('preserves other season data', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);

    const updated = advanceWeek(season);

    expect(updated.id).toBe(season.id);
    expect(updated.matches).toBe(season.matches);
    expect(updated.standings).toBe(season.standings);
  });

  it('can advance multiple times', () => {
    const teamIds = createTeamIds(20);
    let season = createMockSeason(teamIds);

    for (let i = 0; i < 10; i++) {
      season = advanceWeek(season);
    }

    expect(season.currentWeek).toBe(11);
  });
});

// =============================================================================
// GET WEEK MATCHES TESTS
// =============================================================================

describe('getWeekMatches', () => {
  it('returns matches scheduled for specific week', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);

    const week1Matches = getWeekMatches(season, 1);
    const week2Matches = getWeekMatches(season, 2);

    expect(week1Matches.length).toBeGreaterThan(0);
    expect(week2Matches.length).toBeGreaterThan(0);

    // Should be different matches
    const week1Ids = new Set(week1Matches.map((m) => m.id));
    week2Matches.forEach((m) => {
      expect(week1Ids.has(m.id)).toBe(false);
    });
  });

  it('returns empty array for week with no matches', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);

    // Week 100 should have no matches in a ~20-week season
    const matches = getWeekMatches(season, 100);
    expect(matches).toHaveLength(0);
  });

  it('returns reasonable number of matches per week', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);

    // Check that matches are distributed across weeks
    let totalMatchesFound = 0;
    for (let week = 1; week <= 25; week++) {
      const weekMatches = getWeekMatches(season, week);
      totalMatchesFound += weekMatches.length;
    }

    // Should find a significant portion of matches
    expect(totalMatchesFound).toBeGreaterThan(season.matches.length * 0.8);
  });
});

// =============================================================================
// PROCESS MATCH RESULT TESTS
// =============================================================================

describe('processMatchResult', () => {
  it('updates match status to completed', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);
    const match = season.matches[0];

    const result = createMockMatchResult(match, 100, 90);
    const updated = processMatchResult(season, match.id, result);

    const updatedMatch = updated.matches.find((m) => m.id === match.id);
    expect(updatedMatch?.status).toBe('completed');
  });

  it('stores match result', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);
    const match = season.matches[0];

    const result = createMockMatchResult(match, 100, 90);
    const updated = processMatchResult(season, match.id, result);

    const updatedMatch = updated.matches.find((m) => m.id === match.id);
    expect(updatedMatch?.result).toEqual(result);
  });

  it('updates standings for winner and loser', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);
    const match = season.matches[0];

    const result = createMockMatchResult(match, 100, 90);
    const updated = processMatchResult(season, match.id, result);

    // Winner gets a win
    expect(updated.standings[match.homeTeamId].wins).toBe(1);
    expect(updated.standings[match.homeTeamId].losses).toBe(0);

    // Loser gets a loss
    expect(updated.standings[match.awayTeamId].wins).toBe(0);
    expect(updated.standings[match.awayTeamId].losses).toBe(1);
  });

  it('awards 3 points for a win', () => {
    const teamIds = createTeamIds(20);
    const season = createMockSeason(teamIds);
    const match = season.matches[0];

    const result = createMockMatchResult(match, 100, 90);
    const updated = processMatchResult(season, match.id, result);

    // Winner gets 3 points
    expect(updated.standings[match.homeTeamId].points).toBe(3);
    // Loser gets 0 points
    expect(updated.standings[match.awayTeamId].points).toBe(0);
  });
});

// =============================================================================
// UPDATE STANDINGS TESTS
// =============================================================================

describe('updateStandings', () => {
  it('sorts teams by points descending', () => {
    const standings: Record<string, TeamStanding> = {
      'team-1': { teamId: 'team-1', wins: 2, losses: 0, points: 6, rank: 3 },
      'team-2': { teamId: 'team-2', wins: 1, losses: 1, points: 3, rank: 1 },
      'team-3': { teamId: 'team-3', wins: 0, losses: 2, points: 0, rank: 2 },
    };

    const updated = updateStandings(standings);

    expect(updated['team-1'].rank).toBe(1);
    expect(updated['team-2'].rank).toBe(2);
    expect(updated['team-3'].rank).toBe(3);
  });

  it('uses wins as tiebreaker', () => {
    const standings: Record<string, TeamStanding> = {
      'team-1': { teamId: 'team-1', wins: 3, losses: 0, points: 9, rank: 2 },
      'team-2': { teamId: 'team-2', wins: 3, losses: 0, points: 9, rank: 1 },
    };

    // Both have 9 points and 3 wins - should maintain stable sort or use teamId
    const updated = updateStandings(standings);

    // Both should be ranked 1 and 2 (order may vary with ties)
    expect([1, 2]).toContain(updated['team-1'].rank);
    expect([1, 2]).toContain(updated['team-2'].rank);
  });

  it('handles all teams with zero points', () => {
    const teamIds = createTeamIds(5);
    const standings = createInitialStandings(teamIds);

    const updated = updateStandings(standings);

    // All should have sequential ranks
    const ranks = Object.values(updated).map((s) => s.rank);
    expect(ranks.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('week processor integration', () => {
  it('processes a full week of matches', () => {
    const teamIds = createTeamIds(20);
    let season = createMockSeason(teamIds);

    // Get week 1 matches
    const week1Matches = getWeekMatches(season, 1);
    expect(week1Matches.length).toBeGreaterThan(0);

    // Process all matches with mock results
    week1Matches.forEach((match) => {
      const homeWins = Math.random() > 0.5;
      const result = createMockMatchResult(
        match,
        homeWins ? 100 : 90,
        homeWins ? 90 : 100
      );
      season = processMatchResult(season, match.id, result);
    });

    // Verify all week 1 matches are completed
    week1Matches.forEach((match) => {
      const updated = season.matches.find((m) => m.id === match.id);
      expect(updated?.status).toBe('completed');
    });

    // Advance to week 2
    season = advanceWeek(season);
    expect(season.currentWeek).toBe(2);
  });

  it('standings accumulate correctly over multiple weeks', () => {
    const teamIds = createTeamIds(4); // Small for simplicity
    let season = createMockSeason(teamIds);

    // Process first 3 weeks
    for (let week = 1; week <= 3; week++) {
      const matches = getWeekMatches(season, week);

      matches.forEach((match) => {
        // Home team always wins for predictable results
        const result = createMockMatchResult(match, 100, 90);
        season = processMatchResult(season, match.id, result);
      });

      season = advanceWeek(season);
    }

    // Verify standings accumulated
    const totalWins = Object.values(season.standings).reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = Object.values(season.standings).reduce((sum, s) => sum + s.losses, 0);

    // Wins should equal losses (each match has one of each)
    expect(totalWins).toBe(totalLosses);
  });
});
