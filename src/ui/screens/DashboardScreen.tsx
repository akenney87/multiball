/**
 * Dashboard Screen (Home)
 *
 * Main screen showing:
 * - Next match preview
 * - Budget summary
 * - Quick actions
 * - Recent news
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';

export function DashboardScreen() {
  const colors = useColors();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.teamName, { color: colors.text }]}>My Team</Text>
        <Text style={[styles.budget, { color: colors.textSecondary }]}>$5,000,000</Text>
      </View>

      {/* Next Match Card */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>NEXT MATCH</Text>
        <View style={styles.matchPreview}>
          <Text style={[styles.opponent, { color: colors.text }]}>vs Opponent Team</Text>
          <Text style={[styles.matchInfo, { color: colors.textSecondary }]}>
            Week 5 - Basketball
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.textInverse }]}>Preview Match</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.card }, shadows.sm]}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>Sim Match</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.card }, shadows.sm]}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>Advance Week</Text>
        </TouchableOpacity>
      </View>

      {/* Alerts Section */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>ALERTS</Text>
        <View style={styles.alertItem}>
          <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            Player X injured (2 weeks)
          </Text>
        </View>
        <View style={styles.alertItem}>
          <View style={[styles.alertDot, { backgroundColor: colors.info }]} />
          <Text style={[styles.alertText, { color: colors.text }]}>Contract expiring: Player Y</Text>
        </View>
      </View>

      {/* Recent News */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>RECENT NEWS</Text>
        <Text style={[styles.newsItem, { color: colors.textSecondary }]}>
          No recent events yet
        </Text>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  budget: {
    fontSize: 16,
    fontWeight: '500',
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  matchPreview: {
    marginBottom: spacing.lg,
  },
  opponent: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  matchInfo: {
    fontSize: 14,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.md,
  },
  alertText: {
    fontSize: 14,
  },
  newsItem: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default DashboardScreen;
