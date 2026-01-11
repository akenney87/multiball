/**
 * Offseason Processor
 *
 * Handles the 12-week offseason period between seasons:
 * - Week 1: Season end processing (awards, promotion/relegation, contract expiration)
 * - Weeks 1-12: Weekly progression continues
 * - Week 12: New season initialization
 *
 * @module systems/offseasonProcessor
 */

import type { Player, Contract } from '../data/types';
import type { GameState, SeasonState, AITeamState } from '../ui/context/types';
import { createNewSeason } from '../season/seasonManager';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of weeks in the offseason */
export const OFFSEASON_WEEKS = 12;

/** Regular season length in weeks */
export const REGULAR_SEASON_WEEKS = 40;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of season end processing
 */
export interface SeasonEndResult {
  /** Teams promoted to higher division */
  promotedTeams: string[];
  /** Teams relegated to lower division */
  relegatedTeams: string[];
  /** Division champion team ID */
  champion: string;
  /** Players whose contracts expired */
  expiredContracts: string[];
  /** Prize money awarded to user team */
  userPrizeMoney: number;
  /** User team's final position */
  userFinishPosition: number;
  /** Morale boost/penalty for user team players */
  userMoraleChange: number;
}

/**
 * Result of new season initialization
 */
export interface NewSeasonResult {
  /** The new season state */
  season: SeasonState;
  /** Updated teams with division changes applied */
  teams: AITeamState[];
  /** New user team division */
  userDivision: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}

// =============================================================================
// OFFSEASON STATE TRACKING
// =============================================================================

/**
 * Get the current offseason week (1-12)
 * Returns 0 if not in offseason
 */
export function getOffseasonWeek(state: GameState): number {
  if (state.season.status !== 'off_season') {
    return 0;
  }
  // Offseason weeks are tracked as weeks 41-52 internally
  // Week 41 = offseason week 1, Week 52 = offseason week 12
  const offseasonWeek = state.season.currentWeek - REGULAR_SEASON_WEEKS;
  return Math.max(0, Math.min(OFFSEASON_WEEKS, offseasonWeek));
}

/**
 * Check if this is the first week of offseason (season just ended)
 */
export function isSeasonEndWeek(state: GameState): boolean {
  return state.season.status === 'off_season' && getOffseasonWeek(state) === 1;
}

/**
 * Check if this is the last week of offseason (new season should start)
 */
export function isNewSeasonWeek(state: GameState): boolean {
  return state.season.status === 'off_season' && getOffseasonWeek(state) >= OFFSEASON_WEEKS;
}

// =============================================================================
// PRIZE MONEY CALCULATION
// =============================================================================

/**
 * Prize money by division and position
 * Exponential scaling with Division 1 champion at $175M
 */
const PRIZE_MONEY_BY_DIVISION: Record<number, { first: number; last: number }> = {
  1: { first: 175_000_000, last: 105_000_000 },
  2: { first: 30_000_000, last: 18_000_000 },
  3: { first: 3_000_000, last: 1_800_000 },
  4: { first: 900_000, last: 540_000 },
  5: { first: 450_000, last: 270_000 },
  6: { first: 250_000, last: 150_000 },
  7: { first: 150_000, last: 90_000 },
  8: { first: 90_000, last: 54_000 },
  9: { first: 55_000, last: 33_000 },
  10: { first: 35_000, last: 21_000 },
};

/**
 * Calculate prize money for a given finish position in a division
 */
export function calculatePrizeMoney(division: number, position: number, totalTeams: number = 20): number {
  // Clamp division to valid range and get prizes
  const clampedDivision = Math.max(1, Math.min(10, division));
  const divPrizes = PRIZE_MONEY_BY_DIVISION[clampedDivision]!;

  // Linear interpolation between first and last place
  const positionRatio = (position - 1) / (totalTeams - 1);
  const prizeMoney = divPrizes.first - (divPrizes.first - divPrizes.last) * positionRatio;

  return Math.round(prizeMoney);
}

// =============================================================================
// MORALE CALCULATION
// =============================================================================

/**
 * Calculate morale change based on finish position
 */
export function calculateMoraleChange(position: number): number {
  if (position === 1) return 20;
  if (position <= 3) return 15;
  if (position <= 6) return 10;
  if (position <= 10) return 5;
  if (position <= 14) return 0;
  if (position <= 17) return -5;
  return -10; // 18th-20th
}

// =============================================================================
// CONTRACT EXPIRATION
// =============================================================================

/**
 * Get all players with expired contracts
 * A contract is expired if it ends at or before the current season
 */
export function getExpiredContracts(
  players: Record<string, Player>,
  currentSeasonNumber: number
): string[] {
  const expired: string[] = [];

  for (const [playerId, player] of Object.entries(players)) {
    if (player.contract && isContractExpired(player.contract, currentSeasonNumber)) {
      expired.push(playerId);
    }
  }

  return expired;
}

/**
 * Check if a contract is expired
 */
function isContractExpired(contract: Contract, _currentSeasonNumber: number): boolean {
  // Contract length is in years, and each season is 1 year
  // Check if we've passed the contract end date
  if (contract.expiryDate) {
    return new Date() >= new Date(contract.expiryDate);
  }

  // Fallback: check based on contract length
  // This is approximate - contracts start at signing, not season start
  return false;
}

/**
 * Process contract expirations - release players to free agency
 */
export function processContractExpirations(
  players: Record<string, Player>,
  expiredPlayerIds: string[]
): Record<string, Player> {
  const updatedPlayers = { ...players };

  for (const playerId of expiredPlayerIds) {
    const player = updatedPlayers[playerId];
    if (player) {
      updatedPlayers[playerId] = {
        ...player,
        teamId: 'free_agent',
        contract: null,
      };
    }
  }

  return updatedPlayers;
}

// =============================================================================
// PROMOTION / RELEGATION
// =============================================================================

/**
 * Get teams sorted by standings rank
 */
function getTeamsByRank(standings: Record<string, { rank: number }>): string[] {
  return Object.entries(standings)
    .sort(([, a], [, b]) => a.rank - b.rank)
    .map(([teamId]) => teamId);
}

/**
 * Calculate promotion and relegation
 */
export function calculatePromotionRelegation(
  standings: Record<string, { rank: number; teamId: string }>
): { promoted: string[]; relegated: string[]; champion: string } {
  const sorted = getTeamsByRank(standings);

  return {
    promoted: sorted.slice(0, 3),
    relegated: sorted.slice(-3),
    champion: sorted[0] || 'unknown',
  };
}

/**
 * Apply division changes to teams
 */
export function applyDivisionChanges(
  teams: AITeamState[],
  userTeamId: string,
  userDivision: number,
  promoted: string[],
  relegated: string[]
): { teams: AITeamState[]; userDivision: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 } {
  let newUserDivision = userDivision;

  // Check if user team is promoted or relegated
  if (promoted.includes(userTeamId)) {
    newUserDivision = Math.max(1, userDivision - 1);
  } else if (relegated.includes(userTeamId)) {
    newUserDivision = Math.min(10, userDivision + 1);
  }

  // Update AI team divisions
  const updatedTeams = teams.map((team) => {
    let newDivision = team.division;

    if (promoted.includes(team.id)) {
      newDivision = Math.max(1, team.division - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    } else if (relegated.includes(team.id)) {
      newDivision = Math.min(10, team.division + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    }

    return {
      ...team,
      division: newDivision,
    };
  });

  return {
    teams: updatedTeams,
    userDivision: newUserDivision as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
  };
}

// =============================================================================
// SEASON END PROCESSING
// =============================================================================

/**
 * Process end of season
 * Called when transitioning from regular season to offseason (week 41)
 */
export function processSeasonEnd(state: GameState): SeasonEndResult {
  const { standings } = state.season;
  const userTeamId = state.userTeam.id;

  // Get user team's finish position
  const userStanding = standings[userTeamId];
  const userFinishPosition = userStanding?.rank || 10;

  // Calculate promotion/relegation
  const { promoted, relegated, champion } = calculatePromotionRelegation(standings);

  // Get expired contracts
  const expiredContracts = getExpiredContracts(state.players, state.season.number);

  // Calculate prize money
  const userPrizeMoney = calculatePrizeMoney(state.userTeam.division, userFinishPosition);

  // Calculate morale change
  const userMoraleChange = calculateMoraleChange(userFinishPosition);

  return {
    promotedTeams: promoted,
    relegatedTeams: relegated,
    champion,
    expiredContracts,
    userPrizeMoney,
    userFinishPosition,
    userMoraleChange,
  };
}

// =============================================================================
// NEW SEASON INITIALIZATION
// =============================================================================

/**
 * Initialize a new season
 * Called at the end of offseason (week 52 -> week 1 of new season)
 */
export function initializeNewSeason(
  state: GameState,
  promotedTeams: string[],
  relegatedTeams: string[]
): NewSeasonResult {
  const allTeamIds = ['user', ...state.league.teams.map((t) => t.id)];

  // Apply division changes
  const { teams: updatedTeams, userDivision } = applyDivisionChanges(
    state.league.teams,
    'user',
    state.userTeam.division,
    promotedTeams,
    relegatedTeams
  );

  // Create new season
  const newSeasonNumber = state.season.number + 1;
  const newSeason = createNewSeason(allTeamIds, newSeasonNumber);

  // Convert to SeasonState format
  const seasonState: SeasonState = {
    id: newSeason.id,
    number: newSeasonNumber,
    currentWeek: 1,
    status: 'regular_season',
    transferWindowOpen: true,
    matches: newSeason.matches,
    standings: newSeason.standings,
    aiTeamStrategies: state.season.aiTeamStrategies, // Preserve AI strategies
  };

  return {
    season: seasonState,
    teams: updatedTeams,
    userDivision,
  };
}

// =============================================================================
// OFFSEASON WEEK ADVANCEMENT
// =============================================================================

/**
 * Advance one week during offseason
 * Returns the new week number (or 1 if transitioning to new season)
 */
export function advanceOffseasonWeek(currentWeek: number): {
  newWeek: number;
  startNewSeason: boolean;
} {
  const offseasonWeek = currentWeek - REGULAR_SEASON_WEEKS;

  if (offseasonWeek >= OFFSEASON_WEEKS) {
    // End of offseason - start new season
    return { newWeek: 1, startNewSeason: true };
  }

  // Continue offseason
  return { newWeek: currentWeek + 1, startNewSeason: false };
}

/**
 * Check if we should transition from regular season to offseason
 */
export function shouldTransitionToOffseason(state: GameState): boolean {
  return (
    state.season.status === 'regular_season' &&
    state.season.currentWeek >= REGULAR_SEASON_WEEKS &&
    state.season.matches.every((m) => m.status === 'completed')
  );
}
