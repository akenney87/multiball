/**
 * Soccer Substitution System
 *
 * Manages player substitutions during soccer matches:
 * - Respects user's pre-match minutes allocation
 * - AI overrides for injuries, red cards, yellow card risk
 * - Soccer rules: 5 subs max, 3 windows + half-time, no re-entry
 *
 * @module simulation/soccer/systems/substitutionSystem
 */

import { Player } from '../../../data/types';
import { SoccerPosition } from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Player with minutes allocation info
 */
export interface SoccerPlayerWithMinutes extends Player {
  /** Target minutes to play (0-90) */
  minutesTarget: number;
  /** Actual minutes played so far */
  minutesPlayed: number;
  /** Current position on field (null if on bench) */
  currentPosition: SoccerPosition | null;
  /** Whether player has been subbed off (can't re-enter) */
  hasBeenSubbedOff: boolean;
  /** Yellow card count */
  yellowCards: number;
  /** Is currently injured */
  isInjured: boolean;
  /** Current fatigue (0-100, 100 = fresh) */
  fatigue: number;
}

/**
 * Substitution decision from the system
 */
export interface SubstitutionDecision {
  /** Player coming off */
  playerOut: SoccerPlayerWithMinutes;
  /** Player coming on */
  playerIn: SoccerPlayerWithMinutes;
  /** Reason for substitution */
  reason: 'fatigue' | 'injury' | 'yellow_card_risk' | 'tactical';
  /** Position being filled */
  position: SoccerPosition;
}

/**
 * Configuration for the substitution system
 */
export interface SubstitutionConfig {
  /** Maximum substitutions allowed (typically 5) */
  maxSubstitutions: number;
  /** Substitution windows used (max 3, excluding half-time) */
  maxWindows: number;
  /** Fatigue threshold below which AI will consider subbing */
  fatigueThreshold: number;
  /** Whether to auto-sub players on yellow card risk */
  yellowCardRiskManagement: boolean;
}

/**
 * State tracking for substitution system
 */
export interface SubstitutionState {
  /** Players currently on field (11 or fewer if red cards) */
  onField: SoccerPlayerWithMinutes[];
  /** Players on bench */
  onBench: SoccerPlayerWithMinutes[];
  /** Number of substitutions made */
  substitutionsMade: number;
  /** Number of substitution windows used */
  windowsUsed: number;
  /** Whether currently in a valid substitution window */
  inSubWindow: boolean;
  /** Current match minute */
  currentMinute: number;
  /** Is user's team (true) or AI opponent (false) */
  isUserTeam: boolean;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_SUB_CONFIG: SubstitutionConfig = {
  maxSubstitutions: 5,
  maxWindows: 3,
  fatigueThreshold: 65, // Consider subs when below 65% fatigue
  yellowCardRiskManagement: true,
};

// =============================================================================
// MINUTES ALLOCATION
// =============================================================================

/**
 * Apply user's minutes allocation to roster
 *
 * @param roster - Full team roster (should be 18-23 players)
 * @param userMinutesAllocation - Map of playerId -> target minutes
 * @param startingLineup - IDs of the 11 starting players
 * @param positions - Position assignments for starters
 */
export function applyMinutesAllocation(
  roster: Player[],
  userMinutesAllocation: Record<string, number>,
  startingLineup: string[],
  positions: Record<string, SoccerPosition>
): SoccerPlayerWithMinutes[] {
  return roster.map(player => {
    const minutesTarget = userMinutesAllocation[player.id] ?? 0;
    const isStarting = startingLineup.includes(player.id);

    return {
      ...player,
      minutesTarget,
      minutesPlayed: 0,
      currentPosition: isStarting ? (positions[player.id] || null) : null,
      hasBeenSubbedOff: false,
      yellowCards: 0,
      isInjured: false,
      fatigue: 100, // Start fresh
    };
  });
}

/**
 * Auto-calculate minutes allocation based on player ratings
 * Used for AI teams or when user hasn't set allocation
 *
 * @param roster - Team roster
 * @param startingLineup - IDs of starting players
 * @param positions - Position assignments
 */
export function calculateAutoMinutesAllocation(
  roster: Player[],
  startingLineup: string[],
  positions: Record<string, SoccerPosition>
): SoccerPlayerWithMinutes[] {
  // Simple allocation: starters get 70-90 min, bench gets 0-20 based on rating
  return roster.map(player => {
    const isStarting = startingLineup.includes(player.id);
    const rating = calculatePlayerRating(player, positions[player.id] || 'CM');

    let minutesTarget: number;
    if (isStarting) {
      // Starters: 70-90 based on rating and stamina
      const staminaFactor = player.attributes.stamina / 100;
      minutesTarget = 70 + (rating / 100) * 15 * staminaFactor;
    } else {
      // Bench: 0-20 based on rating
      minutesTarget = (rating / 100) * 20;
    }

    return {
      ...player,
      minutesTarget: Math.round(minutesTarget),
      minutesPlayed: 0,
      currentPosition: isStarting ? (positions[player.id] || null) : null,
      hasBeenSubbedOff: false,
      yellowCards: 0,
      isInjured: false,
      fatigue: 100,
    };
  });
}

/**
 * Calculate player's rating for their position
 */
function calculatePlayerRating(player: Player, position: SoccerPosition): number {
  const attrs = player.attributes;

  // Simplified position-based rating
  switch (position) {
    case 'GK':
      return (attrs.reactions * 0.3 + attrs.jumping * 0.2 + attrs.height * 0.2 +
              attrs.awareness * 0.15 + attrs.composure * 0.15);
    case 'CB':
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return (attrs.awareness * 0.25 + attrs.reactions * 0.2 + attrs.core_strength * 0.15 +
              attrs.jumping * 0.15 + attrs.top_speed * 0.15 + attrs.determination * 0.1);
    case 'CDM':
    case 'CM':
      return (attrs.awareness * 0.2 + attrs.stamina * 0.2 + attrs.throw_accuracy * 0.15 +
              attrs.creativity * 0.15 + attrs.composure * 0.15 + attrs.teamwork * 0.15);
    case 'CAM':
    case 'LM':
    case 'RM':
      return (attrs.creativity * 0.25 + attrs.throw_accuracy * 0.2 + attrs.agility * 0.15 +
              attrs.finesse * 0.15 + attrs.awareness * 0.15 + attrs.composure * 0.1);
    case 'LW':
    case 'RW':
      return (attrs.top_speed * 0.25 + attrs.agility * 0.2 + attrs.creativity * 0.15 +
              attrs.finesse * 0.15 + attrs.acceleration * 0.15 + attrs.deception * 0.1);
    case 'ST':
    case 'CF':
      return (attrs.finesse * 0.25 + attrs.composure * 0.2 + attrs.form_technique * 0.15 +
              attrs.awareness * 0.15 + attrs.jumping * 0.15 + attrs.reactions * 0.1);
    default:
      return 50;
  }
}

// =============================================================================
// SUBSTITUTION DECISION LOGIC
// =============================================================================

/**
 * Calculate a player's effective performance score
 * Combines their skill rating at a position with their current fatigue
 *
 * A player at 80 rating with 50% fatigue = 40 effective
 * A player at 60 rating with 90% fatigue = 54 effective
 */
function calculateEffectiveScore(player: SoccerPlayerWithMinutes, position: SoccerPosition): number {
  const rating = calculatePlayerRating(player, position);
  const fatigueFactor = player.fatigue / 100;
  return rating * fatigueFactor;
}

/**
 * Check if a substitution should be made
 *
 * @param state - Current substitution state
 * @param config - Substitution configuration
 * @param isHalfTime - Whether we're at half-time (doesn't count toward windows)
 */
export function checkForSubstitution(
  state: SubstitutionState,
  config: SubstitutionConfig,
  isHalfTime: boolean = false
): SubstitutionDecision | null {
  // Can't sub if we've used all substitutions
  if (state.substitutionsMade >= config.maxSubstitutions) {
    return null;
  }

  // Can't sub if we've used all windows (unless half-time)
  if (!isHalfTime && state.windowsUsed >= config.maxWindows) {
    return null;
  }

  // No bench players available
  const availableSubs = state.onBench.filter(p => !p.hasBeenSubbedOff && !p.isInjured);
  if (availableSubs.length === 0) {
    return null;
  }

  // Priority 1: Injured players MUST be subbed
  const injuredPlayer = state.onField.find(p => p.isInjured);
  if (injuredPlayer) {
    const replacement = findBestReplacement(injuredPlayer, availableSubs, true);
    if (replacement) {
      return {
        playerOut: injuredPlayer,
        playerIn: replacement,
        reason: 'injury',
        position: injuredPlayer.currentPosition!,
      };
    }
  }

  // Priority 2: Yellow card risk (player on yellow playing aggressively)
  if (config.yellowCardRiskManagement) {
    const yellowCardRisk = state.onField.find(p =>
      p.yellowCards === 1 &&
      p.attributes.bravery > 70 &&
      p.attributes.determination > 70 &&
      state.currentMinute > 60 // Only worry in later stages
    );
    if (yellowCardRisk) {
      const replacement = findBestReplacement(yellowCardRisk, availableSubs, true);
      if (replacement) {
        return {
          playerOut: yellowCardRisk,
          playerIn: replacement,
          reason: 'yellow_card_risk',
          position: yellowCardRisk.currentPosition!,
        };
      }
    }
  }

  // Priority 3: Fatigue-based substitution (both user and AI teams)
  // Only consider after halftime (minute 45+)
  if (state.currentMinute >= 45 || isHalfTime) {
    return checkFatigueBasedSubstitution(state, availableSubs, config);
  }

  return null;
}

/**
 * Check for substitution based on fatigue
 * Only subs if a replacement would be an actual improvement in effective performance
 */
function checkFatigueBasedSubstitution(
  state: SubstitutionState,
  availableSubs: SoccerPlayerWithMinutes[],
  config: SubstitutionConfig
): SubstitutionDecision | null {
  // Find fatigued players (below threshold)
  const fatigued = state.onField
    .filter(p => p.fatigue < config.fatigueThreshold)
    .sort((a, b) => a.fatigue - b.fatigue);

  console.log(`[SubSystem] Minute ${state.currentMinute}: ${fatigued.length} players below ${config.fatigueThreshold}% fatigue, ${availableSubs.length} subs available`);

  if (fatigued.length === 0) return null;

  // For each fatigued player, check if we have a replacement that's actually better
  for (const playerOut of fatigued) {
    const position = playerOut.currentPosition!;
    const currentEffective = calculateEffectiveScore(playerOut, position);

    // Find best available replacement for this position
    const replacement = findBestReplacement(playerOut, availableSubs, false);
    if (!replacement) continue;

    const replacementEffective = calculateEffectiveScore(replacement, position);

    // Only sub if replacement is meaningfully better (at least 2% improvement)
    // This prevents lateral moves like swapping 40 effective for 41 effective
    const improvementThreshold = currentEffective * 1.02;

    if (replacementEffective > improvementThreshold) {
      console.log(`[SubSystem] SUB APPROVED: ${playerOut.name} (${Math.round(currentEffective)} eff) -> ${replacement.name} (${Math.round(replacementEffective)} eff)`);
      return {
        playerOut,
        playerIn: replacement,
        reason: 'fatigue',
        position,
      };
    } else {
      console.log(`[SubSystem] Sub rejected: ${playerOut.name} (${Math.round(currentEffective)} eff) vs ${replacement.name} (${Math.round(replacementEffective)} eff) - needs ${Math.round(improvementThreshold)}`);
    }
  }

  return null;
}

/**
 * Find best replacement for a player from available subs
 *
 * @param playerOut - Player being replaced
 * @param availableSubs - Available bench players
 * @param isEmergency - If true (injury/yellow card), find any replacement. If false, use effective score.
 */
function findBestReplacement(
  playerOut: SoccerPlayerWithMinutes,
  availableSubs: SoccerPlayerWithMinutes[],
  isEmergency: boolean = false
): SoccerPlayerWithMinutes | null {
  if (availableSubs.length === 0) return null;

  const position = playerOut.currentPosition!;

  // Score each sub based on effective performance at the position
  const scored = availableSubs.map(sub => {
    const subBestPosition = getPlayerBestPosition(sub);
    const positionCompatible = isPositionCompatible(position, subBestPosition);

    // Use effective score (rating * fatigue) for proper comparison
    const effectiveScore = calculateEffectiveScore(sub, position);

    // Position compatibility bonus - prefer players who fit the role
    const positionBonus = positionCompatible ? 20 : 0;

    return {
      player: sub,
      score: effectiveScore + positionBonus,
      effectiveScore,
      positionCompatible,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // For emergency subs, take the best available regardless
  // For normal subs, prefer position-compatible players
  if (isEmergency) {
    return scored[0]?.player || null;
  }

  // For non-emergency, prefer position-compatible if available
  const compatibleSub = scored.find(s => s.positionCompatible);
  return compatibleSub?.player || scored[0]?.player || null;
}

/**
 * Get player's best position based on their attributes
 * TODO: This should use actual player position data when available
 */
function getPlayerBestPosition(_player: Player): SoccerPosition {
  // Simplified - in reality this would be stored on the player
  // For now, assume midfield/utility
  return 'CM';
}

/**
 * Check if two positions are compatible
 */
function isPositionCompatible(pos1: SoccerPosition, pos2: SoccerPosition): boolean {
  const positionGroups: Record<string, SoccerPosition[]> = {
    goalkeeper: ['GK'],
    centerBack: ['CB'],
    fullBack: ['LB', 'RB', 'LWB', 'RWB'],
    defensiveMid: ['CDM', 'CM'],
    centralMid: ['CM', 'CAM', 'CDM'],
    wideMid: ['LM', 'RM', 'LW', 'RW'],
    winger: ['LW', 'RW', 'LM', 'RM'],
    forward: ['ST', 'CF', 'CAM'],
  };

  for (const group of Object.values(positionGroups)) {
    if (group.includes(pos1) && group.includes(pos2)) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Execute a substitution and update state
 */
export function executeSubstitution(
  state: SubstitutionState,
  decision: SubstitutionDecision,
  isHalfTime: boolean = false
): SubstitutionState {
  const { playerOut, playerIn, position } = decision;

  // Update player states
  playerOut.hasBeenSubbedOff = true;
  playerOut.currentPosition = null;
  playerIn.currentPosition = position;

  // Update state
  const newOnField = state.onField.filter(p => p.id !== playerOut.id);
  newOnField.push(playerIn);

  const newOnBench = state.onBench.filter(p => p.id !== playerIn.id);
  newOnBench.push(playerOut);

  return {
    ...state,
    onField: newOnField,
    onBench: newOnBench,
    substitutionsMade: state.substitutionsMade + 1,
    windowsUsed: isHalfTime ? state.windowsUsed : state.windowsUsed + 1,
  };
}

/**
 * Update fatigue for all players based on minutes played
 *
 * @param state - Current substitution state
 * @param minutesPassed - Minutes since last update
 * @param hasPossession - Whether this team has possession (reduces fatigue loss)
 */
export function updateFatigue(
  state: SubstitutionState,
  minutesPassed: number,
  hasPossession: boolean = true
): void {
  for (const player of state.onField) {
    player.minutesPlayed += minutesPassed;

    // Fatigue decreases based on stamina attribute
    // Players with high stamina lose fatigue slower
    const staminaFactor = player.attributes.stamina / 100;
    const baseFatigueLoss = (minutesPassed / 90) * (100 - 30 * staminaFactor);

    // Out of possession = more fatigue (chasing, pressing, defensive work)
    // In possession = less fatigue (controlling tempo, walking with ball)
    const possessionMultiplier = hasPossession ? 0.8 : 1.3;

    const fatigueLoss = baseFatigueLoss * possessionMultiplier;
    player.fatigue = Math.max(0, player.fatigue - fatigueLoss);
  }

  // Bench players recover slightly
  for (const player of state.onBench) {
    if (!player.hasBeenSubbedOff) {
      player.fatigue = Math.min(100, player.fatigue + minutesPassed * 0.5);
    }
  }
}

/**
 * Handle red card - player is removed, no replacement allowed
 */
export function handleRedCard(
  state: SubstitutionState,
  playerId: string
): SubstitutionState {
  const player = state.onField.find(p => p.id === playerId);
  if (!player) return state;

  player.hasBeenSubbedOff = true; // Counts as removed
  player.currentPosition = null;

  return {
    ...state,
    onField: state.onField.filter(p => p.id !== playerId),
    // Note: No substitution is made - team plays with fewer players
  };
}

/**
 * Handle injury - player must be subbed if possible
 */
export function handleInjury(
  state: SubstitutionState,
  playerId: string
): SubstitutionState {
  const player = state.onField.find(p => p.id === playerId);
  if (!player) return state;

  player.isInjured = true;

  // Injury forces a substitution if one is available
  // This is handled by checkForSubstitution with injury priority

  return state;
}

/**
 * Record a yellow card for a player
 */
export function recordYellowCard(
  state: SubstitutionState,
  playerId: string
): { state: SubstitutionState; isSecondYellow: boolean } {
  const player = state.onField.find(p => p.id === playerId);
  if (!player) return { state, isSecondYellow: false };

  player.yellowCards++;

  if (player.yellowCards >= 2) {
    // Second yellow = red card
    return {
      state: handleRedCard(state, playerId),
      isSecondYellow: true,
    };
  }

  return { state, isSecondYellow: false };
}
