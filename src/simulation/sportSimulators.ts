/**
 * Sport-Specific Simulators
 *
 * Stub implementations for baseball and soccer.
 * These use simplified attribute-driven logic to generate realistic results.
 *
 * Key design principle: Attributes drive outcomes
 * - High arm_strength = faster pitches, stronger throws
 * - High agility = better fielding, better dribbling
 * - High reactions = better batting contact, better goalkeeping
 * - etc.
 */

import type { Player } from '../data/types';
import type { GameResult } from './game/gameSimulation';

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * Calculate team overall from roster
 */
function calculateTeamOverall(roster: Player[]): number {
  if (roster.length === 0) return 50;

  const totals = roster.map(player => {
    const attrs = player.attributes;
    if (!attrs) return 50;
    const values = Object.values(attrs).filter(v => typeof v === 'number') as number[];
    return values.reduce((a, b) => a + b, 0) / values.length;
  });

  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

/**
 * Calculate attribute composite for specific weights
 */
function calculateComposite(player: Player, weights: Record<string, number>): number {
  const attrs = player.attributes;
  if (!attrs) return 50;

  let total = 0;
  let weightSum = 0;

  for (const [attr, weight] of Object.entries(weights)) {
    const value = (attrs as Record<string, number>)[attr];
    if (typeof value === 'number') {
      total += value * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? total / weightSum : 50;
}

/**
 * Add randomness with attribute influence
 * Higher team rating = more consistent results, slightly higher scores
 */
function generateScore(baseMin: number, baseMax: number, teamRating: number, seed: number): number {
  // Team rating affects score range
  const ratingFactor = teamRating / 100;
  const adjustedMin = baseMin + Math.floor(ratingFactor * 2);
  const adjustedMax = baseMax + Math.floor(ratingFactor * 3);

  // Use seeded random for reproducibility
  const random = Math.abs(Math.sin(seed * 12345.67)) % 1;
  return Math.floor(adjustedMin + random * (adjustedMax - adjustedMin));
}

// =============================================================================
// BASEBALL SIMULATOR
// =============================================================================

/**
 * Attribute weights for baseball batting
 */
const WEIGHTS_BATTING = {
  hand_eye_coordination: 0.30,
  reactions: 0.20,
  arm_strength: 0.15,  // Power
  core_strength: 0.15, // Power
  patience: 0.10,      // Plate discipline
  composure: 0.10,
};

/**
 * Attribute weights for baseball pitching
 */
const WEIGHTS_PITCHING = {
  arm_strength: 0.25,
  throw_accuracy: 0.25,
  composure: 0.15,
  deception: 0.15,
  stamina: 0.10,
  consistency: 0.10,
};

/**
 * Attribute weights for baseball fielding
 */
const WEIGHTS_FIELDING = {
  reactions: 0.25,
  agility: 0.20,
  hand_eye_coordination: 0.20,
  throw_accuracy: 0.15,
  top_speed: 0.10,
  awareness: 0.10,
};

/**
 * Calculate team's batting strength
 */
function calculateTeamBatting(roster: Player[]): number {
  const battingScores = roster.map(p => calculateComposite(p, WEIGHTS_BATTING));
  return battingScores.reduce((a, b) => a + b, 0) / battingScores.length;
}

/**
 * Calculate team's pitching strength
 */
function calculateTeamPitching(roster: Player[]): number {
  // Use top 5 pitchers (or all if less than 5)
  const pitchingScores = roster
    .map(p => calculateComposite(p, WEIGHTS_PITCHING))
    .sort((a, b) => b - a)
    .slice(0, 5);
  return pitchingScores.reduce((a, b) => a + b, 0) / pitchingScores.length;
}

/**
 * Calculate team's fielding strength
 */
function calculateTeamFielding(roster: Player[]): number {
  const fieldingScores = roster.map(p => calculateComposite(p, WEIGHTS_FIELDING));
  return fieldingScores.reduce((a, b) => a + b, 0) / fieldingScores.length;
}

/**
 * Simulate a baseball game
 *
 * Attribute-driven:
 * - Better batting vs worse pitching = more runs
 * - Better fielding = fewer opponent runs
 * - Heavy players (high strength, low speed) struggle on bases
 * - Fast players get more infield hits and steals
 */
export function simulateBaseballGame(
  homeRoster: Player[],
  awayRoster: Player[],
  homeTeamName: string,
  awayTeamName: string
): GameResult {
  const seed = Date.now();

  // Calculate team strengths
  const homeBatting = calculateTeamBatting(homeRoster);
  const homePitching = calculateTeamPitching(homeRoster);
  const homeFielding = calculateTeamFielding(homeRoster);

  const awayBatting = calculateTeamBatting(awayRoster);
  const awayPitching = calculateTeamPitching(awayRoster);
  const awayFielding = calculateTeamFielding(awayRoster);

  // Calculate expected runs
  // Batting vs opponent pitching/fielding
  const homeOffense = homeBatting - (awayPitching * 0.5 + awayFielding * 0.5) / 2;
  const awayOffense = awayBatting - (homePitching * 0.5 + homeFielding * 0.5) / 2;

  // Convert to runs (typical MLB game: 4-5 runs per team)
  // Offense differential of 0 = ~4.5 runs, +/-20 = +/-2 runs
  const homeExpected = 4.5 + (homeOffense / 10);
  const awayExpected = 4.5 + (awayOffense / 10);

  // Add variance (baseball is high variance)
  const homeRuns = Math.max(0, Math.round(homeExpected + (Math.random() - 0.5) * 4));
  const awayRuns = Math.max(0, Math.round(awayExpected + (Math.random() - 0.5) * 4));

  // Generate simple box score
  const boxScore = {
    homeRuns,
    awayRuns,
    homeHits: Math.round(homeRuns * 2 + Math.random() * 3),
    awayHits: Math.round(awayRuns * 2 + Math.random() * 3),
    homeErrors: Math.floor(Math.random() * 2),
    awayErrors: Math.floor(Math.random() * 2),
    innings: homeRuns === awayRuns ? 10 : 9, // Extra innings if tied (then we pick winner)
  };

  // If tied after 9, pick winner based on batting strength
  let finalHomeRuns = homeRuns;
  let finalAwayRuns = awayRuns;
  if (homeRuns === awayRuns) {
    if (homeBatting > awayBatting) {
      finalHomeRuns += 1;
    } else {
      finalAwayRuns += 1;
    }
  }

  // Generate play-by-play summary
  const playByPlay = [
    `Baseball: ${awayTeamName} @ ${homeTeamName}`,
    `Final: ${awayTeamName} ${finalAwayRuns} - ${homeTeamName} ${finalHomeRuns}`,
    ``,
    `Team Batting Strength: ${homeTeamName} ${homeBatting.toFixed(1)} vs ${awayTeamName} ${awayBatting.toFixed(1)}`,
    `Team Pitching Strength: ${homeTeamName} ${homePitching.toFixed(1)} vs ${awayTeamName} ${awayPitching.toFixed(1)}`,
  ];

  return {
    homeScore: finalHomeRuns,
    awayScore: finalAwayRuns,
    gameStatistics: boxScore,
    playByPlayText: playByPlay.join('\n'),
    finalQuarterScores: { home: [finalHomeRuns], away: [finalAwayRuns] }, // Not quarters, but final
  };
}

// =============================================================================
// SOCCER SIMULATOR
// =============================================================================

/**
 * Attribute weights for soccer attacking
 */
const WEIGHTS_ATTACK = {
  throw_accuracy: 0.20,  // Shot accuracy
  arm_strength: 0.15,    // Shot power (leg strength proxy)
  agility: 0.15,         // Dribbling
  creativity: 0.15,      // Playmaking
  finesse: 0.15,         // Finishing touch
  awareness: 0.10,       // Positioning
  composure: 0.10,       // Finishing under pressure
};

/**
 * Attribute weights for soccer defending
 */
const WEIGHTS_DEFENSE = {
  awareness: 0.25,       // Positioning
  reactions: 0.20,       // Interceptions
  agility: 0.15,         // Tackling
  core_strength: 0.15,   // Winning duels
  determination: 0.15,   // Work rate
  teamwork: 0.10,        // Defensive organization
};

/**
 * Attribute weights for soccer goalkeeping
 */
const WEIGHTS_GOALKEEPING = {
  reactions: 0.30,       // Shot stopping
  height: 0.20,          // Reach
  agility: 0.15,         // Diving
  awareness: 0.15,       // Positioning
  composure: 0.10,       // High pressure situations
  hand_eye_coordination: 0.10, // Catching
};

/**
 * Calculate team's attacking strength
 */
function calculateTeamAttack(roster: Player[]): number {
  const attackScores = roster.map(p => calculateComposite(p, WEIGHTS_ATTACK));
  return attackScores.reduce((a, b) => a + b, 0) / attackScores.length;
}

/**
 * Calculate team's defensive strength
 */
function calculateTeamDefense(roster: Player[]): number {
  const defenseScores = roster.map(p => calculateComposite(p, WEIGHTS_DEFENSE));
  return defenseScores.reduce((a, b) => a + b, 0) / defenseScores.length;
}

/**
 * Calculate team's goalkeeping strength (best player)
 */
function calculateTeamGoalkeeping(roster: Player[]): number {
  const gkScores = roster.map(p => calculateComposite(p, WEIGHTS_GOALKEEPING));
  return Math.max(...gkScores); // Best goalkeeper
}

/**
 * Simulate a soccer game
 *
 * Attribute-driven:
 * - Better attack vs worse defense = more goals
 * - Better goalkeeping saves shots
 * - Tall players better at headers
 * - Agile players better at dribbling past defenders
 */
export function simulateSoccerGame(
  homeRoster: Player[],
  awayRoster: Player[],
  homeTeamName: string,
  awayTeamName: string
): GameResult {
  // Calculate team strengths
  const homeAttack = calculateTeamAttack(homeRoster);
  const homeDefense = calculateTeamDefense(homeRoster);
  const homeGK = calculateTeamGoalkeeping(homeRoster);

  const awayAttack = calculateTeamAttack(awayRoster);
  const awayDefense = calculateTeamDefense(awayRoster);
  const awayGK = calculateTeamGoalkeeping(awayRoster);

  // Calculate expected goals
  // Attack vs Defense + GK
  const homeXG = (homeAttack - (awayDefense * 0.6 + awayGK * 0.4)) / 30;
  const awayXG = (awayAttack - (homeDefense * 0.6 + homeGK * 0.4)) / 30;

  // Soccer is low scoring (typical: 1-2 goals per team)
  // Base of 1.3 goals, modified by team strength difference
  const homeExpected = Math.max(0, 1.3 + homeXG);
  const awayExpected = Math.max(0, 1.3 + awayXG);

  // Soccer has high variance - Poisson-like distribution
  // Using simple approximation
  const homeGoals = Math.max(0, Math.round(homeExpected + (Math.random() - 0.5) * 2));
  const awayGoals = Math.max(0, Math.round(awayExpected + (Math.random() - 0.5) * 2));

  // Generate simple box score
  const boxScore = {
    homeGoals,
    awayGoals,
    homeShots: Math.round(homeAttack / 10 + 5 + Math.random() * 5),
    awayShots: Math.round(awayAttack / 10 + 5 + Math.random() * 5),
    homePossession: Math.round(50 + (homeAttack - awayAttack) / 5),
    awayPossession: 0, // Will be calculated
    homeCorners: Math.floor(Math.random() * 6),
    awayCorners: Math.floor(Math.random() * 6),
  };
  boxScore.awayPossession = 100 - boxScore.homePossession;

  // Generate play-by-play summary
  const playByPlay = [
    `Soccer: ${awayTeamName} @ ${homeTeamName}`,
    `Final: ${awayTeamName} ${awayGoals} - ${homeTeamName} ${homeGoals}`,
    ``,
    `Possession: ${homeTeamName} ${boxScore.homePossession}% - ${awayTeamName} ${boxScore.awayPossession}%`,
    `Shots: ${homeTeamName} ${boxScore.homeShots} - ${awayTeamName} ${boxScore.awayShots}`,
    ``,
    `Team Attack Strength: ${homeTeamName} ${homeAttack.toFixed(1)} vs ${awayTeamName} ${awayAttack.toFixed(1)}`,
    `Team Defense Strength: ${homeTeamName} ${homeDefense.toFixed(1)} vs ${awayTeamName} ${awayDefense.toFixed(1)}`,
  ];

  return {
    homeScore: homeGoals,
    awayScore: awayGoals,
    gameStatistics: boxScore,
    playByPlayText: playByPlay.join('\n'),
    finalQuarterScores: { home: [homeGoals], away: [awayGoals] }, // Not quarters, but final
  };
}

// =============================================================================
// SPORT SELECTOR
// =============================================================================

/**
 * Simulate a game for any sport
 */
export function simulateGameForSport(
  sport: 'basketball' | 'baseball' | 'soccer',
  homeRoster: Player[],
  awayRoster: Player[],
  homeTeamName: string,
  awayTeamName: string,
  homeTactics?: any,
  awayTactics?: any
): GameResult {
  switch (sport) {
    case 'baseball':
      return simulateBaseballGame(homeRoster, awayRoster, homeTeamName, awayTeamName);
    case 'soccer':
      return simulateSoccerGame(homeRoster, awayRoster, homeTeamName, awayTeamName);
    case 'basketball':
    default:
      // Basketball uses the full GameSimulator - import will be done in matchRunner
      throw new Error('Use GameSimulator for basketball');
  }
}
