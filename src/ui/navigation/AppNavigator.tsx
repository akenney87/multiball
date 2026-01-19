/**
 * App Navigator
 *
 * Root navigation container that wraps the entire app.
 * Handles the game initialization flow:
 * - Shows TitleScreen first (Continue/New Game)
 * - Continue loads saved game and goes to MainTabs
 * - New Game goes to NewGameScreen for onboarding
 * - Shows TabNavigator with main game screens when initialized
 */

import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { TabNavigator } from './TabNavigator';
import { NewGameScreen } from '../screens/NewGameScreen';
import { TitleScreen } from '../screens/TitleScreen';
import { useGame } from '../context/GameContext';
import { useColors } from '../theme';
import { GameStorage } from '../persistence/gameStorage';

type RootStackParamList = {
  Title: undefined;
  NewGame: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const colors = useColors();
  const { state, startNewGame, loadGame } = useGame();
  const [isCheckingGame, setIsCheckingGame] = useState(true);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Check for saved game on mount
  useEffect(() => {
    const checkSavedGame = async () => {
      try {
        // Check for full saved game state (new format)
        const hasFullSave = await GameStorage.hasFullSavedGame();
        setHasSavedGame(hasFullSave);
      } catch (err) {
        setHasSavedGame(false);
      } finally {
        setIsCheckingGame(false);
      }
    };
    checkSavedGame();
  }, []);

  // Handle continue - load saved game
  const handleContinue = useCallback(async () => {
    setIsLoadingGame(true);
    setLoadingProgress(0);

    // Simulate progress during load - quickly go to 30%, then slow down
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev < 0.3) return prev + 0.05;      // Fast to 30%
        if (prev < 0.7) return prev + 0.02;      // Medium to 70%
        if (prev < 0.9) return prev + 0.005;     // Slow to 90%
        return prev;                              // Hold at 90% until done
      });
    }, 50);

    await loadGame();

    clearInterval(progressInterval);
    setLoadingProgress(1);  // Complete!

    // Brief delay to show 100% before transitioning
    await new Promise(resolve => setTimeout(resolve, 200));
    setIsLoadingGame(false);
  }, [loadGame]);

  // Handle new game - go to onboarding
  const handleNewGame = useCallback(() => {
    setShowTitle(false);
  }, []);

  // Show loading while checking for saved game (initial check only)
  if (isCheckingGame) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Show title screen first if not initialized and hasn't been dismissed */}
        {(showTitle || isLoadingGame) && !state.initialized ? (
          <Stack.Screen name="Title">
            {() => (
              <TitleScreen
                onContinue={handleContinue}
                onNewGame={handleNewGame}
                hasSaveData={hasSavedGame}
                isLoading={isLoadingGame}
                loadingProgress={loadingProgress}
              />
            )}
          </Stack.Screen>
        ) : !state.initialized ? (
          <Stack.Screen name="NewGame">
            {(props) => (
              <NewGameScreen
                {...props}
                onStartGame={startNewGame}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
