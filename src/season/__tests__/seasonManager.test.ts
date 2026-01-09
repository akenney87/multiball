/**
 * Season Manager Tests
 *
 * Tests for full season lifecycle:
 * - Creating new seasons
 * - Season phase transitions
 * - End-of-season processing (promotion/relegation)
 * - Transfer window management
 */

import type { Season, TeamStanding } from '../../data/types';
import {
  createNewSeason,
  getSeasonPhase,
  updateSeasonPhase,
  isTransferWindowOpen,
  openTransferWindow,
  closeTransferWindow,
  calculatePromotionRelegation,
  getTeamsByRank,
} from '../seasonManager';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTeamIds(count: number = 20): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

function createStandings(teamIds: string[]): Record<string, TeamStanding> {
  const standings: Record<string, TeamStanding> = {};
  teamIds.forEach((teamId, idx) => {
    standings[teamId] = {
      teamId,
      wins: 20 - idx,
      losses: idx,
      points: (20 - idx) * 3,
      rank: idx + 1,
    };
  });
  return standings;
}

// =============================================================================
// CREATE SEASON TESTS
// =============================================================================

describe('createNewSeason', () => {
  it('creates a season with correct structure', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1);

    expect(season.id).toBeDefined();
    expect(season.seasonNumber).toBe(1);
    expect(season.status).toBe('pre_season');
    expect(season.currentWeek).toBe(1);
  });

  it('generates schedule for all teams', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1);

    expect(season.matches.length).toBe(570);
  });

  it('initializes standings for all teams', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1);

    expect(Object.keys(season.standings)).toHaveLength(20);
    teamIds.forEach((teamId) => {
      expect(season.standings[teamId]).toBeDefined();
      expect(season.standings[teamId].wins).toBe(0);
    });
  });

  it('increments season number', () => {
    const teamIds = createTeamIds(20);

    const season1 = createNewSeason(teamIds, 1);
    const season2 = createNewSeason(teamIds, 2);

    expect(season1.seasonNumber).toBe(1);
    expect(season2.seasonNumber).toBe(2);
  });

  it('uses deterministic schedule with seed', () => {
    const teamIds = createTeamIds(20);

    const season1 = createNewSeason(teamIds, 1, { seed: 12345 });
    const season2 = createNewSeason(teamIds, 1, { seed: 12345 });

    expect(season1.matches[0].homeTeamId).toBe(season2.matches[0].homeTeamId);
    expect(season1.matches[0].awayTeamId).toBe(season2.matches[0].awayTeamId);
  });
});

// =============================================================================
// SEASON PHASE TESTS
// =============================================================================

describe('season phases', () => {
  describe('getSeasonPhase', () => {
    it('returns current season status', () => {
      const teamIds = createTeamIds(20);
      const season = createNewSeason(teamIds, 1);

      expect(getSeasonPhase(season)).toBe('pre_season');
    });
  });

  describe('updateSeasonPhase', () => {
    it('transitions from pre_season to regular_season', () => {
      const teamIds = createTeamIds(20);
      let season = createNewSeason(teamIds, 1);

      season = updateSeasonPhase(season, 'regular_season');

      expect(season.status).toBe('regular_season');
    });

    it('transitions through all phases', () => {
      const teamIds = createTeamIds(20);
      let season = createNewSeason(teamIds, 1);

      season = updateSeasonPhase(season, 'regular_season');
      expect(season.status).toBe('regular_season');

      season = updateSeasonPhase(season, 'post_season');
      expect(season.status).toBe('post_season');

      season = updateSeasonPhase(season, 'off_season');
      expect(season.status).toBe('off_season');
    });

    it('preserves other season data', () => {
      const teamIds = createTeamIds(20);
      let season = createNewSeason(teamIds, 1);

      season = updateSeasonPhase(season, 'regular_season');

      expect(season.matches.length).toBe(570);
      expect(Object.keys(season.standings)).toHaveLength(20);
    });
  });
});

// =============================================================================
// TRANSFER WINDOW TESTS
// =============================================================================

describe('transfer window', () => {
  it('is closed by default', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1);

    expect(isTransferWindowOpen(season)).toBe(false);
  });

  it('can be opened', () => {
    const teamIds = createTeamIds(20);
    let season = createNewSeason(teamIds, 1);

    season = openTransferWindow(season);

    expect(isTransferWindowOpen(season)).toBe(true);
  });

  it('can be closed', () => {
    const teamIds = createTeamIds(20);
    let season = createNewSeason(teamIds, 1);

    season = openTransferWindow(season);
    season = closeTransferWindow(season);

    expect(isTransferWindowOpen(season)).toBe(false);
  });
});

// =============================================================================
// PROMOTION/RELEGATION TESTS
// =============================================================================

describe('promotion and relegation', () => {
  describe('calculatePromotionRelegation', () => {
    it('returns top 3 teams for promotion', () => {
      const teamIds = createTeamIds(20);
      const standings = createStandings(teamIds);

      const result = calculatePromotionRelegation(standings);

      expect(result.promoted).toHaveLength(3);
      expect(result.promoted).toContain('team-1');
      expect(result.promoted).toContain('team-2');
      expect(result.promoted).toContain('team-3');
    });

    it('returns bottom 3 teams for relegation', () => {
      const teamIds = createTeamIds(20);
      const standings = createStandings(teamIds);

      const result = calculatePromotionRelegation(standings);

      expect(result.relegated).toHaveLength(3);
      expect(result.relegated).toContain('team-18');
      expect(result.relegated).toContain('team-19');
      expect(result.relegated).toContain('team-20');
    });

    it('identifies champion', () => {
      const teamIds = createTeamIds(20);
      const standings = createStandings(teamIds);

      const result = calculatePromotionRelegation(standings);

      expect(result.champion).toBe('team-1');
    });

    it('identifies wooden spoon (last place)', () => {
      const teamIds = createTeamIds(20);
      const standings = createStandings(teamIds);

      const result = calculatePromotionRelegation(standings);

      expect(result.woodenSpoon).toBe('team-20');
    });
  });

  describe('getTeamsByRank', () => {
    it('returns teams sorted by rank', () => {
      const teamIds = createTeamIds(5);
      const standings = createStandings(teamIds);

      const sorted = getTeamsByRank(standings);

      expect(sorted).toEqual(['team-1', 'team-2', 'team-3', 'team-4', 'team-5']);
    });

    it('handles empty standings', () => {
      const sorted = getTeamsByRank({});

      expect(sorted).toEqual([]);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('season manager integration', () => {
  it('simulates full season lifecycle', () => {
    const teamIds = createTeamIds(20);

    // Create season
    let season = createNewSeason(teamIds, 1);
    expect(season.status).toBe('pre_season');

    // Open transfer window in pre-season
    season = openTransferWindow(season);
    expect(isTransferWindowOpen(season)).toBe(true);

    // Start regular season
    season = updateSeasonPhase(season, 'regular_season');
    season = closeTransferWindow(season);

    expect(season.status).toBe('regular_season');
    expect(isTransferWindowOpen(season)).toBe(false);

    // End season
    season = updateSeasonPhase(season, 'post_season');
    season = updateSeasonPhase(season, 'off_season');

    // Calculate promotions
    const teamStandings = createStandings(teamIds);
    const promotionResult = calculatePromotionRelegation(teamStandings);

    expect(promotionResult.promoted).toHaveLength(3);
    expect(promotionResult.relegated).toHaveLength(3);
    expect(promotionResult.champion).toBeDefined();
  });
});
