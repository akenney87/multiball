/**
 * Soccer Box Score Generation
 *
 * Generates team and player statistics from match events.
 *
 * @module simulation/soccer/game/boxScore
 */

import {
  SoccerTeamState,
  SoccerMatchInput,
  SoccerEvent,
  SoccerBoxScore,
  SoccerPlayerStats,
} from '../types';
import {
  SHOTS_ON_TARGET_RATE,
  BASE_FOULS_PER_TEAM,
  GOAL_POSITION_WEIGHTS,
  ATTACKING_STYLE_MODIFIERS,
  PRESSING_MODIFIERS,
} from '../constants';
import { ShotProcessingResult } from '../systems/goalkeeperSystem';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create empty player stats
 */
function createEmptyPlayerStats(): SoccerPlayerStats {
  return {
    minutesPlayed: 90, // No substitutions, all play 90
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    redCards: 0,
    plusMinus: 0,
  };
}

/**
 * Distribute remaining shots to players (weighted by position)
 */
function distributeShots(
  team: SoccerTeamState,
  playerStats: Record<string, SoccerPlayerStats>,
  remainingShots: number
): void {
  // Weight by position (attackers take more shots)
  const shotWeights = team.lineup.map(player => {
    const pos = team.positions[player.id] || 'CM';
    const weight = GOAL_POSITION_WEIGHTS[pos] || 1.0;
    return { player, weight };
  });

  const totalWeight = shotWeights.reduce((sum, { weight }) => sum + weight, 0);

  for (const { player, weight } of shotWeights) {
    // Allocate shots proportionally
    const playerShots = Math.round((weight / totalWeight) * remainingShots);

    const stats = playerStats[player.id];
    if (stats) {
      stats.shots += playerShots;
      // Some shots are on target
      stats.shotsOnTarget += Math.round(playerShots * SHOTS_ON_TARGET_RATE);
    }
  }
}

// =============================================================================
// BOX SCORE GENERATION
// =============================================================================

/**
 * Generate complete box score from match data
 *
 * @param input - Match input with team states
 * @param events - All match events
 * @param homeAttack - Home team attack composite
 * @param awayAttack - Away team attack composite
 * @param homeDefense - Home team defense composite
 * @param awayDefense - Away team defense composite
 * @param homeMidfield - Home team midfield composite
 * @param awayMidfield - Away team midfield composite
 * @param homeShotResult - Shot processing result from GK system (optional for backwards compat)
 * @param awayShotResult - Shot processing result from GK system (optional for backwards compat)
 */
export function generateBoxScore(
  input: SoccerMatchInput,
  events: SoccerEvent[],
  homeAttack: number,
  awayAttack: number,
  homeDefense: number,
  awayDefense: number,
  homeMidfield: number,
  awayMidfield: number,
  homeShotResult?: ShotProcessingResult,
  awayShotResult?: ShotProcessingResult
): SoccerBoxScore {
  // Count goals from events
  const homeGoals = events.filter(e => e.type === 'goal' && e.team === 'home').length;
  const awayGoals = events.filter(e => e.type === 'goal' && e.team === 'away').length;

  // Use shot results from GK system if available, otherwise calculate
  let homeShots: number;
  let awayShots: number;
  let homeSoT: number;
  let awaySoT: number;
  let homeSaves: number;
  let awaySaves: number;

  if (homeShotResult && awayShotResult) {
    // Use actual shot data from GK system
    homeSoT = homeShotResult.shotsOnTarget;
    awaySoT = awayShotResult.shotsOnTarget;
    homeSaves = awayShotResult.saves;  // Away GK saves home shots
    awaySaves = homeShotResult.saves;  // Home GK saves away shots

    // Estimate total shots (shots on target + missed shots)
    // Roughly 35% of shots are on target
    homeShots = Math.round(homeSoT / SHOTS_ON_TARGET_RATE);
    awayShots = Math.round(awaySoT / SHOTS_ON_TARGET_RATE);
  } else {
    // Fallback to old calculation method
    const homeChanceModifier = (homeAttack - awayDefense) / 25;
    const awayChanceModifier = (awayAttack - homeDefense) / 25;

    const homeFullChances = Math.max(1, Math.round(3 + homeChanceModifier * 2 + (Math.random() - 0.5) * 2));
    const awayFullChances = Math.max(1, Math.round(3 + awayChanceModifier * 2 + (Math.random() - 0.5) * 2));
    const homeHalfChances = Math.max(2, Math.round(5 + homeChanceModifier * 1.5 + (Math.random() - 0.5) * 3));
    const awayHalfChances = Math.max(2, Math.round(5 + awayChanceModifier * 1.5 + (Math.random() - 0.5) * 3));

    homeShots = Math.max(homeGoals + 2, homeFullChances * 2 + homeHalfChances + Math.round((Math.random() - 0.5) * 4));
    awayShots = Math.max(awayGoals + 2, awayFullChances * 2 + awayHalfChances + Math.round((Math.random() - 0.5) * 4));

    homeSoT = Math.max(homeGoals, Math.round(homeShots * SHOTS_ON_TARGET_RATE + Math.random() * 2));
    awaySoT = Math.max(awayGoals, Math.round(awayShots * SHOTS_ON_TARGET_RATE + Math.random() * 2));

    homeSaves = awaySoT - awayGoals;
    awaySaves = homeSoT - homeGoals;
  }

  // Calculate chances from shot data
  const homeChanceModifier = (homeAttack - awayDefense) / 25;
  const awayChanceModifier = (awayAttack - homeDefense) / 25;
  const homeFullChances = Math.max(1, Math.round(3 + homeChanceModifier * 2 + (Math.random() - 0.5) * 2));
  const awayFullChances = Math.max(1, Math.round(3 + awayChanceModifier * 2 + (Math.random() - 0.5) * 2));
  const homeHalfChances = Math.max(2, Math.round(5 + homeChanceModifier * 1.5 + (Math.random() - 0.5) * 3));
  const awayHalfChances = Math.max(2, Math.round(5 + awayChanceModifier * 1.5 + (Math.random() - 0.5) * 3));

  // Possession based on midfield strength + tactical modifiers
  // Midfield difference directly affects possession (realistic 30-70% range)
  const midfieldDiff = homeMidfield - awayMidfield;
  let basePossession = 50 + midfieldDiff * 0.5; // Each point = 0.5% possession

  // Apply attacking style modifiers (possession style = +8%, counter = -8%)
  const homeStyleMod = ATTACKING_STYLE_MODIFIERS[input.homeTeam.tactics.attackingStyle]?.possession ?? 0;
  const awayStyleMod = ATTACKING_STYLE_MODIFIERS[input.awayTeam.tactics.attackingStyle]?.possession ?? 0;
  basePossession += (homeStyleMod - awayStyleMod);

  // Apply pressing modifiers (high pressing = +5% possession, low = -5%)
  const homeLineMod = PRESSING_MODIFIERS[input.homeTeam.tactics.pressing]?.possession ?? 0;
  const awayLineMod = PRESSING_MODIFIERS[input.awayTeam.tactics.pressing]?.possession ?? 0;
  basePossession += (homeLineMod - awayLineMod);

  const possessionVariance = (Math.random() - 0.5) * 10; // +/- 5% randomness
  const homePossession = Math.round(Math.max(30, Math.min(70, basePossession + possessionVariance)));
  const awayPossession = 100 - homePossession;

  // Corners based on attack dominance and possession
  const homeCornerBase = homePossession > 50 ? 5.5 : 4.5; // More possession = more corners
  const awayCornerBase = awayPossession > 50 ? 5.5 : 4.5;
  const homeCorners = Math.round(homeCornerBase + homeChanceModifier * 1.5 + (Math.random() - 0.5) * 4);
  const awayCorners = Math.round(awayCornerBase + awayChanceModifier * 1.5 + (Math.random() - 0.5) * 4);

  // Fouls
  const homeFouls = Math.round(BASE_FOULS_PER_TEAM + (Math.random() - 0.5) * 6);
  const awayFouls = Math.round(BASE_FOULS_PER_TEAM + (Math.random() - 0.5) * 6);

  // Card counts from events
  const homeYellows = events.filter(e => e.type === 'yellow_card' && e.team === 'home').length;
  const awayYellows = events.filter(e => e.type === 'yellow_card' && e.team === 'away').length;
  const homeReds = events.filter(e => e.type === 'red_card' && e.team === 'home').length;
  const awayReds = events.filter(e => e.type === 'red_card' && e.team === 'away').length;

  // Initialize player stats
  const homePlayerStats: Record<string, SoccerPlayerStats> = {};
  const awayPlayerStats: Record<string, SoccerPlayerStats> = {};

  for (const player of input.homeTeam.lineup) {
    const playerStats = createEmptyPlayerStats();
    homePlayerStats[player.id] = playerStats;
    // Mark goalkeeper with saves from GK system
    if (input.homeTeam.positions[player.id] === 'GK') {
      playerStats.saves = awaySaves;
    }
  }

  for (const player of input.awayTeam.lineup) {
    const playerStats = createEmptyPlayerStats();
    awayPlayerStats[player.id] = playerStats;
    // Mark goalkeeper with saves from GK system
    if (input.awayTeam.positions[player.id] === 'GK') {
      playerStats.saves = homeSaves;
    }
  }

  // Populate from events
  for (const event of events) {
    const statsRecord = event.team === 'home' ? homePlayerStats : awayPlayerStats;

    if (event.player) {
      const playerStats = statsRecord[event.player.id];
      if (playerStats) {
        switch (event.type) {
          case 'goal':
            playerStats.goals++;
            playerStats.shots++;
            playerStats.shotsOnTarget++;
            break;
          case 'yellow_card':
            playerStats.yellowCards++;
            break;
          case 'red_card':
            playerStats.redCards++;
            break;
        }
      }
    }

    // Handle assists
    if (event.type === 'goal' && event.assistPlayer) {
      const assistStats = event.team === 'home' ? homePlayerStats : awayPlayerStats;
      const assisterStats = assistStats[event.assistPlayer.id];
      if (assisterStats) {
        assisterStats.assists++;
      }
    }
  }

  // Distribute remaining shots to players
  const homeRemainingShots = Math.max(0, homeShots - homeGoals);
  const awayRemainingShots = Math.max(0, awayShots - awayGoals);

  distributeShots(input.homeTeam, homePlayerStats, homeRemainingShots);
  distributeShots(input.awayTeam, awayPlayerStats, awayRemainingShots);

  return {
    possession: { home: homePossession, away: awayPossession },
    fullChances: { home: homeFullChances, away: awayFullChances },
    halfChances: { home: homeHalfChances, away: awayHalfChances },
    shots: { home: homeShots, away: awayShots },
    shotsOnTarget: { home: homeSoT, away: awaySoT },
    corners: { home: Math.max(0, homeCorners), away: Math.max(0, awayCorners) },
    fouls: { home: homeFouls, away: awayFouls },
    yellowCards: { home: homeYellows, away: awayYellows },
    redCards: { home: homeReds, away: awayReds },
    homePlayerStats,
    awayPlayerStats,
  };
}
