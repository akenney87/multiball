/**
 * AI System Integration Tests
 *
 * Tests the complete AI decision flow:
 * - Personality affects all decisions consistently
 * - Roster and tactical decisions work together
 * - Full team management scenario
 */

import type { Player, PlayerAttributes, PlayerPotentials } from '../../data/types';
import type { DecisionContext, AIConfig, Position } from '../types';
import { createAIConfig } from '../personality';
import { calculateOverallRating, evaluatePlayer } from '../evaluation';
import { shouldReleasePlayer, shouldOfferContract, prioritizeScouting, shouldPromoteYouth } from '../roster';
import { selectStartingLineup, choosePaceStrategy, setDefenseStrategy, allocateMinutes } from '../tactical';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a realistic player with full attributes
 */
function createPlayer(
  id: string,
  position: Position,
  rating: 'low' | 'medium' | 'high',
  age: number = 25
): Player {
  const baseValue = rating === 'low' ? 55 : rating === 'medium' ? 70 : 85;
  const variance = 5;

  const attributes: PlayerAttributes = {
    // Physical (12)
    grip_strength: baseValue + Math.floor(Math.random() * variance),
    arm_strength: baseValue - 2 + Math.floor(Math.random() * variance),
    core_strength: baseValue + 2 + Math.floor(Math.random() * variance),
    agility: baseValue + Math.floor(Math.random() * variance),
    acceleration: baseValue + 4 + Math.floor(Math.random() * variance),
    top_speed: baseValue - 2 + Math.floor(Math.random() * variance),
    jumping: baseValue + 2 + Math.floor(Math.random() * variance),
    reactions: baseValue + 5 + Math.floor(Math.random() * variance),
    stamina: baseValue + Math.floor(Math.random() * variance),
    balance: baseValue - 2 + Math.floor(Math.random() * variance),
    height: baseValue - 5 + Math.floor(Math.random() * variance),
    durability: baseValue + Math.floor(Math.random() * variance),
    // Mental (8)
    awareness: baseValue + 5 + Math.floor(Math.random() * variance),
    creativity: baseValue - 2 + Math.floor(Math.random() * variance),
    determination: baseValue + 2 + Math.floor(Math.random() * variance),
    bravery: baseValue + Math.floor(Math.random() * variance),
    consistency: baseValue + Math.floor(Math.random() * variance),
    composure: baseValue + 3 + Math.floor(Math.random() * variance),
    patience: baseValue - 2 + Math.floor(Math.random() * variance),
    teamwork: baseValue + Math.floor(Math.random() * variance),
    // Technical (6)
    hand_eye_coordination: baseValue + 2 + Math.floor(Math.random() * variance),
    throw_accuracy: baseValue + Math.floor(Math.random() * variance),
    form_technique: baseValue + 1 + Math.floor(Math.random() * variance),
    finesse: baseValue - 2 + Math.floor(Math.random() * variance),
    deception: baseValue - 5 + Math.floor(Math.random() * variance),
    footwork: baseValue + Math.floor(Math.random() * variance),
  };

  const potentials: PlayerPotentials = {
    physical: baseValue + 10,
    mental: baseValue + 12,
    technical: baseValue + 11,
  };

  return {
    id,
    firstName: `Player`,
    lastName: id,
    age,
    position,
    nationality: 'USA',
    attributes,
    potentials,
    contract: {
      salary: baseValue * 50000,
      yearsRemaining: 2,
    },
  };
}

/**
 * Create a full team roster (12 players)
 */
function createTeamRoster(): Player[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const players: Player[] = [];

  // 5 starters (high rating)
  positions.forEach((pos) => {
    players.push(createPlayer(`starter-${pos}`, pos, 'high', 27));
  });

  // 5 backups (medium rating)
  positions.forEach((pos) => {
    players.push(createPlayer(`backup-${pos}`, pos, 'medium', 24));
  });

  // 2 reserves (low rating, young)
  players.push(createPlayer('reserve-PG', 'PG', 'low', 20));
  players.push(createPlayer('reserve-SG', 'SG', 'low', 21));

  return players;
}

/**
 * Create decision context
 */
function createContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    week: 15,
    transferWindowOpen: true,
    finance: {
      available: 10000000,
      total: 50000000,
    },
    matchImportance: 'medium',
    ...overrides,
  };
}

// =============================================================================
// PERSONALITY CONSISTENCY TESTS
// =============================================================================

describe('AI Personality Consistency', () => {
  const personalities: Array<'conservative' | 'balanced' | 'aggressive'> = [
    'conservative',
    'balanced',
    'aggressive',
  ];

  it('each personality produces consistent decisions across modules', () => {
    personalities.forEach((personality) => {
      const config = createAIConfig(personality);
      const roster = createTeamRoster();
      const context = createContext();

      // Get decisions from all modules
      const lineup = selectStartingLineup(roster, context, config);
      const pace = choosePaceStrategy(roster, context, config);
      const defense = setDefenseStrategy(roster, context, config);
      const minutes = allocateMinutes(roster, context, config);

      // Verify each module returns valid results
      expect(lineup.starters).toHaveLength(5);
      expect(['slow', 'normal', 'fast']).toContain(pace.pace);
      expect(['man', 'zone', 'press']).toContain(defense.defense);
      expect(minutes.totalMinutes).toBe(240);
    });
  });

  it('aggressive AI makes consistently aggressive decisions', () => {
    const config = createAIConfig('aggressive');
    const roster = createTeamRoster();
    const context = createContext();

    const defense = setDefenseStrategy(roster, context, config);
    const minutes = allocateMinutes(roster, context, config);

    // Aggressive should use press defense
    expect(defense.defense).toBe('press');

    // Aggressive distributes minutes more evenly (smaller spread)
    const minuteValues = Object.values(minutes.allocation).filter((m) => m > 0);
    const spread = Math.max(...minuteValues) - Math.min(...minuteValues);
    expect(spread).toBeLessThan(25); // More even than conservative
  });

  it('conservative AI makes consistently conservative decisions', () => {
    const conservativeConfig = createAIConfig('conservative');
    const balancedConfig = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    const defense = setDefenseStrategy(roster, context, conservativeConfig);
    const conservativeMinutes = allocateMinutes(roster, context, conservativeConfig);
    const balancedMinutes = allocateMinutes(roster, context, balancedConfig);

    // Conservative should use zone defense
    expect(defense.defense).toBe('zone');

    // Conservative gives starters more minutes than balanced
    const conservativeStarterAvg =
      conservativeMinutes.starters.reduce((sum, id) => sum + conservativeMinutes.allocation[id], 0) /
      conservativeMinutes.starters.length;
    const balancedStarterAvg =
      balancedMinutes.starters.reduce((sum, id) => sum + balancedMinutes.allocation[id], 0) /
      balancedMinutes.starters.length;

    expect(conservativeStarterAvg).toBeGreaterThanOrEqual(balancedStarterAvg);
  });
});

// =============================================================================
// ROSTER + TACTICAL INTEGRATION TESTS
// =============================================================================

describe('Roster and Tactical Integration', () => {
  it('selectStartingLineup uses same rating as shouldReleasePlayer', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    // Get lineup and minutes
    const lineup = selectStartingLineup(roster, context, config);

    // Verify starters are the highest-rated at their positions
    lineup.starters.forEach((starter) => {
      const positionPlayers = roster.filter((p) => p.position === starter.position);
      const ratings = positionPlayers.map((p) => ({
        id: p.id,
        rating: calculateOverallRating(p),
      }));
      ratings.sort((a, b) => b.rating - a.rating);

      expect(ratings[0].id).toBe(starter.id);
    });
  });

  it('allocateMinutes correctly distributes based on lineup selection', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    const lineup = selectStartingLineup(roster, context, config);
    const minutes = allocateMinutes(roster, context, config);

    // All starters should be in minutes.starters
    lineup.starters.forEach((starter) => {
      expect(minutes.starters).toContain(starter.id);
    });

    // All bench players should be in rotation or deepBench
    lineup.bench.forEach((benchPlayer) => {
      const inRotation = minutes.rotation.includes(benchPlayer.id);
      const inDeepBench = minutes.deepBench.includes(benchPlayer.id);
      expect(inRotation || inDeepBench).toBe(true);
    });
  });

  it('evaluatePlayer scoring aligns with tactical selection', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    // Evaluate all players
    const evaluations = roster.map((p) => ({
      player: p,
      evaluation: evaluatePlayer(p, context, config),
    }));

    // Get lineup
    const lineup = selectStartingLineup(roster, context, config);

    // Starters should have higher composite scores than bench (on average)
    const starterIds = new Set(lineup.starters.map((s) => s.id));
    const starterEvals = evaluations.filter((e) => starterIds.has(e.player.id));
    const benchEvals = evaluations.filter((e) => !starterIds.has(e.player.id));

    const avgStarterScore =
      starterEvals.reduce((sum, e) => sum + e.evaluation.compositeScore, 0) /
      starterEvals.length;
    const avgBenchScore =
      benchEvals.reduce((sum, e) => sum + e.evaluation.compositeScore, 0) / benchEvals.length;

    expect(avgStarterScore).toBeGreaterThan(avgBenchScore);
  });
});

// =============================================================================
// FULL TEAM MANAGEMENT SCENARIO
// =============================================================================

describe('Full Team Management Scenario', () => {
  it('simulates a week of AI team management', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext({ week: 20, matchImportance: 'high' });

    // Step 1: Evaluate roster for releases
    const releaseDecisions = roster.map((player) => ({
      player,
      decision: shouldReleasePlayer(player, roster, context, config),
    }));

    // Some low-rated players might be flagged for release
    const releaseCount = releaseDecisions.filter((d) => d.decision.shouldRelease).length;
    // But we shouldn't release everyone
    expect(releaseCount).toBeLessThan(roster.length / 2);

    // Step 2: Check for scouting priorities
    const priorities = prioritizeScouting(roster, context, config);
    expect(priorities).toHaveLength(5); // All positions considered

    // Step 3: Set tactics for the match
    const lineup = selectStartingLineup(roster, context, config);
    const pace = choosePaceStrategy(roster, context, config);
    const defense = setDefenseStrategy(roster, context, config);
    const minutes = allocateMinutes(roster, context, config);

    // Verify complete tactical setup
    expect(lineup.starters).toHaveLength(5);
    expect(['slow', 'normal', 'fast']).toContain(pace.pace);
    expect(['man', 'zone', 'press']).toContain(defense.defense);
    expect(minutes.totalMinutes).toBe(240);

    // All players should have minutes allocated
    roster.forEach((player) => {
      expect(minutes.allocation[player.id]).toBeDefined();
      expect(minutes.allocation[player.id]).toBeGreaterThanOrEqual(0);
    });
  });

  it('handles roster changes correctly', () => {
    const config = createAIConfig('balanced');
    let roster = createTeamRoster();
    const context = createContext();

    // Initial lineup
    const initialLineup = selectStartingLineup(roster, context, config);
    const initialPGStarter = initialLineup.starters.find((p) => p.position === 'PG');

    // Remove the starting PG
    roster = roster.filter((p) => p.id !== initialPGStarter?.id);

    // Get new lineup
    const newLineup = selectStartingLineup(roster, context, config);

    // Should now have a different PG starter (backup promoted)
    const newPGStarter = newLineup.starters.find((p) => p.position === 'PG');
    expect(newPGStarter?.id).not.toBe(initialPGStarter?.id);
    expect(newPGStarter?.id).toBe('backup-PG');
  });

  it('free agent evaluation aligns with roster evaluation', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    // Create a high-rated free agent
    const freeAgent = createPlayer('free-agent-PG', 'PG', 'high', 26);
    const freeAgentRating = calculateOverallRating(freeAgent);

    // Should get a contract offer if above threshold
    const offer = shouldOfferContract(freeAgent, roster, context, config);

    if (freeAgentRating >= 65) {
      // Balanced threshold for signing
      expect(offer).not.toBeNull();
      expect(offer?.playerId).toBe('free-agent-PG');
      expect(offer?.annualSalary).toBeGreaterThan(0);
    }
  });

  it('youth promotion decision integrates with overall strategy', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const context = createContext();

    // Create youth player (rating ~60 to be borderline)
    const youthPlayer = createPlayer('youth-PG', 'PG', 'medium', 19);

    // Check promotion decision
    const shouldPromote = shouldPromoteYouth(youthPlayer, roster, context, config);
    const youthRating = calculateOverallRating(youthPlayer);

    // Should align with threshold (60 for balanced)
    if (youthRating >= 60) {
      expect(shouldPromote).toBe(true);
    } else {
      expect(shouldPromote).toBe(false);
    }
  });
});

// =============================================================================
// EDGE CASE INTEGRATION TESTS
// =============================================================================

describe('Integration Edge Cases', () => {
  it('handles minimal roster (5 players)', () => {
    const config = createAIConfig('balanced');
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    const roster = positions.map((pos) => createPlayer(`player-${pos}`, pos, 'medium'));
    const context = createContext();

    // All functions should still work
    const lineup = selectStartingLineup(roster, context, config);
    expect(lineup.starters).toHaveLength(5);
    expect(lineup.bench).toHaveLength(0);

    const minutes = allocateMinutes(roster, context, config);
    expect(minutes.totalMinutes).toBe(240);
    roster.forEach((p) => {
      expect(minutes.allocation[p.id]).toBe(48); // Each plays full game
    });

    // No releases when minimum roster
    roster.forEach((player) => {
      const decision = shouldReleasePlayer(player, roster, context, config);
      expect(decision.shouldRelease).toBe(false);
    });
  });

  it('handles budget-constrained decisions', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const lowBudgetContext = createContext({
      finance: { available: 100000, total: 50000000 },
    });

    // Create expensive free agent
    const expensiveAgent = createPlayer('expensive-FA', 'PG', 'high', 27);

    // Should either reject or offer reduced contract
    const offer = shouldOfferContract(expensiveAgent, roster, lowBudgetContext, config);

    if (offer) {
      // If offer made, should be within budget
      expect(offer.annualSalary).toBeLessThanOrEqual(100000);
    }
  });

  it('handles closed transfer window', () => {
    const config = createAIConfig('balanced');
    const roster = createTeamRoster();
    const closedWindowContext = createContext({ transferWindowOpen: false });

    const freeAgent = createPlayer('free-agent', 'PG', 'high', 26);

    // Should not offer contract when window closed
    const offer = shouldOfferContract(freeAgent, roster, closedWindowContext, config);
    expect(offer).toBeNull();
  });
});
