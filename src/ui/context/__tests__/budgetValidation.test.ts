/**
 * Budget Validation Tests
 *
 * Tests that reducers reject actions that would make budget negative.
 */

import { gameReducer } from '../gameReducer';
import type { GameState, GameAction } from '../types';
import type { Player, AcademyProspect } from '../../../data/types';

// Helper to create a minimal valid game state
function createTestState(overrides: Partial<GameState> = {}): GameState {
  const baseState: GameState = {
    initialized: true,
    version: 1,
    players: {},
    userTeam: {
      id: 'user',
      name: 'Test Team',
      colors: { primary: '#000', secondary: '#fff' },
      division: 1,
      totalBudget: 10000000,
      salaryCommitment: 0,
      availableBudget: 100000,
      operationsBudget: {
        scouting: 25,
        training: 25,
        medical: 25,
        youthDevelopment: 25,
      },
      rosterIds: [],
      lineup: {
        basketball: { starters: [], bench: [] },
        baseball: { battingOrder: [], startingPitcher: null, bullpen: [] },
        soccer: { formation: '4-3-3', starters: [], bench: [] },
        minutesAllocation: {},
        soccerMinutesAllocation: {},
      },
      tactics: { offensiveStyle: 'balanced', defensiveStyle: 'balanced', tempo: 'normal' },
      shortlistIds: [],
      transferListIds: [],
      transferListAskingPrices: {},
      trainingFocus: { physical: 34, mental: 33, technical: 33 },
      country: 'USA',
      city: 'Test City',
      startingDivision: 1,
    },
    league: {
      teams: [],
      freeAgentIds: [],
      country: 'USA',
    },
    season: {
      year: 2024,
      currentWeek: 1,
      phase: 'regular',
      schedule: [],
      standings: { basketball: [], baseball: [], soccer: [] },
    },
    market: {
      transferOffers: [],
      incomingOffers: [],
      outgoingOffers: [],
      activeNegotiation: null,
      negotiationHistory: [],
    },
    scouting: {
      knownPlayers: [],
      scoutingTargets: [],
      scoutInstructions: {},
      scoutingDepthSlider: 50,
    },
    youthAcademy: {
      scoutingReports: [],
      academyProspects: [],
      lastReportWeek: 0,
      scoutSportFocus: 'balanced',
    },
    events: [],
    settings: {
      simulationSpeed: 'normal',
      autoSave: true,
      notifications: true,
    },
    managerCareer: {
      name: 'Test Manager',
      rating: 50,
      reputation: 50,
      careerHistory: [],
      achievements: [],
      currentStreak: { wins: 0, losses: 0 },
      seasonRecord: { wins: 0, losses: 0, draws: 0 },
      managerialStyle: 'balanced',
    },
    baseballStrategy: {
      pitchingStrategy: 'balanced',
      battingStrategy: 'balanced',
      runningStrategy: 'conservative',
      fieldingStrategy: 'standard',
      bullpenUsage: 'normal',
    },
  } as GameState;

  return { ...baseState, ...overrides };
}

// Helper to create a test player
function createTestPlayer(id: string, salary: number): Player {
  return {
    id,
    name: `Player ${id}`,
    age: 25,
    careerStartAge: 20,
    dateOfBirth: new Date(),
    position: 'PG',
    height: 75,
    weight: 200,
    nationality: 'USA',
    attributes: {} as Player['attributes'],
    potentials: { physical: 80, mental: 80, technical: 80 },
    peakAges: { physical: 26, technical: 28, mental: 30 },
    contract: {
      id: `contract-${id}`,
      playerId: id,
      teamId: 'user',
      salary,
      signingBonus: 0,
      contractLength: 1,
      startDate: new Date(),
      expiryDate: new Date(),
      performanceBonuses: {},
      releaseClause: null,
      salaryIncreases: [],
      agentFee: 0,
      clauses: [],
      squadRole: 'squad_player',
      loyaltyBonus: 0,
    },
    injury: null,
    trainingFocus: { physical: 34, mental: 33, technical: 33 },
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    teamId: 'user',
    acquisitionType: 'free_agent',
    acquisitionDate: new Date(),
  };
}

describe('Budget Validation in Reducers', () => {
  describe('SIGN_PLAYER', () => {
    it('should reject signing when salary exceeds available budget', () => {
      const state = createTestState();
      state.userTeam.availableBudget = 50000; // Only $50k available

      const expensivePlayer = createTestPlayer('expensive', 100000); // $100k salary

      const action: GameAction = {
        type: 'SIGN_PLAYER',
        payload: { player: expensivePlayer },
      };

      const newState = gameReducer(state, action);

      // State should be unchanged - signing rejected
      expect(newState.userTeam.availableBudget).toBe(50000);
      expect(newState.userTeam.rosterIds).not.toContain('expensive');
    });

    it('should allow signing when salary is within budget', () => {
      const state = createTestState();
      state.userTeam.availableBudget = 200000; // $200k available

      const affordablePlayer = createTestPlayer('affordable', 100000); // $100k salary

      const action: GameAction = {
        type: 'SIGN_PLAYER',
        payload: { player: affordablePlayer },
      };

      const newState = gameReducer(state, action);

      // Signing should succeed
      expect(newState.userTeam.availableBudget).toBe(100000); // 200k - 100k
      expect(newState.userTeam.rosterIds).toContain('affordable');
    });

    it('should allow signing when salary exactly equals budget', () => {
      const state = createTestState();
      state.userTeam.availableBudget = 100000; // Exactly $100k available

      const player = createTestPlayer('exact', 100000); // $100k salary

      const action: GameAction = {
        type: 'SIGN_PLAYER',
        payload: { player: player },
      };

      const newState = gameReducer(state, action);

      // Signing should succeed (budget = salary is allowed)
      expect(newState.userTeam.availableBudget).toBe(0);
      expect(newState.userTeam.rosterIds).toContain('exact');
    });
  });

  describe('SIGN_PROSPECT_TO_ACADEMY', () => {
    it('should reject signing when signing cost exceeds available budget', () => {
      const state = createTestState();
      state.userTeam.availableBudget = 50000; // Only $50k available

      const prospect: AcademyProspect = {
        id: 'prospect-1',
        name: 'Test Prospect',
        age: 16,
        nationality: 'USA',
        height: 180,
        weight: 75,
        attributes: {},
        potentials: { physical: 80, mental: 80, technical: 80 },
        status: 'active',
        signedWeek: 1,
        attributesAtSigning: {},
      };

      const action: GameAction = {
        type: 'SIGN_PROSPECT_TO_ACADEMY',
        payload: { prospect, signingCost: 100000 }, // $100k - more than available
      };

      const newState = gameReducer(state, action);

      // State should be unchanged - signing rejected
      expect(newState.userTeam.availableBudget).toBe(50000);
      expect(newState.youthAcademy.academyProspects.length).toBe(0);
    });

    it('should allow signing when cost is within budget', () => {
      const state = createTestState();
      state.userTeam.availableBudget = 200000; // $200k available

      const prospect: AcademyProspect = {
        id: 'prospect-1',
        name: 'Test Prospect',
        age: 16,
        nationality: 'USA',
        height: 180,
        weight: 75,
        attributes: {},
        potentials: { physical: 80, mental: 80, technical: 80 },
        status: 'active',
        signedWeek: 1,
        attributesAtSigning: {},
      };

      const action: GameAction = {
        type: 'SIGN_PROSPECT_TO_ACADEMY',
        payload: { prospect, signingCost: 100000 }, // $100k - within budget
      };

      const newState = gameReducer(state, action);

      // Signing should succeed
      expect(newState.userTeam.availableBudget).toBe(100000); // 200k - 100k
      expect(newState.youthAcademy.academyProspects.length).toBe(1);
      expect(newState.youthAcademy.academyProspects[0].id).toBe('prospect-1');
    });
  });

  describe('COMPLETE_TRANSFER', () => {
    it('should reject transfer when fee exceeds available budget (user buying)', () => {
      const player = createTestPlayer('transfer-player', 0);
      player.teamId = 'ai-team';
      player.contract = null;

      const state = createTestState();
      state.userTeam.availableBudget = 50000; // Only $50k available
      state.players = { 'transfer-player': player };

      const action: GameAction = {
        type: 'COMPLETE_TRANSFER',
        payload: {
          offerId: 'offer-1',
          playerId: 'transfer-player',
          fromTeamId: 'ai-team',
          toTeamId: 'user', // User is buying
          fee: 100000, // $100k fee - more than available
        },
      };

      const newState = gameReducer(state, action);

      // State should be unchanged - transfer rejected
      expect(newState.userTeam.availableBudget).toBe(50000);
      expect(newState.userTeam.rosterIds).not.toContain('transfer-player');
    });

    it('should allow transfer when fee is within budget', () => {
      const player = createTestPlayer('transfer-player', 0);
      player.teamId = 'ai-team';
      player.contract = null;

      const state = createTestState();
      state.userTeam.availableBudget = 200000; // $200k available
      state.players = { 'transfer-player': player };
      state.league.teams = [{ id: 'ai-team', name: 'AI Team', rosterIds: ['transfer-player'] }] as any;

      const action: GameAction = {
        type: 'COMPLETE_TRANSFER',
        payload: {
          offerId: 'offer-1',
          playerId: 'transfer-player',
          fromTeamId: 'ai-team',
          toTeamId: 'user',
          fee: 100000, // $100k fee - within budget
        },
      };

      const newState = gameReducer(state, action);

      // Transfer should succeed
      expect(newState.userTeam.availableBudget).toBe(100000); // 200k - 100k
      expect(newState.userTeam.rosterIds).toContain('transfer-player');
    });

    it('should allow transfer when user is selling (no budget check needed)', () => {
      const player = createTestPlayer('selling-player', 0);
      player.teamId = 'user';
      player.contract = null;

      const state = createTestState();
      state.userTeam.availableBudget = 50000; // Low budget - shouldn't matter when selling
      state.userTeam.rosterIds = ['selling-player'];
      state.players = { 'selling-player': player };

      const action: GameAction = {
        type: 'COMPLETE_TRANSFER',
        payload: {
          offerId: 'offer-1',
          playerId: 'selling-player',
          fromTeamId: 'user', // User is selling
          toTeamId: 'ai-team',
          fee: 500000, // User receives this
        },
      };

      const newState = gameReducer(state, action);

      // Transfer should succeed - user is selling, not buying
      expect(newState.userTeam.availableBudget).toBe(550000); // 50k + 500k
    });
  });

  describe('MAKE_OFFER', () => {
    it('should reject offer when amount exceeds available budget', () => {
      const player = createTestPlayer('target-player', 0);
      player.teamId = 'ai-team';

      const state = createTestState();
      state.userTeam.availableBudget = 50000; // Only $50k available
      state.players = { 'target-player': player };

      const action: GameAction = {
        type: 'MAKE_OFFER',
        payload: {
          playerId: 'target-player',
          amount: 100000, // $100k offer - more than available
        },
      };

      const newState = gameReducer(state, action);

      // Offer should be rejected
      expect(newState.userTeam.availableBudget).toBe(50000);
      expect(newState.market.outgoingOffers.length).toBe(0);
    });

    it('should allow offer when amount is within budget', () => {
      const player = createTestPlayer('target-player', 0);
      player.teamId = 'ai-team';

      const state = createTestState();
      state.userTeam.availableBudget = 200000; // $200k available
      state.players = { 'target-player': player };

      const action: GameAction = {
        type: 'MAKE_OFFER',
        payload: {
          playerId: 'target-player',
          amount: 100000, // $100k offer - within budget
        },
      };

      const newState = gameReducer(state, action);

      // Offer should be created (budget not deducted yet, just validated)
      expect(newState.userTeam.availableBudget).toBe(200000); // Not deducted until transfer completes
      expect(newState.market.outgoingOffers.length).toBe(1);
      expect(newState.market.outgoingOffers[0].transferFee).toBe(100000);
    });

    it('should allow offer when amount exactly equals budget', () => {
      const player = createTestPlayer('target-player', 0);
      player.teamId = 'ai-team';

      const state = createTestState();
      state.userTeam.availableBudget = 100000; // Exactly $100k available
      state.players = { 'target-player': player };

      const action: GameAction = {
        type: 'MAKE_OFFER',
        payload: {
          playerId: 'target-player',
          amount: 100000, // $100k offer - exactly equals budget
        },
      };

      const newState = gameReducer(state, action);

      // Offer should be created
      expect(newState.market.outgoingOffers.length).toBe(1);
    });
  });
});
