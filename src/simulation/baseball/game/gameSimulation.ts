/**
 * Baseball Game Simulation
 *
 * Simulates a complete baseball game (9+ innings).
 * Handles extra innings, mercy rule (optional), and pitcher substitutions.
 * Supports configurable pitching and batting strategies.
 *
 * @module simulation/baseball/game/gameSimulation
 */

import type { Player } from '../../../data/types';
import type {
  BaseballGameResult,
  HalfInningResult,
  PitchingStrategy,
  BattingStrategy,
  BaseballGameStrategy,
} from '../types';
import {
  DEFAULT_PITCHING_STRATEGY,
  DEFAULT_BATTING_STRATEGY,
} from '../types';
import { simulateHalfInning, getHalfInningSummary, type HalfInningInput } from './halfInning';
import { generateBoxScore } from './boxScore';
import { type FieldingPosition } from '../systems/fielding';
import { INNINGS_PER_GAME } from '../constants';

// =============================================================================
// TYPES
// =============================================================================

export interface TeamGameState {
  /** Team ID */
  teamId: string;
  /** Team name (for display) */
  teamName: string;
  /** Lineup (9 players in batting order) */
  lineup: Player[];
  /** Current pitcher */
  pitcher: Player;
  /** Bullpen (available relief pitchers) */
  bullpen: Player[];
  /** Catcher */
  catcher: Player;
  /** Defensive alignment by position */
  defense: Record<FieldingPosition, Player>;
  /** Current batting order position */
  battingOrderPosition: number;
  /** Current pitcher's pitch count */
  pitchCount: number;
  /** Pitchers used and their pitch counts */
  pitcherPitchCounts: Record<string, number>;
  /** Pitching strategy for this team */
  pitchingStrategy?: PitchingStrategy;
  /** Batting strategy for this team */
  battingStrategy?: BattingStrategy;
}

export interface GameInput {
  /** Home team state */
  homeTeam: TeamGameState;
  /** Away team state */
  awayTeam: TeamGameState;
  /** Optional: Use mercy rule (10+ run lead after 7) */
  useMercyRule?: boolean;
  /** Optional: Maximum extra innings (default 18) */
  maxExtraInnings?: number;
  /** Optional: Home team strategy (overrides team state if provided) */
  homeStrategy?: BaseballGameStrategy;
  /** Optional: Away team strategy (overrides team state if provided) */
  awayStrategy?: BaseballGameStrategy;
}

export interface GameOutput {
  /** Complete game result */
  result: BaseballGameResult;
  /** Final home team state */
  finalHomeState: TeamGameState;
  /** Final away team state */
  finalAwayState: TeamGameState;
}

// =============================================================================
// GAME SIMULATION
// =============================================================================

/**
 * Simulate a complete baseball game
 *
 * @param input - Game input with both teams
 * @returns Complete game output
 */
export function simulateGame(input: GameInput): GameOutput {
  const {
    homeTeam: initialHomeTeam,
    awayTeam: initialAwayTeam,
    useMercyRule = false,
    maxExtraInnings = 18,
    homeStrategy,
    awayStrategy,
  } = input;

  // Clone team states to avoid mutation
  const homeTeam = cloneTeamState(initialHomeTeam);
  const awayTeam = cloneTeamState(initialAwayTeam);

  // Apply strategies (input strategies override team state strategies)
  const homePitchingStrategy = homeStrategy?.pitching ?? homeTeam.pitchingStrategy ?? DEFAULT_PITCHING_STRATEGY;
  const homeBattingStrategy = homeStrategy?.batting ?? homeTeam.battingStrategy ?? DEFAULT_BATTING_STRATEGY;
  const awayPitchingStrategy = awayStrategy?.pitching ?? awayTeam.pitchingStrategy ?? DEFAULT_PITCHING_STRATEGY;
  const awayBattingStrategy = awayStrategy?.batting ?? awayTeam.battingStrategy ?? DEFAULT_BATTING_STRATEGY;

  // Track game state
  let homeScore = 0;
  let awayScore = 0;
  const halfInnings: HalfInningResult[] = [];
  const playByPlay: string[] = [];
  let currentInning = 1;
  let gameOver = false;

  // Track pitchers who have been removed from the game (can't re-enter in baseball)
  const homeRemovedPitchers = new Set<string>();
  const awayRemovedPitchers = new Set<string>();

  // Play regulation innings
  while (currentInning <= INNINGS_PER_GAME && !gameOver) {
    // Top of inning (away team bats)
    const topResult = playHalfInning(
      currentInning,
      'top',
      awayTeam,
      homeTeam,
      awayScore - homeScore,
      awayBattingStrategy,
      homePitchingStrategy
    );

    halfInnings.push(topResult.result);
    playByPlay.push(...getHalfInningSummary(topResult.result, {
      battingTeamName: awayTeam.teamName,
      pitcherName: homeTeam.pitcher.name,
    }));
    awayScore += topResult.result.runs;

    // Update team states from half-inning result
    awayTeam.battingOrderPosition = topResult.newBattingOrderPosition;
    homeTeam.pitchCount = topResult.newPitchCount;
    homeTeam.pitcher = topResult.currentPitcher; // May have changed mid-inning
    homeTeam.bullpen = topResult.remainingBullpen;
    // Merge pitch counts
    Object.assign(homeTeam.pitcherPitchCounts, topResult.pitcherPitchCounts);
    homeTeam.defense['P'] = topResult.currentPitcher;

    // Check for END-of-inning pitcher substitution (if not already done mid-inning)
    if (topResult.pitcherNeedsSubstitution && homeTeam.bullpen.length > 0) {
      substitutePitcher(homeTeam, homeRemovedPitchers);
      playByPlay.push(`Pitching change: ${homeTeam.pitcher.name} enters the game.`);
    }

    // Filter bullpen to remove any pitchers who were removed during this half-inning
    // (safety check - pitchers who left can't re-enter in baseball)
    homeTeam.bullpen = homeTeam.bullpen.filter(p => !homeRemovedPitchers.has(p.id));

    // Check mercy rule after top half
    if (useMercyRule && currentInning >= 7 && awayScore - homeScore >= 10) {
      gameOver = true;
      playByPlay.push('Game called due to mercy rule.');
      break;
    }

    // Bottom of inning (home team bats)
    // Skip bottom of 9th if home team is ahead
    if (currentInning === INNINGS_PER_GAME && homeScore > awayScore) {
      gameOver = true;
      break;
    }

    const bottomResult = playHalfInning(
      currentInning,
      'bottom',
      homeTeam,
      awayTeam,
      homeScore - awayScore,
      homeBattingStrategy,
      awayPitchingStrategy
    );

    halfInnings.push(bottomResult.result);
    playByPlay.push(...getHalfInningSummary(bottomResult.result, {
      battingTeamName: homeTeam.teamName,
      pitcherName: awayTeam.pitcher.name,
    }));
    homeScore += bottomResult.result.runs;

    // Update team states from half-inning result
    homeTeam.battingOrderPosition = bottomResult.newBattingOrderPosition;
    awayTeam.pitchCount = bottomResult.newPitchCount;
    awayTeam.pitcher = bottomResult.currentPitcher; // May have changed mid-inning
    awayTeam.bullpen = bottomResult.remainingBullpen;
    // Merge pitch counts
    Object.assign(awayTeam.pitcherPitchCounts, bottomResult.pitcherPitchCounts);
    awayTeam.defense['P'] = bottomResult.currentPitcher;

    // Check for END-of-inning pitcher substitution (if not already done mid-inning)
    if (bottomResult.pitcherNeedsSubstitution && awayTeam.bullpen.length > 0) {
      substitutePitcher(awayTeam, awayRemovedPitchers);
      playByPlay.push(`Pitching change: ${awayTeam.pitcher.name} enters the game.`);
    }

    // Filter bullpen to remove any pitchers who were removed during this half-inning
    awayTeam.bullpen = awayTeam.bullpen.filter(p => !awayRemovedPitchers.has(p.id));

    // Walk-off win check
    if (currentInning >= INNINGS_PER_GAME && homeScore > awayScore) {
      gameOver = true;
      playByPlay.push('Walk-off win!');
      break;
    }

    // Check mercy rule after bottom half
    if (useMercyRule && currentInning >= 7 && homeScore - awayScore >= 10) {
      gameOver = true;
      playByPlay.push('Game called due to mercy rule.');
      break;
    }

    currentInning++;
  }

  // Extra innings if tied after 9
  let extraInningsPlayed = 0;
  while (homeScore === awayScore && extraInningsPlayed < maxExtraInnings) {
    extraInningsPlayed++;
    currentInning++;

    // Top of extra inning
    const topResult = playHalfInning(
      currentInning,
      'top',
      awayTeam,
      homeTeam,
      awayScore - homeScore,
      awayBattingStrategy,
      homePitchingStrategy
    );

    halfInnings.push(topResult.result);
    playByPlay.push(...getHalfInningSummary(topResult.result, {
      battingTeamName: awayTeam.teamName,
      pitcherName: homeTeam.pitcher.name,
    }));
    awayScore += topResult.result.runs;

    awayTeam.battingOrderPosition = topResult.newBattingOrderPosition;
    homeTeam.pitchCount = topResult.newPitchCount;
    homeTeam.pitcher = topResult.currentPitcher;
    homeTeam.bullpen = topResult.remainingBullpen;
    Object.assign(homeTeam.pitcherPitchCounts, topResult.pitcherPitchCounts);
    homeTeam.defense['P'] = topResult.currentPitcher;

    if (topResult.pitcherNeedsSubstitution && homeTeam.bullpen.length > 0) {
      substitutePitcher(homeTeam, homeRemovedPitchers);
      playByPlay.push(`Pitching change: ${homeTeam.pitcher.name} enters the game.`);
    }
    homeTeam.bullpen = homeTeam.bullpen.filter(p => !homeRemovedPitchers.has(p.id));

    // Bottom of extra inning
    const bottomResult = playHalfInning(
      currentInning,
      'bottom',
      homeTeam,
      awayTeam,
      homeScore - awayScore,
      homeBattingStrategy,
      awayPitchingStrategy
    );

    halfInnings.push(bottomResult.result);
    playByPlay.push(...getHalfInningSummary(bottomResult.result, {
      battingTeamName: homeTeam.teamName,
      pitcherName: awayTeam.pitcher.name,
    }));
    homeScore += bottomResult.result.runs;

    homeTeam.battingOrderPosition = bottomResult.newBattingOrderPosition;
    awayTeam.pitchCount = bottomResult.newPitchCount;
    awayTeam.pitcher = bottomResult.currentPitcher;
    awayTeam.bullpen = bottomResult.remainingBullpen;
    Object.assign(awayTeam.pitcherPitchCounts, bottomResult.pitcherPitchCounts);
    awayTeam.defense['P'] = bottomResult.currentPitcher;

    if (bottomResult.pitcherNeedsSubstitution && awayTeam.bullpen.length > 0) {
      substitutePitcher(awayTeam, awayRemovedPitchers);
      playByPlay.push(`Pitching change: ${awayTeam.pitcher.name} enters the game.`);
    }
    awayTeam.bullpen = awayTeam.bullpen.filter(p => !awayRemovedPitchers.has(p.id));

    // Check for winner
    if (homeScore !== awayScore) {
      if (homeScore > awayScore) {
        playByPlay.push('Walk-off win in extra innings!');
      }
      break;
    }
  }

  // Handle tie (shouldn't happen in real baseball, but cap at maxExtraInnings)
  if (homeScore === awayScore) {
    playByPlay.push(`Game ends in a tie after ${currentInning} innings.`);
  }

  // Generate box score
  const boxScore = generateBoxScore(halfInnings, homeTeam, awayTeam);

  // Determine winner
  const winner = homeScore > awayScore ? homeTeam.teamId : awayTeam.teamId;

  const result: BaseballGameResult = {
    homeTeamId: homeTeam.teamId,
    awayTeamId: awayTeam.teamId,
    homeScore,
    awayScore,
    winner,
    innings: currentInning,
    boxScore,
    playByPlay,
    halfInnings,
  };

  return {
    result,
    finalHomeState: homeTeam,
    finalAwayState: awayTeam,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Play a single half-inning
 */
function playHalfInning(
  inning: number,
  half: 'top' | 'bottom',
  battingTeam: TeamGameState,
  fieldingTeam: TeamGameState,
  scoreDiff: number,
  battingStrategy: BattingStrategy,
  pitchingStrategy: PitchingStrategy
): ReturnType<typeof simulateHalfInning> {
  const input: HalfInningInput = {
    inning,
    half,
    battingLineup: battingTeam.lineup,
    battingOrderPosition: battingTeam.battingOrderPosition,
    pitcher: fieldingTeam.pitcher,
    catcher: fieldingTeam.catcher,
    defense: fieldingTeam.defense,
    pitchCount: fieldingTeam.pitchCount,
    scoreDiff,
    bullpen: fieldingTeam.bullpen,
    pitchingStrategy,
    battingStrategy,
  };

  return simulateHalfInning(input);
}

/**
 * Substitute pitcher from bullpen
 *
 * @param team - Team state
 * @param removedPitchers - Set to track pitchers removed from game (can't re-enter)
 * @returns The old pitcher who was removed, or null if no substitution occurred
 */
function substitutePitcher(team: TeamGameState, removedPitchers?: Set<string>): Player | null {
  if (team.bullpen.length === 0) return null;

  // Get next reliever from bullpen
  const newPitcher = team.bullpen.shift();
  if (!newPitcher) return null;

  // Track the old pitcher as removed (can't re-enter in baseball)
  const oldPitcher = team.pitcher;
  if (removedPitchers) {
    removedPitchers.add(oldPitcher.id);
  }

  // Store old pitcher's final pitch count
  team.pitcherPitchCounts[team.pitcher.id] = team.pitchCount;

  // Bring in new pitcher
  team.pitcher = newPitcher;
  team.pitchCount = 0;
  team.pitcherPitchCounts[newPitcher.id] = 0;

  // Update defense
  team.defense['P'] = newPitcher;

  return oldPitcher;
}

/**
 * Clone team state to avoid mutation
 */
function cloneTeamState(team: TeamGameState): TeamGameState {
  return {
    ...team,
    lineup: [...team.lineup],
    bullpen: [...team.bullpen],
    defense: { ...team.defense },
    pitcherPitchCounts: { ...team.pitcherPitchCounts },
  };
}

/**
 * Create initial team state from roster
 *
 * Convenience function to set up a team for game simulation.
 * The lineup should include 9 batters (8 position players + DH).
 * The pitcher does NOT bat (universal DH rule).
 */
export function createTeamGameState(
  teamId: string,
  teamName: string,
  lineup: Player[],
  startingPitcher: Player,
  bullpen: Player[],
  defensivePositions: Record<FieldingPosition, Player>
): TeamGameState {
  // Validate lineup - must be 9 batters (no pitcher in lineup with DH)
  if (lineup.length !== 9) {
    throw new Error(`Lineup must have exactly 9 players, got ${lineup.length}`);
  }

  // Validate that pitcher is NOT in the lineup (universal DH)
  if (lineup.some(p => p.id === startingPitcher.id)) {
    throw new Error('Pitcher should not be in batting lineup (DH rule)');
  }

  // Ensure catcher is in defensive positions
  const catcher = defensivePositions['C'];
  if (!catcher) {
    throw new Error('Defensive positions must include a catcher (C)');
  }

  // Initialize pitcher pitch counts
  const pitcherPitchCounts: Record<string, number> = {};
  pitcherPitchCounts[startingPitcher.id] = 0;

  return {
    teamId,
    teamName,
    lineup,
    pitcher: startingPitcher,
    bullpen,
    catcher,
    defense: {
      ...defensivePositions,
      P: startingPitcher, // Ensure pitcher is in defense
    },
    battingOrderPosition: 0,
    pitchCount: 0,
    pitcherPitchCounts,
  };
}
