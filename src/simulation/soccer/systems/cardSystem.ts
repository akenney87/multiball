/**
 * Soccer Card System
 *
 * Generates realistic fouls and cards based on:
 * - Tactical settings (attacking style, defensive line)
 * - Player attributes (bravery, composure, determination, patience)
 * - Game state (minute, score differential)
 * - Position (defenders foul more than forwards)
 *
 * @module simulation/soccer/systems/cardSystem
 */

import { Player } from '../../../data/types';
import { SoccerTeamState, SoccerEvent } from '../types';
import {
  BASE_FOULS_PER_TEAM,
  YELLOW_CARD_PER_FOUL_RATE,
  STRAIGHT_RED_CARD_RATE,
  CARD_TIMING_WEIGHTS,
  POSITION_FOUL_WEIGHTS,
  AGGRESSION_ATTRIBUTES,
  ATTACKING_STYLE_MODIFIERS,
} from '../constants';

// =============================================================================
// TYPES
// =============================================================================

interface CardSystemState {
  yellowCards: Map<string, number>;  // playerId -> yellow card count
  redCards: Set<string>;             // playerIds sent off
  fouls: Map<string, number>;        // playerId -> foul count
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate aggression score for a player (higher = more likely to foul)
 * Based on bravery, determination (aggressive) vs composure, patience (disciplined)
 */
function calculatePlayerAggression(player: Player): number {
  const attrs = player.attributes;
  const { positive, negative } = AGGRESSION_ATTRIBUTES;

  const aggressiveScore =
    attrs.bravery * positive.bravery +
    attrs.determination * positive.determination;

  const disciplineScore =
    attrs.composure * negative.composure +
    attrs.patience * negative.patience;

  // Net aggression: high bravery/determination, low composure/patience = high score
  // Range roughly -0.5 to +1.5
  return (aggressiveScore - disciplineScore * 0.8) / 50;
}

/**
 * Select minute for a foul based on weighted timing distribution
 * More fouls/cards occur late in the game (fatigue, desperation)
 */
function selectFoulMinute(): number {
  const weights = Object.entries(CARD_TIMING_WEIGHTS);
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;

  for (const [range, weight] of weights) {
    roll -= weight;
    if (roll <= 0) {
      const parts = range.split('-').map(Number);
      const start = parts[0] ?? 0;
      const end = parts[1] ?? 90;
      return start + Math.floor(Math.random() * (end - start + 1));
    }
  }

  // Fallback to random minute
  return Math.floor(Math.random() * 90) + 1;
}

/**
 * Select which player commits a foul based on position and attributes
 */
function selectFoulingPlayer(
  team: SoccerTeamState,
  excludeIds: Set<string>  // Exclude players already sent off
): Player | null {
  const candidates = team.lineup.filter(p => !excludeIds.has(p.id));
  if (candidates.length === 0) return null;

  const weights = candidates.map(player => {
    const pos = team.positions[player.id] || 'CM';
    const positionWeight = POSITION_FOUL_WEIGHTS[pos] || 1.0;
    const aggressionWeight = 1 + calculatePlayerAggression(player) * 0.3;

    return {
      player,
      weight: Math.max(0.1, positionWeight * aggressionWeight),
    };
  });

  const totalWeight = weights.reduce((sum, { weight }) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { player, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return player;
  }

  return candidates[0] || null;
}

/**
 * Calculate team foul count based on tactics
 * Note: Fouls are no longer affected by tactical modifiers per design decision
 */
function calculateTeamFouls(_team: SoccerTeamState): number {
  let fouls = BASE_FOULS_PER_TEAM;

  // Add variance
  fouls += (Math.random() - 0.5) * 4;

  return Math.round(Math.max(6, Math.min(18, fouls)));
}

// =============================================================================
// MAIN CARD GENERATION
// =============================================================================

/**
 * Generate all card events for a match
 *
 * @param homeTeam - Home team state
 * @param awayTeam - Away team state
 * @param homeGoals - Final home goals (for desperation calculation)
 * @param awayGoals - Final away goals (for desperation calculation)
 * @returns Array of yellow/red card events
 */
export function generateCardEvents(
  homeTeam: SoccerTeamState,
  awayTeam: SoccerTeamState,
  homeGoals: number,
  awayGoals: number
): SoccerEvent[] {
  const events: SoccerEvent[] = [];

  const cardState: Record<'home' | 'away', CardSystemState> = {
    home: { yellowCards: new Map(), redCards: new Set(), fouls: new Map() },
    away: { yellowCards: new Map(), redCards: new Set(), fouls: new Map() },
  };

  const homeFoulCount = calculateTeamFouls(homeTeam);
  const awayFoulCount = calculateTeamFouls(awayTeam);

  // Determine trailing status (for desperation fouls late game)
  const homeTrailing = homeGoals < awayGoals;
  const awayTrailing = awayGoals < homeGoals;

  /**
   * Generate fouls and cards for a team
   */
  const generateTeamCards = (
    team: SoccerTeamState,
    teamKey: 'home' | 'away',
    foulCount: number,
    isTrailing: boolean
  ) => {
    const state = cardState[teamKey];

    for (let i = 0; i < foulCount; i++) {
      const minute = selectFoulMinute();
      const player = selectFoulingPlayer(team, state.redCards);
      if (!player) continue;

      // Track foul for this player
      const currentFouls = state.fouls.get(player.id) || 0;
      state.fouls.set(player.id, currentFouls + 1);

      // Check existing yellow cards for this player
      const existingYellows = state.yellowCards.get(player.id) || 0;

      // Higher card chance late game when trailing (desperation fouls)
      let cardMultiplier = 1.0;
      if (minute >= 75 && isTrailing) {
        cardMultiplier = 1.3;
      }

      // Check for straight red (very rare - violent conduct, DOGSO)
      if (Math.random() < STRAIGHT_RED_CARD_RATE * cardMultiplier) {
        state.redCards.add(player.id);
        events.push({
          minute,
          type: 'red_card',
          team: teamKey,
          player,
          description: `RED CARD! ${player.name} sent off for serious foul play!`,
        });
        continue;
      }

      // Check for yellow card
      let yellowChance = YELLOW_CARD_PER_FOUL_RATE * cardMultiplier;

      // Higher chance if player already on yellow (more scrutiny from referee)
      if (existingYellows > 0) {
        yellowChance *= 1.5;
      }

      // Higher chance for repeated fouls by same player
      if (currentFouls >= 2) {
        yellowChance *= 1.2;
      }

      if (Math.random() < yellowChance) {
        const newYellowCount = existingYellows + 1;
        state.yellowCards.set(player.id, newYellowCount);

        if (newYellowCount >= 2) {
          // Second yellow = red card
          state.redCards.add(player.id);
          events.push({
            minute,
            type: 'yellow_card',
            team: teamKey,
            player,
            description: `Yellow card for ${player.name}`,
          });
          events.push({
            minute,
            type: 'red_card',
            team: teamKey,
            player,
            description: `SECOND YELLOW! ${player.name} is sent off!`,
          });
        } else {
          events.push({
            minute,
            type: 'yellow_card',
            team: teamKey,
            player,
            description: `Yellow card for ${player.name}`,
          });
        }
      }
    }
  };

  generateTeamCards(homeTeam, 'home', homeFoulCount, homeTrailing);
  generateTeamCards(awayTeam, 'away', awayFoulCount, awayTrailing);

  return events;
}

/**
 * Get card counts from events
 */
export function getCardCounts(
  events: SoccerEvent[],
  team: 'home' | 'away'
): { yellows: number; reds: number } {
  const yellows = events.filter(e => e.type === 'yellow_card' && e.team === team).length;
  const reds = events.filter(e => e.type === 'red_card' && e.team === team).length;
  return { yellows, reds };
}
