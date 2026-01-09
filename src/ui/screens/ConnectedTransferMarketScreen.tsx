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

  // Calculate performance multiplier based on awards and stats
  const calculatePerformanceMultiplier = useCallback((player: Player): number => {
    let multiplier = 1.0;

    const awards = player.awards;
    if (awards) {
      multiplier += awards.playerOfTheWeek * 0.05;              // +5% per weekly award
      multiplier += awards.playerOfTheMonth * 0.15;             // +15% per monthly award
      multiplier += awards.basketballPlayerOfTheYear * 0.50;    // +50% per Basketball POY
      multiplier += awards.baseballPlayerOfTheYear * 0.50;      // +50% per Baseball POY
      multiplier += awards.soccerPlayerOfTheYear * 0.50;        // +50% per Soccer POY
      multiplier += awards.rookieOfTheYear * 0.30;              // +30% for ROY
      multiplier += awards.championships * 0.35;                // +35% per championship
    }

    const gamesPlayed = player.careerStats?.gamesPlayed || { basketball: 0, baseball: 0, soccer: 0 };
    const totalGames = gamesPlayed.basketball + gamesPlayed.baseball + gamesPlayed.soccer;
    if (totalGames >= 100) {
      multiplier += 0.30;
    } else if (totalGames >= 50) {
      multiplier += 0.15;
    } else if (totalGames >= 20) {
      multiplier += 0.05;
    }

    return Math.min(3.0, multiplier);
  }, []);

  // Calculate market value - grounded in acquisition cost to prevent exploits
  const calculateMarketValue = useCallback((rating: number, age: number, salary: number = 0, performanceMultiplier: number = 1.0): number => {
    // Base value tiers - what you'd pay to acquire a similar unproven player
    let baseValue: number;
    if (rating < 45) {
      baseValue = 10000;
    } else if (rating < 50) {
      baseValue = 10000 + (rating - 45) * 3000;
    } else if (rating < 55) {
      baseValue = 25000 + (rating - 50) * 5000;
    } else if (rating < 60) {
      baseValue = 50000 + (rating - 55) * 10000;
    } else if (rating < 65) {
      baseValue = 100000 + (rating - 60) * 20000;
    } else if (rating < 70) {
      baseValue = 200000 + (rating - 65) * 40000;
    } else if (rating < 75) {
      baseValue = 400000 + (rating - 70) * 80000;
    } else if (rating < 80) {
      baseValue = 800000 + (rating - 75) * 140000;
    } else if (rating < 85) {
      baseValue = 1500000 + (rating - 80) * 300000;
    } else {
      baseValue = 3000000 + (rating - 85) * 500000;
    }

    // Age factor
    let ageFactor: number;
    if (age < 22) {
      ageFactor = 1.25;
    } else if (age < 25) {
      ageFactor = 1.1;
    } else if (age < 28) {
      ageFactor = 1.0;
    } else if (age < 30) {
      ageFactor = 0.6;
    } else if (age < 32) {
      ageFactor = 0.3;
    } else {
      ageFactor = 0.15;
    }

    let transferValue = baseValue * ageFactor;

    // Cap relative to salary to prevent free agent flip exploit
    if (salary > 0) {
      let maxMultiple: number;
      if (rating >= 80) {
        maxMultiple = 2.0;
      } else if (rating >= 75) {
        maxMultiple = 1.5;
      } else if (rating >= 70) {
        maxMultiple = 1.0;
      } else if (rating >= 65) {
        maxMultiple = 0.5;
      } else {
        maxMultiple = 0.25;
      }
      transferValue = Math.min(transferValue, salary * maxMultiple);
    }

    // Apply performance multiplier
    transferValue *= performanceMultiplier;

    return Math.max(10000, Math.round(transferValue / 10000) * 10000);
  }, []);

  // Convert Player to TransferTarget
  const convertToTarget = useCallback((player: Player): TransferTarget => {
    const overall = calculatePlayerOverall(player);
    const salary = player.contract?.salary || 0;
    const perfMultiplier = calculatePerformanceMultiplier(player);

    // Free agents show $0 market value to avoid tipping off their quality
    const isFreeAgent = player.teamId === 'free_agent';
    const askingPrice = isFreeAgent ? 0 : calculateMarketValue(overall, player.age, salary, perfMultiplier);

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
  }, [state.league.teams, calculateMarketValue, calculatePerformanceMultiplier]);

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
      const salary = player.contract?.salary || 0;
      const perfMultiplier = calculatePerformanceMultiplier(player);
      // Use stored asking price, fall back to calculated value for backward compatibility
      const storedAskingPrice = askingPrices[player.id];
      const askingPrice = storedAskingPrice !== undefined
        ? storedAskingPrice
        : calculateMarketValue(overall, player.age, salary, perfMultiplier);

      return {
        id: player.id,
        name: player.name,
        overall,
        age: player.age,
        salary,
        askingPrice,
      };
    });
  }, [state.initialized, getTransferListedPlayers, state.userTeam.transferListAskingPrices, calculateMarketValue, calculatePerformanceMultiplier]);

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
