/**
 * Game Hooks System
 *
 * Pre/post processing hooks for game events:
 * - Pre-match: Lineup validation, fatigue checks
 * - Post-match: Injury rolls, XP distribution, standings updates
 * - Pre-week: Schedule validation, recovery processing
 * - Post-week: Training, news generation
 *
 * Week 4: Hook infrastructure
 */

import type { Player, Season, Match, MatchResult, Injury } from '../data/types';
import type { AIConfig } from '../ai/types';
import {
  GameEventEmitter,
  createMatchCompletedEvent,
  createPlayerInjuredEvent,
  createSeasonWeekAdvancedEvent,
  createTeamStandingsChangedEvent,
  createPlayerTrainingEvent,
  gameEvents,
} from './events';

// =============================================================================
// HOOK TYPES
// =============================================================================

/**
 * Pre-match hook context
 */
export interface PreMatchContext {
  season: Season;
  match: Match;
  homeRoster: Player[];
  awayRoster: Player[];
  homeConfig: AIConfig;
  awayConfig: AIConfig;
}

/**
 * Pre-match hook result
 */
export interface PreMatchResult {
  canProceed: boolean;
  warnings: string[];
  modifiedHomeRoster?: Player[];
  modifiedAwayRoster?: Player[];
}

/**
 * Post-match hook context
 */
export interface PostMatchContext {
  season: Season;
  match: Match;
  result: MatchResult;
  homeRoster: Player[];
  awayRoster: Player[];
  minutesPlayed: Record<string, number>;
}

/**
 * Post-match hook result
 */
export interface PostMatchResult {
  injuries: Injury[];
  updatedPlayers: Player[];
  newsItems: string[];
}

/**
 * Pre-week hook context
 */
export interface PreWeekContext {
  season: Season;
  weekNumber: number;
  allPlayers: Player[];
}

/**
 * Pre-week hook result
 */
export interface PreWeekResult {
  recoveredPlayers: string[];
  updatedPlayers: Player[];
}

/**
 * Post-week hook context
 */
export interface PostWeekContext {
  season: Season;
  weekNumber: number;
  allPlayers: Player[];
  matchesCompleted: Match[];
}

/**
 * Post-week hook result
 */
export interface PostWeekResult {
  xpDistributed: Record<string, { physical: number; mental: number; technical: number }>;
  updatedPlayers: Player[];
}

// =============================================================================
// HOOK FUNCTION TYPES
// =============================================================================

export type PreMatchHook = (context: PreMatchContext) => PreMatchResult;
export type PostMatchHook = (context: PostMatchContext) => PostMatchResult;
export type PreWeekHook = (context: PreWeekContext) => PreWeekResult;
export type PostWeekHook = (context: PostWeekContext) => PostWeekResult;

// =============================================================================
// HOOK REGISTRY
// =============================================================================

/**
 * Hook Registry
 *
 * Manages registration and execution of game hooks.
 * Hooks are executed in order of registration.
 */
export class HookRegistry {
  private preMatchHooks: PreMatchHook[] = [];
  private postMatchHooks: PostMatchHook[] = [];
  private preWeekHooks: PreWeekHook[] = [];
  private postWeekHooks: PostWeekHook[] = [];
  private eventEmitter: GameEventEmitter;

  constructor(eventEmitter: GameEventEmitter = gameEvents) {
    this.eventEmitter = eventEmitter;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a pre-match hook
   */
  registerPreMatch(hook: PreMatchHook): () => void {
    this.preMatchHooks.push(hook);
    return () => {
      const index = this.preMatchHooks.indexOf(hook);
      if (index !== -1) this.preMatchHooks.splice(index, 1);
    };
  }

  /**
   * Register a post-match hook
   */
  registerPostMatch(hook: PostMatchHook): () => void {
    this.postMatchHooks.push(hook);
    return () => {
      const index = this.postMatchHooks.indexOf(hook);
      if (index !== -1) this.postMatchHooks.splice(index, 1);
    };
  }

  /**
   * Register a pre-week hook
   */
  registerPreWeek(hook: PreWeekHook): () => void {
    this.preWeekHooks.push(hook);
    return () => {
      const index = this.preWeekHooks.indexOf(hook);
      if (index !== -1) this.preWeekHooks.splice(index, 1);
    };
  }

  /**
   * Register a post-week hook
   */
  registerPostWeek(hook: PostWeekHook): () => void {
    this.postWeekHooks.push(hook);
    return () => {
      const index = this.postWeekHooks.indexOf(hook);
      if (index !== -1) this.postWeekHooks.splice(index, 1);
    };
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute all pre-match hooks
   */
  executePreMatch(context: PreMatchContext): PreMatchResult {
    let canProceed = true;
    const allWarnings: string[] = [];
    let currentHomeRoster = context.homeRoster;
    let currentAwayRoster = context.awayRoster;

    for (const hook of this.preMatchHooks) {
      const result = hook({
        ...context,
        homeRoster: currentHomeRoster,
        awayRoster: currentAwayRoster,
      });

      if (!result.canProceed) {
        canProceed = false;
      }
      allWarnings.push(...result.warnings);

      if (result.modifiedHomeRoster) {
        currentHomeRoster = result.modifiedHomeRoster;
      }
      if (result.modifiedAwayRoster) {
        currentAwayRoster = result.modifiedAwayRoster;
      }
    }

    return {
      canProceed,
      warnings: allWarnings,
      modifiedHomeRoster: currentHomeRoster,
      modifiedAwayRoster: currentAwayRoster,
    };
  }

  /**
   * Execute all post-match hooks
   */
  executePostMatch(context: PostMatchContext): PostMatchResult {
    const allInjuries: Injury[] = [];
    const allNewsItems: string[] = [];
    let currentPlayers = [...context.homeRoster, ...context.awayRoster];

    for (const hook of this.postMatchHooks) {
      const result = hook(context);

      allInjuries.push(...result.injuries);
      allNewsItems.push(...result.newsItems);

      // Merge updated players
      if (result.updatedPlayers.length > 0) {
        const updatedMap = new Map(result.updatedPlayers.map((p) => [p.id, p]));
        currentPlayers = currentPlayers.map((p) => updatedMap.get(p.id) ?? p);
      }
    }

    // Emit match completed event
    this.eventEmitter.emit(
      createMatchCompletedEvent(
        context.match.id,
        context.result,
        context.match.homeTeamId,
        context.match.awayTeamId
      )
    );

    // Emit injury events
    for (const injury of allInjuries) {
      const player = currentPlayers.find((p) => p.id === injury.playerId);
      if (player) {
        this.eventEmitter.emit(
          createPlayerInjuredEvent(
            injury.playerId,
            player.name,
            player.teamId,
            injury,
            context.match.id
          )
        );
      }
    }

    return {
      injuries: allInjuries,
      updatedPlayers: currentPlayers,
      newsItems: allNewsItems,
    };
  }

  /**
   * Execute all pre-week hooks
   */
  executePreWeek(context: PreWeekContext): PreWeekResult {
    const allRecovered: string[] = [];
    let currentPlayers = [...context.allPlayers];

    for (const hook of this.preWeekHooks) {
      const result = hook({
        ...context,
        allPlayers: currentPlayers,
      });

      allRecovered.push(...result.recoveredPlayers);

      // Merge updated players
      if (result.updatedPlayers.length > 0) {
        const updatedMap = new Map(result.updatedPlayers.map((p) => [p.id, p]));
        currentPlayers = currentPlayers.map((p) => updatedMap.get(p.id) ?? p);
      }
    }

    return {
      recoveredPlayers: allRecovered,
      updatedPlayers: currentPlayers,
    };
  }

  /**
   * Execute all post-week hooks
   */
  executePostWeek(context: PostWeekContext): PostWeekResult {
    const allXp: Record<string, { physical: number; mental: number; technical: number }> = {};
    let currentPlayers = [...context.allPlayers];

    for (const hook of this.postWeekHooks) {
      const result = hook({
        ...context,
        allPlayers: currentPlayers,
      });

      // Merge XP
      for (const [playerId, xp] of Object.entries(result.xpDistributed)) {
        if (!allXp[playerId]) {
          allXp[playerId] = { physical: 0, mental: 0, technical: 0 };
        }
        allXp[playerId].physical += xp.physical;
        allXp[playerId].mental += xp.mental;
        allXp[playerId].technical += xp.technical;
      }

      // Merge updated players
      if (result.updatedPlayers.length > 0) {
        const updatedMap = new Map(result.updatedPlayers.map((p) => [p.id, p]));
        currentPlayers = currentPlayers.map((p) => updatedMap.get(p.id) ?? p);
      }
    }

    // Emit week advanced event
    this.eventEmitter.emit(
      createSeasonWeekAdvancedEvent(
        context.season.id,
        context.weekNumber - 1,
        context.weekNumber,
        context.matchesCompleted.length
      )
    );

    // Emit training events for significant XP gains
    for (const [playerId, xp] of Object.entries(allXp)) {
      const player = currentPlayers.find((p) => p.id === playerId);
      if (player && (xp.physical + xp.mental + xp.technical) > 0) {
        this.eventEmitter.emit(createPlayerTrainingEvent(playerId, player.name, xp));
      }
    }

    return {
      xpDistributed: allXp,
      updatedPlayers: currentPlayers,
    };
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Get hook counts
   */
  getHookCounts(): {
    preMatch: number;
    postMatch: number;
    preWeek: number;
    postWeek: number;
  } {
    return {
      preMatch: this.preMatchHooks.length,
      postMatch: this.postMatchHooks.length,
      preWeek: this.preWeekHooks.length,
      postWeek: this.postWeekHooks.length,
    };
  }

  /**
   * Clear all hooks
   */
  clearAllHooks(): void {
    this.preMatchHooks = [];
    this.postMatchHooks = [];
    this.preWeekHooks = [];
    this.postWeekHooks = [];
  }
}

// =============================================================================
// BUILT-IN HOOKS
// =============================================================================

/**
 * Pre-match: Validate roster has enough healthy players
 */
export const validateRosterHook: PreMatchHook = (context) => {
  const warnings: string[] = [];
  let canProceed = true;

  const healthyHome = context.homeRoster.filter((p) => !p.injury);
  const healthyAway = context.awayRoster.filter((p) => !p.injury);

  if (healthyHome.length < 5) {
    warnings.push(`Home team has only ${healthyHome.length} healthy players (minimum 5 required)`);
    canProceed = false;
  }

  if (healthyAway.length < 5) {
    warnings.push(`Away team has only ${healthyAway.length} healthy players (minimum 5 required)`);
    canProceed = false;
  }

  return { canProceed, warnings };
};

/**
 * Pre-match: Check for fatigued players
 */
export const checkFatigueHook: PreMatchHook = (context) => {
  const warnings: string[] = [];

  for (const player of context.homeRoster) {
    if (player.attributes.stamina < 30) {
      warnings.push(`${player.name} (Home) is fatigued (stamina: ${player.attributes.stamina})`);
    }
  }

  for (const player of context.awayRoster) {
    if (player.attributes.stamina < 30) {
      warnings.push(`${player.name} (Away) is fatigued (stamina: ${player.attributes.stamina})`);
    }
  }

  return { canProceed: true, warnings };
};

/**
 * Post-match: Roll for injuries based on minutes played
 */
export const injuryRollHook: PostMatchHook = (context) => {
  const injuries: Injury[] = [];
  const newsItems: string[] = [];
  const updatedPlayers: Player[] = [];

  const allPlayers = [...context.homeRoster, ...context.awayRoster];

  for (const player of allPlayers) {
    const minutes = context.minutesPlayed[player.id] ?? 0;
    if (minutes === 0) continue;

    // Already injured players can't get new injuries
    if (player.injury) continue;

    // Base injury chance: 0.5% per 10 minutes played
    // Modified by durability (higher = less likely)
    const baseChance = (minutes / 10) * 0.005;
    const durabilityModifier = (100 - player.attributes.durability) / 100;
    const injuryChance = baseChance * (0.5 + durabilityModifier);

    if (Math.random() < injuryChance) {
      const injury = rollInjury(player);
      injuries.push(injury);
      newsItems.push(`${player.name} suffered a ${injury.injuryName}`);

      // Update player with injury
      updatedPlayers.push({
        ...player,
        injury,
      });
    }
  }

  return { injuries, updatedPlayers, newsItems };
};

/**
 * Roll for injury type and severity
 */
function rollInjury(player: Player): Injury {
  const now = new Date();
  const roll = Math.random();

  let injuryType: Injury['injuryType'];
  let recoveryWeeks: number;
  let injuryName: string;
  let doctorReport: string;

  if (roll < 0.6) {
    // 60% minor
    injuryType = 'minor';
    recoveryWeeks = Math.floor(Math.random() * 2) + 1; // 1-2 weeks
    const minorInjuries = ['Sore ankle', 'Minor knee strain', 'Bruised hip', 'Finger sprain'];
    injuryName = minorInjuries[Math.floor(Math.random() * minorInjuries.length)];
    doctorReport = `${player.name} has sustained a ${injuryName.toLowerCase()}. Expected to return in ${recoveryWeeks} week${recoveryWeeks > 1 ? 's' : ''}.`;
  } else if (roll < 0.9) {
    // 30% moderate
    injuryType = 'moderate';
    recoveryWeeks = Math.floor(Math.random() * 4) + 3; // 3-6 weeks
    const moderateInjuries = ['Ankle sprain', 'Hamstring strain', 'Groin injury', 'Calf strain'];
    injuryName = moderateInjuries[Math.floor(Math.random() * moderateInjuries.length)];
    doctorReport = `${player.name} has suffered a ${injuryName.toLowerCase()}. Will be sidelined for approximately ${recoveryWeeks} weeks.`;
  } else {
    // 10% severe
    injuryType = 'severe';
    recoveryWeeks = Math.floor(Math.random() * 12) + 8; // 8-20 weeks
    const severeInjuries = ['ACL tear', 'Achilles rupture', 'Fractured foot', 'Torn meniscus'];
    injuryName = severeInjuries[Math.floor(Math.random() * severeInjuries.length)];
    doctorReport = `${player.name} has sustained a serious ${injuryName.toLowerCase()}. Facing a lengthy recovery of ${recoveryWeeks} weeks.`;
  }

  const returnDate = new Date(now);
  returnDate.setDate(returnDate.getDate() + recoveryWeeks * 7);

  return {
    id: `injury-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    playerId: player.id,
    injuryType,
    injuryName,
    occurredDate: now,
    recoveryWeeks,
    returnDate,
    doctorReport,
  };
}

/**
 * Pre-week: Process injury recovery
 */
export const recoveryProcessingHook: PreWeekHook = (context) => {
  const recoveredPlayers: string[] = [];
  const updatedPlayers: Player[] = [];
  const now = new Date();

  for (const player of context.allPlayers) {
    if (player.injury && player.injury.returnDate <= now) {
      recoveredPlayers.push(player.id);
      updatedPlayers.push({
        ...player,
        injury: null,
      });
    }
  }

  return { recoveredPlayers, updatedPlayers };
};

/**
 * Post-week: Distribute training XP
 */
export const trainingXpHook: PostWeekHook = (context) => {
  const xpDistributed: Record<string, { physical: number; mental: number; technical: number }> = {};
  const updatedPlayers: Player[] = [];

  for (const player of context.allPlayers) {
    // Skip injured players (reduced training)
    const injuryModifier = player.injury ? 0.25 : 1.0;

    // Base XP from training focus
    const focus = player.trainingFocus ?? { physical: 34, mental: 33, technical: 33 };

    // Base XP per week: 5-15 depending on determination
    const baseXp = 5 + (player.attributes.determination / 100) * 10;

    const physicalXp = Math.floor(baseXp * (focus.physical / 100) * injuryModifier);
    const mentalXp = Math.floor(baseXp * (focus.mental / 100) * injuryModifier);
    const technicalXp = Math.floor(baseXp * (focus.technical / 100) * injuryModifier);

    xpDistributed[player.id] = {
      physical: physicalXp,
      mental: mentalXp,
      technical: technicalXp,
    };

    // Update player's weekly XP
    updatedPlayers.push({
      ...player,
      weeklyXP: {
        physical: (player.weeklyXP?.physical ?? 0) + physicalXp,
        mental: (player.weeklyXP?.mental ?? 0) + mentalXp,
        technical: (player.weeklyXP?.technical ?? 0) + technicalXp,
      },
    });
  }

  return { xpDistributed, updatedPlayers };
};

// =============================================================================
// DEFAULT HOOK REGISTRY
// =============================================================================

/**
 * Create a hook registry with default hooks
 */
export function createDefaultHookRegistry(eventEmitter?: GameEventEmitter): HookRegistry {
  const registry = new HookRegistry(eventEmitter);

  // Register default hooks
  registry.registerPreMatch(validateRosterHook);
  registry.registerPreMatch(checkFatigueHook);
  registry.registerPostMatch(injuryRollHook);
  registry.registerPreWeek(recoveryProcessingHook);
  registry.registerPostWeek(trainingXpHook);

  return registry;
}

/**
 * Global hook registry instance
 */
export const gameHooks = createDefaultHookRegistry();
