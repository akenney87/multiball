/**
 * Youth Academy Screen
 *
 * Two main sections:
 * 1. Scouting Reports - prospects with attribute ranges to evaluate
 * 2. Academy Roster - signed prospects (starts empty)
 *
 * Scouting Flow:
 * - New reports every 4 weeks
 * - Attributes shown as ranges (e.g., 20-40)
 * - Continue Scouting narrows range (risk: rival may sign)
 * - Sign adds to academy ($100k/year cost)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../theme';
import type {
  ScoutingReport,
  AcademyProspect,
  AcademyInfo,
  AttributeRange,
} from '../../systems/youthAcademySystem';
import {
  formatHeight,
  formatWeight,
  formatAttributeRange,
  getScoutingProgressDescription,
  getRangeUncertaintyDescription,
  PHYSICAL_ATTRIBUTES,
  MENTAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTES,
  WEEKLY_PROSPECT_COST,
  MAX_SCOUTING_WEEKS,
} from '../../systems/youthAcademySystem';

// =============================================================================
// TYPES
// =============================================================================

export interface YouthAcademyScreenProps {
  // Scouting
  scoutingReports: ScoutingReport[];
  weeksUntilNextReports: number;
  currentWeek: number;

  // Academy
  academyInfo: AcademyInfo;
  academyProspects: AcademyProspect[];
  prospectsNeedingAction: AcademyProspect[];

  // Actions
  onContinueScouting: (reportId: string) => void;
  onStopScouting: (reportId: string) => void;
  onSignProspect: (reportId: string) => void;
  onPromoteProspect: (prospectId: string) => void;
  onReleaseProspect: (prospectId: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatAttributeName(attr: string): string {
  return attr
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getRangeColor(range: AttributeRange, colors: any): string {
  const avg = (range.min + range.max) / 2;
  if (avg >= 60) return colors.success;
  if (avg >= 40) return colors.primary;
  if (avg >= 25) return colors.warning;
  return colors.error;
}

function getAttributeColor(value: number, colors: any): string {
  if (value >= 60) return colors.success;
  if (value >= 40) return colors.primary;
  if (value >= 25) return colors.warning;
  return colors.error;
}

function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  return `$${(amount / 1000).toFixed(0)}K`;
}

// =============================================================================
// SCOUTING REPORT DETAIL MODAL
// =============================================================================

interface ScoutingReportModalProps {
  report: ScoutingReport | null;
  visible: boolean;
  onClose: () => void;
  onContinueScouting: () => void;
  onStopScouting: () => void;
  onSign: () => void;
  canSign: boolean;
  currentWeek: number;
}

function ScoutingReportModal({
  report,
  visible,
  onClose,
  onContinueScouting,
  onStopScouting,
  onSign,
  canSign,
  currentWeek,
}: ScoutingReportModalProps) {
  const colors = useColors();

  if (!report) return null;

  const canContinueScouting = report.weeksScouted < MAX_SCOUTING_WEEKS;

  const renderAttributeSection = (title: string, attrKeys: string[]) => (
    <View style={styles.attrSection}>
      <Text style={[styles.attrSectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={styles.attrGrid}>
        {attrKeys.map((attr) => {
          const range = report.attributeRanges[attr];
          if (!range) return null;
          return (
            <View key={attr} style={styles.attrItem}>
              <Text style={[styles.attrName, { color: colors.textMuted }]}>
                {formatAttributeName(attr)}
              </Text>
              <Text style={[styles.attrRange, { color: getRangeColor(range, colors) }]}>
                {formatAttributeRange(range)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Scouting Report</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Player Header */}
          <View style={[styles.playerHeader, { backgroundColor: colors.card }]}>
            <Text style={[styles.playerName, { color: colors.text }]}>{report.name}</Text>
            <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
              Age {report.age} • {formatHeight(report.height)} • {formatWeight(report.weight)}
            </Text>
            <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
              {report.nationality}
            </Text>
          </View>

          {/* Scouting Progress */}
          <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Report Quality</Text>
                <Text style={[styles.progressValue, { color: colors.text }]}>
                  {getScoutingProgressDescription(report.weeksScouted)}
                </Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Accuracy</Text>
                <Text style={[styles.progressValue, { color: colors.text }]}>
                  {getRangeUncertaintyDescription(report.weeksScouted)}
                </Text>
              </View>
            </View>
            <Text style={[styles.progressHint, { color: colors.textMuted }]}>
              {report.weeksScouted < MAX_SCOUTING_WEEKS
                ? 'Continue scouting to narrow attribute ranges (risk: rival may sign)'
                : 'Maximum scouting reached - sign or pass'}
            </Text>
          </View>

          {/* Attributes */}
          <View style={[styles.attributesCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Estimated Attributes</Text>
            <Text style={[styles.rangeNote, { color: colors.textMuted }]}>
              Ranges narrow with more scouting
            </Text>
            {renderAttributeSection('Physical', PHYSICAL_ATTRIBUTES)}
            {renderAttributeSection('Mental', MENTAL_ATTRIBUTES)}
            {renderAttributeSection('Technical', TECHNICAL_ATTRIBUTES)}
          </View>

          {/* Signing Cost */}
          <View style={[styles.costCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.costLabel, { color: colors.textMuted }]}>Signing Cost</Text>
            <Text style={[styles.costValue, { color: colors.text }]}>
              {formatMoney(WEEKLY_PROSPECT_COST * 52)}/year
            </Text>
            <Text style={[styles.costNote, { color: colors.textMuted }]}>
              (~{formatMoney(WEEKLY_PROSPECT_COST)}/week)
            </Text>
          </View>

          {/* Report Age */}
          {(() => {
            const reportAge = currentWeek - report.lastUpdatedWeek;
            return reportAge > 0 ? (
              <View style={[styles.ageCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.ageLabel, { color: colors.textMuted }]}>Report Age</Text>
                <Text style={[styles.ageValue, { color: reportAge >= 3 ? colors.warning : colors.text }]}>
                  {reportAge} week{reportAge !== 1 ? 's' : ''} since last update
                </Text>
              </View>
            ) : null;
          })()}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            {canContinueScouting && report.status !== 'scouting' && (
              <TouchableOpacity
                style={[styles.scoutButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                onPress={() => { onContinueScouting(); onClose(); }}
              >
                <Text style={[styles.scoutButtonText, { color: colors.primary }]}>
                  Continue Scouting (auto until max)
                </Text>
              </TouchableOpacity>
            )}
            {report.status === 'scouting' && (
              <TouchableOpacity
                style={[styles.scoutButton, { backgroundColor: colors.surface, borderColor: colors.warning }]}
                onPress={() => { onStopScouting(); onClose(); }}
              >
                <Text style={[styles.scoutButtonText, { color: colors.warning }]}>
                  Stop Scouting
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.signButton,
                { backgroundColor: canSign ? colors.success : colors.surface },
              ]}
              onPress={() => {
                if (canSign) {
                  onSign();
                  onClose();
                } else {
                  Alert.alert('Academy Full', 'Release or promote a prospect to make room.');
                }
              }}
              disabled={!canSign}
            >
              <Text style={[styles.signButtonText, { color: canSign ? '#FFF' : colors.textMuted }]}>
                {canSign ? 'Sign to Academy' : 'Academy Full'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// ACADEMY PROSPECT DETAIL MODAL
// =============================================================================

interface AcademyProspectModalProps {
  prospect: AcademyProspect | null;
  visible: boolean;
  onClose: () => void;
  onPromote: () => void;
  onRelease: () => void;
  needsAction: boolean;
}

function AcademyProspectModal({
  prospect,
  visible,
  onClose,
  onPromote,
  onRelease,
  needsAction,
}: AcademyProspectModalProps) {
  const colors = useColors();

  if (!prospect) return null;

  const handlePromote = () => {
    Alert.alert(
      'Promote to Main Squad',
      `Promote ${prospect.name} to the main roster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Promote', onPress: () => { onPromote(); onClose(); } },
      ]
    );
  };

  const handleRelease = () => {
    Alert.alert(
      'Release Prospect',
      `Release ${prospect.name} from the academy? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release', style: 'destructive', onPress: () => { onRelease(); onClose(); } },
      ]
    );
  };

  const renderAttributeSection = (title: string, attrKeys: string[]) => (
    <View style={styles.attrSection}>
      <Text style={[styles.attrSectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={styles.attrGrid}>
        {attrKeys.map((attr) => {
          const value = prospect.attributes[attr];
          if (value === undefined) return null;
          return (
            <View key={attr} style={styles.attrItem}>
              <Text style={[styles.attrName, { color: colors.textMuted }]}>
                {formatAttributeName(attr)}
              </Text>
              <Text style={[styles.attrValue, { color: getAttributeColor(value, colors) }]}>
                {value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Academy Prospect</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Player Header */}
          <View style={[styles.playerHeader, { backgroundColor: colors.card }]}>
            <Text style={[styles.playerName, { color: colors.text }]}>{prospect.name}</Text>
            <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
              Age {prospect.age} • {formatHeight(prospect.height)} • {formatWeight(prospect.weight)}
            </Text>
            <Text style={[styles.playerMeta, { color: colors.textMuted }]}>
              {prospect.nationality}
            </Text>

            {needsAction && (
              <View style={[styles.urgentBanner, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.urgentText, { color: colors.warning }]}>
                  Turning 19 - must promote or release
                </Text>
              </View>
            )}
          </View>

          {/* Academy Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>In Academy</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {prospect.yearsInAcademy === 0 ? 'New' : `${prospect.yearsInAcademy} year${prospect.yearsInAcademy !== 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Weekly Cost</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatMoney(prospect.weeklyCost)}
                </Text>
              </View>
            </View>
          </View>

          {/* Attributes */}
          <View style={[styles.attributesCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Attributes</Text>
            {renderAttributeSection('Physical', PHYSICAL_ATTRIBUTES)}
            {renderAttributeSection('Mental', MENTAL_ATTRIBUTES)}
            {renderAttributeSection('Technical', TECHNICAL_ATTRIBUTES)}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.promoteButton, { backgroundColor: colors.primary }]}
              onPress={handlePromote}
            >
              <Text style={styles.promoteButtonText}>Promote to Main Squad</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.releaseButton, { borderColor: colors.error }]}
              onPress={handleRelease}
            >
              <Text style={[styles.releaseButtonText, { color: colors.error }]}>Release from Academy</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function YouthAcademyScreen({
  scoutingReports,
  weeksUntilNextReports,
  currentWeek,
  academyInfo,
  academyProspects,
  prospectsNeedingAction,
  onContinueScouting,
  onStopScouting,
  onSignProspect,
  onPromoteProspect,
  onReleaseProspect,
}: YouthAcademyScreenProps) {
  const colors = useColors();
  const [selectedReport, setSelectedReport] = useState<ScoutingReport | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<AcademyProspect | null>(null);

  const activeProspects = academyProspects.filter(p => p.status === 'active');
  const needsActionIds = new Set(prospectsNeedingAction.map(p => p.id));

  // Filter out signed/rival reports, show available and scouting
  const visibleReports = scoutingReports.filter(
    r => r.status === 'available' || r.status === 'scouting'
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Academy Info Bar */}
      <View style={[styles.infoBar, { backgroundColor: colors.card }]}>
        <View style={styles.infoBarItem}>
          <Text style={[styles.infoBarValue, { color: colors.text }]}>
            {academyInfo.usedSlots}/{academyInfo.totalSlots}
          </Text>
          <Text style={[styles.infoBarLabel, { color: colors.textMuted }]}>Academy</Text>
        </View>
        <View style={styles.infoBarItem}>
          <Text style={[styles.infoBarValue, { color: academyInfo.availableSlots > 0 ? colors.success : colors.error }]}>
            {academyInfo.availableSlots}
          </Text>
          <Text style={[styles.infoBarLabel, { color: colors.textMuted }]}>Available</Text>
        </View>
        <View style={styles.infoBarItem}>
          <Text style={[styles.infoBarValue, { color: colors.text }]}>
            {formatMoney(academyInfo.weeklyMaintenanceCost)}
          </Text>
          <Text style={[styles.infoBarLabel, { color: colors.textMuted }]}>Weekly Cost</Text>
        </View>
      </View>

      {/* Scouting Reports Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Scouting Reports</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            {weeksUntilNextReports === 0
              ? 'New reports available now'
              : `New reports in ${weeksUntilNextReports} week${weeksUntilNextReports !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {visibleReports.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No scouting reports available
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              New prospects are scouted every 4 weeks.
              {'\n'}Increase Youth Development budget for more reports.
            </Text>
          </View>
        ) : (
          visibleReports.map((report) => {
            const reportAge = currentWeek - report.lastUpdatedWeek;
            return (
              <TouchableOpacity
                key={report.id}
                style={[styles.reportCard, { backgroundColor: colors.card }]}
                onPress={() => setSelectedReport(report)}
                activeOpacity={0.7}
              >
                <View style={styles.reportHeader}>
                  <View>
                    <Text style={[styles.reportName, { color: colors.text }]}>{report.name}</Text>
                    <Text style={[styles.reportMeta, { color: colors.textMuted }]}>
                      Age {report.age} • {formatHeight(report.height)} • {report.nationality}
                    </Text>
                  </View>
                  <View style={styles.reportBadge}>
                    <Text style={[styles.reportBadgeText, { color: colors.textMuted }]}>
                      {getScoutingProgressDescription(report.weeksScouted)}
                    </Text>
                  </View>
                </View>
                <View style={styles.reportStatusRow}>
                  {report.status === 'scouting' ? (
                    <Text style={[styles.scoutingLabel, { color: colors.primary }]}>
                      Scouting in progress...
                    </Text>
                  ) : reportAge > 0 ? (
                    <Text style={[styles.reportAge, { color: colors.textMuted }]}>
                      Report {reportAge} week{reportAge !== 1 ? 's' : ''} old
                    </Text>
                  ) : (
                    <Text style={[styles.reportAge, { color: colors.success }]}>
                      Fresh report
                    </Text>
                  )}
                </View>
                <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to view report</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Academy Roster Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Academy Roster</Text>
          {prospectsNeedingAction.length > 0 && (
            <View style={[styles.alertBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.alertBadgeText}>{prospectsNeedingAction.length} need action</Text>
            </View>
          )}
        </View>

        {activeProspects.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No prospects in academy
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Sign prospects from scouting reports to fill your academy.
              {'\n'}Each prospect costs {formatMoney(WEEKLY_PROSPECT_COST * 52)}/year.
            </Text>
          </View>
        ) : (
          activeProspects.map((prospect) => {
            const needsAction = needsActionIds.has(prospect.id);
            return (
              <TouchableOpacity
                key={prospect.id}
                style={[
                  styles.prospectCard,
                  { backgroundColor: colors.card },
                  needsAction && { borderLeftWidth: 3, borderLeftColor: colors.warning },
                ]}
                onPress={() => setSelectedProspect(prospect)}
                activeOpacity={0.7}
              >
                <View style={styles.prospectHeader}>
                  <View>
                    <View style={styles.nameRow}>
                      <Text style={[styles.prospectName, { color: colors.text }]}>{prospect.name}</Text>
                      {needsAction && (
                        <View style={[styles.attentionBadge, { backgroundColor: colors.warning }]}>
                          <Text style={styles.attentionText}>!</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.prospectMeta, { color: colors.textMuted }]}>
                      Age {prospect.age} • {formatHeight(prospect.height)} • {prospect.nationality}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.prospectCost, { color: colors.textMuted }]}>
                      {formatMoney(prospect.weeklyCost)}/wk
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap for details</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: spacing.xl * 2 }} />

      {/* Modals */}
      <ScoutingReportModal
        report={selectedReport}
        visible={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        onContinueScouting={() => selectedReport && onContinueScouting(selectedReport.id)}
        onStopScouting={() => selectedReport && onStopScouting(selectedReport.id)}
        onSign={() => selectedReport && onSignProspect(selectedReport.id)}
        canSign={academyInfo.availableSlots > 0}
        currentWeek={currentWeek}
      />

      <AcademyProspectModal
        prospect={selectedProspect}
        visible={selectedProspect !== null}
        onClose={() => setSelectedProspect(null)}
        onPromote={() => selectedProspect && onPromoteProspect(selectedProspect.id)}
        onRelease={() => selectedProspect && onReleaseProspect(selectedProspect.id)}
        needsAction={selectedProspect ? needsActionIds.has(selectedProspect.id) : false}
      />
    </ScrollView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    width: 60,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
  },
  playerHeader: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
  },
  playerMeta: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  urgentBanner: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  urgentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  progressRow: {
    flexDirection: 'row',
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressHint: {
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  attributesCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  rangeNote: {
    fontSize: 12,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  attrSection: {
    marginBottom: spacing.md,
  },
  attrSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  attrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attrItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  attrName: {
    fontSize: 13,
  },
  attrRange: {
    fontSize: 13,
    fontWeight: '600',
  },
  attrValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  costCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  costValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  costNote: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  ageCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ageLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  ageValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  scoutButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  scoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  promoteButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  promoteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  releaseButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  releaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBar: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoBarItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoBarValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBarLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  alertBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  alertBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  reportCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportName: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  reportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reportBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  scoutingLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  reportStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reportAge: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  prospectCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  prospectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prospectName: {
    fontSize: 16,
    fontWeight: '600',
  },
  attentionBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attentionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  prospectMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  prospectCost: {
    fontSize: 12,
  },
  tapHint: {
    fontSize: 11,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default YouthAcademyScreen;
