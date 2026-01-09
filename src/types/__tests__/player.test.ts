/**
 * Tests for Player Type Utilities
 */

import {
  normalizePlayer,
  getPlayerAttributes,
  flattenPlayer,
  hasNestedAttributes,
  hasFlatAttributes,
  validatePlayerAttributes,
  FlatPlayer
} from '../player';
import { Player, PlayerAttributes } from '../../data/types';

describe('Player Type Utilities', () => {
  // Test data
  const nestedPlayer: Player = {
    id: 'player-1',
    name: 'John Doe',
    age: 25,
    dateOfBirth: new Date('1998-01-01'),
    position: 'PG',
    attributes: {
      stamina: 75,
      shooting: 80,
      threePointShooting: 75,
      freeThrowShooting: 85,
      postScoring: 60,
      midRangeShooting: 78,
      layupDunking: 70,
      offensiveRebounding: 55,
      defensiveRebounding: 60,
      passing: 85,
      ballHandling: 90,
      onBallDefense: 70,
      offBallDefense: 68,
      perimeterDefense: 72,
      postDefense: 55,
      blocking: 50,
      stealing: 75,
      speed: 82,
      acceleration: 80,
      verticalLeap: 65,
      strength: 60,
      agility: 85,
      coordination: 78,
      bbiq: 88,
      consistency: 80
    },
    potentials: {} as any,
    peakAges: {} as any,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: {} as any,
    careerStats: {} as any,
    currentSeasonStats: {} as any,
    teamId: 'team-1',
    acquisitionType: 'draft',
    acquisitionDate: new Date('2023-01-01')
  };

  const flatPlayer: FlatPlayer = {
    id: 'player-2',
    name: 'Jane Smith',
    age: 27,
    position: 'SG',
    stamina: 80,
    shooting: 85,
    threePointShooting: 88,
    freeThrowShooting: 90,
    postScoring: 65,
    midRangeShooting: 82,
    layupDunking: 75,
    offensiveRebounding: 60,
    defensiveRebounding: 65,
    passing: 70,
    ballHandling: 75,
    onBallDefense: 80,
    offBallDefense: 78,
    perimeterDefense: 82,
    postDefense: 60,
    blocking: 55,
    stealing: 80,
    speed: 85,
    acceleration: 88,
    verticalLeap: 72,
    strength: 68,
    agility: 82,
    coordination: 80,
    bbiq: 85,
    consistency: 83
  };

  describe('hasNestedAttributes', () => {
    it('returns true for player with nested attributes', () => {
      expect(hasNestedAttributes(nestedPlayer)).toBe(true);
    });

    it('returns false for player with flat attributes', () => {
      expect(hasNestedAttributes(flatPlayer)).toBe(false);
    });

    it('returns false for player with null attributes', () => {
      const invalidPlayer = { id: '1', name: 'Test', attributes: null };
      expect(hasNestedAttributes(invalidPlayer)).toBe(false);
    });

    it('returns false for player with non-object attributes', () => {
      const invalidPlayer = { id: '1', name: 'Test', attributes: 'invalid' };
      expect(hasNestedAttributes(invalidPlayer)).toBe(false);
    });
  });

  describe('hasFlatAttributes', () => {
    it('returns true for player with flat attributes', () => {
      expect(hasFlatAttributes(flatPlayer)).toBe(true);
    });

    it('returns false for player with nested attributes', () => {
      expect(hasFlatAttributes(nestedPlayer)).toBe(false);
    });

    it('returns false for player without stamina field', () => {
      const invalidPlayer = { id: '1', name: 'Test', shooting: 80 };
      expect(hasFlatAttributes(invalidPlayer)).toBe(false);
    });
  });

  describe('normalizePlayer', () => {
    it('returns nested player as-is (no transformation)', () => {
      const result = normalizePlayer(nestedPlayer);
      expect(result).toBe(nestedPlayer); // Same object reference
      expect(result.attributes.stamina).toBe(75);
      expect(result.attributes.shooting).toBe(80);
    });

    it('converts flat player to nested format', () => {
      const result = normalizePlayer(flatPlayer);
      expect(result.id).toBe('player-2');
      expect(result.name).toBe('Jane Smith');
      expect(result.age).toBe(27);
      expect(result.position).toBe('SG');
      expect(result.attributes).toBeDefined();
      expect(result.attributes.stamina).toBe(80);
      expect(result.attributes.shooting).toBe(85);
      expect(result.attributes.threePointShooting).toBe(88);
    });

    it('converts all 25 attributes correctly', () => {
      const result = normalizePlayer(flatPlayer);
      const attrs = result.attributes;

      expect(attrs.stamina).toBe(80);
      expect(attrs.shooting).toBe(85);
      expect(attrs.threePointShooting).toBe(88);
      expect(attrs.freeThrowShooting).toBe(90);
      expect(attrs.postScoring).toBe(65);
      expect(attrs.midRangeShooting).toBe(82);
      expect(attrs.layupDunking).toBe(75);
      expect(attrs.offensiveRebounding).toBe(60);
      expect(attrs.defensiveRebounding).toBe(65);
      expect(attrs.passing).toBe(70);
      expect(attrs.ballHandling).toBe(75);
      expect(attrs.onBallDefense).toBe(80);
      expect(attrs.offBallDefense).toBe(78);
      expect(attrs.perimeterDefense).toBe(82);
      expect(attrs.postDefense).toBe(60);
      expect(attrs.blocking).toBe(55);
      expect(attrs.stealing).toBe(80);
      expect(attrs.speed).toBe(85);
      expect(attrs.acceleration).toBe(88);
      expect(attrs.verticalLeap).toBe(72);
      expect(attrs.strength).toBe(68);
      expect(attrs.agility).toBe(82);
      expect(attrs.coordination).toBe(80);
      expect(attrs.bbiq).toBe(85);
      expect(attrs.consistency).toBe(83);
    });

    it('creates default values for missing fields', () => {
      const minimalPlayer = {
        id: 'player-3',
        name: 'Minimal Player',
        position: 'SF',
        stamina: 70,
        shooting: 75,
        threePointShooting: 72,
        freeThrowShooting: 78,
        postScoring: 68,
        midRangeShooting: 74,
        layupDunking: 70,
        offensiveRebounding: 65,
        defensiveRebounding: 68,
        passing: 70,
        ballHandling: 72,
        onBallDefense: 75,
        offBallDefense: 73,
        perimeterDefense: 76,
        postDefense: 68,
        blocking: 60,
        stealing: 72,
        speed: 78,
        acceleration: 76,
        verticalLeap: 70,
        strength: 72,
        agility: 75,
        coordination: 74,
        bbiq: 76,
        consistency: 75
      };

      const result = normalizePlayer(minimalPlayer);

      expect(result.age).toBe(25); // Default age
      expect(result.contract).toBeNull();
      expect(result.injury).toBeNull();
      expect(result.trainingFocus).toBeNull();
      expect(result.teamId).toBe('free_agent');
      expect(result.acquisitionType).toBe('free_agent');
    });

    it('preserves extra fields not in Player interface', () => {
      const playerWithExtra = {
        ...flatPlayer,
        customField: 'custom value',
        extraData: { foo: 'bar' }
      };

      const result = normalizePlayer(playerWithExtra) as any;
      expect(result.customField).toBe('custom value');
      expect(result.extraData).toEqual({ foo: 'bar' });
    });

    it('throws error for invalid player format', () => {
      const invalidPlayer = { id: '1', name: 'Invalid' };
      expect(() => normalizePlayer(invalidPlayer)).toThrow('Invalid player format');
    });

    it('throws error for empty object', () => {
      expect(() => normalizePlayer({})).toThrow('Invalid player format');
    });
  });

  describe('getPlayerAttributes', () => {
    it('extracts attributes from nested player', () => {
      const attrs = getPlayerAttributes(nestedPlayer);
      expect(attrs.stamina).toBe(75);
      expect(attrs.shooting).toBe(80);
      expect(attrs.bbiq).toBe(88);
    });

    it('extracts attributes from flat player', () => {
      const attrs = getPlayerAttributes(flatPlayer);
      expect(attrs.stamina).toBe(80);
      expect(attrs.shooting).toBe(85);
      expect(attrs.bbiq).toBe(85);
    });

    it('returns all 25 attributes', () => {
      const attrs = getPlayerAttributes(nestedPlayer);
      const keys = Object.keys(attrs);
      expect(keys.length).toBe(25);
    });

    it('throws error for invalid player', () => {
      const invalidPlayer = { id: '1', name: 'Invalid' };
      expect(() => getPlayerAttributes(invalidPlayer)).toThrow('Invalid player format');
    });
  });

  describe('flattenPlayer', () => {
    it('converts nested player to flat format', () => {
      const result = flattenPlayer(nestedPlayer);
      expect(result.id).toBe('player-1');
      expect(result.name).toBe('John Doe');
      expect(result.stamina).toBe(75); // Attribute at top level
      expect(result.shooting).toBe(80); // Attribute at top level
    });

    it('preserves all player fields', () => {
      const result = flattenPlayer(nestedPlayer);
      expect(result.age).toBe(25);
      expect(result.position).toBe('PG');
      expect(result.teamId).toBe('team-1');
      expect(result.acquisitionType).toBe('draft');
    });

    it('includes all 25 attributes at top level', () => {
      const result = flattenPlayer(nestedPlayer);
      expect(result.stamina).toBe(75);
      expect(result.shooting).toBe(80);
      expect(result.bbiq).toBe(88);
      expect(result.consistency).toBe(80);
    });
  });

  describe('validatePlayerAttributes', () => {
    it('validates nested player with valid attributes', () => {
      expect(validatePlayerAttributes(nestedPlayer)).toBe(true);
    });

    it('validates flat player with valid attributes', () => {
      expect(validatePlayerAttributes(flatPlayer)).toBe(true);
    });

    it('throws error for attribute below 1', () => {
      const invalidPlayer = {
        ...nestedPlayer,
        attributes: { ...nestedPlayer.attributes, stamina: 0 }
      };
      expect(() => validatePlayerAttributes(invalidPlayer)).toThrow('must be 1-100');
    });

    it('throws error for attribute above 100', () => {
      const invalidPlayer = {
        ...nestedPlayer,
        attributes: { ...nestedPlayer.attributes, shooting: 101 }
      };
      expect(() => validatePlayerAttributes(invalidPlayer)).toThrow('must be 1-100');
    });

    it('throws error for non-number attribute', () => {
      const invalidPlayer = {
        ...nestedPlayer,
        attributes: { ...nestedPlayer.attributes, stamina: '75' as any }
      };
      expect(() => validatePlayerAttributes(invalidPlayer)).toThrow('must be a number');
    });
  });

  describe('Integration: normalizePlayer -> getPlayerAttributes', () => {
    it('produces same attributes for nested and flat inputs', () => {
      // Create flat player with same attributes as nested
      const flatClone: FlatPlayer = {
        id: 'test',
        name: 'Test',
        position: 'PG',
        ...nestedPlayer.attributes
      };

      const normalizedNested = normalizePlayer(nestedPlayer);
      const normalizedFlat = normalizePlayer(flatClone);

      const attrsNested = getPlayerAttributes(normalizedNested);
      const attrsFlat = getPlayerAttributes(normalizedFlat);

      expect(attrsNested).toEqual(attrsFlat);
    });
  });

  describe('Integration: normalizePlayer -> flattenPlayer', () => {
    it('round-trips flat -> nested -> flat correctly', () => {
      const normalized = normalizePlayer(flatPlayer);
      const flattened = flattenPlayer(normalized);

      expect(flattened.id).toBe(flatPlayer.id);
      expect(flattened.name).toBe(flatPlayer.name);
      expect(flattened.stamina).toBe(flatPlayer.stamina);
      expect(flattened.shooting).toBe(flatPlayer.shooting);
    });
  });

  describe('Edge Cases', () => {
    it('handles player with all attributes at minimum (1)', () => {
      const minPlayer: FlatPlayer = {
        id: 'min',
        name: 'Min Player',
        position: 'C',
        stamina: 1, shooting: 1, threePointShooting: 1, freeThrowShooting: 1,
        postScoring: 1, midRangeShooting: 1, layupDunking: 1, offensiveRebounding: 1,
        defensiveRebounding: 1, passing: 1, ballHandling: 1, onBallDefense: 1,
        offBallDefense: 1, perimeterDefense: 1, postDefense: 1, blocking: 1,
        stealing: 1, speed: 1, acceleration: 1, verticalLeap: 1, strength: 1,
        agility: 1, coordination: 1, bbiq: 1, consistency: 1
      };

      const normalized = normalizePlayer(minPlayer);
      expect(validatePlayerAttributes(normalized)).toBe(true);
      expect(normalized.attributes.stamina).toBe(1);
    });

    it('handles player with all attributes at maximum (100)', () => {
      const maxPlayer: FlatPlayer = {
        id: 'max',
        name: 'Max Player',
        position: 'PF',
        stamina: 100, shooting: 100, threePointShooting: 100, freeThrowShooting: 100,
        postScoring: 100, midRangeShooting: 100, layupDunking: 100, offensiveRebounding: 100,
        defensiveRebounding: 100, passing: 100, ballHandling: 100, onBallDefense: 100,
        offBallDefense: 100, perimeterDefense: 100, postDefense: 100, blocking: 100,
        stealing: 100, speed: 100, acceleration: 100, verticalLeap: 100, strength: 100,
        agility: 100, coordination: 100, bbiq: 100, consistency: 100
      };

      const normalized = normalizePlayer(maxPlayer);
      expect(validatePlayerAttributes(normalized)).toBe(true);
      expect(normalized.attributes.stamina).toBe(100);
    });

    it('handles player with mixed nested and flat format (nested takes precedence)', () => {
      const mixedPlayer = {
        id: 'mixed',
        name: 'Mixed',
        position: 'SG',
        attributes: {
          stamina: 80,
          shooting: 85,
          threePointShooting: 82,
          freeThrowShooting: 88,
          postScoring: 65,
          midRangeShooting: 80,
          layupDunking: 70,
          offensiveRebounding: 60,
          defensiveRebounding: 65,
          passing: 75,
          ballHandling: 78,
          onBallDefense: 80,
          offBallDefense: 78,
          perimeterDefense: 82,
          postDefense: 60,
          blocking: 55,
          stealing: 80,
          speed: 85,
          acceleration: 88,
          verticalLeap: 70,
          strength: 68,
          agility: 82,
          coordination: 80,
          bbiq: 85,
          consistency: 83
        },
        stamina: 50 // This should be ignored (nested takes precedence)
      };

      const normalized = normalizePlayer(mixedPlayer);
      expect(normalized.attributes.stamina).toBe(80); // From nested, not 50
    });
  });
});
