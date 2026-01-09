/**
 * Connected Dashboard Screen
 *
 * Smart hub dashboard connected to GameContext for real game data.
 * NEON PITCH styled central command center.
 *
 * Part of the UI overhaul - focused on:
 * - Next Match (hero card)
 * - Quick Sim / Advance Week
 * - Budget + Alerts
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useColors, spacing, borderRadius, glowShadows, cardStyles } from '../theme';
import { useGame } from '../context/GameContext';

interface ConnectedDashboardScreenProps {
  onNavigateToMatch?: (matchId: string) => void;
  onNavigateToBudget?: () => void;
  onNavigateToSearch?: () => void;
  onNavigateToScouting?: () => void;
  onNavigateToYouthAcademy?: () => void;
  onNavigateToStandings?: () => void;
}

export function ConnectedDashboardScreen({
  onNavigateToMatch,
  onNavigateToBudget,
  onNavigateToSearch,
  onNavigateToScouting,
  onNavigateToYouthAcademy,
  onNavigateToStandings,
}: ConnectedDashboardScreenProps) {
  const colors = useColors();
  const {
    state,
    getNextMatch,
    getUserRoster,
    getRecentEvents,
    getUserStanding,
    simulateMatch,
    quickSimWeek,
  } = useGame();

  // Local loading states for specific operations
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'team' | 'division' | 'global'>('team');

  // Derived data
  const nextMatch = useMemo(() => getNextMatch(), [getNextMatch]);
  const roster = useMemo(() => getUserRoster(), [getUserRoster]);
  const filteredEvents = useMemo(
    () => getRecentEvents(5, alertFilter),
    [getRecentEvents, alertFilter]
  );
  const standing = useMemo(() => getUserStanding(), [getUserStanding]);

  // Get opponent info for next match
  const opponentInfo = useMemo(() => {
    if (!nextMatch) return null;
    const opponentId = nextMatch.homeTeamId === 'user' ? nextMatch.awayTeamId : nextMatch.homeTeamId;
    const opponent = state.league.teams.find((t) => t.id === opponentId);
    const opponentStanding = state.season.standings[opponentId];
    return {
      name: opponent?.name || 'Unknown Team',
      wins: opponentStanding?.wins || 0,
      losses: opponentStanding?.losses || 0,
      rank: opponentStanding?.rank || '?',
    };
  }, [nextMatch, state.league.teams, state.season.standings]);

  const isHomeGame = nextMatch?.homeTeamId === 'user';

  // Calculate injuries
  const injuries = useMemo(() => {
    return roster.filter((p) => p.injury !== null);
  }, [roster]);

  // Calculate expiring contracts (within 4 weeks)
  const expiringContracts = useMemo(() => {
    const now = new Date();
    const fourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    return roster.filter(
      (p) => p.contract && new Date(p.contract.expiryDate) <= fourWeeks
    );
  }, [roster]);

  // Format budget
  const formatBudget = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  // Handlers
  const handleSimMatch = useCallback(async () => {
    if (nextMatch && !isSimulating) {
      setIsSimulating(true);
      try {
        await simulateMatch(nextMatch.id);
      } finally {
        setIsSimulating(false);
      }
    }
  }, [nextMatch, simulateMatch, isSimulating]);

  const handleAdvanceWeek = useCallback(async () => {
    if (!isAdvancing) {
      setIsAdvancing(true);
      try {
        await quickSimWeek();
      } finally {
        setIsAdvancing(false);
      }
    }
  }, [quickSimWeek, isAdvancing]);

  const handlePreviewMatch = useCallback(() => {
    if (nextMatch && onNavigateToMatch) {
      onNavigateToMatch(nextMatch.id);
    }
  }, [nextMatch, onNavigateToMatch]);

  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No game in progress
        </Text>
      </View>
    );
  }

  // Get sport-specific accent color
  const getSportColor = (sport: string) => {
    switch (sport) {
      case 'basketball': return colors.basketball || colors.warning;
      case 'baseball': return colors.baseball || colors.error;
      case 'soccer': return colors.soccer || colors.success;
      default: return colors.primary;
    }
  };

  const sportColor = nextMatch ? getSportColor(nextMatch.sport) : colors.primary;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header with Team Info and Budget */}
      <View style={styles.header}>
        <View style={styles.teamInfo}>
          <Text style={[styles.teamName, { color: colors.text }]}>
            {state.userTeam.name}
          </Text>
          <View style={styles.statsRow}>
            <Text style={[styles.record, { color: colors.textSecondary }]}>
              {standing ? `${standing.wins}W - ${standing.losses}L` : '0W - 0L'}
            </Text>
            {standing && (
              <Text style={[styles.rankBadge, { color: colors.primary }]}>
                #{standing.rank}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.budgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={onNavigateToBudget}
        >
          <Text style={[styles.budgetAmount, { color: colors.primary }]}>
            {formatBudget(state.userTeam.availableBudget)}
          </Text>
          <Text style={[styles.budgetLabel, { color: colors.textMuted }]}>TAP TO MANAGE</Text>
        </TouchableOpacity>
      </View>

      {/* Season Progress Bar */}
      <TouchableOpacity
        style={[styles.progressCard, { backgroundColor: colors.surface }]}
        activeOpacity={0.8}
        onPress={onNavigateToStandings}
      >
        <View style={styles.progressHeader}>
          <Text style={[styles.weekLabel, { color: colors.text }]}>
            Week {state.season.currentWeek}
          </Text>
          <Text style={[styles.weekTotal, { color: colors.textMuted }]}>of 40</Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${(state.season.currentWeek / 40) * 100}%`,
              },
              glowShadows.primary,
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* Next Match Hero Card */}
      {nextMatch && opponentInfo ? (
        <View style={[styles.heroCard, cardStyles.highlighted, { borderColor: sportColor }]}>
          {/* Top Row: Home/Away Badge + Sport Badge */}
          <View style={styles.heroTopRow}>
            <View style={[
              styles.homeAwayBadgeTop,
              { backgroundColor: isHomeGame ? colors.primary : colors.textMuted }
            ]}>
              <Text style={styles.homeAwayTextTop}>{isHomeGame ? 'HOME' : 'AWAY'}</Text>
            </View>
            <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
              <Text style={styles.sportBadgeText}>
                {nextMatch.sport.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>NEXT MATCH</Text>

          {/* Matchup Display - Centered */}
          <View style={styles.matchupContainer}>
            {/* User Team */}
            <View style={styles.matchupTeam}>
              <Text style={[styles.matchupTeamName, { color: colors.text }]} numberOfLines={2}>
                {state.userTeam.name}
              </Text>
              <Text style={[styles.matchupRecord, { color: colors.textSecondary }]}>
                {standing ? `${standing.wins}-${standing.losses}` : '0-0'}
              </Text>
            </View>

            {/* VS Divider */}
            <View style={styles.matchupDivider}>
              <Text style={[styles.matchupVs, { color: sportColor }]}>VS</Text>
              <Text style={[styles.matchupWeek, { color: colors.textMuted }]}>
                Week {state.season.currentWeek}
              </Text>
            </View>

            {/* Opponent Team */}
            <View style={styles.matchupTeam}>
              <Text style={[styles.matchupTeamName, { color: colors.text }]} numberOfLines={2}>
                {opponentInfo.name}
              </Text>
              <Text style={[styles.matchupRecord, { color: colors.textSecondary }]}>
                {opponentInfo.wins}-{opponentInfo.losses}
              </Text>
            </View>
          </View>

          {/* Preview Button - Full Width */}
          <TouchableOpacity
            style={[styles.heroButton, { backgroundColor: sportColor }, glowShadows.primary]}
            activeOpacity={0.8}
            onPress={handlePreviewMatch}
          >
            <Text style={styles.heroButtonText}>PREVIEW MATCH</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.heroCard, cardStyles.default, { borderColor: colors.border }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>NEXT MATCH</Text>
          <Text style={[styles.noMatchText, { color: colors.textSecondary }]}>
            No upcoming matches
          </Text>
        </View>
      )}

      {/* Quick Actions - Sim & Advance */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[
            styles.quickButton,
            {
              backgroundColor: colors.surface,
              borderColor: nextMatch && !isSimulating && !isAdvancing ? colors.primary : colors.border,
              opacity: isSimulating || isAdvancing || !nextMatch ? 0.5 : 1,
            },
          ]}
          activeOpacity={0.8}
          onPress={handleSimMatch}
          disabled={isSimulating || isAdvancing || !nextMatch}
        >
          {isSimulating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Text style={[styles.quickButtonIcon, { color: colors.primary }]}>{'⚡'}</Text>
              <Text style={[styles.quickButtonText, { color: colors.text }]}>Sim Match</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickButton,
            {
              backgroundColor: colors.surface,
              borderColor: !isSimulating && !isAdvancing ? colors.secondary : colors.border,
              opacity: isSimulating || isAdvancing ? 0.5 : 1,
            },
          ]}
          activeOpacity={0.8}
          onPress={handleAdvanceWeek}
          disabled={isSimulating || isAdvancing}
        >
          {isAdvancing ? (
            <ActivityIndicator color={colors.secondary} size="small" />
          ) : (
            <>
              <Text style={[styles.quickButtonIcon, { color: colors.secondary }]}>{'⏩'}</Text>
              <Text style={[styles.quickButtonText, { color: colors.text }]}>Advance Week</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Alerts Section */}
      {(injuries.length > 0 || expiringContracts.length > 0) && (
        <View style={[styles.alertsCard, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
          <View style={styles.alertsHeader}>
            <Text style={[styles.alertsTitle, { color: colors.warning }]}>
              {'⚠'} ALERTS
            </Text>
            <Text style={[styles.alertsCount, { color: colors.warning }]}>
              {injuries.length + expiringContracts.length}
            </Text>
          </View>
          {injuries.slice(0, 2).map((player) => (
            <View key={player.id} style={styles.alertItem}>
              <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.alertText, { color: colors.text }]} numberOfLines={1}>
                {player.name} - injured ({player.injury?.recoveryWeeks || 1}w)
              </Text>
            </View>
          ))}
          {expiringContracts.slice(0, 2).map((player) => (
            <View key={player.id} style={styles.alertItem}>
              <View style={[styles.alertDot, { backgroundColor: colors.info }]} />
              <Text style={[styles.alertText, { color: colors.text }]} numberOfLines={1}>
                {player.name} - contract expiring
              </Text>
            </View>
          ))}
          {(injuries.length + expiringContracts.length > 4) && (
            <Text style={[styles.alertsMore, { color: colors.textMuted }]}>
              +{injuries.length + expiringContracts.length - 4} more
            </Text>
          )}
        </View>
      )}

      {/* Quick Access Row */}
      <View style={styles.accessRow}>
        <TouchableOpacity
          style={[styles.accessButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={onNavigateToScouting}
        >
          <Text style={[styles.accessIcon, { color: colors.primary }]}>{'🔍'}</Text>
          <Text style={[styles.accessLabel, { color: colors.text }]}>Scout</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.accessButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={onNavigateToYouthAcademy}
        >
          <Text style={[styles.accessIcon, { color: colors.secondary }]}>{'⭐'}</Text>
          <Text style={[styles.accessLabel, { color: colors.text }]}>Academy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.accessButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={onNavigateToSearch}
        >
          <Text style={[styles.accessIcon, { color: colors.textMuted }]}>{'👤'}</Text>
          <Text style={[styles.accessLabel, { color: colors.text }]}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Recent News with Scope Toggles */}
      <View style={[styles.newsCard, { backgroundColor: colors.surface }]}>
        <View style={styles.newsHeaderRow}>
          <Text style={[styles.newsHeader, { color: colors.textMuted }]}>RECENT</Text>
          <View style={styles.alertToggles}>
            <TouchableOpacity
              style={[
                styles.alertToggle,
                alertFilter === 'team' && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAlertFilter('team')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.alertToggleText,
                  { color: alertFilter === 'team' ? '#000' : colors.textMuted },
                ]}
              >
                Team
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.alertToggle,
                alertFilter === 'division' && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAlertFilter('division')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.alertToggleText,
                  { color: alertFilter === 'division' ? '#000' : colors.textMuted },
                ]}
              >
                Division
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.alertToggle,
                alertFilter === 'global' && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAlertFilter('global')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.alertToggleText,
                  { color: alertFilter === 'global' ? '#000' : colors.textMuted },
                ]}
              >
                Global
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Filtered events based on selected scope */}
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <View key={event.id} style={styles.newsItem}>
              <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={[styles.newsSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {event.message}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.noNewsText, { color: colors.textMuted }]}>
            No {alertFilter} news
          </Text>
        )}
      </View>
    </ScrollView>
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
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  record: {
    fontSize: 14,
    fontWeight: '500',
  },
  rankBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  budgetCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  budgetAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  budgetLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Progress
  progressCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekTotal: {
    fontSize: 12,
    marginLeft: spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Hero Card
  heroCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  homeAwayBadgeTop: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomRightRadius: borderRadius.md,
  },
  homeAwayTextTop: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sportBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  sportBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  // Matchup Display
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  matchupTeam: {
    flex: 1,
    alignItems: 'center',
  },
  matchupTeamName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  matchupRecord: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  homeAwayBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  homeAwayText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  matchupDivider: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  matchupVs: {
    fontSize: 20,
    fontWeight: '800',
  },
  matchupWeek: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  heroButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noMatchText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  quickButtonIcon: {
    fontSize: 18,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Alerts
  alertsCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alertsTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertsCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  alertText: {
    fontSize: 13,
    flex: 1,
  },
  alertsMore: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  // Quick Access
  accessRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accessButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  accessIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  accessLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // News
  newsCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  newsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  newsHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  alertToggles: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  alertToggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  alertToggleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  newsItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  newsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  newsSubtitle: {
    fontSize: 11,
  },
  noNewsText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ConnectedDashboardScreen;
