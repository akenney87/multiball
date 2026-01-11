/**
 * Leaderboard Screen
 *
 * Displays manager career rankings:
 * - Multiple categories (First Season, Single Season, 3/5/10 Seasons)
 * - User vs fictional managers
 * - Career stats summary
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import type { ManagerCareer, LeaderboardEntry } from '../../data/types';
import {
  generateLeaderboard,
  type LeaderboardCategory,
} from '../../systems/managerRatingSystem';

interface LeaderboardScreenProps {
  managerCareer: ManagerCareer;
}

interface CategoryTab {
  id: LeaderboardCategory;
  label: string;
  shortLabel: string;
  minSeasons: number;
}

const CATEGORIES: CategoryTab[] = [
  { id: 'first_season', label: 'First Season', shortLabel: '1st', minSeasons: 1 },
  { id: 'single_season', label: 'Best Season', shortLabel: 'Best', minSeasons: 1 },
  { id: 'three_seasons', label: '3 Seasons', shortLabel: '3 Szn', minSeasons: 3 },
  { id: 'five_seasons', label: '5 Seasons', shortLabel: '5 Szn', minSeasons: 5 },
  { id: 'ten_seasons', label: '10 Seasons', shortLabel: '10 Szn', minSeasons: 10 },
];

export function LeaderboardScreen({ managerCareer }: LeaderboardScreenProps) {
  const colors = useColors();
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('first_season');

  // Generate leaderboard for selected category
  const leaderboard = useMemo(
    () => generateLeaderboard(managerCareer, selectedCategory),
    [managerCareer, selectedCategory]
  );

  // Find user's entry and rank
  const userEntry = useMemo(
    () => leaderboard.find((e) => e.isUser),
    [leaderboard]
  );

  // Check if user meets minimum requirement for category
  const categoryInfo = CATEGORIES.find((c) => c.id === selectedCategory);
  const meetsRequirement = managerCareer.seasonsPlayed >= (categoryInfo?.minSeasons || 1);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    careerSummary: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.card,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      ...shadows.sm,
    },
    summaryItem: {
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    categoryTabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    categoryTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
    },
    categoryTabActive: {
      backgroundColor: colors.primary,
    },
    categoryTabDisabled: {
      opacity: 0.5,
    },
    categoryTabText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    categoryTabTextActive: {
      color: colors.textInverse,
    },
    leaderboardContainer: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
    leaderboardHeader: {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRank: {
      width: 40,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    headerName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    headerPoints: {
      width: 60,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'right',
    },
    entryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    entryContainerUser: {
      backgroundColor: colors.primary + '15',
      borderRadius: borderRadius.md,
      marginVertical: spacing.xs,
      borderBottomWidth: 0,
    },
    entryRank: {
      width: 40,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankFirst: {
      backgroundColor: '#FFD700',
    },
    rankSecond: {
      backgroundColor: '#C0C0C0',
    },
    rankThird: {
      backgroundColor: '#CD7F32',
    },
    rankOther: {
      backgroundColor: colors.surface,
    },
    rankText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    rankTextTop: {
      color: '#000',
    },
    entryInfo: {
      flex: 1,
    },
    entryName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    entryNameUser: {
      fontWeight: '700',
      color: colors.primary,
    },
    entryContext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    entryPoints: {
      width: 60,
      alignItems: 'flex-end',
    },
    pointsValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    pointsLabel: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    notQualifiedBanner: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    notQualifiedText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    notQualifiedEmphasis: {
      fontWeight: '600',
      color: colors.text,
    },
    userHighlight: {
      backgroundColor: colors.primary + '10',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    userHighlightLeft: {
      flex: 1,
    },
    userHighlightLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    userHighlightRank: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    userHighlightContext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    userHighlightPoints: {
      alignItems: 'flex-end',
    },
    userHighlightPointsValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    userHighlightPointsLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return styles.rankFirst;
    if (rank === 2) return styles.rankSecond;
    if (rank === 3) return styles.rankThird;
    return styles.rankOther;
  };

  const renderEntry = ({ item }: { item: LeaderboardEntry }) => (
    <View style={[styles.entryContainer, item.isUser && styles.entryContainerUser]}>
      <View style={styles.entryRank}>
        <View style={[styles.rankBadge, getRankBadgeStyle(item.rank)]}>
          <Text style={[styles.rankText, item.rank <= 3 && styles.rankTextTop]}>
            {item.rank}
          </Text>
        </View>
      </View>
      <View style={styles.entryInfo}>
        <Text style={[styles.entryName, item.isUser && styles.entryNameUser]}>
          {item.isUser ? `${item.name} (You)` : item.name}
        </Text>
        {item.context && <Text style={styles.entryContext}>{item.context}</Text>}
      </View>
      <View style={styles.entryPoints}>
        <Text style={styles.pointsValue}>{item.points}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manager Rating</Text>
        <Text style={styles.subtitle}>{managerCareer.name || 'Your Career'}</Text>
      </View>

      {/* Career Summary */}
      <View style={styles.careerSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{managerCareer.seasonsPlayed}</Text>
          <Text style={styles.summaryLabel}>Seasons</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{managerCareer.totalPoints}</Text>
          <Text style={styles.summaryLabel}>Total Points</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{managerCareer.championships}</Text>
          <Text style={styles.summaryLabel}>Championships</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{managerCareer.highestDivision}</Text>
          <Text style={styles.summaryLabel}>Best Division</Text>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      >
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const isLocked = managerCareer.seasonsPlayed < category.minSeasons;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTab,
                isActive && styles.categoryTabActive,
                isLocked && styles.categoryTabDisabled,
              ]}
              onPress={() => !isLocked && setSelectedCategory(category.id)}
              disabled={isLocked}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  isActive && styles.categoryTabTextActive,
                ]}
              >
                {category.label}
                {isLocked && ` (${category.minSeasons})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* User Position Highlight */}
      {userEntry && meetsRequirement && (
        <View style={styles.userHighlight}>
          <View style={styles.userHighlightLeft}>
            <Text style={styles.userHighlightLabel}>Your Rank</Text>
            <Text style={styles.userHighlightRank}>
              #{userEntry.rank} of {leaderboard.length}
            </Text>
            {userEntry.context && (
              <Text style={styles.userHighlightContext}>{userEntry.context}</Text>
            )}
          </View>
          <View style={styles.userHighlightPoints}>
            <Text style={styles.userHighlightPointsValue}>{userEntry.points}</Text>
            <Text style={styles.userHighlightPointsLabel}>points</Text>
          </View>
        </View>
      )}

      {/* Not Qualified Banner */}
      {!meetsRequirement && categoryInfo && (
        <View style={styles.notQualifiedBanner}>
          <Text style={styles.notQualifiedText}>
            Complete{' '}
            <Text style={styles.notQualifiedEmphasis}>
              {categoryInfo.minSeasons - managerCareer.seasonsPlayed} more season
              {categoryInfo.minSeasons - managerCareer.seasonsPlayed !== 1 ? 's' : ''}
            </Text>{' '}
            to qualify for {categoryInfo.label} rankings
          </Text>
        </View>
      )}

      {/* Leaderboard Header */}
      <View style={styles.leaderboardHeader}>
        <Text style={styles.headerRank}>Rank</Text>
        <Text style={styles.headerName}>Manager</Text>
        <Text style={styles.headerPoints}>Points</Text>
      </View>

      {/* Leaderboard List */}
      <FlatList
        data={leaderboard}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        style={styles.leaderboardContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

export default LeaderboardScreen;
