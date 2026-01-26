/**
 * Youth League Stats Card Component
 *
 * Displays youth league performance stats with tabs for each sport.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {
  useColors,
  spacing,
  borderRadius,
  textStyles,
} from '../../theme';
import {
  type YouthLeagueStats,
  type YouthBasketballStats,
  type YouthBaseballStats,
  type YouthSoccerStats,
} from '../../../systems/youthAcademySystem';

type Sport = 'basketball' | 'baseball' | 'soccer';

interface YouthLeagueStatsCardProps {
  stats: YouthLeagueStats;
  style?: ViewStyle;
}

const SPORT_TABS: { key: Sport; label: string; abbr: string }[] = [
  { key: 'basketball', label: 'Basketball', abbr: 'BBL' },
  { key: 'baseball', label: 'Baseball', abbr: 'BSB' },
  { key: 'soccer', label: 'Soccer', abbr: 'SOC' },
];

export function YouthLeagueStatsCard({ stats, style }: YouthLeagueStatsCardProps) {
  const colors = useColors();
  const [selectedSport, setSelectedSport] = useState<Sport>('basketball');

  const sportStats = stats[selectedSport];
  const gamesPlayed = sportStats.gamesPlayed ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          YOUTH LEAGUE
        </Text>
        <Text style={[styles.season, { color: colors.textMuted }]}>
          Season {stats.season}
        </Text>
      </View>

      {/* Sport Tabs */}
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {SPORT_TABS.map((tab) => {
          const isSelected = tab.key === selectedSport;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isSelected && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={() => setSelectedSport(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isSelected ? colors.primary : colors.textMuted },
                ]}
              >
                {tab.abbr}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats Display */}
      <View style={styles.statsContainer}>
        {gamesPlayed === 0 ? (
          <Text style={[styles.noStats, { color: colors.textMuted }]}>
            No games played yet
          </Text>
        ) : (
          <>
            {selectedSport === 'basketball' && (
              <BasketballStats stats={stats.basketball} colors={colors} />
            )}
            {selectedSport === 'baseball' && (
              <BaseballStats stats={stats.baseball} colors={colors} />
            )}
            {selectedSport === 'soccer' && (
              <SoccerStats stats={stats.soccer} colors={colors} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function BasketballStats({
  stats,
  colors,
}: {
  stats: YouthBasketballStats;
  colors: ReturnType<typeof useColors>;
}) {
  const gp = stats.gamesPlayed || 1;
  return (
    <View style={styles.statsGrid}>
      <StatItem label="GP" value={stats.gamesPlayed} colors={colors} />
      <StatItem
        label="PPG"
        value={(stats.points / gp).toFixed(1)}
        colors={colors}
      />
      <StatItem
        label="RPG"
        value={(stats.rebounds / gp).toFixed(1)}
        colors={colors}
      />
      <StatItem
        label="APG"
        value={(stats.assists / gp).toFixed(1)}
        colors={colors}
      />
      <StatItem
        label="SPG"
        value={(stats.steals / gp).toFixed(1)}
        colors={colors}
      />
      <StatItem
        label="BPG"
        value={(stats.blocks / gp).toFixed(1)}
        colors={colors}
      />
    </View>
  );
}

function BaseballStats({
  stats,
  colors,
}: {
  stats: YouthBaseballStats;
  colors: ReturnType<typeof useColors>;
}) {
  const avg = stats.atBats > 0 ? (stats.hits / stats.atBats) : 0;
  return (
    <View style={styles.statsGrid}>
      <StatItem label="GP" value={stats.gamesPlayed} colors={colors} />
      <StatItem label="AB" value={stats.atBats} colors={colors} />
      <StatItem label="H" value={stats.hits} colors={colors} />
      <StatItem label="AVG" value={avg.toFixed(3).slice(1)} colors={colors} />
      <StatItem label="HR" value={stats.homeRuns} colors={colors} />
      <StatItem label="RBI" value={stats.rbi} colors={colors} />
    </View>
  );
}

function SoccerStats({
  stats,
  colors,
}: {
  stats: YouthSoccerStats;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statsGrid}>
      <StatItem label="GP" value={stats.gamesPlayed} colors={colors} />
      <StatItem label="G" value={stats.goals} colors={colors} />
      <StatItem label="A" value={stats.assists} colors={colors} />
      <StatItem label="MIN" value={stats.minutesPlayed} colors={colors} />
      <StatItem label="YC" value={stats.yellowCards} colors={colors} />
      <StatItem label="RC" value={stats.redCards} colors={colors} />
    </View>
  );
}

function StatItem({
  label,
  value,
  colors,
}: {
  label: string;
  value: string | number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...textStyles.labelSmall,
  },
  season: {
    fontSize: 11,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statsContainer: {
    minHeight: 50,
  },
  noStats: {
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: 12,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

export default YouthLeagueStatsCard;
