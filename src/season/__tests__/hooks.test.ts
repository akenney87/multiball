/**
 * Hooks System Tests
 *
 * Tests for the pre/post match and week hooks:
 * - Hook registration and execution
 * - Built-in hooks
 * - Event emission from hooks
 */

import {
  HookRegistry,
  createDefaultHookRegistry,
  validateRosterHook,
  checkFatigueHook,
  injuryRollHook,
  recoveryProcessingHook,
  trainingXpHook,
  type PreMatchContext,
  type PostMatchContext,
  type PreWeekContext,
  type PostWeekContext,
} from '../hooks';
import { GameEventEmitter } from '../events';
import { createNewSeason } from '../seasonManager';
import type { Player, Match, MatchResult, Season, Injury, AIConfig } from '../../data/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    age: 25,
    dateOfBirth: new Date('1998-01-01'),
    position: 'PG',
    attributes: {
      grip_strength: 70, arm_strength: 68, core_strength: 72, agility: 70,
      acceleration: 74, top_speed: 68, jumping: 72, reactions: 75,
      stamina: 70, balance: 68, height: 65, durability: 70,
      awareness: 75, creativity: 68, determination: 72, bravery: 70,
      consistency: 70, composure: 73, patience: 68,
      hand_eye_coordination: 72, throw_accuracy: 70, form_technique: 71,
      finesse: 68, deception: 65, teamwork: 70,
    },
    potentials: { physical: 75, mental: 77, technical: 76 },
    peakAges: { physical: 26, technical: 28, mental: 30 },
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
    ...overrides,
  } as Player;
}

function createMockMatch(): Match {
  return {
    id: 'match-1',
    seasonId: 'season-1',
    homeTeamId: 'team-1',
    awayTeamId: 'team-2',
    sport: 'basketball',
    scheduledDate: new Date(),
    status: 'scheduled',
    result: null,
  };
}

function createMockResult(): MatchResult {
  return {
    matchId: 'match-1',
    homeScore: 105,
    awayScore: 98,
    winner: 'team-1',
    boxScore: {},
    playByPlay: [],
  };
}

function createMockConfig(): AIConfig {
  return {
    personality: 'balanced',
    riskTolerance: 50,
    aggression: 50,
    defenseFocus: 50,
    youthPreference: 50,
    pacingPreference: 50,
    starPlayerReliance: 50,
    adaptability: 50,
  };
}

function createMockRoster(count: number = 10): Player[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPlayer(`player-${i + 1}`, { teamId: 'team-1' })
  );
}

function createMockSeason(): Season {
  const teamIds = Array.from({ length: 4 }, (_, i) => `team-${i + 1}`);
  return createNewSeason(teamIds, 1, { seed: 12345 });
}

// =============================================================================
// HOOK REGISTRY TESTS
// =============================================================================

describe('HookRegistry', () => {
  let registry: HookRegistry;
  let emitter: GameEventEmitter;

  beforeEach(() => {
    emitter = new GameEventEmitter();
    registry = new HookRegistry(emitter);
  });

  describe('registration', () => {
    it('registers pre-match hooks', () => {
      const hook = jest.fn(() => ({ canProceed: true, warnings: [] }));
      registry.registerPreMatch(hook);

      expect(registry.getHookCounts().preMatch).toBe(1);
    });

    it('registers post-match hooks', () => {
      const hook = jest.fn(() => ({ injuries: [], updatedPlayers: [], newsItems: [] }));
      registry.registerPostMatch(hook);

      expect(registry.getHookCounts().postMatch).toBe(1);
    });

    it('registers pre-week hooks', () => {
      const hook = jest.fn(() => ({ recoveredPlayers: [], updatedPlayers: [] }));
      registry.registerPreWeek(hook);

      expect(registry.getHookCounts().preWeek).toBe(1);
    });

    it('registers post-week hooks', () => {
      const hook = jest.fn(() => ({ xpDistributed: {}, updatedPlayers: [] }));
      registry.registerPostWeek(hook);

      expect(registry.getHookCounts().postWeek).toBe(1);
    });

    it('returns unsubscribe function', () => {
      const hook = jest.fn(() => ({ canProceed: true, warnings: [] }));
      const unsubscribe = registry.registerPreMatch(hook);

      expect(registry.getHookCounts().preMatch).toBe(1);

      unsubscribe();

      expect(registry.getHookCounts().preMatch).toBe(0);
    });
  });

  describe('executePreMatch', () => {
    it('executes all registered pre-match hooks', () => {
      const hook1 = jest.fn(() => ({ canProceed: true, warnings: [] }));
      const hook2 = jest.fn(() => ({ canProceed: true, warnings: [] }));

      registry.registerPreMatch(hook1);
      registry.registerPreMatch(hook2);

      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(),
        awayRoster: createMockRoster(),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      registry.executePreMatch(context);

      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
    });

    it('combines warnings from all hooks', () => {
      registry.registerPreMatch(() => ({
        canProceed: true,
        warnings: ['Warning 1'],
      }));
      registry.registerPreMatch(() => ({
        canProceed: true,
        warnings: ['Warning 2'],
      }));

      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(),
        awayRoster: createMockRoster(),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = registry.executePreMatch(context);

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain('Warning 1');
      expect(result.warnings).toContain('Warning 2');
    });

    it('stops proceeding if any hook returns canProceed=false', () => {
      registry.registerPreMatch(() => ({
        canProceed: true,
        warnings: [],
      }));
      registry.registerPreMatch(() => ({
        canProceed: false,
        warnings: ['Cannot proceed'],
      }));

      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(),
        awayRoster: createMockRoster(),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = registry.executePreMatch(context);

      expect(result.canProceed).toBe(false);
    });
  });

  describe('executePostMatch', () => {
    it('emits match completed event', () => {
      const listener = jest.fn();
      emitter.on('match:completed', listener);

      const context: PostMatchContext = {
        season: createMockSeason(),
        match: { ...createMockMatch(), status: 'completed' },
        result: createMockResult(),
        homeRoster: createMockRoster(),
        awayRoster: createMockRoster(),
        minutesPlayed: {},
      };

      registry.executePostMatch(context);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('executePostWeek', () => {
    it('emits week advanced event', () => {
      const listener = jest.fn();
      emitter.on('season:weekAdvanced', listener);

      const context: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 2,
        allPlayers: createMockRoster(),
        matchesCompleted: [],
      };

      registry.executePostWeek(context);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('combines XP from all hooks', () => {
      registry.registerPostWeek(() => ({
        xpDistributed: {
          'player-1': { physical: 5, mental: 3, technical: 4 },
        },
        updatedPlayers: [],
      }));
      registry.registerPostWeek(() => ({
        xpDistributed: {
          'player-1': { physical: 2, mental: 1, technical: 1 },
        },
        updatedPlayers: [],
      }));

      const context: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 2,
        allPlayers: createMockRoster(),
        matchesCompleted: [],
      };

      const result = registry.executePostWeek(context);

      expect(result.xpDistributed['player-1'].physical).toBe(7);
      expect(result.xpDistributed['player-1'].mental).toBe(4);
      expect(result.xpDistributed['player-1'].technical).toBe(5);
    });
  });

  describe('clearAllHooks', () => {
    it('removes all registered hooks', () => {
      registry.registerPreMatch(() => ({ canProceed: true, warnings: [] }));
      registry.registerPostMatch(() => ({ injuries: [], updatedPlayers: [], newsItems: [] }));
      registry.registerPreWeek(() => ({ recoveredPlayers: [], updatedPlayers: [] }));
      registry.registerPostWeek(() => ({ xpDistributed: {}, updatedPlayers: [] }));

      registry.clearAllHooks();

      const counts = registry.getHookCounts();
      expect(counts.preMatch).toBe(0);
      expect(counts.postMatch).toBe(0);
      expect(counts.preWeek).toBe(0);
      expect(counts.postWeek).toBe(0);
    });
  });
});

// =============================================================================
// BUILT-IN HOOK TESTS
// =============================================================================

describe('Built-in Hooks', () => {
  describe('validateRosterHook', () => {
    it('allows match with enough healthy players', () => {
      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(10),
        awayRoster: createMockRoster(10),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = validateRosterHook(context);

      expect(result.canProceed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('prevents match when home team has too few players', () => {
      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(3), // Only 3 players
        awayRoster: createMockRoster(10),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = validateRosterHook(context);

      expect(result.canProceed).toBe(false);
      expect(result.warnings.some((w) => w.includes('Home team'))).toBe(true);
    });

    it('excludes injured players from count', () => {
      const roster = createMockRoster(6);
      // Injure 2 players, leaving only 4 healthy
      roster[0].injury = {
        id: 'inj-1',
        playerId: roster[0].id,
        injuryType: 'minor',
        injuryName: 'Sprain',
        occurredDate: new Date(),
        recoveryWeeks: 1,
        returnDate: new Date(),
        doctorReport: 'Test',
      };
      roster[1].injury = {
        id: 'inj-2',
        playerId: roster[1].id,
        injuryType: 'minor',
        injuryName: 'Sprain',
        occurredDate: new Date(),
        recoveryWeeks: 1,
        returnDate: new Date(),
        doctorReport: 'Test',
      };

      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: roster,
        awayRoster: createMockRoster(10),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = validateRosterHook(context);

      expect(result.canProceed).toBe(false);
    });
  });

  describe('checkFatigueHook', () => {
    it('warns about fatigued players', () => {
      const roster = createMockRoster(5);
      roster[0].attributes.stamina = 25; // Fatigued

      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: roster,
        awayRoster: createMockRoster(5),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = checkFatigueHook(context);

      expect(result.canProceed).toBe(true); // Doesn't prevent match
      expect(result.warnings.some((w) => w.includes('fatigued'))).toBe(true);
    });

    it('returns no warnings for healthy stamina', () => {
      const context: PreMatchContext = {
        season: createMockSeason(),
        match: createMockMatch(),
        homeRoster: createMockRoster(5),
        awayRoster: createMockRoster(5),
        homeConfig: createMockConfig(),
        awayConfig: createMockConfig(),
      };

      const result = checkFatigueHook(context);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('injuryRollHook', () => {
    it('skips already injured players', () => {
      const roster = createMockRoster(5);
      roster[0].injury = {
        id: 'inj-1',
        playerId: roster[0].id,
        injuryType: 'minor',
        injuryName: 'Existing',
        occurredDate: new Date(),
        recoveryWeeks: 1,
        returnDate: new Date(),
        doctorReport: 'Test',
      };

      const context: PostMatchContext = {
        season: createMockSeason(),
        match: { ...createMockMatch(), status: 'completed' },
        result: createMockResult(),
        homeRoster: roster,
        awayRoster: [],
        minutesPlayed: { [roster[0].id]: 30 },
      };

      // Run many times - injured player should never get new injury
      for (let i = 0; i < 100; i++) {
        const result = injuryRollHook(context);
        const injuredPlayer = result.injuries.find((inj) => inj.playerId === roster[0].id);
        expect(injuredPlayer).toBeUndefined();
      }
    });

    it('skips players with 0 minutes', () => {
      const roster = createMockRoster(5);

      const context: PostMatchContext = {
        season: createMockSeason(),
        match: { ...createMockMatch(), status: 'completed' },
        result: createMockResult(),
        homeRoster: roster,
        awayRoster: [],
        minutesPlayed: {}, // No minutes played
      };

      const result = injuryRollHook(context);

      expect(result.injuries).toHaveLength(0);
    });
  });

  describe('recoveryProcessingHook', () => {
    it('recovers players whose return date has passed', () => {
      const roster = createMockRoster(5);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      roster[0].injury = {
        id: 'inj-1',
        playerId: roster[0].id,
        injuryType: 'minor',
        injuryName: 'Old injury',
        occurredDate: pastDate,
        recoveryWeeks: 1,
        returnDate: pastDate, // Already past
        doctorReport: 'Should recover',
      };

      const context: PreWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: roster,
      };

      const result = recoveryProcessingHook(context);

      expect(result.recoveredPlayers).toContain(roster[0].id);
      const updatedPlayer = result.updatedPlayers.find((p) => p.id === roster[0].id);
      expect(updatedPlayer?.injury).toBeNull();
    });

    it('does not recover players with future return date', () => {
      const roster = createMockRoster(5);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

      roster[0].injury = {
        id: 'inj-1',
        playerId: roster[0].id,
        injuryType: 'moderate',
        injuryName: 'Active injury',
        occurredDate: new Date(),
        recoveryWeeks: 2,
        returnDate: futureDate,
        doctorReport: 'Still recovering',
      };

      const context: PreWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: roster,
      };

      const result = recoveryProcessingHook(context);

      expect(result.recoveredPlayers).not.toContain(roster[0].id);
    });
  });

  describe('trainingXpHook', () => {
    it('distributes XP based on training focus', () => {
      const roster = createMockRoster(1);
      roster[0].trainingFocus = { physical: 50, mental: 30, technical: 20 };

      const context: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: roster,
        matchesCompleted: [],
      };

      const result = trainingXpHook(context);

      const xp = result.xpDistributed[roster[0].id];
      expect(xp.physical).toBeGreaterThan(xp.mental);
      expect(xp.mental).toBeGreaterThan(xp.technical);
    });

    it('reduces XP for injured players', () => {
      const healthyRoster = createMockRoster(1);
      const injuredRoster = createMockRoster(1);
      injuredRoster[0].id = 'injured-1';
      injuredRoster[0].injury = {
        id: 'inj-1',
        playerId: 'injured-1',
        injuryType: 'minor',
        injuryName: 'Sprain',
        occurredDate: new Date(),
        recoveryWeeks: 1,
        returnDate: new Date(),
        doctorReport: 'Test',
      };

      // Set same determination for fair comparison
      healthyRoster[0].attributes.determination = 50;
      injuredRoster[0].attributes.determination = 50;

      const healthyContext: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: healthyRoster,
        matchesCompleted: [],
      };

      const injuredContext: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: injuredRoster,
        matchesCompleted: [],
      };

      const healthyResult = trainingXpHook(healthyContext);
      const injuredResult = trainingXpHook(injuredContext);

      const healthyTotal =
        healthyResult.xpDistributed[healthyRoster[0].id].physical +
        healthyResult.xpDistributed[healthyRoster[0].id].mental +
        healthyResult.xpDistributed[healthyRoster[0].id].technical;

      const injuredTotal =
        injuredResult.xpDistributed['injured-1'].physical +
        injuredResult.xpDistributed['injured-1'].mental +
        injuredResult.xpDistributed['injured-1'].technical;

      expect(injuredTotal).toBeLessThan(healthyTotal);
    });

    it('updates player weeklyXP accumulation', () => {
      const roster = createMockRoster(1);
      roster[0].weeklyXP = { physical: 10, mental: 5, technical: 3 };

      const context: PostWeekContext = {
        season: createMockSeason(),
        weekNumber: 5,
        allPlayers: roster,
        matchesCompleted: [],
      };

      const result = trainingXpHook(context);

      const updatedPlayer = result.updatedPlayers.find((p) => p.id === roster[0].id);
      expect(updatedPlayer?.weeklyXP.physical).toBeGreaterThan(10);
    });
  });
});

// =============================================================================
// DEFAULT REGISTRY TESTS
// =============================================================================

describe('createDefaultHookRegistry', () => {
  it('creates registry with default hooks', () => {
    const registry = createDefaultHookRegistry();

    const counts = registry.getHookCounts();
    expect(counts.preMatch).toBeGreaterThan(0);
    expect(counts.postMatch).toBeGreaterThan(0);
    expect(counts.preWeek).toBeGreaterThan(0);
    expect(counts.postWeek).toBeGreaterThan(0);
  });

  it('accepts custom event emitter', () => {
    const customEmitter = new GameEventEmitter();
    const listener = jest.fn();
    customEmitter.on('match:completed', listener);

    const registry = createDefaultHookRegistry(customEmitter);

    const context: PostMatchContext = {
      season: createMockSeason(),
      match: { ...createMockMatch(), status: 'completed' },
      result: createMockResult(),
      homeRoster: createMockRoster(),
      awayRoster: createMockRoster(),
      minutesPlayed: {},
    };

    registry.executePostMatch(context);

    expect(listener).toHaveBeenCalled();
  });
});
