/**
 * Morale System for Multiball
 *
 * Tracks player happiness based on playing time vs squad role and match results.
 * Low morale degrades mental attributes and can trigger transfer requests.
 *
 * @module systems/moraleSystem
 */

import { Player, MatchOutcome, SquadRole } from '../data/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Morale thresholds */
export const MORALE_HAPPY = 80;      // 80-100: Happy, +5% mental boost
export const MORALE_CONTENT = 60;    // 60-79: Content, baseline
export const MORALE_UNHAPPY = 40;    // 40-59: Unhappy, -10% mental penalty
// Below 40: Disgruntled, -25% mental penalty, transfer request risk

/** Default starting morale */
export const DEFAULT_MORALE = 75;

/** Morale bounds */
export const MORALE_MIN = 0;
export const MORALE_MAX = 100;

/** Factor weights for morale calculation */
export const PLAYING_TIME_WEIGHT = 0.6;  // 60% weight
export const MATCH_RESULTS_WEIGHT = 0.4; // 40% weight

/** Weighted windows for match results */
export const RESULT_WEIGHTS = {
  last1: 0.40,   // Last match: 40% weight
  last3: 0.30,   // Last 3 matches: 30% weight
  last10: 0.20,  // Last 10 matches: 20% weight
  last20: 0.10,  // Last 20 matches: 10% weight
};

/** Transfer request probability when disgruntled */
export const TRANSFER_REQUEST_BASE_CHANCE = 0.15;  // 15% per week
export const TRANSFER_REQUEST_INCREASE_PER_WEEK = 0.05;  // +5% per consecutive week

/** Weekly morale drift toward baseline */
export const WEEKLY_MORALE_DRIFT = 2;  // Points per week toward baseline (75)

// =============================================================================
// EXPECTED MINUTES BY SQUAD ROLE AND SPORT
// =============================================================================

interface MinutesExpectation {
  min: number;
  max: number;
}

type SportMinutesExpectations = Record<SquadRole, MinutesExpectation>;

/** Expected minutes per game by squad role (basketball) */
const BASKETBALL_MINUTES: SportMinutesExpectations = {
  star_player: { min: 32, max: 36 },
  important_player: { min: 26, max: 32 },
  rotation_player: { min: 16, max: 26 },
  squad_player: { min: 8, max: 16 },
  youth_prospect: { min: 0, max: 12 },
  backup: { min: 0, max: 8 },
};

/** Expected minutes per game by squad role (soccer) */
const SOCCER_MINUTES: SportMinutesExpectations = {
  star_player: { min: 80, max: 90 },
  important_player: { min: 70, max: 80 },
  rotation_player: { min: 45, max: 70 },
  squad_player: { min: 20, max: 45 },
  youth_prospect: { min: 0, max: 30 },
  backup: { min: 0, max: 20 },
};

/** Expected innings per game by squad role (baseball) - stored as minutes equivalent */
const BASEBALL_MINUTES: SportMinutesExpectations = {
  star_player: { min: 8, max: 9 },      // 8-9 innings
  important_player: { min: 6, max: 8 },  // 6-8 innings
  rotation_player: { min: 4, max: 6 },   // 4-6 innings
  squad_player: { min: 2, max: 4 },      // 2-4 innings
  youth_prospect: { min: 0, max: 3 },    // 0-3 innings
  backup: { min: 0, max: 2 },            // 0-2 innings
};

/** Get expected minutes for a squad role and sport */
export function getExpectedMinutes(
  role: SquadRole,
  sport: 'basketball' | 'baseball' | 'soccer'
): MinutesExpectation {
  switch (sport) {
    case 'basketball':
      return BASKETBALL_MINUTES[role];
    case 'soccer':
      return SOCCER_MINUTES[role];
    case 'baseball':
      return BASEBALL_MINUTES[role];
    default:
      return BASKETBALL_MINUTES[role];
  }
}

// =============================================================================
// CORE MORALE CALCULATIONS
// =============================================================================

/**
 * Calculate playing time satisfaction (0-100)
 *
 * Compares actual minutes played to expected minutes for squad role.
 *
 * @param actualMinutesPerGame - Average minutes per game over last 5 games
 * @param squadRole - Player's contracted squad role
 * @param sport - Sport being evaluated
 * @returns Satisfaction score 0-100
 */
export function calculatePlayingTimeSatisfaction(
  actualMinutesPerGame: number,
  squadRole: SquadRole,
  sport: 'basketball' | 'baseball' | 'soccer'
): number {
  const expected = getExpectedMinutes(squadRole, sport);

  // If getting expected minutes or more, fully satisfied
  if (actualMinutesPerGame >= expected.min) {
    // Getting expected or above = 70-100 satisfaction
    const overPerformance = Math.min(actualMinutesPerGame - expected.min, expected.max - expected.min);
    const overPerformanceRatio = (expected.max - expected.min) > 0
      ? overPerformance / (expected.max - expected.min)
      : 1;
    return 70 + Math.round(overPerformanceRatio * 30);
  }

  // Below minimum expected = dissatisfaction
  // 0 minutes = 0 satisfaction, min expected = 70 satisfaction
  if (expected.min === 0) {
    return 70; // No expectation, always satisfied
  }

  const deficit = expected.min - actualMinutesPerGame;
  const maxDeficit = expected.min; // Worst case: 0 minutes
  const deficitRatio = deficit / maxDeficit;

  // Scale from 70 (at min) to 0 (at 0 minutes)
  return Math.max(0, Math.round(70 * (1 - deficitRatio)));
}

/**
 * Calculate match results satisfaction (0-100)
 *
 * Uses weighted windows: last 1 (40%), last 3 (30%), last 10 (20%), last 20 (10%)
 *
 * @param recentResults - Array of recent match outcomes (most recent first)
 * @returns Satisfaction score 0-100
 */
export function calculateMatchResultsSatisfaction(
  recentResults: MatchOutcome[]
): number {
  if (recentResults.length === 0) {
    return 50; // Neutral if no history
  }

  // Calculate win rate for each window
  const getWindowScore = (results: MatchOutcome[]): number => {
    if (results.length === 0) return 50;
    const wins = results.filter(r => r === 'win').length;
    const draws = results.filter(r => r === 'draw').length;
    // Win = 100, Draw = 50, Loss = 0
    return ((wins * 100) + (draws * 50)) / results.length;
  };

  // Get each window's score
  const last1Score = getWindowScore(recentResults.slice(0, 1));
  const last3Score = getWindowScore(recentResults.slice(0, 3));
  const last10Score = getWindowScore(recentResults.slice(0, 10));
  const last20Score = getWindowScore(recentResults.slice(0, 20));

  // Apply weights
  const weightedScore =
    (last1Score * RESULT_WEIGHTS.last1) +
    (last3Score * RESULT_WEIGHTS.last3) +
    (last10Score * RESULT_WEIGHTS.last10) +
    (last20Score * RESULT_WEIGHTS.last20);

  return Math.round(weightedScore);
}

/**
 * Calculate personality modifiers for morale changes
 *
 * Uses existing mental attributes to affect morale stability:
 * - Composure: Smaller swings (±30% modifier)
 * - Determination: Faster recovery from low morale
 * - Teamwork: More affected by team results, less by personal playing time
 * - Patience: Slower to become disgruntled
 *
 * @param player - Player to calculate modifiers for
 * @returns Modifier object with swing and teamFocus values
 */
export function calculatePersonalityModifiers(player: Player): {
  swingModifier: number;      // 0.7-1.3, affects size of morale changes
  recoveryModifier: number;   // 0.8-1.2, affects recovery speed
  teamFocusModifier: number;  // 0.7-1.3, shifts weight from playing time to results
  patienceModifier: number;   // 0.7-1.3, affects disgruntled threshold tolerance
} {
  const { composure, determination, teamwork, patience } = player.attributes;

  // Composure: 100 = 0.7x swings, 1 = 1.3x swings
  const swingModifier = 1.3 - (composure / 100) * 0.6;

  // Determination: 100 = 1.2x recovery, 1 = 0.8x recovery
  const recoveryModifier = 0.8 + (determination / 100) * 0.4;

  // Teamwork: 100 = 1.3x team focus (more affected by results), 1 = 0.7x
  const teamFocusModifier = 0.7 + (teamwork / 100) * 0.6;

  // Patience: 100 = 1.3x patience (slower to become disgruntled), 1 = 0.7x
  const patienceModifier = 0.7 + (patience / 100) * 0.6;

  return { swingModifier, recoveryModifier, teamFocusModifier, patienceModifier };
}

/**
 * Calculate weekly morale change
 *
 * Combines playing time satisfaction and match results satisfaction
 * with personality modifiers to determine morale delta.
 *
 * @param player - Player to calculate for
 * @param playingTimeSatisfaction - 0-100 playing time satisfaction
 * @param matchResultsSatisfaction - 0-100 match results satisfaction
 * @returns Morale change (can be positive or negative)
 */
export function calculateWeeklyMoraleChange(
  player: Player,
  playingTimeSatisfaction: number,
  matchResultsSatisfaction: number
): number {
  const modifiers = calculatePersonalityModifiers(player);

  // Adjust weights based on teamwork (team-focused players care more about results)
  const adjustedPlayingTimeWeight = PLAYING_TIME_WEIGHT / modifiers.teamFocusModifier;
  const adjustedResultsWeight = MATCH_RESULTS_WEIGHT * modifiers.teamFocusModifier;
  const totalWeight = adjustedPlayingTimeWeight + adjustedResultsWeight;

  // Normalize weights
  const normPlayingTimeWeight = adjustedPlayingTimeWeight / totalWeight;
  const normResultsWeight = adjustedResultsWeight / totalWeight;

  // Calculate combined satisfaction
  const combinedSatisfaction =
    (playingTimeSatisfaction * normPlayingTimeWeight) +
    (matchResultsSatisfaction * normResultsWeight);

  // Target morale based on satisfaction (50 satisfaction = 75 morale baseline)
  const targetMorale = 25 + (combinedSatisfaction * 0.75); // Maps 0-100 to 25-100

  // Calculate delta toward target
  const delta = targetMorale - player.morale;

  // Scale by swing modifier (high composure = smaller changes)
  let scaledDelta = delta * 0.2 * modifiers.swingModifier; // 20% movement per week

  // Recovery boost when below baseline and determined
  if (player.morale < DEFAULT_MORALE && delta > 0) {
    scaledDelta *= modifiers.recoveryModifier;
  }

  // Natural drift toward baseline (75) when stable
  const driftToBaseline = (DEFAULT_MORALE - player.morale) * 0.05;
  scaledDelta += driftToBaseline;

  return Math.round(scaledDelta);
}

/**
 * Apply morale change to a player
 *
 * @param player - Player to update
 * @param change - Morale change amount
 * @returns New morale value (clamped to 0-100)
 */
export function applyMoraleChange(player: Player, change: number): number {
  const newMorale = player.morale + change;
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, newMorale));
}

// =============================================================================
// MENTAL ATTRIBUTE MULTIPLIER
// =============================================================================

/**
 * Get mental attribute multiplier based on morale
 *
 * Applied during match simulation to mental attributes:
 * awareness, creativity, composure, consistency, patience, teamwork
 *
 * @param morale - Current morale value (0-100)
 * @returns Multiplier (0.75 - 1.05)
 */
export function getMentalAttributeMultiplier(morale: number): number {
  if (morale >= MORALE_HAPPY) {
    return 1.05;  // +5% boost when happy
  } else if (morale >= MORALE_CONTENT) {
    return 1.0;   // Baseline
  } else if (morale >= MORALE_UNHAPPY) {
    return 0.90;  // -10% penalty when unhappy
  } else {
    return 0.75;  // -25% penalty when disgruntled
  }
}

/**
 * Get morale status label
 *
 * @param morale - Current morale value
 * @returns Status string
 */
export function getMoraleStatus(morale: number): 'happy' | 'content' | 'unhappy' | 'disgruntled' {
  if (morale >= MORALE_HAPPY) return 'happy';
  if (morale >= MORALE_CONTENT) return 'content';
  if (morale >= MORALE_UNHAPPY) return 'unhappy';
  return 'disgruntled';
}

/**
 * Get morale warning level for UI
 *
 * @param morale - Current morale value
 * @returns Warning level for icon display
 */
export function getMoraleWarningLevel(morale: number): 'none' | 'yellow' | 'red' {
  if (morale >= MORALE_CONTENT) return 'none';
  if (morale >= MORALE_UNHAPPY) return 'yellow';
  return 'red';
}

// =============================================================================
// TRANSFER REQUEST LOGIC
// =============================================================================

/**
 * Check if a disgruntled player requests a transfer
 *
 * Only triggers if morale < 40 (disgruntled).
 * Base 15% chance per week, +5% per consecutive week disgruntled.
 * Personality modifiers apply.
 *
 * @param player - Player to check
 * @returns Whether player requests transfer this week
 */
export function checkTransferRequest(player: Player): boolean {
  // Only disgruntled players can request transfers
  if (player.morale >= MORALE_UNHAPPY) {
    return false;
  }

  // Already has active request
  if (player.transferRequestActive) {
    return false;
  }

  const modifiers = calculatePersonalityModifiers(player);

  // Base chance + increase per consecutive week
  let chance = TRANSFER_REQUEST_BASE_CHANCE +
    (player.weeksDisgruntled * TRANSFER_REQUEST_INCREASE_PER_WEEK);

  // Patience modifier reduces chance
  chance /= modifiers.patienceModifier;

  // Bravery increases likelihood of actually making the request public
  const braveryMultiplier = 0.7 + (player.attributes.bravery / 100) * 0.6;
  chance *= braveryMultiplier;

  // Cap at 80% max chance
  chance = Math.min(0.8, chance);

  return Math.random() < chance;
}

/**
 * Update disgruntled weeks counter
 *
 * @param player - Player to update
 * @param currentMorale - Current morale after weekly update
 * @returns New weeksDisgruntled value
 */
export function updateWeeksDisgruntled(player: Player, currentMorale: number): number {
  if (currentMorale < MORALE_UNHAPPY) {
    return player.weeksDisgruntled + 1;
  }
  return 0; // Reset counter when morale recovers
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

export interface MoraleUpdateResult {
  playerId: string;
  oldMorale: number;
  newMorale: number;
  moraleChange: number;
  transferRequestTriggered: boolean;
  weeksDisgruntled: number;
}

export interface PlayingTimeData {
  minutesPlayed: number;
  gamesPlayed: number;
  sport: 'basketball' | 'baseball' | 'soccer';
}

/**
 * Process weekly morale updates for all players
 *
 * @param players - Array of players to process
 * @param matchResultsMap - Map of player ID to their recent match outcome
 * @param playingTimeMap - Map of player ID to their playing time data (last 5 games)
 * @returns Array of morale update results
 */
export function processWeeklyMorale(
  players: Player[],
  _matchResultsMap: Map<string, MatchOutcome>, // Match results stored on player, kept for API compatibility
  playingTimeMap: Map<string, PlayingTimeData>
): MoraleUpdateResult[] {
  const results: MoraleUpdateResult[] = [];

  for (const player of players) {
    // Get playing time data (default to 0 if not available)
    const playingTime = playingTimeMap.get(player.id);
    const avgMinutesPerGame = playingTime && playingTime.gamesPlayed > 0
      ? playingTime.minutesPlayed / playingTime.gamesPlayed
      : 0;
    const sport = playingTime?.sport ?? 'basketball';

    // Get squad role from contract (default to rotation_player)
    const squadRole: SquadRole = player.contract?.squadRole ?? 'rotation_player';

    // Calculate satisfactions
    const playingTimeSatisfaction = calculatePlayingTimeSatisfaction(
      avgMinutesPerGame,
      squadRole,
      sport
    );
    const matchResultsSatisfaction = calculateMatchResultsSatisfaction(
      player.recentMatchResults
    );

    // Calculate morale change
    const moraleChange = calculateWeeklyMoraleChange(
      player,
      playingTimeSatisfaction,
      matchResultsSatisfaction
    );

    // Apply change
    const oldMorale = player.morale;
    const newMorale = applyMoraleChange(player, moraleChange);

    // Update disgruntled counter
    const weeksDisgruntled = updateWeeksDisgruntled(player, newMorale);

    // Check for transfer request (using new morale and updated counter)
    // Temporarily set values for the check
    const tempPlayer = { ...player, morale: newMorale, weeksDisgruntled };
    const transferRequestTriggered = checkTransferRequest(tempPlayer);

    results.push({
      playerId: player.id,
      oldMorale,
      newMorale,
      moraleChange,
      transferRequestTriggered,
      weeksDisgruntled,
    });
  }

  return results;
}

/**
 * Record a match result for a player
 *
 * Adds the result to the player's recentMatchResults array (capped at 20).
 *
 * @param player - Player to update
 * @param outcome - Match outcome
 * @returns Updated recentMatchResults array
 */
export function recordMatchResult(
  player: Player,
  outcome: MatchOutcome
): MatchOutcome[] {
  // Add to front (most recent first), cap at 20
  const updated = [outcome, ...player.recentMatchResults].slice(0, 20);
  return updated;
}

// =============================================================================
// SIMULATION INTEGRATION
// =============================================================================

/** Mental attributes affected by morale */
const MENTAL_ATTRIBUTES = [
  'awareness',
  'creativity',
  'composure',
  'consistency',
  'patience',
  'teamwork',
] as const;

/**
 * Apply morale effects to a player's attributes for simulation
 *
 * Creates a copy of the player with mental attributes modified based on morale.
 * This should be called before passing players to the simulation engine.
 *
 * @param player - Player to apply morale effects to
 * @returns Player with morale-adjusted mental attributes
 */
export function applyMoraleToPlayer(player: Player): Player {
  const multiplier = getMentalAttributeMultiplier(player.morale);

  // If no adjustment needed, return original
  if (multiplier === 1.0) {
    return player;
  }

  // Create new attributes with mental adjustments
  const adjustedAttributes = { ...player.attributes };

  for (const attr of MENTAL_ATTRIBUTES) {
    const original = adjustedAttributes[attr];
    // Apply multiplier, clamp to 1-99 range
    adjustedAttributes[attr] = Math.max(1, Math.min(99, Math.round(original * multiplier)));
  }

  return {
    ...player,
    attributes: adjustedAttributes,
  };
}

/**
 * Apply morale effects to an entire roster for simulation
 *
 * @param roster - Array of players
 * @returns Array of players with morale-adjusted attributes
 */
export function applyMoraleToRoster(roster: Player[]): Player[] {
  return roster.map(applyMoraleToPlayer);
}
