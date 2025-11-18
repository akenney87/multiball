/**
 * Basketball Simulator - Quarter Simulation Tests
 *
 * Tests for quarter orchestration logic.
 *
 * @module simulation/__tests__/game/quarterSimulation.test
 */

import { describe, it, expect } from '@jest/globals';
import { QuarterSimulator } from '../../game/quarterSimulation';
import type { Player, TacticalSettings } from '../../../data/types';

// Mock player helper
const mockPlayer = (name: string, position: string = 'PG', overrides: Partial<Player> = {}): Player => ({
  id: name,
  name,
  position,
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
  ...overrides,
});

// Mock tactical settings
const mockTactical: TacticalSettings = {
  pace: 'standard',
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
    Player6: 16,
    Player7: 12,
    Player8: 8,
  },
  rebounding_strategy: 'standard',
  closers: [],
  timeout_strategy: 'normal',
};

describe('QuarterSimulator', () => {
  describe('Quarter Simulation', () => {
    it('should simulate a complete quarter', () => {
      const homeRoster = [
        mockPlayer('Player1', 'PG'),
        mockPlayer('Player2', 'SG'),
        mockPlayer('Player3', 'SF'),
        mockPlayer('Player4', 'PF'),
        mockPlayer('Player5', 'C'),
        mockPlayer('Player6', 'PG'),
        mockPlayer('Player7', 'SG'),
        mockPlayer('Player8', 'SF'),
      ];

      const awayRoster = [
        mockPlayer('Away1', 'PG'),
        mockPlayer('Away2', 'SG'),
        mockPlayer('Away3', 'SF'),
        mockPlayer('Away4', 'PF'),
        mockPlayer('Away5', 'C'),
        mockPlayer('Away6', 'PG'),
        mockPlayer('Away7', 'SG'),
        mockPlayer('Away8', 'SF'),
      ];

      const awayTactical = {
        ...mockTactical,
        scoring_option_1: 'Away1',
        scoring_option_2: 'Away2',
        scoring_option_3: 'Away3',
        minutes_allotment: {
          Away1: 36,
          Away2: 32,
          Away3: 28,
          Away4: 24,
          Away5: 20,
          Away6: 16,
          Away7: 12,
          Away8: 8,
        },
      };

      const simulator = new QuarterSimulator(
        homeRoster,
        awayRoster,
        mockTactical,
        awayTactical,
        'Home Team',
        'Away Team',
        1
      );

      const result = simulator.simulateQuarter(42); // Seeded for determinism

      // Basic sanity checks
      expect(result).toBeDefined();
      expect(result.homeScore).toBeGreaterThanOrEqual(0);
      expect(result.awayScore).toBeGreaterThanOrEqual(0);
      expect(result.possessionCount).toBeGreaterThan(0);
      expect(result.playByPlayText).toBeDefined();
      expect(result.playByPlayText.length).toBeGreaterThan(0);
      expect(result.homeEndingLineup).toHaveLength(5);
      expect(result.awayEndingLineup).toHaveLength(5);
    });

    it('should track stamina degradation', () => {
      const homeRoster = [
        mockPlayer('Player1', 'PG'),
        mockPlayer('Player2', 'SG'),
        mockPlayer('Player3', 'SF'),
        mockPlayer('Player4', 'PF'),
        mockPlayer('Player5', 'C'),
      ];

      const awayRoster = [
        mockPlayer('Away1', 'PG'),
        mockPlayer('Away2', 'SG'),
        mockPlayer('Away3', 'SF'),
        mockPlayer('Away4', 'PF'),
        mockPlayer('Away5', 'C'),
      ];

      const simpleTactical = {
        ...mockTactical,
        minutes_allotment: {
          Player1: 48,
          Player2: 48,
          Player3: 48,
          Player4: 48,
          Player5: 48,
        },
      };

      const awaySimpleTactical = {
        ...simpleTactical,
        scoring_option_1: 'Away1',
        minutes_allotment: {
          Away1: 48,
          Away2: 48,
          Away3: 48,
          Away4: 48,
          Away5: 48,
        },
      };

      const simulator = new QuarterSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away',
        1
      );

      const result = simulator.simulateQuarter(42);

      // Active players should have lower stamina after a full quarter
      const staminaValues = Object.values(result.staminaFinal);
      const avgStamina = staminaValues.reduce((sum, val) => sum + val, 0) / staminaValues.length;

      expect(avgStamina).toBeLessThan(100); // Stamina should decrease
      expect(avgStamina).toBeGreaterThan(50); // But not drop too low in just one quarter
    });

    it('should track minutes played', () => {
      const homeRoster = [
        mockPlayer('Player1', 'PG'),
        mockPlayer('Player2', 'SG'),
        mockPlayer('Player3', 'SF'),
        mockPlayer('Player4', 'PF'),
        mockPlayer('Player5', 'C'),
      ];

      const awayRoster = [
        mockPlayer('Away1', 'PG'),
        mockPlayer('Away2', 'SG'),
        mockPlayer('Away3', 'SF'),
        mockPlayer('Away4', 'PF'),
        mockPlayer('Away5', 'C'),
      ];

      const simpleTactical = {
        ...mockTactical,
        minutes_allotment: {
          Player1: 48,
          Player2: 48,
          Player3: 48,
          Player4: 48,
          Player5: 48,
        },
      };

      const awaySimpleTactical = {
        ...simpleTactical,
        scoring_option_1: 'Away1',
        minutes_allotment: {
          Away1: 48,
          Away2: 48,
          Away3: 48,
          Away4: 48,
          Away5: 48,
        },
      };

      const simulator = new QuarterSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away',
        1
      );

      const result = simulator.simulateQuarter(42);

      // Active players should have ~12 minutes (one quarter)
      const player1Minutes = result.minutesPlayed['Player1'];
      expect(player1Minutes).toBeGreaterThan(10);
      expect(player1Minutes).toBeLessThan(14); // ~12 minutes for full quarter
    });
  });
});
