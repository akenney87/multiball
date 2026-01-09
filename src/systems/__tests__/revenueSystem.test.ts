/**
 * Unit tests for Revenue System
 */

import {
  SeasonPerformance,
  DIVISION_MULTIPLIERS,
  BASE_REVENUE_PER_WIN,
  WIN_PERCENTAGE_THRESHOLDS,
  PRIZE_MONEY_BY_POSITION,
  calculateWeeklyRevenue,
  calculateSeasonEndRevenue,
  calculateTotalSeasonRevenue,
  estimateSeasonRevenue,
  getWinPercentageMultiplier,
} from '../revenueSystem';

describe('Revenue System', () => {
  describe('Division multipliers', () => {
    it('should have correct division multipliers', () => {
      expect(DIVISION_MULTIPLIERS[1]).toBe(5.0);  // Division 1 (elite)
      expect(DIVISION_MULTIPLIERS[2]).toBe(3.0);
      expect(DIVISION_MULTIPLIERS[3]).toBe(2.0);
      expect(DIVISION_MULTIPLIERS[4]).toBe(1.5);
      expect(DIVISION_MULTIPLIERS[5]).toBe(1.0);  // Division 5 (starting)
    });

    it('should have higher multipliers for higher divisions', () => {
      expect(DIVISION_MULTIPLIERS[1]).toBeGreaterThan(DIVISION_MULTIPLIERS[2]);
      expect(DIVISION_MULTIPLIERS[2]).toBeGreaterThan(DIVISION_MULTIPLIERS[3]);
      expect(DIVISION_MULTIPLIERS[3]).toBeGreaterThan(DIVISION_MULTIPLIERS[4]);
      expect(DIVISION_MULTIPLIERS[4]).toBeGreaterThan(DIVISION_MULTIPLIERS[5]);
    });
  });

  describe('Prize money', () => {
    it('should have highest prize for 1st place', () => {
      expect(PRIZE_MONEY_BY_POSITION[1]).toBe(500000);
    });

    it('should have decreasing prizes for lower positions', () => {
      expect(PRIZE_MONEY_BY_POSITION[1]).toBeGreaterThan(PRIZE_MONEY_BY_POSITION[2]);
      expect(PRIZE_MONEY_BY_POSITION[2]).toBeGreaterThan(PRIZE_MONEY_BY_POSITION[3]);
      expect(PRIZE_MONEY_BY_POSITION[3]).toBeGreaterThan(PRIZE_MONEY_BY_POSITION[4]);
    });

    it('should have minimal prize for relegated teams', () => {
      expect(PRIZE_MONEY_BY_POSITION[19]).toBe(10000);
      expect(PRIZE_MONEY_BY_POSITION[20]).toBe(10000);
    });

    it('should have all positions defined (1-20)', () => {
      for (let pos = 1; pos <= 20; pos++) {
        expect(PRIZE_MONEY_BY_POSITION[pos]).toBeDefined();
        expect(PRIZE_MONEY_BY_POSITION[pos]).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateWeeklyRevenue', () => {
    it('should calculate correct revenue for Division 5 (base)', () => {
      const revenue = calculateWeeklyRevenue(1, 5);
      expect(revenue).toBe(BASE_REVENUE_PER_WIN * 1);  // $50k
    });

    it('should apply division multiplier correctly', () => {
      const div5Revenue = calculateWeeklyRevenue(1, 5);
      const div1Revenue = calculateWeeklyRevenue(1, 1);

      expect(div1Revenue).toBe(div5Revenue * DIVISION_MULTIPLIERS[1]);
    });

    it('should scale with number of wins', () => {
      const oneWin = calculateWeeklyRevenue(1, 5);
      const threeWins = calculateWeeklyRevenue(3, 5);

      expect(threeWins).toBe(oneWin * 3);
    });

    it('should handle zero wins', () => {
      const revenue = calculateWeeklyRevenue(0, 5);
      expect(revenue).toBe(0);
    });

    it('should demonstrate division progression value', () => {
      const div5 = calculateWeeklyRevenue(1, 5);
      const div4 = calculateWeeklyRevenue(1, 4);
      const div3 = calculateWeeklyRevenue(1, 3);
      const div2 = calculateWeeklyRevenue(1, 2);
      const div1 = calculateWeeklyRevenue(1, 1);

      expect(div1).toBeGreaterThan(div2);
      expect(div2).toBeGreaterThan(div3);
      expect(div3).toBeGreaterThan(div4);
      expect(div4).toBeGreaterThan(div5);
    });
  });

  describe('getWinPercentageMultiplier', () => {
    it('should give 1.5x for excellent performance (70%+)', () => {
      expect(getWinPercentageMultiplier(0.70)).toBe(1.5);
      expect(getWinPercentageMultiplier(0.80)).toBe(1.5);
      expect(getWinPercentageMultiplier(1.0)).toBe(1.5);
    });

    it('should give 1.25x for good performance (60-69%)', () => {
      expect(getWinPercentageMultiplier(0.60)).toBe(1.25);
      expect(getWinPercentageMultiplier(0.65)).toBe(1.25);
      expect(getWinPercentageMultiplier(0.69)).toBe(1.25);
    });

    it('should give 1.0x for average performance (50-59%)', () => {
      expect(getWinPercentageMultiplier(0.50)).toBe(1.0);
      expect(getWinPercentageMultiplier(0.55)).toBe(1.0);
      expect(getWinPercentageMultiplier(0.59)).toBe(1.0);
    });

    it('should give 0.85x for poor performance (40-49%)', () => {
      expect(getWinPercentageMultiplier(0.40)).toBe(0.85);
      expect(getWinPercentageMultiplier(0.45)).toBe(0.85);
      expect(getWinPercentageMultiplier(0.49)).toBe(0.85);
    });

    it('should give 0.7x for terrible performance (<40%)', () => {
      expect(getWinPercentageMultiplier(0.39)).toBe(0.7);
      expect(getWinPercentageMultiplier(0.20)).toBe(0.7);
      expect(getWinPercentageMultiplier(0.0)).toBe(0.7);
    });
  });

  describe('calculateSeasonEndRevenue', () => {
    it('should calculate revenue for average Division 5 season', () => {
      const performance: SeasonPerformance = {
        wins: 28,
        losses: 29,
        division: 5,
        leaguePosition: 10,
      };

      const revenue = calculateSeasonEndRevenue(performance);

      expect(revenue.ticketSales).toBeGreaterThan(0);
      expect(revenue.merchandise).toBeGreaterThan(0);
      expect(revenue.sponsorships).toBeGreaterThan(0);
      expect(revenue.prizeMoney).toBe(PRIZE_MONEY_BY_POSITION[10]);
      expect(revenue.total).toBe(
        revenue.ticketSales + revenue.merchandise + revenue.sponsorships + revenue.prizeMoney
      );
    });

    it('should give higher revenue for winning seasons', () => {
      const winning: SeasonPerformance = {
        wins: 40,
        losses: 17,
        division: 5,
        leaguePosition: 3,
      };

      const losing: SeasonPerformance = {
        wins: 17,
        losses: 40,
        division: 5,
        leaguePosition: 18,
      };

      const winningRevenue = calculateSeasonEndRevenue(winning);
      const losingRevenue = calculateSeasonEndRevenue(losing);

      expect(winningRevenue.total).toBeGreaterThan(losingRevenue.total);
      expect(winningRevenue.prizeMoney).toBeGreaterThan(losingRevenue.prizeMoney);
    });

    it('should give massive revenue boost for higher divisions', () => {
      const div5Champion: SeasonPerformance = {
        wins: 45,
        losses: 12,
        division: 5,
        leaguePosition: 1,
      };

      const div1Champion: SeasonPerformance = {
        wins: 45,
        losses: 12,
        division: 1,
        leaguePosition: 1,
      };

      const div5Revenue = calculateSeasonEndRevenue(div5Champion);
      const div1Revenue = calculateSeasonEndRevenue(div1Champion);

      // Division 1 should earn roughly 5x more (excluding prize money which is the same)
      expect(div1Revenue.ticketSales).toBeGreaterThan(div5Revenue.ticketSales * 4);
      expect(div1Revenue.merchandise).toBeGreaterThan(div5Revenue.merchandise * 4);
      expect(div1Revenue.sponsorships).toBeGreaterThan(div5Revenue.sponsorships * 4);
    });

    it('should apply win percentage bonus correctly', () => {
      const excellent: SeasonPerformance = {
        wins: 45,  // 78.9% win rate
        losses: 12,
        division: 5,
        leaguePosition: 1,
      };

      const average: SeasonPerformance = {
        wins: 30,  // 52.6% win rate
        losses: 27,
        division: 5,
        leaguePosition: 10,
      };

      const excellentRevenue = calculateSeasonEndRevenue(excellent);
      const averageRevenue = calculateSeasonEndRevenue(average);

      // Excellent performance should have bonus applied
      // (Note: also has more wins and better position, so multiply effects)
      expect(excellentRevenue.total).toBeGreaterThan(averageRevenue.total);
    });

    it('should include all revenue sources', () => {
      const performance: SeasonPerformance = {
        wins: 30,
        losses: 27,
        division: 3,
        leaguePosition: 5,
      };

      const revenue = calculateSeasonEndRevenue(performance);

      expect(revenue.ticketSales).toBeGreaterThan(0);
      expect(revenue.merchandise).toBeGreaterThan(0);
      expect(revenue.sponsorships).toBeGreaterThan(0);
      expect(revenue.prizeMoney).toBeGreaterThan(0);
    });

    it('should handle winless season', () => {
      const performance: SeasonPerformance = {
        wins: 0,
        losses: 57,
        division: 5,
        leaguePosition: 20,
      };

      const revenue = calculateSeasonEndRevenue(performance);

      // Should still get minimal prize money
      expect(revenue.ticketSales).toBe(0);
      expect(revenue.merchandise).toBe(0);
      expect(revenue.sponsorships).toBe(0);
      expect(revenue.prizeMoney).toBe(PRIZE_MONEY_BY_POSITION[20]);
      expect(revenue.total).toBe(PRIZE_MONEY_BY_POSITION[20]);
    });

    it('should handle perfect season', () => {
      const performance: SeasonPerformance = {
        wins: 57,
        losses: 0,
        division: 1,
        leaguePosition: 1,
      };

      const revenue = calculateSeasonEndRevenue(performance);

      expect(revenue.total).toBeGreaterThan(10000000);  // Over $10M for perfect Division 1 season
    });
  });

  describe('calculateTotalSeasonRevenue', () => {
    it('should combine weekly and season-end revenue', () => {
      const weeklyTotal = 1000000;  // $1M earned weekly
      const performance: SeasonPerformance = {
        wins: 35,
        losses: 22,
        division: 4,
        leaguePosition: 6,
      };

      const total = calculateTotalSeasonRevenue(weeklyTotal, performance);
      const seasonEnd = calculateSeasonEndRevenue(performance);

      expect(total.total).toBe(seasonEnd.total + weeklyTotal);
      expect(total.ticketSales).toBe(seasonEnd.ticketSales + weeklyTotal);
    });

    it('should handle zero weekly revenue', () => {
      const performance: SeasonPerformance = {
        wins: 30,
        losses: 27,
        division: 5,
        leaguePosition: 10,
      };

      const total = calculateTotalSeasonRevenue(0, performance);
      const seasonEnd = calculateSeasonEndRevenue(performance);

      expect(total.total).toBe(seasonEnd.total);
    });
  });

  describe('estimateSeasonRevenue', () => {
    it('should estimate revenue for projected performance', () => {
      const estimate = estimateSeasonRevenue(35, 3, 5);

      expect(estimate.ticketSales).toBeGreaterThan(0);
      expect(estimate.merchandise).toBeGreaterThan(0);
      expect(estimate.sponsorships).toBeGreaterThan(0);
      expect(estimate.prizeMoney).toBe(PRIZE_MONEY_BY_POSITION[5]);
      expect(estimate.total).toBeGreaterThan(0);
    });

    it('should assume 57 total games', () => {
      // 35 wins means 22 losses (57 total)
      const estimate = estimateSeasonRevenue(35, 5, 10);
      const actual = calculateSeasonEndRevenue({
        wins: 35,
        losses: 22,
        division: 5,
        leaguePosition: 10,
      });

      expect(estimate.total).toBe(actual.total);
    });

    it('should help with budget planning', () => {
      // User can estimate revenue for different scenarios
      const optimistic = estimateSeasonRevenue(45, 4, 3);  // 45 wins, finish 3rd
      const realistic = estimateSeasonRevenue(32, 4, 10);  // 32 wins, finish 10th
      const pessimistic = estimateSeasonRevenue(20, 4, 18); // 20 wins, finish 18th

      expect(optimistic.total).toBeGreaterThan(realistic.total);
      expect(realistic.total).toBeGreaterThan(pessimistic.total);
    });
  });

  describe('Integration tests', () => {
    it('should demonstrate complete season revenue flow', () => {
      // Simulate a season in Division 5
      let weeklyRevenue = 0;

      // Simulate 57 matches (19 opponents × 3 sports)
      // Assume 35 wins over the season
      for (let week = 0; week < 57; week++) {
        // Assume ~1 win per 1.6 weeks (35/57 = 0.614 win rate)
        const winsThisWeek = Math.random() < 0.614 ? 1 : 0;
        weeklyRevenue += calculateWeeklyRevenue(winsThisWeek, 5);
      }

      const performance: SeasonPerformance = {
        wins: 35,
        losses: 22,
        division: 5,
        leaguePosition: 8,
      };

      const seasonEnd = calculateSeasonEndRevenue(performance);
      const total = calculateTotalSeasonRevenue(weeklyRevenue, performance);

      // Total should be substantial
      expect(total.total).toBeGreaterThan(1000000);  // Over $1M for good Division 5 season
    });

    it('should show progression value (Division 5 → Division 1)', () => {
      const performance: SeasonPerformance = {
        wins: 40,
        losses: 17,
        division: 5,
        leaguePosition: 3,
      };

      const div5Revenue = calculateSeasonEndRevenue({ ...performance, division: 5 });
      const div4Revenue = calculateSeasonEndRevenue({ ...performance, division: 4 });
      const div3Revenue = calculateSeasonEndRevenue({ ...performance, division: 3 });
      const div2Revenue = calculateSeasonEndRevenue({ ...performance, division: 2 });
      const div1Revenue = calculateSeasonEndRevenue({ ...performance, division: 1 });

      // Each promotion should significantly increase revenue
      expect(div1Revenue.total).toBeGreaterThan(div2Revenue.total);
      expect(div2Revenue.total).toBeGreaterThan(div3Revenue.total);
      expect(div3Revenue.total).toBeGreaterThan(div4Revenue.total);
      expect(div4Revenue.total).toBeGreaterThan(div5Revenue.total);

      // Division 1 should earn significantly more than Division 5
      expect(div1Revenue.total).toBeGreaterThan(div5Revenue.total * 3);
    });

    it('should incentivize both winning and promotion', () => {
      // Scenario A: Win Division 5 (1st place)
      const winDiv5: SeasonPerformance = {
        wins: 50,
        losses: 7,
        division: 5,
        leaguePosition: 1,
      };

      // Scenario B: Mid-table Division 3 (10th place)
      const midDiv3: SeasonPerformance = {
        wins: 30,
        losses: 27,
        division: 3,
        leaguePosition: 10,
      };

      const div5Revenue = calculateSeasonEndRevenue(winDiv5);
      const div3Revenue = calculateSeasonEndRevenue(midDiv3);

      // Both strategies have merit - winning lower division vs surviving higher division
      // Revenue should reflect this strategic choice
      expect(div5Revenue.total).toBeGreaterThan(0);
      expect(div3Revenue.total).toBeGreaterThan(0);
    });
  });
});
