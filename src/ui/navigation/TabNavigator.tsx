/**
 * Tab Navigator
 *
 * Main bottom tab navigation for the app.
 * Uses Connected screens that integrate with GameContext.
 */

import React, { useCallback, useState, useRef, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Modal, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, layout, spacing } from '../theme';
import type { TabParamList } from './types';
import { DEFAULT_GAME_STRATEGY as DEFAULT_BASEBALL_STRATEGY } from '../../simulation/baseball';

// Tab Container Screens (new 2-tab structure)
import { PlayTabScreen } from '../screens/PlayTabScreen';
import { ManageTabScreen } from '../screens/ManageTabScreen';

// Connected Screens (integrate with GameContext)
import { ConnectedSettingsScreen } from '../screens/ConnectedSettingsScreen';
import { ConnectedPlayerDetailScreen } from '../screens/ConnectedPlayerDetailScreen';
import { ConnectedMatchResultScreen } from '../screens/ConnectedMatchResultScreen';
import { ConnectedScoutingScreen } from '../screens/ConnectedScoutingScreen';
import { ConnectedYouthAcademyScreen } from '../screens/ConnectedYouthAcademyScreen';
import { ConnectedMatchPreviewScreen } from '../screens/ConnectedMatchPreviewScreen';
import { ConnectedBudgetScreen } from '../screens/ConnectedBudgetScreen';
import { ConnectedContractNegotiationScreen } from '../screens/ConnectedContractNegotiationScreen';
import { ConnectedLineupEditorScreen } from '../screens/ConnectedLineupEditorScreen';
import { MatchSimulationScreen } from '../screens/MatchSimulationScreen';
import { ThemePreviewScreen } from '../screens/ThemePreviewScreen';
import { PlayerSearchModal } from '../components/search';
import { BudgetAllocationModal } from '../components/budget';
import { HeaderGear } from '../components/common';
import { SwipeablePlayerDetail } from '../components/player';
import { useGame } from '../context/GameContext';
import type { OperationsBudget } from '../context/types';

const Tab = createBottomTabNavigator<TabParamList>();

// Simple text icons (replace with actual icons later)
const TabIcon = ({ label, color }: { label: string; focused?: boolean; color: string }) => (
  <Text style={[styles.icon, { color }]}>{label}</Text>
);

// Basketball strategy type matching ConnectedMatchPreviewScreen
type BasketballPace = 'standard' | 'fast' | 'slow';
type BasketballDefense = 'man' | 'zone' | 'mixed';
type BasketballRebounding = 'crash_glass' | 'standard' | 'prevent_transition';

interface BasketballStrategy {
  pace: BasketballPace;
  defense: BasketballDefense;
  rebounding: BasketballRebounding;
  scoringOptions: string[];
}

// Convert global TacticalSettings to local BasketballStrategy
function tacticsToBasketballStrategy(tactics: {
  pace: 'fast' | 'standard' | 'slow';
  manDefensePct: number;
  scoringOptions: [string?, string?, string?];
  reboundingStrategy: 'crash_glass' | 'standard' | 'prevent_transition';
}): BasketballStrategy {
  // Map manDefensePct to defense type
  let defense: BasketballDefense = 'mixed';
  if (tactics.manDefensePct >= 80) defense = 'man';
  else if (tactics.manDefensePct <= 20) defense = 'zone';

  return {
    pace: tactics.pace,
    defense,
    rebounding: tactics.reboundingStrategy,
    scoringOptions: tactics.scoringOptions.filter((id): id is string => id !== undefined),
  };
}

export function TabNavigator() {
  const colors = useColors();
  const { state, addScoutingTarget, setOperationsBudget, confirmBudgetAllocation, setTactics, setBaseballStrategy, initializeGamedayLineup, clearGamedayLineup } = useGame();

  // Modal state for player detail
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Track where player detail was opened from so we can return there
  const [playerDetailReturnTo, setPlayerDetailReturnTo] = useState<{
    type: 'matchPreview' | 'matchResult' | 'lineupEditor' | 'scouting' | 'search' | null;
    matchId?: string;
    sport?: 'basketball' | 'baseball' | 'soccer';
  }>({ type: null });

  // Player navigation context for swipe navigation
  const [playerNavContext, setPlayerNavContext] = useState<{
    playerList: string[];
    currentIndex: number;
  } | null>(null);

  // Modal state for match
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Get selected match status
  const selectedMatch = selectedMatchId
    ? state.season.matches.find((m) => m.id === selectedMatchId)
    : null;
  const isMatchCompleted = selectedMatch?.status === 'completed';

  // Modal state for scouting
  const [showScouting, setShowScouting] = useState(false);

  // Modal state for youth academy
  const [showYouthAcademy, setShowYouthAcademy] = useState(false);

  // Standings modal removed - now embedded in PlayTabScreen

  // Modal state for budget
  const [showBudget, setShowBudget] = useState(false);

  // Modal state for search
  const [showSearch, setShowSearch] = useState(false);

  // Modal state for contract negotiation
  const [showNegotiation, setShowNegotiation] = useState(false);

  // Modal state for lineup editor
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [lineupEditorSport, setLineupEditorSport] = useState<'basketball' | 'baseball' | 'soccer'>('basketball');
  const pendingMatchIdRef = useRef<string | null>(null);

  // Modal state for live match simulation
  const [showMatchSimulation, setShowMatchSimulation] = useState(false);
  const [simulatingMatchId, setSimulatingMatchId] = useState<string | null>(null);

  // Modal state for theme preview
  const [showThemePreview, setShowThemePreview] = useState(false);

  // Modal state for settings (gear icon)
  const [showSettings, setShowSettings] = useState(false);

  // Baseball strategy - derived from global state for persistence
  const baseballStrategy = state.userTeam.baseballStrategy || DEFAULT_BASEBALL_STRATEGY;

  // Soccer strategy type (matching ConnectedMatchPreviewScreen)
  type SoccerAttackingStyle = 'possession' | 'direct' | 'counter';
  type SoccerPressing = 'high' | 'balanced' | 'low';
  type SoccerWidth = 'wide' | 'balanced' | 'tight';
  interface SoccerStrategy {
    attackingStyle: SoccerAttackingStyle;
    pressing: SoccerPressing;
    width: SoccerWidth;
  }

  // Soccer strategy - derived from global state for persistence (like basketball)
  const soccerStrategy: SoccerStrategy = useMemo(() => ({
    attackingStyle: state.userTeam.tactics.soccerAttackingStyle || 'direct',
    pressing: state.userTeam.tactics.soccerPressing || 'balanced',
    width: state.userTeam.tactics.soccerWidth || 'balanced',
  }), [state.userTeam.tactics.soccerAttackingStyle, state.userTeam.tactics.soccerPressing, state.userTeam.tactics.soccerWidth]);

  // Update global tactics when soccer strategy changes
  const handleSoccerStrategyChange = useCallback((strategy: SoccerStrategy) => {
    setTactics({
      ...state.userTeam.tactics,
      soccerAttackingStyle: strategy.attackingStyle,
      soccerPressing: strategy.pressing,
      soccerWidth: strategy.width,
    });
  }, [state.userTeam.tactics, setTactics]);

  // Basketball strategy - derived from global state for persistence
  const basketballStrategy = tacticsToBasketballStrategy(state.userTeam.tactics);

  // Update global tactics when basketball strategy changes
  const handleBasketballStrategyChange = useCallback((strategy: BasketballStrategy) => {
    // Map defense type back to manDefensePct
    let manDefensePct = 70; // mixed
    if (strategy.defense === 'man') manDefensePct = 100;
    else if (strategy.defense === 'zone') manDefensePct = 0;

    // Build scoring options tuple
    const scoringOptions: [string?, string?, string?] = [
      strategy.scoringOptions[0],
      strategy.scoringOptions[1],
      strategy.scoringOptions[2],
    ];

    setTactics({
      ...state.userTeam.tactics,
      pace: strategy.pace,
      manDefensePct,
      reboundingStrategy: strategy.rebounding,
      scoringOptions,
    });
  }, [state.userTeam.tactics, setTactics]);

  // Handler for navigating to match preview
  const handleNavigateToMatch = useCallback((matchId: string) => {
    const match = state.season.matches.find((m) => m.id === matchId);
    if (match && match.status !== 'completed') {
      initializeGamedayLineup();
    }
    setSelectedMatchId(matchId);
  }, [state.season.matches, initializeGamedayLineup]);

  // Handler for starting live match simulation (Watch Match button)
  const handleStartMatch = useCallback((matchId: string) => {
    setSelectedMatchId(null); // Close the preview modal
    setSimulatingMatchId(matchId);
    setShowMatchSimulation(true);
  }, []);

  // Handler for player press (with optional player list for swipe navigation)
  const handlePlayerPress = useCallback((playerId: string, playerList?: string[]) => {
    if (playerList && playerList.length > 1) {
      const index = playerList.indexOf(playerId);
      setPlayerNavContext({
        playerList,
        currentIndex: index >= 0 ? index : 0,
      });
    } else {
      setPlayerNavContext(null);
    }
    setSelectedPlayerId(playerId);
  }, []);

  // Handler for swipe navigation between players
  const handleSwipeNavigate = useCallback((playerId: string, newIndex: number) => {
    setPlayerNavContext(prev => prev ? { ...prev, currentIndex: newIndex } : null);
    setSelectedPlayerId(playerId);
  }, []);

  // Handler for match press in schedule
  const handleMatchPress = useCallback((matchId: string) => {
    const match = state.season.matches.find((m) => m.id === matchId);
    if (match && match.status !== 'completed') {
      initializeGamedayLineup();
    }
    setSelectedMatchId(matchId);
  }, [state.season.matches, initializeGamedayLineup]);

  // Handler for scouting navigation
  const handleNavigateToScouting = useCallback(() => {
    setShowScouting(true);
  }, []);

  // Handler for youth academy navigation
  const handleNavigateToYouthAcademy = useCallback(() => {
    setShowYouthAcademy(true);
  }, []);

  // Standings navigation removed - now handled by PlayTabScreen internally

  // Handler for budget navigation
  const handleNavigateToBudget = useCallback(() => {
    setShowBudget(true);
  }, []);

  // Handler for search navigation
  const handleNavigateToSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  // Handler for contract negotiation navigation
  // Must close player detail modal first to avoid modal stacking issues
  const handleNavigateToNegotiation = useCallback(() => {
    // Close player detail modal first
    setSelectedPlayerId(null);
    // After player detail closes, open negotiation modal
    setTimeout(() => {
      setShowNegotiation(true);
    }, 100);
  }, []);

  // Handler for lineup editor navigation
  const handleEditLineup = useCallback((sport: 'basketball' | 'baseball' | 'soccer') => {
    setLineupEditorSport(sport);
    setShowLineupEditor(true);
  }, []);

  // Theme preview navigation is now inlined in Settings modal

  // Handler for settings navigation (from gear icon)
  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  // Handler for closing player detail and returning to previous screen
  const handleClosePlayerDetail = useCallback(() => {
    const returnTo = playerDetailReturnTo;
    setSelectedPlayerId(null);
    setPlayerDetailReturnTo({ type: null });
    setPlayerNavContext(null);

    // Reopen the previous modal after a short delay
    setTimeout(() => {
      switch (returnTo.type) {
        case 'matchPreview':
        case 'matchResult':
          if (returnTo.matchId) {
            setSelectedMatchId(returnTo.matchId);
          }
          break;
        case 'lineupEditor':
          if (returnTo.sport) {
            setLineupEditorSport(returnTo.sport);
          }
          setShowLineupEditor(true);
          break;
        case 'scouting':
          setShowScouting(true);
          break;
        case 'search':
          setShowSearch(true);
          break;
        // null or unhandled - just close, don't reopen anything
      }
    }, 150);
  }, [playerDetailReturnTo]);

  // Get all players and teams for search
  const allPlayers = state.initialized && state.players ? Object.values(state.players) : [];
  const allTeams = state.initialized && state.league?.teams
    ? [state.userTeam, ...state.league.teams].map((t) => ({ id: t.id, name: t.name }))
    : [];

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: layout.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerRight: () => <HeaderGear onPress={handleOpenSettings} />,
      }}
    >
      <Tab.Screen
        name="PlayTab"
        options={{
          title: 'Play',
          tabBarIcon: ({ color }) => <TabIcon label="▶" color={color} />,
          headerTitle: 'Multiball',
        }}
      >
        {() => (
          <PlayTabScreen
            onNavigateToMatch={handleNavigateToMatch}
            onNavigateToBudget={handleNavigateToBudget}
            onNavigateToSearch={handleNavigateToSearch}
            onNavigateToScouting={handleNavigateToScouting}
            onNavigateToYouthAcademy={handleNavigateToYouthAcademy}
            onMatchPress={handleMatchPress}
            onPlayerPress={handlePlayerPress}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="ManageTab"
        options={{
          title: 'Manage',
          tabBarIcon: ({ color }) => <TabIcon label="📋" color={color} />,
          headerTitle: 'Multiball',
        }}
      >
        {() => (
          <ManageTabScreen
            onPlayerPress={handlePlayerPress}
            onNavigateToBudget={handleNavigateToBudget}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>

    {/* Match Modal - Shows Preview for scheduled, Result for completed */}
    <Modal
      visible={selectedMatchId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSelectedMatchId(null)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedMatchId(null)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isMatchCompleted ? 'Match Result' : 'Match Preview'}
          </Text>
          <View style={styles.closeButton} />
        </View>
        {selectedMatchId && isMatchCompleted ? (
          <ConnectedMatchResultScreen
            matchId={selectedMatchId}
            onContinue={() => setSelectedMatchId(null)}
            onPlayerPress={(playerId) => {
              const matchId = selectedMatchId;
              setSelectedMatchId(null);
              setPlayerDetailReturnTo({ type: 'matchResult', matchId });
              setSelectedPlayerId(playerId);
            }}
          />
        ) : selectedMatchId ? (
          <ConnectedMatchPreviewScreen
            matchId={selectedMatchId}
            onBack={() => setSelectedMatchId(null)}
            onStartMatch={handleStartMatch}
            onQuickSimComplete={() => {
              // Clear gameday lineup after match completes
              clearGamedayLineup();
              // The modal automatically shows ConnectedMatchResultScreen when
              // match.status becomes 'completed' - no need to close and reopen
            }}
            onEditLineup={() => {
              const match = state.season.matches.find((m) => m.id === selectedMatchId);
              if (match) {
                // Close match preview first to avoid nested modal issues
                pendingMatchIdRef.current = selectedMatchId;
                setSelectedMatchId(null);
                // Small delay to let modal close, then open lineup editor
                setTimeout(() => {
                  handleEditLineup(match.sport);
                }, 150);
              }
            }}
            baseballStrategy={baseballStrategy}
            onBaseballStrategyChange={setBaseballStrategy}
            basketballStrategy={basketballStrategy}
            onBasketballStrategyChange={handleBasketballStrategyChange}
            soccerStrategy={soccerStrategy}
            onSoccerStrategyChange={handleSoccerStrategyChange}
            onPlayerPress={(playerId) => {
              const matchId = selectedMatchId;
              setSelectedMatchId(null);
              setPlayerDetailReturnTo({ type: 'matchPreview', matchId: matchId || undefined });
              setSelectedPlayerId(playerId);
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>

    {/* Scouting Modal */}
    <Modal
      visible={showScouting}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowScouting(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowScouting(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Scouting</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedScoutingScreen
          onBack={() => setShowScouting(false)}
          onPlayerPress={(playerId, playerList) => {
            setShowScouting(false);
            setPlayerDetailReturnTo({ type: 'scouting' });
            handlePlayerPress(playerId, playerList);
          }}
        />
      </SafeAreaView>
    </Modal>

    {/* Youth Academy Modal */}
    <Modal
      visible={showYouthAcademy}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowYouthAcademy(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowYouthAcademy(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Youth Academy</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedYouthAcademyScreen onBack={() => setShowYouthAcademy(false)} />
      </SafeAreaView>
    </Modal>

    {/* Standings Modal removed - now embedded in PlayTabScreen */}

    {/* Budget Modal */}
    <Modal
      visible={showBudget}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowBudget(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowBudget(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Budget</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedBudgetScreen />
      </SafeAreaView>
    </Modal>

    {/* Contract Negotiation Modal */}
    <Modal
      visible={showNegotiation}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowNegotiation(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowNegotiation(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Contract Negotiation</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedContractNegotiationScreen
          onComplete={() => setShowNegotiation(false)}
          onCancel={() => setShowNegotiation(false)}
        />
      </SafeAreaView>
    </Modal>

    {/* Lineup Editor Modal */}
    <Modal
      visible={showLineupEditor}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setShowLineupEditor(false);
        // Reopen match preview after closing lineup editor
        if (pendingMatchIdRef.current) {
          const matchId = pendingMatchIdRef.current;
          pendingMatchIdRef.current = null;
          setTimeout(() => setSelectedMatchId(matchId), 150);
        }
      }}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setShowLineupEditor(false);
              // Reopen match preview after closing lineup editor
              if (pendingMatchIdRef.current) {
                const matchId = pendingMatchIdRef.current;
                pendingMatchIdRef.current = null;
                setTimeout(() => setSelectedMatchId(matchId), 150);
              }
            }}
            style={styles.closeButton}
          >
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Lineup</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedLineupEditorScreen
          sport={lineupEditorSport}
          isGameday={true}
          onSave={() => {
            setShowLineupEditor(false);
            // Reopen match preview after saving
            if (pendingMatchIdRef.current) {
              const matchId = pendingMatchIdRef.current;
              pendingMatchIdRef.current = null;
              setTimeout(() => setSelectedMatchId(matchId), 150);
            }
          }}
          onCancel={() => {
            setShowLineupEditor(false);
            // Reopen match preview after canceling
            if (pendingMatchIdRef.current) {
              const matchId = pendingMatchIdRef.current;
              pendingMatchIdRef.current = null;
              setTimeout(() => setSelectedMatchId(matchId), 150);
            }
          }}
          onPlayerPress={(playerId) => {
            const sport = lineupEditorSport;
            setShowLineupEditor(false);
            setPlayerDetailReturnTo({ type: 'lineupEditor', sport });
            setSelectedPlayerId(playerId);
          }}
        />
      </SafeAreaView>
    </Modal>

    {/* Player Search Modal - rendered before Player Detail so detail appears on top */}
    <PlayerSearchModal
      visible={showSearch}
      onClose={() => setShowSearch(false)}
      onPlayerPress={(playerId, playerList) => {
        // Close search modal first, then open player detail
        // This avoids nested modal issues on some platforms
        setShowSearch(false);
        setPlayerDetailReturnTo({ type: 'search' });
        // Small delay to allow search modal to close first
        setTimeout(() => {
          handlePlayerPress(playerId, playerList);
        }, 100);
      }}
      onScoutPlayer={(playerId) => {
        addScoutingTarget(playerId);
      }}
      players={allPlayers}
      teams={allTeams}
      userTeamId="user"
      scoutingReports={state.scoutingReports || []}
      scoutedPlayerIds={state.scoutedPlayerIds || []}
      scoutingTargetIds={state.scoutingTargetIds || []}
      transferListPlayerIds={state.userTeam.transferListPlayerIds || []}
    />

    {/* Player Detail Modal - rendered last to appear on top of everything */}
    <Modal
      visible={selectedPlayerId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClosePlayerDetail}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClosePlayerDetail} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Player Details</Text>
          <View style={styles.closeButton} />
        </View>
        {selectedPlayerId && (
          <SwipeablePlayerDetail
            playerId={selectedPlayerId}
            playerList={playerNavContext?.playerList || []}
            currentIndex={playerNavContext?.currentIndex || 0}
            onNavigate={handleSwipeNavigate}
          >
            <ConnectedPlayerDetailScreen
              playerId={selectedPlayerId}
              onBack={handleClosePlayerDetail}
              onRelease={handleClosePlayerDetail}
              onNavigateToNegotiation={handleNavigateToNegotiation}
            />
          </SwipeablePlayerDetail>
        )}
      </SafeAreaView>
    </Modal>

    {/* Match Simulation Modal */}
    <Modal
      visible={showMatchSimulation}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        setShowMatchSimulation(false);
        setSimulatingMatchId(null);
      }}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setShowMatchSimulation(false);
              setSimulatingMatchId(null);
            }}
            style={styles.closeButton}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Live Match</Text>
          <View style={styles.closeButton} />
        </View>
        {simulatingMatchId && (
          <MatchSimulationScreen
            matchId={simulatingMatchId}
            onBack={() => {
              setShowMatchSimulation(false);
              setSimulatingMatchId(null);
            }}
            onComplete={() => {
              // Clear gameday lineup after match completes
              clearGamedayLineup();
              setShowMatchSimulation(false);
              // Show the match result
              setSelectedMatchId(simulatingMatchId);
              setSimulatingMatchId(null);
              // Soccer strategy persists in global state - no reset needed
            }}
            soccerStrategy={soccerStrategy}
          />
        )}
      </SafeAreaView>
    </Modal>

    {/* Budget Allocation Modal - Required at game start before scouting/simming */}
    <BudgetAllocationModal
      visible={state.initialized && !state.budgetConfigured}
      totalBudget={state.userTeam.totalBudget}
      salaryCommitment={state.userTeam.salaryCommitment}
      initialAllocation={state.userTeam.operationsBudget}
      onConfirm={(allocation: OperationsBudget) => {
        setOperationsBudget(allocation);
        confirmBudgetAllocation();
      }}
    />

    {/* Theme Preview Modal */}
    <Modal
      visible={showThemePreview}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowThemePreview(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowThemePreview(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Theme Preview</Text>
          <View style={styles.closeButton} />
        </View>
        <ThemePreviewScreen />
      </SafeAreaView>
    </Modal>

    {/* Settings Modal (opened via gear icon) */}
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettings(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedSettingsScreen
          onPreviewThemes={() => {
            setShowSettings(false);
            setTimeout(() => setShowThemePreview(true), 150);
          }}
        />
      </SafeAreaView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 17,
  },
});

export default TabNavigator;
