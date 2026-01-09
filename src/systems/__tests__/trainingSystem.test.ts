/**
 * Unit tests for Training System
 */

import {
  TrainingFocus,
  WeeklyXP,
  CategoryPotentials,
  DEFAULT_TRAINING_FOCUS,
  BASE_XP_PER_WEEK,
  AGE_MULTIPLIERS,
  MAX_PLAYING_TIME_BONUS,
  PLAYING_TIME_FOR_MAX_BONUS,
  SOFT_CAP_MULTIPLIER,
  HARD_CAP_MULTIPLIER,
  PHYSICAL_ATTRIBUTES,
  MENTAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTES,
  validateTrainingFocus,
  getAgeMultiplier,
  calculatePlayingTimeBonus,
  calculateWeeklyXP,
  calculateXPRequired,
  getAttributeCategory,
  applyWeeklyTraining,
  simulateTrainingWeek,
} from '../trainingSystem';

describe('Training System', () => {
  describe('validateTrainingFocus', () => {
    it('should accept default training focus', () => {
      const result = validateTrainingFocus(DEFAULT_TRAINING_FOCUS);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept balanced 33/33/34 split', () => {
      const focus: TrainingFocus = {
        physical: 33,
        mental: 33,
        technical: 34,
      };
      const result = validateTrainingFocus(focus);
      expect(result.isValid).toBe(true);
    });

    it('should accept specialized focus (100/0/0)', () => {
      const focus: TrainingFocus = {
        physical: 100,
        mental: 0,
        technical: 0,
      };
      const result = validateTrainingFocus(focus);
      expect(result.isValid).toBe(true);
    });

    it('should reject total not equal to 100', () => {
      const focus: TrainingFocus = {
        physical: 50,
        mental: 30,
        technical: 10, // Total = 90, not 100
      };
      const result = validateTrainingFocus(focus);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject negative values', () => {
      const focus: TrainingFocus = {
        physical: -10,
        mental: 55,
        technical: 55,
      };
      const result = validateTrainingFocus(focus);
      expect(result.isValid).toBe(false);
    });

    it('should reject values > 100', () => {
      const focus: TrainingFocus = {
        physical: 150,
        mental: 0,
        technical: -50,
      };
      const result = validateTrainingFocus(focus);
      expect(result.isValid).toBe(false);
    });
  });

  describe('getAgeMultiplier', () => {
    it('should give 1.5x for young players (< 23)', () => {
      expect(getAgeMultiplier(18)).toBe(AGE_MULTIPLIERS.young);
      expect(getAgeMultiplier(22)).toBe(AGE_MULTIPLIERS.young);
    });

    it('should give 1.0x for prime players (23-27)', () => {
      expect(getAgeMultiplier(23)).toBe(AGE_MULTIPLIERS.prime);
      expect(getAgeMultiplier(25)).toBe(AGE_MULTIPLIERS.prime);
      expect(getAgeMultiplier(27)).toBe(AGE_MULTIPLIERS.prime);
    });

    it('should give 0.7x for veteran players (28-31)', () => {
      expect(getAgeMultiplier(28)).toBe(AGE_MULTIPLIERS.veteran);
      expect(getAgeMultiplier(30)).toBe(AGE_MULTIPLIERS.veteran);
      expect(getAgeMultiplier(31)).toBe(AGE_MULTIPLIERS.veteran);
    });

    it('should give 0.5x for aging players (>= 32)', () => {
      expect(getAgeMultiplier(32)).toBe(AGE_MULTIPLIERS.aging);
      expect(getAgeMultiplier(35)).toBe(AGE_MULTIPLIERS.aging);
      expect(getAgeMultiplier(40)).toBe(AGE_MULTIPLIERS.aging);
    });
  });

  describe('calculatePlayingTimeBonus', () => {
    it('should give 1.0x (no bonus) for 0 minutes', () => {
      expect(calculatePlayingTimeBonus(0)).toBe(1.0);
    });

    it('should give 1.25x for 250 minutes', () => {
      const bonus = calculatePlayingTimeBonus(250);
      // 1.0 + min(0.5, 250/1000) = 1.0 + 0.25 = 1.25x
      expect(bonus).toBeCloseTo(1.25, 2);
    });

    it('should give 1.5x (max bonus) for 500+ minutes', () => {
      expect(calculatePlayingTimeBonus(500)).toBeCloseTo(1.5, 2);
      expect(calculatePlayingTimeBonus(1000)).toBeCloseTo(1.5, 2);
      expect(calculatePlayingTimeBonus(2000)).toBeCloseTo(1.5, 2);
    });

    it('should scale linearly up to max bonus at 500 minutes', () => {
      const bonus100 = calculatePlayingTimeBonus(100);
      const bonus300 = calculatePlayingTimeBonus(300);

      // 100 minutes: 1.0 + 0.10 = 1.10x
      // 300 minutes: 1.0 + 0.30 = 1.30x
      expect(bonus100).toBeCloseTo(1.10, 2);
      expect(bonus300).toBeCloseTo(1.30, 2);
    });
  });

  describe('calculateWeeklyXP', () => {
    it('should calculate correct XP for balanced training', () => {
      const focus: TrainingFocus = {
        physical: 33,
        mental: 33,
        technical: 34,
      };
      const xp = calculateWeeklyXP(focus, 1.0, 25, 0);

      // baseXP (10) × quality (1.0) × age (1.0) × playingTime (1.0) = 10
      // Physical: 10 × 0.33 = 3.3
      // Mental: 10 × 0.33 = 3.3
      // Technical: 10 × 0.34 = 3.4
      expect(xp.physical).toBeCloseTo(3.3, 1);
      expect(xp.mental).toBeCloseTo(3.3, 1);
      expect(xp.technical).toBeCloseTo(3.4, 1);
    });

    it('should apply training quality multiplier', () => {
      const focus: TrainingFocus = {
        physical: 100,
        mental: 0,
        technical: 0,
      };

      const lowQuality = calculateWeeklyXP(focus, 0.5, 25, 0);
      const highQuality = calculateWeeklyXP(focus, 2.0, 25, 0);

      expect(highQuality.physical).toBeCloseTo(lowQuality.physical * 4, 1);
    });

    it('should apply age multiplier', () => {
      const focus: TrainingFocus = {
        physical: 100,
        mental: 0,
        technical: 0,
      };

      const young = calculateWeeklyXP(focus, 1.0, 20, 0);  // 1.5x
      const prime = calculateWeeklyXP(focus, 1.0, 25, 0);  // 1.0x
      const aging = calculateWeeklyXP(focus, 1.0, 35, 0);  // 0.5x

      expect(young.physical).toBeCloseTo(15, 1);  // 10 × 1.5
      expect(prime.physical).toBeCloseTo(10, 1);  // 10 × 1.0
      expect(aging.physical).toBeCloseTo(5, 1);   // 10 × 0.5
    });

    it('should apply playing time bonus', () => {
      const focus: TrainingFocus = {
        physical: 100,
        mental: 0,
        technical: 0,
      };

      const noPlayingTime = calculateWeeklyXP(focus, 1.0, 25, 0);     // 1.0x
      const maxPlayingTime = calculateWeeklyXP(focus, 1.0, 25, 1000); // 1.5x

      expect(maxPlayingTime.physical).toBeCloseTo(noPlayingTime.physical * 1.5, 1);
    });

    it('should handle specialized training (100/0/0)', () => {
      const focus: TrainingFocus = {
        physical: 100,
        mental: 0,
        technical: 0,
      };
      const xp = calculateWeeklyXP(focus, 1.0, 25, 0);

      expect(xp.physical).toBeCloseTo(10, 1);
      expect(xp.mental).toBe(0);
      expect(xp.technical).toBe(0);
    });
  });

  describe('calculateXPRequired', () => {
    it('should use base formula below potential', () => {
      const xpRequired = calculateXPRequired(50, 80);
      expect(xpRequired).toBe(500); // 50 × 10
    });

    it('should apply soft cap at potential', () => {
      const xpRequired = calculateXPRequired(80, 80);
      expect(xpRequired).toBe(1600); // 80 × 10 × 2 (soft cap)
    });

    it('should apply soft cap just above potential', () => {
      const xpRequired = calculateXPRequired(85, 80);
      expect(xpRequired).toBe(1700); // 85 × 10 × 2 (soft cap)
    });

    it('should apply hard cap 10+ over potential', () => {
      const xpRequired = calculateXPRequired(90, 80);
      expect(xpRequired).toBe(4500); // 90 × 10 × 5 (hard cap)
    });

    it('should scale linearly with attribute value', () => {
      const xp30 = calculateXPRequired(30, 80);
      const xp60 = calculateXPRequired(60, 80);

      expect(xp60).toBe(xp30 * 2); // Linear scaling
    });
  });

  describe('getAttributeCategory', () => {
    it('should categorize physical attributes correctly', () => {
      expect(getAttributeCategory('durability')).toBe('physical');
      expect(getAttributeCategory('stamina')).toBe('physical');
      expect(getAttributeCategory('agility')).toBe('physical');
    });

    it('should categorize mental attributes correctly', () => {
      expect(getAttributeCategory('awareness')).toBe('mental');
      expect(getAttributeCategory('composure')).toBe('mental');
      expect(getAttributeCategory('determination')).toBe('mental');
    });

    it('should categorize technical attributes correctly', () => {
      expect(getAttributeCategory('throw_accuracy')).toBe('technical');
      expect(getAttributeCategory('finesse')).toBe('technical');
      expect(getAttributeCategory('footwork')).toBe('technical');
    });

    it('should categorize teamwork as mental', () => {
      expect(getAttributeCategory('teamwork')).toBe('mental');
    });

    it('should return null for unknown attributes', () => {
      expect(getAttributeCategory('unknown_attribute')).toBeNull();
    });

    it('should have all 26 attributes categorized', () => {
      const allAttributes = [
        ...PHYSICAL_ATTRIBUTES,
        ...MENTAL_ATTRIBUTES,
        ...TECHNICAL_ATTRIBUTES,
      ];
      expect(allAttributes.length).toBe(26);
    });
  });

  describe('applyWeeklyTraining', () => {
    it('should accumulate XP without improving when insufficient', () => {
      const currentAttributes = { durability: 50 };
      const currentXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const weeklyXP: WeeklyXP = { physical: 100, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // 50 durability needs 500 XP to improve, we only have 100
      expect(result.updatedAttributes.durability).toBe(50);
      expect(result.updatedXP.physical).toBe(100);
      expect(result.improvements).toHaveLength(0);
    });

    it('should improve attribute when enough XP accumulated', () => {
      const currentAttributes = { durability: 50 };
      const currentXP: WeeklyXP = { physical: 400, mental: 0, technical: 0 };
      const weeklyXP: WeeklyXP = { physical: 100, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // 400 + 100 = 500 XP, enough to improve from 50 → 51
      expect(result.updatedAttributes.durability).toBe(51);
      expect(result.updatedXP.physical).toBe(0); // XP spent
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].attributeName).toBe('durability');
      expect(result.improvements[0].oldValue).toBe(50);
      expect(result.improvements[0].newValue).toBe(51);
    });

    it('should only improve one attribute per category per week', () => {
      const currentAttributes = {
        durability: 50,
        stamina: 50,
        agility: 50,
      };
      const currentXP: WeeklyXP = { physical: 5000, mental: 0, technical: 0 };
      const weeklyXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // Despite having 5000 XP (enough for multiple), only one improves
      expect(result.improvements).toHaveLength(1);
    });

    it('should respect soft cap at potential', () => {
      const currentAttributes = { durability: 80 };
      const currentXP: WeeklyXP = { physical: 1000, mental: 0, technical: 0 };
      const weeklyXP: WeeklyXP = { physical: 600, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // At potential: needs 80 × 10 × 2 = 1600 XP
      // Has: 1000 + 600 = 1600 XP (exactly enough)
      expect(result.updatedAttributes.durability).toBe(81);
      expect(result.updatedXP.physical).toBe(0);
    });

    it('should cap attributes at 100', () => {
      const currentAttributes = { durability: 100 };
      const currentXP: WeeklyXP = { physical: 10000, mental: 0, technical: 0 };
      const weeklyXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 100, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // Can't improve past 100
      expect(result.updatedAttributes.durability).toBe(100);
    });

    it('should handle improvements in multiple categories', () => {
      const currentAttributes = {
        durability: 50,
        awareness: 50,
        throw_accuracy: 50,
      };
      const currentXP: WeeklyXP = { physical: 500, mental: 500, technical: 500 };
      const weeklyXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = applyWeeklyTraining(currentAttributes, currentXP, weeklyXP, potentials);

      // All three categories have enough XP, so one from each should improve
      expect(result.improvements).toHaveLength(3);
      expect(result.improvements.some(i => i.attributeName === 'durability')).toBe(true);
      expect(result.improvements.some(i => i.attributeName === 'awareness')).toBe(true);
      expect(result.improvements.some(i => i.attributeName === 'throw_accuracy')).toBe(true);
    });
  });

  describe('simulateTrainingWeek', () => {
    it('should simulate complete training week', () => {
      const currentAttributes = {
        durability: 50,
        awareness: 50,
        throw_accuracy: 50,
      };
      const currentXP: WeeklyXP = { physical: 400, mental: 400, technical: 400 };
      const trainingFocus: TrainingFocus = {
        physical: 33,
        mental: 33,
        technical: 34,
      };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const result = simulateTrainingWeek(
        'Test Player',
        currentAttributes,
        currentXP,
        trainingFocus,
        1.0,  // Standard quality
        potentials,
        25,   // Prime age
        0     // No playing time bonus
      );

      expect(result.playerName).toBe('Test Player');
      expect(result.xpEarned.physical).toBeGreaterThan(0);
      expect(result.xpEarned.mental).toBeGreaterThan(0);
      expect(result.xpEarned.technical).toBeGreaterThan(0);
      expect(result.totalImprovements).toBeGreaterThanOrEqual(0);
    });

    it('should show faster progression for young players', () => {
      const currentAttributes = { durability: 50 };
      const currentXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const trainingFocus: TrainingFocus = { physical: 100, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const youngResult = simulateTrainingWeek(
        'Young Player',
        currentAttributes,
        currentXP,
        trainingFocus,
        1.0,
        potentials,
        20,  // Young (1.5x)
        0
      );

      const oldResult = simulateTrainingWeek(
        'Old Player',
        currentAttributes,
        currentXP,
        trainingFocus,
        1.0,
        potentials,
        35,  // Aging (0.5x)
        0
      );

      expect(youngResult.xpEarned.physical).toBeGreaterThan(oldResult.xpEarned.physical);
    });

    it('should show playing time bonus effect', () => {
      const currentAttributes = { durability: 50 };
      const currentXP: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const trainingFocus: TrainingFocus = { physical: 100, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      const noPlayingTime = simulateTrainingWeek(
        'Bench Player',
        currentAttributes,
        currentXP,
        trainingFocus,
        1.0,
        potentials,
        25,
        0     // No minutes
      );

      const highPlayingTime = simulateTrainingWeek(
        'Starter',
        currentAttributes,
        currentXP,
        trainingFocus,
        1.0,
        potentials,
        25,
        1000  // Max bonus
      );

      expect(highPlayingTime.xpEarned.physical).toBeGreaterThan(noPlayingTime.xpEarned.physical);
    });
  });

  describe('Integration tests', () => {
    it('should demonstrate complete player progression over multiple weeks', () => {
      let attributes = { durability: 50 };
      let xp: WeeklyXP = { physical: 0, mental: 0, technical: 0 };
      const trainingFocus: TrainingFocus = { physical: 100, mental: 0, technical: 0 };
      const potentials: CategoryPotentials = { physical: 80, mental: 80, technical: 80 };

      let totalImprovements = 0;

      // Simulate 60 weeks of training
      for (let week = 0; week < 60; week++) {
        const result = simulateTrainingWeek(
          'Test Player',
          attributes,
          xp,
          trainingFocus,
          1.0,
          potentials,
          25,
          500  // Some playing time
        );

        // Update state
        if (result.improvements.length > 0) {
          attributes.durability = result.improvements[0].newValue;
          xp.physical = result.improvements[0].xpProgress;
          totalImprovements++;
        } else {
          xp.physical += result.xpEarned.physical;
        }
      }

      // After 60 weeks, should have improved significantly
      expect(attributes.durability).toBeGreaterThan(50);
      expect(totalImprovements).toBeGreaterThan(0);
    });

    it('should demonstrate soft cap slowing progression', () => {
      // Test XP required at different stages
      const belowPotential = calculateXPRequired(70, 80);
      const atPotential = calculateXPRequired(80, 80);
      const overPotential = calculateXPRequired(90, 80);

      // At potential should require 2x more XP
      expect(atPotential).toBeCloseTo(belowPotential * (80 / 70) * SOFT_CAP_MULTIPLIER, 1);

      // Far over potential should require 5x more XP
      expect(overPotential).toBeCloseTo(belowPotential * (90 / 70) * HARD_CAP_MULTIPLIER, 1);

      // Demonstrate that a player at 75 with potential 80 trains faster than player at 85 with potential 80
      const xpForImprovement75 = calculateXPRequired(75, 80);  // Below potential
      const xpForImprovement85 = calculateXPRequired(85, 80);  // Above potential

      // Player at 85 needs significantly more XP per improvement
      expect(xpForImprovement85).toBeGreaterThan(xpForImprovement75 * 2);
    });
  });
});
