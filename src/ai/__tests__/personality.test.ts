/**
 * Tests for AI Personality Core
 *
 * Validates:
 * - AI personality configuration creation
 * - Decision threshold calculation
 * - Conservative/Balanced/Aggressive behavior differences
 */

import { describe, it, expect } from '@jest/globals';
import {
  createAIConfig,
  getDecisionThresholds,
  getContractValuation,
  getScoutingPreferences,
  getMinutesDistribution,
  type DecisionThresholds,
} from '../personality';
import type { TeamPersonality, AIConfig } from '../types';

describe('AI Personality Core', () => {
  describe('createAIConfig', () => {
    it('creates conservative AI config', () => {
      const config = createAIConfig('conservative');

      expect(config.personality).toBe('conservative');
      expect(config).toHaveProperty('youthDevelopmentFocus');
      expect(config).toHaveProperty('spendingAggression');
      expect(config).toHaveProperty('riskTolerance');
    });

    it('creates balanced AI config', () => {
      const config = createAIConfig('balanced');

      expect(config.personality).toBe('balanced');
      expect(config).toHaveProperty('youthDevelopmentFocus');
      expect(config).toHaveProperty('spendingAggression');
      expect(config).toHaveProperty('riskTolerance');
    });

    it('creates aggressive AI config', () => {
      const config = createAIConfig('aggressive');

      expect(config.personality).toBe('aggressive');
      expect(config).toHaveProperty('youthDevelopmentFocus');
      expect(config).toHaveProperty('spendingAggression');
      expect(config).toHaveProperty('riskTolerance');
    });

    it('sets different spending aggression for each personality', () => {
      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      expect(conservative.spendingAggression).toBeLessThan(balanced.spendingAggression);
      expect(balanced.spendingAggression).toBeLessThan(aggressive.spendingAggression);
    });

    it('sets different risk tolerance for each personality', () => {
      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      expect(conservative.riskTolerance).toBeLessThan(balanced.riskTolerance);
      expect(balanced.riskTolerance).toBeLessThan(aggressive.riskTolerance);
    });
  });

  describe('getDecisionThresholds', () => {
    it('returns decision thresholds for conservative AI', () => {
      const config = createAIConfig('conservative');
      const thresholds = getDecisionThresholds(config);

      expect(thresholds).toHaveProperty('releasePlayerRating');
      expect(thresholds).toHaveProperty('signPlayerRating');
      expect(thresholds).toHaveProperty('promoteYouthRating');
      expect(thresholds).toHaveProperty('starterMinimumRating');
    });

    it('sets higher thresholds for conservative AI', () => {
      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');

      const conservativeThresholds = getDecisionThresholds(conservative);
      const balancedThresholds = getDecisionThresholds(balanced);

      // Conservative keeps players longer (lower release threshold)
      expect(conservativeThresholds.releasePlayerRating).toBeLessThan(
        balancedThresholds.releasePlayerRating
      );

      // Conservative signs only better players (higher sign threshold)
      expect(conservativeThresholds.signPlayerRating).toBeGreaterThan(
        balancedThresholds.signPlayerRating
      );

      // Conservative promotes only proven youth (higher threshold)
      expect(conservativeThresholds.promoteYouthRating).toBeGreaterThan(
        balancedThresholds.promoteYouthRating
      );
    });

    it('sets lower thresholds for aggressive AI', () => {
      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      const balancedThresholds = getDecisionThresholds(balanced);
      const aggressiveThresholds = getDecisionThresholds(aggressive);

      // Aggressive releases more readily (higher release threshold)
      expect(aggressiveThresholds.releasePlayerRating).toBeGreaterThan(
        balancedThresholds.releasePlayerRating
      );

      // Aggressive signs more freely (lower sign threshold)
      expect(aggressiveThresholds.signPlayerRating).toBeLessThan(
        balancedThresholds.signPlayerRating
      );

      // Aggressive promotes youth earlier (lower threshold)
      expect(aggressiveThresholds.promoteYouthRating).toBeLessThan(
        balancedThresholds.promoteYouthRating
      );
    });

    it('returns all required threshold fields', () => {
      const config = createAIConfig('balanced');
      const thresholds = getDecisionThresholds(config);

      expect(thresholds.releasePlayerRating).toBeGreaterThanOrEqual(0);
      expect(thresholds.releasePlayerRating).toBeLessThanOrEqual(100);

      expect(thresholds.signPlayerRating).toBeGreaterThanOrEqual(0);
      expect(thresholds.signPlayerRating).toBeLessThanOrEqual(100);

      expect(thresholds.promoteYouthRating).toBeGreaterThanOrEqual(0);
      expect(thresholds.promoteYouthRating).toBeLessThanOrEqual(100);

      expect(thresholds.starterMinimumRating).toBeGreaterThanOrEqual(0);
      expect(thresholds.starterMinimumRating).toBeLessThanOrEqual(100);
    });
  });

  describe('getContractValuation', () => {
    it('calculates contract value for conservative AI', () => {
      const config = createAIConfig('conservative');
      const value = getContractValuation(75, config);

      expect(value).toBeGreaterThan(0);
      expect(typeof value).toBe('number');
    });

    it('calculates contract value for aggressive AI', () => {
      const config = createAIConfig('aggressive');
      const value = getContractValuation(75, config);

      expect(value).toBeGreaterThan(0);
      expect(typeof value).toBe('number');
    });

    it('offers more for higher-rated players', () => {
      const config = createAIConfig('balanced');
      const lowRatedValue = getContractValuation(60, config);
      const highRatedValue = getContractValuation(80, config);

      expect(highRatedValue).toBeGreaterThan(lowRatedValue);
    });

    it('conservative AI offers less than aggressive AI for same player', () => {
      const conservative = createAIConfig('conservative');
      const aggressive = createAIConfig('aggressive');

      const conservativeOffer = getContractValuation(75, conservative);
      const aggressiveOffer = getContractValuation(75, aggressive);

      expect(conservativeOffer).toBeLessThan(aggressiveOffer);
    });

    it('returns value proportional to rating', () => {
      const config = createAIConfig('balanced');
      const value60 = getContractValuation(60, config);
      const value80 = getContractValuation(80, config);

      // 80 rating should be worth more than 60 rating
      const ratio = value80 / value60;
      expect(ratio).toBeGreaterThan(1.2); // At least 20% more valuable
    });
  });

  describe('getScoutingPreferences', () => {
    it('returns scouting preferences for conservative AI', () => {
      const config = createAIConfig('conservative');
      const prefs = getScoutingPreferences(config);

      expect(prefs).toHaveProperty('focusOnYouth');
      expect(prefs).toHaveProperty('focusOnExperience');
      expect(prefs).toHaveProperty('focusOnPotential');
      expect(prefs).toHaveProperty('focusOnProvenPerformance');
    });

    it('conservative AI favors proven performance over potential', () => {
      const config = createAIConfig('conservative');
      const prefs = getScoutingPreferences(config);

      expect(prefs.focusOnProvenPerformance).toBeGreaterThan(prefs.focusOnPotential);
      expect(prefs.focusOnExperience).toBeGreaterThan(prefs.focusOnYouth);
    });

    it('aggressive AI favors potential over proven performance', () => {
      const config = createAIConfig('aggressive');
      const prefs = getScoutingPreferences(config);

      expect(prefs.focusOnPotential).toBeGreaterThan(prefs.focusOnProvenPerformance);
      expect(prefs.focusOnYouth).toBeGreaterThan(prefs.focusOnExperience);
    });

    it('balanced AI has equal weights', () => {
      const config = createAIConfig('balanced');
      const prefs = getScoutingPreferences(config);

      expect(prefs.focusOnYouth).toBe(prefs.focusOnExperience);
      expect(prefs.focusOnPotential).toBe(prefs.focusOnProvenPerformance);
    });
  });

  describe('getMinutesDistribution', () => {
    it('returns minutes distribution for conservative AI', () => {
      const config = createAIConfig('conservative');
      const dist = getMinutesDistribution(config);

      expect(dist).toHaveProperty('starterMinutes');
      expect(dist).toHaveProperty('rotationMinutes');
      expect(dist).toHaveProperty('benchMinutes');
    });

    it('conservative AI plays starters more', () => {
      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');

      const conservativeDist = getMinutesDistribution(conservative);
      const balancedDist = getMinutesDistribution(balanced);

      expect(conservativeDist.starterMinutes).toBeGreaterThan(balancedDist.starterMinutes);
      expect(conservativeDist.benchMinutes).toBeLessThan(balancedDist.benchMinutes);
    });

    it('aggressive AI distributes minutes more evenly', () => {
      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      const balancedDist = getMinutesDistribution(balanced);
      const aggressiveDist = getMinutesDistribution(aggressive);

      expect(aggressiveDist.starterMinutes).toBeLessThan(balancedDist.starterMinutes);
      expect(aggressiveDist.rotationMinutes).toBeGreaterThan(balancedDist.rotationMinutes);
    });

    it('total minutes equal 48 for all personalities', () => {
      const personalities: TeamPersonality[] = ['conservative', 'balanced', 'aggressive'];

      personalities.forEach((personality) => {
        const config = createAIConfig(personality);
        const dist = getMinutesDistribution(config);

        const totalPerPlayer =
          dist.starterMinutes * 5 + dist.rotationMinutes * 3 + dist.benchMinutes * 2;
        // Total should be 240 (5 players × 48 minutes)
        expect(totalPerPlayer).toBeCloseTo(240, 0);
      });
    });
  });

  describe('Personality Consistency', () => {
    it('conservative config is internally consistent', () => {
      const config = createAIConfig('conservative');

      expect(config.spendingAggression).toBeLessThan(50); // Low spending
      expect(config.riskTolerance).toBeLessThan(50); // Low risk
      expect(config.youthDevelopmentFocus).toBeLessThan(50); // Prefers experience
    });

    it('balanced config is internally consistent', () => {
      const config = createAIConfig('balanced');

      expect(config.spendingAggression).toBeCloseTo(50, 5); // Moderate spending
      expect(config.riskTolerance).toBeCloseTo(50, 5); // Moderate risk
      expect(config.youthDevelopmentFocus).toBeCloseTo(50, 5); // Balanced approach
    });

    it('aggressive config is internally consistent', () => {
      const config = createAIConfig('aggressive');

      expect(config.spendingAggression).toBeGreaterThan(50); // High spending
      expect(config.riskTolerance).toBeGreaterThan(50); // High risk
      expect(config.youthDevelopmentFocus).toBeGreaterThan(50); // Prefers youth
    });
  });

  describe('Edge Cases', () => {
    it('handles minimum rating (1) in contract valuation', () => {
      const config = createAIConfig('balanced');
      const value = getContractValuation(1, config);

      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(100000); // Reasonable minimum
    });

    it('handles maximum rating (100) in contract valuation', () => {
      const config = createAIConfig('balanced');
      const value = getContractValuation(100, config);

      expect(value).toBeGreaterThan(1000000); // Reasonable maximum
      expect(value).toBeLessThan(20000000); // Not absurdly high
    });

    it('all personalities produce different thresholds', () => {
      const conservative = createAIConfig('conservative');
      const balanced = createAIConfig('balanced');
      const aggressive = createAIConfig('aggressive');

      const cThresholds = getDecisionThresholds(conservative);
      const bThresholds = getDecisionThresholds(balanced);
      const aThresholds = getDecisionThresholds(aggressive);

      // Ensure each personality produces unique threshold sets
      expect(cThresholds.releasePlayerRating).not.toBe(bThresholds.releasePlayerRating);
      expect(bThresholds.releasePlayerRating).not.toBe(aThresholds.releasePlayerRating);

      expect(cThresholds.signPlayerRating).not.toBe(bThresholds.signPlayerRating);
      expect(bThresholds.signPlayerRating).not.toBe(aThresholds.signPlayerRating);
    });
  });
});
