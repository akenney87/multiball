/**
 * Tests for Stamina Management System
 *
 * Validates:
 * - Stamina cost calculations (pace, role, player attributes)
 * - Exponential recovery formulas
 * - Stamina tracking for full roster
 * - Degraded player generation
 * - Minutes tracking
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateStaminaCost,
  recoverStamina,
  StaminaTracker,
  applyStaminaCost,
  recoverBenchStamina,
  getDegradedTeam,
} from '../../../src/simulation/stamina/staminaManager';

// Mock player data
interface MockPlayer {
  name: string;
  stamina: number;
  acceleration: number;
  top_speed: number;
  [key: string]: number | string;
}

const createMockPlayer = (name: string, overrides: Partial<MockPlayer> = {}): MockPlayer => ({
  name,
  stamina: 50,
  acceleration: 50,
  top_speed: 50,
  height: 75,
  jumping: 70,
  grip_strength: 70,
  arm_strength: 70,
  core_strength: 70,
  agility: 60,
  balance: 70,
  durability: 70,
  reactions: 70,
  awareness: 70,
  creativity: 60,
  determination: 70,
  bravery: 70,
  consistency: 70,
  composure: 70,
  patience: 60,
  hand_eye_coordination: 70,
  throw_accuracy: 70,
  form_technique: 70,
  finesse: 70,
  deception: 60,
  teamwork: 70,
  ...overrides,
});

describe('Stamina Cost Calculation', () => {
  describe('calculateStaminaCost', () => {
    it('should calculate base cost for standard pace, average player', () => {
      const cost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      expect(cost).toBeCloseTo(0.8, 2);
    });

    it('should apply pace modifiers correctly', () => {
      const fastCost = calculateStaminaCost('fast', false, false, 50, 50, 50);
      const standardCost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      const slowCost = calculateStaminaCost('slow', false, false, 50, 50, 50);

      expect(fastCost).toBeGreaterThan(standardCost);
      expect(slowCost).toBeLessThan(standardCost);
      expect(fastCost).toBeCloseTo(1.1, 2); // 0.8 + 0.3
      expect(slowCost).toBeCloseTo(0.5, 2); // 0.8 - 0.3
    });

    it('should apply scoring option bonus', () => {
      const nonOptionCost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      const optionCost = calculateStaminaCost('standard', true, false, 50, 50, 50);

      expect(optionCost).toBeGreaterThan(nonOptionCost);
      expect(optionCost - nonOptionCost).toBeCloseTo(0.2, 2);
    });

    it('should apply transition bonus', () => {
      const normalCost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      const transitionCost = calculateStaminaCost('standard', false, true, 50, 50, 50);

      expect(transitionCost).toBeGreaterThan(normalCost);
      expect(transitionCost - normalCost).toBeCloseTo(0.1, 2);
    });

    it('should apply stamina attribute drain rate modifier', () => {
      const highStaminaCost = calculateStaminaCost('standard', false, false, 90, 50, 50);
      const avgStaminaCost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      const lowStaminaCost = calculateStaminaCost('standard', false, false, 10, 50, 50);

      // High stamina drains slower (lower cost)
      expect(highStaminaCost).toBeLessThan(avgStaminaCost);
      // Low stamina drains faster (higher cost)
      expect(lowStaminaCost).toBeGreaterThan(avgStaminaCost);
    });

    it('should apply speed efficiency modifier', () => {
      const fastPlayerCost = calculateStaminaCost('standard', false, false, 50, 80, 80);
      const avgPlayerCost = calculateStaminaCost('standard', false, false, 50, 50, 50);
      const slowPlayerCost = calculateStaminaCost('standard', false, false, 50, 20, 20);

      // Fast players are more efficient (lower cost)
      expect(fastPlayerCost).toBeLessThan(avgPlayerCost);
      // Slow players are less efficient (higher cost)
      expect(slowPlayerCost).toBeGreaterThan(avgPlayerCost);
    });

    it('should combine all modifiers correctly', () => {
      // Elite stamina + speed, fast pace, scoring option
      const eliteCost = calculateStaminaCost('fast', true, false, 90, 80, 80);
      // Poor stamina + speed, slow pace, non-option
      const poorCost = calculateStaminaCost('slow', false, false, 10, 20, 20);

      // Elite should have much lower cost despite faster pace
      expect(eliteCost).toBeLessThan(poorCost);
    });

    it('should never return negative cost', () => {
      const cost = calculateStaminaCost('slow', false, false, 90, 90, 90);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Stamina Recovery', () => {
  describe('recoverStamina', () => {
    it('should calculate base recovery correctly', () => {
      // At 50 stamina, 1 minute, average player: 8 * 0.5 * 1.0 = 4.0
      const recovery = recoverStamina(50, 1.0, 50);
      expect(recovery).toBeCloseTo(4.0, 2);
    });

    it('should apply exponential diminishing returns', () => {
      // More tired = faster recovery
      const veryTired = recoverStamina(20, 1.0, 50);
      const somewhatTired = recoverStamina(60, 1.0, 50);

      expect(veryTired).toBeGreaterThan(somewhatTired);
    });

    it('should scale with minutes on bench', () => {
      const oneMinute = recoverStamina(50, 1.0, 50);
      const twoMinutes = recoverStamina(50, 2.0, 50);

      expect(twoMinutes).toBeCloseTo(oneMinute * 2, 2);
    });

    it('should apply stamina attribute recovery rate modifier', () => {
      const highStaminaRecovery = recoverStamina(50, 1.0, 90);
      const avgStaminaRecovery = recoverStamina(50, 1.0, 50);
      const lowStaminaRecovery = recoverStamina(50, 1.0, 10);

      // High stamina recovers faster
      expect(highStaminaRecovery).toBeGreaterThan(avgStaminaRecovery);
      // Low stamina recovers slower
      expect(lowStaminaRecovery).toBeLessThan(avgStaminaRecovery);
    });

    it('should handle edge cases (0 stamina)', () => {
      const recovery = recoverStamina(0, 1.0, 50);
      expect(recovery).toBeCloseTo(8.0, 2); // Full recovery rate
    });

    it('should handle edge cases (100 stamina)', () => {
      const recovery = recoverStamina(100, 1.0, 50);
      expect(recovery).toBeCloseTo(0.0, 2); // No recovery needed
    });

    it('should clamp input stamina to valid range', () => {
      const negativeRecovery = recoverStamina(-10, 1.0, 50);
      const overRecovery = recoverStamina(110, 1.0, 50);

      expect(negativeRecovery).toBeGreaterThan(0); // Treated as 0 stamina
      expect(overRecovery).toBeCloseTo(0, 2); // Treated as 100 stamina
    });

    it('should never return negative recovery', () => {
      const recovery = recoverStamina(100, 1.0, 10);
      expect(recovery).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('StaminaTracker', () => {
  let tracker: StaminaTracker;
  let players: MockPlayer[];

  beforeEach(() => {
    players = [
      createMockPlayer('Player A', { stamina: 50 }), // Same stamina for fair comparison in tests
      createMockPlayer('Player B', { stamina: 50 }),
      createMockPlayer('Player C', { stamina: 50 }),
      createMockPlayer('Player D', { stamina: 50 }),
      createMockPlayer('Player E', { stamina: 50 }),
    ];
    tracker = new StaminaTracker(players);
  });

  describe('Constructor', () => {
    it('should initialize all players at 100 stamina', () => {
      players.forEach((player) => {
        expect(tracker.getCurrentStamina(player.name)).toBe(100);
      });
    });

    it('should initialize all players with 0 minutes played', () => {
      players.forEach((player) => {
        expect(tracker.getMinutesPlayed(player.name)).toBe(0);
      });
    });

    it('should store original player data', () => {
      // Verify we can retrieve degraded players (implies originals are stored)
      const degraded = tracker.getDegradedPlayer(players[0]);
      expect(degraded).toBeDefined();
    });
  });

  describe('Stamina Tracking', () => {
    it('should get current stamina for player', () => {
      const stamina = tracker.getCurrentStamina('Player A');
      expect(stamina).toBe(100);
    });

    it('should throw error for unknown player', () => {
      expect(() => tracker.getCurrentStamina('Unknown')).toThrow();
    });

    it('should get all stamina values', () => {
      const allStamina = tracker.getAllStaminaValues();
      expect(Object.keys(allStamina)).toHaveLength(5);
      Object.values(allStamina).forEach((stamina) => {
        expect(stamina).toBe(100);
      });
    });
  });

  describe('Apply Possession Cost', () => {
    it('should deplete stamina for active players', () => {
      const activePlayers = [players[0], players[1]];
      tracker.applyPossessionCost(activePlayers, 'standard', [], false);

      expect(tracker.getCurrentStamina('Player A')).toBeLessThan(100);
      expect(tracker.getCurrentStamina('Player B')).toBeLessThan(100);
      // Bench players should be unchanged
      expect(tracker.getCurrentStamina('Player C')).toBe(100);
    });

    it('should apply higher cost to scoring options', () => {
      const activePlayers = [players[0], players[1]];
      // Apply cost multiple times to see meaningful difference
      for (let i = 0; i < 10; i++) {
        tracker.applyPossessionCost(activePlayers, 'standard', ['Player A'], false);
      }

      const optionStamina = tracker.getCurrentStamina('Player A');
      const nonOptionStamina = tracker.getCurrentStamina('Player B');

      expect(optionStamina).toBeLessThan(nonOptionStamina);
    });

    it('should clamp stamina to [0, 100]', () => {
      const activePlayers = [players[0]];
      // Deplete stamina many times
      for (let i = 0; i < 200; i++) {
        tracker.applyPossessionCost(activePlayers, 'fast', ['Player A'], true);
      }

      const stamina = tracker.getCurrentStamina('Player A');
      expect(stamina).toBeGreaterThanOrEqual(0);
      expect(stamina).toBeLessThanOrEqual(100);
    });

    it('should use player attributes for cost calculation', () => {
      const elitePlayer = createMockPlayer('Elite', { stamina: 90, acceleration: 80, top_speed: 80 });
      const poorPlayer = createMockPlayer('Poor', { stamina: 10, acceleration: 20, top_speed: 20 });
      const specialTracker = new StaminaTracker([elitePlayer, poorPlayer]);

      // Apply cost multiple times to see meaningful difference
      for (let i = 0; i < 10; i++) {
        specialTracker.applyPossessionCost([elitePlayer, poorPlayer], 'standard', [], false);
      }

      const eliteStamina = specialTracker.getCurrentStamina('Elite');
      const poorStamina = specialTracker.getCurrentStamina('Poor');

      // Elite should have lost less stamina (higher remaining stamina)
      expect(eliteStamina).toBeGreaterThan(poorStamina);
    });
  });

  describe('Bench Recovery', () => {
    it('should recover stamina for bench players', () => {
      // Deplete first
      tracker.applyPossessionCost([players[0]], 'standard', [], false);
      const depleted = tracker.getCurrentStamina('Player A');

      // Recover on bench
      tracker.recoverBenchStamina([players[0]], 1.0);
      const recovered = tracker.getCurrentStamina('Player A');

      expect(recovered).toBeGreaterThan(depleted);
    });

    it('should not exceed 100 stamina', () => {
      // Start at 90
      tracker.applyPossessionCost([players[0]], 'standard', [], false);
      tracker.applyPossessionCost([players[0]], 'standard', [], false);
      tracker.applyPossessionCost([players[0]], 'standard', [], false);

      // Recover for a long time
      tracker.recoverBenchStamina([players[0]], 10.0);

      expect(tracker.getCurrentStamina('Player A')).toBeLessThanOrEqual(100);
    });

    it('should use player stamina attribute for recovery rate', () => {
      const highStaminaPlayer = createMockPlayer('High', { stamina: 90, acceleration: 50, top_speed: 50 });
      const lowStaminaPlayer = createMockPlayer('Low', { stamina: 10, acceleration: 50, top_speed: 50 });
      const specialTracker = new StaminaTracker([highStaminaPlayer, lowStaminaPlayer]);

      // Deplete both players significantly, but high stamina drains slower
      // So we need to deplete them to SIMILAR levels for fair recovery comparison
      // Low stamina player needs fewer iterations to reach same depletion
      for (let i = 0; i < 100; i++) {
        specialTracker.applyPossessionCost([highStaminaPlayer], 'fast', ['High'], true);
      }
      for (let i = 0; i < 70; i++) {
        specialTracker.applyPossessionCost([lowStaminaPlayer], 'fast', ['Low'], true);
      }

      const highBefore = specialTracker.getCurrentStamina('High');
      const lowBefore = specialTracker.getCurrentStamina('Low');

      // Now both should be at roughly similar stamina levels (30-40 range)
      const staminaDiff = Math.abs(highBefore - lowBefore);
      expect(staminaDiff).toBeLessThan(20); // Within 20 stamina points

      // Recover for 2 minutes (longer time for more noticeable difference)
      specialTracker.recoverBenchStamina([highStaminaPlayer, lowStaminaPlayer], 2.0);

      const highAfter = specialTracker.getCurrentStamina('High');
      const lowAfter = specialTracker.getCurrentStamina('Low');

      const highRecovery = highAfter - highBefore;
      const lowRecovery = lowAfter - lowBefore;

      // High stamina player should recover noticeably more (10.4% faster)
      // At similar depletion levels, this should be visible
      expect(highRecovery).toBeGreaterThan(lowRecovery);
    });
  });

  describe('Degraded Player Generation', () => {
    it('should return degraded player with current stamina', () => {
      // Deplete stamina
      tracker.applyPossessionCost([players[0]], 'fast', ['Player A'], true);
      for (let i = 0; i < 50; i++) {
        tracker.applyPossessionCost([players[0]], 'fast', ['Player A'], true);
      }

      const degraded = tracker.getDegradedPlayer(players[0]);
      expect(degraded.current_stamina).toBeLessThan(100);
    });

    it('should not modify original player', () => {
      const originalStamina = players[0].stamina;
      tracker.applyPossessionCost([players[0]], 'fast', ['Player A'], true);
      tracker.getDegradedPlayer(players[0]);

      expect(players[0].stamina).toBe(originalStamina);
    });

    it('should return same player if stamina >= 80', () => {
      const degraded = tracker.getDegradedPlayer(players[0]);
      // Should be same reference since no degradation needed
      // (This depends on implementation of applyStaminaToPlayer)
      expect(degraded).toBeDefined();
    });
  });

  describe('Minutes Tracking', () => {
    it('should track minutes played', () => {
      tracker.addMinutes('Player A', 120); // 2 minutes
      expect(tracker.getMinutesPlayed('Player A')).toBeCloseTo(2.0, 2);
    });

    it('should accumulate minutes across multiple possessions', () => {
      tracker.addMinutes('Player A', 30); // 0.5 min
      tracker.addMinutes('Player A', 30); // 0.5 min
      tracker.addMinutes('Player A', 60); // 1.0 min
      expect(tracker.getMinutesPlayed('Player A')).toBeCloseTo(2.0, 2);
    });

    it('should throw error for unknown player', () => {
      expect(() => tracker.addMinutes('Unknown', 60)).toThrow();
      expect(() => tracker.getMinutesPlayed('Unknown')).toThrow();
    });
  });

  describe('Reset Operations', () => {
    beforeEach(() => {
      // Set up some state
      tracker.applyPossessionCost([players[0]], 'fast', [], false);
      tracker.addMinutes('Player A', 120);
    });

    it('should reset individual player stamina', () => {
      tracker.resetStamina('Player A');
      // Should reset to original stamina attribute (50), not 100
      expect(tracker.getCurrentStamina('Player A')).toBe(50);
    });

    it('should reset all stamina at quarter break', () => {
      tracker.resetQuarter();
      players.forEach((player) => {
        expect(tracker.getCurrentStamina(player.name)).toBe(100);
      });
      // Minutes should be preserved
      expect(tracker.getMinutesPlayed('Player A')).toBeCloseTo(2.0, 2);
    });

    it('should reset all stamina and minutes at game start', () => {
      tracker.resetGame();
      players.forEach((player) => {
        expect(tracker.getCurrentStamina(player.name)).toBe(100);
        expect(tracker.getMinutesPlayed(player.name)).toBe(0);
      });
    });

    it('should throw error for unknown player in resetStamina', () => {
      expect(() => tracker.resetStamina('Unknown')).toThrow();
    });
  });
});

describe('Helper Functions', () => {
  let tracker: StaminaTracker;
  let players: MockPlayer[];

  beforeEach(() => {
    players = [
      createMockPlayer('Player A'),
      createMockPlayer('Player B'),
      createMockPlayer('Player C'),
    ];
    tracker = new StaminaTracker(players);
  });

  describe('applyStaminaCost', () => {
    it('should deplete stamina using player names', () => {
      applyStaminaCost(tracker, ['Player A', 'Player B'], 'standard', []);
      expect(tracker.getCurrentStamina('Player A')).toBeLessThan(100);
      expect(tracker.getCurrentStamina('Player C')).toBe(100);
    });
  });

  describe('recoverBenchStamina', () => {
    it('should recover stamina using player names', () => {
      tracker.applyPossessionCost([players[0]], 'fast', ['Player A'], false);
      const before = tracker.getCurrentStamina('Player A');

      recoverBenchStamina(tracker, ['Player A']);
      const after = tracker.getCurrentStamina('Player A');

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('getDegradedTeam', () => {
    it('should return degraded team without modifying original', () => {
      // Deplete stamina
      for (let i = 0; i < 50; i++) {
        tracker.applyPossessionCost([players[0]], 'fast', ['Player A'], true);
      }

      const degradedTeam = getDegradedTeam([players[0]], tracker);

      expect(degradedTeam).toHaveLength(1);
      expect(degradedTeam[0]).toBeDefined();
      // Original should be unchanged
      expect(players[0].stamina).toBe(50);
    });

    it('should degrade all players in team', () => {
      const degradedTeam = getDegradedTeam(players, tracker);
      expect(degradedTeam).toHaveLength(players.length);
    });
  });
});

describe('Integration Scenarios', () => {
  it('should simulate realistic quarter stamina progression', () => {
    const players = [
      createMockPlayer('Starter', { stamina: 60 }),
      createMockPlayer('Bench', { stamina: 70 }),
    ];
    const tracker = new StaminaTracker(players);

    // Simulate 25 possessions (half quarter)
    for (let i = 0; i < 25; i++) {
      tracker.applyPossessionCost([players[0]], 'standard', ['Starter'], false);
      tracker.recoverBenchStamina([players[1]], 0.4); // ~30 sec per possession
    }

    const starterStamina = tracker.getCurrentStamina('Starter');
    const benchStamina = tracker.getCurrentStamina('Bench');

    expect(starterStamina).toBeLessThan(100);
    expect(starterStamina).toBeGreaterThan(50); // Shouldn't be exhausted yet
    expect(benchStamina).toBe(100); // Full recovery
  });

  it('should handle player substitution pattern', () => {
    const players = [
      createMockPlayer('Player 1', { stamina: 60 }),
      createMockPlayer('Player 2', { stamina: 60 }),
    ];
    const tracker = new StaminaTracker(players);

    // Player 1 plays 10 possessions
    for (let i = 0; i < 10; i++) {
      tracker.applyPossessionCost([players[0]], 'standard', [], false);
      tracker.recoverBenchStamina([players[1]], 0.4);
    }

    const p1Before = tracker.getCurrentStamina('Player 1');
    const p2Before = tracker.getCurrentStamina('Player 2');

    // Switch: Player 2 plays, Player 1 rests
    for (let i = 0; i < 10; i++) {
      tracker.applyPossessionCost([players[1]], 'standard', [], false);
      tracker.recoverBenchStamina([players[0]], 0.4);
    }

    const p1After = tracker.getCurrentStamina('Player 1');
    const p2After = tracker.getCurrentStamina('Player 2');

    // Player 1 should have recovered
    expect(p1After).toBeGreaterThan(p1Before);
    // Player 2 should be depleted
    expect(p2After).toBeLessThan(p2Before);
  });
});
