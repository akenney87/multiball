/**
 * Tests for play-by-play system
 *
 * @module simulation/__tests__/playByPlay/playByPlay.test
 */

import { PlayByPlayLogger, QuarterStatistics, formatPercentage, formatQuarterOrdinal } from '../../playByPlay/playByPlay';
import type { Player } from '../../../data/types';
import type { PossessionEvent } from '../../playByPlay/playByPlay';

function createTestPlayer(name: string, position: string = 'PG'): Player {
  return {
    id: `player-${name}`,
    name,
    position,
    stamina: 100,
    grip_strength: 70,
    arm_strength: 70,
    core_strength: 70,
    agility: 70,
    acceleration: 70,
    top_speed: 70,
    jumping: 70,
    reactions: 70,
    balance: 70,
    height: 70,
    durability: 70,
    awareness: 70,
    creativity: 70,
    determination: 70,
    bravery: 70,
    consistency: 70,
    composure: 70,
    patience: 70,
    hand_eye_coordination: 70,
    throw_accuracy: 70,
    form_technique: 70,
    finesse: 70,
    deception: 70,
    teamwork: 70,
  };
}

describe('Helper Functions', () => {
  test('should format percentage correctly', () => {
    expect(formatPercentage(10, 20)).toBe('10/20 (50.0%)');
    expect(formatPercentage(0, 10)).toBe('0/10 (0.0%)');
    expect(formatPercentage(0, 0)).toBe('0/0 (0.0%)');
  });

  test('should format quarter ordinals', () => {
    expect(formatQuarterOrdinal(1)).toBe('1ST');
    expect(formatQuarterOrdinal(2)).toBe('2ND');
    expect(formatQuarterOrdinal(3)).toBe('3RD');
    expect(formatQuarterOrdinal(4)).toBe('4TH');
  });
});

describe('QuarterStatistics', () => {
  test('should initialize with empty stats', () => {
    const stats = new QuarterStatistics('Lakers', 'Celtics');
    const summary = stats.getTeamSummary('Home');

    expect(summary).toContain('FG: 0/0');
    expect(summary).toContain('3PT: 0/0');
  });

  test('should track made shots', () => {
    const stats = new QuarterStatistics('Lakers', 'Celtics');

    const event: PossessionEvent = {
      gameClock: 600,
      offenseTeam: 'Home',
      scoreBefore: [0, 0],
      playByPlayText: 'Player1 makes a 2-pointer',
      pointsScored: 2,
      outcome: 'made_shot',
      scoringPlayer: 'Player1',
      shooter: 'Player1',
      shotType: 'midrange',
      isOffensiveRebound: false,
      isAndOne: false,
    };

    stats.addPossessionResult('Home', event);

    const summary = stats.getTeamSummary('Home');
    expect(summary).toContain('FG: 1/1');
  });

  test('should track 3-pointers separately', () => {
    const stats = new QuarterStatistics('Lakers', 'Celtics');

    const event: PossessionEvent = {
      gameClock: 600,
      offenseTeam: 'Home',
      scoreBefore: [0, 0],
      playByPlayText: 'Player1 makes a 3-pointer',
      pointsScored: 3,
      outcome: 'made_shot',
      scoringPlayer: 'Player1',
      shooter: 'Player1',
      shotType: '3pt',
      isOffensiveRebound: false,
      isAndOne: false,
    };

    stats.addPossessionResult('Home', event);

    const summary = stats.getTeamSummary('Home');
    expect(summary).toContain('3PT: 1/1');
  });

  test('should track turnovers', () => {
    const stats = new QuarterStatistics('Lakers', 'Celtics');

    const event: PossessionEvent = {
      gameClock: 600,
      offenseTeam: 'Home',
      scoreBefore: [0, 0],
      playByPlayText: 'Turnover',
      pointsScored: 0,
      outcome: 'turnover',
      isOffensiveRebound: false,
      isAndOne: false,
    };

    stats.addPossessionResult('Home', event);

    const summary = stats.getTeamSummary('Home');
    expect(summary).toContain('TO: 1');
  });

  test('should get leading scorer', () => {
    const stats = new QuarterStatistics('Lakers', 'Celtics');
    const homeRoster = [createTestPlayer('Player1'), createTestPlayer('Player2')];
    const awayRoster = [createTestPlayer('Player3'), createTestPlayer('Player4')];
    stats.initializePlayerTeamMapping(homeRoster, awayRoster);

    // Player1 scores
    const event: PossessionEvent = {
      gameClock: 600,
      offenseTeam: 'Home',
      scoreBefore: [0, 0],
      playByPlayText: 'Player1 scores',
      pointsScored: 10,
      outcome: 'made_shot',
      scoringPlayer: 'Player1',
      shooter: 'Player1',
      shotType: 'midrange',
      isOffensiveRebound: false,
      isAndOne: false,
    };

    stats.addPossessionResult('Home', event);

    const [leader, points] = stats.getLeadingScorer('Home');
    expect(leader).toBe('Player1');
    expect(points).toBe(10);
  });
});

describe('PlayByPlayLogger', () => {
  test('should initialize correctly', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 1);
    expect(logger).toBeDefined();
  });

  test('should add possession events', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 1);

    const possessionResult = {
      play_by_play_text: 'Player1 makes a shot',
      points_scored: 2,
      possession_outcome: 'made_shot',
      scoring_player: 'Player1',
      debug: {
        shooter: 'Player1',
        shot_type: 'midrange',
      },
    };

    logger.addPossession(600, 'Home', possessionResult);

    // Should not throw
    expect(() => logger.renderToText()).not.toThrow();
  });

  test('should add substitution events', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 1);

    logger.addSubstitution(540, 'Home', 'Player1', 'Player2', 'stamina', 65);

    // Should not throw
    expect(() => logger.renderToText()).not.toThrow();
  });

  test('should add timeout events', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 1);

    logger.addTimeout(480, 'Home', 'momentum', 6);

    // Should not throw
    expect(() => logger.renderToText()).not.toThrow();
  });

  test('should render complete quarter narrative', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 1);

    // Add a possession
    const possessionResult = {
      play_by_play_text: 'Player1 makes a shot',
      points_scored: 2,
      possession_outcome: 'made_shot',
      scoring_player: 'Player1',
      debug: {
        shooter: 'Player1',
        shot_type: 'midrange',
      },
    };
    logger.addPossession(600, 'Home', possessionResult);

    const text = logger.renderToText();
    expect(text).toContain('1ST QUARTER');
    expect(text).toContain('Lakers');
    expect(text).toContain('Celtics');
    expect(text).toContain('Player1');
  });

  test('should track cumulative score across quarters', () => {
    const logger = new PlayByPlayLogger('Lakers', 'Celtics', 2, {}, 25, 23);

    const possessionResult = {
      play_by_play_text: 'Player1 makes a shot',
      points_scored: 2,
      possession_outcome: 'made_shot',
      scoring_player: 'Player1',
      debug: {
        shooter: 'Player1',
        shot_type: 'midrange',
      },
    };
    logger.addPossession(600, 'Home', possessionResult);

    const text = logger.renderToText();
    // Score should show cumulative total (25 + 2 = 27)
    expect(text).toContain('27'); // Home score includes previous quarter
  });
});
