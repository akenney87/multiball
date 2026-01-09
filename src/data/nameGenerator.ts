/**
 * Name Generator
 *
 * Stateless functions for generating nationality-appropriate player names.
 * Supports both random generation (game initialization) and seeded
 * generation (youth academy - deterministic).
 *
 * @module data/nameGenerator
 */

import { NAME_POOLS, MIDDLE_INITIALS } from './names';

/**
 * Generates a unique name for a player based on nationality.
 * Uses random selection with collision detection.
 *
 * @param nationality - Player's nationality (must match key in NAME_POOLS)
 * @param existingNames - Set of names already in use (for deduplication)
 * @returns Unique full name string
 */
export function generateName(
  nationality: string,
  existingNames: Set<string>
): string {
  const pool = NAME_POOLS[nationality] ?? NAME_POOLS['American'];

  // Try up to 100 times to find a unique name
  for (let attempt = 0; attempt < 100; attempt++) {
    const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
    const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
    const fullName = `${firstName} ${lastName}`;

    if (!existingNames.has(fullName)) {
      return fullName;
    }
  }

  // Fallback: add middle initial to ensure uniqueness
  const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
  const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];

  // Try each middle initial until we find a unique combination
  for (const initial of MIDDLE_INITIALS) {
    const fullName = `${firstName} ${initial}. ${lastName}`;
    if (!existingNames.has(fullName)) {
      return fullName;
    }
  }

  // Ultimate fallback (extremely rare): numeric suffix
  const suffix = Math.floor(Math.random() * 1000);
  return `${firstName} ${lastName} Jr.${suffix > 500 ? ' II' : ''}`;
}

/**
 * Simple seeded random number generator (Linear Congruential Generator)
 * Provides deterministic pseudo-random numbers for reproducible name generation.
 *
 * @param seed - Seed value
 * @returns Object with next() method to get sequential random values
 */
function createSeededRandom(seed: number): { next: () => number } {
  let state = seed;
  return {
    next: () => {
      // LCG parameters (same as glibc)
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}

/**
 * Generates a name using a seed for deterministic results.
 * Used by youth academy system for reproducible prospect generation.
 *
 * @param nationality - Player's nationality (must match key in NAME_POOLS)
 * @param seed - Numeric seed for deterministic generation
 * @returns Full name string (may not be unique - caller must handle)
 */
export function generateSeededName(nationality: string, seed: number): string {
  const pool = NAME_POOLS[nationality] ?? NAME_POOLS['American'];
  const rng = createSeededRandom(seed);

  const firstIdx = Math.floor(rng.next() * pool.firstNames.length);
  const lastIdx = Math.floor(rng.next() * pool.lastNames.length);

  const firstName = pool.firstNames[firstIdx];
  const lastName = pool.lastNames[lastIdx];

  return `${firstName} ${lastName}`;
}

/**
 * Generates a unique seeded name by trying different seed offsets if collision occurs.
 *
 * @param nationality - Player's nationality
 * @param baseSeed - Base seed value
 * @param existingNames - Set of names already in use
 * @returns Unique full name string
 */
export function generateUniqueSeededName(
  nationality: string,
  baseSeed: number,
  existingNames: Set<string>
): string {
  const pool = NAME_POOLS[nationality] ?? NAME_POOLS['American'];

  // Try different seed offsets
  for (let offset = 0; offset < 100; offset++) {
    const name = generateSeededName(nationality, baseSeed + offset * 1000);
    if (!existingNames.has(name)) {
      return name;
    }
  }

  // Fallback: add middle initial
  const rng = createSeededRandom(baseSeed);
  const firstName = pool.firstNames[Math.floor(rng.next() * pool.firstNames.length)];
  const lastName = pool.lastNames[Math.floor(rng.next() * pool.lastNames.length)];
  const initialIdx = Math.floor(rng.next() * MIDDLE_INITIALS.length);

  return `${firstName} ${MIDDLE_INITIALS[initialIdx]}. ${lastName}`;
}

/**
 * Validates that a nationality has a corresponding name pool.
 *
 * @param nationality - Nationality string to check
 * @returns True if name pool exists for this nationality
 */
export function hasNamePool(nationality: string): boolean {
  return nationality in NAME_POOLS;
}

/**
 * Gets list of all nationalities with name pools.
 *
 * @returns Array of nationality strings
 */
export function getAvailableNationalities(): string[] {
  return Object.keys(NAME_POOLS);
}
