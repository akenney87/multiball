/**
 * Play Tab Screen Container
 *
 * Container for the PLAY tab combining:
 * - Dashboard (smart hub) - default view
 * - Schedule with segment control (Fixtures | Table)
 *
 * Part of the NEON PITCH UI overhaul.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, spacing } from '../theme';
import { SegmentControl } from '../components/common';
import { ConnectedDashboardScreen } from './ConnectedDashboardScreen';
import { ConnectedScheduleScreen } from './ConnectedScheduleScreen';
import { ConnectedStandingsScreen } from './ConnectedStandingsScreen';

type PlaySegment = 'dashboard' | 'schedule';
type ScheduleSubSegment = 'fixtures' | 'table';

interface PlayTabScreenProps {
  // Dashboard callbacks
  onNavigateToMatch: (matchId: string) => void;
  onNavigateToBudget: () => void;
  onNavigateToSearch: () => void;
  onNavigateToScouting: () => void;
  onNavigateToYouthAcademy: () => void;
  // Schedule callbacks
  onMatchPress: (matchId: string) => void;
  // Standings callbacks
  onPlayerPress: (playerId: string) => void;
}

export function PlayTabScreen({
  onNavigateToMatch,
  onNavigateToBudget,
  onNavigateToSearch,
  onNavigateToScouting,
  onNavigateToYouthAcademy,
  onMatchPress,
  onPlayerPress,
}: PlayTabScreenProps) {
  const colors = useColors();
  const [segment, setSegment] = useState<PlaySegment>('dashboard');
  const [scheduleSubSegment, setScheduleSubSegment] = useState<ScheduleSubSegment>('fixtures');

  // Navigation to schedule from dashboard
  const handleNavigateToStandings = useCallback(() => {
    setSegment('schedule');
    setScheduleSubSegment('table');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main Segment Control: Dashboard | Schedule */}
      <View style={styles.segmentContainer}>
        <SegmentControl
          segments={[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'schedule', label: 'Schedule' },
          ]}
          selectedKey={segment}
          onChange={setSegment}
        />
      </View>

      {/* Dashboard View */}
      {segment === 'dashboard' && (
        <ConnectedDashboardScreen
          onNavigateToMatch={onNavigateToMatch}
          onNavigateToBudget={onNavigateToBudget}
          onNavigateToSearch={onNavigateToSearch}
          onNavigateToScouting={onNavigateToScouting}
          onNavigateToYouthAcademy={onNavigateToYouthAcademy}
          onNavigateToStandings={handleNavigateToStandings}
        />
      )}

      {/* Schedule View with Sub-segments */}
      {segment === 'schedule' && (
        <View style={styles.scheduleContainer}>
          {/* Sub-segment Control: Fixtures | Table */}
          <View style={styles.subSegmentContainer}>
            <SegmentControl
              segments={[
                { key: 'fixtures', label: 'Fixtures' },
                { key: 'table', label: 'Table' },
              ]}
              selectedKey={scheduleSubSegment}
              onChange={setScheduleSubSegment}
              size="compact"
            />
          </View>

          {/* Fixtures (Schedule) */}
          {scheduleSubSegment === 'fixtures' && (
            <ConnectedScheduleScreen onMatchPress={onMatchPress} />
          )}

          {/* Table (Standings) */}
          {scheduleSubSegment === 'table' && (
            <ConnectedStandingsScreen onPlayerPress={onPlayerPress} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scheduleContainer: {
    flex: 1,
  },
  subSegmentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});

export default PlayTabScreen;
