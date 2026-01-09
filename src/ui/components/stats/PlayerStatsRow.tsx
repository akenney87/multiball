/**
 * Player Stats Row Component
 *
 * Displays a single player's stats in a leaderboard row.
 * Supports basketball, baseball (batting/pitching), and soccer (outfield/goalkeeper).
 * Tappable to open player details.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import type {
  AggregatedPlayerStats,
  AggregatedBaseballBattingStats,
  AggregatedBaseballPitchingStats,
  AggregatedSoccerPlayerStats,
  AggregatedSoccerGoalkeeperStats,
} from '../../../systems/statsAggregator';
import type { SportType, BaseballStatType, SoccerStatType } from '../../screens/ConnectedStatsScreen';

// Union type for all player stat types
type AnyPlayerStats =
  | AggregatedPlayerStats
  | AggregatedBaseballBattingStats
  | AggregatedBaseballPitchingStats
  | AggregatedSoccerPlayerStats
  | AggregatedSoccerGoalkeeperStats;

export interface PlayerStatsRowProps {
  rank: number;
  player: AnyPlayerStats;
  viewMode: 'totals' | 'pergame';
  sortBy: string;
  onPress: () => void;
  sport?: SportType;
  baseballStatType?: BaseballStatType;
  soccerStatType?: SoccerStatType;
}

export function PlayerStatsRow({
  rank,
  player,
  viewMode,
  sortBy,
  onPress,
  sport = 'basketball',
  baseballStatType = 'batting',
  soccerStatType = 'outfield',
}: PlayerStatsRowProps) {
  const colors = useColors();

  // Type guard helpers
  const p = player as any; // Use any for easy property access across types

  // Get the primary stat value based on sort and sport
  const getPrimaryStat = (): { label: string; value: string } => {
    // Basketball stats
    if (sport === 'basketball') {
      const isAvg = viewMode === 'pergame';
      switch (sortBy) {
        case 'eff':
          return { label: 'EFF', value: p.eff?.toFixed(1) ?? '0' };
        case 'points':
        case 'ppg':
          return { label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' };
        case 'rebounds':
        case 'rpg':
          return { label: isAvg ? 'RPG' : 'REB', value: isAvg ? p.rpg?.toFixed(1) ?? '0' : p.rebounds?.toString() ?? '0' };
        case 'assists':
        case 'apg':
          return { label: isAvg ? 'APG' : 'AST', value: isAvg ? p.apg?.toFixed(1) ?? '0' : p.assists?.toString() ?? '0' };
        case 'steals':
        case 'spg':
          return { label: isAvg ? 'SPG' : 'STL', value: isAvg ? p.spg?.toFixed(1) ?? '0' : p.steals?.toString() ?? '0' };
        case 'blocks':
        case 'bpg':
          return { label: isAvg ? 'BPG' : 'BLK', value: isAvg ? p.bpg?.toFixed(1) ?? '0' : p.blocks?.toString() ?? '0' };
        case 'turnovers':
        case 'tpg':
          return { label: isAvg ? 'TPG' : 'TO', value: isAvg ? p.tpg?.toFixed(1) ?? '0' : p.turnovers?.toString() ?? '0' };
        case 'fgPct':
          return { label: 'FG%', value: `${p.fgPct?.toFixed(1) ?? '0'}%` };
        case 'fg3Pct':
          return { label: '3P%', value: `${p.fg3Pct?.toFixed(1) ?? '0'}%` };
        case 'ftPct':
          return { label: 'FT%', value: `${p.ftPct?.toFixed(1) ?? '0'}%` };
        case 'minutesPlayed':
        case 'mpg':
          return { label: isAvg ? 'MPG' : 'MIN', value: isAvg ? p.mpg?.toFixed(1) ?? '0' : p.minutesPlayed?.toFixed(0) ?? '0' };
        default:
          return { label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' };
      }
    }

    // Baseball batting stats
    if (sport === 'baseball' && baseballStatType === 'batting') {
      switch (sortBy) {
        case 'rc27':
          return { label: 'RC27', value: p.rc27?.toFixed(1) ?? '0' };
        case 'battingAvg':
          return { label: 'AVG', value: p.battingAvg?.toFixed(3)?.slice(1) ?? '.000' };
        case 'obp':
          return { label: 'OBP', value: p.obp?.toFixed(3)?.slice(1) ?? '.000' };
        case 'slg':
          return { label: 'SLG', value: p.slg?.toFixed(3)?.slice(1) ?? '.000' };
        case 'ops':
          return { label: 'OPS', value: p.ops?.toFixed(3)?.slice(1) ?? '.000' };
        case 'hits':
          return { label: 'H', value: p.hits?.toString() ?? '0' };
        case 'homeRuns':
          return { label: 'HR', value: p.homeRuns?.toString() ?? '0' };
        case 'rbi':
          return { label: 'RBI', value: p.rbi?.toString() ?? '0' };
        case 'runs':
          return { label: 'R', value: p.runs?.toString() ?? '0' };
        case 'stolenBases':
          return { label: 'SB', value: p.stolenBases?.toString() ?? '0' };
        default:
          return { label: 'AVG', value: p.battingAvg?.toFixed(3)?.slice(1) ?? '.000' };
      }
    }

    // Baseball pitching stats
    if (sport === 'baseball' && baseballStatType === 'pitching') {
      switch (sortBy) {
        case 'fip':
          return { label: 'FIP', value: p.fip?.toFixed(2) ?? '0.00' };
        case 'wins':
          return { label: 'W', value: p.wins?.toString() ?? '0' };
        case 'era':
          return { label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' };
        case 'inningsPitched':
          return { label: 'IP', value: p.inningsPitched?.toFixed(1) ?? '0.0' };
        case 'strikeouts':
          return { label: 'SO', value: p.strikeouts?.toString() ?? '0' };
        case 'saves':
          return { label: 'SV', value: p.saves?.toString() ?? '0' };
        case 'whip':
          return { label: 'WHIP', value: p.whip?.toFixed(2) ?? '0.00' };
        case 'k9':
          return { label: 'K/9', value: p.k9?.toFixed(1) ?? '0.0' };
        default:
          return { label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' };
      }
    }

    // Soccer outfield stats
    if (sport === 'soccer' && soccerStatType === 'outfield') {
      const isAvg = viewMode === 'pergame';
      switch (sortBy) {
        case 'plusMinusPer90':
          const outfieldPM = p.plusMinusPer90 ?? 0;
          return { label: '+/-', value: `${outfieldPM > 0 ? '+' : ''}${outfieldPM.toFixed(1)}` };
        case 'rating':
          const outfieldRating = p.rating ?? 0;
          return { label: 'Rel+/-', value: `${outfieldRating > 0 ? '+' : ''}${outfieldRating.toFixed(1)}` };
        case 'goals':
          return { label: isAvg ? 'G/G' : 'G', value: isAvg ? p.goalsPerGame?.toFixed(1) ?? '0' : p.goals?.toString() ?? '0' };
        case 'assists':
          return { label: isAvg ? 'A/G' : 'A', value: isAvg ? p.assistsPerGame?.toFixed(1) ?? '0' : p.assists?.toString() ?? '0' };
        case 'shots':
          return { label: 'SH', value: p.shots?.toString() ?? '0' };
        case 'shotsOnTarget':
          return { label: 'SOT', value: p.shotsOnTarget?.toString() ?? '0' };
        case 'shotAccuracy':
          return { label: 'ACC%', value: `${p.shotAccuracy?.toFixed(1) ?? '0'}%` };
        case 'minutesPlayed':
          return { label: 'MIN', value: p.minutesPlayed?.toString() ?? '0' };
        default:
          return { label: isAvg ? 'G/G' : 'G', value: isAvg ? p.goalsPerGame?.toFixed(1) ?? '0' : p.goals?.toString() ?? '0' };
      }
    }

    // Soccer goalkeeper stats
    if (sport === 'soccer' && soccerStatType === 'goalkeeper') {
      const isAvg = viewMode === 'pergame';
      switch (sortBy) {
        case 'plusMinusPer90':
          const gkPM = p.plusMinusPer90 ?? 0;
          return { label: '+/-', value: `${gkPM > 0 ? '+' : ''}${gkPM.toFixed(1)}` };
        case 'rating':
          const gkRating = p.rating ?? 0;
          return { label: 'Rel+/-', value: `${gkRating > 0 ? '+' : ''}${gkRating.toFixed(1)}` };
        case 'saves':
          return { label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' };
        case 'cleanSheets':
          return { label: 'CS', value: p.cleanSheets?.toString() ?? '0' };
        case 'goalsAgainst':
          return { label: isAvg ? 'GA/G' : 'GA', value: isAvg ? p.goalsAgainstPerGame?.toFixed(1) ?? '0' : p.goalsAgainst?.toString() ?? '0' };
        case 'savePercentage':
          return { label: 'SV%', value: `${p.savePercentage?.toFixed(1) ?? '0'}%` };
        default:
          return { label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' };
      }
    }

    return { label: 'GP', value: p.gamesPlayed?.toString() ?? '0' };
  };

  const primaryStat = getPrimaryStat();

  // Secondary stats contextual to sort selection
  const getSecondaryStats = () => {
    const stats: { label: string; value: string }[] = [];
    const isAvg = viewMode === 'pergame';

    if (sport === 'basketball') {
      // Show contextually relevant stats based on what we're sorting by
      switch (sortBy) {
        case 'points':
        case 'ppg':
          // Scoring: show efficiency
          stats.push({ label: 'FG%', value: `${p.fgPct?.toFixed(1) ?? '0'}%` });
          stats.push({ label: '3P%', value: `${p.fg3Pct?.toFixed(1) ?? '0'}%` });
          break;
        case 'rebounds':
        case 'rpg':
          // Rebounding: show points for context
          stats.push({ label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'BPG' : 'BLK', value: isAvg ? p.bpg?.toFixed(1) ?? '0' : p.blocks?.toString() ?? '0' });
          break;
        case 'assists':
        case 'apg':
          // Playmaking: show points and steals
          stats.push({ label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'SPG' : 'STL', value: isAvg ? p.spg?.toFixed(1) ?? '0' : p.steals?.toString() ?? '0' });
          break;
        case 'steals':
        case 'spg':
          // Defense: show blocks and rebounds
          stats.push({ label: isAvg ? 'BPG' : 'BLK', value: isAvg ? p.bpg?.toFixed(1) ?? '0' : p.blocks?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'RPG' : 'REB', value: isAvg ? p.rpg?.toFixed(1) ?? '0' : p.rebounds?.toString() ?? '0' });
          break;
        case 'blocks':
        case 'bpg':
          // Shot blocking: show steals and rebounds
          stats.push({ label: isAvg ? 'SPG' : 'STL', value: isAvg ? p.spg?.toFixed(1) ?? '0' : p.steals?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'RPG' : 'REB', value: isAvg ? p.rpg?.toFixed(1) ?? '0' : p.rebounds?.toString() ?? '0' });
          break;
        case 'fgPct':
        case 'fg3Pct':
        case 'ftPct':
          // Efficiency: show points and attempts context
          stats.push({ label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' });
          stats.push({ label: 'FG%', value: `${p.fgPct?.toFixed(1) ?? '0'}%` });
          break;
        case 'minutesPlayed':
        case 'mpg':
          // Playing time: show main production stats
          stats.push({ label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'RPG' : 'REB', value: isAvg ? p.rpg?.toFixed(1) ?? '0' : p.rebounds?.toString() ?? '0' });
          break;
        default:
          // Default: points and rebounds
          stats.push({ label: isAvg ? 'PPG' : 'PTS', value: isAvg ? p.ppg?.toFixed(1) ?? '0' : p.points?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'RPG' : 'REB', value: isAvg ? p.rpg?.toFixed(1) ?? '0' : p.rebounds?.toString() ?? '0' });
      }
    } else if (sport === 'baseball' && baseballStatType === 'batting') {
      // Contextual batting stats
      switch (sortBy) {
        case 'battingAvg':
          stats.push({ label: 'H', value: p.hits?.toString() ?? '0' });
          stats.push({ label: 'RBI', value: p.rbi?.toString() ?? '0' });
          break;
        case 'hits':
          stats.push({ label: 'AVG', value: p.battingAvg?.toFixed(3)?.slice(1) ?? '.000' });
          stats.push({ label: 'RBI', value: p.rbi?.toString() ?? '0' });
          break;
        case 'homeRuns':
          stats.push({ label: 'RBI', value: p.rbi?.toString() ?? '0' });
          stats.push({ label: 'R', value: p.runs?.toString() ?? '0' });
          break;
        case 'rbi':
          stats.push({ label: 'HR', value: p.homeRuns?.toString() ?? '0' });
          stats.push({ label: 'H', value: p.hits?.toString() ?? '0' });
          break;
        case 'runs':
          stats.push({ label: 'H', value: p.hits?.toString() ?? '0' });
          stats.push({ label: 'SB', value: p.stolenBases?.toString() ?? '0' });
          break;
        case 'stolenBases':
          stats.push({ label: 'H', value: p.hits?.toString() ?? '0' });
          stats.push({ label: 'R', value: p.runs?.toString() ?? '0' });
          break;
        default:
          stats.push({ label: 'AVG', value: p.battingAvg?.toFixed(3)?.slice(1) ?? '.000' });
          stats.push({ label: 'RBI', value: p.rbi?.toString() ?? '0' });
      }
    } else if (sport === 'baseball' && baseballStatType === 'pitching') {
      // Contextual pitching stats
      switch (sortBy) {
        case 'wins':
          stats.push({ label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' });
          stats.push({ label: 'SO', value: p.strikeouts?.toString() ?? '0' });
          break;
        case 'era':
          stats.push({ label: 'W-L', value: `${p.wins ?? 0}-${p.losses ?? 0}` });
          stats.push({ label: 'WHIP', value: p.whip?.toFixed(2) ?? '0.00' });
          break;
        case 'strikeouts':
          stats.push({ label: 'IP', value: p.inningsPitched?.toFixed(1) ?? '0.0' });
          stats.push({ label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' });
          break;
        case 'saves':
          stats.push({ label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' });
          stats.push({ label: 'W', value: p.wins?.toString() ?? '0' });
          break;
        default:
          stats.push({ label: 'W-L', value: `${p.wins ?? 0}-${p.losses ?? 0}` });
          stats.push({ label: 'ERA', value: p.era?.toFixed(2) ?? '0.00' });
      }
    } else if (sport === 'soccer' && soccerStatType === 'outfield') {
      // Contextual soccer outfield stats
      switch (sortBy) {
        case 'goals':
          stats.push({ label: isAvg ? 'A/G' : 'A', value: isAvg ? p.assistsPerGame?.toFixed(1) ?? '0' : p.assists?.toString() ?? '0' });
          stats.push({ label: 'SH', value: p.shots?.toString() ?? '0' });
          break;
        case 'assists':
          stats.push({ label: isAvg ? 'G/G' : 'G', value: isAvg ? p.goalsPerGame?.toFixed(1) ?? '0' : p.goals?.toString() ?? '0' });
          stats.push({ label: 'MIN', value: p.minutesPlayed?.toString() ?? '0' });
          break;
        case 'shots':
        case 'shotsOnTarget':
          stats.push({ label: isAvg ? 'G/G' : 'G', value: isAvg ? p.goalsPerGame?.toFixed(1) ?? '0' : p.goals?.toString() ?? '0' });
          stats.push({ label: 'SOT', value: p.shotsOnTarget?.toString() ?? '0' });
          break;
        case 'yellowCards':
        case 'redCards':
          stats.push({ label: 'YC', value: p.yellowCards?.toString() ?? '0' });
          stats.push({ label: 'RC', value: p.redCards?.toString() ?? '0' });
          break;
        default:
          stats.push({ label: isAvg ? 'G/G' : 'G', value: isAvg ? p.goalsPerGame?.toFixed(1) ?? '0' : p.goals?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'A/G' : 'A', value: isAvg ? p.assistsPerGame?.toFixed(1) ?? '0' : p.assists?.toString() ?? '0' });
      }
    } else if (sport === 'soccer' && soccerStatType === 'goalkeeper') {
      // Contextual goalkeeper stats
      switch (sortBy) {
        case 'saves':
          stats.push({ label: 'CS', value: p.cleanSheets?.toString() ?? '0' });
          stats.push({ label: 'SV%', value: `${p.savePercentage?.toFixed(1) ?? '0'}%` });
          break;
        case 'cleanSheets':
          stats.push({ label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'GA/G' : 'GA', value: isAvg ? p.goalsAgainstPerGame?.toFixed(1) ?? '0' : p.goalsAgainst?.toString() ?? '0' });
          break;
        case 'goalsAgainst':
          stats.push({ label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' });
          stats.push({ label: 'CS', value: p.cleanSheets?.toString() ?? '0' });
          break;
        case 'savePercentage':
          stats.push({ label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' });
          stats.push({ label: isAvg ? 'GA/G' : 'GA', value: isAvg ? p.goalsAgainstPerGame?.toFixed(1) ?? '0' : p.goalsAgainst?.toString() ?? '0' });
          break;
        default:
          stats.push({ label: isAvg ? 'SV/G' : 'SV', value: isAvg ? p.savesPerGame?.toFixed(1) ?? '0' : p.saves?.toString() ?? '0' });
          stats.push({ label: 'CS', value: p.cleanSheets?.toString() ?? '0' });
      }
    }

    return stats.slice(0, 2);
  };

  // Secondary stats kept for potential future use but not currently displayed
  // Now using efficiency stats (EFF, RC27, FIP, Rating) instead
  void getSecondaryStats; // Suppress unused warning

  // Rank badge color
  const rankColor =
    rank === 1
      ? '#FFD700'
      : rank === 2
      ? '#C0C0C0'
      : rank === 3
      ? '#CD7F32'
      : colors.textMuted;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Rank */}
      <View style={[styles.rankContainer, { borderRightColor: colors.border }]}>
        <Text style={[styles.rank, { color: rankColor }]}>{rank}</Text>
      </View>

      {/* Player Info */}
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
          {player.playerName}
        </Text>
        <Text style={[styles.teamName, { color: colors.textMuted }]} numberOfLines={1}>
          {player.teamName}
        </Text>
      </View>

      {/* Stats - Simplified layout: Primary, EFF (basketball) or Secondary, GP */}
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

        {/* Efficiency stat for each sport (always shown unless sorting by it) */}
        {/* Basketball: EFF */}
        {sport === 'basketball' && sortBy !== 'eff' && (
          <View style={styles.effStat}>
            <Text style={[styles.effValue, { color: colors.success }]}>
              {p.eff?.toFixed(1) ?? '0'}
            </Text>
            <Text style={[styles.effLabel, { color: colors.textMuted }]}>
              EFF
            </Text>
          </View>
        )}

        {/* Baseball Batting: RC27 */}
        {sport === 'baseball' && baseballStatType === 'batting' && sortBy !== 'rc27' && (
          <View style={styles.effStat}>
            <Text style={[styles.effValue, { color: colors.success }]}>
              {p.rc27?.toFixed(1) ?? '0'}
            </Text>
            <Text style={[styles.effLabel, { color: colors.textMuted }]}>
              RC27
            </Text>
          </View>
        )}

        {/* Baseball Pitching: FIP */}
        {sport === 'baseball' && baseballStatType === 'pitching' && sortBy !== 'fip' && (
          <View style={styles.effStat}>
            <Text style={[styles.effValue, { color: colors.success }]}>
              {p.fip?.toFixed(2) ?? '0'}
            </Text>
            <Text style={[styles.effLabel, { color: colors.textMuted }]}>
              FIP
            </Text>
          </View>
        )}

        {/* Soccer Outfield: Raw +/- (always visible unless sorting by +/- metrics) */}
        {sport === 'soccer' && soccerStatType === 'outfield' && sortBy !== 'rating' && sortBy !== 'plusMinusPer90' && (
          <View style={styles.effStat}>
            <Text style={[styles.effValue, { color: (p.plusMinusPer90 ?? 0) >= 0 ? colors.success : colors.error }]}>
              {(p.plusMinusPer90 ?? 0) > 0 ? '+' : ''}{p.plusMinusPer90?.toFixed(1) ?? '0'}
            </Text>
            <Text style={[styles.effLabel, { color: colors.textMuted }]}>
              +/-
            </Text>
          </View>
        )}

        {/* Soccer Goalkeeper: Raw +/- (always visible unless sorting by +/- metrics) */}
        {sport === 'soccer' && soccerStatType === 'goalkeeper' && sortBy !== 'rating' && sortBy !== 'plusMinusPer90' && (
          <View style={styles.effStat}>
            <Text style={[styles.effValue, { color: (p.plusMinusPer90 ?? 0) >= 0 ? colors.success : colors.error }]}>
              {(p.plusMinusPer90 ?? 0) > 0 ? '+' : ''}{p.plusMinusPer90?.toFixed(1) ?? '0'}
            </Text>
            <Text style={[styles.effLabel, { color: colors.textMuted }]}>
              +/-
            </Text>
          </View>
        )}

        {/* Games Played - now part of stats row */}
        <View style={styles.gamesPlayed}>
          <Text style={[styles.gpValue, { color: colors.textMuted }]}>
            {player.gamesPlayed}
          </Text>
          <Text style={[styles.gpLabel, { color: colors.textMuted }]}>GP</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  playerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamName: {
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
  effStat: {
    alignItems: 'center',
    minWidth: 40,
    marginRight: spacing.sm,
  },
  effValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  effLabel: {
    fontSize: 8,
    fontWeight: '500',
    marginTop: 1,
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

export default PlayerStatsRow;
