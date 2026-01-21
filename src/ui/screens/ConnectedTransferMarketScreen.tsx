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
import { calculatePlayerMarketValue } from '../../systems/contractSystem';
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
    counterTransferOffer,
    getShortlistedPlayers,
    getTransferListedPlayers,
    removeFromShortlist,
    removeFromTransferList,
  } = useGame();

  // Convert Player to TransferTarget
  // Uses the shared calculatePlayerMarketValue from contractSystem.ts
  const convertToTarget = useCallback((player: Player): TransferTarget => {
    const overall = calculatePlayerOverall(player);

    // Free agents show $0 market value to avoid tipping off their quality
    const isFreeAgent = player.teamId === 'free_agent';
    const askingPrice = isFreeAgent ? 0 : calculatePlayerMarketValue(player);

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
  }, [state.league.teams]);

  // Convert incoming offers to UI format
  const convertToIncomingOffer = useCallback((offer: typeof state.market.incomingOffers[0]): IncomingOffer | null => {
    const player = state.players[offer.playerId];
    if (!player) return null;

    const fromTeam = state.league.teams.find((t) => t.id === offer.offeringTeamId);

    // Map offer status to UI status
    let uiStatus: IncomingOffer['status'];
    switch (offer.status) {
      case 'pending':
        uiStatus = 'pending';
        break;
      case 'pending_player_decision':
        uiStatus = 'pending_player_decision';
        break;
      case 'accepted':
        uiStatus = 'accepted';
        break;
      default:
        uiStatus = 'rejected';
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
      fromTeam: fromTeam?.name || 'Unknown Team',
      offerAmount: offer.transferFee,
      status: uiStatus,
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

    // Map offer status to UI status
    let uiStatus: OutgoingOffer['status'];
    switch (offer.status) {
      case 'pending':
        uiStatus = 'pending';
        break;
      case 'accepted':
      case 'negotiating':  // Show negotiating offers as accepted (user can continue)
        uiStatus = 'accepted';
        break;
      case 'countered':
        uiStatus = 'countered';
        break;
      case 'expired':
        uiStatus = 'expired';
        break;
      default:
        // 'rejected', 'walked_away', 'pending_player_decision' all map to rejected
        uiStatus = 'rejected';
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
      status: uiStatus,
      counterAmount,
    };
  }, [state.players, state.league.teams]);

  // Get incoming offers (newest first)
  const incomingOffers = useMemo((): IncomingOffer[] => {
    if (!state.initialized) return [];
    // Sort by createdDate descending (newest first) before converting
    const sorted = [...state.market.incomingOffers].sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );
    return sorted
      .map(convertToIncomingOffer)
      .filter((offer): offer is IncomingOffer => offer !== null);
  }, [state.initialized, state.market.incomingOffers, convertToIncomingOffer]);

  // Get outgoing offers (newest first)
  const outgoingOffers = useMemo((): OutgoingOffer[] => {
    if (!state.initialized) return [];
    // Sort by createdDate descending (newest first) before converting
    const sorted = [...state.market.outgoingOffers].sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );
    return sorted
      .map(convertToOutgoingOffer)
      .filter((offer): offer is OutgoingOffer => offer !== null);
  }, [state.initialized, state.market.outgoingOffers, convertToOutgoingOffer]);

  // Get shortlisted players (converted to TransferTarget format, newest first)
  const shortlistedPlayers = useMemo((): TransferTarget[] => {
    if (!state.initialized) return [];
    const players = getShortlistedPlayers();
    // Reverse to show newest additions first (items are added to end of array)
    return [...players].reverse().map(convertToTarget);
  }, [state.initialized, getShortlistedPlayers, convertToTarget]);

  // Get transfer listed players (user's own players, newest first)
  const transferListedPlayers = useMemo((): TransferListPlayer[] => {
    if (!state.initialized) return [];
    const players = getTransferListedPlayers();
    const askingPrices = state.userTeam.transferListAskingPrices || {};
    // Reverse to show newest additions first (items are added to end of array)
    return [...players].reverse().map((player): TransferListPlayer => {
      const overall = calculatePlayerOverall(player);
      const salary = player.contract?.salary || 0;
      // Use stored asking price, fall back to calculated value for backward compatibility
      const storedAskingPrice = askingPrices[player.id];
      const askingPrice = storedAskingPrice !== undefined
        ? storedAskingPrice
        : calculatePlayerMarketValue(player);

      return {
        id: player.id,
        name: player.name,
        overall,
        age: player.age,
        salary,
        askingPrice,
      };
    });
  }, [state.initialized, getTransferListedPlayers, state.userTeam.transferListAskingPrices]);

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

  // Handle counter offer on incoming offer
  const handleCounterOffer = useCallback((offer: IncomingOffer, counterAmount: number) => {
    counterTransferOffer(offer.id, counterAmount);
  }, [counterTransferOffer]);

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
      onCounterOffer={handleCounterOffer}
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
