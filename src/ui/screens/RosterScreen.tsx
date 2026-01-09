/**
 * Roster Screen
 *
 * Displays team roster with:
 * - Position filters
 * - Sort options
 * - Player cards list
 * - Starter indicators
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../theme';
import { PlayerCard, PlayerCardData } from '../components/roster/PlayerCard';

type SortOption = 'overall' | 'age' | 'salary' | 'name';

interface RosterScreenProps {
  onPlayerPress?: (player: PlayerCardData) => void;
}

// Mock roster data - will be replaced with real data from context
const mockRoster: PlayerCardData[] = [
  { id: '1', name: 'John Smith', overall: 82, age: 25, salary: 2500000 },
  { id: '2', name: 'Mike Johnson', overall: 78, age: 27, salary: 1800000 },
  { id: '3', name: 'Chris Williams', overall: 75, age: 24, salary: 1500000 },
  { id: '4', name: 'David Brown', overall: 72, age: 28, salary: 1200000 },
  { id: '5', name: 'James Davis', overall: 70, age: 26, salary: 1000000 },
  { id: '6', name: 'Robert Wilson', overall: 68, age: 23, salary: 800000 },
  { id: '7', name: 'William Taylor', overall: 65, age: 22, salary: 600000, isInjured: true },
  { id: '8', name: 'Daniel Anderson', overall: 62, age: 21, salary: 500000 },
];

export function RosterScreen({ onPlayerPress }: RosterScreenProps) {
  const colors = useColors();
  const [sortBy, setSortBy] = useState<SortOption>('overall');

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'overall', label: 'OVR' },
    { key: 'age', label: 'Age' },
    { key: 'salary', label: 'Salary' },
    { key: 'name', label: 'Name' },
  ];

  const filteredRoster = useMemo(() => {
    let players = [...mockRoster];

    // Sort
    players.sort((a, b) => {
      switch (sortBy) {
        case 'overall':
          return b.overall - a.overall;
        case 'age':
          return a.age - b.age;
        case 'salary':
          return (b.salary || 0) - (a.salary || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return players;
  }, [sortBy]);

  const injuredCount = mockRoster.filter((p) => p.isInjured).length;
  const avgAge = (mockRoster.reduce((sum, p) => sum + p.age, 0) / mockRoster.length).toFixed(1);

  const renderPlayer = ({ item }: { item: PlayerCardData }) => (
    <View style={styles.playerItem}>
      <PlayerCard
        player={item}
        showSalary
        onPress={onPlayerPress}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.card }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {mockRoster.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Players</Text>
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

      {/* Position Filter */}
      <View style={styles.filterContainer}>
        {positions.map((pos) => (
          <TouchableOpacity
            key={pos}
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  selectedPosition === pos ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setSelectedPosition(pos)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: selectedPosition === pos ? colors.textInverse : colors.text,
                },
              ]}
            >
              {pos}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by:</Text>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortButton,
              sortBy === option.key && { borderBottomColor: colors.primary },
            ]}
            onPress={() => setSortBy(option.key)}
          >
            <Text
              style={[
                styles.sortText,
                {
                  color: sortBy === option.key ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player List */}
      <FlatList
        data={filteredRoster}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  sortLabel: {
    fontSize: 12,
  },
  sortButton: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  playerItem: {
    marginBottom: spacing.sm,
  },
});

export default RosterScreen;
