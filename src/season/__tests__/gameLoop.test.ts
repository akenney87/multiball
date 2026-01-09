/**
 * Game Loop Tests
 *
 * Tests for the game loop orchestrator:
 * - Week processing
 * - State management
 * - Hook integration
 */

import { GameLoop, createGameLoop } from '../gameLoop';
import { HookRegistry } from '../hooks';
import { GameEventEmitter } from '../events';
import { createNewSeason } from '../seasonManager';
import type { Player, Season, Franchise } from '../../data/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockPlayer(id: string, teamId: string): Player {
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
    teamId,
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
  } as Player;
}

function createMockFranchise(id: string): Franchise {
  return {
    id,
    name: `Team ${id}`,
    colors: { primary: '#000000', secondary: '#FFFFFF' },
    division: 1,
    divisionHistory: [],
    budget: { total: 20000000, allocated: { salaries: 15000000, coaching: 1000000, medical: 500000, youthAcademy: 500000, scouting: 500000, freeAgentTryouts: 500000 }, available: 5000000 },
    rosterIds: [],
    youthAcademyIds: [],
    tacticalSettings: {
      pace: 'standard',
      manDefensePct: 70,
      scoringOptions: [],
      minutesAllotment: {},
      reboundingStrategy: 'standard',
      closers: [],
      timeoutStrategy: 'standard',
    },
    trainingSettings: { teamWide: { physical: 34, mental: 33, technical: 33 } },
    scoutingSettings: { budgetAllocation: 10, depthVsBreadth: 50, targets: [] },
    aiPersonality: {
      name: 'Balanced',
      traits: {
        youth_development_focus: 50,
        spending_aggression: 50,
        defensive_preference: 50,
        multi_sport_specialist: false,
        risk_tolerance: 50,
        player_loyalty: 50,
      },
    },
    createdDate: new Date(),
    currentSeason: 1,
  };
}

function createTestData(): {
  season: Season;
  players: Player[];
  teams: Franchise[];
} {
  const teamIds = ['team-1', 'team-2', 'team-3', 'team-4'];
  const season = createNewSeason(teamIds, 1, { seed: 12345 });

  const players: Player[] = [];
  for (const teamId of teamIds) {
    for (let i = 0; i < 10; i++) {
      players.push(createMockPlayer(`${teamId}-player-${i}`, teamId));
    }
  }

  const teams = teamIds.map((id) => createMockFranchise(id));

  return { season, players, teams };
}

// =============================================================================
// GAME LOOP TESTS
// =============================================================================

describe('GameLoop', () => {
  let gameLoop: GameLoop;
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
    gameLoop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1'
    );
  });

  describe('initialization', () => {
    it('creates game loop with correct initial state', () => {
      expect(gameLoop.season).toBe(testData.season);
      expect(gameLoop.players).toBe(testData.players);
      expect(gameLoop.teams).toBe(testData.teams);
      expect(gameLoop.currentWeek).toBe(1);
    });

    it('starts in non-running state', () => {
      expect(gameLoop.isRunning).toBe(false);
      expect(gameLoop.isPaused).toBe(false);
    });
  });

  describe('getTeamRoster', () => {
    it('returns players for a specific team', () => {
      const roster = gameLoop.getTeamRoster('team-1');

      expect(roster).toHaveLength(10);
      expect(roster.every((p) => p.teamId === 'team-1')).toBe(true);
    });

    it('returns empty array for non-existent team', () => {
      const roster = gameLoop.getTeamRoster('non-existent');

      expect(roster).toHaveLength(0);
    });
  });

  describe('getTeamConfig', () => {
    it('returns balanced config for teams without specific personality', () => {
      const config = gameLoop.getTeamConfig('team-1');

      expect(config.personality).toBe('balanced');
    });

    it('returns conservative config for defensive teams', () => {
      testData.teams[0].aiPersonality!.traits.defensive_preference = 80;
      gameLoop.updateTeams(testData.teams);

      const config = gameLoop.getTeamConfig('team-1');

      expect(config.personality).toBe('conservative');
    });

    it('returns aggressive config for risk-taking teams', () => {
      testData.teams[0].aiPersonality!.traits.risk_tolerance = 80;
      gameLoop.updateTeams(testData.teams);

      const config = gameLoop.getTeamConfig('team-1');

      expect(config.personality).toBe('aggressive');
    });
  });

  describe('getTeamBudget', () => {
    it('returns team budget', () => {
      const budget = gameLoop.getTeamBudget('team-1');

      expect(budget.available).toBe(5000000);
      expect(budget.total).toBe(20000000);
    });

    it('returns default budget for non-existent team', () => {
      const budget = gameLoop.getTeamBudget('non-existent');

      expect(budget.available).toBe(5000000);
      expect(budget.total).toBe(20000000);
    });
  });

  describe('isSeasonComplete', () => {
    it('returns false for new season', () => {
      expect(gameLoop.isSeasonComplete()).toBe(false);
    });
  });

  describe('getSeasonProgress', () => {
    it('returns progress percentage', () => {
      const progress = gameLoop.getSeasonProgress();

      // Progress is 0% at start (no completed matches)
      expect(progress).toBe(0);
      expect(typeof progress).toBe('number');
    });
  });

  describe('state updates', () => {
    it('updates season', () => {
      const newSeason = createNewSeason(['team-1', 'team-2'], 2, { seed: 54321 });
      gameLoop.updateSeason(newSeason);

      expect(gameLoop.season).toBe(newSeason);
    });

    it('updates players', () => {
      const newPlayers = [createMockPlayer('new-1', 'team-1')];
      gameLoop.updatePlayers(newPlayers);

      expect(gameLoop.players).toBe(newPlayers);
    });

    it('updates teams', () => {
      const newTeams = [createMockFranchise('new-team')];
      gameLoop.updateTeams(newTeams);

      expect(gameLoop.teams).toBe(newTeams);
    });
  });
});

// =============================================================================
// FACTORY FUNCTION TESTS
// =============================================================================

describe('createGameLoop', () => {
  it('creates game loop instance', () => {
    const testData = createTestData();
    const loop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1'
    );

    expect(loop).toBeInstanceOf(GameLoop);
  });

  it('accepts custom hook registry', () => {
    const testData = createTestData();
    const customRegistry = new HookRegistry();
    const hookCalled = jest.fn();

    customRegistry.registerPreMatch(() => {
      hookCalled();
      return { canProceed: true, warnings: [] };
    });

    const loop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1',
      { hookRegistry: customRegistry }
    );

    expect(loop).toBeInstanceOf(GameLoop);
  });

  it('accepts custom event emitter', () => {
    const testData = createTestData();
    const customEmitter = new GameEventEmitter();

    const loop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1',
      { eventEmitter: customEmitter }
    );

    expect(loop).toBeInstanceOf(GameLoop);
  });
});

// =============================================================================
// SIMULATION CONTROL TESTS
// =============================================================================

describe('Simulation Control', () => {
  let gameLoop: GameLoop;

  beforeEach(() => {
    const testData = createTestData();
    gameLoop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1'
    );
  });

  it('can pause and resume', () => {
    gameLoop.pauseSimulation();
    expect(gameLoop.isPaused).toBe(true);

    gameLoop.resumeSimulation();
    expect(gameLoop.isPaused).toBe(false);
  });

  it('can stop simulation', () => {
    gameLoop.stopSimulation();
    expect(gameLoop.isRunning).toBe(false);
    expect(gameLoop.isPaused).toBe(false);
  });
});

// =============================================================================
// PROMOTION/RELEGATION TESTS
// =============================================================================

describe('Promotion/Relegation', () => {
  it('returns promotion/relegation results', () => {
    const testData = createTestData();
    const loop = createGameLoop(
      testData.season,
      testData.players,
      testData.teams,
      'team-1'
    );

    const results = loop.getPromotionRelegation();

    expect(results.promoted).toBeDefined();
    expect(results.relegated).toBeDefined();
    expect(Array.isArray(results.promoted)).toBe(true);
    expect(Array.isArray(results.relegated)).toBe(true);
  });
});
