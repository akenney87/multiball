/**
 * Season Manager
 *
 * Manages the full season lifecycle:
 * - Creating new seasons
 * - Phase transitions (pre_season, regular_season, post_season, off_season)
 * - Transfer window management
 * - End-of-season promotion/relegation
 *
 * Week 2: Core functionality
 * Week 4: Add season events, milestones, achievements
 */

import type { Season, TeamStanding } from '../data/types';
import { generateSeasonSchedule, type ScheduleOptions } from './scheduleGenerator';
import { createInitialStandings } from './weekProcessor';

/**
 * Generate a unique ID (simple implementation to avoid uuid ESM issues)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// TYPES
// =============================================================================

export interface SeasonOptions extends ScheduleOptions {
  /** Season start date */
  startDate?: Date;
}

export interface PromotionRelegationResult {
  /** Teams being promoted (top 3) */
  promoted: string[];
  /** Teams being relegated (bottom 3) */
  relegated: string[];
  /** Division champion */
  champion: string;
  /** Last place team */
  woodenSpoon: string;
}

// =============================================================================
// SEASON CREATION
// =============================================================================

/**
 * Create a new season with schedule and initial standings
 *
 * @param teamIds - Teams participating in this season
 * @param seasonNumber - Season number (1, 2, 3...)
 * @param options - Season creation options
 * @returns New season object
 */
export function createNewSeason(
  teamIds: string[],
  seasonNumber: number,
  options: SeasonOptions = {}
): Season {
  const seasonId = generateId();
  const startDate = options.startDate ?? new Date();

  // Generate schedule
  const schedule = generateSeasonSchedule(teamIds, seasonId, {
    seed: options.seed,
    startDate,
    totalWeeks: options.totalWeeks,
  });

  // Create initial standings
  const standings = createInitialStandings(teamIds);

  return {
    id: seasonId,
    seasonNumber,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    status: 'pre_season',
    matches: schedule.matches,
    standings,
    transferWindowOpen: false,
    currentWeek: 1,
  };
}

// =============================================================================
// SEASON PHASES
// =============================================================================

export type SeasonPhase = 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

/**
 * Get current season phase
 *
 * @param season - Current season
 * @returns Current phase
 */
export function getSeasonPhase(season: Season): SeasonPhase {
  return season.status;
}

/**
 * Update season to new phase
 *
 * @param season - Current season
 * @param newPhase - New phase to transition to
 * @returns Updated season
 */
export function updateSeasonPhase(season: Season, newPhase: SeasonPhase): Season {
  return {
    ...season,
    status: newPhase,
  };
}

// =============================================================================
// TRANSFER WINDOW
// =============================================================================

/**
 * Check if transfer window is currently open
 *
 * @param season - Current season
 * @returns True if window is open
 */
export function isTransferWindowOpen(season: Season): boolean {
  return season.transferWindowOpen;
}

/**
 * Open the transfer window
 *
 * @param season - Current season
 * @returns Updated season with open window
 */
export function openTransferWindow(season: Season): Season {
  return {
    ...season,
    transferWindowOpen: true,
  };
}

/**
 * Close the transfer window
 *
 * @param season - Current season
 * @returns Updated season with closed window
 */
export function closeTransferWindow(season: Season): Season {
  return {
    ...season,
    transferWindowOpen: false,
  };
}

// =============================================================================
// PROMOTION AND RELEGATION
// =============================================================================

/**
 * Calculate promotion and relegation based on final standings
 *
 * Standard rules:
 * - Top 3 teams are promoted
 * - Bottom 3 teams are relegated
 * - 1st place is champion
 * - 20th place is wooden spoon
 *
 * @param standings - Final season standings
 * @returns Promotion/relegation result
 */
export function calculatePromotionRelegation(
  standings: Record<string, TeamStanding>
): PromotionRelegationResult {
  const sorted = getTeamsByRank(standings);

  return {
    promoted: sorted.slice(0, 3),
    relegated: sorted.slice(-3),
    champion: sorted[0],
    woodenSpoon: sorted[sorted.length - 1],
  };
}

/**
 * Get teams sorted by their standings rank
 *
 * @param standings - Current standings
 * @returns Team IDs sorted by rank (1st place first)
 */
export function getTeamsByRank(standings: Record<string, TeamStanding>): string[] {
  return Object.values(standings)
    .sort((a, b) => a.rank - b.rank)
    .map((s) => s.teamId);
}

// =============================================================================
// SEASON UTILITIES
// =============================================================================

/**
 * Check if season is complete (all matches played)
 *
 * @param season - Current season
 * @returns True if all matches are completed
 */
export function isSeasonComplete(season: Season): boolean {
  return season.matches.every((m) => m.status === 'completed');
}

/**
 * Get season progress as percentage
 *
 * @param season - Current season
 * @returns Progress 0-100
 */
export function getSeasonProgress(season: Season): number {
  const completed = season.matches.filter((m) => m.status === 'completed').length;
  return Math.round((completed / season.matches.length) * 100);
}

/**
 * Get remaining matches count
 *
 * @param season - Current season
 * @returns Number of matches not yet completed
 */
export function getRemainingMatchCount(season: Season): number {
  return season.matches.filter((m) => m.status !== 'completed').length;
}
