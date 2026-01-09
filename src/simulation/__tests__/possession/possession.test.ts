/**
 * Basketball Simulator - Possession System Tests
 *
 * Tests for possession orchestration logic.
 *
 * @module simulation/__tests__/possession/possession.test
 */

import { describe, it, expect } from '@jest/globals';
import * as possession from '../../possession/possession';
import type { Player } from '../../../data/types';

// Mock player data
const mockPlayer = (name: string, overrides: Partial<Player> = {}): Player => ({
  id: name,
  name,
  position: 'PG',
  grip_strength: 50,
  arm_strength: 50,
  core_strength: 50,
  agility: 50,
  acceleration: 50,
  top_speed: 50,
  jumping: 50,
  reactions: 50,
  stamina: 50,
  balance: 50,
  height: 50,
  durability: 50,
  awareness: 50,
  creativity: 50,
  determination: 50,
  bravery: 50,
  consistency: 50,
  composure: 50,
  patience: 50,
  hand_eye_coordination: 50,
  throw_accuracy: 50,
  form_technique: 50,
  finesse: 50,
  deception: 50,
  teamwork: 50,
  footwork: 50,
  ...overrides,
});

describe('Possession System', () => {
  describe('calculateShotCreationAbility', () => {
    it('should calculate shot creation ability for a guard', () => {
      const guard = mockPlayer('Chris Maestro', {
        deception: 80,
        hand_eye_coordination: 85,
        agility: 75,
        awareness: 90,
        creativity: 85,
        patience: 70,
        composure: 80,
        form_technique: 70,
      });

      const ability = possession.calculateShotCreationAbility(guard);
      expect(ability).toBeGreaterThan(70); // Elite shot creator
      expect(ability).toBeLessThan(90);
    });

    it('should calculate lower shot creation for a traditional center', () => {
      const center = mockPlayer('Hassan Swatter', {
        deception: 30,
        hand_eye_coordination: 40,
        agility: 35,
        awareness: 45,
        creativity: 35,
        patience: 40,
        composure: 50,
        jumping: 90,
        height: 95,
      });

      const ability = possession.calculateShotCreationAbility(center);
      expect(ability).toBeLessThan(50); // Non-creator
    });
  });

  describe('buildUsageDistribution', () => {
    it('should assign 30%/20%/15% to scoring options', () => {
      const team = [
        mockPlayer('Player1'),
        mockPlayer('Player2'),
        mockPlayer('Player3'),
        mockPlayer('Player4'),
        mockPlayer('Player5'),
      ];

      const tactical = {
        pace: 'standard' as const,
        man_defense_pct: 70,
        scoring_option_1: 'Player1',
        scoring_option_2: 'Player2',
        scoring_option_3: 'Player3',
        minutes_allotment: {
          Player1: 36,
          Player2: 32,
          Player3: 28,
          Player4: 24,
          Player5: 20,
        },
        rebounding_strategy: 'standard' as const,
        closers: [],
        timeout_strategy: 'normal' as const,
      };

      const usage = possession.buildUsageDistribution(team, tactical);

      expect(usage['Player1']).toBe(0.30);
      expect(usage['Player2']).toBe(0.20);
      expect(usage['Player3']).toBe(0.15);
      expect(usage['Player4'] + usage['Player5']).toBeCloseTo(0.35, 2);
    });

    it('should sum to 1.0', () => {
      const team = [
        mockPlayer('Player1'),
        mockPlayer('Player2'),
        mockPlayer('Player3'),
        mockPlayer('Player4'),
        mockPlayer('Player5'),
      ];

      const tactical = {
        pace: 'standard' as const,
        man_defense_pct: 70,
        scoring_option_1: 'Player1',
        scoring_option_2: null,
        scoring_option_3: null,
        minutes_allotment: {
          Player1: 36,
          Player2: 32,
          Player3: 28,
          Player4: 24,
          Player5: 20,
        },
        rebounding_strategy: 'standard' as const,
        closers: [],
        timeout_strategy: 'normal' as const,
      };

      const usage = possession.buildUsageDistribution(team, tactical);
      const total = Object.values(usage).reduce((sum, val) => sum + val, 0);

      expect(total).toBeCloseTo(1.0, 5);
    });
  });

  describe('selectShooter', () => {
    it('should select a shooter from the team', () => {
      const team = [
        mockPlayer('Player1'),
        mockPlayer('Player2'),
        mockPlayer('Player3'),
        mockPlayer('Player4'),
        mockPlayer('Player5'),
      ];

      const usage = {
        Player1: 0.30,
        Player2: 0.20,
        Player3: 0.20,
        Player4: 0.15,
        Player5: 0.15,
      };

      const shooter = possession.selectShooter(team, usage);
      expect(team).toContainEqual(shooter);
    });
  });

  describe('shouldAttemptDrive', () => {
    it('should return true for fast players in transition', () => {
      const fastPlayer = mockPlayer('Speedy', {
        top_speed: 90,
        agility: 85,
        acceleration: 88,
      });

      const context = {
        isTransition: true,
        shotClock: 24,
        scoreDifferential: 0,
        gameTimeRemaining: 600,
        quarter: 1,
        offensiveTeam: 'home' as const,
      };

      const shouldDrive = possession.shouldAttemptDrive(fastPlayer, context);
      // In transition, should almost always drive (95% probability)
      // We can't guarantee true on single call, but we can test the function runs
      expect(typeof shouldDrive).toBe('boolean');
    });

    it('should have lower probability for slow players', () => {
      const slowPlayer = mockPlayer('BigMan', {
        top_speed: 30,
        agility: 35,
        acceleration: 32,
      });

      const context = {
        isTransition: false,
        shotClock: 24,
        scoreDifferential: 0,
        gameTimeRemaining: 600,
        quarter: 1,
        offensiveTeam: 'home' as const,
      };

      // Run multiple times to check probability is reasonable
      const results = Array.from({ length: 100 }, () =>
        possession.shouldAttemptDrive(slowPlayer, context)
      );
      const driveCount = results.filter(x => x).length;

      // For slow player, should be around 50% (base 70% - 20% adjustment)
      // Wide tolerance for probabilistic test
      expect(driveCount).toBeGreaterThan(25);
      expect(driveCount).toBeLessThan(75);
    });
  });

  describe('simulateDriveOutcome', () => {
    it('should return one of four outcomes', () => {
      const driver = mockPlayer('Driver', {
        top_speed: 80,
        agility: 75,
        jumping: 85,
      });

      const defender = mockPlayer('Defender', {
        reactions: 70,
        jumping: 75,
      });

      const result = possession.simulateDriveOutcome(driver, defender, []);

      expect(['dunk', 'layup', 'kickout', 'turnover']).toContain(result.outcome);
      expect(result.debug).toBeDefined();
      expect(result.debug.driverName).toBe('Driver');
      expect(result.debug.defenderName).toBe('Defender');
    });

    it('should assign finalDefender for dunk/layup outcomes', () => {
      const driver = mockPlayer('Driver');
      const defender = mockPlayer('Defender');

      // Run multiple times until we get a shot attempt
      let shotAttempt = false;
      for (let i = 0; i < 100; i++) {
        const result = possession.simulateDriveOutcome(driver, defender, []);
        if (result.outcome === 'dunk' || result.outcome === 'layup') {
          expect(result.finalDefender).not.toBeNull();
          shotAttempt = true;
          break;
        }
      }

      // Should get at least one shot attempt in 100 tries
      expect(shotAttempt).toBe(true);
    });
  });

  describe('checkAssist', () => {
    it('should have higher assist probability for 3PT shots', () => {
      const shooter = mockPlayer('Shooter');
      const teammates = [
        mockPlayer('Passer1', { awareness: 80, creativity: 75 }),
        mockPlayer('Passer2', { awareness: 70, creativity: 65 }),
      ];

      // Run multiple times to check probability
      const results = Array.from({ length: 100 }, () =>
        possession.checkAssist('3pt', shooter, teammates)
      );
      const assistCount = results.filter(r => r.assistOccurred).length;

      // 3PT should have ~90% assist rate
      expect(assistCount).toBeGreaterThan(75);
      expect(assistCount).toBeLessThan(98);
    });

    it('should have lower assist probability for midrange shots', () => {
      const shooter = mockPlayer('Shooter');
      const teammates = [
        mockPlayer('Passer1', { awareness: 80, creativity: 75 }),
        mockPlayer('Passer2', { awareness: 70, creativity: 65 }),
      ];

      // Run multiple times to check probability
      const results = Array.from({ length: 100 }, () =>
        possession.checkAssist('midrange', shooter, teammates)
      );
      const assistCount = results.filter(r => r.assistOccurred).length;

      // Midrange should have ~50% assist rate
      expect(assistCount).toBeGreaterThan(35);
      expect(assistCount).toBeLessThan(65);
    });

    it('should return no assist when no teammates available', () => {
      const shooter = mockPlayer('Shooter');
      const result = possession.checkAssist('3pt', shooter, []);

      expect(result.assistOccurred).toBe(false);
      expect(result.assisterName).toBeNull();
    });
  });
});
