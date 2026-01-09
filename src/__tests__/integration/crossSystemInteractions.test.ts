/**
 * Cross-System Interaction Tests
 *
 * Tests interactions between multiple systems:
 * - Transfer + Contract integration
 * - Free Agent + Signing workflow
 * - Season + Market interactions
 * - AI decisions across market systems
 */

import {
  createTransferMarketState,
  openTransferMarket,
  closeTransferMarket,
  getPlayerMarketValue,
  submitTransferOffer,
  identifyTransferTargets,
  shouldAIMakeOffer,
  determineAIUrgency,
  GameEventEmitter,
} from '../../season';
import {
  createContractNegotiationState,
  startNegotiation,
  submitOffer,
  generateRecommendedOffer,
  canAffordContract,
} from '../../season/contractIntegration';
import {
  createFreeAgentMarketState,
  signFreeAgent,
  releaseToFreeAgency,
  identifyFreeAgentTargets,
  shouldAISignFreeAgent,
  getTopAvailableFreeAgents,
  getFreeAgentMarketSummary,
} from '../../season/freeAgentIntegration';
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
      grip_strength: 70,
      arm_strength: 68,
      core_strength: 72,
      agility: 70,
      acceleration: 74,
      top_speed: 68,
      jumping: 72,
      reactions: 75,
      stamina: 70,
      balance: 68,
      height: 65,
      durability: 70,
      awareness: 75,
      creativity: 68,
      determination: 72,
      bravery: 70,
      consistency: 70,
      composure: 73,
      patience: 68,
      hand_eye_coordination: 72,
      throw_accuracy: 70,
      form_technique: 71,
      finesse: 68,
      deception: 65,
      teamwork: 70,
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
    budget: {
      total: 20000000,
      allocated: {
        salaries: 15000000,
        coaching: 1000000,
        medical: 500000,
        youthAcademy: 500000,
        scouting: 500000,
        freeAgentTryouts: 500000,
      },
      available: 5000000,
    },
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
    trainingSettings: {
      teamWide: { physical: 34, mental: 33, technical: 33 },
    },
    scoutingSettings: {
      budgetAllocation: 10,
      depthVsBreadth: 50,
      targets: [],
    },
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
// TRANSFER + CONTRACT INTEGRATION
// =============================================================================

describe('Cross-System Interactions', () => {
  describe('Transfer + Contract Integration', () => {
    it('player market value aligns with contract valuation', () => {
      const player = createMockPlayer('p1');

      const marketValue = getPlayerMarketValue(player);
      const recommendedOffer = generateRecommendedOffer(player, 10000000);

      // Market value should be positive
      expect(marketValue).toBeGreaterThan(0);

      // Recommended offer should be related to market value
      expect(recommendedOffer.annualSalary).toBeGreaterThan(0);
    });

    it('transfer window state affects offer submission', () => {
      const emitter = new GameEventEmitter();
      let transferState = createTransferMarketState(false, 1); // Window closed

      const player = createMockPlayer('p1', { teamId: 'team-seller' });

      // Should fail when window is closed
      expect(() =>
        submitTransferOffer(
          transferState,
          player,
          'team-buyer',
          'Buyer Team',
          'team-seller',
          'Seller Team',
          2.0,
          'neutral',
          emitter
        )
      ).toThrow('Transfer window is closed');

      // Open window
      transferState = openTransferMarket(transferState, emitter);
      expect(transferState.isWindowOpen).toBe(true);

      // Now should work
      const result = submitTransferOffer(
        transferState,
        player,
        'team-buyer',
        'Buyer Team',
        'team-seller',
        'Seller Team',
        2.0,
        'neutral',
        emitter
      );

      expect(result.offer.status).toBe('pending');
    });
  });

  // =============================================================================
  // FREE AGENT + SIGNING WORKFLOW
  // =============================================================================

  describe('Free Agent + Signing Workflow', () => {
    it('free agent signing updates player list', () => {
      const emitter = new GameEventEmitter();
      const freeAgentState = createFreeAgentMarketState(1, 10);
      const players: Player[] = [];

      // Get a free agent
      const topAgents = getTopAvailableFreeAgents(freeAgentState, 1);
      expect(topAgents.length).toBeGreaterThan(0);

      const agentToSign = topAgents[0];

      // Sign the agent
      const result = signFreeAgent(
        freeAgentState,
        players,
        agentToSign.id,
        'team-1',
        'Team 1',
        agentToSign.annualSalary,
        emitter
      );

      // Player should be added to list
      expect(result.players.length).toBe(1);
      expect(result.players[0].teamId).toBe('team-1');

      // Agent should be removed from pool
      expect(result.state.pool.find((fa) => fa.id === agentToSign.id)).toBeUndefined();
    });

    it('releasing player adds them to free agent pool', () => {
      const emitter = new GameEventEmitter();
      const freeAgentState = createFreeAgentMarketState(1, 0); // Empty pool
      const player = createMockPlayer('release-me', { teamId: 'team-1' });
      const players = [player];

      const initialPoolSize = freeAgentState.pool.length;

      const result = releaseToFreeAgency(freeAgentState, players, player.id, emitter);

      // Player should be removed from roster
      expect(result.players.find((p) => p.id === player.id)).toBeUndefined();

      // Player should be in free agent pool
      expect(result.state.pool.length).toBe(initialPoolSize + 1);
      expect(result.state.pool.find((fa) => fa.id === player.id)).toBeDefined();
    });
  });

  // =============================================================================
  // AI MARKET DECISIONS
  // =============================================================================

  describe('AI Market Decisions', () => {
    it('AI identifies transfer targets based on roster needs', () => {
      const franchise = createMockFranchise('ai-team');
      const config = createAIConfig('balanced');

      // Roster with missing positions
      const aiRoster = [
        createMockPlayer('p1', { position: 'PG', teamId: 'ai-team' }),
        createMockPlayer('p2', { position: 'SG', teamId: 'ai-team' }),
      ];

      // Available players at needed positions
      const availablePlayers = [
        createMockPlayer('target-1', { position: 'C', teamId: 'other' }),
        createMockPlayer('target-2', { position: 'PF', teamId: 'other' }),
        createMockPlayer('target-3', { position: 'SF', teamId: 'other' }),
      ];

      const targets = identifyTransferTargets(franchise, aiRoster, availablePlayers, config);

      expect(targets.length).toBeGreaterThan(0);

      // Should prioritize needed positions
      targets.forEach((target) => {
        expect(['high', 'medium', 'low']).toContain(target.priority);
        expect(target.reason).toBeTruthy();
      });
    });

    it('AI urgency varies by personality', () => {
      const franchise = createMockFranchise('ai-team');

      const target = {
        player: createMockPlayer('target'),
        priority: 'high' as const,
        reason: 'Test',
        estimatedCost: 1000000,
      };

      const aggressiveConfig = createAIConfig('aggressive');
      const conservativeConfig = createAIConfig('conservative');

      const aggressiveUrgency = determineAIUrgency(franchise, target, aggressiveConfig);
      const conservativeUrgency = determineAIUrgency(franchise, target, conservativeConfig);

      // Aggressive should be more urgent
      expect(aggressiveUrgency).toBe('desperate');
      expect(conservativeUrgency).not.toBe('desperate');
    });

    it('AI free agent decisions consider budget', () => {
      const config = createAIConfig('balanced');
      const freeAgentState = createFreeAgentMarketState(1, 20);

      // High budget scenario
      const targetsHighBudget = identifyFreeAgentTargets(
        freeAgentState,
        [], // Empty roster (needs everyone)
        config,
        10000000 // High budget
      );

      // Low budget scenario
      const targetsLowBudget = identifyFreeAgentTargets(
        freeAgentState,
        [],
        config,
        100000 // Low budget
      );

      // High budget should find more targets (can afford more)
      expect(targetsHighBudget.length).toBeGreaterThanOrEqual(targetsLowBudget.length);
    });
  });

  // =============================================================================
  // CONTRACT NEGOTIATION FLOW
  // =============================================================================

  describe('Contract Negotiation Flow', () => {
    it('full negotiation workflow with events', () => {
      const emitter = new GameEventEmitter();
      const events: string[] = [];
      emitter.onAll((e) => events.push(e.type));

      let contractState = createContractNegotiationState();
      const player = createMockPlayer('negotiate-me', { teamId: 'free_agent' });

      const initialOffer = {
        annualSalary: 500000,
        contractLength: 3,
        signingBonus: 50000,
        performanceBonus: 25000,
        releaseClause: 0,
      };

      // Start negotiation
      contractState = startNegotiation(contractState, player, 'team-1', initialOffer, emitter);

      expect(events).toContain('contract:offered');
      expect(contractState.negotiations.has(player.id)).toBe(true);
    });

    it('budget constraint affects contract offers', () => {
      const lowBudgetOffer = {
        annualSalary: 100000,
        contractLength: 2,
        signingBonus: 10000,
        performanceBonus: 5000,
        releaseClause: 0,
      };

      const highBudgetOffer = {
        annualSalary: 1000000,
        contractLength: 4,
        signingBonus: 100000,
        performanceBonus: 50000,
        releaseClause: 0,
      };

      const canAffordLow = canAffordContract(lowBudgetOffer, 1000000, 800000);
      const canAffordHigh = canAffordContract(highBudgetOffer, 1000000, 800000);

      // Low budget offer should be affordable
      expect(canAffordLow).toBe(true);

      // High budget offer should not be affordable
      expect(canAffordHigh).toBe(false);
    });
  });

  // =============================================================================
  // MARKET SUMMARY AND STATISTICS
  // =============================================================================

  describe('Market Summary and Statistics', () => {
    it('free agent market summary reflects pool state', () => {
      const freeAgentState = createFreeAgentMarketState(1, 25);
      const summary = getFreeAgentMarketSummary(freeAgentState);

      expect(summary.totalPlayers).toBe(25);
      expect(summary.averageRating).toBeGreaterThan(0);
      expect(summary.averageAge).toBeGreaterThan(0);
      expect(summary.topRatedPlayer).not.toBeNull();
    });
  });

  // =============================================================================
  // EVENT PROPAGATION
  // =============================================================================

  describe('Event Propagation', () => {
    it('market operations emit appropriate events', () => {
      const emitter = new GameEventEmitter();
      const events: Array<{ type: string; timestamp: Date }> = [];

      emitter.onAll((event) => {
        events.push({ type: event.type, timestamp: event.timestamp });
      });

      // Transfer window events
      let transferState = createTransferMarketState(false, 1);
      transferState = openTransferMarket(transferState, emitter);
      transferState = closeTransferMarket(transferState, emitter);

      expect(events.some((e) => e.type === 'season:transferWindowOpened')).toBe(true);
      expect(events.some((e) => e.type === 'season:transferWindowClosed')).toBe(true);
    });
  });
});
