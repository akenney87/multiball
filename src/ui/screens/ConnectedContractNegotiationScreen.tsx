/**
 * Connected Contract Negotiation Screen
 *
 * Connects ContractNegotiationScreen to real game data via GameContext.
 * Handles FM-style contract negotiations with players.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGame } from '../context/GameContext';
import { ContractNegotiationScreen } from './ContractNegotiationScreen';
import { useColors, spacing } from '../theme';

interface ConnectedContractNegotiationScreenProps {
  /** Callback when negotiation completes (signed or cancelled) */
  onComplete?: () => void;
  /** Callback when user walks away from negotiation */
  onCancel?: () => void;
}

export function ConnectedContractNegotiationScreen({
  onComplete,
  onCancel,
}: ConnectedContractNegotiationScreenProps) {
  const colors = useColors();
  const {
    state,
    getActiveNegotiation,
    getPlayer,
    submitContractOffer,
    acceptPlayerCounter,
    cancelNegotiation,
    completeSigning,
  } = useGame();

  const negotiation = getActiveNegotiation();
  const player = negotiation ? getPlayer(negotiation.playerId) : null;
  const userBudget = state.userTeam.availableBudget;

  // Budget info for impact preview
  const budgetInfo = {
    totalBudget: state.userTeam.totalBudget,
    salaryCommitment: state.userTeam.salaryCommitment,
    operationsBudget: state.userTeam.operationsBudget,
  };

  // Handle submit offer
  const handleSubmitOffer = (offer: import('../../data/types').ContractOffer) => {
    submitContractOffer(offer);
  };

  // Handle accept counter
  const handleAcceptCounter = () => {
    acceptPlayerCounter();
  };

  // Handle cancel/walk away
  const handleCancel = () => {
    cancelNegotiation();
    onCancel?.();
  };

  // Handle complete signing
  const handleCompleteSigning = () => {
    completeSigning();
    onComplete?.();
  };

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  // No active negotiation
  if (!negotiation || !player) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.noNegotiationText, { color: colors.textMuted }]}>
          No active contract negotiation.
        </Text>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          Start a negotiation from the Transfer Market.
        </Text>
      </View>
    );
  }

  return (
    <ContractNegotiationScreen
      negotiation={negotiation}
      player={player}
      userBudget={userBudget}
      budgetInfo={budgetInfo}
      onSubmitOffer={handleSubmitOffer}
      onAcceptCounter={handleAcceptCounter}
      onCancel={handleCancel}
      onCompleteSigning={handleCompleteSigning}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  noNegotiationText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default ConnectedContractNegotiationScreen;
