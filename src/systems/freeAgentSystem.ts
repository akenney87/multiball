/**
 * Free Agent System
 *
 * Manages the global free agent pool and player acquisition.
 * - Global pool of available players
 * - Pool refresh logic (weekly, seasonal)
 * - Player filtering by sport, position, rating
 * - Tryout system (budget-based frequency)
 * - Integration with Contract System for negotiations
 *
 * Design Philosophy:
 * - Dynamic pool that refreshes regularly
 * - Quality distribution (many low, few high)
 * - Reuses Contract System for valuations
 * - Simple filtering for user convenience
 */

import {
  calculatePlayerValuation,
  ContractDemands,
  generatePlayerDemands,
} from './contractSystem';

/**
 * Free agent player data
 */
export interface FreeAgent {
  id: string;
  name: string;
  age: number;
  overallRating: number;
  position: string;
  primarySport: string;
  sportsRatings: Record<string, number>;  // Sport name → rating
  averagePotential: number;               // Average of physical/mental/technical
  marketValue: number;                    // Calculated market value
  annualSalary: number;                   // Expected annual salary
  demands: ContractDemands;               // Contract demands
  addedDate: number;                      // Week added to pool
}

/**
 * Free agent pool configuration
 */
export interface PoolConfig {
  maxSize: number;                        // Maximum pool size
  minRating: number;                      // Minimum overall rating
  maxRating: number;                      // Maximum overall rating
  refreshRate: number;                    // Players added per week
  expiryWeeks: number;                    // Weeks before player removed
}

/**
 * Pool refresh result
 */
export interface PoolRefreshResult {
  added: FreeAgent[];
  removed: FreeAgent[];
  poolSize: number;
}

/**
 * Filter criteria for searching free agents
 */
export interface FreeAgentFilter {
  minRating?: number;
  maxRating?: number;
  sport?: string;
  position?: string;
  maxAge?: number;
  minAge?: number;
  maxSalary?: number;
}

// Pool configuration constants
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxSize: 100,           // Maximum 100 free agents
  minRating: 40,          // Minimum 40 overall
  maxRating: 85,          // Maximum 85 overall (elite players rarely free agents)
  refreshRate: 10,        // 10 new players per week
  expiryWeeks: 12,        // Players removed after 12 weeks
};

// Rating distribution (weighted toward lower ratings)
export const RATING_DISTRIBUTION = {
  weights: [
    { min: 40, max: 50, weight: 40 },   // 40% chance of 40-50 rating
    { min: 51, max: 60, weight: 30 },   // 30% chance of 51-60 rating
    { min: 61, max: 70, weight: 20 },   // 20% chance of 61-70 rating
    { min: 71, max: 80, weight: 8 },    // 8% chance of 71-80 rating
    { min: 81, max: 85, weight: 2 },    // 2% chance of 81-85 rating
  ],
};

// Available sports (from multi-sport simulation)
export const AVAILABLE_SPORTS = [
  'basketball',
  'volleyball',
  'handball',
  'dodgeball',
];

// Available positions (sport-specific)
export const POSITIONS_BY_SPORT: Record<string, string[]> = {
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  volleyball: ['S', 'OH', 'MB', 'L'],
  handball: ['GK', 'LW', 'RW', 'CB', 'LB', 'RB', 'P'],
  dodgeball: ['T', 'C', 'R'],
};

/**
 * Generates a random rating based on weighted distribution
 *
 * @param seed - Random seed for determinism
 * @returns Overall rating (40-85)
 */
export function generateRandomRating(seed: number): number {
  const random = Math.abs(Math.sin(seed)) % 1;
  let cumulativeWeight = 0;

  for (const tier of RATING_DISTRIBUTION.weights) {
    cumulativeWeight += tier.weight;
    if (random * 100 < cumulativeWeight) {
      // Random rating within tier
      const range = tier.max - tier.min + 1;
      const offset = Math.floor((Math.abs(Math.sin(seed * 1.5)) % 1) * range);
      return tier.min + offset;
    }
  }

  // Fallback (should never reach here)
  return 50;
}

/**
 * Generates a random age weighted toward younger players
 *
 * @param seed - Random seed
 * @returns Age (18-38)
 */
export function generateRandomAge(seed: number): number {
  const random = Math.abs(Math.sin(seed * 2)) % 1;

  // Weighted toward younger players
  if (random < 0.4) return 18 + Math.floor((Math.abs(Math.sin(seed * 2.1)) % 1) * 5);  // 40%: 18-22
  if (random < 0.7) return 23 + Math.floor((Math.abs(Math.sin(seed * 2.2)) % 1) * 5);  // 30%: 23-27
  if (random < 0.9) return 28 + Math.floor((Math.abs(Math.sin(seed * 2.3)) % 1) * 5);  // 20%: 28-32
  return 33 + Math.floor((Math.abs(Math.sin(seed * 2.4)) % 1) * 6);                    // 10%: 33-38
}

/**
 * Generates a random potential based on rating and age
 *
 * @param rating - Overall rating
 * @param age - Player age
 * @param seed - Random seed
 * @returns Average potential (0-100)
 */
export function generateRandomPotential(rating: number, age: number, seed: number): number {
  const random = Math.abs(Math.sin(seed * 3)) % 1;

  // Younger players have higher potential
  let potentialRange: number;
  if (age < 23) {
    potentialRange = 10 + Math.floor(random * 20);  // +10 to +30
  } else if (age < 28) {
    potentialRange = 5 + Math.floor(random * 15);   // +5 to +20
  } else if (age < 33) {
    potentialRange = 0 + Math.floor(random * 10);   // +0 to +10
  } else {
    potentialRange = 0 + Math.floor(random * 5);    // +0 to +5
  }

  return Math.min(100, rating + potentialRange);
}

/**
 * Generates a random primary sport
 *
 * @param seed - Random seed
 * @returns Sport name
 */
export function generateRandomSport(seed: number): string {
  const random = Math.abs(Math.sin(seed * 4)) % 1;
  const index = Math.floor(random * AVAILABLE_SPORTS.length);
  return AVAILABLE_SPORTS[index];
}

/**
 * Generates a random position for a sport
 *
 * @param sport - Sport name
 * @param seed - Random seed
 * @returns Position code
 */
export function generateRandomPosition(sport: string, seed: number): string {
  const positions = POSITIONS_BY_SPORT[sport] || ['PG'];
  const random = Math.abs(Math.sin(seed * 5)) % 1;
  const index = Math.floor(random * positions.length);
  return positions[index];
}

/**
 * Generates sport ratings for a free agent
 *
 * @param primarySport - Primary sport
 * @param primaryRating - Rating in primary sport
 * @param seed - Random seed
 * @returns Sport ratings map
 */
export function generateSportRatings(
  primarySport: string,
  primaryRating: number,
  seed: number
): Record<string, number> {
  const ratings: Record<string, number> = {
    [primarySport]: primaryRating,
  };

  // 30% chance of being good at 2nd sport (50+)
  const random1 = Math.abs(Math.sin(seed * 6)) % 1;
  if (random1 < 0.3) {
    const secondarySports = AVAILABLE_SPORTS.filter(s => s !== primarySport);
    const secondarySport = secondarySports[Math.floor((Math.abs(Math.sin(seed * 6.1)) % 1) * secondarySports.length)];
    ratings[secondarySport] = 50 + Math.floor((Math.abs(Math.sin(seed * 6.2)) % 1) * 20);  // 50-69
  }

  // 10% chance of being good at 3rd sport (50+)
  const random2 = Math.abs(Math.sin(seed * 7)) % 1;
  if (random2 < 0.1) {
    const remainingSports = AVAILABLE_SPORTS.filter(s => !(s in ratings));
    if (remainingSports.length > 0) {
      const thirdSport = remainingSports[Math.floor((Math.abs(Math.sin(seed * 7.1)) % 1) * remainingSports.length)];
      ratings[thirdSport] = 50 + Math.floor((Math.abs(Math.sin(seed * 7.2)) % 1) * 15);  // 50-64
    }
  }

  return ratings;
}

/**
 * Generates a random free agent player
 *
 * @param id - Player ID
 * @param currentWeek - Current game week
 * @param seed - Random seed for determinism
 * @returns Free agent player
 */
export function generateFreeAgent(
  id: string,
  currentWeek: number,
  seed: number
): FreeAgent {
  // Generate basic attributes
  const overallRating = generateRandomRating(seed);
  const age = generateRandomAge(seed);
  const averagePotential = generateRandomPotential(overallRating, age, seed);
  const primarySport = generateRandomSport(seed);
  const position = generateRandomPosition(primarySport, seed);
  const sportsRatings = generateSportRatings(primarySport, overallRating, seed);

  // Count sports above 50 for valuation
  const sportsAbove50 = Object.values(sportsRatings).filter(r => r >= 50).length;

  // Calculate valuation using Contract System
  const valuation = calculatePlayerValuation(overallRating, age, averagePotential, sportsAbove50);

  // Generate demands using Contract System
  const demands = generatePlayerDemands(valuation.annualSalary, age);

  // Generate random name
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Reese', 'Drew'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const firstName = firstNames[Math.floor((Math.abs(Math.sin(seed * 8)) % 1) * firstNames.length)];
  const lastName = lastNames[Math.floor((Math.abs(Math.sin(seed * 9)) % 1) * lastNames.length)];
  const name = `${firstName} ${lastName}`;

  return {
    id,
    name,
    age,
    overallRating,
    position,
    primarySport,
    sportsRatings,
    averagePotential,
    marketValue: valuation.marketValue,
    annualSalary: valuation.annualSalary,
    demands,
    addedDate: currentWeek,
  };
}

/**
 * Refreshes the free agent pool
 *
 * Adds new players and removes expired players
 *
 * @param currentPool - Current free agent pool
 * @param currentWeek - Current game week
 * @param config - Pool configuration
 * @param seed - Random seed for new players
 * @returns Pool refresh result
 */
export function refreshFreeAgentPool(
  currentPool: FreeAgent[],
  currentWeek: number,
  config: PoolConfig,
  seed: number
): PoolRefreshResult {
  // Remove expired players (over expiryWeeks old)
  const removed = currentPool.filter(
    fa => currentWeek - fa.addedDate >= config.expiryWeeks
  );

  let activePool = currentPool.filter(
    fa => currentWeek - fa.addedDate < config.expiryWeeks
  );

  // Add new players up to refreshRate (if under maxSize)
  const added: FreeAgent[] = [];
  const playersToAdd = Math.min(
    config.refreshRate,
    config.maxSize - activePool.length
  );

  for (let i = 0; i < playersToAdd; i++) {
    const newAgent = generateFreeAgent(
      `fa_${currentWeek}_${i}`,
      currentWeek,
      seed + i
    );
    added.push(newAgent);
    activePool.push(newAgent);
  }

  return {
    added,
    removed,
    poolSize: activePool.length,
  };
}

/**
 * Filters free agents by criteria
 *
 * @param pool - Free agent pool
 * @param filter - Filter criteria
 * @returns Filtered free agents
 */
export function filterFreeAgents(
  pool: FreeAgent[],
  filter: FreeAgentFilter
): FreeAgent[] {
  return pool.filter(fa => {
    // Rating filters
    if (filter.minRating !== undefined && fa.overallRating < filter.minRating) {
      return false;
    }
    if (filter.maxRating !== undefined && fa.overallRating > filter.maxRating) {
      return false;
    }

    // Age filters
    if (filter.minAge !== undefined && fa.age < filter.minAge) {
      return false;
    }
    if (filter.maxAge !== undefined && fa.age > filter.maxAge) {
      return false;
    }

    // Salary filter
    if (filter.maxSalary !== undefined && fa.annualSalary > filter.maxSalary) {
      return false;
    }

    // Sport filter
    if (filter.sport !== undefined) {
      if (!(filter.sport in fa.sportsRatings) || fa.sportsRatings[filter.sport] < 50) {
        return false;
      }
    }

    // Position filter
    if (filter.position !== undefined && fa.position !== filter.position) {
      return false;
    }

    return true;
  });
}

/**
 * Sorts free agents by a given criteria
 *
 * @param pool - Free agent pool
 * @param sortBy - Sort criteria
 * @param ascending - Sort order
 * @returns Sorted free agents
 */
export function sortFreeAgents(
  pool: FreeAgent[],
  sortBy: 'rating' | 'age' | 'salary' | 'potential',
  ascending: boolean = false
): FreeAgent[] {
  const sorted = [...pool].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'rating':
        comparison = a.overallRating - b.overallRating;
        break;
      case 'age':
        comparison = a.age - b.age;
        break;
      case 'salary':
        comparison = a.annualSalary - b.annualSalary;
        break;
      case 'potential':
        comparison = a.averagePotential - b.averagePotential;
        break;
    }

    return ascending ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Gets the top N free agents by rating
 *
 * @param pool - Free agent pool
 * @param count - Number of agents to return
 * @returns Top N free agents
 */
export function getTopFreeAgents(pool: FreeAgent[], count: number): FreeAgent[] {
  return sortFreeAgents(pool, 'rating', false).slice(0, count);
}

/**
 * Searches for a free agent by ID
 *
 * @param pool - Free agent pool
 * @param id - Player ID
 * @returns Free agent or null
 */
export function findFreeAgentById(pool: FreeAgent[], id: string): FreeAgent | null {
  return pool.find(fa => fa.id === id) || null;
}

/**
 * Removes a free agent from the pool (e.g., after signing)
 *
 * @param pool - Free agent pool
 * @param id - Player ID
 * @returns Updated pool
 */
export function removeFreeAgent(pool: FreeAgent[], id: string): FreeAgent[] {
  return pool.filter(fa => fa.id !== id);
}
