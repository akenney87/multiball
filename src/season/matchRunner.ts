/**
 * Match Runner
 *
 * Integrates season flow with game simulation and AI decisions:
 * - Creates decision context from season state
 * - Generates tactical settings from AI
 * - Executes matches using GameSimulator
 * - Converts results and updates season
 *
 * Week 3: Core integration
 * Week 4: Add pre/post match hooks, event triggers
 */

import type { Player, Season, MatchResult, TacticalSettings } from '../data/types';
import type { DecisionContext, AIConfig } from '../ai/types';
import { GameSimulator, type GameResult } from '../simulation/game/gameSimulation';
import {
  simulateGame as simulateBaseballGameReal,
  type GameInput as BaseballGameInput,
  type TeamGameState as BaseballTeamState,
  DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY,
} from '../simulation/baseball';
import type { FieldingPosition } from '../simulation/baseball/systems/fielding';
import { simulateSoccerMatchV2 } from '../simulation/soccer/game/matchSimulation';
import type { SoccerMatchInput, SoccerTeamState, SoccerPosition, SoccerMatchResult } from '../simulation/soccer/types';
import { FORMATION_POSITIONS } from '../simulation/soccer/constants';
import { choosePaceStrategy, setDefenseStrategy } from '../ai/tactical';
import { processMatchResult } from './weekProcessor';

// =============================================================================
// DECISION CONTEXT CREATION
// =============================================================================

/**
 * Budget information for decision context
 */
export interface TeamBudget {
  available: number;
  total: number;
}

/**
 * Create a DecisionContext from season state for AI decisions
 *
 * Maps season data to the format expected by AI modules.
 *
 * @param season - Current season
 * @param teamId - Team making decisions
 * @param budget - Team's budget
 * @returns Decision context for AI
 */
export function createDecisionContext(
  season: Season,
  teamId: string,
  budget: TeamBudget
): DecisionContext {
  const standing = season.standings[teamId];

  return {
    week: season.currentWeek,
    transferWindowOpen: season.transferWindowOpen,
    finance: {
      available: budget.available,
      total: budget.total,
    },
    standings: standing
      ? {
          position: standing.rank,
          points: standing.points,
          goalDifferential: 0, // Not tracked yet
          record: {
            wins: standing.wins,
            losses: standing.losses,
            draws: 0,
          },
        }
      : undefined,
    seasonPhase: mapSeasonPhase(season.status),
  };
}

/**
 * Map Season status to DecisionContext seasonPhase
 */
function mapSeasonPhase(
  status: Season['status']
): DecisionContext['seasonPhase'] {
  switch (status) {
    case 'pre_season':
      return 'pre_season';
    case 'regular_season':
      return 'mid_season'; // Simplified mapping
    case 'post_season':
      return 'playoffs';
    case 'off_season':
      return 'pre_season'; // Map to pre_season for next year
    default:
      return 'mid_season';
  }
}

// =============================================================================
// BASEBALL HELPER FUNCTIONS
// =============================================================================

type BaseballPosition = 'P' | 'C' | '1B' | '2B' | 'SS' | '3B' | 'LF' | 'CF' | 'RF' | 'DH';

/**
 * Get overall rating for a player (simplified calculation)
 */
function calculatePlayerOverall(player: Player): number {
  const attrs = player.attributes;

  // Physical average (11 attributes, excluding height which uses player.height)
  const physical = (
    attrs.grip_strength +
    attrs.arm_strength +
    attrs.core_strength +
    attrs.agility +
    attrs.acceleration +
    attrs.top_speed +
    attrs.jumping +
    attrs.reactions +
    attrs.stamina +
    attrs.balance +
    attrs.durability
  ) / 11;

  // Mental average (8 attributes)
  const mental = (
    attrs.awareness +
    attrs.creativity +
    attrs.determination +
    attrs.bravery +
    attrs.consistency +
    attrs.composure +
    attrs.patience +
    attrs.teamwork
  ) / 8;

  // Technical average (6 attributes)
  const technical = (
    attrs.hand_eye_coordination +
    attrs.throw_accuracy +
    attrs.form_technique +
    attrs.finesse +
    attrs.deception +
    attrs.footwork
  ) / 6;

  // Weight: 40% physical, 30% mental, 30% technical
  return Math.round(physical * 0.4 + mental * 0.3 + technical * 0.3);
}

/**
 * Calculate baseball-specific score for position assignment
 * Uses attribute weights appropriate for each defensive position
 */
function calculateBaseballPositionScore(player: Player, position: BaseballPosition): number {
  const attrs = player.attributes;

  switch (position) {
    case 'P':
      // Pitcher: arm strength, stamina, accuracy, composure
      return attrs.arm_strength * 2 + attrs.stamina * 1.5 + attrs.throw_accuracy * 1.5 + attrs.composure;
    case 'C':
      // Catcher: durability, reactions, arm strength, awareness
      return attrs.durability * 1.5 + attrs.reactions * 1.5 + attrs.arm_strength + attrs.awareness;
    case '1B':
      // First base: height-related (grip strength for catching), reactions
      return player.height * 0.5 + attrs.grip_strength * 1.5 + attrs.reactions;
    case '2B':
    case 'SS':
      // Middle infield: agility, reactions, speed, throw accuracy
      return attrs.agility * 1.5 + attrs.reactions * 1.5 + attrs.top_speed + attrs.throw_accuracy;
    case '3B':
      // Third base: reactions, arm strength, bravery
      return attrs.reactions * 2 + attrs.arm_strength * 1.5 + attrs.bravery;
    case 'LF':
    case 'RF':
      // Corner outfield: speed, arm strength, reactions
      return attrs.top_speed * 1.5 + attrs.arm_strength * 1.5 + attrs.acceleration + attrs.reactions;
    case 'CF':
      // Center field: speed and range
      return attrs.top_speed * 2 + attrs.acceleration * 1.5 + attrs.agility + attrs.reactions;
    case 'DH':
      // DH: hitting attributes (using hand-eye, composure, patience for batting)
      return attrs.hand_eye_coordination * 2 + attrs.composure * 1.5 + attrs.patience + attrs.grip_strength;
    default:
      return calculatePlayerOverall(player);
  }
}

/**
 * Build BaseballTeamState from roster for baseball simulation
 * Assigns positions based on positional attributes
 */
function buildBaseballTeamState(
  teamId: string,
  roster: Player[]
): BaseballTeamState {
  // Sort roster by overall rating
  const sortedRoster = [...roster].sort((a, b) => {
    const overallA = calculatePlayerOverall(a);
    const overallB = calculatePlayerOverall(b);
    return overallB - overallA;
  });

  // Ensure we have at least one player
  const fallbackPlayer = sortedRoster[0];
  if (!fallbackPlayer) {
    throw new Error('Cannot build baseball team state: no players in roster');
  }

  // Determine starting pitcher (best pitcher score)
  let pitcher = fallbackPlayer;
  let bestPitchScore = -Infinity;
  for (const player of sortedRoster) {
    const score = calculateBaseballPositionScore(player, 'P');
    if (score > bestPitchScore) {
      bestPitchScore = score;
      pitcher = player;
    }
  }

  // Get lineup: top 9 players EXCLUDING the pitcher (DH rule)
  const lineup = sortedRoster.filter((p) => p.id !== pitcher.id).slice(0, 9);

  // Ensure we have 9 batters
  while (lineup.length < 9) {
    const nextPlayer = sortedRoster.find((p) => !lineup.includes(p) && p.id !== pitcher.id);
    if (nextPlayer) lineup.push(nextPlayer);
    else break;
  }

  // Determine catcher (best catcher score from lineup)
  let catcher = lineup[0] ?? fallbackPlayer;
  let bestCatcherScore = -Infinity;
  for (const player of lineup) {
    const score = calculateBaseballPositionScore(player, 'C');
    if (score > bestCatcherScore) {
      bestCatcherScore = score;
      catcher = player;
    }
  }

  // Build defense assignment
  const defensivePositions: FieldingPosition[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const defense: Record<FieldingPosition, Player> = {} as Record<FieldingPosition, Player>;
  const assignedPlayers = new Set<string>();

  // Assign pitcher and catcher first
  defense['P'] = pitcher;
  assignedPlayers.add(pitcher.id);
  defense['C'] = catcher;
  assignedPlayers.add(catcher.id);

  // Fill remaining positions using positional scoring
  for (const pos of defensivePositions) {
    if (defense[pos]) continue;

    // Find best available player for this position
    let bestPlayer: Player | null = null;
    let bestScore = -Infinity;
    for (const player of lineup) {
      if (assignedPlayers.has(player.id)) continue;
      const score = calculateBaseballPositionScore(player, pos as BaseballPosition);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }
    if (bestPlayer) {
      defense[pos] = bestPlayer;
      assignedPlayers.add(bestPlayer.id);
    } else {
      // Fallback to any player
      defense[pos] = fallbackPlayer;
    }
  }

  // Bullpen: remaining players not in starting lineup, sorted by pitching score
  const bullpenCandidates = roster
    .filter((p) => !lineup.includes(p) && p.id !== pitcher.id)
    .map((p) => ({ player: p, pitchScore: calculateBaseballPositionScore(p, 'P') }))
    .sort((a, b) => b.pitchScore - a.pitchScore);
  const bullpen = bullpenCandidates.slice(0, 5).map((c) => c.player);

  return {
    teamId,
    lineup,
    pitcher,
    bullpen,
    catcher,
    defense,
    battingOrderPosition: 0,
    pitchCount: 0,
    pitcherPitchCounts: {},
  };
}

// =============================================================================
// TACTICAL SETTINGS CREATION
// =============================================================================

/**
 * Create TacticalSettings from AI decisions
 *
 * Uses AI tactical module to determine pace and defense strategy.
 *
 * @param roster - Team roster
 * @param context - Decision context
 * @param config - AI configuration
 * @returns Tactical settings for game simulation
 */
export function createTacticalSettings(
  roster: Player[],
  context: DecisionContext,
  config: AIConfig
): TacticalSettings {
  const paceDecision = choosePaceStrategy(roster, context, config);
  const defenseDecision = setDefenseStrategy(roster, context, config);

  return {
    pace: paceDecision.pace,
    defense: defenseDecision.defense,
    // Additional settings can be added here
    shotSelection: 'balanced',
    reboundingFocus: 'balanced',
  };
}

// =============================================================================
// GAME RESULT CONVERSION
// =============================================================================

/**
 * Convert GameResult to MatchResult format
 *
 * @param matchId - Match ID
 * @param homeTeamId - Home team ID
 * @param awayTeamId - Away team ID
 * @param gameResult - Result from GameSimulator
 * @returns Match result for season tracking
 */
export function convertGameResultToMatchResult(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  gameResult: GameResult
): MatchResult {
  return {
    matchId,
    homeScore: gameResult.homeScore,
    awayScore: gameResult.awayScore,
    winner:
      gameResult.homeScore > gameResult.awayScore ? homeTeamId : awayTeamId,
    boxScore: gameResult.gameStatistics,
    playByPlay: gameResult.playByPlayText.split('\n').filter((line) => line.length > 0),
  };
}

// =============================================================================
// SOCCER V2 HELPERS
// =============================================================================

/**
 * Create SoccerTeamState from a roster for V2 simulation
 *
 * Uses default 4-4-2 formation if not specified
 */
function createSoccerTeamState(
  roster: Player[],
  teamId: string,
  teamName: string,
  tactics?: { attackingStyle?: 'possession' | 'direct' | 'counter'; defensiveLine?: 'high' | 'medium' | 'low' }
): SoccerTeamState {
  // Use first 11 players as lineup
  const lineup = roster.slice(0, 11);

  // Default formation
  const formation = '4-4-2';
  const formationPositions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2'];

  // Assign positions to players
  const positions: Record<string, SoccerPosition> = {};
  lineup.forEach((player, index) => {
    positions[player.id] = (formationPositions[index] || 'CM') as SoccerPosition;
  });

  return {
    teamId,
    teamName,
    lineup,
    formation,
    positions,
    tactics: {
      attackingStyle: tactics?.attackingStyle || 'direct',
      defensiveLine: tactics?.defensiveLine || 'medium',
    },
  };
}

/**
 * Convert SoccerMatchResult to GameResult for uniform handling
 */
function convertSoccerResultToGameResult(result: SoccerMatchResult): GameResult {
  return {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    gameStatistics: {
      ...result.boxScore,
      events: result.events, // Include events for timeline display
    },
    playByPlayText: result.playByPlay.join('\n'),
    quarterScores: [
      [result.halfTimeScore.home, result.halfTimeScore.away],
      [result.homeScore - result.halfTimeScore.home, result.awayScore - result.halfTimeScore.away],
    ],
    quarterResults: [],
    finalStamina: {},
    minutesPlayed: {},
  };
}

// =============================================================================
// MATCH EXECUTION
// =============================================================================

/**
 * Execute a match within the season
 *
 * Complete flow:
 * 1. Find match in season
 * 2. Create tactical settings for both teams
 * 3. Run game simulation
 * 4. Convert result
 * 5. Update season
 *
 * @param season - Current season
 * @param matchId - Match to execute
 * @param homeRoster - Home team roster
 * @param awayRoster - Away team roster
 * @param homeConfig - Home team AI config
 * @param awayConfig - Away team AI config
 * @returns Updated season with match result
 */
export function executeMatch(
  season: Season,
  matchId: string,
  homeRoster: Player[],
  awayRoster: Player[],
  homeConfig: AIConfig,
  awayConfig: AIConfig
): Season {
  // Find the match
  const match = season.matches.find((m) => m.id === matchId);
  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }

  if (match.status !== 'scheduled') {
    throw new Error(`Match ${matchId} is not scheduled (status: ${match.status})`);
  }

  // Create decision contexts
  const homeBudget: TeamBudget = { available: 5000000, total: 20000000 }; // Default
  const awayBudget: TeamBudget = { available: 5000000, total: 20000000 };

  const homeContext = createDecisionContext(season, match.homeTeamId, homeBudget);
  const awayContext = createDecisionContext(season, match.awayTeamId, awayBudget);

  // Create tactical settings
  const homeTactics = createTacticalSettings(homeRoster, homeContext, homeConfig);
  const awayTactics = createTacticalSettings(awayRoster, awayContext, awayConfig);

  // Run game simulation based on sport type
  let gameResult: GameResult;

  switch (match.sport) {
    case 'baseball': {
      // Build team states for real baseball simulation
      const homeTeamState = buildBaseballTeamState(match.homeTeamId, homeRoster);
      const awayTeamState = buildBaseballTeamState(match.awayTeamId, awayRoster);

      const baseballInput: BaseballGameInput = {
        homeTeam: homeTeamState,
        awayTeam: awayTeamState,
        useMercyRule: false,
        maxExtraInnings: 18,
        homeStrategy: DEFAULT_BASEBALL_STRATEGY,
        awayStrategy: DEFAULT_BASEBALL_STRATEGY,
      };

      const baseballOutput = simulateBaseballGameReal(baseballInput);

      // Convert to GameResult format
      // quarterScores is expected as [home, away][] tuples per inning
      const innings = Math.max(
        baseballOutput.result.boxScore.homeRunsByInning.length,
        baseballOutput.result.boxScore.awayRunsByInning.length
      );
      const quarterScores: [number, number][] = [];
      for (let i = 0; i < innings; i++) {
        quarterScores.push([
          baseballOutput.result.boxScore.homeRunsByInning[i] ?? 0,
          baseballOutput.result.boxScore.awayRunsByInning[i] ?? 0,
        ]);
      }

      gameResult = {
        homeScore: baseballOutput.result.homeScore,
        awayScore: baseballOutput.result.awayScore,
        gameStatistics: baseballOutput.result.boxScore as unknown as Record<string, unknown>,
        playByPlayText: baseballOutput.result.playByPlay.join('\n'),
        quarterScores,
        quarterResults: [], // Not applicable for baseball
        finalStamina: {}, // Baseball doesn't track stamina the same way
        minutesPlayed: {}, // Baseball uses at-bats/innings, not minutes
      };
      break;
    }

    case 'soccer': {
      // Use V2 event-driven simulation
      // Team names default to teamId if not available in season data
      const homeTeamName = match.homeTeamId;
      const awayTeamName = match.awayTeamId;
      const homeTeamState = createSoccerTeamState(homeRoster, match.homeTeamId, homeTeamName);
      const awayTeamState = createSoccerTeamState(awayRoster, match.awayTeamId, awayTeamName);

      const soccerInput: SoccerMatchInput = {
        homeTeam: homeTeamState,
        awayTeam: awayTeamState,
      };

      const soccerResult = simulateSoccerMatchV2(soccerInput);
      gameResult = convertSoccerResultToGameResult(soccerResult);
      break;
    }

    case 'basketball':
    default:
      // Use full basketball simulator
      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        homeTactics,
        awayTactics,
        match.homeTeamId,
        match.awayTeamId
      );
      gameResult = simulator.simulateGame();
      break;
  }

  // Convert to match result
  const matchResult = convertGameResultToMatchResult(
    matchId,
    match.homeTeamId,
    match.awayTeamId,
    gameResult
  );

  // Update season
  return processMatchResult(season, matchId, matchResult);
}

// =============================================================================
// BATCH EXECUTION
// =============================================================================

/**
 * Execute all pending matches for a week
 *
 * @param season - Current season
 * @param weekNumber - Week to execute
 * @param getRoster - Function to get roster for a team
 * @param getConfig - Function to get AI config for a team
 * @returns Updated season with all matches completed
 */
export function executeWeekMatches(
  season: Season,
  weekNumber: number,
  getRoster: (teamId: string) => Player[],
  getConfig: (teamId: string) => AIConfig
): Season {
  // Get matches for this week
  const matches = season.matches.filter((m) => {
    const matchWeek = calculateMatchWeek(m.scheduledDate, season.startDate);
    return matchWeek === weekNumber && m.status === 'scheduled';
  });

  // Execute each match
  let updatedSeason = season;
  for (const match of matches) {
    const homeRoster = getRoster(match.homeTeamId);
    const awayRoster = getRoster(match.awayTeamId);
    const homeConfig = getConfig(match.homeTeamId);
    const awayConfig = getConfig(match.awayTeamId);

    updatedSeason = executeMatch(
      updatedSeason,
      match.id,
      homeRoster,
      awayRoster,
      homeConfig,
      awayConfig
    );
  }

  return updatedSeason;
}

/**
 * Calculate which week a match falls in
 */
function calculateMatchWeek(matchDate: Date, seasonStart: Date): number {
  const diffMs = matchDate.getTime() - seasonStart.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}
