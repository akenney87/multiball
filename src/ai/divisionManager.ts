/**
 * Division Manager
 *
 * Handles the 10-division, 200-team league structure.
 * Key responsibilities:
 * - Track teams by division
 * - Batch select teams for weekly AI processing
 * - Manage shared player pool across divisions
 * - Support promotion/relegation
 *
 * Performance Strategy (Football Manager-inspired):
 * - User's division (20 teams): FULL simulation every week
 * - Adjacent divisions (±2): Process 50% per week (compete for same players)
 * - Distant divisions: Process 25% per week (statistical simulation)
 */

import {
  DIVISION_COUNT,
  AI_TEAMS_PER_WEEK_BATCH,
  SHARED_POOL_RADIUS,
  USER_TEAM_ID,
} from '../data/constants';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Team reference for batch processing (lightweight, no full roster)
 */
export interface TeamReference {
  id: string;
  name: string;
  division: number;
  isUserTeam: boolean;
}

/**
 * Division state tracking
 */
export interface DivisionState {
  divisionNumber: number;
  teamIds: string[];
  lastFullProcessWeek: number; // Track when division was last fully processed
}

/**
 * Batch of teams selected for processing this week
 */
export interface WeeklyProcessingBatch {
  userDivisionTeams: TeamReference[];      // Always process user's division
  adjacentDivisionTeams: TeamReference[];  // Teams competing for same players
  distantDivisionTeams: TeamReference[];   // Background simulation
  totalTeams: number;
}

// =============================================================================
// DIVISION MANAGER CLASS
// =============================================================================

export class DivisionManager {
  private divisions: Map<number, DivisionState> = new Map();
  private teamDivisions: Map<string, number> = new Map(); // teamId -> division
  private allTeams: TeamReference[] = [];
  private userDivision: number;

  constructor(userDivision: number = 7) {
    this.userDivision = userDivision;
    this.initializeDivisions();
  }

  /**
   * Initialize empty division structure
   */
  private initializeDivisions(): void {
    for (let div = 1; div <= DIVISION_COUNT; div++) {
      this.divisions.set(div, {
        divisionNumber: div,
        teamIds: [],
        lastFullProcessWeek: 0,
      });
    }
  }

  /**
   * Register a team in a division
   */
  registerTeam(team: TeamReference): void {
    const divisionState = this.divisions.get(team.division);
    if (!divisionState) {
      throw new Error(`Invalid division ${team.division}`);
    }

    divisionState.teamIds.push(team.id);
    this.teamDivisions.set(team.id, team.division);
    this.allTeams.push(team);

    // Track user's division
    if (team.isUserTeam) {
      this.userDivision = team.division;
    }
  }

  /**
   * Register multiple teams at once
   */
  registerTeams(teams: TeamReference[]): void {
    for (const team of teams) {
      this.registerTeam(team);
    }
  }

  /**
   * Get team's current division
   */
  getTeamDivision(teamId: string): number | undefined {
    return this.teamDivisions.get(teamId);
  }

  /**
   * Get all teams in a division
   */
  getTeamsInDivision(division: number): string[] {
    return this.divisions.get(division)?.teamIds || [];
  }

  /**
   * Check if a division is "adjacent" to user's division (competes for same players)
   */
  isAdjacentDivision(division: number): boolean {
    const distance = Math.abs(division - this.userDivision);
    return distance > 0 && distance <= SHARED_POOL_RADIUS;
  }

  /**
   * Check if a division shares the player pool with user
   */
  sharesPlayerPool(division: number): boolean {
    const distance = Math.abs(division - this.userDivision);
    return distance <= SHARED_POOL_RADIUS;
  }

  /**
   * Get divisions that share the player pool with user
   */
  getSharedPoolDivisions(): number[] {
    const divisions: number[] = [];
    for (let div = 1; div <= DIVISION_COUNT; div++) {
      if (this.sharesPlayerPool(div)) {
        divisions.push(div);
      }
    }
    return divisions;
  }

  /**
   * Select teams for weekly batch processing
   *
   * Priority:
   * 1. User's division (all 19 AI teams) - always process
   * 2. Adjacent divisions - process ~50% per week (rotating)
   * 3. Distant divisions - process ~25% per week (rotating)
   *
   * @param currentWeek - Current game week (for rotation)
   */
  selectWeeklyBatch(currentWeek: number): WeeklyProcessingBatch {
    const userDivisionTeams: TeamReference[] = [];
    const adjacentDivisionTeams: TeamReference[] = [];
    const distantDivisionTeams: TeamReference[] = [];

    // 1. User's division - ALL AI teams (skip user's team itself)
    const userDivTeamIds = this.getTeamsInDivision(this.userDivision);
    for (const teamId of userDivTeamIds) {
      if (teamId !== USER_TEAM_ID) {
        const team = this.allTeams.find(t => t.id === teamId);
        if (team) userDivisionTeams.push(team);
      }
    }

    // 2. Adjacent divisions - ~50% per week, rotating
    for (let div = 1; div <= DIVISION_COUNT; div++) {
      if (div === this.userDivision) continue;

      const divTeamIds = this.getTeamsInDivision(div);
      const teams = divTeamIds
        .filter(id => id !== USER_TEAM_ID)
        .map(id => this.allTeams.find(t => t.id === id))
        .filter((t): t is TeamReference => t !== undefined);

      if (this.isAdjacentDivision(div)) {
        // Adjacent: process 50% per week (alternate based on week)
        const startIdx = (currentWeek % 2) * Math.ceil(teams.length / 2);
        const endIdx = Math.min(startIdx + Math.ceil(teams.length / 2), teams.length);
        adjacentDivisionTeams.push(...teams.slice(startIdx, endIdx));
      } else {
        // Distant: process 25% per week (rotate through 4 quarters)
        const quarterSize = Math.ceil(teams.length / 4);
        const quarter = currentWeek % 4;
        const startIdx = quarter * quarterSize;
        const endIdx = Math.min(startIdx + quarterSize, teams.length);
        distantDivisionTeams.push(...teams.slice(startIdx, endIdx));
      }
    }

    // Cap distant teams if too many (shouldn't happen but safety)
    const remainingCapacity = AI_TEAMS_PER_WEEK_BATCH - userDivisionTeams.length - adjacentDivisionTeams.length;
    const cappedDistant = distantDivisionTeams.slice(0, Math.max(0, remainingCapacity));

    return {
      userDivisionTeams,
      adjacentDivisionTeams,
      distantDivisionTeams: cappedDistant,
      totalTeams: userDivisionTeams.length + adjacentDivisionTeams.length + cappedDistant.length,
    };
  }

  /**
   * Get teams that should compete for the same free agents/transfers as user
   * (User's division + adjacent divisions)
   */
  getCompetingTeams(): TeamReference[] {
    return this.allTeams.filter(t =>
      !t.isUserTeam && this.sharesPlayerPool(t.division)
    );
  }

  /**
   * Move team to new division (promotion/relegation)
   */
  moveTeamToDivision(teamId: string, newDivision: number): void {
    const currentDivision = this.teamDivisions.get(teamId);
    if (currentDivision === undefined) {
      throw new Error(`Team ${teamId} not found`);
    }

    if (newDivision < 1 || newDivision > DIVISION_COUNT) {
      throw new Error(`Invalid division ${newDivision}`);
    }

    // Remove from current division
    const currentDivState = this.divisions.get(currentDivision);
    if (currentDivState) {
      currentDivState.teamIds = currentDivState.teamIds.filter(id => id !== teamId);
    }

    // Add to new division
    const newDivState = this.divisions.get(newDivision);
    if (newDivState) {
      newDivState.teamIds.push(teamId);
    }

    // Update tracking
    this.teamDivisions.set(teamId, newDivision);

    // Update team reference
    const teamRef = this.allTeams.find(t => t.id === teamId);
    if (teamRef) {
      teamRef.division = newDivision;
    }

    // Update user division if user moved
    if (teamId === USER_TEAM_ID) {
      this.userDivision = newDivision;
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTeams: number;
    teamsByDivision: Record<number, number>;
    userDivision: number;
    sharedPoolDivisions: number[];
  } {
    const teamsByDivision: Record<number, number> = {};
    for (let div = 1; div <= DIVISION_COUNT; div++) {
      teamsByDivision[div] = this.getTeamsInDivision(div).length;
    }

    return {
      totalTeams: this.allTeams.length,
      teamsByDivision,
      userDivision: this.userDivision,
      sharedPoolDivisions: this.getSharedPoolDivisions(),
    };
  }

  /**
   * Export division state for saving
   */
  exportState(): {
    userDivision: number;
    teamDivisions: Record<string, number>;
  } {
    const teamDivisions: Record<string, number> = {};
    this.teamDivisions.forEach((div, teamId) => {
      teamDivisions[teamId] = div;
    });

    return {
      userDivision: this.userDivision,
      teamDivisions,
    };
  }

  /**
   * Import division state from save
   */
  importState(
    state: { userDivision: number; teamDivisions: Record<string, number> },
    teams: TeamReference[]
  ): void {
    this.userDivision = state.userDivision;
    this.initializeDivisions(); // Reset

    // Re-register all teams with their saved divisions
    for (const team of teams) {
      const savedDivision = state.teamDivisions[team.id];
      if (savedDivision !== undefined) {
        team.division = savedDivision;
      }
      this.registerTeam(team);
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Simple hash for deterministic team selection
 */
export function hashTeamWeek(teamId: string, week: number): number {
  let hash = 0;
  const str = teamId + week.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Determine division tier quality for player generation
 *
 * Division 1 = Elite (best players)
 * Division 10 = Worst (developing players)
 *
 * @param division - Division number (1-10)
 * @returns OVR range { min, max } for players in that division
 */
export function getDivisionPlayerQuality(division: number): { min: number; max: number } {
  // Linear scale: Division 1 = 60-90, Division 10 = 15-45
  const qualityRanges: Record<number, { min: number; max: number }> = {
    1: { min: 60, max: 90 },   // Elite
    2: { min: 55, max: 85 },
    3: { min: 50, max: 80 },
    4: { min: 45, max: 75 },
    5: { min: 40, max: 70 },
    6: { min: 35, max: 65 },
    7: { min: 30, max: 55 },   // User starts here
    8: { min: 25, max: 50 },
    9: { min: 20, max: 45 },
    10: { min: 15, max: 40 },  // Worst
  };

  return qualityRanges[division] || { min: 30, max: 55 };
}

/**
 * Get division budget multiplier
 *
 * Higher divisions have more money (better sponsors, attendance, etc.)
 *
 * @param division - Division number (1-10)
 * @returns Budget multiplier (1.0 = base budget)
 */
export function getDivisionBudgetMultiplier(division: number): number {
  // Division 1 = 5x budget, Division 10 = 0.5x budget
  const multipliers: Record<number, number> = {
    1: 5.0,
    2: 4.0,
    3: 3.0,
    4: 2.5,
    5: 2.0,
    6: 1.5,
    7: 1.0,   // User starts here (base budget)
    8: 0.8,
    9: 0.6,
    10: 0.5,
  };

  return multipliers[division] || 1.0;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

// Global instance for easy access
let globalDivisionManager: DivisionManager | null = null;

export function getDivisionManager(): DivisionManager {
  if (!globalDivisionManager) {
    globalDivisionManager = new DivisionManager();
  }
  return globalDivisionManager;
}

export function resetDivisionManager(): void {
  globalDivisionManager = null;
}

export function initializeDivisionManager(userDivision: number): DivisionManager {
  globalDivisionManager = new DivisionManager(userDivision);
  return globalDivisionManager;
}
