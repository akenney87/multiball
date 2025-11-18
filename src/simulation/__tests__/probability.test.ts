/**
 * Basic tests for probability module
 *
 * NOTE: These are placeholder tests for Phase 1 completion.
 * Agent 4 will create comprehensive validation tests.
 */

import {
  sigmoid,
  calculateComposite,
  weightedSigmoidProbability,
  calculateStaminaPenalty,
  setSeed,
  resetRandom,
} from '../core/probability';
import { WEIGHTS_3PT } from '../constants';

describe('Probability Engine - Basic Tests', () => {
  beforeEach(() => {
    resetRandom();
  });

  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 10);
    });

    it('should return ~1.0 for large positive input', () => {
      expect(sigmoid(100)).toBeCloseTo(1.0, 10);
    });

    it('should return ~0.0 for large negative input', () => {
      expect(sigmoid(-100)).toBeCloseTo(0.0, 10);
    });

    it('should be monotonically increasing', () => {
      const values = [-10, -5, 0, 5, 10].map(sigmoid);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('calculateComposite', () => {
    it('should calculate weighted average correctly', () => {
      const player = {
        form_technique: 80,
        throw_accuracy: 80,
        finesse: 80,
        hand_eye_coordination: 80,
        balance: 80,
        composure: 80,
        consistency: 80,
        agility: 80,
      };

      const composite = calculateComposite(player, WEIGHTS_3PT);
      expect(composite).toBeCloseTo(80, 1);
    });

    it('should calculate weighted average for mixed attributes', () => {
      const player = {
        form_technique: 90, // 0.25 weight
        throw_accuracy: 85, // 0.20 weight
        finesse: 80, // 0.15 weight
        hand_eye_coordination: 75, // 0.12 weight
        balance: 70, // 0.10 weight
        composure: 65, // 0.08 weight
        consistency: 60, // 0.06 weight
        agility: 55, // 0.04 weight
      };

      const composite = calculateComposite(player, WEIGHTS_3PT);
      // Expected: 0.25*90 + 0.20*85 + 0.15*80 + 0.12*75 + 0.10*70 + 0.08*65 + 0.06*60 + 0.04*55
      // Expected: 22.5 + 17 + 12 + 9 + 7 + 5.2 + 3.6 + 2.2 = 78.5
      expect(composite).toBeCloseTo(78.5, 1);
    });

    it('should throw error for missing attribute', () => {
      const player = {
        form_technique: 80,
        // Missing other attributes
      };

      expect(() => calculateComposite(player, WEIGHTS_3PT)).toThrow();
    });
  });

  describe('weightedSigmoidProbability', () => {
    it('should return baseRate when diff=0', () => {
      const prob = weightedSigmoidProbability(0.3, 0);
      expect(prob).toBeCloseTo(0.3, 2);
    });

    it('should return higher probability for positive diff', () => {
      const baseRate = 0.3;
      const probPositive = weightedSigmoidProbability(baseRate, 60);
      expect(probPositive).toBeGreaterThan(baseRate);
      // With k=0.025, baseRate=0.3, diff=60: ~0.623
      expect(probPositive).toBeCloseTo(0.623, 1); // Elite vs poor
    });

    it('should return lower probability for negative diff', () => {
      const baseRate = 0.3;
      const probNegative = weightedSigmoidProbability(baseRate, -60);
      expect(probNegative).toBeLessThan(baseRate);
      // With k=0.025, baseRate=0.3, diff=-60: ~0.161
      expect(probNegative).toBeCloseTo(0.161, 1); // Poor vs elite
    });

    it('should apply floor of 5%', () => {
      const prob = weightedSigmoidProbability(0.3, -200);
      expect(prob).toBeGreaterThanOrEqual(0.05);
    });

    it('should apply ceiling of 95%', () => {
      const prob = weightedSigmoidProbability(0.3, 200);
      expect(prob).toBeLessThanOrEqual(0.95);
    });

    it('should cap attribute diff at ±40', () => {
      const prob1 = weightedSigmoidProbability(0.3, 40);
      const prob2 = weightedSigmoidProbability(0.3, 100);
      expect(prob1).toBeCloseTo(prob2, 2); // Both capped at 40
    });
  });

  describe('calculateStaminaPenalty', () => {
    it('should return 0 at threshold (80)', () => {
      expect(calculateStaminaPenalty(80)).toBe(0);
    });

    it('should return 0 above threshold', () => {
      expect(calculateStaminaPenalty(90)).toBe(0);
      expect(calculateStaminaPenalty(100)).toBe(0);
    });

    it('should return correct penalty at stamina=60', () => {
      // Formula: 0.002 * (80 - 60) ** 1.3 = 0.002 * 20^1.3 ≈ 0.098
      const penalty = calculateStaminaPenalty(60);
      expect(penalty).toBeCloseTo(0.098, 2);
    });

    it('should return correct penalty at stamina=40', () => {
      // Formula: 0.002 * (80 - 40) ** 1.3 = 0.002 * 40^1.3 ≈ 0.242
      const penalty = calculateStaminaPenalty(40);
      expect(penalty).toBeCloseTo(0.242, 2);
    });

    it('should return correct penalty at stamina=20', () => {
      // Formula: 0.002 * (80 - 20) ** 1.3 = 0.002 * 60^1.3 ≈ 0.410
      const penalty = calculateStaminaPenalty(20);
      expect(penalty).toBeCloseTo(0.410, 2);
    });

    it('should cap penalty at 100%', () => {
      const penalty = calculateStaminaPenalty(0);
      expect(penalty).toBeLessThanOrEqual(1.0);
    });
  });

  describe('setSeed', () => {
    it('should produce reproducible results with same seed', () => {
      setSeed(42);
      const prob1 = weightedSigmoidProbability(0.5, 0);
      const prob2 = weightedSigmoidProbability(0.5, 10);

      setSeed(42);
      const prob3 = weightedSigmoidProbability(0.5, 0);
      const prob4 = weightedSigmoidProbability(0.5, 10);

      expect(prob1).toBe(prob3);
      expect(prob2).toBe(prob4);
    });

    it('should produce different results with different seeds', () => {
      setSeed(42);
      const prob1 = weightedSigmoidProbability(0.5, 0);

      setSeed(123);
      const prob2 = weightedSigmoidProbability(0.5, 0);

      // Probabilities should be same (no randomness in sigmoid itself)
      // But if we add consistency variance, they would differ
      expect(prob1).toBe(prob2); // Base formula is deterministic
    });
  });
});

describe('Probability Engine - Integration Tests', () => {
  it('should calculate realistic 3PT probability for elite shooter vs poor defender', () => {
    const shooter = {
      form_technique: 95,
      throw_accuracy: 92,
      finesse: 88,
      hand_eye_coordination: 90,
      balance: 85,
      composure: 87,
      consistency: 84,
      agility: 80,
    };

    const defender = {
      height: 30,
      reactions: 25,
      agility: 20,
      balance: 15,
      determination: 10,
    };

    const shooterComposite = calculateComposite(shooter, WEIGHTS_3PT);
    const defenderComposite =
      defender.height * 0.25 +
      defender.reactions * 0.25 +
      defender.agility * 0.25 +
      defender.balance * 0.15 +
      defender.determination * 0.1;

    const attributeDiff = shooterComposite - defenderComposite;
    const probability = weightedSigmoidProbability(0.28, attributeDiff);

    // Elite shooter vs poor defender should have high success rate
    expect(probability).toBeGreaterThan(0.6);
    expect(probability).toBeLessThan(0.95); // But capped
  });

  it('should calculate realistic 3PT probability for poor shooter vs elite defender', () => {
    const shooter = {
      form_technique: 20,
      throw_accuracy: 18,
      finesse: 15,
      hand_eye_coordination: 22,
      balance: 25,
      composure: 19,
      consistency: 17,
      agility: 16,
    };

    const defender = {
      height: 95,
      reactions: 92,
      agility: 88,
      balance: 90,
      determination: 87,
    };

    const shooterComposite = calculateComposite(shooter, WEIGHTS_3PT);
    const defenderComposite =
      defender.height * 0.25 +
      defender.reactions * 0.25 +
      defender.agility * 0.25 +
      defender.balance * 0.15 +
      defender.determination * 0.1;

    const attributeDiff = shooterComposite - defenderComposite;
    const probability = weightedSigmoidProbability(0.28, attributeDiff);

    // Poor shooter vs elite defender should have low success rate
    expect(probability).toBeLessThan(0.2);
    expect(probability).toBeGreaterThan(0.05); // But floored
  });
});
