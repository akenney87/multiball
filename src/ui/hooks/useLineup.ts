/**
 * useLineup Hook
 *
 * Provides lineup management functionality for the user team.
 * Supports basketball, baseball, and soccer lineup editing.
 */

import { useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { calculatePlayerOverall, calculateSoccerPositionOverall } from '../integration/gameInitializer';
import type { SoccerFormation, BaseballPosition, BullpenRole, BaseballBullpenConfig } from '../context/types';
import { calculateBasketballOverall, calculateBaseballPositionOverall, type BaseballPositionType } from '../../utils/overallRating';
import { applyFitnessDegradation } from '../../systems/matchFitnessSystem';
import type { Player } from '../../data/types';

export interface LineupPlayer {
  id: string;
  name: string;
  position: string;
  overall: number;
  isStarter: boolean;
  isInjured: boolean;
  targetMinutes: number;
  /** Height in inches */
  height: number;
  /** Weight in pounds */
  weight: number;
  /** Match fitness (0-100) - persistent stamina between matches */
  matchFitness: number;
  /** Soccer-specific: slot index in formation (0-10) */
  slotIndex?: number;
  /** Baseball-specific: batting order position (1-9, undefined if not in order) */
  battingOrderPosition?: number;
  /** Baseball-specific: defensive position assignment */
  baseballPosition?: BaseballPosition;
  /** Baseball-specific: whether this player is the starting pitcher */
  isPitcher?: boolean;
  /** Baseball-specific: bullpen role (if in bullpen) */
  bullpenRole?: BullpenRole;
}

export type SportType = 'basketball' | 'soccer' | 'baseball';

// Soccer formations with position slots (exported for use in other components)
// Uses L/R designations to differentiate duplicate positions
export const FORMATION_POSITIONS: Record<SoccerFormation, string[]> = {
  '4-4-2': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LM', 'LCM', 'RCM', 'RM', 'LST', 'RST'],
  '4-3-3': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CDM', 'RCM', 'LW', 'ST', 'RW'],
  '3-5-2': ['GK', 'LCB', 'CB', 'RCB', 'LM', 'LCM', 'CDM', 'RCM', 'RM', 'LST', 'RST'],
  '4-2-3-1': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCDM', 'RCDM', 'LW', 'CAM', 'RW', 'ST'],
  '5-3-2': ['GK', 'LWB', 'LCB', 'CB', 'RCB', 'RWB', 'LCM', 'CM', 'RCM', 'LST', 'RST'],
  '4-1-4-1': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'CDM', 'LM', 'LCM', 'RCM', 'RM', 'ST'],
};

export interface UseLineupOptions {
  /**
   * When true, edits go to gamedayLineup instead of the default lineup.
   * Use this for pre-match lineup editing where changes shouldn't persist.
   */
  isGameday?: boolean;
}

export function useLineup(sport: SportType = 'basketball', options: UseLineupOptions = {}) {
  const { state, setLineup, setGamedayLineup, getUserRoster } = useGame();
  const { isGameday = false } = options;

  // Determine which lineup to use based on gameday mode
  // If gameday mode and gamedayLineup exists, use it; otherwise use default lineup
  const activeLineup = isGameday && state.userTeam.gamedayLineup
    ? state.userTeam.gamedayLineup
    : state.userTeam.lineup;

  // Use the appropriate setter based on mode
  // Memoized to ensure stable reference for callback dependencies
  const activeSetLineup = useMemo(
    () => isGameday ? setGamedayLineup : setLineup,
    [isGameday, setGamedayLineup, setLineup]
  );

  // =========================================================================
  // BASKETBALL
  // =========================================================================

  const basketballPlayers = useMemo((): LineupPlayer[] => {
    const roster = getUserRoster();
    const starters = new Set(activeLineup.basketballStarters);
    const minutesAllocation = activeLineup.minutesAllocation;

    return roster.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      overall: calculateBasketballOverall(player.attributes),
      isStarter: starters.has(player.id),
      isInjured: player.injury !== null,
      // Use allocated minutes, or default: starters get 32, bench gets 0 (until optimal is applied)
      targetMinutes: minutesAllocation[player.id] ?? (starters.has(player.id) ? 32 : 0),
      height: player.height,
      weight: player.weight,
      matchFitness: player.matchFitness ?? 100,
    }));
  }, [getUserRoster, activeLineup.basketballStarters, activeLineup.minutesAllocation]);

  const basketballStarters = useMemo((): (LineupPlayer | undefined)[] => {
    // Return starters in positional order (PG, SG, SF, PF, C)
    // Each index corresponds to a position slot (0=PG, 1=SG, 2=SF, 3=PF, 4=C)
    // Returns array of length 5, with undefined for empty slots
    const starterIds = activeLineup.basketballStarters;
    return starterIds.map((id) => {
      if (!id) return undefined;
      return basketballPlayers.find((p) => p.id === id);
    });
  }, [basketballPlayers, activeLineup.basketballStarters]);

  const basketballBench = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    return basketballPlayers
      .filter((p) => !p.isStarter && benchSet.has(p.id))
      .slice(0, 9); // Ensure max 9
  }, [basketballPlayers, activeLineup.bench]);

  const basketballReserves = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    // Exclude injured players from reserves - they go to injured section
    return basketballPlayers.filter((p) => !p.isStarter && !benchSet.has(p.id) && !p.isInjured);
  }, [basketballPlayers, activeLineup.bench]);

  const basketballInjured = useMemo(() => {
    return basketballPlayers.filter((p) => p.isInjured);
  }, [basketballPlayers]);

  const setBasketballStarter = useCallback(
    (playerId: string, position: number) => {
      // Block injured players from being added to lineup
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const newStarters = [...currentLineup.basketballStarters];
      const newBench = [...currentLineup.bench];

      const benchIndex = newBench.indexOf(playerId);
      if (benchIndex !== -1) {
        newBench.splice(benchIndex, 1);
      }

      const existingStarter = newStarters[position];
      if (existingStarter && existingStarter !== playerId) {
        newBench.push(existingStarter);
      }

      const currentStarterIndex = newStarters.indexOf(playerId);
      if (currentStarterIndex !== -1 && currentStarterIndex !== position) {
        newStarters[currentStarterIndex] = '';
      }

      newStarters[position] = playerId;

      activeSetLineup({
        ...currentLineup,
        basketballStarters: newStarters as [string, string, string, string, string],
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  const moveBasketballToBench = useCallback(
    (playerId: string) => {
      const currentLineup = activeLineup;
      const newStarters = [...currentLineup.basketballStarters];
      const newBench = [...currentLineup.bench];

      const starterIndex = newStarters.indexOf(playerId);
      if (starterIndex !== -1) {
        newStarters[starterIndex] = '';
      }

      if (!newBench.includes(playerId)) {
        newBench.push(playerId);
      }

      activeSetLineup({
        ...currentLineup,
        basketballStarters: newStarters as [string, string, string, string, string],
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  // Add a player to the bench (from reserves) - respects 9 player limit
  const addPlayerToBench = useCallback(
    (playerId: string) => {
      // Block injured players from being added to bench
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const newBench = [...currentLineup.bench];

      // Check if already on bench or if bench is full
      if (newBench.includes(playerId)) return;
      if (newBench.length >= 9) return; // Bench is full

      newBench.push(playerId);

      activeSetLineup({
        ...currentLineup,
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  // Remove a player from the bench (to reserves)
  const removePlayerFromBench = useCallback(
    (playerId: string) => {
      const currentLineup = activeLineup;
      const newBench = currentLineup.bench.filter((id) => id !== playerId);

      activeSetLineup({
        ...currentLineup,
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  // Swap a bench player with a reserve player atomically
  const swapBenchWithReserve = useCallback(
    (benchPlayerId: string, reservePlayerId: string) => {
      const currentLineup = activeLineup;
      const benchIndex = currentLineup.bench.indexOf(benchPlayerId);

      // Bench player must be on bench
      if (benchIndex === -1) return;

      // Reserve player must NOT be on bench (they're a reserve)
      if (currentLineup.bench.includes(reservePlayerId)) return;

      // Create new bench with the swap
      const newBench = [...currentLineup.bench];
      newBench[benchIndex] = reservePlayerId;

      activeSetLineup({
        ...currentLineup,
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  const swapBasketballPlayers = useCallback(
    (player1Id: string, player2Id: string) => {
      const currentLineup = activeLineup;
      const newStarters = [...currentLineup.basketballStarters];
      const newBench = [...currentLineup.bench];

      const starter1Index = newStarters.indexOf(player1Id);
      const starter2Index = newStarters.indexOf(player2Id);
      const bench1Index = newBench.indexOf(player1Id);
      const bench2Index = newBench.indexOf(player2Id);

      if (starter1Index !== -1 && starter2Index !== -1) {
        newStarters[starter1Index] = player2Id;
        newStarters[starter2Index] = player1Id;
      } else if (starter1Index !== -1 && bench2Index !== -1) {
        newStarters[starter1Index] = player2Id;
        newBench[bench2Index] = player1Id;
      } else if (starter2Index !== -1 && bench1Index !== -1) {
        newStarters[starter2Index] = player1Id;
        newBench[bench1Index] = player2Id;
      }

      activeSetLineup({
        ...currentLineup,
        basketballStarters: newStarters as [string, string, string, string, string],
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Swap two starters' positions by their slot indices.
   * This allows swapping e.g. the PG and SG positions directly.
   */
  const swapBasketballStarterPositions = useCallback(
    (slotIndexA: number, slotIndexB: number) => {
      const currentLineup = activeLineup;
      const newStarters = [...currentLineup.basketballStarters];

      // Swap the player IDs at the two position slots
      const playerA = newStarters[slotIndexA] ?? '';
      const playerB = newStarters[slotIndexB] ?? '';
      newStarters[slotIndexA] = playerB;
      newStarters[slotIndexB] = playerA;

      activeSetLineup({
        ...currentLineup,
        basketballStarters: newStarters as [string, string, string, string, string],
      });
    },
    [activeLineup, activeSetLineup]
  );

  const isValidBasketballLineup = useMemo(() => {
    const validStarters = activeLineup.basketballStarters.filter((id) => id !== '');
    return validStarters.length === 5;
  }, [activeLineup.basketballStarters]);

  /**
   * Set the full basketball lineup at once (all 5 starters) with proper minutes allocation.
   * - Starters get minutes based on their overall (28-36 range)
   * - Top 3 bench players get minutes (8-16 range based on overall)
   * - Total should equal exactly 240 minutes
   */
  const setFullBasketballLineup = useCallback(
    (starterIds: [string, string, string, string, string]) => {
      const currentLineup = activeLineup;
      const roster = getUserRoster();

      // Build new starters array
      const newStarters = starterIds;
      const starterSet = new Set(starterIds.filter((id) => id !== ''));

      // Build new bench - top 9 non-starters by condition-adjusted rating
      const benchPlayers = roster
        .filter((p) => !starterSet.has(p.id))
        .map((p) => {
          const overall = calculatePlayerOverall(p);
          const stamina = p.matchFitness ?? 100;
          const staminaFactor = 0.6 + 0.4 * (stamina / 100);
          return { id: p.id, overall, effectiveRating: overall * staminaFactor };
        })
        .sort((a, b) => b.effectiveRating - a.effectiveRating);

      // Limit bench to 9 players (rest are reserves)
      const newBench = benchPlayers.slice(0, 9).map((p) => p.id);

      // Calculate minutes allocation for exactly 240 total
      const newMinutesAllocation: Record<string, number> = {};

      // Get starter overalls for proportional allocation
      const starterOveralls = starterIds
        .filter((id) => id !== '')
        .map((id) => {
          const player = roster.find((p) => p.id === id);
          return { id, overall: player ? calculatePlayerOverall(player) : 50 };
        })
        .sort((a, b) => b.overall - a.overall);

      // Starters get 28-36 minutes based on rank (best starter gets most)
      // Total starter minutes: ~160 (leaving ~80 for bench)
      const starterMinutesTemplate = [36, 34, 32, 30, 28]; // 160 total
      starterOveralls.forEach((starter, idx) => {
        newMinutesAllocation[starter.id] = starterMinutesTemplate[idx] ?? 32;
      });

      // Top 3 bench players get minutes to reach 240 total
      // Total bench minutes: 80 (240 - 160 starter minutes)
      const benchMinutesAdjusted = [28, 28, 24]; // 80 total for top 3 bench
      const topBenchCount = Math.min(3, benchPlayers.length);

      for (let i = 0; i < benchPlayers.length; i++) {
        const benchPlayer = benchPlayers[i];
        if (benchPlayer) {
          if (i < topBenchCount) {
            newMinutesAllocation[benchPlayer.id] = benchMinutesAdjusted[i] ?? 0;
          } else {
            newMinutesAllocation[benchPlayer.id] = 0; // Other bench players get 0
          }
        }
      }

      activeSetLineup({
        ...currentLineup,
        basketballStarters: newStarters,
        bench: newBench,
        minutesAllocation: newMinutesAllocation,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  /**
   * Calculate optimal basketball lineup and apply it.
   * Uses the same fitness degradation formula as match simulations to calculate effective ratings.
   */
  const applyOptimalBasketballLineup = useCallback(() => {
    const roster = getUserRoster();

    // Calculate effective overall for each player using the simulation formula
    // applyFitnessDegradation reduces physical attributes based on matchFitness
    const availablePlayers = roster
      .filter((p) => p.injury === null)
      .map((p) => {
        // Apply fitness degradation to get effective attributes (same as in-match)
        const degradedPlayer = applyFitnessDegradation(p);
        return {
          id: p.id,
          effectiveOverall: calculatePlayerOverall(degradedPlayer),
          rawOverall: calculatePlayerOverall(p),
          height: p.height ?? 72,
        };
      })
      .sort((a, b) => b.effectiveOverall - a.effectiveOverall);

    // Select top 5 by effective overall
    const top5 = availablePlayers.slice(0, 5);

    // Sort selected 5 by height (shortest to tallest) for position assignment
    // PG (slot 0) = shortest, SG (slot 1) = 2nd shortest, ..., C (slot 4) = tallest
    const top5ByHeight = [...top5].sort((a, b) => a.height - b.height);

    // Build the 5-tuple of starter IDs arranged by height
    const starterIds: [string, string, string, string, string] = ['', '', '', '', ''];
    for (let i = 0; i < 5 && i < top5ByHeight.length; i++) {
      const player = top5ByHeight[i];
      if (player) {
        starterIds[i] = player.id;
      }
    }

    // Use setFullBasketballLineup which handles minutes allocation
    setFullBasketballLineup(starterIds);
  }, [getUserRoster, setFullBasketballLineup]);

  const basketballTotalMinutes = useMemo(() => {
    return basketballPlayers.reduce((sum, p) => sum + p.targetMinutes, 0);
  }, [basketballPlayers]);

  /**
   * Get the maximum minutes allowed for a specific player given the current total allocation.
   * This is used by the slider to prevent the user from exceeding the total limit.
   */
  const getBasketballMaxAllowedMinutes = useCallback(
    (playerId: string): number => {
      const playerData = basketballPlayers.find(p => p.id === playerId);
      const currentPlayerMinutes = playerData?.targetMinutes ?? 0;
      const otherPlayersMinutes = basketballTotalMinutes - currentPlayerMinutes;
      // Max 48 per player, but also can't exceed 240 total
      return Math.max(0, Math.min(48, 240 - otherPlayersMinutes));
    },
    [basketballPlayers, basketballTotalMinutes]
  );

  const setBasketballTargetMinutes = useCallback(
    (playerId: string, minutes: number) => {
      const currentLineup = activeLineup;

      // Get the player's current minutes from the basketballPlayers array (which accounts for defaults)
      const playerData = basketballPlayers.find(p => p.id === playerId);
      const currentPlayerMinutes = playerData?.targetMinutes ?? 0;
      const otherPlayersMinutes = basketballTotalMinutes - currentPlayerMinutes;

      // Cap at 240 total, also max 48 per player, min 0
      const maxAllowedForPlayer = Math.min(48, 240 - otherPlayersMinutes);
      const clampedMinutes = Math.max(0, Math.min(maxAllowedForPlayer, minutes));

      activeSetLineup({
        ...currentLineup,
        minutesAllocation: {
          ...currentLineup.minutesAllocation,
          [playerId]: clampedMinutes,
        },
      });
    },
    [activeLineup, activeSetLineup, basketballTotalMinutes, basketballPlayers]
  );

  // =========================================================================
  // SOCCER
  // =========================================================================

  const soccerPlayers = useMemo((): LineupPlayer[] => {
    const roster = getUserRoster();
    const soccerLineup = activeLineup.soccerLineup;
    const starterSet = new Set(soccerLineup.starters);
    // Fallback to empty object for saves that haven't been migrated yet
    const soccerMinutesAllocation = activeLineup.soccerMinutesAllocation ?? {};

    return roster.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      overall: calculatePlayerOverall(player),
      isStarter: starterSet.has(player.id),
      isInjured: player.injury !== null,
      targetMinutes: soccerMinutesAllocation[player.id] ?? (starterSet.has(player.id) ? 90 : 0),
      height: player.height,
      weight: player.weight,
      matchFitness: player.matchFitness ?? 100,
      slotIndex: soccerLineup.positions[player.id],
    }));
  }, [getUserRoster, activeLineup.soccerLineup, activeLineup.soccerMinutesAllocation]);

  const soccerStarters = useMemo(() => {
    return soccerPlayers.filter((p) => p.isStarter);
  }, [soccerPlayers]);

  const soccerBench = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    return soccerPlayers
      .filter((p) => !p.isStarter && benchSet.has(p.id))
      .slice(0, 9); // Ensure max 9
  }, [soccerPlayers, activeLineup.bench]);

  const soccerReserves = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    // Exclude injured players from reserves - they go to injured section
    return soccerPlayers.filter((p) => !p.isStarter && !benchSet.has(p.id) && !p.isInjured);
  }, [soccerPlayers, activeLineup.bench]);

  const soccerInjured = useMemo(() => {
    return soccerPlayers.filter((p) => p.isInjured);
  }, [soccerPlayers]);

  const currentFormation = activeLineup.soccerLineup.formation;
  const formationPositions = FORMATION_POSITIONS[currentFormation] || FORMATION_POSITIONS['4-4-2'];

  const setSoccerStarter = useCallback(
    (playerId: string, slotIndex: number) => {
      // Block injured players from being added to lineup
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const soccerLineup = { ...currentLineup.soccerLineup };
      const newStarters = [...soccerLineup.starters];
      const newPositions: Record<string, number> = { ...soccerLineup.positions };
      const newBench = [...currentLineup.bench];

      // Validate slot index
      if (slotIndex < 0 || slotIndex > 10) {
        return;
      }

      // Remove player from bench if present
      const benchIndex = newBench.indexOf(playerId);
      if (benchIndex !== -1) {
        newBench.splice(benchIndex, 1);
      }

      // Find and remove any player currently in this slot
      for (const [existingId, existingSlot] of Object.entries(newPositions)) {
        if (existingSlot === slotIndex && existingId !== playerId) {
          // Remove from starters
          const idx = newStarters.indexOf(existingId);
          if (idx !== -1) {
            newStarters.splice(idx, 1);
          }
          // Add to bench
          if (!newBench.includes(existingId)) {
            newBench.push(existingId);
          }
          // Remove slot assignment
          delete newPositions[existingId];
          break; // Only one player can be in a slot
        }
      }

      // Remove player from their old slot if they had one
      if (newPositions[playerId] !== undefined) {
        delete newPositions[playerId];
      }

      // Remove from starters if already there (to re-add)
      const existingStarterIdx = newStarters.indexOf(playerId);
      if (existingStarterIdx !== -1) {
        newStarters.splice(existingStarterIdx, 1);
      }

      // Add player to starters and assign slot
      newStarters.push(playerId);
      newPositions[playerId] = slotIndex;

      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          ...soccerLineup,
          starters: newStarters,
          positions: newPositions,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  const moveSoccerToBench = useCallback(
    (playerId: string) => {
      const currentLineup = activeLineup;
      const soccerLineup = { ...currentLineup.soccerLineup };
      const newStarters = soccerLineup.starters.filter((id) => id !== playerId);
      const newPositions = { ...soccerLineup.positions };
      delete newPositions[playerId];

      const newBench = [...currentLineup.bench];
      if (!newBench.includes(playerId)) {
        newBench.push(playerId);
      }

      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          ...soccerLineup,
          starters: newStarters,
          positions: newPositions,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  const setSoccerFormation = useCallback(
    (formation: SoccerFormation) => {
      const currentLineup = activeLineup;
      const soccerLineup = currentLineup.soccerLineup;

      // Clear all position assignments when changing formation
      // User must rebuild lineup for the new formation
      // Move all current starters to bench
      const newBench = [
        ...currentLineup.bench,
        ...soccerLineup.starters.filter((id) => !currentLineup.bench.includes(id)),
      ];

      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          starters: [],
          formation,
          positions: {},
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Set the full soccer lineup at once (starters and positions)
   * This avoids state batching issues when setting multiple starters
   */
  const setFullSoccerLineup = useCallback(
    (starterAssignments: Array<{ playerId: string; slotIndex: number }>) => {
      const currentLineup = activeLineup;
      const roster = getUserRoster();

      // Build new starters and positions from assignments
      const newStarters: string[] = [];
      const newPositions: Record<string, number> = {};

      for (const { playerId, slotIndex } of starterAssignments) {
        if (slotIndex >= 0 && slotIndex <= 10) {
          newStarters.push(playerId);
          newPositions[playerId] = slotIndex;
        }
      }

      // Build new bench - everyone not in starters
      const starterSet = new Set(newStarters);
      const newBench = roster
        .filter(p => !starterSet.has(p.id))
        .map(p => p.id);

      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          ...currentLineup.soccerLineup,
          starters: newStarters,
          positions: newPositions,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  /**
   * Swap two starters' positions in a single state update
   * This avoids state batching issues when swapping
   */
  const swapSoccerStarters = useCallback(
    (slotIndexA: number, slotIndexB: number) => {
      const currentLineup = activeLineup;
      const soccerLineup = currentLineup.soccerLineup;
      const newPositions: Record<string, number> = { ...soccerLineup.positions };

      // Find players at each slot
      let playerAtA: string | null = null;
      let playerAtB: string | null = null;

      for (const [playerId, slot] of Object.entries(newPositions)) {
        if (slot === slotIndexA) playerAtA = playerId;
        if (slot === slotIndexB) playerAtB = playerId;
      }

      // Swap their positions
      if (playerAtA) newPositions[playerAtA] = slotIndexB;
      if (playerAtB) newPositions[playerAtB] = slotIndexA;

      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          ...soccerLineup,
          positions: newPositions,
        },
      });
    },
    [activeLineup, activeSetLineup]
  );

  const isValidSoccerLineup = useMemo(() => {
    const { starters, positions } = activeLineup.soccerLineup;

    // Need exactly 11 starters
    if (starters.length !== 11) return false;

    // All starters must have slot assignments
    const assignedSlots = Object.values(positions);
    if (assignedSlots.length !== 11) return false;

    // Must have GK slot (index 0) filled
    if (!assignedSlots.includes(0)) return false;

    // All slots 0-10 must be filled exactly once (no duplicates)
    const slotSet = new Set(assignedSlots);
    if (slotSet.size !== 11) return false;

    // All slots must be in valid range 0-10
    for (const slot of assignedSlots) {
      if (slot < 0 || slot > 10) return false;
    }

    return true;
  }, [activeLineup.soccerLineup]);

  const soccerTotalMinutes = useMemo(() => {
    return soccerPlayers.reduce((sum, p) => sum + p.targetMinutes, 0);
  }, [soccerPlayers]);

  /**
   * Get the maximum minutes allowed for a specific player given the current total allocation.
   * This is used by the slider to prevent the user from exceeding the total limit.
   */
  const getSoccerMaxAllowedMinutes = useCallback(
    (playerId: string): number => {
      const playerData = soccerPlayers.find(p => p.id === playerId);
      const currentPlayerMinutes = playerData?.targetMinutes ?? 0;
      const otherPlayersMinutes = soccerTotalMinutes - currentPlayerMinutes;
      // Max 90 per player, but also can't exceed 990 total
      return Math.max(0, Math.min(90, 990 - otherPlayersMinutes));
    },
    [soccerPlayers, soccerTotalMinutes]
  );

  const setSoccerTargetMinutes = useCallback(
    (playerId: string, minutes: number) => {
      const currentLineup = activeLineup;

      // Get the player's current minutes from the soccerPlayers array (which accounts for defaults)
      const playerData = soccerPlayers.find(p => p.id === playerId);
      const currentPlayerMinutes = playerData?.targetMinutes ?? 0;
      const otherPlayersMinutes = soccerTotalMinutes - currentPlayerMinutes;

      // Cap at 990 total, also max 90 per player, min 0
      const maxAllowedForPlayer = Math.min(90, 990 - otherPlayersMinutes);
      const clampedMinutes = Math.max(0, Math.min(maxAllowedForPlayer, minutes));

      activeSetLineup({
        ...currentLineup,
        soccerMinutesAllocation: {
          ...(currentLineup.soccerMinutesAllocation ?? {}),
          [playerId]: clampedMinutes,
        },
      });
    },
    [activeLineup, activeSetLineup, soccerTotalMinutes, soccerPlayers]
  );

  /**
   * Calculate the optimal lineup and average overall for a given formation.
   * Returns the best player assignments and the average overall rating.
   * Uses the same fitness degradation formula as match simulations to calculate effective ratings.
   */
  const calculateOptimalLineupForFormation = useCallback(
    (targetFormation: SoccerFormation): {
      assignments: Array<{ playerId: string; slotIndex: number }>;
      averageOverall: number;
      totalOverall: number;
    } => {
      const roster = getUserRoster();
      const positions = FORMATION_POSITIONS[targetFormation];
      const assignments: Array<{ playerId: string; slotIndex: number }> = [];
      const assignedPlayerIds = new Set<string>();
      let totalEffectiveOverall = 0;

      // For each slot (0-10), find the best unassigned player by effective rating
      for (let slotIndex = 0; slotIndex < 11; slotIndex++) {
        const positionName = positions[slotIndex];

        // Get available players for this position
        const available = roster.filter(
          (p) => !assignedPlayerIds.has(p.id) && p.injury === null
        );

        let bestPlayer: Player | null = null;
        let bestEffectiveOverall = -1;

        // Find player with highest effective position rating (after fitness degradation)
        for (const player of available) {
          // Apply fitness degradation to get effective attributes (same as in-match)
          const degradedPlayer = applyFitnessDegradation(player);
          const effectiveOverall = calculateSoccerPositionOverall(degradedPlayer, positionName || 'CM');

          if (effectiveOverall > bestEffectiveOverall) {
            bestEffectiveOverall = effectiveOverall;
            bestPlayer = player;
          }
        }

        if (bestPlayer) {
          assignedPlayerIds.add(bestPlayer.id);
          assignments.push({ playerId: bestPlayer.id, slotIndex });
          totalEffectiveOverall += bestEffectiveOverall;
        }
      }

      const averageOverall = assignments.length > 0 ? Math.round(totalEffectiveOverall / assignments.length) : 0;
      return { assignments, averageOverall, totalOverall: totalEffectiveOverall };
    },
    [getUserRoster]
  );

  /**
   * Get the average overall for each formation to help user choose.
   */
  const getFormationRatings = useCallback((): Record<SoccerFormation, number> => {
    const formations = Object.keys(FORMATION_POSITIONS) as SoccerFormation[];
    const ratings: Partial<Record<SoccerFormation, number>> = {};

    for (const formation of formations) {
      const { averageOverall } = calculateOptimalLineupForFormation(formation);
      ratings[formation] = averageOverall;
    }

    return ratings as Record<SoccerFormation, number>;
  }, [calculateOptimalLineupForFormation]);

  /**
   * Get the current lineup's average overall (for the current formation).
   */
  const getCurrentLineupAverageOverall = useMemo((): number => {
    if (soccerStarters.length === 0) return 0;

    let total = 0;
    for (const starter of soccerStarters) {
      if (starter.slotIndex !== undefined) {
        const positionName = formationPositions[starter.slotIndex];
        const player = state.players[starter.id];
        if (player && positionName) {
          total += calculateSoccerPositionOverall(player, positionName);
        }
      }
    }

    return soccerStarters.length > 0 ? Math.round(total / soccerStarters.length) : 0;
  }, [soccerStarters, formationPositions, state.players]);

  /**
   * Apply the optimal lineup for the specified formation (or current if not specified).
   * Updates both formation AND lineup in a single state update to avoid batching issues.
   * Also allocates minutes: starters get 90, top 3 bench get ~25 each.
   */
  const applyOptimalSoccerLineup = useCallback(
    (targetFormation?: SoccerFormation) => {
      const formation = targetFormation || currentFormation;
      const { assignments } = calculateOptimalLineupForFormation(formation);

      if (assignments.length === 0) return;

      const currentLineup = activeLineup;
      const roster = getUserRoster();

      // Build new starters and positions from assignments
      const newStarters: string[] = [];
      const newPositions: Record<string, number> = {};

      for (const { playerId, slotIndex } of assignments) {
        if (slotIndex >= 0 && slotIndex <= 10) {
          newStarters.push(playerId);
          newPositions[playerId] = slotIndex;
        }
      }

      // Build new bench - top 9 non-starters by condition-adjusted rating
      const starterSet = new Set(newStarters);
      const benchPlayers = roster
        .filter(p => !starterSet.has(p.id))
        .map(p => {
          const overall = calculatePlayerOverall(p);
          const stamina = p.matchFitness ?? 100;
          const staminaFactor = 0.6 + 0.4 * (stamina / 100);
          return { id: p.id, overall, effectiveRating: overall * staminaFactor };
        })
        .sort((a, b) => b.effectiveRating - a.effectiveRating);
      // Limit bench to 9 players (rest are reserves)
      const newBench = benchPlayers.slice(0, 9).map(p => p.id);

      // Allocate minutes: starters get 90 each, bench gets 0
      // Total = 11 * 90 = 990
      const newMinutesAllocation: Record<string, number> = {};

      // All starters get 90 minutes
      for (const starterId of newStarters) {
        newMinutesAllocation[starterId] = 90;
      }

      // All bench players get 0 minutes
      for (const benchPlayer of benchPlayers) {
        newMinutesAllocation[benchPlayer.id] = 0;
      }

      // Single state update with formation, lineup, AND minutes
      activeSetLineup({
        ...currentLineup,
        soccerLineup: {
          ...currentLineup.soccerLineup,
          formation, // Update formation here
          starters: newStarters,
          positions: newPositions,
        },
        bench: newBench,
        soccerMinutesAllocation: newMinutesAllocation,
      });
    },
    [activeLineup, currentFormation, calculateOptimalLineupForFormation, activeSetLineup, getUserRoster]
  );

  // =========================================================================
  // BASEBALL
  // =========================================================================

  const baseballPlayers = useMemo((): LineupPlayer[] => {
    const roster = getUserRoster();
    const baseballLineup = activeLineup.baseballLineup;
    const battingOrderSet = new Set(baseballLineup.battingOrder);
    const pitcherId = baseballLineup.startingPitcher;
    const bullpen = baseballLineup.bullpen;

    // Build a map of player ID to bullpen role
    const bullpenRoleMap: Record<string, BullpenRole> = {};
    if (bullpen) {
      if (bullpen.closer) bullpenRoleMap[bullpen.closer] = 'closer';
      bullpen.longRelievers?.forEach((id) => {
        if (id) bullpenRoleMap[id] = 'longReliever';
      });
      bullpen.shortRelievers?.forEach((id) => {
        if (id) bullpenRoleMap[id] = 'shortReliever';
      });
    }

    return roster.map((player) => {
      const battingIndex = baseballLineup.battingOrder.indexOf(player.id);
      const isPitcher = player.id === pitcherId;
      const isInLineup = battingOrderSet.has(player.id) || isPitcher;
      const assignedPosition = baseballLineup.positions[player.id];
      const bullpenRole = bullpenRoleMap[player.id];

      return {
        id: player.id,
        name: player.name,
        position: player.position,
        overall: calculatePlayerOverall(player),
        isStarter: isInLineup,
        isInjured: player.injury !== null,
        targetMinutes: 0, // Not applicable for baseball
        height: player.height,
        weight: player.weight,
        matchFitness: player.matchFitness ?? 100,
        battingOrderPosition: battingIndex >= 0 ? battingIndex + 1 : undefined,
        baseballPosition: assignedPosition,
        isPitcher,
        bullpenRole,
      };
    });
  }, [getUserRoster, activeLineup.baseballLineup]);

  const baseballBattingOrder = useMemo(() => {
    return baseballPlayers
      .filter((p) => p.battingOrderPosition !== undefined)
      .sort((a, b) => (a.battingOrderPosition || 0) - (b.battingOrderPosition || 0));
  }, [baseballPlayers]);

  const baseballStartingPitcher = useMemo(() => {
    return baseballPlayers.find((p) => p.isPitcher);
  }, [baseballPlayers]);

  const baseballBullpen = useMemo(() => {
    const bullpen = activeLineup.baseballLineup.bullpen;
    if (!bullpen) return { longRelievers: [], shortRelievers: [], closer: null };

    const getPlayer = (id: string) => baseballPlayers.find((p) => p.id === id) ?? null;

    return {
      longRelievers: bullpen.longRelievers.map(getPlayer),
      shortRelievers: bullpen.shortRelievers.map(getPlayer),
      closer: getPlayer(bullpen.closer),
    };
  }, [baseballPlayers, activeLineup.baseballLineup.bullpen]);

  const baseballBench = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    return baseballPlayers
      .filter((p) => !p.isStarter && !p.isPitcher && !p.bullpenRole && benchSet.has(p.id))
      .slice(0, 9); // Ensure max 9
  }, [baseballPlayers, activeLineup.bench]);

  const baseballReserves = useMemo(() => {
    const benchSet = new Set(activeLineup.bench);
    // Exclude injured players from reserves - they go to injured section
    return baseballPlayers.filter(
      (p) => !p.isStarter && !p.isPitcher && !p.bullpenRole && !benchSet.has(p.id) && !p.isInjured
    );
  }, [baseballPlayers, activeLineup.bench]);

  const baseballInjured = useMemo(() => {
    return baseballPlayers.filter((p) => p.isInjured);
  }, [baseballPlayers]);

  const setBaseballBattingOrder = useCallback(
    (newBattingOrder: string[]) => {
      const currentLineup = activeLineup;
      const baseballLineup = { ...currentLineup.baseballLineup };

      // Update batting order (should be exactly 9 players)
      baseballLineup.battingOrder = newBattingOrder.slice(0, 9);

      // Update bench - remove anyone now in batting order
      const newInLineup = new Set([
        ...newBattingOrder,
        baseballLineup.startingPitcher,
      ]);
      const newBench = currentLineup.bench.filter((id) => !newInLineup.has(id));

      // Add players removed from batting order to bench
      const oldBattingSet = new Set(currentLineup.baseballLineup.battingOrder);
      for (const oldId of oldBattingSet) {
        if (!newBattingOrder.includes(oldId) && !newBench.includes(oldId)) {
          newBench.push(oldId);
        }
      }

      activeSetLineup({
        ...currentLineup,
        baseballLineup,
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  const setBaseballStartingPitcher = useCallback(
    (playerId: string) => {
      // Block injured players from being added to lineup
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const newBench = [...currentLineup.bench];
      const newBattingOrder = [...currentLineup.baseballLineup.battingOrder];
      const newPositions = { ...currentLineup.baseballLineup.positions };

      // If there's an existing pitcher, move them to bench
      const oldPitcherId = currentLineup.baseballLineup.startingPitcher;
      if (oldPitcherId && oldPitcherId !== playerId) {
        // Add old pitcher to bench if they're not already there and not in batting order
        if (!newBench.includes(oldPitcherId) && !newBattingOrder.includes(oldPitcherId)) {
          newBench.push(oldPitcherId);
        }
        // Remove old pitcher's position assignment
        delete newPositions[oldPitcherId];
      }

      // Remove new pitcher from bench if present
      const benchIndex = newBench.indexOf(playerId);
      if (benchIndex !== -1) {
        newBench.splice(benchIndex, 1);
      }

      // Remove from batting order if present (pitchers don't bat in DH league)
      const battingIndex = newBattingOrder.indexOf(playerId);
      if (battingIndex !== -1) {
        newBattingOrder[battingIndex] = ''; // Clear the slot instead of splicing
      }

      // Set new pitcher
      newPositions[playerId] = 'P';

      activeSetLineup({
        ...currentLineup,
        bench: newBench,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          startingPitcher: playerId,
          battingOrder: newBattingOrder,
          positions: newPositions,
        },
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  const setBaseballPosition = useCallback(
    (playerId: string, position: BaseballPosition) => {
      const currentLineup = activeLineup;
      const baseballLineup = { ...currentLineup.baseballLineup };
      const newPositions = { ...baseballLineup.positions };

      // If setting to pitcher, use setBaseballStartingPitcher instead
      if (position === 'P') {
        setBaseballStartingPitcher(playerId);
        return;
      }

      // Get the current player's old position (for swapping)
      const oldPosition = newPositions[playerId];

      // Swap positions if target is occupied (except DH which can have multiple)
      if (position !== 'DH') {
        for (const [existingId, existingPos] of Object.entries(newPositions)) {
          if (existingPos === position && existingId !== playerId) {
            // Swap: give the displaced player the old position
            if (oldPosition && oldPosition !== 'P') {
              newPositions[existingId] = oldPosition;
            } else {
              // If no old position, assign DH as fallback
              newPositions[existingId] = 'DH';
            }
            break;
          }
        }
      }

      newPositions[playerId] = position;

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...baseballLineup,
          positions: newPositions,
        },
      });
    },
    [activeLineup, activeSetLineup, setBaseballStartingPitcher]
  );

  const addToBattingOrder = useCallback(
    (playerId: string, slotIndex: number, defensivePosition?: BaseballPosition) => {
      // Block injured players from being added to lineup
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const baseballLineup = { ...currentLineup.baseballLineup };
      const newBattingOrder = [...baseballLineup.battingOrder];
      const newBench = [...currentLineup.bench];
      const newPositions = { ...baseballLineup.positions };

      // Don't add pitcher to batting order
      if (playerId === baseballLineup.startingPitcher) {
        return;
      }

      // Remove player from current position in batting order if present
      const existingIndex = newBattingOrder.indexOf(playerId);
      if (existingIndex !== -1) {
        newBattingOrder.splice(existingIndex, 1);
      }

      // Remove from bench if present
      const benchIndex = newBench.indexOf(playerId);
      if (benchIndex !== -1) {
        newBench.splice(benchIndex, 1);
      }

      // If slot is occupied, swap players
      if (newBattingOrder[slotIndex]) {
        // Move displaced player to bench if they were swapped out entirely
        const displacedId = newBattingOrder[slotIndex];
        if (existingIndex === -1) {
          // New player coming in, displaced goes to bench
          if (!newBench.includes(displacedId)) {
            newBench.push(displacedId);
          }
          newBattingOrder[slotIndex] = playerId;
        } else {
          // Existing player moving to new position - swap them
          newBattingOrder[existingIndex] = displacedId;
          newBattingOrder[slotIndex] = playerId;
        }
      } else {
        // Empty slot
        newBattingOrder[slotIndex] = playerId;
      }

      // Ensure batting order is exactly 9 slots
      while (newBattingOrder.length < 9) {
        newBattingOrder.push('');
      }

      // Set defensive position if provided
      if (defensivePosition) {
        // Remove any other player at this defensive position (except DH)
        if (defensivePosition !== 'DH') {
          for (const [existingId, existingPos] of Object.entries(newPositions)) {
            if (existingPos === defensivePosition && existingId !== playerId) {
              delete newPositions[existingId];
            }
          }
        }
        newPositions[playerId] = defensivePosition;
      }

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...baseballLineup,
          battingOrder: newBattingOrder.slice(0, 9),
          positions: newPositions,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  const removeFromBattingOrder = useCallback(
    (playerId: string) => {
      const currentLineup = activeLineup;
      const baseballLineup = { ...currentLineup.baseballLineup };
      const newBattingOrder = baseballLineup.battingOrder.map((id) =>
        id === playerId ? '' : id
      );
      const newPositions = { ...baseballLineup.positions };
      const newBench = [...currentLineup.bench];

      // Remove position assignment
      delete newPositions[playerId];

      // Add to bench
      if (!newBench.includes(playerId)) {
        newBench.push(playerId);
      }

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...baseballLineup,
          battingOrder: newBattingOrder,
          positions: newPositions,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Swap two players' positions in the batting order
   * Handles the swap in a single state update to avoid batching issues
   */
  const swapBattingOrderPositions = useCallback(
    (slotIndexA: number, slotIndexB: number) => {
      const currentLineup = activeLineup;
      const baseballLineup = { ...currentLineup.baseballLineup };
      const newBattingOrder = [...baseballLineup.battingOrder];

      // Swap the player IDs at the two slots (use empty string as fallback)
      const playerA = newBattingOrder[slotIndexA] ?? '';
      const playerB = newBattingOrder[slotIndexB] ?? '';
      newBattingOrder[slotIndexA] = playerB;
      newBattingOrder[slotIndexB] = playerA;

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...baseballLineup,
          battingOrder: newBattingOrder,
        },
      });
    },
    [activeLineup, activeSetLineup]
  );

  const isValidBaseballLineup = useMemo(() => {
    const baseballLineup = activeLineup.baseballLineup;

    // Must have a starting pitcher
    if (!baseballLineup.startingPitcher) return false;

    // Batting order must have exactly 9 filled slots
    const filledSlots = baseballLineup.battingOrder.filter((id) => id !== '');
    if (filledSlots.length !== 9) return false;

    // All batters must have position assignments
    for (const batterId of filledSlots) {
      if (!baseballLineup.positions[batterId]) return false;
    }

    // Pitcher must have 'P' position
    if (baseballLineup.positions[baseballLineup.startingPitcher] !== 'P') return false;

    // Exactly one player per defensive position (except DH)
    const positionCounts: Record<string, number> = {};
    for (const pos of Object.values(baseballLineup.positions)) {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    }

    // Each non-DH position should appear exactly once
    const requiredPositions: BaseballPosition[] = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
    for (const pos of requiredPositions) {
      if (positionCounts[pos] !== 1) return false;
    }

    return true;
  }, [activeLineup.baseballLineup]);

  /**
   * Calculate a player's overall rating for a specific baseball position
   */
  const getBaseballPositionOverall = useCallback(
    (playerId: string, position: BaseballPositionType): number => {
      const player = state.players[playerId];
      if (!player) return 0;
      return calculateBaseballPositionOverall(player.attributes, position);
    },
    [state.players]
  );

  /**
   * Get a player's best baseball position and overall rating
   * Checks all positions and returns the highest rated one
   */
  const getBaseballBestPosition = useCallback(
    (playerId: string): { position: BaseballPositionType; overall: number } => {
      const player = state.players[playerId];
      if (!player) return { position: 'DH', overall: 0 };

      const positions: BaseballPositionType[] = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'];
      let bestPosition: BaseballPositionType = 'DH';
      let bestOverall = 0;

      for (const pos of positions) {
        const ovr = calculateBaseballPositionOverall(player.attributes, pos);
        if (ovr > bestOverall) {
          bestOverall = ovr;
          bestPosition = pos;
        }
      }

      return { position: bestPosition, overall: bestOverall };
    },
    [state.players]
  );

  /**
   * Set the full baseball lineup at once (pitcher, batting order, positions)
   * This avoids state batching issues when setting multiple values
   */
  const setFullBaseballLineup = useCallback(
    (pitcherId: string, battingOrder: string[], positions: Record<string, BaseballPosition>) => {
      const currentLineup = activeLineup;
      const allInLineup = new Set([pitcherId, ...battingOrder.filter(id => id !== '')]);

      // Build new bench - everyone not in lineup (and not in bullpen)
      const roster = getUserRoster();
      const bullpenIds = new Set([
        currentLineup.baseballLineup.bullpen?.closer ?? '',
        ...(currentLineup.baseballLineup.bullpen?.longRelievers ?? []),
        ...(currentLineup.baseballLineup.bullpen?.shortRelievers ?? []),
      ].filter(id => id !== ''));
      const newBench = roster
        .filter(p => !allInLineup.has(p.id) && !bullpenIds.has(p.id))
        .map(p => p.id);

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          battingOrder: battingOrder.slice(0, 9),
          startingPitcher: pitcherId,
          positions: { ...positions, [pitcherId]: 'P' },
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  /**
   * Set a player in a bullpen role
   */
  const setBullpenRole = useCallback(
    (playerId: string, role: BullpenRole, slotIndex?: number) => {
      // Block injured players from being added to lineup
      const roster = getUserRoster();
      const player = roster.find(p => p.id === playerId);
      if (player?.injury !== null) return;

      const currentLineup = activeLineup;
      const currentBullpen = currentLineup.baseballLineup.bullpen ?? {
        longRelievers: ['', ''] as [string, string],
        shortRelievers: ['', ''] as [string, string],
        closer: '',
      };
      const newBench = [...currentLineup.bench];

      // Find the existing player in the target slot (to move them to bench)
      let displacedPlayerId: string | null = null;
      switch (role) {
        case 'closer':
          if (currentBullpen.closer && currentBullpen.closer !== playerId) {
            displacedPlayerId = currentBullpen.closer;
          }
          break;
        case 'longReliever':
          if (slotIndex !== undefined && slotIndex < 2) {
            const existing = currentBullpen.longRelievers[slotIndex];
            if (existing && existing !== playerId) {
              displacedPlayerId = existing;
            }
          }
          break;
        case 'shortReliever':
          if (slotIndex !== undefined && slotIndex < 2) {
            const existing = currentBullpen.shortRelievers[slotIndex];
            if (existing && existing !== playerId) {
              displacedPlayerId = existing;
            }
          }
          break;
      }

      // Move displaced player to bench if they exist and aren't already there
      if (displacedPlayerId && !newBench.includes(displacedPlayerId)) {
        newBench.push(displacedPlayerId);
      }

      // Remove the new player from bench (they're becoming a bullpen player)
      const benchIndex = newBench.indexOf(playerId);
      if (benchIndex !== -1) {
        newBench.splice(benchIndex, 1);
      }

      // Remove player from any existing bullpen slot
      const newBullpen: BaseballBullpenConfig = {
        longRelievers: currentBullpen.longRelievers.map((id) =>
          id === playerId ? '' : id
        ) as [string, string],
        shortRelievers: currentBullpen.shortRelievers.map((id) =>
          id === playerId ? '' : id
        ) as [string, string],
        closer: currentBullpen.closer === playerId ? '' : currentBullpen.closer,
      };

      // Also remove from batting order if present
      const newBattingOrder = currentLineup.baseballLineup.battingOrder.map((id) =>
        id === playerId ? '' : id
      );

      // Add to the specified role
      switch (role) {
        case 'closer':
          newBullpen.closer = playerId;
          break;
        case 'longReliever':
          if (slotIndex !== undefined && slotIndex < 2) {
            newBullpen.longRelievers[slotIndex] = playerId;
          } else {
            // Find first empty slot
            const emptyIndex = newBullpen.longRelievers.findIndex((id) => !id);
            if (emptyIndex >= 0) {
              newBullpen.longRelievers[emptyIndex] = playerId;
            }
          }
          break;
        case 'shortReliever':
          if (slotIndex !== undefined && slotIndex < 2) {
            newBullpen.shortRelievers[slotIndex] = playerId;
          } else {
            const emptyIndex = newBullpen.shortRelievers.findIndex((id) => !id);
            if (emptyIndex >= 0) {
              newBullpen.shortRelievers[emptyIndex] = playerId;
            }
          }
          break;
      }

      activeSetLineup({
        ...currentLineup,
        bench: newBench,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          battingOrder: newBattingOrder,
          bullpen: newBullpen,
        },
      });
    },
    [activeLineup, activeSetLineup, getUserRoster]
  );

  /**
   * Remove a player from the bullpen
   */
  const removeFromBullpen = useCallback(
    (playerId: string) => {
      const currentLineup = activeLineup;
      const currentBullpen = currentLineup.baseballLineup.bullpen;
      if (!currentBullpen) return;

      const newBullpen: BaseballBullpenConfig = {
        longRelievers: currentBullpen.longRelievers.map((id) =>
          id === playerId ? '' : id
        ) as [string, string],
        shortRelievers: currentBullpen.shortRelievers.map((id) =>
          id === playerId ? '' : id
        ) as [string, string],
        closer: currentBullpen.closer === playerId ? '' : currentBullpen.closer,
      };

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          bullpen: newBullpen,
        },
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Swap two bullpen players' roles in a single state update
   */
  const swapBullpenRoles = useCallback(
    (
      playerAId: string,
      roleA: BullpenRole,
      slotA: number | undefined,
      playerBId: string,
      roleB: BullpenRole,
      slotB: number | undefined
    ) => {
      const currentLineup = activeLineup;
      const currentBullpen = currentLineup.baseballLineup.bullpen ?? {
        longRelievers: ['', ''] as [string, string],
        shortRelievers: ['', ''] as [string, string],
        closer: '',
      };

      // Start with empty bullpen slots for the affected positions
      const newBullpen: BaseballBullpenConfig = {
        longRelievers: [...currentBullpen.longRelievers] as [string, string],
        shortRelievers: [...currentBullpen.shortRelievers] as [string, string],
        closer: currentBullpen.closer,
      };

      // Clear both players from their current positions
      newBullpen.longRelievers = newBullpen.longRelievers.map((id) =>
        id === playerAId || id === playerBId ? '' : id
      ) as [string, string];
      newBullpen.shortRelievers = newBullpen.shortRelievers.map((id) =>
        id === playerAId || id === playerBId ? '' : id
      ) as [string, string];
      if (newBullpen.closer === playerAId || newBullpen.closer === playerBId) {
        newBullpen.closer = '';
      }

      // Helper to place a player in a role
      const placeInRole = (playerId: string, role: BullpenRole, slot: number | undefined) => {
        switch (role) {
          case 'closer':
            newBullpen.closer = playerId;
            break;
          case 'longReliever':
            if (slot !== undefined && slot < 2) {
              newBullpen.longRelievers[slot] = playerId;
            }
            break;
          case 'shortReliever':
            if (slot !== undefined && slot < 2) {
              newBullpen.shortRelievers[slot] = playerId;
            }
            break;
        }
      };

      // Place player A in player B's old position
      placeInRole(playerAId, roleB, slotB);
      // Place player B in player A's old position
      placeInRole(playerBId, roleA, slotA);

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          bullpen: newBullpen,
        },
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Atomically swap a bullpen player with a batter.
   * Moves the batter to the specified bullpen role, and the bullpen player to the batting slot.
   */
  const swapBullpenWithBatter = useCallback(
    (
      bullpenPlayerId: string,
      bullpenRole: BullpenRole,
      bullpenSlotIndex: number | undefined,
      batterPlayerId: string,
      batterSlotIndex: number,
      batterPosition: BaseballPosition
    ) => {
      const currentLineup = activeLineup;
      const currentBullpen = currentLineup.baseballLineup.bullpen ?? {
        longRelievers: ['', ''] as [string, string],
        shortRelievers: ['', ''] as [string, string],
        closer: '',
      };

      // 1. Build new bullpen - remove bullpen player, add batter
      const newBullpen: BaseballBullpenConfig = {
        longRelievers: currentBullpen.longRelievers.map((id) =>
          id === bullpenPlayerId ? '' : id
        ) as [string, string],
        shortRelievers: currentBullpen.shortRelievers.map((id) =>
          id === bullpenPlayerId ? '' : id
        ) as [string, string],
        closer: currentBullpen.closer === bullpenPlayerId ? '' : currentBullpen.closer,
      };

      // Add batter to the bullpen role
      switch (bullpenRole) {
        case 'closer':
          newBullpen.closer = batterPlayerId;
          break;
        case 'longReliever':
          if (bullpenSlotIndex !== undefined && bullpenSlotIndex < 2) {
            newBullpen.longRelievers[bullpenSlotIndex] = batterPlayerId;
          }
          break;
        case 'shortReliever':
          if (bullpenSlotIndex !== undefined && bullpenSlotIndex < 2) {
            newBullpen.shortRelievers[bullpenSlotIndex] = batterPlayerId;
          }
          break;
      }

      // 2. Build new batting order - remove batter, add bullpen player
      const newBattingOrder = [...currentLineup.baseballLineup.battingOrder];
      newBattingOrder[batterSlotIndex] = bullpenPlayerId;

      // 3. Build new positions - give bullpen player the batter's position
      const newPositions = { ...currentLineup.baseballLineup.positions };
      delete newPositions[batterPlayerId]; // Remove batter's position
      newPositions[bullpenPlayerId] = batterPosition; // Give bullpen player the position

      // 4. Update bench - remove bullpen player if they were there
      const newBench = currentLineup.bench.filter((id) => id !== bullpenPlayerId);

      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          battingOrder: newBattingOrder,
          positions: newPositions,
          bullpen: newBullpen,
        },
        bench: newBench,
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Atomically swap a bullpen player with the starting pitcher.
   * Moves the pitcher to the specified bullpen role, and the bullpen player becomes the starter.
   */
  const swapBullpenWithPitcher = useCallback(
    (
      bullpenPlayerId: string,
      bullpenRole: BullpenRole,
      bullpenSlotIndex: number | undefined
    ) => {
      const currentLineup = activeLineup;
      const currentPitcherId = currentLineup.baseballLineup.startingPitcher;
      if (!currentPitcherId) return;

      const currentBullpen = currentLineup.baseballLineup.bullpen ?? {
        longRelievers: ['', ''] as [string, string],
        shortRelievers: ['', ''] as [string, string],
        closer: '',
      };

      // 1. Build new bullpen - remove bullpen player, add current pitcher
      const newBullpen: BaseballBullpenConfig = {
        longRelievers: currentBullpen.longRelievers.map((id) =>
          id === bullpenPlayerId ? '' : id
        ) as [string, string],
        shortRelievers: currentBullpen.shortRelievers.map((id) =>
          id === bullpenPlayerId ? '' : id
        ) as [string, string],
        closer: currentBullpen.closer === bullpenPlayerId ? '' : currentBullpen.closer,
      };

      // Add current pitcher to the bullpen role
      switch (bullpenRole) {
        case 'closer':
          newBullpen.closer = currentPitcherId;
          break;
        case 'longReliever':
          if (bullpenSlotIndex !== undefined && bullpenSlotIndex < 2) {
            newBullpen.longRelievers[bullpenSlotIndex] = currentPitcherId;
          }
          break;
        case 'shortReliever':
          if (bullpenSlotIndex !== undefined && bullpenSlotIndex < 2) {
            newBullpen.shortRelievers[bullpenSlotIndex] = currentPitcherId;
          }
          break;
      }

      // 2. Update positions - new pitcher gets 'P', old pitcher loses position
      const newPositions = { ...currentLineup.baseballLineup.positions };
      delete newPositions[currentPitcherId]; // Remove old pitcher's 'P' position
      newPositions[bullpenPlayerId] = 'P'; // Assign 'P' to new pitcher

      // 3. Update in one state change
      activeSetLineup({
        ...currentLineup,
        baseballLineup: {
          ...currentLineup.baseballLineup,
          startingPitcher: bullpenPlayerId,
          bullpen: newBullpen,
          positions: newPositions,
        },
      });
    },
    [activeLineup, activeSetLineup]
  );

  /**
   * Apply optimal baseball lineup including batting order, pitcher, and bullpen.
   * Uses the same fitness degradation formula as match simulations to calculate effective ratings.
   */
  const applyOptimalBaseballLineup = useCallback(() => {
    const roster = getUserRoster();
    const currentLineup = activeLineup;

    // Calculate each player's effective rating for each baseball position
    // Uses fitness degradation to match in-match performance
    const playerScores: Array<{
      player: Player;
      effectiveScores: Record<BaseballPosition, number>;
    }> = roster
      .filter((p) => p.injury === null)
      .map((player) => {
        // Apply fitness degradation to get effective attributes (same as in-match)
        const degradedPlayer = applyFitnessDegradation(player);
        return {
          player,
          effectiveScores: {
            P: calculateBaseballPositionOverall(degradedPlayer.attributes, 'P'),
            C: calculateBaseballPositionOverall(degradedPlayer.attributes, 'C'),
            '1B': calculateBaseballPositionOverall(degradedPlayer.attributes, '1B'),
            '2B': calculateBaseballPositionOverall(degradedPlayer.attributes, '2B'),
            SS: calculateBaseballPositionOverall(degradedPlayer.attributes, 'SS'),
            '3B': calculateBaseballPositionOverall(degradedPlayer.attributes, '3B'),
            LF: calculateBaseballPositionOverall(degradedPlayer.attributes, 'LF'),
            CF: calculateBaseballPositionOverall(degradedPlayer.attributes, 'CF'),
            RF: calculateBaseballPositionOverall(degradedPlayer.attributes, 'RF'),
            DH: calculateBaseballPositionOverall(degradedPlayer.attributes, 'DH'),
          },
        };
      });

    // Helper: Select best player for a position by effective rating
    const selectBestForPosition = (
      candidates: typeof playerScores,
      pos: BaseballPosition,
      usedIds: Set<string>
    ): typeof playerScores[0] | undefined => {
      const available = candidates.filter((ps) => !usedIds.has(ps.player.id));
      if (available.length === 0) return undefined;

      // Sort by effective rating for this position
      available.sort((a, b) => b.effectiveScores[pos] - a.effectiveScores[pos]);
      return available[0];
    };

    // 1. Find best starting pitcher by effective rating
    const startingPitcherData = selectBestForPosition(playerScores, 'P', new Set());
    const startingPitcher = startingPitcherData?.player;
    if (!startingPitcher) return;

    // 2. Build optimal lineup for defensive positions (excluding pitcher)
    const usedPlayerIds = new Set<string>([startingPitcher.id]);
    const positions: Record<string, BaseballPosition> = {
      [startingPitcher.id]: 'P',
    };
    const battingOrder: string[] = [];

    // Defensive positions to fill (9 players: C, 1B, 2B, SS, 3B, LF, CF, RF, DH)
    const defensivePositions: BaseballPosition[] = [
      'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH',
    ];

    // Greedy assignment: for each position, pick best available by effective rating
    for (const pos of defensivePositions) {
      const best = selectBestForPosition(playerScores, pos, usedPlayerIds);
      if (best) {
        battingOrder.push(best.player.id);
        positions[best.player.id] = pos;
        usedPlayerIds.add(best.player.id);
      }
    }

    // 3. Build optimal bullpen from remaining players by effective pitching rating
    const remainingForBullpen = playerScores
      .filter((ps) => !usedPlayerIds.has(ps.player.id))
      .sort((a, b) => b.effectiveScores.P - a.effectiveScores.P);

    // Select top 5 pitchers for bullpen roles
    const bullpenCandidates = remainingForBullpen.slice(0, 5);
    const closer = bullpenCandidates[0]?.player.id ?? '';
    const longReliever1 = bullpenCandidates[1]?.player.id ?? '';
    const longReliever2 = bullpenCandidates[2]?.player.id ?? '';
    const shortReliever1 = bullpenCandidates[3]?.player.id ?? '';
    const shortReliever2 = bullpenCandidates[4]?.player.id ?? '';

    const longRelievers: [string, string] = [longReliever1, longReliever2];
    const shortRelievers: [string, string] = [shortReliever1, shortReliever2];

    const bullpen: BaseballBullpenConfig = {
      closer,
      longRelievers,
      shortRelievers,
    };

    // 4. Build bench from anyone not assigned - sort by effective overall
    const allAssigned = new Set([
      startingPitcher.id,
      ...battingOrder,
      closer,
      ...longRelievers.filter((id) => id !== ''),
      ...shortRelievers.filter((id) => id !== ''),
    ]);
    const benchCandidates = roster
      .filter((p) => !allAssigned.has(p.id))
      .map((p) => {
        const degradedPlayer = applyFitnessDegradation(p);
        return { id: p.id, effectiveOverall: calculatePlayerOverall(degradedPlayer) };
      })
      .sort((a, b) => b.effectiveOverall - a.effectiveOverall);
    // Limit bench to 9 players (rest are reserves)
    const newBench = benchCandidates.slice(0, 9).map((p) => p.id);

    // 5. Set the full lineup in one state update
    activeSetLineup({
      ...currentLineup,
      baseballLineup: {
        ...currentLineup.baseballLineup,
        startingPitcher: startingPitcher.id,
        battingOrder: battingOrder.slice(0, 9),
        positions,
        bullpen,
      },
      bench: newBench,
    });
  }, [activeLineup, getUserRoster, activeSetLineup]);

  // =========================================================================
  // RETURN BASED ON SPORT
  // =========================================================================

  if (sport === 'baseball') {
    return {
      players: baseballPlayers,
      starters: baseballBattingOrder,
      bench: baseballBench,
      reserves: baseballReserves,
      injured: baseballInjured,
      currentLineup: activeLineup,
      battingOrder: baseballBattingOrder,
      startingPitcher: baseballStartingPitcher,
      positions: activeLineup.baseballLineup.positions,
      bullpen: baseballBullpen,
      setBattingOrder: setBaseballBattingOrder,
      setStartingPitcher: setBaseballStartingPitcher,
      setPosition: setBaseballPosition,
      addToBattingOrder,
      removeFromBattingOrder,
      swapBattingOrder: swapBattingOrderPositions,
      setFullLineup: setFullBaseballLineup,
      setBullpenRole,
      removeFromBullpen,
      swapBullpenRoles,
      swapBullpenWithBatter,
      swapBullpenWithPitcher,
      getPositionOverall: getBaseballPositionOverall,
      getBestPosition: getBaseballBestPosition,
      applyOptimalLineup: applyOptimalBaseballLineup,
      isValidLineup: isValidBaseballLineup,
      // Provide stubs for shared interface compatibility
      setStarter: addToBattingOrder,
      moveToBench: removeFromBattingOrder,
      swapPlayers: () => {},
      setFormation: undefined,
      setTargetMinutes: () => {},
      totalMinutesAllocated: 0,
      formation: undefined,
      formationPositions: undefined,
      addToBench: addPlayerToBench,
      removeFromBench: removePlayerFromBench,
      swapBenchWithReserve,
    };
  }

  if (sport === 'soccer') {
    return {
      players: soccerPlayers,
      starters: soccerStarters,
      bench: soccerBench,
      reserves: soccerReserves,
      injured: soccerInjured,
      currentLineup: activeLineup,
      formation: currentFormation,
      formationPositions,
      setStarter: setSoccerStarter,
      moveToBench: moveSoccerToBench,
      setFormation: setSoccerFormation,
      setFullLineup: setFullSoccerLineup,
      swapStarters: swapSoccerStarters,
      swapPlayers: () => {}, // Legacy - use swapStarters instead
      setTargetMinutes: setSoccerTargetMinutes,
      getMaxAllowedMinutes: getSoccerMaxAllowedMinutes,
      totalMinutesAllocated: soccerTotalMinutes,
      isValidLineup: isValidSoccerLineup,
      // Formation rating utilities
      getFormationRatings,
      getCurrentLineupAverageOverall,
      applyOptimalLineup: applyOptimalSoccerLineup,
      calculateOptimalLineupForFormation,
      addToBench: addPlayerToBench,
      removeFromBench: removePlayerFromBench,
      swapBenchWithReserve,
    };
  }

  // Default: basketball
  return {
    players: basketballPlayers,
    starters: basketballStarters,
    bench: basketballBench,
    reserves: basketballReserves,
    injured: basketballInjured,
    currentLineup: activeLineup,
    formation: undefined,
    formationPositions: undefined,
    setStarter: setBasketballStarter,
    moveToBench: moveBasketballToBench,
    swapPlayers: swapBasketballPlayers,
    swapStarters: swapBasketballStarterPositions,
    setFormation: undefined,
    setFullLineup: setFullBasketballLineup,
    applyOptimalLineup: applyOptimalBasketballLineup,
    setTargetMinutes: setBasketballTargetMinutes,
    getMaxAllowedMinutes: getBasketballMaxAllowedMinutes,
    totalMinutesAllocated: basketballTotalMinutes,
    isValidLineup: isValidBasketballLineup,
    addToBench: addPlayerToBench,
    removeFromBench: removePlayerFromBench,
    swapBenchWithReserve,
  };
}

export default useLineup;
