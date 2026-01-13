/**
 * Career Stats Card
 *
 * Displays sport-specific career statistics with:
 * - Year dropdown selector (Career + each season)
 * - Total/Per Game toggle
 * - Sport tabs (Basketball/Baseball/Soccer)
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import { Dropdown, SegmentControl } from '../common';
import type { DropdownOption } from '../common';
import type {
  Player,
  BasketballCareerStats,
  BaseballCareerStats,
  SoccerCareerStats,
} from '../../../data/types';

// =============================================================================
// TYPES
// =============================================================================

type Sport = 'basketball' | 'baseball' | 'soccer';
type DisplayMode = 'total' | 'perGame';

interface CareerStatsCardProps {
  player: Player;
  /** If true, hide stats (for unscouted players) */
  hidden?: boolean;
}

interface StatRow {
  label: string;
  value: string;
  highlight?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatNumber(n: number, decimals: number = 0): string {
  if (isNaN(n) || !isFinite(n)) return '-';
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

function formatPercentage(made: number, attempted: number): string {
  if (attempted === 0) return '-';
  return ((made / attempted) * 100).toFixed(1) + '%';
}

function formatBattingAverage(hits: number, atBats: number): string {
  if (atBats === 0) return '-';
  const avg = hits / atBats;
  return avg.toFixed(3).replace(/^0/, '');
}

function formatERA(earnedRuns: number, inningsPitched: number): string {
  if (inningsPitched === 0) return '-';
  const era = (earnedRuns / inningsPitched) * 9;
  return era.toFixed(2);
}

function formatWHIP(walks: number, hits: number, inningsPitched: number): string {
  if (inningsPitched === 0) return '-';
  const whip = (walks + hits) / inningsPitched;
  return whip.toFixed(2);
}

// =============================================================================
// STAT BUILDERS
// =============================================================================

function buildBasketballStats(
  stats: BasketballCareerStats | undefined,
  gamesPlayed: number,
  mode: DisplayMode
): StatRow[] {
  if (!stats || gamesPlayed === 0) {
    return [{ label: 'No basketball stats', value: '-' }];
  }

  const totalPoints =
    stats.fieldGoalsMade * 2 +
    stats.threePointersMade +
    stats.freeThrowsMade;

  if (mode === 'perGame') {
    return [
      { label: 'PPG', value: formatNumber(totalPoints / gamesPlayed, 1), highlight: true },
      { label: 'RPG', value: formatNumber(stats.rebounds / gamesPlayed, 1) },
      { label: 'APG', value: formatNumber(stats.assists / gamesPlayed, 1) },
      { label: 'SPG', value: formatNumber(stats.steals / gamesPlayed, 1) },
      { label: 'BPG', value: formatNumber(stats.blocks / gamesPlayed, 1) },
      { label: 'FG%', value: formatPercentage(stats.fieldGoalsMade, stats.fieldGoalsAttempted) },
      { label: '3P%', value: formatPercentage(stats.threePointersMade, stats.threePointersAttempted) },
      { label: 'FT%', value: formatPercentage(stats.freeThrowsMade, stats.freeThrowsAttempted) },
      { label: 'TOV', value: formatNumber(stats.turnovers / gamesPlayed, 1) },
    ];
  }

  return [
    { label: 'Games', value: formatNumber(gamesPlayed), highlight: true },
    { label: 'Points', value: formatNumber(totalPoints) },
    { label: 'Rebounds', value: formatNumber(stats.rebounds) },
    { label: 'Assists', value: formatNumber(stats.assists) },
    { label: 'Steals', value: formatNumber(stats.steals) },
    { label: 'Blocks', value: formatNumber(stats.blocks) },
    { label: 'FGM/A', value: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}` },
    { label: '3PM/A', value: `${stats.threePointersMade}/${stats.threePointersAttempted}` },
    { label: 'FTM/A', value: `${stats.freeThrowsMade}/${stats.freeThrowsAttempted}` },
  ];
}

function buildBaseballBattingStats(
  stats: BaseballCareerStats | undefined,
  gamesPlayed: number,
  mode: DisplayMode
): StatRow[] {
  if (!stats || stats.atBats === 0 || gamesPlayed === 0) {
    return [{ label: 'No batting stats', value: '-' }];
  }

  const obp = (stats.hits + stats.walks) / (stats.atBats + stats.walks);
  const slg =
    (stats.hits - stats.doubles - stats.triples - stats.homeRuns +
      stats.doubles * 2 +
      stats.triples * 3 +
      stats.homeRuns * 4) /
    stats.atBats;

  const ops = obp + slg;

  if (mode === 'perGame') {
    return [
      { label: 'AVG', value: formatBattingAverage(stats.hits, stats.atBats), highlight: true },
      { label: 'OBP', value: formatNumber(obp, 3).replace(/^0/, '') },
      { label: 'SLG', value: formatNumber(slg, 3).replace(/^0/, '') },
      { label: 'OPS', value: formatNumber(ops, 3) },
      { label: 'H/G', value: formatNumber(stats.hits / gamesPlayed, 1) },
      { label: 'HR/G', value: formatNumber(stats.homeRuns / gamesPlayed, 2) },
      { label: 'RBI/G', value: formatNumber(stats.rbi / gamesPlayed, 1) },
      { label: 'R/G', value: formatNumber(stats.runs / gamesPlayed, 1) },
      { label: 'BB/G', value: formatNumber(stats.walks / gamesPlayed, 1) },
    ];
  }

  return [
    { label: 'Games', value: formatNumber(gamesPlayed), highlight: true },
    { label: 'AVG', value: formatBattingAverage(stats.hits, stats.atBats) },
    { label: 'OPS', value: formatNumber(ops, 3) },
    { label: 'AB', value: formatNumber(stats.atBats) },
    { label: 'H', value: formatNumber(stats.hits) },
    { label: 'HR', value: formatNumber(stats.homeRuns) },
    { label: 'RBI', value: formatNumber(stats.rbi) },
    { label: 'R', value: formatNumber(stats.runs) },
    { label: 'SB', value: formatNumber(stats.stolenBases) },
    { label: 'BB', value: formatNumber(stats.walks) },
  ];
}

function buildBaseballPitchingStats(
  stats: BaseballCareerStats | undefined,
  gamesPlayed: number,
  mode: DisplayMode
): StatRow[] {
  if (!stats || stats.inningsPitched === 0 || gamesPlayed === 0) {
    return [{ label: 'No pitching stats', value: '-' }];
  }

  const ip = stats.inningsPitched;

  if (mode === 'perGame') {
    return [
      { label: 'ERA', value: formatERA(stats.earnedRuns, ip), highlight: true },
      { label: 'WHIP', value: formatWHIP(stats.walksAllowed, stats.hitsAllowed, ip) },
      { label: 'IP/G', value: formatNumber(ip / gamesPlayed, 1) },
      { label: 'K/G', value: formatNumber(stats.strikeoutsThrown / gamesPlayed, 1) },
      { label: 'BB/G', value: formatNumber(stats.walksAllowed / gamesPlayed, 1) },
      { label: 'K/9', value: formatNumber((stats.strikeoutsThrown / ip) * 9, 1) },
      { label: 'W-L', value: `${stats.wins}-${stats.losses}` },
      { label: 'SV', value: formatNumber(stats.saves) },
    ];
  }

  return [
    { label: 'W-L', value: `${stats.wins}-${stats.losses}`, highlight: true },
    { label: 'ERA', value: formatERA(stats.earnedRuns, ip) },
    { label: 'IP', value: formatNumber(ip, 1) },
    { label: 'K', value: formatNumber(stats.strikeoutsThrown) },
    { label: 'BB', value: formatNumber(stats.walksAllowed) },
    { label: 'WHIP', value: formatWHIP(stats.walksAllowed, stats.hitsAllowed, ip) },
    { label: 'SV', value: formatNumber(stats.saves) },
    { label: 'H', value: formatNumber(stats.hitsAllowed) },
    { label: 'HR', value: formatNumber(stats.homeRunsAllowed) },
  ];
}

function buildSoccerStats(
  stats: SoccerCareerStats | undefined,
  gamesPlayed: number,
  mode: DisplayMode
): StatRow[] {
  if (!stats || gamesPlayed === 0) {
    return [{ label: 'No soccer stats', value: '-' }];
  }

  if (mode === 'perGame') {
    return [
      { label: 'Goals/G', value: formatNumber(stats.goals / gamesPlayed, 2), highlight: true },
      { label: 'Assists/G', value: formatNumber(stats.assists / gamesPlayed, 2) },
      { label: 'Shots/G', value: formatNumber(stats.shots / gamesPlayed, 1) },
      { label: 'SOT/G', value: formatNumber(stats.shotsOnTarget / gamesPlayed, 1) },
      { label: 'Shot%', value: stats.shots > 0 ? formatPercentage(stats.shotsOnTarget, stats.shots) : '-' },
      { label: 'Mins/G', value: formatNumber(stats.minutesPlayed / gamesPlayed, 0) },
      { label: 'YC', value: formatNumber(stats.yellowCards) },
      { label: 'RC', value: formatNumber(stats.redCards) },
    ];
  }

  return [
    { label: 'Games', value: formatNumber(gamesPlayed), highlight: true },
    { label: 'Goals', value: formatNumber(stats.goals) },
    { label: 'Assists', value: formatNumber(stats.assists) },
    { label: 'Shots', value: formatNumber(stats.shots) },
    { label: 'SOT', value: formatNumber(stats.shotsOnTarget) },
    { label: 'Minutes', value: formatNumber(stats.minutesPlayed) },
    { label: 'YC', value: formatNumber(stats.yellowCards) },
    { label: 'RC', value: formatNumber(stats.redCards) },
    ...(stats.saves !== undefined
      ? [
          { label: 'Saves', value: formatNumber(stats.saves) },
          { label: 'CS', value: formatNumber(stats.cleanSheets || 0) },
        ]
      : []),
  ];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CareerStatsCard({ player, hidden = false }: CareerStatsCardProps) {
  const colors = useColors();

  // If hidden, show placeholder
  if (hidden) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.title, { color: colors.text }]}>Career Statistics</Text>
        <View style={styles.hiddenContainer}>
          <Text style={[styles.hiddenText, { color: colors.textMuted }]}>
            Scout this player to reveal their statistics
          </Text>
        </View>
      </View>
    );
  }

  // State
  const [selectedYear, setSelectedYear] = useState<string>('career');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('perGame');
  const [selectedSport, setSelectedSport] = useState<Sport>('basketball');

  // Build year options from season history
  const yearOptions: DropdownOption<string>[] = useMemo(() => {
    const options: DropdownOption<string>[] = [{ value: 'career', label: 'Career' }];

    if (player.seasonHistory && player.seasonHistory.length > 0) {
      // Add seasons in reverse order (most recent first)
      const sortedHistory = [...player.seasonHistory].sort(
        (a, b) => b.seasonNumber - a.seasonNumber
      );
      for (const season of sortedHistory) {
        options.push({
          value: String(season.seasonNumber),
          label: season.yearLabel,
        });
      }
    }

    // Always include current season if there are games played
    const currentGames =
      player.currentSeasonStats.gamesPlayed.basketball +
      player.currentSeasonStats.gamesPlayed.baseball +
      player.currentSeasonStats.gamesPlayed.soccer;

    if (currentGames > 0) {
      // Insert "This Season" after Career
      options.splice(1, 0, { value: 'current', label: 'This Season' });
    }

    return options;
  }, [player.seasonHistory, player.currentSeasonStats]);

  // Get stats for selected year/sport
  const { stats, gamesPlayed } = useMemo(() => {
    let sourceStats: {
      basketball?: BasketballCareerStats;
      baseball?: BaseballCareerStats;
      soccer?: SoccerCareerStats;
      gamesPlayed: { basketball: number; baseball: number; soccer: number };
    };

    if (selectedYear === 'career') {
      sourceStats = {
        ...player.careerStats,
        gamesPlayed: player.careerStats.gamesPlayed,
      };
    } else if (selectedYear === 'current') {
      sourceStats = {
        ...player.currentSeasonStats,
        gamesPlayed: player.currentSeasonStats.gamesPlayed,
      };
    } else {
      const season = player.seasonHistory?.find(
        (s) => String(s.seasonNumber) === selectedYear
      );
      if (season) {
        sourceStats = {
          basketball: season.basketball,
          baseball: season.baseball,
          soccer: season.soccer,
          gamesPlayed: season.gamesPlayed,
        };
      } else {
        sourceStats = {
          gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
        };
      }
    }

    return {
      stats: sourceStats,
      gamesPlayed: sourceStats.gamesPlayed[selectedSport],
    };
  }, [selectedYear, selectedSport, player]);

  // Build stat rows for current selection
  const statRows = useMemo(() => {
    switch (selectedSport) {
      case 'basketball':
        return buildBasketballStats(stats.basketball, gamesPlayed, displayMode);
      case 'baseball':
        // Show both batting and pitching
        const batting = buildBaseballBattingStats(stats.baseball, gamesPlayed, displayMode);
        const pitching = buildBaseballPitchingStats(stats.baseball, gamesPlayed, displayMode);
        return { batting, pitching };
      case 'soccer':
        return buildSoccerStats(stats.soccer, gamesPlayed, displayMode);
    }
  }, [stats, gamesPlayed, displayMode, selectedSport]);

  const isBaseballStats = selectedSport === 'baseball' && typeof statRows === 'object' && 'batting' in statRows;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
      {/* Header with controls */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Career Stats</Text>

        {/* Year Dropdown & Mode Toggle */}
        <View style={styles.controls}>
          <Dropdown
            options={yearOptions}
            selectedValue={selectedYear}
            onSelect={setSelectedYear}
            size="compact"
            style={styles.yearDropdown}
          />
          <SegmentControl
            segments={[
              { key: 'perGame' as DisplayMode, label: 'Per Game' },
              { key: 'total' as DisplayMode, label: 'Total' },
            ]}
            selectedKey={displayMode}
            onChange={setDisplayMode}
            size="compact"
            style={styles.modeToggle}
          />
        </View>
      </View>

      {/* Sport Tabs */}
      <SegmentControl
        segments={[
          { key: 'basketball' as Sport, label: 'Basketball' },
          { key: 'baseball' as Sport, label: 'Baseball' },
          { key: 'soccer' as Sport, label: 'Soccer' },
        ]}
        selectedKey={selectedSport}
        onChange={setSelectedSport}
        size="compact"
        style={styles.sportTabs}
      />

      {/* Stats Grid */}
      <ScrollView style={styles.statsContainer} nestedScrollEnabled>
        {isBaseballStats ? (
          <>
            {/* Batting Section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BATTING</Text>
            <View style={styles.statsGrid}>
              {statRows.batting.map((row, idx) => (
                <View key={`bat-${idx}`} style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: row.highlight ? colors.primary : colors.text },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Pitching Section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md }]}>
              PITCHING
            </Text>
            <View style={styles.statsGrid}>
              {statRows.pitching.map((row, idx) => (
                <View key={`pitch-${idx}`} style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: row.highlight ? colors.primary : colors.text },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.statsGrid}>
            {(statRows as StatRow[]).map((row, idx) => (
              <View key={idx} style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: row.highlight ? colors.primary : colors.text },
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gamesPlayed === 0 && (
          <Text style={[styles.noData, { color: colors.textMuted }]}>
            No {selectedSport} games played
            {selectedYear === 'career' ? '' : ` in ${yearOptions.find(o => o.value === selectedYear)?.label || 'this period'}`}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  yearDropdown: {
    flex: 0,
    minWidth: 110,
  },
  modeToggle: {
    flex: 1,
  },
  sportTabs: {
    marginBottom: spacing.md,
  },
  statsContainer: {
    maxHeight: 280,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '33.33%',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  noData: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  hiddenContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  hiddenText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default CareerStatsCard;
