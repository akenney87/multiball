/**
 * Phase 5 Week 1: Integration Tests
 *
 * Tests for GameContext, gameReducer, and game initialization.
 */

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => `mock-uuid-${Math.random().toString(36).substring(7)}`,
}));

import { gameReducer, initialGameState } from '../context/gameReducer';
import { initializeNewGame, calculatePlayerOverall } from '../integration/gameInitializer';
import {
  DEFAULT_SETTINGS,
  DEFAULT_OPERATIONS_BUDGET,
  DEFAULT_TRAINING_FOCUS,
  SAVE_VERSION,
} from '../context/types';
import type { GameState, GameAction } from '../context/types';
import type { NewGameConfig } from '../screens/NewGameScreen';

// =============================================================================
// GAME INITIALIZER TESTS
// =============================================================================

describe('initializeNewGame', () => {
  const createConfig = (overrides?: Partial<NewGameConfig>): NewGameConfig => ({
    teamName: 'Test Team',
    primaryColor: '#FF0000',
    secondaryColor: '#FFFFFF',
    difficulty: 'normal',
    ...overrides,
  });

  it('creates payload with user team', () => {
    const config = createConfig();
    const payload = initializeNewGame(config);

    expect(payload.userTeam).toBeDefined();
    expect(payload.userTeam.id).toBe('user');
    expect(payload.userTeam.name).toBe('Test Team');
    expect(payload.userTeam.colors.primary).toBe('#FF0000');
    expect(payload.userTeam.colors.secondary).toBe('#FFFFFF');
  });

  it('creates 25 players for user team', () => {
    const payload = initializeNewGame(createConfig());
    expect(payload.userTeam.rosterIds.length).toBe(25);

    // All player IDs should exist in players map
    for (const id of payload.userTeam.rosterIds) {
      expect(payload.players[id]).toBeDefined();
      expect(payload.players[id].teamId).toBe('user');
    }
  });

  it('creates 19 AI teams', () => {
    const payload = initializeNewGame(createConfig());
    expect(payload.league.teams.length).toBe(19);

    // Each AI team should have a roster
    for (const team of payload.league.teams) {
      expect(team.rosterIds.length).toBe(25);
      expect(team.aiConfig).toBeDefined();
    }
  });

  it('creates free agents', () => {
    const payload = initializeNewGame(createConfig());
    expect(payload.league.freeAgentIds.length).toBeGreaterThan(0);

    // All free agents should exist and have no contract
    for (const id of payload.league.freeAgentIds) {
      expect(payload.players[id]).toBeDefined();
      expect(payload.players[id].teamId).toBe('free_agent');
      expect(payload.players[id].contract).toBeNull();
    }
  });

  it('creates season with matches', () => {
    const payload = initializeNewGame(createConfig());
    expect(payload.season.id).toBeDefined();
    expect(payload.season.matches.length).toBeGreaterThan(0);
    expect(payload.season.currentWeek).toBe(1);
    expect(payload.season.status).toBe('regular_season');
  });

  it('creates standings for all teams', () => {
    const payload = initializeNewGame(createConfig());

    // Should have 20 teams in standings (user + 19 AI)
    const standingCount = Object.keys(payload.season.standings).length;
    expect(standingCount).toBe(20);

    // User team should be in standings
    expect(payload.season.standings['user']).toBeDefined();
  });

  it('sets budget based on difficulty - easy ($25M)', () => {
    const payload = initializeNewGame(createConfig({ difficulty: 'easy' }));
    expect(payload.userTeam.totalBudget).toBe(25000000);
  });

  it('sets budget based on difficulty - normal ($20M)', () => {
    const payload = initializeNewGame(createConfig({ difficulty: 'normal' }));
    expect(payload.userTeam.totalBudget).toBe(20000000);
  });

  it('sets budget based on difficulty - hard ($15M)', () => {
    const payload = initializeNewGame(createConfig({ difficulty: 'hard' }));
    expect(payload.userTeam.totalBudget).toBe(15000000);
  });

  it('sets valid lineup from roster', () => {
    const payload = initializeNewGame(createConfig());

    // Basketball starters should be 5 players from roster
    expect(payload.userTeam.lineup.basketballStarters.length).toBe(5);
    expect(payload.userTeam.lineup.basketballStarters.every((id: string) => id !== '')).toBe(true);

    // Bench should be remaining players (25 - 5 starters = 20)
    expect(payload.userTeam.lineup.bench.length).toBe(20);
  });

  it('generates unique player names', () => {
    const payload = initializeNewGame(createConfig());
    const names = Object.values(payload.players).map((p) => p.name);
    const uniqueNames = new Set(names);

    // Should have mostly unique names (some duplicates possible with random generation)
    expect(uniqueNames.size).toBeGreaterThan(names.length * 0.9);
  });

  it('creates players with valid positions', () => {
    const payload = initializeNewGame(createConfig());
    const validPositions = ['PG', 'SG', 'SF', 'PF', 'C'];

    for (const player of Object.values(payload.players)) {
      expect(validPositions).toContain(player.position);
    }
  });
});

describe('calculatePlayerOverall', () => {
  it('calculates overall rating', () => {
    const payload = initializeNewGame({
      teamName: 'Test',
      primaryColor: '#000',
      secondaryColor: '#FFF',
      difficulty: 'normal',
    });

    const player = Object.values(payload.players)[0];
    const overall = calculatePlayerOverall(player);

    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// GAME REDUCER TESTS
// =============================================================================

describe('gameReducer', () => {
  describe('INITIALIZE_GAME', () => {
    it('sets initialized to true', () => {
      const config: NewGameConfig = {
        teamName: 'Test',
        primaryColor: '#000',
        secondaryColor: '#FFF',
        difficulty: 'normal',
      };
      const payload = initializeNewGame(config);
      const action: GameAction = { type: 'INITIALIZE_GAME', payload };

      const newState = gameReducer(initialGameState, action);

      expect(newState.initialized).toBe(true);
      expect(newState.userTeam.name).toBe('Test');
    });
  });

  describe('RESET_GAME', () => {
    it('resets to initial state', () => {
      const config: NewGameConfig = {
        teamName: 'Test',
        primaryColor: '#000',
        secondaryColor: '#FFF',
        difficulty: 'normal',
      };
      const payload = initializeNewGame(config);
      let state = gameReducer(initialGameState, { type: 'INITIALIZE_GAME', payload });
      expect(state.initialized).toBe(true);

      state = gameReducer(state, { type: 'RESET_GAME' });
      expect(state.initialized).toBe(false);
      expect(state.userTeam.name).toBe('');
    });
  });

  describe('ADVANCE_WEEK', () => {
    it('increments current week', () => {
      const config: NewGameConfig = {
        teamName: 'Test',
        primaryColor: '#000',
        secondaryColor: '#FFF',
        difficulty: 'normal',
      };
      const payload = initializeNewGame(config);
      let state = gameReducer(initialGameState, { type: 'INITIALIZE_GAME', payload });
      expect(state.season.currentWeek).toBe(1);

      state = gameReducer(state, { type: 'ADVANCE_WEEK' });
      expect(state.season.currentWeek).toBe(2);
    });

    it('caps at week 40 and sets off_season', () => {
      const config: NewGameConfig = {
        teamName: 'Test',
        primaryColor: '#000',
        secondaryColor: '#FFF',
        difficulty: 'normal',
      };
      const payload = initializeNewGame(config);
      let state = gameReducer(initialGameState, { type: 'INITIALIZE_GAME', payload });

      // Advance to week 40
      state = {
        ...state,
        season: { ...state.season, currentWeek: 40 },
      };

      state = gameReducer(state, { type: 'ADVANCE_WEEK' });
      expect(state.season.currentWeek).toBe(40);
      expect(state.season.status).toBe('off_season');
    });
  });

  describe('SET_LINEUP', () => {
    it('updates lineup', () => {
      const config: NewGameConfig = {
        teamName: 'Test',
        primaryColor: '#000',
        secondaryColor: '#FFF',
        difficulty: 'normal',
      };
      const payload = initializeNewGame(config);
      let state = gameReducer(initialGameState, { type: 'INITIALIZE_GAME', payload });

      const newLineup = {
        basketballStarters: ['p1', 'p2', 'p3', 'p4', 'p5'] as [string, string, string, string, string],
        baseballLineup: {
          battingOrder: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'],
          positions: {},
          startingPitcher: 'p1',
          bullpen: {
            longRelievers: ['', ''] as [string, string],
            shortRelievers: ['', ''] as [string, string],
            closer: '',
          },
        },
        soccerLineup: {
          starters: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
          formation: '4-4-2' as const,
          positions: {},
        },
        bench: ['p6', 'p7'],
        minutesAllocation: {},
        soccerMinutesAllocation: {},
      };

      state = gameReducer(state, { type: 'SET_LINEUP', payload: newLineup });
      expect(state.userTeam.lineup).toEqual(newLineup);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('merges settings', () => {
      let state = gameReducer(initialGameState, {
        type: 'UPDATE_SETTINGS',
        payload: { soundEnabled: false },
      });

      expect(state.settings.soundEnabled).toBe(false);
      expect(state.settings.autoSaveEnabled).toBe(true); // unchanged
    });
  });

  describe('ADD_EVENT', () => {
    it('adds event to front of list', () => {
      const event = {
        id: 'test-event',
        type: 'general' as const,
        priority: 'info' as const,
        title: 'Test',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        scope: 'team' as const,
      };

      const state = gameReducer(initialGameState, {
        type: 'ADD_EVENT',
        payload: event,
      });

      expect(state.events[0]).toEqual(event);
    });

    it('limits events to 100', () => {
      let state = initialGameState;

      // Add 110 events
      for (let i = 0; i < 110; i++) {
        state = gameReducer(state, {
          type: 'ADD_EVENT',
          payload: {
            id: `event-${i}`,
            type: 'general' as const,
            priority: 'info' as const,
            title: `Event ${i}`,
            message: 'Test',
            timestamp: new Date(),
            read: false,
            scope: 'team' as const,
          },
        });
      }

      expect(state.events.length).toBe(100);
    });
  });

  describe('MARK_SAVED', () => {
    it('updates lastSaved timestamp', () => {
      const timestamp = new Date();
      const state = gameReducer(initialGameState, {
        type: 'MARK_SAVED',
        payload: { timestamp },
      });

      expect(state.lastSaved).toEqual(timestamp);
    });
  });
});

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('Context Constants', () => {
  it('has valid default settings', () => {
    expect(DEFAULT_SETTINGS.difficulty).toBe('normal');
    expect(DEFAULT_SETTINGS.simulationSpeed).toBe('normal');
    expect(DEFAULT_SETTINGS.soundEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.theme).toBe('system');
  });

  it('has valid default operations budget summing to 100', () => {
    const sum =
      DEFAULT_OPERATIONS_BUDGET.training +
      DEFAULT_OPERATIONS_BUDGET.scouting +
      DEFAULT_OPERATIONS_BUDGET.medical +
      DEFAULT_OPERATIONS_BUDGET.youthDevelopment;
    expect(sum).toBe(100);
  });

  it('has valid default training focus summing to 100', () => {
    const sum =
      DEFAULT_TRAINING_FOCUS.physical +
      DEFAULT_TRAINING_FOCUS.mental +
      DEFAULT_TRAINING_FOCUS.technical;
    expect(sum).toBe(100);
  });

  it('has valid save version', () => {
    expect(SAVE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// =============================================================================
// INITIAL STATE TESTS
// =============================================================================

describe('initialGameState', () => {
  it('has initialized as false', () => {
    expect(initialGameState.initialized).toBe(false);
  });

  it('has empty user team', () => {
    expect(initialGameState.userTeam.name).toBe('');
    expect(initialGameState.userTeam.rosterIds).toEqual([]);
  });

  it('has empty players', () => {
    expect(Object.keys(initialGameState.players)).toHaveLength(0);
  });

  it('has empty league', () => {
    expect(initialGameState.league.teams).toHaveLength(0);
    expect(initialGameState.league.freeAgentIds).toHaveLength(0);
  });

  it('has default settings', () => {
    expect(initialGameState.settings).toEqual(DEFAULT_SETTINGS);
  });
});
