/**
 * Baseball Simulation Integration Tests
 *
 * Tests that validate attribute-driven simulation outcomes.
 * Verifies that better attributes lead to better performance.
 *
 * @module simulation/baseball/__tests__/baseballSimulation.test
 */

import type { Player, PlayerAttributes } from '../../../data/types';
import {
  calculateContactComposite,
  calculatePowerComposite,
  calculateDisciplineComposite,
  determineAtBatOutcome,
  determineHitType,
  hasPlatoonAdvantage,
  getPlayerHandedness,
} from '../systems/batting';
import {
  calculateVelocityComposite,
  calculateControlComposite,
  calculateMovementComposite,
  getFatiguedComposites,
  determinePitcherType,
} from '../systems/pitching';
import {
  calculateFieldingComposite,
  calculateRangeComposite,
  checkForError,
} from '../systems/fielding';
import {
  calculateStealingComposite,
  calculateSpeedComposite,
  attemptStolenBase,
} from '../systems/baserunning';
import { simulateAtBat } from '../systems/atBat';
import { simulateHalfInning } from '../game/halfInning';
import { simulateGame, createTeamGameState } from '../game/gameSimulation';
import { setSeed, resetRandom } from '../../core/probability';
import type { FieldingPosition } from '../systems/fielding';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a test player with specified attribute level
 */
function createTestPlayer(
  id: string,
  name: string,
  attributeLevel: number,
  overrides: Partial<PlayerAttributes> = {}
): Player {
  const baseAttributes: PlayerAttributes = {
    // Physical (12)
    height: attributeLevel,
    weight: attributeLevel,
    top_speed: attributeLevel,
    acceleration: attributeLevel,
    agility: attributeLevel,
    balance: attributeLevel,
    jumping: attributeLevel,
    stamina: attributeLevel,
    durability: attributeLevel,
    core_strength: attributeLevel,
    arm_strength: attributeLevel,
    grip_strength: attributeLevel,
    reactions: attributeLevel,

    // Mental (8)
    awareness: attributeLevel,
    creativity: attributeLevel,
    determination: attributeLevel,
    bravery: attributeLevel,
    consistency: attributeLevel,
    composure: attributeLevel,
    patience: attributeLevel,
    teamwork: attributeLevel,

    // Technical (6)
    hand_eye_coordination: attributeLevel,
    throw_accuracy: attributeLevel,
    form_technique: attributeLevel,
    finesse: attributeLevel,
    deception: attributeLevel,
    footwork: attributeLevel,
    ...overrides,
  };

  return {
    id,
    name,
    age: 25,
    dateOfBirth: new Date('1999-01-01'),
    position: 'P',
    height: 72,
    weight: 190,
    nationality: 'USA',
    attributes: baseAttributes,
    potential: attributeLevel + 10,
    overall: attributeLevel,
    contract: {
      salary: 1000000,
      yearsRemaining: 2,
      signingBonus: 0,
      teamOption: false,
      playerOption: false,
      noTradeClause: false,
    },
    teamId: 'test-team',
    acquisitionType: 'draft',
    acquisitionDate: new Date(),
    experience: 3,
    skillDevelopment: {},
    mood: 75,
    morale: 75,
  };
}

/**
 * Create a 9-player lineup with specified attribute level
 */
function createTestLineup(teamId: string, attributeLevel: number): Player[] {
  return Array.from({ length: 9 }, (_, i) =>
    createTestPlayer(
      `${teamId}-player-${i + 1}`,
      `${teamId} Player ${i + 1}`,
      attributeLevel
    )
  );
}

/**
 * Create defensive alignment
 */
function createDefense(lineup: Player[]): Record<FieldingPosition, Player> {
  const positions: FieldingPosition[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'];
  const defense: Partial<Record<FieldingPosition, Player>> = {};

  positions.forEach((pos, i) => {
    defense[pos] = lineup[i % lineup.length]!;
  });

  return defense as Record<FieldingPosition, Player>;
}

// =============================================================================
// COMPOSITE CALCULATION TESTS
// =============================================================================

describe('Baseball Composite Calculations', () => {
  describe('Batting Composites', () => {
    it('should calculate higher contact composite for better hand-eye coordination', () => {
      const goodContact = createTestPlayer('1', 'Good Contact', 50, {
        hand_eye_coordination: 90,
        reactions: 80,
      });
      const poorContact = createTestPlayer('2', 'Poor Contact', 50, {
        hand_eye_coordination: 30,
        reactions: 30,
      });

      expect(calculateContactComposite(goodContact)).toBeGreaterThan(
        calculateContactComposite(poorContact)
      );
    });

    it('should calculate higher power composite for stronger players', () => {
      const power = createTestPlayer('1', 'Power', 50, {
        core_strength: 95,
        arm_strength: 90,
        grip_strength: 85,
      });
      const weak = createTestPlayer('2', 'Weak', 50, {
        core_strength: 30,
        arm_strength: 30,
        grip_strength: 30,
      });

      expect(calculatePowerComposite(power)).toBeGreaterThan(
        calculatePowerComposite(weak)
      );
    });

    it('should calculate higher discipline composite for patient players', () => {
      const patient = createTestPlayer('1', 'Patient', 50, {
        patience: 95,
        awareness: 85,
        composure: 80,
      });
      const aggressive = createTestPlayer('2', 'Aggressive', 50, {
        patience: 25,
        awareness: 30,
        composure: 30,
      });

      expect(calculateDisciplineComposite(patient)).toBeGreaterThan(
        calculateDisciplineComposite(aggressive)
      );
    });
  });

  describe('Pitching Composites', () => {
    it('should calculate higher velocity composite for stronger arms', () => {
      const flamethrower = createTestPlayer('1', 'Flamethrower', 50, {
        arm_strength: 95,
        core_strength: 85,
        acceleration: 80,
      });
      const softTosser = createTestPlayer('2', 'Soft Tosser', 50, {
        arm_strength: 40,
        core_strength: 45,
        acceleration: 40,
      });

      expect(calculateVelocityComposite(flamethrower)).toBeGreaterThan(
        calculateVelocityComposite(softTosser)
      );
    });

    it('should calculate higher control composite for accurate throwers', () => {
      const pinpoint = createTestPlayer('1', 'Pinpoint', 50, {
        throw_accuracy: 95,
        composure: 85,
        consistency: 80,
      });
      const wild = createTestPlayer('2', 'Wild', 50, {
        throw_accuracy: 30,
        composure: 35,
        consistency: 30,
      });

      expect(calculateControlComposite(pinpoint)).toBeGreaterThan(
        calculateControlComposite(wild)
      );
    });

    it('should correctly identify pitcher types', () => {
      const power = createTestPlayer('1', 'Power', 50, {
        arm_strength: 95,
        core_strength: 90,
        throw_accuracy: 50,
        composure: 50,
      });
      const finesse = createTestPlayer('2', 'Finesse', 50, {
        arm_strength: 50,
        core_strength: 50,
        throw_accuracy: 95,
        composure: 90,
        consistency: 85,
      });

      expect(determinePitcherType(power)).toBe('power');
      expect(determinePitcherType(finesse)).toBe('finesse');
    });
  });

  describe('Fielding Composites', () => {
    it('should calculate higher shortstop composite for agile, accurate fielders', () => {
      const goldGlove = createTestPlayer('1', 'Gold Glove', 50, {
        reactions: 95,
        agility: 90,
        throw_accuracy: 85,
        arm_strength: 80,
      });
      const liability = createTestPlayer('2', 'Liability', 50, {
        reactions: 30,
        agility: 35,
        throw_accuracy: 40,
        arm_strength: 35,
      });

      expect(calculateFieldingComposite(goldGlove, 'SS')).toBeGreaterThan(
        calculateFieldingComposite(liability, 'SS')
      );
    });

    it('should calculate higher outfield composite for fast players with strong arms', () => {
      const elite = createTestPlayer('1', 'Elite OF', 50, {
        top_speed: 95,
        acceleration: 90,
        arm_strength: 85,
        awareness: 80,
      });
      const slow = createTestPlayer('2', 'Slow OF', 50, {
        top_speed: 35,
        acceleration: 40,
        arm_strength: 40,
        awareness: 45,
      });

      expect(calculateFieldingComposite(elite, 'CF')).toBeGreaterThan(
        calculateFieldingComposite(slow, 'CF')
      );
    });
  });

  describe('Baserunning Composites', () => {
    it('should calculate higher stealing composite for fast, aware players', () => {
      const speedster = createTestPlayer('1', 'Speedster', 50, {
        acceleration: 95,
        top_speed: 90,
        reactions: 85,
        awareness: 80,
        bravery: 75,
      });
      const slowpoke = createTestPlayer('2', 'Slowpoke', 50, {
        acceleration: 35,
        top_speed: 40,
        reactions: 45,
        awareness: 40,
        bravery: 40,
      });

      expect(calculateStealingComposite(speedster)).toBeGreaterThan(
        calculateStealingComposite(slowpoke)
      );
    });
  });
});

// =============================================================================
// HANDEDNESS AND PLATOON TESTS
// =============================================================================

describe('Handedness and Platoon Advantage', () => {
  it('should generate consistent handedness for the same player', () => {
    const player = createTestPlayer('consistent-id', 'Test', 50);

    const hand1 = getPlayerHandedness(player);
    const hand2 = getPlayerHandedness(player);

    expect(hand1).toEqual(hand2);
  });

  it('should generate different handedness for different players', () => {
    // With enough players, we should see variation
    const players = Array.from({ length: 100 }, (_, i) =>
      createTestPlayer(`player-${i}`, `Test ${i}`, 50)
    );

    const hands = players.map(p => getPlayerHandedness(p));
    const leftBats = hands.filter(h => h.bats === 'L').length;
    const rightBats = hands.filter(h => h.bats === 'R').length;

    // Should have some variety (not all the same)
    expect(leftBats).toBeGreaterThan(0);
    expect(rightBats).toBeGreaterThan(0);
  });

  it('should identify platoon advantage correctly', () => {
    const lhb = createTestPlayer('lhb', 'LHB', 50);
    const rhp = createTestPlayer('rhp', 'RHP', 50);

    // Mock handedness by setting sportMetadata
    lhb.sportMetadata = { baseball: { bats: 'L', throws: 'R' } };
    rhp.sportMetadata = { baseball: { bats: 'R', throws: 'R' } };

    expect(hasPlatoonAdvantage(lhb, rhp)).toBe(true);
  });

  it('should give switch hitters permanent platoon advantage', () => {
    const switch_hitter = createTestPlayer('sh', 'Switch', 50);
    const pitcher = createTestPlayer('pitcher', 'Pitcher', 50);

    switch_hitter.sportMetadata = { baseball: { bats: 'S', throws: 'R' } };
    pitcher.sportMetadata = { baseball: { bats: 'R', throws: 'R' } };

    expect(hasPlatoonAdvantage(switch_hitter, pitcher)).toBe(true);

    pitcher.sportMetadata = { baseball: { bats: 'R', throws: 'L' } };
    expect(hasPlatoonAdvantage(switch_hitter, pitcher)).toBe(true);
  });
});

// =============================================================================
// FATIGUE TESTS
// =============================================================================

describe('Pitcher Fatigue', () => {
  it('should not degrade pitcher below pitch count threshold', () => {
    const pitcher = createTestPlayer('pitcher', 'Fresh Pitcher', 70);

    const fresh = getFatiguedComposites(pitcher, 50);
    expect(fresh.fatigueState.degradation).toBe(0);
    expect(fresh.velocity).toBeCloseTo(calculateVelocityComposite(pitcher), 1);
  });

  it('should degrade pitcher above pitch count threshold', () => {
    const pitcher = createTestPlayer('pitcher', 'Tired Pitcher', 70);

    const tired = getFatiguedComposites(pitcher, 100);
    expect(tired.fatigueState.degradation).toBeGreaterThan(0);
    expect(tired.velocity).toBeLessThan(calculateVelocityComposite(pitcher));
  });

  it('should indicate substitution needed at high pitch counts', () => {
    const pitcher = createTestPlayer('pitcher', 'Gassed Pitcher', 70);

    const gassed = getFatiguedComposites(pitcher, 120);
    expect(gassed.fatigueState.needsSubstitution).toBe(true);
  });

  it('high stamina pitchers should have extended threshold', () => {
    const ironman = createTestPlayer('ironman', 'Ironman', 50, { stamina: 95 });
    const lowStamina = createTestPlayer('weak', 'Low Stamina', 50, { stamina: 30 });

    const ironmanAt90 = getFatiguedComposites(ironman, 90);
    const weakAt90 = getFatiguedComposites(lowStamina, 90);

    // Ironman should have less degradation due to higher stamina
    expect(ironmanAt90.fatigueState.degradation).toBeLessThan(
      weakAt90.fatigueState.degradation
    );
  });
});

// =============================================================================
// AT-BAT SIMULATION TESTS
// =============================================================================

describe('At-Bat Simulation', () => {
  beforeEach(() => {
    setSeed('test-seed-123');
  });

  afterEach(() => {
    resetRandom();
  });

  it('should produce valid at-bat outcomes', () => {
    const batter = createTestPlayer('batter', 'Batter', 70);
    const pitcher = createTestPlayer('pitcher', 'Pitcher', 70);
    const catcher = createTestPlayer('catcher', 'Catcher', 70);
    const lineup = createTestLineup('test', 70);
    const defense = createDefense(lineup);

    const result = simulateAtBat({
      batter,
      pitcher,
      catcher,
      defense,
      baseState: [null, null, null],
      pitchCount: 0,
      outs: 0,
      inning: 1,
      scoreDiff: 0,
    });

    // Should have valid outcome
    const validOutcomes = [
      'strikeout', 'walk', 'hit_by_pitch', 'single', 'double', 'triple',
      'home_run', 'groundout', 'flyout', 'lineout', 'popup', 'error',
      'fielders_choice', 'double_play',
    ];
    expect(validOutcomes).toContain(result.result.outcome);

    // Should have valid pitch count
    expect(result.pitchesThrown).toBeGreaterThanOrEqual(3);
    expect(result.pitchesThrown).toBeLessThanOrEqual(12);
  });

  it('elite batters should hit better than poor batters over many at-bats', () => {
    const eliteBatter = createTestPlayer('elite', 'Elite', 90);
    const poorBatter = createTestPlayer('poor', 'Poor', 30);
    const pitcher = createTestPlayer('pitcher', 'Average Pitcher', 50);
    const catcher = createTestPlayer('catcher', 'Catcher', 50);
    const lineup = createTestLineup('test', 50);
    const defense = createDefense(lineup);

    const atBats = 100;
    let eliteHits = 0;
    let poorHits = 0;

    for (let i = 0; i < atBats; i++) {
      setSeed(`elite-${i}`);
      const eliteResult = simulateAtBat({
        batter: eliteBatter,
        pitcher,
        catcher,
        defense,
        baseState: [null, null, null],
        pitchCount: 0,
        outs: 0,
        inning: 1,
        scoreDiff: 0,
      });

      if (['single', 'double', 'triple', 'home_run'].includes(eliteResult.result.outcome)) {
        eliteHits++;
      }

      setSeed(`poor-${i}`);
      const poorResult = simulateAtBat({
        batter: poorBatter,
        pitcher,
        catcher,
        defense,
        baseState: [null, null, null],
        pitchCount: 0,
        outs: 0,
        inning: 1,
        scoreDiff: 0,
      });

      if (['single', 'double', 'triple', 'home_run'].includes(poorResult.result.outcome)) {
        poorHits++;
      }
    }

    // Elite batter should have meaningfully more hits
    expect(eliteHits).toBeGreaterThan(poorHits);
  });
});

// =============================================================================
// HIT TYPE TESTS
// =============================================================================

describe('Hit Type Distribution', () => {
  beforeEach(() => {
    setSeed('hit-type-seed');
  });

  afterEach(() => {
    resetRandom();
  });

  it('power hitters should hit more home runs', () => {
    const powerHitter = createTestPlayer('power', 'Power', 50, {
      core_strength: 95,
      arm_strength: 90,
      grip_strength: 85,
    });
    const contactHitter = createTestPlayer('contact', 'Contact', 50, {
      core_strength: 50,
      arm_strength: 50,
      grip_strength: 50,
    });

    const hits = 200;
    let powerHRs = 0;
    let contactHRs = 0;

    for (let i = 0; i < hits; i++) {
      setSeed(`power-hit-${i}`);
      const powerResult = determineHitType(powerHitter);
      if (powerResult.hitType === 'home_run') powerHRs++;

      setSeed(`contact-hit-${i}`);
      const contactResult = determineHitType(contactHitter);
      if (contactResult.hitType === 'home_run') contactHRs++;
    }

    // Power hitter should have more HRs
    expect(powerHRs).toBeGreaterThan(contactHRs);
  });
});

// =============================================================================
// STOLEN BASE TESTS
// =============================================================================

describe('Stolen Base System', () => {
  beforeEach(() => {
    setSeed('steal-seed');
  });

  afterEach(() => {
    resetRandom();
  });

  it('fast runners should steal more successfully than slow runners', () => {
    const speedster = createTestPlayer('fast', 'Speedster', 50, {
      acceleration: 95,
      top_speed: 90,
      reactions: 85,
    });
    const slowpoke = createTestPlayer('slow', 'Slowpoke', 50, {
      acceleration: 30,
      top_speed: 35,
      reactions: 40,
    });
    const catcher = createTestPlayer('catcher', 'Catcher', 50);
    const pitcher = createTestPlayer('pitcher', 'Pitcher', 50);

    const attempts = 50;
    let fastSuccess = 0;
    let slowSuccess = 0;

    for (let i = 0; i < attempts; i++) {
      setSeed(`fast-steal-${i}`);
      const fastResult = attemptStolenBase(speedster, catcher, pitcher, 2);
      if (fastResult.success) fastSuccess++;

      setSeed(`slow-steal-${i}`);
      const slowResult = attemptStolenBase(slowpoke, catcher, pitcher, 2);
      if (slowResult.success) slowSuccess++;
    }

    expect(fastSuccess).toBeGreaterThan(slowSuccess);
  });
});

// =============================================================================
// HALF-INNING SIMULATION TESTS
// =============================================================================

describe('Half-Inning Simulation', () => {
  beforeEach(() => {
    setSeed('half-inning-seed');
  });

  afterEach(() => {
    resetRandom();
  });

  it('should simulate a complete half-inning', () => {
    const lineup = createTestLineup('batting', 70);
    const pitcher = createTestPlayer('pitcher', 'Pitcher', 70);
    const catcher = createTestPlayer('catcher', 'Catcher', 70);
    const fieldingLineup = createTestLineup('fielding', 70);
    const defense = createDefense(fieldingLineup);
    defense['P'] = pitcher;

    const result = simulateHalfInning({
      inning: 1,
      half: 'top',
      battingLineup: lineup,
      battingOrderPosition: 0,
      pitcher,
      catcher,
      defense,
      pitchCount: 0,
      scoreDiff: 0,
    });

    // Should have recorded 3 outs (unless walkoff/mercy)
    expect(result.result.runs).toBeGreaterThanOrEqual(0);
    expect(result.result.atBats.length).toBeGreaterThan(0);
    expect(result.newPitchCount).toBeGreaterThan(0);
  });

  it('better hitting team should score more over many half-innings', () => {
    const eliteLineup = createTestLineup('elite', 85);
    const poorLineup = createTestLineup('poor', 35);
    const pitcher = createTestPlayer('pitcher', 'Pitcher', 50);
    const catcher = createTestPlayer('catcher', 'Catcher', 50);
    const defense = createDefense(poorLineup);
    defense['P'] = pitcher;

    const halfInnings = 20;
    let eliteRuns = 0;
    let poorRuns = 0;

    for (let i = 0; i < halfInnings; i++) {
      setSeed(`elite-inning-${i}`);
      const eliteResult = simulateHalfInning({
        inning: 1,
        half: 'top',
        battingLineup: eliteLineup,
        battingOrderPosition: 0,
        pitcher,
        catcher,
        defense,
        pitchCount: 0,
        scoreDiff: 0,
      });
      eliteRuns += eliteResult.result.runs;

      setSeed(`poor-inning-${i}`);
      const poorResult = simulateHalfInning({
        inning: 1,
        half: 'top',
        battingLineup: poorLineup,
        battingOrderPosition: 0,
        pitcher,
        catcher,
        defense,
        pitchCount: 0,
        scoreDiff: 0,
      });
      poorRuns += poorResult.result.runs;
    }

    expect(eliteRuns).toBeGreaterThan(poorRuns);
  });
});

// =============================================================================
// FULL GAME SIMULATION TESTS
// =============================================================================

describe('Full Game Simulation', () => {
  beforeEach(() => {
    setSeed('full-game-seed');
  });

  afterEach(() => {
    resetRandom();
  });

  it('should simulate a complete 9-inning game', () => {
    const homeLineup = createTestLineup('home', 70);
    const awayLineup = createTestLineup('away', 70);
    const homePitcher = createTestPlayer('home-pitcher', 'Home Pitcher', 70);
    const awayPitcher = createTestPlayer('away-pitcher', 'Away Pitcher', 70);

    const homeTeam = createTeamGameState(
      'home-team',
      'Home Team',
      homeLineup,
      homePitcher,
      [createTestPlayer('home-reliever', 'Reliever', 65)],
      createDefense(homeLineup)
    );

    const awayTeam = createTeamGameState(
      'away-team',
      'Away Team',
      awayLineup,
      awayPitcher,
      [createTestPlayer('away-reliever', 'Reliever', 65)],
      createDefense(awayLineup)
    );

    const result = simulateGame({ homeTeam, awayTeam });

    // Should have a winner
    expect(result.result.winner).toBeTruthy();

    // Should have played at least 9 half-innings
    expect(result.result.halfInnings.length).toBeGreaterThanOrEqual(17);

    // Should have box score
    expect(result.result.boxScore.homeRuns).toBeGreaterThanOrEqual(0);
    expect(result.result.boxScore.awayRuns).toBeGreaterThanOrEqual(0);

    // Should have play-by-play
    expect(result.result.playByPlay.length).toBeGreaterThan(0);
  });

  it('better team should win more often over multiple games', () => {
    const games = 10;
    let eliteWins = 0;

    for (let i = 0; i < games; i++) {
      setSeed(`game-${i}`);

      const eliteLineup = createTestLineup('elite', 85);
      const poorLineup = createTestLineup('poor', 35);
      const elitePitcher = createTestPlayer(`elite-pitcher-${i}`, 'Elite Pitcher', 85);
      const poorPitcher = createTestPlayer(`poor-pitcher-${i}`, 'Poor Pitcher', 35);

      const eliteTeam = createTeamGameState(
        'elite-team',
        'Elite Team',
        eliteLineup,
        elitePitcher,
        [],
        createDefense(eliteLineup)
      );

      const poorTeam = createTeamGameState(
        'poor-team',
        'Poor Team',
        poorLineup,
        poorPitcher,
        [],
        createDefense(poorLineup)
      );

      const result = simulateGame({ homeTeam: eliteTeam, awayTeam: poorTeam });

      if (result.result.winner === 'elite-team') {
        eliteWins++;
      }
    }

    // Elite team should win majority of games
    expect(eliteWins).toBeGreaterThanOrEqual(6); // At least 60%
  });

  it('should track innings pitched correctly (total outs should match)', () => {
    // Run multiple games with different seeds to ensure robustness
    const seeds = ['innings-pitched-test-1', 'innings-pitched-test-2', 'innings-pitched-test-3', 'innings-pitched-test-4', 'innings-pitched-test-5'];

    for (const seed of seeds) {
      setSeed(seed);

      const homeLineup = createTestLineup('home', 70);
      const awayLineup = createTestLineup('away', 70);
      const homePitcher = createTestPlayer('home-pitcher', 'Home Pitcher', 70);
      const awayPitcher = createTestPlayer('away-pitcher', 'Away Pitcher', 70);
      const homeRelievers = [
        createTestPlayer('home-reliever-1', 'Home Reliever 1', 65),
        createTestPlayer('home-reliever-2', 'Home Reliever 2', 65),
      ];
      const awayRelievers = [
        createTestPlayer('away-reliever-1', 'Away Reliever 1', 65),
        createTestPlayer('away-reliever-2', 'Away Reliever 2', 65),
      ];

      const homeTeam = createTeamGameState(
        'home-team',
        'Home Team',
        homeLineup,
        homePitcher,
        homeRelievers,
        createDefense(homeLineup)
      );

      const awayTeam = createTeamGameState(
        'away-team',
        'Away Team',
        awayLineup,
        awayPitcher,
        awayRelievers,
        createDefense(awayLineup)
      );

      const result = simulateGame({ homeTeam, awayTeam });
      const boxScore = result.result.boxScore;

      // Calculate total outs from home pitching (pitches to away batters)
      let homeTotalOuts = 0;
      for (const stats of Object.values(boxScore.homePitching)) {
        // Convert IP back to outs (IP * 3)
        homeTotalOuts += Math.round(stats.inningsPitched * 3);
      }

      // Calculate total outs from away pitching (pitches to home batters)
      let awayTotalOuts = 0;
      for (const stats of Object.values(boxScore.awayPitching)) {
        awayTotalOuts += Math.round(stats.inningsPitched * 3);
      }

      // Home pitching should have pitched to away batters for all their half-innings
      const awayHalfInnings = boxScore.awayRunsByInning.length;
      const expectedAwayOuts = awayHalfInnings * 3;

      // Away pitching should have pitched to home batters
      // Note: if home team won via walk-off, the last inning may be incomplete
      const homeHalfInnings = boxScore.homeRunsByInning.length;
      const homeWonWalkoff = result.result.homeScore > result.result.awayScore && result.result.innings >= 9;

      // Home pitching should always match (away team always bats full innings except in extra innings)
      expect(homeTotalOuts).toBe(expectedAwayOuts);

      // For away pitching, if not a walk-off, should match expected
      if (!homeWonWalkoff) {
        const expectedHomeOuts = homeHalfInnings * 3;
        expect(awayTotalOuts).toBe(expectedHomeOuts);
      } else {
        // Walk-off means last inning was incomplete, so total should be less than full
        const maxHomeOuts = homeHalfInnings * 3;
        expect(awayTotalOuts).toBeLessThanOrEqual(maxHomeOuts);
        expect(awayTotalOuts).toBeGreaterThan(0);
      }
    }
  });
});
