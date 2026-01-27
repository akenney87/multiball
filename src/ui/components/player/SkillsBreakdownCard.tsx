/**
 * Skills Breakdown Card
 *
 * Visual display of 5 skill composites per sport
 * with progress bars and ratings.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import { SegmentControl } from '../common';
import type { Player } from '../../../data/types';
import {
  calculateAllSkills,
  getSkillColor,
  type Sport,
  type CalculatedSkill,
} from '../../../utils/skillComposites';
import {
  calculateBasketballOverall,
  calculateBaseballOverall,
  calculateSoccerOverall,
} from '../../../utils/overallRating';

// =============================================================================
// TYPES
// =============================================================================

interface SkillsBreakdownCardProps {
  player: Player;
  /** If true, hide skills (for unscouted players) */
  hidden?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SkillsBreakdownCard({ player, hidden = false }: SkillsBreakdownCardProps) {
  const colors = useColors();
  const [selectedSport, setSelectedSport] = useState<Sport>('basketball');

  // Calculate skills for selected sport
  const skills = useMemo(() => {
    if (hidden) return [];
    return calculateAllSkills(player.attributes, selectedSport);
  }, [player.attributes, selectedSport, hidden]);

  // Get color for skill value
  const getBarColor = (value: number): string => {
    const colorKey = getSkillColor(value);
    switch (colorKey) {
      case 'excellent':
        return colors.success;
      case 'good':
        return '#22C55E'; // Light green
      case 'average':
        return colors.warning;
      case 'poor':
        return colors.error;
    }
  };

  // Get overall for selected sport (using same formula as rest of app)
  const sportOverall = useMemo(() => {
    if (hidden) return '??';
    switch (selectedSport) {
      case 'basketball':
        return calculateBasketballOverall(player.attributes);
      case 'baseball':
        return calculateBaseballOverall(player.attributes);
      case 'soccer':
        return calculateSoccerOverall(player.attributes);
    }
  }, [player.attributes, selectedSport, hidden]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Skills Breakdown</Text>
        <View style={styles.overallBadge}>
          <Text style={[styles.overallLabel, { color: colors.textMuted }]}>
            {selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)}
          </Text>
          <Text style={[styles.overallValue, { color: colors.primary }]}>
            {sportOverall}
          </Text>
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

      {/* Skills List */}
      {hidden ? (
        <View style={styles.hiddenContainer}>
          <Text style={[styles.hiddenText, { color: colors.textMuted }]}>
            Scout this player to reveal their skills
          </Text>
        </View>
      ) : (
        <View style={styles.skillsList}>
          {skills.map((skill, idx) => (
            <SkillBar
              key={idx}
              skill={skill}
              barColor={getBarColor(skill.value)}
              textColor={colors.text}
              mutedColor={colors.textMuted}
              bgColor={colors.surface}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SkillBarProps {
  skill: CalculatedSkill;
  barColor: string;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}

function SkillBar({ skill, barColor, textColor, mutedColor, bgColor }: SkillBarProps) {
  return (
    <View style={styles.skillItem}>
      <View style={styles.skillHeader}>
        <Text style={[styles.skillName, { color: textColor }]}>{skill.name}</Text>
        <Text style={[styles.skillValue, { color: barColor }]}>{skill.value}</Text>
      </View>
      <View style={[styles.barBackground, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.barFill,
            {
              backgroundColor: barColor,
              width: `${Math.min(skill.value, 100)}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.skillDescription, { color: mutedColor }]}>
        {skill.description}
      </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  overallBadge: {
    alignItems: 'flex-end',
  },
  overallLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  overallValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  sportTabs: {
    marginBottom: spacing.lg,
  },
  skillsList: {
    gap: spacing.md,
  },
  skillItem: {
    marginBottom: spacing.sm,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
  },
  skillValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  barBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  skillDescription: {
    fontSize: 10,
    marginTop: 2,
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

export default SkillsBreakdownCard;
