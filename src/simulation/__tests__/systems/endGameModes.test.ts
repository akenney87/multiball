/**
 * Tests for end-game modes system
 *
 * @module simulation/__tests__/systems/endGameModes.test
 */

import {
  detectEndGameMode,
  shouldIntentionalFoul,
  selectIntentionalFoulTarget,
  createEmptyModifiers,
} from '../../systems/endGameModes';
import type { Player } from '../../../data/types';

function createTestPlayer(name: string, throwAccuracy: number = 70): Player {
  return {
    id: `player-${name}`,
    name,
    position: 'PG',
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
    throw_accuracy: throwAccuracy,
    form_technique: 70,
    finesse: 70,
    deception: 70,
    teamwork: 70,
  };
}

describe('End Game Modifiers', () => {
  test('should create empty modifiers', () => {
    const mods = createEmptyModifiers();
    expect(mods.activeModes).toHaveLength(0);
    expect(mods.shotClockTarget).toBeNull();
    expect(mods.paceMultiplier).toBe(1.0);
  });

  test('should detect clock kill mode', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(30, 3, 4, true, roster, roster);

    expect(mods.activeModes).toContain('clock_kill');
    expect(mods.shotClockTarget).toBe(7.0); // Small lead (3 pts)
  });

  test('should detect last shot tied mode', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(20, 0, 4, true, roster, roster);

    expect(mods.activeModes).toContain('last_shot_tied');
    expect(mods.gameClockTarget).toBe(3.0);
  });

  test('should detect last shot losing mode and force 3PT when down 3', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(20, -3, 4, true, roster, roster);

    expect(mods.activeModes).toContain('last_shot_losing');
    expect(mods.forceShotType).toBe('3pt');
    expect(mods.gameClockTarget).toBeGreaterThanOrEqual(5.0);
    expect(mods.gameClockTarget).toBeLessThanOrEqual(8.0);
  });

  test('should detect desperation mode', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(300, -15, 4, true, roster, roster);

    expect(mods.activeModes).toContain('desperation');
    expect(mods.shotDistribution3ptAdj).toBeGreaterThan(0);
    expect(mods.paceMultiplier).toBeGreaterThan(1.0);
  });

  test('should detect conserve lead mode', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(120, 20, 4, true, roster, roster);

    expect(mods.activeModes).toContain('conserve_lead');
    expect(mods.shotDistribution3ptAdj).toBeLessThan(0);
    expect(mods.paceMultiplier).toBeLessThan(1.0);
  });

  test('should not detect modes in Q1-Q3', () => {
    const roster: Player[] = [];
    const mods = detectEndGameMode(30, 3, 3, true, roster, roster);

    expect(mods.activeModes).toHaveLength(0);
  });
});

describe('Intentional Fouling', () => {
  test('should foul when down 2-3 with <24 seconds', () => {
    expect(shouldIntentionalFoul(20, 3, 4, true)).toBe(true);
    expect(shouldIntentionalFoul(20, 2, 4, true)).toBe(true);
  });

  test('should not foul when down 2-3 with >24 seconds', () => {
    expect(shouldIntentionalFoul(30, 3, 4, true)).toBe(false);
  });

  test('should foul when down 4-6 with <60 seconds', () => {
    expect(shouldIntentionalFoul(50, 5, 4, true)).toBe(true);
    expect(shouldIntentionalFoul(50, 4, 4, true)).toBe(true);
  });

  test('should not foul in Q1-Q3', () => {
    expect(shouldIntentionalFoul(20, 3, 3, true)).toBe(false);
  });

  test('should not foul when offense is losing', () => {
    expect(shouldIntentionalFoul(20, 3, 4, false)).toBe(false);
  });

  test('should select intentional foul target from roster', () => {
    const roster = [
      createTestPlayer('BadFT', 50),
      createTestPlayer('GoodFT', 90),
      createTestPlayer('MediumFT', 70),
    ];

    // Run multiple times to check distribution
    const selections: string[] = [];
    for (let i = 0; i < 100; i++) {
      selections.push(selectIntentionalFoulTarget(roster));
    }

    // GoodFT should be selected most often
    const goodFTCount = selections.filter(s => s === 'GoodFT').length;
    expect(goodFTCount).toBeGreaterThan(30); // At least 30% (should be ~50%)
  });
});
