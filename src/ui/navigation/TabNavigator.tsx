/**
 * Tab Navigator
 *
 * Main bottom tab navigation for the app.
 * Uses Connected screens that integrate with GameContext.
 */

import React, { useCallback, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Modal, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, layout, spacing } from '../theme';
import type { TabParamList } from './types';

// Connected Screens (integrate with GameContext)
import { ConnectedDashboardScreen } from '../screens/ConnectedDashboardScreen';
import { ConnectedRosterScreen } from '../screens/ConnectedRosterScreen';
import { ConnectedScheduleScreen } from '../screens/ConnectedScheduleScreen';
import { ConnectedTransferMarketScreen } from '../screens/ConnectedTransferMarketScreen';
import { ConnectedSettingsScreen } from '../screens/ConnectedSettingsScreen';
import { ConnectedPlayerDetailScreen } from '../screens/ConnectedPlayerDetailScreen';
import { ConnectedMatchResultScreen } from '../screens/ConnectedMatchResultScreen';
import { ConnectedScoutingScreen } from '../screens/ConnectedScoutingScreen';
import { ConnectedYouthAcademyScreen } from '../screens/ConnectedYouthAcademyScreen';
import { ConnectedStandingsScreen } from '../screens/ConnectedStandingsScreen';
import { ConnectedStatsScreen } from '../screens/ConnectedStatsScreen';
import { ConnectedMatchPreviewScreen } from '../screens/ConnectedMatchPreviewScreen';
import { ConnectedBudgetScreen } from '../screens/ConnectedBudgetScreen';
import { ConnectedContractNegotiationScreen } from '../screens/ConnectedContractNegotiationScreen';
import { PlayerSearchModal } from '../components/search';
import { useGame } from '../context/GameContext';

const Tab = createBottomTabNavigator<TabParamList>();

// Simple text icons (replace with actual icons later)
const TabIcon = ({ label, color }: { label: string; focused?: boolean; color: string }) => (
  <Text style={[styles.icon, { color }]}>{label}</Text>
);

export function TabNavigator() {
  const colors = useColors();
  const { state } = useGame();

  // Modal state for player detail
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  // Modal state for standings
  const [showStandings, setShowStandings] = useState(false);

  // Modal state for budget
  const [showBudget, setShowBudget] = useState(false);

  // Modal state for search
  const [showSearch, setShowSearch] = useState(false);

  // Modal state for contract negotiation
  const [showNegotiation, setShowNegotiation] = useState(false);

  // Handler for navigating to match preview
  const handleNavigateToMatch = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
  }, []);

  // Handler for player press
  const handlePlayerPress = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
  }, []);

  // Handler for match press in schedule
  const handleMatchPress = useCallback((matchId: string) => {
    setSelectedMatchId(matchId);
  }, []);

  // Handler for scouting navigation
  const handleNavigateToScouting = useCallback(() => {
    setShowScouting(true);
  }, []);

  // Handler for youth academy navigation
  const handleNavigateToYouthAcademy = useCallback(() => {
    setShowYouthAcademy(true);
  }, []);

  // Handler for standings navigation
  const handleNavigateToStandings = useCallback(() => {
    setShowStandings(true);
  }, []);

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
          fontSize: 10,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => <TabIcon label="H" focused={focused} color={color} />,
          headerTitle: 'Dashboard',
        }}
      >
        {() => <ConnectedDashboardScreen onNavigateToMatch={handleNavigateToMatch} onNavigateToScouting={handleNavigateToScouting} onNavigateToYouthAcademy={handleNavigateToYouthAcademy} onNavigateToStandings={handleNavigateToStandings} onNavigateToBudget={handleNavigateToBudget} onNavigateToSearch={handleNavigateToSearch} />}
      </Tab.Screen>
      <Tab.Screen
        name="RosterTab"
        options={{
          title: 'Roster',
          tabBarIcon: ({ focused, color }) => <TabIcon label="R" focused={focused} color={color} />,
          headerTitle: 'Team Roster',
        }}
      >
        {() => <ConnectedRosterScreen onPlayerPress={handlePlayerPress} />}
      </Tab.Screen>
      <Tab.Screen
        name="SeasonTab"
        options={{
          title: 'Season',
          tabBarIcon: ({ focused, color }) => <TabIcon label="S" focused={focused} color={color} />,
          headerTitle: 'Schedule',
        }}
      >
        {() => <ConnectedScheduleScreen onMatchPress={handleMatchPress} />}
      </Tab.Screen>
      <Tab.Screen
        name="StatsTab"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused, color }) => <TabIcon label="T" focused={focused} color={color} />,
          headerTitle: 'League Stats',
        }}
      >
        {() => <ConnectedStatsScreen onPlayerPress={handlePlayerPress} />}
      </Tab.Screen>
      <Tab.Screen
        name="MarketTab"
        component={ConnectedTransferMarketScreen}
        options={{
          title: 'Market',
          tabBarIcon: ({ focused, color }) => <TabIcon label="M" focused={focused} color={color} />,
          headerTitle: 'Transfer Market',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={ConnectedSettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => <TabIcon label="G" focused={focused} color={color} />,
          headerTitle: 'Settings',
        }}
      />
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
              setSelectedMatchId(null);
              setSelectedPlayerId(playerId);
            }}
          />
        ) : selectedMatchId ? (
          <ConnectedMatchPreviewScreen
            matchId={selectedMatchId}
            onBack={() => setSelectedMatchId(null)}
            onQuickSimComplete={() => {
              // After quick sim, the match is completed - stay on modal to show result
              // Force re-render by setting match ID again
              const matchId = selectedMatchId;
              setSelectedMatchId(null);
              setTimeout(() => setSelectedMatchId(matchId), 50);
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
          onPlayerPress={(playerId) => {
            setShowScouting(false);
            setSelectedPlayerId(playerId);
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

    {/* Standings Modal */}
    <Modal
      visible={showStandings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowStandings(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowStandings(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Standings</Text>
          <View style={styles.closeButton} />
        </View>
        <ConnectedStandingsScreen onPlayerPress={handlePlayerPress} />
      </SafeAreaView>
    </Modal>

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

    {/* Player Search Modal - rendered before Player Detail so detail appears on top */}
    <PlayerSearchModal
      visible={showSearch}
      onClose={() => setShowSearch(false)}
      onPlayerPress={(playerId) => {
        // Close search modal first, then open player detail
        // This avoids nested modal issues on some platforms
        setShowSearch(false);
        // Small delay to allow search modal to close first
        setTimeout(() => {
          setSelectedPlayerId(playerId);
        }, 100);
      }}
      players={allPlayers}
      teams={allTeams}
      userTeamId="user"
      scoutingReports={state.scoutingReports || []}
      scoutedPlayerIds={state.scoutedPlayerIds || []}
    />

    {/* Player Detail Modal - rendered last to appear on top of everything */}
    <Modal
      visible={selectedPlayerId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSelectedPlayerId(null)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedPlayerId(null)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Player Details</Text>
          <View style={styles.closeButton} />
        </View>
        {selectedPlayerId && (
          <ConnectedPlayerDetailScreen
            playerId={selectedPlayerId}
            onBack={() => setSelectedPlayerId(null)}
            onRelease={() => setSelectedPlayerId(null)}
            onNavigateToNegotiation={handleNavigateToNegotiation}
          />
        )}
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
