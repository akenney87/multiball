/**
 * Match Preview Screen
 *
 * Shows match details before simulation:
 * - Teams and their records
 * - Lineup selection
 * - Tactical options
 * - Start match button
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface MatchPreviewScreenProps {
  matchId?: string;
  onStartMatch?: () => void;
  onQuickSim?: () => void;
  onBack?: () => void;
}

export function MatchPreviewScreen({
  matchId,
  onStartMatch,
  onQuickSim,
  onBack,
}: MatchPreviewScreenProps) {
  const colors = useColors();
  const [showQuickSimConfirm, setShowQuickSimConfirm] = useState(false);

  // Mock data - will be replaced with real data from context
  const matchData = {
    homeTeam: 'My Team',
    awayTeam: 'Opponent',
    sport: 'Basketball',
    week: 5,
    homeRecord: '10-5',
    awayRecord: '8-7',
  };

  const handleQuickSim = () => {
    setShowQuickSimConfirm(true);
  };

  const confirmQuickSim = () => {
    setShowQuickSimConfirm(false);
    onQuickSim?.();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Match Header */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <View style={[styles.sportBadge, { backgroundColor: colors.basketball }]}>
          <Text style={styles.sportText}>{matchData.sport}</Text>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.team}>
            <Text style={[styles.teamName, { color: colors.text }]}>
              {matchData.homeTeam}
            </Text>
            <Text style={[styles.record, { color: colors.textSecondary }]}>
              {matchData.homeRecord}
            </Text>
            <Text style={[styles.homeAway, { color: colors.textMuted }]}>HOME</Text>
          </View>

          <Text style={[styles.vs, { color: colors.textMuted }]}>VS</Text>

          <View style={styles.team}>
            <Text style={[styles.teamName, { color: colors.text }]}>
              {matchData.awayTeam}
            </Text>
            <Text style={[styles.record, { color: colors.textSecondary }]}>
              {matchData.awayRecord}
            </Text>
            <Text style={[styles.homeAway, { color: colors.textMuted }]}>AWAY</Text>
          </View>
        </View>

        <Text style={[styles.weekLabel, { color: colors.textMuted }]}>
          Week {matchData.week}
        </Text>
      </View>

      {/* Lineup Preview */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Starting Lineup</Text>
        <View style={styles.lineupGrid}>
          {[1, 2, 3, 4, 5].map((slot) => (
            <View
              key={slot}
              style={[styles.positionSlot, { borderColor: colors.border }]}
            >
              <Text style={[styles.positionLabel, { color: colors.textMuted }]}>
                #{slot}
              </Text>
              <Text style={[styles.playerName, { color: colors.text }]}>
                Starter {slot}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.editButton, { borderColor: colors.primary }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.editButtonText, { color: colors.primary }]}>
            Edit Lineup
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tactical Options */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tactics</Text>
        <View style={styles.tacticsRow}>
          <View style={styles.tacticItem}>
            <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Pace</Text>
            <Text style={[styles.tacticValue, { color: colors.text }]}>Normal</Text>
          </View>
          <View style={styles.tacticItem}>
            <Text style={[styles.tacticLabel, { color: colors.textMuted }]}>Defense</Text>
            <Text style={[styles.tacticValue, { color: colors.text }]}>Man</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onStartMatch}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
            Watch Match
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleQuickSim}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Quick Sim
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Sim Confirmation */}
      <ConfirmationModal
        visible={showQuickSimConfirm}
        title="Quick Simulate?"
        message="The match will be simulated instantly and you'll see the final result."
        confirmText="Simulate"
        cancelText="Cancel"
        onConfirm={confirmQuickSim}
        onCancel={() => setShowQuickSimConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  sportBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  sportText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  record: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  homeAway: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  vs: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: spacing.md,
  },
  weekLabel: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  lineupGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  positionSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  positionLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: '600',
  },
  playerName: {
    flex: 1,
    fontSize: 14,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tacticsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  tacticItem: {
    flex: 1,
  },
  tacticLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  tacticValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MatchPreviewScreen;
