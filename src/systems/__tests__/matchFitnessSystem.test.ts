/**
 * Match Fitness System Tests
 *
 * Unit tests for the persistent match fitness tracking system.
 */

import {
  calculateMatchDrain,
  calculateRecovery,
  applyFitnessDrain,
  applyFitnessRecovery,
  calculateAttributeMultiplier,
  getWarningLevel,
  getWarningMessage,
  isFatigued,
  isExhausted,
  calculateInjuryRiskMultiplier,
  daysBetween,
  CONSTANTS,
} from '../matchFitnessSystem';

describe('matchFitnessSystem', () => {
  // ===========================================================================
  // DRAIN CALCULATION TESTS
  // ===========================================================================

  describe('calculateMatchDrain', () => {
    describe('basketball', () => {
      it('should drain ~40% for full 48 minutes at average stamina', () => {
        const drain = calculateMatchDrain('basketball', 'PG', 48, 50);
        expect(drain).toBeCloseTo(40, 0);
      });

      it('should drain proportionally for partial minutes', () => {
        const fullDrain = calculateMatchDrain('basketball', 'PG', 48, 50);
        const halfDrain = calculateMatchDrain('basketball', 'PG', 24, 50);
        expect(halfDrain).toBeCloseTo(fullDrain / 2, 1);
      });

      it('should drain less for high stamina players', () => {
        const lowStaminaDrain = calculateMatchDrain('basketball', 'PG', 48, 10);
        const highStaminaDrain = calculateMatchDrain('basketball', 'PG', 48, 90);
        expect(highStaminaDrain).toBeLessThan(lowStaminaDrain);
        // High stamina (90) should drain about 50% of low stamina (10)
        expect(highStaminaDrain / lowStaminaDrain).toBeCloseTo(0.52, 1);
      });

      it('should be uniform across positions', () => {
        const pgDrain = calculateMatchDrain('basketball', 'PG', 48, 50);
        const cDrain = calculateMatchDrain('basketball', 'C', 48, 50);
        expect(pgDrain).toEqual(cDrain);
      });
    });

    describe('soccer', () => {
      it('should drain ~20% for full 90 minutes at average stamina (midfield)', () => {
        const drain = calculateMatchDrain('soccer', 'CM', 90, 50);
        // CM has 1.25x modifier, so 20 * 1.25 = 25%
        expect(drain).toBeCloseTo(25, 0);
      });

      it('should drain less for goalkeeper', () => {
        const gkDrain = calculateMatchDrain('soccer', 'GK', 90, 50);
        const cmDrain = calculateMatchDrain('soccer', 'CM', 90, 50);
        // GK is 0.5x, CM is 1.25x
        expect(gkDrain).toBeLessThan(cmDrain);
        expect(gkDrain).toBeCloseTo(10, 0); // 20 * 0.5 = 10%
      });

      it('should drain most for central midfielders', () => {
        const gkDrain = calculateMatchDrain('soccer', 'GK', 90, 50);
        const cbDrain = calculateMatchDrain('soccer', 'CB', 90, 50);
        const cmDrain = calculateMatchDrain('soccer', 'CM', 90, 50);
        const stDrain = calculateMatchDrain('soccer', 'ST', 90, 50);

        expect(cmDrain).toBeGreaterThan(cbDrain);
        expect(cmDrain).toBeGreaterThan(stDrain);
        expect(cmDrain).toBeGreaterThan(gkDrain);
      });
    });

    describe('baseball', () => {
      it('should drain ~80% for starting pitcher over 9 innings', () => {
        const drain = calculateMatchDrain('baseball', 'P', 9, 50, false);
        // Base 10 * P modifier 8.0 = 80%
        expect(drain).toBeCloseTo(80, 0);
      });

      it('should drain very little for first baseman', () => {
        const drain = calculateMatchDrain('baseball', '1B', 9, 50);
        // Base 10 * 1B modifier 0.5 = 5%
        expect(drain).toBeCloseTo(5, 0);
      });

      it('should apply relief pitcher modifier', () => {
        const starterDrain = calculateMatchDrain('baseball', 'P', 2, 50, false);
        const reliefDrain = calculateMatchDrain('baseball', 'P', 2, 50, true);
        // Relief has 1.25x modifier on top
        expect(reliefDrain).toBeGreaterThan(starterDrain);
        expect(reliefDrain / starterDrain).toBeCloseTo(1.25, 1);
      });

      it('should cap drain at 80%', () => {
        // Even extreme case should not exceed 80%
        const drain = calculateMatchDrain('baseball', 'P', 15, 10, true);
        expect(drain).toBeLessThanOrEqual(80);
      });
    });

    describe('stamina attribute effect', () => {
      it('should make low stamina players drain faster', () => {
        const lowStamina = calculateMatchDrain('basketball', 'PG', 48, 10);
        const avgStamina = calculateMatchDrain('basketball', 'PG', 48, 50);
        const highStamina = calculateMatchDrain('basketball', 'PG', 48, 90);

        expect(lowStamina).toBeGreaterThan(avgStamina);
        expect(avgStamina).toBeGreaterThan(highStamina);
      });
    });
  });

  // ===========================================================================
  // RECOVERY CALCULATION TESTS
  // ===========================================================================

  describe('calculateRecovery', () => {
    it('should recover ~4.3% per day at average stamina', () => {
      const recovery = calculateRecovery(1, 50, 50);
      expect(recovery).toBeCloseTo(4.3, 0);
    });

    it('should recover ~33% per week at average stamina with 50% medical', () => {
      // 4.3 * 7 * 1.0 (stamina mod) * 1.1 (medical mod) = 33.11
      const recovery = calculateRecovery(7, 50, 50);
      expect(recovery).toBeCloseTo(33, 0);
    });

    it('should recover faster with high stamina attribute', () => {
      const lowStaminaRecovery = calculateRecovery(7, 10, 50);
      const highStaminaRecovery = calculateRecovery(7, 90, 50);
      expect(highStaminaRecovery).toBeGreaterThan(lowStaminaRecovery);
    });

    it('should recover faster with higher medical budget', () => {
      const lowMedical = calculateRecovery(7, 50, 0);
      const highMedical = calculateRecovery(7, 50, 100);
      expect(highMedical).toBeGreaterThan(lowMedical);
      // 20% bonus at 100% medical
      expect(highMedical / lowMedical).toBeCloseTo(1.2, 1);
    });

    it('should scale linearly with days', () => {
      const oneDay = calculateRecovery(1, 50, 50);
      const threeDays = calculateRecovery(3, 50, 50);
      expect(threeDays).toBeCloseTo(oneDay * 3, 1);
    });
  });

  // ===========================================================================
  // APPLY DRAIN/RECOVERY TESTS
  // ===========================================================================

  describe('applyFitnessDrain', () => {
    it('should reduce fitness by drain amount', () => {
      const result = applyFitnessDrain(100, 40);
      expect(result.newFitness).toBe(60);
      expect(result.drainAmount).toBe(40);
    });

    it('should not go below minimum (10%)', () => {
      const result = applyFitnessDrain(20, 50);
      expect(result.newFitness).toBe(10);
      expect(result.drainAmount).toBe(10); // Only actually drained 10
    });

    it('should handle zero drain', () => {
      const result = applyFitnessDrain(80, 0);
      expect(result.newFitness).toBe(80);
      expect(result.drainAmount).toBe(0);
    });
  });

  describe('applyFitnessRecovery', () => {
    it('should increase fitness by recovery amount', () => {
      const result = applyFitnessRecovery(60, 30);
      expect(result.newFitness).toBe(90);
      expect(result.recoveryAmount).toBe(30);
    });

    it('should not exceed maximum (100%)', () => {
      const result = applyFitnessRecovery(80, 50);
      expect(result.newFitness).toBe(100);
      expect(result.recoveryAmount).toBe(20); // Only actually recovered 20
    });

    it('should handle zero recovery', () => {
      const result = applyFitnessRecovery(70, 0);
      expect(result.newFitness).toBe(70);
      expect(result.recoveryAmount).toBe(0);
    });
  });

  // ===========================================================================
  // PERFORMANCE DEGRADATION TESTS
  // ===========================================================================

  describe('calculateAttributeMultiplier', () => {
    it('should return 1.0 at 100% fitness', () => {
      expect(calculateAttributeMultiplier(100)).toBe(1.0);
    });

    it('should return 0.75 at 50% fitness', () => {
      expect(calculateAttributeMultiplier(50)).toBe(0.75);
    });

    it('should return 0.5 at 0% fitness', () => {
      expect(calculateAttributeMultiplier(0)).toBe(0.5);
    });

    it('should scale linearly', () => {
      const at25 = calculateAttributeMultiplier(25);
      const at75 = calculateAttributeMultiplier(75);
      expect(at25).toBeCloseTo(0.625, 3);
      expect(at75).toBeCloseTo(0.875, 3);
    });
  });

  // ===========================================================================
  // UI HELPER TESTS
  // ===========================================================================

  describe('getWarningLevel', () => {
    it('should return "none" for 75% and above', () => {
      expect(getWarningLevel(100)).toBe('none');
      expect(getWarningLevel(75)).toBe('none');
    });

    it('should return "yellow" for 50-74%', () => {
      expect(getWarningLevel(74)).toBe('yellow');
      expect(getWarningLevel(50)).toBe('yellow');
    });

    it('should return "red" for below 50%', () => {
      expect(getWarningLevel(49)).toBe('red');
      expect(getWarningLevel(10)).toBe('red');
    });
  });

  describe('getWarningMessage', () => {
    it('should return null for healthy fitness', () => {
      expect(getWarningMessage(100)).toBeNull();
      expect(getWarningMessage(75)).toBeNull();
    });

    it('should return fatigued message for yellow warning', () => {
      const msg = getWarningMessage(60);
      expect(msg).toContain('Fatigued');
    });

    it('should return exhausted message for red warning', () => {
      const msg = getWarningMessage(30);
      expect(msg).toContain('Exhausted');
    });
  });

  describe('isFatigued', () => {
    it('should return false for 75% and above', () => {
      expect(isFatigued(100)).toBe(false);
      expect(isFatigued(75)).toBe(false);
    });

    it('should return true below 75%', () => {
      expect(isFatigued(74)).toBe(true);
      expect(isFatigued(50)).toBe(true);
      expect(isFatigued(10)).toBe(true);
    });
  });

  describe('isExhausted', () => {
    it('should return false for 50% and above', () => {
      expect(isExhausted(100)).toBe(false);
      expect(isExhausted(50)).toBe(false);
    });

    it('should return true below 50%', () => {
      expect(isExhausted(49)).toBe(true);
      expect(isExhausted(10)).toBe(true);
    });
  });

  // ===========================================================================
  // INJURY RISK TESTS
  // ===========================================================================

  describe('calculateInjuryRiskMultiplier', () => {
    it('should return 1.0 at 100% fitness', () => {
      expect(calculateInjuryRiskMultiplier(100)).toBe(1.0);
    });

    it('should return 1.5 at 50% fitness', () => {
      expect(calculateInjuryRiskMultiplier(50)).toBe(1.5);
    });

    it('should return 2.0 at 0% fitness', () => {
      expect(calculateInjuryRiskMultiplier(0)).toBe(2.0);
    });

    it('should scale linearly', () => {
      const at25 = calculateInjuryRiskMultiplier(25);
      const at75 = calculateInjuryRiskMultiplier(75);
      expect(at25).toBeCloseTo(1.75, 2);
      expect(at75).toBeCloseTo(1.25, 2);
    });
  });

  // ===========================================================================
  // UTILITY TESTS
  // ===========================================================================

  describe('daysBetween', () => {
    it('should calculate days between dates', () => {
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-08');
      expect(daysBetween(from, to)).toBe(7);
    });

    it('should return 0 for same day', () => {
      const date = new Date('2025-01-01');
      expect(daysBetween(date, date)).toBe(0);
    });

    it('should handle partial days (floor)', () => {
      const from = new Date('2025-01-01T00:00:00');
      const to = new Date('2025-01-01T23:59:59');
      expect(daysBetween(from, to)).toBe(0);
    });
  });

  // ===========================================================================
  // CONSTANTS VALIDATION
  // ===========================================================================

  describe('constants', () => {
    it('should have correct base drain values', () => {
      expect(CONSTANTS.BASE_DRAIN.basketball).toBe(40);
      expect(CONSTANTS.BASE_DRAIN.soccer).toBe(20);
      expect(CONSTANTS.BASE_DRAIN.baseball).toBe(10);
    });

    it('should have soccer position modifiers summing reasonably', () => {
      const mods = Object.values(CONSTANTS.SOCCER_POSITION_MOD);
      const avg = mods.reduce((a, b) => a + b, 0) / mods.length;
      expect(avg).toBeGreaterThan(0.8);
      expect(avg).toBeLessThan(1.2);
    });

    it('should have recovery constants set correctly', () => {
      expect(CONSTANTS.BASE_DAILY_RECOVERY).toBeCloseTo(4.3, 1);
      expect(CONSTANTS.MIN_FITNESS).toBe(10);
      expect(CONSTANTS.MAX_FITNESS).toBe(100);
    });
  });
});
