/**
 * Soccer Simulation Types
 *
 * Type definitions for soccer match simulation.
 *
 * @module simulation/soccer/types
 */

import { Player } from '../../data/types';

// =============================================================================
// POSITIONS
// =============================================================================

/**
 * Soccer position codes
 * Includes all common formation positions
 */
export type SoccerPosition =
  | 'GK'           // Goalkeeper
  | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'  // Defenders
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM'  // Midfielders
  | 'LW' | 'RW' | 'ST' | 'CF';          // Attackers

// =============================================================================
// TEAM STATE
// =============================================================================

/**
 * Team state for soccer simulation
 */
export interface SoccerTeamState {
  /** Team identifier */
  teamId: string;
  /** Team display name (e.g., "Lakers", "Celtics") */
  teamName: string;
  /** 11 players in starting lineup */
  lineup: Player[];
  /** Players on bench (optional, for substitutions) */
  bench?: Player[];
  /** Formation string (e.g., "4-3-3", "4-4-2") */
  formation: string;
  /** Position assignments by player ID */
  positions: Record<string, SoccerPosition>;
  /** Tactical settings */
  tactics: {
    attackingStyle: 'possession' | 'direct' | 'counter';
    pressing: 'high' | 'balanced' | 'low';
    width: 'wide' | 'balanced' | 'tight';
  };
  /** Minutes allocation by player ID (optional, for user team) */
  minutesAllocation?: Record<string, number>;
  /** Whether this is the user's team (affects sub logic) */
  isUserTeam?: boolean;
}

// =============================================================================
// MATCH EVENTS
// =============================================================================

/**
 * Soccer match event types
 */
export type SoccerEventType =
  | 'goal'
  | 'shot_saved'
  | 'shot_missed'
  | 'shot_blocked'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'half_time'
  | 'full_time'
  | 'corner'
  | 'free_kick'
  | 'foul'
  | 'offside'
  | 'injury_delay'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'penalty_saved';

/**
 * A single match event
 */
export interface SoccerEvent {
  /** Minute of the event (1-90+) */
  minute: number;
  /** Type of event */
  type: SoccerEventType;
  /** Which team the event is for */
  team: 'home' | 'away';
  /** Primary player involved */
  player?: Player;
  /** Assisting player (for goals) */
  assistPlayer?: Player;
  /** Human-readable description */
  description: string;
}

// =============================================================================
// PLAYER STATS
// =============================================================================

/**
 * Individual player statistics for a match
 */
export interface SoccerPlayerStats {
  /** Minutes played (always 90 for starters, no subs) */
  minutesPlayed: number;
  /** Goals scored */
  goals: number;
  /** Assists */
  assists: number;
  /** Total shots taken */
  shots: number;
  /** Shots on target */
  shotsOnTarget: number;
  /** Yellow cards received */
  yellowCards: number;
  /** Red cards received */
  redCards: number;
  /** Saves (GK only) */
  saves?: number;
  /** Plus/minus: goals for minus goals against while on field */
  plusMinus: number;
}

// =============================================================================
// BOX SCORE
// =============================================================================

/**
 * Complete box score for a soccer match
 */
export interface SoccerBoxScore {
  /** Possession percentage */
  possession: { home: number; away: number };
  /** Full chances (clear opportunities) - deprecated in V2 */
  fullChances: { home: number; away: number };
  /** Half chances (partial opportunities) - deprecated in V2 */
  halfChances: { home: number; away: number };
  /** Total shots */
  shots: { home: number; away: number };
  /** Shots on target */
  shotsOnTarget: { home: number; away: number };
  /** Corner kicks */
  corners: { home: number; away: number };
  /** Fouls committed */
  fouls: { home: number; away: number };
  /** Yellow cards */
  yellowCards: { home: number; away: number };
  /** Red cards */
  redCards: { home: number; away: number };
  /** Half time score */
  halfTimeScore?: { home: number; away: number };
  /** Home team player stats by player ID */
  homePlayerStats: Record<string, SoccerPlayerStats>;
  /** Away team player stats by player ID */
  awayPlayerStats: Record<string, SoccerPlayerStats>;
  /** All match events (for timeline display) */
  events?: SoccerEvent[];
}

// =============================================================================
// MATCH INPUT/OUTPUT
// =============================================================================

/**
 * Input for soccer match simulation
 */
export interface SoccerMatchInput {
  /** Home team state */
  homeTeam: SoccerTeamState;
  /** Away team state */
  awayTeam: SoccerTeamState;
}

/**
 * Penalty shootout result
 */
export interface PenaltyShootoutResult {
  /** Home team penalties scored */
  homeScore: number;
  /** Away team penalties scored */
  awayScore: number;
  /** Home team individual kicks (true = scored, false = missed/saved) */
  homeKicks: boolean[];
  /** Away team individual kicks (true = scored, false = missed/saved) */
  awayKicks: boolean[];
  /** Winner team ID */
  winner: string;
}

/**
 * Result of a soccer match simulation
 */
export interface SoccerMatchResult {
  /** Home team ID */
  homeTeamId: string;
  /** Away team ID */
  awayTeamId: string;
  /** Final home score (regulation time) */
  homeScore: number;
  /** Final away score (regulation time) */
  awayScore: number;
  /** Winner team ID (never null - ties resolved by penalties) */
  winner: string | null;
  /** Score at half time */
  halfTimeScore: { home: number; away: number };
  /** Match events in chronological order */
  events: SoccerEvent[];
  /** Complete box score */
  boxScore: SoccerBoxScore;
  /** Play-by-play text */
  playByPlay: string[];
  /** Penalty shootout result (only if match ended in draw) */
  penaltyShootout?: PenaltyShootoutResult;
}
