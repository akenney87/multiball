/**
 * Connected Transfer Market Screen
 *
 * Connects TransferMarketScreen to real game data via GameContext.
 * Shows actual players from AI teams and handles real transfer offers.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGame } from '../context/GameContext';
import { TransferMarketScreen, TransferTarget, TransferListPlayer, IncomingOffer, OutgoingOffer } from './TransferMarketScreen';
import { calculatePlayerOverall } from '../integration/gameInitializer';
import { useColors, spacing } from '../theme';
import type { Player } from '../../data/types';

interface ConnectedTransferMarketScreenProps {
  /** Callback when offer is made (for navigation) */
  onOfferMade?: () => void;
  /** Navigate to player detail screen */
  onPlayerPress?: (playerId: string) => void;
}

export function ConnectedTransferMarketScreen({
  onOfferMade,
  onPlayerPress,
}: ConnectedTransferMarketScreenProps) {
  const colors = useColors();
  const {
    state,
    makeTransferOffer,
    respondToOffer,
    getShortlistedPlayers,
    getTransferListedPlayers,
    removeFromShortlist,
    removeFromTransferList,
  } = useGame();

  // Calculate market value using polynomial scaling
  const calculateMarketValue = useCallback((rating: number, age: number): number => {
    // Use polynomial scaling so low-rated players have much lower values
    let baseValue: number;
    if (rating < 50) {
      baseValue = Math.max(10000, (rating - 35) * 5000);
    } else if (rating < 60) {
      baseValue = 75000 + (rating - 50) * 30000;
    } else if (rating < 70) {
      baseValue = 400000 + (rating - 60) * 80000;
    } else if (rating < 80) {
      baseValue = 1200000 + (rating - 70) * 200000;
    } else {
      baseValue = 3200000 + (rating - 80) * 500000;
    }

    // Age factor
    let ageFactor: number;
    if (age < 22) {
      ageFactor = 1.4;
    } else if (age < 25) {
      ageFactor = 1.2;
    } else if (age < 28) {
      ageFactor = 1.0;
    } else if (age < 30) {
      ageFactor = 0.8;
    } else if (age < 32) {
      ageFactor = 0.5;
    } else {
      ageFactor = 0.25;
    }

    return Math.round(baseValue * ageFactor / 25000) * 25000;
  }, []);

  // Convert Player to TransferTarget
  const convertToTarget = useCallback((player: Player): TransferTarget => {
    const overall = calculatePlayerOverall(player);
    const askingPrice = calculateMarketValue(overall, player.age);

    // Find which team the player is on
    const team = state.league.teams.find((t) => t.rosterIds.includes(player.id));

    return {
      id: player.id,
      name: player.name,
      overall,
      age: player.age,
      salary: player.contract?.salary || 0,
      team: team?.name || 'Free Agent',
      askingPrice,
      status: 'available',
    };
  }, [state.league.teams, calculateMarketValue]);

  // Convert incoming offers to UI format
  const convertToIncomingOffer = useCallback((offer: typeof state.market.incomingOffers[0]): IncomingOffer | null => {
    const player = state.players[offer.playerId];
    if (!player) return null;

    const fromTeam = state.league.teams.find((t) => t.id === offer.offeringTeamId);

    return {
      id: offer.id,
      player: {
        id: player.id,
        name: player.name,
        overall: calculatePlayerOverall(player),
        age: player.age,
        salary: player.contract?.salary || 0,
      },
      fromTeam: fromTeam?.name || 'Unknown Team',
      offerAmount: offer.transferFee,
      status: offer.status === 'pending' ? 'pending' : offer.status === 'accepted' ? 'accepted' : 'rejected',
      expiresIn: 3, // Default expiry
    };
  }, [state.players, state.league.teams]);

  // Convert outgoing offers to UI format
  const convertToOutgoingOffer = useCallback((offer: typeof state.market.outgoingOffers[0]): OutgoingOffer | null => {
    const player = state.players[offer.playerId];
    if (!player) return null;

    const toTeam = state.league.teams.find((t) => t.id === offer.receivingTeamId);

    // Get counter amount from negotiation history if countered
    let counterAmount: number | undefined;
    if (offer.status === 'countered' && offer.negotiationHistory.length > 1) {
      const lastEntry = offer.negotiationHistory[offer.negotiationHistory.length - 1];
      if (lastEntry && lastEntry.from !== 'user') {
        counterAmount = lastEntry.amount;
      }
    }

    return {
      id: offer.id,
      player: {
        id: player.id,
        name: player.name,
        overall: calculatePlayerOverall(player),
        age: player.age,
        salary: player.contract?.salary || 0,
      },
      toTeam: toTeam?.name || 'Unknown Team',
      offerAmount: offer.transferFee,
      status: offer.status,
      counterAmount,
    };
  }, [state.players, state.league.teams]);

  // Get incoming offers
  const incomingOffers = useMemo((): IncomingOffer[] => {
    if (!state.initialized) return [];
    return state.market.incomingOffers
      .map(convertToIncomingOffer)
      .filter((offer): offer is IncomingOffer => offer !== null);
  }, [state.initialized, state.market.incomingOffers, convertToIncomingOffer]);

  // Get outgoing offers
  const outgoingOffers = useMemo((): OutgoingOffer[] => {
    if (!state.initialized) return [];
    return state.market.outgoingOffers
      .map(convertToOutgoingOffer)
      .filter((offer): offer is OutgoingOffer => offer !== null);
  }, [state.initialized, state.market.outgoingOffers, convertToOutgoingOffer]);

  // Get shortlisted players (converted to TransferTarget format)
  const shortlistedPlayers = useMemo((): TransferTarget[] => {
    if (!state.initialized) return [];
    const players = getShortlistedPlayers();
    return players.map(convertToTarget);
  }, [state.initialized, getShortlistedPlayers, convertToTarget]);

  // Get transfer listed players (user's own players)
  const transferListedPlayers = useMemo((): TransferListPlayer[] => {
    if (!state.initialized) return [];
    const players = getTransferListedPlayers();
    const askingPrices = state.userTeam.transferListAskingPrices || {};
    return players.map((player): TransferListPlayer => {
      const overall = calculatePlayerOverall(player);
      // Use stored asking price, fall back to calculated value for backward compatibility
      const storedAskingPrice = askingPrices[player.id];
      const askingPrice = storedAskingPrice !== undefined
        ? storedAskingPrice
        : calculateMarketValue(overall, player.age);

      return {
        id: player.id,
        name: player.name,
        overall,
        age: player.age,
        salary: player.contract?.salary || 0,
        askingPrice,
      };
    });
  }, [state.initialized, getTransferListedPlayers, state.userTeam.transferListAskingPrices, calculateMarketValue]);

  // Handle making a transfer offer (free agents are handled via contract negotiation)
  const handleMakeOffer = useCallback((target: TransferTarget, amount: number) => {
    makeTransferOffer(target.id, amount);
    onOfferMade?.();
  }, [makeTransferOffer, onOfferMade]);

  // Handle accepting an incoming offer
  const handleAcceptOffer = useCallback((offer: IncomingOffer) => {
    respondToOffer(offer.id, true);
  }, [respondToOffer]);

  // Handle rejecting an incoming offer
  const handleRejectOffer = useCallback((offer: IncomingOffer) => {
    respondToOffer(offer.id, false);
  }, [respondToOffer]);

  // Handle accepting a counter offer (make new offer at counter amount)
  const handleAcceptCounter = useCallback((offer: OutgoingOffer) => {
    if (offer.counterAmount) {
      // Make a new offer at the counter amount
      makeTransferOffer(offer.player.id, offer.counterAmount);
    }
  }, [makeTransferOffer]);

  // Handle withdrawing an offer (just remove from UI - offers expire naturally)
  const handleWithdrawOffer = useCallback((_offer: OutgoingOffer) => {
    // For now, we don't have a withdraw action in reducer
    // The offer will expire naturally or be rejected
    console.log('Withdraw offer not implemented - offer will expire naturally');
  }, []);

  // Handle removing from shortlist
  const handleRemoveFromShortlist = useCallback((playerId: string) => {
    removeFromShortlist(playerId);
  }, [removeFromShortlist]);

  // Handle removing from transfer list
  const handleRemoveFromTransferList = useCallback((playerId: string) => {
    removeFromTransferList(playerId);
  }, [removeFromTransferList]);

  // Get user's available budget
  const userBudget = state.userTeam.availableBudget;

  // Loading state - now after all hooks
  if (!state.initialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading market...
        </Text>
      </View>
    );
  }

  return (
    <TransferMarketScreen
      userBudget={userBudget}
      shortlistedPlayers={shortlistedPlayers}
      transferListedPlayers={transferListedPlayers}
      offers={incomingOffers}
      outgoingOffers={outgoingOffers}
      onMakeOffer={handleMakeOffer}
      onAcceptOffer={handleAcceptOffer}
      onRejectOffer={handleRejectOffer}
      onAcceptCounter={handleAcceptCounter}
      onWithdrawOffer={handleWithdrawOffer}
      onRemoveFromShortlist={handleRemoveFromShortlist}
      onRemoveFromTransferList={handleRemoveFromTransferList}
      onPlayerPress={onPlayerPress}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
});

export default ConnectedTransferMarketScreen;
