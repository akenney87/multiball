/**
 * AI Loan Manager
 *
 * Handles AI decision-making for loans:
 * - Which players to loan out (parent club perspective)
 * - Which players to loan in (loan club perspective)
 * - Responding to loan offers
 * - Exercising buy options
 * - Recalling players early
 *
 * Design Philosophy:
 * - Youth development: AI teams loan out young players for playing time
 * - Wage management: AI teams offload high-wage players they can't afford
 * - Gap filling: AI teams loan in players to fill positional needs cheaply
 * - Quality boost: Contending teams loan in quality players for push
 */

import type { Player, AIPersonality, LoanTerms, LoanOffer, ActiveLoan } from '../data/types';
import type { Position } from './types';
import { calculateAllOveralls } from '../utils/overallRating';
import {
  calculateRecommendedLoanFee,
  calculateRecommendedWageContribution,
  calculateBuyOptionPrice,
  LOAN_DURATION_OPTIONS,
} from '../systems/loanSystem';
import { calculatePlayerValuation } from '../systems/contractSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum loan-out candidates per team per week */
export const MAX_LOAN_OUTS_PER_WEEK = 1;

/** Maximum loan-in pursuits per team per week */
export const MAX_LOAN_INS_PER_WEEK = 1;

/** Age range for youth development loans */
export const YOUTH_LOAN_AGE_MIN = 18;
export const YOUTH_LOAN_AGE_MAX = 23;

/** Minimum playing time (minutes per game) threshold for considering loan out */
export const MIN_PLAYING_TIME_THRESHOLD = 15;

/** Division gap for development partnership loans */
export const DEVELOPMENT_PARTNERSHIP_DIVISION_GAP = 3;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Loan-out candidate (parent club perspective)
 */
export interface LoanCandidate {
  playerId: string;
  playerName: string;
  reason: LoanOutReason;
  priority: 'high' | 'medium' | 'low';
  suggestedTerms: Partial<LoanTerms>;
}

/**
 * Reasons for loaning out a player
 */
export type LoanOutReason =
  | 'youth_development'
  | 'blocked_by_star'
  | 'wage_offload'
  | 'returning_from_injury'
  | 'no_permanent_buyer';

/**
 * Loan-in target (loan club perspective)
 */
export interface LoanTarget {
  playerId: string;
  playerName: string;
  parentClubId: string;
  reason: LoanInReason;
  priority: 'high' | 'medium' | 'low';
  maxLoanFee: number;
  maxWageContribution: number; // What loan club will pay (100 - this = parent pays)
}

/**
 * Reasons for loaning in a player
 */
export type LoanInReason =
  | 'position_gap'
  | 'quality_boost'
  | 'development_partnership'
  | 'injury_cover';

/**
 * AI loan offer intent
 */
export interface AILoanOffer {
  targetPlayerId: string;
  targetTeamId: string;
  terms: LoanTerms;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * AI loan offer response
 */
export interface AILoanResponse {
  offerId: string;
  decision: 'accept' | 'reject' | 'counter';
  counterTerms?: LoanTerms;
  reason: string;
}

/**
 * Context for AI loan decisions
 */
export interface AILoanContext {
  teamId: string;
  teamName: string;
  personality: AIPersonality;
  roster: Player[];
  budget: number;
  division: number;
  leaguePosition: number;
  currentWeek: number;
  seasonEndWeek: number;
  weeksRemaining: number;
  isInPromotionRace: boolean;
  isInRelegationBattle: boolean;
  salaryCommitment: number;
  positionNeeds: Position[];
  playersLoanedOut: ActiveLoan[];
  playersLoanedIn: ActiveLoan[];
}

/**
 * Full AI loan weekly actions
 */
export interface AILoanWeeklyActions {
  loanOffers: AILoanOffer[];
  loanOfferResponses: AILoanResponse[];
  loanRecalls: Array<{ loanId: string; reason: string }>;
  buyOptionExercises: Array<{ loanId: string; reason: string }>;
  playersToLoanList: string[];
}

// =============================================================================
// LOAN OUT LOGIC (Parent Club Perspective)
// =============================================================================

/**
 * Identify players that should be loaned out
 */
export function identifyLoanCandidates(
  roster: Player[],
  personality: AIPersonality,
  context: AILoanContext
): LoanCandidate[] {
  const candidates: LoanCandidate[] = [];

  // Sort roster by overall to determine depth
  const sortedRoster = [...roster].sort((a, b) => {
    const aOverall = calculateAllOveralls(a).basketball;
    const bOverall = calculateAllOveralls(b).basketball;
    return bOverall - aOverall;
  });

  // Get average rating for comparison
  const avgRating = sortedRoster.reduce(
    (sum, p) => sum + calculateAllOveralls(p).basketball,
    0
  ) / Math.max(sortedRoster.length, 1);

  for (const player of sortedRoster) {
    // Skip players already on loan
    if (player.loanStatus?.isOnLoan) continue;

    // Skip players without contracts
    if (!player.contract) continue;

    const overalls = calculateAllOveralls(player);
    const rating = overalls.basketball;
    const age = player.age;
    const weeklySalary = player.contract.salary / 52;

    // 1. Youth Development: Age 18-23, above division min but below rotation avg
    if (
      age >= YOUTH_LOAN_AGE_MIN &&
      age <= YOUTH_LOAN_AGE_MAX &&
      rating > 35 && // Not too weak
      rating < avgRating - 5 // Not good enough for regular rotation
    ) {
      const youthFocus = personality.traits.youth_development_focus / 100;

      // Youth-focused teams are more likely to loan out
      if (youthFocus > 0.4 || rating < avgRating - 10) {
        candidates.push({
          playerId: player.id,
          playerName: player.name,
          reason: 'youth_development',
          priority: youthFocus > 0.6 ? 'high' : 'medium',
          suggestedTerms: {
            wageContribution: 50, // Split wages
            duration: { type: 'end_of_season' },
          },
        });
        continue;
      }
    }

    // 2. Blocked by Star: Within 10 rating of starter but can't break through
    const starterThreshold = avgRating + 5;
    if (rating >= starterThreshold - 10 && rating < starterThreshold && age <= 27) {
      // Player is good but blocked
      candidates.push({
        playerId: player.id,
        playerName: player.name,
        reason: 'blocked_by_star',
        priority: 'medium',
        suggestedTerms: {
          wageContribution: 25, // Loan club pays most
          buyOption: {
            price: calculateBuyOptionPrice(
              calculatePlayerValuation(rating, age, 60, 2).marketValue,
              age,
              60
            ),
            mandatory: false,
          },
        },
      });
      continue;
    }

    // 3. Wage Offload: High salary relative to budget, not in top 5
    const salaryRatio = (weeklySalary * 52) / Math.max(context.budget, 1);
    const playerRankByRating = sortedRoster.findIndex(p => p.id === player.id);

    if (salaryRatio > 0.15 && playerRankByRating >= 5) {
      // High earner not in top 5
      const spendingAggression = personality.traits.spending_aggression / 100;

      if (spendingAggression < 0.6 || context.budget < context.salaryCommitment * 1.1) {
        candidates.push({
          playerId: player.id,
          playerName: player.name,
          reason: 'wage_offload',
          priority: 'high',
          suggestedTerms: {
            wageContribution: 0, // Loan club pays all wages
            loanFee: 0, // No fee, just want wage relief
          },
        });
        continue;
      }
    }

    // 4. Returning from Injury: Just recovered, needs match fitness
    if (player.matchFitness < 70 && !player.injury && age <= 30) {
      candidates.push({
        playerId: player.id,
        playerName: player.name,
        reason: 'returning_from_injury',
        priority: 'low',
        suggestedTerms: {
          duration: { type: 'fixed', weeks: LOAN_DURATION_OPTIONS.SHORT },
          wageContribution: 50,
          recallClause: {
            minWeeksBeforeRecall: 4,
            recallFee: 50000,
          },
        },
      });
    }
  }

  // Limit candidates and sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return candidates
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, MAX_LOAN_OUTS_PER_WEEK * 3); // Keep some options
}

// =============================================================================
// LOAN IN LOGIC (Loan Club Perspective)
// =============================================================================

/**
 * Evaluate if team should pursue loaning in a player
 */
export function shouldPursueLoan(
  player: Player,
  context: AILoanContext
): { pursue: boolean; reason: LoanInReason | null; priority: 'high' | 'medium' | 'low' } {
  const overalls = calculateAllOveralls(player);
  const playerRating = overalls.basketball;

  // Get team's average rating
  const avgRating = context.roster.reduce(
    (sum, p) => sum + calculateAllOveralls(p).basketball,
    0
  ) / Math.max(context.roster.length, 1);

  // 1. Position Gap: Critical need, insufficient transfer budget
  if (context.positionNeeds.length > 0) {
    // Simplified position matching - in real implementation would check player.position
    if (playerRating >= avgRating - 10 && context.budget < 1000000) {
      return { pursue: true, reason: 'position_gap', priority: 'high' };
    }
  }

  // 2. Quality Boost: In promotion race, player above team avg
  if (context.isInPromotionRace && playerRating > avgRating + 5 && context.weeksRemaining <= 15) {
    return { pursue: true, reason: 'quality_boost', priority: 'high' };
  }

  // 3. Development Partnership: Lower division getting player from higher division
  // This would need parent club division info - simplified here
  if (player.age <= 23 && playerRating > avgRating && context.division >= 5) {
    return { pursue: true, reason: 'development_partnership', priority: 'medium' };
  }

  // 4. Injury Cover: Check if we have injuries (simplified)
  const injuredCount = context.roster.filter(p => p.injury !== null).length;
  if (injuredCount >= 2 && playerRating >= avgRating - 5) {
    return { pursue: true, reason: 'injury_cover', priority: 'medium' };
  }

  return { pursue: false, reason: null, priority: 'low' };
}

/**
 * Generate loan offer terms from loan club perspective
 */
export function generateLoanOfferTerms(
  player: Player,
  context: AILoanContext,
  reason: LoanInReason
): LoanTerms {
  const overalls = calculateAllOveralls(player);
  const playerRating = overalls.basketball;

  // Estimate market value
  const marketValue = calculatePlayerValuation(
    playerRating,
    player.age,
    60, // Estimate potential
    2   // Estimate sports above 50
  ).marketValue;

  // Calculate duration based on context
  let duration: LoanTerms['duration'];
  if (reason === 'quality_boost' && context.weeksRemaining <= 15) {
    duration = { type: 'end_of_season' };
  } else if (reason === 'injury_cover') {
    duration = { type: 'fixed', weeks: LOAN_DURATION_OPTIONS.MEDIUM };
  } else {
    duration = { type: 'end_of_season' };
  }

  const endWeek = duration.type === 'end_of_season'
    ? context.seasonEndWeek
    : context.currentWeek + duration.weeks;

  // Calculate loan fee
  const loanFee = calculateRecommendedLoanFee(
    marketValue,
    endWeek - context.currentWeek,
    player.age,
    player.age <= 23
  );

  // Wage contribution - what percentage parent pays
  // Loan club wants parent to pay more
  const playerWeeklySalary = player.contract ? player.contract.salary / 52 : 0;
  const wageContribution = calculateRecommendedWageContribution(
    playerWeeklySalary,
    context.budget,
    50 // Neutral parent motivation
  );

  // Build terms
  const terms: LoanTerms = {
    loanFee: Math.round(loanFee * 0.8), // Offer below recommended
    wageContribution: Math.min(wageContribution + 10, 100), // Ask parent to pay a bit more
    duration,
    startWeek: context.currentWeek,
    endWeek,
  };

  // Add buy option for young high-potential players
  if (player.age <= 23 && playerRating >= 50) {
    terms.buyOption = {
      price: calculateBuyOptionPrice(marketValue, player.age, 65),
      mandatory: false,
    };
  }

  return terms;
}

// =============================================================================
// RESPONSE TO LOAN OFFERS
// =============================================================================

/**
 * Evaluate incoming loan offer (as parent club)
 */
export function evaluateLoanOfferAsAI(
  offer: LoanOffer,
  player: Player,
  context: AILoanContext
): AILoanResponse {
  const overalls = calculateAllOveralls(player);
  const playerRating = overalls.basketball;

  // Get team average to determine if player is needed
  const avgRating = context.roster.reduce(
    (sum, p) => sum + calculateAllOveralls(p).basketball,
    0
  ) / Math.max(context.roster.length, 1);

  // Key player check - don't loan out top performers
  const isKeyPlayer = playerRating >= avgRating + 10;
  if (isKeyPlayer && !context.isInRelegationBattle) {
    return {
      offerId: offer.id,
      decision: 'reject',
      reason: 'Player is too important to loan out',
    };
  }

  // Youth development focus
  const youthFocus = context.personality.traits.youth_development_focus / 100;

  // Young player not getting time - want them to develop
  if (player.age <= 23 && playerRating < avgRating && youthFocus > 0.4) {
    // Accept reasonable terms
    const minWageContribution = 25; // Parent willing to pay up to 75% of wages
    if (offer.terms.wageContribution >= minWageContribution) {
      return {
        offerId: offer.id,
        decision: 'accept',
        reason: 'Good development opportunity for young player',
      };
    } else {
      // Counter with higher wage contribution from parent
      return {
        offerId: offer.id,
        decision: 'counter',
        counterTerms: { ...offer.terms, wageContribution: minWageContribution },
        reason: `We need at least ${100 - minWageContribution}% wage contribution from loan club`,
      };
    }
  }

  // Wage offload situation
  if (player.contract) {
    const weeklySalary = player.contract.salary / 52;
    const salaryRatio = (weeklySalary * 52) / Math.max(context.budget, 1);

    if (salaryRatio > 0.15) {
      // High earner - accept if loan club takes most wages
      if (offer.terms.wageContribution <= 25) {
        return {
          offerId: offer.id,
          decision: 'accept',
          reason: 'Good wage relief opportunity',
        };
      }
    }
  }

  // Default: accept if terms are reasonable
  const expectedLoanFee = calculateRecommendedLoanFee(
    calculatePlayerValuation(playerRating, player.age, 60, 2).marketValue,
    offer.terms.endWeek - offer.terms.startWeek,
    player.age,
    player.age <= 23
  );

  if (offer.terms.loanFee >= expectedLoanFee * 0.7) {
    return {
      offerId: offer.id,
      decision: 'accept',
      reason: 'Terms are acceptable',
    };
  }

  // Counter with higher fee
  return {
    offerId: offer.id,
    decision: 'counter',
    counterTerms: { ...offer.terms, loanFee: expectedLoanFee },
    reason: 'Loan fee too low',
  };
}

// =============================================================================
// BUY OPTION & RECALL DECISIONS
// =============================================================================

/**
 * Decide whether to exercise buy option
 */
export function shouldExerciseBuyOption(
  loan: ActiveLoan,
  player: Player,
  context: AILoanContext
): { exercise: boolean; reason: string } {
  if (!loan.terms.buyOption) {
    return { exercise: false, reason: 'No buy option available' };
  }

  // Check if we can afford it
  if (context.budget < loan.terms.buyOption.price) {
    return { exercise: false, reason: 'Cannot afford buy option' };
  }

  const overalls = calculateAllOveralls(player);
  const playerRating = overalls.basketball;

  // Get team average
  const avgRating = context.roster.reduce(
    (sum, p) => sum + calculateAllOveralls(p).basketball,
    0
  ) / Math.max(context.roster.length, 1);

  // Player performed well (above team average) - buy
  if (playerRating > avgRating + 5) {
    return { exercise: true, reason: 'Player has been excellent, worth buying permanently' };
  }

  // Young player with potential - buy
  if (player.age <= 23 && playerRating >= avgRating - 5) {
    const youthFocus = context.personality.traits.youth_development_focus / 100;
    if (youthFocus > 0.5) {
      return { exercise: true, reason: 'Young player with potential, good investment' };
    }
  }

  // Check if mandatory
  if (loan.terms.buyOption.mandatory) {
    // Check condition if exists
    if (loan.terms.buyOption.mandatoryCondition) {
      const { type, threshold } = loan.terms.buyOption.mandatoryCondition;
      if (type === 'appearances') {
        const totalAppearances =
          loan.appearances.basketball +
          loan.appearances.baseball +
          loan.appearances.soccer;
        if (totalAppearances >= threshold) {
          return { exercise: true, reason: 'Mandatory buy option triggered by appearances' };
        }
        return { exercise: false, reason: 'Mandatory condition not met' };
      }
    }
    // Mandatory with no condition
    return { exercise: true, reason: 'Mandatory buy option - must purchase' };
  }

  return { exercise: false, reason: 'Player did not meet expectations for permanent signing' };
}

/**
 * Decide whether to recall a player from loan
 */
export function shouldRecallFromLoan(
  loan: ActiveLoan,
  player: Player,
  context: AILoanContext
): { recall: boolean; reason: string } {
  // Check if recall clause exists
  if (!loan.terms.recallClause) {
    return { recall: false, reason: 'No recall clause' };
  }

  // Check minimum weeks
  const weeksElapsed = context.currentWeek - loan.startWeek;
  if (weeksElapsed < loan.terms.recallClause.minWeeksBeforeRecall) {
    return { recall: false, reason: 'Too early to recall' };
  }

  // Check if we can afford recall fee
  if (context.budget < loan.terms.recallClause.recallFee) {
    return { recall: false, reason: 'Cannot afford recall fee' };
  }

  // Injury cover needed back home
  const homeInjuries = context.roster.filter(p => p.injury !== null).length;
  if (homeInjuries >= 3) {
    return { recall: true, reason: 'Multiple injuries at parent club, need player back' };
  }

  // Player has improved significantly (simplified check)
  const overalls = calculateAllOveralls(player);
  if (overalls.basketball > 70 && player.age <= 25) {
    return { recall: true, reason: 'Player has developed well, ready for first team' };
  }

  return { recall: false, reason: 'No pressing need to recall' };
}

// =============================================================================
// MAIN WEEKLY PROCESSING
// =============================================================================

/**
 * Process all AI loan decisions for a week
 */
export function processAILoanWeek(
  context: AILoanContext,
  availableLoanPlayers: Player[],
  incomingLoanOffers: LoanOffer[],
  currentLoansAsParent: ActiveLoan[],
  currentLoansAsLoanClub: ActiveLoan[]
): AILoanWeeklyActions {
  const actions: AILoanWeeklyActions = {
    loanOffers: [],
    loanOfferResponses: [],
    loanRecalls: [],
    buyOptionExercises: [],
    playersToLoanList: [],
  };

  // 1. Identify players to loan out
  const loanCandidates = identifyLoanCandidates(
    context.roster,
    context.personality,
    context
  );

  // Add top candidates to loan list
  for (const candidate of loanCandidates.slice(0, MAX_LOAN_OUTS_PER_WEEK)) {
    actions.playersToLoanList.push(candidate.playerId);
  }

  // 2. Look for players to loan in
  for (const player of availableLoanPlayers) {
    if (actions.loanOffers.length >= MAX_LOAN_INS_PER_WEEK) break;

    const { pursue, reason } = shouldPursueLoan(player, context);
    if (pursue && reason) {
      const terms = generateLoanOfferTerms(player, context, reason);
      actions.loanOffers.push({
        targetPlayerId: player.id,
        targetTeamId: player.teamId,
        terms,
        priority: 'medium',
        reason: `Loan in for ${reason.replace('_', ' ')}`,
      });
    }
  }

  // 3. Respond to incoming loan offers
  for (const offer of incomingLoanOffers) {
    const player = context.roster.find(p => p.id === offer.playerId);
    if (!player) continue;

    const response = evaluateLoanOfferAsAI(offer, player, context);
    actions.loanOfferResponses.push(response);
  }

  // 4. Check recall decisions for players we've loaned out
  for (const loan of currentLoansAsParent) {
    const player = context.roster.find(p => p.id === loan.playerId);
    if (!player) continue;

    const { recall, reason } = shouldRecallFromLoan(loan, player, context);
    if (recall) {
      actions.loanRecalls.push({ loanId: loan.id, reason });
    }
  }

  // 5. Check buy option decisions for players we've loaned in
  for (const loan of currentLoansAsLoanClub) {
    const player = context.roster.find(p => p.id === loan.playerId);
    if (!player) continue;

    const { exercise, reason } = shouldExerciseBuyOption(loan, player, context);
    if (exercise) {
      actions.buyOptionExercises.push({ loanId: loan.id, reason });
    }
  }

  return actions;
}
