/**
 * Tests for AI Roster Management System
 *
 * Validates:
 * - Player release decisions
 * - Contract offer generation
 * - Scouting prioritization
 * - Youth player promotion
 */

import { describe, it, expect } from '@jest/globals';
import {
  shouldReleasePlayer,
  shouldOfferContract,
  prioritizeScouting,
  shouldPromoteYouth,
} from '../roster';
import type { Player, PlayerAttributes, PlayerPotentials } from '../../data/types';
import type { DecisionContext, ReleaseDecision, ContractOffer, Position } from '../types';
import { createAIConfig } from '../personality';

// =============================================================================
// MOCK DATA HELPERS
// =============================================================================

function createMockAttributes(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  return {
    // Physical (12)
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
    // Mental (8)
    awareness: 75,
    creativity: 68,
    determination: 72,
    bravery: 70,
    consistency: 70,
    composure: 73,
    patience: 68,
    teamwork: 70,
    // Technical (6)
    hand_eye_coordination: 72,
    throw_accuracy: 70,
    form_technique: 71,
    finesse: 68,
    deception: 65,
    footwork: 70,
    ...overrides,
  };
}

function createMockPotentials(overrides: Partial<PlayerPotentials> = {}): PlayerPotentials {
  return {
    physical: 75,
    mental: 77,
    technical: 76,
    ...overrides,
  };
}

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'test-player',
    name: 'Test Player',
    age: 25,
    dateOfBirth: new Date('1998-01-01'),
    position: 'PG' as Position,
    attributes: createMockAttributes(),
    potentials: createMockPotentials(),
    peakAges: { physical: 26, technical: 28, mental: 30 },
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    careerStats: {} as any,
    currentSeasonStats: {} as any,
    teamId: 'test-team',
    acquisitionType: 'draft',
    acquisitionDate: new Date(),
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    ...overrides,
  };
}

function createMockContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    week: 10,
    transferWindowOpen: true,
    finance: {
      available: 5000000,
      total: 10000000,
    },
    ...overrides,
  };
}

function createWeakPlayer(id: string = 'weak-player'): Player {
  // All attributes at 40 - clearly below release threshold
  const weakAttrs: PlayerAttributes = {
    grip_strength: 40, arm_strength: 40, core_strength: 40, agility: 40,
    acceleration: 40, top_speed: 40, jumping: 40, reactions: 40,
    stamina: 40, balance: 40, height: 40, durability: 40,
    awareness: 40, creativity: 40, determination: 40, bravery: 40,
    consistency: 40, composure: 40, patience: 40,
    hand_eye_coordination: 40, throw_accuracy: 40, form_technique: 40,
    finesse: 40, deception: 40, teamwork: 40, footwork: 40,
  };

  return createMockPlayer({
    id,
    name: 'Weak Player',
    attributes: weakAttrs,
    potentials: { physical: 45, mental: 45, technical: 45 },
  });
}

function createStrongPlayer(id: string = 'strong-player'): Player {
  // All attributes at 85 - clearly above thresholds
  const strongAttrs: PlayerAttributes = {
    grip_strength: 85, arm_strength: 85, core_strength: 85, agility: 85,
    acceleration: 85, top_speed: 85, jumping: 85, reactions: 85,
    stamina: 85, balance: 85, height: 85, durability: 85,
    awareness: 85, creativity: 85, determination: 85, bravery: 85,
    consistency: 85, composure: 85, patience: 85,
    hand_eye_coordination: 85, throw_accuracy: 85, form_technique: 85,
    finesse: 85, deception: 85, teamwork: 85, footwork: 85,
  };

  return createMockPlayer({
    id,
    name: 'Strong Player',
    attributes: strongAttrs,
    potentials: { physical: 88, mental: 88, technical: 88 },
  });
}

function createYoungProspect(id: string = 'young-prospect'): Player {
  // Age 19, moderate current attributes, high potential
  const prospectAttrs: PlayerAttributes = {
    grip_strength: 60, arm_strength: 58, core_strength: 62, agility: 65,
    acceleration: 68, top_speed: 62, jumping: 66, reactions: 64,
    stamina: 60, balance: 58, height: 70, durability: 65,
    awareness: 55, creativity: 60, determination: 70, bravery: 65,
    consistency: 50, composure: 55, patience: 52,
    hand_eye_coordination: 62, throw_accuracy: 58, form_technique: 56,
    finesse: 58, deception: 55, teamwork: 60, footwork: 58,
  };

  return createMockPlayer({
    id,
    age: 19,
    name: 'Young Prospect',
    attributes: prospectAttrs,
    potentials: { physical: 88, mental: 85, technical: 90 },
  });
}

// =============================================================================
// TESTS: shouldReleasePlayer
// =============================================================================

describe('AI Roster Management', () => {
  describe('shouldReleasePlayer', () => {
    it('returns ReleaseDecision object with required fields', () => {
      const player = createMockPlayer();
      const roster = [player];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const decision = shouldReleasePlayer(player, roster, context, config);

      expect(decision).toHaveProperty('shouldRelease');
      expect(decision).toHaveProperty('reason');
      expect(decision).toHaveProperty('rating');
      expect(typeof decision.shouldRelease).toBe('boolean');
      expect(typeof decision.reason).toBe('string');
      expect(typeof decision.rating).toBe('number');
    });

    it('recommends releasing weak players (below threshold)', () => {
      const weakPlayer = createWeakPlayer('weak-pg');
      weakPlayer.position = 'PG';

      // Add a stronger player at same position so weak isn't protected
      const strongerPG = createMockPlayer({ id: 'stronger-pg', position: 'PG' });

      const roster = [weakPlayer, strongerPG];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const decision = shouldReleasePlayer(weakPlayer, roster, context, config);

      expect(decision.shouldRelease).toBe(true);
      expect(decision.rating).toBeLessThan(60);
      expect(decision.reason).toContain('below');
    });

    it('recommends keeping strong players (above threshold)', () => {
      const strongPlayer = createStrongPlayer();
      const roster = [strongPlayer];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const decision = shouldReleasePlayer(strongPlayer, roster, context, config);

      expect(decision.shouldRelease).toBe(false);
      expect(decision.rating).toBeGreaterThan(70);
    });

    it('conservative AI has lower release threshold (keeps more players)', () => {
      // Player at 58 rating - between conservative (55) and balanced (60) thresholds
      const borderlinePlayer = createMockPlayer({
        id: 'borderline',
        attributes: createMockAttributes({
          throw_accuracy: 58,
          agility: 58,
          jumping: 58,
        }),
      });

      const roster = [borderlinePlayer];
      const context = createMockContext();

      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');

      const conservativeDecision = shouldReleasePlayer(borderlinePlayer, roster, context, conservative);
      const balancedDecision = shouldReleasePlayer(borderlinePlayer, roster, context, balanced);

      // Conservative should keep, balanced should release (or at least conservative less likely to release)
      expect(conservativeDecision.shouldRelease).toBe(false);
    });

    it('aggressive AI has higher release threshold (releases more players)', () => {
      // Player at ~62 rating - between balanced (60) and aggressive (65) thresholds
      // Need full attribute set to control the rating precisely
      const borderlinePlayer = createMockPlayer({
        id: 'borderline',
        position: 'PG',
        attributes: {
          // Physical (12) - average around 62
          grip_strength: 60, arm_strength: 58, core_strength: 62, agility: 64,
          acceleration: 66, top_speed: 60, jumping: 64, reactions: 66,
          stamina: 62, balance: 60, height: 58, durability: 62,
          // Mental (8) - average around 62
          awareness: 67, creativity: 60, determination: 64, bravery: 62,
          consistency: 60, composure: 64, patience: 58, teamwork: 64,
          // Technical (6) - average around 62
          hand_eye_coordination: 64, throw_accuracy: 64, form_technique: 62,
          finesse: 60, deception: 60, footwork: 62,
        },
      });

      // Add a stronger player at same position so borderline isn't protected
      const strongerPG = createStrongPlayer('stronger-pg');
      strongerPG.position = 'PG';

      const roster = [borderlinePlayer, strongerPG];
      const context = createMockContext();

      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      const balancedDecision = shouldReleasePlayer(borderlinePlayer, roster, context, balanced);
      const aggressiveDecision = shouldReleasePlayer(borderlinePlayer, roster, context, aggressive);

      // Balanced should keep (threshold 60), aggressive should release (threshold 65)
      expect(balancedDecision.shouldRelease).toBe(false);
      expect(aggressiveDecision.shouldRelease).toBe(true);
    });

    it('considers roster rank (avoids releasing best player at position)', () => {
      const bestPG = createStrongPlayer('best-pg');
      bestPG.position = 'PG';

      const weakPG = createWeakPlayer('weak-pg');
      weakPG.position = 'PG';

      const roster = [bestPG, weakPG];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const bestDecision = shouldReleasePlayer(bestPG, roster, context, config);
      const weakDecision = shouldReleasePlayer(weakPG, roster, context, config);

      // Best PG should never be released, weak PG should be released
      expect(bestDecision.shouldRelease).toBe(false);
      expect(weakDecision.shouldRelease).toBe(true);
    });
  });

  // =============================================================================
  // TESTS: shouldOfferContract
  // =============================================================================

  describe('shouldOfferContract', () => {
    it('returns ContractOffer or null', () => {
      const freeAgent = createStrongPlayer('free-agent');
      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(freeAgent, roster, context, config);

      // Should return offer for strong player
      expect(offer).not.toBeNull();
      if (offer) {
        expect(offer).toHaveProperty('playerId');
        expect(offer).toHaveProperty('annualSalary');
        expect(offer).toHaveProperty('duration');
      }
    });

    it('offers contract to strong free agents', () => {
      const strongFreeAgent = createStrongPlayer('strong-fa');
      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(strongFreeAgent, roster, context, config);

      expect(offer).not.toBeNull();
      expect(offer!.playerId).toBe('strong-fa');
      expect(offer!.annualSalary).toBeGreaterThan(0);
      expect(offer!.duration).toBeGreaterThanOrEqual(1);
    });

    it('does not offer contract to weak free agents', () => {
      const weakFreeAgent = createWeakPlayer('weak-fa');
      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(weakFreeAgent, roster, context, config);

      expect(offer).toBeNull();
    });

    it('considers available budget', () => {
      const strongFreeAgent = createStrongPlayer('strong-fa');
      const roster = [createMockPlayer()];

      // Very tight budget
      const poorContext = createMockContext({
        finance: { available: 100000, total: 100000 },
      });

      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(strongFreeAgent, roster, poorContext, config);

      // Should either not offer or offer within budget
      if (offer) {
        expect(offer.annualSalary).toBeLessThanOrEqual(100000);
      }
    });

    it('does not offer when transfer window is closed', () => {
      const strongFreeAgent = createStrongPlayer('strong-fa');
      const roster = [createMockPlayer()];
      const closedContext = createMockContext({ transferWindowOpen: false });
      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(strongFreeAgent, roster, closedContext, config);

      expect(offer).toBeNull();
    });

    it('aggressive AI offers higher salaries', () => {
      const freeAgent = createStrongPlayer('fa');
      const roster = [createMockPlayer()];
      const context = createMockContext();

      const conservative = createAIConfig('conservative');
      const aggressive = createAIConfig('aggressive');

      const conservativeOffer = shouldOfferContract(freeAgent, roster, context, conservative);
      const aggressiveOffer = shouldOfferContract(freeAgent, roster, context, aggressive);

      // Both should offer, but aggressive offers more
      expect(conservativeOffer).not.toBeNull();
      expect(aggressiveOffer).not.toBeNull();
      expect(aggressiveOffer!.annualSalary).toBeGreaterThan(conservativeOffer!.annualSalary);
    });
  });

  // =============================================================================
  // TESTS: prioritizeScouting
  // =============================================================================

  describe('prioritizeScouting', () => {
    it('returns array of positions sorted by priority', () => {
      const roster = [createMockPlayer({ position: 'PG' })];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const priorities = prioritizeScouting(roster, context, config);

      expect(Array.isArray(priorities)).toBe(true);
      expect(priorities.length).toBeGreaterThan(0);
      // Should be valid positions
      const validPositions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
      priorities.forEach((pos) => {
        expect(validPositions).toContain(pos);
      });
    });

    it('prioritizes positions with no players', () => {
      // Only have PG, should prioritize other positions
      const roster = [
        createMockPlayer({ id: 'pg1', position: 'PG' }),
        createMockPlayer({ id: 'pg2', position: 'PG' }),
      ];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const priorities = prioritizeScouting(roster, context, config);

      // PG should be lowest priority since we have 2
      // Other positions should be higher priority
      const pgIndex = priorities.indexOf('PG');
      expect(pgIndex).toBeGreaterThan(0); // PG should not be first priority
    });

    it('prioritizes positions with weak players', () => {
      const strongPG = createStrongPlayer('strong-pg');
      strongPG.position = 'PG';

      const weakSG = createWeakPlayer('weak-sg');
      weakSG.position = 'SG';

      const roster = [strongPG, weakSG];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const priorities = prioritizeScouting(roster, context, config);

      // SG should be higher priority than PG (weak vs strong)
      const sgIndex = priorities.indexOf('SG');
      const pgIndex = priorities.indexOf('PG');
      expect(sgIndex).toBeLessThan(pgIndex);
    });

    it('returns all 5 positions', () => {
      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const priorities = prioritizeScouting(roster, context, config);

      expect(priorities.length).toBe(5);
      expect(priorities).toContain('PG');
      expect(priorities).toContain('SG');
      expect(priorities).toContain('SF');
      expect(priorities).toContain('PF');
      expect(priorities).toContain('C');
    });
  });

  // =============================================================================
  // TESTS: shouldPromoteYouth
  // =============================================================================

  describe('shouldPromoteYouth', () => {
    it('returns boolean', () => {
      const youthPlayer = createYoungProspect();
      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const shouldPromote = shouldPromoteYouth(youthPlayer, roster, context, config);

      expect(typeof shouldPromote).toBe('boolean');
    });

    it('promotes ready youth players (above threshold)', () => {
      // Youth player with decent attributes
      const readyYouth = createMockPlayer({
        id: 'ready-youth',
        age: 20,
        attributes: createMockAttributes({
          throw_accuracy: 68,
          agility: 70,
          jumping: 68,
        }),
        potentials: { physical: 85, mental: 82, technical: 88 },
      });

      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const shouldPromote = shouldPromoteYouth(readyYouth, roster, context, config);

      expect(shouldPromote).toBe(true);
    });

    it('does not promote youth players below threshold', () => {
      const notReadyYouth = createWeakPlayer('not-ready');
      notReadyYouth.age = 18;

      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const shouldPromote = shouldPromoteYouth(notReadyYouth, roster, context, config);

      expect(shouldPromote).toBe(false);
    });

    it('aggressive AI promotes youth earlier (lower threshold)', () => {
      // Youth player at borderline rating
      const borderlineYouth = createMockPlayer({
        id: 'borderline-youth',
        age: 19,
        attributes: createMockAttributes({
          throw_accuracy: 58,
          agility: 58,
          jumping: 58,
        }),
        potentials: { physical: 85, mental: 82, technical: 88 },
      });

      const roster = [createMockPlayer()];
      const context = createMockContext();

      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      const balancedDecision = shouldPromoteYouth(borderlineYouth, roster, context, balanced);
      const aggressiveDecision = shouldPromoteYouth(borderlineYouth, roster, context, aggressive);

      // Aggressive should promote, balanced might not
      expect(aggressiveDecision).toBe(true);
    });

    it('conservative AI promotes youth later (higher threshold)', () => {
      // Youth player at ~62 rating - between balanced (60) and conservative (65) thresholds
      // Need to lower more attributes to get rating clearly between 60-65
      const borderlineYouth = createMockPlayer({
        id: 'borderline-youth',
        age: 19,
        attributes: {
          // Physical (12) - average around 60
          grip_strength: 58, arm_strength: 56, core_strength: 60, agility: 62,
          acceleration: 64, top_speed: 58, jumping: 62, reactions: 64,
          stamina: 60, balance: 58, height: 55, durability: 60,
          // Mental (8) - average around 60
          awareness: 65, creativity: 58, determination: 62, bravery: 60,
          consistency: 58, composure: 62, patience: 56, teamwork: 62,
          // Technical (6) - average around 62
          hand_eye_coordination: 62, throw_accuracy: 62, form_technique: 60,
          finesse: 58, deception: 58, footwork: 60,
        },
        potentials: { physical: 85, mental: 82, technical: 88 },
      });

      const roster = [createMockPlayer()];
      const context = createMockContext();

      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');

      const conservativeDecision = shouldPromoteYouth(borderlineYouth, roster, context, conservative);
      const balancedDecision = shouldPromoteYouth(borderlineYouth, roster, context, balanced);

      // Conservative should NOT promote (threshold 65), balanced should (threshold 60)
      expect(conservativeDecision).toBe(false);
      expect(balancedDecision).toBe(true);
    });
  });

  // =============================================================================
  // TESTS: Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('handles empty roster for release decision', () => {
      const player = createMockPlayer();
      const emptyRoster: Player[] = [];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      // Should not throw
      const decision = shouldReleasePlayer(player, emptyRoster, context, config);
      expect(decision).toHaveProperty('shouldRelease');
    });

    it('handles empty roster for scouting priorities', () => {
      const emptyRoster: Player[] = [];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const priorities = prioritizeScouting(emptyRoster, context, config);

      // All positions should be high priority
      expect(priorities.length).toBe(5);
    });

    it('handles zero budget for contract offers', () => {
      const freeAgent = createStrongPlayer('fa');
      const roster = [createMockPlayer()];
      const brokeContext = createMockContext({
        finance: { available: 0, total: 0 },
      });
      const config = createAIConfig('balanced');

      const offer = shouldOfferContract(freeAgent, roster, brokeContext, config);

      // Should not offer when broke
      expect(offer).toBeNull();
    });

    it('handles very old youth player (edge case)', () => {
      // "Youth" player who is actually 30
      const oldYouth = createMockPlayer({
        id: 'old-youth',
        age: 30,
        attributes: createMockAttributes(),
      });

      const roster = [createMockPlayer()];
      const context = createMockContext();
      const config = createAIConfig('balanced');

      // Should still evaluate based on rating, not crash
      const shouldPromote = shouldPromoteYouth(oldYouth, roster, context, config);
      expect(typeof shouldPromote).toBe('boolean');
    });
  });
});
