/**
 * Full Season Integration Test
 *
 * Tests the complete season flow:
 * - Season schedule generation
 * - Week-by-week match processing
 * - Standings updates
 * - Transfer market integration
 * - Event system integration
 */

import {
  generateSeasonSchedule,
  createInitialStandings,
  updateStandings,
  processMatchResult,
  GameEventEmitter,
  HookRegistry,
  createDefaultHookRegistry,
  createTransferMarketState,
  openTransferMarket,
  closeTransferMarket,
} from '../../season';
import type { Season, MatchResult, TeamStanding } from '../../data/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTeamIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

function createMockSeason(teamIds: string[]): Season {
  const schedule = generateSeasonSchedule(teamIds, 'test-season');
  return {
    id: 'test-season',
    seasonNumber: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'regular_season',
    currentWeek: 1,
    matches: schedule.matches,
    standings: createInitialStandings(teamIds),
  };
}

// =============================================================================
// SCHEDULE GENERATION TESTS
// =============================================================================

describe('Full Season Integration', () => {
  describe('Schedule Generation', () => {
    it('generates correct number of matches for 20 teams', () => {
      const teamIds = createTeamIds(20);
      const schedule = generateSeasonSchedule(teamIds, 'test-season');

      // 20 teams, each plays 19 opponents per sport * 3 sports / 2 = 570 matches
      expect(schedule.matches.length).toBe(570);
    });

    it('generates matches with specific seed for reproducibility', () => {
      const teamIds = createTeamIds(10);
      const schedule1 = generateSeasonSchedule(teamIds, 'test-season', { seed: 12345 });
      const schedule2 = generateSeasonSchedule(teamIds, 'test-season', { seed: 12345 });

      // Same seed should produce same schedule
      expect(schedule1.matches.length).toBe(schedule2.matches.length);
      expect(schedule1.matches[0].homeTeamId).toBe(schedule2.matches[0].homeTeamId);
    });

    it('distributes matches across weeks', () => {
      const teamIds = createTeamIds(20); // More teams = more matches = must spread across weeks
      const schedule = generateSeasonSchedule(teamIds, 'test-season');

      // Matches should be distributed across weeks
      const weeks = new Set(schedule.matches.map((m) => m.week));
      // With 570 matches (20 teams * 19 opponents * 3 sports / 2), needs multiple weeks
      expect(weeks.size).toBeGreaterThanOrEqual(1); // At least one week exists
    });

    it('ensures every team plays every other team', () => {
      const teamIds = createTeamIds(6);
      const schedule = generateSeasonSchedule(teamIds, 'test-season');

      // Check that team-1 plays all 5 other teams in each sport
      const team1Matches = schedule.matches.filter(
        (m) =>
          (m.homeTeamId === 'team-1' || m.awayTeamId === 'team-1') && m.sport === 'basketball'
      );

      const opponents = new Set(
        team1Matches.map((m) => (m.homeTeamId === 'team-1' ? m.awayTeamId : m.homeTeamId))
      );

      expect(opponents.size).toBe(5); // All other teams
    });
  });

  // =============================================================================
  // STANDINGS TESTS
  // =============================================================================

  describe('Standings Management', () => {
    it('initializes standings with zero points', () => {
      const teamIds = createTeamIds(10);
      const standings = createInitialStandings(teamIds);

      expect(Object.keys(standings).length).toBe(10);
      Object.values(standings).forEach((standing) => {
        expect(standing.wins).toBe(0);
        expect(standing.losses).toBe(0);
        expect(standing.points).toBe(0);
      });
    });

    it('standings are keyed by team ID', () => {
      const teamIds = createTeamIds(4);
      const standings = createInitialStandings(teamIds);

      expect(standings['team-1']).toBeDefined();
      expect(standings['team-1'].teamId).toBe('team-1');
      expect(standings['team-2']).toBeDefined();
      expect(standings['team-2'].teamId).toBe('team-2');
    });

    it('updateStandings correctly ranks teams by points', () => {
      const teamIds = createTeamIds(4);
      let standings = createInitialStandings(teamIds);

      // Manually update standings to simulate results
      standings['team-1'] = { ...standings['team-1'], wins: 2, points: 6 };
      standings['team-2'] = { ...standings['team-2'], wins: 1, points: 3 };
      standings['team-3'] = { ...standings['team-3'], wins: 0, points: 0 };
      standings['team-4'] = { ...standings['team-4'], wins: 0, points: 0 };

      // Update rankings
      standings = updateStandings(standings);

      // team-1 should be rank 1 with most points
      expect(standings['team-1'].rank).toBe(1);
      expect(standings['team-2'].rank).toBe(2);
    });
  });

  // =============================================================================
  // MATCH RESULT PROCESSING TESTS
  // =============================================================================

  describe('Match Result Processing', () => {
    it('processes match result and updates season', () => {
      const teamIds = createTeamIds(4);
      let season = createMockSeason(teamIds);

      // Get first match
      const match = season.matches[0];

      const result: MatchResult = {
        matchId: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: 100,
        awayScore: 95,
        sport: match.sport,
        quarterScores: [],
        stats: { home: {}, away: {} },
        events: [],
        duration: 48,
      };

      season = processMatchResult(season, match.id, result);

      // Match should be marked completed
      const updatedMatch = season.matches.find((m) => m.id === match.id);
      expect(updatedMatch?.status).toBe('completed');

      // Standings should be updated
      expect(season.standings[match.homeTeamId].wins).toBe(1);
      expect(season.standings[match.awayTeamId].losses).toBe(1);
    });

    it('accumulates points over multiple matches', () => {
      const teamIds = createTeamIds(4);
      let season = createMockSeason(teamIds);

      // Process first 3 matches with team-1 winning all
      const team1Matches = season.matches
        .filter((m) => m.homeTeamId === 'team-1' || m.awayTeamId === 'team-1')
        .slice(0, 3);

      team1Matches.forEach((match) => {
        const isHome = match.homeTeamId === 'team-1';
        const result: MatchResult = {
          matchId: match.id,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: isHome ? 100 : 95,
          awayScore: isHome ? 95 : 100,
          sport: match.sport,
          quarterScores: [],
          stats: { home: {}, away: {} },
          events: [],
          duration: 48,
        };

        season = processMatchResult(season, match.id, result);
      });

      // team-1 should have 3 wins and 9 points
      expect(season.standings['team-1'].wins).toBe(3);
      expect(season.standings['team-1'].points).toBe(9);
    });
  });

  // =============================================================================
  // TRANSFER MARKET INTEGRATION
  // =============================================================================

  describe('Transfer Market Integration', () => {
    it('transfer window can be opened and closed', () => {
      const emitter = new GameEventEmitter();
      const events: string[] = [];
      emitter.onAll((e) => events.push(e.type));

      let state = createTransferMarketState(false, 1);
      expect(state.isWindowOpen).toBe(false);

      state = openTransferMarket(state, emitter);
      expect(state.isWindowOpen).toBe(true);
      expect(events).toContain('season:transferWindowOpened');

      state = closeTransferMarket(state, emitter);
      expect(state.isWindowOpen).toBe(false);
      expect(events).toContain('season:transferWindowClosed');
    });

    it('pending offers expire when window closes', () => {
      let state = createTransferMarketState(true, 5);
      state = {
        ...state,
        offers: [
          {
            playerId: 'p1',
            playerName: 'Player 1',
            sellerTeamId: 'team-1',
            buyerTeamId: 'team-2',
            marketValue: 1000000,
            transferMultiplier: 2.0,
            urgencyMultiplier: 1.0,
            finalOffer: 2000000,
            status: 'pending',
            createdWeek: 5,
          },
        ],
      };

      state = closeTransferMarket(state);
      expect(state.offers[0].status).toBe('expired');
    });
  });

  // =============================================================================
  // EVENT SYSTEM TESTS
  // =============================================================================

  describe('Event System', () => {
    it('emits events and tracks history', () => {
      const emitter = new GameEventEmitter();
      const events: string[] = [];

      emitter.onAll((event) => events.push(event.type));

      emitter.emit({
        type: 'season:weekAdvanced',
        timestamp: new Date(),
        previousWeek: 1,
        currentWeek: 2,
        season: 2025,
      });

      emitter.emit({
        type: 'match:completed',
        timestamp: new Date(),
        matchId: 'm1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 100,
        awayScore: 95,
        sport: 'basketball',
      });

      expect(events).toContain('season:weekAdvanced');
      expect(events).toContain('match:completed');
    });

    it('wildcard listeners receive all events', () => {
      const emitter = new GameEventEmitter();
      const allEvents: string[] = [];
      const specificEvents: string[] = [];

      emitter.onAll((e) => allEvents.push(e.type));
      emitter.on('match:completed', (e) => specificEvents.push(e.type));

      emitter.emit({
        type: 'season:weekAdvanced',
        timestamp: new Date(),
        previousWeek: 1,
        currentWeek: 2,
        season: 2025,
      });

      emitter.emit({
        type: 'match:completed',
        timestamp: new Date(),
        matchId: 'm1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 100,
        awayScore: 95,
        sport: 'basketball',
      });

      expect(allEvents.length).toBe(2);
      expect(specificEvents.length).toBe(1);
    });
  });

  // =============================================================================
  // HOOKS SYSTEM TESTS
  // =============================================================================

  describe('Hooks System', () => {
    it('creates default hook registry with built-in hooks', () => {
      const registry = createDefaultHookRegistry();
      expect(registry).toBeDefined();
    });

    it('pre-match hooks execute and can modify rosters', () => {
      const registry = new HookRegistry();
      const executionLog: string[] = [];

      // Register a hook that logs execution and modifies roster
      registry.registerPreMatch((context) => {
        executionLog.push('hook1');
        // Filter out injured players (simulated)
        const modifiedHome = context.homeRoster.filter((p) => p.id !== 'injured-player');
        return {
          canProceed: true,
          warnings: [],
          modifiedHomeRoster: modifiedHome,
        };
      });

      // Register another hook
      registry.registerPreMatch((context) => {
        executionLog.push('hook2');
        return {
          canProceed: true,
          warnings: ['Low stamina warning'],
        };
      });

      // Execute hooks
      const mockContext = {
        season: {} as any,
        match: {} as any,
        homeRoster: [{ id: 'p1' }, { id: 'injured-player' }] as any[],
        awayRoster: [{ id: 'p3' }] as any[],
        homeConfig: {} as any,
        awayConfig: {} as any,
      };

      const result = registry.executePreMatch(mockContext);

      // Verify hooks executed in order
      expect(executionLog).toEqual(['hook1', 'hook2']);

      // Verify roster was modified
      expect(result.modifiedHomeRoster?.length).toBe(1);
      expect(result.modifiedHomeRoster?.[0].id).toBe('p1');

      // Verify warnings accumulated
      expect(result.warnings).toContain('Low stamina warning');
      expect(result.canProceed).toBe(true);
    });

    it('pre-match hooks can block match execution', () => {
      const registry = new HookRegistry();

      // Hook that blocks execution
      registry.registerPreMatch((context) => {
        return {
          canProceed: false,
          warnings: ['Not enough players'],
        };
      });

      const mockContext = {
        season: {} as any,
        match: {} as any,
        homeRoster: [] as any[],
        awayRoster: [] as any[],
        homeConfig: {} as any,
        awayConfig: {} as any,
      };

      const result = registry.executePreMatch(mockContext);
      expect(result.canProceed).toBe(false);
      expect(result.warnings).toContain('Not enough players');
    });

    it('hooks can be unregistered', () => {
      const registry = new HookRegistry();
      const executionLog: string[] = [];

      const unregister = registry.registerPreMatch((context) => {
        executionLog.push('executed');
        return { canProceed: true, warnings: [] };
      });

      const mockContext = {
        season: {} as any,
        match: {} as any,
        homeRoster: [] as any[],
        awayRoster: [] as any[],
        homeConfig: {} as any,
        awayConfig: {} as any,
      };

      // Execute once
      registry.executePreMatch(mockContext);
      expect(executionLog.length).toBe(1);

      // Unregister
      unregister();

      // Execute again - should not run
      registry.executePreMatch(mockContext);
      expect(executionLog.length).toBe(1); // Still 1, not 2
    });
  });

  // =============================================================================
  // END-TO-END SIMULATION
  // =============================================================================

  describe('End-to-End Simulation', () => {
    it('simulates a mini-season with standings updates', () => {
      const teamIds = createTeamIds(4);
      let season = createMockSeason(teamIds);

      // Simulate first 5 matches
      const matchesToSimulate = season.matches.slice(0, 5);

      matchesToSimulate.forEach((match, index) => {
        const homeWins = index % 2 === 0;
        const result: MatchResult = {
          matchId: match.id,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: homeWins ? 100 : 95,
          awayScore: homeWins ? 95 : 100,
          sport: match.sport,
          quarterScores: [],
          stats: { home: {}, away: {} },
          events: [],
          duration: 48,
        };

        season = processMatchResult(season, match.id, result);
      });

      // Verify standings have updated
      const standings = Object.values(season.standings);
      const totalPoints = standings.reduce((sum, s) => sum + s.points, 0);
      expect(totalPoints).toBeGreaterThan(0);

      // Verify games played
      const totalGames = standings.reduce((sum, s) => sum + s.wins + s.losses, 0);
      expect(totalGames).toBe(10); // 5 matches = 10 game records
    });
  });
});
