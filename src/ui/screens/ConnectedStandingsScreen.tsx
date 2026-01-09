/**
 * Connected Standings Screen
 *
 * Standings screen connected to GameContext for real standings data.
 * Shows league table with all teams.
 * Tap any team to view their roster.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useGame } from '../context/GameContext';
import { calculatePlayerOverall } from '../integration/gameInitializer';
import { ConnectedPlayerDetailScreen } from './ConnectedPlayerDetailScreen';

interface TeamRosterViewProps {
  teamId: string;
  teamName: string;
  onClose: () => void;
}

// Team Roster View Component - self-contained with player detail overlay
function TeamRosterView({ teamId, teamName, onClose }: TeamRosterViewProps) {
  const colors = useColors();
  const { state } = useGame();

  // Local state for player detail
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Get team roster
  const roster = useMemo(() => {
    let rosterIds: string[] = [];
    if (teamId === 'user') {
      rosterIds = state.userTeam.rosterIds;
    } else {
      const team = state.league.teams.find((t) => t.id === teamId);
      rosterIds = team?.rosterIds || [];
    }

    return rosterIds
      .map((id) => state.players[id])
      .filter((p) => p !== undefined)
      .map((player) => ({
        id: player.id,
        name: player.name,
        age: player.age,
        nationality: player.nationality,
        height: player.height,
        weight: player.weight,
        overall: calculatePlayerOverall(player),
        salary: player.contract?.salary || 0,
      }))
      .sort((a, b) => b.overall - a.overall);
  }, [teamId, state]);

  const formatHeight = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    return `$${(salary / 1000).toFixed(0)}K`;
  };

  return (
    <View style={[rosterStyles.container, { backgroundColor: colors.background }]}>
      <View style={[rosterStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={rosterStyles.closeButton}>
          <Text style={[rosterStyles.closeText, { color: colors.primary }]}>Close</Text>
        </TouchableOpacity>
        <Text style={[rosterStyles.title, { color: colors.text }]}>{teamName}</Text>
        <View style={rosterStyles.closeButton} />
      </View>

      <ScrollView contentContainerStyle={rosterStyles.content}>
        <Text style={[rosterStyles.rosterCount, { color: colors.textMuted }]}>
          {roster.length} PLAYERS
        </Text>

        {roster.map((player) => (
          <TouchableOpacity
            key={player.id}
            style={[rosterStyles.playerRow, { backgroundColor: colors.card }, shadows.sm]}
            onPress={() => setSelectedPlayerId(player.id)}
            activeOpacity={0.7}
          >
            <View style={rosterStyles.playerInfo}>
              <Text style={[rosterStyles.playerName, { color: colors.text }]}>
                {player.name}
              </Text>
              <Text style={[rosterStyles.playerDetails, { color: colors.textMuted }]}>
                Age {player.age} • {formatHeight(player.height)} • {player.weight} lbs • {player.nationality}
              </Text>
              <Text style={[rosterStyles.playerContract, { color: colors.textSecondary }]}>
                {formatSalary(player.salary)}/yr
              </Text>
            </View>
            <View style={rosterStyles.overallContainer}>
              <Text style={[rosterStyles.overall, { color: colors.primary }]}>{player.overall}</Text>
              <Text style={[rosterStyles.overallLabel, { color: colors.textMuted }]}>OVR</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Player Detail Overlay - inside TeamRosterView so it appears on top */}
      {selectedPlayerId && (
        <View style={[rosterStyles.playerDetailOverlay, { backgroundColor: colors.background }]}>
          <View style={[rosterStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedPlayerId(null)} style={rosterStyles.closeButton}>
              <Text style={[rosterStyles.closeText, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[rosterStyles.title, { color: colors.text }]}>Player Details</Text>
            <View style={rosterStyles.closeButton} />
          </View>
          <ConnectedPlayerDetailScreen
            playerId={selectedPlayerId}
            onBack={() => setSelectedPlayerId(null)}
          />
        </View>
      )}
    </View>
  );
}

export interface ConnectedStandingsScreenProps {
  onPlayerPress?: (playerId: string) => void;
}

export function ConnectedStandingsScreen({ onPlayerPress: _onPlayerPress }: ConnectedStandingsScreenProps = {}) {
  const colors = useColors();
  const { state, getUserStanding } = useGame();

  // State for team roster modal
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);

  // Handle team press
  const handleTeamPress = useCallback((teamId: string, teamName: string) => {
    setSelectedTeam({ id: teamId, name: teamName });
  }, []);

  // Calculate W-L% helper
  const getWinPct = (wins: number, losses: number): string => {
    const total = wins + losses;
    if (total === 0) return '.000';
    const pct = wins / total;
    return pct.toFixed(3).replace('0.', '.');
  };

  // Build standings list
  const standings = useMemo(() => {
    const standingsList = Object.values(state.season.standings).map((standing) => {
      // Get team name
      let teamName = 'Unknown';
      if (standing.teamId === 'user') {
        teamName = state.userTeam.name;
      } else {
        const team = state.league.teams.find((t) => t.id === standing.teamId);
        teamName = team?.name || 'Unknown';
      }

      return {
        ...standing,
        teamName,
        isUser: standing.teamId === 'user',
        gamesPlayed: standing.wins + standing.losses,
        winPct: getWinPct(standing.wins, standing.losses),
        basketballPct: getWinPct(standing.basketball.wins, standing.basketball.losses),
        baseballPct: getWinPct(standing.baseball.wins, standing.baseball.losses),
        soccerPct: getWinPct(standing.soccer.wins, standing.soccer.losses),
      };
    });

    // Sort by rank
    return standingsList.sort((a, b) => a.rank - b.rank);
  }, [state.season.standings, state.userTeam.name, state.league.teams]);

  // Get user position
  const userStanding = useMemo(() => getUserStanding(), [getUserStanding]);

  const renderStandingItem = ({ item, index }: { item: typeof standings[0]; index: number }) => {
    const isTop3 = item.rank <= 3;
    const isBottom3 = item.rank > standings.length - 3;

    return (
      <TouchableOpacity
        style={[
          styles.standingRow,
          { backgroundColor: item.isUser ? colors.primary + '15' : colors.card },
          index === 0 && styles.firstRow,
        ]}
        onPress={() => handleTeamPress(item.teamId, item.teamName)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text
            style={[
              styles.rankText,
              {
                color: isTop3 ? colors.success : isBottom3 ? colors.error : colors.text,
              },
            ]}
          >
            {item.rank}
          </Text>
          {isTop3 && (
            <View style={[styles.playoffIndicator, { backgroundColor: colors.success }]} />
          )}
          {isBottom3 && (
            <View style={[styles.playoffIndicator, { backgroundColor: colors.error }]} />
          )}
        </View>

        <View style={styles.teamContainer}>
          <Text
            style={[
              styles.teamName,
              { color: colors.text },
              item.isUser && styles.userTeamName,
            ]}
            numberOfLines={1}
          >
            {item.teamName}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={[styles.statText, { color: colors.text }]}>{item.wins}</Text>
          <Text style={[styles.statText, { color: colors.text }]}>{item.losses}</Text>
          <Text style={[styles.pctText, { color: colors.primary }]}>{item.winPct}</Text>
        </View>
        <View style={styles.sportPctContainer}>
          <Text style={[styles.sportPctText, { color: '#FF6B35' }]}>{item.basketballPct}</Text>
          <Text style={[styles.sportPctText, { color: '#1B998B' }]}>{item.baseballPct}</Text>
          <Text style={[styles.sportPctText, { color: '#3498DB' }]}>{item.soccerPct}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.headerText, { color: colors.textMuted }]}>#</Text>
      </View>
      <View style={styles.teamContainer}>
        <Text style={[styles.headerText, { color: colors.textMuted }]}>Team</Text>
      </View>
      <View style={styles.statsContainer}>
        <Text style={[styles.headerText, { color: colors.textMuted }]}>W</Text>
        <Text style={[styles.headerText, { color: colors.textMuted }]}>L</Text>
        <Text style={[styles.headerText, { color: colors.textMuted }]}>PCT</Text>
      </View>
      <View style={styles.sportPctContainer}>
        <Text style={[styles.sportHeaderText, { color: '#FF6B35' }]}>BBall</Text>
        <Text style={[styles.sportHeaderText, { color: '#1B998B' }]}>Base</Text>
        <Text style={[styles.sportHeaderText, { color: '#3498DB' }]}>Soccer</Text>
      </View>
    </View>
  );

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* User Position Summary */}
      {userStanding && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card }, shadows.md]}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>YOUR POSITION</Text>
          <View style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                #{userStanding.rank}
              </Text>
              <Text style={[styles.summarySubtext, { color: colors.textMuted }]}>Rank</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {userStanding.wins}-{userStanding.losses}
              </Text>
              <Text style={[styles.summarySubtext, { color: colors.textMuted }]}>Record</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {getWinPct(userStanding.wins, userStanding.losses)}
              </Text>
              <Text style={[styles.summarySubtext, { color: colors.textMuted }]}>W-L%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Promotion</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Relegation</Text>
        </View>
      </View>

      {/* Standings Table */}
      <FlatList
        data={standings}
        renderItem={renderStandingItem}
        keyExtractor={(item) => item.teamId}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Team Roster Modal */}
      <Modal
        visible={selectedTeam !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTeam(null)}
      >
        {selectedTeam && (
          <TeamRosterView
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            onClose={() => setSelectedTeam(null)}
          />
        )}
      </Modal>

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
  summaryCard: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summarySubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  firstRow: {
    marginTop: spacing.sm,
  },
  rankContainer: {
    width: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  playoffIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 4,
  },
  teamContainer: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  teamName: {
    fontSize: 14,
  },
  userTeamName: {
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    width: 90,
  },
  statText: {
    width: 24,
    fontSize: 13,
    textAlign: 'center',
  },
  pctText: {
    width: 42,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sportPctContainer: {
    flexDirection: 'row',
    width: 120,
  },
  sportPctText: {
    width: 40,
    fontSize: 11,
    textAlign: 'center',
  },
  sportHeaderText: {
    width: 40,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

const rosterStyles = StyleSheet.create({
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
  content: {
    padding: spacing.md,
  },
  rosterCount: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  playerDetails: {
    fontSize: 12,
    marginBottom: 2,
  },
  playerContract: {
    fontSize: 11,
  },
  overallContainer: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  overall: {
    fontSize: 20,
    fontWeight: '700',
  },
  overallLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  playerDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});

export default ConnectedStandingsScreen;
