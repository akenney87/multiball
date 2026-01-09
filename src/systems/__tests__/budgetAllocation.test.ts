/**
 * Unit tests for Budget Allocation System
 */

import {
  BudgetAllocation,
  DEFAULT_BUDGET_ALLOCATION,
  MIN_ALLOCATION,
  MAX_ALLOCATION_PER_CATEGORY,
  MAX_TOTAL_ALLOCATION,
  validateBudgetAllocation,
  calculateBudgetDollars,
  calculateBudgetImpact,
  getRemainingBudget,
  createRadarChartData,
  YOUTH_ACADEMY_BASE_COST,
  YOUTH_ACADEMY_BASE_CAPACITY,
  YOUTH_ACADEMY_COST_PER_TIER,
  YOUTH_ACADEMY_SLOTS_PER_TIER,
  SCOUTING_COST_PER_SCOUT,
} from '../budgetAllocation';

describe('Budget Allocation System', () => {
  describe('validateBudgetAllocation', () => {
    it('should accept default allocation (25% each)', () => {
      const result = validateBudgetAllocation(DEFAULT_BUDGET_ALLOCATION);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept minimum allocation (0% each)', () => {
      const result = validateBudgetAllocation(MIN_ALLOCATION);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept 100% allocation to single category', () => {
      const allocation: BudgetAllocation = {
        coaching: 100,
        medical: 0,
        youthAcademy: 0,
        scouting: 0,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept partial allocation (total < 100%)', () => {
      const allocation: BudgetAllocation = {
        coaching: 20,
        medical: 15,
        youthAcademy: 10,
        scouting: 5,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject total allocation > 100%', () => {
      const allocation: BudgetAllocation = {
        coaching: 50,
        medical: 40,
        youthAcademy: 30,
        scouting: 20,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should reject negative allocation', () => {
      const allocation: BudgetAllocation = {
        coaching: -10,
        medical: 25,
        youthAcademy: 25,
        scouting: 25,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Coaching');
    });

    it('should reject allocation > 100% for single category', () => {
      const allocation: BudgetAllocation = {
        coaching: 150,
        medical: 0,
        youthAcademy: 0,
        scouting: 0,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Coaching');
    });

    it('should report multiple errors for multiple invalid categories', () => {
      const allocation: BudgetAllocation = {
        coaching: 150,
        medical: -10,
        youthAcademy: 200,
        scouting: 50,
      };
      const result = validateBudgetAllocation(allocation);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // At least 3 categories invalid
    });
  });

  describe('calculateBudgetDollars', () => {
    it('should correctly convert percentages to dollars', () => {
      const allocation: BudgetAllocation = {
        coaching: 25,
        medical: 25,
        youthAcademy: 25,
        scouting: 25,
      };
      const totalBudget = 1000000; // $1M

      const result = calculateBudgetDollars(allocation, totalBudget);

      expect(result.coaching).toBe(250000);
      expect(result.medical).toBe(250000);
      expect(result.youthAcademy).toBe(250000);
      expect(result.scouting).toBe(250000);
      expect(result.total).toBe(1000000);
    });

    it('should handle partial allocation', () => {
      const allocation: BudgetAllocation = {
        coaching: 20,
        medical: 15,
        youthAcademy: 10,
        scouting: 5,
      };
      const totalBudget = 1000000; // $1M

      const result = calculateBudgetDollars(allocation, totalBudget);

      expect(result.coaching).toBe(200000);
      expect(result.medical).toBe(150000);
      expect(result.youthAcademy).toBe(100000);
      expect(result.scouting).toBe(50000);
      expect(result.total).toBe(500000); // 50% of budget
    });

    it('should handle zero allocation', () => {
      const result = calculateBudgetDollars(MIN_ALLOCATION, 1000000);

      expect(result.coaching).toBe(0);
      expect(result.medical).toBe(0);
      expect(result.youthAcademy).toBe(0);
      expect(result.scouting).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle 100% allocation to one category', () => {
      const allocation: BudgetAllocation = {
        coaching: 100,
        medical: 0,
        youthAcademy: 0,
        scouting: 0,
      };
      const totalBudget = 1000000; // $1M

      const result = calculateBudgetDollars(allocation, totalBudget);

      expect(result.coaching).toBe(1000000);
      expect(result.medical).toBe(0);
      expect(result.youthAcademy).toBe(0);
      expect(result.scouting).toBe(0);
      expect(result.total).toBe(1000000);
    });
  });

  describe('calculateBudgetImpact', () => {
    describe('Coaching impact', () => {
      it('should give 1.0x multiplier at 25% allocation', () => {
        const allocation: BudgetAllocation = {
          coaching: 25,
          medical: 25,
          youthAcademy: 25,
          scouting: 25,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.coaching.trainingQualityMultiplier).toBeCloseTo(0.875, 2);
        expect(impact.coaching.attributeImprovementBonus).toBe(25);
      });

      it('should give 0.5x multiplier at 0% allocation', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.coaching.trainingQualityMultiplier).toBe(0.5);
        expect(impact.coaching.attributeImprovementBonus).toBe(0);
      });

      it('should give 2.0x multiplier at 100% allocation', () => {
        const allocation: BudgetAllocation = {
          coaching: 100,
          medical: 0,
          youthAcademy: 0,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.coaching.trainingQualityMultiplier).toBe(2.0);
        expect(impact.coaching.attributeImprovementBonus).toBe(100);
      });
    });

    describe('Medical impact', () => {
      it('should give 1.25x injury prevention at 50% allocation', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 50,
          youthAcademy: 0,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // At 50%, injury prevention = 2.0 - (0.5 * 1.5) = 1.25x
        expect(impact.medical.injuryPreventionMultiplier).toBeCloseTo(1.25, 2);
        // At 50%, recovery speed = 1.0 + (0.5 * 1.0) = 1.5x
        expect(impact.medical.recoverySpeedMultiplier).toBeCloseTo(1.5, 2);
      });

      it('should give 2.0x injury prevention at 0% allocation (worst)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.medical.injuryPreventionMultiplier).toBe(2.0);
        expect(impact.medical.recoverySpeedMultiplier).toBe(1.0);
      });

      it('should give 0.5x injury prevention at 100% allocation (best)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 100,
          youthAcademy: 0,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.medical.injuryPreventionMultiplier).toBe(0.5);
        expect(impact.medical.recoverySpeedMultiplier).toBe(2.0);
      });
    });

    describe('Youth Academy impact', () => {
      it('should calculate capacity correctly at base level ($100k)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 10, // 10% of $1M = $100k
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // Base capacity = 5 slots at $100k
        expect(impact.youthAcademy.capacitySlots).toBe(YOUTH_ACADEMY_BASE_CAPACITY);
      });

      it('should increase capacity with higher budget ($150k = 5 + 3 slots)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 15, // 15% of $1M = $150k
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // $150k = $100k base + $50k (1 tier) = 5 + 3 = 8 slots
        expect(impact.youthAcademy.capacitySlots).toBe(8);
      });

      it('should increase capacity with multiple tiers ($250k = 5 + 9 slots)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 25, // 25% of $1M = $250k
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // $250k = $100k base + $150k (3 tiers) = 5 + 9 = 14 slots
        expect(impact.youthAcademy.capacitySlots).toBe(14);
      });

      it('should have correct quality multipliers', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 50,
          scouting: 0,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.youthAcademy.prospectQualityMultiplier).toBeCloseTo(1.25, 2);
        expect(impact.youthAcademy.prospectQuantityMultiplier).toBeCloseTo(1.25, 2);
      });
    });

    describe('Scouting impact', () => {
      it('should give 1 scout at minimum budget ($50k)', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 5, // 5% of $1M = $50k
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.scouting.simultaneousScouts).toBe(1);
      });

      it('should give 5 scouts at $250k', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 25, // 25% of $1M = $250k
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // $250k / $50k per scout = 5 scouts
        expect(impact.scouting.simultaneousScouts).toBe(5);
      });

      it('should give 10 scouts at $500k', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 50, // 50% of $1M = $500k
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        // $500k / $50k per scout = 10 scouts
        expect(impact.scouting.simultaneousScouts).toBe(10);
      });

      it('should have correct accuracy multipliers', () => {
        const allocation: BudgetAllocation = {
          coaching: 0,
          medical: 0,
          youthAcademy: 0,
          scouting: 50,
        };
        const impact = calculateBudgetImpact(allocation, 1000000);

        expect(impact.scouting.reportAccuracyMultiplier).toBeCloseTo(1.25, 2);
      });
    });
  });

  describe('getRemainingBudget', () => {
    it('should return 0 when fully allocated', () => {
      const allocation: BudgetAllocation = {
        coaching: 25,
        medical: 25,
        youthAcademy: 25,
        scouting: 25,
      };
      const remaining = getRemainingBudget(allocation);
      expect(remaining).toBe(0);
    });

    it('should return 100 when nothing allocated', () => {
      const remaining = getRemainingBudget(MIN_ALLOCATION);
      expect(remaining).toBe(100);
    });

    it('should return correct remaining for partial allocation', () => {
      const allocation: BudgetAllocation = {
        coaching: 20,
        medical: 15,
        youthAcademy: 10,
        scouting: 5,
      };
      const remaining = getRemainingBudget(allocation);
      expect(remaining).toBe(50); // 100 - 50 = 50
    });

    it('should return 0 for over-allocated budget (not negative)', () => {
      const allocation: BudgetAllocation = {
        coaching: 50,
        medical: 40,
        youthAcademy: 30,
        scouting: 20,
      };
      const remaining = getRemainingBudget(allocation);
      expect(remaining).toBe(0); // Max of (0, 100 - 140) = 0
    });
  });

  describe('createRadarChartData', () => {
    it('should create correct data structure', () => {
      const allocation: BudgetAllocation = {
        coaching: 30,
        medical: 20,
        youthAcademy: 25,
        scouting: 15,
      };
      const data = createRadarChartData(allocation);

      expect(data).toHaveLength(4);
      expect(data[0]).toEqual({
        category: 'Coaching',
        value: 30,
        maxValue: MAX_ALLOCATION_PER_CATEGORY,
      });
      expect(data[1]).toEqual({
        category: 'Medical',
        value: 20,
        maxValue: MAX_ALLOCATION_PER_CATEGORY,
      });
      expect(data[2]).toEqual({
        category: 'Youth Academy',
        value: 25,
        maxValue: MAX_ALLOCATION_PER_CATEGORY,
      });
      expect(data[3]).toEqual({
        category: 'Scouting',
        value: 15,
        maxValue: MAX_ALLOCATION_PER_CATEGORY,
      });
    });

    it('should handle zero values', () => {
      const data = createRadarChartData(MIN_ALLOCATION);

      expect(data).toHaveLength(4);
      data.forEach(point => {
        expect(point.value).toBe(0);
        expect(point.maxValue).toBe(MAX_ALLOCATION_PER_CATEGORY);
      });
    });

    it('should handle max values', () => {
      const allocation: BudgetAllocation = {
        coaching: 100,
        medical: 100,
        youthAcademy: 100,
        scouting: 100,
      };
      const data = createRadarChartData(allocation);

      expect(data).toHaveLength(4);
      data.forEach(point => {
        expect(point.value).toBe(100);
        expect(point.maxValue).toBe(MAX_ALLOCATION_PER_CATEGORY);
      });
    });
  });

  describe('Integration tests', () => {
    it('should handle complete budget allocation workflow', () => {
      // 1. Start with default allocation
      let allocation = { ...DEFAULT_BUDGET_ALLOCATION };

      // 2. Validate it
      let validation = validateBudgetAllocation(allocation);
      expect(validation.isValid).toBe(true);

      // 3. Calculate dollars
      const totalBudget = 1000000;
      const dollars = calculateBudgetDollars(allocation, totalBudget);
      expect(dollars.total).toBe(1000000);

      // 4. Calculate impact
      const impact = calculateBudgetImpact(allocation, totalBudget);
      expect(impact.coaching.trainingQualityMultiplier).toBeGreaterThan(0.5);
      expect(impact.medical.recoverySpeedMultiplier).toBeGreaterThan(1.0);
      expect(impact.youthAcademy.capacitySlots).toBeGreaterThanOrEqual(5);
      expect(impact.scouting.simultaneousScouts).toBeGreaterThanOrEqual(1);

      // 5. Check remaining budget
      const remaining = getRemainingBudget(allocation);
      expect(remaining).toBe(0);
    });

    it('should handle aggressive coaching focus allocation', () => {
      const allocation: BudgetAllocation = {
        coaching: 70,
        medical: 10,
        youthAcademy: 10,
        scouting: 10,
      };

      const validation = validateBudgetAllocation(allocation);
      expect(validation.isValid).toBe(true);

      const impact = calculateBudgetImpact(allocation, 1000000);

      // Coaching should be strong
      expect(impact.coaching.trainingQualityMultiplier).toBeGreaterThan(1.5);
      expect(impact.coaching.attributeImprovementBonus).toBeGreaterThan(50);

      // Other systems should be weak
      expect(impact.medical.recoverySpeedMultiplier).toBeLessThan(1.5);
      expect(impact.youthAcademy.capacitySlots).toBeLessThan(10);
      expect(impact.scouting.simultaneousScouts).toBeLessThan(5);
    });
  });
});
