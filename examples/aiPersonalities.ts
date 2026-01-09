/**
 * AI Personalities Example
 *
 * Demonstrates how different AI personalities make different decisions.
 * Run with: npx ts-node examples/aiPersonalities.ts
 */

import { createAIConfig, getDecisionThresholds } from '../src/ai/personality';
import { evaluatePlayer, comparePlayersByPosition } from '../src/ai/evaluation';
import { shouldReleasePlayer, prioritizeScouting } from '../src/ai/roster';
import { choosePaceStrategy, setDefenseStrategy, allocateMinutes } from '../src/ai/tactical';
import type { Player } from '../src/data/types';
import type { DecisionContext, AIConfig } from '../src/ai/types';

// =============================================================================
// MOCK DATA
// =============================================================================

function createMockPlayer(
  id: string,
  position: string,
  attributeLevel: number,
  age: number
): Player {
  const attrs = {
    grip_strength: attributeLevel,
    arm_strength: attributeLevel,
    core_strength: attributeLevel,
    agility: attributeLevel,
    acceleration: attributeLevel,
    top_speed: attributeLevel,
    jumping: attributeLevel,
    reactions: attributeLevel,
    stamina: attributeLevel,
    balance: attributeLevel,
    height: attributeLevel,
    durability: attributeLevel,
    awareness: attributeLevel,
    creativity: attributeLevel,
    determination: attributeLevel,
    bravery: attributeLevel,
    consistency: attributeLevel,
    composure: attributeLevel,
    patience: attributeLevel,
    hand_eye_coordination: attributeLevel,
    throw_accuracy: attributeLevel,
    form_technique: attributeLevel,
    finesse: attributeLevel,
    deception: attributeLevel,
    teamwork: attributeLevel,
  };

  return {
    id,
    name: `Player ${id}`,
    age,
    dateOfBirth: new Date(2000 - age, 0, 1),
    position: position as any,
    attributes: attrs,
    potentials: { physical: 80, mental: 80, technical: 80 },
    peakAges: { physical: 27, technical: 29, mental: 31 },
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: { physical: 0, mental: 0, technical: 0 },
    careerStats: {
      gamesPlayed: { basketball: 50, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 500, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 1000, baseball: 0, soccer: 0 },
    },
    currentSeasonStats: {
      gamesPlayed: { basketball: 10, baseball: 0, soccer: 0 },
      totalPoints: { basketball: 100, baseball: 0, soccer: 0 },
      minutesPlayed: { basketball: 200, baseball: 0, soccer: 0 },
    },
    teamId: 'team-1',
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
  } as Player;
}

function createDecisionContext(): DecisionContext {
  return {
    week: 20,
    transferWindowOpen: true,
    finance: { available: 5000000, total: 20000000 },
    standings: { position: 10, gamesPlayed: 20, wins: 10, losses: 10 },
  };
}

// =============================================================================
// DEMONSTRATIONS
// =============================================================================

function demonstrateThresholds() {
  console.log('\n' + '='.repeat(60));
  console.log('1. DECISION THRESHOLDS BY PERSONALITY');
  console.log('='.repeat(60));

  const personalities = ['conservative', 'balanced', 'aggressive'] as const;

  console.log('\nThreshold | Conservative | Balanced | Aggressive');
  console.log('-'.repeat(55));

  const configs = personalities.map((p) => createAIConfig(p));
  const thresholds = configs.map((c) => getDecisionThresholds(c));

  console.log(
    `Release   | ${thresholds[0].releasePlayerRating.toString().padStart(12)} | ${thresholds[1].releasePlayerRating.toString().padStart(8)} | ${thresholds[2].releasePlayerRating}`
  );
  console.log(
    `Sign      | ${thresholds[0].signPlayerRating.toString().padStart(12)} | ${thresholds[1].signPlayerRating.toString().padStart(8)} | ${thresholds[2].signPlayerRating}`
  );
  console.log(
    `Promote   | ${thresholds[0].promoteYouthRating.toString().padStart(12)} | ${thresholds[1].promoteYouthRating.toString().padStart(8)} | ${thresholds[2].promoteYouthRating}`
  );

  console.log('\nInterpretation:');
  console.log('- Conservative: Higher bar to sign (70), lower to release (55) - keeps veterans');
  console.log('- Aggressive: Lower bar to sign (60), higher to release (65) - churns roster');
}

function demonstrateTacticalDecisions() {
  console.log('\n' + '='.repeat(60));
  console.log('2. TACTICAL DECISIONS BY PERSONALITY');
  console.log('='.repeat(60));

  // Create an athletic roster
  const roster = [
    createMockPlayer('pg1', 'PG', 75, 25),
    createMockPlayer('sg1', 'SG', 72, 27),
    createMockPlayer('sf1', 'SF', 78, 24),
    createMockPlayer('pf1', 'PF', 70, 28),
    createMockPlayer('c1', 'C', 68, 26),
    createMockPlayer('pg2', 'PG', 65, 22),
    createMockPlayer('sg2', 'SG', 63, 23),
  ];

  const context = createDecisionContext();

  console.log('\nRoster: 7 players (PG, SG, SF, PF, C + 2 bench)');
  console.log('\n         | Conservative | Balanced   | Aggressive');
  console.log('-'.repeat(55));

  const personalities = ['conservative', 'balanced', 'aggressive'] as const;
  const configs = personalities.map((p) => createAIConfig(p));

  const paces = configs.map((c) => choosePaceStrategy(roster, context, c));
  const defenses = configs.map((c) => setDefenseStrategy(roster, context, c));

  console.log(
    `Pace     | ${paces[0].pace.padStart(12)} | ${paces[1].pace.padStart(10)} | ${paces[2].pace}`
  );
  console.log(
    `Defense  | ${defenses[0].defense.padStart(12)} | ${defenses[1].defense.padStart(10)} | ${defenses[2].defense}`
  );

  console.log('\nInterpretation:');
  console.log('- Conservative: Prefers zone defense, slower pace (lower risk)');
  console.log('- Aggressive: Prefers press defense, faster pace (high risk/reward)');
}

function demonstrateRosterDecisions() {
  console.log('\n' + '='.repeat(60));
  console.log('3. ROSTER DECISIONS BY PERSONALITY');
  console.log('='.repeat(60));

  // Create a marginal player (rating ~58)
  const marginalPlayer = createMockPlayer('marginal', 'SG', 58, 29);
  const roster = [
    marginalPlayer,
    createMockPlayer('pg1', 'PG', 70, 25),
    createMockPlayer('sf1', 'SF', 72, 26),
    createMockPlayer('pf1', 'PF', 68, 27),
    createMockPlayer('c1', 'C', 65, 28),
  ];

  const context = createDecisionContext();

  console.log('\nMarginal Player: SG, age 29, rating ~58');
  console.log('\n              | Conservative | Balanced | Aggressive');
  console.log('-'.repeat(55));

  const personalities = ['conservative', 'balanced', 'aggressive'] as const;
  const configs = personalities.map((p) => createAIConfig(p));

  const decisions = configs.map((c) => shouldReleasePlayer(marginalPlayer, roster, c, context));

  console.log(
    `Release?  | ${decisions[0].shouldRelease.toString().padStart(12)} | ${decisions[1].shouldRelease.toString().padStart(8)} | ${decisions[2].shouldRelease}`
  );

  console.log('\nInterpretation:');
  console.log('- Conservative (threshold 55): Keeps player (58 > 55)');
  console.log('- Balanced (threshold 60): May release (58 < 60)');
  console.log('- Aggressive (threshold 65): Releases (58 < 65)');
}

function demonstrateScoutingPriorities() {
  console.log('\n' + '='.repeat(60));
  console.log('4. SCOUTING PRIORITIES BY ROSTER GAPS');
  console.log('='.repeat(60));

  // Roster missing center
  const roster = [
    createMockPlayer('pg1', 'PG', 70, 25),
    createMockPlayer('pg2', 'PG', 65, 23),
    createMockPlayer('sg1', 'SG', 72, 26),
    createMockPlayer('sf1', 'SF', 68, 27),
    createMockPlayer('sf2', 'SF', 64, 24),
    createMockPlayer('pf1', 'PF', 66, 28),
    // No centers!
  ];

  const context = createDecisionContext();
  const config = createAIConfig('balanced');

  const priorities = prioritizeScouting(roster, context, config);

  console.log('\nRoster: PG(2), SG(1), SF(2), PF(1), C(0)');
  console.log(`\nScouting Priorities: ${priorities.join(' > ')}`);
  console.log('\nInterpretation: C is highest priority (missing), then SG/PF (only 1 each)');
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('='.repeat(60));
  console.log('MULTIBALL - AI Personalities Demo');
  console.log('='.repeat(60));

  demonstrateThresholds();
  demonstrateTacticalDecisions();
  demonstrateRosterDecisions();
  demonstrateScoutingPriorities();

  console.log('\n' + '='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main();
