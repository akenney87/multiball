/**
 * Game State Reducer
 *
 * Handles all state updates for the game.
 * Pure function - no side effects.
 */

import type {
  GameState,
  GameAction,
  LineupConfig,
} from './types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_OPERATIONS_BUDGET,
  DEFAULT_TRAINING_FOCUS,
  DEFAULT_SCOUT_INSTRUCTIONS,
  DEFAULT_YOUTH_ACADEMY_STATE,
  SAVE_VERSION,
} from './types';
import type { Player, TransferOffer, ContractNegotiation } from '../../data/types';
import {
  createNegotiation,
  processNegotiationRound,
  createDefaultOffer,
  createContractFromOffer,
  calculateSigningCost,
} from '../../systems/contractSystem';
import { createManagerCareer } from '../../systems/managerRatingSystem';
import { DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY } from '../../simulation/baseball/types';

/**
 * Initial/empty game state
 */
export const initialGameState: GameState = {
  initialized: false,
  version: SAVE_VERSION,
  lastSaved: null,

  userTeam: {
    id: 'user',
    name: '',
    colors: { primary: '#3B82F6', secondary: '#FFFFFF' },
    division: 5,
    totalBudget: 0,
    salaryCommitment: 0,
    availableBudget: 0,
    operationsBudget: DEFAULT_OPERATIONS_BUDGET,
    rosterIds: [],
    lineup: {
      basketballStarters: ['', '', '', '', ''],
      baseballLineup: {
        battingOrder: ['', '', '', '', '', '', '', '', '', ''],
        positions: {},
        startingPitcher: '',
        bullpen: {
          longRelievers: ['', ''],
          shortRelievers: ['', ''],
          closer: '',
        },
      },
      soccerLineup: {
        starters: [],
        formation: '4-4-2',
        positions: {},
      },
      bench: [],
      minutesAllocation: {},
    },
    trainingFocus: DEFAULT_TRAINING_FOCUS,
    tactics: {
      pace: 'standard',
      manDefensePct: 70,
      scoringOptions: [undefined, undefined, undefined],
      minutesAllotment: {},
      reboundingStrategy: 'standard',
      closers: [],
      timeoutStrategy: 'standard',
      // Soccer tactical defaults
      soccerAttackingStyle: 'direct',
      soccerPressing: 'balanced',
      soccerWidth: 'balanced',
    },
    baseballStrategy: DEFAULT_BASEBALL_STRATEGY,
    shortlistedPlayerIds: [],
    transferListPlayerIds: [],
    transferListAskingPrices: {},
  },

  players: {},

  league: {
    teams: [],
    freeAgentIds: [],
  },

  season: {
    id: '',
    number: 1,
    currentWeek: 1,
    status: 'pre_season',
    transferWindowOpen: false,
    matches: [],
    standings: {},
    aiTeamStrategies: {},
  },

  market: {
    transferOffers: [],
    incomingOffers: [],
    outgoingOffers: [],
    activeNegotiation: null,
    negotiationHistory: [],
  },

  youthAcademy: DEFAULT_YOUTH_ACADEMY_STATE,

  events: [],

  settings: DEFAULT_SETTINGS,

  scoutedPlayerIds: [],
  scoutingTargetIds: [],
  scoutingReports: [],
  scoutInstructions: DEFAULT_SCOUT_INSTRUCTIONS,
  scoutingDepthSlider: 0.5,
  budgetConfigured: false,

  // Trophy Case & Manager Rating
  trophies: [],
  playerAwards: [],
  managerCareer: createManagerCareer('', 7),
};

/**
 * Game state reducer
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    case 'INITIALIZE_GAME': {
      const { config, userTeam, players, league, season } = action.payload;
      // User's own players are automatically "scouted" (full visibility)
      const scoutedPlayerIds = [...userTeam.rosterIds];

      // Snapshot current attributes as season start baseline for progress tracking
      const playersWithSnapshot: Record<string, Player> = {};
      for (const [playerId, player] of Object.entries(players)) {
        if (userTeam.rosterIds.includes(playerId)) {
          playersWithSnapshot[playerId] = {
            ...player,
            seasonStartAttributes: { ...player.attributes },
          };
        } else {
          playersWithSnapshot[playerId] = player;
        }
      }

      return {
        ...state,
        initialized: true,
        version: SAVE_VERSION,
        lastSaved: null,
        userTeam,
        players: playersWithSnapshot,
        league,
        season,
        market: {
          transferOffers: [],
          incomingOffers: [],
          outgoingOffers: [],
          activeNegotiation: null,
          negotiationHistory: [],
        },
        youthAcademy: DEFAULT_YOUTH_ACADEMY_STATE,
        events: [],
        settings: {
          ...state.settings,
          difficulty: config.difficulty,
        },
        scoutedPlayerIds,
        // Initialize trophy case and manager career
        trophies: [],
        playerAwards: [],
        managerCareer: createManagerCareer(userTeam.name, userTeam.division),
      };
    }

    case 'LOAD_GAME': {
      // Handle legacy saves that don't have newer scouting fields
      const scoutedPlayerIds = action.payload.scoutedPlayerIds || action.payload.userTeam.rosterIds || [];
      const scoutingTargetIds = action.payload.scoutingTargetIds || [];
      const scoutingReports = action.payload.scoutingReports || [];
      const scoutInstructions = action.payload.scoutInstructions || DEFAULT_SCOUT_INSTRUCTIONS;
      const scoutingDepthSlider = action.payload.scoutingDepthSlider ?? 0.5;
      // Handle legacy saves that don't have youth academy
      const youthAcademy = action.payload.youthAcademy || DEFAULT_YOUTH_ACADEMY_STATE;
      // Handle legacy saves that don't have trophy/career data
      const trophies = action.payload.trophies || [];
      const playerAwards = action.payload.playerAwards || [];
      const managerCareer = action.payload.managerCareer ||
        createManagerCareer(action.payload.userTeam.name, action.payload.userTeam.division);

      // Migrate players to have matchFitness fields (v2 migration)
      const migratedPlayers: Record<string, Player> = {};
      for (const [playerId, player] of Object.entries(action.payload.players || {})) {
        migratedPlayers[playerId] = {
          ...player,
          // Add matchFitness fields if missing (default to fully fit)
          matchFitness: player.matchFitness ?? 100,
          lastMatchDate: player.lastMatchDate ?? null,
          lastMatchSport: player.lastMatchSport ?? null,
        };
      }

      // Handle legacy saves that don't have AI team strategies (v3 migration)
      const aiTeamStrategies = action.payload.season?.aiTeamStrategies || {};

      return {
        ...action.payload,
        initialized: true,
        players: migratedPlayers,
        season: {
          ...action.payload.season,
          aiTeamStrategies,
        },
        scoutedPlayerIds,
        scoutingTargetIds,
        scoutingReports,
        scoutInstructions,
        scoutingDepthSlider,
        youthAcademy,
        trophies,
        playerAwards,
        managerCareer,
      };
    }

    case 'RESET_GAME': {
      return initialGameState;
    }

    // =========================================================================
    // SEASON
    // =========================================================================

    case 'ADVANCE_WEEK': {
      const nextWeek = state.season.currentWeek + 1;
      // Regular season is weeks 1-40, offseason handling is separate
      const isSeasonEnd = nextWeek > 40 && state.season.status !== 'off_season';

      return {
        ...state,
        season: {
          ...state.season,
          currentWeek: isSeasonEnd ? 41 : nextWeek,
          status: isSeasonEnd ? 'off_season' : state.season.status,
        },
      };
    }

    case 'ADVANCE_OFFSEASON_WEEK': {
      // Advance week during offseason (weeks 41-52)
      const nextWeek = state.season.currentWeek + 1;

      return {
        ...state,
        season: {
          ...state.season,
          currentWeek: nextWeek,
        },
      };
    }

    case 'PROCESS_SEASON_END': {
      const {
        promotedTeams,
        relegatedTeams,
        expiredContracts,
        userPrizeMoney,
        userMoraleChange,
      } = action.payload;

      // Process contract expirations - release players to free agency
      const updatedPlayers: Record<string, Player> = { ...state.players };
      const newFreeAgentIds = [...state.league.freeAgentIds];

      for (const playerId of expiredContracts) {
        const player = updatedPlayers[playerId];
        if (player) {
          updatedPlayers[playerId] = {
            ...player,
            teamId: 'free_agent',
            contract: null,
          };

          // Add to free agents if not already there
          if (!newFreeAgentIds.includes(playerId)) {
            newFreeAgentIds.push(playerId);
          }
        }
      }

      // Apply morale change to all user team players
      for (const playerId of state.userTeam.rosterIds) {
        const player = updatedPlayers[playerId];
        if (player) {
          const newMorale = Math.max(0, Math.min(100, player.morale + userMoraleChange));
          updatedPlayers[playerId] = {
            ...player,
            morale: newMorale,
          };
        }
      }

      // Remove expired contract players from team rosters
      const updatedTeams = state.league.teams.map((team) => ({
        ...team,
        rosterIds: team.rosterIds.filter((id) => !expiredContracts.includes(id)),
      }));

      // Check if user team was promoted or relegated
      let newUserDivision = state.userTeam.division;
      if (promotedTeams.includes('user')) {
        newUserDivision = Math.max(1, state.userTeam.division - 1) as typeof newUserDivision;
      } else if (relegatedTeams.includes('user')) {
        newUserDivision = Math.min(10, state.userTeam.division + 1) as typeof newUserDivision;
      }

      return {
        ...state,
        players: updatedPlayers,
        userTeam: {
          ...state.userTeam,
          rosterIds: state.userTeam.rosterIds.filter((id) => !expiredContracts.includes(id)),
          availableBudget: state.userTeam.availableBudget + userPrizeMoney,
          division: newUserDivision,
        },
        league: {
          ...state.league,
          teams: updatedTeams.map((team) => {
            // Apply division changes to AI teams
            let newDivision = team.division;
            if (promotedTeams.includes(team.id)) {
              newDivision = Math.max(1, team.division - 1) as typeof newDivision;
            } else if (relegatedTeams.includes(team.id)) {
              newDivision = Math.min(10, team.division + 1) as typeof newDivision;
            }
            return { ...team, division: newDivision };
          }),
          freeAgentIds: newFreeAgentIds,
        },
      };
    }

    case 'START_NEW_SEASON': {
      const { season, teams, userDivision } = action.payload;

      // Reset player season stats and create new season snapshots
      const updatedPlayers: Record<string, Player> = {};
      for (const [playerId, player] of Object.entries(state.players)) {
        // Archive current season stats to history
        const newSeasonHistory = [...player.seasonHistory];
        if (player.currentSeasonStats.gamesPlayed.basketball > 0 ||
            player.currentSeasonStats.gamesPlayed.baseball > 0 ||
            player.currentSeasonStats.gamesPlayed.soccer > 0) {
          newSeasonHistory.push({
            seasonNumber: state.season.number,
            yearLabel: `Season ${state.season.number}`,
            teamId: player.teamId,
            gamesPlayed: { ...player.currentSeasonStats.gamesPlayed },
            totalPoints: { ...player.currentSeasonStats.totalPoints },
            minutesPlayed: { ...player.currentSeasonStats.minutesPlayed },
            basketball: player.currentSeasonStats.basketball ? { ...player.currentSeasonStats.basketball } : undefined,
            baseball: player.currentSeasonStats.baseball ? { ...player.currentSeasonStats.baseball } : undefined,
            soccer: player.currentSeasonStats.soccer ? { ...player.currentSeasonStats.soccer } : undefined,
          });
        }

        updatedPlayers[playerId] = {
          ...player,
          // Reset season stats
          currentSeasonStats: {
            gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
            totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
            minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
          },
          // Snapshot current attributes for progress tracking
          seasonStartAttributes: { ...player.attributes },
          // Archive season history
          seasonHistory: newSeasonHistory,
          // Reset weekly XP
          weeklyXP: { physical: 0, mental: 0, technical: 0 },
          // Reset match results
          recentMatchResults: [],
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        userTeam: {
          ...state.userTeam,
          division: userDivision,
        },
        league: {
          ...state.league,
          teams,
        },
        season,
      };
    }

    case 'UPDATE_STANDINGS': {
      return {
        ...state,
        season: {
          ...state.season,
          standings: action.payload,
        },
      };
    }

    case 'INCREMENT_STANDINGS': {
      // Incremental standings update - avoids race conditions with stale stateRef
      const { homeTeamId, awayTeamId, homeWon, sport } = action.payload;
      const newStandings = { ...state.season.standings };

      // Deep copy the standings entries we're updating
      if (newStandings[homeTeamId]) {
        newStandings[homeTeamId] = {
          ...newStandings[homeTeamId],
          [sport]: { ...newStandings[homeTeamId][sport] },
        };
      }
      if (newStandings[awayTeamId]) {
        newStandings[awayTeamId] = {
          ...newStandings[awayTeamId],
          [sport]: { ...newStandings[awayTeamId][sport] },
        };
      }

      const homeStanding = newStandings[homeTeamId];
      const awayStanding = newStandings[awayTeamId];

      if (homeStanding && awayStanding) {
        if (homeWon) {
          homeStanding.wins += 1;
          homeStanding[sport].wins += 1;
          awayStanding.losses += 1;
          awayStanding[sport].losses += 1;
        } else {
          awayStanding.wins += 1;
          awayStanding[sport].wins += 1;
          homeStanding.losses += 1;
          homeStanding[sport].losses += 1;
        }

        // Recalculate ranks by W-L%
        const getWinPct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));
        const sorted = Object.values(newStandings).sort((a, b) => {
          const aWinPct = getWinPct(a.wins, a.losses);
          const bWinPct = getWinPct(b.wins, b.losses);
          if (bWinPct !== aWinPct) return bWinPct - aWinPct;
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (a.losses !== b.losses) return a.losses - b.losses;
          return a.teamId.localeCompare(b.teamId);
        });
        sorted.forEach((s, i) => {
          const standing = newStandings[s.teamId];
          if (standing) {
            standing.rank = i + 1;
          }
        });
      }

      return {
        ...state,
        season: {
          ...state.season,
          standings: newStandings,
        },
      };
    }

    case 'COMPLETE_MATCH': {
      const { matchId, result } = action.payload;
      console.log('[gameReducer] COMPLETE_MATCH - matchId:', matchId, 'Score:', result.homeScore, '-', result.awayScore);
      return {
        ...state,
        season: {
          ...state.season,
          matches: state.season.matches.map((match) =>
            match.id === matchId
              ? { ...match, status: 'completed' as const, result }
              : match
          ),
        },
      };
    }

    // =========================================================================
    // ROSTER
    // =========================================================================

    case 'SET_LINEUP': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          lineup: action.payload,
        },
      };
    }

    case 'SET_TACTICS': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          tactics: action.payload,
        },
      };
    }

    case 'SET_BASEBALL_STRATEGY': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          baseballStrategy: action.payload,
        },
      };
    }

    case 'RELEASE_PLAYER': {
      const { playerId } = action.payload;
      const player = state.players[playerId];

      if (!player || player.teamId !== 'user') {
        return state;
      }

      // Update player to free agent
      const updatedPlayer: Player = {
        ...player,
        teamId: 'free_agent',
        contract: null,
      };

      // Remove from roster
      const newRosterIds = state.userTeam.rosterIds.filter((id) => id !== playerId);

      // Remove from lineup (all sports)
      const currentLineup = state.userTeam.lineup;
      const newLineup: LineupConfig = {
        basketballStarters: currentLineup.basketballStarters.map((id) =>
          id === playerId ? '' : id
        ) as [string, string, string, string, string],
        baseballLineup: {
          battingOrder: currentLineup.baseballLineup.battingOrder.map((id) =>
            id === playerId ? '' : id
          ) as [string, string, string, string, string, string, string, string, string, string],
          positions: Object.fromEntries(
            Object.entries(currentLineup.baseballLineup.positions).filter(([id]) => id !== playerId)
          ),
          startingPitcher: currentLineup.baseballLineup.startingPitcher === playerId ? '' : currentLineup.baseballLineup.startingPitcher,
          bullpen: {
            longRelievers: currentLineup.baseballLineup.bullpen.longRelievers.map((id) =>
              id === playerId ? '' : id
            ) as [string, string],
            shortRelievers: currentLineup.baseballLineup.bullpen.shortRelievers.map((id) =>
              id === playerId ? '' : id
            ) as [string, string],
            closer: currentLineup.baseballLineup.bullpen.closer === playerId ? '' : currentLineup.baseballLineup.bullpen.closer,
          },
        },
        soccerLineup: {
          starters: currentLineup.soccerLineup.starters.filter((id) => id !== playerId),
          formation: currentLineup.soccerLineup.formation,
          positions: Object.fromEntries(
            Object.entries(currentLineup.soccerLineup.positions).filter(([id]) => id !== playerId)
          ),
        },
        bench: currentLineup.bench.filter((id) => id !== playerId),
        minutesAllocation: { ...currentLineup.minutesAllocation },
      };
      delete newLineup.minutesAllocation[playerId];

      // Calculate new salary commitment
      const releasedSalary = player.contract?.salary || 0;

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        userTeam: {
          ...state.userTeam,
          rosterIds: newRosterIds,
          lineup: newLineup,
          salaryCommitment: state.userTeam.salaryCommitment - releasedSalary,
          availableBudget: state.userTeam.availableBudget + releasedSalary,
        },
        league: {
          ...state.league,
          freeAgentIds: [...state.league.freeAgentIds, playerId],
        },
      };
    }

    case 'SIGN_PLAYER': {
      const { player } = action.payload;

      // Update salary
      const newSalary = player.contract?.salary || 0;

      // Budget validation - prevent signing if it would make budget negative
      if (state.userTeam.availableBudget < newSalary) {
        console.warn(`SIGN_PLAYER rejected: insufficient budget (need ${newSalary}, have ${state.userTeam.availableBudget})`);
        return state;
      }

      // Add to roster
      const newRosterIds = [...state.userTeam.rosterIds, player.id];

      // Remove from free agents if applicable
      const newFreeAgentIds = state.league.freeAgentIds.filter(
        (id) => id !== player.id
      );

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: player,
        },
        userTeam: {
          ...state.userTeam,
          rosterIds: newRosterIds,
          salaryCommitment: state.userTeam.salaryCommitment + newSalary,
          availableBudget: state.userTeam.availableBudget - newSalary,
        },
        league: {
          ...state.league,
          freeAgentIds: newFreeAgentIds,
        },
      };
    }

    case 'SET_TRAINING_FOCUS': {
      const { playerId, focus } = action.payload;

      if (playerId) {
        // Per-player training focus
        const player = state.players[playerId];
        if (!player) return state;

        return {
          ...state,
          players: {
            ...state.players,
            [playerId]: {
              ...player,
              trainingFocus: focus,
            },
          },
        };
      } else {
        // Team-wide training focus
        return {
          ...state,
          userTeam: {
            ...state.userTeam,
            trainingFocus: focus,
          },
        };
      }
    }

    // =========================================================================
    // MARKET
    // =========================================================================

    case 'MAKE_OFFER': {
      const { playerId, amount } = action.payload;
      const player = state.players[playerId];

      if (!player) return state;

      // Budget validation - prevent making offers you can't afford
      if (state.userTeam.availableBudget < amount) {
        console.warn(`MAKE_OFFER rejected: insufficient budget (need ${amount}, have ${state.userTeam.availableBudget})`);
        return state;
      }

      const newOffer: TransferOffer = {
        id: `offer-${Date.now()}`,
        offeringTeamId: 'user',
        receivingTeamId: player.teamId,
        playerId,
        transferFee: amount,
        status: 'pending',
        createdDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        negotiationHistory: [
          {
            amount,
            from: 'user',
            timestamp: new Date(),
          },
        ],
      };

      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: [...state.market.transferOffers, newOffer],
          outgoingOffers: [...state.market.outgoingOffers, newOffer],
        },
      };
    }

    case 'RESPOND_TO_OFFER': {
      const { offerId, accept } = action.payload;

      const updateOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.id !== offerId) return offer;
        return {
          ...offer,
          status: accept ? 'accepted' : 'rejected',
        };
      };

      const updatedOffers = state.market.transferOffers.map(updateOffer);
      const acceptedOffer = updatedOffers.find(
        (o) => o.id === offerId && o.status === 'accepted'
      );

      let newState = {
        ...state,
        market: {
          ...state.market,
          transferOffers: updatedOffers,
          incomingOffers: state.market.incomingOffers.map(updateOffer),
        },
      };

      // If accepted, process the transfer
      if (acceptedOffer) {
        const player = state.players[acceptedOffer.playerId];
        if (player) {
          // Remove from user team
          newState = {
            ...newState,
            players: {
              ...newState.players,
              [acceptedOffer.playerId]: {
                ...player,
                teamId: acceptedOffer.offeringTeamId,
              },
            },
            userTeam: {
              ...newState.userTeam,
              rosterIds: newState.userTeam.rosterIds.filter(
                (id) => id !== acceptedOffer.playerId
              ),
              availableBudget:
                newState.userTeam.availableBudget + acceptedOffer.transferFee,
            },
          };
        }
      }

      return newState;
    }

    case 'EXPIRE_OFFERS': {
      const now = new Date();
      const expireOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.status === 'pending' && offer.expiryDate < now) {
          return { ...offer, status: 'expired' };
        }
        return offer;
      };

      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: state.market.transferOffers.map(expireOffer),
          incomingOffers: state.market.incomingOffers.map(expireOffer),
          outgoingOffers: state.market.outgoingOffers.map(expireOffer),
        },
      };
    }

    case 'PROCESS_TRANSFER_RESPONSES': {
      // Process AI responses to user's outgoing offers
      const pendingOffers = state.market.outgoingOffers.filter(
        (o) => o.status === 'pending'
      );

      if (pendingOffers.length === 0) {
        return state;
      }

      const updatedOffers: TransferOffer[] = [];
      const acceptedOffers: TransferOffer[] = [];

      for (const offer of pendingOffers) {
        const player = state.players[offer.playerId];
        if (!player) {
          // Player doesn't exist, mark as rejected
          updatedOffers.push({ ...offer, status: 'rejected' });
          continue;
        }

        // Find the AI team that owns the player
        const aiTeam = state.league.teams.find(
          (t) => t.id === offer.receivingTeamId
        );

        if (!aiTeam) {
          // Team not found, mark as rejected
          updatedOffers.push({ ...offer, status: 'rejected' });
          continue;
        }

        // Calculate player's market value (simplified)
        const attrs = player.attributes;
        const avgAttr = attrs
          ? Object.values(attrs).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) / 25
          : 50;
        const marketValue = Math.round(avgAttr * 100000); // $5M base for 50-rated player

        // Get AI acceptance threshold based on personality
        const personality = aiTeam.aiConfig?.personality || 'balanced';
        let acceptanceMultiplier: number;
        switch (personality) {
          case 'conservative':
            acceptanceMultiplier = 1.5; // Want 150% of market value
            break;
          case 'aggressive':
            acceptanceMultiplier = 0.8; // Accept 80% of market value
            break;
          default:
            acceptanceMultiplier = 1.0; // Accept at market value
        }

        const minAcceptable = Math.round(marketValue * acceptanceMultiplier);

        // Add some randomness (±20%)
        const randomFactor = 0.8 + Math.random() * 0.4;
        const adjustedMinAcceptable = Math.round(minAcceptable * randomFactor);

        // Check if offer meets threshold
        if (offer.transferFee >= adjustedMinAcceptable) {
          // Accepted
          updatedOffers.push({ ...offer, status: 'accepted' });
          acceptedOffers.push(offer);
        } else {
          // Check if we should counter or reject
          const shortfallPct = (adjustedMinAcceptable - offer.transferFee) / adjustedMinAcceptable;

          if (shortfallPct < 0.3 && Math.random() > 0.5) {
            // Within 30% and 50% chance - counter offer
            const counterAmount = Math.round(adjustedMinAcceptable * 1.1); // 10% above min
            const counterOffer: TransferOffer = {
              ...offer,
              status: 'countered',
              negotiationHistory: [
                ...offer.negotiationHistory,
                {
                  amount: counterAmount,
                  from: offer.receivingTeamId,
                  timestamp: new Date(),
                },
              ],
            };
            updatedOffers.push(counterOffer);
          } else {
            // Reject
            updatedOffers.push({ ...offer, status: 'rejected' });
          }
        }
      }

      // Update offers in state
      const newTransferOffers = state.market.transferOffers.map((offer) => {
        const updated = updatedOffers.find((u) => u.id === offer.id);
        return updated || offer;
      });

      const newOutgoingOffers = state.market.outgoingOffers.map((offer) => {
        const updated = updatedOffers.find((u) => u.id === offer.id);
        return updated || offer;
      });

      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: newTransferOffers,
          outgoingOffers: newOutgoingOffers,
        },
      };
    }

    case 'COMPLETE_TRANSFER': {
      const { offerId, playerId, fromTeamId, toTeamId, fee } = action.payload;
      const player = state.players[playerId];

      if (!player) return state;

      // Budget validation - if user is buying, check they can afford it
      if (toTeamId === 'user' && state.userTeam.availableBudget < fee) {
        console.warn(`COMPLETE_TRANSFER rejected: insufficient budget (need ${fee}, have ${state.userTeam.availableBudget})`);
        return state;
      }

      // Create a contract for the player
      const newContract = {
        id: `contract-${Date.now()}`,
        playerId,
        teamId: toTeamId,
        salary: Math.round(fee * 0.2), // Salary = 20% of transfer fee per year
        signingBonus: 0,
        contractLength: 3,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
        performanceBonuses: {},
        releaseClause: null,
        salaryIncreases: [],
        agentFee: 0,
        clauses: [],
        squadRole: 'rotation_player' as const,
        loyaltyBonus: 0,
      };

      // Update player
      const updatedPlayer: Player = {
        ...player,
        teamId: toTeamId,
        contract: newContract,
        acquisitionType: 'trade', // 'trade' is the closest available type to transfer
        acquisitionDate: new Date(),
      };

      // Update the offer status
      const updateOfferStatus = (offer: TransferOffer): TransferOffer => {
        if (offer.id === offerId) {
          return { ...offer, status: 'accepted' };
        }
        return offer;
      };

      // Build new state
      let newState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        market: {
          ...state.market,
          transferOffers: state.market.transferOffers.map(updateOfferStatus),
          outgoingOffers: state.market.outgoingOffers.map(updateOfferStatus),
        },
      };

      // Handle roster updates based on who is buying
      if (toTeamId === 'user') {
        // User is buying from AI team
        // Add to user roster
        newState = {
          ...newState,
          userTeam: {
            ...newState.userTeam,
            rosterIds: [...newState.userTeam.rosterIds, playerId],
            availableBudget: newState.userTeam.availableBudget - fee,
            salaryCommitment: newState.userTeam.salaryCommitment + newContract.salary,
          },
        };

        // Remove from AI team roster
        newState = {
          ...newState,
          league: {
            ...newState.league,
            teams: newState.league.teams.map((team) => {
              if (team.id === fromTeamId) {
                return {
                  ...team,
                  rosterIds: team.rosterIds.filter((id) => id !== playerId),
                };
              }
              return team;
            }),
          },
        };
      } else if (fromTeamId === 'user') {
        // User is selling to AI team
        // Remove from user roster
        newState = {
          ...newState,
          userTeam: {
            ...newState.userTeam,
            rosterIds: newState.userTeam.rosterIds.filter((id) => id !== playerId),
            availableBudget: newState.userTeam.availableBudget + fee,
            salaryCommitment: newState.userTeam.salaryCommitment - (player.contract?.salary || 0),
          },
        };

        // Add to AI team roster
        newState = {
          ...newState,
          league: {
            ...newState.league,
            teams: newState.league.teams.map((team) => {
              if (team.id === toTeamId) {
                return {
                  ...team,
                  rosterIds: [...team.rosterIds, playerId],
                };
              }
              return team;
            }),
          },
        };
      }

      return newState;
    }

    // =========================================================================
    // CONTRACT NEGOTIATION (FM-STYLE)
    // =========================================================================

    case 'START_NEGOTIATION': {
      const { playerId, transferFee, negotiationType } = action.payload;
      const player = state.players[playerId];

      if (!player) return state;

      // Create default offer based on player value
      const defaultOffer = createDefaultOffer(player);

      // Create negotiation - pass user's division for accurate role expectations
      // This ensures high OVR players in lower divisions expect appropriate roles
      const negotiation = createNegotiation(
        player,
        defaultOffer,
        state.season.currentWeek,
        negotiationType,
        transferFee,
        state.userTeam.division
      );

      // Clean up accepted offer from outgoingOffers if this is a transfer
      const cleanedOutgoingOffers = state.market.outgoingOffers.filter(
        (offer) => !(offer.playerId === playerId && offer.status === 'accepted')
      );

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: negotiation,
          outgoingOffers: cleanedOutgoingOffers,
        },
      };
    }

    case 'SUBMIT_CONTRACT_OFFER': {
      const { offer } = action.payload;
      const negotiation = state.market.activeNegotiation;

      if (!negotiation || negotiation.status !== 'in_progress') {
        return state;
      }

      const player = state.players[negotiation.playerId];
      if (!player) return state;

      // Process the negotiation round
      const result = processNegotiationRound(negotiation, offer);

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: result.negotiation,
        },
      };
    }

    case 'ACCEPT_PLAYER_COUNTER': {
      const negotiation = state.market.activeNegotiation;

      if (!negotiation || !negotiation.counterOffer) {
        return state;
      }

      // Accepting counter means making their counter offer as our offer
      const result = processNegotiationRound(negotiation, negotiation.counterOffer);

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: result.negotiation,
        },
      };
    }

    case 'CANCEL_NEGOTIATION': {
      const negotiation = state.market.activeNegotiation;

      if (!negotiation) return state;

      // Move to history as cancelled
      const cancelledNegotiation: ContractNegotiation = {
        ...negotiation,
        status: 'rejected',
      };

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: null,
          negotiationHistory: [cancelledNegotiation, ...state.market.negotiationHistory],
        },
      };
    }

    case 'COMPLETE_SIGNING': {
      const negotiation = state.market.activeNegotiation;

      if (!negotiation || negotiation.status !== 'accepted') {
        return state;
      }

      const player = state.players[negotiation.playerId];
      if (!player) return state;

      // Create the contract
      const contract = createContractFromOffer(
        negotiation.playerId,
        'user',
        negotiation.currentOffer
      );

      // Calculate total signing cost
      const signingCost = calculateSigningCost(negotiation.currentOffer);
      const transferFee = negotiation.transferFee || 0;
      const totalCost = signingCost + transferFee;

      // Budget validation - prevent signing if it would make budget negative
      if (state.userTeam.availableBudget < totalCost) {
        console.warn(`COMPLETE_SIGNING rejected: insufficient budget (need ${totalCost}, have ${state.userTeam.availableBudget})`);
        return state;
      }

      // Update player with new contract
      // Free agents start with reduced match fitness (haven't been playing)
      const isFreeAgent = negotiation.negotiationType === 'new_signing';
      const updatedPlayer: Player = {
        ...player,
        teamId: 'user',
        contract,
        acquisitionType: negotiation.negotiationType === 'transfer' ? 'trade' : 'free_agent',
        acquisitionDate: new Date(),
        matchFitness: isFreeAgent ? 50 : player.matchFitness,
      };

      // Build new state
      let newState: GameState = {
        ...state,
        players: {
          ...state.players,
          [negotiation.playerId]: updatedPlayer,
        },
        userTeam: {
          ...state.userTeam,
          rosterIds: state.userTeam.rosterIds.includes(negotiation.playerId)
            ? state.userTeam.rosterIds
            : [...state.userTeam.rosterIds, negotiation.playerId],
          availableBudget: state.userTeam.availableBudget - totalCost,
          salaryCommitment: state.userTeam.salaryCommitment + contract.salary,
        },
        market: {
          ...state.market,
          activeNegotiation: null,
          negotiationHistory: [negotiation, ...state.market.negotiationHistory],
        },
      };

      // If transfer, remove player from previous team
      if (negotiation.negotiationType === 'transfer') {
        const previousTeamId = player.teamId;
        if (previousTeamId && previousTeamId !== 'user' && previousTeamId !== 'free_agent') {
          newState = {
            ...newState,
            league: {
              ...newState.league,
              teams: newState.league.teams.map((team) => {
                if (team.id === previousTeamId) {
                  return {
                    ...team,
                    rosterIds: team.rosterIds.filter((id) => id !== negotiation.playerId),
                  };
                }
                return team;
              }),
            },
          };
        }
      }

      // If free agent, remove from free agents list
      if (negotiation.negotiationType === 'new_signing') {
        newState = {
          ...newState,
          league: {
            ...newState.league,
            freeAgentIds: newState.league.freeAgentIds.filter((id) => id !== negotiation.playerId),
          },
        };
      }

      return newState;
    }

    // =========================================================================
    // BUDGET
    // =========================================================================

    case 'SET_OPERATIONS_BUDGET': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          operationsBudget: action.payload,
        },
      };
    }

    case 'CONFIRM_BUDGET_ALLOCATION': {
      return {
        ...state,
        budgetConfigured: true,
      };
    }

    // =========================================================================
    // SETTINGS
    // =========================================================================

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    case 'ADD_EVENT': {
      return {
        ...state,
        events: [action.payload, ...state.events].slice(0, 100), // Keep last 100
      };
    }

    case 'MARK_EVENT_READ': {
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.eventId ? { ...event, read: true } : event
        ),
      };
    }

    // =========================================================================
    // SAVE
    // =========================================================================

    case 'MARK_SAVED': {
      return {
        ...state,
        lastSaved: action.payload.timestamp,
      };
    }

    // =========================================================================
    // SCOUTING
    // =========================================================================

    case 'SCOUT_PLAYER': {
      const { playerId } = action.payload;
      // Don't add duplicates
      if (state.scoutedPlayerIds.includes(playerId)) {
        return state;
      }
      // Also remove from scouting targets since they're now scouted
      const updatedTargets = state.scoutingTargetIds.filter(id => id !== playerId);
      return {
        ...state,
        scoutedPlayerIds: [...state.scoutedPlayerIds, playerId],
        scoutingTargetIds: updatedTargets,
      };
    }

    case 'ADD_SCOUTING_TARGET': {
      const { playerId } = action.payload;
      // Don't add if already a target or already scouted
      if (state.scoutingTargetIds.includes(playerId) || state.scoutedPlayerIds.includes(playerId)) {
        return state;
      }
      return {
        ...state,
        scoutingTargetIds: [...state.scoutingTargetIds, playerId],
      };
    }

    case 'REMOVE_SCOUTING_TARGET': {
      const { playerId } = action.payload;
      return {
        ...state,
        scoutingTargetIds: state.scoutingTargetIds.filter(id => id !== playerId),
      };
    }

    case 'ADD_SCOUTING_REPORT': {
      const { report } = action.payload;
      // Don't add duplicate reports for the same player
      if (state.scoutingReports.some(r => r.playerId === report.playerId)) {
        return state;
      }
      return {
        ...state,
        scoutingReports: [...state.scoutingReports, report],
      };
    }

    case 'SET_SCOUT_INSTRUCTIONS': {
      return {
        ...state,
        scoutInstructions: action.payload,
      };
    }

    case 'SET_SCOUTING_DEPTH_SLIDER': {
      // Clamp value between 0 and 1
      const value = Math.max(0, Math.min(1, action.payload));
      return {
        ...state,
        scoutingDepthSlider: value,
      };
    }

    // =========================================================================
    // YOUTH ACADEMY
    // =========================================================================

    case 'SET_YOUTH_ACADEMY_STATE': {
      return {
        ...state,
        youthAcademy: action.payload,
      };
    }

    case 'ADD_YOUTH_SCOUTING_REPORT': {
      const { report } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          scoutingReports: [...state.youthAcademy.scoutingReports, report],
        },
      };
    }

    case 'UPDATE_YOUTH_SCOUTING_REPORT': {
      const { reportId, report } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          scoutingReports: state.youthAcademy.scoutingReports.map((r) =>
            r.id === reportId ? report : r
          ),
        },
      };
    }

    case 'REMOVE_YOUTH_SCOUTING_REPORT': {
      const { reportId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          scoutingReports: state.youthAcademy.scoutingReports.filter(
            (r) => r.id !== reportId
          ),
        },
      };
    }

    case 'SIGN_PROSPECT_TO_ACADEMY': {
      const { prospect, signingCost = 0 } = action.payload;

      // Budget validation - prevent signing if it would make budget negative
      if (state.userTeam.availableBudget < signingCost) {
        console.warn(`SIGN_PROSPECT_TO_ACADEMY rejected: insufficient budget (need ${signingCost}, have ${state.userTeam.availableBudget})`);
        return state;
      }

      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          // Deduct signing cost from available budget
          availableBudget: state.userTeam.availableBudget - signingCost,
        },
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: [...state.youthAcademy.academyProspects, prospect],
        },
      };
    }

    case 'UPDATE_ACADEMY_PROSPECT': {
      const { prospectId, prospect } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.map((p) =>
            p.id === prospectId ? prospect : p
          ),
        },
      };
    }

    case 'REMOVE_ACADEMY_PROSPECT': {
      const { prospectId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.filter(
            (p) => p.id !== prospectId
          ),
        },
      };
    }

    case 'SET_LAST_REPORT_WEEK': {
      const { week } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          lastReportWeek: week,
          initialized: true,
        },
      };
    }

    case 'SET_SCOUT_SPORT_FOCUS': {
      const { focus } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          scoutSportFocus: focus,
        },
      };
    }

    // =========================================================================
    // PLAYER PROGRESSION
    // =========================================================================

    case 'SNAPSHOT_SEASON_ATTRIBUTES': {
      // Snapshot current attributes for all user team players at season start
      // This enables showing attribute change deltas in PlayerDetailScreen
      const updatedPlayers: Record<string, Player> = { ...state.players };

      for (const playerId of state.userTeam.rosterIds) {
        const player = updatedPlayers[playerId];
        if (player) {
          updatedPlayers[playerId] = {
            ...player,
            seasonStartAttributes: { ...player.attributes },
          };
        }
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    case 'APPLY_WEEKLY_PROGRESSION': {
      // Apply training and regression results to players
      const { results } = action.payload;
      const updatedPlayers: Record<string, Player> = { ...state.players };

      for (const result of results) {
        const player = updatedPlayers[result.playerId];
        if (!player) continue;

        // Merge updated attributes back into existing PlayerAttributes structure
        updatedPlayers[result.playerId] = {
          ...player,
          attributes: {
            ...player.attributes,
            ...result.updatedAttributes,
          },
          weeklyXP: result.updatedXP,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    case 'UPDATE_PLAYER': {
      // Update specific fields on a player
      const { playerId, updates } = action.payload;
      const player = state.players[playerId];
      if (!player) return state;

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            ...updates,
          },
        },
      };
    }

    case 'APPLY_INJURY': {
      // Apply injury to player and remove from all lineup positions
      const { playerId, injury, conditionPenalty } = action.payload;
      const player = state.players[playerId];
      if (!player) return state;

      // Update player with injury and reduced matchFitness
      const updatedPlayer = {
        ...player,
        injury,
        matchFitness: Math.max(0, (player.matchFitness ?? 100) - conditionPenalty),
      };

      // Remove injured player from all lineup positions
      const lineup = state.userTeam.lineup;
      const newLineup = { ...lineup };

      // Basketball - remove from starters
      newLineup.basketballStarters = lineup.basketballStarters.map(
        id => id === playerId ? '' : id
      ) as [string, string, string, string, string];

      // Soccer - remove from starters and positions
      if (lineup.soccerLineup.starters.includes(playerId)) {
        newLineup.soccerLineup = {
          ...lineup.soccerLineup,
          starters: lineup.soccerLineup.starters.filter(id => id !== playerId),
          positions: Object.fromEntries(
            Object.entries(lineup.soccerLineup.positions).filter(([id]) => id !== playerId)
          ),
        };
      }

      // Baseball - remove from batting order, pitcher, and bullpen
      if (lineup.baseballLineup.battingOrder.includes(playerId)) {
        newLineup.baseballLineup = {
          ...lineup.baseballLineup,
          battingOrder: lineup.baseballLineup.battingOrder.map(id => id === playerId ? '' : id),
          positions: Object.fromEntries(
            Object.entries(lineup.baseballLineup.positions).filter(([id]) => id !== playerId)
          ),
        };
      }
      if (lineup.baseballLineup.startingPitcher === playerId) {
        newLineup.baseballLineup = {
          ...newLineup.baseballLineup,
          startingPitcher: '',
        };
      }
      // Remove from bullpen if present
      const bullpen = lineup.baseballLineup.bullpen;
      if (bullpen) {
        newLineup.baseballLineup = {
          ...newLineup.baseballLineup,
          bullpen: {
            longRelievers: bullpen.longRelievers.map(id => id === playerId ? '' : id) as [string, string],
            shortRelievers: bullpen.shortRelievers.map(id => id === playerId ? '' : id) as [string, string],
            closer: bullpen.closer === playerId ? '' : bullpen.closer,
          },
        };
      }

      // Remove from bench
      newLineup.bench = lineup.bench.filter(id => id !== playerId);

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        userTeam: {
          ...state.userTeam,
          lineup: newLineup,
        },
      };
    }

    case 'APPLY_ACADEMY_TRAINING': {
      // Apply training results to academy prospects
      const { results } = action.payload;
      const updatedProspects = state.youthAcademy.academyProspects.map(prospect => {
        const result = results.find(r => r.prospectId === prospect.id);
        if (!result) return prospect;

        return {
          ...prospect,
          attributes: result.updatedAttributes,
          weeklyXP: result.updatedXP,
        };
      });

      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: updatedProspects,
        },
      };
    }

    // =========================================================================
    // MATCH FITNESS
    // =========================================================================

    case 'APPLY_MATCH_FATIGUE': {
      // Apply fatigue drain to all players who played in a match
      const fatigueUpdates = action.payload;
      const updatedPlayers: Record<string, Player> = { ...state.players };

      for (const { playerId, drain, matchDate, sport } of fatigueUpdates) {
        const player = updatedPlayers[playerId];
        if (!player) continue;

        // Apply drain, floor at 10%
        const newFitness = Math.max(10, player.matchFitness - drain);

        updatedPlayers[playerId] = {
          ...player,
          matchFitness: newFitness,
          lastMatchDate: matchDate,
          lastMatchSport: sport,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    case 'APPLY_FITNESS_RECOVERY': {
      // Apply fitness recovery to all players
      const { daysSinceAdvance, medicalBudgetDollars } = action.payload;
      const updatedPlayers: Record<string, Player> = { ...state.players };

      // Recovery calculation:
      // Base daily recovery: 4.3% (~30%/week)
      // Stamina attr modifier: ±30% at extremes
      // Medical budget bonus: 0-20% based on actual dollars spent (not percentage)
      const BASE_DAILY_RECOVERY = 4.3;
      const STAMINA_ATTR_RECOVERY_MOD = 0.3;

      // Medical bonus uses logarithmic scaling based on actual dollars
      // This ensures rich teams spending more get better outcomes than poor teams
      // $25K or less = 0% bonus (baseline)
      // $250K = ~8% bonus (typical Division 7)
      // $1M = ~13% bonus
      // $5M+ = 20% bonus (capped)
      const medicalBonus = medicalBudgetDollars <= 25000
        ? 1.0
        : 1.0 + Math.min(0.20, 0.08 * Math.log10(medicalBudgetDollars / 25000));

      for (const [playerId, player] of Object.entries(updatedPlayers)) {
        // Skip if already at max fitness
        if (player.matchFitness >= 100) continue;

        // Calculate stamina modifier
        const staminaNormalized = (player.attributes.stamina - 50) / 50;
        const recoveryMod = 1.0 + staminaNormalized * STAMINA_ATTR_RECOVERY_MOD;

        // Calculate total recovery
        const recovery = BASE_DAILY_RECOVERY * daysSinceAdvance * recoveryMod * medicalBonus;

        // Apply recovery, cap at 100
        const newFitness = Math.min(100, player.matchFitness + recovery);

        updatedPlayers[playerId] = {
          ...player,
          matchFitness: newFitness,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    // =========================================================================
    // MORALE SYSTEM
    // =========================================================================

    case 'RECORD_MATCH_RESULTS': {
      // Record match outcomes for player morale tracking
      const matchResults = action.payload as Array<{ playerId: string; outcome: 'win' | 'loss' | 'draw' }>;
      const updatedPlayers: Record<string, Player> = { ...state.players };

      for (const { playerId, outcome } of matchResults) {
        const player = updatedPlayers[playerId];
        if (!player) continue;

        // Add to front (most recent first), cap at 20
        const newResults = [outcome, ...player.recentMatchResults].slice(0, 20);

        updatedPlayers[playerId] = {
          ...player,
          recentMatchResults: newResults,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    case 'APPLY_MORALE_UPDATE': {
      // Apply weekly morale updates to players
      const moraleUpdates = action.payload as Array<{
        playerId: string;
        newMorale: number;
        weeksDisgruntled: number;
        transferRequestTriggered: boolean;
      }>;
      const updatedPlayers: Record<string, Player> = { ...state.players };

      for (const { playerId, newMorale, weeksDisgruntled, transferRequestTriggered } of moraleUpdates) {
        const player = updatedPlayers[playerId];
        if (!player) continue;

        updatedPlayers[playerId] = {
          ...player,
          morale: newMorale,
          weeksDisgruntled,
          transferRequestActive: transferRequestTriggered ? true : player.transferRequestActive,
          transferRequestDate: transferRequestTriggered ? new Date() : player.transferRequestDate,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
      };
    }

    // =========================================================================
    // AI ACTIONS
    // =========================================================================

    case 'AI_SIGN_FREE_AGENT': {
      const { teamId, playerId, salary, years } = action.payload;
      const player = state.players[playerId];

      if (!player || !state.league.freeAgentIds.includes(playerId)) {
        return state;
      }

      // Create contract for the player
      const newContract = {
        id: `contract-${Date.now()}-${playerId}`,
        playerId,
        teamId,
        salary,
        signingBonus: 0,
        contractLength: years,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000),
        performanceBonuses: {},
        releaseClause: null,
        salaryIncreases: [],
        agentFee: 0,
        clauses: [],
        squadRole: 'rotation_player' as const,
        loyaltyBonus: 0,
      };

      // Update player
      const updatedPlayer: Player = {
        ...player,
        teamId,
        contract: newContract,
        acquisitionType: 'free_agent',
        acquisitionDate: new Date(),
        matchFitness: 50, // Free agents start at reduced fitness
      };

      // Update AI team roster
      const updatedTeams = state.league.teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            rosterIds: [...team.rosterIds, playerId],
          };
        }
        return team;
      });

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        league: {
          ...state.league,
          teams: updatedTeams,
          freeAgentIds: state.league.freeAgentIds.filter(id => id !== playerId),
        },
      };
    }

    case 'AI_MAKE_TRANSFER_BID': {
      const { buyerTeamId, sellerTeamId, playerId, bidAmount } = action.payload;
      const player = state.players[playerId];

      if (!player) return state;

      // If selling to user, add to incoming offers
      if (sellerTeamId === 'user') {
        const newOffer: TransferOffer = {
          id: `offer-ai-${Date.now()}-${playerId}`,
          offeringTeamId: buyerTeamId,
          receivingTeamId: 'user',
          playerId,
          transferFee: bidAmount,
          status: 'pending',
          createdDate: new Date(),
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          negotiationHistory: [
            {
              amount: bidAmount,
              from: buyerTeamId,
              timestamp: new Date(),
            },
          ],
        };

        return {
          ...state,
          market: {
            ...state.market,
            transferOffers: [...state.market.transferOffers, newOffer],
            incomingOffers: [...state.market.incomingOffers, newOffer],
          },
        };
      }

      // AI to AI transfer - auto-process based on seller personality
      // For now, just log it (could be expanded to full AI negotiation)
      console.log(`[AI Transfer] ${buyerTeamId} bids $${bidAmount} for ${player.name} from ${sellerTeamId}`);

      return state;
    }

    case 'AI_RELEASE_PLAYER': {
      const { teamId, playerId } = action.payload;
      const player = state.players[playerId];

      if (!player || player.teamId !== teamId) {
        return state;
      }

      // Update player to free agent
      const updatedPlayer: Player = {
        ...player,
        teamId: 'free_agent',
        contract: null,
      };

      // Remove from AI team roster
      const updatedTeams = state.league.teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            rosterIds: team.rosterIds.filter(id => id !== playerId),
          };
        }
        return team;
      });

      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        league: {
          ...state.league,
          teams: updatedTeams,
          freeAgentIds: [...state.league.freeAgentIds, playerId],
        },
      };
    }

    case 'AI_RESPOND_TO_TRANSFER': {
      const { offerId, decision, counterAmount } = action.payload;

      const updateOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.id !== offerId) return offer;

        if (decision === 'accept') {
          return { ...offer, status: 'accepted' };
        } else if (decision === 'reject') {
          return { ...offer, status: 'rejected' };
        } else if (decision === 'counter' && counterAmount) {
          return {
            ...offer,
            status: 'countered',
            negotiationHistory: [
              ...offer.negotiationHistory,
              {
                amount: counterAmount,
                from: offer.receivingTeamId,
                timestamp: new Date(),
              },
            ],
          };
        }
        return offer;
      };

      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: state.market.transferOffers.map(updateOffer),
          outgoingOffers: state.market.outgoingOffers.map(updateOffer),
        },
      };
    }

    // =========================================================================
    // SHORTLIST & TRANSFER LIST
    // =========================================================================

    case 'ADD_TO_SHORTLIST': {
      const { playerId } = action.payload;
      const currentShortlist = state.userTeam.shortlistedPlayerIds || [];
      // Don't add duplicates or own players
      if (currentShortlist.includes(playerId)) {
        return state;
      }
      if (state.userTeam.rosterIds.includes(playerId)) {
        return state;
      }
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          shortlistedPlayerIds: [...currentShortlist, playerId],
        },
      };
    }

    case 'REMOVE_FROM_SHORTLIST': {
      const { playerId } = action.payload;
      const currentShortlist = state.userTeam.shortlistedPlayerIds || [];
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          shortlistedPlayerIds: currentShortlist.filter(id => id !== playerId),
        },
      };
    }

    case 'ADD_TO_TRANSFER_LIST': {
      const { playerId, askingPrice } = action.payload;
      const currentTransferList = state.userTeam.transferListPlayerIds || [];
      const currentAskingPrices = state.userTeam.transferListAskingPrices || {};
      // Must be own player and not already listed
      if (!state.userTeam.rosterIds.includes(playerId)) {
        return state;
      }
      if (currentTransferList.includes(playerId)) {
        return state;
      }
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          transferListPlayerIds: [...currentTransferList, playerId],
          transferListAskingPrices: {
            ...currentAskingPrices,
            [playerId]: askingPrice,
          },
        },
      };
    }

    case 'REMOVE_FROM_TRANSFER_LIST': {
      const { playerId } = action.payload;
      const currentTransferList = state.userTeam.transferListPlayerIds || [];
      const currentAskingPrices = state.userTeam.transferListAskingPrices || {};
      // Remove the asking price for this player
      const { [playerId]: _removed, ...remainingAskingPrices } = currentAskingPrices;
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          transferListPlayerIds: currentTransferList.filter(id => id !== playerId),
          transferListAskingPrices: remainingAskingPrices,
        },
      };
    }

    // =========================================================================
    // TROPHY CASE & MANAGER RATING
    // =========================================================================

    case 'ADD_TROPHY': {
      return {
        ...state,
        trophies: [...state.trophies, action.payload],
      };
    }

    case 'ADD_PLAYER_AWARD': {
      return {
        ...state,
        playerAwards: [...state.playerAwards, action.payload],
      };
    }

    case 'UPDATE_MANAGER_CAREER': {
      return {
        ...state,
        managerCareer: action.payload,
      };
    }

    default:
      return state;
  }
}

export default gameReducer;
