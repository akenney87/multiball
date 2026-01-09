/**
 * Soccer Match Simulation
 *
 * Main simulation engine for soccer matches.
 * V2: Event-driven minute-by-minute simulation with player attributes
 * directly influencing all events and outcomes.
 *
 * @module simulation/soccer/game/matchSimulation
 */

import { Player } from '../../../data/types';
import {
  SoccerTeamState,
  SoccerMatchInput,
  SoccerMatchResult,
  SoccerEvent,
  SoccerPosition,
  PenaltyShootoutResult,
} from '../types';
import {
  FORMATION_MODIFIERS,
  GOAL_POSITION_WEIGHTS,
  ASSIST_POSITION_WEIGHTS,
  BASE_EXPECTED_GOALS,
  ASSIST_PROBABILITY,
  ATTACKING_STYLE_MODIFIERS,
  PRESSING_MODIFIERS,
  HOME_ADVANTAGE_XG_MODIFIER,
  HOT_STREAK_CHANCE,
  HOT_STREAK_MULTIPLIER,
  COLD_STREAK_CHANCE,
  COLD_STREAK_MULTIPLIER,
  CONSISTENCY_VARIANCE_SCALE,
  INDIVIDUAL_SKILL_WEIGHT,
  POSITION_WEIGHT,
} from '../constants';
import { generateBoxScore } from './boxScore';
import { calculateSoccerPositionOverall } from '../utils/positionRatings';
import { generateCardEvents } from '../systems/cardSystem';
import { processShots, ShotDetail } from '../systems/goalkeeperSystem';
import { generateGoalNarrative, generatePlayByPlay as generateEnrichedPlayByPlay } from '../playByPlay/soccerPlayByPlay';

// Re-export the new V2 engine
export { simulateSoccerMatchV2 } from '../engine/matchEngine';

// simulatePenaltyShootout is exported at the end of this file for use by live simulation

// =============================================================================
// COMPOSITE CALCULATIONS (using detailed positional weights)
// =============================================================================

/**
 * Get a player's position-specific overall rating
 * Uses the detailed weights from calculateSoccerPositionOverall
 */
function getPlayerPositionRating(player: Player, position: SoccerPosition): number {
  return calculateSoccerPositionOverall(player, position);
}

/**
 * Get players by position type
 */
function getPlayersByRole(
  team: SoccerTeamState,
  role: 'attack' | 'midfield' | 'defense' | 'goalkeeper'
): Array<{ player: Player; position: SoccerPosition }> {
  const attackPositions: SoccerPosition[] = ['ST', 'LW', 'RW', 'CAM'];
  const midfieldPositions: SoccerPosition[] = ['CM', 'CDM', 'LM', 'RM'];
  const defensePositions: SoccerPosition[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
  const gkPositions: SoccerPosition[] = ['GK'];

  let targetPositions: SoccerPosition[];
  switch (role) {
    case 'attack':
      targetPositions = attackPositions;
      break;
    case 'midfield':
      targetPositions = midfieldPositions;
      break;
    case 'defense':
      targetPositions = defensePositions;
      break;
    case 'goalkeeper':
      targetPositions = gkPositions;
      break;
  }

  const result: Array<{ player: Player; position: SoccerPosition }> = [];
  for (const player of team.lineup) {
    const pos = team.positions[player.id];
    if (pos !== undefined && targetPositions.includes(pos)) {
      result.push({ player, position: pos });
    }
  }
  return result;
}

/**
 * Calculate team's attacking strength using position-specific ratings
 */
function calculateTeamAttack(team: SoccerTeamState): number {
  const attackers = getPlayersByRole(team, 'attack');
  const midfielders = getPlayersByRole(team, 'midfield');

  if (attackers.length === 0 && midfielders.length === 0) {
    // Fallback: use all outfield players with their actual positions
    let total = 0;
    let count = 0;
    for (const player of team.lineup) {
      const pos = team.positions[player.id];
      if (pos && pos !== 'GK') {
        total += getPlayerPositionRating(player, pos);
        count++;
      }
    }
    return count > 0 ? total / count : 50;
  }

  // Calculate average rating for attackers at their actual positions
  const attackRating = attackers.length > 0
    ? attackers.reduce((sum, { player, position }) =>
        sum + getPlayerPositionRating(player, position), 0) / attackers.length
    : 50;

  // Midfielders contribute to attack as well
  const midfieldRating = midfielders.length > 0
    ? midfielders.reduce((sum, { player, position }) =>
        sum + getPlayerPositionRating(player, position), 0) / midfielders.length
    : 50;

  return attackRating * 0.7 + midfieldRating * 0.3;
}

/**
 * Calculate team's defensive strength using position-specific ratings
 */
function calculateTeamDefense(team: SoccerTeamState): number {
  const defenders = getPlayersByRole(team, 'defense');
  const midfielders = getPlayersByRole(team, 'midfield');

  if (defenders.length === 0 && midfielders.length === 0) {
    // Fallback: use all outfield players with their actual positions
    let total = 0;
    let count = 0;
    for (const player of team.lineup) {
      const pos = team.positions[player.id];
      if (pos && pos !== 'GK') {
        total += getPlayerPositionRating(player, pos);
        count++;
      }
    }
    return count > 0 ? total / count : 50;
  }

  // Calculate average rating for defenders at their actual positions
  const defenseRating = defenders.length > 0
    ? defenders.reduce((sum, { player, position }) =>
        sum + getPlayerPositionRating(player, position), 0) / defenders.length
    : 50;

  // Midfielders contribute to defense as well
  const midfieldRating = midfielders.length > 0
    ? midfielders.reduce((sum, { player, position }) =>
        sum + getPlayerPositionRating(player, position), 0) / midfielders.length
    : 50;

  return defenseRating * 0.7 + midfieldRating * 0.3;
}

/**
 * Calculate team's midfield strength using position-specific ratings
 */
function calculateTeamMidfield(team: SoccerTeamState): number {
  const midfielders = getPlayersByRole(team, 'midfield');

  if (midfielders.length === 0) {
    // Fallback: use all outfield players with their actual positions
    let total = 0;
    let count = 0;
    for (const player of team.lineup) {
      const pos = team.positions[player.id];
      if (pos && pos !== 'GK') {
        total += getPlayerPositionRating(player, pos);
        count++;
      }
    }
    return count > 0 ? total / count : 50;
  }

  return midfielders.reduce(
    (sum, { player, position }) => sum + getPlayerPositionRating(player, position),
    0
  ) / midfielders.length;
}

/**
 * Calculate goalkeeper rating using position-specific rating
 */
function calculateGoalkeeperRating(team: SoccerTeamState): number {
  const goalkeepers = getPlayersByRole(team, 'goalkeeper');
  if (goalkeepers.length === 0 || !goalkeepers[0]) {
    // Fallback: use first player as GK
    const firstPlayer = team.lineup[0];
    if (!firstPlayer) return 50;
    return getPlayerPositionRating(firstPlayer, 'GK');
  }
  return getPlayerPositionRating(goalkeepers[0].player, 'GK');
}

// =============================================================================
// EXPECTED GOALS CALCULATION
// =============================================================================

/**
 * Calculate expected goals based on attack vs defense + goalkeeper + tactics
 *
 * @param attack - Team's attacking strength (0-100)
 * @param defense - Opponent's defensive strength (0-100)
 * @param goalkeeper - Opponent's goalkeeper rating (0-100)
 * @param attackingStyle - Team's tactical attacking style
 * @param opponentPressing - Opponent's pressing intensity
 * @param isHome - Whether this team is playing at home
 */
function calculateExpectedGoals(
  attack: number,
  defense: number,
  goalkeeper: number,
  attackingStyle: 'possession' | 'direct' | 'counter',
  opponentPressing: 'high' | 'balanced' | 'low',
  isHome: boolean
): number {
  // Normalize to 0-100 scale
  const attackNorm = attack / 100;
  const defenseNorm = defense / 100;
  const gkNorm = goalkeeper / 100;

  // Combined opposition strength
  const opposition = (defenseNorm * 0.7 + gkNorm * 0.3);

  // Calculate xG modifier: attack advantage increases xG, defense advantage decreases
  const advantage = attackNorm - opposition;
  let xgModifier = 1 + (advantage * 1.5); // Range roughly 0.25 to 1.75

  // Apply attacking style modifier (possession = fewer but quality, direct = more shots)
  const styleModifier = ATTACKING_STYLE_MODIFIERS[attackingStyle]?.xG ?? 1.0;
  xgModifier *= styleModifier;

  // Apply opponent's pressing modifier (high pressing = more turnovers but exposed to counters)
  const lineModifier = PRESSING_MODIFIERS[opponentPressing]?.xGConceded ?? 1.0;
  xgModifier *= lineModifier;

  // Apply home advantage
  if (isHome) {
    xgModifier *= HOME_ADVANTAGE_XG_MODIFIER;
  }

  return BASE_EXPECTED_GOALS * Math.max(0.3, xgModifier);
}

// NOTE: generateGoals function replaced by processShots() from goalkeeperSystem.ts
// The new system uses xG to generate shot opportunities, then GK saves to determine goals

// =============================================================================
// PLAYER ATTRIBUTION
// =============================================================================

/**
 * Weighted random selection from array
 * Requires at least one item in the array
 */
function weightedRandomSelect<T>(items: Array<{ item: T; weight: number }>): T {
  if (items.length === 0) {
    throw new Error('weightedRandomSelect: items array cannot be empty');
  }

  const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const { item, weight } of items) {
    random -= weight;
    if (random <= 0) {
      return item;
    }
  }

  // Fallback to first item (guaranteed to exist after length check)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return items[0]!.item;
}

/**
 * Calculate player form modifier based on consistency attribute
 * Returns multiplier: 0.7-1.35 range
 *
 * - 8% chance of hot streak (1.35x)
 * - 5% chance of cold streak (0.7x)
 * - Otherwise, variance based on consistency (high = tight range, low = wide range)
 */
function calculateFormModifier(player: Player): number {
  const consistency = player.attributes.consistency;

  // Check for hot/cold streak
  const streakRoll = Math.random();
  if (streakRoll < HOT_STREAK_CHANCE) {
    return HOT_STREAK_MULTIPLIER;
  }
  if (streakRoll > 1 - COLD_STREAK_CHANCE) {
    return COLD_STREAK_MULTIPLIER;
  }

  // Normal variance based on consistency
  // High consistency (90) = tight range (±5%)
  // Low consistency (30) = wide range (±14%)
  const varianceScale = (100 - consistency) * CONSISTENCY_VARIANCE_SCALE;
  const variance = (Math.random() - 0.5) * 2 * varianceScale;

  return Math.max(0.8, Math.min(1.2, 1.0 + variance));
}

/**
 * Attribute a goal to a player based on position, skill, and form
 *
 * Uses enhanced weighting: 60% individual skill, 40% position weight
 * Form modifier adds realistic variance based on consistency
 */
function attributeGoalToPlayer(team: SoccerTeamState): Player {
  const weights = team.lineup.map(player => {
    const pos = team.positions[player.id] || 'CM';

    // Use position-specific overall rating (0-100)
    const playerRating = getPlayerPositionRating(player, pos);

    // Position weight for goal scoring
    const positionWeight = GOAL_POSITION_WEIGHTS[pos] || 1.0;

    // Form modifier (hot/cold streak + consistency)
    const formModifier = calculateFormModifier(player);

    // Combine: individual skill matters more than position alone
    // Skill component: 0-100 scaled by INDIVIDUAL_SKILL_WEIGHT (0.6)
    // Position component: normalized to ~50 scale, scaled by POSITION_WEIGHT (0.4)
    const skillComponent = playerRating * INDIVIDUAL_SKILL_WEIGHT;
    const positionComponent = positionWeight * 50 * POSITION_WEIGHT;

    const finalWeight = (skillComponent + positionComponent) * formModifier;

    return {
      item: player,
      weight: Math.max(0.1, finalWeight),  // Minimum weight to allow any player to score
    };
  });

  return weightedRandomSelect(weights);
}

/**
 * Attribute an assist to a player (or return null for solo goal)
 *
 * Enhanced with creativity bonus and form modifier
 */
function attributeAssistToPlayer(team: SoccerTeamState, scorer: Player): Player | null {
  // Check if there's an assist
  if (Math.random() > ASSIST_PROBABILITY) {
    return null;
  }

  // Exclude the scorer
  const candidates = team.lineup.filter(p => p.id !== scorer.id);

  const weights = candidates.map(player => {
    const pos = team.positions[player.id] || 'CM';

    // Use position-specific overall rating
    const playerRating = getPlayerPositionRating(player, pos);

    // Position weight for assists
    const positionWeight = ASSIST_POSITION_WEIGHTS[pos] || 1.0;

    // Form modifier
    const formModifier = calculateFormModifier(player);

    // Creativity bonus for assists (0.7-1.3x multiplier)
    const creativityBonus = (player.attributes.creativity / 100) * 0.6 + 0.7;

    // Combine skill and position with creativity bonus
    const skillComponent = playerRating * INDIVIDUAL_SKILL_WEIGHT * creativityBonus;
    const positionComponent = positionWeight * 50 * POSITION_WEIGHT;

    const finalWeight = (skillComponent + positionComponent) * formModifier;

    return {
      item: player,
      weight: Math.max(0.1, finalWeight),
    };
  });

  return weightedRandomSelect(weights);
}

// =============================================================================
// EVENT GENERATION
// =============================================================================

// NOTE: generateGoalMinutes replaced by shot timing from goalkeeperSystem.ts
// Goal minutes now come from ShotDetail[] which are generated during shot processing

/**
 * Generate match events (goals only - cards handled separately)
 *
 * @param input - Match input with team states
 * @param homeGoals - Number of home goals
 * @param awayGoals - Number of away goals
 * @param homeShotDetails - Shot details from GK system (for timing)
 * @param awayShotDetails - Shot details from GK system (for timing)
 */
function generateMatchEvents(
  input: SoccerMatchInput,
  homeGoals: number,
  awayGoals: number,
  homeShotDetails: ShotDetail[],
  awayShotDetails: ShotDetail[]
): SoccerEvent[] {
  const events: SoccerEvent[] = [];

  // Get goal minutes from shot details (shots that weren't saved)
  const homeGoalDetails = homeShotDetails.filter(s => !s.saved).slice(0, homeGoals);
  const awayGoalDetails = awayShotDetails.filter(s => !s.saved).slice(0, awayGoals);

  // If not enough shot details, generate random minutes
  const homeDefaultShooter = input.homeTeam.lineup[0];
  const awayDefaultShooter = input.awayTeam.lineup[0];

  while (homeGoalDetails.length < homeGoals && homeDefaultShooter) {
    const half = Math.random() > 0.45 ? 2 : 1;
    const baseMinute = half === 1 ? 0 : 45;
    const minute = baseMinute + Math.floor(Math.random() * 45) + 1;
    homeGoalDetails.push({
      minute,
      quality: 'halfChance',
      saved: false,
      shooter: homeDefaultShooter,
    });
  }
  while (awayGoalDetails.length < awayGoals && awayDefaultShooter) {
    const half = Math.random() > 0.45 ? 2 : 1;
    const baseMinute = half === 1 ? 0 : 45;
    const minute = baseMinute + Math.floor(Math.random() * 45) + 1;
    awayGoalDetails.push({
      minute,
      quality: 'halfChance',
      saved: false,
      shooter: awayDefaultShooter,
    });
  }

  // Generate home goal events
  for (const shotDetail of homeGoalDetails) {
    const scorer = attributeGoalToPlayer(input.homeTeam);
    const assister = attributeAssistToPlayer(input.homeTeam, scorer);

    // Generate enriched narrative based on shot quality
    const narrative = generateGoalNarrative(scorer, assister, shotDetail.quality);

    events.push({
      minute: shotDetail.minute,
      type: 'goal',
      team: 'home',
      player: scorer,
      assistPlayer: assister ?? undefined,
      description: narrative,
    });
  }

  // Generate away goal events
  for (const shotDetail of awayGoalDetails) {
    const scorer = attributeGoalToPlayer(input.awayTeam);
    const assister = attributeAssistToPlayer(input.awayTeam, scorer);

    // Generate enriched narrative based on shot quality
    const narrative = generateGoalNarrative(scorer, assister, shotDetail.quality);

    events.push({
      minute: shotDetail.minute,
      type: 'goal',
      team: 'away',
      player: scorer,
      assistPlayer: assister ?? undefined,
      description: narrative,
    });
  }

  // Sort events by minute (cards will be merged in later)
  events.sort((a, b) => a.minute - b.minute);

  return events;
}

/**
 * Calculate half time score from events
 */
function calculateHalfTimeScore(
  events: SoccerEvent[]
): { home: number; away: number } {
  let homeHT = 0;
  let awayHT = 0;

  for (const event of events) {
    if (event.type === 'half_time') break;
    if (event.type === 'goal') {
      if (event.team === 'home') homeHT++;
      else awayHT++;
    }
  }

  return { home: homeHT, away: awayHT };
}

// NOTE: generatePlayByPlay replaced by generateEnrichedPlayByPlay from soccerPlayByPlay.ts
// The new system provides richer narrative text with templates and variety

// =============================================================================
// PENALTY SHOOTOUT SIMULATION
// =============================================================================

/**
 * Calculate penalty conversion probability for a player
 * Base probability ~75%, modified by composure, throw accuracy (shooting), and form technique
 */
function calculatePenaltyConversion(player: Player, gkRating: number): number {
  const composure = player.attributes.composure ?? 50;
  const throwAccuracy = player.attributes.throw_accuracy ?? 50; // Shooting/passing precision
  const formTechnique = player.attributes.form_technique ?? 50; // Shooting mechanics

  // Base conversion rate 75%
  let probability = 0.75;

  // Composure modifier: +/- 10% based on composure (50 = neutral)
  probability += (composure - 50) / 500;

  // Shooting accuracy modifier: +/- 6% based on throw_accuracy
  probability += (throwAccuracy - 50) / 833;

  // Form technique modifier: +/- 4% based on mechanics
  probability += (formTechnique - 50) / 1250;

  // Goalkeeper modifier: better GK reduces probability
  probability -= (gkRating - 50) / 400;

  // Clamp to reasonable range (50% - 90%)
  return Math.max(0.50, Math.min(0.90, probability));
}

/**
 * Simulate a penalty shootout between two teams
 * Standard format: 5 kicks each, then sudden death
 * Exported for use by live simulation (V2 engine doesn't include it)
 */
export function simulatePenaltyShootout(
  homeTeam: SoccerTeamState,
  awayTeam: SoccerTeamState,
  events: SoccerEvent[]
): PenaltyShootoutResult {
  const homeGK = calculateGoalkeeperRating(homeTeam);
  const awayGK = calculateGoalkeeperRating(awayTeam);

  // Get penalty takers (sorted by composure + throw_accuracy for shooting skill)
  const getKickers = (team: SoccerTeamState): Player[] => {
    return [...team.lineup]
      .filter(p => team.positions[p.id] !== 'GK')
      .sort((a, b) => {
        const aScore = (a.attributes.composure ?? 50) + (a.attributes.throw_accuracy ?? 50);
        const bScore = (b.attributes.composure ?? 50) + (b.attributes.throw_accuracy ?? 50);
        return bScore - aScore;
      });
  };

  const homeKickers = getKickers(homeTeam);
  const awayKickers = getKickers(awayTeam);

  const homeKicks: boolean[] = [];
  const awayKicks: boolean[] = [];
  let homeScore = 0;
  let awayScore = 0;

  // First 5 kicks each
  for (let round = 0; round < 5; round++) {
    // Home team kicks
    const homeKicker = homeKickers[round % homeKickers.length];
    if (homeKicker) {
      const prob = calculatePenaltyConversion(homeKicker, homeGK);
      const scored = Math.random() < prob;
      homeKicks.push(scored);
      if (scored) homeScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'home',
        player: homeKicker,
        description: scored
          ? `${homeKicker.name} scores! (${homeScore}-${awayScore})`
          : `${homeKicker.name}'s penalty is saved! (${homeScore}-${awayScore})`,
      });
    }

    // Away team kicks
    const awayKicker = awayKickers[round % awayKickers.length];
    if (awayKicker) {
      const prob = calculatePenaltyConversion(awayKicker, awayGK);
      const scored = Math.random() < prob;
      awayKicks.push(scored);
      if (scored) awayScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'away',
        player: awayKicker,
        description: scored
          ? `${awayKicker.name} scores! (${homeScore}-${awayScore})`
          : `${awayKicker.name}'s penalty is saved! (${homeScore}-${awayScore})`,
      });
    }

    // Check if shootout is decided after both teams kicked
    const homeRemaining = 5 - (round + 1);
    const awayRemaining = 5 - (round + 1);

    // If one team can't catch up, end early
    if (homeScore > awayScore + awayRemaining) break;
    if (awayScore > homeScore + homeRemaining) break;
  }

  // Sudden death if still tied after 5 kicks each
  let suddenDeathRound = 5;
  while (homeScore === awayScore && suddenDeathRound < 20) {
    // Home kicks
    const homeKicker = homeKickers[suddenDeathRound % homeKickers.length];
    if (homeKicker) {
      const prob = calculatePenaltyConversion(homeKicker, homeGK);
      const scored = Math.random() < prob;
      homeKicks.push(scored);
      if (scored) homeScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'home',
        player: homeKicker,
        description: scored
          ? `SUDDEN DEATH: ${homeKicker.name} scores! (${homeScore}-${awayScore})`
          : `SUDDEN DEATH: ${homeKicker.name}'s penalty is saved! (${homeScore}-${awayScore})`,
      });
    }

    // Away kicks
    const awayKicker = awayKickers[suddenDeathRound % awayKickers.length];
    if (awayKicker) {
      const prob = calculatePenaltyConversion(awayKicker, awayGK);
      const scored = Math.random() < prob;
      awayKicks.push(scored);
      if (scored) awayScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'away',
        player: awayKicker,
        description: scored
          ? `SUDDEN DEATH: ${awayKicker.name} scores! (${homeScore}-${awayScore})`
          : `SUDDEN DEATH: ${awayKicker.name}'s penalty is saved! (${homeScore}-${awayScore})`,
      });
    }

    // Check if one team is ahead after both have kicked in sudden death
    if (homeScore !== awayScore) break;

    suddenDeathRound++;
  }

  const winner = homeScore > awayScore ? homeTeam.teamId : awayTeam.teamId;

  return {
    homeScore,
    awayScore,
    homeKicks,
    awayKicks,
    winner,
  };
}

// =============================================================================
// MAIN SIMULATION
// =============================================================================

/**
 * Simulate a complete soccer match
 */
export function simulateSoccerMatch(input: SoccerMatchInput): SoccerMatchResult {
  // 1. Calculate team composites
  const homeAttack = calculateTeamAttack(input.homeTeam);
  const homeDefense = calculateTeamDefense(input.homeTeam);
  const homeMidfield = calculateTeamMidfield(input.homeTeam);
  const homeGK = calculateGoalkeeperRating(input.homeTeam);

  const awayAttack = calculateTeamAttack(input.awayTeam);
  const awayDefense = calculateTeamDefense(input.awayTeam);
  const awayMidfield = calculateTeamMidfield(input.awayTeam);
  const awayGK = calculateGoalkeeperRating(input.awayTeam);

  // 2. Apply formation modifiers
  const homeMod = FORMATION_MODIFIERS[input.homeTeam.formation] || { attack: 1, defense: 1 };
  const awayMod = FORMATION_MODIFIERS[input.awayTeam.formation] || { attack: 1, defense: 1 };

  // 3. Calculate expected goals with tactical modifiers
  const homeXG = calculateExpectedGoals(
    homeAttack * homeMod.attack,
    awayDefense * awayMod.defense,
    awayGK,
    input.homeTeam.tactics.attackingStyle,
    input.awayTeam.tactics.pressing,
    true  // isHome
  );
  const awayXG = calculateExpectedGoals(
    awayAttack * awayMod.attack,
    homeDefense * homeMod.defense,
    homeGK,
    input.awayTeam.tactics.attackingStyle,
    input.homeTeam.tactics.pressing,
    false  // isAway
  );


  // 4. Process shots using goalkeeper system (replaces simple goal generation)
  const homeShotResult = processShots(homeXG, input.homeTeam, input.awayTeam);
  const awayShotResult = processShots(awayXG, input.awayTeam, input.homeTeam);

  const homeGoals = homeShotResult.goals;
  const awayGoals = awayShotResult.goals;

  // 5. Generate goal events with enhanced attribution
  const goalEvents = generateMatchEvents(
    input,
    homeGoals,
    awayGoals,
    homeShotResult.shotDetails,
    awayShotResult.shotDetails
  );

  // 6. Generate card events using realistic card system
  const cardEvents = generateCardEvents(
    input.homeTeam,
    input.awayTeam,
    homeGoals,
    awayGoals
  );

  // 7. Combine and sort all events
  const allEvents = [...goalEvents, ...cardEvents];
  allEvents.sort((a, b) => a.minute - b.minute);

  // Insert half time marker
  const halfTimeIndex = allEvents.findIndex(e => e.minute > 45);
  const insertAt = halfTimeIndex >= 0 ? halfTimeIndex : allEvents.length;
  allEvents.splice(insertAt, 0, {
    minute: 45,
    type: 'half_time',
    team: 'home',
    description: 'Half Time',
  });

  // Add full time marker
  allEvents.push({
    minute: 90,
    type: 'full_time',
    team: 'home',
    description: 'Full Time',
  });

  // 8. Calculate half time score
  const halfTimeScore = calculateHalfTimeScore(allEvents);

  // 9. Generate box score with GK saves
  const boxScore = generateBoxScore(
    input,
    allEvents,
    homeAttack,
    awayAttack,
    homeDefense,
    awayDefense,
    homeMidfield,
    awayMidfield,
    homeShotResult,
    awayShotResult
  );

  // 10. Determine winner (with penalty shootout if tied)
  let winner: string | null = null;
  let penaltyShootout: PenaltyShootoutResult | undefined;

  if (homeGoals > awayGoals) {
    winner = input.homeTeam.teamId;
  } else if (awayGoals > homeGoals) {
    winner = input.awayTeam.teamId;
  } else {
    // Tied - go to penalty shootout
    penaltyShootout = simulatePenaltyShootout(input.homeTeam, input.awayTeam, allEvents);
    winner = penaltyShootout.winner;
  }

  // 11. Generate enriched play-by-play (includes penalty events if any)
  const playByPlay = generateEnrichedPlayByPlay(
    allEvents,
    input.homeTeam.teamId,
    input.awayTeam.teamId
  );

  return {
    homeTeamId: input.homeTeam.teamId,
    awayTeamId: input.awayTeam.teamId,
    homeScore: homeGoals,
    awayScore: awayGoals,
    winner,
    halfTimeScore,
    events: allEvents,
    boxScore,
    playByPlay,
    penaltyShootout,
  };
}
