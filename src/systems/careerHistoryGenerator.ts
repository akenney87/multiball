/**
 * Career History Generator
 *
 * Generates historical career stats for players from before the user started playing.
 * Each player's career started between ages 18-22, with stats reflecting their
 * skill level at each age, accounting for progression and variance.
 *
 * @module systems/careerHistoryGenerator
 */

import type {
  Player,
  PlayerAttributes,
  PlayerSeasonRecord,
  BasketballCareerStats,
  BaseballCareerStats,
  SoccerCareerStats,
} from '../data/types';
import { calculateSimpleOverall } from '../utils/overallRating';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Base year for the game - Season 1 starts in this year
 * Used to calculate calendar year labels for seasons (e.g., "2024-25")
 */
export const BASE_YEAR = 2026;

// Peak ages for different attribute categories
const PEAK_AGES = {
  physical: 26,
  technical: 28,
  mental: 30,
};

// Season lengths (games per sport per season)
const GAMES_PER_SEASON = {
  basketball: 82,
  baseball: 162,
  soccer: 38,
};

// Minutes per game (approximate averages for starters)
const MINUTES_PER_GAME = {
  basketball: 36,
  baseball: 9 * 3, // 9 innings * ~3 at-bats
  soccer: 90,
};

/**
 * Get calendar year label for a season number
 * Season 1 = "2025-26" (starts in 2025, ends in 2026)
 * Season 0 = "2024-25"
 * Season -1 = "2023-24"
 * etc.
 */
function getYearLabelForSeason(seasonNumber: number): string {
  // Season 1 starts in year (BASE_YEAR - 1) and ends in BASE_YEAR
  const startYear = BASE_YEAR - 1 + (seasonNumber - 1);
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a random career start age (18-22), weighted toward younger ages
 * Most players turn pro at 18-20, fewer at 21-22
 */
function generateCareerStartAge(): number {
  const rand = Math.random();
  if (rand < 0.35) return 18; // 35% start at 18
  if (rand < 0.65) return 19; // 30% start at 19
  if (rand < 0.85) return 20; // 20% start at 20
  if (rand < 0.95) return 21; // 10% start at 21
  return 22; // 5% start at 22
}

/**
 * Calculate playing time percentage based on age and career stage
 * Early career: less playing time (developing, not first choice)
 * Prime years: peak playing time
 * Late career: possibly reduced if declining
 *
 * @param age - Player age in that season
 * @param careerStartAge - Age when player turned pro
 * @param currentOvr - Current overall rating (affects opportunity)
 * @returns Playing time multiplier (0.1 to 1.0)
 */
function getPlayingTimeMultiplier(
  age: number,
  careerStartAge: number,
  currentOvr: number
): number {
  const yearsInCareer = age - careerStartAge;

  // Base playing time by years in career
  let baseMultiplier: number;
  if (yearsInCareer === 0) {
    // Rookie year - very limited unless exceptional
    baseMultiplier = 0.15 + Math.random() * 0.25; // 15-40%
  } else if (yearsInCareer === 1) {
    // Second year - growing role
    baseMultiplier = 0.30 + Math.random() * 0.30; // 30-60%
  } else if (yearsInCareer === 2) {
    // Third year - establishing
    baseMultiplier = 0.50 + Math.random() * 0.30; // 50-80%
  } else if (age >= 24 && age <= 30) {
    // Prime years - full playing time potential
    baseMultiplier = 0.70 + Math.random() * 0.30; // 70-100%
  } else if (age > 30 && age <= 33) {
    // Early decline - still significant role
    baseMultiplier = 0.60 + Math.random() * 0.30; // 60-90%
  } else if (age > 33) {
    // Late career - reduced role
    baseMultiplier = 0.40 + Math.random() * 0.35; // 40-75%
  } else {
    // Young player establishing (23)
    baseMultiplier = 0.60 + Math.random() * 0.30; // 60-90%
  }

  // OVR modifier: better players get more time at all stages
  const ovrModifier = 0.7 + (currentOvr / 100) * 0.6; // 0.7-1.3 based on OVR

  // Add some random variance for injuries, competition, etc.
  const variance = 0.85 + Math.random() * 0.30; // 85-115%

  return Math.min(1.0, Math.max(0.1, baseMultiplier * ovrModifier * variance));
}

/**
 * Estimate what a player's OVR would have been at a given age
 * Works backwards from current attributes using progression/regression curves
 *
 * @param currentAttrs - Current player attributes
 * @param currentAge - Player's current age
 * @param targetAge - Age to estimate OVR for
 * @returns Estimated OVR at target age
 */
function estimateHistoricalOvr(
  currentAttrs: PlayerAttributes,
  currentAge: number,
  targetAge: number
): number {
  // Calculate current OVR
  const currentOvr = calculateSimpleOverall(currentAttrs);

  // If target age is current age, return current OVR
  if (targetAge === currentAge) return currentOvr;

  const ageDiff = currentAge - targetAge;

  if (ageDiff > 0) {
    // Looking at younger version - need to reduce from current
    // Players typically improve ~2-4 points per year in their youth
    // and maintain through prime

    let historicalOvr = currentOvr;

    for (let age = currentAge - 1; age >= targetAge; age--) {
      // Different progression rates by career stage
      if (age < 22) {
        // Heavy development years - large improvements
        historicalOvr -= 2.5 + Math.random() * 2.5; // -2.5 to -5 per year
      } else if (age < 25) {
        // Continued development - moderate improvements
        historicalOvr -= 1.5 + Math.random() * 2.0; // -1.5 to -3.5 per year
      } else if (age < PEAK_AGES.physical) {
        // Approaching physical peak - small improvements
        historicalOvr -= 0.5 + Math.random() * 1.5; // -0.5 to -2 per year
      } else if (age < PEAK_AGES.mental) {
        // Physical decline but mental growth - mostly stable
        historicalOvr -= Math.random() * 1.0; // 0 to -1 per year
      } else if (age < 33) {
        // Decline phase - they were actually BETTER before
        historicalOvr += 0.5 + Math.random() * 1.5; // Actually add because they've declined
      } else {
        // Late career decline
        historicalOvr += 1.0 + Math.random() * 2.0; // They were better before decline
      }
    }

    // Add variance - some players develop differently
    const developmentVariance = (Math.random() - 0.5) * 8; // +-4 variance
    historicalOvr += developmentVariance;

    // Clamp to reasonable range - can't be better than peak or worse than minimum pro
    return Math.max(20, Math.min(currentOvr + 10, Math.round(historicalOvr)));
  }

  // Looking at older version (shouldn't happen in this context)
  return currentOvr;
}

// =============================================================================
// STAT GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate basketball stats for a season based on OVR and playing time
 */
function generateBasketballStats(
  ovr: number,
  gamesPlayed: number,
  minutesPlayed: number
): BasketballCareerStats {
  const minutesPerGame = gamesPlayed > 0 ? minutesPlayed / gamesPlayed : 0;
  const ovrFactor = ovr / 100; // 0-1 scale

  // Per-game rates scaled by OVR and minutes
  const mpgFactor = minutesPerGame / 36; // Compared to full starter minutes

  // FG attempts per game: 6-20
  const fgaPerGame = (6 + ovrFactor * 14) * mpgFactor;
  const fgPct = 0.35 + ovrFactor * 0.20 + (Math.random() - 0.5) * 0.08; // 35-55% with variance

  // 3PT: varies more by player type
  const threePtRate = 0.2 + Math.random() * 0.4; // 20-60% of FGA are 3s
  const threeAttempts = fgaPerGame * threePtRate;
  const threePct = 0.28 + ovrFactor * 0.14 + (Math.random() - 0.5) * 0.08; // 28-42%

  // FT
  const ftaPerGame = (2 + ovrFactor * 6) * mpgFactor;
  const ftPct = 0.60 + ovrFactor * 0.25 + (Math.random() - 0.5) * 0.10; // 60-85%

  // Other stats
  const rpg = (2 + ovrFactor * 8) * mpgFactor;
  const apg = (1 + ovrFactor * 6) * mpgFactor;
  const spg = (0.3 + ovrFactor * 1.5) * mpgFactor;
  const bpg = (0.2 + ovrFactor * 1.3) * mpgFactor;
  const topg = (1 + ovrFactor * 2) * mpgFactor;

  // Calculate totals for season
  const fgm = Math.round(fgaPerGame * fgPct * gamesPlayed);
  const fga = Math.round(fgaPerGame * gamesPlayed);
  const threeMade = Math.round(threeAttempts * threePct * gamesPlayed);
  const threeAtt = Math.round(threeAttempts * gamesPlayed);
  const ftm = Math.round(ftaPerGame * ftPct * gamesPlayed);
  const fta = Math.round(ftaPerGame * gamesPlayed);

  return {
    fieldGoalsMade: fgm,
    fieldGoalsAttempted: Math.max(fgm, fga),
    threePointersMade: threeMade,
    threePointersAttempted: Math.max(threeMade, threeAtt),
    freeThrowsMade: ftm,
    freeThrowsAttempted: Math.max(ftm, fta),
    rebounds: Math.round(rpg * gamesPlayed),
    assists: Math.round(apg * gamesPlayed),
    steals: Math.round(spg * gamesPlayed),
    blocks: Math.round(bpg * gamesPlayed),
    turnovers: Math.round(topg * gamesPlayed),
  };
}

/**
 * Generate baseball stats for a season based on OVR and playing time
 */
function generateBaseballStats(
  ovr: number,
  gamesPlayed: number
): BaseballCareerStats {
  const ovrFactor = ovr / 100;

  // Batting stats
  const atBatsPerGame = 3.5 + Math.random() * 1.0; // 3.5-4.5 AB per game
  const atBats = Math.round(atBatsPerGame * gamesPlayed);

  // Batting average: .200 to .320 based on OVR
  const battingAvg = 0.200 + ovrFactor * 0.120 + (Math.random() - 0.5) * 0.040;
  const hits = Math.round(atBats * battingAvg);

  // Extra base hits
  const xbhRate = 0.15 + ovrFactor * 0.15; // 15-30% of hits are XBH
  const xbh = Math.round(hits * xbhRate);
  const doubles = Math.round(xbh * 0.65);
  const triples = Math.round(xbh * 0.08);
  const homeRuns = Math.round(xbh * 0.27);

  // Other batting
  const runsPerHit = 0.4 + ovrFactor * 0.3;
  const runs = Math.round(hits * runsPerHit);
  const rbiPerHit = 0.35 + ovrFactor * 0.35;
  const rbi = Math.round(hits * rbiPerHit);
  const walkRate = 0.06 + ovrFactor * 0.06; // 6-12% walk rate
  const walks = Math.round(atBats * walkRate);
  const strikeoutRate = 0.28 - ovrFactor * 0.10; // 18-28% K rate
  const strikeouts = Math.round(atBats * strikeoutRate);

  // Stolen bases (speed-dependent, but simplified)
  const sbAttempts = Math.round(gamesPlayed * (0.05 + ovrFactor * 0.15));
  const sbSuccess = 0.65 + ovrFactor * 0.15;
  const stolenBases = Math.round(sbAttempts * sbSuccess);
  const caughtStealing = sbAttempts - stolenBases;

  // Pitching (most players don't pitch, but some might have a few innings)
  const isPitcher = Math.random() < 0.15; // 15% chance player has pitching stats
  let pitchingStats = {
    gamesStarted: 0,
    inningsPitched: 0,
    hitsAllowed: 0,
    runsAllowed: 0,
    earnedRuns: 0,
    walksAllowed: 0,
    strikeoutsThrown: 0,
    homeRunsAllowed: 0,
    wins: 0,
    losses: 0,
    saves: 0,
  };

  if (isPitcher) {
    const gs = Math.round(gamesPlayed * (0.1 + Math.random() * 0.2));
    const ip = gs * (4 + ovrFactor * 3); // 4-7 IP per start
    const ipThirds = Math.round(ip * 3);

    const era = 5.5 - ovrFactor * 2.5 + (Math.random() - 0.5) * 1.5; // 3.0-5.5 ERA
    const er = Math.round((ip * era) / 9);

    pitchingStats = {
      gamesStarted: gs,
      inningsPitched: ipThirds,
      hitsAllowed: Math.round(ip * (0.9 + (1 - ovrFactor) * 0.4)),
      runsAllowed: Math.round(er * 1.15),
      earnedRuns: er,
      walksAllowed: Math.round(ip * (0.25 + (1 - ovrFactor) * 0.2)),
      strikeoutsThrown: Math.round(ip * (0.6 + ovrFactor * 0.5)),
      homeRunsAllowed: Math.round(ip * (0.08 + (1 - ovrFactor) * 0.08)),
      wins: Math.round(gs * (0.3 + ovrFactor * 0.3)),
      losses: Math.round(gs * (0.3 + (1 - ovrFactor) * 0.2)),
      saves: 0,
    };
  }

  // Fielding
  const putouts = Math.round(gamesPlayed * (2 + Math.random() * 4));
  const assists = Math.round(gamesPlayed * (1 + Math.random() * 3));
  const fieldingPct = 0.95 + ovrFactor * 0.04;
  const totalChances = putouts + assists;
  const errors = Math.round(totalChances * (1 - fieldingPct));

  return {
    atBats,
    runs,
    hits,
    doubles,
    triples,
    homeRuns,
    rbi,
    walks,
    strikeouts,
    stolenBases,
    caughtStealing,
    ...pitchingStats,
    putouts,
    assists,
    errors,
  };
}

/**
 * Generate soccer stats for a season based on OVR and playing time
 */
function generateSoccerStats(
  ovr: number,
  gamesPlayed: number,
  minutesPlayed: number
): SoccerCareerStats {
  const ovrFactor = ovr / 100;
  const minutesPerGame = gamesPlayed > 0 ? minutesPlayed / gamesPlayed : 0;
  const mpgFactor = minutesPerGame / 90;

  // Attacking stats vary by position (simplified - assume mixed role)
  const isAttacker = Math.random() < 0.4; // 40% are more attacking players
  const isGoalkeeper = Math.random() < 0.08; // 8% are goalkeepers

  let goals: number;
  let shotStats: { shots: number; shotsOnTarget: number };

  if (isGoalkeeper) {
    goals = 0;
    shotStats = { shots: 0, shotsOnTarget: 0 };
  } else if (isAttacker) {
    // Attackers: 5-20 goals per season for good players
    const goalsPerGame = (0.15 + ovrFactor * 0.35) * mpgFactor;
    goals = Math.round(goalsPerGame * gamesPlayed);
    const shotsPerGame = (1.5 + ovrFactor * 2.5) * mpgFactor;
    const shots = Math.round(shotsPerGame * gamesPlayed);
    const sotPct = 0.30 + ovrFactor * 0.20;
    shotStats = { shots, shotsOnTarget: Math.round(shots * sotPct) };
  } else {
    // Midfielders/defenders: 0-8 goals
    const goalsPerGame = (0.02 + ovrFactor * 0.12) * mpgFactor;
    goals = Math.round(goalsPerGame * gamesPlayed);
    const shotsPerGame = (0.5 + ovrFactor * 1.0) * mpgFactor;
    const shots = Math.round(shotsPerGame * gamesPlayed);
    const sotPct = 0.25 + ovrFactor * 0.20;
    shotStats = { shots, shotsOnTarget: Math.round(shots * sotPct) };
  }

  // Assists
  const assistsPerGame = isGoalkeeper
    ? 0
    : (0.05 + ovrFactor * 0.20) * mpgFactor;
  const assists = Math.round(assistsPerGame * gamesPlayed);

  // Cards
  const yellowsPerGame = 0.05 + (1 - ovrFactor) * 0.10; // Better players get fewer cards
  const yellowCards = Math.round(yellowsPerGame * gamesPlayed);
  const redCards = Math.random() < 0.1 ? 1 : 0; // 10% chance of 1 red per season

  // Goalkeeper stats
  let gkStats: { saves?: number; cleanSheets?: number; goalsAgainst?: number } = {};
  if (isGoalkeeper) {
    const savesPerGame = 2 + ovrFactor * 4;
    gkStats = {
      saves: Math.round(savesPerGame * gamesPlayed),
      cleanSheets: Math.round(gamesPlayed * (0.15 + ovrFactor * 0.25)),
      goalsAgainst: Math.round(gamesPlayed * (1.5 - ovrFactor * 0.7)),
    };
  }

  return {
    goals,
    assists,
    shots: shotStats.shots,
    shotsOnTarget: shotStats.shotsOnTarget,
    minutesPlayed,
    yellowCards,
    redCards,
    ...gkStats,
  };
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Generate historical career stats for a player
 *
 * Creates season-by-season records from their professional debut to present.
 * Stats reflect estimated skill level at each age with appropriate variance.
 *
 * @param player - The player to generate history for
 * @param currentSeasonNumber - Current season number (for year labels)
 * @returns Array of PlayerSeasonRecord for their career history
 */
export function generateCareerHistory(
  player: Player,
  currentSeasonNumber: number = 1
): PlayerSeasonRecord[] {
  const history: PlayerSeasonRecord[] = [];

  // Use player's stored careerStartAge, or generate one if not set
  const careerStartAge = player.careerStartAge ?? generateCareerStartAge();

  // Calculate number of professional seasons (not including current season)
  const seasonsPlayed = Math.max(0, player.age - careerStartAge);

  if (seasonsPlayed === 0) {
    // Player just turned pro, no history yet
    return history;
  }

  // Generate each historical season (before current season starts)
  for (let i = 0; i < seasonsPlayed; i++) {
    const seasonAge = careerStartAge + i;
    // Historical seasons are numbered relative to current season
    // If current is season 1 and player has 5 years history, their first was "season -4"
    const seasonNumber = currentSeasonNumber - seasonsPlayed + i;

    // Estimate OVR at this age
    const historicalOvr = estimateHistoricalOvr(
      player.attributes,
      player.age,
      seasonAge
    );

    // Calculate playing time
    const playingTimeMultiplier = getPlayingTimeMultiplier(
      seasonAge,
      careerStartAge,
      historicalOvr
    );

    // Games played per sport (with some variance in which sports they played)
    const sportFocus = Math.random(); // Random sport emphasis
    const basketballEmphasis = sportFocus < 0.33 ? 1.2 : sportFocus < 0.66 ? 1.0 : 0.8;
    const baseballEmphasis = sportFocus < 0.33 ? 0.8 : sportFocus < 0.66 ? 1.2 : 1.0;
    const soccerEmphasis = sportFocus < 0.33 ? 1.0 : sportFocus < 0.66 ? 0.8 : 1.2;

    const basketballGames = Math.round(
      GAMES_PER_SEASON.basketball * playingTimeMultiplier * basketballEmphasis * (0.9 + Math.random() * 0.2)
    );
    const baseballGames = Math.round(
      GAMES_PER_SEASON.baseball * playingTimeMultiplier * baseballEmphasis * (0.9 + Math.random() * 0.2)
    );
    const soccerGames = Math.round(
      GAMES_PER_SEASON.soccer * playingTimeMultiplier * soccerEmphasis * (0.9 + Math.random() * 0.2)
    );

    // Minutes played
    const basketballMinutes = Math.round(basketballGames * MINUTES_PER_GAME.basketball * (0.7 + playingTimeMultiplier * 0.3));
    const baseballMinutes = Math.round(baseballGames * MINUTES_PER_GAME.baseball);
    const soccerMinutes = Math.round(soccerGames * MINUTES_PER_GAME.soccer * (0.7 + playingTimeMultiplier * 0.3));

    // Generate sport-specific stats
    const basketballStats = generateBasketballStats(historicalOvr, basketballGames, basketballMinutes);
    const baseballStats = generateBaseballStats(historicalOvr, baseballGames);
    const soccerStats = generateSoccerStats(historicalOvr, soccerGames, soccerMinutes);

    // Calculate total points
    const basketballPoints =
      basketballStats.fieldGoalsMade * 2 +
      basketballStats.threePointersMade +
      basketballStats.freeThrowsMade;
    const baseballPoints = baseballStats.runs + baseballStats.rbi;
    const soccerPoints = soccerStats.goals * 3 + soccerStats.assists;

    // Create season record with proper calendar year label
    const seasonRecord: PlayerSeasonRecord = {
      seasonNumber,
      yearLabel: getYearLabelForSeason(seasonNumber),
      teamId: 'historical', // Generic ID for pre-game history
      gamesPlayed: {
        basketball: basketballGames,
        baseball: baseballGames,
        soccer: soccerGames,
      },
      totalPoints: {
        basketball: basketballPoints,
        baseball: baseballPoints,
        soccer: soccerPoints,
      },
      minutesPlayed: {
        basketball: basketballMinutes,
        baseball: baseballMinutes,
        soccer: soccerMinutes,
      },
      basketball: basketballStats,
      baseball: baseballStats,
      soccer: soccerStats,
    };

    history.push(seasonRecord);
  }

  return history;
}

/**
 * Add career start age to a player
 * Call this during player creation to store the generated start age
 */
export function assignCareerStartAge(): number {
  return generateCareerStartAge();
}

/**
 * Calculate career totals from season history
 */
export function calculateCareerTotals(history: PlayerSeasonRecord[]): {
  totalGames: { basketball: number; baseball: number; soccer: number };
  totalMinutes: { basketball: number; baseball: number; soccer: number };
  totalPoints: { basketball: number; baseball: number; soccer: number };
} {
  const totals = {
    totalGames: { basketball: 0, baseball: 0, soccer: 0 },
    totalMinutes: { basketball: 0, baseball: 0, soccer: 0 },
    totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
  };

  for (const season of history) {
    totals.totalGames.basketball += season.gamesPlayed.basketball;
    totals.totalGames.baseball += season.gamesPlayed.baseball;
    totals.totalGames.soccer += season.gamesPlayed.soccer;
    totals.totalMinutes.basketball += season.minutesPlayed.basketball;
    totals.totalMinutes.baseball += season.minutesPlayed.baseball;
    totals.totalMinutes.soccer += season.minutesPlayed.soccer;
    totals.totalPoints.basketball += season.totalPoints.basketball;
    totals.totalPoints.baseball += season.totalPoints.baseball;
    totals.totalPoints.soccer += season.totalPoints.soccer;
  }

  return totals;
}
