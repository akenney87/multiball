/**
 * Schedule Generator Tests
 *
 * Tests for season schedule generation:
 * - 57 matches per team (19 opponents × 3 sports)
 * - 20 teams per division
 * - Fair home/away distribution
 * - Matches spread across weeks
 */

import {
  generateSeasonSchedule,
  generateTeamSchedule,
  distributeMatchesToWeeks,
} from '../scheduleGenerator';
import type { Match } from '../../data/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create array of team IDs for a division
 */
function createTeamIds(count: number = 20): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

// =============================================================================
// SCHEDULE GENERATION TESTS
// =============================================================================

describe('generateSeasonSchedule', () => {
  const teamIds = createTeamIds(20);
  const seasonId = 'season-1';

  describe('match count validation', () => {
    it('generates correct total matches for 20-team division', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      // Each team plays 19 opponents × 3 sports = 57 matches per team
      // Total matches = (20 × 57) / 2 = 570 (each match counted once)
      expect(schedule.matches.length).toBe(570);
    });

    it('each team plays exactly 57 matches', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      teamIds.forEach((teamId) => {
        const teamMatches = schedule.matches.filter(
          (m) => m.homeTeamId === teamId || m.awayTeamId === teamId
        );
        expect(teamMatches.length).toBe(57);
      });
    });

    it('each team plays each opponent exactly 3 times (once per sport)', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      teamIds.forEach((teamId) => {
        const opponents = teamIds.filter((id) => id !== teamId);

        opponents.forEach((opponentId) => {
          const matchups = schedule.matches.filter(
            (m) =>
              (m.homeTeamId === teamId && m.awayTeamId === opponentId) ||
              (m.homeTeamId === opponentId && m.awayTeamId === teamId)
          );
          expect(matchups.length).toBe(3); // One per sport
        });
      });
    });
  });

  describe('sport distribution', () => {
    it('generates equal matches for each sport', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      const basketballMatches = schedule.matches.filter((m) => m.sport === 'basketball');
      const baseballMatches = schedule.matches.filter((m) => m.sport === 'baseball');
      const soccerMatches = schedule.matches.filter((m) => m.sport === 'soccer');

      // 20 teams, each plays 19 opponents = 190 matchups per sport
      expect(basketballMatches.length).toBe(190);
      expect(baseballMatches.length).toBe(190);
      expect(soccerMatches.length).toBe(190);
    });

    it('each team plays each opponent once in each sport', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);
      const teamId = 'team-1';
      const opponentId = 'team-2';

      const matchups = schedule.matches.filter(
        (m) =>
          (m.homeTeamId === teamId && m.awayTeamId === opponentId) ||
          (m.homeTeamId === opponentId && m.awayTeamId === teamId)
      );

      const sports = matchups.map((m) => m.sport);
      expect(sports).toContain('basketball');
      expect(sports).toContain('baseball');
      expect(sports).toContain('soccer');
    });
  });

  describe('home/away balance', () => {
    it('each team has roughly equal home and away games', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      teamIds.forEach((teamId) => {
        const homeGames = schedule.matches.filter((m) => m.homeTeamId === teamId);
        const awayGames = schedule.matches.filter((m) => m.awayTeamId === teamId);

        // With 57 total games, should be close to 28-29 split
        // Allow for some variance due to odd number
        expect(homeGames.length).toBeGreaterThanOrEqual(26);
        expect(homeGames.length).toBeLessThanOrEqual(31);
        expect(awayGames.length).toBeGreaterThanOrEqual(26);
        expect(awayGames.length).toBeLessThanOrEqual(31);
      });
    });
  });

  describe('match metadata', () => {
    it('all matches have correct seasonId', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      schedule.matches.forEach((match) => {
        expect(match.seasonId).toBe(seasonId);
      });
    });

    it('all matches start with scheduled status', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      schedule.matches.forEach((match) => {
        expect(match.status).toBe('scheduled');
      });
    });

    it('all matches have null result initially', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      schedule.matches.forEach((match) => {
        expect(match.result).toBeNull();
      });
    });

    it('all matches have unique IDs', () => {
      const schedule = generateSeasonSchedule(teamIds, seasonId);

      const ids = schedule.matches.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

// =============================================================================
// TEAM SCHEDULE TESTS
// =============================================================================

describe('generateTeamSchedule', () => {
  const teamIds = createTeamIds(20);
  const seasonId = 'season-1';

  it('returns only matches for specified team', () => {
    const fullSchedule = generateSeasonSchedule(teamIds, seasonId);
    const teamSchedule = generateTeamSchedule(fullSchedule.matches, 'team-1');

    expect(teamSchedule.length).toBe(57);
    teamSchedule.forEach((match) => {
      expect(match.homeTeamId === 'team-1' || match.awayTeamId === 'team-1').toBe(true);
    });
  });

  it('sorts matches by scheduled date', () => {
    const fullSchedule = generateSeasonSchedule(teamIds, seasonId);
    const teamSchedule = generateTeamSchedule(fullSchedule.matches, 'team-1');

    for (let i = 1; i < teamSchedule.length; i++) {
      expect(teamSchedule[i].scheduledDate.getTime()).toBeGreaterThanOrEqual(
        teamSchedule[i - 1].scheduledDate.getTime()
      );
    }
  });
});

// =============================================================================
// WEEK DISTRIBUTION TESTS
// =============================================================================

describe('distributeMatchesToWeeks', () => {
  const teamIds = createTeamIds(20);
  const seasonId = 'season-1';

  it('distributes matches across season weeks', () => {
    const schedule = generateSeasonSchedule(teamIds, seasonId);

    // With 570 matches and max ~30 per week (due to constraints), need at least 19 weeks
    // Typically uses 19-25 weeks depending on distribution
    expect(schedule.matchesByWeek.size).toBeGreaterThanOrEqual(19);
  });

  it('no team plays more than 3 matches per week', () => {
    const schedule = generateSeasonSchedule(teamIds, seasonId);

    // Use the matchesByWeek from the schedule (which tracks logical weeks)
    schedule.matchesByWeek.forEach((weekMatches, weekNum) => {
      teamIds.forEach((teamId) => {
        const teamWeekMatches = weekMatches.filter(
          (m) => m.homeTeamId === teamId || m.awayTeamId === teamId
        );
        expect(teamWeekMatches.length).toBeLessThanOrEqual(3);
      });
    });
  });

  it('matches are spread across all three sports each week', () => {
    const schedule = generateSeasonSchedule(teamIds, seasonId);

    let weeksWithAllSports = 0;
    let weeksWithMultipleSports = 0;
    schedule.matchesByWeek.forEach((weekMatches) => {
      const sports = new Set(weekMatches.map((m) => m.sport));
      if (sports.size === 3) {
        weeksWithAllSports++;
      }
      if (sports.size >= 2) {
        weeksWithMultipleSports++;
      }
    });

    // At least 40% of weeks should have all three sports
    expect(weeksWithAllSports / schedule.matchesByWeek.size).toBeGreaterThanOrEqual(0.4);
    // At least half of weeks should have 2+ sports (schedule is tightly packed)
    expect(weeksWithMultipleSports / schedule.matchesByWeek.size).toBeGreaterThanOrEqual(0.5);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('edge cases', () => {
  it('handles minimum team count (2 teams)', () => {
    const teamIds = createTeamIds(2);
    const schedule = generateSeasonSchedule(teamIds, 'season-1');

    // 2 teams play each other 3 times (once per sport)
    expect(schedule.matches.length).toBe(3);
  });

  it('handles odd team count', () => {
    const teamIds = createTeamIds(5);
    const schedule = generateSeasonSchedule(teamIds, 'season-1');

    // 5 teams: each plays 4 opponents × 3 sports = 12 matches per team
    // Total: (5 × 12) / 2 = 30 matches
    expect(schedule.matches.length).toBe(30);

    // Each team plays 12 matches
    teamIds.forEach((teamId) => {
      const teamMatches = schedule.matches.filter(
        (m) => m.homeTeamId === teamId || m.awayTeamId === teamId
      );
      expect(teamMatches.length).toBe(12);
    });
  });

  it('generates deterministic schedule with same seed', () => {
    const teamIds = createTeamIds(20);

    const schedule1 = generateSeasonSchedule(teamIds, 'season-1', { seed: 12345 });
    const schedule2 = generateSeasonSchedule(teamIds, 'season-1', { seed: 12345 });

    // Same seed should produce identical schedules
    expect(schedule1.matches.length).toBe(schedule2.matches.length);

    for (let i = 0; i < schedule1.matches.length; i++) {
      expect(schedule1.matches[i].homeTeamId).toBe(schedule2.matches[i].homeTeamId);
      expect(schedule1.matches[i].awayTeamId).toBe(schedule2.matches[i].awayTeamId);
      expect(schedule1.matches[i].sport).toBe(schedule2.matches[i].sport);
    }
  });
});
