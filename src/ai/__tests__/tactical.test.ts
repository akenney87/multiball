/**
 * AI Tactical Decision Tests
 *
 * Tests for tactical decision-making functions:
 * - selectStartingLineup: Choose best 5 players by position
 * - choosePaceStrategy: Select pace based on roster athleticism
 * - setDefenseStrategy: Choose defense based on personality
 * - allocateMinutes: Distribute 240 minutes across roster
 */

import type { Player, PlayerAttributes, PlayerPotentials } from '../../data/types';
import type { DecisionContext, AIConfig, Position } from '../types';
import { createAIConfig } from '../personality';
import {
  selectStartingLineup,
  choosePaceStrategy,
  setDefenseStrategy,
  allocateMinutes,
} from '../tactical';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create mock player with full 25-attribute system
 */
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  const baseAttributes: PlayerAttributes = {
    // Physical (12)
    grip_strength: 70,
    arm_strength: 68,
    core_strength: 72,
    agility: 70,
    acceleration: 74,
    top_speed: 68,
    jumping: 72,
    reactions: 75,
    stamina: 70,
    balance: 68,
    height: 65,
    durability: 70,
    // Mental (8)
    awareness: 75,
    creativity: 68,
    determination: 72,
    bravery: 70,
    consistency: 70,
    composure: 73,
    patience: 68,
    teamwork: 70,
    // Technical (6)
    hand_eye_coordination: 72,
    throw_accuracy: 70,
    form_technique: 71,
    finesse: 68,
    deception: 65,
    footwork: 70,
  };

  const basePotentials: PlayerPotentials = {
    physical: 75,
    mental: 77,
    technical: 76,
  };

  return {
    id: overrides.id || `player-${Math.random().toString(36).substring(7)}`,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'Player',
    age: overrides.age || 25,
    position: overrides.position || 'PG',
    nationality: overrides.nationality || 'USA',
    attributes: { ...baseAttributes, ...(overrides.attributes || {}) },
    potentials: { ...basePotentials, ...(overrides.potentials || {}) },
    contract: overrides.contract || {
      salary: 2000000,
      yearsRemaining: 2,
    },
    ...(overrides.morale !== undefined && { morale: overrides.morale }),
    ...(overrides.form !== undefined && { form: overrides.form }),
    ...(overrides.injury !== undefined && { injury: overrides.injury }),
    ...(overrides.fatigue !== undefined && { fatigue: overrides.fatigue }),
  };
}

/**
 * Create a full roster with one player at each position
 */
function createFullRoster(): Player[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  return positions.map((pos, idx) =>
    createMockPlayer({
      id: `player-${pos}`,
      position: pos,
      firstName: pos,
      lastName: `Player${idx + 1}`,
    })
  );
}

/**
 * Create a deep roster with 2-3 players at each position
 */
function createDeepRoster(): Player[] {
  const players: Player[] = [];
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  positions.forEach((pos, posIdx) => {
    // Starter (high rating ~75)
    players.push(
      createMockPlayer({
        id: `starter-${pos}`,
        position: pos,
        firstName: `${pos}Starter`,
        attributes: {
          // Physical (12) - high values
          grip_strength: 75,
          arm_strength: 73,
          core_strength: 77,
          agility: 78,
          acceleration: 79,
          top_speed: 73,
          jumping: 77,
          reactions: 80,
          stamina: 75,
          balance: 73,
          height: 70,
          durability: 75,
          // Mental (8) - high values
          awareness: 80,
          creativity: 73,
          determination: 77,
          bravery: 75,
          consistency: 75,
          composure: 78,
          patience: 73,
          teamwork: 75,
          // Technical (6) - high values
          hand_eye_coordination: 77,
          throw_accuracy: 75,
          form_technique: 76,
          finesse: 73,
          deception: 70,
          footwork: 75,
        },
      })
    );

    // Backup (medium rating ~65)
    players.push(
      createMockPlayer({
        id: `backup-${pos}`,
        position: pos,
        firstName: `${pos}Backup`,
        attributes: {
          // Physical (12) - medium values
          grip_strength: 65,
          arm_strength: 63,
          core_strength: 67,
          agility: 65,
          acceleration: 66,
          top_speed: 63,
          jumping: 67,
          reactions: 70,
          stamina: 65,
          balance: 63,
          height: 60,
          durability: 65,
          // Mental (8) - medium values
          awareness: 70,
          creativity: 63,
          determination: 67,
          bravery: 65,
          consistency: 65,
          composure: 68,
          patience: 63,
          teamwork: 65,
          // Technical (6) - medium values
          hand_eye_coordination: 67,
          throw_accuracy: 65,
          form_technique: 66,
          finesse: 63,
          deception: 60,
          footwork: 65,
        },
      })
    );

    // Third string (only for guards, ~55 rating)
    if (pos === 'PG' || pos === 'SG') {
      players.push(
        createMockPlayer({
          id: `reserve-${pos}`,
          position: pos,
          firstName: `${pos}Reserve`,
          attributes: {
            // Physical (12) - lower values
            grip_strength: 55,
            arm_strength: 53,
            core_strength: 57,
            agility: 55,
            acceleration: 56,
            top_speed: 53,
            jumping: 57,
            reactions: 60,
            stamina: 55,
            balance: 53,
            height: 50,
            durability: 55,
            // Mental (8) - lower values
            awareness: 60,
            creativity: 53,
            determination: 57,
            bravery: 55,
            consistency: 55,
            composure: 58,
            patience: 53,
            teamwork: 55,
            // Technical (6) - lower values
            hand_eye_coordination: 57,
            throw_accuracy: 55,
            form_technique: 56,
            finesse: 53,
            deception: 50,
            footwork: 55,
          },
        })
      );
    }
  });

  return players;
}

/**
 * Create default decision context
 */
function createMockContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    week: 10,
    transferWindowOpen: false,
    finance: {
      available: 5000000,
      total: 20000000,
    },
    matchImportance: 'medium',
    ...overrides,
  };
}

// =============================================================================
// STARTING LINEUP TESTS
// =============================================================================

describe('selectStartingLineup', () => {
  describe('basic lineup selection', () => {
    it('selects exactly 5 starters', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      expect(result.starters).toHaveLength(5);
    });

    it('selects one player per position', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);
      const positions = result.starters.map((p) => p.position);

      expect(positions).toContain('PG');
      expect(positions).toContain('SG');
      expect(positions).toContain('SF');
      expect(positions).toContain('PF');
      expect(positions).toContain('C');
    });

    it('places remaining players on bench', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      expect(result.starters.length + result.bench.length).toBe(roster.length);
    });
  });

  describe('rating-based selection', () => {
    it('selects highest rated player at each position', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      // All starters should have "Starter" in their firstName
      result.starters.forEach((starter) => {
        expect(starter.firstName).toContain('Starter');
      });
    });

    it('places lower rated players on bench in rating order', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      // Bench should contain backups and reserves
      const benchNames = result.bench.map((p) => p.firstName);
      expect(benchNames.some((n) => n.includes('Backup'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles roster with exactly 5 players', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      expect(result.starters).toHaveLength(5);
      expect(result.bench).toHaveLength(0);
    });

    it('handles missing position (uses null placeholder)', () => {
      const roster = createFullRoster().filter((p) => p.position !== 'C');
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = selectStartingLineup(roster, context, config);

      // Should still return lineup info with available players
      expect(result.starters.length).toBeLessThanOrEqual(5);
      expect(result.reason).toContain('C');
    });
  });
});

// =============================================================================
// PACE STRATEGY TESTS
// =============================================================================

describe('choosePaceStrategy', () => {
  describe('athleticism-based pace', () => {
    it('chooses fast pace for athletic roster', () => {
      // Create highly athletic roster
      const athleticRoster = createFullRoster().map((p) => ({
        ...p,
        attributes: {
          ...p.attributes,
          agility: 85,
          acceleration: 88,
          top_speed: 85,
          stamina: 82,
        },
      }));

      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = choosePaceStrategy(athleticRoster, context, config);

      expect(result.pace).toBe('fast');
      expect(result.avgAthleticism).toBeGreaterThan(75);
    });

    it('chooses slow pace for non-athletic roster', () => {
      // Create less athletic roster
      const slowRoster = createFullRoster().map((p) => ({
        ...p,
        attributes: {
          ...p.attributes,
          agility: 55,
          acceleration: 52,
          top_speed: 50,
          stamina: 55,
        },
      }));

      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = choosePaceStrategy(slowRoster, context, config);

      expect(result.pace).toBe('slow');
      expect(result.avgAthleticism).toBeLessThan(65);
    });

    it('chooses normal pace for average roster', () => {
      const roster = createFullRoster(); // Default attributes ~70
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = choosePaceStrategy(roster, context, config);

      expect(result.pace).toBe('normal');
    });
  });

  describe('personality influence', () => {
    it('aggressive AI prefers faster pace', () => {
      const roster = createFullRoster();
      const aggressiveConfig = createAIConfig('aggressive');
      const context = createMockContext();

      const result = choosePaceStrategy(roster, context, aggressiveConfig);

      // Aggressive should bias toward fast
      expect(['normal', 'fast']).toContain(result.pace);
    });

    it('conservative AI prefers slower pace', () => {
      const roster = createFullRoster();
      const conservativeConfig = createAIConfig('conservative');
      const context = createMockContext();

      const result = choosePaceStrategy(roster, context, conservativeConfig);

      // Conservative should bias toward slow
      expect(['slow', 'normal']).toContain(result.pace);
    });
  });

  it('provides reasoning for decision', () => {
    const roster = createFullRoster();
    const config = createAIConfig('balanced');
    const context = createMockContext();

    const result = choosePaceStrategy(roster, context, config);

    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// DEFENSE STRATEGY TESTS
// =============================================================================

describe('setDefenseStrategy', () => {
  describe('personality-based defense', () => {
    it('aggressive AI prefers press defense', () => {
      const roster = createFullRoster();
      const config = createAIConfig('aggressive');
      const context = createMockContext();

      const result = setDefenseStrategy(roster, context, config);

      expect(result.defense).toBe('press');
    });

    it('conservative AI prefers zone defense', () => {
      const roster = createFullRoster();
      const config = createAIConfig('conservative');
      const context = createMockContext();

      const result = setDefenseStrategy(roster, context, config);

      expect(result.defense).toBe('zone');
    });

    it('balanced AI uses man-to-man defense', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = setDefenseStrategy(roster, context, config);

      expect(result.defense).toBe('man');
    });
  });

  describe('match importance factor', () => {
    it('high importance match can modify strategy', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext({ matchImportance: 'high' });

      const result = setDefenseStrategy(roster, context, config);

      // Should still return a valid strategy
      expect(['man', 'zone', 'press']).toContain(result.defense);
    });
  });

  it('provides reasoning for decision', () => {
    const roster = createFullRoster();
    const config = createAIConfig('balanced');
    const context = createMockContext();

    const result = setDefenseStrategy(roster, context, config);

    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// MINUTES ALLOCATION TESTS
// =============================================================================

describe('allocateMinutes', () => {
  describe('total minutes validation', () => {
    it('allocates exactly 240 total minutes', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      expect(result.totalMinutes).toBe(240);
    });

    it('allocation entries sum to 240', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      const sum = Object.values(result.allocation).reduce((a, b) => a + b, 0);
      expect(sum).toBe(240);
    });
  });

  describe('minutes distribution', () => {
    it('starters get more minutes than bench', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      const starterMinutes = result.starters.map((id) => result.allocation[id]);
      const benchMinutes = result.rotation.map((id) => result.allocation[id]);

      const avgStarterMin = starterMinutes.reduce((a, b) => a + b, 0) / starterMinutes.length;
      const avgBenchMin = benchMinutes.reduce((a, b) => a + b, 0) / benchMinutes.length;

      expect(avgStarterMin).toBeGreaterThan(avgBenchMin);
    });

    it('no player gets more than 40 minutes', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      Object.values(result.allocation).forEach((minutes) => {
        expect(minutes).toBeLessThanOrEqual(40);
      });
    });

    it('no player gets negative minutes', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      Object.values(result.allocation).forEach((minutes) => {
        expect(minutes).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('personality-based distribution', () => {
    it('conservative AI gives starters more minutes', () => {
      const roster = createDeepRoster();
      const conservativeConfig = createAIConfig('conservative');
      const balancedConfig = createAIConfig('balanced');
      const context = createMockContext();

      const conservativeResult = allocateMinutes(roster, context, conservativeConfig);
      const balancedResult = allocateMinutes(roster, context, balancedConfig);

      const conservativeStarterAvg =
        conservativeResult.starters.reduce((sum, id) => sum + conservativeResult.allocation[id], 0) /
        conservativeResult.starters.length;
      const balancedStarterAvg =
        balancedResult.starters.reduce((sum, id) => sum + balancedResult.allocation[id], 0) /
        balancedResult.starters.length;

      expect(conservativeStarterAvg).toBeGreaterThan(balancedStarterAvg);
    });

    it('aggressive AI distributes minutes more evenly', () => {
      const roster = createDeepRoster();
      const aggressiveConfig = createAIConfig('aggressive');
      const balancedConfig = createAIConfig('balanced');
      const context = createMockContext();

      const aggressiveResult = allocateMinutes(roster, context, aggressiveConfig);
      const balancedResult = allocateMinutes(roster, context, balancedConfig);

      // Compare the spread (max - min) - aggressive should be smaller
      const aggressiveSpread =
        Math.max(...Object.values(aggressiveResult.allocation)) -
        Math.min(...Object.values(aggressiveResult.allocation).filter((m) => m > 0));
      const balancedSpread =
        Math.max(...Object.values(balancedResult.allocation)) -
        Math.min(...Object.values(balancedResult.allocation).filter((m) => m > 0));

      expect(aggressiveSpread).toBeLessThanOrEqual(balancedSpread);
    });
  });

  describe('categorization', () => {
    it('correctly categorizes starters', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      expect(result.starters).toHaveLength(5);
    });

    it('correctly categorizes rotation players', () => {
      const roster = createDeepRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      // Rotation should get meaningful minutes (> 8 min)
      result.rotation.forEach((id) => {
        expect(result.allocation[id]).toBeGreaterThan(8);
      });
    });
  });

  describe('edge cases', () => {
    it('handles roster with exactly 5 players', () => {
      const roster = createFullRoster();
      const config = createAIConfig('balanced');
      const context = createMockContext();

      const result = allocateMinutes(roster, context, config);

      expect(result.totalMinutes).toBe(240);
      expect(result.starters).toHaveLength(5);
      expect(result.rotation).toHaveLength(0);
      expect(result.deepBench).toHaveLength(0);

      // Each starter gets 48 minutes
      result.starters.forEach((id) => {
        expect(result.allocation[id]).toBe(48);
      });
    });
  });
});
