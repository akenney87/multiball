/**
 * AI Weekly Processor
 *
 * Processes AI teams each week to generate their actions.
 * Handles conflict resolution when multiple teams want the same player.
 *
 * Performance Strategy (200 teams):
 * - User's division (19 AI teams): Process EVERY week
 * - Adjacent divisions (±2): Process 50% per week (rotating)
 * - Distant divisions: Process 25% per week (rotating)
 *
 * This ensures:
 * - User always has active competition
 * - Nearby divisions compete for same players
 * - Distant divisions still drain/add to player pool but less frequently
 */

import type { Player, AIPersonality } from '../data/types';
import type { AIConfig } from './types';
import {
  AIWeeklyActions,
  AIDecisionContext,
  TransferBid,
  processAIWeek,
} from './aiManager';
import { calculateOverallRating } from './evaluation';
import {
  DivisionManager,
  TeamReference,
  WeeklyProcessingBatch,
  getDivisionManager,
} from './divisionManager';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Simplified free agent data for AI processing
 */
export interface SimpleFreeAgent {
  id: string;
  name: string;
  position: string;
  overallRating: number;
  age: number;
  annualSalary: number;
}

/**
 * Team data for AI processing (works with both AITeamState and Franchise)
 */
export interface AITeam {
  id: string;
  name: string;
  rosterIds: string[];
  /** Team's division (1-10) */
  division?: number;
  /** Either aiConfig (from AITeamState) or aiPersonality (from Franchise) */
  aiConfig?: AIConfig;
  aiPersonality?: AIPersonality | null;
  budget?: {
    available: number;
    total: number;
  };
}

/**
 * Input for weekly AI processing
 */
export interface WeeklyProcessorInput {
  teams: AITeam[];
  players: Record<string, Player>;
  freeAgentPool: SimpleFreeAgent[];
  currentWeek: number;
  isTransferWindowOpen: boolean;
  /** Incoming offers keyed by team ID */
  incomingOffersByTeam: Record<string, Array<{ offerId: string; playerId: string; offerAmount: number }>>;
  /** Player IDs with bid blocking - maps player ID to week when block expires */
  bidBlockedPlayers?: Record<string, number>;
  /** Player IDs that are on the transfer list (motivated sellers - AI will bid lower) */
  transferListedPlayerIds?: string[];
}

/**
 * Extended input with division awareness for 200-team processing
 */
export interface ExtendedWeeklyProcessorInput extends WeeklyProcessorInput {
  /** All teams keyed by ID (all 200) */
  allTeamsById: Record<string, AITeam>;
  /** Division manager instance (or will use global) */
  divisionManager?: DivisionManager;
  /** User's current division */
  userDivision: number;
}

/**
 * Result of batch processing (includes metadata)
 */
export interface BatchProcessingResult {
  resolved: ResolvedActions;
  teamsProcessed: number;
  userDivisionProcessed: number;
  adjacentDivisionsProcessed: number;
  distantDivisionsProcessed: number;
}

/**
 * Resolved action that will actually be executed
 */
export interface ResolvedSigning {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  salary: number;
  years: number;
}

export interface ResolvedTransferBid {
  buyerTeamId: string;
  buyerTeamName: string;
  sellerTeamId: string;
  playerId: string;
  playerName: string;
  bidAmount: number;
}

export interface ResolvedOfferResponse {
  teamId: string;
  offerId: string;
  playerId: string;
  decision: 'accept' | 'reject' | 'counter';
  counterAmount?: number;
}

export interface ResolvedRelease {
  teamId: string;
  playerId: string;
  playerName: string;
}

export interface ResolvedTransferListing {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  askingPrice: number;
  reason: string;
}

/**
 * All resolved actions after conflict resolution
 */
export interface ResolvedActions {
  signings: ResolvedSigning[];
  transferBids: ResolvedTransferBid[];
  offerResponses: ResolvedOfferResponse[];
  releases: ResolvedRelease[];
  transferListings: ResolvedTransferListing[];
  /** Actions that were blocked due to conflicts */
  blockedActions: {
    type: 'signing' | 'transfer';
    teamId: string;
    playerId: string;
    reason: string;
  }[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert SimpleFreeAgent to format needed by AI manager
 * (identity function now that we use SimpleFreeAgent directly)
 */
function convertFreeAgent(agent: SimpleFreeAgent): {
  id: string;
  name: string;
  position: string;
  overallRating: number;
  age: number;
  annualSalary: number;
} {
  return {
    id: agent.id,
    name: agent.name,
    position: agent.position,
    overallRating: agent.overallRating,
    age: agent.age,
    annualSalary: agent.annualSalary,
  };
}

/**
 * Convert Player to transfer target format
 * Includes release clause from contract for AI awareness
 */
function convertToTransferTarget(
  player: Player,
  teamId: string,
  bidBlockedUntilWeek?: number,
  isOnTransferList?: boolean
): {
  id: string;
  name: string;
  teamId: string;
  position: string;
  overallRating: number;
  age: number;
  marketValue: number;
  releaseClause?: number;
  bidBlockedUntilWeek?: number;
  isOnTransferList?: boolean;
} {
  const overallRating = calculateOverallRating(player);
  // Simple market value calculation (overall * age factor * base)
  const ageFactor = player.age < 25 ? 1.5 : player.age > 30 ? 0.7 : 1.0;
  const marketValue = Math.round(overallRating * 50000 * ageFactor);

  return {
    id: player.id,
    name: player.name,
    teamId,
    position: player.position,
    overallRating,
    age: player.age,
    marketValue,
    releaseClause: player.contract?.releaseClause ?? undefined,
    bidBlockedUntilWeek,
    isOnTransferList,
  };
}

/**
 * Convert AIConfig to AIPersonality for decision context
 * Maps old-style personality types to new trait-based personality
 */
export function configToPersonality(config: AIConfig): AIPersonality {
  // Default balanced personality
  const balancedPersonality: AIPersonality = {
    name: 'Balanced',
    traits: {
      youth_development_focus: 50,
      spending_aggression: 50,
      defensive_preference: 50,
      multi_sport_specialist: false,
      risk_tolerance: 50,
      player_loyalty: 50,
    },
  };

  // Map personality type to trait values
  const personalityMap: Record<string, AIPersonality> = {
    conservative: {
      name: 'Conservative',
      traits: {
        youth_development_focus: 70,
        spending_aggression: 30,
        defensive_preference: 60,
        multi_sport_specialist: false,
        risk_tolerance: 30,
        player_loyalty: 80,
      },
    },
    balanced: balancedPersonality,
    aggressive: {
      name: 'Aggressive',
      traits: {
        youth_development_focus: 30,
        spending_aggression: 80,
        defensive_preference: 40,
        multi_sport_specialist: false,
        risk_tolerance: 70,
        player_loyalty: 30,
      },
    },
  };

  return personalityMap[config.personality] ?? balancedPersonality;
}

/**
 * Build decision context for an AI team
 */
function buildDecisionContext(
  team: AITeam,
  players: Record<string, Player>,
  currentWeek: number,
  isTransferWindowOpen: boolean,
  leaguePosition?: number,
  totalTeams?: number
): AIDecisionContext | null {
  // Skip user team
  if (team.id === 'user') {
    return null;
  }

  // Get AI personality - either from direct aiPersonality or converted from aiConfig
  let personality: AIPersonality | null = null;
  if (team.aiPersonality) {
    personality = team.aiPersonality;
  } else if (team.aiConfig) {
    personality = configToPersonality(team.aiConfig);
  }

  if (!personality) {
    return null;
  }

  // Get team roster
  const roster = team.rosterIds
    .map(id => players[id])
    .filter((p): p is Player => p !== undefined);

  // Calculate salary commitment
  const salaryCommitment = roster.reduce((sum, p) => sum + (p.contract?.salary || 0), 0);

  return {
    teamId: team.id,
    teamName: team.name,
    personality,
    roster,
    budget: team.budget?.available || 1000000,
    salaryCommitment,
    week: currentWeek,
    transferWindowOpen: isTransferWindowOpen,
    division: team.division || 5, // Default to middle division if not set
    finance: {
      available: team.budget?.available || 1000000,
      total: team.budget?.total || 5000000,
    },
    leaguePosition,
    totalTeams,
  };
}

// =============================================================================
// MAIN PROCESSING
// =============================================================================

/**
 * Process all AI teams for the week
 */
export function processAllAITeams(input: WeeklyProcessorInput): AIWeeklyActions[] {
  const { teams, players, freeAgentPool, currentWeek, isTransferWindowOpen, incomingOffersByTeam, bidBlockedPlayers, transferListedPlayerIds } = input;

  const allActions: AIWeeklyActions[] = [];

  // Convert free agents to the format needed
  const availableFreeAgents = freeAgentPool.map(convertFreeAgent);

  // Convert transfer listed player IDs to a Set for fast lookup
  const transferListedSet = new Set(transferListedPlayerIds || []);

  // Build list of transfer targets (players from other teams)
  const transferTargetsByTeam: Map<string, ReturnType<typeof convertToTransferTarget>[]> = new Map();

  for (const team of teams) {
    if (team.id === 'user') continue;

    // Each AI team can only target players from OTHER teams
    const targets: ReturnType<typeof convertToTransferTarget>[] = [];

    for (const otherTeam of teams) {
      if (otherTeam.id === team.id) continue; // Skip own team

      for (const playerId of otherTeam.rosterIds) {
        const player = players[playerId];
        if (player) {
          // Include bid blocking week if player has bids blocked
          const bidBlockedUntilWeek = bidBlockedPlayers?.[playerId];
          // Check if player is on the transfer list (motivated seller)
          const isOnTransferList = transferListedSet.has(playerId);
          targets.push(convertToTransferTarget(player, otherTeam.id, bidBlockedUntilWeek, isOnTransferList));
        }
      }
    }

    transferTargetsByTeam.set(team.id, targets);
  }

  // Process each AI team
  for (const team of teams) {
    const context = buildDecisionContext(
      team,
      players,
      currentWeek,
      isTransferWindowOpen,
      undefined, // TODO: Pass league position
      teams.length
    );

    if (!context) continue; // Skip user team or teams without AI personality

    const transferTargets = transferTargetsByTeam.get(team.id) || [];
    const incomingOffers = incomingOffersByTeam[team.id] || [];

    // Create market value lookup
    const getPlayerMarketValue = (playerId: string): number => {
      const player = players[playerId];
      if (!player) return 0;
      const overall = calculateOverallRating(player);
      const ageFactor = player.age < 25 ? 1.5 : player.age > 30 ? 0.7 : 1.0;
      return Math.round(overall * 50000 * ageFactor);
    };

    const actions = processAIWeek(
      context,
      availableFreeAgents,
      transferTargets,
      incomingOffers,
      getPlayerMarketValue
    );

    allActions.push(actions);
  }

  return allActions;
}

/**
 * Resolve conflicts when multiple teams want the same player
 */
export function resolveConflicts(allActions: AIWeeklyActions[]): ResolvedActions {
  const resolved: ResolvedActions = {
    signings: [],
    transferBids: [],
    offerResponses: [],
    releases: [],
    transferListings: [],
    blockedActions: [],
  };

  // Track claimed free agents
  const claimedFreeAgents = new Set<string>();

  // Track transfer bids by player (to pick highest bidder)
  const transferBidsByPlayer = new Map<string, TransferBid & { teamId: string; teamName: string }>();

  // Process all actions
  for (const teamActions of allActions) {
    // Handle signings - first come first served with priority
    for (const signing of teamActions.signings) {
      if (claimedFreeAgents.has(signing.playerId)) {
        resolved.blockedActions.push({
          type: 'signing',
          teamId: teamActions.teamId,
          playerId: signing.playerId,
          reason: 'Player already claimed by another team',
        });
        continue;
      }

      // Check if another team has higher priority for this player
      const competingSignings = allActions
        .filter(a => a.teamId !== teamActions.teamId)
        .flatMap(a => a.signings)
        .filter(s => s.playerId === signing.playerId);

      const hasBetterOffer = competingSignings.some(s => {
        // Higher priority wins
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[s.priority] < priorityOrder[signing.priority]) return true;
        // Same priority - higher salary wins
        if (priorityOrder[s.priority] === priorityOrder[signing.priority]) {
          return s.offeredSalary > signing.offeredSalary;
        }
        return false;
      });

      if (hasBetterOffer) {
        resolved.blockedActions.push({
          type: 'signing',
          teamId: teamActions.teamId,
          playerId: signing.playerId,
          reason: 'Another team made a better offer',
        });
        continue;
      }

      // Claim the player
      claimedFreeAgents.add(signing.playerId);
      resolved.signings.push({
        teamId: teamActions.teamId,
        teamName: teamActions.teamName,
        playerId: signing.playerId,
        playerName: signing.playerName,
        salary: signing.offeredSalary,
        years: signing.offeredYears,
      });
    }

    // Handle transfer bids - collect all bids, will resolve later
    for (const bid of teamActions.transferBids) {
      const existingBid = transferBidsByPlayer.get(bid.playerId);

      if (!existingBid || bid.bidAmount > existingBid.bidAmount) {
        transferBidsByPlayer.set(bid.playerId, {
          ...bid,
          teamId: teamActions.teamId,
          teamName: teamActions.teamName,
        });

        // Mark the losing bid as blocked
        if (existingBid) {
          resolved.blockedActions.push({
            type: 'transfer',
            teamId: existingBid.teamId,
            playerId: bid.playerId,
            reason: `Outbid by ${teamActions.teamName}`,
          });
        }
      } else {
        resolved.blockedActions.push({
          type: 'transfer',
          teamId: teamActions.teamId,
          playerId: bid.playerId,
          reason: `Outbid by ${existingBid.teamName}`,
        });
      }
    }

    // Handle offer responses - no conflicts possible
    for (const response of teamActions.offerResponses) {
      resolved.offerResponses.push({
        teamId: teamActions.teamId,
        offerId: response.offerId,
        playerId: response.playerId,
        decision: response.decision,
        counterAmount: response.counterAmount,
      });
    }

    // Handle releases - no conflicts possible
    for (const release of teamActions.releases) {
      resolved.releases.push({
        teamId: teamActions.teamId,
        playerId: release.playerId,
        playerName: release.playerName,
      });
    }

    // Handle transfer listings - no conflicts possible (each team lists their own players)
    for (const listing of teamActions.transferListings || []) {
      resolved.transferListings.push({
        teamId: teamActions.teamId,
        teamName: teamActions.teamName,
        playerId: listing.playerId,
        playerName: listing.playerName,
        askingPrice: listing.askingPrice,
        reason: listing.reason,
      });
    }
  }

  // Finalize transfer bids (highest bidder wins)
  for (const [playerId, bid] of transferBidsByPlayer) {
    resolved.transferBids.push({
      buyerTeamId: bid.teamId,
      buyerTeamName: bid.teamName,
      sellerTeamId: bid.targetTeamId,
      playerId,
      playerName: bid.playerName,
      bidAmount: bid.bidAmount,
    });
  }

  return resolved;
}

/**
 * Main entry point: process all AI teams and resolve conflicts
 * (Legacy - processes all provided teams)
 */
export function processWeeklyAI(input: WeeklyProcessorInput): ResolvedActions {
  const allActions = processAllAITeams(input);
  return resolveConflicts(allActions);
}

// =============================================================================
// BATCH PROCESSING FOR 200-TEAM LEAGUES
// =============================================================================

/**
 * Process AI teams using batch selection from division manager
 *
 * This is the recommended entry point for 200-team leagues.
 * Uses intelligent batching to process:
 * - All teams in user's division (19 AI teams)
 * - ~50% of adjacent divisions (rotating)
 * - ~25% of distant divisions (rotating)
 *
 * @param input - Extended input with division awareness
 * @returns Batch processing result with metadata
 */
export function processBatchedWeeklyAI(input: ExtendedWeeklyProcessorInput): BatchProcessingResult {
  const {
    allTeamsById,
    players,
    freeAgentPool,
    currentWeek,
    isTransferWindowOpen,
    incomingOffersByTeam,
    divisionManager,
  } = input;

  // Get division manager (use provided or global)
  const dm = divisionManager || getDivisionManager();

  // Get batch of teams to process this week
  const batch: WeeklyProcessingBatch = dm.selectWeeklyBatch(currentWeek);

  // Combine all teams in the batch
  const teamsToProcess: TeamReference[] = [
    ...batch.userDivisionTeams,
    ...batch.adjacentDivisionTeams,
    ...batch.distantDivisionTeams,
  ];

  // Convert TeamReferences to AITeam format
  const aiTeams: AITeam[] = teamsToProcess
    .map(ref => allTeamsById[ref.id])
    .filter((t): t is AITeam => t !== undefined);

  // Build standard input for processing
  const standardInput: WeeklyProcessorInput = {
    teams: aiTeams,
    players,
    freeAgentPool,
    currentWeek,
    isTransferWindowOpen,
    incomingOffersByTeam,
    // Pass through transfer-listed players so batch processing sees them too
    transferListedPlayerIds: input.transferListedPlayerIds,
    bidBlockedPlayers: input.bidBlockedPlayers,
  };

  // Process the batch
  const allActions = processAllAITeams(standardInput);
  const resolved = resolveConflicts(allActions);

  return {
    resolved,
    teamsProcessed: aiTeams.length,
    userDivisionProcessed: batch.userDivisionTeams.length,
    adjacentDivisionsProcessed: batch.adjacentDivisionTeams.length,
    distantDivisionsProcessed: batch.distantDivisionTeams.length,
  };
}

/**
 * Generate simulated actions for non-processed distant divisions
 *
 * For divisions not being fully simulated, we generate statistical
 * approximations of their actions (X signings per week, Y releases, etc.)
 * This keeps the player pool dynamic without full AI processing.
 *
 * @param distantDivisions - Division numbers not being processed
 * @param freeAgentPool - Available free agents
 * @param currentWeek - Current game week
 * @returns Simulated actions to apply
 */
export function simulateDistantDivisionActions(
  distantDivisions: number[],
  freeAgentPool: SimpleFreeAgent[],
  currentWeek: number
): { signedPlayerIds: string[]; releasedPlayers: SimpleFreeAgent[] } {
  const signedPlayerIds: string[] = [];
  const releasedPlayers: SimpleFreeAgent[] = [];

  // Each distant division (not being processed this week) has a small chance
  // to sign players from the pool statistically

  for (const division of distantDivisions) {
    // ~1-2 signings per division per week (averaged over 20 teams)
    // This represents the 75% of teams NOT being processed that week
    const expectedSignings = 1.5 * 0.75; // 0.75 = not processed ratio

    // Use deterministic randomness based on division + week
    const hash = simpleHashForSim(division, currentWeek);

    // Decide how many signings this week (0, 1, or 2)
    const signings = hash % 100 < expectedSignings * 50 ? (hash % 2 === 0 ? 1 : 2) : 0;

    if (signings > 0) {
      // Pick random players from appropriate tier
      const qualityFloor = Math.max(0, (division - 1) * 3);
      const qualityCeiling = 100 - (division - 1) * 5;

      const eligibleAgents = freeAgentPool.filter(a =>
        a.overallRating >= qualityFloor &&
        a.overallRating <= qualityCeiling &&
        !signedPlayerIds.includes(a.id)
      );

      for (let i = 0; i < signings && eligibleAgents.length > 0; i++) {
        const pickIndex = (hash + i * 17) % eligibleAgents.length;
        const picked = eligibleAgents[pickIndex];
        if (picked) {
          signedPlayerIds.push(picked.id);
          eligibleAgents.splice(pickIndex, 1);
        }
      }
    }
  }

  return { signedPlayerIds, releasedPlayers };
}

/**
 * Simple hash for statistical simulation
 */
function simpleHashForSim(division: number, week: number): number {
  let hash = division * 31 + week * 17;
  hash = ((hash << 5) - hash) + (division * week);
  return Math.abs(hash & hash);
}
