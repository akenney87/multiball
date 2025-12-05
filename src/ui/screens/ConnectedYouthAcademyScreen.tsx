/**
 * Connected Youth Academy Screen
 *
 * Youth Academy screen connected to GameContext.
 * Uses module-level cache to persist state between navigations.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useColors, spacing } from '../theme';
import { YouthAcademyScreen } from './YouthAcademyScreen';
import { useGame } from '../context/GameContext';
import type { Player, Contract, PlayerAttributes, PlayerPotentials, PeakAges, TrainingFocus, WeeklyXP, PlayerCareerStats } from '../../data/types';
import {
  ScoutingReport,
  AcademyProspect,
  AcademyInfo,
  generateScoutingReports,
  getAcademyInfo,
  calculateReportsPerCycle,
  calculateAcademyCapacity,
  canSignProspect,
  signProspectToAcademy,
  requestContinueScouting,
  stopScouting,
  advanceScoutingReport,
  promoteProspect,
  releaseProspect,
  getProspectsNeedingAction,
  SCOUTING_CYCLE_WEEKS,
} from '../../systems/youthAcademySystem';

// =============================================================================
// MODULE-LEVEL CACHE (persists between component mounts)
// =============================================================================

interface AcademyCache {
  scoutingReports: ScoutingReport[];
  academyProspects: AcademyProspect[];
  lastReportWeek: number;
  initialized: boolean;
  gameId: string | null;  // Track which game this cache belongs to
}

let academyCache: AcademyCache = {
  scoutingReports: [],
  academyProspects: [],
  lastReportWeek: 0,
  initialized: false,
  gameId: null,
};

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
    hand_eye_coordination: attrs['hand_eye_coordination'] ?? 30,
    throw_accuracy: attrs['throw_accuracy'] ?? 30,
    form_technique: attrs['form_technique'] ?? 30,
    finesse: attrs['finesse'] ?? 30,
    deception: attrs['deception'] ?? 30,
    teamwork: attrs['teamwork'] ?? 30,
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
  const { state, signPlayer } = useGame();
  const mountedRef = useRef(true);

  // Local state initialized from cache
  const [scoutingReports, setScoutingReports] = useState<ScoutingReport[]>(() => {
    // Reset cache if different game
    if (academyCache.gameId !== state.userTeam.name) {
      return [];
    }
    return academyCache.scoutingReports;
  });

  const [academyProspects, setAcademyProspects] = useState<AcademyProspect[]>(() => {
    if (academyCache.gameId !== state.userTeam.name) {
      return [];
    }
    return academyCache.academyProspects;
  });

  const [lastReportWeek, setLastReportWeek] = useState<number>(() => {
    if (academyCache.gameId !== state.userTeam.name) {
      return 0;
    }
    return academyCache.lastReportWeek;
  });

  const [initialized, setInitialized] = useState<boolean>(() => {
    if (academyCache.gameId !== state.userTeam.name) {
      return false;
    }
    return academyCache.initialized;
  });

  // Sync state to cache on every change
  useEffect(() => {
    academyCache = {
      scoutingReports,
      academyProspects,
      lastReportWeek,
      initialized,
      gameId: state.userTeam.name,
    };
  }, [scoutingReports, academyProspects, lastReportWeek, initialized, state.userTeam.name]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Calculate budget-based settings
  const youthBudgetPct = state.userTeam.operationsBudget.youthDevelopment;
  const budgetAmount = (youthBudgetPct / 100) * 500000;
  const qualityMultiplier = 0.5 + (youthBudgetPct / 100) * 1.0;

  // Calculate academy capacity and reports per cycle
  const capacity = useMemo(() => calculateAcademyCapacity(budgetAmount), [budgetAmount]);
  const reportsPerCycle = useMemo(() => calculateReportsPerCycle(budgetAmount), [budgetAmount]);

  // Calculate weeks until next reports
  const currentWeek = state.season?.currentWeek ?? 0;
  const weeksUntilNextReports = useMemo(() => {
    const weeksSinceLastReport = currentWeek - lastReportWeek;
    return Math.max(0, SCOUTING_CYCLE_WEEKS - weeksSinceLastReport);
  }, [currentWeek, lastReportWeek]);

  // Initialize on first load
  useEffect(() => {
    if (state.initialized && !initialized) {
      const seed = Date.now();
      const reports = generateScoutingReports(
        currentWeek,
        reportsPerCycle,
        qualityMultiplier,
        seed
      );
      setScoutingReports(reports);
      setLastReportWeek(currentWeek);
      setAcademyProspects([]);
      setInitialized(true);
    }
  }, [state.initialized, initialized, currentWeek, reportsPerCycle, qualityMultiplier]);

  // Generate new reports when 4-week cycle completes
  useEffect(() => {
    if (initialized && weeksUntilNextReports === 0 && currentWeek > lastReportWeek) {
      const seed = Date.now() + currentWeek;

      setScoutingReports(prev => {
        // Advance continuing reports (narrow ranges, check for rival signing)
        const updated = prev.map((report, index) =>
          advanceScoutingReport(report, currentWeek, seed + index * 100)
        );

        // Check for rival signings and show alerts
        const rivalSigned = updated.filter(r => r.status === 'signed_by_rival');
        rivalSigned.forEach(report => {
          // Show alert for each rival signing (delayed to avoid React state issues)
          setTimeout(() => {
            Alert.alert(
              'Prospect Signed by Rival',
              `${report.name} has been signed by another club while you were scouting him. The scouting report is no longer available.`
            );
          }, 100);
        });

        // Keep reports that are continuing scouting (status = 'scouting')
        // These take up slots in the next cycle
        const continuingReports = updated.filter(r => r.status === 'scouting');

        // Calculate how many new report slots are available
        // Total slots = reportsPerCycle, continuing reports take up slots
        const availableSlots = Math.max(0, reportsPerCycle - continuingReports.length);

        // Generate new reports only for available slots
        const newReports = availableSlots > 0
          ? generateScoutingReports(
              currentWeek,
              availableSlots,
              qualityMultiplier,
              seed + 10000
            )
          : [];

        return [...continuingReports, ...newReports];
      });

      setLastReportWeek(currentWeek);
    }
  }, [initialized, weeksUntilNextReports, currentWeek, lastReportWeek, reportsPerCycle, qualityMultiplier]);

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
    setScoutingReports(prev =>
      prev.map(r => r.id === reportId ? requestContinueScouting(r) : r)
    );
  }, []);

  // Handle stop scouting
  const handleStopScouting = useCallback((reportId: string) => {
    setScoutingReports(prev =>
      prev.map(r => r.id === reportId ? stopScouting(r) : r)
    );
  }, []);

  // Handle signing a prospect to the academy
  const handleSignProspect = useCallback((reportId: string) => {
    const report = scoutingReports.find(r => r.id === reportId);
    if (!report) return;

    if (!canSignProspect(academyProspects, capacity)) {
      Alert.alert('Academy Full', 'You have reached your academy capacity. Promote or release a prospect first.');
      return;
    }

    const prospect = signProspectToAcademy(report, currentWeek);
    setAcademyProspects(prev => [...prev, prospect]);

    setScoutingReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, status: 'signed' as const } : r)
    );
  }, [scoutingReports, academyProspects, capacity, currentWeek]);

  // Handle promoting a prospect to main squad
  const handlePromoteProspect = useCallback((prospectId: string) => {
    const prospect = academyProspects.find(p => p.id === prospectId);
    if (!prospect) return;

    // Create contract and convert to Player
    const contract = createYouthContract(prospect.id);
    const player = convertProspectToPlayer(prospect, contract);

    // Add to main roster via context
    signPlayer(player);

    // Mark as promoted in academy
    setAcademyProspects(prev =>
      prev.map(p => p.id === prospectId ? promoteProspect(p) : p)
    );

    Alert.alert(
      'Prospect Promoted!',
      `${prospect.name} has been promoted to the main squad with a 1-year youth contract ($100k/year).`
    );
  }, [academyProspects, signPlayer]);

  // Handle releasing a prospect
  const handleReleaseProspect = useCallback((prospectId: string) => {
    setAcademyProspects(prev =>
      prev.map(p => p.id === prospectId ? releaseProspect(p) : p)
    );
  }, []);

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
      academyInfo={academyInfo}
      academyProspects={activeProspects}
      prospectsNeedingAction={prospectsNeedingAction}
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
