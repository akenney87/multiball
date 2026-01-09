/**
 * Revenue System
 *
 * Calculates franchise revenue based on:
 * - Performance (win/loss record)
 * - Division level (Division 5 = lowest, Division 1 = highest)
 * - League finish position (1st to 20th)
 *
 * Revenue sources (all automatic):
 * - Ticket sales (based on wins)
 * - Merchandise (based on wins + division)
 * - Sponsorships (based on wins + division)
 * - Prize money (based on final league position)
 *
 * Design Philosophy:
 * - Simple performance-based formula
 * - Tunable parameters for balancing
 * - Higher division = significantly more revenue
 * - Win percentage bonuses encourage excellence
 */

/**
 * Complete revenue breakdown showing all sources
 */
export interface RevenueBreakdown {
  ticketSales: number;
  merchandise: number;
  sponsorships: number;
  prizeMoney: number;
  total: number;
}

/**
 * Season performance data
 */
export interface SeasonPerformance {
  wins: number;
  losses: number;
  division: number;        // 1-5 (1 = highest, 5 = lowest)
  leaguePosition: number;  // 1-20 (1 = first place, 20 = last place)
}

// Division multipliers (higher division = more revenue)
// Climbing divisions significantly increases revenue potential
export const DIVISION_MULTIPLIERS: Record<number, number> = {
  1: 5.0,   // Division 1 (elite) - 5x base revenue
  2: 3.0,   // Division 2 - 3x base revenue
  3: 2.0,   // Division 3 - 2x base revenue
  4: 1.5,   // Division 4 - 1.5x base revenue
  5: 1.0,   // Division 5 (starting division) - 1x base revenue
};

// Base revenue per win for weekly calculations (in dollars)
export const BASE_REVENUE_PER_WIN = 50000;  // $50k per win

// Win percentage thresholds for bonus multipliers
export const WIN_PERCENTAGE_THRESHOLDS = {
  excellent: 0.70,  // 70%+ win rate = 1.5x bonus
  good: 0.60,       // 60%+ win rate = 1.25x bonus
  average: 0.50,    // 50%+ win rate = 1.0x (no bonus)
  poor: 0.40,       // 40%+ win rate = 0.85x penalty
  terrible: 0,      // <40% win rate = 0.7x penalty
};

// Prize money by league position (in dollars)
// Top finishers get substantial rewards, relegation zone gets minimal
export const PRIZE_MONEY_BY_POSITION: Record<number, number> = {
  1: 500000,   // Champion: $500k
  2: 350000,   // Runner-up: $350k
  3: 250000,   // 3rd place: $250k
  4: 150000,   // 4th-6th: $150k
  5: 150000,
  6: 150000,
  7: 100000,   // 7th-10th: $100k
  8: 100000,
  9: 100000,
  10: 100000,
  11: 50000,   // 11th-15th: $50k
  12: 50000,
  13: 50000,
  14: 50000,
  15: 50000,
  16: 25000,   // 16th-18th: $25k (relegation zone)
  17: 25000,
  18: 25000,
  19: 10000,   // 19th-20th: $10k (relegated)
  20: 10000,
};

/**
 * Calculates weekly revenue based on match results
 *
 * Called after each match to calculate immediate revenue
 *
 * @param wins - Number of wins this week
 * @param division - Current division (1-5)
 * @returns Weekly revenue
 */
export function calculateWeeklyRevenue(wins: number, division: number): number {
  const divisionMultiplier = DIVISION_MULTIPLIERS[division] || 1.0;

  // Weekly revenue = base per win * wins * division multiplier
  const revenue = BASE_REVENUE_PER_WIN * wins * divisionMultiplier;

  return Math.round(revenue);
}

/**
 * Calculates season-end revenue breakdown
 *
 * Called at the end of the season to calculate final bonuses and totals
 *
 * @param performance - Season performance data
 * @returns Complete revenue breakdown
 */
export function calculateSeasonEndRevenue(performance: SeasonPerformance): RevenueBreakdown {
  const { wins, losses, division, leaguePosition } = performance;
  const totalGames = wins + losses;
  const winPercentage = totalGames > 0 ? wins / totalGames : 0;

  // Division multiplier
  const divisionMultiplier = DIVISION_MULTIPLIERS[division] || 1.0;

  // Win percentage multiplier (encourages excellence)
  let winPctMultiplier = 0.7;  // Default (terrible performance)
  if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.excellent) {
    winPctMultiplier = 1.5;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.good) {
    winPctMultiplier = 1.25;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.average) {
    winPctMultiplier = 1.0;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.poor) {
    winPctMultiplier = 0.85;
  }

  // Ticket sales: Based on wins and division
  const baseTicketRevenue = wins * 30000;  // $30k per win
  const ticketSales = Math.round(baseTicketRevenue * divisionMultiplier * winPctMultiplier);

  // Merchandise: Based on wins and division (smaller than tickets)
  const baseMerchandiseRevenue = wins * 15000;  // $15k per win
  const merchandise = Math.round(baseMerchandiseRevenue * divisionMultiplier * winPctMultiplier);

  // Sponsorships: Based on wins and division (largest revenue source)
  const baseSponsorshipRevenue = wins * 50000;  // $50k per win
  const sponsorships = Math.round(baseSponsorshipRevenue * divisionMultiplier * winPctMultiplier);

  // Prize money: Based on league position (fixed amounts)
  const prizeMoney = PRIZE_MONEY_BY_POSITION[leaguePosition] || 0;

  const total = ticketSales + merchandise + sponsorships + prizeMoney;

  return {
    ticketSales,
    merchandise,
    sponsorships,
    prizeMoney,
    total,
  };
}

/**
 * Calculates total season revenue (weekly + season-end)
 *
 * Combines weekly revenues earned throughout the season with season-end bonuses
 *
 * @param weeklyRevenueTotal - Sum of all weekly revenues
 * @param performance - Season performance data
 * @returns Complete season revenue breakdown
 */
export function calculateTotalSeasonRevenue(
  weeklyRevenueTotal: number,
  performance: SeasonPerformance
): RevenueBreakdown {
  const seasonEnd = calculateSeasonEndRevenue(performance);

  return {
    ticketSales: seasonEnd.ticketSales + weeklyRevenueTotal,
    merchandise: seasonEnd.merchandise,
    sponsorships: seasonEnd.sponsorships,
    prizeMoney: seasonEnd.prizeMoney,
    total: seasonEnd.total + weeklyRevenueTotal,
  };
}

/**
 * Estimates expected season revenue based on projected performance
 *
 * Useful for budget planning and financial projections
 *
 * @param projectedWins - Expected number of wins
 * @param division - Current division (1-5)
 * @param projectedPosition - Expected league finish (1-20)
 * @returns Estimated revenue breakdown
 */
export function estimateSeasonRevenue(
  projectedWins: number,
  division: number,
  projectedPosition: number
): RevenueBreakdown {
  // Total games per season: 19 opponents × 3 sports = 57 games
  const totalGames = 57;
  const projectedLosses = totalGames - projectedWins;

  return calculateSeasonEndRevenue({
    wins: projectedWins,
    losses: projectedLosses,
    division,
    leaguePosition: projectedPosition,
  });
}

/**
 * Gets win percentage bonus multiplier for a given win rate
 *
 * @param winPercentage - Win rate (0.0 to 1.0)
 * @returns Revenue multiplier (0.7 to 1.5)
 */
export function getWinPercentageMultiplier(winPercentage: number): number {
  if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.excellent) {
    return 1.5;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.good) {
    return 1.25;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.average) {
    return 1.0;
  } else if (winPercentage >= WIN_PERCENTAGE_THRESHOLDS.poor) {
    return 0.85;
  }
  return 0.7;
}
