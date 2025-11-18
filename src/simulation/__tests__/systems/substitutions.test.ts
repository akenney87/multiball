/**
 * Tests for substitution system
 *
 * Validates:
 * - LineupManager functionality
 * - Substitution triggers (stamina, minutes)
 * - Position compatibility
 * - Substitute selection logic
 * - SubstitutionManager integration
 *
 * @module simulation/__tests__/systems/substitutions.test
 */

import {
  LineupManager,
  SubstitutionManager,
  checkSubstitutionNeeded,
  selectSubstitute,
  isPositionCompatible,
  calculateQuarterAllocations,
  validateMinutesAllocation,
} from '../../systems/substitutions';
import type { Player } from '../../../data/types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createTestPlayer(name: string, position: string, stamina: number = 100): Player {
  return {
    id: `player-${name}`,
    name,
    position,
    stamina,
    // Include required attributes
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

function createTestTeam(size: number = 10): Player[] {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C'];
  const team: Player[] = [];
  for (let i = 0; i < size; i++) {
    const pos = positions[i % positions.length];
    team.push(createTestPlayer(`Player${i + 1}`, pos));
  }
  return team;
}

// =============================================================================
// POSITION COMPATIBILITY TESTS
// =============================================================================

describe('Position Compatibility', () => {
  test('guards (PG/SG) should be interchangeable', () => {
    expect(isPositionCompatible('PG', 'SG')).toBe(true);
    expect(isPositionCompatible('SG', 'PG')).toBe(true);
    expect(isPositionCompatible('PG', 'PG')).toBe(true);
    expect(isPositionCompatible('SG', 'SG')).toBe(true);
  });

  test('wings (SF/PF) should be interchangeable', () => {
    expect(isPositionCompatible('SF', 'PF')).toBe(true);
    expect(isPositionCompatible('PF', 'SF')).toBe(true);
    expect(isPositionCompatible('SF', 'SF')).toBe(true);
    expect(isPositionCompatible('PF', 'PF')).toBe(true);
  });

  test('centers (C) should only match centers', () => {
    expect(isPositionCompatible('C', 'C')).toBe(true);
    expect(isPositionCompatible('C', 'PF')).toBe(false);
    expect(isPositionCompatible('C', 'SF')).toBe(false);
    expect(isPositionCompatible('C', 'SG')).toBe(false);
    expect(isPositionCompatible('C', 'PG')).toBe(false);
  });

  test('guards and wings should not be compatible', () => {
    expect(isPositionCompatible('PG', 'SF')).toBe(false);
    expect(isPositionCompatible('PG', 'PF')).toBe(false);
    expect(isPositionCompatible('SG', 'SF')).toBe(false);
    expect(isPositionCompatible('SG', 'PF')).toBe(false);
  });
});

// =============================================================================
// SUBSTITUTION CHECK TESTS
// =============================================================================

describe('Substitution Checks', () => {
  test('stamina < 75 should trigger substitution', () => {
    const player = createTestPlayer('Test', 'PG');
    const [needsSub, reason] = checkSubstitutionNeeded(player, 70.0, 5.0, 12.0);
    expect(needsSub).toBe(true);
    expect(reason).toBe('stamina');
  });

  test('minutes >= allocation should trigger substitution', () => {
    const player = createTestPlayer('Test', 'PG');
    const [needsSub, reason] = checkSubstitutionNeeded(player, 80.0, 12.2, 12.0);
    expect(needsSub).toBe(true);
    expect(reason).toBe('minutes');
  });

  test('no triggers should return false', () => {
    const player = createTestPlayer('Test', 'PG');
    const [needsSub, reason] = checkSubstitutionNeeded(player, 80.0, 8.0, 12.0);
    expect(needsSub).toBe(false);
    expect(reason).toBe('');
  });

  test('stamina trigger should take priority over minutes', () => {
    const player = createTestPlayer('Test', 'PG');
    const [needsSub, reason] = checkSubstitutionNeeded(player, 60.0, 12.5, 12.0);
    expect(needsSub).toBe(true);
    expect(reason).toBe('stamina');
  });
});

// =============================================================================
// LINEUP MANAGER TESTS
// =============================================================================

describe('LineupManager', () => {
  test('should initialize with correct active lineup', () => {
    const team = createTestTeam(10);
    const manager = new LineupManager(team);

    const active = manager.getActivePlayers();
    expect(active).toHaveLength(5);
    expect(active[0].name).toBe('Player1');
  });

  test('should throw error if team has fewer than 5 players', () => {
    const team = createTestTeam(3);
    expect(() => new LineupManager(team)).toThrow();
  });

  test('should substitute players correctly', () => {
    const team = createTestTeam(10);
    const manager = new LineupManager(team);

    const active = manager.getActivePlayers();
    const bench = manager.getBenchPlayers();

    const playerOut = active[0];
    const playerIn = bench[0];

    const success = manager.substitute(playerOut, playerIn);
    expect(success).toBe(true);

    const newActive = manager.getActivePlayers();
    expect(newActive.some(p => p.name === playerIn.name)).toBe(true);
    expect(newActive.some(p => p.name === playerOut.name)).toBe(false);
  });

  test('should validate lineup has exactly 5 players', () => {
    const team = createTestTeam(10);
    const manager = new LineupManager(team);

    expect(manager.validateLineup()).toBe(true);
  });
});

// =============================================================================
// MINUTES ALLOCATION TESTS
// =============================================================================

describe('Minutes Allocation', () => {
  test('should calculate quarter allocations correctly', () => {
    const total = {
      Player1: 36,
      Player2: 32,
      Player3: 28,
      Player4: 24,
      Player5: 20,
    };

    const quarter = calculateQuarterAllocations(total, 1);

    expect(quarter['Player1']).toBe(9);
    expect(quarter['Player2']).toBe(8);
    expect(quarter['Player3']).toBe(7);
  });

  test('should validate correct allocation (240 minutes)', () => {
    const allocation = {
      Player1: 48,
      Player2: 48,
      Player3: 48,
      Player4: 48,
      Player5: 48,
    };

    const [isValid, error] = validateMinutesAllocation(allocation, 5);
    expect(isValid).toBe(true);
    expect(error).toBe('');
  });

  test('should reject allocation not totaling 240', () => {
    const allocation = {
      Player1: 50,
      Player2: 50,
      Player3: 50,
      Player4: 50,
      Player5: 50,
    };

    const [isValid, error] = validateMinutesAllocation(allocation, 5);
    expect(isValid).toBe(false);
    expect(error).toContain('240');
  });

  test('should reject negative minutes', () => {
    const allocation = {
      Player1: 48,
      Player2: 48,
      Player3: 48,
      Player4: 48,
      Player5: -48, // Invalid
    };

    const [isValid, error] = validateMinutesAllocation(allocation, 5);
    expect(isValid).toBe(false);
    expect(error).toContain('negative');
  });

  test('should reject minutes > 48', () => {
    const allocation = {
      Player1: 60, // Invalid
      Player2: 45,
      Player3: 45,
      Player4: 45,
      Player5: 45,
    };

    const [isValid, error] = validateMinutesAllocation(allocation, 5);
    expect(isValid).toBe(false);
    expect(error).toContain('48');
  });
});
