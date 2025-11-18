/**
 * Basketball Simulator - Core Types
 *
 * TypeScript interfaces for basketball simulation.
 * Aligned with basketball-sim Python data structures and Agent 5's data models.
 *
 * CRITICAL: These types must align with:
 * 1. Python basketball-sim data structures
 * 2. Agent 5's data models (src/data/types.ts)
 *
 * @module simulation/core/types
 */

import type { Player, TacticalSettings } from '../../data/types';

// =============================================================================
// POSSESSION CONTEXT
// =============================================================================

/**
 * Possession context information
 * Aligned with Python PossessionContext class
 */
export interface PossessionContext {
  /** Is this a transition possession? */
  isTransition: boolean;

  /** Shot clock remaining (seconds) */
  shotClock: number;

  /** Score differential (positive = offense ahead) */
  scoreDifferential: number;

  /** Game time remaining (total seconds left in game) */
  gameTimeRemaining: number;

  /** Quarter number (1-4) */
  quarter?: number;

  /** Possession number in the game */
  possessionNumber?: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

/**
 * Team tactical settings (simplified for simulation)
 * Maps to Agent 5's TacticalSettings
 */
export interface SimulationTacticalSettings {
  /** Game pace */
  pace: 'fast' | 'standard' | 'slow';

  /** Man defense percentage (0-100) */
  manDefensePct: number;

  /** Priority scoring options (player IDs) */
  scoringOptions: [string?, string?, string?];

  /** Minutes allocation (player ID -> minutes, must sum to 240) */
  minutesAllotment: Record<string, number>;

  /** Rebounding strategy */
  reboundingStrategy: 'crash_glass' | 'standard' | 'prevent_transition';
}

/**
 * Simple player representation for simulation
 * Contains only attributes needed for game calculations
 */
export interface SimulationPlayer {
  /** Player ID (from Agent 5 data model) */
  id: string;

  /** Player name */
  name: string;

  /** Position (PG, SG, SF, PF, C) */
  position: string;

  /** All 25 attributes (1-100 scale) */
  // Physical (12)
  grip_strength: number;
  arm_strength: number;
  core_strength: number;
  agility: number;
  acceleration: number;
  top_speed: number;
  jumping: number;
  reactions: number;
  stamina: number;
  balance: number;
  height: number;
  durability: number;

  // Mental (7)
  awareness: number;
  creativity: number;
  determination: number;
  bravery: number;
  consistency: number;
  composure: number;
  patience: number;

  // Technical (6)
  hand_eye_coordination: number;
  throw_accuracy: number;
  form_technique: number;
  finesse: number;
  deception: number;
  teamwork: number;

  /** Current stamina (runtime state, not base attribute) */
  current_stamina?: number;
}

/**
 * Team representation for simulation
 */
export interface SimulationTeam {
  /** Team ID */
  id: string;

  /** Team name */
  name: string;

  /** Active roster (5 players on court) */
  activePlayers: SimulationPlayer[];

  /** Bench players */
  benchPlayers: SimulationPlayer[];

  /** Tactical settings */
  tactics: SimulationTacticalSettings;

  /** Defensive assignments (offensive player ID -> defensive player ID) */
  defensiveAssignments: Record<string, string>;
}

// =============================================================================
// SHOT TYPES
// =============================================================================

/**
 * Shot types (aligned with Python constants)
 */
export type ShotType = '3pt' | 'midrange_short' | 'midrange_long' | 'dunk' | 'layup' | 'rim';

/**
 * Contest tiers (aligned with Python defense system)
 */
export type ContestTier = 'wide_open' | 'contested' | 'heavy';

// =============================================================================
// TURNOVER TYPES
// =============================================================================

/**
 * Turnover types (Section 6.2)
 */
export type TurnoverType = 'bad_pass' | 'lost_ball' | 'offensive_foul' | 'shot_clock' | 'other_violation';

// =============================================================================
// POSSESSION OUTCOME
// =============================================================================

/**
 * Possession outcome type
 */
export type PossessionOutcomeType = 'made_shot' | 'missed_shot' | 'turnover' | 'block';

/**
 * Detailed possession outcome
 * Aligned with Python simulation output
 */
export interface PossessionOutcome {
  /** Outcome type */
  outcomeType: PossessionOutcomeType;

  /** Points scored (0 if miss/turnover) */
  pointsScored: number;

  /** Scoring player ID (null if no score) */
  scoringPlayer: string | null;

  /** Assist player ID (null if no assist) */
  assistPlayer: string | null;

  /** Rebounding player ID (null if no rebound) */
  reboundPlayer: string | null;

  /** Which team got the rebound (null if no rebound) */
  reboundingTeam: string | null;

  /** Turnover type (null if not a turnover) */
  turnoverType: TurnoverType | null;

  /** Player who committed turnover (null if not a turnover) */
  turnoverPlayer: string | null;

  /** Player who got steal (null if not a steal) */
  stealPlayer: string | null;

  /** Player who blocked shot (null if not a block) */
  blockPlayer: string | null;

  /** Play-by-play text description */
  playByPlayText: string;

  /** Debug information (detailed probability calculations) */
  debug?: PossessionDebug;
}

/**
 * Debug information for possession outcome
 * Used for validation and testing
 */
export interface PossessionDebug {
  /** Shooter player ID */
  shooter: string;

  /** Shot type */
  shotType: ShotType;

  /** Contest distance (feet) */
  contestDistance: number;

  /** Contest tier */
  contestTier: ContestTier;

  /** Primary defender ID */
  primaryDefender: string;

  /** Help defender ID (null if none) */
  helpDefender: string | null;

  /** Probability calculations */
  shooterComposite: number;
  defenderComposite: number;
  attributeDiff: number;
  baseSuccessRate: number;
  contestPenalty: number;
  finalSuccessRate: number;
  actualRoll: number;
  shotResult: 'make' | 'miss';

  /** Rebound information (if miss) */
  reboundOffensiveStrength?: number;
  reboundDefensiveStrength?: number;
  orebProbability?: number;
  reboundRoll?: number;
  reboundingTeam?: string;
  rebounderSelectionWeights?: Record<string, number>;

  /** Turnover information (if turnover) */
  turnoverCheck?: boolean;
  turnoverProbability?: number;
  turnoverRoll?: number;
  turnoverType?: TurnoverType | null;

  /** Block information (if block) */
  blockCheck?: boolean;
  blockProbability?: number;
  blockRoll?: number;
  blockOutcome?: string;

  /** All sigmoid calculations */
  allSigmoidCalculations?: SigmoidCalculation[];
}

/**
 * Individual sigmoid calculation record (for validation)
 */
export interface SigmoidCalculation {
  /** What is being calculated */
  action: string;

  /** Offensive composite */
  offensiveComposite: number;

  /** Defensive composite */
  defensiveComposite: number;

  /** Attribute difference */
  attributeDiff: number;

  /** Base rate */
  baseRate: number;

  /** Sigmoid k value */
  k: number;

  /** Final probability */
  probability: number;

  /** Random roll */
  roll: number;

  /** Success/failure */
  result: boolean;
}

// =============================================================================
// BOX SCORE
// =============================================================================

/**
 * Player statistics for a game/quarter
 */
export interface PlayerStats {
  /** Player ID */
  playerId: string;

  /** Minutes played */
  minutes: number;

  /** Points scored */
  points: number;

  /** Field goals made */
  fieldGoalsMade: number;

  /** Field goals attempted */
  fieldGoalsAttempted: number;

  /** 3-pointers made */
  threePointersMade: number;

  /** 3-pointers attempted */
  threePointersAttempted: number;

  /** Free throws made */
  freeThrowsMade: number;

  /** Free throws attempted */
  freeThrowsAttempted: number;

  /** Offensive rebounds */
  offensiveRebounds: number;

  /** Defensive rebounds */
  defensiveRebounds: number;

  /** Total rebounds */
  rebounds: number;

  /** Assists */
  assists: number;

  /** Steals */
  steals: number;

  /** Blocks */
  blocks: number;

  /** Turnovers */
  turnovers: number;

  /** Personal fouls */
  fouls: number;
}

/**
 * Team statistics for a game/quarter
 */
export interface TeamStats {
  /** Team ID */
  teamId: string;

  /** Total points */
  points: number;

  /** Field goals made */
  fieldGoalsMade: number;

  /** Field goals attempted */
  fieldGoalsAttempted: number;

  /** 3-pointers made */
  threePointersMade: number;

  /** 3-pointers attempted */
  threePointersAttempted: number;

  /** Free throws made */
  freeThrowsMade: number;

  /** Free throws attempted */
  freeThrowsAttempted: number;

  /** Offensive rebounds */
  offensiveRebounds: number;

  /** Defensive rebounds */
  defensiveRebounds: number;

  /** Total rebounds */
  rebounds: number;

  /** Assists */
  assists: number;

  /** Steals */
  steals: number;

  /** Blocks */
  blocks: number;

  /** Turnovers */
  turnovers: number;

  /** Team fouls */
  fouls: number;

  /** Player statistics */
  playerStats: PlayerStats[];
}

/**
 * Complete box score
 */
export interface BoxScore {
  /** Home team stats */
  homeTeam: TeamStats;

  /** Away team stats */
  awayTeam: TeamStats;

  /** Final score (home) */
  homeScore: number;

  /** Final score (away) */
  awayScore: number;

  /** Winner team ID */
  winner: string;

  /** Quarter-by-quarter scores */
  quarterScores: {
    quarter: number;
    homeScore: number;
    awayScore: number;
  }[];
}

// =============================================================================
// GAME RESULT
// =============================================================================

/**
 * Complete game simulation result
 */
export interface GameResult {
  /** Game ID */
  gameId: string;

  /** Home team ID */
  homeTeamId: string;

  /** Away team ID */
  awayTeamId: string;

  /** Box score */
  boxScore: BoxScore;

  /** Play-by-play log */
  playByPlay: string[];

  /** All possession outcomes */
  possessions: PossessionOutcome[];

  /** Game duration (minutes) */
  duration: number;

  /** Random seed (if used) */
  seed?: string | number;
}

// =============================================================================
// UTILITY TYPE CONVERTERS
// =============================================================================

/**
 * Convert Agent 5's Player to SimulationPlayer
 * Extracts only the attributes needed for simulation
 */
export function playerToSimulationPlayer(player: Player): SimulationPlayer {
  return {
    id: player.id,
    name: player.name,
    position: player.position,

    // Physical attributes
    grip_strength: player.attributes.grip_strength,
    arm_strength: player.attributes.arm_strength,
    core_strength: player.attributes.core_strength,
    agility: player.attributes.agility,
    acceleration: player.attributes.acceleration,
    top_speed: player.attributes.top_speed,
    jumping: player.attributes.jumping,
    reactions: player.attributes.reactions,
    stamina: player.attributes.stamina,
    balance: player.attributes.balance,
    height: player.attributes.height,
    durability: player.attributes.durability,

    // Mental attributes
    awareness: player.attributes.awareness,
    creativity: player.attributes.creativity,
    determination: player.attributes.determination,
    bravery: player.attributes.bravery,
    consistency: player.attributes.consistency,
    composure: player.attributes.composure,
    patience: player.attributes.patience,

    // Technical attributes
    hand_eye_coordination: player.attributes.hand_eye_coordination,
    throw_accuracy: player.attributes.throw_accuracy,
    form_technique: player.attributes.form_technique,
    finesse: player.attributes.finesse,
    deception: player.attributes.deception,
    teamwork: player.attributes.teamwork,

    // Initialize current stamina to base stamina attribute
    current_stamina: player.attributes.stamina,
  };
}

/**
 * Convert Agent 5's TacticalSettings to SimulationTacticalSettings
 */
export function tacticalSettingsToSimulation(
  tactics: TacticalSettings
): SimulationTacticalSettings {
  return {
    pace: tactics.pace,
    manDefensePct: tactics.manDefensePct,
    scoringOptions: tactics.scoringOptions,
    minutesAllotment: tactics.minutesAllotment,
    reboundingStrategy: tactics.reboundingStrategy,
  };
}
