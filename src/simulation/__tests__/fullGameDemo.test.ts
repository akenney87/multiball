/**
 * Full game simulation demo with complete rosters
 */

import { describe, it } from '@jest/globals';
import { GameSimulator } from '../game/gameSimulation';
import type { Player } from '../../data/types';

// Create a player with realistic attributes
const createPlayer = (
  id: string,
  name: string,
  position: string,
  overall: number
): Player => ({
  id,
  name,
  age: 25,
  dateOfBirth: new Date('1999-01-01'),
  position,
  attributes: {
    grip_strength: overall + Math.floor(Math.random() * 10 - 5),
    arm_strength: overall + Math.floor(Math.random() * 10 - 5),
    core_strength: overall + Math.floor(Math.random() * 10 - 5),
    agility: overall + Math.floor(Math.random() * 10 - 5),
    acceleration: overall + Math.floor(Math.random() * 10 - 5),
    top_speed: overall + Math.floor(Math.random() * 10 - 5),
    jumping: overall + Math.floor(Math.random() * 10 - 5),
    reactions: overall + Math.floor(Math.random() * 10 - 5),
    stamina: overall + Math.floor(Math.random() * 10 - 5),
    balance: overall + Math.floor(Math.random() * 10 - 5),
    height: overall + Math.floor(Math.random() * 10 - 5),
    durability: overall + Math.floor(Math.random() * 10 - 5),
    awareness: overall + Math.floor(Math.random() * 10 - 5),
    creativity: overall + Math.floor(Math.random() * 10 - 5),
    determination: overall + Math.floor(Math.random() * 10 - 5),
    bravery: overall + Math.floor(Math.random() * 10 - 5),
    consistency: overall + Math.floor(Math.random() * 10 - 5),
    composure: overall + Math.floor(Math.random() * 10 - 5),
    patience: overall + Math.floor(Math.random() * 10 - 5),
    hand_eye_coordination: overall + Math.floor(Math.random() * 10 - 5),
    throw_accuracy: overall + Math.floor(Math.random() * 10 - 5),
    form_technique: overall + Math.floor(Math.random() * 10 - 5),
    finesse: overall + Math.floor(Math.random() * 10 - 5),
    deception: overall + Math.floor(Math.random() * 10 - 5),
    teamwork: overall + Math.floor(Math.random() * 10 - 5),
  },
  potentials: { physical: overall, mental: overall, technical: overall },
  peakAges: { physical: 26, mental: 30, technical: 28 },
  trainingFocus: { physical: 33, mental: 33, technical: 34 },
  weeklyXP: { physical: 0, mental: 0, technical: 0 },
  careerStats: {
    gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
    minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
  },
  contract: null,
  injury: null,
  currentSeasonStats: {
    gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
    minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
  },
  teamId: 'team',
  acquisitionType: 'starter',
  acquisitionDate: new Date('2024-01-01'),
} as any);

describe('Full Game Demo', () => {
  it('should simulate Lakers vs Celtics with full play-by-play', () => {
    // Lakers roster
    const lakersRoster: Player[] = [
      createPlayer('LAL1', 'LeBron James', 'SF', 78),
      createPlayer('LAL2', 'Anthony Davis', 'PF', 80),
      createPlayer('LAL3', "D'Angelo Russell", 'PG', 75),
      createPlayer('LAL4', 'Austin Reaves', 'SG', 72),
      createPlayer('LAL5', 'Rui Hachimura', 'SF', 70),
      createPlayer('LAL6', 'Jarred Vanderbilt', 'PF', 68),
      createPlayer('LAL7', 'Taurean Prince', 'SF', 65),
      createPlayer('LAL8', 'Jaxson Hayes', 'C', 63),
      createPlayer('LAL9', 'Cam Reddish', 'SG', 62),
      createPlayer('LAL10', 'Max Christie', 'SG', 60),
    ];

    // Celtics roster
    const celticsRoster: Player[] = [
      createPlayer('BOS1', 'Jayson Tatum', 'SF', 82),
      createPlayer('BOS2', 'Jaylen Brown', 'SG', 80),
      createPlayer('BOS3', 'Derrick White', 'PG', 76),
      createPlayer('BOS4', 'Jrue Holiday', 'SG', 77),
      createPlayer('BOS5', 'Al Horford', 'C', 74),
      createPlayer('BOS6', 'Kristaps Porzingis', 'C', 78),
      createPlayer('BOS7', 'Sam Hauser', 'SF', 67),
      createPlayer('BOS8', 'Payton Pritchard', 'PG', 65),
      createPlayer('BOS9', 'Oshae Brissett', 'PF', 63),
      createPlayer('BOS10', 'Svi Mykhailiuk', 'SG', 61),
    ];

    const lakersTactical: any = {
      pace: 'standard',
      man_defense_pct: 75,
      scoring_option_1: 'LeBron James',
      scoring_option_2: 'Anthony Davis',
      scoring_option_3: "D'Angelo Russell",
      minutes_allotment: {
        'LeBron James': 36,
        'Anthony Davis': 35,
        "D'Angelo Russell": 32,
        'Austin Reaves': 28,
        'Rui Hachimura': 26,
        'Jarred Vanderbilt': 22,
        'Taurean Prince': 18,
        'Jaxson Hayes': 16,
        'Cam Reddish': 12,
        'Max Christie': 8,
      },
      rebounding_strategy: 'standard',
      closers: ['LeBron James', 'Anthony Davis'],
      timeout_strategy: 'aggressive',
    };

    const celticsTactical: any = {
      pace: 'fast',
      man_defense_pct: 80,
      scoring_option_1: 'Jayson Tatum',
      scoring_option_2: 'Jaylen Brown',
      scoring_option_3: 'Kristaps Porzingis',
      minutes_allotment: {
        'Jayson Tatum': 38,
        'Jaylen Brown': 36,
        'Derrick White': 32,
        'Jrue Holiday': 30,
        'Al Horford': 28,
        'Kristaps Porzingis': 25,
        'Sam Hauser': 20,
        'Payton Pritchard': 18,
        'Oshae Brissett': 12,
        'Svi Mykhailiuk': 8,
      },
      rebounding_strategy: 'crash_glass',
      closers: ['Jayson Tatum', 'Jaylen Brown', 'Jrue Holiday'],
      timeout_strategy: 'standard',
    };

    console.log('\n' + '='.repeat(80));
    console.log('NBA SIMULATION: Los Angeles Lakers vs Boston Celtics');
    console.log('='.repeat(80) + '\n');

    const simulator = new GameSimulator(
      lakersRoster,
      celticsRoster,
      lakersTactical,
      celticsTactical,
      'Lakers',
      'Celtics'
    );

    const result = simulator.simulateGame(12345);

    console.log('\n' + '='.repeat(80));
    console.log('FINAL SCORE');
    console.log('='.repeat(80));
    console.log(`Lakers: ${result.homeScore}`);
    console.log(`Celtics: ${result.awayScore}`);
    console.log(`Winner: ${result.homeScore > result.awayScore ? 'Lakers' : 'Celtics'}`);
    console.log();

    console.log('='.repeat(80));
    console.log('QUARTER-BY-QUARTER SCORING');
    console.log('='.repeat(80));
    result.quarterScores.forEach((scores, idx) => {
      console.log(`Q${idx + 1}: Lakers ${scores[0]} - Celtics ${scores[1]}`);
    });
    console.log();

    console.log('='.repeat(80));
    console.log('MINUTES PLAYED');
    console.log('='.repeat(80));
    console.log('\nLAKERS:');
    Object.entries(result.minutesPlayed)
      .filter(([name]) => lakersRoster.some(p => p.name === name))
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, minutes]) => {
        console.log(`  ${name.padEnd(25)} ${minutes.toFixed(1)} min`);
      });

    console.log('\nCELTICS:');
    Object.entries(result.minutesPlayed)
      .filter(([name]) => celticsRoster.some(p => p.name === name))
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, minutes]) => {
        console.log(`  ${name.padEnd(25)} ${minutes.toFixed(1)} min`);
      });

    console.log();
    console.log('='.repeat(80));
    console.log('PLAY-BY-PLAY LOG');
    console.log('='.repeat(80));
    console.log(result.playByPlayText);
  });
});
