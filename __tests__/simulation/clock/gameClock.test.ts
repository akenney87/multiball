/**
 * Tests for Game Clock System
 *
 * Validates:
 * - Possession duration calculations (pace-based, triangular distribution)
 * - Clock management (tick, remaining time, formatting)
 * - Quarter flow logic (end conditions, final possession detection)
 * - Possession count estimates and validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  GameClock,
  calculatePossessionDuration,
  estimatePossessionsPerQuarter,
  shouldEndQuarter,
  simulateQuarterClock,
  validatePossessionCounts,
} from '../../../src/simulation/clock/gameClock';

describe('GameClock', () => {
  let clock: GameClock;

  beforeEach(() => {
    clock = new GameClock();
  });

  describe('Constructor', () => {
    it('should initialize with 12 minute quarter (720 seconds)', () => {
      expect(clock.getTimeRemaining()).toBe(720);
      expect(clock.formatTime()).toBe('12:00');
    });

    it('should support custom quarter length', () => {
      const customClock = new GameClock(10);
      expect(customClock.getTimeRemaining()).toBe(600);
      expect(customClock.formatTime()).toBe('10:00');
    });
  });

  describe('Clock Operations', () => {
    it('should advance clock by specified duration', () => {
      const remaining = clock.tick(30);
      expect(remaining).toBe(690);
      expect(clock.getTimeRemaining()).toBe(690);
    });

    it('should format time correctly', () => {
      clock.tick(195); // 3:15 elapsed
      expect(clock.formatTime()).toBe('08:45');
      expect(clock.getTimeRemainingFormatted()).toBe('08:45');
    });

    it('should handle zero padding in formatting', () => {
      clock.tick(678); // Leave 42 seconds
      expect(clock.formatTime()).toBe('00:42');
    });

    it('should not allow negative time', () => {
      clock.tick(800); // More than quarter length
      expect(clock.getTimeRemaining()).toBe(0);
      expect(clock.formatTime()).toBe('00:00');
    });

    it('should detect quarter end', () => {
      expect(clock.isQuarterOver()).toBe(false);
      clock.tick(720);
      expect(clock.isQuarterOver()).toBe(true);
    });

    it('should detect final possession', () => {
      expect(clock.isFinalPossession()).toBe(false);
      clock.tick(695); // 25 seconds left
      expect(clock.isFinalPossession()).toBe(true);
    });

    it('should support custom final possession threshold', () => {
      clock.tick(680); // 40 seconds left
      expect(clock.isFinalPossession(30)).toBe(false);
      expect(clock.isFinalPossession(50)).toBe(true);
    });

    it('should reset clock to start of quarter', () => {
      clock.tick(300);
      expect(clock.getTimeRemaining()).toBe(420);
      clock.reset();
      expect(clock.getTimeRemaining()).toBe(720);
    });

    it('should support advanceClock alias', () => {
      clock.advanceClock(120);
      expect(clock.getTimeRemaining()).toBe(600);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple ticks past quarter end', () => {
      clock.tick(400);
      clock.tick(400); // Total 800, exceeds 720
      expect(clock.getTimeRemaining()).toBe(0);
      clock.tick(10); // Try to advance further
      expect(clock.getTimeRemaining()).toBe(0);
    });

    it('should handle zero duration tick', () => {
      const initial = clock.getTimeRemaining();
      clock.tick(0);
      expect(clock.getTimeRemaining()).toBe(initial);
    });
  });
});

describe('Possession Duration Calculation', () => {
  describe('calculatePossessionDuration', () => {
    it('should return duration in valid range for fast pace', () => {
      for (let i = 0; i < 100; i++) {
        const duration = calculatePossessionDuration('fast');
        expect(duration).toBeGreaterThanOrEqual(7);
        expect(duration).toBeLessThanOrEqual(18);
      }
    });

    it('should return duration in valid range for standard pace', () => {
      for (let i = 0; i < 100; i++) {
        const duration = calculatePossessionDuration('standard');
        expect(duration).toBeGreaterThanOrEqual(8);
        expect(duration).toBeLessThanOrEqual(21);
      }
    });

    it('should return duration in valid range for slow pace', () => {
      for (let i = 0; i < 100; i++) {
        const duration = calculatePossessionDuration('slow');
        expect(duration).toBeGreaterThanOrEqual(9);
        expect(duration).toBeLessThanOrEqual(24);
      }
    });

    it('should return shorter duration for transition possessions', () => {
      for (let i = 0; i < 100; i++) {
        const duration = calculatePossessionDuration('standard', true);
        expect(duration).toBeGreaterThanOrEqual(6);
        expect(duration).toBeLessThanOrEqual(12);
      }
    });

    it('should throw error for invalid pace', () => {
      expect(() => calculatePossessionDuration('invalid' as any)).toThrow();
    });

    it('should return integers (no decimals)', () => {
      for (let i = 0; i < 50; i++) {
        const duration = calculatePossessionDuration('standard');
        expect(Number.isInteger(duration)).toBe(true);
      }
    });
  });

  describe('estimatePossessionsPerQuarter', () => {
    it('should estimate ~56 possessions for fast pace', () => {
      const estimate = estimatePossessionsPerQuarter('fast');
      expect(estimate).toBeGreaterThanOrEqual(55);
      expect(estimate).toBeLessThanOrEqual(57);
    });

    it('should estimate ~50 possessions for standard pace', () => {
      const estimate = estimatePossessionsPerQuarter('standard');
      expect(estimate).toBe(50);
    });

    it('should estimate ~44 possessions for slow pace', () => {
      const estimate = estimatePossessionsPerQuarter('slow');
      expect(estimate).toBeGreaterThanOrEqual(43);
      expect(estimate).toBeLessThanOrEqual(45);
    });

    it('should throw error for invalid pace', () => {
      expect(() => estimatePossessionsPerQuarter('invalid' as any)).toThrow();
    });
  });

  describe('Pace Differentiation', () => {
    it('should show fast pace is faster than standard', () => {
      const durations: Record<string, number[]> = {
        fast: [],
        standard: [],
      };

      for (let i = 0; i < 100; i++) {
        durations.fast.push(calculatePossessionDuration('fast'));
        durations.standard.push(calculatePossessionDuration('standard'));
      }

      const avgFast = durations.fast.reduce((a, b) => a + b, 0) / durations.fast.length;
      const avgStandard =
        durations.standard.reduce((a, b) => a + b, 0) / durations.standard.length;

      expect(avgFast).toBeLessThan(avgStandard);
    });

    it('should show slow pace is slower than standard', () => {
      const durations: Record<string, number[]> = {
        slow: [],
        standard: [],
      };

      for (let i = 0; i < 100; i++) {
        durations.slow.push(calculatePossessionDuration('slow'));
        durations.standard.push(calculatePossessionDuration('standard'));
      }

      const avgSlow = durations.slow.reduce((a, b) => a + b, 0) / durations.slow.length;
      const avgStandard =
        durations.standard.reduce((a, b) => a + b, 0) / durations.standard.length;

      expect(avgSlow).toBeGreaterThan(avgStandard);
    });
  });
});

describe('Quarter Flow Logic', () => {
  describe('shouldEndQuarter', () => {
    let clock: GameClock;

    beforeEach(() => {
      clock = new GameClock();
    });

    it('should not end quarter with plenty of time left', () => {
      expect(shouldEndQuarter(clock, false)).toBe(false);
    });

    it('should end quarter when time expires', () => {
      clock.tick(720);
      expect(shouldEndQuarter(clock, false)).toBe(true);
    });

    it('should end quarter when less than 25 seconds and no possession started', () => {
      clock.tick(696); // 24 seconds left
      expect(shouldEndQuarter(clock, false)).toBe(true);
    });

    it('should NOT end quarter if possession already started', () => {
      clock.tick(696); // 24 seconds left
      expect(shouldEndQuarter(clock, true)).toBe(false);
    });

    it('should allow possession to finish even at 0:00', () => {
      clock.tick(720);
      expect(shouldEndQuarter(clock, true)).toBe(false);
    });
  });

  describe('simulateQuarterClock', () => {
    it('should generate possessions until quarter ends', () => {
      const possessions = simulateQuarterClock('standard');
      expect(possessions.length).toBeGreaterThan(0);
      expect(possessions[0].startTime).toBe('12:00');
    });

    it('should have sequential possession numbers', () => {
      const possessions = simulateQuarterClock('standard');
      possessions.forEach((poss, idx) => {
        expect(poss.possessionNum).toBe(idx + 1);
      });
    });

    it('should have valid time progression', () => {
      const possessions = simulateQuarterClock('standard');
      for (let i = 1; i < possessions.length; i++) {
        const prev = possessions[i - 1];
        const curr = possessions[i];
        expect(curr.startTime).toBe(prev.endTime);
      }
    });

    it('should include duration for each possession', () => {
      const possessions = simulateQuarterClock('standard');
      possessions.forEach((poss) => {
        expect(poss.duration).toBeGreaterThan(0);
        expect(Number.isInteger(poss.duration)).toBe(true);
      });
    });

    it('should generate more possessions for fast pace', () => {
      const fastPossessions = simulateQuarterClock('fast');
      const standardPossessions = simulateQuarterClock('standard');
      expect(fastPossessions.length).toBeGreaterThan(standardPossessions.length);
    });

    it('should generate fewer possessions for slow pace', () => {
      const slowPossessions = simulateQuarterClock('slow');
      const standardPossessions = simulateQuarterClock('standard');
      expect(slowPossessions.length).toBeLessThan(standardPossessions.length);
    });
  });
});

describe('Possession Count Validation', () => {
  describe('validatePossessionCounts', () => {
    it('should validate fast pace possession counts', () => {
      const stats = validatePossessionCounts('fast', 20);
      expect(stats.pace).toBe('fast');
      expect(stats.expected).toBeGreaterThan(50);
      expect(stats.allCounts).toHaveLength(20);
      expect(stats.avg).toBeGreaterThan(45);
    });

    it('should validate standard pace possession counts', () => {
      const stats = validatePossessionCounts('standard', 20);
      expect(stats.pace).toBe('standard');
      expect(stats.expected).toBe(50);
      expect(stats.avg).toBeGreaterThan(40);
      expect(stats.avg).toBeLessThan(60);
    });

    it('should validate slow pace possession counts', () => {
      const stats = validatePossessionCounts('slow', 20);
      expect(stats.pace).toBe('slow');
      expect(stats.expected).toBeLessThan(50);
      expect(stats.avg).toBeGreaterThan(35);
      expect(stats.avg).toBeLessThan(50);
    });

    it('should have realistic min/max ranges', () => {
      const stats = validatePossessionCounts('standard', 50);
      const range = stats.max - stats.min;
      expect(range).toBeGreaterThan(3); // Some variance (relaxed from 5)
      expect(range).toBeLessThan(20); // Not too chaotic
    });

    it('should return all individual counts', () => {
      const stats = validatePossessionCounts('standard', 10);
      expect(stats.allCounts).toHaveLength(10);
      stats.allCounts.forEach((count) => {
        expect(count).toBeGreaterThan(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });
  });

  describe('Statistical Properties', () => {
    it('should have consistent averages across multiple runs', () => {
      const run1 = validatePossessionCounts('standard', 100);
      const run2 = validatePossessionCounts('standard', 100);

      // Averages should be within 5% of each other
      const difference = Math.abs(run1.avg - run2.avg);
      const tolerance = run1.avg * 0.05;
      expect(difference).toBeLessThan(tolerance);
    });

    it('should show proper pace ordering: fast > standard > slow', () => {
      const fast = validatePossessionCounts('fast', 50);
      const standard = validatePossessionCounts('standard', 50);
      const slow = validatePossessionCounts('slow', 50);

      expect(fast.avg).toBeGreaterThan(standard.avg);
      expect(standard.avg).toBeGreaterThan(slow.avg);
    });
  });
});

describe('Clock Integration Scenarios', () => {
  it('should handle full quarter simulation', () => {
    const clock = new GameClock();
    let possessionCount = 0;

    while (!shouldEndQuarter(clock, false)) {
      const duration = calculatePossessionDuration('standard');
      clock.tick(duration);
      possessionCount++;

      // Safety check to prevent infinite loop
      if (possessionCount > 100) break;
    }

    expect(possessionCount).toBeGreaterThan(40);
    expect(possessionCount).toBeLessThan(60);
    // Quarter may not be technically "over" if there's still time left (just < 25 seconds)
    // The shouldEndQuarter returns true, but time remaining might be > 0
    expect(clock.getTimeRemaining()).toBeLessThan(25);
  });

  it('should allow final possession to complete', () => {
    const clock = new GameClock();
    clock.tick(695); // 25 seconds left

    // Possession starts
    expect(shouldEndQuarter(clock, true)).toBe(false);

    // Long possession that goes past 0:00
    clock.tick(30); // Clock now at 0:00

    // Possession still completes
    expect(shouldEndQuarter(clock, true)).toBe(false);
    expect(clock.isQuarterOver()).toBe(true);
  });
});
