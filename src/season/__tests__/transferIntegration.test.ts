/**
 * Transfer Integration Tests
 *
 * Tests for the transfer system integration:
 * - Transfer market state management
 * - Transfer window events
 * - Player valuation
 * - AI transfer decisions
 */

import {
  createTransferMarketState,
  openTransferWindow,
  closeTransferWindow,
  getPlayerMarketValue,
  getPlayerValuationDetails,
  submitTransferOffer,
  processOfferWithAI,
  identifyTransferTargets,
  shouldAIMakeOffer,
  determineAIUrgency,
  processWeeklyTransfers,
  getTeamPendingOffers,
  getMarketActivitySummary,
  type TransferMarketState,
} from '../transferIntegration';
import { GameEventEmitter } from '../events';
import { createAIConfig } from '../../ai/personality';
import type { Player, Franchise } from '../../data/types';

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

// =============================================================================
// TRANSFER MARKET STATE TESTS
// =============================================================================

describe('Transfer Market State', () => {
  describe('createTransferMarketState', () => {
    it('creates initial state', () => {
      const state = createTransferMarketState();

      expect(state.offers).toHaveLength(0);
      expect(state.isWindowOpen).toBe(false);
      expect(state.currentWeek).toBe(1);
    });

    it('creates state with custom week', () => {
      const state = createTransferMarketState(true, 5);

      expect(state.isWindowOpen).toBe(true);
      expect(state.currentWeek).toBe(5);
    });
  });

  describe('openTransferWindow', () => {
    it('opens the transfer window', () => {
      const emitter = new GameEventEmitter();
      const listener = jest.fn();
      emitter.on('season:transferWindowOpened', listener);

      let state = createTransferMarketState();
      state = openTransferWindow(state, emitter);

      expect(state.isWindowOpen).toBe(true);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('closeTransferWindow', () => {
    it('closes the transfer window', () => {
      const emitter = new GameEventEmitter();
      const listener = jest.fn();
      emitter.on('season:transferWindowClosed', listener);

      let state = createTransferMarketState(true, 5);
      state = closeTransferWindow(state, emitter);

      expect(state.isWindowOpen).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it('expires pending offers when closing', () => {
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

      state = closeTransferWindow(state);

      expect(state.offers[0].status).toBe('expired');
    });
  });
});

// =============================================================================
// PLAYER VALUATION TESTS
// =============================================================================

describe('Player Valuation', () => {
  describe('getPlayerMarketValue', () => {
    it('calculates market value for player', () => {
      const player = createMockPlayer('p1');
      const value = getPlayerMarketValue(player);

      expect(value).toBeGreaterThan(0);
      expect(typeof value).toBe('number');
    });

    it('higher rated players have higher value', () => {
      const lowRated = createMockPlayer('p1', {
        attributes: {
          grip_strength: 50, arm_strength: 50, core_strength: 50, agility: 50,
          acceleration: 50, top_speed: 50, jumping: 50, reactions: 50,
          stamina: 50, balance: 50, height: 50, durability: 50,
          awareness: 50, creativity: 50, determination: 50, bravery: 50,
          consistency: 50, composure: 50, patience: 50,
          hand_eye_coordination: 50, throw_accuracy: 50, form_technique: 50,
          finesse: 50, deception: 50, teamwork: 50,
        },
      });
      const highRated = createMockPlayer('p2', {
        attributes: {
          grip_strength: 90, arm_strength: 90, core_strength: 90, agility: 90,
          acceleration: 90, top_speed: 90, jumping: 90, reactions: 90,
          stamina: 90, balance: 90, height: 90, durability: 90,
          awareness: 90, creativity: 90, determination: 90, bravery: 90,
          consistency: 90, composure: 90, patience: 90,
          hand_eye_coordination: 90, throw_accuracy: 90, form_technique: 90,
          finesse: 90, deception: 90, teamwork: 90,
        },
      });

      const lowValue = getPlayerMarketValue(lowRated);
      const highValue = getPlayerMarketValue(highRated);

      expect(highValue).toBeGreaterThan(lowValue);
    });
  });

  describe('getPlayerValuationDetails', () => {
    it('returns detailed valuation', () => {
      const player = createMockPlayer('p1');
      const details = getPlayerValuationDetails(player);

      expect(details.player).toBe(player);
      expect(details.overallRating).toBeGreaterThan(0);
      expect(details.marketValue).toBeGreaterThan(0);
      expect(details.suggestedAskingPrice).toBeGreaterThan(0);
      expect(['young', 'prime', 'veteran']).toContain(details.ageCategory);
    });

    it('categorizes age correctly', () => {
      const young = createMockPlayer('p1', { age: 22 });
      const prime = createMockPlayer('p2', { age: 27 });
      const veteran = createMockPlayer('p3', { age: 32 });

      expect(getPlayerValuationDetails(young).ageCategory).toBe('young');
      expect(getPlayerValuationDetails(prime).ageCategory).toBe('prime');
      expect(getPlayerValuationDetails(veteran).ageCategory).toBe('veteran');
    });
  });
});

// =============================================================================
// TRANSFER OFFER TESTS
// =============================================================================

describe('Transfer Offers', () => {
  describe('submitTransferOffer', () => {
    it('creates and submits transfer offer', () => {
      const emitter = new GameEventEmitter();
      const listener = jest.fn();
      emitter.onAll(listener);

      let state = createTransferMarketState(true, 5);
      const player = createMockPlayer('p1', { teamId: 'team-1' });

      const result = submitTransferOffer(
        state,
        player,
        'team-2',
        'Team 2',
        'team-1',
        'Team 1',
        2.0,
        'neutral',
        emitter
      );

      expect(result.state.offers).toHaveLength(1);
      expect(result.offer.status).toBe('pending');
      expect(listener).toHaveBeenCalled();
    });

    it('throws if transfer window is closed', () => {
      const state = createTransferMarketState(false, 5);
      const player = createMockPlayer('p1');

      expect(() =>
        submitTransferOffer(state, player, 'team-2', 'Team 2', 'team-1', 'Team 1', 2.0, 'neutral')
      ).toThrow('Transfer window is closed');
    });
  });
});

// =============================================================================
// AI TRANSFER DECISIONS TESTS
// =============================================================================

describe('AI Transfer Decisions', () => {
  describe('identifyTransferTargets', () => {
    it('identifies targets based on team needs', () => {
      const aiTeam = createMockFranchise('ai-team');
      const aiRoster: Player[] = [
        createMockPlayer('p1', { position: 'PG', teamId: 'ai-team' }),
        createMockPlayer('p2', { position: 'SG', teamId: 'ai-team' }),
      ];
      const availablePlayers: Player[] = [
        createMockPlayer('target-1', { position: 'C', teamId: 'other' }),
        createMockPlayer('target-2', { position: 'PF', teamId: 'other' }),
      ];
      const config = createAIConfig('balanced');

      const targets = identifyTransferTargets(
        aiTeam,
        aiRoster,
        availablePlayers,
        config
      );

      expect(targets.length).toBeGreaterThan(0);
      targets.forEach((t) => {
        expect(['high', 'medium', 'low']).toContain(t.priority);
        expect(t.reason).toBeTruthy();
      });
    });
  });

  describe('shouldAIMakeOffer', () => {
    it('returns true for high priority targets with budget', () => {
      const target = {
        player: createMockPlayer('p1'),
        priority: 'high' as const,
        reason: 'Test',
        estimatedCost: 1000000,
      };
      const config = createAIConfig('balanced');

      expect(shouldAIMakeOffer(
        { id: 'team', budget: { available: 5000000 } } as Franchise,
        target,
        config
      )).toBe(true);
    });

    it('returns false when budget is insufficient', () => {
      const target = {
        player: createMockPlayer('p1'),
        priority: 'high' as const,
        reason: 'Test',
        estimatedCost: 10000000,
      };
      const config = createAIConfig('balanced');

      expect(shouldAIMakeOffer(
        { id: 'team', budget: { available: 1000000 } } as Franchise,
        target,
        config
      )).toBe(false);
    });
  });

  describe('determineAIUrgency', () => {
    it('returns desperate for high priority with aggressive AI', () => {
      const target = {
        player: createMockPlayer('p1'),
        priority: 'high' as const,
        reason: 'Test',
        estimatedCost: 1000000,
      };
      const config = createAIConfig('aggressive');

      expect(determineAIUrgency(
        createMockFranchise('team'),
        target,
        config
      )).toBe('desperate');
    });

    it('returns reluctant for conservative AI', () => {
      const target = {
        player: createMockPlayer('p1'),
        priority: 'medium' as const,
        reason: 'Test',
        estimatedCost: 1000000,
      };
      const config = createAIConfig('conservative');

      expect(determineAIUrgency(
        createMockFranchise('team'),
        target,
        config
      )).toBe('reluctant');
    });
  });
});

// =============================================================================
// WEEKLY PROCESSING TESTS
// =============================================================================

describe('Weekly Processing', () => {
  describe('processWeeklyTransfers', () => {
    it('expires old offers', () => {
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
            createdWeek: 1, // Old offer
          },
        ],
      };

      const updated = processWeeklyTransfers(state, 5);

      expect(updated.offers[0].status).toBe('expired');
      expect(updated.currentWeek).toBe(5);
    });
  });
});

// =============================================================================
// QUERY FUNCTIONS TESTS
// =============================================================================

describe('Query Functions', () => {
  describe('getTeamPendingOffers', () => {
    it('separates incoming and outgoing offers', () => {
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
          {
            playerId: 'p2',
            playerName: 'Player 2',
            sellerTeamId: 'team-2',
            buyerTeamId: 'team-1',
            marketValue: 1500000,
            transferMultiplier: 2.0,
            urgencyMultiplier: 1.0,
            finalOffer: 3000000,
            status: 'pending',
            createdWeek: 5,
          },
        ],
      };

      const { incoming, outgoing } = getTeamPendingOffers(state, 'team-1');

      expect(incoming).toHaveLength(1);
      expect(outgoing).toHaveLength(1);
      expect(incoming[0].sellerTeamId).toBe('team-1');
      expect(outgoing[0].buyerTeamId).toBe('team-1');
    });
  });

  describe('getMarketActivitySummary', () => {
    it('returns correct summary', () => {
      let state = createTransferMarketState(true, 5);
      state = {
        ...state,
        offers: [
          { status: 'pending', finalOffer: 1000000 } as any,
          { status: 'accepted', finalOffer: 2000000 } as any,
          { status: 'rejected', finalOffer: 500000 } as any,
        ],
      };

      const summary = getMarketActivitySummary(state);

      expect(summary.totalOffers).toBe(3);
      expect(summary.pendingOffers).toBe(1);
      expect(summary.acceptedOffers).toBe(1);
      expect(summary.rejectedOffers).toBe(1);
      expect(summary.totalValue).toBe(2000000);
    });
  });
});
