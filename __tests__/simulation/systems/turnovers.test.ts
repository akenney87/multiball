/**
 * Tests for Turnover System
 *
 * Validates:
 * - Turnover probability calculation with modifiers
 * - Turnover type selection
 * - Steal credit determination
 * - Transition trigger logic
 */

import { describe, it, expect } from '@jest/globals';
import {
  checkTurnover,
  selectTurnoverType,
  determineStealCredit,
  triggersTransition,
  getTurnoverDescription,
} from '../../../src/simulation/systems/turnovers';
import type {
  SimulationPlayer,
  PossessionContext,
  SimulationTacticalSettings,
} from '../../../src/simulation/core/types';

// Mock player data
const createMockPlayer = (
  name: string,
  attributes: Partial<SimulationPlayer> = {}
): SimulationPlayer => ({
  id: name,
  name,
  position: 'PG',
  height: 75,
  jumping: 70,
  grip_strength: 70,
  arm_strength: 70,
  core_strength: 70,
  awareness: 70,
  reactions: 70,
  determination: 70,
  agility: 60,
  acceleration: 60,
  top_speed: 60,
  stamina: 80,
  balance: 70,
  durability: 70,
  creativity: 60,
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
  ...attributes,
});

const mockTacticalSettings: SimulationTacticalSettings = {
  pace: 'standard',
  manDefensePct: 70,
  scoringOptions: [],
  minutesAllotment: {},
  reboundingStrategy: 'standard',
};

const mockPossessionContext: PossessionContext = {
  isTransition: false,
  shotClock: 24,
  scoreDifferential: 0,
  gameTimeRemaining: 720,
  quarter: 1,
};

describe('Turnover System', () => {
  describe('checkTurnover', () => {
    it('should return turnover result with required fields', () => {
      const ballHandler = createMockPlayer('PG', { awareness: 80, composure: 80 });
      const defender = createMockPlayer('Def');
      const result = checkTurnover(
        ballHandler,
        defender,
        mockTacticalSettings,
        mockPossessionContext
      );

      expect(result).toHaveProperty('ball_handler_name');
      expect(result).toHaveProperty('defender_name');
      expect(result).toHaveProperty('turnover_occurred');
      expect(result).toHaveProperty('adjusted_turnover_rate');
      expect(typeof result.turnover_occurred).toBe('boolean');
    });

    it('should increase turnover rate with fast pace', () => {
      const ballHandler = createMockPlayer('PG');
      const defender = createMockPlayer('Def');
      const fastSettings = { ...mockTacticalSettings, pace: 'fast' as const };
      const result = checkTurnover(ballHandler, defender, fastSettings, mockPossessionContext);

      expect(result.pace_modifier).toBeGreaterThan(0);
    });

    it('should decrease turnover rate with slow pace', () => {
      const ballHandler = createMockPlayer('PG');
      const defender = createMockPlayer('Def');
      const slowSettings = { ...mockTacticalSettings, pace: 'slow' as const };
      const result = checkTurnover(ballHandler, defender, slowSettings, mockPossessionContext);

      expect(result.pace_modifier).toBeLessThan(0);
    });

    it('should decrease turnover rate in transition', () => {
      const ballHandler = createMockPlayer('PG');
      const defender = createMockPlayer('Def');
      const transitionContext = { ...mockPossessionContext, isTransition: true };
      const result = checkTurnover(ballHandler, defender, mockTacticalSettings, transitionContext);

      expect(result.transition_modifier).toBeLessThan(0);
    });

    it('should cap turnover rate at maximum', () => {
      const poorHandler = createMockPlayer('Poor', { awareness: 10, composure: 10 });
      const eliteDefender = createMockPlayer('Elite', { awareness: 95, composure: 95 });
      const result = checkTurnover(
        poorHandler,
        eliteDefender,
        mockTacticalSettings,
        mockPossessionContext
      );

      expect(result.adjusted_turnover_rate).toBeLessThanOrEqual(0.12); // MAX_TURNOVER_RATE
    });
  });

  describe('selectTurnoverType', () => {
    it('should return valid turnover type', () => {
      const type = selectTurnoverType(mockPossessionContext, mockTacticalSettings);
      expect(['bad_pass', 'lost_ball', 'offensive_foul', 'shot_clock', 'other_violation']).toContain(
        type
      );
    });

    it('should increase bad_pass probability with zone defense', () => {
      const zoneTypes: string[] = [];
      const manTypes: string[] = [];

      // Sample 1000 turnovers for each (increased from 100 for statistical reliability)
      for (let i = 0; i < 1000; i++) {
        zoneTypes.push(selectTurnoverType(mockPossessionContext, mockTacticalSettings, 'zone'));
        manTypes.push(selectTurnoverType(mockPossessionContext, mockTacticalSettings, 'man'));
      }

      const zoneBadPasses = zoneTypes.filter((t) => t === 'bad_pass').length;
      const manBadPasses = manTypes.filter((t) => t === 'bad_pass').length;

      expect(zoneBadPasses).toBeGreaterThan(manBadPasses);
    });

    it('should increase shot_clock violations with low shot clock', () => {
      const lowClockContext = { ...mockPossessionContext, shotClock: 3 };
      const types: string[] = [];

      for (let i = 0; i < 1000; i++) {
        types.push(selectTurnoverType(lowClockContext, mockTacticalSettings));
      }

      const shotClockCount = types.filter((t) => t === 'shot_clock').length;
      expect(shotClockCount).toBeGreaterThan(0);
    });
  });

  describe('determineStealCredit', () => {
    it('should not credit steal for offensive fouls', () => {
      const defender = createMockPlayer('Def');
      const credited = determineStealCredit(defender, 'offensive_foul');
      expect(credited).toBe(false);
    });

    it('should not credit steal for violations', () => {
      const defender = createMockPlayer('Def');
      const credited = determineStealCredit(defender, 'shot_clock');
      expect(credited).toBe(false);
    });

    it('should potentially credit steal for bad_pass', () => {
      const defender = createMockPlayer('Def', { grip_strength: 90, reactions: 90 });
      let stealCredited = false;

      // Run multiple times to check if steal can be credited
      for (let i = 0; i < 50; i++) {
        if (determineStealCredit(defender, 'bad_pass')) {
          stealCredited = true;
          break;
        }
      }

      expect(stealCredited).toBe(true); // Should credit at least one in 50 attempts
    });

    it('should potentially credit steal for lost_ball', () => {
      const defender = createMockPlayer('Def', { grip_strength: 90, reactions: 90 });
      let stealCredited = false;

      // Run multiple times to check if steal can be credited
      for (let i = 0; i < 50; i++) {
        if (determineStealCredit(defender, 'lost_ball')) {
          stealCredited = true;
          break;
        }
      }

      expect(stealCredited).toBe(true);
    });
  });

  describe('triggersTransition', () => {
    it('should trigger transition for bad_pass', () => {
      expect(triggersTransition('bad_pass')).toBe(true);
    });

    it('should trigger transition for lost_ball', () => {
      expect(triggersTransition('lost_ball')).toBe(true);
    });

    it('should trigger transition for offensive_foul', () => {
      expect(triggersTransition('offensive_foul')).toBe(true);
    });

    it('should not trigger transition for shot_clock violation', () => {
      expect(triggersTransition('shot_clock')).toBe(false);
    });

    it('should not trigger transition for other_violation', () => {
      expect(triggersTransition('other_violation')).toBe(false);
    });
  });

  describe('getTurnoverDescription', () => {
    it('should generate description for bad_pass with steal', () => {
      const desc = getTurnoverDescription('bad_pass', 'Player1', 'Defender1');
      expect(desc).toContain('bad pass');
      expect(desc).toContain('Stolen by Defender1');
      expect(desc).toContain('live ball');
    });

    it('should generate description for bad_pass without steal', () => {
      const desc = getTurnoverDescription('bad_pass', 'Player1', null);
      expect(desc).toContain('bad pass');
      expect(desc).toContain('out of bounds');
      expect(desc).toContain('dead ball');
    });

    it('should generate description for offensive_foul', () => {
      const desc = getTurnoverDescription('offensive_foul', 'Player1', null, 'Defender1');
      expect(desc).toContain('offensive foul');
      expect(desc).toContain('Defender1');
      expect(desc).toContain('dead ball');
    });

    it('should generate description for shot_clock violation', () => {
      const desc = getTurnoverDescription('shot_clock', 'Player1');
      expect(desc).toContain('Shot clock violation');
      expect(desc).toContain('dead ball');
    });
  });
});
