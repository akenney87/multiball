/**
 * Loan System
 *
 * Manages player loans between teams (FM-style).
 * - Loan fee calculation
 * - Wage contribution negotiation
 * - Buy option pricing
 * - Recall clause management
 * - Loan eligibility checks
 * - Loan lifecycle management
 *
 * Design Philosophy:
 * - Uses weeks for all durations (consistent with transfer system)
 * - Parent club owns player, loan club gets temporary use
 * - Wage split negotiated between clubs
 * - Optional buy options can be mandatory or optional
 * - Recall clauses protect parent club interests
 */

import { v4 as uuid } from 'uuid';
import type {
  Player,
  LoanDuration,
  LoanTerms,
  LoanOffer,
  ActiveLoan,
  PlayerLoanStatus,
  Contract,
} from '../data/types';
import { calculatePlayerValuation } from './contractSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Standard loan durations in weeks */
export const LOAN_DURATION_OPTIONS = {
  SHORT: 8,      // ~2 months
  MEDIUM: 16,    // ~4 months
  LONG: 24,      // ~6 months
  SEASON: 40,    // Full season
};

/** Loan fee as percentage of market value by duration */
export const LOAN_FEE_PERCENTAGES = {
  SHORT: 0.02,   // 2% of market value
  MEDIUM: 0.05,  // 5% of market value
  LONG: 0.08,    // 8% of market value
  SEASON: 0.10,  // 10% of market value
};

/** Default wage contribution (parent pays this percentage) */
export const DEFAULT_WAGE_CONTRIBUTION = 50;

/** Minimum recall clause duration in weeks */
export const MIN_RECALL_WEEKS = 4;

/** Default recall fee as percentage of loan fee */
export const DEFAULT_RECALL_FEE_PERCENTAGE = 0.5;

/** Buy option price as percentage of market value */
export const BUY_OPTION_MULTIPLIER = {
  MIN: 0.8,     // 80% of market value (discount for loan club)
  DEFAULT: 1.0, // 100% of market value (fair price)
  MAX: 1.5,     // 150% of market value (premium if player performs well)
};

/** Loan offer expiry in weeks */
export const LOAN_OFFER_EXPIRY_WEEKS = 2;

// =============================================================================
// VALUATION FUNCTIONS
// =============================================================================

/**
 * Calculate recommended loan fee based on player value and loan duration
 *
 * @param playerMarketValue - Player's market value
 * @param durationWeeks - Loan duration in weeks
 * @param playerAge - Player's age (youth development loans get discount)
 * @param isYouthDevelopment - Whether this is primarily for development
 * @returns Recommended loan fee
 */
export function calculateRecommendedLoanFee(
  playerMarketValue: number,
  durationWeeks: number,
  playerAge: number,
  isYouthDevelopment: boolean = false
): number {
  // Determine fee percentage based on duration
  let feePercentage: number;
  if (durationWeeks <= LOAN_DURATION_OPTIONS.SHORT) {
    feePercentage = LOAN_FEE_PERCENTAGES.SHORT;
  } else if (durationWeeks <= LOAN_DURATION_OPTIONS.MEDIUM) {
    feePercentage = LOAN_FEE_PERCENTAGES.MEDIUM;
  } else if (durationWeeks <= LOAN_DURATION_OPTIONS.LONG) {
    feePercentage = LOAN_FEE_PERCENTAGES.LONG;
  } else {
    feePercentage = LOAN_FEE_PERCENTAGES.SEASON;
  }

  // Youth development loans get 50% discount on loan fee
  if (isYouthDevelopment && playerAge <= 23) {
    feePercentage *= 0.5;
  }

  return Math.round(playerMarketValue * feePercentage);
}

/**
 * Calculate recommended wage contribution (percentage parent club pays)
 *
 * @param playerWeeklySalary - Player's weekly salary
 * @param loanClubBudget - Loan club's available budget
 * @param parentClubMotivation - How motivated parent is to loan out (0-100)
 * @returns Recommended wage contribution percentage (0-100)
 */
export function calculateRecommendedWageContribution(
  playerWeeklySalary: number,
  loanClubBudget: number,
  parentClubMotivation: number
): number {
  // If loan club can easily afford full salary, parent contributes less
  const affordabilityRatio = loanClubBudget / (playerWeeklySalary * 40); // Annual affordability

  let baseContribution: number;
  if (affordabilityRatio > 10) {
    baseContribution = 0; // Loan club can easily afford
  } else if (affordabilityRatio > 5) {
    baseContribution = 25; // Parent contributes some
  } else if (affordabilityRatio > 2) {
    baseContribution = 50; // Split 50/50
  } else {
    baseContribution = 75; // Parent pays most
  }

  // Adjust for parent motivation (desperate parent pays more wages)
  const motivationAdjustment = (parentClubMotivation - 50) * 0.5; // -25 to +25
  baseContribution += motivationAdjustment;

  // Clamp to valid range
  return Math.max(0, Math.min(100, Math.round(baseContribution)));
}

/**
 * Calculate buy option price
 *
 * @param playerMarketValue - Player's market value
 * @param playerAge - Player's age
 * @param playerPotential - Player's average potential
 * @returns Recommended buy option price
 */
export function calculateBuyOptionPrice(
  playerMarketValue: number,
  playerAge: number,
  playerPotential: number
): number {
  let multiplier = BUY_OPTION_MULTIPLIER.DEFAULT;

  // Young players with high potential = premium
  if (playerAge <= 23 && playerPotential >= 70) {
    multiplier = BUY_OPTION_MULTIPLIER.MAX;
  }
  // Older players or low potential = discount
  else if (playerAge >= 30 || playerPotential < 50) {
    multiplier = BUY_OPTION_MULTIPLIER.MIN;
  }

  return Math.round(playerMarketValue * multiplier);
}

// =============================================================================
// ELIGIBILITY FUNCTIONS
// =============================================================================

export interface LoanEligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Check if a player can be loaned out
 *
 * @param player - The player to check
 * @param ownerTeamRosterSize - Owner team's current roster size
 * @returns Eligibility result
 */
export function canPlayerBeLoaned(
  player: Player,
  ownerTeamRosterSize: number
): LoanEligibilityResult {
  // Already on loan
  if (player.loanStatus?.isOnLoan) {
    return { eligible: false, reason: 'Player is already on loan' };
  }

  // No contract (free agent)
  if (!player.contract) {
    return { eligible: false, reason: 'Player has no contract' };
  }

  // Contract expiring too soon (less than the loan duration)
  const contractWeeksRemaining = getContractWeeksRemaining(player.contract);
  if (contractWeeksRemaining < LOAN_DURATION_OPTIONS.SHORT) {
    return { eligible: false, reason: 'Contract expires too soon' };
  }

  // Team needs minimum roster
  if (ownerTeamRosterSize <= 15) {
    return { eligible: false, reason: 'Team needs minimum roster size' };
  }

  // Injured players can still be loaned (common in real football)
  // Just a warning, not a blocker

  return { eligible: true };
}

/**
 * Check if a team can loan in a player
 *
 * @param teamBudget - Team's available budget
 * @param terms - Proposed loan terms
 * @param teamRosterSize - Team's current roster size
 * @param maxRosterSize - Maximum roster size (default 30)
 * @returns Eligibility result
 */
export function canTeamLoanIn(
  teamBudget: number,
  terms: LoanTerms,
  teamRosterSize: number,
  maxRosterSize: number = 30
): LoanEligibilityResult {
  // Check roster space
  if (teamRosterSize >= maxRosterSize) {
    return { eligible: false, reason: 'Roster is full' };
  }

  // Check can afford loan fee
  if (teamBudget < terms.loanFee) {
    return { eligible: false, reason: 'Cannot afford loan fee' };
  }

  return { eligible: true };
}

/**
 * Get weeks remaining on a contract
 */
function getContractWeeksRemaining(contract: Contract): number {
  const now = new Date();
  const expiry = new Date(contract.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
}

// =============================================================================
// OFFER EVALUATION
// =============================================================================

export interface LoanOfferEvaluation {
  decision: 'accept' | 'reject' | 'counter';
  reason: string;
  counterTerms?: Partial<LoanTerms>;
}

/**
 * Evaluate a loan offer from the parent club's perspective
 *
 * @param offer - The loan offer
 * @param player - The player being loaned
 * @param parentClubContext - Context about the parent club
 * @returns Evaluation result
 */
export function evaluateLoanOfferAsParent(
  offer: LoanOffer,
  player: Player,
  parentClubContext: {
    wantsToLoan: boolean;
    needsWageRelief: boolean;
    playerIsKeyPlayer: boolean;
    playerAge: number;
  }
): LoanOfferEvaluation {
  const { wantsToLoan, needsWageRelief, playerIsKeyPlayer, playerAge } = parentClubContext;

  // Key player - reject unless desperate
  if (playerIsKeyPlayer && !needsWageRelief) {
    return {
      decision: 'reject',
      reason: 'Player is too important to loan out',
    };
  }

  // Check wage contribution - parent club wants loan club to pay more
  const desiredWageContribution = needsWageRelief ? 25 : 50;
  if (offer.terms.wageContribution > desiredWageContribution + 20) {
    return {
      decision: 'counter',
      reason: 'Want loan club to pay more wages',
      counterTerms: { wageContribution: desiredWageContribution },
    };
  }

  // Check loan fee for valuable players
  if (player.contract) {
    const playerValue = calculatePlayerValuation(
      50, // Approximate overall
      playerAge,
      60, // Approximate potential
      2   // Approximate sports above 50
    ).marketValue;

    const minimumFee = calculateRecommendedLoanFee(playerValue, offer.terms.endWeek - offer.terms.startWeek, playerAge, playerAge <= 23);

    if (offer.terms.loanFee < minimumFee * 0.5 && !needsWageRelief) {
      return {
        decision: 'counter',
        reason: 'Loan fee too low',
        counterTerms: { loanFee: minimumFee },
      };
    }
  }

  // Youth development - prefer buy option for protection
  if (playerAge <= 21 && !offer.terms.buyOption) {
    // Still accept, but note concern
  }

  // Accept if wanting to loan out
  if (wantsToLoan) {
    return { decision: 'accept', reason: 'Terms acceptable for player development' };
  }

  // Otherwise accept if terms are good
  return { decision: 'accept', reason: 'Terms acceptable' };
}

/**
 * Evaluate if a team should pursue loaning in a player
 *
 * @param playerOverall - Player's overall rating
 * @param playerAge - Player's age
 * @param teamNeedsPosition - Whether team needs this position
 * @param teamBudget - Team's available budget
 * @param terms - Proposed terms
 * @returns Whether to pursue and suggested terms
 */
export function evaluateLoanOpportunity(
  playerOverall: number,
  playerAge: number,
  teamNeedsPosition: boolean,
  teamBudget: number,
  _terms: LoanTerms
): { interested: boolean; proposedTerms?: LoanTerms; reason: string } {
  // Not interested if don't need the position
  if (!teamNeedsPosition) {
    return { interested: false, reason: 'No positional need' };
  }

  // Check affordability
  // Simplified check - would need actual terms calculation
  if (teamBudget < 100000) {
    return { interested: false, reason: 'Insufficient budget' };
  }

  // Quality check - want players above team average
  if (playerOverall < 40) {
    return { interested: false, reason: 'Player quality too low' };
  }

  // Prefer younger players for development
  const isYouthLoan = playerAge <= 23;

  return {
    interested: true,
    reason: isYouthLoan ? 'Good youth development opportunity' : 'Quality reinforcement',
  };
}

// =============================================================================
// LOAN LIFECYCLE
// =============================================================================

/**
 * Create a loan offer
 *
 * @param offeringTeamId - Team wanting to borrow (loan club)
 * @param receivingTeamId - Team that owns player (parent club)
 * @param playerId - Player being loaned
 * @param terms - Proposed loan terms
 * @param currentWeek - Current week number
 * @returns New loan offer
 */
export function createLoanOffer(
  offeringTeamId: string,
  receivingTeamId: string,
  playerId: string,
  terms: LoanTerms,
  currentWeek: number
): LoanOffer {
  return {
    id: uuid(),
    offeringTeamId,
    receivingTeamId,
    playerId,
    terms,
    status: 'pending',
    createdWeek: currentWeek,
    expiryWeek: currentWeek + LOAN_OFFER_EXPIRY_WEEKS,
    negotiationHistory: [{ terms, from: offeringTeamId, week: currentWeek }],
  };
}

/**
 * Activate a loan (after offer accepted)
 *
 * @param player - Player being loaned
 * @param offer - Accepted loan offer
 * @param currentWeek - Current week
 * @param currentSeason - Current season number
 * @returns Updated player and active loan record
 */
export function activateLoan(
  player: Player,
  offer: LoanOffer,
  currentWeek: number,
  currentSeason: number
): { updatedPlayer: Player; activeLoan: ActiveLoan } {
  // Calculate wage split
  const playerWeeklySalary = player.contract ? player.contract.salary / 52 : 0;
  const parentAmount = Math.round(playerWeeklySalary * (offer.terms.wageContribution / 100));
  const loanClubAmount = playerWeeklySalary - parentAmount;

  // Create active loan record
  const activeLoan: ActiveLoan = {
    id: uuid(),
    playerId: player.id,
    parentClubId: offer.receivingTeamId,
    loanClubId: offer.offeringTeamId,
    terms: offer.terms,
    status: 'active',
    startWeek: currentWeek,
    startSeason: currentSeason,
    appearances: { basketball: 0, baseball: 0, soccer: 0 },
    buyOptionExercised: false,
    recalledEarly: false,
    weeklyWageResponsibility: {
      parentClubAmount: parentAmount,
      loanClubAmount: loanClubAmount,
    },
  };

  // Update player with loan status
  const loanStatus: PlayerLoanStatus = {
    isOnLoan: true,
    activeLoanId: activeLoan.id,
    parentClubId: offer.receivingTeamId,
    loanClubId: offer.offeringTeamId,
  };

  const updatedPlayer: Player = {
    ...player,
    teamId: offer.offeringTeamId, // Player now "plays for" loan club
    loanStatus,
  };

  return { updatedPlayer, activeLoan };
}

/**
 * Complete a loan (natural end)
 *
 * @param loan - Active loan
 * @param player - Player on loan
 * @returns Updated player and loan record
 */
export function completeLoan(
  loan: ActiveLoan,
  player: Player
): { updatedPlayer: Player; updatedLoan: ActiveLoan } {
  // Return player to parent club
  const updatedPlayer: Player = {
    ...player,
    teamId: loan.parentClubId,
    loanStatus: null,
  };

  const updatedLoan: ActiveLoan = {
    ...loan,
    status: 'completed',
  };

  return { updatedPlayer, updatedLoan };
}

/**
 * Recall a player from loan
 *
 * @param loan - Active loan
 * @param player - Player on loan
 * @param currentWeek - Current week
 * @returns Updated player, loan, and recall fee
 */
export function recallLoan(
  loan: ActiveLoan,
  player: Player,
  currentWeek: number
): { updatedPlayer: Player; updatedLoan: ActiveLoan; recallFee: number } | { error: string } {
  // Check if recall clause exists
  if (!loan.terms.recallClause) {
    return { error: 'No recall clause in loan terms' };
  }

  // Check minimum weeks elapsed
  const weeksElapsed = currentWeek - loan.startWeek;
  if (weeksElapsed < loan.terms.recallClause.minWeeksBeforeRecall) {
    return { error: `Cannot recall until week ${loan.startWeek + loan.terms.recallClause.minWeeksBeforeRecall}` };
  }

  // Return player to parent club
  const updatedPlayer: Player = {
    ...player,
    teamId: loan.parentClubId,
    loanStatus: null,
  };

  const updatedLoan: ActiveLoan = {
    ...loan,
    status: 'recalled',
    recalledEarly: true,
    recalledWeek: currentWeek,
  };

  return {
    updatedPlayer,
    updatedLoan,
    recallFee: loan.terms.recallClause.recallFee,
  };
}

/**
 * Exercise buy option on loan
 *
 * @param loan - Active loan
 * @param player - Player on loan
 * @returns Updated player, loan, and transfer fee, or error
 */
export function exerciseBuyOption(
  loan: ActiveLoan,
  player: Player
): { updatedPlayer: Player; updatedLoan: ActiveLoan; transferFee: number } | { error: string } {
  // Check if buy option exists
  if (!loan.terms.buyOption) {
    return { error: 'No buy option in loan terms' };
  }

  // Check if already exercised
  if (loan.buyOptionExercised) {
    return { error: 'Buy option already exercised' };
  }

  // Convert to permanent transfer
  const updatedPlayer: Player = {
    ...player,
    teamId: loan.loanClubId,
    loanStatus: null,
    // Contract will be updated by the calling code
  };

  const updatedLoan: ActiveLoan = {
    ...loan,
    status: 'bought',
    buyOptionExercised: true,
  };

  return {
    updatedPlayer,
    updatedLoan,
    transferFee: loan.terms.buyOption.price,
  };
}

/**
 * Check if mandatory buy option should be triggered
 *
 * @param loan - Active loan
 * @returns Whether mandatory buy should trigger
 */
export function checkMandatoryBuyOption(loan: ActiveLoan): boolean {
  if (!loan.terms.buyOption || !loan.terms.buyOption.mandatory) {
    return false;
  }

  // Check condition if exists
  if (loan.terms.buyOption.mandatoryCondition) {
    const { type, threshold } = loan.terms.buyOption.mandatoryCondition;
    if (type === 'appearances') {
      const totalAppearances =
        loan.appearances.basketball +
        loan.appearances.baseball +
        loan.appearances.soccer;
      return totalAppearances >= threshold;
    }
  }

  // Mandatory with no condition = always triggers at loan end
  return true;
}

/**
 * Record an appearance for playing time tracking
 *
 * @param loan - Active loan
 * @param sport - Sport the appearance was in
 * @returns Updated loan record
 */
export function recordLoanAppearance(
  loan: ActiveLoan,
  sport: 'basketball' | 'baseball' | 'soccer'
): ActiveLoan {
  return {
    ...loan,
    appearances: {
      ...loan.appearances,
      [sport]: loan.appearances[sport] + 1,
    },
  };
}

/**
 * Calculate playing time penalty (if clause not met)
 *
 * @param loan - Active loan
 * @returns Penalty amount (0 if clause met or no clause)
 */
export function calculatePlayingTimePenalty(loan: ActiveLoan): number {
  if (!loan.terms.playingTimeClause) {
    return 0;
  }

  const { minAppearances, sport, penaltyAmount } = loan.terms.playingTimeClause;

  let actualAppearances: number;
  if (sport === 'all') {
    actualAppearances =
      loan.appearances.basketball +
      loan.appearances.baseball +
      loan.appearances.soccer;
  } else {
    actualAppearances = loan.appearances[sport];
  }

  if (actualAppearances < minAppearances) {
    return penaltyAmount;
  }

  return 0;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create default loan terms
 *
 * @param startWeek - Loan start week
 * @param duration - Loan duration type or custom weeks
 * @param seasonEndWeek - Week the season ends (for end_of_season duration)
 * @returns Default loan terms
 */
export function createDefaultLoanTerms(
  startWeek: number,
  duration: LoanDuration,
  seasonEndWeek: number = 40
): Omit<LoanTerms, 'loanFee' | 'wageContribution'> {
  const endWeek = duration.type === 'end_of_season'
    ? seasonEndWeek
    : startWeek + duration.weeks;

  return {
    duration,
    startWeek,
    endWeek,
  };
}

/**
 * Check if loan has expired
 *
 * @param loan - Active loan
 * @param currentWeek - Current week
 * @returns Whether loan has expired
 */
export function isLoanExpired(loan: ActiveLoan, currentWeek: number): boolean {
  return currentWeek >= loan.terms.endWeek;
}

/**
 * Get loans expiring this week
 *
 * @param loans - All active loans
 * @param currentWeek - Current week
 * @returns Loans expiring this week
 */
export function getExpiringLoans(loans: ActiveLoan[], currentWeek: number): ActiveLoan[] {
  return loans.filter(loan => loan.status === 'active' && loan.terms.endWeek === currentWeek);
}

/**
 * Get loans for a specific team (as parent or loan club)
 *
 * @param loans - All loans
 * @param teamId - Team ID
 * @param role - Role to filter by (optional)
 * @returns Filtered loans
 */
export function getLoansForTeam(
  loans: ActiveLoan[],
  teamId: string,
  role?: 'parent' | 'loan_club'
): ActiveLoan[] {
  return loans.filter(loan => {
    if (role === 'parent') return loan.parentClubId === teamId;
    if (role === 'loan_club') return loan.loanClubId === teamId;
    return loan.parentClubId === teamId || loan.loanClubId === teamId;
  });
}

/**
 * Check if recall is allowed based on injury clause
 *
 * @param loan - Active loan
 * @param playerInjuryWeeks - How many weeks player has been injured
 * @returns Whether recall is allowed
 */
export function canRecallForInjury(loan: ActiveLoan, playerInjuryWeeks: number): boolean {
  if (!loan.terms.injuryClause) {
    return false;
  }
  return playerInjuryWeeks >= loan.terms.injuryClause.canRecallIfInjuredWeeks;
}

/**
 * Expire old loan offers
 *
 * @param offers - List of loan offers
 * @param currentWeek - Current week
 * @returns Updated offers with expired status
 */
export function expireOldLoanOffers(offers: LoanOffer[], currentWeek: number): LoanOffer[] {
  return offers.map(offer => {
    if (offer.status === 'pending' && currentWeek >= offer.expiryWeek) {
      return { ...offer, status: 'expired' as const };
    }
    return offer;
  });
}
