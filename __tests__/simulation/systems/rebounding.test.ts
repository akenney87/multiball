/**
 * Tests for Rebounding System
 *
 * Validates:
 * - Rebounder selection based on strategy
 * - Team strength calculations with defensive advantage
 * - OREB probability calculations
 * - Putback attempt logic
 * - Complete rebound simulation flow
 */

import { describe, it, expect } from '@jest/globals';
import {
  getReboundersForStrategy,
  calculateTeamReboundingStrength,
  calculateOffensiveReboundProbability,
  checkPutbackAttempt,
  simulateRebound,
} from '../../../src/simulation/systems/rebounding';
import type { SimulationPlayer } from '../../../src/simulation/core/types';

// Mock player data
const createMockPlayer = (
  name: string,
  height: number = 75,
  reboundAttributes: Partial<SimulationPlayer> = {}
): SimulationPlayer => ({
  id: name,
  name,
  position: 'PF',
  height,
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
  footwork: 70,
  ...reboundAttributes,
});

describe('Rebounding System', () => {
  describe('getReboundersForStrategy', () => {
    it('should select 5 offensive rebounders for crash_glass strategy', () => {
      const team = Array.from({ length: 5 }, (_, i) => createMockPlayer(`Player${i}`));
      const rebounders = getReboundersForStrategy(team, 'crash_glass', true);
      expect(rebounders.length).toBe(5);
    });

    it('should select 2 offensive rebounders for standard strategy', () => {
      const team = Array.from({ length: 5 }, (_, i) => createMockPlayer(`Player${i}`));
      const rebounders = getReboundersForStrategy(team, 'standard', true);
      expect(rebounders.length).toBe(2);
    });

    it('should select 1 offensive rebounder for prevent_transition strategy', () => {
      const team = Array.from({ length: 5 }, (_, i) => createMockPlayer(`Player${i}`));
      const rebounders = getReboundersForStrategy(team, 'prevent_transition', true);
      expect(rebounders.length).toBe(1);
    });

    it('should select best rebounders based on composite', () => {
      const team = [
        createMockPlayer('Elite', 85, { jumping: 90, height: 90 }),
        createMockPlayer('Average', 75, { jumping: 70, height: 70 }),
        createMockPlayer('Poor', 65, { jumping: 50, height: 60 }),
        createMockPlayer('Good', 80, { jumping: 80, height: 80 }),
        createMockPlayer('Weak', 60, { jumping: 40, height: 50 }),
      ];
      const rebounders = getReboundersForStrategy(team, 'standard', true);
      expect(rebounders.length).toBe(2);
      // Should select Elite and Good (top 2 composites)
      expect(rebounders[0].name).toBe('Elite');
      expect(rebounders[1].name).toBe('Good');
    });
  });

  describe('calculateTeamReboundingStrength', () => {
    it('should calculate average composite for rebounders', () => {
      const rebounders = [
        createMockPlayer('P1', 75, { jumping: 80, height: 80 }),
        createMockPlayer('P2', 75, { jumping: 60, height: 60 }),
      ];
      const strength = calculateTeamReboundingStrength(rebounders, false);
      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThan(100);
    });

    it('should apply 15% defensive advantage when isDefense=true', () => {
      const rebounders = [createMockPlayer('P1', 75, { jumping: 70, height: 70 })];
      const offensiveStrength = calculateTeamReboundingStrength(rebounders, false);
      const defensiveStrength = calculateTeamReboundingStrength(rebounders, true);
      expect(defensiveStrength).toBeCloseTo(offensiveStrength * 1.15, 1);
    });

    it('should return 0 for empty rebounders array', () => {
      const strength = calculateTeamReboundingStrength([], false);
      expect(strength).toBe(0);
    });
  });

  describe('calculateOffensiveReboundProbability', () => {
    it('should return probability between 0 and 1', () => {
      const [prob] = calculateOffensiveReboundProbability(70, 80, '3pt', 'standard', 'standard');
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('should apply 3PT shot modifier (decrease probability)', () => {
      const [prob3pt] = calculateOffensiveReboundProbability(70, 70, '3pt', 'standard', 'standard');
      const [probRim] = calculateOffensiveReboundProbability(70, 70, 'rim', 'standard', 'standard');
      expect(prob3pt).toBeLessThan(probRim);
    });

    it('should increase probability with crash_glass strategy', () => {
      const [probStandard] = calculateOffensiveReboundProbability(
        70,
        70,
        'rim',
        'standard',
        'standard'
      );
      const [probCrash] = calculateOffensiveReboundProbability(
        70,
        70,
        'rim',
        'crash_glass',
        'standard'
      );
      expect(probCrash).toBeGreaterThan(probStandard);
    });
  });

  describe('checkPutbackAttempt', () => {
    it('should not attempt putback if height <= 75', () => {
      const rebounder = createMockPlayer('Short', 70);
      const defenders = [createMockPlayer('Def1')];
      const [attempted] = checkPutbackAttempt(rebounder, defenders);
      expect(attempted).toBe(false);
    });

    it('should attempt putback if height > 75', () => {
      const rebounder = createMockPlayer('Tall', 85);
      const defenders = [createMockPlayer('Def1')];
      const [attempted] = checkPutbackAttempt(rebounder, defenders);
      expect(attempted).toBe(true);
    });

    it('should return made result when putback attempted', () => {
      const rebounder = createMockPlayer('Tall', 85, { finesse: 90 });
      const defenders = [createMockPlayer('Def1', 75, { finesse: 30 })];
      const [attempted, made] = checkPutbackAttempt(rebounder, defenders);
      expect(attempted).toBe(true);
      expect(typeof made).toBe('boolean');
    });
  });

  describe('simulateRebound', () => {
    it('should return no rebound when shot made', () => {
      const offense = Array.from({ length: 5 }, (_, i) => createMockPlayer(`O${i}`));
      const defense = Array.from({ length: 5 }, (_, i) => createMockPlayer(`D${i}`));
      const result = simulateRebound(
        offense,
        defense,
        'standard',
        'standard',
        'rim',
        true // shot made
      );
      expect(result.rebound_occurred).toBe(false);
    });

    it('should simulate complete rebound when shot missed', () => {
      const offense = Array.from({ length: 5 }, (_, i) => createMockPlayer(`O${i}`));
      const defense = Array.from({ length: 5 }, (_, i) => createMockPlayer(`D${i}`));
      const result = simulateRebound(
        offense,
        defense,
        'standard',
        'standard',
        'rim',
        false // shot missed
      );
      expect(result.rebound_occurred).toBe(true);
      expect(result.rebounder_name).toBeDefined();
      expect(['offense', 'defense']).toContain(result.rebounding_team);
    });

    it('should check for putback on offensive rebounds', () => {
      const offense = Array.from({ length: 5 }, (_, i) =>
        createMockPlayer(`O${i}`, 85, { jumping: 90 })
      );
      const defense = Array.from({ length: 5 }, (_, i) => createMockPlayer(`D${i}`));

      // Run multiple times to get an offensive rebound
      let orebFound = false;
      for (let i = 0; i < 50; i++) {
        const result = simulateRebound(offense, defense, 'crash_glass', 'standard', 'rim', false);
        if (result.offensive_rebound) {
          orebFound = true;
          expect(result.putback_attempted).toBeDefined();
          expect(result.oreb_outcome).toBeDefined();
          break;
        }
      }
      expect(orebFound).toBe(true); // Should find at least one OREB in 50 attempts
    });
  });
});
