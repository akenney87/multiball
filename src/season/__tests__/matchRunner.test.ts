/**
 * Match Runner Integration Tests
 *
 * Tests for executing matches within the season flow:
 * - Creating decision context from season
 * - Running matches with AI tactical settings
 * - Converting game results to match results
 */

import type { Player, PlayerAttributes, PlayerPotentials, Season, TacticalSettings } from '../../data/types';
import type { DecisionContext, AIConfig, Position } from '../../ai/types';
import { createAIConfig } from '../../ai/personality';
import { selectStartingLineup, choosePaceStrategy, setDefenseStrategy, allocateMinutes } from '../../ai/tactical';
import { createNewSeason } from '../seasonManager';
import { processMatchResult, getWeekMatches } from '../weekProcessor';
import {
  createDecisionContext,
  createTacticalSettings,
  convertGameResultToMatchResult,
  executeMatch,
} from '../matchRunner';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTeamIds(count: number = 20): string[] {
  return Array.from({ length: count }, (_, i) => `team-${i + 1}`);
}

function createMockPlayer(id: string, position: Position): Player {
  const baseAttributes: PlayerAttributes = {
    grip_strength: 70, arm_strength: 68, core_strength: 72, agility: 70,
    acceleration: 74, top_speed: 68, jumping: 72, reactions: 75,
    stamina: 70, balance: 68, height: 65, durability: 70,
    awareness: 75, creativity: 68, determination: 72, bravery: 70,
    consistency: 70, composure: 73, patience: 68,
    hand_eye_coordination: 72, throw_accuracy: 70, form_technique: 71,
    finesse: 68, deception: 65, teamwork: 70,
  };

  const basePotentials: PlayerPotentials = { physical: 75, mental: 77, technical: 76 };

  return {
    id,
    firstName: `Player`,
    lastName: id,
    age: 25,
    position,
    nationality: 'USA',
    attributes: baseAttributes,
    potentials: basePotentials,
    contract: { salary: 2000000, yearsRemaining: 2 },
  };
}

function createMockRoster(): Player[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const roster: Player[] = [];

  // 2 players per position
  positions.forEach((pos) => {
    roster.push(createMockPlayer(`starter-${pos}`, pos));
    roster.push(createMockPlayer(`backup-${pos}`, pos));
  });

  return roster;
}

// =============================================================================
// DECISION CONTEXT TESTS
// =============================================================================

describe('createDecisionContext', () => {
  it('creates context from season and team', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1, { seed: 12345 });
    const teamId = 'team-1';
    const budget = { available: 5000000, total: 20000000 };

    const context = createDecisionContext(season, teamId, budget);

    expect(context.week).toBe(season.currentWeek);
    expect(context.transferWindowOpen).toBe(season.transferWindowOpen);
    expect(context.finance.available).toBe(budget.available);
    expect(context.finance.total).toBe(budget.total);
  });

  it('includes standings information', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1, { seed: 12345 });
    const teamId = 'team-1';
    const budget = { available: 5000000, total: 20000000 };

    const context = createDecisionContext(season, teamId, budget);

    expect(context.standings).toBeDefined();
    expect(context.standings?.position).toBe(season.standings[teamId].rank);
  });

  it('maps season phase correctly', () => {
    const teamIds = createTeamIds(20);
    const season = createNewSeason(teamIds, 1, { seed: 12345 });
    const teamId = 'team-1';
    const budget = { available: 5000000, total: 20000000 };

    const context = createDecisionContext(season, teamId, budget);

    expect(context.seasonPhase).toBe('pre_season');
  });
});

// =============================================================================
// TACTICAL SETTINGS TESTS
// =============================================================================

describe('createTacticalSettings', () => {
  it('creates tactical settings from AI decisions', () => {
    const roster = createMockRoster();
    const config = createAIConfig('balanced');
    const context: DecisionContext = {
      week: 1,
      transferWindowOpen: false,
      finance: { available: 5000000, total: 20000000 },
    };

    const settings = createTacticalSettings(roster, context, config);

    expect(settings).toBeDefined();
    expect(settings.pace).toBeDefined();
    expect(settings.defense).toBeDefined();
  });

  it('respects AI personality', () => {
    const roster = createMockRoster();
    const context: DecisionContext = {
      week: 1,
      transferWindowOpen: false,
      finance: { available: 5000000, total: 20000000 },
    };

    const aggressiveSettings = createTacticalSettings(roster, context, createAIConfig('aggressive'));
    const conservativeSettings = createTacticalSettings(roster, context, createAIConfig('conservative'));

    // Aggressive uses press, conservative uses zone
    expect(aggressiveSettings.defense).toBe('press');
    expect(conservativeSettings.defense).toBe('zone');
  });
});

// =============================================================================
// GAME RESULT CONVERSION TESTS
// =============================================================================

describe('convertGameResultToMatchResult', () => {
  it('converts game result to match result format', () => {
    const matchId = 'match-1';
    const homeTeamId = 'team-1';
    const awayTeamId = 'team-2';
    const gameResult = {
      homeScore: 105,
      awayScore: 98,
      quarterScores: [[25, 22], [28, 25], [27, 26], [25, 25]] as [number, number][],
      playByPlayText: 'Q1: Shot made...\nQ2: Rebound...',
      gameStatistics: { totalPoints: 203 },
      quarterResults: [],
      finalStamina: {},
      minutesPlayed: {},
    };

    const result = convertGameResultToMatchResult(matchId, homeTeamId, awayTeamId, gameResult);

    expect(result.matchId).toBe(matchId);
    expect(result.homeScore).toBe(105);
    expect(result.awayScore).toBe(98);
    expect(result.winner).toBe(homeTeamId);
  });

  it('correctly identifies away team as winner', () => {
    const gameResult = {
      homeScore: 90,
      awayScore: 105,
      quarterScores: [] as [number, number][],
      playByPlayText: '',
      gameStatistics: {},
      quarterResults: [],
      finalStamina: {},
      minutesPlayed: {},
    };

    const result = convertGameResultToMatchResult('match-1', 'home', 'away', gameResult);

    expect(result.winner).toBe('away');
  });

  it('converts play-by-play text to array', () => {
    const gameResult = {
      homeScore: 100,
      awayScore: 100,
      quarterScores: [] as [number, number][],
      playByPlayText: 'Line 1\nLine 2\nLine 3',
      gameStatistics: {},
      quarterResults: [],
      finalStamina: {},
      minutesPlayed: {},
    };

    const result = convertGameResultToMatchResult('match-1', 'home', 'away', gameResult);

    expect(result.playByPlay).toHaveLength(3);
    expect(result.playByPlay[0]).toBe('Line 1');
  });
});

// =============================================================================
// MATCH EXECUTION TESTS (INTEGRATION)
// =============================================================================

describe('executeMatch', () => {
  // Note: Full game simulation integration tests require properly configured
  // rosters with all required properties. These are tested separately in
  // the fullGameDemo tests. Here we test the wrapper functions.

  it('throws error for non-existent match', () => {
    const teamIds = createTeamIds(4);
    const season = createNewSeason(teamIds, 1, { seed: 12345 });
    const homeRoster = createMockRoster();
    const awayRoster = createMockRoster();
    const homeConfig = createAIConfig('balanced');
    const awayConfig = createAIConfig('balanced');

    expect(() =>
      executeMatch(
        season,
        'non-existent-match',
        homeRoster,
        awayRoster,
        homeConfig,
        awayConfig
      )
    ).toThrow('Match not found');
  });

  it('throws error for already completed match', () => {
    const teamIds = createTeamIds(4);
    let season = createNewSeason(teamIds, 1, { seed: 12345 });

    // Get first match and mark it completed
    const matches = getWeekMatches(season, 1);
    if (matches.length === 0) return;

    const match = matches[0];

    // Manually complete the match
    const mockResult = {
      matchId: match.id,
      homeScore: 100,
      awayScore: 90,
      winner: match.homeTeamId,
      boxScore: {},
      playByPlay: [],
    };
    season = processMatchResult(season, match.id, mockResult);

    const homeRoster = createMockRoster();
    const awayRoster = createMockRoster();
    const homeConfig = createAIConfig('balanced');
    const awayConfig = createAIConfig('balanced');

    expect(() =>
      executeMatch(
        season,
        match.id,
        homeRoster,
        awayRoster,
        homeConfig,
        awayConfig
      )
    ).toThrow('not scheduled');
  });
});
