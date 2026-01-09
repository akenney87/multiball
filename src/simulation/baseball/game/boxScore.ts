/**
 * Baseball Box Score Generation
 *
 * Generates complete box scores from half-inning results.
 * Tracks batting stats, pitching stats, and game totals.
 *
 * @module simulation/baseball/game/boxScore
 */

import type {
  BaseballBoxScore,
  BaseballBattingLine,
  BaseballPitchingLine,
  BaseballCatcherLine,
  HalfInningResult,
  AtBatResult,
  HalfInningEvent,
} from '../types';
import type { TeamGameState } from './gameSimulation';

// =============================================================================
// BOX SCORE GENERATION
// =============================================================================

/**
 * Generate complete box score from half-inning results
 *
 * @param halfInnings - All half-inning results
 * @param homeTeam - Home team state (for player IDs)
 * @param awayTeam - Away team state (for player IDs)
 * @returns Complete box score
 */
export function generateBoxScore(
  halfInnings: HalfInningResult[],
  homeTeam: TeamGameState,
  awayTeam: TeamGameState
): BaseballBoxScore {
  // Initialize batting lines
  const homeBatting: Record<string, BaseballBattingLine> = {};
  const awayBatting: Record<string, BaseballBattingLine> = {};

  // Initialize pitching lines
  const homePitching: Record<string, BaseballPitchingLine> = {};
  const awayPitching: Record<string, BaseballPitchingLine> = {};

  // Initialize all batters with empty lines
  for (const player of homeTeam.lineup) {
    homeBatting[player.id] = createEmptyBattingLine();
  }
  for (const player of awayTeam.lineup) {
    awayBatting[player.id] = createEmptyBattingLine();
  }

  // Initialize pitching lines from pitch counts
  for (const [pitcherId, pitchCount] of Object.entries(homeTeam.pitcherPitchCounts)) {
    homePitching[pitcherId] = createEmptyPitchingLine(pitchCount);
  }
  for (const [pitcherId, pitchCount] of Object.entries(awayTeam.pitcherPitchCounts)) {
    awayPitching[pitcherId] = createEmptyPitchingLine(pitchCount);
  }

  // Initialize catcher lines
  const homeCatching: Record<string, BaseballCatcherLine> = {};
  const awayCatching: Record<string, BaseballCatcherLine> = {};

  // Track runs by inning
  const homeRunsByInning: number[] = [];
  const awayRunsByInning: number[] = [];

  // Track errors by fielder (fielding team is opposite of batting team)
  const homeErrorsByFielder: Record<string, number> = {};
  const awayErrorsByFielder: Record<string, number> = {};

  // Track team-level stats
  let homeLeftOnBase = 0;
  let awayLeftOnBase = 0;
  let homeStolenBases = 0;
  let awayStolenBases = 0;
  let homeCaughtStealing = 0;
  let awayCaughtStealing = 0;
  let homeWildPitches = 0;
  let awayWildPitches = 0;
  let homePassedBalls = 0;
  let awayPassedBalls = 0;

  // Process each half-inning
  for (const halfInning of halfInnings) {
    const isHome = halfInning.half === 'bottom';
    const battingLines = isHome ? homeBatting : awayBatting;
    const pitchingLines = isHome ? awayPitching : homePitching;

    // Track runs for this inning
    if (halfInning.half === 'top') {
      awayRunsByInning.push(halfInning.runs);
    } else {
      homeRunsByInning.push(halfInning.runs);
    }

    // Fielding team error tracking: when away bats (top), home fields; when home bats (bottom), away fields
    const errorsByFielder = isHome ? awayErrorsByFielder : homeErrorsByFielder;

    // Process each at-bat
    for (const atBat of halfInning.atBats) {
      // Update batter stats
      const batterId = atBat.batter.id;
      const batterLine = battingLines[batterId];
      if (batterLine) {
        updateBattingLine(batterLine, atBat);
      }

      // Add runs to ALL scoring runners' batting lines (not just the batter)
      // The batter's run on HR is already handled in updateBattingLine
      for (const runner of atBat.scoringRunners) {
        // Skip batter on home runs (already counted in updateBattingLine)
        if (atBat.outcome === 'home_run' && runner.id === batterId) {
          continue;
        }
        // Skip batter on other outcomes (handled in updateBattingLine)
        if (runner.id === batterId) {
          continue;
        }
        // Add run to this runner's batting line
        const runnerLine = battingLines[runner.id];
        if (runnerLine) {
          runnerLine.runs++;
        }
      }

      // Update pitcher stats (hits, walks, Ks, etc.)
      const pitcherId = atBat.pitcher.id;
      const pitcherLine = pitchingLines[pitcherId];
      if (pitcherLine) {
        updatePitchingLine(pitcherLine, atBat);
      }

      // Update runs charged to responsible pitchers (handles inherited runners)
      updatePitchingLinesFromRuns(pitchingLines, atBat);

      // Track errors by fielder
      if (atBat.outcome === 'error' && atBat.errorFielder) {
        const fielderId = atBat.errorFielder.id;
        errorsByFielder[fielderId] = (errorsByFielder[fielderId] ?? 0) + 1;
      }
    }

    // Process events (steals, WP, PB, IBB)
    const catchingLines = isHome ? awayCatching : homeCatching;
    for (const event of halfInning.events) {
      processEvent(
        event,
        battingLines,
        pitchingLines,
        catchingLines,
        isHome,
        {
          addStolenBase: () => { if (isHome) homeStolenBases++; else awayStolenBases++; },
          addCaughtStealing: () => { if (isHome) homeCaughtStealing++; else awayCaughtStealing++; },
          addWildPitch: () => { if (isHome) awayWildPitches++; else homeWildPitches++; },
          addPassedBall: () => { if (isHome) awayPassedBalls++; else homePassedBalls++; },
        }
      );
    }

    // Track LOB from half-inning
    if (isHome) {
      homeLeftOnBase += halfInning.leftOnBase;
    } else {
      awayLeftOnBase += halfInning.leftOnBase;
    }

    // Update innings pitched for pitcher(s)
    for (const [pitcherId, outs] of Object.entries(getOutsByPitcher(halfInning))) {
      const pitcherLine = pitchingLines[pitcherId];
      if (pitcherLine) {
        // Add partial innings (outs / 3)
        pitcherLine.inningsPitched += outs / 3;
      }
    }
  }

  // Calculate totals
  const homeRuns = homeRunsByInning.reduce((a, b) => a + b, 0);
  const awayRuns = awayRunsByInning.reduce((a, b) => a + b, 0);
  const homeHits = Object.values(homeBatting).reduce((sum, line) => sum + line.hits, 0);
  const awayHits = Object.values(awayBatting).reduce((sum, line) => sum + line.hits, 0);
  const homeErrors = halfInnings
    .filter(hi => hi.half === 'top')
    .reduce((sum, hi) => sum + hi.errors, 0);
  const awayErrors = halfInnings
    .filter(hi => hi.half === 'bottom')
    .reduce((sum, hi) => sum + hi.errors, 0);

  // Assign pitcher decisions
  assignPitcherDecisions(homePitching, awayPitching, homeRuns, awayRuns);

  // Calculate innings played
  const innings = Math.max(homeRunsByInning.length, awayRunsByInning.length);

  return {
    homeRunsByInning,
    awayRunsByInning,
    homeRuns,
    awayRuns,
    homeHits,
    awayHits,
    homeErrors,
    awayErrors,
    homeErrorsByFielder,
    awayErrorsByFielder,
    homeBatting,
    awayBatting,
    homePitching,
    awayPitching,
    homeCatching,
    awayCatching,
    homeLeftOnBase,
    awayLeftOnBase,
    homeStolenBases,
    awayStolenBases,
    homeCaughtStealing,
    awayCaughtStealing,
    homeWildPitches,
    awayWildPitches,
    homePassedBalls,
    awayPassedBalls,
    innings,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create empty batting line
 */
function createEmptyBattingLine(): BaseballBattingLine {
  return {
    atBats: 0,
    runs: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    rbi: 0,
    walks: 0,
    strikeouts: 0,
    stolenBases: 0,
    caughtStealing: 0,
    sacrificeFlies: 0,
    gidp: 0,
    rbiWith2Outs: 0,
  };
}

/**
 * Create empty pitching line
 */
function createEmptyPitchingLine(pitchCount: number = 0): BaseballPitchingLine {
  return {
    inningsPitched: 0,
    hits: 0,
    runs: 0,
    earnedRuns: 0,
    walks: 0,
    intentionalWalks: 0,
    strikeouts: 0,
    homeRuns: 0,
    pitchCount,
    wildPitches: 0,
  };
}

/**
 * Create empty catcher line
 */
function createEmptyCatcherLine(): BaseballCatcherLine {
  return {
    passedBalls: 0,
    runnersCaughtStealing: 0,
    stolenBasesAllowed: 0,
  };
}

/**
 * Ensure catcher line exists for given catcher ID
 */
function ensureCatcherLine(
  catchingLines: Record<string, BaseballCatcherLine>,
  catcherId: string
): BaseballCatcherLine {
  if (!catchingLines[catcherId]) {
    catchingLines[catcherId] = createEmptyCatcherLine();
  }
  return catchingLines[catcherId]!;
}

/**
 * Update batting line from at-bat result
 */
function updateBattingLine(line: BaseballBattingLine, atBat: AtBatResult): void {
  const outcome = atBat.outcome;

  // Walks and HBP don't count as at-bats
  if (outcome === 'walk' || outcome === 'intentional_walk') {
    line.walks++;
    return;
  }

  if (outcome === 'hit_by_pitch') {
    // HBP doesn't count as at-bat or walk
    return;
  }

  // Sacrifice flies don't count as at-bats
  if (atBat.isSacrificeFly) {
    line.sacrificeFlies++;
    line.rbi += atBat.rbi;
    // Track 2-out RBIs
    if (atBat.outsWhenRbiOccurred === 2 && atBat.rbi > 0) {
      line.rbiWith2Outs += atBat.rbi;
    }
    return;
  }

  // Count at-bat
  line.atBats++;

  // Update based on outcome
  switch (outcome) {
    case 'single':
      line.hits++;
      break;
    case 'double':
      line.hits++;
      line.doubles++;
      break;
    case 'triple':
      line.hits++;
      line.triples++;
      break;
    case 'home_run':
      line.hits++;
      line.homeRuns++;
      line.runs++; // Batter scores on HR
      break;
    case 'strikeout':
      line.strikeouts++;
      break;
    case 'double_play':
      if (atBat.isGIDP) {
        line.gidp++;
      }
      break;
    case 'error':
      // Reached on error - not a hit, not an out
      break;
    // Other outs don't affect batting line beyond at-bat count
  }

  // Add RBIs
  line.rbi += atBat.rbi;

  // Track 2-out RBIs
  if (atBat.outsWhenRbiOccurred === 2 && atBat.rbi > 0) {
    line.rbiWith2Outs += atBat.rbi;
  }

  // Add runs for runners who scored (batter included in HR case)
  if (outcome !== 'home_run') {
    // Don't double-count batter's run on HR
    for (const runner of atBat.scoringRunners) {
      if (runner.id === atBat.batter.id) {
        line.runs++;
      }
    }
  }
}

/**
 * Update pitching line from at-bat result
 *
 * Note: This function handles hits, walks, strikeouts etc.
 * Runs are now charged separately via updatePitchingLinesFromRuns to properly
 * handle inherited runners.
 */
function updatePitchingLine(line: BaseballPitchingLine, atBat: AtBatResult): void {
  const outcome = atBat.outcome;

  switch (outcome) {
    case 'single':
    case 'double':
    case 'triple':
      line.hits++;
      break;
    case 'home_run':
      line.hits++;
      line.homeRuns++;
      break;
    case 'walk':
      line.walks++;
      break;
    case 'intentional_walk':
      line.walks++;
      line.intentionalWalks++;
      break;
    case 'strikeout':
      line.strikeouts++;
      break;
  }

  // Runs are charged via updatePitchingLinesFromRuns to handle inherited runners
}

/**
 * Update pitching lines from runs charged in an at-bat
 *
 * This handles inherited runners: if a reliever inherits a runner who scores,
 * the run is charged to the pitcher who originally allowed that runner.
 */
function updatePitchingLinesFromRuns(
  pitchingLines: Record<string, BaseballPitchingLine>,
  atBat: AtBatResult
): void {
  // Charge runs to responsible pitchers (handles inherited runners)
  for (const [pitcherId, runs] of Object.entries(atBat.runsChargedByPitcher)) {
    const pitcherLine = pitchingLines[pitcherId];
    if (pitcherLine) {
      pitcherLine.runs += runs;
    }
  }

  // Charge earned runs to responsible pitchers
  for (const [pitcherId, earnedRuns] of Object.entries(atBat.earnedRunsChargedByPitcher)) {
    const pitcherLine = pitchingLines[pitcherId];
    if (pitcherLine) {
      pitcherLine.earnedRuns += earnedRuns;
    }
  }
}

/**
 * Process a half-inning event (steals, WP, PB, IBB)
 */
function processEvent(
  event: HalfInningEvent,
  battingLines: Record<string, BaseballBattingLine>,
  pitchingLines: Record<string, BaseballPitchingLine>,
  catchingLines: Record<string, BaseballCatcherLine>,
  _isHome: boolean,
  teamStats: {
    addStolenBase: () => void;
    addCaughtStealing: () => void;
    addWildPitch: () => void;
    addPassedBall: () => void;
  }
): void {
  switch (event.type) {
    case 'stolen_base': {
      // Update runner's batting line
      const runnerId = event.runner.id;
      const batterLine = battingLines[runnerId];
      if (batterLine) {
        batterLine.stolenBases++;
      }
      teamStats.addStolenBase();
      break;
    }

    case 'caught_stealing': {
      // Update runner's batting line
      const runnerId = event.runner.id;
      const batterLine = battingLines[runnerId];
      if (batterLine) {
        batterLine.caughtStealing++;
      }
      // Update catcher's stats
      const catcherId = event.catcher.id;
      const catcherLine = ensureCatcherLine(catchingLines, catcherId);
      catcherLine.runnersCaughtStealing++;
      teamStats.addCaughtStealing();
      break;
    }

    case 'wild_pitch': {
      // Update pitcher's stats
      const pitcherId = event.pitcher.id;
      const pitcherLine = pitchingLines[pitcherId];
      if (pitcherLine) {
        pitcherLine.wildPitches++;
      }
      // Add runs to scoring runners' batting lines
      for (const adv of event.advancements) {
        if (adv.to === 4) { // Runner scored
          const runnerLine = battingLines[adv.runner.id];
          if (runnerLine) {
            runnerLine.runs++;
          }
        }
      }
      teamStats.addWildPitch();
      break;
    }

    case 'passed_ball': {
      // Update catcher's stats
      const catcherId = event.catcher.id;
      const catcherLine = ensureCatcherLine(catchingLines, catcherId);
      catcherLine.passedBalls++;
      // Add runs to scoring runners' batting lines
      for (const adv of event.advancements) {
        if (adv.to === 4) { // Runner scored
          const runnerLine = battingLines[adv.runner.id];
          if (runnerLine) {
            runnerLine.runs++;
          }
        }
      }
      teamStats.addPassedBall();
      break;
    }

    case 'intentional_walk': {
      // IBB is handled in updatePitchingLine via at_bat event
      // This event is just for play-by-play tracking
      break;
    }

    case 'at_bat': {
      // At-bats are handled separately via updateBattingLine/updatePitchingLine
      break;
    }
  }
}

/**
 * Get outs recorded by each pitcher in a half-inning
 *
 * This includes:
 * - Outs from at-bats (strikeouts, groundouts, etc.)
 * - Outs from caught stealing events (credited to the pitcher who was pitching)
 */
function getOutsByPitcher(halfInning: HalfInningResult): Record<string, number> {
  const outsByPitcher: Record<string, number> = {};

  // Track the current pitcher as we process events in order
  // Start with the first at-bat's pitcher (or use events to track pitcher changes)
  let currentPitcherId: string | null = null;

  // Process all events in order to track pitcher changes and caught stealing
  for (const event of halfInning.events) {
    if (event.type === 'at_bat') {
      const atBat = event.result;
      currentPitcherId = atBat.pitcher.id;
      outsByPitcher[currentPitcherId] = (outsByPitcher[currentPitcherId] ?? 0) + atBat.outsRecorded;
    } else if (event.type === 'pitcher_change') {
      currentPitcherId = event.newPitcher.id;
    } else if (event.type === 'caught_stealing') {
      // Caught stealing is an out - credit it to the current pitcher
      if (currentPitcherId) {
        outsByPitcher[currentPitcherId] = (outsByPitcher[currentPitcherId] ?? 0) + 1;
      } else {
        // If no at-bat has occurred yet, get pitcher from the first at-bat (if any)
        const firstAtBat = halfInning.atBats[0];
        if (firstAtBat) {
          outsByPitcher[firstAtBat.pitcher.id] = (outsByPitcher[firstAtBat.pitcher.id] ?? 0) + 1;
        }
      }
    }
  }

  return outsByPitcher;
}

/**
 * Assign W/L/S decisions to pitchers
 *
 * Simple implementation:
 * - Win: Pitcher of record when team takes lead for good
 * - Loss: Opposing pitcher at that time
 * - Save: Closer who finishes with 3-run lead or less (and wasn't winning pitcher)
 */
function assignPitcherDecisions(
  homePitching: Record<string, BaseballPitchingLine>,
  awayPitching: Record<string, BaseballPitchingLine>,
  homeRuns: number,
  awayRuns: number
): void {
  // Get all pitchers sorted by innings (approximation for who pitched when)
  const homePitchers = Object.entries(homePitching)
    .sort((a, b) => b[1].inningsPitched - a[1].inningsPitched);
  const awayPitchers = Object.entries(awayPitching)
    .sort((a, b) => b[1].inningsPitched - a[1].inningsPitched);

  if (homeRuns === awayRuns) {
    // Tie - no decisions
    return;
  }

  const homeWon = homeRuns > awayRuns;

  // Winning pitcher: starter or reliever with most innings on winning team
  // (simplified - in reality it's pitcher of record when lead was taken)
  const winningPitchers = homeWon ? homePitchers : awayPitchers;
  const losingPitchers = homeWon ? awayPitchers : homePitchers;

  // Give win to pitcher with most innings (usually starter)
  if (winningPitchers.length > 0 && winningPitchers[0]) {
    const [, winnerLine] = winningPitchers[0];
    if (winnerLine) {
      winnerLine.decision = 'W';
    }
  }

  // Give loss to pitcher with most innings on losing team
  if (losingPitchers.length > 0 && losingPitchers[0]) {
    const [, loserLine] = losingPitchers[0];
    if (loserLine) {
      loserLine.decision = 'L';
    }
  }

  // Check for save situation
  const runDiff = Math.abs(homeRuns - awayRuns);
  if (runDiff <= 3 && winningPitchers.length > 1) {
    // Last pitcher might get save if they finished and weren't winning pitcher
    const lastPitcher = winningPitchers[winningPitchers.length - 1];
    if (lastPitcher) {
      const [, lastLine] = lastPitcher;
      if (lastLine && lastLine.decision !== 'W' && lastLine.inningsPitched >= 1) {
        lastLine.decision = 'S';
      }
    }
  }
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format box score for display
 */
export function formatBoxScore(boxScore: BaseballBoxScore): string[] {
  const lines: string[] = [];

  // Line score header
  lines.push('');
  lines.push('LINESCORE');
  lines.push('─'.repeat(60));

  // Inning headers
  const maxInnings = Math.max(boxScore.homeRunsByInning.length, boxScore.awayRunsByInning.length);
  let inningHeader = '     ';
  for (let i = 1; i <= maxInnings; i++) {
    inningHeader += ` ${i.toString().padStart(2)}`;
  }
  inningHeader += '   R  H  E';
  lines.push(inningHeader);

  // Away line
  let awayLine = 'AWAY ';
  for (const runs of boxScore.awayRunsByInning) {
    awayLine += ` ${runs.toString().padStart(2)}`;
  }
  awayLine += `  ${boxScore.awayRuns.toString().padStart(2)} ${boxScore.awayHits.toString().padStart(2)} ${boxScore.awayErrors.toString().padStart(2)}`;
  lines.push(awayLine);

  // Home line
  let homeLine = 'HOME ';
  for (const runs of boxScore.homeRunsByInning) {
    homeLine += ` ${runs.toString().padStart(2)}`;
  }
  // Home might not bat in 9th if ahead
  while (homeLine.length < awayLine.length - 10) {
    homeLine += '  X';
  }
  homeLine += `  ${boxScore.homeRuns.toString().padStart(2)} ${boxScore.homeHits.toString().padStart(2)} ${boxScore.homeErrors.toString().padStart(2)}`;
  lines.push(homeLine);

  lines.push('');

  return lines;
}

/**
 * Format batting stats for display
 */
export function formatBattingStats(
  batting: Record<string, BaseballBattingLine>,
  lineup: { id: string; name: string }[]
): string[] {
  const lines: string[] = [];

  lines.push('BATTING');
  lines.push('─'.repeat(60));
  lines.push('Player               AB   R   H  2B  3B  HR RBI  BB  SO');
  lines.push('─'.repeat(60));

  for (const player of lineup) {
    const stats = batting[player.id];
    if (!stats) continue;

    const name = player.name.substring(0, 18).padEnd(18);
    const line = `${name}  ${stats.atBats.toString().padStart(2)}  ${stats.runs.toString().padStart(2)}  ${stats.hits.toString().padStart(2)}  ${stats.doubles.toString().padStart(2)}  ${stats.triples.toString().padStart(2)}  ${stats.homeRuns.toString().padStart(2)}  ${stats.rbi.toString().padStart(2)}  ${stats.walks.toString().padStart(2)}  ${stats.strikeouts.toString().padStart(2)}`;
    lines.push(line);
  }

  lines.push('');

  return lines;
}

/**
 * Format pitching stats for display
 */
export function formatPitchingStats(
  pitching: Record<string, BaseballPitchingLine>,
  pitchers: { id: string; name: string }[]
): string[] {
  const lines: string[] = [];

  lines.push('PITCHING');
  lines.push('─'.repeat(60));
  lines.push('Player               IP   H   R  ER  BB  SO  HR   PC  DEC');
  lines.push('─'.repeat(60));

  for (const pitcher of pitchers) {
    const stats = pitching[pitcher.id];
    if (!stats) continue;

    const name = pitcher.name.substring(0, 18).padEnd(18);
    const ip = formatInningsPitched(stats.inningsPitched);
    const dec = stats.decision ?? '-';
    const line = `${name}  ${ip}  ${stats.hits.toString().padStart(2)}  ${stats.runs.toString().padStart(2)}  ${stats.earnedRuns.toString().padStart(2)}  ${stats.walks.toString().padStart(2)}  ${stats.strikeouts.toString().padStart(2)}  ${stats.homeRuns.toString().padStart(2)}  ${stats.pitchCount.toString().padStart(3)}   ${dec}`;
    lines.push(line);
  }

  lines.push('');

  return lines;
}

/**
 * Format innings pitched (e.g., 6.2 for 6 and 2/3)
 */
function formatInningsPitched(ip: number): string {
  const whole = Math.floor(ip);
  const partial = ip - whole;

  if (partial < 0.1) {
    return `${whole}.0`;
  } else if (partial < 0.4) {
    return `${whole}.1`;
  } else if (partial < 0.7) {
    return `${whole}.2`;
  } else {
    return `${whole + 1}.0`;
  }
}
