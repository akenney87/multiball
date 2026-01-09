/**
 * Baseball Simulation Types
 *
 * Type definitions specific to baseball simulation.
 *
 * @module simulation/baseball/types
 */

import type { Player } from '../../data/types';

// =============================================================================
// GAME STATE TYPES
// =============================================================================

/**
 * Base state representation
 * Index 0 = first base, 1 = second base, 2 = third base
 */
export type BaseState = [Player | null, Player | null, Player | null];

/**
 * How a runner reached base (for earned run calculation)
 */
export type ReachedBaseVia = 'hit' | 'walk' | 'hbp' | 'error' | 'fielders_choice';

/**
 * Runner on base with tracking info for earned runs
 */
export interface BaseRunner {
  player: Player;
  reachedVia: ReachedBaseVia;
}

/**
 * Runner origin tracking with responsible pitcher
 * Used to properly attribute runs to the pitcher who allowed the runner
 */
export interface RunnerOrigin {
  /** How the runner reached base */
  reachedVia: ReachedBaseVia;
  /** The pitcher who allowed this runner to reach base (for inherited runner tracking) */
  responsiblePitcherId: string;
}

/**
 * Extended base state that tracks how runners reached base
 * Used for earned run calculation
 */
export type BaseStateWithOrigin = [BaseRunner | null, BaseRunner | null, BaseRunner | null];

/**
 * At-bat outcome types
 */
export type AtBatOutcome =
  | 'strikeout'
  | 'walk'
  | 'hit_by_pitch'
  | 'intentional_walk'
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'groundout'
  | 'flyout'
  | 'lineout'
  | 'popup'
  | 'error'
  | 'fielders_choice'
  | 'double_play'
  | 'triple_play'
  | 'caught_stealing';

/**
 * Hit location types
 */
export type HitLocation =
  | 'left_field'
  | 'center_field'
  | 'right_field'
  | 'left_line'
  | 'right_line'
  | 'shortstop_hole'
  | 'up_the_middle'
  | 'third_base_line'
  | 'first_base_line';

/**
 * Hit type for balls in play
 */
export type HitType = 'single' | 'double' | 'triple' | 'home_run';

// =============================================================================
// BASERUNNING EVENTS
// =============================================================================

/**
 * Stolen base event
 */
export interface StolenBaseEvent {
  type: 'stolen_base';
  runner: Player;
  targetBase: 2 | 3 | 4;
  success: true;
}

/**
 * Caught stealing event
 */
export interface CaughtStealingEvent {
  type: 'caught_stealing';
  runner: Player;
  targetBase: 2 | 3 | 4;
  catcher: Player;
}

/**
 * Runner advancement detail for wild pitch/passed ball
 */
export interface RunnerAdvancement {
  runner: Player;
  from: 1 | 2 | 3;
  to: 2 | 3 | 4;  // 4 = home (scored)
}

/**
 * Wild pitch event
 */
export interface WildPitchEvent {
  type: 'wild_pitch';
  pitcher: Player;
  runnersAdvanced: Player[];
  advancements: RunnerAdvancement[];
  runsScored: number;
}

/**
 * Passed ball event
 */
export interface PassedBallEvent {
  type: 'passed_ball';
  catcher: Player;
  runnersAdvanced: Player[];
  advancements: RunnerAdvancement[];
  runsScored: number;
}

/**
 * Intentional walk event
 */
export interface IntentionalWalkEvent {
  type: 'intentional_walk';
  batter: Player;
  pitcher: Player;
}

/**
 * Pitcher change event (mid-inning substitution)
 */
export interface PitcherChangeEvent {
  type: 'pitcher_change';
  oldPitcher: Player;
  newPitcher: Player;
  atBatIndex: number;
  inheritedRunners: number;
  reason: 'pitch_count' | 'runs_allowed' | 'meltdown' | 'closer' | 'bases_loaded';
}

/**
 * Union of all baserunning/pitching events that can occur during an at-bat
 */
export type BaserunningEvent =
  | StolenBaseEvent
  | CaughtStealingEvent
  | WildPitchEvent
  | PassedBallEvent;

/**
 * Union of all half-inning events for play-by-play and box score
 */
export type HalfInningEvent =
  | { type: 'at_bat'; result: AtBatResult }
  | StolenBaseEvent
  | CaughtStealingEvent
  | WildPitchEvent
  | PassedBallEvent
  | IntentionalWalkEvent
  | PitcherChangeEvent;

// =============================================================================
// AT-BAT RESULT
// =============================================================================

/**
 * Result of a single at-bat
 */
export interface AtBatResult {
  /** Outcome type */
  outcome: AtBatOutcome;

  /** Batter */
  batter: Player;

  /** Pitcher */
  pitcher: Player;

  /** Runs scored on this at-bat */
  runsScored: number;

  /** Earned runs scored on this at-bat (excludes runners who reached on error) */
  earnedRunsScored: number;

  /** RBIs credited to batter */
  rbi: number;

  /** Players who scored */
  scoringRunners: Player[];

  /** Players who scored that count as earned runs */
  earnedScoringRunners: Player[];

  /**
   * Runs charged to each pitcher (by pitcher ID)
   * Handles inherited runners: if a reliever inherits a runner who scores,
   * the run is charged to the pitcher who originally allowed that runner.
   */
  runsChargedByPitcher: Record<string, number>;

  /**
   * Earned runs charged to each pitcher (by pitcher ID)
   * Same as runsChargedByPitcher but excludes unearned runs.
   */
  earnedRunsChargedByPitcher: Record<string, number>;

  /** Hit location (if ball in play) */
  hitLocation?: HitLocation;

  /** Was there an error? */
  isError: boolean;

  /** Fielder who committed error (if any) */
  errorFielder?: Player;

  /** Base advancement for runners */
  baseAdvancement: {
    first: Player | null;
    second: Player | null;
    third: Player | null;
  };

  /** Outs recorded */
  outsRecorded: number;

  /** Play-by-play text */
  playByPlayText: string;

  /** Baserunning events that occurred during this at-bat (steals, WP, PB) */
  events?: BaserunningEvent[];

  /** Whether this was a sacrifice fly */
  isSacrificeFly?: boolean;

  /** Whether batter grounded into double play */
  isGIDP?: boolean;

  /** Number of outs when RBIs occurred (for 2-out RBI tracking) */
  outsWhenRbiOccurred?: number;

  /** Debug info for validation */
  debugInfo: {
    batterContact: number;
    batterPower: number;
    batterDiscipline: number;
    pitcherVelocity: number;
    pitcherControl: number;
    pitcherMovement: number;
    platoonAdvantage: boolean;
    clutchSituation: boolean;
    pitcherFatigue: number;
  };
}

// =============================================================================
// INNING RESULT
// =============================================================================

/**
 * Result of a half-inning
 */
export interface HalfInningResult {
  /** Inning number (1-9+) */
  inning: number;

  /** Top or bottom */
  half: 'top' | 'bottom';

  /** Runs scored */
  runs: number;

  /** Hits */
  hits: number;

  /** Errors */
  errors: number;

  /** Left on base */
  leftOnBase: number;

  /** At-bat results */
  atBats: AtBatResult[];

  /** All events in order (at-bats, steals, WP, etc.) */
  events: HalfInningEvent[];

  /** Pitch count for pitcher(s) */
  pitchCounts: Record<string, number>;

  /** Stolen bases this half-inning */
  stolenBases: number;

  /** Caught stealing this half-inning */
  caughtStealing: number;

  /** Wild pitches this half-inning */
  wildPitches: number;

  /** Passed balls this half-inning */
  passedBalls: number;
}

// =============================================================================
// BOX SCORE
// =============================================================================

/**
 * Individual batting line in box score
 */
export interface BaseballBattingLine {
  /** At bats */
  atBats: number;
  /** Runs scored */
  runs: number;
  /** Hits */
  hits: number;
  /** Doubles */
  doubles: number;
  /** Triples */
  triples: number;
  /** Home runs */
  homeRuns: number;
  /** Runs batted in */
  rbi: number;
  /** Walks */
  walks: number;
  /** Strikeouts */
  strikeouts: number;
  /** Stolen bases */
  stolenBases: number;
  /** Caught stealing */
  caughtStealing: number;
  /** Sacrifice flies */
  sacrificeFlies: number;
  /** Grounded into double play */
  gidp: number;
  /** RBIs with 2 outs */
  rbiWith2Outs: number;
}

/**
 * Individual pitching line in box score
 */
export interface BaseballPitchingLine {
  /** Innings pitched (as decimal, e.g., 6.2 = 6 and 2/3) */
  inningsPitched: number;
  /** Hits allowed */
  hits: number;
  /** Runs allowed */
  runs: number;
  /** Earned runs */
  earnedRuns: number;
  /** Walks */
  walks: number;
  /** Intentional walks */
  intentionalWalks: number;
  /** Strikeouts */
  strikeouts: number;
  /** Home runs allowed */
  homeRuns: number;
  /** Pitch count */
  pitchCount: number;
  /** Wild pitches */
  wildPitches: number;
  /** Decision (W/L/S/H or undefined) */
  decision?: 'W' | 'L' | 'S' | 'H';
}

/**
 * Individual catcher line in box score (for passed balls)
 */
export interface BaseballCatcherLine {
  /** Passed balls */
  passedBalls: number;
  /** Runners caught stealing */
  runnersCaughtStealing: number;
  /** Stolen bases allowed */
  stolenBasesAllowed: number;
}

/**
 * Complete baseball box score
 */
export interface BaseballBoxScore {
  /** Runs scored by inning (home team) */
  homeRunsByInning: number[];
  /** Runs scored by inning (away team) */
  awayRunsByInning: number[];

  /** Total runs (home) */
  homeRuns: number;
  /** Total runs (away) */
  awayRuns: number;
  /** Total hits (home) */
  homeHits: number;
  /** Total hits (away) */
  awayHits: number;
  /** Total errors (home) */
  homeErrors: number;
  /** Total errors (away) */
  awayErrors: number;

  /** Errors by fielder (home) - playerId -> error count */
  homeErrorsByFielder: Record<string, number>;
  /** Errors by fielder (away) - playerId -> error count */
  awayErrorsByFielder: Record<string, number>;

  /** Batting lines (home) */
  homeBatting: Record<string, BaseballBattingLine>;
  /** Batting lines (away) */
  awayBatting: Record<string, BaseballBattingLine>;
  /** Pitching lines (home) */
  homePitching: Record<string, BaseballPitchingLine>;
  /** Pitching lines (away) */
  awayPitching: Record<string, BaseballPitchingLine>;
  /** Catcher lines (home) */
  homeCatching?: Record<string, BaseballCatcherLine>;
  /** Catcher lines (away) */
  awayCatching?: Record<string, BaseballCatcherLine>;

  /** Defensive positions by player (home) - playerId -> position */
  homePositions?: Record<string, string>;
  /** Defensive positions by player (away) - playerId -> position */
  awayPositions?: Record<string, string>;

  /** Team left on base (home) */
  homeLeftOnBase: number;
  /** Team left on base (away) */
  awayLeftOnBase: number;

  /** Total stolen bases (home) */
  homeStolenBases: number;
  /** Total stolen bases (away) */
  awayStolenBases: number;
  /** Total caught stealing (home) */
  homeCaughtStealing: number;
  /** Total caught stealing (away) */
  awayCaughtStealing: number;

  /** Total wild pitches (home pitchers) */
  homeWildPitches: number;
  /** Total wild pitches (away pitchers) */
  awayWildPitches: number;
  /** Total passed balls (home catchers) */
  homePassedBalls: number;
  /** Total passed balls (away catchers) */
  awayPassedBalls: number;

  /** Number of innings played */
  innings: number;
}

// =============================================================================
// GAME RESULT
// =============================================================================

/**
 * Complete baseball game result
 */
export interface BaseballGameResult {
  /** Home team ID */
  homeTeamId: string;
  /** Away team ID */
  awayTeamId: string;

  /** Final score (home) */
  homeScore: number;
  /** Final score (away) */
  awayScore: number;

  /** Winning team ID */
  winner: string;

  /** Number of innings played */
  innings: number;

  /** Full box score */
  boxScore: BaseballBoxScore;

  /** Play-by-play log */
  playByPlay: string[];

  /** Half-inning results */
  halfInnings: HalfInningResult[];
}

// =============================================================================
// STRATEGY TYPES
// =============================================================================

/**
 * Pitching management strategy
 */
export interface PitchingStrategy {
  /** Base rope (runs allowed before hook) before situational adjustments */
  starterMaxRunsInning: number;
  /** Reliever rope (shorter leash) */
  relieverMaxRunsInning: number;
  /** Hard pitch count cap for starters */
  starterMaxPitchCount: number;
  /** Enable quick hook (tighter rope overall, -1 to base) */
  quickHookEnabled: boolean;
  /** Enable long leash (looser rope overall, +1 to base) */
  longLeashEnabled: boolean;
  /** Automatically bring in closer in save situations */
  useCloserInSaveSpots: boolean;
}

/**
 * Plate approach type
 */
export type PlateApproach = 'aggressive' | 'patient' | 'balanced';

/**
 * Swing style type
 */
export type SwingStyle = 'contact' | 'power' | 'balanced';

/**
 * Baserunning style type
 */
export type BaserunningStyle = 'aggressive' | 'conservative' | 'balanced';

/**
 * Batting and baserunning strategy
 */
export interface BattingStrategy {
  /** Plate approach affects K%, BB% */
  plateApproach: PlateApproach;
  /** Swing style affects HR% vs BA */
  swingStyle: SwingStyle;
  /** Baserunning affects steal attempts and extra bases */
  baserunningStyle: BaserunningStyle;
}

/**
 * Complete game strategy settings
 */
export interface BaseballGameStrategy {
  pitching: PitchingStrategy;
  batting: BattingStrategy;
}

/**
 * Default pitching strategy
 */
export const DEFAULT_PITCHING_STRATEGY: PitchingStrategy = {
  starterMaxRunsInning: 4,
  relieverMaxRunsInning: 3,
  starterMaxPitchCount: 100,
  quickHookEnabled: false,
  longLeashEnabled: false,
  useCloserInSaveSpots: true,
};

/**
 * Default batting strategy
 */
export const DEFAULT_BATTING_STRATEGY: BattingStrategy = {
  plateApproach: 'balanced',
  swingStyle: 'balanced',
  baserunningStyle: 'balanced',
};

/**
 * Default game strategy
 */
export const DEFAULT_GAME_STRATEGY: BaseballGameStrategy = {
  pitching: DEFAULT_PITCHING_STRATEGY,
  batting: DEFAULT_BATTING_STRATEGY,
};

// =============================================================================
// SUBSTITUTION CONTEXT
// =============================================================================

/**
 * Context for determining whether to substitute a pitcher
 */
export interface SubstitutionContext {
  /** Current pitcher */
  pitcher: Player;
  /** Whether this is the starting pitcher or a reliever */
  isStarter: boolean;
  /** Current pitch count for this pitcher */
  pitchCount: number;
  /** Current inning number */
  inning: number;
  /** Current outs in the inning */
  outs: number;
  /** Current base state */
  baseState: BaseState;
  /** Runs allowed THIS inning by current pitcher */
  runsAllowedThisInning: number;
  /** Hits allowed THIS inning by current pitcher */
  hitsAllowedThisInning: number;
  /** Current score differential (positive = fielding team ahead) */
  scoreDiff: number;
  /** Whether bullpen has available pitchers */
  bullpenAvailable: boolean;
}
