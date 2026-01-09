/**
 * Connected Roster Screen
 *
 * Roster screen connected to GameContext for real player data.
 * Shows all players with filtering, sorting, and real stats.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../theme';
import { PlayerCard, PlayerCardData } from '../components/roster/PlayerCard';
import { useGame } from '../context/GameContext';
import { calculateAllOveralls } from '../../utils/overallRating';

type SortOption =
  | 'overall'
  | 'basketballOvr'
  | 'baseballOvr'
  | 'soccerOvr'
  | 'age'
  | 'salary'
  | 'name'
  | 'height'
  | 'top_speed'
  | 'core_strength'
  | 'agility'
  | 'stamina'
  | 'awareness';

interface ConnectedRosterScreenProps {
  onPlayerPress?: (playerId: string) => void;
}

// Sort options grouped by category
const SORT_GROUPS: { title: string; options: { key: SortOption; label: string }[] }[] = [
  {
    title: 'Rating',
    options: [
      { key: 'overall', label: 'Overall' },
      { key: 'basketballOvr', label: 'Basketball' },
      { key: 'baseballOvr', label: 'Baseball' },
      { key: 'soccerOvr', label: 'Soccer' },
    ],
  },
  {
    title: 'Info',
    options: [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'salary', label: 'Salary' },
    ],
  },
  {
    title: 'Attributes',
    options: [
      { key: 'height', label: 'Height' },
      { key: 'top_speed', label: 'Speed' },
      { key: 'core_strength', label: 'Strength' },
      { key: 'agility', label: 'Agility' },
      { key: 'stamina', label: 'Stamina' },
      { key: 'awareness', label: 'Awareness' },
    ],
  },
];

// Flat list for lookup
const ALL_SORT_OPTIONS = SORT_GROUPS.flatMap((g) => g.options);

export function ConnectedRosterScreen({ onPlayerPress }: ConnectedRosterScreenProps) {
  const colors = useColors();
  const { state, getUserRoster } = useGame();

  const [sortBy, setSortBy] = useState<SortOption>('overall');
  const [showSortPicker, setShowSortPicker] = useState(false);

  // Get label for current sort
  const currentSortLabel = ALL_SORT_OPTIONS.find((o) => o.key === sortBy)?.label || 'Overall';

  // Convert roster to PlayerCardData format
  const roster = useMemo((): PlayerCardData[] => {
    const players = getUserRoster();

    return players.map((player) => {
      const overalls = calculateAllOveralls(player);
      return {
        id: player.id,
        name: player.name,
        overall: overalls.overall,
        basketballOvr: overalls.basketball,
        baseballOvr: overalls.baseball,
        soccerOvr: overalls.soccer,
        age: player.age,
        salary: player.contract?.salary,
        isInjured: player.injury !== null,
        // Include key attributes for sorting
        height: player.attributes.height,
        top_speed: player.attributes.top_speed,
        core_strength: player.attributes.core_strength,
        agility: player.attributes.agility,
        stamina: player.attributes.stamina,
        awareness: player.attributes.awareness,
      };
    });
  }, [getUserRoster]);

  // Sort roster
  const filteredRoster = useMemo(() => {
    let players = [...roster];

    // Sort
    players.sort((a, b) => {
      switch (sortBy) {
        case 'overall':
          return b.overall - a.overall;
        case 'basketballOvr':
          return (b.basketballOvr || 0) - (a.basketballOvr || 0);
        case 'baseballOvr':
          return (b.baseballOvr || 0) - (a.baseballOvr || 0);
        case 'soccerOvr':
          return (b.soccerOvr || 0) - (a.soccerOvr || 0);
        case 'age':
          return a.age - b.age;
        case 'salary':
          return (b.salary || 0) - (a.salary || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'height':
          return (b.height || 0) - (a.height || 0);
        case 'top_speed':
          return (b.top_speed || 0) - (a.top_speed || 0);
        case 'core_strength':
          return (b.core_strength || 0) - (a.core_strength || 0);
        case 'agility':
          return (b.agility || 0) - (a.agility || 0);
        case 'stamina':
          return (b.stamina || 0) - (a.stamina || 0);
        case 'awareness':
          return (b.awareness || 0) - (a.awareness || 0);
        default:
          return 0;
      }
    });

    return players;
  }, [roster, sortBy]);

  // Stats
  const injuredCount = roster.filter((p) => p.isInjured).length;
  const avgOverall = roster.length > 0
    ? Math.round(roster.reduce((sum, p) => sum + p.overall, 0) / roster.length)
    : 0;
  const avgAge = roster.length > 0
    ? (roster.reduce((sum, p) => sum + p.age, 0) / roster.length).toFixed(1)
    : 0;

  // Handle player press
  const handlePlayerPress = useCallback(
    (player: PlayerCardData) => {
      onPlayerPress?.(player.id);
    },
    [onPlayerPress]
  );

  const renderPlayer = ({ item }: { item: PlayerCardData }) => (
    <View style={styles.playerItem}>
      <PlayerCard
        player={item}
        showSalary
        onPress={handlePlayerPress}
      />
    </View>
  );

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading roster...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.card }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {roster.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Players</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {avgOverall}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg OVR</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {avgAge}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Age</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: injuredCount > 0 ? colors.error : colors.text }]}>
            {injuredCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Injured</Text>
        </View>
      </View>

      {/* Sort Dropdown Trigger */}
      <View style={styles.sortWrapper}>
        <TouchableOpacity
          style={[styles.sortDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowSortPicker(true)}
        >
          <Text style={[styles.sortDropdownLabel, { color: colors.textMuted }]}>Sort by</Text>
          <View style={styles.sortDropdownValue}>
            <Text style={[styles.sortDropdownText, { color: colors.text }]}>
              {currentSortLabel}
            </Text>
            <Text style={[styles.sortDropdownArrow, { color: colors.textMuted }]}>▼</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sort Picker Modal */}
      <Modal
        visible={showSortPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSortPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortPicker(false)}
        >
          <View style={[styles.sortPickerContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.sortPickerTitle, { color: colors.text }]}>Sort Players By</Text>

            {SORT_GROUPS.map((group) => (
              <View key={group.title} style={styles.sortGroup}>
                <Text style={[styles.sortGroupTitle, { color: colors.textMuted }]}>
                  {group.title.toUpperCase()}
                </Text>
                <View style={styles.sortGroupOptions}>
                  {group.options.map((option) => {
                    const isSelected = sortBy === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.sortOption,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setSortBy(option.key);
                          setShowSortPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.sortOptionText,
                            { color: isSelected ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.sortPickerClose, { borderColor: colors.border }]}
              onPress={() => setShowSortPicker(false)}
            >
              <Text style={[styles.sortPickerCloseText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Player List */}
      <FlatList
        data={filteredRoster}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No players found
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  sortDropdownLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  sortDropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortDropdownText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortDropdownArrow: {
    fontSize: 10,
  },
  // Sort Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sortPickerContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sortPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sortGroup: {
    marginBottom: spacing.md,
  },
  sortGroupTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sortGroupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sortPickerClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  sortPickerCloseText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  playerItem: {
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ConnectedRosterScreen;
