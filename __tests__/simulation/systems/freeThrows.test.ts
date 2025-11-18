/**
 * Tests for Free Throws System
 *
 * Validates:
 * - Free throw probability calculation
 * - Pressure modifiers (bonus, clutch, and-1)
 * - Free throw execution
 * - Result tracking
 */

import { describe, it, expect } from '@jest/globals';
import {
  FreeThrowShooter,
  simulateFreeThrowSequence,
  FREE_THROW_BASE_RATE,
  PRESSURE_MODIFIERS,
} from '../../../src/simulation/systems/freeThrows';
import type { SimulationPlayer } from '../../../src/simulation/core/types';

// Mock player data
const createMockPlayer = (
  name: string,
  attributes: Partial<SimulationPlayer> = {}
): SimulationPlayer => ({
  id: name,
  name,
  position: 'SG',
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

describe('Free Throws System', () => {
  describe('FreeThrowShooter.shootFreeThrows', () => {
    it('should return result with correct structure', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);

      expect(result).toHaveProperty('shooter');
      expect(result).toHaveProperty('attempts');
      expect(result).toHaveProperty('made');
      expect(result).toHaveProperty('points_scored');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('situation');
    });

    it('should execute correct number of attempts', () => {
      const shooter = createMockPlayer('Player1');

      const result1 = FreeThrowShooter.shootFreeThrows(shooter, 1);
      expect(result1.attempts).toBe(1);
      expect(result1.results.length).toBe(1);

      const result2 = FreeThrowShooter.shootFreeThrows(shooter, 2);
      expect(result2.attempts).toBe(2);
      expect(result2.results.length).toBe(2);

      const result3 = FreeThrowShooter.shootFreeThrows(shooter, 3);
      expect(result3.attempts).toBe(3);
      expect(result3.results.length).toBe(3);
    });

    it('should return made count between 0 and attempts', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);

      expect(result.made).toBeGreaterThanOrEqual(0);
      expect(result.made).toBeLessThanOrEqual(result.attempts);
    });

    it('should set points_scored equal to made', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);

      expect(result.points_scored).toBe(result.made);
    });

    it('should detect clutch situation in Q4 < 2min close game', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(
        shooter,
        2,
        'normal',
        4, // Q4
        100, // 1:40 remaining
        3 // close game
      );

      expect(result.situation).toBe('clutch');
    });

    it('should use and-1 situation when specified', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 1, 'and_1');

      expect(result.situation).toBe('and_1');
    });

    it('should use bonus situation when specified', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2, 'bonus');

      expect(result.situation).toBe('bonus');
    });
  });

  describe('Free Throw Probability', () => {
    it('should give elite shooter higher probability', () => {
      const eliteShooter = createMockPlayer('Elite', {
        form_technique: 95,
        throw_accuracy: 95,
        composure: 95,
      });
      const poorShooter = createMockPlayer('Poor', {
        form_technique: 40,
        throw_accuracy: 40,
        composure: 40,
      });

      // Sample 100 FTs for each
      let eliteMakes = 0;
      let poorMakes = 0;

      for (let i = 0; i < 100; i++) {
        const eliteResult = FreeThrowShooter.shootFreeThrows(eliteShooter, 1);
        const poorResult = FreeThrowShooter.shootFreeThrows(poorShooter, 1);

        if (eliteResult.results[0]) eliteMakes++;
        if (poorResult.results[0]) poorMakes++;
      }

      expect(eliteMakes).toBeGreaterThan(poorMakes);
    });

    it('should apply and-1 bonus (higher probability)', () => {
      const shooter = createMockPlayer('Player1');

      // Sample 200 FTs
      let normalMakes = 0;
      let andOneMakes = 0;

      for (let i = 0; i < 200; i++) {
        const normalResult = FreeThrowShooter.shootFreeThrows(shooter, 1, 'normal');
        const andOneResult = FreeThrowShooter.shootFreeThrows(shooter, 1, 'and_1');

        if (normalResult.results[0]) normalMakes++;
        if (andOneResult.results[0]) andOneMakes++;
      }

      // And-1 should have +5% bonus
      expect(andOneMakes).toBeGreaterThan(normalMakes);
    });

    it('should apply clutch penalty (lower probability)', () => {
      const shooter = createMockPlayer('Player1');

      // Sample 200 FTs
      let normalMakes = 0;
      let clutchMakes = 0;

      for (let i = 0; i < 200; i++) {
        const normalResult = FreeThrowShooter.shootFreeThrows(shooter, 1, 'normal');
        const clutchResult = FreeThrowShooter.shootFreeThrows(
          shooter,
          1,
          'normal',
          4,
          100,
          2 // Force clutch
        );

        if (normalResult.results[0]) normalMakes++;
        if (clutchResult.results[0]) clutchMakes++;
      }

      // Clutch should have -5% penalty
      expect(clutchMakes).toBeLessThan(normalMakes);
    });
  });

  describe('simulateFreeThrowSequence', () => {
    it('should execute sequence with correct parameters', () => {
      const shooter = createMockPlayer('Player1');
      const result = simulateFreeThrowSequence(shooter, 2, false);

      expect(result.attempts).toBe(2);
      expect(result.shooter).toBe('Player1');
    });

    it('should use and-1 situation when andOne=true', () => {
      const shooter = createMockPlayer('Player1');
      const result = simulateFreeThrowSequence(shooter, 1, true);

      expect(result.situation).toBe('and_1');
    });

    it('should use normal situation when andOne=false', () => {
      const shooter = createMockPlayer('Player1');
      const result = simulateFreeThrowSequence(shooter, 2, false);

      expect(result.situation).toBe('normal');
    });
  });

  describe('generateFreeThrowDescription', () => {
    it('should generate description for 2 FTs', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);
      const desc = FreeThrowShooter.generateFreeThrowDescription(result, 'shooting', [100, 95]);

      expect(desc).toContain('Player1');
      expect(desc).toContain('2 free throws');
    });

    it('should generate description for and-1', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 1, 'and_1');
      const desc = FreeThrowShooter.generateFreeThrowDescription(result, 'and_1', [100, 95]);

      expect(desc).toContain('and-1');
    });

    it('should show individual results', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);
      const desc = FreeThrowShooter.generateFreeThrowDescription(result, 'shooting', [100, 95]);

      expect(desc).toContain('FT 1/2');
      expect(desc).toContain('FT 2/2');
    });

    it('should show makes summary', () => {
      const shooter = createMockPlayer('Player1');
      const result = FreeThrowShooter.shootFreeThrows(shooter, 2);
      const desc = FreeThrowShooter.generateFreeThrowDescription(result, 'shooting', [100, 95]);

      expect(desc).toContain(`makes ${result.made}/${result.attempts}`);
    });
  });

  describe('Constants', () => {
    it('should have valid base rate', () => {
      expect(FREE_THROW_BASE_RATE).toBeGreaterThan(0);
      expect(FREE_THROW_BASE_RATE).toBeLessThan(1);
    });

    it('should have valid pressure modifiers', () => {
      expect(PRESSURE_MODIFIERS.normal).toBe(0);
      expect(PRESSURE_MODIFIERS.and_1).toBeGreaterThan(0);
      expect(PRESSURE_MODIFIERS.clutch).toBeLessThan(0);
      expect(PRESSURE_MODIFIERS.bonus).toBeLessThan(0);
    });
  });
});
