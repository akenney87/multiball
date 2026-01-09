/**
 * Role Expectation System
 *
 * Calculates expected squad roles based on player overall rating,
 * division quality, and individual ambition modifier.
 *
 * Key concept: A player's expected role depends on how their rating
 * compares to the division's quality range, modified by their ambition.
 *
 * @module systems/roleExpectationSystem
 */

import type { SquadRole } from '../data/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Division quality ranges (player OVR)
 * Division 1 = Elite, Division 10 = Lowest
 * These match the values in divisionManager.ts
 */
export const DIVISION_QUALITY: Record<number, { min: number; max: number }> = {
  1: { min: 60, max: 90 },   // Elite
  2: { min: 55, max: 85 },
  3: { min: 50, max: 80 },
  4: { min: 45, max: 75 },
  5: { min: 40, max: 70 },
  6: { min: 35, max: 65 },
  7: { min: 30, max: 55 },   // User default
  8: { min: 25, max: 50 },
  9: { min: 20, max: 45 },
  10: { min: 15, max: 40 },  // Lowest
};

/**
 * Role thresholds as percentile within division quality range
 * Higher percentile = higher expected role
 */
const ROLE_THRESHOLDS: { role: SquadRole; minPercentile: number }[] = [
  { role: 'star_player', minPercentile: 0.85 },       // Top 15%
  { role: 'important_player', minPercentile: 0.65 },  // 65-85th percentile
  { role: 'rotation_player', minPercentile: 0.40 },   // 40-65th percentile
  { role: 'squad_player', minPercentile: 0.20 },      // 20-40th percentile
  { role: 'backup', minPercentile: 0.0 },             // Bottom 20%
];

/**
 * Default division for free agents or unknown teams
 * Uses middle-tier division for baseline expectations
 */
export const DEFAULT_DIVISION = 6;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get division quality range
 *
 * @param division - Division number (1-10)
 * @returns Quality range { min, max } or default if invalid
 */
export function getDivisionQuality(division: number): { min: number; max: number } {
  const clamped = Math.max(1, Math.min(10, Math.round(division)));
  return DIVISION_QUALITY[clamped] ?? DIVISION_QUALITY[DEFAULT_DIVISION] ?? { min: 30, max: 55 };
}

/**
 * Calculate expected squad role based on player OVR and division
 *
 * The calculation:
 * 1. Apply ambition multiplier to get "perceived OVR"
 * 2. Calculate percentile within division's quality range
 * 3. Map percentile to squad role using thresholds
 *
 * @param playerOVR - Player's overall rating (1-99)
 * @param division - Division number (1-10)
 * @param ambition - Player's ambition modifier (0.85-1.15, default 1.0)
 * @returns Expected squad role
 */
export function getExpectedRole(
  playerOVR: number,
  division: number,
  ambition: number = 1.0
): SquadRole {
  const quality = getDivisionQuality(division);

  // Apply ambition to get perceived OVR
  const perceivedOVR = playerOVR * ambition;

  // Calculate percentile within division range
  const range = quality.max - quality.min;
  const percentile = range > 0
    ? (perceivedOVR - quality.min) / range
    : 0.5; // Default to middle if range is 0

  // Find matching role based on percentile
  for (const threshold of ROLE_THRESHOLDS) {
    if (percentile >= threshold.minPercentile) {
      return threshold.role;
    }
  }

  // Fallback to backup if below all thresholds
  return 'backup';
}

/**
 * Calculate expected squad role without ambition modifier
 * Used for AI calculations and objective assessments
 *
 * @param playerOVR - Player's overall rating (1-99)
 * @param division - Division number (1-10)
 * @returns Expected squad role based purely on OVR vs division
 */
export function getRoleForDivision(
  playerOVR: number,
  division: number
): SquadRole {
  return getExpectedRole(playerOVR, division, 1.0);
}

/**
 * Get human-readable description of ambition level
 *
 * @param ambition - Player's ambition modifier
 * @returns Description string
 */
export function getAmbitionDescription(ambition: number): string {
  if (ambition < 0.93) return 'Humble';
  if (ambition > 1.07) return 'Ambitious';
  return 'Realistic';
}

/**
 * Get role display name
 *
 * @param role - Squad role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: SquadRole): string {
  switch (role) {
    case 'star_player': return 'Star Player';
    case 'important_player': return 'Important Player';
    case 'rotation_player': return 'Rotation Player';
    case 'squad_player': return 'Squad Player';
    case 'youth_prospect': return 'Youth Prospect';
    case 'backup': return 'Backup';
    default: return role;
  }
}

/**
 * Compare two squad roles
 *
 * @param role1 - First role
 * @param role2 - Second role
 * @returns Positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(role1: SquadRole, role2: SquadRole): number {
  const roleOrder: SquadRole[] = [
    'backup',
    'youth_prospect',
    'squad_player',
    'rotation_player',
    'important_player',
    'star_player',
  ];

  const index1 = roleOrder.indexOf(role1);
  const index2 = roleOrder.indexOf(role2);

  return index1 - index2;
}

/**
 * Check if actual role meets or exceeds expected role
 *
 * @param actualRole - Role the player is offered/has
 * @param expectedRole - Role the player expects based on their assessment
 * @returns true if actualRole >= expectedRole
 */
export function rolesMeetExpectation(
  actualRole: SquadRole,
  expectedRole: SquadRole
): boolean {
  return compareRoles(actualRole, expectedRole) >= 0;
}

/**
 * Get role difference as number of levels
 *
 * @param role1 - First role
 * @param role2 - Second role
 * @returns Number of role levels difference (positive = role1 higher)
 */
export function getRoleDifference(role1: SquadRole, role2: SquadRole): number {
  return compareRoles(role1, role2);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate what division a player would be star-level in
 * Useful for transfer/signing decisions
 *
 * @param playerOVR - Player's overall rating
 * @param ambition - Player's ambition modifier (optional)
 * @returns Division number where player would expect star role
 */
export function getStarDivision(playerOVR: number, ambition: number = 1.0): number {
  const perceivedOVR = playerOVR * ambition;

  // Find the division where this OVR would be at 85th percentile (star level)
  for (let division = 1; division <= 10; division++) {
    const quality = getDivisionQuality(division);
    const range = quality.max - quality.min;
    const starThreshold = quality.min + range * 0.85;

    if (perceivedOVR >= starThreshold) {
      return division;
    }
  }

  return 10; // Default to lowest division
}

/**
 * Get all roles a player could reasonably accept in a division
 * (their expected role and anything above it)
 *
 * @param playerOVR - Player's overall rating
 * @param division - Division number
 * @param ambition - Player's ambition modifier
 * @returns Array of acceptable roles (from expected up to star)
 */
export function getAcceptableRoles(
  playerOVR: number,
  division: number,
  ambition: number = 1.0
): SquadRole[] {
  const expectedRole = getExpectedRole(playerOVR, division, ambition);
  const allRoles: SquadRole[] = [
    'backup',
    'youth_prospect',
    'squad_player',
    'rotation_player',
    'important_player',
    'star_player',
  ];

  const expectedIndex = allRoles.indexOf(expectedRole);
  return allRoles.slice(expectedIndex);
}
