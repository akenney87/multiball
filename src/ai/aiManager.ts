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
import { calculateAllOveralls } from '../utils/overallRating';

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
const BASE_ACTION_CHANCE = 0.5; // 50% base chance to act

/**
 * Determine if AI team will be active this week
 * More desperate teams (critical needs) are more likely to act
 */
export function willTeamActThisWeek(
  teamId: string,
  week: number,
  hasCriticalNeed: boolean,
  personality: AIPersonality,
  hasTransferListedTargets: boolean = false
): boolean {
  // Use deterministic randomness based on team+week
  const hash = simpleHash(teamId + week.toString());
  const roll = (hash % 100) / 100;

  // Calculate action chance
  let chance = BASE_ACTION_CHANCE;

  // Critical needs increase action chance significantly
  if (hasCriticalNeed) {
    chance += 0.3; // 80% total if critical
  }

  // Transfer-listed players available = bargain hunting opportunity
  // All teams are more active when there are deals to be found
  if (hasTransferListedTargets) {
    chance += 0.25; // 75% base when players are on the market
  }

  // Aggressive spenders are more active
  const spending = personality.traits.spending_aggression / 100;
  chance += spending * 0.2; // Up to +20% for aggressive teams

  // Cap at 95% max action chance
  chance = Math.min(0.95, chance);

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
  isOnTransferList: boolean;
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
 * Intent to transfer list a player (make available for sale)
 */
export interface TransferListing {
  playerId: string;
  playerName: string;
  askingPrice: number;  // AI's asking price based on market value
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
  transferListings: TransferListing[];
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
// SPORT-BASED PLAYER EVALUATION
// =============================================================================

export type SportType = 'basketball' | 'baseball' | 'soccer';

export interface SportRatings {
  basketball: number;
  baseball: number;
  soccer: number;
}

export interface TeamSportStrength {
  sport: SportType;
  average: number;
  median: number;
  max: number;
  playerCount: number;
}

export type RotationFit = 'starter' | 'rotation' | 'depth' | 'no-fit';

/**
 * Get a player's best sport and their rating in it
 */
export function getPlayerBestSport(player: Player): { sport: SportType; rating: number } {
  const overalls = calculateAllOveralls(player);

  if (overalls.basketball >= overalls.baseball && overalls.basketball >= overalls.soccer) {
    return { sport: 'basketball', rating: overalls.basketball };
  } else if (overalls.baseball >= overalls.soccer) {
    return { sport: 'baseball', rating: overalls.baseball };
  } else {
    return { sport: 'soccer', rating: overalls.soccer };
  }
}

/**
 * Get sport-specific ratings for a player
 */
export function getPlayerSportRatings(player: Player): SportRatings {
  const overalls = calculateAllOveralls(player);
  return {
    basketball: overalls.basketball,
    baseball: overalls.baseball,
    soccer: overalls.soccer,
  };
}

/**
 * Cache for all three sport strengths for a team
 * Pre-calculated once per team per week for performance
 */
export interface TeamSportStrengthCache {
  basketball: TeamSportStrength;
  baseball: TeamSportStrength;
  soccer: TeamSportStrength;
}

/**
 * Pre-calculate team strengths for all three sports
 * Call this once per team to avoid recalculating for every transfer target
 */
export function calculateAllTeamSportStrengths(roster: Player[]): TeamSportStrengthCache {
  if (roster.length === 0) {
    return {
      basketball: { sport: 'basketball', average: 0, median: 0, max: 0, playerCount: 0 },
      baseball: { sport: 'baseball', average: 0, median: 0, max: 0, playerCount: 0 },
      soccer: { sport: 'soccer', average: 0, median: 0, max: 0, playerCount: 0 },
    };
  }

  // Calculate all player overalls ONCE
  const playerOveralls = roster.map(player => calculateAllOveralls(player));

  // Extract ratings for each sport
  const basketballRatings = playerOveralls.map(o => o.basketball).sort((a, b) => b - a);
  const baseballRatings = playerOveralls.map(o => o.baseball).sort((a, b) => b - a);
  const soccerRatings = playerOveralls.map(o => o.soccer).sort((a, b) => b - a);

  const calculateStats = (ratings: number[], sport: SportType): TeamSportStrength => {
    const sum = ratings.reduce((acc, r) => acc + r, 0);
    const average = sum / ratings.length;
    const mid = Math.floor(ratings.length / 2);
    let median: number;
    if (ratings.length % 2 === 0) {
      median = ((ratings[mid - 1] ?? 0) + (ratings[mid] ?? 0)) / 2;
    } else {
      median = ratings[mid] ?? 0;
    }
    return {
      sport,
      average: Math.round(average * 10) / 10,
      median: Math.round(median * 10) / 10,
      max: ratings[0] ?? 0,
      playerCount: ratings.length,
    };
  };

  return {
    basketball: calculateStats(basketballRatings, 'basketball'),
    baseball: calculateStats(baseballRatings, 'baseball'),
    soccer: calculateStats(soccerRatings, 'soccer'),
  };
}

/**
 * Calculate team's strength in a specific sport
 * Uses players' ratings in that sport to determine avg/median/max
 * @deprecated Use calculateAllTeamSportStrengths for better performance
 */
export function calculateTeamSportStrength(
  roster: Player[],
  sport: SportType
): TeamSportStrength {
  if (roster.length === 0) {
    return { sport, average: 0, median: 0, max: 0, playerCount: 0 };
  }

  // Get each player's rating in the specified sport
  const ratings = roster.map(player => {
    const overalls = calculateAllOveralls(player);
    return overalls[sport];
  }).sort((a, b) => b - a); // Sort descending

  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const average = sum / ratings.length;

  // Median calculation (safe access with fallback)
  const mid = Math.floor(ratings.length / 2);
  let median: number;
  if (ratings.length % 2 === 0) {
    const left = ratings[mid - 1] ?? 0;
    const right = ratings[mid] ?? 0;
    median = (left + right) / 2;
  } else {
    median = ratings[mid] ?? 0;
  }

  const max = ratings[0] ?? 0;

  return {
    sport,
    average: Math.round(average * 10) / 10,
    median: Math.round(median * 10) / 10,
    max,
    playerCount: ratings.length,
  };
}

/**
 * Determine how a player would fit into a team's rotation for their best sport
 *
 * - starter: Better than team average (would crack starting lineup)
 * - rotation: Between median and average (solid rotation piece)
 * - depth: Below median but provides backup value
 * - no-fit: Too far below team level to contribute
 */
export function determineRotationFit(
  playerRating: number,
  teamStrength: TeamSportStrength,
  personality: AIPersonality
): RotationFit {
  const { average, median } = teamStrength;

  // If team has no players, any player is a starter
  if (teamStrength.playerCount === 0) {
    return 'starter';
  }

  // Get personality factors (risk tolerance affects depth threshold)
  const riskTolerance = getTraitValue(personality, 'risk_tolerance');

  // Above average = starter material
  if (playerRating >= average) {
    return 'starter';
  }

  // Above median but below average = rotation piece
  if (playerRating >= median) {
    return 'rotation';
  }

  // Below median - depth or no-fit depending on how far below
  // Risk-tolerant teams might take on more depth players
  const depthThreshold = median - 10 - (riskTolerance * 5); // Risk-tolerant teams accept weaker depth

  if (playerRating >= depthThreshold) {
    return 'depth';
  }

  return 'no-fit';
}

/**
 * Calculate how much AI values a player based on their rotation fit
 * Returns a multiplier to apply to market value
 *
 * - starter: 1.0 - 1.3x (willing to pay market or above)
 * - rotation: 0.8 - 1.0x (fair value)
 * - depth: 0.6 - 0.8x (discount expected)
 */
export function calculateRotationValueMultiplier(
  rotationFit: RotationFit,
  personality: AIPersonality
): number {
  const spending = getTraitValue(personality, 'spending_aggression');

  switch (rotationFit) {
    case 'starter':
      // Aggressive spenders pay up to 1.3x for starters
      return 1.0 + (spending * 0.3);
    case 'rotation':
      // 0.8 to 1.0x for rotation pieces
      return 0.8 + (spending * 0.2);
    case 'depth':
      // 0.6 to 0.8x for depth
      return 0.6 + (spending * 0.2);
    case 'no-fit':
      return 0;
  }
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
  const { personality, budget, roster } = context;
  const config = personalityToConfig(personality);
  const thresholds = getDecisionThresholds(config);

  // Check roster space
  if (roster.length >= MAX_ROSTER_SIZE) {
    return null;
  }

  // Check budget (can we afford 2 years of salary?)
  // NOTE: `budget` is ALREADY the available budget, don't subtract salaryCommitment again
  const affordableYearlySalary = budget * 0.3; // Max 30% of available for one player
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
  overallRating: number;          // Legacy: single overall rating
  sportRatings: SportRatings;     // Sport-specific ratings (basketball, baseball, soccer)
  age: number;
  marketValue: number;
  askingPrice?: number;           // Asking price if transfer-listed (seller's desired price)
  salaryExpectation: number;      // Player's expected annual salary
  contractYearsRemaining?: number; // Years left on current contract
  releaseClause?: number;         // Optional release clause
  bidBlockedUntilWeek?: number;   // User can block bids for 4 weeks
  isOnTransferList?: boolean;     // Player is listed for transfer (motivated seller)
}

/**
 * Determine if AI should make a transfer bid
 *
 * Evaluation flow:
 * 1. Get player's best sport rating
 * 2. Compare to team's roster for that sport (avg/median/max)
 * 3. Determine rotation fit (starter/rotation/depth/no-fit)
 * 4. If no fit → skip
 * 5. Check salary affordability
 * 6. If can't afford salary → skip
 * 7. Calculate bid based on rotation value, market value, asking price, personality
 * 8. Validate transfer fee is affordable
 * 9. Submit bid
 */
export function shouldMakeTransferBid(
  target: TransferTargetInfo,
  _needs: TeamNeeds, // Kept for API compatibility, evaluation is now sport-based
  context: AIDecisionContext,
  teamStrengthCache?: TeamSportStrengthCache
): TransferBid | null {
  const { personality, budget, roster } = context;

  // Debug logging for user's transfer-listed players
  const isUserPlayer = target.teamId === 'user';
  const logPrefix = isUserPlayer ? `[AI Bid Debug - ${context.teamName}]` : null;

  // =========================================================================
  // STEP 0: Pre-checks (blocked bids, roster space)
  // =========================================================================

  if (target.bidBlockedUntilWeek && context.week < target.bidBlockedUntilWeek) {
    if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: bid blocked until week ${target.bidBlockedUntilWeek}`);
    return null;
  }

  if (roster.length >= MAX_ROSTER_SIZE) {
    if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: roster full (${roster.length}/${MAX_ROSTER_SIZE})`);
    return null;
  }

  // =========================================================================
  // STEP 1: Identify player's best sport and get AI's perceived rating
  // =========================================================================

  const { basketball, baseball, soccer } = target.sportRatings;
  let bestSport: SportType;
  let bestRating: number;

  if (basketball >= baseball && basketball >= soccer) {
    bestSport = 'basketball';
    bestRating = basketball;
  } else if (baseball >= soccer) {
    bestSport = 'baseball';
    bestRating = baseball;
  } else {
    bestSport = 'soccer';
    bestRating = soccer;
  }

  // Apply AI perception variance (±8 points based on team+player hash)
  const perceivedRating = getPerceivedRating(bestRating, target.id, context.teamId);

  // =========================================================================
  // STEP 2: Compare to team's strength in that sport
  // =========================================================================

  // Use cached team strengths if provided (much faster), otherwise calculate
  const teamStrength = teamStrengthCache
    ? teamStrengthCache[bestSport]
    : calculateTeamSportStrength(roster, bestSport);

  // =========================================================================
  // STEP 3: Determine rotation fit
  // =========================================================================

  const rotationFit = determineRotationFit(perceivedRating, teamStrength, personality);

  // =========================================================================
  // STEP 4: If no fit, skip (unless transfer-listed and we have room for depth)
  // =========================================================================

  if (rotationFit === 'no-fit') {
    // Transfer-listed players at a discount might still be worth it for depth
    // Be VERY lenient: accept if within 35 points of median AND roster has room
    // This allows lower division teams to buy bargain players from higher divisions
    if (target.isOnTransferList && roster.length < MAX_ROSTER_SIZE) {
      // Check if they're at least within 35 points of team median
      // This allows a div 8 team (median ~30) to consider a div 5 player (rating ~55)
      if (perceivedRating < teamStrength.median - 35) {
        if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: no rotation fit, perceived ${perceivedRating.toFixed(1)} < median ${teamStrength.median.toFixed(1)} - 35`);
        return null;
      }
      if (logPrefix) console.log(`${logPrefix} ${target.name}: no-fit but accepting for depth (perceived ${perceivedRating.toFixed(1)}, median ${teamStrength.median.toFixed(1)})`);
      // Continue with evaluation as 'depth' fit
    } else {
      if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: no rotation fit (perceived ${perceivedRating.toFixed(1)} vs team median ${teamStrength.median.toFixed(1)})`);
      return null;
    }
  }

  // =========================================================================
  // STEP 5: Check salary affordability
  // =========================================================================

  // NOTE: `budget` from context is ALREADY the available budget (total - salaryCommitment)
  // Do NOT subtract salaryCommitment again - that was the bug causing negative budgets!
  const availableBudget = budget;
  // Transfer-listed players:
  // - AI willing to spend up to 50% of budget (motivated to buy deals)
  // - Player is ALSO more desperate (willing to take pay cut)
  // Non-listed players: more conservative at 25%
  const salaryBudgetRatio = target.isOnTransferList ? 0.50 : 0.25;
  const maxAffordableSalary = availableBudget * salaryBudgetRatio;

  // Transfer-listed players are motivated to move - they accept 70% of their expectation
  const effectiveSalaryExpectation = target.isOnTransferList
    ? target.salaryExpectation * 0.70
    : target.salaryExpectation;

  if (effectiveSalaryExpectation > maxAffordableSalary) {
    if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: salary ${effectiveSalaryExpectation.toLocaleString()} > max affordable ${maxAffordableSalary.toLocaleString()} (budget: ${availableBudget.toLocaleString()})`);
    return null;
  }

  // =========================================================================
  // STEP 6: Calculate how much AI values this player
  // =========================================================================

  const actualFit = rotationFit === 'no-fit' ? 'depth' : rotationFit;
  const rotationMultiplier = calculateRotationValueMultiplier(actualFit, personality);
  const spendingMultiplier = getSpendingMultiplier(personality);

  // Base value: market value adjusted by rotation fit
  const perceivedValue = Math.round(target.marketValue * rotationMultiplier);

  // Age adjustment: younger players worth more, older worth less
  const agingThreshold = getAgingThreshold(personality);
  let ageMultiplier = 1.0;
  if (target.age < 25) {
    ageMultiplier = 1.1; // 10% premium for young players
  } else if (target.age >= agingThreshold) {
    ageMultiplier = 0.8; // 20% discount for aging players
  } else if (target.age >= agingThreshold - 2) {
    ageMultiplier = 0.9; // 10% discount for players approaching decline
  }

  // Contract length adjustment: longer contracts = more expensive
  const contractMultiplier = target.contractYearsRemaining
    ? 0.9 + (Math.min(target.contractYearsRemaining, 4) * 0.05) // 0.95x for 1yr, 1.1x for 4yr+
    : 1.0;

  // Final calculated value
  const calculatedValue = Math.round(perceivedValue * ageMultiplier * contractMultiplier);

  // =========================================================================
  // STEP 7: Determine bid based on calculated value vs asking price
  // =========================================================================

  let bidAmount: number;
  let maxBid: number;
  let bidStrategy: string;

  if (target.isOnTransferList && target.askingPrice) {
    // SANITY CHECK: If asking price is way above market value, skip entirely
    // No matter how good we think the player is, paying 3x+ market value is unreasonable
    const marketRatio = target.askingPrice / Math.max(target.marketValue, 1000);
    if (marketRatio > 3.0) {
      if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: asking price ${target.askingPrice.toLocaleString()} is ${marketRatio.toFixed(1)}x market value ${target.marketValue.toLocaleString()}`);
      return null; // Asking price is unrealistic - seller is dreaming
    }

    // Transfer-listed player with asking price
    const askingRatio = target.askingPrice / calculatedValue;

    if (askingRatio <= 0.9) {
      // Asking price is a bargain! Bid the asking price directly
      // But cap at 2x market value to avoid overpaying due to perception errors
      bidAmount = Math.min(target.askingPrice, target.marketValue * 2);
      maxBid = Math.round(bidAmount * 1.1);
      bidStrategy = 'bargain-asking-price';
    } else if (askingRatio <= 1.2) {
      // Asking price is reasonable - bid calculated value, willing to go to asking
      bidAmount = Math.round(calculatedValue * (0.85 + Math.random() * 0.1)); // 85-95% of our value
      maxBid = Math.round(Math.min(target.askingPrice, calculatedValue * 1.15));
      bidStrategy = 'reasonable-negotiation';
    } else if (askingRatio <= 1.5) {
      // Asking price is high but might be negotiable
      bidAmount = Math.round(calculatedValue * 0.8); // Lowball to start
      maxBid = calculatedValue; // Won't pay more than our calculated value
      bidStrategy = 'high-asking-lowball';
    } else {
      // Asking price is way too high - skip unless desperate
      if (actualFit === 'starter' && roster.length < 30) {
        bidAmount = Math.round(calculatedValue * 0.7);
        maxBid = Math.round(calculatedValue * 0.9);
        bidStrategy = 'overpriced-lowball';
      } else {
        if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: asking ratio ${askingRatio.toFixed(2)} too high (asking ${target.askingPrice?.toLocaleString()} vs calculated value ${calculatedValue.toLocaleString()}, fit=${actualFit})`);
        return null; // Not worth pursuing at this price
      }
    }
  } else {
    // Non-listed player or no asking price - bid based on market value and fit
    bidAmount = Math.round(calculatedValue * spendingMultiplier * (0.9 + Math.random() * 0.1));
    maxBid = Math.round(calculatedValue * spendingMultiplier * 1.3);
    bidStrategy = 'standard-pursuit';
  }

  // =========================================================================
  // STEP 8: Release clause handling
  // =========================================================================

  if (target.releaseClause && target.releaseClause > 0) {
    // If asking price > release clause, just bid at release clause
    if (target.askingPrice && target.askingPrice > target.releaseClause) {
      bidAmount = target.releaseClause;
      maxBid = target.releaseClause;
      bidStrategy = 'release-clause-trigger';
    } else {
      // Cap bids at release clause (no point going higher)
      maxBid = Math.min(maxBid, target.releaseClause);
      bidAmount = Math.min(bidAmount, target.releaseClause);
    }
  }

  // =========================================================================
  // STEP 9: Final affordability check for transfer fee
  // =========================================================================

  const maxTransferBudget = budget * 0.5; // Max 50% of total budget on one transfer

  if (bidAmount > maxTransferBudget) {
    // Try to lower bid if possible
    if (maxTransferBudget >= target.marketValue * 0.6) {
      bidAmount = Math.round(maxTransferBudget * 0.9);
      maxBid = Math.round(maxTransferBudget);
    } else {
      if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: can't afford transfer fee (bid ${bidAmount.toLocaleString()} > max ${maxTransferBudget.toLocaleString()}, market ${target.marketValue.toLocaleString()})`);
      return null; // Can't afford this player
    }
  }

  // Ensure max bid doesn't exceed what we can spend
  maxBid = Math.min(maxBid, maxTransferBudget);

  // Minimum viable bid check
  // Transfer-listed players can receive lower bids (motivated seller)
  // EXCEPTION: If player is listed with an asking price and we meet it, skip this check
  // (the seller has already said they'll accept that price)
  const minBidRatio = target.isOnTransferList ? 0.35 : 0.5;
  const meetsAskingPrice = target.isOnTransferList && target.askingPrice && bidAmount >= target.askingPrice;

  if (!meetsAskingPrice && bidAmount < target.marketValue * minBidRatio) {
    if (logPrefix) console.log(`${logPrefix} SKIP ${target.name}: bid ${bidAmount.toLocaleString()} < min ${(target.marketValue * minBidRatio).toLocaleString()} (${minBidRatio * 100}% of market)`);
    return null; // Bid would be insultingly low
  }

  // =========================================================================
  // STEP 10: Determine urgency and build response
  // =========================================================================

  let urgency: 'reluctant' | 'neutral' | 'desperate';
  if (actualFit === 'starter' && teamStrength.playerCount < 15) {
    urgency = 'desperate';
  } else if (actualFit === 'starter') {
    urgency = 'neutral';
  } else if (actualFit === 'rotation') {
    urgency = 'neutral';
  } else {
    urgency = 'reluctant';
  }

  // Build reason string
  const reasonParts: string[] = [];
  reasonParts.push(`${actualFit} for ${bestSport}`);
  reasonParts.push(`${perceivedRating} perceived rating`);
  reasonParts.push(`${bidStrategy}`);
  if (target.isOnTransferList) {
    reasonParts.push('transfer-listed');
  }

  if (logPrefix) console.log(`${logPrefix} BID on ${target.name}: $${bidAmount.toLocaleString()} (max $${maxBid.toLocaleString()}) - ${reasonParts.join(', ')}`);

  return {
    playerId: target.id,
    playerName: target.name,
    targetTeamId: target.teamId,
    bidAmount,
    maxBid,
    urgency,
    reason: reasonParts.join(', '),
    isOnTransferList: target.isOnTransferList ?? false,
  };
}

/**
 * Evaluate an incoming transfer offer
 */
export function evaluateIncomingOffer(
  offer: { offerId: string; playerId: string; offerAmount: number },
  player: Player,
  marketValue: number,
  context: AIDecisionContext,
  askingPrice?: number  // If player is transfer-listed, this is their asking price
): OfferResponse {
  const { personality, roster } = context;

  // Debug: Log offer evaluation
  console.log(`[Offer Eval] ${context.teamName} evaluating offer for ${player.name}:`);
  console.log(`  - Offer: $${offer.offerAmount.toLocaleString()}`);
  console.log(`  - Market Value: $${marketValue.toLocaleString()}`);
  console.log(`  - Asking Price: ${askingPrice !== undefined ? `$${askingPrice.toLocaleString()}` : 'NOT SET (player not transfer-listed)'}`);

  // CRITICAL: If player is transfer-listed with an asking price, and offer meets it, AUTO-ACCEPT
  // The whole point of listing a player is to sell at that price!
  if (askingPrice !== undefined && offer.offerAmount >= askingPrice) {
    console.log(`  => AUTO-ACCEPT: Offer meets asking price`);
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'accept',
      reason: `Offer of $${offer.offerAmount.toLocaleString()} meets asking price of $${askingPrice.toLocaleString()}`,
    };
  }

  // Check if this is a star player
  const sortedByRating = [...roster].sort((a, b) =>
    calculateOverallRating(b) - calculateOverallRating(a)
  );
  const playerRank = sortedByRating.findIndex(p => p.id === player.id) + 1;
  const isStarPlayer = playerRank <= 3;

  // Calculate minimum acceptable offer using selling multiplier
  // Conservative = sells easier (lower multiplier), Aggressive = holds (higher multiplier)
  const sellingMultiplier = getSellingMultiplier(personality, isStarPlayer);
  let minAcceptable = Math.round(marketValue * sellingMultiplier);

  // If player is transfer-listed, they're motivated sellers - use asking price as minimum if lower
  if (askingPrice !== undefined) {
    minAcceptable = Math.min(minAcceptable, askingPrice);
  }

  // Is this a lowball offer?
  const offerRatio = offer.offerAmount / marketValue;

  // For transfer-listed players, be more lenient with "lowball" threshold
  const lowballThreshold = askingPrice !== undefined ? 0.5 : 0.75;

  if (offerRatio < lowballThreshold) {
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

  // Counter if within 30% of acceptable (40% for listed players - more willing to negotiate)
  const counterThreshold = askingPrice !== undefined ? 0.6 : 0.7;
  if (offer.offerAmount >= minAcceptable * counterThreshold) {
    // For listed players, counter closer to asking price; for others, ask 10% above minimum
    const counterAmount = askingPrice !== undefined
      ? askingPrice  // Just ask for the asking price
      : Math.round(minAcceptable * 1.1);
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
 * Counter-offer response from AI buyer
 */
export interface BuyerCounterResponse {
  offerId: string;
  playerId: string;
  decision: 'accept' | 'counter' | 'walk_away';
  counterAmount?: number;
  reason: string;
}

/**
 * Evaluate a counter-offer from the seller (user) when AI is the buyer
 *
 * AI buyer personality affects:
 * - spending_aggression: How much above initial bid they're willing to go
 * - risk_tolerance: Whether they'll counter or walk away when price is high
 *
 * Returns accept, counter, or walk_away based on:
 * - How the counter compares to their maxBid
 * - Their personality (aggressive spenders are more flexible)
 * - The negotiation round (AI gets less patient over time)
 */
export function evaluateBuyerCounterResponse(
  offer: {
    offerId: string;
    playerId: string;
    counterAmount: number;       // What the seller is asking
    originalBid: number;         // AI's original bid
    maxBid: number;              // AI's maximum they were willing to pay
    marketValue: number;         // Player's market value
    negotiationRound: number;    // How many back-and-forths (1 = first counter)
    isTransferListed: boolean;   // Was player on transfer list?
  },
  personality: AIPersonality
): BuyerCounterResponse {
  const { counterAmount, originalBid, maxBid, marketValue, negotiationRound, isTransferListed } = offer;

  // ==========================================================================
  // SANITY CHECK: Walk away immediately from unreasonable counters
  // ==========================================================================

  // If counter is more than 2x our original bid, they're not serious
  if (counterAmount > originalBid * 2) {
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'walk_away',
      reason: `Counter of $${counterAmount.toLocaleString()} is unreasonable (>2x our bid of $${originalBid.toLocaleString()})`,
    };
  }

  // If counter is more than 3x market value, walk away
  if (counterAmount > marketValue * 3) {
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'walk_away',
      reason: `Counter of $${counterAmount.toLocaleString()} is way above market value of $${marketValue.toLocaleString()}`,
    };
  }

  // Get personality traits (0-1 scale)
  const spendingAggression = personality.traits.spending_aggression / 100;
  const riskTolerance = personality.traits.risk_tolerance / 100;

  // Counter as percentage of market value
  const counterRatio = counterAmount / marketValue;

  // AI patience decreases with each round
  // Round 1: full patience, Round 2: 80%, Round 3: 60%, etc.
  const patienceMultiplier = Math.max(0.4, 1 - (negotiationRound - 1) * 0.2);

  // Aggressive spenders have higher effective maxBid
  // Conservative ones have lower effective maxBid
  const effectiveMaxBid = maxBid * (0.8 + spendingAggression * 0.4); // 0.8x to 1.2x

  // ==========================================================================
  // DECISION LOGIC
  // ==========================================================================

  // ACCEPT: Counter is at or below effective max bid
  if (counterAmount <= effectiveMaxBid) {
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'accept',
      reason: `Counter of $${counterAmount.toLocaleString()} is acceptable (within budget)`,
    };
  }

  // For transfer-listed players, AI is less willing to overpay
  // (They expected a discount, so they're less patient)
  if (isTransferListed && counterRatio > 1.0) {
    // Player is listed but asking above market value
    const walkAwayChance = 0.4 + (counterRatio - 1.0) * 2; // Higher counter = more likely to walk

    // Risk-tolerant AIs might still try to counter
    if (Math.random() > walkAwayChance * (1 - riskTolerance * 0.5)) {
      // Make one more counter at market value
      const newCounter = Math.round(marketValue * (0.95 + spendingAggression * 0.1));
      return {
        offerId: offer.offerId,
        playerId: offer.playerId,
        decision: 'counter',
        counterAmount: Math.min(newCounter, Math.round(effectiveMaxBid)),
        reason: `Listed player asking above market - countering at $${newCounter.toLocaleString()}`,
      };
    } else {
      return {
        offerId: offer.offerId,
        playerId: offer.playerId,
        decision: 'walk_away',
        reason: `Listed player asking ${(counterRatio * 100).toFixed(0)}% of market value - walking away`,
      };
    }
  }

  // COUNTER: If we still have room to negotiate
  if (negotiationRound < 3 * patienceMultiplier) {
    // Calculate our counter offer
    // Start from our original bid and move toward their counter based on personality
    const moveAmount = (counterAmount - originalBid) * (0.3 + spendingAggression * 0.4);
    let newOffer = Math.round(originalBid + moveAmount);

    // Don't exceed our effective max
    newOffer = Math.min(newOffer, Math.round(effectiveMaxBid));

    // Don't go backwards
    newOffer = Math.max(newOffer, originalBid);

    // If our new offer is basically the same as our original (< 5% increase), walk away
    if (newOffer < originalBid * 1.05) {
      return {
        offerId: offer.offerId,
        playerId: offer.playerId,
        decision: 'walk_away',
        reason: `Cannot meet seller's price - too far above our valuation`,
      };
    }

    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'counter',
      counterAmount: newOffer,
      reason: `Countering with $${newOffer.toLocaleString()} (round ${negotiationRound + 1})`,
    };
  }

  // WALK AWAY: Out of patience or counter is way too high
  // Risk-tolerant AIs have a small chance to make one final "take it or leave it" offer
  if (riskTolerance > 0.7 && Math.random() < riskTolerance * 0.3) {
    const finalOffer = Math.round(effectiveMaxBid);
    return {
      offerId: offer.offerId,
      playerId: offer.playerId,
      decision: 'counter',
      counterAmount: finalOffer,
      reason: `Final offer: $${finalOffer.toLocaleString()} - take it or leave it`,
    };
  }

  return {
    offerId: offer.offerId,
    playerId: offer.playerId,
    decision: 'walk_away',
    reason: `Negotiations stalled after ${negotiationRound} rounds - walking away`,
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
 * Input transfer target with required sport-specific data
 */
export interface TransferTargetInput {
  id: string;
  name: string;
  teamId: string;
  position: string;
  overallRating: number;
  sportRatings: SportRatings;
  age: number;
  marketValue: number;
  salaryExpectation: number;
  askingPrice?: number;
  contractYearsRemaining?: number;
  releaseClause?: number;
  bidBlockedUntilWeek?: number;
  isOnTransferList?: boolean;
}

/**
 * Process all AI decisions for a team for this week
 */
export function processAIWeek(
  context: AIDecisionContext,
  availableFreeAgents: Array<{ id: string; name: string; position: string; overallRating: number; age: number; annualSalary: number }>,
  availableTransferTargets: TransferTargetInput[],
  incomingOffers: Array<{ offerId: string; playerId: string; offerAmount: number }>,
  getPlayerMarketValue: (playerId: string) => number,
  teamTransferListAskingPrices?: Record<string, number>  // This team's asking prices for their listed players
): AIWeeklyActions {
  const needs = analyzeTeamNeeds(context.roster, context.personality);

  const actions: AIWeeklyActions = {
    teamId: context.teamId,
    teamName: context.teamName,
    signings: [],
    transferBids: [],
    offerResponses: [],
    releases: [],
    transferListings: [],
  };

  // Always respond to incoming offers (can't ignore them)
  console.log(`[processAIWeek] ${context.teamName} (${context.teamId}) processing ${incomingOffers.length} incoming offers`);
  console.log(`[processAIWeek] Team roster has ${context.roster.length} players`);
  for (const offer of incomingOffers) {
    const player = context.roster.find(p => p.id === offer.playerId);
    console.log(`[processAIWeek] Looking for player ${offer.playerId} in roster: ${player ? `FOUND (${player.name})` : 'NOT FOUND'}`);
    if (player) {
      const marketValue = getPlayerMarketValue(player.id);
      // Get asking price if player is on this team's transfer list
      const askingPrice = teamTransferListAskingPrices?.[player.id];
      console.log(`[processAIWeek] Asking price for ${player.name}: ${askingPrice !== undefined ? `$${askingPrice}` : 'NOT IN MAP'}`);
      const response = evaluateIncomingOffer(offer, player, marketValue, context, askingPrice);
      actions.offerResponses.push(response);
    } else {
      console.log(`[processAIWeek] WARNING: Player ${offer.playerId} not found in ${context.teamName}'s roster! Offer ignored.`);
    }
  }

  // Check if team will be proactively active this week
  const hasCriticalNeed = needs.positionGaps.some(g => g.urgency === 'critical');
  const hasTransferListedTargets = availableTransferTargets.some(t => t.isOnTransferList);
  const isActiveThisWeek = willTeamActThisWeek(
    context.teamId,
    context.week,
    hasCriticalNeed,
    context.personality,
    hasTransferListedTargets
  );

  // If not active this week, only respond to offers (no proactive moves)
  if (!isActiveThisWeek) {
    return actions;
  }

  // Pre-calculate team strength for all sports ONCE (major performance optimization)
  // This avoids recalculating for every single transfer target
  const teamStrengthCache = calculateAllTeamSportStrengths(context.roster);

  // Convert free agents to perceived ratings (AI doesn't have perfect knowledge)
  const perceivedFreeAgents = availableFreeAgents.map(agent => ({
    ...agent,
    overallRating: getPerceivedRating(agent.overallRating, agent.id, context.teamId),
  }));

  // Convert transfer targets to perceived ratings with sport-specific data
  const perceivedTransferTargets: TransferTargetInfo[] = availableTransferTargets.map(target => {
    const perceivedOverall = getPerceivedRating(target.overallRating, target.id, context.teamId);
    const ratingRatio = perceivedOverall / Math.max(target.overallRating, 1);

    // Apply perception to sport-specific ratings too
    const perceivedSportRatings: SportRatings = {
      basketball: Math.round(target.sportRatings.basketball * ratingRatio),
      baseball: Math.round(target.sportRatings.baseball * ratingRatio),
      soccer: Math.round(target.sportRatings.soccer * ratingRatio),
    };

    return {
      id: target.id,
      name: target.name,
      teamId: target.teamId,
      position: target.position,
      overallRating: perceivedOverall,
      sportRatings: perceivedSportRatings,
      age: target.age,
      marketValue: Math.round(target.marketValue * ratingRatio),
      salaryExpectation: target.salaryExpectation,
      askingPrice: target.askingPrice,
      contractYearsRemaining: target.contractYearsRemaining,
      releaseClause: target.releaseClause,
      bidBlockedUntilWeek: target.bidBlockedUntilWeek,
      isOnTransferList: target.isOnTransferList,
    };
  });

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

  // Consider transfer bids
  // Transfer-listed players get special consideration (motivated sellers, potential bargains)
  // Non-listed players only considered if no free agent options
  const transferListedTargets = perceivedTransferTargets.filter(t => t.isOnTransferList);
  const nonListedTargets = perceivedTransferTargets.filter(t => !t.isOnTransferList);

  const transferIntents: TransferBid[] = [];

  // ALWAYS evaluate transfer-listed players - these are active opportunities
  // Even if we signed a free agent, a good deal on a listed player is worth pursuing
  for (const target of transferListedTargets) {
    const bid = shouldMakeTransferBid(target, needs, context, teamStrengthCache);
    if (bid) {
      transferIntents.push(bid);
    }
  }

  // Only consider non-listed players if no signing this week and conditions favor transfers
  if (actions.signings.length === 0) {
    const criticalNeeds = needs.positionGaps.filter(g => g.urgency === 'critical');
    const hasFreeAgentForCriticalNeed = criticalNeeds.some(need => {
      return perceivedFreeAgents.some(agent =>
        agent.position === need.position &&
        agent.overallRating >= need.targetRating - 10
      );
    });

    const shouldConsiderNonListed =
      !hasFreeAgentForCriticalNeed ||
      (criticalNeeds.length === 0 && getTraitValue(context.personality, 'spending_aggression') > 0.7);

    if (shouldConsiderNonListed) {
      for (const target of nonListedTargets) {
        const bid = shouldMakeTransferBid(target, needs, context, teamStrengthCache);
        if (bid) {
          transferIntents.push(bid);
        }
      }
    }
  }

  // Sort and take best bids
  // Priority: 1) Transfer-listed players (active sellers), 2) Urgency within each group
  if (transferIntents.length > 0) {
    // Separate bids on transfer-listed vs non-listed players
    const listedBids = transferIntents.filter(b => b.isOnTransferList);
    const nonListedBids = transferIntents.filter(b => !b.isOnTransferList);

    // Sort each group by urgency
    const urgencyOrder = { desperate: 0, neutral: 1, reluctant: 2 };
    const sortByUrgency = (a: TransferBid, b: TransferBid) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    listedBids.sort(sortByUrgency);
    nonListedBids.sort(sortByUrgency);

    // Prioritize transfer-listed players (active sellers should get bids)
    // Take up to MAX_TRANSFER_BIDS_PER_WEEK, preferring listed players
    const selectedBids: TransferBid[] = [];

    // First, take bids on listed players
    for (const bid of listedBids) {
      if (selectedBids.length >= MAX_TRANSFER_BIDS_PER_WEEK) break;
      selectedBids.push(bid);
    }

    // Then fill remaining slots with non-listed players
    for (const bid of nonListedBids) {
      if (selectedBids.length >= MAX_TRANSFER_BIDS_PER_WEEK) break;
      selectedBids.push(bid);
    }

    // Debug: log which bids were selected vs dropped
    if (transferIntents.length > selectedBids.length) {
      const droppedBids = transferIntents.filter(b => !selectedBids.includes(b));
      for (const dropped of droppedBids) {
        if (dropped.targetTeamId === 'user') {
          console.log(`[AI Bid] ${context.teamName} dropped bid on ${dropped.playerName} (urgency: ${dropped.urgency}, listed: ${dropped.isOnTransferList}) - ${selectedBids.length} bids already selected`);
        }
      }
    }

    actions.transferBids = selectedBids;
  }

  // Consider transfer listing players (max 1 per week, only if transfer window is open)
  if (context.transferWindowOpen) {
    const listingCandidates = evaluateTransferListCandidates(context, needs, getPlayerMarketValue);
    if (listingCandidates.length > 0) {
      // Pick the best candidate (highest priority reason)
      actions.transferListings = listingCandidates.slice(0, 1);
    }
  }

  return actions;
}

/**
 * Evaluate which players should be transfer listed
 * AI teams consider listing players when:
 * 1. Excess depth at a position (3+ players, lowest rated gets listed)
 * 2. Aging players past peak (age > 31 with declining value)
 * 3. Overpaid players (salary much higher than market value)
 * 4. Budget pressure (need to free up funds)
 */
function evaluateTransferListCandidates(
  context: AIDecisionContext,
  needs: TeamNeeds,
  getPlayerMarketValue: (playerId: string) => number
): TransferListing[] {
  const { roster, personality, budget, salaryCommitment } = context;
  const candidates: TransferListing[] = [];

  // Calculate team's average overall
  const avgOverall = needs.overallStrength;

  // Track players by position to find excess depth
  const playersByPosition = new Map<string, Player[]>();
  for (const player of roster) {
    const pos = player.position;
    if (!playersByPosition.has(pos)) {
      playersByPosition.set(pos, []);
    }
    playersByPosition.get(pos)!.push(player);
  }

  // Budget pressure check - if salary commitment is > 80% of budget, more likely to sell
  const budgetPressure = salaryCommitment / Math.max(budget, 1);
  const underBudgetPressure = budgetPressure > 0.8;

  for (const player of roster) {
    // Skip players without contracts (shouldn't happen, but safety check)
    if (!player.contract) continue;

    const overallRating = calculateOverallRating(player);
    const marketValue = getPlayerMarketValue(player.id);
    const salary = player.contract.salary;

    // Skip key players (top 50% of roster by overall)
    if (overallRating >= avgOverall) continue;

    // Check for excess depth (3+ players at same position)
    const positionPlayers = playersByPosition.get(player.position) || [];
    if (positionPlayers.length >= 3) {
      // Sort by overall to find lowest
      const sortedByRating = [...positionPlayers].sort(
        (a, b) => calculateOverallRating(a) - calculateOverallRating(b)
      );
      const lowestRated = sortedByRating[0];

      if (lowestRated && lowestRated.id === player.id) {
        candidates.push({
          playerId: player.id,
          playerName: player.name,
          askingPrice: Math.round(marketValue * 1.1), // Ask slightly above market
          reason: `Excess depth at ${player.position}`,
        });
        continue;
      }
    }

    // Check for aging players (31+ and in bottom half of roster)
    if (player.age >= 31 && overallRating < avgOverall - 3) {
      candidates.push({
        playerId: player.id,
        playerName: player.name,
        askingPrice: Math.round(marketValue * 0.95), // Slightly below market for aging
        reason: `Aging player (${player.age}) with declining value`,
      });
      continue;
    }

    // Check for overpaid players (salary > 150% of expected for their rating)
    const expectedSalary = overallRating * 40000; // Rough estimate: 40k per overall point
    if (salary > expectedSalary * 1.5 && underBudgetPressure) {
      candidates.push({
        playerId: player.id,
        playerName: player.name,
        askingPrice: Math.round(marketValue * 1.0), // At market value
        reason: `Overpaid relative to performance ($${(salary / 1000000).toFixed(1)}M)`,
      });
      continue;
    }

    // Budget pressure: list bottom performers if we need funds
    if (underBudgetPressure && overallRating < avgOverall - 5) {
      // Only aggressive spenders resist selling under budget pressure
      const spendingAggression = getTraitValue(personality, 'spending_aggression');
      if (spendingAggression < 0.7) {
        candidates.push({
          playerId: player.id,
          playerName: player.name,
          askingPrice: Math.round(marketValue * 0.9), // Discount for quick sale
          reason: 'Budget pressure - need to free up funds',
        });
      }
    }
  }

  // Sort by asking price descending (prioritize selling higher value players)
  candidates.sort((a, b) => b.askingPrice - a.askingPrice);

  return candidates;
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
