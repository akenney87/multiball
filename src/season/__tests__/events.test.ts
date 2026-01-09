/**
 * Event System Tests
 *
 * Tests for the typed pub/sub event system:
 * - Event emission and subscription
 * - Event history tracking
 * - Wildcard listeners
 * - Event to news conversion
 */

import {
  GameEventEmitter,
  createMatchCompletedEvent,
  createPlayerInjuredEvent,
  createSeasonWeekAdvancedEvent,
  createTeamStandingsChangedEvent,
  createPlayerTrainingEvent,
  eventToNewsItem,
  type MatchCompletedEvent,
  type PlayerInjuredEvent,
  type GameEvent,
} from '../events';
import type { Injury, MatchResult } from '../../data/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockMatchResult(): MatchResult {
  return {
    matchId: 'match-1',
    homeScore: 105,
    awayScore: 98,
    winner: 'team-1',
    boxScore: {},
    playByPlay: ['Shot made', 'Rebound'],
  };
}

function createMockInjury(): Injury {
  const now = new Date();
  const returnDate = new Date(now);
  returnDate.setDate(returnDate.getDate() + 14);

  return {
    id: 'injury-1',
    playerId: 'player-1',
    injuryType: 'moderate',
    injuryName: 'Ankle sprain',
    occurredDate: now,
    recoveryWeeks: 2,
    returnDate,
    doctorReport: 'Expected to recover in 2 weeks.',
  };
}

// =============================================================================
// EVENT EMITTER TESTS
// =============================================================================

describe('GameEventEmitter', () => {
  let emitter: GameEventEmitter;

  beforeEach(() => {
    emitter = new GameEventEmitter();
  });

  describe('on / emit', () => {
    it('calls listener when event is emitted', () => {
      const listener = jest.fn();
      emitter.on('match:completed', listener);

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls multiple listeners for same event type', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      emitter.on('match:completed', listener1);
      emitter.on('match:completed', listener2);

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('does not call listener for different event type', () => {
      const listener = jest.fn();
      emitter.on('match:completed', listener);

      const event = createPlayerInjuredEvent(
        'player-1',
        'John Doe',
        'team-1',
        createMockInjury()
      );
      emitter.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('removes listener', () => {
      const listener = jest.fn();
      emitter.on('match:completed', listener);
      emitter.off('match:completed', listener);

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function from on()', () => {
      const listener = jest.fn();
      const unsubscribe = emitter.on('match:completed', listener);

      unsubscribe();

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('onAll', () => {
    it('calls wildcard listener for all events', () => {
      const listener = jest.fn();
      emitter.onAll(listener);

      const matchEvent = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      const injuryEvent = createPlayerInjuredEvent(
        'player-1',
        'John Doe',
        'team-1',
        createMockInjury()
      );

      emitter.emit(matchEvent);
      emitter.emit(injuryEvent);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(matchEvent);
      expect(listener).toHaveBeenCalledWith(injuryEvent);
    });

    it('returns unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = emitter.onAll(listener);

      unsubscribe();

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('event history', () => {
    it('stores emitted events in history', () => {
      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      const history = emitter.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(event);
    });

    it('filters history by event type', () => {
      const matchEvent = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      const injuryEvent = createPlayerInjuredEvent(
        'player-1',
        'John Doe',
        'team-1',
        createMockInjury()
      );

      emitter.emit(matchEvent);
      emitter.emit(injuryEvent);

      const matchHistory = emitter.getHistory('match:completed');
      expect(matchHistory).toHaveLength(1);
      expect(matchHistory[0].type).toBe('match:completed');
    });

    it('respects max history size', () => {
      const smallEmitter = new GameEventEmitter(2);

      for (let i = 0; i < 5; i++) {
        smallEmitter.emit(createMatchCompletedEvent(
          `match-${i}`,
          createMockMatchResult(),
          'team-1',
          'team-2'
        ));
      }

      const history = smallEmitter.getHistory();
      expect(history).toHaveLength(2);
    });

    it('clears history', () => {
      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);
      emitter.clearHistory();

      expect(emitter.getHistory()).toHaveLength(0);
    });
  });

  describe('listenerCount', () => {
    it('returns count for specific event type', () => {
      emitter.on('match:completed', jest.fn());
      emitter.on('match:completed', jest.fn());
      emitter.on('player:injured', jest.fn());

      expect(emitter.listenerCount('match:completed')).toBe(2);
      expect(emitter.listenerCount('player:injured')).toBe(1);
    });

    it('includes wildcard listeners in count', () => {
      emitter.on('match:completed', jest.fn());
      emitter.onAll(jest.fn());

      expect(emitter.listenerCount('match:completed')).toBe(2);
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for specific event type', () => {
      emitter.on('match:completed', jest.fn());
      emitter.on('match:completed', jest.fn());
      emitter.on('player:injured', jest.fn());

      emitter.removeAllListeners('match:completed');

      expect(emitter.listenerCount('match:completed')).toBe(0);
      expect(emitter.listenerCount('player:injured')).toBe(1);
    });

    it('removes all listeners when no type specified', () => {
      emitter.on('match:completed', jest.fn());
      emitter.on('player:injured', jest.fn());
      emitter.onAll(jest.fn());

      emitter.removeAllListeners();

      expect(emitter.listenerCount()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('continues calling other listeners if one throws', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = jest.fn();

      emitter.on('match:completed', errorListener);
      emitter.on('match:completed', normalListener);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const event = createMatchCompletedEvent(
        'match-1',
        createMockMatchResult(),
        'team-1',
        'team-2'
      );
      emitter.emit(event);

      expect(normalListener).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

// =============================================================================
// EVENT FACTORY TESTS
// =============================================================================

describe('Event Factory Functions', () => {
  describe('createMatchCompletedEvent', () => {
    it('creates event with correct type and data', () => {
      const result = createMockMatchResult();
      const event = createMatchCompletedEvent('match-1', result, 'team-1', 'team-2');

      expect(event.type).toBe('match:completed');
      expect(event.matchId).toBe('match-1');
      expect(event.result).toBe(result);
      expect(event.homeTeamId).toBe('team-1');
      expect(event.awayTeamId).toBe('team-2');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createPlayerInjuredEvent', () => {
    it('creates event with correct type and data', () => {
      const injury = createMockInjury();
      const event = createPlayerInjuredEvent(
        'player-1',
        'John Doe',
        'team-1',
        injury,
        'match-1'
      );

      expect(event.type).toBe('player:injured');
      expect(event.playerId).toBe('player-1');
      expect(event.playerName).toBe('John Doe');
      expect(event.teamId).toBe('team-1');
      expect(event.injury).toBe(injury);
      expect(event.matchId).toBe('match-1');
    });
  });

  describe('createSeasonWeekAdvancedEvent', () => {
    it('creates event with correct type and data', () => {
      const event = createSeasonWeekAdvancedEvent('season-1', 5, 6, 10);

      expect(event.type).toBe('season:weekAdvanced');
      expect(event.seasonId).toBe('season-1');
      expect(event.previousWeek).toBe(5);
      expect(event.newWeek).toBe(6);
      expect(event.matchesThisWeek).toBe(10);
    });
  });

  describe('createTeamStandingsChangedEvent', () => {
    it('creates event with correct type and data', () => {
      const event = createTeamStandingsChangedEvent('team-1', 5, 3, 30, 33);

      expect(event.type).toBe('team:standingsChanged');
      expect(event.teamId).toBe('team-1');
      expect(event.previousRank).toBe(5);
      expect(event.newRank).toBe(3);
      expect(event.previousPoints).toBe(30);
      expect(event.newPoints).toBe(33);
    });
  });

  describe('createPlayerTrainingEvent', () => {
    it('creates event with correct type and data', () => {
      const event = createPlayerTrainingEvent('player-1', 'John Doe', {
        physical: 5,
        mental: 3,
        technical: 4,
      });

      expect(event.type).toBe('player:training');
      expect(event.playerId).toBe('player-1');
      expect(event.playerName).toBe('John Doe');
      expect(event.xpGained.physical).toBe(5);
      expect(event.xpGained.mental).toBe(3);
      expect(event.xpGained.technical).toBe(4);
    });
  });
});

// =============================================================================
// NEWS CONVERSION TESTS
// =============================================================================

describe('eventToNewsItem', () => {
  it('converts match:completed to news item', () => {
    const event = createMatchCompletedEvent(
      'match-1',
      createMockMatchResult(),
      'team-1',
      'team-2'
    );
    const news = eventToNewsItem(event);

    expect(news).not.toBeNull();
    expect(news!.type).toBe('match');
    expect(news!.priority).toBe('info');
    expect(news!.title).toBe('Match Completed');
    expect(news!.message).toContain('105');
    expect(news!.message).toContain('98');
  });

  it('converts player:injured to news item with correct priority', () => {
    const minorInjury = { ...createMockInjury(), injuryType: 'minor' as const };
    const severeInjury = { ...createMockInjury(), injuryType: 'severe' as const };

    const minorEvent = createPlayerInjuredEvent('player-1', 'John Doe', 'team-1', minorInjury);
    const severeEvent = createPlayerInjuredEvent('player-1', 'John Doe', 'team-1', severeInjury);

    const minorNews = eventToNewsItem(minorEvent);
    const severeNews = eventToNewsItem(severeEvent);

    expect(minorNews!.priority).toBe('important');
    expect(severeNews!.priority).toBe('critical');
  });

  it('returns null for unhandled event types', () => {
    const event: GameEvent = {
      type: 'match:started',
      timestamp: new Date(),
      matchId: 'match-1',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      sport: 'basketball',
    };

    const news = eventToNewsItem(event);
    expect(news).toBeNull();
  });
});
