/**
 * AI Manager - Central Orchestrator
 *
 * Coordinates all AI decision-making for a single team.
 * Uses the full AIPersonality traits to drive intelligent behavior.
 */

import type { Player, AIPersonality } from '../data/types';
import type { DecisionContext, Position, AIConfig } from './types';
import { calculateOverallRating } from './evaluation';
import { getDecisionThresholds } from './personality';

// =============================================================================
// AI PERCEPTION & RATE LIMITING
// =============================================================================

/**
 * AI doesn't have perfect knowledge - they see estimates with variance
 * This simulates imperfect scouting/evaluation
 */
const AI_RATING_VARIANCE = 8; // ±8 points variance

/**
 * Get AI's perceived rating of a player (with variance)
 * Uses a seeded approach so the same player gets consistent ratings within a session
 */
export function getPerceivedRating(
  actualRating: number,
  playerId: string,
  teamId: string
): number {
  // Create a deterministic "random" offset based on player+team IDs
  // This ensures same team sees same variance for same player
  const hash = simpleHash(playerId + teamId);
  const normalizedHash = (hash % 1000) / 1000; // 0 to 1
  const variance = (normalizedHash - 0.5) * 2 * AI_RATING_VARIANCE; // -8 to +8

  // Clamp to valid range
  return Math.max(1, Math.min(100, Math.round(actualRating + variance)));
}

/**
 * Simple hash function for deterministic variance
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Chance that an AI team takes action this week
 * Not every team is actively looking every single week
 */
const BASE_ACTION_CHANCE = 0.3; // 30% base chance to act

/**
 * Determine if AI team will be active this week
 * More desperate teams (critical needs) are more likely to act
 */
export function willTeamActThisWeek(
  teamId: string,
  week: number,
  hasCriticalNeed: boolean,
  personality: AIPersonality
): boolean {
  // Use deterministic randomness based on team+week
  const hash = simpleHash(teamId + week.toString());
  const roll = (hash % 100) / 100;

  // Calculate action chance
  let chance = BASE_ACTION_CHANCE;

  // Critical needs increase action chance significantly
  if (hasCriticalNeed) {
    chance += 0.4; // 70% total if critical
  }

  // Aggressive spenders are more active
  const spending = personality.traits.spending_aggression / 100;
  chance += spending * 0.2; // Up to +20% for aggressive teams

  // Cap at 75% max action chance
  chance = Math.min(0.75, chance);

  return roll < chance;
}

/**
 * Maximum moves per team per week
 */
const MAX_SIGNINGS_PER_WEEK = 1;
const MAX_TRANSFER_BIDS_PER_WEEK = 1;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Intent to sign a free agent
 */
export interface SigningIntent {
  playerId: string;
  playerName: string;
  offeredSalary: number;
  offeredYears: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Transfer bid on a player from another team
 */
export interface TransferBid {
  playerId: string;
  playerName: string;
  targetTeamId: string;
  bidAmount: number;
  maxBid: number;
  urgency: 'reluctant' | 'neutral' | 'desperate';
  reason: string;
}

/**
 * Response to an incoming offer
 */
export interface OfferResponse {
  offerId: string;
  playerId: string;
  decision: 'accept' | 'reject' | 'counter';
  counterAmount?: number;
  reason: string;
}

/**
 * Intent to release a player
 */
export interface PlayerRelease {
  playerId: string;
  playerName: string;
  reason: string;
}

/**
 * All actions an AI team wants to take this week
 */
export interface AIWeeklyActions {
  teamId: string;
  teamName: string;
  signings: SigningIntent[];
  transferBids: TransferBid[];
  offerResponses: OfferResponse[];
  releases: PlayerRelease[];
}

/**
 * Extended decision context with team-specific info
 */
export interface AIDecisionContext extends DecisionContext {
  teamId: string;
  teamName: string;
  personality: AIPersonality;
  roster: Player[];
  budget: number;
  salaryCommitment: number;
  leaguePosition?: number;
  totalTeams?: number;
}

/**
 * Team needs assessment result
 */
export interface TeamNeeds {
  positionGaps: PositionNeed[];
  agingConcerns: AgingConcern[];
  weakestPosition: Position | null;
  strongestPosition: Position | null;
  overallStrength: number;
  rosterSize: number;
  idealRosterSize: number;
}

export interface PositionNeed {
  position: Position;
  currentCount: number;
  idealCount: number;
  avgRating: number;
  urgency: 'critical' | 'moderate' | 'low';
  targetRating: number;
}

export interface AgingConcern {
  player: Player;
  yearsUntilDecline: number;
  urgency: 'immediate' | 'soon' | 'monitor';
}

// =============================================================================
// PERSONALITY TRAIT HELPERS
// =============================================================================

/**
 * Get normalized trait value (0-1 from 0-100)
 */
export function getTraitValue(personality: AIPersonality, trait: keyof AIPersonality['traits']): number {
  const value = personality.traits[trait];
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value / 100;
}

/**
 * Calculate age threshold for "aging" based on youth focus
 * Higher youth focus = lower age threshold (earlier concern about aging players)
 */
export function getAgingThreshold(personality: AIPersonality): number {
  const youthFocus = getTraitValue(personality, 'youth_development_focus');
  // Range: 28 (high youth focus) to 33 (low youth focus)
  return Math.round(33 - (youthFocus * 5));
}

/**
 * Calculate minimum acceptable offer multiplier based on personality
 *
 * NEW LOGIC (based on spending_aggression, not loyalty):
 * - Conservative (low spending_aggression): MORE likely to sell at good price
 *   They're fiscally responsible, so they accept reasonable offers
 * - Aggressive (high spending_aggression): LESS likely to sell
 *   They want to keep players and are willing to stretch budget
 *
 * Multiplier determines minimum acceptable offer vs market value:
 * - Conservative: 0.85-1.0x market value (will sell at or slightly below market)
 * - Aggressive: 1.2-1.5x market value (need overpay to sell)
 */
export function getSellingMultiplier(personality: AIPersonality, isStarPlayer: boolean): number {
  const spendingAggression = getTraitValue(personality, 'spending_aggression');

  // Conservative = 0.85x, Aggressive = 1.2x (inverted from old logic)
  // Low spending aggression = more willing to sell = lower multiplier
  let multiplier = 0.85 + (spendingAggression * 0.35); // 0.85 to 1.2

  // Star players still get protection, but less extreme
  if (isStarPlayer) {
    multiplier *= 1.15; // 15% premium for stars (0.98 to 1.38)
  }

  return multiplier;
}

/**
 * Calculate spending willingness multiplier
 * Higher spending aggression = willing to pay more
 */
export function getSpendingMultiplier(personality: AIPersonality): number {
  const spending = getTraitValue(personality, 'spending_aggression');
  // Range: 0.8 (conservative) to 1.3 (aggressive)
  return 0.8 + (spending * 0.5);
}

/**
 * Calculate risk tolerance factor
 * Higher risk tolerance = more willing to take chances
 */
export function getRiskFactor(personality: AIPersonality): number {
  return getTraitValue(personality, 'risk_tolerance');
}

/**
 * Map AIPersonality to simplified AIConfig for existing functions
 */
export function personalityToConfig(personality: AIPersonality): AIConfig {
  const riskTolerance = personality.traits.risk_tolerance;

  let type: 'conservative' | 'balanced' | 'aggressive';
  if (riskTolerance < 40) {
    type = 'conservative';
  } else if (riskTolerance > 70) {
    type = 'aggressive';
  } else {
    type = 'balanced';
  }

  return {
    personality: type,
    youthDevelopmentFocus: personality.traits.youth_development_focus,
    spendingAggression: personality.traits.spending_aggression,
    defensivePreference: personality.traits.defensive_preference,
    riskTolerance: personality.traits.risk_tolerance,
  };
}

// =============================================================================
// ROSTER ANALYSIS (MULTI-SPORT)
// =============================================================================

// Multi-sport roster requirements
// Players CAN play all sports, but optimal strategy is sport-specific cores:
// - Basketball core: ~8 players
// - Soccer core: ~14 players
// - Baseball core: ~12 players
// - Plus backups/flex players = ~45 ideal
const IDEAL_ROSTER_SIZE = 45;
const MAX_ROSTER_SIZE = 50;

// =============================================================================
// BASKETBALL POSITION ANALYSIS
// =============================================================================

/**
 * Basketball position category based on height
 * - Guards: < 6'6" (< 78 inches)
 * - Wings: 6'6" to 6'9" (78-81 inches)
 * - Bigs: 6'10"+ (82+ inches)
 */
type BasketballPositionCategory = 'Guard' | 'Wing' | 'Big';

const BASKETBALL_POSITION_CATEGORIES: BasketballPositionCategory[] = ['Guard', 'Wing', 'Big'];

// Basketball core: ~8 players (2-3 per category + flex)
const BASKETBALL_IDEAL_DEPTH: Record<BasketballPositionCategory, number> = {
  Guard: 3,  // Need guards for ball handling
  Wing: 3,   // Versatile players
  Big: 2,    // Rim protection and rebounding
};

/**
 * Determine a player's basketball position category based on height
 */
export function getBasketballPositionCategory(player: Player): BasketballPositionCategory {
  const heightInches = player.height;

  if (heightInches < 78) {        // Under 6'6"
    return 'Guard';
  } else if (heightInches < 82) { // 6'6" to 6'9"
    return 'Wing';
  } else {                        // 6'10"+
    return 'Big';
  }
}

/**
 * Check if a player can play a specific basketball position category
 * Players can only play their height-determined category (no flex)
 */
export function canPlayBasketballPosition(player: Player, category: BasketballPositionCategory): boolean {
  return getBasketballPositionCategory(player) === category;
}

/**
 * Map old position types to new categories (for compatibility)
 * PG, SG → Guard; SF → Wing; PF, C → depends on height
 */
export function mapPositionToCategory(_position: Position, height: number): BasketballPositionCategory {
  // Height is the determining factor, not the legacy position
  if (height < 78) return 'Guard';
  if (height < 82) return 'Wing';
  return 'Big';
}

// =============================================================================
// SOCCER POSITION ANALYSIS
// =============================================================================

type SoccerPosition = 'GK' | 'CB' | 'FB' | 'CDM' | 'CM' | 'CAM' | 'WM' | 'W' | 'ST';

const SOCCER_POSITIONS: SoccerPosition[] = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WM', 'W', 'ST'];
// Soccer core: ~14 players (starting XI + 3 key subs)
const SOCCER_IDEAL_DEPTH: Record<SoccerPosition, number> = {
  GK: 2,   // Starting GK + backup
  CB: 3,   // 2 starters + 1 backup
  FB: 2,   // LB + RB (L/R equivalence means 2 covers both sides)
  CDM: 1,  // Defensive midfielder
  CM: 2,   // Central midfielders
  CAM: 1,  // Attacking midfielder
  WM: 1,   // Wide midfielder (covers both sides)
  W: 2,    // Wingers (covers both sides)
  ST: 2,   // Strikers
};

/**
 * Normalize soccer positions to handle L/R equivalence
 * LB/RB → FB (fullback), LM/RM → WM (wide mid), LW/RW → W (winger)
 */
function normalizeSoccerPosition(position: string | undefined): SoccerPosition | null {
  if (!position) return null;

  // Handle L/R equivalence - treat as same position category
  const normalizationMap: Record<string, SoccerPosition> = {
    'GK': 'GK',
    'CB': 'CB',
    'LB': 'FB', 'RB': 'FB',  // Fullbacks
    'CDM': 'CDM',
    'CM': 'CM',
    'CAM': 'CAM',
    'LM': 'WM', 'RM': 'WM',  // Wide midfielders
    'LW': 'W', 'RW': 'W',    // Wingers
    'ST': 'ST',
  };

  return normalizationMap[position] || null;
}

/**
 * Estimate a player's best soccer position based on attributes
 * Used when sportMetadata.soccer.preferredPosition isn't set
 */
function estimateSoccerPosition(player: Player): SoccerPosition {
  const attrs = player.attributes;
  const height = player.height; // in inches

  // Goalkeeper: Tall + good reactions + good jumping
  if (height >= 74 && attrs.reactions >= 65 && attrs.jumping >= 60) {
    // Check if they have low offensive stats suggesting GK
    if (attrs.throw_accuracy < 55 && attrs.top_speed < 60) {
      return 'GK';
    }
  }

  // Center back: Tall + strong + good balance
  if (height >= 73 && attrs.core_strength >= 60 && attrs.balance >= 55) {
    if (attrs.top_speed < 70) return 'CB';
  }

  // Fullback: Good speed + stamina + balance
  if (attrs.top_speed >= 65 && attrs.stamina >= 60 && attrs.acceleration >= 60) {
    if (attrs.throw_accuracy < 65) return 'FB';
  }

  // CDM: Strong + good awareness + balance
  if (attrs.core_strength >= 55 && attrs.awareness >= 60 && attrs.balance >= 55) {
    if (attrs.creativity < 65) return 'CDM';
  }

  // CAM: Creative + good technique + awareness
  if (attrs.creativity >= 65 && attrs.form_technique >= 60 && attrs.awareness >= 60) {
    return 'CAM';
  }

  // Winger: Fast + agile + good acceleration
  if (attrs.top_speed >= 70 && attrs.agility >= 65 && attrs.acceleration >= 65) {
    return 'W';
  }

  // Striker: Good finishing (accuracy + composure) + jumping
  if (attrs.throw_accuracy >= 65 && attrs.composure >= 60) {
    if (attrs.jumping >= 60 || attrs.top_speed >= 70) return 'ST';
  }

  // Wide midfielder: Speed + stamina
  if (attrs.top_speed >= 60 && attrs.stamina >= 65) {
    return 'WM';
  }

  // Default to CM (versatile midfield role)
  return 'CM';
}

/**
 * Get a player's soccer position (normalized)
 */
function getPlayerSoccerPosition(player: Player): SoccerPosition {
  // First check if they have an explicit preferred position
  const preferred = player.sportMetadata?.soccer?.preferredPosition;
  const normalized = normalizeSoccerPosition(preferred);
  if (normalized) return normalized;

  // Otherwise estimate from attributes
  return estimateSoccerPosition(player);
}

// =============================================================================
// BASEBALL POSITION ANALYSIS
// =============================================================================

type BaseballPosition = 'P' | 'C' | '1B' | '2B' | 'SS' | '3B' | 'OF';

const BASEBALL_POSITIONS: BaseballPosition[] = ['P', 'C', '1B', '2B', 'SS', '3B', 'OF'];
// Baseball core: ~12 players (9 starters + pitching rotation)
const BASEBALL_IDEAL_DEPTH: Record<BaseballPosition, number> = {
  P: 5,    // Starting rotation (5) - bullpen can be flex players
  C: 2,    // Starting catcher + backup
  '1B': 1,
  '2B': 1,
  'SS': 1,
  '3B': 1,
  OF: 3,   // LF + CF + RF
};

/**
 * Normalize baseball outfield positions
 * LF/CF/RF → OF
 */
function normalizeBaseballPosition(position: string | undefined): BaseballPosition | null {
  if (!position) return null;

  const normalizationMap: Record<string, BaseballPosition> = {
    'P': 'P',
    'C': 'C',
    '1B': '1B',
    '2B': '2B',
    'SS': 'SS',
    '3B': '3B',
    'LF': 'OF', 'CF': 'OF', 'RF': 'OF',
    'DH': '1B', // DH can play 1B
  };

  return normalizationMap[position] || null;
}

/**
 * Estimate a player's best baseball position based on attributes
 */
function estimateBaseballPosition(player: Player): BaseballPosition {
  const attrs = player.attributes;

  // Pitcher: Good arm strength + form technique
  if (attrs.arm_strength >= 65 && attrs.form_technique >= 60) {
    return 'P';
  }

  // Catcher: Strong + good reactions + durable
  if (attrs.core_strength >= 60 && attrs.reactions >= 60 && attrs.durability >= 65) {
    if (attrs.top_speed < 65) return 'C';
  }

  // Shortstop: Agile + quick reactions + good arm
  if (attrs.agility >= 65 && attrs.reactions >= 65 && attrs.arm_strength >= 55) {
    return 'SS';
  }

  // Second base: Agile + good hands
  if (attrs.agility >= 60 && attrs.hand_eye_coordination >= 60) {
    if (attrs.arm_strength < 65) return '2B';
  }

  // Third base: Good reactions + strong arm
  if (attrs.reactions >= 60 && attrs.arm_strength >= 60) {
    return '3B';
  }

  // Outfield: Fast + good tracking
  if (attrs.top_speed >= 65 && attrs.awareness >= 55) {
    return 'OF';
  }

  // First base: Default for bigger/slower players
  return '1B';
}

/**
 * Get a player's baseball position (normalized)
 */
function getPlayerBaseballPosition(player: Player): BaseballPosition {
  // First check if they have an explicit preferred position
  const preferred = player.sportMetadata?.baseball?.preferredPosition;
  const normalized = normalizeBaseballPosition(preferred);
  if (normalized) return normalized;

  // Otherwise estimate from attributes
  return estimateBaseballPosition(player);
}

// =============================================================================
// COMBINED ROSTER ANALYSIS
// =============================================================================

/**
 * Analyze position needs for a specific sport
 */
function analyzeSportPositions<T extends string>(
  roster: Player[],
  positions: T[],
  idealDepth: Record<T, number>,
  getPosition: (p: Player) => T,
  personality: AIPersonality
): PositionNeed[] {
  const youthFocus = getTraitValue(personality, 'youth_development_focus');

  return positions.map(pos => {
    const players = roster.filter(p => getPosition(p) === pos);
    const count = players.length;
    const ideal = idealDepth[pos];
    const avgRating = count > 0
      ? players.reduce((sum, p) => sum + calculateOverallRating(p), 0) / count
      : 0;

    let urgency: 'critical' | 'moderate' | 'low';
    if (count === 0) {
      urgency = 'critical';
    } else if (count < ideal * 0.5) {
      urgency = 'critical';  // Less than half needed
    } else if (count < ideal || avgRating < 55) {
      urgency = 'moderate';
    } else {
      urgency = 'low';
    }

    // Target rating based on current strength and personality
    const targetRating = avgRating > 0
      ? Math.max(avgRating + 5, 60 - (youthFocus * 10))
      : 60;

    return {
      position: pos as Position,  // Cast for type compatibility
      currentCount: count,
      idealCount: ideal,
      avgRating,
      urgency,
      targetRating,
    };
  });
}

/**
 * Analyze team roster to identify needs across all sports
 */
export function analyzeTeamNeeds(
  roster: Player[],
  personality: AIPersonality
): TeamNeeds {
  const agingThreshold = getAgingThreshold(personality);

  // Analyze basketball position categories (based on height: Guards/Wings/Bigs)
  const basketballGaps = analyzeSportPositions(
    roster,
    BASKETBALL_POSITION_CATEGORIES,
    BASKETBALL_IDEAL_DEPTH,
    getBasketballPositionCategory,
    personality
  );

  // Analyze soccer positions
  const soccerGaps = analyzeSportPositions(
    roster,
    SOCCER_POSITIONS,
    SOCCER_IDEAL_DEPTH,
    getPlayerSoccerPosition,
    personality
  );

  // Analyze baseball positions
  const baseballGaps = analyzeSportPositions(
    roster,
    BASEBALL_POSITIONS,
    BASEBALL_IDEAL_DEPTH,
    getPlayerBaseballPosition,
    personality
  );

  // For AI decisions, use basketball positions as primary (matches player.position)
  // but weight urgency based on combined needs
  const positionGaps = basketballGaps.map(gap => {
    // Check if there's a critical soccer or baseball need that this player type could fill
    const relatedSoccerNeed = soccerGaps.find(s => s.urgency === 'critical');
    const relatedBaseballNeed = baseballGaps.find(b => b.urgency === 'critical');

    // Escalate urgency if other sports desperately need players
    if (gap.urgency === 'low' && (relatedSoccerNeed || relatedBaseballNeed)) {
      return { ...gap, urgency: 'moderate' as const };
    }
    return gap;
  });

  // Identify aging concerns
  const agingConcerns: AgingConcern[] = roster
    .filter(p => p.age >= agingThreshold - 3)
    .map(p => {
      const yearsUntilDecline = Math.max(0, agingThreshold - p.age);
      let urgency: 'immediate' | 'soon' | 'monitor';
      if (yearsUntilDecline <= 0) {
        urgency = 'immediate';
      } else if (yearsUntilDecline <= 2) {
        urgency = 'soon';
      } else {
        urgency = 'monitor';
      }
      return { player: p, yearsUntilDecline, urgency };
    })
    .sort((a, b) => a.yearsUntilDecline - b.yearsUntilDecline);

  // Find weakest and strongest basketball positions (primary reference)
  const sortedByStrength = [...positionGaps].sort((a, b) => {
    const urgencyOrder = { critical: 0, moderate: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.avgRating - b.avgRating;
  });

  const weakestPosition = sortedByStrength[0]?.position ?? null;
  const strongestPosition = sortedByStrength[sortedByStrength.length - 1]?.position ?? null;

  // Calculate overall team strength
  const overallStrength = roster.length > 0
    ? roster.reduce((sum, p) => sum + calculateOverallRating(p), 0) / roster.length
    : 0;

  return {
    positionGaps,
    agingConcerns,
    weakestPosition,
    strongestPosition,
    overallStrength,
    rosterSize: roster.length,
    idealRosterSize: IDEAL_ROSTER_SIZE,
  };
}

// =============================================================================
// AI DECISION MAKING
// =============================================================================

/**
 * Determine if AI should pursue a free agent
 */
export function shouldPursueFreeAgent(
  agent: { id: string; name: string; position: string; overallRating: number; age: number; annualSalary: number },
  needs: TeamNeeds,
  context: AIDecisionContext
): SigningIntent | null {
  const { personality, budget, salaryCommitment, roster } = context;
  const config = personalityToConfig(personality);
  const thresholds = getDecisionThresholds(config);

  // Check roster space
  if (roster.length >= MAX_ROSTER_SIZE) {
    return null;
  }

  // Check budget (can we afford 2 years of salary?)
  const affordableYearlySalary = (budget - salaryCommitment) * 0.3; // Max 30% of available for one player
  if (agent.annualSalary > affordableYearlySalary) {
    return null;
  }

  // Check if player meets minimum rating threshold
  if (agent.overallRating < thresholds.signPlayerRating - 10) {
    return null; // Too far below threshold
  }

  // Check position need
  const positionNeed = needs.positionGaps.find(g => g.position === agent.position);
  if (!positionNeed) {
    return null;
  }

  // Calculate fit score
  let priority: 'high' | 'medium' | 'low' = 'low';
  let reason = '';

  if (positionNeed.urgency === 'critical') {
    priority = 'high';
    reason = `Critical need at ${agent.position}`;
  } else if (positionNeed.urgency === 'moderate' && agent.overallRating >= positionNeed.avgRating) {
    priority = 'medium';
    reason = `Upgrade at ${agent.position} (${agent.overallRating} vs ${positionNeed.avgRating.toFixed(0)} avg)`;
  } else if (agent.overallRating >= thresholds.signPlayerRating) {
    priority = 'low';
    reason = `Quality player available`;
  } else {
    return null; // Not interested
  }

  // Age check based on youth focus
  const agingThreshold = getAgingThreshold(personality);
  const youthFocus = getTraitValue(personality, 'youth_development_focus');
  if (agent.age > agingThreshold && youthFocus > 0.6) {
    // Youth-focused teams skip older players unless critical need
    if (priority !== 'high') {
      return null;
    }
  }

  // Calculate offer
  const spendingMultiplier = getSpendingMultiplier(personality);
  const offeredSalary = Math.round(agent.annualSalary * spendingMultiplier);

  // Contract length based on age
  let offeredYears: number;
  if (agent.age < 25) {
    offeredYears = config.personality === 'aggressive' ? 4 : 3;
  } else if (agent.age < 30) {
    offeredYears = 2;
  } else {
    offeredYears = 1;
  }

  return {
    playerId: agent.id,
    playerName: agent.name,
    offeredSalary,
    offeredYears,
    priority,
    reason,
  };
}

/**
 * Transfer target information including release clause
 */
export interface TransferTargetInfo {
  id: string;
  name: string;
  teamId: string;
  position: string;
  overallRating: number;
  age: number;
  marketValue: number;
  releaseClause?: number;         // Optional release clause
  bidBlockedUntilWeek?: number;   // User can block bids for 4 weeks
  isOnTransferList?: boolean;     // Player is listed for transfer (motivated seller)
}

/**
 * Determine if AI should make a transfer bid
 *
 * IMPORTANT: AI is aware of release clauses and will NEVER bid above them.
 * If a release clause exists, it triggers auto-accept at that value.
 * AI will bid below the clause if the player is worth pursuing.
 */
export function shouldMakeTransferBid(
  target: TransferTargetInfo,
  needs: TeamNeeds,
  context: AIDecisionContext
): TransferBid | null {
  const { personality, budget, roster } = context;

  // Check if bids are blocked for this player (user blocked for 4 weeks)
  if (target.bidBlockedUntilWeek && context.week < target.bidBlockedUntilWeek) {
    return null;
  }

  // Check roster space
  if (roster.length >= MAX_ROSTER_SIZE) {
    return null;
  }

  // Check position need
  const positionNeed = needs.positionGaps.find(g => g.position === target.position);
  if (!positionNeed || positionNeed.urgency === 'low') {
    return null; // Only pursue if we need the position
  }

  // Must be an upgrade
  if (target.overallRating <= positionNeed.avgRating + 3) {
    return null; // Not enough of an upgrade
  }

  // Calculate bid based on spending aggression
  const spendingMultiplier = getSpendingMultiplier(personality);

  // TRANSFER LIST DISCOUNT: Players on transfer list are motivated sellers
  // AI knows they can bid at or below market value and likely get accepted
  const transferListDiscount = target.isOnTransferList ? 0.85 : 1.0; // 15% discount for listed players

  // Base bid: normally 1.5x market value, but much lower for transfer-listed players
  const baseBidMultiplier = target.isOnTransferList ? 0.9 : 1.5; // Start at 90% of market for listed players
  const baseBid = target.marketValue * baseBidMultiplier * transferListDiscount;
  let bidAmount = Math.round(baseBid * spendingMultiplier);

  // Max bid is also capped lower for transfer-listed players (they're motivated to sell)
  const maxBidMultiplier = target.isOnTransferList ? 1.1 : 2.5; // Max 110% of market for listed players
  let maxBid = Math.round(target.marketValue * maxBidMultiplier * spendingMultiplier);

  // CRITICAL: If release clause exists, NEVER bid above it
  // Bidding at or above release clause triggers auto-accept
  // AI should bid BELOW the clause to try to negotiate
  if (target.releaseClause && target.releaseClause > 0) {
    // Cap our max bid just below the release clause (95% of it)
    // We don't want to trigger auto-accept, we want to negotiate
    const maxBeforeClause = Math.floor(target.releaseClause * 0.95);
    maxBid = Math.min(maxBid, maxBeforeClause);

    // If our calculated bid would exceed clause, cap it
    if (bidAmount >= target.releaseClause) {
      bidAmount = maxBeforeClause;
    }

    // If even 95% of release clause is too expensive, skip
    if (maxBeforeClause > budget * 0.5) {
      return null;
    }
  }

  // Check if we can afford it
  if (bidAmount > budget * 0.5) {
    return null; // Too expensive (max 50% of budget on one player)
  }

  // If our max bid is too low to be competitive, skip
  if (maxBid < target.marketValue * 0.75) {
    return null;
  }

  // Determine urgency
  let urgency: 'reluctant' | 'neutral' | 'desperate';
  if (positionNeed.urgency === 'critical') {
    urgency = 'desperate';
  } else if (positionNeed.urgency === 'moderate') {
    urgency = 'neutral';
  } else {
    urgency = 'reluctant';
  }

  return {
    playerId: target.id,
    playerName: target.name,
    targetTeamId: target.teamId,
    bidAmount,
    maxBid,
    urgency,
    reason: `${positionNeed.urgency} need at ${target.position}, ${target.overallRating} rating`,
  };
}

/**
 * Evaluate an incoming transfer offer
 */
export function evaluateIncomingOffer(
  offer: { offerId: string; playerId: string; offerAmount: number },
  player: Player,
  marketValue: number,
  context: AIDecisionContext
): OfferResponse {
  const { personality, roster } = context;

  // Check if this is a star player
  const sortedByRating = [...roster].sort((a, b) =>
    calculateOverallRating(b) - calculateOverallRating(a)
  );
  const playerRank = sortedByRating.findIndex(p => p.id === player.id) + 1;
  const isStarPlayer = playerRank <= 3;

  // Calculate minimum acceptable offer using selling multiplier
  // Conservative = sells easier (lower multiplier), Aggressive = holds (higher multiplier)
  const sellingMultiplier = getSellingMultiplier(personality, isStarPlayer);
  const minAcceptable = Math.round(marketValue * sellingMultiplier);

  // Is this a lowball offer?
  const offerRatio = offer.offerAmount / marketValue;

  if (offerRatio < 0.75) {
    // Lowball - reject outright
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'reject',
      reason: `Insulting offer - ${(offerRatio * 100).toFixed(0)}% of market value`,
    };
  }

  if (offer.offerAmount >= minAcceptable) {
    // Accept
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'accept',
      reason: `Offer of $${offer.offerAmount.toLocaleString()} meets threshold of $${minAcceptable.toLocaleString()}`,
    };
  }

  // Counter if within 30% of acceptable
  if (offer.offerAmount >= minAcceptable * 0.7) {
    const counterAmount = Math.round(minAcceptable * 1.1); // Ask for 10% above minimum
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'counter',
      counterAmount,
      reason: `Counter-offer: $${counterAmount.toLocaleString()} (minimum acceptable: $${minAcceptable.toLocaleString()})`,
    };
  }

  // Reject
  return {
    offerId: offer.offerId,
    playerId: offer.playerId,
    decision: 'reject',
    reason: `Offer $${offer.offerAmount.toLocaleString()} too far below minimum $${minAcceptable.toLocaleString()}`,
  };
}

/**
 * Determine if AI should release a player
 */
export function shouldReleasePlayer(
  player: Player,
  needs: TeamNeeds,
  context: AIDecisionContext
): PlayerRelease | null {
  const { personality, roster } = context;
  const config = personalityToConfig(personality);
  const thresholds = getDecisionThresholds(config);

  const rating = calculateOverallRating(player);

  // Find position depth
  const positionPlayers = roster.filter(p => p.position === player.position);
  const isLastAtPosition = positionPlayers.length <= 1;
  const isBestAtPosition = positionPlayers.every(p =>
    p.id === player.id || calculateOverallRating(p) <= rating
  );

  // Never release last player at position
  if (isLastAtPosition) {
    return null;
  }

  // Don't release best player at position (unless critical need elsewhere)
  if (isBestAtPosition && needs.rosterSize <= needs.idealRosterSize) {
    return null;
  }

  // Release if below threshold and roster is full
  if (rating < thresholds.releasePlayerRating && needs.rosterSize >= needs.idealRosterSize) {
    return {
      playerId: player.id,
      playerName: player.name,
      reason: `Rating ${rating.toFixed(0)} below threshold ${thresholds.releasePlayerRating}`,
    };
  }

  // Release if roster is over capacity and this is lowest rated
  if (needs.rosterSize > MAX_ROSTER_SIZE) {
    const lowestRated = [...roster].sort((a, b) =>
      calculateOverallRating(a) - calculateOverallRating(b)
    )[0];

    if (lowestRated?.id === player.id) {
      return {
        playerId: player.id,
        playerName: player.name,
        reason: `Roster over capacity, lowest rated player`,
      };
    }
  }

  return null;
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

/**
 * Process all AI decisions for a team for this week
 */
export function processAIWeek(
  context: AIDecisionContext,
  availableFreeAgents: Array<{ id: string; name: string; position: string; overallRating: number; age: number; annualSalary: number }>,
  availableTransferTargets: Array<{ id: string; name: string; teamId: string; position: string; overallRating: number; age: number; marketValue: number }>,
  incomingOffers: Array<{ offerId: string; playerId: string; offerAmount: number }>,
  getPlayerMarketValue: (playerId: string) => number
): AIWeeklyActions {
  const needs = analyzeTeamNeeds(context.roster, context.personality);

  const actions: AIWeeklyActions = {
    teamId: context.teamId,
    teamName: context.teamName,
    signings: [],
    transferBids: [],
    offerResponses: [],
    releases: [],
  };

  // Always respond to incoming offers (can't ignore them)
  for (const offer of incomingOffers) {
    const player = context.roster.find(p => p.id === offer.playerId);
    if (player) {
      const marketValue = getPlayerMarketValue(player.id);
      const response = evaluateIncomingOffer(offer, player, marketValue, context);
      actions.offerResponses.push(response);
    }
  }

  // Check if team will be proactively active this week
  const hasCriticalNeed = needs.positionGaps.some(g => g.urgency === 'critical');
  const isActiveThisWeek = willTeamActThisWeek(
    context.teamId,
    context.week,
    hasCriticalNeed,
    context.personality
  );

  // If not active this week, only respond to offers (no proactive moves)
  if (!isActiveThisWeek) {
    return actions;
  }

  // Convert free agents to perceived ratings (AI doesn't have perfect knowledge)
  const perceivedFreeAgents = availableFreeAgents.map(agent => ({
    ...agent,
    overallRating: getPerceivedRating(agent.overallRating, agent.id, context.teamId),
  }));

  // Convert transfer targets to perceived ratings
  const perceivedTransferTargets = availableTransferTargets.map(target => ({
    ...target,
    overallRating: getPerceivedRating(target.overallRating, target.id, context.teamId),
    // Market value also affected by perceived rating
    marketValue: Math.round(target.marketValue * (getPerceivedRating(target.overallRating, target.id, context.teamId) / target.overallRating)),
  }));

  // Consider releases if roster is bloated (max 1 per week)
  if (needs.rosterSize > needs.idealRosterSize + 5) { // Only release if significantly over
    for (const player of context.roster) {
      const release = shouldReleasePlayer(player, needs, context);
      if (release) {
        actions.releases.push(release);
        break; // Max 1 release per week
      }
    }
  }

  // Consider free agent signings (max 1 per week)
  const freeAgentIntents: SigningIntent[] = [];
  for (const agent of perceivedFreeAgents) {
    const intent = shouldPursueFreeAgent(agent, needs, context);
    if (intent) {
      freeAgentIntents.push(intent);
    }
  }

  // Sort by priority and take top 1 only
  if (freeAgentIntents.length > 0) {
    freeAgentIntents.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    actions.signings = freeAgentIntents.slice(0, MAX_SIGNINGS_PER_WEEK);
  }

  // Consider transfer bids (max 1 per week, and only if no signing this week)
  // AI teams don't try to do everything at once
  // IMPORTANT: Only make transfer bids if there's no suitable free agent available
  if (actions.signings.length === 0) {
    // Check if there's a free agent who could fill our critical needs
    // If so, we should wait and pursue them rather than making expensive transfer bids
    const criticalNeeds = needs.positionGaps.filter(g => g.urgency === 'critical');
    const hasFreeAgentForCriticalNeed = criticalNeeds.some(need => {
      return perceivedFreeAgents.some(agent =>
        agent.position === need.position &&
        agent.overallRating >= need.targetRating - 10 // Within 10 points of target
      );
    });

    // Only pursue transfers if:
    // 1. No free agents available for critical needs, OR
    // 2. We have moderate (not critical) needs but high spending aggression
    const shouldConsiderTransfers =
      !hasFreeAgentForCriticalNeed ||
      (criticalNeeds.length === 0 && getTraitValue(context.personality, 'spending_aggression') > 0.7);

    if (shouldConsiderTransfers) {
      const transferIntents: TransferBid[] = [];
      for (const target of perceivedTransferTargets) {
        const bid = shouldMakeTransferBid(target, needs, context);
        if (bid) {
          transferIntents.push(bid);
        }
      }

      if (transferIntents.length > 0) {
        transferIntents.sort((a, b) => {
          const urgencyOrder = { desperate: 0, neutral: 1, reluctant: 2 };
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        });
        actions.transferBids = transferIntents.slice(0, MAX_TRANSFER_BIDS_PER_WEEK);
      }
    }
  }

  return actions;
}

// =============================================================================
// PLAYER WILLINGNESS SYSTEM
// =============================================================================

/**
 * Player willingness to accept a move
 */
export interface PlayerWillingness {
  /** Overall willingness score (0-100) */
  willingness: number;
  /** Will the player accept this move? */
  accepts: boolean;
  /** Reasons affecting the decision */
  factors: {
    divisionChange: { score: number; reason: string };
    salaryChange: { score: number; reason: string };
    playingTime: { score: number; reason: string };
    ageCareer: { score: number; reason: string };
  };
}

/**
 * Calculate player's willingness to accept a transfer/signing
 *
 * Factors:
 * 1. Division change: Players WANT to move up (higher division = better)
 *    - Moving up: bonus
 *    - Moving down: penalty (unless financial compensation)
 *
 * 2. Salary change: Players want more money
 *    - Significant raise: bonus
 *    - Pay cut: penalty
 *
 * 3. Playing time: Players want to play
 *    - Starter role: bonus
 *    - Backup/bench role: penalty
 *
 * 4. Age/Career stage: Affects priorities
 *    - Young players prioritize development (playing time)
 *    - Prime players prioritize winning (division)
 *    - Veteran players prioritize money (salary)
 *
 * @param player - The player considering the move
 * @param currentDivision - Player's current team division (1=best, 10=worst)
 * @param targetDivision - Target team's division
 * @param currentSalary - Player's current salary
 * @param offeredSalary - Offered salary
 * @param expectedRole - Expected playing role at new team ('starter' | 'rotation' | 'bench')
 * @param currentRole - Current playing role
 */
export function calculatePlayerWillingness(
  player: { id: string; age: number; overallRating: number },
  currentDivision: number,
  targetDivision: number,
  currentSalary: number,
  offeredSalary: number,
  expectedRole: 'starter' | 'rotation' | 'bench',
  currentRole: 'starter' | 'rotation' | 'bench'
): PlayerWillingness {
  const factors = {
    divisionChange: { score: 0, reason: '' },
    salaryChange: { score: 0, reason: '' },
    playingTime: { score: 0, reason: '' },
    ageCareer: { score: 0, reason: '' },
  };

  // 1. Division change factor
  // Lower division number = better (Division 1 is elite, Division 10 is worst)
  const divisionDiff = currentDivision - targetDivision; // Positive = moving up

  if (divisionDiff > 0) {
    // Moving UP - players love this
    factors.divisionChange.score = Math.min(30, divisionDiff * 10);
    factors.divisionChange.reason = `Moving up ${divisionDiff} division${divisionDiff > 1 ? 's' : ''}`;
  } else if (divisionDiff < 0) {
    // Moving DOWN - players don't like this
    factors.divisionChange.score = Math.max(-40, divisionDiff * 8);
    factors.divisionChange.reason = `Moving down ${Math.abs(divisionDiff)} division${Math.abs(divisionDiff) > 1 ? 's' : ''}`;
  } else {
    factors.divisionChange.score = 0;
    factors.divisionChange.reason = 'Same division';
  }

  // 2. Salary change factor
  const salaryRatio = offeredSalary / Math.max(currentSalary, 1);
  const salaryPercentChange = (salaryRatio - 1) * 100;

  if (salaryRatio >= 1.5) {
    // 50%+ raise - very attractive
    factors.salaryChange.score = 30;
    factors.salaryChange.reason = `${salaryPercentChange.toFixed(0)}% salary increase`;
  } else if (salaryRatio >= 1.2) {
    // 20-49% raise - attractive
    factors.salaryChange.score = 20;
    factors.salaryChange.reason = `${salaryPercentChange.toFixed(0)}% salary increase`;
  } else if (salaryRatio >= 1.0) {
    // 0-19% raise - slight positive
    factors.salaryChange.score = Math.round(salaryPercentChange / 2);
    factors.salaryChange.reason = salaryRatio > 1 ? `${salaryPercentChange.toFixed(0)}% salary increase` : 'Same salary';
  } else if (salaryRatio >= 0.8) {
    // 0-20% pay cut - negative
    factors.salaryChange.score = Math.round((salaryRatio - 1) * 50);
    factors.salaryChange.reason = `${Math.abs(salaryPercentChange).toFixed(0)}% salary decrease`;
  } else {
    // 20%+ pay cut - very negative
    factors.salaryChange.score = -30;
    factors.salaryChange.reason = `${Math.abs(salaryPercentChange).toFixed(0)}% salary decrease`;
  }

  // 3. Playing time factor
  const roleScores = { starter: 2, rotation: 1, bench: 0 } as const;
  const roleDiff = roleScores[expectedRole] - roleScores[currentRole];

  if (roleDiff > 0) {
    // Better role - positive
    factors.playingTime.score = roleDiff * 15;
    factors.playingTime.reason = `Improved role (${currentRole} → ${expectedRole})`;
  } else if (roleDiff < 0) {
    // Worse role - negative
    factors.playingTime.score = roleDiff * 20;
    factors.playingTime.reason = `Reduced role (${currentRole} → ${expectedRole})`;
  } else {
    factors.playingTime.score = 5; // Same role is slightly positive (fresh start)
    factors.playingTime.reason = `Same role (${expectedRole})`;
  }

  // 4. Age/Career stage modifiers
  // These adjust the weights of other factors
  if (player.age < 24) {
    // Young player - prioritizes playing time
    factors.playingTime.score *= 1.5;
    factors.ageCareer.score = 5;
    factors.ageCareer.reason = 'Young player values development';
  } else if (player.age >= 24 && player.age < 30) {
    // Prime player - prioritizes winning/division
    factors.divisionChange.score *= 1.3;
    factors.ageCareer.score = 5;
    factors.ageCareer.reason = 'Prime player values winning';
  } else {
    // Veteran player - prioritizes money
    factors.salaryChange.score *= 1.5;
    factors.ageCareer.score = 5;
    factors.ageCareer.reason = 'Veteran values financial security';
  }

  // Calculate total willingness
  const totalScore = 50 + // Base willingness
    factors.divisionChange.score +
    factors.salaryChange.score +
    factors.playingTime.score +
    factors.ageCareer.score;

  // Clamp to 0-100
  const willingness = Math.max(0, Math.min(100, totalScore));

  // Players accept if willingness >= 50
  // Star players are pickier (need >= 60)
  const isStarPlayer = player.overallRating >= 80;
  const acceptThreshold = isStarPlayer ? 60 : 50;

  return {
    willingness,
    accepts: willingness >= acceptThreshold,
    factors,
  };
}

/**
 * Estimate expected role at a team based on player rating vs team depth
 */
export function estimateExpectedRole(
  playerRating: number,
  teamRosterAtPosition: { rating: number }[]
): 'starter' | 'rotation' | 'bench' {
  if (teamRosterAtPosition.length === 0) {
    return 'starter';
  }

  // Sort by rating descending
  const sortedByRating = [...teamRosterAtPosition].sort((a, b) => b.rating - a.rating);
  const bestRating = sortedByRating[0]?.rating || 0;
  const secondBestRating = sortedByRating[1]?.rating || 0;

  if (playerRating >= bestRating) {
    return 'starter';
  } else if (playerRating >= secondBestRating - 5) {
    return 'rotation';
  } else {
    return 'bench';
  }
}

/**
 * Estimate current role based on minutes allocation
 * (or default based on rating if no minutes data)
 */
export function estimateCurrentRole(
  minutesPerGame: number | undefined,
  teamAverageMinutes: number = 20
): 'starter' | 'rotation' | 'bench' {
  if (minutesPerGame === undefined) {
    return 'rotation'; // Default assumption
  }

  if (minutesPerGame >= teamAverageMinutes * 1.3) {
    return 'starter';
  } else if (minutesPerGame >= teamAverageMinutes * 0.5) {
    return 'rotation';
  } else {
    return 'bench';
  }
}

// =============================================================================
// SALARY EXPECTATION VARIANCE
// =============================================================================

/**
 * Salary expectation type
 */
export type SalaryExpectationType =
  | 'bargain'      // Asks for less than worth (rare - 10%)
  | 'realistic'    // Asks for fair market value (40%)
  | 'ambitious'    // Asks for more than worth (common - 35%)
  | 'delusional';  // Asks for much more than worth (15%)

/**
 * Salary expectation data
 */
export interface SalaryExpectation {
  type: SalaryExpectationType;
  multiplier: number;
  description: string;
}

/**
 * Calculate a player's salary expectation multiplier
 *
 * Distribution:
 * - Bargain (0.85-0.95x): 10% - Players who undervalue themselves
 * - Realistic (0.95-1.05x): 40% - Players who know their worth
 * - Ambitious (1.10-1.30x): 35% - Players who overvalue themselves (common)
 * - Delusional (1.40-1.70x): 15% - Players way overvaluing themselves
 *
 * This is deterministic based on player ID so the same player always
 * has the same expectation type within a game.
 *
 * @param playerId - Player ID for deterministic variance
 * @param age - Player age (older players may be more realistic)
 * @param overallRating - Overall rating (stars may be more ambitious)
 */
export function calculateSalaryExpectation(
  playerId: string,
  age: number,
  overallRating: number
): SalaryExpectation {
  // Create deterministic hash from player ID
  const hash = simpleHash(playerId + 'salary_exp');
  const roll = (hash % 100) / 100;

  // Age modifier: older players trend toward realistic
  // Rating modifier: higher rated players trend toward ambitious
  const ageMod = age >= 30 ? -0.1 : age < 24 ? 0.05 : 0;
  const ratingMod = overallRating >= 80 ? 0.1 : overallRating < 60 ? -0.05 : 0;
  const adjustedRoll = Math.max(0, Math.min(1, roll + ageMod + ratingMod));

  // Distribution thresholds
  // 0.00-0.10 = Bargain (10%)
  // 0.10-0.50 = Realistic (40%)
  // 0.50-0.85 = Ambitious (35%)
  // 0.85-1.00 = Delusional (15%)

  if (adjustedRoll < 0.10) {
    // Bargain: 0.85-0.95x
    const multiplier = 0.85 + (adjustedRoll / 0.10) * 0.10;
    return {
      type: 'bargain',
      multiplier,
      description: 'Undervalues themselves',
    };
  } else if (adjustedRoll < 0.50) {
    // Realistic: 0.95-1.05x
    const normalizedRoll = (adjustedRoll - 0.10) / 0.40;
    const multiplier = 0.95 + normalizedRoll * 0.10;
    return {
      type: 'realistic',
      multiplier,
      description: 'Knows their worth',
    };
  } else if (adjustedRoll < 0.85) {
    // Ambitious: 1.10-1.30x
    const normalizedRoll = (adjustedRoll - 0.50) / 0.35;
    const multiplier = 1.10 + normalizedRoll * 0.20;
    return {
      type: 'ambitious',
      multiplier,
      description: 'Overvalues themselves',
    };
  } else {
    // Delusional: 1.40-1.70x
    const normalizedRoll = (adjustedRoll - 0.85) / 0.15;
    const multiplier = 1.40 + normalizedRoll * 0.30;
    return {
      type: 'delusional',
      multiplier,
      description: 'Greatly overvalues themselves',
    };
  }
}

/**
 * Calculate what salary a player will demand
 *
 * @param playerId - Player ID
 * @param marketValueSalary - The fair market salary for this player
 * @param age - Player age
 * @param overallRating - Overall rating
 * @returns The salary the player will demand
 */
export function calculateDemandedSalary(
  playerId: string,
  marketValueSalary: number,
  age: number,
  overallRating: number
): number {
  const expectation = calculateSalaryExpectation(playerId, age, overallRating);
  return Math.round(marketValueSalary * expectation.multiplier);
}

/**
 * Check if an offered salary meets a player's expectations
 *
 * @param playerId - Player ID
 * @param offeredSalary - The salary being offered
 * @param marketValueSalary - The fair market salary
 * @param age - Player age
 * @param overallRating - Overall rating
 * @returns Whether the player would accept this salary
 */
export function willAcceptSalary(
  playerId: string,
  offeredSalary: number,
  marketValueSalary: number,
  age: number,
  overallRating: number
): boolean {
  const demandedSalary = calculateDemandedSalary(playerId, marketValueSalary, age, overallRating);

  // Players accept if offered at least 90% of their demanded salary
  // This allows some negotiation room
  return offeredSalary >= demandedSalary * 0.9;
}

/**
 * Get the minimum salary a player would accept
 *
 * @param playerId - Player ID
 * @param marketValueSalary - The fair market salary
 * @param age - Player age
 * @param overallRating - Overall rating
 * @returns The minimum acceptable salary (90% of demanded)
 */
export function getMinimumAcceptableSalary(
  playerId: string,
  marketValueSalary: number,
  age: number,
  overallRating: number
): number {
  const demandedSalary = calculateDemandedSalary(playerId, marketValueSalary, age, overallRating);
  return Math.round(demandedSalary * 0.9);
}
