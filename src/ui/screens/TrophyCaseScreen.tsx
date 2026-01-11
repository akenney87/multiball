/**
 * Trophy Case Screen
 *
 * Displays the user's achievements:
 * - Championship trophies
 * - Promotion trophies
 * - Player awards (MVP, All-Star, etc.)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import type { TrophyRecord, PlayerAwardRecord } from '../../data/types';

interface TrophyCaseScreenProps {
  trophies: TrophyRecord[];
  playerAwards: PlayerAwardRecord[];
  teamName: string;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th');
}

export function TrophyCaseScreen({
  trophies,
  playerAwards,
  teamName,
}: TrophyCaseScreenProps) {
  const colors = useColors();

  // Separate trophies by type
  const championships = useMemo(
    () => trophies.filter((t) => t.type === 'championship').sort((a, b) => b.seasonNumber - a.seasonNumber),
    [trophies]
  );

  const promotions = useMemo(
    () => trophies.filter((t) => t.type === 'promotion').sort((a, b) => b.seasonNumber - a.seasonNumber),
    [trophies]
  );

  // Group player awards by season
  const awardsBySeason = useMemo(() => {
    const grouped: Record<number, PlayerAwardRecord[]> = {};
    for (const award of playerAwards) {
      const seasonNum = award.seasonNumber;
      if (!grouped[seasonNum]) {
        grouped[seasonNum] = [];
      }
      grouped[seasonNum].push(award);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([season, awards]) => ({ season: Number(season), awards }));
  }, [playerAwards]);

  const hasTrophies = trophies.length > 0 || playerAwards.length > 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    header: {
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl * 2,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionIcon: {
      fontSize: 24,
      marginRight: spacing.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    sectionCount: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: spacing.xs,
    },
    trophyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -spacing.xs,
    },
    trophyCard: {
      width: '48%',
      marginHorizontal: '1%',
      marginBottom: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.md,
    },
    championshipCard: {
      borderWidth: 2,
      borderColor: '#FFD700',
    },
    promotionCard: {
      borderWidth: 1,
      borderColor: colors.success,
    },
    trophyEmoji: {
      fontSize: 40,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    trophyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    trophyDivision: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    trophySeason: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    trophyRecord: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    awardCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      ...shadows.sm,
    },
    awardIcon: {
      fontSize: 32,
      marginRight: spacing.md,
    },
    awardContent: {
      flex: 1,
    },
    awardType: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    awardPlayer: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      marginTop: spacing.xs,
    },
    awardDetails: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    seasonHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });

  // Get award emoji based on type
  const getAwardEmoji = (awardType: string): string => {
    switch (awardType) {
      case 'playerOfTheYear':
        return '\u{1F3C6}'; // Trophy
      case 'playerOfTheMonth':
        return '\u{2B50}'; // Star
      case 'playerOfTheWeek':
        return '\u{1F3C5}'; // Medal
      default:
        return '\u{1F3C5}'; // Medal
    }
  };

  // Get readable award name
  const getAwardName = (awardType: string): string => {
    switch (awardType) {
      case 'playerOfTheYear':
        return 'Player of the Year';
      case 'playerOfTheMonth':
        return 'Player of the Month';
      case 'playerOfTheWeek':
        return 'Player of the Week';
      default:
        return awardType.replace(/([A-Z])/g, ' $1').trim();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Trophy Case</Text>
        <Text style={styles.subtitle}>{teamName}</Text>
      </View>

      {!hasTrophies ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F3C6}'}</Text>
          <Text style={styles.emptyTitle}>No Trophies Yet</Text>
          <Text style={styles.emptyText}>
            Win championships and earn promotions to fill your trophy case. Your achievements will be displayed here.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{championships.length}</Text>
              <Text style={styles.statLabel}>Championships</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{promotions.length}</Text>
              <Text style={styles.statLabel}>Promotions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{playerAwards.length}</Text>
              <Text style={styles.statLabel}>Player Awards</Text>
            </View>
          </View>

          {/* Championships Section */}
          {championships.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{'\u{1F3C6}'}</Text>
                <Text style={styles.sectionTitle}>Championships</Text>
                <Text style={styles.sectionCount}>({championships.length})</Text>
              </View>
              <View style={styles.trophyGrid}>
                {championships.map((trophy, index) => (
                  <View key={`champ-${index}`} style={[styles.trophyCard, styles.championshipCard]}>
                    <Text style={styles.trophyEmoji}>{'\u{1F3C6}'}</Text>
                    <Text style={styles.trophyTitle}>CHAMPION</Text>
                    <Text style={styles.trophyDivision}>Division {trophy.division}</Text>
                    <Text style={styles.trophySeason}>Season {trophy.seasonNumber}</Text>
                    <Text style={styles.trophyRecord}>
                      {trophy.record.wins}-{trophy.record.losses}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Promotions Section */}
          {promotions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{'\u{2B06}'}</Text>
                <Text style={styles.sectionTitle}>Promotions</Text>
                <Text style={styles.sectionCount}>({promotions.length})</Text>
              </View>
              <View style={styles.trophyGrid}>
                {promotions.map((trophy, index) => (
                  <View key={`promo-${index}`} style={[styles.trophyCard, styles.promotionCard]}>
                    <Text style={styles.trophyEmoji}>{'\u{2B06}'}</Text>
                    <Text style={styles.trophyTitle}>PROMOTED</Text>
                    <Text style={styles.trophyDivision}>From Division {trophy.division}</Text>
                    <Text style={styles.trophySeason}>Season {trophy.seasonNumber}</Text>
                    <Text style={styles.trophyRecord}>
                      {getOrdinal(Math.min(3, trophy.record.wins > trophy.record.losses ? 2 : 3))} Place
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Player Awards Section */}
          {awardsBySeason.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{'\u{1F3C5}'}</Text>
                <Text style={styles.sectionTitle}>Player Awards</Text>
                <Text style={styles.sectionCount}>({playerAwards.length})</Text>
              </View>
              {awardsBySeason.map(({ season, awards }) => (
                <View key={`season-${season}`}>
                  <Text style={styles.seasonHeader}>Season {season}</Text>
                  {awards.map((award, index) => (
                    <View key={`award-${season}-${index}`} style={styles.awardCard}>
                      <Text style={styles.awardIcon}>{getAwardEmoji(award.type)}</Text>
                      <View style={styles.awardContent}>
                        <Text style={styles.awardType}>{getAwardName(award.type)}</Text>
                        <Text style={styles.awardPlayer}>{award.playerName}</Text>
                        <Text style={styles.awardDetails}>
                          {award.sport.charAt(0).toUpperCase() + award.sport.slice(1)}
                          {award.period ? ` - ${award.type === 'playerOfTheMonth' ? 'Month' : 'Week'} ${award.period}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

export default TrophyCaseScreen;
