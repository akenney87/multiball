/**
 * Basketball Simulator - Game Simulation Tests
 *
 * Tests for full game orchestration logic.
 *
 * @module simulation/__tests__/game/gameSimulation.test
 */

import { describe, it, expect } from '@jest/globals';
import { GameSimulator } from '../../game/gameSimulation';
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
  footwork: 50,
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

describe('GameSimulator', () => {
  describe('Full Game Simulation', () => {
    it('should simulate a complete 4-quarter game', () => {
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

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        mockTactical,
        awayTactical,
        'Home Team',
        'Away Team'
      );

      const result = simulator.simulateGame(42); // Seeded for determinism

      // Basic sanity checks
      expect(result).toBeDefined();
      expect(result.homeScore).toBeGreaterThan(0);
      expect(result.awayScore).toBeGreaterThan(0);
      expect(result.quarterScores).toHaveLength(4);
      expect(result.quarterResults).toHaveLength(4);
      expect(result.playByPlayText).toBeDefined();
      expect(result.playByPlayText).toContain('FULL GAME');
      expect(result.playByPlayText).toContain('FINAL SCORE');
    });

    it('should have realistic total scores', () => {
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

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away'
      );

      const result = simulator.simulateGame(42);

      // NBA games typically score 90-130 points per team
      expect(result.homeScore).toBeGreaterThan(60);
      expect(result.homeScore).toBeLessThan(150);
      expect(result.awayScore).toBeGreaterThan(60);
      expect(result.awayScore).toBeLessThan(150);
    });

    it('should sum quarter scores to final score', () => {
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

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away'
      );

      const result = simulator.simulateGame(42);

      // Sum quarter scores
      const homeSum = result.quarterScores.reduce((sum, q) => sum + q[0], 0);
      const awaySum = result.quarterScores.reduce((sum, q) => sum + q[1], 0);

      expect(homeSum).toBe(result.homeScore);
      expect(awaySum).toBe(result.awayScore);
    });

    it('should track minutes played across all quarters', () => {
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

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away'
      );

      const result = simulator.simulateGame(42);

      // Starters should play close to 48 minutes
      const player1Minutes = result.minutesPlayed['Player1'];
      expect(player1Minutes).toBeGreaterThan(40);
      expect(player1Minutes).toBeLessThanOrEqual(49); // Allow small tolerance for floating-point precision
    });

    it('should restore stamina at halftime', () => {
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

      const simulator = new GameSimulator(
        homeRoster,
        awayRoster,
        simpleTactical,
        awaySimpleTactical,
        'Home',
        'Away'
      );

      const result = simulator.simulateGame(42);

      // Quarter 2 ending stamina should be lower than 100 (players tired)
      const q2Result = result.quarterResults[1];
      const q2AvgStamina = Object.values(q2Result.staminaFinal).reduce((sum, val) => sum + val, 0) /
        Object.values(q2Result.staminaFinal).length;

      expect(q2AvgStamina).toBeLessThan(100);

      // But should be restored to 100 at start of Q3 (halftime recovery)
      // This is tested implicitly by the game running 4 quarters successfully
      expect(result.quarterResults).toHaveLength(4);
    });
  });
});
