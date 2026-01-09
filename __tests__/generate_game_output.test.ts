/**
 * Generate full game output to file
 */

import { describe, it } from '@jest/globals';
import { GameSimulator } from '../src/simulation/game/gameSimulation';
import { calculateMinutesTargets } from '../src/simulation/systems/substitutions';
import type { Player } from '../src/data/types';
import * as fs from 'fs';

// Create a player with realistic attributes
const createPlayer = (
  id: string,
  name: string,
  position: string,
  overall: number
): Player => {
  const attrs = {
    grip_strength: overall,
    arm_strength: overall,
    core_strength: overall,
    agility: overall,
    acceleration: overall,
    top_speed: overall,
    jumping: overall,
    reactions: overall,
    stamina: overall,
    balance: overall,
    height: overall,
    durability: overall,
    awareness: overall,
    creativity: overall,
    determination: overall,
    bravery: overall,
    consistency: overall,
    composure: overall,
    patience: overall,
    hand_eye_coordination: overall,
    throw_accuracy: overall,
    form_technique: overall,
    finesse: overall,
    deception: overall,
    teamwork: overall,
  };

  return {
    id,
    name,
    age: 25,
    dateOfBirth: new Date('1999-01-01'),
    position,
    attributes: attrs,
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
  } as any;
};

describe('Generate Game Output', () => {
  it('should generate full game output to file', () => {
    // Lakers roster
    const lakersRoster: Player[] = [
      createPlayer('LAL1', 'LeBron James', 'SF', 92),
      createPlayer('LAL2', 'Anthony Davis', 'PF', 90),
      createPlayer('LAL3', 'Austin Reaves', 'SG', 80),
      createPlayer('LAL4', "D'Angelo Russell", 'PG', 78),
      createPlayer('LAL5', 'Rui Hachimura', 'SF', 76),
      createPlayer('LAL6', 'Jarred Vanderbilt', 'PF', 70),
      createPlayer('LAL7', 'Taurean Prince', 'SF', 68),
      createPlayer('LAL8', 'Jaxson Hayes', 'C', 66),
      createPlayer('LAL9', 'Max Christie', 'SG', 64),
      createPlayer('LAL10', 'Cam Reddish', 'SF', 62),
    ];

    // Celtics roster
    const celticsRoster: Player[] = [
      createPlayer('BOS1', 'Jayson Tatum', 'SF', 93),
      createPlayer('BOS2', 'Jaylen Brown', 'SG', 88),
      createPlayer('BOS3', 'Kristaps Porzingis', 'C', 85),
      createPlayer('BOS4', 'Jrue Holiday', 'PG', 83),
      createPlayer('BOS5', 'Derrick White', 'SG', 79),
      createPlayer('BOS6', 'Al Horford', 'C', 75),
      createPlayer('BOS7', 'Sam Hauser', 'SF', 69),
      createPlayer('BOS8', 'Payton Pritchard', 'PG', 67),
      createPlayer('BOS9', 'Oshae Brissett', 'PF', 65),
      createPlayer('BOS10', 'Svi Mykhailiuk', 'SG', 63),
    ];

    const lakersTactical: any = {
      pace: 'standard',
      man_defense_pct: 75,
      scoring_option_1: 'LeBron James',
      scoring_option_2: 'Anthony Davis',
      scoring_option_3: 'Austin Reaves',
      minutes_allotment: {},
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
      minutes_allotment: {},
      rebounding_strategy: 'crash_glass',
      closers: ['Jayson Tatum', 'Jaylen Brown', 'Jrue Holiday'],
      timeout_strategy: 'standard',
    };

    const outputLines: string[] = [];
    outputLines.push('═'.repeat(80));
    outputLines.push('NBA SIMULATION: Los Angeles Lakers vs Boston Celtics');
    outputLines.push('═'.repeat(80));
    outputLines.push('');
    outputLines.push('MINUTES TARGETS (Automatic Calculation with Exponent = 1.0, MAX = 40 min)');
    outputLines.push('═'.repeat(80));
    outputLines.push('');

    // Show minutes targets
    outputLines.push('LAKERS                  Overall  Minutes  Quarter');
    outputLines.push('─'.repeat(80));
    const lakersWithMinutes = calculateMinutesTargets(lakersRoster);
    let lakersTotal = 0;
    for (const p of lakersWithMinutes) {
      const overall = Object.values(p.attributes).reduce((a: number, b: number) => a + b, 0) / 25;
      outputLines.push(
        `${p.name.padEnd(22)} ${overall.toFixed(0).padStart(7)}  ${p.minutesTarget.toFixed(1).padStart(7)}  ${p.quarterTarget.toFixed(1).padStart(7)}`
      );
      lakersTotal += p.minutesTarget;
    }
    outputLines.push('─'.repeat(80));
    outputLines.push(`TOTAL${' '.repeat(37)}${lakersTotal.toFixed(1).padStart(7)}`);
    outputLines.push('');

    outputLines.push('CELTICS                 Overall  Minutes  Quarter');
    outputLines.push('─'.repeat(80));
    const celticsWithMinutes = calculateMinutesTargets(celticsRoster);
    let celticsTotal = 0;
    for (const p of celticsWithMinutes) {
      const overall = Object.values(p.attributes).reduce((a: number, b: number) => a + b, 0) / 25;
      outputLines.push(
        `${p.name.padEnd(22)} ${overall.toFixed(0).padStart(7)}  ${p.minutesTarget.toFixed(1).padStart(7)}  ${p.quarterTarget.toFixed(1).padStart(7)}`
      );
      celticsTotal += p.minutesTarget;
    }
    outputLines.push('─'.repeat(80));
    outputLines.push(`TOTAL${' '.repeat(37)}${celticsTotal.toFixed(1).padStart(7)}`);
    outputLines.push('');
    outputLines.push('═'.repeat(80));
    outputLines.push('');

    console.log('Starting game simulation...');

    const simulator = new GameSimulator(
      lakersRoster,
      celticsRoster,
      lakersTactical,
      celticsTactical,
      'Lakers',
      'Celtics'
    );

    const result = simulator.simulateGame(12345);

    console.log(`\nGame complete: Lakers ${result.homeScore}, Celtics ${result.awayScore}`);

    // Add play-by-play
    outputLines.push(result.playByPlayText);

    // Write to file
    fs.writeFileSync('real_game_output.txt', outputLines.join('\n'));

    console.log('\nFull play-by-play and box score written to real_game_output.txt');
  });
});
