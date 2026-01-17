/**
 * Training Focus Selector
 *
 * Hierarchical training focus selection component.
 * Replaces the physical/mental/technical slider system with:
 * - Balanced: Even XP distribution across all attributes
 * - Sport: Train attributes weighted by sport importance
 * - Skill: Train specific skills within a sport
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import { SegmentControl, type Segment } from '../common/SegmentControl';
import { Dropdown, type DropdownOption } from '../common/Dropdown';
import type {
  NewTrainingFocus,
  TrainingFocusLevel,
  SportFocusType,
  SkillFocusType,
  Player,
} from '../../../data/types';
import { getSkillsForSport } from '../../../utils/trainingFocusMapper';
import { calculateAllOveralls } from '../../../utils/overallRating';
import { calculateAllSkills } from '../../../utils/skillComposites';

// =============================================================================
// CONSTANTS
// =============================================================================

const LEVEL_SEGMENTS: Segment<TrainingFocusLevel>[] = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'sport', label: 'Sport' },
  { key: 'skill', label: 'Skill' },
];

const SPORT_OPTIONS: DropdownOption<SportFocusType>[] = [
  { value: 'basketball', label: 'Basketball' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'soccer', label: 'Soccer' },
];

const SPORT_COLORS: Record<SportFocusType, string> = {
  basketball: '#FF6B35', // Orange
  baseball: '#3B82F6',   // Blue
  soccer: '#10B981',     // Green
};

const SPORT_ICONS: Record<SportFocusType, string> = {
  basketball: '🏀',
  baseball: '⚾',
  soccer: '⚽',
};

// =============================================================================
// TYPES
// =============================================================================

interface TrainingFocusSelectorProps {
  focus: NewTrainingFocus;
  onChange: (focus: NewTrainingFocus) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Optional player to show sport/skill ratings */
  player?: Player;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TrainingFocusSelector({
  focus,
  onChange,
  disabled = false,
  compact = false,
  player,
}: TrainingFocusSelectorProps) {
  const colors = useColors();

  // Get current selections
  const currentLevel = focus.level;
  const currentSport = focus.sport ?? 'basketball';
  const currentSkill = focus.skill?.skill ?? '';

  // Get skills for current sport
  const skillOptions = useMemo((): DropdownOption<string>[] => {
    const skills = getSkillsForSport(currentSport);
    return skills.map((skill) => ({ value: skill, label: skill }));
  }, [currentSport]);

  // Calculate sport overalls if player provided
  const sportOveralls = useMemo(() => {
    if (!player) return null;
    return calculateAllOveralls(player);
  }, [player]);

  // Calculate skill ratings for current sport if player provided
  const skillRatings = useMemo(() => {
    if (!player) return null;
    const skills = calculateAllSkills(player.attributes, currentSport);
    return Object.fromEntries(skills.map(s => [s.name, s.value]));
  }, [player, currentSport]);

  // Handle level change
  const handleLevelChange = useCallback(
    (level: TrainingFocusLevel) => {
      if (disabled) return;

      if (level === 'balanced') {
        onChange({ level: 'balanced' });
      } else if (level === 'sport') {
        onChange({ level: 'sport', sport: currentSport });
      } else {
        // skill level - need a default skill
        const skills = getSkillsForSport(currentSport);
        const defaultSkill = skills[0] || 'Shooting';
        onChange({
          level: 'skill',
          sport: currentSport,
          skill: { sport: currentSport, skill: defaultSkill } as SkillFocusType,
        });
      }
    },
    [disabled, onChange, currentSport]
  );

  // Handle sport change
  const handleSportChange = useCallback(
    (sport: SportFocusType) => {
      if (disabled) return;

      if (currentLevel === 'sport') {
        onChange({ level: 'sport', sport });
      } else if (currentLevel === 'skill') {
        // When sport changes, reset skill to first available
        const skills = getSkillsForSport(sport);
        const defaultSkill = skills[0] || 'Shooting';
        onChange({
          level: 'skill',
          sport,
          skill: { sport, skill: defaultSkill } as SkillFocusType,
        });
      }
    },
    [disabled, onChange, currentLevel]
  );

  // Handle skill change
  const handleSkillChange = useCallback(
    (skill: string) => {
      if (disabled) return;

      onChange({
        level: 'skill',
        sport: currentSport,
        skill: { sport: currentSport, skill } as SkillFocusType,
      });
    },
    [disabled, onChange, currentSport]
  );

  // Get description text for current focus
  const focusDescription = useMemo(() => {
    switch (currentLevel) {
      case 'balanced':
        return 'Training evenly distributed across all attributes';
      case 'sport':
        return `Training weighted for ${currentSport} performance`;
      case 'skill':
        return `Focused training on ${currentSkill} attributes`;
      default:
        return '';
    }
  }, [currentLevel, currentSport, currentSkill]);

  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {/* Level Selection */}
      <SegmentControl
        segments={LEVEL_SEGMENTS}
        selectedKey={currentLevel}
        onChange={handleLevelChange}
        size={compact ? 'compact' : 'default'}
      />

      {/* Sport Selection (for Sport and Skill levels) */}
      {(currentLevel === 'sport' || currentLevel === 'skill') && (
        <View style={styles.sportSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            SPORT
          </Text>
          <View style={styles.sportButtons}>
            {SPORT_OPTIONS.map((option) => {
              const isSelected = option.value === currentSport;
              const sportColor = SPORT_COLORS[option.value];
              const sportRating = sportOveralls?.[option.value];

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sportButton,
                    {
                      backgroundColor: isSelected
                        ? sportColor + '20'
                        : colors.surface,
                      borderColor: isSelected ? sportColor : colors.border,
                    },
                  ]}
                  onPress={() => handleSportChange(option.value)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sportIcon}>
                    {SPORT_ICONS[option.value]}
                  </Text>
                  <Text
                    style={[
                      styles.sportLabel,
                      { color: isSelected ? sportColor : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sportRating !== undefined && (
                    <Text
                      style={[
                        styles.sportRating,
                        { color: isSelected ? sportColor : colors.textMuted },
                      ]}
                    >
                      {sportRating}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Skill Selection (for Skill level only) */}
      {currentLevel === 'skill' && (
        <View style={styles.skillSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            SKILL FOCUS
          </Text>
          {skillRatings ? (
            // Show skill chips with ratings when player is provided
            <View style={styles.skillChips}>
              {skillOptions.map((option) => {
                const isSelected = option.value === currentSkill;
                const sportColor = SPORT_COLORS[currentSport];
                const rating = skillRatings[option.value] ?? 0;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.skillChip,
                      {
                        backgroundColor: isSelected
                          ? sportColor + '20'
                          : colors.surface,
                        borderColor: isSelected ? sportColor : colors.border,
                      },
                    ]}
                    onPress={() => handleSkillChange(option.value)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.skillChipText,
                        { color: isSelected ? sportColor : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.skillChipRating,
                        { color: isSelected ? sportColor : colors.textMuted },
                      ]}
                    >
                      {rating}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // Fallback to dropdown when no player
            <Dropdown
              options={skillOptions}
              selectedValue={currentSkill}
              onSelect={handleSkillChange}
              placeholder="Select skill..."
              size={compact ? 'compact' : 'default'}
              disabled={disabled}
            />
          )}
        </View>
      )}

      {/* Description */}
      <View
        style={[
          styles.descriptionContainer,
          { backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {focusDescription}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  containerCompact: {
    gap: spacing.sm,
  },
  sportSection: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sportButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sportButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  sportIcon: {
    fontSize: 16,
  },
  sportLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sportRating: {
    fontSize: 18,
    fontWeight: '700',
  },
  skillSection: {
    marginTop: spacing.xs,
  },
  skillChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  skillChipRating: {
    fontSize: 14,
    fontWeight: '700',
  },
  descriptionContainer: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  description: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TrainingFocusSelector;
