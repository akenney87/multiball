/**
 * UI Integration Test
 *
 * Verifies that all Phase 1-3 APIs can be imported and used together
 * in a way that simulates React Native UI usage.
 */

// Import everything the UI will need
import {
  // AI
  createAIConfig,
  evaluatePlayer,
  selectStartingLineup,
  choosePaceStrategy,
  setDefenseStrategy,
  allocateMinutes,
  shouldReleasePlayer,
} from '../../ai';

import {
  // Season
  generateSeasonSchedule,
  createInitialStandings,
  processMatchResult,
  createNewSeason,
  advanceWeek,
  GameEventEmitter,
  HookRegistry,
  createDefaultHookRegistry,
  createTransferMarketState,
  openTransferMarket,
  closeTransferMarket,
  createFreeAgentMarketState,
} from '../../season';

import {
  // Simulation
  GameSimulator,
} from '../../simulation';

import type { Player, TacticalSettings } from '../../data/types';
import type { DecisionContext } from '../../ai/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockPlayer(id: string, position: string, rating: number, age: number): Player {
  const attrs = {
    grip_strength: rating,
    arm_strength: rating,
    core_strength: rating,
    agility: rating,
    acceleration: rating,
    top_speed: rating,
    jumping: rating,
    reactions: rating,
    stamina: rating,
    balance: rating,
    height: rating,
    durability: rating,
    awareness: rating,
    creativity: rating,
    determination: rating,
    bravery: rating,
    consistency: rating,
    composure: rating,
    patience: rating,
    hand_eye_coordination: rating,
    throw_accuracy: rating,
    form_technique: rating,
    finesse: rating,
    deception: rating,
    teamwork: rating,
  };

  return {
    id,
    name: `Player ${id}`,
    age,
    dateOfBirth: new Date(2000 - age, 0, 1),
    position: position as any,
    attributes: attrs,
    potentials: { physical: 80, mental: 80, technical: 80 },
    peakAges: { physical: 27, technical: 29, mental: 31 },
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    careerStats: {
      gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    },
    currentSeasonStats: {
      gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    },
    teamId: 'team-1',
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
  } as Player;
}

function createTestRoster(): Player[] {
  return [
    createMockPlayer('pg1', 'PG', 75, 25),
    createMockPlayer('sg1', 'SG', 72, 26),
    createMockPlayer('sf1', 'SF', 78, 24),
    createMockPlayer('pf1', 'PF', 70, 27),
    createMockPlayer('c1', 'C', 68, 26),
    createMockPlayer('pg2', 'PG', 65, 23),
    createMockPlayer('sg2', 'SG', 63, 24),
    createMockPlayer('sf2', 'SF', 60, 22),
  ];
}

function createDecisionContext(): DecisionContext {
  return {
    week: 10,
    transferWindowOpen: true,
    finance: { available: 5000000, total: 20000000 },
    standings: { position: 10, gamesPlayed: 20, wins: 10, losses: 10 },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('UI Integration - API Verification', () => {
  describe('Module Imports', () => {
    it('can import all AI module exports', () => {
      expect(createAIConfig).toBeDefined();
      expect(evaluatePlayer).toBeDefined();
      expect(selectStartingLineup).toBeDefined();
      expect(choosePaceStrategy).toBeDefined();
      expect(setDefenseStrategy).toBeDefined();
      expect(allocateMinutes).toBeDefined();
      expect(shouldReleasePlayer).toBeDefined();
    });

    it('can import all Season module exports', () => {
      expect(generateSeasonSchedule).toBeDefined();
      expect(createInitialStandings).toBeDefined();
      expect(processMatchResult).toBeDefined();
      expect(createNewSeason).toBeDefined();
      expect(advanceWeek).toBeDefined();
      expect(GameEventEmitter).toBeDefined();
      expect(HookRegistry).toBeDefined();
      expect(createDefaultHookRegistry).toBeDefined();
      expect(createTransferMarketState).toBeDefined();
      expect(openTransferMarket).toBeDefined();
      expect(closeTransferMarket).toBeDefined();
      expect(createFreeAgentMarketState).toBeDefined();
    });

    it('can import Simulation module exports', () => {
      expect(GameSimulator).toBeDefined();
    });
  });

  describe('Typical UI Flow', () => {
    it('can create a new game state', () => {
      // 1. Create team IDs
      const teamIds = Array.from({ length: 6 }, (_, i) => `team-${i + 1}`);

      // 2. Generate season schedule
      const schedule = generateSeasonSchedule(teamIds, 'season-1', { seed: 12345 });
      expect(schedule.matches.length).toBeGreaterThan(0);

      // 3. Create initial standings
      const standings = createInitialStandings(teamIds);
      expect(Object.keys(standings).length).toBe(6);

      // 4. Create event emitter
      const emitter = new GameEventEmitter();
      expect(emitter).toBeDefined();

      // 5. Create hooks registry
      const hooks = createDefaultHookRegistry();
      expect(hooks).toBeDefined();

      // 6. Create transfer market state
      const transferState = createTransferMarketState(false, 1);
      expect(transferState.isWindowOpen).toBe(false);

      // 7. Create free agent market state
      const faState = createFreeAgentMarketState(1, 10);
      expect(faState).toBeDefined();
    });

    it('can make AI decisions for a team', () => {
      const roster = createTestRoster();
      const context = createDecisionContext();
      const config = createAIConfig('balanced');

      // 1. Select lineup
      const lineup = selectStartingLineup(roster, context, config);
      expect(lineup.starters.length).toBe(5);
      expect(lineup.bench.length).toBe(3);

      // 2. Choose pace
      const pace = choosePaceStrategy(roster, context, config);
      expect(['slow', 'normal', 'fast']).toContain(pace.pace);

      // 3. Set defense
      const defense = setDefenseStrategy(roster, context, config);
      expect(['man', 'zone', 'press']).toContain(defense.defense);

      // 4. Allocate minutes
      const minutes = allocateMinutes(roster, context, config);
      expect(minutes.totalMinutes).toBe(240);
    });

    it('can evaluate players', () => {
      const player = createMockPlayer('test', 'PG', 75, 25);
      const context = createDecisionContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(player, context, config);
      expect(evaluation.playerId).toBe('test');
      expect(evaluation.overall).toBeGreaterThan(0);
      expect(evaluation.overall).toBeLessThanOrEqual(100);
    });

    it('can track events', () => {
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

      expect(events).toContain('season:weekAdvanced');
    });

    it('can process match results and update standings', () => {
      const teamIds = ['team-1', 'team-2', 'team-3', 'team-4'];
      const schedule = generateSeasonSchedule(teamIds, 'test-season', { seed: 42 });

      const season = {
        id: 'test-season',
        seasonNumber: 1,
        startDate: new Date(),
        endDate: new Date(),
        status: 'regular_season' as const,
        currentWeek: 1,
        matches: schedule.matches,
        standings: createInitialStandings(teamIds),
      };

      // Get first match
      const match = season.matches[0];

      // Process result
      const updatedSeason = processMatchResult(season, match.id, {
        matchId: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: 105,
        awayScore: 98,
        sport: match.sport,
        quarterScores: [],
        stats: { home: {}, away: {} },
        events: [],
        duration: 48,
      });

      // Verify standings updated
      expect(updatedSeason.standings[match.homeTeamId].wins).toBe(1);
      expect(updatedSeason.standings[match.awayTeamId].losses).toBe(1);
    });
  });

  describe('Type Compatibility', () => {
    it('Player type is compatible across modules', () => {
      const player = createMockPlayer('test', 'PG', 70, 25);

      // Should work with AI evaluation
      const config = createAIConfig('balanced');
      const context = createDecisionContext();
      const evaluation = evaluatePlayer(player, context, config);

      expect(evaluation.playerId).toBe('test');
    });

    it('DecisionContext has all required fields', () => {
      const context: DecisionContext = {
        week: 10,
        transferWindowOpen: true,
        finance: { available: 1000000, total: 5000000 },
        standings: { position: 5, gamesPlayed: 10, wins: 6, losses: 4 },
      };

      expect(context.week).toBeDefined();
      expect(context.transferWindowOpen).toBeDefined();
      expect(context.finance.available).toBeDefined();
    });
  });
});
