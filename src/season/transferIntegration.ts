/**
 * Transfer Integration
 *
 * Connects the Transfer System with the Season/Event infrastructure:
 * - Transfer window state management
 * - Event emission for transfer activities
 * - AI transfer decision hooks
 * - Transfer workflow orchestration
 *
 * Week 5: Transfer System Integration
 */

import type { Player, Season, Franchise } from '../data/types';
import type { AIConfig } from '../ai/types';
import {
  TransferOffer,
  AITransferSettings,
  TeamPersonality,
  BuyerUrgency,
  createTransferOffer,
  processTransferOffer,
  calculatePlayerMarketValue,
  suggestAskingPrice,
  expireOldOffers,
  filterOffersByStatus,
  getOffersForTeam,
  getOffersForPlayer,
} from '../systems/transferSystem';
import { calculateOverallRating } from '../ai/evaluation';
import {
  GameEventEmitter,
  gameEvents,
  type GameEvent,
} from './events';

// =============================================================================
// TRANSFER EVENT TYPES
// =============================================================================

/**
 * Transfer offered event
 */
export interface TransferOfferedEvent {
  type: 'transfer:offered';
  timestamp: Date;
  offer: TransferOffer;
  buyerTeamName: string;
  sellerTeamName: string;
}

/**
 * Transfer accepted event
 */
export interface TransferAcceptedEvent {
  type: 'transfer:accepted';
  timestamp: Date;
  offer: TransferOffer;
  playerName: string;
  fromTeam: string;
  toTeam: string;
  fee: number;
}

/**
 * Transfer rejected event
 */
export interface TransferRejectedEvent {
  type: 'transfer:rejected';
  timestamp: Date;
  offer: TransferOffer;
  reason: string;
}

/**
 * Transfer completed event (player moved)
 */
export interface TransferCompletedEvent {
  type: 'transfer:completed';
  timestamp: Date;
  playerId: string;
  playerName: string;
  fromTeamId: string;
  toTeamId: string;
  transferFee: number;
}

// =============================================================================
// TRANSFER STATE
// =============================================================================

/**
 * Transfer market state
 */
export interface TransferMarketState {
  offers: TransferOffer[];
  isWindowOpen: boolean;
  currentWeek: number;
}

/**
 * Create initial transfer market state
 */
export function createTransferMarketState(
  isWindowOpen: boolean = false,
  currentWeek: number = 1
): TransferMarketState {
  return {
    offers: [],
    isWindowOpen,
    currentWeek,
  };
}

// =============================================================================
// TRANSFER WINDOW MANAGEMENT
// =============================================================================

/**
 * Open the transfer window
 */
export function openTransferWindow(
  state: TransferMarketState,
  eventEmitter: GameEventEmitter = gameEvents
): TransferMarketState {
  eventEmitter.emit({
    type: 'season:transferWindowOpened',
    timestamp: new Date(),
    seasonId: 'current',
    week: state.currentWeek,
  });

  return {
    ...state,
    isWindowOpen: true,
  };
}

/**
 * Close the transfer window
 */
export function closeTransferWindow(
  state: TransferMarketState,
  eventEmitter: GameEventEmitter = gameEvents
): TransferMarketState {
  // Expire all pending offers
  const expiredOffers = state.offers.map((offer) =>
    offer.status === 'pending' ? { ...offer, status: 'expired' as const } : offer
  );

  eventEmitter.emit({
    type: 'season:transferWindowClosed',
    timestamp: new Date(),
    seasonId: 'current',
    week: state.currentWeek,
  });

  return {
    ...state,
    isWindowOpen: false,
    offers: expiredOffers,
  };
}

// =============================================================================
// PLAYER VALUATION
// =============================================================================

/**
 * Calculate player's transfer market value
 */
export function getPlayerMarketValue(player: Player): number {
  const rating = calculateOverallRating(player);
  const avgPotential =
    (player.potentials.physical + player.potentials.mental + player.potentials.technical) / 3;

  // Count sports with rating above 50 (placeholder - would need sport-specific ratings)
  const sportsAbove50 = 1; // Default to 1 for now

  return calculatePlayerMarketValue(rating, player.age, avgPotential, sportsAbove50);
}

/**
 * Get player valuation details
 */
export interface PlayerValuationDetails {
  player: Player;
  overallRating: number;
  marketValue: number;
  suggestedAskingPrice: number;
  ageCategory: 'young' | 'prime' | 'veteran';
}

export function getPlayerValuationDetails(
  player: Player,
  sellerPersonality: TeamPersonality = 'balanced'
): PlayerValuationDetails {
  const rating = calculateOverallRating(player);
  const marketValue = getPlayerMarketValue(player);
  const multiplier = suggestAskingPrice(marketValue, sellerPersonality);

  let ageCategory: 'young' | 'prime' | 'veteran';
  if (player.age < 25) {
    ageCategory = 'young';
  } else if (player.age < 30) {
    ageCategory = 'prime';
  } else {
    ageCategory = 'veteran';
  }

  return {
    player,
    overallRating: rating,
    marketValue,
    suggestedAskingPrice: Math.round(marketValue * multiplier),
    ageCategory,
  };
}

// =============================================================================
// TRANSFER OFFER MANAGEMENT
// =============================================================================

/**
 * Create and submit a transfer offer
 */
export function submitTransferOffer(
  state: TransferMarketState,
  player: Player,
  buyerTeamId: string,
  buyerTeamName: string,
  sellerTeamId: string,
  sellerTeamName: string,
  transferMultiplier: number,
  urgency: BuyerUrgency,
  eventEmitter: GameEventEmitter = gameEvents
): { state: TransferMarketState; offer: TransferOffer } {
  if (!state.isWindowOpen) {
    throw new Error('Transfer window is closed');
  }

  const marketValue = getPlayerMarketValue(player);

  const offer = createTransferOffer(
    player.id,
    player.name,
    sellerTeamId,
    buyerTeamId,
    marketValue,
    transferMultiplier,
    urgency,
    state.currentWeek
  );

  // Emit event
  const event: TransferOfferedEvent = {
    type: 'transfer:offered',
    timestamp: new Date(),
    offer,
    buyerTeamName,
    sellerTeamName,
  };
  eventEmitter.emit(event as unknown as GameEvent);

  return {
    state: {
      ...state,
      offers: [...state.offers, offer],
    },
    offer,
  };
}

/**
 * Process an offer with AI decision
 */
export function processOfferWithAI(
  state: TransferMarketState,
  offerId: string,
  aiSettings: AITransferSettings,
  eventEmitter: GameEventEmitter = gameEvents
): TransferMarketState {
  const offerIndex = state.offers.findIndex(
    (o) => o.playerId === offerId && o.status === 'pending'
  );

  if (offerIndex === -1) {
    return state;
  }

  const offer = state.offers[offerIndex];
  const { updatedOffer, evaluation } = processTransferOffer(offer, aiSettings);

  // Emit appropriate event
  if (evaluation.accepted) {
    const acceptEvent: TransferAcceptedEvent = {
      type: 'transfer:accepted',
      timestamp: new Date(),
      offer: updatedOffer,
      playerName: updatedOffer.playerName,
      fromTeam: updatedOffer.sellerTeamId,
      toTeam: updatedOffer.buyerTeamId,
      fee: updatedOffer.finalOffer,
    };
    eventEmitter.emit(acceptEvent as unknown as GameEvent);
  } else {
    const rejectEvent: TransferRejectedEvent = {
      type: 'transfer:rejected',
      timestamp: new Date(),
      offer: updatedOffer,
      reason: evaluation.reason,
    };
    eventEmitter.emit(rejectEvent as unknown as GameEvent);
  }

  // Update offers list
  const updatedOffers = [...state.offers];
  updatedOffers[offerIndex] = updatedOffer;

  return {
    ...state,
    offers: updatedOffers,
  };
}

/**
 * Complete a transfer (move player between teams)
 */
export function completeTransfer(
  players: Player[],
  offer: TransferOffer,
  eventEmitter: GameEventEmitter = gameEvents
): Player[] {
  if (offer.status !== 'accepted') {
    throw new Error('Cannot complete non-accepted transfer');
  }

  const playerIndex = players.findIndex((p) => p.id === offer.playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found');
  }

  const player = players[playerIndex];

  // Move player to new team
  const updatedPlayer: Player = {
    ...player,
    teamId: offer.buyerTeamId,
    acquisitionType: 'trade',
    acquisitionDate: new Date(),
    contract: null, // Contract will need to be negotiated
  };

  // Emit completion event
  const event: TransferCompletedEvent = {
    type: 'transfer:completed',
    timestamp: new Date(),
    playerId: player.id,
    playerName: player.name,
    fromTeamId: offer.sellerTeamId,
    toTeamId: offer.buyerTeamId,
    transferFee: offer.finalOffer,
  };
  eventEmitter.emit(event as unknown as GameEvent);

  const updatedPlayers = [...players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return updatedPlayers;
}

// =============================================================================
// AI TRANSFER DECISIONS
// =============================================================================

/**
 * AI transfer target identification
 */
export interface TransferTarget {
  player: Player;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedCost: number;
}

/**
 * Identify transfer targets for AI team
 */
export function identifyTransferTargets(
  aiTeam: Franchise,
  aiRoster: Player[],
  availablePlayers: Player[],
  config: AIConfig,
  maxTargets: number = 5
): TransferTarget[] {
  const targets: TransferTarget[] = [];

  // Analyze team needs
  const positionCounts: Record<string, number> = {};
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  for (const player of aiRoster) {
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
  }

  // Find positions with fewer than 2 players
  const neededPositions = positions.filter((pos) => (positionCounts[pos] || 0) < 2);

  // Calculate average team rating
  const avgRating =
    aiRoster.length > 0
      ? aiRoster.reduce((sum, p) => sum + calculateOverallRating(p), 0) / aiRoster.length
      : 50;

  // Filter and score available players
  for (const player of availablePlayers) {
    if (player.teamId === aiTeam.id) continue; // Skip own players

    const rating = calculateOverallRating(player);
    const marketValue = getPlayerMarketValue(player);

    // Determine priority
    let priority: 'high' | 'medium' | 'low' = 'low';
    let reason = '';

    // High priority: fills needed position AND improves team
    if (neededPositions.includes(player.position) && rating > avgRating) {
      priority = 'high';
      reason = `Fills needed ${player.position} position and improves team average`;
    }
    // Medium priority: fills needed position OR significantly better than average
    else if (neededPositions.includes(player.position)) {
      priority = 'medium';
      reason = `Fills needed ${player.position} position`;
    } else if (rating > avgRating + 10) {
      priority = 'medium';
      reason = `Significantly better than team average (${rating} vs ${avgRating.toFixed(0)})`;
    }
    // Low priority: young player with high potential
    else if (player.age < 23 && player.potentials.physical > 75) {
      priority = 'low';
      reason = 'Young player with development potential';
    } else {
      continue; // Skip players that don't meet any criteria
    }

    // Adjust for AI personality
    if (config.personality === 'conservative' && player.age > 28) {
      continue; // Conservative AI avoids older players
    }
    if (config.personality === 'aggressive' && priority === 'low') {
      continue; // Aggressive AI only pursues high-value targets
    }

    targets.push({
      player,
      priority,
      reason,
      estimatedCost: Math.round(marketValue * 2.0), // Estimate at 2x market value
    });
  }

  // Sort by priority and limit
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  targets.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return targets.slice(0, maxTargets);
}

/**
 * Decide if AI should make a transfer offer
 */
export function shouldAIMakeOffer(
  aiTeam: Franchise,
  target: TransferTarget,
  config: AIConfig
): boolean {
  const budget = aiTeam.budget.available;
  const estimatedCost = target.estimatedCost;

  // Must have budget
  if (budget < estimatedCost * 0.5) {
    return false;
  }

  // Personality affects willingness
  switch (config.personality) {
    case 'aggressive':
      return target.priority !== 'low' || budget > estimatedCost * 2;
    case 'conservative':
      return target.priority === 'high' && budget > estimatedCost * 1.5;
    case 'balanced':
    default:
      return target.priority !== 'low' || budget > estimatedCost;
  }
}

/**
 * Determine buyer urgency based on AI state
 */
export function determineAIUrgency(
  aiTeam: Franchise,
  target: TransferTarget,
  config: AIConfig
): BuyerUrgency {
  // High priority + aggressive = desperate
  if (target.priority === 'high' && config.personality === 'aggressive') {
    return 'desperate';
  }

  // Low priority or conservative = reluctant
  if (target.priority === 'low' || config.personality === 'conservative') {
    return 'reluctant';
  }

  return 'neutral';
}

// =============================================================================
// WEEKLY TRANSFER PROCESSING
// =============================================================================

/**
 * Process transfers for the week
 */
export function processWeeklyTransfers(
  state: TransferMarketState,
  currentWeek: number
): TransferMarketState {
  // Update current week
  let updatedState: TransferMarketState = {
    ...state,
    currentWeek,
  };

  // Expire old offers
  updatedState = {
    ...updatedState,
    offers: expireOldOffers(updatedState.offers, currentWeek, 2),
  };

  return updatedState;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get pending offers for a team
 */
export function getTeamPendingOffers(
  state: TransferMarketState,
  teamId: string
): { incoming: TransferOffer[]; outgoing: TransferOffer[] } {
  const teamOffers = getOffersForTeam(state.offers, teamId);
  const pending = filterOffersByStatus(teamOffers, 'pending');

  return {
    incoming: pending.filter((o) => o.sellerTeamId === teamId),
    outgoing: pending.filter((o) => o.buyerTeamId === teamId),
  };
}

/**
 * Get transfer history for a player
 */
export function getPlayerTransferHistory(
  state: TransferMarketState,
  playerId: string
): TransferOffer[] {
  return getOffersForPlayer(state.offers, playerId).filter(
    (o) => o.status === 'accepted' || o.status === 'rejected'
  );
}

/**
 * Get market activity summary
 */
export function getMarketActivitySummary(state: TransferMarketState): {
  totalOffers: number;
  pendingOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  expiredOffers: number;
  totalValue: number;
} {
  const pending = filterOffersByStatus(state.offers, 'pending');
  const accepted = filterOffersByStatus(state.offers, 'accepted');
  const rejected = filterOffersByStatus(state.offers, 'rejected');
  const expired = filterOffersByStatus(state.offers, 'expired');

  const totalValue = accepted.reduce((sum, o) => sum + o.finalOffer, 0);

  return {
    totalOffers: state.offers.length,
    pendingOffers: pending.length,
    acceptedOffers: accepted.length,
    rejectedOffers: rejected.length,
    expiredOffers: expired.length,
    totalValue,
  };
}
