/**
 * Contract Integration
 *
 * Connects the Contract System with the Season/Event infrastructure:
 * - Contract negotiation workflow
 * - Event emission for contract activities
 * - Expiring contract management
 * - Free agent signing integration
 *
 * Note: FM-style contract negotiations now primarily flow through
 * GameContext/reducer. This file provides event emission utilities.
 */

import type {
  Player,
  Contract,
  ContractOffer,
  ContractDemands,
} from '../data/types';
import {
  generatePlayerDemands as generateDemands,
  determineNegotiationStrategy,
  createDefaultOffer,
} from '../systems/contractSystem';
import { GameEventEmitter, gameEvents, type GameEvent } from './events';

// =============================================================================
// CONTRACT EVENT TYPES
// =============================================================================

/**
 * Contract offered event
 */
export interface ContractOfferedEvent {
  type: 'contract:offered';
  timestamp: Date;
  playerId: string;
  playerName: string;
  teamId: string;
  offer: ContractOffer;
  negotiationRound: number;
}

/**
 * Contract signed event
 */
export interface ContractSignedEvent {
  type: 'contract:signed';
  timestamp: Date;
  playerId: string;
  playerName: string;
  teamId: string;
  contract: Contract;
}

/**
 * Contract rejected event
 */
export interface ContractRejectedEvent {
  type: 'contract:rejected';
  timestamp: Date;
  playerId: string;
  playerName: string;
  teamId: string;
  reason: string;
}

/**
 * Contract expiring event
 */
export interface ContractExpiringEvent {
  type: 'contract:expiring';
  timestamp: Date;
  playerId: string;
  playerName: string;
  teamId: string;
  weeksRemaining: number;
}

/**
 * Contract expired event
 */
export interface ContractExpiredEvent {
  type: 'contract:expired';
  timestamp: Date;
  playerId: string;
  playerName: string;
  previousTeamId: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate player valuation (backwards compatibility wrapper)
 */
export function calculatePlayerValuation(
  overallRating: number,
  age: number,
  averagePotential: number,
  sportsAbove50: number
): { marketValue: number; annualSalary: number } {
  // Use the simplified calculation from contractSystem
  const baseValue = (overallRating / 100) * 1000000;

  let ageMultiplier: number;
  if (age < 23) {
    ageMultiplier = 1.5;
  } else if (age < 29) {
    ageMultiplier = 2.0;
  } else if (age < 33) {
    ageMultiplier = 1.5;
  } else {
    ageMultiplier = 1.0;
  }

  const potentialModifier = 1.0 + (averagePotential - overallRating) / 100;
  const multiSportBonus = 1.0 + (sportsAbove50 - 1) * 0.2;

  const marketValue = Math.round(baseValue * ageMultiplier * potentialModifier * Math.max(1.0, multiSportBonus));
  const annualSalary = Math.round(marketValue * 0.20);

  return { marketValue, annualSalary };
}

/**
 * Generate player demands wrapper for backwards compatibility
 */
export function generatePlayerDemands(
  player: Player,
  calculatedSalary: number
): ContractDemands {
  const strategy = determineNegotiationStrategy(player, false, true);
  return generateDemands(player, calculatedSalary, strategy);
}

/**
 * Get recommended contract offer for a player
 */
export function getRecommendedOffer(player: Player): ContractOffer {
  return createDefaultOffer(player);
}

/**
 * Calculate total contract cost (upfront)
 */
export function calculateContractUpfrontCost(offer: ContractOffer): number {
  return offer.salary + offer.signingBonus + offer.agentFee;
}

// =============================================================================
// EVENT EMISSION HELPERS
// =============================================================================

/**
 * Emit contract offered event
 */
export function emitContractOfferedEvent(
  playerId: string,
  playerName: string,
  teamId: string,
  offer: ContractOffer,
  round: number,
  eventEmitter: GameEventEmitter = gameEvents
): void {
  const event: ContractOfferedEvent = {
    type: 'contract:offered',
    timestamp: new Date(),
    playerId,
    playerName,
    teamId,
    offer,
    negotiationRound: round,
  };
  eventEmitter.emit(event as unknown as GameEvent);
}

/**
 * Emit contract signed event
 */
export function emitContractSignedEvent(
  playerId: string,
  playerName: string,
  teamId: string,
  contract: Contract,
  eventEmitter: GameEventEmitter = gameEvents
): void {
  const event: ContractSignedEvent = {
    type: 'contract:signed',
    timestamp: new Date(),
    playerId,
    playerName,
    teamId,
    contract,
  };
  eventEmitter.emit(event as unknown as GameEvent);
}

/**
 * Emit contract rejected event
 */
export function emitContractRejectedEvent(
  playerId: string,
  playerName: string,
  teamId: string,
  reason: string,
  eventEmitter: GameEventEmitter = gameEvents
): void {
  const event: ContractRejectedEvent = {
    type: 'contract:rejected',
    timestamp: new Date(),
    playerId,
    playerName,
    teamId,
    reason,
  };
  eventEmitter.emit(event as unknown as GameEvent);
}

// =============================================================================
// EXPIRING CONTRACT TRACKING
// =============================================================================

/**
 * Expiring contract info
 */
export interface ExpiringContractInfo {
  playerId: string;
  playerName: string;
  teamId: string;
  weeksRemaining: number;
}

/**
 * Get list of expiring contracts
 */
export function getExpiringContracts(
  players: Record<string, Player>,
  currentWeek: number,
  weeksWarning: number = 8
): ExpiringContractInfo[] {
  const expiring: ExpiringContractInfo[] = [];

  for (const player of Object.values(players)) {
    if (!player.contract) continue;

    // Simplified check - contract expiry based on weeks
    const contractEndWeek = 40; // End of season
    const weeksRemaining = contractEndWeek - currentWeek;

    if (weeksRemaining <= weeksWarning && weeksRemaining > 0) {
      expiring.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId || 'unknown',
        weeksRemaining,
      });
    }
  }

  return expiring;
}

/**
 * Check if player contract is expiring
 */
export function isContractExpiring(player: Player, currentWeek: number): boolean {
  if (!player.contract) return false;

  const contractEndWeek = 40;
  const weeksRemaining = contractEndWeek - currentWeek;

  return weeksRemaining <= 8;
}
