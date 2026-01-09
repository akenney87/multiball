/**
 * Team Stats Row Component
 *
 * Displays a single team's stats in a leaderboard row.
 * Supports basketball, baseball, and soccer.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import type {
  AggregatedTeamStats,
  AggregatedBaseballTeamStats,
  AggregatedSoccerTeamStats,
} from '../../../systems/statsAggregator';
import type { SportType } from '../../screens/ConnectedStatsScreen';

// Union type for all team stat types
type AnyTeamStats = AggregatedTeamStats | AggregatedBaseballTeamStats | AggregatedSoccerTeamStats;

export interface TeamStatsRowProps {
  rank: number;
  team: AnyTeamStats;
  sortBy: string;
  sport?: SportType;
}

export function TeamStatsRow({ rank, team, sortBy, sport = 'basketball' }: TeamStatsRowProps) {
  const colors = useColors();
  const t = team as any; // Use any for easy property access across types

  // Get the primary stat value based on sort and sport
  const getPrimaryStat = (): { label: string; value: string } => {
    if (sport === 'basketball') {
      // Calculate per-game values for team stats
      const gp = t.gamesPlayed || 1;
      const rebPg = ((t.rebounds || 0) / gp).toFixed(1);
      const astPg = ((t.assists || 0) / gp).toFixed(1);
      const stlPg = ((t.steals || 0) / gp).toFixed(1);
      const blkPg = ((t.blocks || 0) / gp).toFixed(1);
      const toPg = ((t.turnovers || 0) / gp).toFixed(1);

      switch (sortBy) {
        case 'ppg':
        case 'pointsFor':
          return { label: 'PPG', value: t.ppg?.toFixed(1) ?? '0' };
        case 'oppPpg':
        case 'pointsAgainst':
          return { label: 'OPP', value: t.oppPpg?.toFixed(1) ?? '0' };
        case 'rebounds':
          return { label: 'RPG', value: rebPg };
        case 'assists':
          return { label: 'APG', value: astPg };
        case 'steals':
          return { label: 'SPG', value: stlPg };
        case 'blocks':
          return { label: 'BPG', value: blkPg };
        case 'turnovers':
          return { label: 'TPG', value: toPg };
        case 'fgPct':
          return { label: 'FG%', value: `${t.fgPct?.toFixed(1) ?? '0'}%` };
        case 'fg3Pct':
          return { label: '3P%', value: `${t.fg3Pct?.toFixed(1) ?? '0'}%` };
        case 'ftPct':
          return { label: 'FT%', value: `${t.ftPct?.toFixed(1) ?? '0'}%` };
        case 'winPct':
        case 'wins':
          return { label: 'WIN%', value: `${t.winPct?.toFixed(1) ?? '0'}%` };
        default:
          return { label: 'PPG', value: t.ppg?.toFixed(1) ?? '0' };
      }
    }

    if (sport === 'baseball') {
      switch (sortBy) {
        case 'runsPerGame':
          return { label: 'R/G', value: t.runsPerGame?.toFixed(1) ?? '0' };
        case 'runsAgainstPerGame':
          return { label: 'RA/G', value: t.runsAgainstPerGame?.toFixed(1) ?? '0' };
        case 'battingAvg':
          return { label: 'BA', value: t.battingAvg?.toFixed(3)?.slice(1) ?? '.000' };
        case 'era':
          return { label: 'ERA', value: t.era?.toFixed(2) ?? '0.00' };
        case 'winPct':
        case 'wins':
          return { label: 'WIN%', value: `${t.winPct?.toFixed(1) ?? '0'}%` };
        default:
          return { label: 'R/G', value: t.runsPerGame?.toFixed(1) ?? '0' };
      }
    }

    if (sport === 'soccer') {
      switch (sortBy) {
        case 'goalsFor':
          return { label: 'GF', value: t.goalsFor?.toString() ?? '0' };
        case 'goalsAgainst':
          return { label: 'GA', value: t.goalsAgainst?.toString() ?? '0' };
        case 'possession':
          return { label: 'POSS%', value: `${t.possession ?? 50}%` };
        case 'shotsPerGame':
          return { label: 'SH/G', value: t.shotsPerGame?.toFixed(1) ?? '0' };
        case 'winPct':
        case 'wins':
          return { label: 'WIN%', value: `${t.winPct?.toFixed(1) ?? '0'}%` };
        default:
          return { label: 'GF', value: t.goalsFor?.toString() ?? '0' };
      }
    }

    return { label: 'GP', value: t.gamesPlayed?.toString() ?? '0' };
  };

  const primaryStat = getPrimaryStat();

  // Get secondary stats based on sport
  const getSecondaryStats = () => {
    const stats: { label: string; value: string }[] = [];

    if (sport === 'basketball') {
      // Always show PPG (unless sorting by it) and WIN%
      if (!['ppg', 'pointsFor'].includes(sortBy)) {
        stats.push({ label: 'PPG', value: t.ppg?.toFixed(1) ?? '0' });
      }
      if (!['oppPpg', 'pointsAgainst'].includes(sortBy)) {
        stats.push({ label: 'OPP', value: t.oppPpg?.toFixed(1) ?? '0' });
      }
      if (!['winPct', 'wins'].includes(sortBy)) {
        stats.push({ label: 'W%', value: `${t.winPct?.toFixed(0) ?? '0'}` });
      }
    } else if (sport === 'baseball') {
      if (sortBy !== 'runsPerGame') {
        stats.push({ label: 'R/G', value: t.runsPerGame?.toFixed(1) ?? '0' });
      }
      if (sortBy !== 'runsAgainstPerGame') {
        stats.push({ label: 'RA/G', value: t.runsAgainstPerGame?.toFixed(1) ?? '0' });
      }
      stats.push({ label: 'HR', value: t.homeRuns?.toString() ?? '0' });
    } else if (sport === 'soccer') {
      if (sortBy !== 'goalsFor') {
        stats.push({ label: 'GF', value: t.goalsFor?.toString() ?? '0' });
      }
      if (sortBy !== 'goalsAgainst') {
        stats.push({ label: 'GA', value: t.goalsAgainst?.toString() ?? '0' });
      }
      stats.push({ label: 'POSS', value: `${t.possession ?? 50}%` });
    }

    return stats.slice(0, 3);
  };

  const secondaryStats = getSecondaryStats();

  // Rank badge color
  const rankColor =
    rank === 1
      ? '#FFD700'
      : rank === 2
      ? '#C0C0C0'
      : rank === 3
      ? '#CD7F32'
      : colors.textMuted;

  // Record display based on sport (soccer has draws)
  const recordDisplay = sport === 'soccer'
    ? `${t.wins ?? 0}-${t.draws ?? 0}-${t.losses ?? 0}`
    : `${t.wins ?? 0}-${t.losses ?? 0}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Rank */}
      <View style={[styles.rankContainer, { borderRightColor: colors.border }]}>
        <Text style={[styles.rank, { color: rankColor }]}>{rank}</Text>
      </View>

      {/* Team Info */}
      <View style={styles.teamInfo}>
        <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
          {t.teamName}
        </Text>
        <Text style={[styles.record, { color: colors.textMuted }]}>
          {recordDisplay}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        {/* Primary Stat */}
        <View style={styles.primaryStat}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {primaryStat.value}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {primaryStat.label}
          </Text>
        </View>

        {/* Secondary Stats */}
        {secondaryStats.map((stat, index) => (
          <View key={index} style={styles.secondaryStat}>
            <Text style={[styles.secondaryValue, { color: colors.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.secondaryLabel, { color: colors.textMuted }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Games Played */}
      <View style={styles.gamesPlayed}>
        <Text style={[styles.gpValue, { color: colors.textMuted }]}>
          {t.gamesPlayed ?? 0}
        </Text>
        <Text style={[styles.gpLabel, { color: colors.textMuted }]}>GP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    marginRight: spacing.sm,
  },
  rank: {
    fontSize: 16,
    fontWeight: '700',
  },
  teamInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
  },
  record: {
    fontSize: 11,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryStat: {
    alignItems: 'center',
    minWidth: 48,
    marginRight: spacing.sm,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  secondaryStat: {
    alignItems: 'center',
    minWidth: 36,
    marginRight: spacing.xs,
  },
  secondaryValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryLabel: {
    fontSize: 8,
    marginTop: 1,
  },
  gamesPlayed: {
    alignItems: 'center',
    minWidth: 28,
    marginLeft: spacing.xs,
  },
  gpValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  gpLabel: {
    fontSize: 8,
  },
});

export default TeamStatsRow;
