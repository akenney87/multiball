/**
 * Manager Rating System
 *
 * Tracks manager career performance for leaderboard comparisons.
 *
 * Scoring:
 * - Base points: 20 for 1st place, 19 for 2nd, ... 1 for 20th
 * - Division multiplier: Div 1 = 2.0x, Div 5 = 1.2x, Div 7 = 1.0x, Div 10 = 0.7x
 * - Championship bonus: +10 pts
 * - Promotion bonus: +5 pts
 * - Relegation penalty: -5 pts
 *
 * @module systems/managerRatingSystem
 */

import type {
  SeasonRating,
  ManagerCareer,
  LeaderboardEntry,
} from '../data/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Division multipliers for scoring
 * Higher divisions = more points
 */
const DIVISION_MULTIPLIERS: Record<number, number> = {
  1: 2.0,
  2: 1.6,
  3: 1.4,
  4: 1.2,
  5: 1.1,
  6: 1.05,
  7: 1.0,
  8: 0.9,
  9: 0.8,
  10: 0.7,
};

/** Bonus points for winning championship (1st place) */
const CHAMPIONSHIP_BONUS = 10;

/** Bonus points for promotion (top 3) */
const PROMOTION_BONUS = 5;

/** Penalty points for relegation (bottom 3) */
const RELEGATION_PENALTY = -5;

// =============================================================================
// SEASON RATING CALCULATION
// =============================================================================

/**
 * Calculate the manager rating for a completed season
 */
export function calculateSeasonRating(
  seasonNumber: number,
  division: number,
  finishPosition: number,
  wasPromoted: boolean,
  wasRelegated: boolean
): SeasonRating {
  // Base points: 20 for 1st, 19 for 2nd, ... 1 for 20th
  const basePoints = 21 - finishPosition;

  // Division multiplier
  const divisionMultiplier = DIVISION_MULTIPLIERS[division] ?? 1.0;

  // Bonus points
  let bonusPoints = 0;
  if (finishPosition === 1) {
    bonusPoints += CHAMPIONSHIP_BONUS;
  }
  if (wasPromoted) {
    bonusPoints += PROMOTION_BONUS;
  }

  // Penalty points
  let penaltyPoints = 0;
  if (wasRelegated) {
    penaltyPoints += Math.abs(RELEGATION_PENALTY);
  }

  // Total points = (base * multiplier) + bonus - penalty
  const totalPoints = Math.round(basePoints * divisionMultiplier) + bonusPoints - penaltyPoints;

  return {
    seasonNumber,
    division,
    finishPosition,
    basePoints,
    divisionMultiplier,
    bonusPoints,
    penaltyPoints,
    totalPoints: Math.max(0, totalPoints), // Can't go negative
  };
}

// =============================================================================
// CAREER MANAGEMENT
// =============================================================================

/**
 * Create a new manager career
 */
export function createManagerCareer(name: string, startingDivision: number): ManagerCareer {
  return {
    name,
    id: `career-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    seasonRatings: [],
    totalPoints: 0,
    bestSeasonPoints: 0,
    bestSeasonNumber: 0,
    championships: 0,
    promotions: 0,
    relegations: 0,
    highestDivision: startingDivision,
    currentDivision: startingDivision,
    seasonsPlayed: 0,
    startDate: new Date(),
    lastUpdated: new Date(),
  };
}

/**
 * Update career with a completed season
 */
export function updateManagerCareer(
  career: ManagerCareer,
  seasonRating: SeasonRating,
  newDivision: number
): ManagerCareer {
  const updatedRatings = [...career.seasonRatings, seasonRating];
  const totalPoints = updatedRatings.reduce((sum, r) => sum + r.totalPoints, 0);

  // Check if this is the best season
  const isBestSeason = seasonRating.totalPoints > career.bestSeasonPoints;

  // Track promotion/relegation/championship
  const wasChampionship = seasonRating.finishPosition === 1;
  const wasPromotion = seasonRating.bonusPoints >= PROMOTION_BONUS;
  const wasRelegation = seasonRating.penaltyPoints > 0;

  return {
    ...career,
    seasonRatings: updatedRatings,
    totalPoints,
    bestSeasonPoints: isBestSeason ? seasonRating.totalPoints : career.bestSeasonPoints,
    bestSeasonNumber: isBestSeason ? seasonRating.seasonNumber : career.bestSeasonNumber,
    championships: career.championships + (wasChampionship ? 1 : 0),
    promotions: career.promotions + (wasPromotion ? 1 : 0),
    relegations: career.relegations + (wasRelegation ? 1 : 0),
    highestDivision: Math.min(career.highestDivision, newDivision),
    currentDivision: newDivision,
    seasonsPlayed: career.seasonsPlayed + 1,
    lastUpdated: new Date(),
  };
}

// =============================================================================
// LEADERBOARD GENERATION
// =============================================================================

/**
 * Leaderboard categories
 */
export type LeaderboardCategory =
  | 'first_season'
  | 'single_season'
  | 'three_seasons'
  | 'five_seasons'
  | 'ten_seasons';

/**
 * Get points for a specific leaderboard category
 */
export function getCategoryPoints(career: ManagerCareer, category: LeaderboardCategory): number {
  const ratings = career.seasonRatings;

  switch (category) {
    case 'first_season':
      return ratings[0]?.totalPoints ?? 0;

    case 'single_season':
      return career.bestSeasonPoints;

    case 'three_seasons':
      return ratings.slice(0, 3).reduce((sum, r) => sum + r.totalPoints, 0);

    case 'five_seasons':
      return ratings.slice(0, 5).reduce((sum, r) => sum + r.totalPoints, 0);

    case 'ten_seasons':
      return ratings.slice(0, 10).reduce((sum, r) => sum + r.totalPoints, 0);

    default:
      return 0;
  }
}

/**
 * Get context string for leaderboard display
 */
function getCategoryContext(career: ManagerCareer, category: LeaderboardCategory): string {
  const ratings = career.seasonRatings;

  switch (category) {
    case 'first_season':
      if (ratings[0]) {
        const r = ratings[0];
        return `Div ${r.division}, ${getOrdinal(r.finishPosition)} place`;
      }
      return '';

    case 'single_season':
      if (career.bestSeasonNumber > 0) {
        const best = ratings.find(r => r.seasonNumber === career.bestSeasonNumber);
        if (best) {
          return `Season ${best.seasonNumber}, Div ${best.division}`;
        }
      }
      return '';

    case 'three_seasons':
    case 'five_seasons':
    case 'ten_seasons':
      const count = category === 'three_seasons' ? 3 : category === 'five_seasons' ? 5 : 10;
      const actual = Math.min(count, ratings.length);
      return `${actual} season${actual !== 1 ? 's' : ''}`;

    default:
      return '';
  }
}

/**
 * Generate leaderboard entries for a category
 */
export function generateLeaderboard(
  userCareer: ManagerCareer | null,
  category: LeaderboardCategory
): LeaderboardEntry[] {
  // Pre-generated fictional managers with realistic scores
  const fictionalManagers = getFictionalManagers(category);

  // Build entries list
  const entries: LeaderboardEntry[] = fictionalManagers.map((m) => ({
    name: m.name,
    id: m.id,
    points: m.points,
    rank: 0, // Will be set after sorting
    context: m.context,
    isUser: false,
  }));

  // Add user if they have data for this category
  if (userCareer && userCareer.seasonsPlayed > 0) {
    const userPoints = getCategoryPoints(userCareer, category);
    const meetsMinimum = meetsMinimumRequirement(userCareer, category);

    if (meetsMinimum && userPoints > 0) {
      entries.push({
        name: userCareer.name,
        id: userCareer.id,
        points: userPoints,
        rank: 0,
        context: getCategoryContext(userCareer, category),
        isUser: true,
      });
    }
  }

  // Sort by points descending
  entries.sort((a, b) => b.points - a.points);

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Check if career meets minimum requirement for a category
 */
function meetsMinimumRequirement(career: ManagerCareer, category: LeaderboardCategory): boolean {
  switch (category) {
    case 'first_season':
    case 'single_season':
      return career.seasonsPlayed >= 1;
    case 'three_seasons':
      return career.seasonsPlayed >= 3;
    case 'five_seasons':
      return career.seasonsPlayed >= 5;
    case 'ten_seasons':
      return career.seasonsPlayed >= 10;
    default:
      return false;
  }
}

// =============================================================================
// FICTIONAL MANAGERS (Pre-populated leaderboard)
// =============================================================================

interface FictionalManager {
  name: string;
  id: string;
  points: number;
  context: string;
}

/**
 * Get fictional managers for leaderboard comparison
 * These represent realistic scores players might achieve
 */
function getFictionalManagers(category: LeaderboardCategory): FictionalManager[] {
  switch (category) {
    case 'first_season':
      return [
        { name: 'Alex Ferguson', id: 'npc-1', points: 38, context: 'Div 5, 1st place' },
        { name: 'Pep Guardiola', id: 'npc-2', points: 35, context: 'Div 6, 1st place' },
        { name: 'Carlo Ancelotti', id: 'npc-3', points: 32, context: 'Div 6, 2nd place' },
        { name: 'Jurgen Klopp', id: 'npc-4', points: 30, context: 'Div 7, 1st place' },
        { name: 'Jose Mourinho', id: 'npc-5', points: 28, context: 'Div 7, 2nd place' },
        { name: 'Zinedine Zidane', id: 'npc-6', points: 26, context: 'Div 7, 3rd place' },
        { name: 'Antonio Conte', id: 'npc-7', points: 24, context: 'Div 7, 5th place' },
        { name: 'Thomas Tuchel', id: 'npc-8', points: 22, context: 'Div 7, 7th place' },
        { name: 'Diego Simeone', id: 'npc-9', points: 20, context: 'Div 7, 9th place' },
        { name: 'Arsene Wenger', id: 'npc-10', points: 18, context: 'Div 7, 11th place' },
      ];

    case 'single_season':
      return [
        { name: 'Alex Ferguson', id: 'npc-1', points: 50, context: 'Season 12, Div 1' },
        { name: 'Pep Guardiola', id: 'npc-2', points: 48, context: 'Season 8, Div 1' },
        { name: 'Carlo Ancelotti', id: 'npc-3', points: 45, context: 'Season 15, Div 1' },
        { name: 'Jurgen Klopp', id: 'npc-4', points: 42, context: 'Season 6, Div 2' },
        { name: 'Jose Mourinho', id: 'npc-5', points: 40, context: 'Season 10, Div 2' },
        { name: 'Zinedine Zidane', id: 'npc-6', points: 38, context: 'Season 5, Div 3' },
        { name: 'Antonio Conte', id: 'npc-7', points: 36, context: 'Season 7, Div 3' },
        { name: 'Thomas Tuchel', id: 'npc-8', points: 34, context: 'Season 4, Div 4' },
        { name: 'Diego Simeone', id: 'npc-9', points: 32, context: 'Season 9, Div 4' },
        { name: 'Arsene Wenger', id: 'npc-10', points: 30, context: 'Season 11, Div 5' },
      ];

    case 'three_seasons':
      return [
        { name: 'Alex Ferguson', id: 'npc-1', points: 125, context: '3 seasons' },
        { name: 'Pep Guardiola', id: 'npc-2', points: 115, context: '3 seasons' },
        { name: 'Carlo Ancelotti', id: 'npc-3', points: 105, context: '3 seasons' },
        { name: 'Jurgen Klopp', id: 'npc-4', points: 95, context: '3 seasons' },
        { name: 'Jose Mourinho', id: 'npc-5', points: 88, context: '3 seasons' },
        { name: 'Zinedine Zidane', id: 'npc-6', points: 82, context: '3 seasons' },
        { name: 'Antonio Conte', id: 'npc-7', points: 76, context: '3 seasons' },
        { name: 'Thomas Tuchel', id: 'npc-8', points: 70, context: '3 seasons' },
        { name: 'Diego Simeone', id: 'npc-9', points: 65, context: '3 seasons' },
        { name: 'Arsene Wenger', id: 'npc-10', points: 60, context: '3 seasons' },
      ];

    case 'five_seasons':
      return [
        { name: 'Alex Ferguson', id: 'npc-1', points: 220, context: '5 seasons' },
        { name: 'Pep Guardiola', id: 'npc-2', points: 200, context: '5 seasons' },
        { name: 'Carlo Ancelotti', id: 'npc-3', points: 185, context: '5 seasons' },
        { name: 'Jurgen Klopp', id: 'npc-4', points: 170, context: '5 seasons' },
        { name: 'Jose Mourinho', id: 'npc-5', points: 155, context: '5 seasons' },
        { name: 'Zinedine Zidane', id: 'npc-6', points: 142, context: '5 seasons' },
        { name: 'Antonio Conte', id: 'npc-7', points: 130, context: '5 seasons' },
        { name: 'Thomas Tuchel', id: 'npc-8', points: 120, context: '5 seasons' },
        { name: 'Diego Simeone', id: 'npc-9', points: 110, context: '5 seasons' },
        { name: 'Arsene Wenger', id: 'npc-10', points: 100, context: '5 seasons' },
      ];

    case 'ten_seasons':
      return [
        { name: 'Alex Ferguson', id: 'npc-1', points: 480, context: '10 seasons' },
        { name: 'Pep Guardiola', id: 'npc-2', points: 440, context: '10 seasons' },
        { name: 'Carlo Ancelotti', id: 'npc-3', points: 400, context: '10 seasons' },
        { name: 'Jurgen Klopp', id: 'npc-4', points: 365, context: '10 seasons' },
        { name: 'Jose Mourinho', id: 'npc-5', points: 335, context: '10 seasons' },
        { name: 'Zinedine Zidane', id: 'npc-6', points: 305, context: '10 seasons' },
        { name: 'Antonio Conte', id: 'npc-7', points: 280, context: '10 seasons' },
        { name: 'Thomas Tuchel', id: 'npc-8', points: 255, context: '10 seasons' },
        { name: 'Diego Simeone', id: 'npc-9', points: 235, context: '10 seasons' },
        { name: 'Arsene Wenger', id: 'npc-10', points: 215, context: '10 seasons' },
      ];

    default:
      return [];
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get ordinal string (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th');
}
