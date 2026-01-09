/**
 * Stats Screen
 *
 * Displays league-wide player and team statistics from completed games.
 * Features sport selection, tabs for Players/Teams, filtering, and sorting.
 * Supports basketball, baseball (batting/pitching), and soccer (outfield/goalkeeper).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../theme';
import { PlayerStatsRow } from '../components/stats';
import { TeamStatsRow } from '../components/stats';
import { SegmentControl } from '../components/common/SegmentControl';
import type {
  AggregatedPlayerStats,
  AggregatedTeamStats,
  AggregatedBaseballBattingStats,
  AggregatedBaseballPitchingStats,
  AggregatedBaseballTeamStats,
  AggregatedSoccerPlayerStats,
  AggregatedSoccerGoalkeeperStats,
  AggregatedSoccerTeamStats,
} from '../../systems/statsAggregator';
import type { SportType, BaseballStatType, SoccerStatType } from './ConnectedStatsScreen';

// Union types for multi-sport support
type AnyPlayerStats =
  | AggregatedPlayerStats
  | AggregatedBaseballBattingStats
  | AggregatedBaseballPitchingStats
  | AggregatedSoccerPlayerStats
  | AggregatedSoccerGoalkeeperStats;

type AnyTeamStats =
  | AggregatedTeamStats
  | AggregatedBaseballTeamStats
  | AggregatedSoccerTeamStats;

// =============================================================================
// TYPES
// =============================================================================

export interface StatsScreenProps {
  // Sport selection
  selectedSport: SportType;
  baseballStatType: BaseballStatType;
  soccerStatType: SoccerStatType;
  onSportChange: (sport: SportType) => void;
  onBaseballStatTypeChange: (type: BaseballStatType) => void;
  onSoccerStatTypeChange: (type: SoccerStatType) => void;

  // Data (union types for multi-sport support)
  playerStats: AnyPlayerStats[];
  teamStats: AnyTeamStats[];
  teams: Array<{ id: string; name: string }>;

  // Filters
  selectedTeamId: string | null;
  viewMode: 'totals' | 'pergame';
  activeTab: 'players' | 'teams';
  sortBy: string;

  // Callbacks
  onTeamFilterChange: (teamId: string | null) => void;
  onViewModeChange: (mode: 'totals' | 'pergame') => void;
  onTabChange: (tab: 'players' | 'teams') => void;
  onSortChange: (sortBy: string) => void;
  onPlayerPress: (playerId: string) => void;
}

// =============================================================================
// SORT OPTIONS - BY SPORT
// =============================================================================

// Basketball
const BASKETBALL_PLAYER_SORTS = [
  { key: 'eff', label: 'EFF' },
  { key: 'points', label: 'PTS' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'fg3Pct', label: '3P%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'minutesPlayed', label: 'MIN' },
];

const BASKETBALL_TEAM_SORTS = [
  { key: 'ppg', label: 'PPG' },
  { key: 'oppPpg', label: 'OPP PPG' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'fg3Pct', label: '3P%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'winPct', label: 'WIN%' },
];

// Baseball - Batting
const BASEBALL_BATTING_SORTS = [
  { key: 'rc27', label: 'RC27' },
  { key: 'battingAvg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
  { key: 'hits', label: 'H' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'runs', label: 'R' },
  { key: 'stolenBases', label: 'SB' },
];

// Baseball - Pitching
const BASEBALL_PITCHING_SORTS = [
  { key: 'fip', label: 'FIP' },
  { key: 'wins', label: 'W' },
  { key: 'era', label: 'ERA' },
  { key: 'inningsPitched', label: 'IP' },
  { key: 'strikeouts', label: 'SO' },
  { key: 'saves', label: 'SV' },
  { key: 'whip', label: 'WHIP' },
  { key: 'k9', label: 'K/9' },
];

const BASEBALL_TEAM_SORTS = [
  { key: 'runsPerGame', label: 'R/G' },
  { key: 'runsAgainstPerGame', label: 'RA/G' },
  { key: 'battingAvg', label: 'BA' },
  { key: 'era', label: 'ERA' },
  { key: 'winPct', label: 'WIN%' },
];

// Soccer - Outfield Players
const SOCCER_OUTFIELD_SORTS = [
  { key: 'plusMinusPer90', label: '+/-' },
  { key: 'rating', label: 'Rel+/-' },
  { key: 'goals', label: 'G' },
  { key: 'assists', label: 'A' },
  { key: 'shots', label: 'SH' },
  { key: 'shotsOnTarget', label: 'SOT' },
  { key: 'shotAccuracy', label: 'ACC%' },
  { key: 'minutesPlayed', label: 'MIN' },
];

// Soccer - Goalkeepers
const SOCCER_GOALKEEPER_SORTS = [
  { key: 'plusMinusPer90', label: '+/-' },
  { key: 'rating', label: 'Rel+/-' },
  { key: 'saves', label: 'SV' },
  { key: 'cleanSheets', label: 'CS' },
  { key: 'goalsAgainst', label: 'GA' },
  { key: 'savePercentage', label: 'SV%' },
];

const SOCCER_TEAM_SORTS = [
  { key: 'goalsFor', label: 'GF' },
  { key: 'goalsAgainst', label: 'GA' },
  { key: 'possession', label: 'POSS%' },
  { key: 'shotsPerGame', label: 'SH/G' },
  { key: 'winPct', label: 'WIN%' },
];

// Sport segment options
const SPORT_SEGMENTS = [
  { key: 'basketball' as SportType, label: '🏀' },
  { key: 'baseball' as SportType, label: '⚾' },
  { key: 'soccer' as SportType, label: '⚽' },
];

// Baseball sub-type segments
const BASEBALL_STAT_SEGMENTS = [
  { key: 'batting' as BaseballStatType, label: 'Batting' },
  { key: 'pitching' as BaseballStatType, label: 'Pitching' },
];

// Soccer sub-type segments
const SOCCER_STAT_SEGMENTS = [
  { key: 'outfield' as SoccerStatType, label: 'Outfield' },
  { key: 'goalkeeper' as SoccerStatType, label: 'Keepers' },
];

// Helper to get sort options based on sport and stat type
function getSortOptions(
  activeTab: 'players' | 'teams',
  sport: SportType,
  baseballStatType: BaseballStatType,
  soccerStatType: SoccerStatType
): Array<{ key: string; label: string }> {
  if (activeTab === 'teams') {
    switch (sport) {
      case 'basketball': return BASKETBALL_TEAM_SORTS;
      case 'baseball': return BASEBALL_TEAM_SORTS;
      case 'soccer': return SOCCER_TEAM_SORTS;
    }
  }

  // Player stats
  switch (sport) {
    case 'basketball':
      return BASKETBALL_PLAYER_SORTS;
    case 'baseball':
      return baseballStatType === 'batting' ? BASEBALL_BATTING_SORTS : BASEBALL_PITCHING_SORTS;
    case 'soccer':
      return soccerStatType === 'outfield' ? SOCCER_OUTFIELD_SORTS : SOCCER_GOALKEEPER_SORTS;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StatsScreen({
  // Sport selection
  selectedSport,
  baseballStatType,
  soccerStatType,
  onSportChange,
  onBaseballStatTypeChange,
  onSoccerStatTypeChange,
  // Data
  playerStats,
  teamStats,
  teams,
  // Filters
  selectedTeamId,
  viewMode,
  activeTab,
  sortBy,
  // Callbacks
  onTeamFilterChange,
  onViewModeChange,
  onTabChange,
  onSortChange,
  onPlayerPress,
}: StatsScreenProps) {
  const colors = useColors();
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const sortOptions = getSortOptions(activeTab, selectedSport, baseballStatType, soccerStatType);
  const selectedTeam = selectedTeamId
    ? teams.find((t) => t.id === selectedTeamId)
    : null;
  const currentSortLabel = sortOptions.find((o) => o.key === sortBy)?.label || sortOptions[0]?.label || 'Sort';

  // Show sub-tabs for baseball (batting/pitching) or soccer (outfield/goalkeeper)
  const showSubTabs = activeTab === 'players' && (selectedSport === 'baseball' || selectedSport === 'soccer');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sport Selector */}
      <View style={styles.sportSelectorContainer}>
        <SegmentControl
          segments={SPORT_SEGMENTS}
          selectedKey={selectedSport}
          onChange={onSportChange}
          size="compact"
          style={styles.sportSelector}
        />
      </View>

      {/* Sport Sub-Type Tabs (Baseball: Batting/Pitching, Soccer: Outfield/Keepers) */}
      {showSubTabs && (
        <View style={styles.subTabContainer}>
          {selectedSport === 'baseball' && (
            <SegmentControl
              segments={BASEBALL_STAT_SEGMENTS}
              selectedKey={baseballStatType}
              onChange={onBaseballStatTypeChange}
              size="compact"
              style={styles.subTabSelector}
            />
          )}
          {selectedSport === 'soccer' && (
            <SegmentControl
              segments={SOCCER_STAT_SEGMENTS}
              selectedKey={soccerStatType}
              onChange={onSoccerStatTypeChange}
              size="compact"
              style={styles.subTabSelector}
            />
          )}
        </View>
      )}

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'players' && styles.activeTab,
            activeTab === 'players' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => onTabChange('players')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'players' ? colors.primary : colors.textMuted },
            ]}
          >
            Players
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'teams' && styles.activeTab,
            activeTab === 'teams' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => onTabChange('teams')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'teams' ? colors.primary : colors.textMuted },
            ]}
          >
            Teams
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.card }]}>
        {/* Team Filter (only for Players tab) */}
        {activeTab === 'players' && (
          <TouchableOpacity
            style={[styles.filterButton, { borderColor: colors.border }]}
            onPress={() => setShowTeamPicker(true)}
          >
            <Text
              style={[styles.filterButtonText, { color: colors.text }]}
              numberOfLines={1}
            >
              {selectedTeam ? selectedTeam.name : 'All Teams'}
            </Text>
            <Text style={[styles.filterArrow, { color: colors.textMuted }]}>
              ▼
            </Text>
          </TouchableOpacity>
        )}

        {/* Spacer for Teams tab or when no toggle shown */}
        {(activeTab === 'teams' || selectedSport === 'baseball') && <View style={styles.filterSpacer} />}

        {/* View Mode Toggle - Only show for basketball and soccer (baseball uses rate stats) */}
        {selectedSport !== 'baseball' && activeTab === 'players' && (
          <View style={[styles.viewModeToggle, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'totals' && { backgroundColor: colors.primary },
              ]}
              onPress={() => onViewModeChange('totals')}
            >
              <Text
                style={[
                  styles.viewModeText,
                  { color: viewMode === 'totals' ? colors.textInverse : colors.textMuted },
                ]}
              >
                Totals
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'pergame' && { backgroundColor: colors.primary },
              ]}
              onPress={() => onViewModeChange('pergame')}
            >
              <Text
                style={[
                  styles.viewModeText,
                  { color: viewMode === 'pergame' ? colors.textInverse : colors.textMuted },
                ]}
              >
                Per Game
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sort Dropdown */}
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

      {/* Stats List */}
      {activeTab === 'players' ? (
        <FlatList
          data={playerStats}
          keyExtractor={(item) => item.playerId}
          renderItem={({ item, index }) => (
            <PlayerStatsRow
              rank={index + 1}
              player={item}
              viewMode={viewMode}
              sortBy={sortBy}
              onPress={() => onPlayerPress(item.playerId)}
              sport={selectedSport}
              baseballStatType={baseballStatType}
              soccerStatType={soccerStatType}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No stats available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Play some games to see player statistics
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={teamStats}
          keyExtractor={(item) => item.teamId}
          renderItem={({ item, index }) => (
            <TeamStatsRow
              rank={index + 1}
              team={item}
              sortBy={sortBy}
              sport={selectedSport}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No stats available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Play some games to see team statistics
              </Text>
            </View>
          }
        />
      )}

      {/* Team Picker Modal */}
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTeamPicker(false)}
        >
          <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              Filter by Team
            </Text>

            <ScrollView style={styles.pickerList}>
              {/* All Teams Option */}
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !selectedTeamId && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => {
                  onTeamFilterChange(null);
                  setShowTeamPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: !selectedTeamId ? colors.primary : colors.text },
                  ]}
                >
                  All Teams
                </Text>
              </TouchableOpacity>

              {/* Team Options */}
              {teams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.pickerOption,
                    selectedTeamId === team.id && {
                      backgroundColor: colors.primary + '20',
                    },
                  ]}
                  onPress={() => {
                    onTeamFilterChange(team.id);
                    setShowTeamPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      {
                        color:
                          selectedTeamId === team.id ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.pickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowTeamPicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Picker Modal */}
      <Modal
        visible={showSortPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortPicker(false)}
        >
          <View style={[styles.sortPickerModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              Sort By
            </Text>

            <View style={styles.sortOptionsGrid}>
              {sortOptions.map((option) => {
                const isSelected = sortBy === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.sortOptionButton,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      onSortChange(option.key);
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

            <TouchableOpacity
              style={[styles.pickerCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowSortPicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sportSelectorContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sportSelector: {
    maxWidth: 180,
    alignSelf: 'center',
  },
  subTabContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  subTabSelector: {
    maxWidth: 240,
    alignSelf: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    maxWidth: 150,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  filterArrow: {
    fontSize: 10,
    marginLeft: spacing.xs,
  },
  filterSpacer: {
    flex: 1,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  viewModeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  viewModeText: {
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
  sortPickerModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  sortOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  sortOptionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  pickerCancel: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default StatsScreen;
