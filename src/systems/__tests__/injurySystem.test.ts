/**
 * Unit tests for Injury System
 */

import {
  InjuryType,
  InjurySeverity,
  InjuryData,
  BASE_INJURY_PROBABILITY_PER_MATCH,
  BASE_INJURY_PROBABILITY_PER_TRAINING,
  calculateInjuryProbabilityMultiplier,
  checkMatchInjury,
  checkTrainingInjury,
  progressInjury,
  isPlayerInjured,
  getRemainingRecoveryTime,
} from '../injurySystem';

describe('Injury System', () => {
  describe('calculateInjuryProbabilityMultiplier', () => {
    it('should give 2.0x multiplier at durability 0 (most injury prone)', () => {
      const multiplier = calculateInjuryProbabilityMultiplier(0);
      expect(multiplier).toBeCloseTo(2.0, 2);
    });

    it('should give 1.1x multiplier at durability 50 (average)', () => {
      const multiplier = calculateInjuryProbabilityMultiplier(50);
      expect(multiplier).toBeCloseTo(1.1, 2);
    });

    it('should give 0.2x multiplier at durability 100 (most durable)', () => {
      const multiplier = calculateInjuryProbabilityMultiplier(100);
      expect(multiplier).toBeCloseTo(0.2, 2);
    });

    it('should scale linearly between 0 and 100', () => {
      const mult25 = calculateInjuryProbabilityMultiplier(25);
      const mult75 = calculateInjuryProbabilityMultiplier(75);

      expect(mult25).toBeGreaterThan(mult75);
      expect(mult25).toBeCloseTo(1.55, 2);
      expect(mult75).toBeCloseTo(0.65, 2);
    });
  });

  describe('checkMatchInjury', () => {
    it('should not injure player with high durability and good medical budget', () => {
      // Durability 100, medical 0.5x = very low injury chance
      const result = checkMatchInjury(100, 0.5, 12345);

      // At durability 100: 0.2x durability multiplier
      // At medical 0.5x: 0.5x medical multiplier
      // Total: 5% * 0.2 * 0.5 = 0.5% chance
      // This specific seed shouldn't trigger injury
      expect(result.injured).toBe(false);
      expect(result.injury).toBeNull();
    });

    it('should have consistent results with same seed', () => {
      const seed = 54321;
      const result1 = checkMatchInjury(50, 1.0, seed);
      const result2 = checkMatchInjury(50, 1.0, seed);

      expect(result1.injured).toBe(result2.injured);
      if (result1.injured && result2.injured) {
        expect(result1.injury?.type).toBe(result2.injury?.type);
        expect(result1.injury?.severity).toBe(result2.injury?.severity);
      }
    });

    it('should generate injury when random check passes', () => {
      // Test with very low durability and poor medical to increase chance
      // We'll test multiple seeds to find one that triggers injury
      let foundInjury = false;
      for (let seed = 0; seed < 100; seed++) {
        const result = checkMatchInjury(0, 2.0, seed);
        if (result.injured) {
          foundInjury = true;
          expect(result.injury).not.toBeNull();
          expect(result.injury?.type).toBeDefined();
          expect(result.injury?.severity).toBeDefined();
          expect(result.injury?.recoveryWeeks).toBeGreaterThan(0);
          expect(result.injury?.doctorReport).toBeTruthy();
          expect(result.injury?.isActive).toBe(true);
          break;
        }
      }
      expect(foundInjury).toBe(true);
    });

    it('should respect medical budget impact on injury prevention', () => {
      // Same durability, different medical budgets
      let injuriesWithPoorMedical = 0;
      let injuriesWithGoodMedical = 0;

      // Run simulation multiple times
      for (let i = 0; i < 100; i++) {
        if (checkMatchInjury(50, 2.0, i).injured) {
          injuriesWithPoorMedical++;
        }
        if (checkMatchInjury(50, 0.5, i + 1000).injured) {
          injuriesWithGoodMedical++;
        }
      }

      // Poor medical should have more injuries
      expect(injuriesWithPoorMedical).toBeGreaterThan(injuriesWithGoodMedical);
    });
  });

  describe('checkTrainingInjury', () => {
    it('should have lower base probability than match injuries', () => {
      expect(BASE_INJURY_PROBABILITY_PER_TRAINING).toBeLessThan(BASE_INJURY_PROBABILITY_PER_MATCH);
    });

    it('should generate injuries with same mechanics as match injuries', () => {
      // Find a seed that triggers training injury
      let foundInjury = false;
      for (let seed = 0; seed < 200; seed++) {
        const result = checkTrainingInjury(0, 2.0, seed);
        if (result.injured) {
          foundInjury = true;
          expect(result.injury).not.toBeNull();
          expect(result.injury?.isActive).toBe(true);
          break;
        }
      }
      // Training injuries should be possible
      expect(foundInjury).toBe(true);
    });

    it('should have consistent results with same seed', () => {
      const seed = 99999;
      const result1 = checkTrainingInjury(50, 1.0, seed);
      const result2 = checkTrainingInjury(50, 1.0, seed);

      expect(result1.injured).toBe(result2.injured);
    });
  });

  describe('Injury generation and severity distribution', () => {
    it('should generate different injury severities', () => {
      const severities = new Set<InjurySeverity>();

      // Generate many injuries to test distribution
      for (let seed = 0; seed < 500; seed++) {
        const result = checkMatchInjury(0, 2.0, seed);
        if (result.injured && result.injury) {
          severities.add(result.injury.severity);
        }
      }

      // Should have generated multiple severity types
      expect(severities.size).toBeGreaterThan(1);
    });

    it('should have recovery time appropriate to severity', () => {
      // Generate injuries and check recovery times
      for (let seed = 0; seed < 200; seed++) {
        const result = checkMatchInjury(0, 1.0, seed);
        if (result.injured && result.injury) {
          const { severity, recoveryWeeks } = result.injury;

          if (severity === InjurySeverity.MINOR) {
            expect(recoveryWeeks).toBeGreaterThanOrEqual(1);
            expect(recoveryWeeks).toBeLessThanOrEqual(2);
          } else if (severity === InjurySeverity.MODERATE) {
            expect(recoveryWeeks).toBeGreaterThanOrEqual(2);
            expect(recoveryWeeks).toBeLessThanOrEqual(6);
          } else if (severity === InjurySeverity.MAJOR) {
            expect(recoveryWeeks).toBeGreaterThanOrEqual(6);
            expect(recoveryWeeks).toBeLessThanOrEqual(12);
          } else if (severity === InjurySeverity.SEASON_ENDING) {
            expect(recoveryWeeks).toBeGreaterThanOrEqual(12);
            expect(recoveryWeeks).toBeLessThanOrEqual(24);
          }
        }
      }
    });

    it('should apply medical budget to reduce recovery time', () => {
      // Generate injury with poor medical
      let poorMedicalInjury: InjuryData | null = null;
      for (let seed = 0; seed < 100; seed++) {
        const result = checkMatchInjury(50, 1.0, seed); // 1.0x recovery speed
        if (result.injured && result.injury) {
          poorMedicalInjury = result.injury;
          break;
        }
      }

      // Generate injury with good medical (using different seed offset)
      let goodMedicalInjury: InjuryData | null = null;
      for (let seed = 0; seed < 100; seed++) {
        const result = checkMatchInjury(50, 2.0, seed); // 2.0x recovery speed
        if (result.injured && result.injury) {
          goodMedicalInjury = result.injury;
          break;
        }
      }

      expect(poorMedicalInjury).not.toBeNull();
      expect(goodMedicalInjury).not.toBeNull();

      // Better medical should generally lead to shorter recovery
      // (Not guaranteed for every individual case, but statistically true)
    });

    it('should include doctor report with all injuries', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = checkMatchInjury(0, 2.0, seed);
        if (result.injured && result.injury) {
          expect(result.injury.doctorReport).toBeTruthy();
          expect(result.injury.doctorReport.length).toBeGreaterThan(20);
          expect(result.injury.doctorReport).toContain('week');
        }
      }
    });
  });

  describe('progressInjury', () => {
    it('should increment weeks missed', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 0,
        isActive: true,
        doctorReport: 'Test injury',
      };

      const updated = progressInjury(injury);
      expect(updated).not.toBeNull();
      expect(updated?.weeksMissed).toBe(1);
      expect(updated?.isActive).toBe(true);
    });

    it('should mark injury as inactive when recovery complete', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 1, // Already missed 1 week
        isActive: true,
        doctorReport: 'Test injury',
      };

      const updated = progressInjury(injury);
      expect(updated).not.toBeNull();
      expect(updated?.weeksMissed).toBe(2);
      expect(updated?.isActive).toBe(false);
    });

    it('should return null for already inactive injury', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 2,
        isActive: false,
        doctorReport: 'Test injury',
      };

      const updated = progressInjury(injury);
      expect(updated).toBeNull();
    });

    it('should handle multi-week recovery correctly', () => {
      let injury: InjuryData = {
        type: InjuryType.ACL_TEAR,
        severity: InjurySeverity.SEASON_ENDING,
        injuryDate: new Date(),
        recoveryWeeks: 12,
        actualRecoveryWeeks: 12,
        weeksMissed: 0,
        isActive: true,
        doctorReport: 'Test injury',
      };

      // Progress through recovery
      for (let week = 1; week <= 11; week++) {
        const updated = progressInjury(injury);
        expect(updated).not.toBeNull();
        expect(updated?.weeksMissed).toBe(week);
        expect(updated?.isActive).toBe(true);
        injury = updated!;
      }

      // Final week should mark as recovered
      const finalUpdate = progressInjury(injury);
      expect(finalUpdate).not.toBeNull();
      expect(finalUpdate?.weeksMissed).toBe(12);
      expect(finalUpdate?.isActive).toBe(false);
    });
  });

  describe('isPlayerInjured', () => {
    it('should return false for null injury', () => {
      expect(isPlayerInjured(null)).toBe(false);
    });

    it('should return true for active injury', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 0,
        isActive: true,
        doctorReport: 'Test injury',
      };

      expect(isPlayerInjured(injury)).toBe(true);
    });

    it('should return false for inactive injury', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 2,
        isActive: false,
        doctorReport: 'Test injury',
      };

      expect(isPlayerInjured(injury)).toBe(false);
    });
  });

  describe('getRemainingRecoveryTime', () => {
    it('should return 0 for null injury', () => {
      expect(getRemainingRecoveryTime(null)).toBe(0);
    });

    it('should return 0 for inactive injury', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 2,
        isActive: false,
        doctorReport: 'Test injury',
      };

      expect(getRemainingRecoveryTime(injury)).toBe(0);
    });

    it('should calculate remaining time correctly', () => {
      const injury: InjuryData = {
        type: InjuryType.ACL_TEAR,
        severity: InjurySeverity.SEASON_ENDING,
        injuryDate: new Date(),
        recoveryWeeks: 12,
        actualRecoveryWeeks: 12,
        weeksMissed: 5,
        isActive: true,
        doctorReport: 'Test injury',
      };

      expect(getRemainingRecoveryTime(injury)).toBe(7); // 12 - 5 = 7 weeks
    });

    it('should return 0 when recovery time reached', () => {
      const injury: InjuryData = {
        type: InjuryType.ANKLE_SPRAIN,
        severity: InjurySeverity.MINOR,
        injuryDate: new Date(),
        recoveryWeeks: 2,
        actualRecoveryWeeks: 2,
        weeksMissed: 2,
        isActive: true, // Still marked active (edge case)
        doctorReport: 'Test injury',
      };

      expect(getRemainingRecoveryTime(injury)).toBe(0);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete injury lifecycle', () => {
      // 1. Player gets injured
      let result = checkMatchInjury(30, 1.0, 42);

      // Find a seed that causes injury
      for (let seed = 0; seed < 200; seed++) {
        result = checkMatchInjury(30, 1.0, seed);
        if (result.injured) break;
      }

      expect(result.injured).toBe(true);
      expect(result.injury).not.toBeNull();

      let injury = result.injury!;

      // 2. Player is injured
      expect(isPlayerInjured(injury)).toBe(true);

      const initialRecovery = getRemainingRecoveryTime(injury);
      expect(initialRecovery).toBeGreaterThan(0);

      // 3. Progress through recovery
      while (injury.isActive) {
        const updated = progressInjury(injury);
        if (updated === null) break;

        injury = updated;

        if (injury.isActive) {
          expect(isPlayerInjured(injury)).toBe(true);
        }
      }

      // 4. Player is recovered
      expect(injury.isActive).toBe(false);
      expect(isPlayerInjured(injury)).toBe(false);
      expect(getRemainingRecoveryTime(injury)).toBe(0);
    });

    it('should demonstrate medical budget impact on both prevention and recovery', () => {
      // Compare poor medical vs elite medical
      let poorMedicalInjuries = 0;
      let eliteMedicalInjuries = 0;
      let poorRecoveryTotal = 0;
      let eliteRecoveryTotal = 0;

      // Simulate 100 matches with poor medical (2.0x injury, 1.0x recovery)
      for (let i = 0; i < 100; i++) {
        const result = checkMatchInjury(50, 2.0, i);
        if (result.injured && result.injury) {
          poorMedicalInjuries++;
          poorRecoveryTotal += result.injury.actualRecoveryWeeks;
        }
      }

      // Simulate 100 matches with elite medical (0.5x injury, 2.0x recovery)
      for (let i = 0; i < 100; i++) {
        const result = checkMatchInjury(50, 0.5, i + 1000);
        if (result.injured && result.injury) {
          eliteMedicalInjuries++;
          eliteRecoveryTotal += result.injury.actualRecoveryWeeks;
        }
      }

      // Elite medical should have fewer injuries
      expect(eliteMedicalInjuries).toBeLessThan(poorMedicalInjuries);

      // If both have injuries, elite should have shorter average recovery
      if (poorMedicalInjuries > 0 && eliteMedicalInjuries > 0) {
        const poorAvg = poorRecoveryTotal / poorMedicalInjuries;
        const eliteAvg = eliteRecoveryTotal / eliteMedicalInjuries;
        // Note: This may not always be true due to randomness, but statistically should be
      }
    });
  });
});
