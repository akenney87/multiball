/**
 * Tests for Fouls System
 *
 * Validates:
 * - Shooting foul detection
 * - Non-shooting foul detection
 * - Personal foul tracking
 * - Team foul tracking and bonus
 * - Free throw allocation
 * - Foul out detection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FoulSystem } from '../../../src/simulation/systems/fouls';
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

describe('Foul System', () => {
  let foulSystem: FoulSystem;
  let homeRoster: SimulationPlayer[];
  let awayRoster: SimulationPlayer[];

  beforeEach(() => {
    homeRoster = Array.from({ length: 5 }, (_, i) => createMockPlayer(`Home${i}`));
    awayRoster = Array.from({ length: 5 }, (_, i) => createMockPlayer(`Away${i}`));
    foulSystem = new FoulSystem(homeRoster, awayRoster);
  });

  describe('Personal Foul Tracking', () => {
    it('should initialize with 0 personal fouls for all players', () => {
      expect(foulSystem.getPersonalFouls('Home0')).toBe(0);
      expect(foulSystem.getPersonalFouls('Away0')).toBe(0);
    });

    it('should increment personal fouls on shooting foul', () => {
      const shooter = homeRoster[0];
      const defender = awayRoster[0];

      // Force a foul by checking many times
      for (let i = 0; i < 100; i++) {
        const foul = foulSystem.checkShootingFoul(
          shooter,
          defender,
          1.5, // heavily contested
          'layup',
          false,
          'Away',
          1,
          '10:00'
        );
        if (foul) {
          expect(foulSystem.getPersonalFouls(defender.name)).toBeGreaterThan(0);
          break;
        }
      }
    });

    it('should detect foul out at 6 personal fouls', () => {
      const player = homeRoster[0];

      // Manually record 6 fouls
      for (let i = 0; i < 6; i++) {
        foulSystem.recordOffensiveFoul(player.name, 'Opponent', 'Home', 1, '10:00');
      }

      expect(foulSystem.isFouledOut(player.name)).toBe(true);
      expect(foulSystem.getPersonalFouls(player.name)).toBe(6);
    });
  });

  describe('Team Foul Tracking', () => {
    it('should initialize with 0 team fouls', () => {
      expect(foulSystem.getTeamFouls('Home')).toBe(0);
      expect(foulSystem.getTeamFouls('Away')).toBe(0);
    });

    it('should increment team fouls on fouls', () => {
      const initialFouls = foulSystem.getTeamFouls('Home');
      foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      expect(foulSystem.getTeamFouls('Home')).toBe(initialFouls + 1);
    });

    it('should reset team fouls on new quarter', () => {
      foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      foulSystem.recordOffensiveFoul('Home1', 'Away1', 'Home', 1, '9:00');
      expect(foulSystem.getTeamFouls('Home')).toBe(2);

      foulSystem.resetTeamFoulsForQuarter(2);
      expect(foulSystem.getTeamFouls('Home')).toBe(0);
    });

    it('should not reset personal fouls on new quarter', () => {
      foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      expect(foulSystem.getPersonalFouls('Home0')).toBe(1);

      foulSystem.resetTeamFoulsForQuarter(2);
      expect(foulSystem.getPersonalFouls('Home0')).toBe(1); // Still 1
    });
  });

  describe('Bonus Detection', () => {
    it('should not be in bonus with < 5 team fouls', () => {
      expect(foulSystem.isInBonus('Home')).toBe(false);
    });

    it('should be in bonus with >= 5 opponent team fouls', () => {
      // Give Away team 5 fouls
      for (let i = 0; i < 5; i++) {
        foulSystem.recordOffensiveFoul(`Away${i % 5}`, 'Home0', 'Away', 1, '10:00');
      }
      expect(foulSystem.getTeamFouls('Away')).toBe(5);
      expect(foulSystem.isInBonus('Home')).toBe(true); // Home is in bonus (Away has 5 fouls)
    });
  });

  describe('Free Throw Allocation', () => {
    it('should award 2 FTs for missed 2PT shot', () => {
      const shooter = homeRoster[0];
      const defender = awayRoster[0];

      // Force a shooting foul
      for (let i = 0; i < 200; i++) {
        const foul = foulSystem.checkShootingFoul(
          shooter,
          defender,
          1.0,
          'layup',
          false, // missed
          'Away',
          1,
          '10:00'
        );
        if (foul) {
          expect(foul.free_throws_awarded).toBe(2);
          break;
        }
      }
    });

    it('should award 3 FTs for missed 3PT shot', () => {
      const shooter = homeRoster[0];
      const defender = awayRoster[0];

      // Force a shooting foul
      for (let i = 0; i < 200; i++) {
        const foul = foulSystem.checkShootingFoul(
          shooter,
          defender,
          1.0,
          '3pt',
          false, // missed
          'Away',
          1,
          '10:00'
        );
        if (foul) {
          expect(foul.free_throws_awarded).toBe(3);
          break;
        }
      }
    });

    it('should award 1 FT for and-1 situation', () => {
      const shooter = homeRoster[0];
      const defender = awayRoster[0];

      // Force a shooting foul
      for (let i = 0; i < 200; i++) {
        const foul = foulSystem.checkShootingFoul(
          shooter,
          defender,
          1.0,
          'layup',
          true, // made
          'Away',
          1,
          '10:00'
        );
        if (foul) {
          expect(foul.free_throws_awarded).toBe(1);
          expect(foul.and_one).toBe(true);
          break;
        }
      }
    });

    it('should award 2 FTs for non-shooting foul in bonus', () => {
      // Give Away team 5 fouls to trigger bonus
      for (let i = 0; i < 5; i++) {
        foulSystem.recordOffensiveFoul(`Away${i % 5}`, 'Home0', 'Away', 1, '10:00');
      }

      const offensive = homeRoster[0];
      const defensive = awayRoster[0];

      // Force a non-shooting foul
      for (let i = 0; i < 200; i++) {
        const foul = foulSystem.checkNonShootingFoul(
          offensive,
          defensive,
          'drive',
          'Away',
          1,
          '9:00'
        );
        if (foul) {
          expect(foul.free_throws_awarded).toBe(2); // In bonus
          expect(foul.bonus_triggered).toBe(true);
          break;
        }
      }
    });

    it('should award 0 FTs for non-shooting foul not in bonus', () => {
      const offensive = homeRoster[0];
      const defensive = awayRoster[0];

      // Force a non-shooting foul
      for (let i = 0; i < 200; i++) {
        const foul = foulSystem.checkNonShootingFoul(
          offensive,
          defensive,
          'drive',
          'Away',
          1,
          '10:00'
        );
        if (foul) {
          expect(foul.free_throws_awarded).toBe(0); // Not in bonus
          break;
        }
      }
    });
  });

  describe('Offensive Fouls', () => {
    it('should record offensive foul with 0 FTs', () => {
      const foul = foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      expect(foul.foul_type).toBe('offensive');
      expect(foul.free_throws_awarded).toBe(0);
    });

    it('should increment personal and team fouls for offensive fouls', () => {
      foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      expect(foulSystem.getPersonalFouls('Home0')).toBe(1);
      expect(foulSystem.getTeamFouls('Home')).toBe(1);
    });
  });

  describe('Foul Summary', () => {
    it('should return accurate foul summary', () => {
      foulSystem.recordOffensiveFoul('Home0', 'Away0', 'Home', 1, '10:00');
      foulSystem.recordOffensiveFoul('Home1', 'Away1', 'Home', 1, '9:00');

      const summary = foulSystem.getFoulSummary();
      expect(summary.total_fouls).toBe(2);
      expect(summary.foul_events.length).toBe(2);
    });
  });
});
