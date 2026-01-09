/**
 * Event System
 *
 * Typed pub/sub event system for game events:
 * - Match events (start, end, score updates)
 * - Player events (injury, training, contract)
 * - Season events (week advance, transfer window)
 * - Team events (standings changes)
 *
 * Week 4: Core event infrastructure
 */

import type { Season, Match, MatchResult, Injury, NewsItem } from '../data/types';

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * All possible event types in the game
 */
export type GameEventType =
  // Match events
  | 'match:scheduled'
  | 'match:started'
  | 'match:quarterEnd'
  | 'match:completed'
  | 'match:cancelled'
  // Player events
  | 'player:injured'
  | 'player:recovered'
  | 'player:training'
  | 'player:levelUp'
  | 'player:fatigued'
  // Season events
  | 'season:weekAdvanced'
  | 'season:phaseChanged'
  | 'season:transferWindowOpened'
  | 'season:transferWindowClosed'
  | 'season:completed'
  // Team events
  | 'team:standingsChanged'
  | 'team:promoted'
  | 'team:relegated'
  // Contract events
  | 'contract:offered'
  | 'contract:signed'
  | 'contract:expired'
  | 'contract:rejected'
  // Transfer events
  | 'transfer:offered'
  | 'transfer:accepted'
  | 'transfer:rejected'
  | 'transfer:completed';

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

/**
 * Base event with timestamp
 */
export interface BaseEvent {
  timestamp: Date;
}

/**
 * Match scheduled event
 */
export interface MatchScheduledEvent extends BaseEvent {
  type: 'match:scheduled';
  match: Match;
}

/**
 * Match started event
 */
export interface MatchStartedEvent extends BaseEvent {
  type: 'match:started';
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  sport: Match['sport'];
}

/**
 * Match quarter end event (for live updates)
 */
export interface MatchQuarterEndEvent extends BaseEvent {
  type: 'match:quarterEnd';
  matchId: string;
  quarter: number;
  homeScore: number;
  awayScore: number;
}

/**
 * Match completed event
 */
export interface MatchCompletedEvent extends BaseEvent {
  type: 'match:completed';
  matchId: string;
  result: MatchResult;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Player injured event
 */
export interface PlayerInjuredEvent extends BaseEvent {
  type: 'player:injured';
  playerId: string;
  playerName: string;
  teamId: string;
  injury: Injury;
  matchId?: string;
}

/**
 * Player recovered event
 */
export interface PlayerRecoveredEvent extends BaseEvent {
  type: 'player:recovered';
  playerId: string;
  playerName: string;
  teamId: string;
}

/**
 * Player training event
 */
export interface PlayerTrainingEvent extends BaseEvent {
  type: 'player:training';
  playerId: string;
  playerName: string;
  xpGained: {
    physical: number;
    mental: number;
    technical: number;
  };
}

/**
 * Player level up event (attribute improved)
 */
export interface PlayerLevelUpEvent extends BaseEvent {
  type: 'player:levelUp';
  playerId: string;
  playerName: string;
  attribute: string;
  oldValue: number;
  newValue: number;
}

/**
 * Season week advanced event
 */
export interface SeasonWeekAdvancedEvent extends BaseEvent {
  type: 'season:weekAdvanced';
  seasonId: string;
  previousWeek: number;
  newWeek: number;
  matchesThisWeek: number;
}

/**
 * Season phase changed event
 */
export interface SeasonPhaseChangedEvent extends BaseEvent {
  type: 'season:phaseChanged';
  seasonId: string;
  previousPhase: Season['status'];
  newPhase: Season['status'];
}

/**
 * Transfer window opened event
 */
export interface TransferWindowOpenedEvent extends BaseEvent {
  type: 'season:transferWindowOpened';
  seasonId: string;
  week: number;
}

/**
 * Transfer window closed event
 */
export interface TransferWindowClosedEvent extends BaseEvent {
  type: 'season:transferWindowClosed';
  seasonId: string;
  week: number;
}

/**
 * Season completed event
 */
export interface SeasonCompletedEvent extends BaseEvent {
  type: 'season:completed';
  seasonId: string;
  seasonNumber: number;
  champion: string;
  relegated: string[];
  promoted: string[];
}

/**
 * Team standings changed event
 */
export interface TeamStandingsChangedEvent extends BaseEvent {
  type: 'team:standingsChanged';
  teamId: string;
  previousRank: number;
  newRank: number;
  previousPoints: number;
  newPoints: number;
}

/**
 * Team promoted event
 */
export interface TeamPromotedEvent extends BaseEvent {
  type: 'team:promoted';
  teamId: string;
  teamName: string;
  fromDivision: number;
  toDivision: number;
}

/**
 * Team relegated event
 */
export interface TeamRelegatedEvent extends BaseEvent {
  type: 'team:relegated';
  teamId: string;
  teamName: string;
  fromDivision: number;
  toDivision: number;
}

/**
 * Union of all event types
 */
export type GameEvent =
  | MatchScheduledEvent
  | MatchStartedEvent
  | MatchQuarterEndEvent
  | MatchCompletedEvent
  | PlayerInjuredEvent
  | PlayerRecoveredEvent
  | PlayerTrainingEvent
  | PlayerLevelUpEvent
  | SeasonWeekAdvancedEvent
  | SeasonPhaseChangedEvent
  | TransferWindowOpenedEvent
  | TransferWindowClosedEvent
  | SeasonCompletedEvent
  | TeamStandingsChangedEvent
  | TeamPromotedEvent
  | TeamRelegatedEvent;

// =============================================================================
// EVENT LISTENER
// =============================================================================

/**
 * Event listener function type
 */
export type EventListener<T extends GameEvent = GameEvent> = (event: T) => void;

/**
 * Typed event listener map
 */
type EventListenerMap = {
  [K in GameEventType]?: EventListener[];
};

// =============================================================================
// EVENT EMITTER
// =============================================================================

/**
 * Game Event Emitter
 *
 * Thread-safe, typed pub/sub event system.
 * Supports wildcards and event history.
 */
export class GameEventEmitter {
  private listeners: EventListenerMap = {};
  private wildcardListeners: EventListener[] = [];
  private eventHistory: GameEvent[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Subscribe to a specific event type
   */
  on<T extends GameEvent>(eventType: T['type'], listener: EventListener<T>): () => void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType]!.push(listener as EventListener);

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  /**
   * Subscribe to all events
   */
  onAll(listener: EventListener): () => void {
    this.wildcardListeners.push(listener);

    return () => {
      const index = this.wildcardListeners.indexOf(listener);
      if (index !== -1) {
        this.wildcardListeners.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from a specific event type
   */
  off<T extends GameEvent>(eventType: T['type'], listener: EventListener<T>): void {
    const listeners = this.listeners[eventType];
    if (listeners) {
      const index = listeners.indexOf(listener as EventListener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<T extends GameEvent>(event: T): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const listeners = this.listeners[event.type];
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      }
    }

    // Notify wildcard listeners
    for (const listener of this.wildcardListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in wildcard event listener:`, error);
      }
    }
  }

  /**
   * Get event history
   */
  getHistory(eventType?: GameEventType): GameEvent[] {
    if (eventType) {
      return this.eventHistory.filter((e) => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get count of listeners for an event type
   */
  listenerCount(eventType?: GameEventType): number {
    if (eventType) {
      return (this.listeners[eventType]?.length ?? 0) + this.wildcardListeners.length;
    }
    let total = this.wildcardListeners.length;
    for (const listeners of Object.values(this.listeners)) {
      total += listeners?.length ?? 0;
    }
    return total;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(eventType?: GameEventType): void {
    if (eventType) {
      delete this.listeners[eventType];
    } else {
      this.listeners = {};
      this.wildcardListeners = [];
    }
  }
}

// =============================================================================
// EVENT FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a match completed event
 */
export function createMatchCompletedEvent(
  matchId: string,
  result: MatchResult,
  homeTeamId: string,
  awayTeamId: string
): MatchCompletedEvent {
  return {
    type: 'match:completed',
    timestamp: new Date(),
    matchId,
    result,
    homeTeamId,
    awayTeamId,
  };
}

/**
 * Create a player injured event
 */
export function createPlayerInjuredEvent(
  playerId: string,
  playerName: string,
  teamId: string,
  injury: Injury,
  matchId?: string
): PlayerInjuredEvent {
  return {
    type: 'player:injured',
    timestamp: new Date(),
    playerId,
    playerName,
    teamId,
    injury,
    matchId,
  };
}

/**
 * Create a season week advanced event
 */
export function createSeasonWeekAdvancedEvent(
  seasonId: string,
  previousWeek: number,
  newWeek: number,
  matchesThisWeek: number
): SeasonWeekAdvancedEvent {
  return {
    type: 'season:weekAdvanced',
    timestamp: new Date(),
    seasonId,
    previousWeek,
    newWeek,
    matchesThisWeek,
  };
}

/**
 * Create a team standings changed event
 */
export function createTeamStandingsChangedEvent(
  teamId: string,
  previousRank: number,
  newRank: number,
  previousPoints: number,
  newPoints: number
): TeamStandingsChangedEvent {
  return {
    type: 'team:standingsChanged',
    timestamp: new Date(),
    teamId,
    previousRank,
    newRank,
    previousPoints,
    newPoints,
  };
}

/**
 * Create a player training event
 */
export function createPlayerTrainingEvent(
  playerId: string,
  playerName: string,
  xpGained: { physical: number; mental: number; technical: number }
): PlayerTrainingEvent {
  return {
    type: 'player:training',
    timestamp: new Date(),
    playerId,
    playerName,
    xpGained,
  };
}

// =============================================================================
// NEWS ITEM CONVERSION
// =============================================================================

/**
 * Determine scope based on event type and team
 */
function getEventScope(eventType: string, teamId?: string): 'team' | 'division' | 'global' {
  // Transfer window events are global
  if (eventType.startsWith('season:transferWindow')) {
    return 'global';
  }
  // Team promotions/relegations that aren't user are division scope
  if (eventType === 'team:promoted' || eventType === 'team:relegated') {
    return teamId === 'user' ? 'team' : 'division';
  }
  // Default to team scope for player-related events
  return 'team';
}

/**
 * Convert a game event to a news item
 */
export function eventToNewsItem(event: GameEvent): NewsItem | null {
  const baseNewsItem = {
    id: `news-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: event.timestamp,
    read: false,
  };

  switch (event.type) {
    case 'match:completed':
      return {
        ...baseNewsItem,
        type: 'match' as const,
        priority: 'info' as const,
        title: 'Match Completed',
        message: `Final score: ${event.result.homeScore} - ${event.result.awayScore}`,
        relatedEntityId: event.matchId,
        scope: 'team' as const,
      };

    case 'player:injured':
      return {
        ...baseNewsItem,
        type: 'injury' as const,
        priority: (event.injury.injuryType === 'severe' ? 'critical' : 'important') as 'critical' | 'important',
        title: `${event.playerName} Injured`,
        message: `${event.injury.injuryName}. Expected recovery: ${event.injury.recoveryWeeks} weeks.`,
        relatedEntityId: event.playerId,
        scope: 'team' as const,
        teamId: event.teamId,
      };

    case 'player:recovered':
      return {
        ...baseNewsItem,
        type: 'injury' as const,
        priority: 'info' as const,
        title: `${event.playerName} Recovered`,
        message: `${event.playerName} has fully recovered and is available for selection.`,
        relatedEntityId: event.playerId,
        scope: 'team' as const,
        teamId: event.teamId,
      };

    case 'player:levelUp':
      return {
        ...baseNewsItem,
        type: 'progression' as const,
        priority: 'info' as const,
        title: `${event.playerName} Improved`,
        message: `${event.attribute} increased from ${event.oldValue} to ${event.newValue}.`,
        relatedEntityId: event.playerId,
        scope: 'team' as const,
      };

    case 'season:transferWindowOpened':
      return {
        ...baseNewsItem,
        type: 'window' as const,
        priority: 'important' as const,
        title: 'Transfer Window Open',
        message: 'The transfer window is now open. You can buy and sell players.',
        relatedEntityId: event.seasonId,
        scope: 'global' as const,
      };

    case 'season:transferWindowClosed':
      return {
        ...baseNewsItem,
        type: 'window' as const,
        priority: 'important' as const,
        title: 'Transfer Window Closed',
        message: 'The transfer window has closed. No more transfers until next window.',
        relatedEntityId: event.seasonId,
        scope: 'global' as const,
      };

    case 'team:promoted':
      return {
        ...baseNewsItem,
        type: 'general' as const,
        priority: 'critical' as const,
        title: `${event.teamName} Promoted!`,
        message: `Congratulations! The team has been promoted from Division ${event.fromDivision} to Division ${event.toDivision}.`,
        relatedEntityId: event.teamId,
        scope: getEventScope(event.type, event.teamId),
        teamId: event.teamId,
      };

    case 'team:relegated':
      return {
        ...baseNewsItem,
        type: 'general' as const,
        priority: 'critical' as const,
        title: `${event.teamName} Relegated`,
        message: `The team has been relegated from Division ${event.fromDivision} to Division ${event.toDivision}.`,
        relatedEntityId: event.teamId,
        scope: getEventScope(event.type, event.teamId),
        teamId: event.teamId,
      };

    default:
      return null;
  }
}

// =============================================================================
// GLOBAL EVENT EMITTER INSTANCE
// =============================================================================

/**
 * Global game event emitter
 * Use this for cross-module event communication
 */
export const gameEvents = new GameEventEmitter();
