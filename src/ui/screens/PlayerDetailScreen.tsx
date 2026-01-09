/**
 * Player Detail Screen
 *
 * Full player information:
 * - Basic info and contract
 * - Attribute display (25 attributes)
 * - Career stats
 * - Actions (release, training)
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

interface PlayerDetailScreenProps {
  playerId?: string;
  onRelease?: () => void;
  onBack?: () => void;
}

// Attribute categories for display
const attributeCategories = {
  physical: [
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
  ],
  mental: [
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience', 'teamwork',
  ],
  technical: [
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'footwork',
  ],
};

// Mock player data
const mockPlayer = {
  id: '1',
  name: 'John Smith',
  age: 25,
  overall: 82,
  contract: {
    salary: 2500000,
    yearsRemaining: 2,
    expiryDate: '2026-06-30',
  },
  attributes: {
    grip_strength: 75, arm_strength: 78, core_strength: 80, agility: 85,
    acceleration: 88, top_speed: 82, jumping: 76, reactions: 84,
    stamina: 80, balance: 78, height: 72, durability: 75,
    awareness: 82, creativity: 80, determination: 85, bravery: 78,
    consistency: 76, composure: 82, patience: 74,
    hand_eye_coordination: 86, throw_accuracy: 84, form_technique: 80,
    finesse: 78, deception: 76, teamwork: 82,
  },
  stats: {
    gamesPlayed: 45,
    pointsPerGame: 18.5,
    reboundsPerGame: 4.2,
    assistsPerGame: 7.8,
  },
};

export function PlayerDetailScreen({
  playerId,
  onRelease,
  onBack,
}: PlayerDetailScreenProps) {
  const colors = useColors();
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    return `$${(salary / 1000).toFixed(0)}K`;
  };

  const formatAttributeName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getAttributeColor = (value: number) => {
    if (value >= 85) return colors.success;
    if (value >= 70) return '#22C55E'; // light green
    if (value >= 55) return colors.warning;
    return colors.error;
  };

  const handleRelease = () => {
    setShowReleaseConfirm(false);
    onRelease?.();
  };

  const renderAttributeCategory = (
    title: string,
    attrs: string[],
    categoryColor: string
  ) => (
    <View style={[styles.categoryCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={[styles.categoryHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        <Text style={[styles.categoryTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.attributesGrid}>
        {attrs.map((attr) => {
          const value = mockPlayer.attributes[attr as keyof typeof mockPlayer.attributes];
          return (
            <View key={attr} style={styles.attributeItem}>
              <Text style={[styles.attributeName, { color: colors.textSecondary }]}>
                {formatAttributeName(attr)}
              </Text>
              <View style={styles.attributeValueContainer}>
                <View
                  style={[
                    styles.attributeBar,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.attributeBarFill,
                      {
                        width: `${value}%`,
                        backgroundColor: getAttributeColor(value),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.attributeValue, { color: colors.text }]}>
                  {value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: colors.card }, shadows.md]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.playerName, { color: colors.text }]}>
              {mockPlayer.name}
            </Text>
            <Text style={[styles.playerPosition, { color: colors.textSecondary }]}>
              Age {mockPlayer.age}
            </Text>
          </View>
          <View style={styles.overallContainer}>
            <Text style={[styles.overallValue, { color: colors.primary }]}>
              {mockPlayer.overall}
            </Text>
            <Text style={[styles.overallLabel, { color: colors.textMuted }]}>OVR</Text>
          </View>
        </View>

        {/* Contract Info */}
        <View style={[styles.contractInfo, { borderTopColor: colors.border }]}>
          <View style={styles.contractItem}>
            <Text style={[styles.contractLabel, { color: colors.textMuted }]}>Salary</Text>
            <Text style={[styles.contractValue, { color: colors.text }]}>
              {formatSalary(mockPlayer.contract.salary)}/yr
            </Text>
          </View>
          <View style={styles.contractItem}>
            <Text style={[styles.contractLabel, { color: colors.textMuted }]}>Contract</Text>
            <Text style={[styles.contractValue, { color: colors.text }]}>
              {mockPlayer.contract.yearsRemaining} years
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Card */}
      <View style={[styles.statsCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Season Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {mockPlayer.stats.gamesPlayed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>GP</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {mockPlayer.stats.pointsPerGame}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>PPG</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {mockPlayer.stats.reboundsPerGame}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>RPG</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {mockPlayer.stats.assistsPerGame}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>APG</Text>
          </View>
        </View>
      </View>

      {/* Attributes */}
      {renderAttributeCategory('Physical', attributeCategories.physical, '#3B82F6')}
      {renderAttributeCategory('Mental', attributeCategories.mental, '#8B5CF6')}
      {renderAttributeCategory('Technical', attributeCategories.technical, '#10B981')}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.releaseButton, { borderColor: colors.error }]}
          onPress={() => setShowReleaseConfirm(true)}
        >
          <Text style={[styles.releaseText, { color: colors.error }]}>
            Release Player
          </Text>
        </TouchableOpacity>
      </View>

      {/* Release Confirmation */}
      <ConfirmationModal
        visible={showReleaseConfirm}
        title="Release Player?"
        message={`Are you sure you want to release ${mockPlayer.name}? This action cannot be undone.`}
        confirmText="Release"
        cancelText="Cancel"
        confirmStyle="destructive"
        onConfirm={handleRelease}
        onCancel={() => setShowReleaseConfirm(false)}
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
  headerCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
  },
  playerPosition: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  overallContainer: {
    alignItems: 'center',
  },
  overallValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  overallLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  contractInfo: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  contractItem: {
    flex: 1,
  },
  contractLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  contractValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  categoryCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  attributesGrid: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attributeName: {
    fontSize: 12,
    flex: 1,
  },
  attributeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attributeBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  attributeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  attributeValue: {
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  actions: {
    gap: spacing.md,
  },
  releaseButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  releaseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PlayerDetailScreen;
