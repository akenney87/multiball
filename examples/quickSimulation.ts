/**
 * Quick Simulation Example
 *
 * Demonstrates how to simulate a mini-season with AI teams.
 * Run with: npx ts-node examples/quickSimulation.ts
 */

import {
  generateSeasonSchedule,
  createInitialStandings,
  processMatchResult,
  updateStandings,
  GameEventEmitter,
} from '../src/season';
import { createAIConfig } from '../src/ai/personality';
import { selectStartingLineup, choosePaceStrategy } from '../src/ai/tactical';
import type { Season, MatchResult } from '../src/data/types';
import type { DecisionContext } from '../src/ai/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const NUM_TEAMS = 6; // Small league for demo
const WEEKS_TO_SIMULATE = 5;
const SEED = 12345; // For reproducibility

// =============================================================================
// SETUP
// =============================================================================

function createTeamIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

function createMockSeason(teamIds: string[]): Season {
  const schedule = generateSeasonSchedule(teamIds, 'demo-season', { seed: SEED });
  return {
    id: 'demo-season',
    seasonNumber: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'regular_season',
    currentWeek: 1,
    matches: schedule.matches,
    standings: createInitialStandings(teamIds),
    transferWindowOpen: false,
  };
}

function createDecisionContext(week: number): DecisionContext {
  return {
    week,
    transferWindowOpen: false,
    finance: { available: 5000000, total: 20000000 },
  };
}

// Assign AI personalities to teams
function assignTeamPersonalities(
  teamIds: string[]
): Record<string, 'conservative' | 'balanced' | 'aggressive'> {
  const personalities: Array<'conservative' | 'balanced' | 'aggressive'> = [
    'aggressive',
    'balanced',
    'conservative',
  ];
  const assignments: Record<string, 'conservative' | 'balanced' | 'aggressive'> = {};
  teamIds.forEach((id, i) => {
    assignments[id] = personalities[i % 3];
  });
  return assignments;
}

// =============================================================================
// SIMULATION
// =============================================================================

/**
 * Simulate a single match (simplified - random result for demo)
 */
function simulateMatch(
  homeTeamId: string,
  awayTeamId: string,
  sport: string
): { homeScore: number; awayScore: number; winner: string } {
  // For basketball, scores typically 80-120
  // For baseball, scores typically 0-15
  // For soccer, scores typically 0-5
  let homeScore: number;
  let awayScore: number;

  if (sport === 'basketball') {
    homeScore = Math.floor(Math.random() * 40) + 85;
    awayScore = Math.floor(Math.random() * 40) + 85;
  } else if (sport === 'baseball') {
    homeScore = Math.floor(Math.random() * 12);
    awayScore = Math.floor(Math.random() * 12);
  } else {
    // soccer
    homeScore = Math.floor(Math.random() * 5);
    awayScore = Math.floor(Math.random() * 5);
  }

  // Ensure no ties (for simplicity)
  if (homeScore === awayScore) {
    homeScore += 1;
  }

  return {
    homeScore,
    awayScore,
    winner: homeScore > awayScore ? homeTeamId : awayTeamId,
  };
}

/**
 * Main simulation
 */
async function runSimulation() {
  console.log('='.repeat(60));
  console.log('MULTIBALL - Quick Simulation Demo');
  console.log('='.repeat(60));

  // Setup
  const teamIds = createTeamIds(NUM_TEAMS);
  const personalities = assignTeamPersonalities(teamIds);
  let season = createMockSeason(teamIds);
  const emitter = new GameEventEmitter();

  // Track events
  const events: string[] = [];
  emitter.onAll((e) => events.push(e.type));

  console.log(`\nTeams: ${teamIds.join(', ')}`);
  console.log(`Personalities: ${JSON.stringify(personalities, null, 2)}`);
  console.log(`Total Matches: ${season.matches.length}`);
  console.log(`Simulating ${WEEKS_TO_SIMULATE} weeks...\n`);

  // Simulate week by week
  for (let week = 1; week <= WEEKS_TO_SIMULATE; week++) {
    console.log(`--- Week ${week} ---`);

    const weekMatches = season.matches.filter(
      (m) => m.week === week && m.status === 'scheduled'
    );

    if (weekMatches.length === 0) {
      console.log('No matches this week.');
      continue;
    }

    for (const match of weekMatches) {
      // Simulate the match
      const { homeScore, awayScore, winner } = simulateMatch(
        match.homeTeamId,
        match.awayTeamId,
        match.sport
      );

      // Create result
      const result: MatchResult = {
        matchId: match.id,
        homeScore,
        awayScore,
        winner,
        boxScore: {},
        playByPlay: [`${match.sport} match completed`],
      };

      // Update season
      season = processMatchResult(season, match.id, result);

      console.log(
        `  ${match.sport.padEnd(10)} | ${match.homeTeamId} ${homeScore} - ${awayScore} ${match.awayTeamId} | Winner: ${winner}`
      );
    }
  }

  // Final standings
  console.log('\n' + '='.repeat(60));
  console.log('FINAL STANDINGS');
  console.log('='.repeat(60));

  const sortedStandings = Object.values(season.standings).sort(
    (a, b) => b.points - a.points || b.wins - a.wins
  );

  console.log('Rank | Team     | W  | L  | Pts');
  console.log('-'.repeat(35));
  sortedStandings.forEach((standing, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${standing.teamId.padEnd(8)} | ${standing.wins
        .toString()
        .padStart(2)} | ${standing.losses.toString().padStart(2)} | ${standing.points
        .toString()
        .padStart(3)}`
    );
  });

  // Promotion/Relegation
  console.log('\n' + '='.repeat(60));
  console.log('PROMOTION & RELEGATION');
  console.log('='.repeat(60));

  const promoted = sortedStandings.slice(0, 3).map((s) => s.teamId);
  const relegated = sortedStandings.slice(-3).map((s) => s.teamId);

  console.log(`Promoted: ${promoted.join(', ')}`);
  console.log(`Relegated: ${relegated.join(', ')}`);

  console.log('\nSimulation complete!');
}

// Run
runSimulation().catch(console.error);
