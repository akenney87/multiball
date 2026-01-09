/**
 * Unit tests for Contract System
 */

import {
  Contract,
  ContractOffer,
  ContractDemands,
  BASE_VALUE_PER_RATING_POINT,
  SALARY_PERCENTAGE,
  AGE_MULTIPLIERS,
  MULTI_SPORT_BONUS,
  MIN_CONTRACT_LENGTH,
  MAX_CONTRACT_LENGTH,
  calculateMarketValue,
  calculateAnnualSalary,
  calculatePlayerValuation,
  generatePlayerDemands,
  evaluateContractOffer,
  generateCounterOffer,
  createContract,
  advanceContract,
  isContractExpiringSoon,
  calculateTotalContractValue,
} from '../contractSystem';

describe('Contract System', () => {
  describe('calculateMarketValue', () => {
    it('should calculate base value correctly', () => {
      // Rating 50 → $500k base
      const value = calculateMarketValue(50, 26, 50, 1);
      const baseValue = (50 / 100) * 1000000;
      expect(value).toBeGreaterThanOrEqual(baseValue);
    });

    it('should apply age multipliers correctly', () => {
      const baseRating = 70;
      const basePotential = 70;

      const youngValue = calculateMarketValue(baseRating, 20, basePotential, 1);  // 1.5x
      const primeValue = calculateMarketValue(baseRating, 26, basePotential, 1);  // 2.0x
      const veteranValue = calculateMarketValue(baseRating, 30, basePotential, 1); // 1.5x
      const agingValue = calculateMarketValue(baseRating, 35, basePotential, 1);   // 1.0x

      expect(primeValue).toBeGreaterThan(youngValue);
      expect(youngValue).toBeGreaterThan(agingValue);
      expect(veteranValue).toBeGreaterThan(agingValue);
    });

    it('should apply potential modifier correctly', () => {
      const baseRating = 60;
      const age = 26; // Prime

      const lowPotential = calculateMarketValue(baseRating, age, 60, 1);  // No modifier (1.0)
      const highPotential = calculateMarketValue(baseRating, age, 80, 1); // +0.2 modifier (1.2)

      expect(highPotential).toBeGreaterThan(lowPotential);
      expect(highPotential).toBeCloseTo(lowPotential * 1.2, -2);
    });

    it('should apply multi-sport bonus correctly', () => {
      const baseRating = 70;
      const age = 26;
      const potential = 70;

      const oneSport = calculateMarketValue(baseRating, age, potential, 1);    // 1.0x
      const twoSports = calculateMarketValue(baseRating, age, potential, 2);   // 1.2x
      const threeSports = calculateMarketValue(baseRating, age, potential, 3); // 1.4x

      expect(twoSports).toBeGreaterThan(oneSport);
      expect(threeSports).toBeGreaterThan(twoSports);
      expect(twoSports).toBeCloseTo(oneSport * 1.2, -2);
      expect(threeSports).toBeCloseTo(oneSport * 1.4, -2);
    });

    it('should value prime-age players highest', () => {
      const rating = 75;
      const potential = 75;

      const values = [
        calculateMarketValue(rating, 20, potential, 1),  // Young
        calculateMarketValue(rating, 26, potential, 1),  // Prime
        calculateMarketValue(rating, 30, potential, 1),  // Veteran
        calculateMarketValue(rating, 35, potential, 1),  // Aging
      ];

      const primeValue = values[1];
      expect(primeValue).toBe(Math.max(...values));
    });
  });

  describe('calculateAnnualSalary', () => {
    it('should calculate 20% of market value', () => {
      const marketValue = 1000000;
      const salary = calculateAnnualSalary(marketValue);
      expect(salary).toBe(200000);
    });

    it('should round to nearest dollar', () => {
      const marketValue = 1234567;
      const salary = calculateAnnualSalary(marketValue);
      expect(salary).toBe(Math.round(1234567 * 0.2));
    });

    it('should handle small values', () => {
      const marketValue = 100000;
      const salary = calculateAnnualSalary(marketValue);
      expect(salary).toBe(20000);
    });
  });

  describe('calculatePlayerValuation', () => {
    it('should return both market value and salary', () => {
      const result = calculatePlayerValuation(75, 26, 80, 2);

      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.annualSalary).toBeGreaterThan(0);
      expect(result.annualSalary).toBeCloseTo(result.marketValue * 0.2, -2);
    });

    it('should produce realistic valuations', () => {
      // Elite prime player
      const elite = calculatePlayerValuation(90, 26, 95, 3);

      // Average veteran
      const average = calculatePlayerValuation(60, 30, 60, 1);

      // Young prospect
      const prospect = calculatePlayerValuation(50, 20, 75, 1);

      expect(elite.marketValue).toBeGreaterThan(average.marketValue);
      expect(elite.annualSalary).toBeGreaterThan(average.annualSalary);
      expect(prospect.marketValue).toBeGreaterThan(average.marketValue); // High potential
    });
  });

  describe('generatePlayerDemands', () => {
    it('should demand 10-20% above calculated salary', () => {
      const calculatedSalary = 200000;
      const demands = generatePlayerDemands(calculatedSalary, 26);

      expect(demands.minAnnualSalary).toBeGreaterThanOrEqual(calculatedSalary * 1.1);
      expect(demands.minAnnualSalary).toBeLessThanOrEqual(calculatedSalary * 1.2);
    });

    it('should have preferred contract length between 2-5 years', () => {
      const demands = generatePlayerDemands(200000, 26);

      expect(demands.preferredLength).toBeGreaterThanOrEqual(2);
      expect(demands.preferredLength).toBeLessThanOrEqual(5);
    });

    it('should demand signing bonus of 10-20% of salary', () => {
      const calculatedSalary = 200000;
      const demands = generatePlayerDemands(calculatedSalary, 26);

      expect(demands.minSigningBonus).toBeGreaterThanOrEqual(calculatedSalary * 0.1);
      expect(demands.minSigningBonus).toBeLessThanOrEqual(calculatedSalary * 0.2);
    });

    it('should have young players prefer longer contracts', () => {
      const youngDemands = generatePlayerDemands(200000, 22);
      const oldDemands = generatePlayerDemands(200000, 33);

      // Young players generally want 4-5 years
      expect(youngDemands.preferredLength).toBeGreaterThanOrEqual(4);

      // Old players generally want 2-3 years
      expect(oldDemands.preferredLength).toBeLessThanOrEqual(3);
    });
  });

  describe('evaluateContractOffer', () => {
    const baseDemands: ContractDemands = {
      minAnnualSalary: 200000,
      preferredLength: 3,
      minSigningBonus: 20000,
    };

    it('should accept offer meeting all demands', () => {
      const offer: ContractOffer = {
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(true);
    });

    it('should reject offer below minimum salary', () => {
      const offer: ContractOffer = {
        annualSalary: 190000,  // Below minimum
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(false);
    });

    it('should reject offer with poor signing bonus', () => {
      const offer: ContractOffer = {
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 10000,  // Too low (< 80% of minimum)
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(false);
    });

    it('should accept offer with contract length within 1 year of preference', () => {
      const offer: ContractOffer = {
        annualSalary: 220000,
        contractLength: 4,  // 1 year more than preferred (3)
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(true);
    });

    it('should reject offer with contract length too different from preference', () => {
      const offer: ContractOffer = {
        annualSalary: 210000,  // Not enough compensation
        contractLength: 5,  // 2 years more than preferred (3)
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(false);
    });

    it('should accept offer with poor length if salary compensates', () => {
      const offer: ContractOffer = {
        annualSalary: 230000,  // 15% above minimum (enough to compensate)
        contractLength: 5,  // 2 years more than preferred
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      expect(evaluateContractOffer(offer, baseDemands)).toBe(true);
    });
  });

  describe('generateCounterOffer', () => {
    const baseDemands: ContractDemands = {
      minAnnualSalary: 220000,
      preferredLength: 4,
      minSigningBonus: 25000,
    };

    it('should counter with salary between offer and demand', () => {
      const previousOffer: ContractOffer = {
        annualSalary: 180000,
        contractLength: 3,
        signingBonus: 15000,
        performanceBonus: 5000,
        releaseClause: 0,
      };

      const counter = generateCounterOffer(previousOffer, baseDemands, 1);

      expect(counter.annualSalary).toBeGreaterThan(previousOffer.annualSalary);
      expect(counter.annualSalary).toBeLessThanOrEqual(baseDemands.minAnnualSalary);
    });

    it('should move contract length toward preference', () => {
      const previousOffer: ContractOffer = {
        annualSalary: 200000,
        contractLength: 2,  // Below preferred (4)
        signingBonus: 20000,
        performanceBonus: 5000,
        releaseClause: 0,
      };

      const counter = generateCounterOffer(previousOffer, baseDemands, 1);

      expect(counter.contractLength).toBeGreaterThan(previousOffer.contractLength);
      expect(counter.contractLength).toBeLessThanOrEqual(baseDemands.preferredLength);
    });

    it('should become more flexible in later rounds', () => {
      const previousOffer: ContractOffer = {
        annualSalary: 180000,
        contractLength: 3,
        signingBonus: 15000,
        performanceBonus: 5000,
        releaseClause: 0,
      };

      const round1Counter = generateCounterOffer(previousOffer, baseDemands, 1);
      const round2Counter = generateCounterOffer(previousOffer, baseDemands, 2);

      // Round 2 should be closer to the original offer (more flexible)
      const round1Gap = round1Counter.annualSalary - previousOffer.annualSalary;
      const round2Gap = round2Counter.annualSalary - previousOffer.annualSalary;

      expect(round2Gap).toBeLessThan(round1Gap);
    });

    it('should not decrease salary below previous offer', () => {
      const previousOffer: ContractOffer = {
        annualSalary: 250000,  // Already above demand
        contractLength: 3,
        signingBonus: 30000,
        performanceBonus: 5000,
        releaseClause: 0,
      };

      const counter = generateCounterOffer(previousOffer, baseDemands, 1);

      expect(counter.annualSalary).toBeGreaterThanOrEqual(previousOffer.annualSalary);
    });
  });

  describe('createContract', () => {
    it('should create contract from accepted offer', () => {
      const offer: ContractOffer = {
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      const contract = createContract('player123', 'John Doe', offer, 2025);

      expect(contract.playerId).toBe('player123');
      expect(contract.playerName).toBe('John Doe');
      expect(contract.annualSalary).toBe(220000);
      expect(contract.contractLength).toBe(3);
      expect(contract.signingBonus).toBe(25000);
      expect(contract.performanceBonus).toBe(10000);
      expect(contract.releaseClause).toBe(1000000);
      expect(contract.yearsSigned).toBe(2025);
      expect(contract.yearsRemaining).toBe(3);
      expect(contract.status).toBe('active');
    });
  });

  describe('advanceContract', () => {
    it('should decrement years remaining', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 3,
        status: 'active',
      };

      const advanced = advanceContract(contract);

      expect(advanced.yearsRemaining).toBe(2);
      expect(advanced.status).toBe('active');
    });

    it('should mark contract as expired when years reach 0', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 1,
        status: 'active',
      };

      const advanced = advanceContract(contract);

      expect(advanced.yearsRemaining).toBe(0);
      expect(advanced.status).toBe('expired');
    });
  });

  describe('isContractExpiringSoon', () => {
    it('should return true for contract with 1 year remaining', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 1,
        status: 'active',
      };

      expect(isContractExpiringSoon(contract)).toBe(true);
    });

    it('should return false for contract with 2+ years remaining', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 2,
        status: 'active',
      };

      expect(isContractExpiringSoon(contract)).toBe(false);
    });

    it('should return false for expired contract', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 0,
        status: 'expired',
      };

      expect(isContractExpiringSoon(contract)).toBe(false);
    });

    it('should support custom warning period', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 220000,
        contractLength: 3,
        signingBonus: 25000,
        performanceBonus: 10000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 2,
        status: 'active',
      };

      expect(isContractExpiringSoon(contract, 2)).toBe(true);
      expect(isContractExpiringSoon(contract, 1)).toBe(false);
    });
  });

  describe('calculateTotalContractValue', () => {
    it('should calculate total value correctly', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 200000,
        contractLength: 3,
        signingBonus: 50000,
        performanceBonus: 20000,
        releaseClause: 1000000,
        yearsSigned: 2025,
        yearsRemaining: 3,
        status: 'active',
      };

      const total = calculateTotalContractValue(contract);

      // (200k × 3) + 50k + (20k × 3) = 600k + 50k + 60k = 710k
      expect(total).toBe(710000);
    });

    it('should handle contract with no bonuses', () => {
      const contract: Contract = {
        playerId: 'player123',
        playerName: 'John Doe',
        annualSalary: 150000,
        contractLength: 2,
        signingBonus: 0,
        performanceBonus: 0,
        releaseClause: 0,
        yearsSigned: 2025,
        yearsRemaining: 2,
        status: 'active',
      };

      const total = calculateTotalContractValue(contract);

      // 150k × 2 = 300k
      expect(total).toBe(300000);
    });
  });

  describe('Integration tests', () => {
    it('should simulate complete contract negotiation', () => {
      // 1. Calculate player valuation
      const valuation = calculatePlayerValuation(75, 26, 80, 2);

      // 2. Generate player demands
      const demands = generatePlayerDemands(valuation.annualSalary, 26);

      // 3. Make initial offer (below demands)
      const initialOffer: ContractOffer = {
        annualSalary: valuation.annualSalary * 0.95,
        contractLength: 3,
        signingBonus: demands.minSigningBonus * 0.8,
        performanceBonus: 10000,
        releaseClause: valuation.marketValue * 2,
      };

      // 4. Player rejects initial offer
      expect(evaluateContractOffer(initialOffer, demands)).toBe(false);

      // 5. Player counters
      const counter = generateCounterOffer(initialOffer, demands, 1);

      // 6. Make improved offer (meet demands)
      const improvedOffer: ContractOffer = {
        annualSalary: demands.minAnnualSalary,  // Meet minimum demand
        contractLength: demands.preferredLength,  // Match preference
        signingBonus: demands.minSigningBonus,    // Meet minimum demand
        performanceBonus: 15000,
        releaseClause: valuation.marketValue * 2,
      };

      // 7. Player accepts improved offer (meets all demands)
      const accepted = evaluateContractOffer(improvedOffer, demands);
      expect(accepted).toBe(true);

      // 8. Create contract
      const contract = createContract('player123', 'John Doe', improvedOffer, 2025);

      expect(contract.status).toBe('active');
      expect(contract.yearsRemaining).toBe(improvedOffer.contractLength);
    });

    it('should demonstrate contract lifecycle', () => {
      // Create 3-year contract
      const offer: ContractOffer = {
        annualSalary: 200000,
        contractLength: 3,
        signingBonus: 20000,
        performanceBonus: 10000,
        releaseClause: 1000000,
      };

      let contract = createContract('player123', 'John Doe', offer, 2025);

      // Year 1
      expect(contract.yearsRemaining).toBe(3);
      expect(contract.status).toBe('active');
      expect(isContractExpiringSoon(contract)).toBe(false);

      // Year 2
      contract = advanceContract(contract);
      expect(contract.yearsRemaining).toBe(2);
      expect(contract.status).toBe('active');
      expect(isContractExpiringSoon(contract)).toBe(false);

      // Year 3 (final year)
      contract = advanceContract(contract);
      expect(contract.yearsRemaining).toBe(1);
      expect(contract.status).toBe('active');
      expect(isContractExpiringSoon(contract)).toBe(true);

      // Contract expires
      contract = advanceContract(contract);
      expect(contract.yearsRemaining).toBe(0);
      expect(contract.status).toBe('expired');
      expect(isContractExpiringSoon(contract)).toBe(false);
    });
  });
});
