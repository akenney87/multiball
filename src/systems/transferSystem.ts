/**
 * Transfer System
 *
 * Manages player transfers between teams.
 * - Transfer fee calculation
 * - Seller asking price (transfer multiplier)
 * - Buyer urgency (urgency multiplier)
 * - AI acceptance logic
 * - Transfer offer management
 *
 * Design Philosophy:
 * - Market value from Contract System
 * - Seller sets asking price (1.5x to 3.0x market value)
 * - Buyer urgency affects final offer (0.8x to 1.2x)
 * - AI teams have personality-based acceptance logic
 * - Simple negotiation flow
 */

import { calculatePlayerValuation } from './contractSystem';

/**
 * Buyer urgency level
 */
export type BuyerUrgency = 'reluctant' | 'neutral' | 'desperate';

/**
 * Team personality type (affects AI behavior)
 */
export type TeamPersonality = 'conservative' | 'balanced' | 'aggressive';

/**
 * Transfer offer data
 */
export interface TransferOffer {
  playerId: string;
  playerName: string;
  sellerTeamId: string;
  buyerTeamId: string;
  marketValue: number;                // Player's market value
  transferMultiplier: number;         // Seller's asking price multiplier (1.5x-3.0x)
  urgencyMultiplier: number;          // Buyer's urgency multiplier (0.8x-1.2x)
  finalOffer: number;                 // Calculated offer amount
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdWeek: number;                // Week offer was created
}

/**
 * AI team transfer settings
 */
export interface AITransferSettings {
  teamId: string;
  personality: TeamPersonality;
  leaguePosition: number;             // 1 = first place, higher = worse
  totalTeams: number;                 // Total teams in league
  contractExpiringWithinYears: number; // Years until contract expires
}

/**
 * Transfer acceptance evaluation result
 */
export interface TransferEvaluation {
  accepted: boolean;
  minAcceptableOffer: number;
  offerAmount: number;
  reason: string;
}

// Transfer multiplier constants
export const MIN_TRANSFER_MULTIPLIER = 1.5;     // Minimum asking price
export const MAX_TRANSFER_MULTIPLIER = 3.0;     // Maximum asking price
export const DEFAULT_TRANSFER_MULTIPLIER = 2.0; // Standard asking price

// Urgency multiplier constants
export const URGENCY_MULTIPLIERS = {
  reluctant: 0.8,   // 20% below asking price
  neutral: 1.0,     // Asking price
  desperate: 1.2,   // 20% above asking price
};

// Personality multiplier constants (affects AI acceptance threshold)
export const PERSONALITY_MULTIPLIERS = {
  conservative: 2.0,  // Demands 2.0x market value minimum
  balanced: 1.5,      // Demands 1.5x market value minimum
  aggressive: 0.8,    // Accepts 0.8x market value minimum
};

// League position adjustment
export const LEAGUE_POSITION_ADJUSTMENT = {
  topThird: 0.0,      // Top teams: no adjustment (full asking price)
  middleThird: -0.2,  // Middle teams: -20% (slightly desperate)
  bottomThird: -0.4,  // Bottom teams: -40% (very desperate)
};

// Contract expiry adjustment
export const CONTRACT_EXPIRY_ADJUSTMENT = {
  expiringSoon: -0.3,   // Expiring within 1 year: -30%
  normal: 0.0,          // 2+ years remaining: no adjustment
};

/**
 * Validates transfer multiplier
 *
 * @param multiplier - Transfer multiplier
 * @returns Clamped multiplier (1.5x-3.0x)
 */
export function validateTransferMultiplier(multiplier: number): number {
  return Math.max(MIN_TRANSFER_MULTIPLIER, Math.min(MAX_TRANSFER_MULTIPLIER, multiplier));
}

/**
 * Gets urgency multiplier from urgency level
 *
 * @param urgency - Buyer urgency level
 * @returns Urgency multiplier (0.8x-1.2x)
 */
export function getUrgencyMultiplier(urgency: BuyerUrgency): number {
  return URGENCY_MULTIPLIERS[urgency];
}

/**
 * Calculates transfer fee
 *
 * Formula: transferFee = marketValue × transferMultiplier × urgencyMultiplier
 *
 * @param marketValue - Player's market value
 * @param transferMultiplier - Seller's asking price multiplier
 * @param urgencyMultiplier - Buyer's urgency multiplier
 * @returns Final transfer fee
 */
export function calculateTransferFee(
  marketValue: number,
  transferMultiplier: number,
  urgencyMultiplier: number
): number {
  const validMultiplier = validateTransferMultiplier(transferMultiplier);
  return Math.round(marketValue * validMultiplier * urgencyMultiplier);
}

/**
 * Calculates minimum acceptable offer for AI team
 *
 * Considers:
 * - Team personality (conservative/balanced/aggressive)
 * - League position (desperate teams accept less)
 * - Contract situation (expiring soon = accept less)
 *
 * @param marketValue - Player's market value
 * @param settings - AI team settings
 * @returns Minimum acceptable offer
 */
export function calculateMinAcceptableOffer(
  marketValue: number,
  settings: AITransferSettings
): number {
  // Base multiplier from personality
  let multiplier = PERSONALITY_MULTIPLIERS[settings.personality];

  // Adjust for league position
  const positionRatio = settings.leaguePosition / settings.totalTeams;
  if (positionRatio <= 0.33) {
    // Top third: no adjustment
    multiplier += LEAGUE_POSITION_ADJUSTMENT.topThird;
  } else if (positionRatio <= 0.67) {
    // Middle third: slightly desperate
    multiplier += LEAGUE_POSITION_ADJUSTMENT.middleThird;
  } else {
    // Bottom third: very desperate
    multiplier += LEAGUE_POSITION_ADJUSTMENT.bottomThird;
  }

  // Adjust for contract expiry
  if (settings.contractExpiringWithinYears <= 1) {
    multiplier += CONTRACT_EXPIRY_ADJUSTMENT.expiringSoon;
  } else {
    multiplier += CONTRACT_EXPIRY_ADJUSTMENT.normal;
  }

  // Ensure minimum multiplier is at least 0.5x
  multiplier = Math.max(0.5, multiplier);

  return Math.round(marketValue * multiplier);
}

/**
 * Evaluates if AI team accepts a transfer offer
 *
 * @param offer - Transfer offer
 * @param settings - AI team settings
 * @returns Transfer evaluation result
 */
export function evaluateTransferOffer(
  offer: TransferOffer,
  settings: AITransferSettings
): TransferEvaluation {
  const minAcceptable = calculateMinAcceptableOffer(offer.marketValue, settings);
  const accepted = offer.finalOffer >= minAcceptable;

  let reason: string;
  if (accepted) {
    const percentAboveMin = ((offer.finalOffer - minAcceptable) / minAcceptable) * 100;
    reason = `Offer of $${offer.finalOffer.toLocaleString()} exceeds minimum of $${minAcceptable.toLocaleString()} (+${percentAboveMin.toFixed(0)}%)`;
  } else {
    const shortfall = minAcceptable - offer.finalOffer;
    reason = `Offer of $${offer.finalOffer.toLocaleString()} below minimum of $${minAcceptable.toLocaleString()} (-$${shortfall.toLocaleString()})`;
  }

  return {
    accepted,
    minAcceptableOffer: minAcceptable,
    offerAmount: offer.finalOffer,
    reason,
  };
}

/**
 * Creates a transfer offer
 *
 * @param playerId - Player ID
 * @param playerName - Player name
 * @param sellerTeamId - Selling team ID
 * @param buyerTeamId - Buying team ID
 * @param marketValue - Player's market value
 * @param transferMultiplier - Seller's asking price multiplier
 * @param urgency - Buyer's urgency level
 * @param currentWeek - Current game week
 * @returns Transfer offer
 */
export function createTransferOffer(
  playerId: string,
  playerName: string,
  sellerTeamId: string,
  buyerTeamId: string,
  marketValue: number,
  transferMultiplier: number,
  urgency: BuyerUrgency,
  currentWeek: number
): TransferOffer {
  const urgencyMultiplier = getUrgencyMultiplier(urgency);
  const finalOffer = calculateTransferFee(marketValue, transferMultiplier, urgencyMultiplier);

  return {
    playerId,
    playerName,
    sellerTeamId,
    buyerTeamId,
    marketValue,
    transferMultiplier: validateTransferMultiplier(transferMultiplier),
    urgencyMultiplier,
    finalOffer,
    status: 'pending',
    createdWeek: currentWeek,
  };
}

/**
 * Accepts a transfer offer
 *
 * @param offer - Transfer offer
 * @returns Updated offer with accepted status
 */
export function acceptTransferOffer(offer: TransferOffer): TransferOffer {
  return {
    ...offer,
    status: 'accepted',
  };
}

/**
 * Rejects a transfer offer
 *
 * @param offer - Transfer offer
 * @returns Updated offer with rejected status
 */
export function rejectTransferOffer(offer: TransferOffer): TransferOffer {
  return {
    ...offer,
    status: 'rejected',
  };
}

/**
 * Expires a transfer offer (e.g., after certain number of weeks)
 *
 * @param offer - Transfer offer
 * @returns Updated offer with expired status
 */
export function expireTransferOffer(offer: TransferOffer): TransferOffer {
  return {
    ...offer,
    status: 'expired',
  };
}

/**
 * Processes a transfer offer with AI decision
 *
 * @param offer - Transfer offer
 * @param settings - AI team settings
 * @returns Updated offer and evaluation result
 */
export function processTransferOffer(
  offer: TransferOffer,
  settings: AITransferSettings
): {
  updatedOffer: TransferOffer;
  evaluation: TransferEvaluation;
} {
  const evaluation = evaluateTransferOffer(offer, settings);
  const updatedOffer = evaluation.accepted
    ? acceptTransferOffer(offer)
    : rejectTransferOffer(offer);

  return {
    updatedOffer,
    evaluation,
  };
}

/**
 * Calculates suggested asking price for a player
 *
 * @param marketValue - Player's market value
 * @param sellerPersonality - Seller's team personality
 * @returns Suggested transfer multiplier
 */
export function suggestAskingPrice(
  _marketValue: number,
  sellerPersonality: TeamPersonality
): number {
  // Conservative teams ask for more
  // Aggressive teams ask for less
  switch (sellerPersonality) {
    case 'conservative':
      return 2.5; // 2.5x market value
    case 'balanced':
      return 2.0; // 2.0x market value
    case 'aggressive':
      return 1.5; // 1.5x market value
    default:
      return DEFAULT_TRANSFER_MULTIPLIER;
  }
}

/**
 * Calculates player market value for transfer
 *
 * Convenience function that wraps Contract System's valuation
 *
 * @param overallRating - Overall rating
 * @param age - Player age
 * @param averagePotential - Average potential
 * @param sportsAbove50 - Number of sports rated 50+
 * @returns Market value
 */
export function calculatePlayerMarketValue(
  overallRating: number,
  age: number,
  averagePotential: number,
  sportsAbove50: number
): number {
  const valuation = calculatePlayerValuation(overallRating, age, averagePotential, sportsAbove50);
  return valuation.marketValue;
}

/**
 * Filters transfer offers by status
 *
 * @param offers - List of transfer offers
 * @param status - Status filter
 * @returns Filtered offers
 */
export function filterOffersByStatus(
  offers: TransferOffer[],
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
): TransferOffer[] {
  return offers.filter(o => o.status === status);
}

/**
 * Sorts transfer offers by amount
 *
 * @param offers - List of transfer offers
 * @param ascending - Sort order
 * @returns Sorted offers
 */
export function sortOffersByAmount(
  offers: TransferOffer[],
  ascending: boolean = false
): TransferOffer[] {
  return [...offers].sort((a, b) => {
    const comparison = a.finalOffer - b.finalOffer;
    return ascending ? comparison : -comparison;
  });
}

/**
 * Gets transfer offers for a specific player
 *
 * @param offers - List of transfer offers
 * @param playerId - Player ID
 * @returns Offers for the player
 */
export function getOffersForPlayer(
  offers: TransferOffer[],
  playerId: string
): TransferOffer[] {
  return offers.filter(o => o.playerId === playerId);
}

/**
 * Gets transfer offers involving a specific team (as buyer or seller)
 *
 * @param offers - List of transfer offers
 * @param teamId - Team ID
 * @returns Offers involving the team
 */
export function getOffersForTeam(
  offers: TransferOffer[],
  teamId: string
): TransferOffer[] {
  return offers.filter(o => o.sellerTeamId === teamId || o.buyerTeamId === teamId);
}

/**
 * Expires old transfer offers
 *
 * @param offers - List of transfer offers
 * @param currentWeek - Current game week
 * @param expiryWeeks - Number of weeks before expiry (default: 2)
 * @returns Updated offers with expired status
 */
export function expireOldOffers(
  offers: TransferOffer[],
  currentWeek: number,
  expiryWeeks: number = 2
): TransferOffer[] {
  return offers.map(offer => {
    const age = currentWeek - offer.createdWeek;
    if (offer.status === 'pending' && age >= expiryWeeks) {
      return expireTransferOffer(offer);
    }
    return offer;
  });
}

// =============================================================================
// BID BLOCKING SYSTEM
// =============================================================================

/**
 * Bid blocking duration (weeks)
 * User can block AI bids on their players for this many weeks
 */
export const BID_BLOCK_DURATION_WEEKS = 4;

/**
 * Calculate the week when a bid block expires
 *
 * @param currentWeek - Current game week
 * @returns Week number when the block expires
 */
export function calculateBidBlockExpiry(currentWeek: number): number {
  return currentWeek + BID_BLOCK_DURATION_WEEKS;
}

/**
 * Check if bids are currently blocked for a player
 *
 * @param bidBlockedPlayers - Map of player IDs to block expiry weeks
 * @param playerId - Player ID to check
 * @param currentWeek - Current game week
 * @returns True if bids are blocked, false otherwise
 */
export function areBidsBlocked(
  bidBlockedPlayers: Record<string, number>,
  playerId: string,
  currentWeek: number
): boolean {
  const expiryWeek = bidBlockedPlayers[playerId];
  return expiryWeek !== undefined && currentWeek < expiryWeek;
}

/**
 * Block bids on a player
 *
 * @param bidBlockedPlayers - Current map of blocked players
 * @param playerId - Player ID to block
 * @param currentWeek - Current game week
 * @returns Updated map with new block added
 */
export function blockBidsOnPlayer(
  bidBlockedPlayers: Record<string, number>,
  playerId: string,
  currentWeek: number
): Record<string, number> {
  return {
    ...bidBlockedPlayers,
    [playerId]: calculateBidBlockExpiry(currentWeek),
  };
}

/**
 * Unblock bids on a player
 *
 * @param bidBlockedPlayers - Current map of blocked players
 * @param playerId - Player ID to unblock
 * @returns Updated map with block removed
 */
export function unblockBidsOnPlayer(
  bidBlockedPlayers: Record<string, number>,
  playerId: string
): Record<string, number> {
  const { [playerId]: _, ...rest } = bidBlockedPlayers;
  return rest;
}

/**
 * Clean up expired bid blocks
 *
 * @param bidBlockedPlayers - Current map of blocked players
 * @param currentWeek - Current game week
 * @returns Updated map with expired blocks removed
 */
export function cleanupExpiredBidBlocks(
  bidBlockedPlayers: Record<string, number>,
  currentWeek: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [playerId, expiryWeek] of Object.entries(bidBlockedPlayers)) {
    if (currentWeek < expiryWeek) {
      result[playerId] = expiryWeek;
    }
  }
  return result;
}
