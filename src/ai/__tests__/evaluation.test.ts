/**
 * Tests for AI Player Evaluation System
 *
 * Validates:
 * - Player rating calculation
 * - Position-based comparison
 * - Age and potential factors
 * - Contract value considerations
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluatePlayer,
  comparePlayersByPosition,
  calculateOverallRating,
  calculateAgeFactor,
  calculatePotentialFactor,
} from '../evaluation';
import type { Player, PlayerAttributes, PlayerPotentials } from '../../data/types';
import type { DecisionContext, PlayerEvaluation } from '../types';
import { createAIConfig } from '../personality';

// Helper to create mock player
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  const baseAttributes: PlayerAttributes = {
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
  };

  // Default potentials: slight upside (~5 points) for prime-age player
  const basePotentials: PlayerPotentials = {
    physical: 75,
    mental: 77,
    technical: 76,
  };

  return {
    id: 'test-player',
    name: 'Test Player',
    age: 25,
    dateOfBirth: new Date('1998-01-01'),
    position: 'PG',
    attributes: baseAttributes,
    potentials: basePotentials,
    peakAges: {} as any,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: {} as any,
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

// Helper to create mock context
function createMockContext(): DecisionContext {
  return {
    week: 10,
    transferWindowOpen: true,
    finance: {
      available: 5000000,
      total: 10000000,
    },
  };
}

describe('AI Player Evaluation System', () => {
  describe('calculateOverallRating', () => {
    it('calculates overall rating from player attributes', () => {
      const player = createMockPlayer();
      const rating = calculateOverallRating(player);

      expect(rating).toBeGreaterThanOrEqual(0);
      expect(rating).toBeLessThanOrEqual(100);
      expect(typeof rating).toBe('number');
    });

    it('returns higher rating for better players', () => {
      const averagePlayer = createMockPlayer({
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 60,
          agility: 60,
          jumping: 60,
        } as any,
      });

      const elitePlayer = createMockPlayer({
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 90,
          agility: 90,
          jumping: 90,
        } as any,
      });

      const averageRating = calculateOverallRating(averagePlayer);
      const eliteRating = calculateOverallRating(elitePlayer);

      expect(eliteRating).toBeGreaterThan(averageRating);
    });

    it('uses weighted attribute system', () => {
      const player = createMockPlayer();
      const rating = calculateOverallRating(player);

      // Rating should be reasonable average of attributes (not just simple mean)
      const allAttributeValues = Object.values(player.attributes);
      const simpleAverage =
        allAttributeValues.reduce((sum, val) => sum + val, 0) / allAttributeValues.length;

      // Should be close to simple average but not exactly (due to weighting)
      expect(Math.abs(rating - simpleAverage)).toBeLessThan(10);
    });
  });

  describe('calculateAgeFactor', () => {
    it('returns 100 for players in prime (25-28)', () => {
      const primeAge25 = calculateAgeFactor(25);
      const primeAge28 = calculateAgeFactor(28);

      expect(primeAge25).toBe(100);
      expect(primeAge28).toBe(100);
    });

    it('penalizes very young players (< 21)', () => {
      const age18 = calculateAgeFactor(18);
      const age25 = calculateAgeFactor(25);

      expect(age18).toBeLessThan(age25);
      expect(age18).toBeGreaterThan(50); // Still has value
    });

    it('penalizes older players (> 32)', () => {
      const age34 = calculateAgeFactor(34);
      const age25 = calculateAgeFactor(25);

      expect(age34).toBeLessThan(age25);
      expect(age34).toBeGreaterThan(50); // Still has value
    });

    it('returns factor between 0-100', () => {
      const ages = [18, 21, 25, 28, 32, 36, 40];

      ages.forEach((age) => {
        const factor = calculateAgeFactor(age);
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculatePotentialFactor', () => {
    it('returns 0 when player at ceiling', () => {
      const player = createMockPlayer({
        potentials: {
          physical: 70,  // Matches base average
          mental: 71,
          technical: 70,
        },
      });

      const factor = calculatePotentialFactor(player);
      expect(factor).toBeLessThan(5); // Minimal upside
    });

    it('returns positive value when player has growth room', () => {
      const player = createMockPlayer({
        potentials: {
          physical: 85,  // ~15 point upside
          mental: 87,
          technical: 86,
        },
      });

      const factor = calculatePotentialFactor(player);
      expect(factor).toBeGreaterThan(20); // Significant upside
    });

    it('returns higher value for higher potential gap', () => {
      const smallUpside = createMockPlayer({
        potentials: {
          physical: 75,  // Small gap
          mental: 76,
          technical: 75,
        },
      });

      const largeUpside = createMockPlayer({
        potentials: {
          physical: 90,  // Large gap
          mental: 92,
          technical: 91,
        },
      });

      const smallFactor = calculatePotentialFactor(smallUpside);
      const largeFactor = calculatePotentialFactor(largeUpside);

      expect(largeFactor).toBeGreaterThan(smallFactor);
    });

    it('returns factor between 0-100', () => {
      const player = createMockPlayer();
      const factor = calculatePotentialFactor(player);

      expect(factor).toBeGreaterThanOrEqual(0);
      expect(factor).toBeLessThanOrEqual(100);
    });
  });

  describe('evaluatePlayer', () => {
    it('returns complete evaluation for player', () => {
      const player = createMockPlayer();
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(player, context, config);

      expect(evaluation).toHaveProperty('playerId');
      expect(evaluation).toHaveProperty('overall');
      expect(evaluation).toHaveProperty('positionFit');
      expect(evaluation).toHaveProperty('ageFactor');
      expect(evaluation).toHaveProperty('potential');
      expect(evaluation).toHaveProperty('valueFactor');
      expect(evaluation).toHaveProperty('compositeScore');
    });

    it('sets playerId correctly', () => {
      const player = createMockPlayer({ id: 'test-123' });
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(player, context, config);

      expect(evaluation.playerId).toBe('test-123');
    });

    it('calculates overall rating', () => {
      const player = createMockPlayer();
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(player, context, config);

      expect(evaluation.overall).toBeGreaterThanOrEqual(0);
      expect(evaluation.overall).toBeLessThanOrEqual(100);
    });

    it('calculates position fit (100 for exact match)', () => {
      const pgPlayer = createMockPlayer({ position: 'PG' });
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(pgPlayer, context, config);

      // Week 1: Simple 100 for exact match
      expect(evaluation.positionFit).toBe(100);
    });

    it('calculates age factor', () => {
      const youngPlayer = createMockPlayer({ age: 22 });
      const primePlayer = createMockPlayer({ age: 27 });
      const oldPlayer = createMockPlayer({ age: 34 });

      const context = createMockContext();
      const config = createAIConfig('balanced');

      const youngEval = evaluatePlayer(youngPlayer, context, config);
      const primeEval = evaluatePlayer(primePlayer, context, config);
      const oldEval = evaluatePlayer(oldPlayer, context, config);

      expect(primeEval.ageFactor).toBeGreaterThanOrEqual(youngEval.ageFactor);
      expect(primeEval.ageFactor).toBeGreaterThan(oldEval.ageFactor);
    });

    it('calculates composite score as weighted average', () => {
      const player = createMockPlayer();
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(player, context, config);

      // Composite should be in 0-100 range
      expect(evaluation.compositeScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.compositeScore).toBeLessThanOrEqual(100);

      // Should be influenced by overall rating
      expect(Math.abs(evaluation.compositeScore - evaluation.overall)).toBeLessThan(30);
    });

    it('conservative AI values proven performance (older players)', () => {
      // Young player: high potential, lower current rating
      const youngPlayer = createMockPlayer({
        age: 21,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 65,
          agility: 64,
          hand_eye_coordination: 66,
        } as any,
        potentials: {
          physical: 85,
          mental: 82,
          technical: 88,
        }, // High upside
      });

      // Veteran: proven performance, at ceiling
      const veteran = createMockPlayer({
        age: 29,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 78,
          agility: 76,
          hand_eye_coordination: 75,
        } as any,
        potentials: {
          physical: 76,
          mental: 75,
          technical: 77,
        }, // At ceiling
      });

      const context = createMockContext();
      const conservative = createAIConfig('conservative');

      const youngEval = evaluatePlayer(youngPlayer, context, conservative);
      const veteranEval = evaluatePlayer(veteran, context, conservative);

      // Conservative should prefer veteran (proven performance over potential)
      expect(veteranEval.compositeScore).toBeGreaterThan(youngEval.compositeScore);
    });

    it('aggressive AI values potential (younger players)', () => {
      // Young player: high potential, lower current rating
      const youngPlayer = createMockPlayer({
        age: 21,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 65,
          agility: 64,
          hand_eye_coordination: 66,
        } as any,
        potentials: {
          physical: 85,
          mental: 82,
          technical: 88,
        }, // High upside
      });

      // Veteran: proven performance, at ceiling
      const veteran = createMockPlayer({
        age: 29,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 78,
          agility: 76,
          hand_eye_coordination: 75,
        } as any,
        potentials: {
          physical: 76,
          mental: 75,
          technical: 77,
        }, // At ceiling
      });

      const context = createMockContext();
      const aggressive = createAIConfig('aggressive');

      const youngEval = evaluatePlayer(youngPlayer, context, aggressive);
      const veteranEval = evaluatePlayer(veteran, context, aggressive);

      // Aggressive should prefer young player (potential over proven performance)
      expect(youngEval.compositeScore).toBeGreaterThan(veteranEval.compositeScore);
    });
  });

  describe('comparePlayersByPosition', () => {
    it('returns evaluations for all players', () => {
      const players = [
        createMockPlayer({ id: 'player-1', position: 'PG' }),
        createMockPlayer({ id: 'player-2', position: 'PG' }),
        createMockPlayer({ id: 'player-3', position: 'PG' }),
      ];

      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluations = comparePlayersByPosition(players, 'PG', context, config);

      expect(evaluations.length).toBe(3);
      expect(evaluations[0].playerId).toBe('player-1');
      expect(evaluations[1].playerId).toBe('player-2');
      expect(evaluations[2].playerId).toBe('player-3');
    });

    it('sorts players by composite score (highest first)', () => {
      // Create complete attribute objects to avoid spread issues
      const weakAttrs: PlayerAttributes = {
        grip_strength: 70, arm_strength: 68, core_strength: 72, agility: 50,
        acceleration: 74, top_speed: 68, jumping: 50, reactions: 50,
        stamina: 70, balance: 68, height: 65, durability: 70,
        awareness: 75, creativity: 68, determination: 72, bravery: 70,
        consistency: 70, composure: 73, patience: 68,
        hand_eye_coordination: 50, throw_accuracy: 50, form_technique: 71,
        finesse: 68, deception: 65, teamwork: 70, footwork: 70,
      };

      const strongAttrs: PlayerAttributes = {
        grip_strength: 70, arm_strength: 68, core_strength: 72, agility: 90,
        acceleration: 74, top_speed: 68, jumping: 90, reactions: 90,
        stamina: 70, balance: 68, height: 65, durability: 70,
        awareness: 75, creativity: 68, determination: 72, bravery: 70,
        consistency: 70, composure: 73, patience: 68,
        hand_eye_coordination: 90, throw_accuracy: 90, form_technique: 71,
        finesse: 68, deception: 65, teamwork: 70, footwork: 70,
      };

      const weakPlayer = createMockPlayer({
        id: 'weak',
        attributes: weakAttrs,
        potentials: { physical: 55, mental: 72, technical: 55 }, // Low ceiling
      });

      const strongPlayer = createMockPlayer({
        id: 'strong',
        attributes: strongAttrs,
        potentials: { physical: 92, mental: 78, technical: 92 }, // High ceiling
      });

      const players = [weakPlayer, strongPlayer]; // Intentionally wrong order

      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluations = comparePlayersByPosition(players, 'PG', context, config);

      // Should be sorted with strong player first
      expect(evaluations[0].playerId).toBe('strong');
      expect(evaluations[1].playerId).toBe('weak');
      expect(evaluations[0].compositeScore).toBeGreaterThan(evaluations[1].compositeScore);
    });

    it('filters players by position', () => {
      const pgPlayer = createMockPlayer({ id: 'pg', position: 'PG' });
      const sgPlayer = createMockPlayer({ id: 'sg', position: 'SG' });
      const sfPlayer = createMockPlayer({ id: 'sf', position: 'SF' });

      const players = [pgPlayer, sgPlayer, sfPlayer];

      const context = createMockContext();
      const config = createAIConfig('balanced');

      const pgEvals = comparePlayersByPosition(players, 'PG', context, config);

      // Should only include PG player
      expect(pgEvals.length).toBe(1);
      expect(pgEvals[0].playerId).toBe('pg');
    });

    it('returns empty array when no players match position', () => {
      const players = [
        createMockPlayer({ id: 'player-1', position: 'PG' }),
        createMockPlayer({ id: 'player-2', position: 'SG' }),
      ];

      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluations = comparePlayersByPosition(players, 'C', context, config);

      expect(evaluations.length).toBe(0);
    });

    it('handles empty player array', () => {
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluations = comparePlayersByPosition([], 'PG', context, config);

      expect(evaluations.length).toBe(0);
    });

    it('produces different rankings for different personalities', () => {
      // Young talent: high potential, lower current rating
      const youngTalent = createMockPlayer({
        id: 'young',
        age: 21,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 65,
          agility: 64,
          hand_eye_coordination: 66,
        } as any,
        potentials: {
          physical: 85,
          mental: 82,
          technical: 88,
        }, // High upside
      });

      // Veteran: proven performance, at ceiling
      const veteran = createMockPlayer({
        id: 'veteran',
        age: 29,
        attributes: {
          ...createMockPlayer().attributes,
          throw_accuracy: 78,
          agility: 76,
          hand_eye_coordination: 75,
        } as any,
        potentials: {
          physical: 76,
          mental: 75,
          technical: 77,
        }, // At ceiling
      });

      const players = [youngTalent, veteran];
      const context = createMockContext();

      const conservative = createAIConfig('conservative');
      const aggressive = createAIConfig('aggressive');

      const conservativeRanking = comparePlayersByPosition(players, 'PG', context, conservative);
      const aggressiveRanking = comparePlayersByPosition(players, 'PG', context, aggressive);

      // Conservative should prefer veteran, aggressive should prefer young talent
      expect(conservativeRanking[0].playerId).toBe('veteran');
      expect(aggressiveRanking[0].playerId).toBe('young');
    });
  });

  describe('Edge Cases', () => {
    it('handles player with all minimum attributes (1s)', () => {
      const minPlayer = createMockPlayer({
        attributes: Object.fromEntries(
          Object.keys(createMockPlayer().attributes).map((key) => [key, 1])
        ) as any,
      });

      const rating = calculateOverallRating(minPlayer);
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThan(20); // Should be very low
    });

    it('handles player with all maximum attributes (100s)', () => {
      const maxPlayer = createMockPlayer({
        attributes: Object.fromEntries(
          Object.keys(createMockPlayer().attributes).map((key) => [key, 100])
        ) as any,
      });

      const rating = calculateOverallRating(maxPlayer);
      expect(rating).toBeGreaterThan(95);
      expect(rating).toBeLessThanOrEqual(100);
    });

    it('handles very old player (40+)', () => {
      const oldPlayer = createMockPlayer({ age: 42 });
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(oldPlayer, context, config);

      expect(evaluation.ageFactor).toBeGreaterThan(0); // Still has some value
      expect(evaluation.ageFactor).toBeLessThan(50); // But penalized
    });

    it('handles very young player (18)', () => {
      const youngPlayer = createMockPlayer({ age: 18 });
      const context = createMockContext();
      const config = createAIConfig('balanced');

      const evaluation = evaluatePlayer(youngPlayer, context, config);

      expect(evaluation.ageFactor).toBeGreaterThan(60); // Has value (potential)
      expect(evaluation.ageFactor).toBeLessThan(100); // But not prime
    });
  });
});
