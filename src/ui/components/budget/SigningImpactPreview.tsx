/**
 * Signing Impact Preview Component
 *
 * Displays the budget impact of signing a player, showing:
 * - Current and projected operations pool
 * - Impact on each budget category (training, scouting, facilities, youth)
 * - Visual indication of reductions
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import {
  SigningImpact,
  formatBudgetAmount,
} from '../../../systems/budgetAllocation';

interface SigningImpactPreviewProps {
  /** The signing impact data */
  impact: SigningImpact;
  /** Player name (optional) */
  playerName?: string;
  /** Proposed salary amount */
  salary: number;
  /** Whether to show a compact version */
  compact?: boolean;
}

const categoryLabels = {
  training: 'Training',
  scouting: 'Scouting',
  medical: 'Medical',
  youthDevelopment: 'Youth Dev',
};

const categoryColors = {
  training: '#3B82F6',
  scouting: '#10B981',
  medical: '#8B5CF6',
  youthDevelopment: '#F59E0B',
};

export function SigningImpactPreview({
  impact,
  playerName,
  salary,
  compact = false,
}: SigningImpactPreviewProps) {
  const colors = useColors();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.compactTitle, { color: colors.text }]}>
          Budget Impact
        </Text>
        <View style={styles.compactRow}>
          <Text style={[styles.compactLabel, { color: colors.textMuted }]}>
            Operations Pool:
          </Text>
          <Text style={[styles.compactValue, { color: colors.text }]}>
            {formatBudgetAmount(impact.currentPool)} {' '}
            <Text style={{ color: colors.error }}>
              {formatBudgetAmount(impact.poolChange)}
            </Text>
          </Text>
        </View>
        <View style={styles.compactImpacts}>
          {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]).map((key) => {
            const categoryImpact = impact.categoryImpacts[key];
            return (
              <View key={key} style={styles.compactImpactItem}>
                <View style={[styles.compactDot, { backgroundColor: categoryColors[key] }]} />
                <Text style={[styles.compactImpactText, { color: colors.error }]}>
                  {formatBudgetAmount(categoryImpact.change)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Signing Impact Preview
      </Text>

      {playerName && (
        <Text style={[styles.playerName, { color: colors.textSecondary }]}>
          {playerName}
        </Text>
      )}

      <View style={styles.salaryRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          Annual Salary:
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {formatBudgetAmount(salary)}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Operations Pool Impact */}
      <View style={styles.poolSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Operations Pool
        </Text>
        <View style={styles.poolRow}>
          <View style={styles.poolItem}>
            <Text style={[styles.poolLabel, { color: colors.textMuted }]}>Current</Text>
            <Text style={[styles.poolValue, { color: colors.text }]}>
              {formatBudgetAmount(impact.currentPool)}
            </Text>
          </View>
          <Text style={[styles.poolArrow, { color: colors.textMuted }]}>→</Text>
          <View style={styles.poolItem}>
            <Text style={[styles.poolLabel, { color: colors.textMuted }]}>After</Text>
            <Text style={[styles.poolValue, { color: colors.warning }]}>
              {formatBudgetAmount(impact.newPool)}
            </Text>
          </View>
          <View style={styles.poolItem}>
            <Text style={[styles.poolLabel, { color: colors.textMuted }]}>Change</Text>
            <Text style={[styles.poolChange, { color: colors.error }]}>
              {formatBudgetAmount(impact.poolChange)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Category Impacts */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Budget Category Impacts
      </Text>

      {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]).map((key) => {
        const categoryImpact = impact.categoryImpacts[key];
        return (
          <View key={key} style={styles.categoryRow}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryDot, { backgroundColor: categoryColors[key] }]} />
              <Text style={[styles.categoryLabel, { color: colors.text }]}>
                {categoryLabels[key]}
              </Text>
            </View>
            <View style={styles.categoryValues}>
              <Text style={[styles.categoryBefore, { color: colors.textMuted }]}>
                {formatBudgetAmount(categoryImpact.current)}
              </Text>
              <Text style={[styles.categoryArrow, { color: colors.textMuted }]}>→</Text>
              <Text style={[styles.categoryAfter, { color: colors.warning }]}>
                {formatBudgetAmount(categoryImpact.after)}
              </Text>
              <Text style={[styles.categoryChange, { color: colors.error }]}>
                ({formatBudgetAmount(categoryImpact.change)})
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  playerName: {
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  poolSection: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poolItem: {
    alignItems: 'center',
  },
  poolLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  poolValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  poolArrow: {
    fontSize: 16,
    marginHorizontal: spacing.xs,
  },
  poolChange: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBefore: {
    fontSize: 12,
    width: 50,
    textAlign: 'right',
  },
  categoryArrow: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  categoryAfter: {
    fontSize: 12,
    fontWeight: '500',
    width: 50,
    textAlign: 'right',
  },
  categoryChange: {
    fontSize: 11,
    marginLeft: spacing.xs,
    width: 55,
    textAlign: 'right',
  },
  // Compact styles
  compactContainer: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  compactLabel: {
    fontSize: 11,
  },
  compactValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  compactImpacts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactImpactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  compactImpactText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default SigningImpactPreview;
