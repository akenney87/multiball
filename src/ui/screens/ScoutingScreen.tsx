/**
 * Scouting Screen
 *
 * UI for scouting players with depth vs breadth controls.
 * Shows scout reports with attribute ranges.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../theme';
import type { ScoutReport, AttributeRange } from '../../systems/scoutingSystem';
import { getExpectedValue } from '../../systems/scoutingSystem';
import type { ScoutInstructions } from '../context/types';
import { ScoutInstructionsModal } from '../components/scouting';

// =============================================================================
// TYPES
// =============================================================================

export interface ScoutTarget {
  id: string;
  name: string;
  age: number;
  teamName: string;
  isScoutable: boolean;
}

export interface ScoutingScreenProps {
  // Settings
  depthSlider: number;
  budgetMultiplier: number;
  simultaneousScouts: number;
  playersScoutedPerWeek: number;
  scoutingBudgetPct: number;

  // Scout Instructions
  scoutInstructions: ScoutInstructions;

  // Data
  scoutReports: ScoutReport[];
  availableTargets: ScoutTarget[];
  currentTargetIds: string[];

  // Callbacks
  onDepthChange: (value: number) => void;
  onAddTarget: (targetId: string) => void;
  onRemoveTarget: (targetId: string) => void;
  onScoutNow: () => void;
  onBudgetPress: () => void;
  onInstructionsChange: (instructions: ScoutInstructions) => void;
  onPlayerPress?: (playerId: string) => void;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface DepthSliderProps {
  value: number;
  onChange: (value: number) => void;
}

function DepthSlider({ value, onChange }: DepthSliderProps) {
  const colors = useColors();
  const presets = [
    { value: 0, label: 'Breadth' },
    { value: 0.25, label: '' },
    { value: 0.5, label: 'Balanced' },
    { value: 0.75, label: '' },
    { value: 1, label: 'Depth' },
  ];

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>
          Many Players (Broad)
        </Text>
        <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>
          Few Players (Deep)
        </Text>
      </View>
      <View style={styles.sliderTrack}>
        {presets.map((preset) => (
          <TouchableOpacity
            key={preset.value}
            style={[
              styles.sliderDot,
              {
                backgroundColor:
                  value === preset.value ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(preset.value)}
          >
            {preset.label ? (
              <Text
                style={[
                  styles.sliderDotLabel,
                  { color: value === preset.value ? colors.primary : colors.textMuted },
                ]}
              >
                {preset.label}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface AttributeRangeItemProps {
  range: AttributeRange;
}

function AttributeRangeItem({ range }: AttributeRangeItemProps) {
  const colors = useColors();
  const expected = getExpectedValue(range.min, range.max);

  // Format attribute name
  const formatName = (name: string) =>
    name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <View style={styles.attributeRow}>
      <Text style={[styles.attributeName, { color: colors.text }]}>
        {formatName(range.attributeName)}
      </Text>
      <View style={styles.attributeValue}>
        <Text style={[styles.rangeText, { color: colors.textMuted }]}>
          {range.min}-{range.max}
        </Text>
        <Text style={[styles.expectedText, { color: colors.primary }]}>
          ~{expected}
        </Text>
      </View>
    </View>
  );
}

interface ScoutReportCardProps {
  report: ScoutReport;
  onPress?: (playerId: string) => void;
}

function ScoutReportCard({ report, onPress }: ScoutReportCardProps) {
  const colors = useColors();

  // Use scoutingDepth if available, otherwise fall back to confidence
  const depthPct = report.scoutingDepth ?? 50;
  const isFullyScounted = depthPct >= 100;

  // Depth badge color: 100% = green, 75%+ = blue, 50%+ = yellow, <50% = gray
  const depthColor =
    depthPct >= 100
      ? colors.success
      : depthPct >= 75
      ? colors.primary
      : depthPct >= 50
      ? colors.warning
      : colors.textMuted;

  const confidenceLabel = isFullyScounted
    ? 'Complete'
    : depthPct >= 75
    ? 'High'
    : depthPct >= 50
    ? 'Medium'
    : 'Low';

  // Group attributes by category
  const physicalAttrs = report.attributeRanges.filter((r) =>
    [
      'grip_strength',
      'arm_strength',
      'core_strength',
      'agility',
      'acceleration',
      'top_speed',
      'jumping',
      'reactions',
      'stamina',
      'balance',
      'height',
      'durability',
    ].includes(r.attributeName)
  );

  const mentalAttrs = report.attributeRanges.filter((r) =>
    [
      'awareness',
      'creativity',
      'determination',
      'bravery',
      'consistency',
      'composure',
      'patience',
      'teamwork',
    ].includes(r.attributeName)
  );

  const technicalAttrs = report.attributeRanges.filter((r) =>
    [
      'hand_eye_coordination',
      'throw_accuracy',
      'form_technique',
      'finesse',
      'deception',
      'footwork',
    ].includes(r.attributeName)
  );

  return (
    <TouchableOpacity
      style={[styles.reportCard, { backgroundColor: colors.card }]}
      onPress={() => onPress?.(report.playerId)}
      activeOpacity={0.8}
    >
      {/* Depth Badge */}
      <View style={[styles.depthBadge, { backgroundColor: depthColor }]}>
        <Text style={styles.depthBadgeText}>
          {report.isTargeted ? 'TARGETED' : `${depthPct}%`}
        </Text>
      </View>

      {/* Header */}
      <View style={styles.reportHeader}>
        <View style={styles.reportInfo}>
          <Text style={[styles.reportName, { color: colors.text }]}>
            {report.playerName}
          </Text>
          <Text style={[styles.reportMeta, { color: colors.textMuted }]}>
            Age {report.age} • {report.primarySport}
          </Text>
        </View>
        <View style={styles.reportOverall}>
          {/* Show exact value if fully scouted, otherwise show range */}
          <Text style={[styles.overallRange, { color: colors.text }]}>
            {isFullyScounted
              ? report.estimatedOverallMin
              : `${report.estimatedOverallMin}-${report.estimatedOverallMax}`}
          </Text>
          <Text style={[styles.confidenceLabel, { color: depthColor }]}>
            {confidenceLabel}
          </Text>
        </View>
      </View>

      {/* Tap hint */}
      <Text style={[styles.tapHint, { color: colors.textMuted }]}>
        Tap for details
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ScoutingScreen({
  depthSlider,
  budgetMultiplier: _budgetMultiplier,
  simultaneousScouts: _simultaneousScouts,
  playersScoutedPerWeek,
  scoutingBudgetPct,
  scoutInstructions,
  scoutReports,
  availableTargets,
  currentTargetIds,
  onDepthChange,
  onAddTarget,
  onRemoveTarget,
  onScoutNow: _onScoutNow,
  onBudgetPress,
  onInstructionsChange,
  onPlayerPress,
}: ScoutingScreenProps) {
  // _onScoutNow reserved for future weekly scouting trigger
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<'reports' | 'targets'>('reports');
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Filter targets not already being scouted
  const unscoutedTargets = useMemo(
    () => availableTargets.filter((t) => !currentTargetIds.includes(t.id)),
    [availableTargets, currentTargetIds]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Summary */}
      <View style={[styles.statsBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.stat} onPress={onBudgetPress} activeOpacity={0.7}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {scoutingBudgetPct}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Budget</Text>
        </TouchableOpacity>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {playersScoutedPerWeek}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Per Week</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {currentTargetIds.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Targets</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {scoutReports.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reports</Text>
        </View>
      </View>

      {/* Scouting Strategy Section */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>
            Scouting Strategy
          </Text>
          <TouchableOpacity
            style={[styles.instructionsButton, { borderColor: colors.primary }]}
            onPress={() => setShowInstructionsModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.instructionsButtonText, { color: colors.primary }]}>
              Instructions
            </Text>
          </TouchableOpacity>
        </View>
        <DepthSlider value={depthSlider} onChange={onDepthChange} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'reports' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('reports')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'reports' ? colors.primary : colors.textMuted },
            ]}
          >
            Reports ({scoutReports.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'targets' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('targets')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'targets' ? colors.primary : colors.textMuted },
            ]}
          >
            Targets ({currentTargetIds.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'reports' ? (
        <FlatList
          data={scoutReports}
          keyExtractor={(item) => item.playerId}
          renderItem={({ item }) => <ScoutReportCard report={item} onPress={onPlayerPress} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No scout reports yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Add targets and wait for weekly scouting results
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={unscoutedTargets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.targetCard, { backgroundColor: colors.card }]}
              onPress={() => onAddTarget(item.id)}
            >
              <View>
                <Text style={[styles.targetName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.targetMeta, { color: colors.textMuted }]}>
                  Age {item.age} • {item.teamName}
                </Text>
              </View>
              <Text style={[styles.addButton, { color: colors.primary }]}>+ Add</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            currentTargetIds.length > 0 ? (
              <View style={styles.currentTargetsSection}>
                <Text style={[styles.currentTargetsTitle, { color: colors.text }]}>
                  Currently Scouting ({currentTargetIds.length})
                </Text>
                {currentTargetIds.map((id) => {
                  const target = availableTargets.find((t) => t.id === id);
                  if (!target) return null;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.currentTargetCard, { backgroundColor: colors.card }]}
                      onPress={() => onRemoveTarget(id)}
                    >
                      <View>
                        <Text style={[styles.targetName, { color: colors.text }]}>
                          {target.name}
                        </Text>
                        <Text style={[styles.targetMeta, { color: colors.textMuted }]}>
                          Age {target.age} • {target.teamName}
                        </Text>
                      </View>
                      <Text style={[styles.removeButton, { color: colors.error }]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[styles.availableTitle, { color: colors.text }]}>
                  Available Players
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No more players to scout
              </Text>
            </View>
          }
        />
      )}

      {/* Scout Instructions Modal */}
      <ScoutInstructionsModal
        visible={showInstructionsModal}
        instructions={scoutInstructions}
        onSave={(instructions) => {
          onInstructionsChange(instructions);
          setShowInstructionsModal(false);
        }}
        onCancel={() => setShowInstructionsModal(false)}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionsButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
  },
  instructionsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderContainer: {
    marginTop: spacing.xs,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sliderLabel: {
    fontSize: 11,
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
  },
  sliderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderDotLabel: {
    position: 'absolute',
    top: 28,
    fontSize: 10,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  reportCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  depthBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  depthBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  reportInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  reportName: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  reportOverall: {
    alignItems: 'flex-end',
  },
  overallRange: {
    fontSize: 18,
    fontWeight: '700',
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  reportExpanded: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  sectionContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  attributeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  attributeName: {
    fontSize: 13,
  },
  attributeValue: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeText: {
    fontSize: 13,
  },
  expectedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sportName: {
    fontSize: 13,
    fontWeight: '500',
  },
  sportRange: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoutedWeek: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  targetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  targetName: {
    fontSize: 15,
    fontWeight: '600',
  },
  targetMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentTargetsSection: {
    marginBottom: spacing.md,
  },
  currentTargetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  currentTargetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  availableTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 11,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default ScoutingScreen;
