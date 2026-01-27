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
  DEFAULT_LOAN_STATE,
  SAVE_VERSION,
} from './types';
import type { Player, TransferOffer, ContractNegotiation, Contract, NewsItem, LoanOffer, ActiveLoan } from '../../data/types';
import {
  createLoanOffer,
  activateLoan,
  completeLoan,
  recallLoan,
  exerciseBuyOption,
  recordLoanAppearance,
  expireOldLoanOffers,
  LOAN_OFFER_EXPIRY_WEEKS,
} from '../../systems/loanSystem';
import {
  createNegotiation,
  processNegotiationRound,
  createDefaultOffer,
  createContractFromOffer,
  calculateSigningCost,
} from '../../systems/contractSystem';
import { createManagerCareer } from '../../systems/managerRatingSystem';
import { DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY } from '../../simulation/baseball/types';
import {
  getHomeRegion,
  createEmptyYouthLeagueStats,
  WEEKLY_ACADEMY_FEE,
  TRIAL_COST,
  type AcademyProspect,
} from '../../systems/youthAcademySystem';

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
    country: 'US',
    city: '',
    startingDivision: 5,
    division: 5,
    totalBudget: 0,
    salaryCommitment: 0,
    availableBudget: 0,
    operationsBudget: DEFAULT_OPERATIONS_BUDGET,
    rosterIds: [],
    lineup: {
      basketballStarters: ['', '', '', '', ''],
      basketballFormation: '2-2-1',
      baseballLineup: {
        battingOrder: ['', '', '', '', '', '', '', '', '', ''],
        positions: {},
        startingPitcher: '',
        bullpen: {
          longRelievers: ['', ''],
          shortRelievers: ['', '', '', ''],
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
      soccerMinutesAllocation: {},
    },
    gamedayLineup: null,
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
    country: 'US',
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

  loans: DEFAULT_LOAN_STATE,

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
        loans: DEFAULT_LOAN_STATE,
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
      const legacyYouthAcademy = action.payload.youthAcademy || DEFAULT_YOUTH_ACADEMY_STATE;

      // Migrate youth academy to include new regional scouting and trial fields
      const homeRegion = legacyYouthAcademy.homeRegion ?? getHomeRegion(action.payload.userTeam.country);
      const currentSeason = action.payload.season?.number ?? 1;

      // Migrate existing academy prospects to include new fields
      const migratedProspects: AcademyProspect[] = (legacyYouthAcademy.academyProspects || []).map(prospect => ({
        ...prospect,
        trainingFocus: prospect.trainingFocus ?? null,
        youthLeagueStats: prospect.youthLeagueStats ?? createEmptyYouthLeagueStats(currentSeason),
        rivalInterest: prospect.rivalInterest ?? null,
        source: prospect.source ?? 'scouting',
        scoutedRegion: prospect.scoutedRegion ?? homeRegion,
        weeklyCost: WEEKLY_ACADEMY_FEE, // Use new lower cost
      }));

      // Migrate scouting reports to include region field
      const migratedReports = (legacyYouthAcademy.scoutingReports || []).map(report => ({
        ...report,
        region: report.region ?? homeRegion,
        rivalInterest: report.rivalInterest ?? null,
      }));

      const youthAcademy = {
        ...legacyYouthAcademy,
        academyProspects: migratedProspects,
        scoutingReports: migratedReports,
        homeRegion,
        selectedRegion: legacyYouthAcademy.selectedRegion ?? homeRegion,
        trialProspects: legacyYouthAcademy.trialProspects ?? [],
        lastTrialWeek: legacyYouthAcademy.lastTrialWeek ?? 0,
      };
      // Handle legacy saves that don't have trophy/career data
      const trophies = action.payload.trophies || [];
      const playerAwards = action.payload.playerAwards || [];
      const managerCareer = action.payload.managerCareer ||
        createManagerCareer(action.payload.userTeam.name, action.payload.userTeam.division);

      // Migrate players to have matchFitness fields (v2 migration)
      // and loanStatus field (loan system migration)
      const migratedPlayers: Record<string, Player> = {};
      for (const [playerId, player] of Object.entries(action.payload.players || {})) {
        migratedPlayers[playerId] = {
          ...player,
          // Add matchFitness fields if missing (default to fully fit)
          matchFitness: player.matchFitness ?? 100,
          lastMatchDate: player.lastMatchDate ?? null,
          lastMatchSport: player.lastMatchSport ?? null,
          // Add loanStatus if missing (loan system migration)
          loanStatus: player.loanStatus ?? null,
        };
      }

      // Handle legacy saves that don't have loan state
      const loans = action.payload.loans || DEFAULT_LOAN_STATE;

      // Handle legacy saves that don't have AI team strategies (v3 migration)
      const aiTeamStrategies = action.payload.season?.aiTeamStrategies || {};

      // Migrate lineup to include basketball formation if missing
      const legacyLineup = action.payload.userTeam?.lineup || {};
      const migratedLineup = {
        ...legacyLineup,
        basketballFormation: legacyLineup.basketballFormation || '2-2-1',
      };

      return {
        ...action.payload,
        initialized: true,
        players: migratedPlayers,
        userTeam: {
          ...action.payload.userTeam,
          lineup: migratedLineup,
        },
        season: {
          ...action.payload.season,
          aiTeamStrategies,
        },
        loans,
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
      const lineup = action.payload;
      const rosterSet = new Set(state.userTeam.rosterIds);

      // Helper to validate player IDs
      const validatePlayerIds = (ids: string[], context: string): boolean => {
        for (const id of ids) {
          if (id === '') continue; // Empty slots are valid
          if (!rosterSet.has(id)) {
            console.warn(`[SET_LINEUP] Invalid player ID in ${context}: ${id} not on roster`);
            return false;
          }
          // Check if player is injured (warning only, still allow)
          const player = state.players[id];
          if (player && player.injury !== null) {
            console.warn(`[SET_LINEUP] Warning: Injured player ${player.name} in ${context}`);
          }
        }
        return true;
      };

      // Validate basketball starters
      if (!validatePlayerIds(lineup.basketballStarters, 'basketballStarters')) {
        return state;
      }

      // Validate baseball lineup
      if (!validatePlayerIds(lineup.baseballLineup.battingOrder, 'baseballLineup.battingOrder')) {
        return state;
      }
      const baseballPositionIds = Object.keys(lineup.baseballLineup.positions);
      if (!validatePlayerIds(baseballPositionIds, 'baseballLineup.positions')) {
        return state;
      }
      if (lineup.baseballLineup.startingPitcher && !rosterSet.has(lineup.baseballLineup.startingPitcher)) {
        console.warn(`[SET_LINEUP] Invalid player ID in startingPitcher: ${lineup.baseballLineup.startingPitcher}`);
        return state;
      }
      // Validate bullpen
      const bullpen = lineup.baseballLineup.bullpen;
      const bullpenIds = [...bullpen.longRelievers, ...bullpen.shortRelievers, bullpen.closer];
      if (!validatePlayerIds(bullpenIds, 'baseballLineup.bullpen')) {
        return state;
      }

      // Validate soccer lineup
      if (!validatePlayerIds(lineup.soccerLineup.starters, 'soccerLineup.starters')) {
        return state;
      }
      const soccerPositionIds = Object.keys(lineup.soccerLineup.positions);
      if (!validatePlayerIds(soccerPositionIds, 'soccerLineup.positions')) {
        return state;
      }

      // Validate bench
      if (!validatePlayerIds(lineup.bench, 'bench')) {
        return state;
      }

      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          lineup,
        },
      };
    }

    case 'SET_GAMEDAY_LINEUP': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          gamedayLineup: action.payload,
        },
      };
    }

    case 'CLEAR_GAMEDAY_LINEUP': {
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          gamedayLineup: null,
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
        basketballFormation: currentLineup.basketballFormation || '2-2-1',
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
            ) as [string, string, string, string],
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
        minutesAllocation: { ...(currentLineup.minutesAllocation ?? {}) },
        soccerMinutesAllocation: { ...(currentLineup.soccerMinutesAllocation ?? {}) },
      };
      delete newLineup.minutesAllocation[playerId];
      delete newLineup.soccerMinutesAllocation[playerId];

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

      // When accepting, set to 'pending_player_decision' - the player needs to negotiate
      // a contract with the buying team before the transfer is finalized.
      // The user can accept multiple offers - the player will choose the best one.
      const updateOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.id !== offerId) return offer;
        return {
          ...offer,
          status: accept ? 'pending_player_decision' : 'rejected',
        };
      };

      const updatedOffers = state.market.transferOffers.map(updateOffer);

      // Don't transfer the player immediately when accepting!
      // The transfer will be finalized during weekly progression after the player
      // negotiates a contract with the buying team(s).
      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: updatedOffers,
          incomingOffers: state.market.incomingOffers.map(updateOffer),
        },
      };
    }

    case 'COUNTER_TRANSFER_OFFER': {
      // User counters an AI's offer (user is the seller)
      const { offerId, counterAmount } = action.payload;

      const updateOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.id !== offerId) return offer;

        // Add counter to negotiation history
        const historyEntry = {
          amount: counterAmount,
          from: 'user',
          timestamp: new Date(),
        };

        return {
          ...offer,
          status: 'countered' as const,
          counterOffer: {
            amount: counterAmount,
            counteredBy: 'user',
            counteredDate: new Date(),
          },
          negotiationHistory: [...(offer.negotiationHistory || []), historyEntry],
          negotiationRound: (offer.negotiationRound || 1) + 1,
        };
      };

      return {
        ...state,
        market: {
          ...state.market,
          transferOffers: state.market.transferOffers.map(updateOffer),
          incomingOffers: state.market.incomingOffers.map(updateOffer),
        },
      };
    }

    case 'AI_RESPOND_TO_COUNTER': {
      // AI responds to user's counter-offer
      const { offerId, decision, newAmount } = action.payload;

      const updateOffer = (offer: TransferOffer): TransferOffer => {
        if (offer.id !== offerId) return offer;

        if (decision === 'accept') {
          // AI accepts user's counter - use the counter amount
          return {
            ...offer,
            status: 'accepted' as const,
            transferFee: offer.counterOffer?.amount || offer.transferFee,
          };
        } else if (decision === 'walk_away') {
          return {
            ...offer,
            status: 'walked_away' as const,
          };
        } else {
          // AI counters back
          const historyEntry = {
            amount: newAmount || offer.transferFee,
            from: offer.offeringTeamId,
            timestamp: new Date(),
          };

          return {
            ...offer,
            status: 'pending' as const, // Back to pending, waiting for user response
            transferFee: newAmount || offer.transferFee,
            counterOffer: undefined, // Clear user's counter since AI responded
            negotiationHistory: [...(offer.negotiationHistory || []), historyEntry],
            negotiationRound: (offer.negotiationRound || 1) + 1,
          };
        }
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

      // If AI accepted, process the transfer (same as RESPOND_TO_OFFER accept)
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
              // Remove from transfer list
              transferListPlayerIds: newState.userTeam.transferListPlayerIds?.filter(
                (id: string) => id !== acceptedOffer.playerId
              ),
              availableBudget:
                newState.userTeam.availableBudget + acceptedOffer.transferFee,
            },
          };

          // Add to AI team roster
          const aiTeam = newState.league.teams.find(
            (t) => t.id === acceptedOffer.offeringTeamId
          );
          if (aiTeam) {
            newState = {
              ...newState,
              league: {
                ...newState.league,
                teams: newState.league.teams.map((t) =>
                  t.id === acceptedOffer.offeringTeamId
                    ? { ...t, rosterIds: [...t.rosterIds, acceptedOffer.playerId] }
                    : t
                ),
              },
            };
          }
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

    case 'PROCESS_PENDING_PLAYER_DECISIONS': {
      // Process offers where the user has accepted the bid but the player
      // hasn't decided yet (needs to negotiate contract with buying team)
      const { currentWeek: _currentWeek, isTransferWindowOpen } = action.payload;

      // Find all offers pending player decision
      const pendingOffers = state.market.incomingOffers.filter(
        (offer) => offer.status === 'pending_player_decision'
      );

      if (pendingOffers.length === 0) {
        return state;
      }

      // Group offers by player
      const offersByPlayer = new Map<string, TransferOffer[]>();
      for (const offer of pendingOffers) {
        const existing = offersByPlayer.get(offer.playerId) || [];
        existing.push(offer);
        offersByPlayer.set(offer.playerId, existing);
      }

      let newState = { ...state };
      const completedTransfers: Array<{
        playerId: string;
        toTeamId: string;
        toTeamName: string;
        fee: number;
        offerId: string;
        playerName: string;
      }> = [];
      const failedNegotiations: string[] = []; // offer IDs
      const failedTransferNews: Array<{ playerName: string; toTeamName: string }> = [];

      // For each player with pending offers, simulate their decision
      for (const [playerId, playerOffers] of offersByPlayer) {
        const player = newState.players[playerId];
        if (!player) continue;

        // Sort offers by transfer fee (player prefers higher-paying teams typically)
        const sortedOffers = [...playerOffers].sort((a, b) => b.transferFee - a.transferFee);

        // Simulate contract negotiation success probability
        // Higher chance of success if: multiple offers (competition), good transfer fee, player on transfer list
        const baseSuccessRate = 0.75; // 75% base success rate
        const competitionBonus = sortedOffers.length > 1 ? 0.15 : 0; // +15% if multiple suitors
        const successRate = Math.min(0.95, baseSuccessRate + competitionBonus);

        // Random check to see if negotiations succeed
        const negotiationSucceeds = Math.random() < successRate;

        // sortedOffers always has at least one entry since we're iterating over playerOffers
        const bestOffer = sortedOffers[0]!;

        if (negotiationSucceeds) {
          // Player accepts the best offer (highest fee)
          const toTeam = newState.league.teams.find((t) => t.id === bestOffer.offeringTeamId);
          completedTransfers.push({
            playerId,
            toTeamId: bestOffer.offeringTeamId,
            toTeamName: toTeam?.name || 'Unknown Team',
            fee: bestOffer.transferFee,
            offerId: bestOffer.id,
            playerName: player.name,
          });

          // Mark other offers for this player as rejected (player chose different team)
          for (const offer of sortedOffers.slice(1)) {
            failedNegotiations.push(offer.id);
          }
        } else {
          // All negotiations for this player failed - add to failed list and create news event
          for (const offer of sortedOffers) {
            failedNegotiations.push(offer.id);
          }
          const toTeam = newState.league.teams.find((t) => t.id === bestOffer.offeringTeamId);
          failedTransferNews.push({
            playerName: player.name,
            toTeamName: toTeam?.name || 'Unknown Team',
          });
          console.log(`[Transfer] Contract negotiations failed for ${player.name} - player stays with current team`);
        }
      }

      // Update offer statuses
      const updateOfferStatus = (offer: TransferOffer): TransferOffer => {
        const completedTransfer = completedTransfers.find((t) => t.offerId === offer.id);
        if (completedTransfer) {
          return { ...offer, status: 'accepted' };
        }
        if (failedNegotiations.includes(offer.id)) {
          return { ...offer, status: 'rejected' };
        }
        return offer;
      };

      newState = {
        ...newState,
        market: {
          ...newState.market,
          transferOffers: newState.market.transferOffers.map(updateOfferStatus),
          incomingOffers: newState.market.incomingOffers.map(updateOfferStatus),
        },
      };

      // Process completed transfers
      const newsEvents: NewsItem[] = [];

      for (const transfer of completedTransfers) {
        const { playerId, toTeamId, toTeamName, fee, playerName } = transfer;
        const player = newState.players[playerId];

        if (!player) continue;

        // If transfer window is closed, we can't complete the transfer yet
        // In the future, we could add a "pending_window" status
        if (!isTransferWindowOpen) {
          console.log(`[Transfer] ${player.name} agreed to join ${toTeamId} but transfer window is closed - will complete when it opens`);
          // For now, we still complete it - proper window handling would need more state
        }

        // Create a contract for the player - use existing salary as baseline with raise
        const baseSalary = player.contract?.salary || 100000;
        const newSalary = Math.round(baseSalary * 1.15); // 15% raise for moving teams

        const newContract = {
          id: `contract-${Date.now()}-${playerId}`,
          playerId,
          teamId: toTeamId,
          salary: newSalary,
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
          acquisitionType: 'trade',
          acquisitionDate: new Date(),
        };

        // Build updated asking prices without the sold player
        const updatedAskingPrices = { ...newState.userTeam.transferListAskingPrices };
        delete updatedAskingPrices[playerId];

        // Remove sold player from lineup (all sports)
        const currentLineup = newState.userTeam.lineup;
        const cleanedLineup: LineupConfig = {
          basketballStarters: currentLineup.basketballStarters.map((id) =>
            id === playerId ? '' : id
          ) as [string, string, string, string, string],
          basketballFormation: currentLineup.basketballFormation || '2-2-1',
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
              ) as [string, string, string, string],
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
          minutesAllocation: { ...(currentLineup.minutesAllocation ?? {}) },
          soccerMinutesAllocation: { ...(currentLineup.soccerMinutesAllocation ?? {}) },
        };
        delete cleanedLineup.minutesAllocation[playerId];
        delete cleanedLineup.soccerMinutesAllocation[playerId];

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [playerId]: updatedPlayer,
          },
          userTeam: {
            ...newState.userTeam,
            rosterIds: newState.userTeam.rosterIds.filter((id) => id !== playerId),
            lineup: cleanedLineup,
            availableBudget: newState.userTeam.availableBudget + fee,
            salaryCommitment: newState.userTeam.salaryCommitment - (player.contract?.salary || 0),
            transferListPlayerIds: (newState.userTeam.transferListPlayerIds || []).filter(
              (id: string) => id !== playerId
            ),
            transferListAskingPrices: updatedAskingPrices,
          },
          league: {
            ...newState.league,
            teams: newState.league.teams.map((team) => {
              if (team.id === toTeamId) {
                // Add player to AI team roster
                // Note: AI team budget tracking would require adding budget field to AITeamState
                return {
                  ...team,
                  rosterIds: [...team.rosterIds, playerId],
                };
              }
              return team;
            }),
          },
        };

        // Add news event for completed transfer
        newsEvents.push({
          id: `event-transfer-complete-${Date.now()}-${playerId}`,
          type: 'transfer',
          priority: 'important',
          title: 'Transfer Complete',
          message: `${playerName} has completed his move to ${toTeamName} for $${(fee / 1000).toFixed(0)}K.`,
          timestamp: new Date(),
          read: false,
          relatedEntityId: playerId,
          scope: 'team',
          teamId: 'user',
        });

        console.log(`[Transfer] ${player.name} completed transfer to ${toTeamId} for $${fee.toLocaleString()}`);
      }

      // Add news events for failed negotiations
      for (let i = 0; i < failedTransferNews.length; i++) {
        const failed = failedTransferNews[i]!; // Index always valid in this loop
        newsEvents.push({
          id: `event-transfer-failed-${Date.now()}-${i}-${failed.playerName}`,
          type: 'transfer',
          priority: 'important',
          title: 'Transfer Collapsed',
          message: `${failed.playerName} could not agree personal terms with ${failed.toTeamName}. The transfer has fallen through.`,
          timestamp: new Date(),
          read: false,
          scope: 'team',
          teamId: 'user',
        });
      }

      // Add all news events to state
      if (newsEvents.length > 0) {
        newState = {
          ...newState,
          events: [...newState.events, ...newsEvents],
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

      // Update offer status to 'negotiating' if this is a transfer (keeps offer visible in My Offers)
      // The offer stays in the list until the transfer is completed or expires
      const updatedOutgoingOffers = negotiationType === 'transfer'
        ? state.market.outgoingOffers.map((offer) =>
            offer.playerId === playerId && offer.status === 'accepted'
              ? { ...offer, status: 'negotiating' as const }
              : offer
          )
        : state.market.outgoingOffers;

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: negotiation,
          outgoingOffers: updatedOutgoingOffers,
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

      // If this was a transfer negotiation, revert the offer back to 'accepted' status
      // so the user can re-start negotiations later
      const revertedOutgoingOffers = negotiation.negotiationType === 'transfer'
        ? state.market.outgoingOffers.map((offer) =>
            offer.playerId === negotiation.playerId && offer.status === 'negotiating'
              ? { ...offer, status: 'accepted' as const }
              : offer
          )
        : state.market.outgoingOffers;

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: null,
          negotiationHistory: [cancelledNegotiation, ...state.market.negotiationHistory],
          outgoingOffers: revertedOutgoingOffers,
        },
      };
    }

    case 'EXPIRE_NEGOTIATION': {
      // Called when negotiation deadline passes without a deal being reached
      // Player withdraws from negotiations
      const negotiation = state.market.activeNegotiation;

      if (!negotiation) return state;

      // Move to history as expired
      const expiredNegotiation: ContractNegotiation = {
        ...negotiation,
        status: 'rejected', // Player walked away
      };

      // If this was a transfer negotiation, remove the offer entirely
      // (unlike cancel where we revert to 'accepted', here the deal is dead)
      const cleanedOutgoingOffers = negotiation.negotiationType === 'transfer'
        ? state.market.outgoingOffers.filter(
            (offer) => !(offer.playerId === negotiation.playerId && offer.status === 'negotiating')
          )
        : state.market.outgoingOffers;

      return {
        ...state,
        market: {
          ...state.market,
          activeNegotiation: null,
          negotiationHistory: [expiredNegotiation, ...state.market.negotiationHistory],
          outgoingOffers: cleanedOutgoingOffers,
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
      const budget = action.payload;

      // Validate: all values must be non-negative
      const values = [budget.training, budget.scouting, budget.medical, budget.youthDevelopment];
      const hasNegative = values.some(v => v < 0);
      if (hasNegative) {
        console.warn('[SET_OPERATIONS_BUDGET] Invalid budget: negative values not allowed', budget);
        return state; // Reject invalid budget
      }

      // Validate: percentages must sum to 100
      const sum = values.reduce((acc, v) => acc + v, 0);
      if (Math.abs(sum - 100) > 0.01) { // Allow small floating point tolerance
        console.warn(`[SET_OPERATIONS_BUDGET] Invalid budget: percentages sum to ${sum}, expected 100`, budget);
        return state; // Reject invalid budget
      }

      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          operationsBudget: budget,
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
    // REGIONAL SCOUTING
    // =========================================================================

    case 'SET_SCOUTING_REGION': {
      const { region } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          selectedRegion: region,
        },
      };
    }

    // =========================================================================
    // TRIAL SYSTEM
    // =========================================================================

    case 'HOLD_TRIAL_EVENT': {
      const { week } = action.payload;
      return {
        ...state,
        userTeam: {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget - TRIAL_COST,
        },
        youthAcademy: {
          ...state.youthAcademy,
          lastTrialWeek: week,
        },
      };
    }

    case 'ADD_TRIAL_PROSPECTS': {
      const { prospects } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          trialProspects: prospects,
        },
      };
    }

    case 'INVITE_TO_NEXT_TRIAL': {
      const { prospectId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          trialProspects: state.youthAcademy.trialProspects.map(p =>
            p.id === prospectId
              ? { ...p, invitedToNextTrial: true, status: 'invited' as const }
              : p
          ),
        },
      };
    }

    case 'SIGN_TRIAL_PROSPECT': {
      // Only removes from trial list - SIGN_PROSPECT_TO_ACADEMY handles adding to academy
      const { prospectId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          trialProspects: state.youthAcademy.trialProspects.filter(p => p.id !== prospectId),
        },
      };
    }

    case 'PASS_TRIAL_PROSPECT': {
      const { prospectId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          trialProspects: state.youthAcademy.trialProspects.filter(p => p.id !== prospectId),
        },
      };
    }

    case 'CLEAR_TRIAL_PROSPECTS': {
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          trialProspects: [],
        },
      };
    }

    case 'RELEASE_ACADEMY_PROSPECT': {
      const { prospectId } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.map(p =>
            p.id === prospectId ? { ...p, status: 'released' as const } : p
          ),
        },
      };
    }

    // =========================================================================
    // YOUTH LEAGUE & DEVELOPMENT
    // =========================================================================

    case 'UPDATE_YOUTH_LEAGUE_STATS': {
      const { prospectId, stats } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.map(p => {
            if (p.id !== prospectId || !p.youthLeagueStats) return p;
            return {
              ...p,
              youthLeagueStats: {
                ...p.youthLeagueStats,
                basketball: { ...p.youthLeagueStats.basketball, ...stats.basketball },
                baseball: { ...p.youthLeagueStats.baseball, ...stats.baseball },
                soccer: { ...p.youthLeagueStats.soccer, ...stats.soccer },
              },
            };
          }),
        },
      };
    }

    case 'ADD_RIVAL_INTEREST': {
      const { prospectId, interest } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.map(p =>
            p.id === prospectId ? { ...p, rivalInterest: interest } : p
          ),
        },
      };
    }

    case 'SET_PROSPECT_TRAINING_FOCUS': {
      const { prospectId, focus } = action.payload;
      return {
        ...state,
        youthAcademy: {
          ...state.youthAcademy,
          academyProspects: state.youthAcademy.academyProspects.map(p =>
            p.id === prospectId ? { ...p, trainingFocus: focus } : p
          ),
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
            shortRelievers: bullpen.shortRelievers.map(id => id === playerId ? '' : id) as [string, string, string, string],
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
        // Check if there's already an active offer from this team for this player
        const existingOffer = state.market.incomingOffers.find(
          o => o.offeringTeamId === buyerTeamId &&
               o.playerId === playerId &&
               (o.status === 'pending' || o.status === 'countered')
        );

        // If there's already an offer in progress, skip the new one
        if (existingOffer) {
          console.log(`[Transfer] Skipping duplicate offer from ${buyerTeamId} for player ${playerId}`);
          return state;
        }

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

    case 'UPDATE_AI_TRANSFER_LISTS': {
      // Update AI team transfer lists based on their weekly decisions
      const { listings } = action.payload;

      // Group listings and asking prices by team
      const listingsByTeam = new Map<string, string[]>();
      const pricesByTeam = new Map<string, Record<string, number>>();
      for (const listing of listings) {
        // Player IDs
        const existingIds = listingsByTeam.get(listing.teamId) || [];
        existingIds.push(listing.playerId);
        listingsByTeam.set(listing.teamId, existingIds);

        // Asking prices
        const existingPrices = pricesByTeam.get(listing.teamId) || {};
        existingPrices[listing.playerId] = listing.askingPrice;
        pricesByTeam.set(listing.teamId, existingPrices);
      }

      // Update each team's transfer list and asking prices
      const updatedTeams = state.league.teams.map(team => {
        const teamListings = listingsByTeam.get(team.id);
        const teamPrices = pricesByTeam.get(team.id);
        if (teamListings) {
          // Combine with existing listings (avoid duplicates)
          const existingListings = team.transferListPlayerIds || [];
          const existingPrices = team.transferListAskingPrices || {};
          const combined = [...new Set([...existingListings, ...teamListings])];
          return {
            ...team,
            transferListPlayerIds: combined,
            transferListAskingPrices: { ...existingPrices, ...teamPrices },
          };
        }
        return team;
      });

      return {
        ...state,
        league: {
          ...state.league,
          teams: updatedTeams,
        },
      };
    }

    case 'AI_EXECUTE_TRANSFER': {
      // Execute an AI-to-AI transfer
      const { buyerTeamId, sellerTeamId, playerId, transferFee } = action.payload;
      const player = state.players[playerId];

      if (!player) {
        console.log(`[AI Transfer] Player ${playerId} not found`);
        return state;
      }

      // Find buyer and seller teams
      const buyerTeamIndex = state.league.teams.findIndex(t => t.id === buyerTeamId);
      const sellerTeamIndex = state.league.teams.findIndex(t => t.id === sellerTeamId);

      if (buyerTeamIndex === -1 || sellerTeamIndex === -1) {
        console.log(`[AI Transfer] Team not found: buyer=${buyerTeamId}, seller=${sellerTeamId}`);
        return state;
      }

      const buyerTeam = state.league.teams[buyerTeamIndex];

      // Check buyer can afford it
      if (!buyerTeam || !buyerTeam.budget || buyerTeam.budget.available < transferFee) {
        console.log(`[AI Transfer] Buyer ${buyerTeamId} can't afford $${transferFee}`);
        return state;
      }

      // Create new contract for the player
      const newContract: Contract = {
        id: `contract-${Date.now()}-${playerId}`,
        playerId,
        teamId: buyerTeamId,
        salary: player.contract?.salary || 50000,
        signingBonus: 0,
        contractLength: 2,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
        performanceBonuses: {},
        releaseClause: null,
        salaryIncreases: [],
        agentFee: 0,
        clauses: [],
        squadRole: 'rotation_player',
        loyaltyBonus: 0,
      };

      // Update player
      const updatedPlayer: Player = {
        ...player,
        teamId: buyerTeamId,
        contract: newContract,
        acquisitionType: 'trade',
        acquisitionDate: new Date(),
      };

      // Update teams
      const updatedTeams = state.league.teams.map((team, index) => {
        if (index === buyerTeamIndex) {
          return {
            ...team,
            rosterIds: [...team.rosterIds, playerId],
            budget: {
              ...team.budget!,
              available: team.budget!.available - transferFee,
            },
          };
        }
        if (index === sellerTeamIndex) {
          return {
            ...team,
            rosterIds: team.rosterIds.filter(id => id !== playerId),
            budget: team.budget ? {
              ...team.budget,
              available: team.budget.available + transferFee,
            } : undefined,
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

    // =========================================================================
    // LOAN SYSTEM
    // =========================================================================

    case 'MAKE_LOAN_OFFER': {
      const { playerId, receivingTeamId, terms } = action.payload;
      const currentWeek = state.season.currentWeek;

      const newOffer = createLoanOffer(
        'user', // User is offering to loan in
        receivingTeamId, // Owner of the player
        playerId,
        terms,
        currentWeek
      );

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: [...state.loans.loanOffers, newOffer],
          outgoingLoanOffers: [...state.loans.outgoingLoanOffers, newOffer],
        },
      };
    }

    case 'RESPOND_TO_LOAN_OFFER': {
      const { offerId, accept } = action.payload;
      const offer = state.loans.incomingLoanOffers.find(o => o.id === offerId);

      if (!offer) return state;

      const updatedStatus: LoanOffer['status'] = accept ? 'accepted' : 'rejected';

      const updateOffer = (o: LoanOffer): LoanOffer =>
        o.id === offerId ? { ...o, status: updatedStatus } : o;

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: state.loans.loanOffers.map(updateOffer),
          incomingLoanOffers: state.loans.incomingLoanOffers.map(updateOffer),
        },
      };
    }

    case 'COUNTER_LOAN_OFFER': {
      const { offerId, counterTerms } = action.payload;
      const offer = state.loans.incomingLoanOffers.find(o => o.id === offerId);

      if (!offer) return state;

      const currentWeek = state.season.currentWeek;
      const updateOffer = (o: LoanOffer): LoanOffer =>
        o.id === offerId
          ? {
              ...o,
              status: 'countered',
              counterTerms,
              negotiationHistory: [
                ...o.negotiationHistory,
                { terms: counterTerms, from: 'user', week: currentWeek },
              ],
            }
          : o;

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: state.loans.loanOffers.map(updateOffer),
          incomingLoanOffers: state.loans.incomingLoanOffers.map(updateOffer),
        },
      };
    }

    case 'ACCEPT_COUNTER_LOAN_OFFER': {
      // User accepts a counter offer on their outgoing loan offer
      const { offerId } = action.payload;
      const offer = state.loans.outgoingLoanOffers.find(o => o.id === offerId);

      if (!offer || offer.status !== 'countered' || !offer.counterTerms) return state;

      // Update offer to accepted with counter terms as the final terms
      const updatedOffer: LoanOffer = {
        ...offer,
        status: 'accepted',
        terms: offer.counterTerms, // Counter terms become the agreed terms
      };

      const updateOffer = (o: LoanOffer): LoanOffer =>
        o.id === offerId ? updatedOffer : o;

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: state.loans.loanOffers.map(updateOffer),
          outgoingLoanOffers: state.loans.outgoingLoanOffers.map(updateOffer),
        },
      };
    }

    case 'COMPLETE_LOAN': {
      const { offerId } = action.payload;
      const offer = state.loans.loanOffers.find(o => o.id === offerId);

      if (!offer || offer.status !== 'accepted') return state;

      const player = state.players[offer.playerId];
      if (!player) return state;

      const currentWeek = state.season.currentWeek;
      const currentSeason = state.season.number;

      const { updatedPlayer, activeLoan } = activateLoan(
        player,
        offer,
        currentWeek,
        currentSeason
      );

      // Track which team is which
      const loanClubId = offer.offeringTeamId; // Team borrowing the player
      const parentClubId = offer.receivingTeamId; // Team that owns the player
      const isUserLoaningIn = loanClubId === 'user';
      const isUserLoaningOut = parentClubId === 'user';

      let newUserTeam = state.userTeam;
      let newTeams = state.league.teams;

      if (isUserLoaningIn) {
        // User is borrowing - deduct loan fee, add to roster
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget - offer.terms.loanFee,
          rosterIds: [...state.userTeam.rosterIds, player.id],
        };
        // AI parent receives loan fee, removes player from roster
        newTeams = newTeams.map((team) => {
          if (team.id === parentClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
              budget: {
                ...team.budget,
                available: team.budget.available + offer.terms.loanFee,
              },
            };
          }
          return team;
        });
      } else if (isUserLoaningOut) {
        // User owns player - receive loan fee, remove from roster
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget + offer.terms.loanFee,
          rosterIds: state.userTeam.rosterIds.filter(id => id !== player.id),
        };
        // AI loan club pays fee, adds player to roster
        newTeams = newTeams.map((team) => {
          if (team.id === loanClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
              budget: {
                ...team.budget,
                available: team.budget.available - offer.terms.loanFee,
              },
            };
          }
          return team;
        });
      } else {
        // AI to AI loan - update both teams
        newTeams = newTeams.map((team) => {
          if (team.id === parentClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
              budget: {
                ...team.budget,
                available: team.budget.available + offer.terms.loanFee,
              },
            };
          }
          if (team.id === loanClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
              budget: {
                ...team.budget,
                available: team.budget.available - offer.terms.loanFee,
              },
            };
          }
          return team;
        });
      }

      // Remove accepted offer from active offers
      const updateOffer = (o: LoanOffer): LoanOffer =>
        o.id === offerId ? { ...o, status: 'accepted' as const } : o;

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        league: {
          ...state.league,
          teams: newTeams,
        },
        loans: {
          ...state.loans,
          loanOffers: state.loans.loanOffers.map(updateOffer),
          incomingLoanOffers: state.loans.incomingLoanOffers.filter(o => o.id !== offerId),
          outgoingLoanOffers: state.loans.outgoingLoanOffers.filter(o => o.id !== offerId),
          activeLoans: [...state.loans.activeLoans, activeLoan],
          allActiveLoans: [...state.loans.allActiveLoans, activeLoan],
        },
      };
    }

    case 'RECALL_LOAN': {
      const { loanId } = action.payload;
      const loan = state.loans.activeLoans.find(l => l.id === loanId);

      if (!loan) return state;

      const player = state.players[loan.playerId];
      if (!player) return state;

      const currentWeek = state.season.currentWeek;
      const result = recallLoan(loan, player, currentWeek);

      if ('error' in result) {
        console.warn('[Recall Loan]', result.error);
        return state;
      }

      const { updatedPlayer, updatedLoan, recallFee } = result;

      const isUserParent = loan.parentClubId === 'user';
      const isUserLoanClub = loan.loanClubId === 'user';

      let newUserTeam = state.userTeam;
      let newTeams = state.league.teams;

      if (isUserParent) {
        // User recalling their player - pay recall fee, add to roster
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget - recallFee,
          rosterIds: [...state.userTeam.rosterIds, player.id],
        };
        // AI loan club receives recall fee, removes player from roster
        newTeams = newTeams.map((team) => {
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
              budget: {
                ...team.budget,
                available: team.budget.available + recallFee,
              },
            };
          }
          return team;
        });
      } else if (isUserLoanClub) {
        // User losing loaned player - receive recall fee, remove from roster
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget + recallFee,
          rosterIds: state.userTeam.rosterIds.filter(id => id !== player.id),
        };
        // AI parent pays recall fee, adds player to roster
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
              budget: {
                ...team.budget,
                available: team.budget.available - recallFee,
              },
            };
          }
          return team;
        });
      } else {
        // AI to AI recall - update both teams
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
              budget: {
                ...team.budget,
                available: team.budget.available - recallFee,
              },
            };
          }
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
              budget: {
                ...team.budget,
                available: team.budget.available + recallFee,
              },
            };
          }
          return team;
        });
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        league: {
          ...state.league,
          teams: newTeams,
        },
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
          allActiveLoans: state.loans.allActiveLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
        },
      };
    }

    case 'EXERCISE_BUY_OPTION': {
      const { loanId } = action.payload;
      const loan = state.loans.activeLoans.find(l => l.id === loanId);

      if (!loan) return state;

      const player = state.players[loan.playerId];
      if (!player) return state;

      const result = exerciseBuyOption(loan, player);

      if ('error' in result) {
        console.warn('[Exercise Buy Option]', result.error);
        return state;
      }

      const { updatedPlayer, updatedLoan, transferFee } = result;

      const isUserLoanClub = loan.loanClubId === 'user';
      const isUserParent = loan.parentClubId === 'user';

      let newUserTeam = state.userTeam;
      let newTeams = state.league.teams;

      // Buy option = permanent transfer from parent to loan club
      // Player already on loan club's roster, just need to handle payment

      if (isUserLoanClub) {
        // User exercising buy option - pay fee (player already on user roster)
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget - transferFee,
        };
        // AI parent receives payment
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              budget: {
                ...team.budget,
                available: team.budget.available + transferFee,
              },
            };
          }
          return team;
        });
      } else if (isUserParent) {
        // User receiving buy option fee (player already off user roster from loan start)
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget + transferFee,
        };
        // AI loan club pays fee
        newTeams = newTeams.map((team) => {
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              budget: {
                ...team.budget,
                available: team.budget.available - transferFee,
              },
            };
          }
          return team;
        });
      } else {
        // AI to AI buy option - update both teams' budgets
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              budget: {
                ...team.budget,
                available: team.budget.available + transferFee,
              },
            };
          }
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              budget: {
                ...team.budget,
                available: team.budget.available - transferFee,
              },
            };
          }
          return team;
        });
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        league: {
          ...state.league,
          teams: newTeams,
        },
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
          allActiveLoans: state.loans.allActiveLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
        },
      };
    }

    case 'END_LOAN': {
      const { loanId, reason } = action.payload;
      const loan = state.loans.activeLoans.find(l => l.id === loanId);

      if (!loan) return state;

      const player = state.players[loan.playerId];
      if (!player) return state;

      const { updatedPlayer, updatedLoan } = completeLoan(loan, player);

      const isUserParent = loan.parentClubId === 'user';
      const isUserLoanClub = loan.loanClubId === 'user';

      let newUserTeam = state.userTeam;
      let newTeams = state.league.teams;

      // Loan ended = player returns to parent club (removed from loan club, added to parent)

      if (isUserParent) {
        // Player returning to user
        newUserTeam = {
          ...state.userTeam,
          rosterIds: [...state.userTeam.rosterIds, player.id],
        };
        // Remove from AI loan club's roster
        newTeams = newTeams.map((team) => {
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
            };
          }
          return team;
        });
      } else if (isUserLoanClub) {
        // Player leaving user
        newUserTeam = {
          ...state.userTeam,
          rosterIds: state.userTeam.rosterIds.filter(id => id !== player.id),
        };
        // Add to AI parent's roster
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
            };
          }
          return team;
        });
      } else {
        // AI to AI loan end - update both teams
        newTeams = newTeams.map((team) => {
          if (team.id === loan.parentClubId) {
            return {
              ...team,
              rosterIds: [...team.rosterIds, player.id],
            };
          }
          if (team.id === loan.loanClubId) {
            return {
              ...team,
              rosterIds: team.rosterIds.filter((id) => id !== player.id),
            };
          }
          return team;
        });
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        league: {
          ...state.league,
          teams: newTeams,
        },
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(l =>
            l.id === loanId ? { ...updatedLoan, status: reason === 'bought' ? 'bought' : 'completed' } as ActiveLoan : l
          ),
          allActiveLoans: state.loans.allActiveLoans.map(l =>
            l.id === loanId ? { ...updatedLoan, status: reason === 'bought' ? 'bought' : 'completed' } as ActiveLoan : l
          ),
        },
      };
    }

    case 'LIST_PLAYER_FOR_LOAN': {
      const { playerId } = action.payload;

      if (state.loans.loanListedPlayerIds.includes(playerId)) {
        return state;
      }

      return {
        ...state,
        loans: {
          ...state.loans,
          loanListedPlayerIds: [...state.loans.loanListedPlayerIds, playerId],
        },
      };
    }

    case 'UNLIST_PLAYER_FOR_LOAN': {
      const { playerId } = action.payload;

      return {
        ...state,
        loans: {
          ...state.loans,
          loanListedPlayerIds: state.loans.loanListedPlayerIds.filter(id => id !== playerId),
        },
      };
    }

    case 'PROCESS_LOAN_EXPIRIES': {
      const { currentWeek } = action.payload;

      // Expire old loan offers
      const expiredOffers = expireOldLoanOffers(state.loans.loanOffers, currentWeek);

      // End loans that have reached their end week
      const loansToEnd = state.loans.activeLoans.filter(
        loan => loan.status === 'active' && currentWeek >= loan.terms.endWeek
      );

      let updatedPlayers = { ...state.players };
      let updatedLoans = state.loans.activeLoans.map(loan => {
        if (loansToEnd.find(l => l.id === loan.id)) {
          const player = updatedPlayers[loan.playerId];
          if (player) {
            const { updatedPlayer, updatedLoan } = completeLoan(loan, player);
            updatedPlayers[loan.playerId] = updatedPlayer;
            return updatedLoan;
          }
        }
        return loan;
      });

      return {
        ...state,
        players: updatedPlayers,
        loans: {
          ...state.loans,
          loanOffers: expiredOffers,
          incomingLoanOffers: expiredOffers.filter(o => o.receivingTeamId === 'user'),
          outgoingLoanOffers: expiredOffers.filter(o => o.offeringTeamId === 'user'),
          activeLoans: updatedLoans,
          allActiveLoans: state.loans.allActiveLoans.map(loan => {
            const updated = updatedLoans.find(l => l.id === loan.id);
            return updated || loan;
          }),
        },
      };
    }

    case 'RECORD_LOAN_APPEARANCE': {
      const { loanId, sport } = action.payload;

      return {
        ...state,
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(loan =>
            loan.id === loanId ? recordLoanAppearance(loan, sport) : loan
          ),
          allActiveLoans: state.loans.allActiveLoans.map(loan =>
            loan.id === loanId ? recordLoanAppearance(loan, sport) : loan
          ),
        },
      };
    }

    case 'AI_MAKE_LOAN_OFFER': {
      const { offeringTeamId, receivingTeamId, playerId, terms } = action.payload;
      const currentWeek = state.season.currentWeek;

      const newOffer = createLoanOffer(
        offeringTeamId,
        receivingTeamId,
        playerId,
        terms,
        currentWeek
      );

      // If offer is to user (user owns the player), add to incoming
      const isToUser = receivingTeamId === 'user';

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: [...state.loans.loanOffers, newOffer],
          incomingLoanOffers: isToUser
            ? [...state.loans.incomingLoanOffers, newOffer]
            : state.loans.incomingLoanOffers,
        },
      };
    }

    case 'AI_RESPOND_TO_LOAN_OFFER': {
      const { offerId, decision, counterTerms } = action.payload;
      const currentWeek = state.season.currentWeek;

      const updateOffer = (o: LoanOffer): LoanOffer => {
        if (o.id !== offerId) return o;

        if (decision === 'accept') {
          return { ...o, status: 'accepted' };
        } else if (decision === 'reject') {
          return { ...o, status: 'rejected' };
        } else if (decision === 'counter' && counterTerms) {
          return {
            ...o,
            status: 'countered',
            counterTerms,
            negotiationHistory: [
              ...o.negotiationHistory,
              { terms: counterTerms, from: o.receivingTeamId, week: currentWeek },
            ],
          };
        }
        return o;
      };

      return {
        ...state,
        loans: {
          ...state.loans,
          loanOffers: state.loans.loanOffers.map(updateOffer),
          outgoingLoanOffers: state.loans.outgoingLoanOffers.map(updateOffer),
        },
      };
    }

    case 'AI_RECALL_LOAN': {
      const { loanId } = action.payload;
      const loan = state.loans.allActiveLoans.find(l => l.id === loanId);

      if (!loan) return state;

      const player = state.players[loan.playerId];
      if (!player) return state;

      const currentWeek = state.season.currentWeek;
      const result = recallLoan(loan, player, currentWeek);

      if ('error' in result) return state;

      const { updatedPlayer, updatedLoan, recallFee } = result;

      // Handle user team if involved
      let newUserTeam = state.userTeam;
      if (loan.loanClubId === 'user') {
        // User losing player, receiving fee
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget + recallFee,
          rosterIds: state.userTeam.rosterIds.filter(id => id !== player.id),
        };
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
          allActiveLoans: state.loans.allActiveLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
        },
      };
    }

    case 'AI_EXERCISE_BUY_OPTION': {
      const { loanId } = action.payload;
      const loan = state.loans.allActiveLoans.find(l => l.id === loanId);

      if (!loan) return state;

      const player = state.players[loan.playerId];
      if (!player) return state;

      const result = exerciseBuyOption(loan, player);

      if ('error' in result) return state;

      const { updatedPlayer, updatedLoan, transferFee } = result;

      // Handle user team if involved
      let newUserTeam = state.userTeam;
      if (loan.parentClubId === 'user') {
        // User receiving buy option fee
        newUserTeam = {
          ...state.userTeam,
          availableBudget: state.userTeam.availableBudget + transferFee,
        };
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: updatedPlayer,
        },
        userTeam: newUserTeam,
        loans: {
          ...state.loans,
          activeLoans: state.loans.activeLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
          allActiveLoans: state.loans.allActiveLoans.map(l =>
            l.id === loanId ? updatedLoan : l
          ),
        },
      };
    }

    case 'AI_LIST_PLAYER_FOR_LOAN': {
      const { playerId } = action.payload;

      if (state.loans.loanListedPlayerIds.includes(playerId)) {
        return state;
      }

      return {
        ...state,
        loans: {
          ...state.loans,
          loanListedPlayerIds: [...state.loans.loanListedPlayerIds, playerId],
        },
      };
    }

    default:
      return state;
  }
}

export default gameReducer;
