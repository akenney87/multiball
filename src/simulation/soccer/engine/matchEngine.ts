/**
 * Soccer Match Engine - Event-Driven Simulation
 *
 * Simulates soccer matches minute-by-minute with player attributes
 * directly influencing all events and outcomes.
 *
 * @module simulation/soccer/engine/matchEngine
 */

import { Player } from '../../../data/types';
import {
  SoccerTeamState,
  SoccerMatchInput,
  SoccerMatchResult,
  SoccerEvent,
  SoccerPosition,
  SoccerBoxScore,
  SoccerPlayerStats,
  PenaltyShootoutResult,
} from '../types';
import {
  FORMATION_MODIFIERS,
  ATTACKING_STYLE_MODIFIERS,
  PRESSING_MODIFIERS,
  WIDTH_MODIFIERS,
  GOAL_POSITION_WEIGHTS,
  ASSIST_POSITION_WEIGHTS,
  POSITION_FOUL_WEIGHTS,
  BASE_SAVE_RATE,
  GK_RATING_SAVE_IMPACT,
  CORNER_TO_SHOT_PROBABILITY,
  FREE_KICK_TO_SHOT_PROBABILITY,
  SET_PIECE_HEIGHT_ADVANTAGE,
  AVERAGE_PLAYER_HEIGHT,
  SET_PIECE_SHOT_QUALITY,
  SET_PIECE_TARGET_WEIGHTS,
} from '../constants';
import { calculateSoccerPositionOverall } from '../utils/positionRatings';
import {
  SubstitutionState,
  SubstitutionConfig,
  SoccerPlayerWithMinutes,
  applyMinutesAllocation,
  calculateAutoMinutesAllocation,
  checkForSubstitution,
  executeSubstitution,
  updateFatigue,
  handleRedCard,
  handleInjury,
  recordYellowCard,
  DEFAULT_SUB_CONFIG,
} from '../systems/substitutionSystem';
import {
  InGameInjuryTracker,
  InGameInjuryOutcome,
  soccerMustSubstitute,
} from '../../../systems/injurySystem';
import type { InjuryData } from '../../../systems/injurySystem';

// =============================================================================
// TYPES
// =============================================================================

interface MatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';

  // Active lineups (changes with subs/reds)
  homeLineup: Player[];
  awayLineup: Player[];

  // Position maps
  homePositions: Record<string, SoccerPosition>;
  awayPositions: Record<string, SoccerPosition>;

  // Cards tracking (playerId -> yellow count)
  yellowCards: Map<string, number>;
  redCardPlayers: Set<string>;

  // Substitution state for both teams
  homeSubState: SubstitutionState;
  awaySubState: SubstitutionState;

  // Events generated
  events: SoccerEvent[];

  // Stoppage time
  firstHalfStoppage: number;
  secondHalfStoppage: number;

  // Team references
  homeTeam: SoccerTeamState;
  awayTeam: SoccerTeamState;

  // Player stats tracking
  homeStats: Map<string, SoccerPlayerStats>;
  awayStats: Map<string, SoccerPlayerStats>;

  // Injury tracking
  injuryTracker: InGameInjuryTracker;
}

interface ShotContext {
  shooter: Player;
  position: SoccerPosition;
  quality: 'fullChance' | 'halfChance' | 'longRange';
  foot: 'left' | 'right' | 'header';
  location: string;
  assister?: Player;
  assistType?: string;
}

// =============================================================================
// NARRATIVE TEMPLATES
// =============================================================================

const SHOT_LOCATIONS = {
  fullChance: [
    'from the center of the box',
    'from the right side of the box',
    'from the left side of the box',
    'from close range',
    'from the six yard box',
  ],
  halfChance: [
    'from the edge of the box',
    'from the right side of the box',
    'from the left side of the box',
    'from a tight angle on the right',
    'from a tight angle on the left',
  ],
  longRange: [
    'from outside the box',
    'from long range',
    'from about 25 yards out',
    'from about 30 yards out',
    'from distance',
  ],
};

const HEADER_LOCATIONS = [
  'from the center of the box',
  'from very close range',
  'from the six yard box',
  'at the back post',
  'at the near post',
];

const MISS_DESCRIPTIONS = [
  'is high and wide to the left',
  'is high and wide to the right',
  'goes just over the bar',
  'goes just wide of the right post',
  'goes just wide of the left post',
  'is way off target',
  'flies over the crossbar',
  'drifts wide',
];

const SAVE_DESCRIPTIONS = [
  'is saved in the bottom left corner',
  'is saved in the bottom right corner',
  'is saved in the top left corner',
  'is saved in the top right corner',
  'is saved by an excellent diving stop',
  'is parried away',
  'is tipped over the bar',
  'is caught comfortably',
];

const GOAL_DESCRIPTIONS = [
  'finds the bottom left corner',
  'finds the bottom right corner',
  'nestles in the top left corner',
  'rockets into the top right corner',
  'beats the keeper at his near post',
  'loops over the goalkeeper',
  'is slotted home coolly',
  'thunders into the net',
];

const BLOCK_DESCRIPTIONS = [
  'is blocked',
  'is blocked by a defender',
  'is deflected behind for a corner',
  'is bravely blocked',
  'hits the defender and goes out',
];

const ASSIST_TYPES = [
  'with a cross',
  'with a through ball',
  'with a clever pass',
  'with a headed pass',
  'following a corner',
  'following a set piece',
  'with a cutback',
  'with a long ball',
];

const FOUL_DESCRIPTIONS = [
  'brings down',
  'trips',
  'fouls',
  'catches',
  'brings down',
  'makes a late challenge on',
  'clips the heels of',
  'upends',
];

const CARD_REASONS = [
  'for a bad foul',
  'for persistent fouling',
  'for a reckless challenge',
  'for dissent',
  'for a tactical foul',
  'for time wasting',
  'for a dangerous tackle',
  'for unsporting behavior',
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function weightedRandomPick<T>(items: Array<{ item: T; weight: number }>): T {
  const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const { item, weight } of items) {
    random -= weight;
    if (random <= 0) return item;
  }

  return items[0]!.item;
}

function getPlayerPosition(playerId: string, state: MatchState): SoccerPosition {
  return state.homePositions[playerId] || state.awayPositions[playerId] || 'CM';
}

function isHomePlayer(playerId: string, state: MatchState): boolean {
  return state.homeLineup.some(p => p.id === playerId);
}

function getActiveLineup(team: 'home' | 'away', state: MatchState): Player[] {
  const lineup = team === 'home' ? state.homeLineup : state.awayLineup;
  return lineup.filter(p => !state.redCardPlayers.has(p.id));
}

function getTeamPositions(team: 'home' | 'away', state: MatchState): Record<string, SoccerPosition> {
  return team === 'home' ? state.homePositions : state.awayPositions;
}

/**
 * Update plus/minus for all players on field when a goal is scored
 * @param scoringTeam - The team that scored ('home' or 'away')
 * @param state - Current match state
 */
function updatePlusMinus(scoringTeam: 'home' | 'away', state: MatchState): void {
  const defendingTeam = scoringTeam === 'home' ? 'away' : 'home';

  // Get all players currently on field for both teams
  const scoringLineup = getActiveLineup(scoringTeam, state);
  const concedingLineup = getActiveLineup(defendingTeam, state);

  const scoringStats = scoringTeam === 'home' ? state.homeStats : state.awayStats;
  const concedingStats = defendingTeam === 'home' ? state.homeStats : state.awayStats;

  // +1 for all players on the scoring team
  for (const player of scoringLineup) {
    const stats = scoringStats.get(player.id) || createEmptyStats();
    stats.plusMinus++;
    scoringStats.set(player.id, stats);
  }

  // -1 for all players on the conceding team
  for (const player of concedingLineup) {
    const stats = concedingStats.get(player.id) || createEmptyStats();
    stats.plusMinus--;
    concedingStats.set(player.id, stats);
  }
}

// =============================================================================
// NUMERICAL ADVANTAGE (RED CARD IMPACT)
// =============================================================================

/**
 * Calculate the player count for each team (excluding sent-off players)
 */
function getActivePlayerCounts(state: MatchState): { home: number; away: number } {
  const homeCount = getActiveLineup('home', state).length;
  const awayCount = getActiveLineup('away', state).length;
  return { home: homeCount, away: awayCount };
}

/**
 * Calculate numerical advantage modifiers for a team.
 * Returns modifiers for possession, attack, defense, and fatigue.
 *
 * Real-world impact of playing down a man:
 * - 10v11: ~60-65% possession for full team, ~15-20% higher goal probability
 * - 9v11: Even more extreme disadvantage
 *
 * @param team - The team to calculate modifiers for
 * @param state - Current match state
 * @returns Modifiers object with possession, attack, defense, fatigue adjustments
 */
function getNumericalAdvantageModifiers(team: 'home' | 'away', state: MatchState): {
  possession: number;   // Additive modifier to possession % (e.g., +7 means +7%)
  attack: number;       // Multiplicative modifier (e.g., 1.1 = 10% boost)
  defense: number;      // Multiplicative modifier (e.g., 0.85 = 15% weaker)
  fatigue: number;      // Multiplicative modifier for fatigue rate (e.g., 1.3 = 30% faster)
} {
  const counts = getActivePlayerCounts(state);
  const myCount = team === 'home' ? counts.home : counts.away;
  const oppCount = team === 'home' ? counts.away : counts.home;

  // Calculate player difference (positive = advantage, negative = disadvantage)
  const playerDiff = myCount - oppCount;

  if (playerDiff === 0) {
    // Even numbers - no modifier
    return { possession: 0, attack: 1.0, defense: 1.0, fatigue: 1.0 };
  }

  // Per-player modifiers (based on real-world data)
  // Each extra player gives roughly:
  // - +7% possession
  // - +15% attack effectiveness (more passing options, overloads)
  // - +20% defensive strength (more coverage)
  // Each missing player means:
  // - Faster fatigue (covering more ground)

  const POSSESSION_PER_PLAYER = 7;      // +7% possession per extra player
  const ATTACK_PER_PLAYER = 0.12;       // +12% attack per extra player
  const DEFENSE_PER_PLAYER = 0.15;      // +15% defense per extra player
  const FATIGUE_PER_MISSING = 0.25;     // +25% fatigue rate per missing player

  const possessionMod = playerDiff * POSSESSION_PER_PLAYER;

  // Attack/defense modifiers (multiplicative)
  const attackMod = playerDiff > 0
    ? 1 + (playerDiff * ATTACK_PER_PLAYER)
    : 1 / (1 + (Math.abs(playerDiff) * ATTACK_PER_PLAYER));

  const defenseMod = playerDiff > 0
    ? 1 + (playerDiff * DEFENSE_PER_PLAYER)
    : 1 / (1 + (Math.abs(playerDiff) * DEFENSE_PER_PLAYER));

  // Fatigue modifier (only applies when short-handed)
  const fatigueMod = playerDiff < 0
    ? 1 + (Math.abs(playerDiff) * FATIGUE_PER_MISSING)
    : 1.0;

  return {
    possession: possessionMod,
    attack: attackMod,
    defense: defenseMod,
    fatigue: fatigueMod,
  };
}

// =============================================================================
// ATTRIBUTE COMPOSITES
// =============================================================================

/**
 * Calculate player's aggression level (likelihood to commit fouls)
 * High bravery + determination = aggressive
 * High composure + patience = disciplined
 */
function getPlayerAggression(player: Player): number {
  const aggressive = (player.attributes.bravery * 0.3 + player.attributes.determination * 0.25);
  const disciplined = (player.attributes.composure * 0.25 + player.attributes.patience * 0.2);
  return aggressive - disciplined + 50; // Normalized around 50
}

/**
 * Calculate player's attacking threat (likelihood to be involved in chances)
 */
function getAttackingThreat(player: Player, position: SoccerPosition): number {
  const posWeight = GOAL_POSITION_WEIGHTS[position] || 1.0;
  const skillBase = calculateSoccerPositionOverall(player, position);
  const creativity = player.attributes.creativity * 0.3;
  const pace = player.attributes.top_speed * 0.2;

  return (skillBase + creativity + pace) * posWeight / 2;
}

/**
 * Calculate player's shooting accuracy
 * Determines if shot is on target and how hard it is to save
 *
 * @param player - The shooter
 * @param shotQuality - Type of chance (fullChance lets player express full skill)
 * @param fatigue - Player's current fatigue level (0-100, 100 = fresh)
 */
function getShootingAccuracy(
  player: Player,
  shotQuality: 'fullChance' | 'halfChance' | 'longRange' = 'halfChance',
  fatigue: number = 100
): number {
  // Base accuracy from attributes (sum = 1.0)
  const baseAccuracy = (
    player.attributes.form_technique * 0.25 +
    player.attributes.finesse * 0.25 +
    player.attributes.composure * 0.20 +
    player.attributes.balance * 0.15 +
    player.attributes.footwork * 0.15
  );

  // Shot quality modifier: fullChance = express full skill, longRange = harder
  const qualityMultiplier = shotQuality === 'fullChance' ? 1.0
                          : shotQuality === 'halfChance' ? 0.85
                          : 0.70; // longRange

  // Fatigue penalty: tired players less accurate
  // At 100 fatigue = 1.0x, at 50 fatigue = 0.9x, at 0 fatigue = 0.8x
  const fatigueMultiplier = 0.8 + (fatigue / 100) * 0.2;

  return baseAccuracy * qualityMultiplier * fatigueMultiplier;
}

/**
 * Calculate goalkeeper save ability
 */
function getGKRating(player: Player): number {
  return calculateSoccerPositionOverall(player, 'GK');
}

// =============================================================================
// SUBSTITUTION STATE INITIALIZATION
// =============================================================================

/**
 * Initialize substitution state for a team
 */
function initializeSubstitutionState(
  team: SoccerTeamState,
  side: 'home' | 'away'
): SubstitutionState {
  const startingLineupIds = team.lineup.map(p => p.id);

  // If user has provided minutes allocation, use it
  // Otherwise, auto-calculate based on ratings
  let playersWithMinutes: SoccerPlayerWithMinutes[];

  if (team.minutesAllocation && Object.keys(team.minutesAllocation).length > 0) {
    // Combine lineup and bench for full roster
    const fullRoster = [...team.lineup, ...(team.bench || [])];
    playersWithMinutes = applyMinutesAllocation(
      fullRoster,
      team.minutesAllocation,
      startingLineupIds,
      team.positions
    );
  } else {
    // Auto-calculate for AI teams
    const fullRoster = [...team.lineup, ...(team.bench || [])];
    playersWithMinutes = calculateAutoMinutesAllocation(
      fullRoster,
      startingLineupIds,
      team.positions
    );
  }

  return {
    onField: playersWithMinutes.filter(p => startingLineupIds.includes(p.id)),
    onBench: playersWithMinutes.filter(p => !startingLineupIds.includes(p.id)),
    substitutionsMade: 0,
    windowsUsed: 0,
    inSubWindow: false,
    currentMinute: 0,
    isUserTeam: team.isUserTeam || false,
  };
}

/**
 * Calculate player's defensive ability for blocks
 *
 * @param player - The defending player
 * @param fatigue - Player's current fatigue level (0-100, 100 = fresh)
 */
function getDefensiveAbility(player: Player, fatigue: number = 100): number {
  const baseAbility = (
    player.attributes.reactions * 0.25 +
    player.attributes.awareness * 0.25 +
    player.attributes.bravery * 0.20 +
    player.attributes.agility * 0.15 +
    player.attributes.jumping * 0.10 +
    player.attributes.determination * 0.05
  );

  // Fatigue penalty: tired defenders are slower to react
  // At 100 fatigue = 1.0x, at 50 fatigue = 0.85x, at 0 fatigue = 0.70x
  const fatigueMultiplier = 0.70 + (fatigue / 100) * 0.30;

  return baseAbility * fatigueMultiplier;
}

/**
 * Calculate player's playmaking ability for assists
 * Used to determine who provides the assist
 */
function getPlaymakingRating(player: Player): number {
  return (
    player.attributes.creativity * 0.30 +
    player.attributes.awareness * 0.25 +
    player.attributes.finesse * 0.20 +
    player.attributes.composure * 0.15 +
    player.attributes.teamwork * 0.10
  );
}

/**
 * Calculate player's shot quality rating
 * Used to determine full chance vs half chance vs long range
 *
 * Weights (sum to 100%):
 * - Physical: agility (5), accel (5), top_speed (5), reactions (5), balance (5) = 25%
 * - Mental: awareness (10), creativity (10), composure (10), teamwork (10) = 40%
 * - Technical: form_technique (5), finesse (10), deception (10), footwork (10) = 35%
 */
function getShotQualityRating(player: Player): number {
  return (
    player.attributes.agility * 0.05 +
    player.attributes.acceleration * 0.05 +
    player.attributes.top_speed * 0.05 +
    player.attributes.reactions * 0.05 +
    player.attributes.balance * 0.05 +
    player.attributes.awareness * 0.10 +
    player.attributes.creativity * 0.10 +
    player.attributes.composure * 0.10 +
    player.attributes.form_technique * 0.05 +
    player.attributes.finesse * 0.10 +
    player.attributes.deception * 0.10 +
    player.attributes.teamwork * 0.10 +
    player.attributes.footwork * 0.10
  );
}

// =============================================================================
// PLAYER SELECTION
// =============================================================================

/**
 * Add randomness to player selection weights to ensure variety
 * while still favoring players with higher base weights
 */
function addSelectionVariance(baseWeight: number): number {
  // Add 30-70% random variance to the weight
  const variance = 0.3 + Math.random() * 0.4;
  return baseWeight * variance + Math.random() * 0.5; // Add flat random component too
}

/**
 * Select a player to commit a foul based on position and aggression
 */
function selectFouler(team: 'home' | 'away', state: MatchState): Player {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);

  const weighted = lineup.map(player => {
    const pos = positions[player.id] || 'CM';
    const posWeight = POSITION_FOUL_WEIGHTS[pos] || 1.0;
    const aggression = getPlayerAggression(player);
    const baseWeight = posWeight * (aggression / 50);

    return {
      item: player,
      weight: Math.max(0.1, addSelectionVariance(baseWeight)),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select a player to be fouled (usually attackers)
 */
function selectFoulVictim(team: 'home' | 'away', state: MatchState): Player {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);

  const weighted = lineup.map(player => {
    const pos = positions[player.id] || 'CM';
    const posWeight = GOAL_POSITION_WEIGHTS[pos] || 1.0; // Attackers get fouled more
    const trickiness = (
      player.attributes.agility * 0.3 +
      player.attributes.top_speed * 0.3 +
      player.attributes.creativity * 0.2 +
      player.attributes.balance * 0.2
    ) / 100;
    const baseWeight = posWeight * (0.5 + trickiness);

    return {
      item: player,
      weight: Math.max(0.1, addSelectionVariance(baseWeight)),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select shooter based on attacking threat and position
 */
function selectShooter(team: 'home' | 'away', state: MatchState): { player: Player; position: SoccerPosition } {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);

  const weighted = lineup.map(player => {
    const pos = positions[player.id] || 'CM';
    const threat = getAttackingThreat(player, pos);

    return {
      item: { player, position: pos },
      weight: Math.max(0.1, addSelectionVariance(threat)),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select assister based on playmaking ability and position
 *
 * @param team - The attacking team
 * @param excludePlayer - The shooter (can't assist themselves)
 * @param state - Current match state
 * @param requireAssist - If true, always return an assister (for headers which require delivery)
 */
function selectAssister(
  team: 'home' | 'away',
  excludePlayer: Player,
  state: MatchState,
  requireAssist: boolean = false
): Player | null {
  // 70% of goals have assists normally, but headers always require an assist
  // (someone has to deliver the ball for a header)
  if (!requireAssist && Math.random() > 0.70) return null;

  const lineup = getActiveLineup(team, state).filter(p => p.id !== excludePlayer.id);
  const positions = getTeamPositions(team, state);

  if (lineup.length === 0) return null;

  const weighted = lineup.map(player => {
    const pos = positions[player.id] || 'CM';
    const posWeight = ASSIST_POSITION_WEIGHTS[pos] || 1.0;
    const playmaking = getPlaymakingRating(player);

    return {
      item: player,
      weight: Math.max(0.1, posWeight * (playmaking / 50)),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select blocker from defensive positions and return their fatigue
 */
function selectBlocker(team: 'home' | 'away', state: MatchState): { player: Player; fatigue: number } {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);
  const subState = team === 'home' ? state.homeSubState : state.awaySubState;
  const defPositions = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'];

  const defenders = lineup.filter(p => defPositions.includes(positions[p.id] || ''));
  const candidates = defenders.length > 0 ? defenders : lineup;

  const weighted = candidates.map(player => {
    // Get player's fatigue from substitution state
    const playerState = subState.onField.find(p => p.id === player.id);
    const fatigue = playerState?.fatigue ?? 100;
    const defensive = getDefensiveAbility(player, fatigue);
    return {
      item: { player, fatigue },
      weight: Math.max(0.1, defensive / 50),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select player for offside
 * Fast players with good awareness are more likely to be in offside positions
 * (they make more runs and push the line)
 */
function selectOffsidePlayer(team: 'home' | 'away', state: MatchState): Player {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);
  const attackPositions = ['ST', 'CF', 'LW', 'RW', 'CAM'];

  const attackers = lineup.filter(p => attackPositions.includes(positions[p.id] || ''));
  const candidates = attackers.length > 0 ? attackers : lineup;

  const weighted = candidates.map(player => {
    const pos = positions[player.id] || 'CM';
    const posWeight = GOAL_POSITION_WEIGHTS[pos] || 1.0;
    // Fast players who make attacking runs are more likely to be caught offside
    const runningThreat = (player.attributes.top_speed + player.attributes.acceleration) / 2;

    return {
      item: player,
      weight: Math.max(0.1, posWeight * (runningThreat / 50)),
    };
  });

  return weightedRandomPick(weighted);
}

/**
 * Select player who conceded a corner
 */
function selectCornerConceder(team: 'home' | 'away', state: MatchState): Player {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);
  const defPositions = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'];

  const defenders = lineup.filter(p => defPositions.includes(positions[p.id] || ''));
  return defenders.length > 0 ? randomPick(defenders) : randomPick(lineup);
}

// =============================================================================
// SHOT PROCESSING
// =============================================================================

/**
 * Position weights for chance creation involvement
 * Attackers are much more likely to be involved in creating chances
 */
const CHANCE_CREATION_POSITION_WEIGHTS: Record<string, number> = {
  ST: 2.5,
  CF: 2.3,
  LW: 2.2,
  RW: 2.2,
  CAM: 2.5,
  LM: 1.5,
  RM: 1.5,
  CM: 1.2,
  CDM: 0.6,
  LWB: 0.8,
  RWB: 0.8,
  LB: 0.5,
  RB: 0.5,
  CB: 0.2,
  GK: 0.05,
};

/**
 * Determine how many players are involved in creating a chance
 * Solo efforts are rare, most chances involve 2-3 players
 */
function determinePlayersInvolved(): number {
  const roll = Math.random() * 100;

  if (roll < 10) return 1;      // 10% solo effort
  if (roll < 55) return 2;      // 45% shooter + 1 teammate
  return 3;                      // 45% shooter + 2 teammates
}

/**
 * Select additional players involved in chance creation
 * Weighted by position - attackers more likely to be involved
 */
function selectChanceCreators(
  team: 'home' | 'away',
  shooter: Player,
  count: number,
  state: MatchState
): Player[] {
  if (count === 0) return [];

  const lineup = getActiveLineup(team, state).filter(p => p.id !== shooter.id);
  const positions = getTeamPositions(team, state);

  if (lineup.length === 0) return [];

  const selected: Player[] = [];
  let remainingCandidates = [...lineup];

  for (let i = 0; i < count && remainingCandidates.length > 0; i++) {
    const weighted = remainingCandidates.map(player => {
      const pos = positions[player.id] || 'CM';
      const posWeight = CHANCE_CREATION_POSITION_WEIGHTS[pos] || 1.0;

      return {
        item: player,
        weight: Math.max(0.05, posWeight),
      };
    });

    const chosen = weightedRandomPick(weighted);
    selected.push(chosen);
    remainingCandidates = remainingCandidates.filter(p => p.id !== chosen.id);
  }

  return selected;
}

/**
 * Determine contribution weights for each player in chance creation
 * Returns array of weights that sum to 1.0
 */
function determineContributionWeights(playerCount: number): number[] {
  if (playerCount === 1) return [1.0];

  if (playerCount === 2) {
    // Possible splits for 2 players (in 10% increments)
    const splits = [
      [0.7, 0.3],
      [0.6, 0.4],
      [0.5, 0.5],
      [0.4, 0.6],
      [0.3, 0.7],
    ];
    return randomPick(splits);
  }

  // 3 players - various weight distributions
  const splits = [
    [0.5, 0.3, 0.2],
    [0.4, 0.4, 0.2],
    [0.4, 0.3, 0.3],
    [0.3, 0.4, 0.3],
    [0.3, 0.3, 0.4],
    [0.2, 0.4, 0.4],
    [0.2, 0.3, 0.5],
  ];
  return randomPick(splits);
}

/**
 * Calculate team shot quality using multiple players
 * Soccer is a team game - chances are rarely created solo
 */
function calculateTeamShotQuality(
  shooter: Player,
  team: 'home' | 'away',
  state: MatchState
): number {
  // Determine how many players involved
  const totalPlayers = determinePlayersInvolved();

  if (totalPlayers === 1) {
    // Solo effort - just use shooter's rating
    return getShotQualityRating(shooter);
  }

  // Select additional players
  const additionalCount = totalPlayers - 1;
  const teammates = selectChanceCreators(team, shooter, additionalCount, state);

  // Build full list with shooter first
  const allInvolved = [shooter, ...teammates];

  // Get contribution weights
  const weights = determineContributionWeights(allInvolved.length);

  // Calculate weighted average of shot quality ratings
  let totalQuality = 0;
  for (let i = 0; i < allInvolved.length; i++) {
    const player = allInvolved[i];
    const weight = weights[i] ?? 0;
    if (player) {
      totalQuality += getShotQualityRating(player) * weight;
    }
  }

  return totalQuality;
}

function determineShotQuality(
  shooter: Player,
  team: 'home' | 'away',
  state: MatchState
): 'fullChance' | 'halfChance' | 'longRange' {
  const shotQuality = calculateTeamShotQuality(shooter, team, state);
  const roll = Math.random() * 100;

  // Better team play creates better chances
  const fullChanceThreshold = 15 + (shotQuality / 5); // 15-35%
  const halfChanceThreshold = 50 + (shotQuality / 4); // 50-75%

  if (roll < fullChanceThreshold) return 'fullChance';
  if (roll < halfChanceThreshold) return 'halfChance';
  return 'longRange';
}

function determineShotFoot(shooter: Player): 'left' | 'right' | 'header' {
  const roll = Math.random();
  if (roll < 0.15) return 'header';
  if (roll < 0.30) return 'left';
  return 'right';
}

interface ShotOutcomeResult {
  outcome: 'goal' | 'saved' | 'missed' | 'blocked';
  blocker?: Player;
}

function processShotOutcome(
  context: ShotContext,
  defendingTeam: 'home' | 'away',
  attackingTeam: 'home' | 'away',
  state: MatchState
): ShotOutcomeResult {
  // Get numerical advantage modifiers for both teams
  const attackNumMod = getNumericalAdvantageModifiers(attackingTeam, state);
  const defenseNumMod = getNumericalAdvantageModifiers(defendingTeam, state);

  // Get shooter's fatigue
  const attackSubState = attackingTeam === 'home' ? state.homeSubState : state.awaySubState;
  const shooterState = attackSubState.onField.find(p => p.id === context.shooter.id);
  const shooterFatigue = shooterState?.fatigue ?? 100;

  // Calculate shooter accuracy with shot quality and fatigue
  // Apply attacking team's numerical advantage (more space = better chances)
  const baseShooterAccuracy = getShootingAccuracy(context.shooter, context.quality, shooterFatigue);
  const shooterAccuracy = baseShooterAccuracy * attackNumMod.attack;

  // Step 1: Select potential blocker FIRST, then calculate block chance based on their ability
  const { player: blocker, fatigue: blockerFatigue } = selectBlocker(defendingTeam, state);
  const blockerAbility = getDefensiveAbility(blocker, blockerFatigue);

  // Base block chance by shot quality (closer shots = less time to block)
  const baseBlockChance = context.quality === 'fullChance' ? 0.08
                        : context.quality === 'halfChance' ? 0.15
                        : 0.25; // longRange

  // Adjust by defender's ability: ability 50 = 1.0x, ability 70 = 1.4x, ability 30 = 0.6x
  const blockerModifier = blockerAbility / 50;

  // Apply defensive team's numerical advantage (or disadvantage)
  // Short-handed teams have less coverage, fewer players to block shots
  const blockChance = Math.min(0.40, baseBlockChance * blockerModifier * defenseNumMod.defense);

  if (Math.random() < blockChance) {
    return { outcome: 'blocked', blocker };
  }

  // Step 2: Is the shot on target?
  // Attackers benefit from numerical advantage (more space, less pressure)
  const onTargetBase = context.quality === 'fullChance' ? 0.65
                     : context.quality === 'halfChance' ? 0.45
                     : 0.30;
  const onTargetChance = (onTargetBase + (shooterAccuracy - 50) / 200) * attackNumMod.attack;

  if (Math.random() > Math.min(0.90, onTargetChance)) {
    return { outcome: 'missed' };
  }

  // Step 3: Does the GK save it?
  const gkLineup = getActiveLineup(defendingTeam, state);
  const gkPositions = getTeamPositions(defendingTeam, state);
  const goalkeeper = gkLineup.find(p => gkPositions[p.id] === 'GK') || gkLineup[0];

  if (!goalkeeper) return { outcome: 'goal' };

  // Get GK fatigue
  const defSubState = defendingTeam === 'home' ? state.homeSubState : state.awaySubState;
  const gkState = defSubState.onField.find(p => p.id === goalkeeper.id);
  const gkFatigue = gkState?.fatigue ?? 100;

  // GK rating with fatigue penalty
  const gkRating = getGKRating(goalkeeper);
  const fatiguePenalty = 1 - ((100 - gkFatigue) / 100) * 0.20; // Max 20% penalty when exhausted

  let saveChance = (BASE_SAVE_RATE + (gkRating - 50) * GK_RATING_SAVE_IMPACT) * fatiguePenalty;

  // Adjust for shot quality
  if (context.quality === 'fullChance') saveChance *= 0.70;
  if (context.quality === 'longRange') saveChance *= 1.25;

  // Adjust for shooter skill (already includes attack modifier)
  saveChance -= (shooterAccuracy - 50) / 200;

  // GK has less protection when team is short-handed (more shots get through)
  // This represents fewer defenders clearing balls and blocking shots before GK
  saveChance *= defenseNumMod.defense;

  saveChance = Math.max(0.15, Math.min(0.85, saveChance));

  if (Math.random() < saveChance) {
    return { outcome: 'saved' };
  }

  return { outcome: 'goal' };
}

// =============================================================================
// EVENT GENERATION
// =============================================================================

function generateFoulEvent(state: MatchState): SoccerEvent[] {
  const foulingTeam = state.possession === 'home' ? 'away' : 'home';
  const victimTeam = state.possession;

  const fouler = selectFouler(foulingTeam, state);
  const victim = selectFoulVictim(victimTeam, state);

  // Location determines if free kick can lead to shot
  const inAttackingHalf = Math.random() > 0.5;
  const location = inAttackingHalf ? 'attacking half' : 'defensive half';
  const foulType = randomPick(FOUL_DESCRIPTIONS);

  const description = `Foul by ${fouler.name} (${state[`${foulingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName}). ${victim.name} (${state[`${victimTeam}Team` as 'homeTeam' | 'awayTeam'].teamName}) wins a free kick in the ${location}.`;

  const events: SoccerEvent[] = [];

  // Chance of card - ~1 yellow per 6 fouls (~16.7%)
  const aggression = getPlayerAggression(fouler);
  const cardChance = 0.14 + (aggression - 50) / 300; // 7-21% based on aggression, avg ~14%

  if (Math.random() < cardChance) {
    const currentYellows = state.yellowCards.get(fouler.id) || 0;

    if (currentYellows > 0) {
      // Second yellow = red card
      events.push(generateCardEvent(fouler, foulingTeam, 'second_yellow', state));
    } else if (Math.random() < 0.02) {
      // 2% chance of straight red (very rare)
      events.push(generateCardEvent(fouler, foulingTeam, 'straight_red', state));
    } else {
      // First yellow card
      events.push(generateCardEvent(fouler, foulingTeam, 'yellow', state));
    }
  } else {
    // Regular foul, no card
    events.push({
      minute: state.minute,
      type: 'foul',
      team: foulingTeam,
      player: fouler,
      description,
    });
  }

  // Free kick in attacking half may lead to a shot opportunity
  if (inAttackingHalf && Math.random() < FREE_KICK_TO_SHOT_PROBABILITY) {
    const shotEvents = generateSetPieceShot(victimTeam, 'free_kick', state);
    events.push(...shotEvents);
  }

  return events;
}

function generateCardEvent(
  player: Player,
  team: 'home' | 'away',
  cardType: 'yellow' | 'second_yellow' | 'straight_red',
  state: MatchState
): SoccerEvent {
  const teamName = state[`${team}Team` as 'homeTeam' | 'awayTeam'].teamName;
  const reason = randomPick(CARD_REASONS);

  if (cardType === 'yellow') {
    state.yellowCards.set(player.id, (state.yellowCards.get(player.id) || 0) + 1);
    return {
      minute: state.minute,
      type: 'yellow_card',
      team,
      player,
      description: `${player.name} (${teamName}) is shown the yellow card ${reason}.`,
    };
  } else if (cardType === 'second_yellow') {
    state.yellowCards.set(player.id, 2);
    state.redCardPlayers.add(player.id);
    return {
      minute: state.minute,
      type: 'red_card',
      team,
      player,
      description: `Second yellow card! ${player.name} (${teamName}) receives a second yellow and is sent off!`,
    };
  } else {
    state.redCardPlayers.add(player.id);
    return {
      minute: state.minute,
      type: 'red_card',
      team,
      player,
      description: `Straight red card! ${player.name} (${teamName}) is sent off ${reason}!`,
    };
  }
}

function generateShotEvent(state: MatchState): SoccerEvent[] {
  const attackingTeam = state.possession;
  const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';

  const { player: shooter, position } = selectShooter(attackingTeam, state);
  let quality = determineShotQuality(shooter, attackingTeam, state);
  const foot = determineShotFoot(shooter);

  // Headers are always from close range
  if (foot === 'header' && quality === 'longRange') {
    quality = Math.random() > 0.5 ? 'fullChance' : 'halfChance';
  }

  // Use header-specific locations for headers
  const location = foot === 'header'
    ? randomPick(HEADER_LOCATIONS)
    : randomPick(SHOT_LOCATIONS[quality]);

  // Headers always require an assist (someone must deliver the ball)
  const isHeader = foot === 'header';
  const assister = selectAssister(attackingTeam, shooter, state, isHeader);
  const assistType = assister ? randomPick(ASSIST_TYPES) : undefined;

  const context: ShotContext = { shooter, position, quality, foot, location, assister: assister || undefined, assistType };
  const { outcome, blocker } = processShotOutcome(context, defendingTeam, attackingTeam, state);

  const attackingTeamName = state[`${attackingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName;
  const defendingTeamName = state[`${defendingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName;
  const footStr = foot === 'header' ? 'header' : `${foot} footed shot`;

  const events: SoccerEvent[] = [];

  // Update player stats
  const shooterStats = attackingTeam === 'home' ? state.homeStats : state.awayStats;
  const stats = shooterStats.get(shooter.id) || createEmptyStats();
  stats.shots++;

  if (outcome === 'goal') {
    stats.goals++;
    stats.shotsOnTarget++;
    if (assister) {
      const assisterStats = shooterStats.get(assister.id) || createEmptyStats();
      assisterStats.assists++;
      shooterStats.set(assister.id, assisterStats);
    }

    if (attackingTeam === 'home') state.homeScore++;
    else state.awayScore++;

    const goalDesc = randomPick(GOAL_DESCRIPTIONS);
    const assistStr = assister ? ` Assisted by ${assister.name} ${assistType}.` : ' Unassisted.';

    // Always show score as Home - Away for consistency
    const homeTeamName = state.homeTeam.teamName;
    const awayTeamName = state.awayTeam.teamName;

    events.push({
      minute: state.minute,
      type: 'goal',
      team: attackingTeam,
      player: shooter,
      assistPlayer: assister || undefined,
      description: `GOAL! ${homeTeamName} ${state.homeScore}, ${awayTeamName} ${state.awayScore}. ${shooter.name} (${attackingTeamName}) ${footStr} ${location} ${goalDesc}.${assistStr}`,
    });

    // Update plus/minus for all players on field
    updatePlusMinus(attackingTeam, state);
  } else if (outcome === 'saved') {
    stats.shotsOnTarget++;
    const gkLineup = getActiveLineup(defendingTeam, state);
    const gkPositions = getTeamPositions(defendingTeam, state);
    const goalkeeper = gkLineup.find(p => gkPositions[p.id] === 'GK') || gkLineup[0];

    if (goalkeeper) {
      const gkStats = defendingTeam === 'home' ? state.homeStats : state.awayStats;
      const gkStatEntry = gkStats.get(goalkeeper.id) || createEmptyStats();
      gkStatEntry.saves = (gkStatEntry.saves || 0) + 1;
      gkStats.set(goalkeeper.id, gkStatEntry);
    }

    const saveDesc = randomPick(SAVE_DESCRIPTIONS);
    const assistStr = assister ? ` Assisted by ${assister.name} ${assistType}.` : '';

    events.push({
      minute: state.minute,
      type: 'shot_saved',
      team: attackingTeam,
      player: shooter,
      description: `Save! ${shooter.name} (${attackingTeamName}) ${footStr} ${location} ${saveDesc}.${assistStr}`,
    });
  } else if (outcome === 'missed') {
    const missDesc = randomPick(MISS_DESCRIPTIONS);
    const assistStr = assister ? ` Assisted by ${assister.name} ${assistType}.` : '';

    events.push({
      minute: state.minute,
      type: 'shot_missed',
      team: attackingTeam,
      player: shooter,
      description: `Attempt missed. ${shooter.name} (${attackingTeamName}) ${footStr} ${location} ${missDesc}.${assistStr}`,
    });
  } else if (outcome === 'blocked' && blocker) {
    const blockDesc = randomPick(BLOCK_DESCRIPTIONS);
    const assistStr = assister ? ` Assisted by ${assister.name} ${assistType}.` : '';

    events.push({
      minute: state.minute,
      type: 'shot_blocked',
      team: attackingTeam,
      player: shooter,
      description: `Attempt blocked. ${shooter.name} (${attackingTeamName}) ${footStr} ${location} ${blockDesc}. Blocked by ${blocker.name}.${assistStr}`,
    });

    // Blocked shots often lead to corners
    if (Math.random() < 0.40) {
      events.push({
        minute: state.minute,
        type: 'corner',
        team: attackingTeam,
        player: blocker,
        description: `Corner, ${attackingTeamName}. Conceded by ${blocker.name}.`,
      });
    }
  }

  shooterStats.set(shooter.id, stats);
  return events;
}

function generateOffsideEvent(state: MatchState): SoccerEvent {
  const attackingTeam = state.possession;
  const player = selectOffsidePlayer(attackingTeam, state);
  const teamName = state[`${attackingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName;

  return {
    minute: state.minute,
    type: 'foul', // Offside is treated as a stoppage
    team: attackingTeam,
    player,
    description: `Offside, ${teamName}. ${player.name} is caught offside.`,
  };
}

/**
 * Select the best set piece target based on position, height, and jumping
 * Taller players with good jumping/heading are preferred
 */
function selectSetPieceTarget(
  team: 'home' | 'away',
  state: MatchState
): { player: Player; position: SoccerPosition } {
  const lineup = getActiveLineup(team, state);
  const positions = getTeamPositions(team, state);

  const weighted = lineup.map(player => {
    const position = positions[player.id] || 'CM';
    const posWeight = SET_PIECE_TARGET_WEIGHTS[position] || 1.0;

    // Height advantage: each inch above average = bonus weight
    const heightAdvantage = (player.attributes.height - AVERAGE_PLAYER_HEIGHT) * SET_PIECE_HEIGHT_ADVANTAGE;

    // Jumping and heading ability
    const aerialAbility = (
      player.attributes.jumping * 0.4 +
      player.attributes.reactions * 0.3 +
      player.attributes.bravery * 0.2 +
      player.attributes.core_strength * 0.1
    ) / 100;

    const weight = Math.max(0.1, posWeight * (1 + heightAdvantage) * (0.5 + aerialAbility));

    return { item: { player, position: position as SoccerPosition }, weight };
  });

  return weightedRandomPick(weighted);
}

/**
 * Determine shot quality for set piece (most are contested headers)
 */
function determineSetPieceShotQuality(): 'fullChance' | 'halfChance' | 'longRange' {
  const roll = Math.random();
  const fullChance = SET_PIECE_SHOT_QUALITY.fullChance ?? 0.25;
  const halfChance = SET_PIECE_SHOT_QUALITY.halfChance ?? 0.55;
  if (roll < fullChance) return 'fullChance';
  if (roll < fullChance + halfChance) return 'halfChance';
  return 'longRange';
}

/**
 * Generate a shot from a set piece (corner or free kick)
 * Height gives advantage for headers
 */
function generateSetPieceShot(
  attackingTeam: 'home' | 'away',
  setPieceType: 'corner' | 'free_kick',
  state: MatchState
): SoccerEvent[] {
  const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
  const { player: shooter, position } = selectSetPieceTarget(attackingTeam, state);

  // Most set piece shots are headers
  const isHeader = Math.random() < 0.70;
  const foot: 'left' | 'right' | 'header' = isHeader ? 'header' : (Math.random() < 0.5 ? 'left' : 'right');

  const quality = determineSetPieceShotQuality();
  const location = isHeader ? randomPick(HEADER_LOCATIONS) : randomPick(SHOT_LOCATIONS[quality]);

  // Find the taker for assist credit
  // Set pieces always have a taker who delivers the ball, so require an assist
  // (especially for headers which need someone to cross/deliver)
  const taker = selectAssister(attackingTeam, shooter, state, true);

  const context: ShotContext = {
    shooter,
    position,
    quality,
    foot,
    location,
    assister: taker || undefined,
    assistType: setPieceType === 'corner' ? 'with a corner' : 'with a free kick',
  };

  const { outcome, blocker } = processShotOutcome(context, defendingTeam, attackingTeam, state);

  const attackingTeamName = state[`${attackingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName;
  const footStr = foot === 'header' ? 'header' : `${foot} footed shot`;
  const setPieceStr = setPieceType === 'corner' ? 'from a corner' : 'from a free kick';

  const events: SoccerEvent[] = [];

  // Update stats
  const shooterStats = attackingTeam === 'home' ? state.homeStats : state.awayStats;
  const stats = shooterStats.get(shooter.id) || createEmptyStats();
  stats.shots++;

  if (outcome === 'goal') {
    stats.goals++;
    stats.shotsOnTarget++;

    // Height bonus already factored into target selection
    if (taker) {
      const takerStats = shooterStats.get(taker.id) || createEmptyStats();
      takerStats.assists++;
      shooterStats.set(taker.id, takerStats);
    }

    if (attackingTeam === 'home') state.homeScore++;
    else state.awayScore++;

    const goalDesc = isHeader ? 'heads it home' : randomPick(GOAL_DESCRIPTIONS);
    const assistStr = taker ? ` Assisted by ${taker.name} ${setPieceStr}.` : ` ${setPieceStr}.`;

    const homeTeamName = state.homeTeam.teamName;
    const awayTeamName = state.awayTeam.teamName;

    events.push({
      minute: state.minute,
      type: 'goal',
      team: attackingTeam,
      player: shooter,
      assistPlayer: taker || undefined,
      description: `GOAL! ${homeTeamName} ${state.homeScore}, ${awayTeamName} ${state.awayScore}. ${shooter.name} (${attackingTeamName}) ${footStr} ${goalDesc}${assistStr}`,
    });

    // Update plus/minus for all players on field
    updatePlusMinus(attackingTeam, state);
  } else if (outcome === 'saved') {
    stats.shotsOnTarget++;
    const gkLineup = getActiveLineup(defendingTeam, state);
    const gkPositions = getTeamPositions(defendingTeam, state);
    const goalkeeper = gkLineup.find(p => gkPositions[p.id] === 'GK') || gkLineup[0];

    if (goalkeeper) {
      const gkStats = defendingTeam === 'home' ? state.homeStats : state.awayStats;
      const gkStatEntry = gkStats.get(goalkeeper.id) || createEmptyStats();
      gkStatEntry.saves = (gkStatEntry.saves || 0) + 1;
      gkStats.set(goalkeeper.id, gkStatEntry);
    }

    const saveDesc = randomPick(SAVE_DESCRIPTIONS);
    events.push({
      minute: state.minute,
      type: 'shot_saved',
      team: attackingTeam,
      player: shooter,
      description: `Save! ${shooter.name} (${attackingTeamName}) ${footStr} ${setPieceStr} ${saveDesc}.`,
    });
  } else if (outcome === 'missed') {
    const missDesc = randomPick(MISS_DESCRIPTIONS);
    events.push({
      minute: state.minute,
      type: 'shot_missed',
      team: attackingTeam,
      player: shooter,
      description: `Attempt missed. ${shooter.name} (${attackingTeamName}) ${footStr} ${setPieceStr} ${missDesc}.`,
    });
  } else if (outcome === 'blocked' && blocker) {
    const blockDesc = randomPick(BLOCK_DESCRIPTIONS);
    events.push({
      minute: state.minute,
      type: 'shot_blocked',
      team: attackingTeam,
      player: shooter,
      description: `Attempt blocked. ${shooter.name} (${attackingTeamName}) ${footStr} ${setPieceStr} ${blockDesc}. Blocked by ${blocker.name}.`,
    });
  }

  shooterStats.set(shooter.id, stats);
  return events;
}

function generateCornerEvent(state: MatchState): SoccerEvent[] {
  const attackingTeam = state.possession;
  const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
  const conceder = selectCornerConceder(defendingTeam, state);

  const attackingTeamName = state[`${attackingTeam}Team` as 'homeTeam' | 'awayTeam'].teamName;

  const events: SoccerEvent[] = [{
    minute: state.minute,
    type: 'corner',
    team: attackingTeam,
    player: conceder,
    description: `Corner, ${attackingTeamName}. Conceded by ${conceder.name}.`,
  }];

  // Corner may lead to a shot opportunity
  if (Math.random() < CORNER_TO_SHOT_PROBABILITY) {
    const shotEvents = generateSetPieceShot(attackingTeam, 'corner', state);
    events.push(...shotEvents);
  }

  return events;
}

function generateSubstitutionEvent(
  team: 'home' | 'away',
  playerOut: Player,
  playerIn: Player,
  state: MatchState
): SoccerEvent {
  const teamName = state[`${team}Team` as 'homeTeam' | 'awayTeam'].teamName;

  return {
    minute: state.minute,
    type: 'substitution',
    team,
    player: playerIn,
    description: `Substitution, ${teamName}. ${playerIn.name} replaces ${playerOut.name}.`,
  };
}

function generateInjuryDelayEvent(player: Player, team: 'home' | 'away', state: MatchState): SoccerEvent[] {
  const teamName = state[`${team}Team` as 'homeTeam' | 'awayTeam'].teamName;

  return [
    {
      minute: state.minute,
      type: 'foul',
      team,
      player,
      description: `Delay in match because of an injury to ${player.name} (${teamName}).`,
    },
    {
      minute: state.minute + 1,
      type: 'foul',
      team,
      player,
      description: `Delay over. They are ready to continue.`,
    },
  ];
}

// =============================================================================
// SUBSTITUTION PROCESSING
// =============================================================================

/**
 * Process half-time substitutions for a team
 */
function processHalfTimeSubstitutions(state: MatchState, team: 'home' | 'away'): void {
  const subState = team === 'home' ? state.homeSubState : state.awaySubState;
  subState.currentMinute = 45;

  // Can make multiple subs at half-time
  let subsThisWindow = 0;
  const maxSubsPerWindow = 3; // Reasonable limit per window

  while (subsThisWindow < maxSubsPerWindow) {
    const decision = checkForSubstitution(subState, DEFAULT_SUB_CONFIG, true);
    if (!decision) break;

    // Execute substitution
    const newSubState = executeSubstitution(subState, decision, true);

    // Update match state
    if (team === 'home') {
      state.homeSubState = newSubState;
      syncLineupFromSubState(state, 'home');
    } else {
      state.awaySubState = newSubState;
      syncLineupFromSubState(state, 'away');
    }

    // Generate substitution event
    state.events.push(generateSubstitutionEvent(team, decision.playerOut, decision.playerIn, state));

    // Initialize stats for incoming player
    const statsMap = team === 'home' ? state.homeStats : state.awayStats;
    if (!statsMap.has(decision.playerIn.id)) {
      statsMap.set(decision.playerIn.id, createEmptyStats());
    }

    subsThisWindow++;
  }
}

/**
 * Check and process in-game substitutions for a team
 */
function processInGameSubstitutions(state: MatchState, team: 'home' | 'away'): void {
  const subState = team === 'home' ? state.homeSubState : state.awaySubState;
  subState.currentMinute = state.minute;

  const decision = checkForSubstitution(subState, DEFAULT_SUB_CONFIG, false);
  if (!decision) return;

  // Execute substitution
  const newSubState = executeSubstitution(subState, decision, false);

  // Update match state
  if (team === 'home') {
    state.homeSubState = newSubState;
    syncLineupFromSubState(state, 'home');
  } else {
    state.awaySubState = newSubState;
    syncLineupFromSubState(state, 'away');
  }

  // Generate substitution event
  state.events.push(generateSubstitutionEvent(team, decision.playerOut, decision.playerIn, state));

  // Initialize stats for incoming player
  const statsMap = team === 'home' ? state.homeStats : state.awayStats;
  if (!statsMap.has(decision.playerIn.id)) {
    statsMap.set(decision.playerIn.id, createEmptyStats());
  }
}

/**
 * Sync the main lineup from substitution state
 */
function syncLineupFromSubState(state: MatchState, team: 'home' | 'away'): void {
  const subState = team === 'home' ? state.homeSubState : state.awaySubState;

  // Update lineup to match substitution state
  const newLineup = subState.onField.map(p => {
    // Find the original player object
    const origHome = state.homeLineup.find(op => op.id === p.id);
    const origAway = state.awayLineup.find(op => op.id === p.id);
    const origBenchHome = state.homeTeam.bench?.find(op => op.id === p.id);
    const origBenchAway = state.awayTeam.bench?.find(op => op.id === p.id);
    return origHome || origAway || origBenchHome || origBenchAway || p;
  });

  if (team === 'home') {
    state.homeLineup = newLineup;
    // Update positions for subbed players
    for (const player of subState.onField) {
      if (player.currentPosition) {
        state.homePositions[player.id] = player.currentPosition;
      }
    }
  } else {
    state.awayLineup = newLineup;
    for (const player of subState.onField) {
      if (player.currentPosition) {
        state.awayPositions[player.id] = player.currentPosition;
      }
    }
  }
}

/**
 * Update fatigue for players in both teams
 * Teams out of possession tire faster (chasing, pressing, defensive work)
 */
function updateAllFatigue(state: MatchState): void {
  const homeHasPossession = state.possession === 'home';

  // Get numerical advantage modifiers - short-handed teams tire faster
  const homeNumMod = getNumericalAdvantageModifiers('home', state);
  const awayNumMod = getNumericalAdvantageModifiers('away', state);

  // Apply fatigue with numerical disadvantage penalty
  // Teams with fewer players cover more ground = faster fatigue
  updateFatigue(state.homeSubState, 1 * homeNumMod.fatigue, homeHasPossession);
  updateFatigue(state.awaySubState, 1 * awayNumMod.fatigue, !homeHasPossession);
}

/**
 * Handle injury during match - marks player as injured for substitution
 */
function handleMatchInjury(state: MatchState, team: 'home' | 'away', playerId: string): void {
  if (team === 'home') {
    state.homeSubState = handleInjury(state.homeSubState, playerId);
  } else {
    state.awaySubState = handleInjury(state.awaySubState, playerId);
  }
}

/**
 * Check for injuries during a minute of play
 * This is called every minute to ensure proper injury rate
 */
function checkMinuteInjuries(state: MatchState, minute: number): void {
  // Check both teams for injuries
  for (const team of ['home', 'away'] as const) {
    const lineup = getActiveLineup(team, state);
    const subState = team === 'home' ? state.homeSubState : state.awaySubState;

    // Check each active player for potential injury
    for (const player of lineup) {
      // Get player's durability (default 70 if not set)
      const durability = player.attributes?.durability ?? 70;
      // Get player's current fatigue from sub state (100 = fresh)
      const playerWithMinutes = subState.onField.find(p => p.id === player.id);
      const fatigue = playerWithMinutes?.fatigue ?? 80;

      // Check if injury occurs based on durability
      const injuryResult = state.injuryTracker.checkInjury(
        player.id,
        durability,
        fatigue,
        Math.random(),
        minute
      );

      if (injuryResult && injuryResult.injured) {
        const teamName = state[`${team}Team` as 'homeTeam' | 'awayTeam'].teamName;

        // Generate injury event based on severity
        if (injuryResult.outcome === InGameInjuryOutcome.MOMENTARY) {
          // Momentary injury - brief delay, player continues
          state.events.push({
            minute,
            type: 'foul',
            team,
            player,
            description: `Brief delay as ${player.name} (${teamName}) receives treatment for a minor knock.`,
          });
          // Small stoppage time
          if (minute <= 45) state.firstHalfStoppage += 1;
          else state.secondHalfStoppage += 1;
        } else {
          // Temporary or game-ending injury - player must be substituted
          const isGameEnding = injuryResult.outcome === InGameInjuryOutcome.GAME_ENDING;
          const injuryDesc = isGameEnding
            ? `${player.name} (${teamName}) goes down with a serious injury and cannot continue.`
            : `${player.name} (${teamName}) is injured and will need to be substituted.`;

          state.events.push({
            minute,
            type: 'foul',
            team,
            player,
            description: injuryDesc,
          });

          // Mark player as injured - must be substituted in soccer
          handleMatchInjury(state, team, player.id);

          // Immediately try to substitute the injured player
          processInGameSubstitutions(state, team);

          // More stoppage time for serious injuries
          if (minute <= 45) state.firstHalfStoppage += isGameEnding ? 4 : 2;
          else state.secondHalfStoppage += isGameEnding ? 4 : 2;
        }
      }
    }
  }
}

/**
 * Handle yellow card - updates substitution state
 */
function handleMatchYellowCard(state: MatchState, team: 'home' | 'away', playerId: string): boolean {
  const subState = team === 'home' ? state.homeSubState : state.awaySubState;
  const { state: newState, isSecondYellow } = recordYellowCard(subState, playerId);

  if (team === 'home') {
    state.homeSubState = newState;
  } else {
    state.awaySubState = newState;
  }

  return isSecondYellow;
}

/**
 * Handle red card - removes player from substitution state
 */
function handleMatchRedCard(state: MatchState, team: 'home' | 'away', playerId: string): void {
  if (team === 'home') {
    state.homeSubState = handleRedCard(state.homeSubState, playerId);
    syncLineupFromSubState(state, 'home');
  } else {
    state.awaySubState = handleRedCard(state.awaySubState, playerId);
    syncLineupFromSubState(state, 'away');
  }
}

// =============================================================================
// MAIN SIMULATION LOOP
// =============================================================================

function createEmptyStats(): SoccerPlayerStats {
  return {
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    plusMinus: 0,
  };
}

function initializePlayerStats(lineup: Player[]): Map<string, SoccerPlayerStats> {
  const stats = new Map<string, SoccerPlayerStats>();
  for (const player of lineup) {
    stats.set(player.id, createEmptyStats());
  }
  return stats;
}

function calculateTeamStrength(team: SoccerTeamState): number {
  let total = 0;
  for (const player of team.lineup) {
    const pos = team.positions[player.id] || 'CM';
    total += calculateSoccerPositionOverall(player, pos as SoccerPosition);
  }
  return total / team.lineup.length;
}

/**
 * Run the full match simulation
 */
export function simulateSoccerMatchV2(input: SoccerMatchInput): SoccerMatchResult {
  // Initialize substitution states for both teams
  const homeSubState = initializeSubstitutionState(input.homeTeam, 'home');
  const awaySubState = initializeSubstitutionState(input.awayTeam, 'away');

  // Initialize injury tracker (soccer checks ~90 times per game, one per minute)
  const injuryTracker = new InGameInjuryTracker('soccer', 90);

  // Initialize match state
  const state: MatchState = {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: Math.random() > 0.5 ? 'home' : 'away',
    homeLineup: [...input.homeTeam.lineup],
    awayLineup: [...input.awayTeam.lineup],
    homePositions: { ...input.homeTeam.positions },
    awayPositions: { ...input.awayTeam.positions },
    yellowCards: new Map(),
    redCardPlayers: new Set(),
    homeSubState,
    awaySubState,
    events: [],
    firstHalfStoppage: Math.floor(Math.random() * 4) + 1,
    secondHalfStoppage: Math.floor(Math.random() * 5) + 2,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeStats: initializePlayerStats(input.homeTeam.lineup),
    awayStats: initializePlayerStats(input.awayTeam.lineup),
    injuryTracker,
  };

  // Calculate team strengths for event probabilities
  const homeStrength = calculateTeamStrength(input.homeTeam);
  const awayStrength = calculateTeamStrength(input.awayTeam);

  // Apply tactical and home advantage modifiers
  const homeMod = FORMATION_MODIFIERS[input.homeTeam.formation] || { attack: 1, defense: 1 };
  const awayMod = FORMATION_MODIFIERS[input.awayTeam.formation] || { attack: 1, defense: 1 };

  const homeAttackMod = ATTACKING_STYLE_MODIFIERS[input.homeTeam.tactics.attackingStyle]?.xG || 1;
  const awayAttackMod = ATTACKING_STYLE_MODIFIERS[input.awayTeam.tactics.attackingStyle]?.xG || 1;

  // Get pressing and width modifiers (with defaults)
  const defaultPressing = { xGConceded: 1, possession: 0, fatigue: 1 };
  const defaultWidth = { crossingBonus: 1, centralBonus: 1 };
  const homePressing = PRESSING_MODIFIERS[input.homeTeam.tactics.pressing] ?? defaultPressing;
  const awayPressing = PRESSING_MODIFIERS[input.awayTeam.tactics.pressing] ?? defaultPressing;
  // Width modifiers available for future use (goal type distribution, etc.)
  // const homeWidth = WIDTH_MODIFIERS[input.homeTeam.tactics.width] ?? defaultWidth;
  // const awayWidth = WIDTH_MODIFIERS[input.awayTeam.tactics.width] ?? defaultWidth;
  void defaultWidth; // Mark as intentionally unused for now

  // Store pressing fatigue modifiers in state for use in fatigue calculations
  (state as any).homePressingFatigue = homePressing.fatigue;
  (state as any).awayPressingFatigue = awayPressing.fatigue;

  // Possession probability based on team strengths and tactics
  // Pressing adds to possession (winning ball back higher up)
  const homePossession = 50 +
    (homeStrength - awayStrength) / 4 +
    (ATTACKING_STYLE_MODIFIERS[input.homeTeam.tactics.attackingStyle]?.possession || 0) -
    (ATTACKING_STYLE_MODIFIERS[input.awayTeam.tactics.attackingStyle]?.possession || 0) +
    (homePressing.possession - awayPressing.possession);

  // First half
  state.events.push({
    minute: 0,
    type: 'foul',
    team: 'home',
    description: 'First Half begins.',
  });

  simulateHalf(state, 1, 45, homeStrength, awayStrength, homePossession, homeMod, awayMod, homeAttackMod, awayAttackMod);

  // Add stoppage time
  const firstHalfEnd = 45 + state.firstHalfStoppage;
  state.events.push({
    minute: 45,
    type: 'half_time',
    team: 'home',
    description: `First Half ends, ${input.homeTeam.teamName} ${state.homeScore}, ${input.awayTeam.teamName} ${state.awayScore}.`,
  });

  // Record half time score
  const halfTimeScore = { home: state.homeScore, away: state.awayScore };

  // Half-time substitutions (don't count toward window limits)
  console.log('[Soccer] Half-time sub check - Home bench size:', state.homeSubState.onBench.length);
  console.log('[Soccer] Home player fatigue levels:', state.homeSubState.onField.map(p => ({ name: p.name, fatigue: Math.round(p.fatigue) })));
  processHalfTimeSubstitutions(state, 'home');
  processHalfTimeSubstitutions(state, 'away');

  // Second half
  state.events.push({
    minute: 45,
    type: 'foul',
    team: 'home',
    description: 'Second Half begins.',
  });

  simulateHalf(state, 46, 90, homeStrength, awayStrength, homePossession, homeMod, awayMod, homeAttackMod, awayAttackMod);

  // Full time
  state.events.push({
    minute: 90,
    type: 'full_time',
    team: 'home',
    description: `Match ends, ${input.homeTeam.teamName} ${state.homeScore}, ${input.awayTeam.teamName} ${state.awayScore}.`,
  });

  // Update minutes played based on substitution state
  for (const player of state.homeSubState.onField) {
    const stats = state.homeStats.get(player.id);
    if (stats) {
      stats.minutesPlayed = player.minutesPlayed;
    }
  }
  for (const player of state.homeSubState.onBench) {
    if (player.hasBeenSubbedOff) {
      const stats = state.homeStats.get(player.id);
      if (stats) {
        stats.minutesPlayed = player.minutesPlayed;
      }
    }
  }
  for (const player of state.awaySubState.onField) {
    const stats = state.awayStats.get(player.id);
    if (stats) {
      stats.minutesPlayed = player.minutesPlayed;
    }
  }
  for (const player of state.awaySubState.onBench) {
    if (player.hasBeenSubbedOff) {
      const stats = state.awayStats.get(player.id);
      if (stats) {
        stats.minutesPlayed = player.minutesPlayed;
      }
    }
  }

  // Build box score
  const boxScore = buildBoxScore(state, input, halfTimeScore);

  // Build play-by-play
  const playByPlay = state.events.map(e => `${e.minute}' ${e.description}`);

  // Get post-game injuries and injured out players from tracker
  const postGameInjuries = state.injuryTracker.getPostGameInjuries();
  const injuredOutPlayers = state.injuryTracker.getRemovedPlayers();

  // Determine winner - if tied, go to penalty shootout
  let winner: string | null = null;
  let penaltyShootout: PenaltyShootoutResult | undefined;

  if (state.homeScore > state.awayScore) {
    winner = input.homeTeam.teamId;
  } else if (state.awayScore > state.homeScore) {
    winner = input.awayTeam.teamId;
  } else {
    // Tied - go to penalty shootout
    penaltyShootout = simulatePenaltyShootoutV2(input.homeTeam, input.awayTeam, state.events);
    winner = penaltyShootout.winner;
  }

  return {
    homeTeamId: input.homeTeam.teamId,
    awayTeamId: input.awayTeam.teamId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    winner,
    halfTimeScore,
    events: state.events,
    boxScore,
    playByPlay: state.events.map(e => `${e.minute}' ${e.description}`),
    penaltyShootout,
    postGameInjuries,
    injuredOutPlayers,
  };
}

/**
 * Simulate a penalty shootout between two teams (V2 engine version)
 * Standard format: 5 kicks each, then sudden death
 */
function simulatePenaltyShootoutV2(
  homeTeam: SoccerTeamState,
  awayTeam: SoccerTeamState,
  events: SoccerEvent[]
): PenaltyShootoutResult {
  // Calculate GK ratings for each team
  const getGKRating = (team: SoccerTeamState): number => {
    const gk = team.lineup.find(p => team.positions[p.id] === 'GK');
    if (!gk) return 50;
    return (
      (gk.attributes.reactions ?? 50) * 0.3 +
      (gk.attributes.agility ?? 50) * 0.25 +
      (gk.attributes.jumping ?? 50) * 0.2 +
      (gk.attributes.composure ?? 50) * 0.15 +
      (gk.attributes.awareness ?? 50) * 0.1
    );
  };

  const homeGK = getGKRating(awayTeam); // Home shoots against away GK
  const awayGK = getGKRating(homeTeam); // Away shoots against home GK

  // Calculate penalty conversion probability
  const calcConversion = (player: Player, gkRating: number): number => {
    const composure = player.attributes.composure ?? 50;
    const throwAccuracy = player.attributes.throw_accuracy ?? 50;
    const formTechnique = player.attributes.form_technique ?? 50;

    let probability = 0.75; // Base 75%
    probability += (composure - 50) / 500;      // +/- 10%
    probability += (throwAccuracy - 50) / 833;  // +/- 6%
    probability += (formTechnique - 50) / 1250; // +/- 4%
    probability -= (gkRating - 50) / 400;       // GK modifier

    return Math.max(0.50, Math.min(0.90, probability));
  };

  // Get penalty takers (sorted by composure + throw_accuracy)
  const getKickers = (team: SoccerTeamState): Player[] => {
    return [...team.lineup]
      .filter(p => team.positions[p.id] !== 'GK')
      .sort((a, b) => {
        const aScore = (a.attributes.composure ?? 50) + (a.attributes.throw_accuracy ?? 50);
        const bScore = (b.attributes.composure ?? 50) + (b.attributes.throw_accuracy ?? 50);
        return bScore - aScore;
      });
  };

  const homeKickers = getKickers(homeTeam);
  const awayKickers = getKickers(awayTeam);

  const homeKicks: boolean[] = [];
  const awayKicks: boolean[] = [];
  let homeScore = 0;
  let awayScore = 0;

  // Add penalty shootout start event
  events.push({
    minute: 90,
    type: 'penalty_shootout_start',
    team: 'home',
    description: 'Penalty shootout begins!',
  });

  // First 5 kicks each
  for (let round = 0; round < 5; round++) {
    // Home team kicks
    const homeKicker = homeKickers[round % homeKickers.length];
    if (homeKicker) {
      const prob = calcConversion(homeKicker, homeGK);
      const scored = Math.random() < prob;
      homeKicks.push(scored);
      if (scored) homeScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'home',
        player: homeKicker,
        description: scored
          ? `GOAL! ${homeKicker.name} scores! (${homeScore}-${awayScore})`
          : `SAVED! ${homeKicker.name}'s penalty is stopped! (${homeScore}-${awayScore})`,
      });
    }

    // Check if shootout is mathematically decided after home kick
    const homeKicksRemaining = 5 - round - 1;
    const awayKicksRemaining = 5 - round;
    if (homeScore > awayScore + awayKicksRemaining) break;
    if (awayScore > homeScore + homeKicksRemaining) break;

    // Away team kicks
    const awayKicker = awayKickers[round % awayKickers.length];
    if (awayKicker) {
      const prob = calcConversion(awayKicker, awayGK);
      const scored = Math.random() < prob;
      awayKicks.push(scored);
      if (scored) awayScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'away',
        player: awayKicker,
        description: scored
          ? `GOAL! ${awayKicker.name} scores! (${homeScore}-${awayScore})`
          : `SAVED! ${awayKicker.name}'s penalty is stopped! (${homeScore}-${awayScore})`,
      });
    }

    // Check if shootout is mathematically decided after away kick
    const homeKicksRemainingAfter = 5 - round - 1;
    if (homeScore > awayScore + homeKicksRemainingAfter) break;
    if (awayScore > homeScore + homeKicksRemainingAfter) break;
  }

  // Sudden death if still tied after 5 rounds
  let suddenDeathRound = 5;
  while (homeScore === awayScore && suddenDeathRound < 20) {
    // Home kicks
    const homeKicker = homeKickers[suddenDeathRound % homeKickers.length];
    if (homeKicker) {
      const prob = calcConversion(homeKicker, homeGK);
      const scored = Math.random() < prob;
      homeKicks.push(scored);
      if (scored) homeScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'home',
        player: homeKicker,
        description: scored
          ? `GOAL! ${homeKicker.name} scores! (${homeScore}-${awayScore})`
          : `SAVED! ${homeKicker.name}'s penalty is stopped! (${homeScore}-${awayScore})`,
      });
    }

    // Away kicks
    const awayKicker = awayKickers[suddenDeathRound % awayKickers.length];
    if (awayKicker) {
      const prob = calcConversion(awayKicker, awayGK);
      const scored = Math.random() < prob;
      awayKicks.push(scored);
      if (scored) awayScore++;

      events.push({
        minute: 90,
        type: scored ? 'penalty_scored' : 'penalty_saved',
        team: 'away',
        player: awayKicker,
        description: scored
          ? `GOAL! ${awayKicker.name} scores! (${homeScore}-${awayScore})`
          : `SAVED! ${awayKicker.name}'s penalty is stopped! (${homeScore}-${awayScore})`,
      });
    }

    suddenDeathRound++;
  }

  const winner = homeScore > awayScore ? homeTeam.teamId : awayTeam.teamId;

  events.push({
    minute: 90,
    type: 'penalty_shootout_end',
    team: homeScore > awayScore ? 'home' : 'away',
    description: `${homeScore > awayScore ? homeTeam.teamName : awayTeam.teamName} wins the penalty shootout ${homeScore}-${awayScore}!`,
  });

  return {
    homeScore,
    awayScore,
    homeKicks,
    awayKicks,
    winner,
  };
}

function simulateHalf(
  state: MatchState,
  startMinute: number,
  endMinute: number,
  homeStrength: number,
  awayStrength: number,
  homePossession: number,
  homeMod: { attack: number; defense: number },
  awayMod: { attack: number; defense: number },
  homeAttackMod: number,
  awayAttackMod: number
): void {
  // Event probability per minute (roughly 25-40 events per game = ~0.3-0.45 per minute)
  const EVENT_PROBABILITY = 0.38;

  // Substitution check intervals (minutes 55, 65, 75, 85 for natural breaks)
  const SUB_CHECK_MINUTES = [55, 65, 75, 85];

  for (let minute = startMinute; minute <= endMinute; minute++) {
    state.minute = minute;

    // Update fatigue for all players each minute
    updateAllFatigue(state);

    // Check for injuries every minute (independent of match events)
    checkMinuteInjuries(state, minute);

    // Check for substitutions at natural break points
    if (SUB_CHECK_MINUTES.includes(minute)) {
      processInGameSubstitutions(state, 'home');
      processInGameSubstitutions(state, 'away');
    }

    // Determine possession for this minute
    // Apply numerical advantage modifier (recalculated each minute in case of red cards)
    const homeNumMod = getNumericalAdvantageModifiers('home', state);
    const awayNumMod = getNumericalAdvantageModifiers('away', state);
    const effectivePossession = homePossession + homeNumMod.possession - awayNumMod.possession;

    if (Math.random() * 100 < effectivePossession) {
      state.possession = 'home';
    } else {
      state.possession = 'away';
    }

    // Should an event happen this minute?
    if (Math.random() > EVENT_PROBABILITY) continue;

    // What type of event?
    const eventRoll = Math.random() * 100;

    // Event distribution (roughly):
    // Shot: 25% (including goals, saves, misses, blocks)
    // Foul: 30%
    // Offside: 10%
    // Corner: 15%
    // Other (nothing notable): 20%
    // Note: Injuries are checked separately every minute

    if (eventRoll < 25) {
      // Shot attempt
      const shotEvents = generateShotEvent(state);
      state.events.push(...shotEvents);
    } else if (eventRoll < 55) {
      // Foul (may include card and/or free kick shot)
      const foulEvents = generateFoulEvent(state);
      state.events.push(...foulEvents);

      // Handle any card consequences for substitution state
      for (const event of foulEvents) {
        if (event.type === 'red_card' && event.player) {
          handleMatchRedCard(state, event.team, event.player.id);
        } else if (event.type === 'yellow_card' && event.player) {
          handleMatchYellowCard(state, event.team, event.player.id);
        }
      }
    } else if (eventRoll < 65) {
      // Offside
      state.events.push(generateOffsideEvent(state));
    } else if (eventRoll < 80) {
      // Corner (may include set piece shot)
      const cornerEvents = generateCornerEvent(state);
      state.events.push(...cornerEvents);
    }
    // else: nothing notable happens this minute (injuries checked separately)
  }
}

function buildBoxScore(
  state: MatchState,
  input: SoccerMatchInput,
  halfTimeScore: { home: number; away: number }
): SoccerBoxScore {
  // Count events for stats
  let homeShots = 0, awayShots = 0;
  let homeShotsOnTarget = 0, awayShotsOnTarget = 0;
  let homeCorners = 0, awayCorners = 0;
  let homeFouls = 0, awayFouls = 0;
  let homeYellows = 0, awayYellows = 0;
  let homeReds = 0, awayReds = 0;

  for (const event of state.events) {
    const isHome = event.team === 'home';

    switch (event.type) {
      case 'goal':
      case 'shot_saved':
        if (isHome) { homeShots++; homeShotsOnTarget++; }
        else { awayShots++; awayShotsOnTarget++; }
        break;
      case 'shot_missed':
      case 'shot_blocked':
        if (isHome) homeShots++;
        else awayShots++;
        break;
      case 'corner':
        if (isHome) homeCorners++;
        else awayCorners++;
        break;
      case 'foul':
        // Fouls are attributed to the fouling team
        if (isHome) homeFouls++;
        else awayFouls++;
        break;
      case 'yellow_card':
        if (isHome) homeYellows++;
        else awayYellows++;
        break;
      case 'red_card':
        if (isHome) homeReds++;
        else awayReds++;
        break;
    }
  }

  // Build player stats objects
  const homePlayerStats: Record<string, SoccerPlayerStats> = {};
  const awayPlayerStats: Record<string, SoccerPlayerStats> = {};

  // For now, set all players who have stats to 90 minutes played
  // TODO: Track actual minutes when substitution system is fully integrated
  for (const [playerId, stats] of state.homeStats) {
    stats.minutesPlayed = 90;
    homePlayerStats[playerId] = stats;
  }

  for (const [playerId, stats] of state.awayStats) {
    stats.minutesPlayed = 90;
    awayPlayerStats[playerId] = stats;
  }

  // Calculate possession (simplified - based on team strengths)
  const homeStrength = calculateTeamStrength(input.homeTeam);
  const awayStrength = calculateTeamStrength(input.awayTeam);
  const totalStrength = homeStrength + awayStrength;
  const homePoss = Math.round((homeStrength / totalStrength) * 100);

  return {
    possession: { home: homePoss, away: 100 - homePoss },
    fullChances: { home: 0, away: 0 }, // Deprecated
    halfChances: { home: 0, away: 0 }, // Deprecated
    shots: { home: homeShots, away: awayShots },
    shotsOnTarget: { home: homeShotsOnTarget, away: awayShotsOnTarget },
    corners: { home: homeCorners, away: awayCorners },
    fouls: { home: homeFouls, away: awayFouls },
    yellowCards: { home: homeYellows, away: awayYellows },
    redCards: { home: homeReds, away: awayReds },
    halfTimeScore,
    homePlayerStats,
    awayPlayerStats,
    events: state.events,
  } as SoccerBoxScore & { events: SoccerEvent[] };
}
