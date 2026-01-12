/**
 * Manage Tab Screen Container
 *
 * Container for the MANAGE tab combining:
 * - Squad (Roster | Stats | Training)
 * - Market (Transfers | Scouting)
 *
 * Part of the NEON PITCH UI overhaul.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, spacing } from '../theme';
import { SegmentControl } from '../components/common';
import { ConnectedRosterScreen } from './ConnectedRosterScreen';
import { ConnectedStatsScreen } from './ConnectedStatsScreen';
import { ConnectedTransferMarketScreen } from './ConnectedTransferMarketScreen';
import { ConnectedScoutingScreen } from './ConnectedScoutingScreen';
import { ConnectedTrainingScreen } from './ConnectedTrainingScreen';
import { ConnectedTrophyCaseScreen } from './ConnectedTrophyCaseScreen';
import { ConnectedLeaderboardScreen } from './ConnectedLeaderboardScreen';

type ManageSegment = 'squad' | 'market' | 'career';
type SquadSubSegment = 'roster' | 'stats' | 'training';
type MarketSubSegment = 'transfers' | 'scouting';
type CareerSubSegment = 'trophies' | 'leaderboard';

interface ManageTabScreenProps {
  // Player navigation
  onPlayerPress: (playerId: string) => void;
  // Budget navigation (for scouting)
  onNavigateToBudget: () => void;
  // Transfer callbacks
  onOfferMade?: () => void;
}

export function ManageTabScreen({
  onPlayerPress,
  onNavigateToBudget,
  onOfferMade,
}: ManageTabScreenProps) {
  const colors = useColors();
  const [segment, setSegment] = useState<ManageSegment>('squad');
  const [squadSubSegment, setSquadSubSegment] = useState<SquadSubSegment>('roster');
  const [marketSubSegment, setMarketSubSegment] = useState<MarketSubSegment>('transfers');
  const [careerSubSegment, setCareerSubSegment] = useState<CareerSubSegment>('trophies');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main Segment Control: Squad | Market | Career */}
      <View style={styles.segmentContainer}>
        <SegmentControl
          segments={[
            { key: 'squad', label: 'Squad' },
            { key: 'market', label: 'Market' },
            { key: 'career', label: 'Career' },
          ]}
          selectedKey={segment}
          onChange={setSegment}
        />
      </View>

      {/* Squad View with Sub-segments */}
      {segment === 'squad' && (
        <View style={styles.contentContainer}>
          {/* Sub-segment Control: Roster | Stats | Training */}
          <View style={styles.subSegmentContainer}>
            <SegmentControl
              segments={[
                { key: 'roster', label: 'Roster' },
                { key: 'stats', label: 'Stats' },
                { key: 'training', label: 'Training' },
              ]}
              selectedKey={squadSubSegment}
              onChange={setSquadSubSegment}
              size="compact"
            />
          </View>

          {/* Roster */}
          {squadSubSegment === 'roster' && (
            <ConnectedRosterScreen onPlayerPress={onPlayerPress} />
          )}

          {/* Stats */}
          {squadSubSegment === 'stats' && (
            <ConnectedStatsScreen onPlayerPress={onPlayerPress} />
          )}

          {/* Training */}
          {squadSubSegment === 'training' && (
            <ConnectedTrainingScreen onPlayerPress={onPlayerPress} />
          )}
        </View>
      )}

      {/* Market View with Sub-segments */}
      {segment === 'market' && (
        <View style={styles.contentContainer}>
          {/* Sub-segment Control: Transfers | Scouting */}
          <View style={styles.subSegmentContainer}>
            <SegmentControl
              segments={[
                { key: 'transfers', label: 'Transfers' },
                { key: 'scouting', label: 'Scouting' },
              ]}
              selectedKey={marketSubSegment}
              onChange={setMarketSubSegment}
              size="compact"
            />
          </View>

          {/* Transfers */}
          {marketSubSegment === 'transfers' && (
            <ConnectedTransferMarketScreen
              onOfferMade={onOfferMade}
              onPlayerPress={onPlayerPress}
            />
          )}

          {/* Scouting */}
          {marketSubSegment === 'scouting' && (
            <ConnectedScoutingScreen
              onNavigateToBudget={onNavigateToBudget}
              onPlayerPress={onPlayerPress}
            />
          )}
        </View>
      )}

      {/* Career View with Sub-segments */}
      {segment === 'career' && (
        <View style={styles.contentContainer}>
          {/* Sub-segment Control: Trophies | Leaderboard */}
          <View style={styles.subSegmentContainer}>
            <SegmentControl
              segments={[
                { key: 'trophies', label: 'Trophy Case' },
                { key: 'leaderboard', label: 'Leaderboard' },
              ]}
              selectedKey={careerSubSegment}
              onChange={setCareerSubSegment}
              size="compact"
            />
          </View>

          {/* Trophy Case */}
          {careerSubSegment === 'trophies' && (
            <ConnectedTrophyCaseScreen />
          )}

          {/* Leaderboard */}
          {careerSubSegment === 'leaderboard' && (
            <ConnectedLeaderboardScreen />
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
  contentContainer: {
    flex: 1,
  },
  subSegmentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});

export default ManageTabScreen;
