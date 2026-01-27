/**
 * Connected Loan Market Screen
 *
 * Connects LoanMarketScreen to real game data via GameContext.
 * Shows loan-listed players from AI teams and handles loan offers.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGame } from '../context/GameContext';
import {
  LoanMarketScreen,
  LoanTarget,
  LoanListPlayer,
  IncomingLoanOffer,
  OutgoingLoanOffer,
  ActiveLoanDisplay,
} from './LoanMarketScreen';
import { calculatePlayerOverall } from '../integration/gameInitializer';
import { calculateRecommendedLoanFee } from '../../systems/loanSystem';
import { calculatePlayerMarketValue } from '../../systems/contractSystem';
import { useColors, spacing } from '../theme';
import type { Player, LoanTerms, LoanOffer, ActiveLoan } from '../../data/types';

interface ConnectedLoanMarketScreenProps {
  /** Callback when offer is made (for navigation) */
  onOfferMade?: () => void;
  /** Navigate to player detail screen */
  onPlayerPress?: (playerId: string) => void;
}

export function ConnectedLoanMarketScreen({
  onOfferMade,
  onPlayerPress,
}: ConnectedLoanMarketScreenProps) {
  const colors = useColors();
  const {
    state,
    makeLoanOffer,
    respondToLoanOffer,
    counterLoanOffer,
    acceptCounterLoanOffer,
    recallLoan,
    exerciseBuyOption,
    unlistPlayerForLoan,
    getLoanListedPlayers,
    getActiveLoans,
    getIncomingLoanOffers,
    getOutgoingLoanOffers,
  } = useGame();

  // Convert Player to LoanTarget
  const convertToTarget = useCallback((player: Player): LoanTarget => {
    const overall = calculatePlayerOverall(player);
    const marketValue = calculatePlayerMarketValue(player);
    const weeklySalary = player.contract?.salary ? player.contract.salary / 52 : 0;
    const recommendedLoanFee = calculateRecommendedLoanFee(
      marketValue,
      16, // Default medium duration
      player.age,
      player.age < 24 // Youth development for young players
    );

    const team = state.league.teams.find((t) => t.rosterIds.includes(player.id));

    return {
      id: player.id,
      name: player.name,
      overall,
      age: player.age,
      salary: player.contract?.salary || 0,
      team: team?.name || 'Unknown',
      teamId: team?.id || '',
      recommendedLoanFee,
      weeklySalary,
    };
  }, [state.league.teams]);

  // Convert Player to LoanListPlayer (user's players listed for loan)
  const convertToLoanListPlayer = useCallback((player: Player): LoanListPlayer => {
    const overall = calculatePlayerOverall(player);
    const weeklySalary = player.contract?.salary ? player.contract.salary / 52 : 0;

    return {
      id: player.id,
      name: player.name,
      overall,
      age: player.age,
      salary: player.contract?.salary || 0,
      weeklySalary,
    };
  }, []);

  // Convert LoanOffer to IncomingLoanOffer
  const convertToIncomingOffer = useCallback((offer: LoanOffer): IncomingLoanOffer | null => {
    const player = state.players[offer.playerId];
    if (!player) return null;

    const fromTeam = state.league.teams.find((t) => t.id === offer.offeringTeamId);

    // Calculate expiry (2 weeks from creation)
    const weeksUntilExpiry = Math.max(0, offer.expiryWeek - state.season.currentWeek);

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
      terms: offer.terms,
      status: offer.status as 'pending' | 'accepted' | 'rejected' | 'countered',
      expiresIn: weeksUntilExpiry,
    };
  }, [state.players, state.league.teams, state.season.currentWeek]);

  // Convert LoanOffer to OutgoingLoanOffer
  const convertToOutgoingOffer = useCallback((offer: LoanOffer): OutgoingLoanOffer | null => {
    const player = state.players[offer.playerId];
    if (!player) return null;

    const toTeam = state.league.teams.find((t) => t.id === offer.receivingTeamId);

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
      terms: offer.terms,
      status: offer.status as 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired',
      counterTerms: offer.counterTerms,
    };
  }, [state.players, state.league.teams]);

  // Convert ActiveLoan to ActiveLoanDisplay
  const convertToActiveLoan = useCallback((loan: ActiveLoan): ActiveLoanDisplay | null => {
    const player = state.players[loan.playerId];
    if (!player) return null;

    const isLoanedIn = loan.loanClubId === state.userTeam.id;
    const otherTeamId = isLoanedIn ? loan.parentClubId : loan.loanClubId;
    const otherTeam = state.league.teams.find((t) => t.id === otherTeamId);

    // Calculate weeks remaining
    const weeksRemaining = Math.max(0, loan.terms.endWeek - state.season.currentWeek);

    // Check if recall is possible
    const canRecall = !isLoanedIn &&
      loan.terms.recallClause !== undefined &&
      (state.season.currentWeek - loan.startWeek) >= loan.terms.recallClause.minWeeksBeforeRecall;

    // Check if buy option can be exercised (loan club only, with optional buy option)
    const canExerciseBuyOption = isLoanedIn &&
      loan.terms.buyOption !== undefined &&
      !loan.terms.buyOption.mandatory; // Mandatory ones execute automatically

    return {
      id: loan.id,
      player: {
        id: player.id,
        name: player.name,
        overall: calculatePlayerOverall(player),
        age: player.age,
        salary: player.contract?.salary || 0,
      },
      otherTeam: otherTeam?.name || 'Unknown Team',
      terms: loan.terms,
      weeksRemaining,
      isLoanedIn,
      canRecall,
      canExerciseBuyOption,
      appearances: loan.appearances,
    };
  }, [state.players, state.league.teams, state.userTeam.id, state.season.currentWeek]);

  // Get loan-listed players from other teams
  const loanTargets = useMemo((): LoanTarget[] => {
    if (!state.initialized) return [];

    const loanListedPlayers = getLoanListedPlayers();
    // Filter out user's own players
    const otherTeamsPlayers = loanListedPlayers.filter(
      (p) => p.teamId !== state.userTeam.id
    );

    return otherTeamsPlayers.map(convertToTarget);
  }, [state.initialized, getLoanListedPlayers, convertToTarget, state.userTeam.id]);

  // Get user's players listed for loan
  const loanListedPlayers = useMemo((): LoanListPlayer[] => {
    if (!state.initialized) return [];

    // Get player IDs from loan state that belong to user
    const userLoanListedIds = state.loans.loanListedPlayerIds.filter((id) => {
      const player = state.players[id];
      return player && player.teamId === state.userTeam.id;
    });

    return userLoanListedIds
      .map((id) => state.players[id])
      .filter((p): p is Player => p !== undefined)
      .map(convertToLoanListPlayer);
  }, [state.initialized, state.loans.loanListedPlayerIds, state.players, state.userTeam.id, convertToLoanListPlayer]);

  // Get incoming loan offers
  const incomingOffers = useMemo((): IncomingLoanOffer[] => {
    if (!state.initialized) return [];

    const offers = getIncomingLoanOffers();
    return offers
      .map(convertToIncomingOffer)
      .filter((offer): offer is IncomingLoanOffer => offer !== null);
  }, [state.initialized, getIncomingLoanOffers, convertToIncomingOffer]);

  // Get outgoing loan offers
  const outgoingOffers = useMemo((): OutgoingLoanOffer[] => {
    if (!state.initialized) return [];

    const offers = getOutgoingLoanOffers();
    return offers
      .map(convertToOutgoingOffer)
      .filter((offer): offer is OutgoingLoanOffer => offer !== null);
  }, [state.initialized, getOutgoingLoanOffers, convertToOutgoingOffer]);

  // Get active loans
  const activeLoans = useMemo((): ActiveLoanDisplay[] => {
    if (!state.initialized) return [];

    const loans = getActiveLoans();
    return loans
      .map(convertToActiveLoan)
      .filter((loan): loan is ActiveLoanDisplay => loan !== null);
  }, [state.initialized, getActiveLoans, convertToActiveLoan]);

  // Handle making a loan offer
  const handleMakeLoanOffer = useCallback((target: LoanTarget, terms: LoanTerms) => {
    makeLoanOffer(target.id, target.teamId, terms);
    onOfferMade?.();
  }, [makeLoanOffer, onOfferMade]);

  // Handle accepting an incoming offer
  const handleAcceptOffer = useCallback((offer: IncomingLoanOffer) => {
    respondToLoanOffer(offer.id, true);
  }, [respondToLoanOffer]);

  // Handle rejecting an incoming offer
  const handleRejectOffer = useCallback((offer: IncomingLoanOffer) => {
    respondToLoanOffer(offer.id, false);
  }, [respondToLoanOffer]);

  // Handle counter offer
  const handleCounterOffer = useCallback((offer: IncomingLoanOffer, counterTerms: LoanTerms) => {
    counterLoanOffer(offer.id, counterTerms);
  }, [counterLoanOffer]);

  // Handle accepting a counter offer
  const handleAcceptCounter = useCallback((offer: OutgoingLoanOffer) => {
    if (offer.counterTerms) {
      // Accept the counter offer (which also auto-completes the loan)
      acceptCounterLoanOffer(offer.id);
    }
  }, [acceptCounterLoanOffer]);

  // Handle withdrawing an offer
  const handleWithdrawOffer = useCallback((_offer: OutgoingLoanOffer) => {
    // For now, we don't have a withdraw action - offers expire naturally
    console.log('Withdraw loan offer not implemented - offer will expire naturally');
  }, []);

  // Handle removing from loan list
  const handleRemoveFromLoanList = useCallback((playerId: string) => {
    unlistPlayerForLoan(playerId);
  }, [unlistPlayerForLoan]);

  // Handle recalling a loan
  const handleRecallLoan = useCallback((loanId: string) => {
    recallLoan(loanId);
  }, [recallLoan]);

  // Handle exercising buy option
  const handleExerciseBuyOption = useCallback((loanId: string) => {
    exerciseBuyOption(loanId);
  }, [exerciseBuyOption]);

  // Get user's available budget
  const userBudget = state.userTeam.availableBudget;

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading loan market...
        </Text>
      </View>
    );
  }

  return (
    <LoanMarketScreen
      userBudget={userBudget}
      loanTargets={loanTargets}
      loanListedPlayers={loanListedPlayers}
      incomingOffers={incomingOffers}
      outgoingOffers={outgoingOffers}
      activeLoans={activeLoans}
      onMakeLoanOffer={handleMakeLoanOffer}
      onAcceptOffer={handleAcceptOffer}
      onRejectOffer={handleRejectOffer}
      onCounterOffer={handleCounterOffer}
      onAcceptCounter={handleAcceptCounter}
      onWithdrawOffer={handleWithdrawOffer}
      onRemoveFromLoanList={handleRemoveFromLoanList}
      onRecallLoan={handleRecallLoan}
      onExerciseBuyOption={handleExerciseBuyOption}
      onPlayerPress={onPlayerPress}
      currentWeek={state.season.currentWeek}
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

export default ConnectedLoanMarketScreen;
