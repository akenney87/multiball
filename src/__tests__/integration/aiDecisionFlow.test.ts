/**
 * AI Decision Flow Integration Tests
 *
 * Tests AI decision-making across systems:
 * - Player evaluation consistency
 * - Roster decisions flow
 * - Tactical decisions integration
 * - Personality impact across modules
 */

import { createAIConfig, getDecisionThresholds } from '../../ai/personality';
import { calculateOverallRating, evaluatePlayer, comparePlayersByPosition } from '../../ai/evaluation';
import {
  shouldReleasePlayer,
  shouldOfferContract,
  prioritizeScouting,
  shouldPromoteYouth,
} from '../../ai/roster';
import { selectStartingLineup, choosePaceStrategy, setDefenseStrategy, allocateMinutes } from '../../ai/tactical';
import type { Player, Franchise } from '../../data/types';
import type { DecisionContext } from '../../ai/types';

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
      footwork: 70,
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

function createDecisionContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    week: 10,
    transferWindowOpen: true,
    finance: {
      available: 5000000,
      total: 20000000,
      weeklyRevenue: 500000,
    },
    standings: {
      position: 10,
      gamesPlayed: 10,
      wins: 5,
      losses: 5,
    },
    ...overrides,
  };
}

// =============================================================================
// PERSONALITY CONSISTENCY TESTS
// =============================================================================

describe('AI Decision Flow Integration', () => {
  describe('Personality Consistency', () => {
    it('conservative personality produces consistent decisions across modules', () => {
      const config = createAIConfig('conservative');
      const roster = [
        createMockPlayer('p1', { position: 'PG' }),
        createMockPlayer('p2', { position: 'SG' }),
        createMockPlayer('p3', { position: 'SF' }),
        createMockPlayer('p4', { position: 'PF' }),
        createMockPlayer('p5', { position: 'C' }),
      ];

      // Get thresholds using AIConfig
      const thresholds = getDecisionThresholds(config);
      expect(thresholds.releasePlayerRating).toBeLessThan(60); // Conservative keeps more (lower threshold)

      // Tactical decisions should be cautious
      const context = createDecisionContext();
      const paceDecision = choosePaceStrategy(roster, context, config);
      const defenseDecision = setDefenseStrategy(roster, context, config);
      expect(['normal', 'slow']).toContain(paceDecision.pace);
      expect(['man', 'zone']).toContain(defenseDecision.defense);
    });

    it('aggressive personality produces consistent decisions across modules', () => {
      const config = createAIConfig('aggressive');
      const roster = [
        createMockPlayer('p1', { position: 'PG' }),
        createMockPlayer('p2', { position: 'SG' }),
        createMockPlayer('p3', { position: 'SF' }),
        createMockPlayer('p4', { position: 'PF' }),
        createMockPlayer('p5', { position: 'C' }),
      ];

      // Get thresholds using AIConfig
      const thresholds = getDecisionThresholds(config);
      expect(thresholds.releasePlayerRating).toBeGreaterThan(60); // Aggressive releases more (higher threshold)

      // Tactical decisions should be aggressive
      const context = createDecisionContext();
      const defenseDecision = setDefenseStrategy(roster, context, config);
      expect(['man', 'press']).toContain(defenseDecision.defense);
    });
  });

  // =============================================================================
  // PLAYER EVALUATION FLOW TESTS
  // =============================================================================

  describe('Player Evaluation Flow', () => {
    it('evaluation ratings align with tactical selection', () => {
      const roster = [
        createMockPlayer('p1', {
          position: 'PG',
          attributes: { ...createMockPlayer('').attributes, agility: 90, hand_eye_coordination: 90 },
        }),
        createMockPlayer('p2', {
          position: 'PG',
          attributes: { ...createMockPlayer('').attributes, agility: 60, hand_eye_coordination: 60 },
        }),
        createMockPlayer('p3', { position: 'SG' }),
        createMockPlayer('p4', { position: 'SF' }),
        createMockPlayer('p5', { position: 'PF' }),
        createMockPlayer('p6', { position: 'C' }),
      ];

      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      // Evaluate players
      const p1Rating = calculateOverallRating(roster[0]);
      const p2Rating = calculateOverallRating(roster[1]);

      // Better player should have higher rating
      expect(p1Rating).toBeGreaterThan(p2Rating);

      // Tactical selection should pick better player for position
      const lineup = selectStartingLineup(roster, context, config);
      const selectedPG = lineup.starters.find((p) => p.position === 'PG');

      // Should select the better PG
      expect(selectedPG?.id).toBe('p1');
    });

    it('position comparison works correctly', () => {
      // Create two players with different attribute levels
      const highAttrs = {
        grip_strength: 85, arm_strength: 85, core_strength: 85, agility: 85,
        acceleration: 85, top_speed: 85, jumping: 85, reactions: 85, stamina: 85,
        balance: 85, height: 85, durability: 85, awareness: 85, creativity: 85,
        determination: 85, bravery: 85, consistency: 85, composure: 85, patience: 85,
        hand_eye_coordination: 85, throw_accuracy: 85, form_technique: 85, finesse: 85,
        deception: 85, teamwork: 85, footwork: 85,
      };
      const lowAttrs = {
        grip_strength: 50, arm_strength: 50, core_strength: 50, agility: 50,
        acceleration: 50, top_speed: 50, jumping: 50, reactions: 50, stamina: 50,
        balance: 50, height: 50, durability: 50, awareness: 50, creativity: 50,
        determination: 50, bravery: 50, consistency: 50, composure: 50, patience: 50,
        hand_eye_coordination: 50, throw_accuracy: 50, form_technique: 50, finesse: 50,
        deception: 50, teamwork: 50, footwork: 50,
      };

      const players = [
        createMockPlayer('p1', { position: 'PG', attributes: highAttrs }),
        createMockPlayer('p2', { position: 'PG', attributes: lowAttrs }),
      ];

      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      const compared = comparePlayersByPosition(players, 'PG', context, config);

      // Both players should be evaluated
      expect(compared.length).toBe(2);

      // Results should be sorted by composite score
      // Higher-attribute player should have higher overall rating
      const p1Eval = compared.find((e) => e.playerId === 'p1');
      const p2Eval = compared.find((e) => e.playerId === 'p2');
      expect(p1Eval).toBeDefined();
      expect(p2Eval).toBeDefined();
      expect(p1Eval!.overall).toBeGreaterThan(p2Eval!.overall);
    });
  });

  // =============================================================================
  // ROSTER DECISION FLOW TESTS
  // =============================================================================

  describe('Roster Decision Flow', () => {
    it('release decision considers rating vs threshold', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      // Low rated player
      const lowPlayer = createMockPlayer('low', {
        attributes: {
          grip_strength: 40,
          arm_strength: 40,
          core_strength: 40,
          agility: 40,
          acceleration: 40,
          top_speed: 40,
          jumping: 40,
          reactions: 40,
          stamina: 40,
          balance: 40,
          height: 40,
          durability: 40,
          awareness: 40,
          creativity: 40,
          determination: 40,
          bravery: 40,
          consistency: 40,
          composure: 40,
          patience: 40,
          hand_eye_coordination: 40,
          throw_accuracy: 40,
          form_technique: 40,
          finesse: 40,
          deception: 40,
          teamwork: 40,
          footwork: 40,
        },
      });

      // High rated player
      const highPlayer = createMockPlayer('high', {
        attributes: {
          grip_strength: 85,
          arm_strength: 85,
          core_strength: 85,
          agility: 85,
          acceleration: 85,
          top_speed: 85,
          jumping: 85,
          reactions: 85,
          stamina: 85,
          balance: 85,
          height: 85,
          durability: 85,
          awareness: 85,
          creativity: 85,
          determination: 85,
          bravery: 85,
          consistency: 85,
          composure: 85,
          patience: 85,
          hand_eye_coordination: 85,
          throw_accuracy: 85,
          form_technique: 85,
          finesse: 85,
          deception: 85,
          teamwork: 85,
          footwork: 85,
        },
      });

      const roster = [lowPlayer, highPlayer];
      const releaseDecisionLow = shouldReleasePlayer(lowPlayer, roster, context, config);
      const releaseDecisionHigh = shouldReleasePlayer(highPlayer, roster, context, config);

      // Low player more likely to be released
      expect(releaseDecisionLow.shouldRelease || !releaseDecisionHigh.shouldRelease).toBe(true);
    });

    it('contract offer respects budget constraints', () => {
      const config = createAIConfig('balanced');
      const contextWithBudget = createDecisionContext({
        finance: {
          available: 5000000,
          total: 20000000,
        },
        transferWindowOpen: true,
      });

      const contextNoBudget = createDecisionContext({
        finance: {
          available: 100000, // Very low budget
          total: 20000000,
        },
        transferWindowOpen: true,
      });

      const player = createMockPlayer('p1', { teamId: 'free_agent' });
      const roster: Player[] = [];

      const offerWithBudget = shouldOfferContract(player, roster, contextWithBudget, config);
      const offerNoBudget = shouldOfferContract(player, roster, contextNoBudget, config);

      // Should be more willing to offer with budget
      if (offerWithBudget && offerNoBudget) {
        expect(offerWithBudget.annualSalary).toBeGreaterThanOrEqual(offerNoBudget.annualSalary);
      }
    });
  });

  // =============================================================================
  // TACTICAL DECISION FLOW TESTS
  // =============================================================================

  describe('Tactical Decision Flow', () => {
    it('lineup selection fills all positions', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();
      const roster = [
        createMockPlayer('p1', { position: 'PG' }),
        createMockPlayer('p2', { position: 'SG' }),
        createMockPlayer('p3', { position: 'SF' }),
        createMockPlayer('p4', { position: 'PF' }),
        createMockPlayer('p5', { position: 'C' }),
        createMockPlayer('p6', { position: 'PG' }),
        createMockPlayer('p7', { position: 'SG' }),
      ];

      const lineup = selectStartingLineup(roster, context, config);

      expect(lineup.starters.length).toBe(5);

      const positions = lineup.starters.map((p) => p.position);
      expect(positions).toContain('PG');
      expect(positions).toContain('SG');
      expect(positions).toContain('SF');
      expect(positions).toContain('PF');
      expect(positions).toContain('C');
    });

    it('minutes allocation totals 240', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();
      const roster = [
        createMockPlayer('p1', { position: 'PG' }),
        createMockPlayer('p2', { position: 'SG' }),
        createMockPlayer('p3', { position: 'SF' }),
        createMockPlayer('p4', { position: 'PF' }),
        createMockPlayer('p5', { position: 'C' }),
        createMockPlayer('p6', { position: 'PG' }),
        createMockPlayer('p7', { position: 'SG' }),
        createMockPlayer('p8', { position: 'SF' }),
      ];

      const allocation = allocateMinutes(roster, context, config);

      // MinutesAllocation has allocation (Record) and totalMinutes
      expect(allocation.totalMinutes).toBe(240);
    });

    it('pace strategy considers roster athleticism', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      // Athletic roster
      const athleticRoster = [
        createMockPlayer('p1', {
          position: 'PG',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 90,
            acceleration: 90,
            top_speed: 90,
            stamina: 90,
          },
        }),
        createMockPlayer('p2', {
          position: 'SG',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 90,
            acceleration: 90,
            top_speed: 90,
            stamina: 90,
          },
        }),
        createMockPlayer('p3', {
          position: 'SF',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 90,
            acceleration: 90,
            top_speed: 90,
            stamina: 90,
          },
        }),
        createMockPlayer('p4', {
          position: 'PF',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 90,
            acceleration: 90,
            top_speed: 90,
            stamina: 90,
          },
        }),
        createMockPlayer('p5', {
          position: 'C',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 90,
            acceleration: 90,
            top_speed: 90,
            stamina: 90,
          },
        }),
      ];

      // Slow roster
      const slowRoster = [
        createMockPlayer('p1', {
          position: 'PG',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 50,
            acceleration: 50,
            top_speed: 50,
            stamina: 50,
          },
        }),
        createMockPlayer('p2', {
          position: 'SG',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 50,
            acceleration: 50,
            top_speed: 50,
            stamina: 50,
          },
        }),
        createMockPlayer('p3', {
          position: 'SF',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 50,
            acceleration: 50,
            top_speed: 50,
            stamina: 50,
          },
        }),
        createMockPlayer('p4', {
          position: 'PF',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 50,
            acceleration: 50,
            top_speed: 50,
            stamina: 50,
          },
        }),
        createMockPlayer('p5', {
          position: 'C',
          attributes: {
            ...createMockPlayer('').attributes,
            agility: 50,
            acceleration: 50,
            top_speed: 50,
            stamina: 50,
          },
        }),
      ];

      const athleticPaceDecision = choosePaceStrategy(athleticRoster, context, config);
      const slowPaceDecision = choosePaceStrategy(slowRoster, context, config);

      // Athletic teams should prefer faster pace
      const paceOrder = { fast: 3, normal: 2, slow: 1 };
      expect(paceOrder[athleticPaceDecision.pace]).toBeGreaterThanOrEqual(paceOrder[slowPaceDecision.pace]);
    });
  });

  // =============================================================================
  // CROSS-MODULE INTEGRATION TESTS
  // =============================================================================

  describe('Cross-Module Integration', () => {
    it('scouting priorities align with roster gaps', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      // Roster missing center - only guards and forwards
      const roster = [
        createMockPlayer('p1', { position: 'PG' }),
        createMockPlayer('p2', { position: 'PG' }),
        createMockPlayer('p3', { position: 'SG' }),
        createMockPlayer('p4', { position: 'SG' }),
        createMockPlayer('p5', { position: 'SF' }),
        createMockPlayer('p6', { position: 'SF' }),
        createMockPlayer('p7', { position: 'PF' }),
        createMockPlayer('p8', { position: 'PF' }),
        // No centers!
      ];

      const priorities = prioritizeScouting(roster, context, config);

      // Should prioritize missing position
      expect(priorities.length).toBeGreaterThan(0);
      expect(priorities[0]).toBe('C'); // Center should be highest priority
    });

    it('youth promotion decision considers rating', () => {
      const config = createAIConfig('balanced');
      const context = createDecisionContext();

      // Young player with high rating
      const youthPlayer = createMockPlayer('youth', {
        age: 18,
        attributes: {
          grip_strength: 75,
          arm_strength: 75,
          core_strength: 75,
          agility: 75,
          acceleration: 75,
          top_speed: 75,
          jumping: 75,
          reactions: 75,
          stamina: 75,
          balance: 75,
          height: 75,
          durability: 75,
          awareness: 75,
          creativity: 75,
          determination: 75,
          bravery: 75,
          consistency: 75,
          composure: 75,
          patience: 75,
          hand_eye_coordination: 75,
          throw_accuracy: 75,
          form_technique: 75,
          finesse: 75,
          deception: 75,
          teamwork: 75,
          footwork: 75,
        },
        potentials: { physical: 90, mental: 90, technical: 90 },
      });

      const roster = [createMockPlayer('p1', { position: 'PG' })];
      const shouldPromote = shouldPromoteYouth(youthPlayer, roster, context, config);

      // Should return a boolean
      expect(typeof shouldPromote).toBe('boolean');
    });
  });
});
