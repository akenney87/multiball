/**
 * Connected Youth Academy Screen
 *
 * Youth Academy screen connected to GameContext.
 * State is persisted in GameContext (survives app restarts).
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useColors, spacing } from '../theme';
import { YouthAcademyScreen } from './YouthAcademyScreen';
import { useGame } from '../context/GameContext';
import type { Player, Contract, PlayerAttributes, PlayerPotentials, PeakAges, TrainingFocus, WeeklyXP, PlayerCareerStats } from '../../data/types';
import {
  AcademyProspect,
  AcademyInfo,
  ScoutSportFocus,
  ScoutingRegion,
  getAcademyInfo,
  calculateAcademyCapacity,
  canSignProspect,
  signProspectToAcademy as createProspectFromReport,
  requestContinueScouting,
  stopScouting,
  getProspectsNeedingAction,
  getHomeRegion,
  SCOUTING_CYCLE_WEEKS,
  SIGNING_FEE,
} from '../../systems/youthAcademySystem';

// =============================================================================
// HELPER: Convert AcademyProspect to Player
// =============================================================================

function convertProspectToPlayer(
  prospect: AcademyProspect,
  contract: Contract
): Player {
  // Convert Record<string, number> to PlayerAttributes
  const attrs = prospect.attributes;
  const attributes: PlayerAttributes = {
    grip_strength: attrs['grip_strength'] ?? 30,
    arm_strength: attrs['arm_strength'] ?? 30,
    core_strength: attrs['core_strength'] ?? 30,
    agility: attrs['agility'] ?? 30,
    acceleration: attrs['acceleration'] ?? 30,
    top_speed: attrs['top_speed'] ?? 30,
    jumping: attrs['jumping'] ?? 30,
    reactions: attrs['reactions'] ?? 30,
    stamina: attrs['stamina'] ?? 30,
    balance: attrs['balance'] ?? 30,
    height: attrs['height'] ?? 30,
    durability: attrs['durability'] ?? 30,
    awareness: attrs['awareness'] ?? 30,
    creativity: attrs['creativity'] ?? 30,
    determination: attrs['determination'] ?? 30,
    bravery: attrs['bravery'] ?? 30,
    consistency: attrs['consistency'] ?? 30,
    composure: attrs['composure'] ?? 30,
    patience: attrs['patience'] ?? 30,
    teamwork: attrs['teamwork'] ?? 30,
    hand_eye_coordination: attrs['hand_eye_coordination'] ?? 30,
    throw_accuracy: attrs['throw_accuracy'] ?? 30,
    form_technique: attrs['form_technique'] ?? 30,
    finesse: attrs['finesse'] ?? 30,
    deception: attrs['deception'] ?? 30,
    footwork: attrs['footwork'] ?? 30,
  };

  const potentials: PlayerPotentials = {
    physical: prospect.potentials.physical,
    mental: prospect.potentials.mental,
    technical: prospect.potentials.technical,
  };

  const peakAges: PeakAges = {
    physical: 26,
    technical: 28,
    mental: 30,
  };

  const trainingFocus: TrainingFocus = {
    physical: 34,
    mental: 33,
    technical: 33,
  };

  const weeklyXP: WeeklyXP = {
    physical: 0,
    mental: 0,
    technical: 0,
  };

  const emptyStats: PlayerCareerStats = {
    gamesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
    totalPoints: { basketball: 0, baseball: 0, soccer: 0 },
    minutesPlayed: { basketball: 0, baseball: 0, soccer: 0 },
  };

  // Calculate height in inches from cm
  const heightInches = Math.round(prospect.height / 2.54);

  // Calculate weight in lbs from kg
  const weightLbs = Math.round(prospect.weight * 2.205);

  return {
    id: prospect.id,
    name: prospect.name,
    age: prospect.age,
    careerStartAge: prospect.age, // Youth prospect just starting career
    dateOfBirth: new Date(Date.now() - prospect.age * 365 * 24 * 60 * 60 * 1000),
    position: 'SF', // Default position, user can change
    height: heightInches,
    weight: weightLbs,
    nationality: prospect.nationality,
    attributes,
    potentials,
    peakAges,
    contract,
    injury: null,
    trainingFocus,
    weeklyXP,
    careerStats: emptyStats,
    currentSeasonStats: { ...emptyStats },
    teamId: 'user',
    acquisitionType: 'youth',
    acquisitionDate: new Date(),
    // Snapshot current attributes for progress tracking
    seasonStartAttributes: { ...attributes },
    // Match fitness - new players start fully fit
    matchFitness: 100,
    lastMatchDate: null,
    lastMatchSport: null,
    // Season history - empty for new players
    seasonHistory: [],
    // Awards - empty for new players
    awards: {
      playerOfTheWeek: { basketball: 0, baseball: 0, soccer: 0 },
      playerOfTheMonth: { basketball: 0, baseball: 0, soccer: 0 },
      basketballPlayerOfTheYear: 0,
      baseballPlayerOfTheYear: 0,
      soccerPlayerOfTheYear: 0,
      rookieOfTheYear: 0,
      championships: 0,
    },
    // Morale system
    morale: 75,
    recentMatchResults: [],
    transferRequestActive: false,
    transferRequestDate: null,
    weeksDisgruntled: 0,
    ambition: 0.9 + Math.random() * 0.2, // 0.9-1.1 range for youth
  };
}

function createYouthContract(playerId: string): Contract {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  return {
    id: `contract_${playerId}`,
    playerId,
    teamId: 'user',
    salary: 100000, // Youth contract: $100k/year
    signingBonus: 0,
    contractLength: 1,
    startDate: now,
    expiryDate,
    performanceBonuses: {},
    releaseClause: null,
    salaryIncreases: [0],
    agentFee: 0,
    clauses: [],
    squadRole: 'youth_prospect',
    loyaltyBonus: 0,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ConnectedYouthAcademyScreenProps {
  onBack?: () => void;
}

export function ConnectedYouthAcademyScreen({ onBack: _onBack }: ConnectedYouthAcademyScreenProps) {
  const colors = useColors();
  const {
    state,
    signPlayer,
    signProspectToAcademy,
    updateYouthScoutingReport,
    setYouthScoutSportFocus,
    setScoutingRegion,
    holdTrialEvent,
    signTrialProspect,
    inviteTrialProspectToNextTrial,
    passTrialProspect,
    releaseAcademyProspect,
  } = useGame();

  // Get youth academy state directly from context (reports are now generated in advanceWeek)
  const youthAcademy = state.youthAcademy;
  const scoutingReports = youthAcademy?.scoutingReports || [];
  const academyProspects = youthAcademy?.academyProspects || [];
  const lastReportWeek = youthAcademy?.lastReportWeek || 0;
  const sportFocus = youthAcademy?.scoutSportFocus || 'balanced';

  // Regional scouting state
  const homeRegion = youthAcademy?.homeRegion || getHomeRegion(state.userTeam.country);
  const selectedRegion = youthAcademy?.selectedRegion || homeRegion;

  // Trial system state
  const lastTrialWeek = youthAcademy?.lastTrialWeek || 0;
  const trialProspects = youthAcademy?.trialProspects || [];

  // Calculate budget-based settings (using actual dollars, not percentage)
  const youthBudgetPct = state.userTeam.operationsBudget.youthDevelopment;
  const operationsPool = Math.max(0, state.userTeam.totalBudget - state.userTeam.salaryCommitment);
  const budgetAmount = operationsPool * (youthBudgetPct / 100);

  // Calculate academy capacity
  const capacity = useMemo(() => calculateAcademyCapacity(budgetAmount), [budgetAmount]);

  // Calculate weeks until next reports
  const currentWeek = state.season?.currentWeek ?? 0;
  const weeksUntilNextReports = useMemo(() => {
    const weeksSinceLastReport = currentWeek - lastReportWeek;
    return Math.max(0, SCOUTING_CYCLE_WEEKS - weeksSinceLastReport);
  }, [currentWeek, lastReportWeek]);

  // Get academy info
  const academyInfo = useMemo((): AcademyInfo => {
    return getAcademyInfo(budgetAmount, academyProspects);
  }, [budgetAmount, academyProspects]);

  // Get active prospects
  const activeProspects = useMemo(() => {
    return academyProspects.filter(p => p.status === 'active');
  }, [academyProspects]);

  // Get prospects needing action
  const prospectsNeedingAction = useMemo(() => {
    return getProspectsNeedingAction(activeProspects);
  }, [activeProspects]);

  // Get available scouting reports
  const availableReports = useMemo(() => {
    return scoutingReports.filter(r => r.status === 'available' || r.status === 'scouting');
  }, [scoutingReports]);

  // Handle continue scouting
  const handleContinueScouting = useCallback((reportId: string) => {
    const report = scoutingReports.find(r => r.id === reportId);
    if (report) {
      updateYouthScoutingReport(reportId, requestContinueScouting(report));
    }
  }, [scoutingReports, updateYouthScoutingReport]);

  // Handle stop scouting
  const handleStopScouting = useCallback((reportId: string) => {
    const report = scoutingReports.find(r => r.id === reportId);
    if (report) {
      updateYouthScoutingReport(reportId, stopScouting(report));
    }
  }, [scoutingReports, updateYouthScoutingReport]);

  // Handle signing a prospect to the academy
  const handleSignProspect = useCallback((reportId: string) => {
    const report = scoutingReports.find(r => r.id === reportId);
    if (!report) return;

    // Check budget first - signing costs $10k
    if (state.userTeam.availableBudget < SIGNING_FEE) {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(SIGNING_FEE);
      Alert.alert('Insufficient Budget', `You need at least ${formatted} to sign a youth prospect. Current budget: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(state.userTeam.availableBudget)}`);
      return;
    }

    if (!canSignProspect(academyProspects, capacity)) {
      Alert.alert('Academy Full', 'You have reached your academy capacity. Promote or release a prospect first.');
      return;
    }

    // Create the prospect from the scouting report
    const prospect = createProspectFromReport(report, currentWeek);

    // Sign to academy via context (this also deducts signing fee from budget)
    signProspectToAcademy(prospect);

    // Mark report as signed
    updateYouthScoutingReport(reportId, { ...report, status: 'signed' as const });
  }, [scoutingReports, academyProspects, capacity, currentWeek, signProspectToAcademy, updateYouthScoutingReport, state.userTeam.availableBudget]);

  // Handle promoting a prospect to main squad
  const handlePromoteProspect = useCallback((prospectId: string) => {
    const prospect = academyProspects.find(p => p.id === prospectId);
    if (!prospect) return;

    // Create contract and convert to Player
    const contract = createYouthContract(prospect.id);
    const player = convertProspectToPlayer(prospect, contract);

    // Add to main roster via context (this will also update the academy prospect status)
    signPlayer(player);

    Alert.alert(
      'Prospect Promoted!',
      `${prospect.name} has been promoted to the main squad with a 1-year youth contract ($100k/year).`
    );
  }, [academyProspects, signPlayer]);

  // Handle releasing a prospect
  const handleReleaseProspect = useCallback((prospectId: string) => {
    const prospect = academyProspects.find(p => p.id === prospectId);
    if (!prospect) return;
    releaseAcademyProspect(prospectId);
    Alert.alert('Released', `${prospect.name} has been released from the academy.`);
  }, [academyProspects, releaseAcademyProspect]);

  // Handle sport focus change
  const handleSportFocusChange = useCallback((focus: ScoutSportFocus) => {
    setYouthScoutSportFocus(focus);
  }, [setYouthScoutSportFocus]);

  // Handle region change
  const handleRegionChange = useCallback((region: ScoutingRegion) => {
    setScoutingRegion(region);
  }, [setScoutingRegion]);

  // Handle hold trial
  const handleHoldTrial = useCallback(() => {
    holdTrialEvent();
  }, [holdTrialEvent]);

  // Handle signing a trial prospect
  const handleSignTrialProspect = useCallback((prospectId: string) => {
    // Check budget
    if (state.userTeam.availableBudget < SIGNING_FEE) {
      Alert.alert('Insufficient Funds', `You need $${(SIGNING_FEE / 1000).toFixed(0)}K to sign a prospect.`);
      return;
    }

    // Check capacity
    if (!canSignProspect(academyProspects, capacity)) {
      Alert.alert('Academy Full', 'Release or promote a prospect first.');
      return;
    }

    signTrialProspect(prospectId);
  }, [state.userTeam.availableBudget, academyProspects, capacity, signTrialProspect]);

  // Handle inviting to next trial
  const handleInviteToNextTrial = useCallback((prospectId: string) => {
    inviteTrialProspectToNextTrial(prospectId);
  }, [inviteTrialProspectToNextTrial]);

  // Handle passing on a trial prospect
  const handlePassTrialProspect = useCallback((prospectId: string) => {
    passTrialProspect(prospectId);
  }, [passTrialProspect]);

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading youth academy...
        </Text>
      </View>
    );
  }

  return (
    <YouthAcademyScreen
      scoutingReports={availableReports}
      weeksUntilNextReports={weeksUntilNextReports}
      currentWeek={currentWeek}
      homeRegion={homeRegion}
      selectedRegion={selectedRegion}
      onRegionChange={handleRegionChange}
      lastTrialWeek={lastTrialWeek}
      availableBudget={state.userTeam.availableBudget}
      trialProspects={trialProspects}
      onHoldTrial={handleHoldTrial}
      onSignTrialProspect={handleSignTrialProspect}
      onInviteToNextTrial={handleInviteToNextTrial}
      onPassTrialProspect={handlePassTrialProspect}
      academyInfo={academyInfo}
      academyProspects={activeProspects}
      prospectsNeedingAction={prospectsNeedingAction}
      sportFocus={sportFocus}
      onSportFocusChange={handleSportFocusChange}
      onContinueScouting={handleContinueScouting}
      onStopScouting={handleStopScouting}
      onSignProspect={handleSignProspect}
      onPromoteProspect={handlePromoteProspect}
      onReleaseProspect={handleReleaseProspect}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
});

export default ConnectedYouthAcademyScreen;
