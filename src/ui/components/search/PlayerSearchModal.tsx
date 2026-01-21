/**
 * Player Search Modal
 *
 * Global player search with advanced filters:
 * - Name search
 * - Team dropdown (all teams listed)
 * - Height/Weight ranges
 * - Nationality
 * - Age range
 * - Overall range
 * - Attribute filters with comparison operators (>=, <=, =)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { Player, PlayerAttributes, ScoutingReport } from '../../../data/types';
import { calculatePlayerOverall } from '../../integration/gameInitializer';
import { calculatePlayerValuation, calculatePlayerMarketValue } from '../../../systems/contractSystem';

interface PlayerSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onPlayerPress: (playerId: string, playerList?: string[]) => void;
  onScoutPlayer?: (playerId: string) => void;
  players: Player[];
  teams: Array<{ id: string; name: string }>;
  userTeamId: string;
  scoutingReports?: ScoutingReport[];
  scoutedPlayerIds?: string[];
  scoutingTargetIds?: string[];  // Players currently being scouted
  transferListPlayerIds?: string[];  // Players on the transfer list
  transferListAskingPrices?: Record<string, number>;  // Asking prices for transfer-listed players
}

type SortOption = 'overall' | 'age' | 'height' | 'weight' | 'name' | 'salary' | 'askingPrice';

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'overall', label: 'Overall' },
  { key: 'age', label: 'Age' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'name', label: 'Name' },
  { key: 'salary', label: 'Salary' },
  { key: 'askingPrice', label: 'Asking Price' },
];

type ComparisonOperator = '>=' | '<=' | '=';

interface AttributeFilter {
  attribute: string;
  operator: ComparisonOperator;
  value: number;
}

// All available attributes for filtering
const ATTRIBUTE_OPTIONS: Array<{ key: keyof PlayerAttributes; label: string }> = [
  // Physical
  { key: 'height', label: 'Height' },
  { key: 'jumping', label: 'Jumping' },
  { key: 'agility', label: 'Agility' },
  { key: 'acceleration', label: 'Acceleration' },
  { key: 'top_speed', label: 'Speed' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'core_strength', label: 'Core Strength' },
  { key: 'arm_strength', label: 'Arm Strength' },
  { key: 'grip_strength', label: 'Grip Strength' },
  { key: 'balance', label: 'Balance' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'durability', label: 'Durability' },
  // Technical
  { key: 'throw_accuracy', label: 'Accuracy' },
  { key: 'hand_eye_coordination', label: 'Coordination' },
  { key: 'form_technique', label: 'Technique' },
  { key: 'finesse', label: 'Finesse' },
  { key: 'deception', label: 'Deception' },
  { key: 'teamwork', label: 'Teamwork' },
  // Mental
  { key: 'awareness', label: 'Awareness' },
  { key: 'composure', label: 'Composure' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'determination', label: 'Determination' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'bravery', label: 'Bravery' },
  { key: 'patience', label: 'Patience' },
];

export function PlayerSearchModal({
  visible,
  onClose,
  onPlayerPress,
  onScoutPlayer,
  players,
  teams,
  userTeamId,
  scoutingReports = [],
  scoutedPlayerIds = [],
  scoutingTargetIds = [],
  transferListPlayerIds = [],
  transferListAskingPrices = {},
}: PlayerSearchModalProps) {
  const colors = useColors();

  // Debug: Log transfer list data when it changes
  useEffect(() => {
    const listedCount = transferListPlayerIds.length;
    const priceCount = Object.keys(transferListAskingPrices).length;
    if (listedCount > 0 || priceCount > 0) {
      console.log(`[PlayerSearch] Transfer Listed: ${listedCount} players, ${priceCount} with asking prices`);
      for (const [playerId, price] of Object.entries(transferListAskingPrices)) {
        const player = players.find(p => p.id === playerId);
        console.log(`  - ${player?.name || playerId}: $${price.toLocaleString()}`);
      }
    }
  }, [transferListPlayerIds, transferListAskingPrices, players]);

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('overall');
  const [sortAscending, setSortAscending] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  // PERFORMANCE: Create lookup maps for O(1) access instead of O(n) find() calls
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) {
      map.set(p.id, p);
    }
    return map;
  }, [players]);

  const scoutingReportMap = useMemo(() => {
    const map = new Map<string, typeof scoutingReports[0]>();
    for (const r of scoutingReports) {
      map.set(r.playerId, r);
    }
    return map;
  }, [scoutingReports]);

  const scoutedPlayerSet = useMemo(() => new Set(scoutedPlayerIds), [scoutedPlayerIds]);

  // Helper to get scouting status for a player
  const getScoutingInfo = useCallback((playerId: string) => {
    // User team players are always fully known
    const player = playerMap.get(playerId);
    if (player?.teamId === userTeamId) {
      return { isFullyKnown: true, scoutingDepth: 100, report: null };
    }

    // Check if fully scouted
    if (scoutedPlayerSet.has(playerId)) {
      return { isFullyKnown: true, scoutingDepth: 100, report: null };
    }

    // Check for partial scouting report
    const report = scoutingReportMap.get(playerId);
    if (report) {
      const depth = report.scoutingQuality || 50;
      return { isFullyKnown: depth >= 100, scoutingDepth: depth, report };
    }

    // Not scouted at all
    return { isFullyKnown: false, scoutingDepth: 0, report: null };
  }, [playerMap, userTeamId, scoutedPlayerSet, scoutingReportMap]);

  // Search state
  const [searchText, setSearchText] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [selectedNationality, setSelectedNationality] = useState<string>('all');
  const [minOverall, setMinOverall] = useState('');
  const [maxOverall, setMaxOverall] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilter[]>([]);

  // Special filter checkboxes
  const [showFreeAgentsOnly, setShowFreeAgentsOnly] = useState(false);
  const [showTransferListedOnly, setShowTransferListedOnly] = useState(false);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [showAttributePicker, setShowAttributePicker] = useState(false);
  const [editingAttributeIndex, setEditingAttributeIndex] = useState<number | null>(null);

  // Get unique nationalities from players
  const nationalities = useMemo(() => {
    if (!players || !Array.isArray(players)) return [];
    const unique = new Set(players.map((p) => p.nationality).filter(Boolean));
    return Array.from(unique).sort();
  }, [players]);

  // Helper to get salary for a player (contract salary or calculated for free agents)
  const getPlayerSalary = useCallback((player: Player): number => {
    // If player has a contract, use contract salary
    if (player.contract && player.contract.salary > 0) {
      return player.contract.salary;
    }
    // For free agents, calculate salary demand based on their attributes
    const overall = calculatePlayerOverall(player);
    // Calculate average potential (use current overall as estimate)
    const { annualSalary } = calculatePlayerValuation(overall, player.age, overall, 1);
    return annualSalary;
  }, []);

  // Create a set for fast transfer list lookup
  const transferListSet = useMemo(() => new Set(transferListPlayerIds), [transferListPlayerIds]);

  // Build team options (only actual teams, not special filters)
  const teamOptions = useMemo(() => {
    const options: Array<{ id: string; name: string }> = [
      { id: 'all', name: 'All Teams' },
    ];
    // Add user team first
    const userTeam = teams.find((t) => t.id === userTeamId);
    if (userTeam) {
      options.push({ id: userTeam.id, name: `${userTeam.name} (You)` });
    }
    // Add other teams sorted alphabetically
    const otherTeams = teams
      .filter((t) => t.id !== userTeamId)
      .sort((a, b) => a.name.localeCompare(b.name));
    options.push(...otherTeams);
    return options;
  }, [teams, userTeamId]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchText('');
    setSelectedTeamId('all');
    setMinAge('');
    setMaxAge('');
    setMinHeight('');
    setMaxHeight('');
    setMinWeight('');
    setMaxWeight('');
    setSelectedNationality('all');
    setMinOverall('');
    setMaxOverall('');
    setMinSalary('');
    setMaxSalary('');
    setAttributeFilters([]);
    setShowFreeAgentsOnly(false);
    setShowTransferListedOnly(false);
  }, []);

  // Add attribute filter
  const addAttributeFilter = useCallback(() => {
    setAttributeFilters((prev) => [
      ...prev,
      { attribute: 'throw_accuracy', operator: '>=', value: 50 },
    ]);
  }, []);

  // Update attribute filter
  const updateAttributeFilter = useCallback(
    (index: number, updates: Partial<AttributeFilter>) => {
      setAttributeFilters((prev) =>
        prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
      );
    },
    []
  );

  // Remove attribute filter
  const removeAttributeFilter = useCallback((index: number) => {
    setAttributeFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Filter players
  const filteredPlayers = useMemo(() => {
    if (!players || !Array.isArray(players)) return [];
    return players.filter((player) => {
      // Name filter
      if (searchText && !player.name.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      // Free agents filter (checkbox)
      if (showFreeAgentsOnly && player.teamId !== 'free_agent') {
        return false;
      }

      // Transfer listed filter (checkbox)
      if (showTransferListedOnly && !transferListSet.has(player.id)) {
        return false;
      }

      // Team filter (dropdown - only applies to non-free-agent filtering)
      if (selectedTeamId !== 'all' && player.teamId !== selectedTeamId) {
        return false;
      }

      // Age filter
      const minAgeNum = minAge ? parseInt(minAge, 10) : null;
      const maxAgeNum = maxAge ? parseInt(maxAge, 10) : null;
      if (minAgeNum !== null && !isNaN(minAgeNum) && player.age < minAgeNum) return false;
      if (maxAgeNum !== null && !isNaN(maxAgeNum) && player.age > maxAgeNum) return false;

      // Height filter (in inches)
      const minHeightNum = minHeight ? parseInt(minHeight, 10) : null;
      const maxHeightNum = maxHeight ? parseInt(maxHeight, 10) : null;
      if (minHeightNum !== null && !isNaN(minHeightNum) && player.height < minHeightNum) return false;
      if (maxHeightNum !== null && !isNaN(maxHeightNum) && player.height > maxHeightNum) return false;

      // Weight filter
      const minWeightNum = minWeight ? parseInt(minWeight, 10) : null;
      const maxWeightNum = maxWeight ? parseInt(maxWeight, 10) : null;
      if (minWeightNum !== null && !isNaN(minWeightNum) && player.weight < minWeightNum) return false;
      if (maxWeightNum !== null && !isNaN(maxWeightNum) && player.weight > maxWeightNum) return false;

      // Nationality filter
      if (selectedNationality !== 'all' && player.nationality !== selectedNationality) {
        return false;
      }

      // Overall filter
      const overall = calculatePlayerOverall(player);
      const minOverallNum = minOverall ? parseInt(minOverall, 10) : null;
      const maxOverallNum = maxOverall ? parseInt(maxOverall, 10) : null;
      if (minOverallNum !== null && !isNaN(minOverallNum) && overall < minOverallNum) return false;
      if (maxOverallNum !== null && !isNaN(maxOverallNum) && overall > maxOverallNum) return false;

      // Salary filter
      const minSalaryNum = minSalary ? parseFloat(minSalary) * 1000000 : null;
      const maxSalaryNum = maxSalary ? parseFloat(maxSalary) * 1000000 : null;
      if (minSalaryNum !== null || maxSalaryNum !== null) {
        const playerSalary = getPlayerSalary(player);
        if (minSalaryNum !== null && !isNaN(minSalaryNum) && playerSalary < minSalaryNum) return false;
        if (maxSalaryNum !== null && !isNaN(maxSalaryNum) && playerSalary > maxSalaryNum) return false;
      }

      // Attribute filters - must respect scouting status
      for (const filter of attributeFilters) {
        const attrValue = (player.attributes as unknown as Record<string, number>)[filter.attribute];
        if (typeof attrValue !== 'number') continue;

        // Check if player is on user team or fully scouted
        const isUserTeamPlayer = player.teamId === userTeamId;
        const isFullyScouted = scoutedPlayerIds.includes(player.id);

        if (isUserTeamPlayer || isFullyScouted) {
          // Use exact value for known players
          switch (filter.operator) {
            case '>=':
              if (attrValue < filter.value) return false;
              break;
            case '<=':
              if (attrValue > filter.value) return false;
              break;
            case '=':
              if (attrValue !== filter.value) return false;
              break;
          }
        } else {
          // Check scouting report for this player
          const report = scoutingReports.find(r => r.playerId === player.id);

          if (!report || !report.attributeRanges || !report.attributeRanges[filter.attribute]) {
            // Attribute not scouted - EXCLUDE from results
            // User shouldn't be able to "discover" unscouted attributes via search
            return false;
          }

          // Use the scouted range
          const range = report.attributeRanges[filter.attribute];

          switch (filter.operator) {
            case '>=':
              // Include if the max of the range could satisfy >= filter
              // i.e., if range is 28-48 and filter is >= 45, include because actual could be 45-48
              if (range.max < filter.value) return false;
              break;
            case '<=':
              // Include if the min of the range could satisfy <= filter
              // i.e., if range is 28-48 and filter is <= 30, include because actual could be 28-30
              if (range.min > filter.value) return false;
              break;
            case '=':
              // Include if filter value falls within the range
              if (filter.value < range.min || filter.value > range.max) return false;
              break;
          }
        }
      }

      return true;
    });
  }, [
    players,
    searchText,
    selectedTeamId,
    minAge,
    maxAge,
    minHeight,
    maxHeight,
    minWeight,
    maxWeight,
    selectedNationality,
    minOverall,
    maxOverall,
    minSalary,
    maxSalary,
    attributeFilters,
    userTeamId,
    scoutedPlayerIds,
    scoutingReports,
    transferListSet,
    getPlayerSalary,
    showFreeAgentsOnly,
    showTransferListedOnly,
  ]);

  // Sort players by selected criteria
  // When sorting by overall, only sort scouted players by actual rating
  // Unscouted players (showing "?") are sorted by last name and placed at the end
  const sortedPlayers = useMemo(() => {
    // PERFORMANCE: Pre-compute sortable overalls ONCE before sorting
    // This avoids calling getScoutingInfo() for every sort comparison (O(n log n) calls)
    const sortableOveralls = new Map<string, number | null>();

    if (sortBy === 'overall') {
      for (const player of filteredPlayers) {
        const info = getScoutingInfo(player.id);

        if (info.isFullyKnown) {
          sortableOveralls.set(player.id, calculatePlayerOverall(player));
        } else if (info.scoutingDepth > 0 && info.report?.overallRatings?.basketball) {
          const range = info.report.overallRatings.basketball;
          sortableOveralls.set(player.id, (range.min + range.max) / 2);
        } else {
          sortableOveralls.set(player.id, null);
        }
      }
    }

    return [...filteredPlayers].sort((a, b) => {
      // When sorting by overall, handle scouting status
      if (sortBy === 'overall') {
        const overallA = sortableOveralls.get(a.id) ?? null;
        const overallB = sortableOveralls.get(b.id) ?? null;

        // Both have sortable values: sort by overall
        if (overallA !== null && overallB !== null) {
          const comparison = overallA - overallB;
          return sortAscending ? comparison : -comparison;
        }

        // Only A has value: A comes first (scouted players at top)
        if (overallA !== null && overallB === null) {
          return sortAscending ? 1 : -1;
        }

        // Only B has value: B comes first
        if (overallA === null && overallB !== null) {
          return sortAscending ? -1 : 1;
        }

        // Neither has value (both show "?"): sort by last name
        const lastNameA = a.name.split(' ').pop() || a.name;
        const lastNameB = b.name.split(' ').pop() || b.name;
        return lastNameA.localeCompare(lastNameB);
      }

      // For other sort options, use normal sorting
      let comparison = 0;
      switch (sortBy) {
        case 'age':
          comparison = a.age - b.age;
          break;
        case 'height':
          comparison = a.height - b.height;
          break;
        case 'weight':
          comparison = a.weight - b.weight;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'salary':
          comparison = getPlayerSalary(a) - getPlayerSalary(b);
          break;
        case 'askingPrice': {
          // Sort by asking price - use market value as fallback for listed players, Infinity for unlisted
          const isListedA = transferListSet.has(a.id);
          const isListedB = transferListSet.has(b.id);
          const priceA = isListedA
            ? (transferListAskingPrices[a.id] ?? calculatePlayerMarketValue(a))
            : Infinity;
          const priceB = isListedB
            ? (transferListAskingPrices[b.id] ?? calculatePlayerMarketValue(b))
            : Infinity;
          comparison = priceA - priceB;
          break;
        }
      }
      return sortAscending ? comparison : -comparison;
    });
  }, [filteredPlayers, sortBy, sortAscending, getScoutingInfo, getPlayerSalary, transferListAskingPrices]);

  // Get team name for display
  const getTeamName = useCallback(
    (teamId: string) => {
      if (teamId === 'free_agent') return 'Free Agent';
      if (teamId === userTeamId) return 'Your Team';
      const team = teams.find((t) => t.id === teamId);
      return team?.name || 'Unknown';
    },
    [teams, userTeamId]
  );

  // Format height for display (inches to feet'inches")
  const formatHeight = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  // Format salary
  const formatSalary = (salary: number) => {
    if (salary >= 1000000) return `$${(salary / 1000000).toFixed(1)}M`;
    return `$${(salary / 1000).toFixed(0)}K`;
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTeamId !== 'all') count++;
    if (minAge || maxAge) count++;
    if (minHeight || maxHeight) count++;
    if (minWeight || maxWeight) count++;
    if (selectedNationality !== 'all') count++;
    if (minOverall || maxOverall) count++;
    if (minSalary || maxSalary) count++;
    count += attributeFilters.length;
    return count;
  }, [
    selectedTeamId,
    minAge,
    maxAge,
    minHeight,
    maxHeight,
    minWeight,
    maxWeight,
    selectedNationality,
    minOverall,
    maxOverall,
    minSalary,
    maxSalary,
    attributeFilters,
  ]);

  // Check if player can be scouted (not on user team, not already scouted, not already being scouted)
  const canScoutPlayer = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.teamId === userTeamId) return false;  // Own team - no need to scout
    if (scoutedPlayerIds.includes(playerId)) return false;  // Already fully scouted
    if (scoutingTargetIds.includes(playerId)) return false;  // Already being scouted
    return true;
  }, [players, userTeamId, scoutedPlayerIds, scoutingTargetIds]);

  // Render player item
  const renderPlayer = ({ item: player }: { item: Player }) => {
    const overall = calculatePlayerOverall(player);
    const scoutingInfo = getScoutingInfo(player.id);
    const isOnScoutList = scoutingTargetIds.includes(player.id);
    const isOwnPlayer = player.teamId === userTeamId;
    const canScout = canScoutPlayer(player.id);
    const isOnTransferList = transferListSet.has(player.id);
    // Get asking price - use stored value or calculate from market value as fallback
    const storedAskingPrice = transferListAskingPrices[player.id];
    const askingPrice = isOnTransferList
      ? (storedAskingPrice ?? calculatePlayerMarketValue(player))
      : undefined;

    // Determine what to show for overall rating
    let overallDisplay: string;
    let badgeColor: string;

    if (scoutingInfo.isFullyKnown) {
      // Fully known - show exact overall
      overallDisplay = overall.toString();
      badgeColor = colors.primary;
    } else if (scoutingInfo.scoutingDepth > 0 && scoutingInfo.report?.overallRatings?.basketball) {
      // Partially scouted - show range from report
      const range = scoutingInfo.report.overallRatings.basketball;
      overallDisplay = `${range.min}-${range.max}`;
      badgeColor = colors.warning || '#FFA500';
    } else {
      // Not scouted - show question mark
      overallDisplay = '?';
      badgeColor = colors.textMuted;
    }

    return (
      <View style={[styles.playerCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Pressable
          style={({ pressed }) => [
            styles.playerPressable,
            { backgroundColor: pressed ? colors.surface : 'transparent' },
          ]}
          onPress={() => {
            // Don't close the modal - let user return to search after viewing player
            // Pass sorted player list for swipe navigation
            const playerIds = sortedPlayers.map(p => p.id);
            onPlayerPress(player.id, playerIds);
          }}
        >
          <View style={styles.playerInfo}>
            <View style={styles.playerHeader}>
              <Text style={[styles.playerName, { color: colors.text }]}>{player.name}</Text>
              <View style={styles.badgeRow}>
                {/* Transfer listed indicator */}
                {isOnTransferList && !isOwnPlayer && (
                  <View style={[styles.scoutingBadge, { backgroundColor: colors.success + '30' }]}>
                    <Text style={[styles.scoutingBadgeText, { color: colors.success }]}>For Sale</Text>
                  </View>
                )}
                {/* Scouting status indicator */}
                {isOnScoutList && (
                  <View style={[styles.scoutingBadge, { backgroundColor: colors.warning + '30' }]}>
                    <Text style={[styles.scoutingBadgeText, { color: colors.warning }]}>Scouting</Text>
                  </View>
                )}
                {scoutingInfo.isFullyKnown && !isOwnPlayer && !isOnTransferList && (
                  <View style={[styles.scoutingBadge, { backgroundColor: colors.success + '30' }]}>
                    <Text style={[styles.scoutingBadgeText, { color: colors.success }]}>Scouted</Text>
                  </View>
                )}
                <View style={[styles.overallBadge, { backgroundColor: badgeColor }]}>
                  <Text style={[styles.overallText, overallDisplay.length > 2 && styles.overallTextSmall]}>
                    {overallDisplay}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
              {formatHeight(player.height)} | {player.weight} lbs | Age {player.age}
            </Text>
            <Text style={[styles.playerTeam, { color: colors.textSecondary }]}>
              {getTeamName(player.teamId)}
              {player.contract && ` | ${formatSalary(player.contract.salary)}/yr`}
            </Text>
            {/* Asking price shown prominently for transfer-listed players - always visible regardless of scouting */}
            {isOnTransferList && askingPrice !== undefined && (
              <View style={styles.askingPriceRow}>
                <Text style={[styles.askingPriceLabel, { color: colors.textMuted }]}>Asking:</Text>
                <Text style={[styles.askingPriceValue, { color: colors.success }]}>
                  {formatSalary(askingPrice)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Scout button - only show for players that can be scouted */}
        {canScout && onScoutPlayer && (
          <TouchableOpacity
            style={[styles.scoutButton, { backgroundColor: colors.primary }]}
            onPress={() => onScoutPlayer(player.id)}
          >
            <Text style={styles.scoutButtonText}>Scout</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Get selected team name
  const selectedTeamName = teamOptions.find((t) => t.id === selectedTeamId)?.name || 'All Teams';

  // Get selected nationality name
  const selectedNationalityName = selectedNationality === 'all' ? 'All' : selectedNationality;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Search Players</Text>
          <TouchableOpacity onPress={resetFilters} style={styles.closeButton}>
            <Text style={[styles.resetText, { color: colors.textMuted }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
            ]}
            placeholder="Search by name..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />

          {/* Filter Toggle */}
          <TouchableOpacity
            style={[
              styles.filterToggle,
              {
                backgroundColor: showFilters ? colors.primary : colors.surface,
                borderColor: showFilters ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text
              style={[styles.filterToggleText, { color: showFilters ? '#FFFFFF' : colors.text }]}
            >
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expandable Filters */}
        {showFilters && (
          <ScrollView style={[styles.filtersContainer, { backgroundColor: colors.card }]}>
            {/* Quick Filters (Checkboxes) */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkboxButton,
                  {
                    backgroundColor: showFreeAgentsOnly ? colors.primary : colors.surface,
                    borderColor: showFreeAgentsOnly ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setShowFreeAgentsOnly(!showFreeAgentsOnly)}
              >
                <Text style={[styles.checkboxText, { color: showFreeAgentsOnly ? '#FFFFFF' : colors.text }]}>
                  Free Agents Only
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.checkboxButton,
                  {
                    backgroundColor: showTransferListedOnly ? colors.success : colors.surface,
                    borderColor: showTransferListedOnly ? colors.success : colors.border,
                  },
                ]}
                onPress={() => setShowTransferListedOnly(!showTransferListedOnly)}
              >
                <Text style={[styles.checkboxText, { color: showTransferListedOnly ? '#FFFFFF' : colors.text }]}>
                  Transfer Listed Only
                </Text>
              </TouchableOpacity>
            </View>

            {/* Team Picker */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Team</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowTeamPicker(true)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.text }]} numberOfLines={1}>
                  {selectedTeamName}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Nationality Picker */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Nationality</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowNationalityPicker(true)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.text }]} numberOfLines={1}>
                  {selectedNationalityName}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Age Range */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Age</Text>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  value={minAge}
                  onChangeText={setMinAge}
                  keyboardType="number-pad"
                />
                <Text style={[styles.rangeSeparator, { color: colors.textMuted }]}>to</Text>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  value={maxAge}
                  onChangeText={setMaxAge}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Height Range */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Height (in)</Text>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  value={minHeight}
                  onChangeText={setMinHeight}
                  keyboardType="number-pad"
                />
                <Text style={[styles.rangeSeparator, { color: colors.textMuted }]}>to</Text>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  value={maxHeight}
                  onChangeText={setMaxHeight}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Weight Range */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Weight (lbs)</Text>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  value={minWeight}
                  onChangeText={setMinWeight}
                  keyboardType="number-pad"
                />
                <Text style={[styles.rangeSeparator, { color: colors.textMuted }]}>to</Text>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  value={maxWeight}
                  onChangeText={setMaxWeight}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Overall Range */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Overall</Text>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  value={minOverall}
                  onChangeText={setMinOverall}
                  keyboardType="number-pad"
                />
                <Text style={[styles.rangeSeparator, { color: colors.textMuted }]}>to</Text>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  value={maxOverall}
                  onChangeText={setMaxOverall}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Salary Range (in millions) */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Salary ($M)</Text>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  value={minSalary}
                  onChangeText={setMinSalary}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.rangeSeparator, { color: colors.textMuted }]}>to</Text>
                <TextInput
                  style={[styles.rangeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  value={maxSalary}
                  onChangeText={setMaxSalary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Attribute Filters */}
            <View style={styles.attributeFiltersSection}>
              <Text style={[styles.filterLabel, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Attribute Filters
              </Text>
              {attributeFilters.map((filter, index) => (
                <View key={index} style={styles.attributeFilterRow}>
                  <TouchableOpacity
                    style={[styles.attributeSelect, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setEditingAttributeIndex(index);
                      setShowAttributePicker(true);
                    }}
                  >
                    <Text style={[styles.attributeSelectText, { color: colors.text }]} numberOfLines={1}>
                      {ATTRIBUTE_OPTIONS.find((a) => a.key === filter.attribute)?.label || filter.attribute}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.operatorContainer}>
                    {(['>=', '<=', '='] as ComparisonOperator[]).map((op) => (
                      <TouchableOpacity
                        key={op}
                        style={[
                          styles.operatorButton,
                          {
                            backgroundColor: filter.operator === op ? colors.primary : colors.surface,
                            borderColor: filter.operator === op ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => updateAttributeFilter(index, { operator: op })}
                      >
                        <Text
                          style={[
                            styles.operatorText,
                            { color: filter.operator === op ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {op}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.attributeValueInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={filter.value.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) {
                        updateAttributeFilter(index, { value: Math.min(100, Math.max(1, num)) });
                      } else if (text === '') {
                        updateAttributeFilter(index, { value: 0 });
                      }
                    }}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[styles.removeFilterButton, { backgroundColor: colors.error }]}
                    onPress={() => removeAttributeFilter(index)}
                  >
                    <Text style={styles.removeFilterText}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addFilterButton, { borderColor: colors.primary }]}
                onPress={addAttributeFilter}
              >
                <Text style={[styles.addFilterText, { color: colors.primary }]}>+ Add Attribute Filter</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* Results Header with Sort */}
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
            {sortedPlayers.length} player{sortedPlayers.length !== 1 ? 's' : ''} found
          </Text>
          <View style={styles.sortContainer}>
            <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort:</Text>
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowSortPicker(true)}
            >
              <Text style={[styles.sortButtonText, { color: colors.text }]}>
                {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortDirectionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setSortAscending(!sortAscending)}
            >
              <Text style={[styles.sortDirectionText, { color: colors.text }]}>
                {sortAscending ? '↑' : '↓'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Player List */}
        <FlatList
          data={sortedPlayers}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No players match your search
              </Text>
            </View>
          }
        />

        {/* Team Picker Modal - only render when needed to avoid nested modal touch issues */}
        {showTeamPicker && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setShowTeamPicker(false)}>
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowTeamPicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Team</Text>
              <ScrollView style={styles.pickerList}>
                {teamOptions.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      selectedTeamId === team.id && { backgroundColor: colors.surface },
                    ]}
                    onPress={() => {
                      setSelectedTeamId(team.id);
                      setShowTeamPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{team.name}</Text>
                    {selectedTeamId === team.id && (
                      <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
        )}

        {/* Nationality Picker Modal - only render when needed */}
        {showNationalityPicker && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setShowNationalityPicker(false)}>
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowNationalityPicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Nationality</Text>
              <ScrollView style={styles.pickerList}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    selectedNationality === 'all' && { backgroundColor: colors.surface },
                  ]}
                  onPress={() => {
                    setSelectedNationality('all');
                    setShowNationalityPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>All Nationalities</Text>
                  {selectedNationality === 'all' && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
                {nationalities.map((nat) => (
                  <TouchableOpacity
                    key={nat}
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      selectedNationality === nat && { backgroundColor: colors.surface },
                    ]}
                    onPress={() => {
                      setSelectedNationality(nat);
                      setShowNationalityPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{nat}</Text>
                    {selectedNationality === nat && (
                      <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
        )}

        {/* Attribute Picker Modal - only render when needed */}
        {showAttributePicker && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setShowAttributePicker(false)}>
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowAttributePicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Attribute</Text>
              <ScrollView style={styles.pickerList}>
                {ATTRIBUTE_OPTIONS.map((attr) => (
                  <TouchableOpacity
                    key={attr.key}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      if (editingAttributeIndex !== null) {
                        updateAttributeFilter(editingAttributeIndex, { attribute: attr.key });
                      }
                      setShowAttributePicker(false);
                      setEditingAttributeIndex(null);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{attr.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
        )}

        {/* Sort Picker Modal */}
        {showSortPicker && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setShowSortPicker(false)}>
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowSortPicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Sort By</Text>
              <ScrollView style={styles.pickerList}>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      sortBy === option.key && { backgroundColor: colors.surface },
                    ]}
                    onPress={() => {
                      setSortBy(option.key);
                      setShowSortPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{option.label}</Text>
                    {sortBy === option.key && (
                      <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    width: 60,
  },
  closeText: {
    fontSize: 17,
  },
  resetText: {
    fontSize: 14,
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  filterToggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filtersContainer: {
    maxHeight: 350,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkboxButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  checkboxText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 80,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  pickerButtonText: {
    fontSize: 14,
  },
  rangeInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rangeInput: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: 12,
  },
  attributeFiltersSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  attributeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  attributeSelect: {
    flex: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  attributeSelectText: {
    fontSize: 12,
  },
  operatorContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  operatorButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  operatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attributeValueInput: {
    width: 50,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  removeFilterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addFilterButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resultsCount: {
    fontSize: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortLabel: {
    fontSize: 12,
  },
  sortButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 12,
  },
  sortDirectionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  sortDirectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  playerPressable: {
    flex: 1,
    borderRadius: borderRadius.sm,
  },
  playerInfo: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoutingBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: 4,
  },
  scoutingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  overallBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  overallTextSmall: {
    fontSize: 10,
  },
  playerMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  playerTeam: {
    fontSize: 11,
  },
  askingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  askingPriceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  askingPriceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoutButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  scoutButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerModal: {
    width: '100%',
    maxHeight: '70%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 15,
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PlayerSearchModal;
