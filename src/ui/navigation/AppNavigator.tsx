/**
 * App Navigator
 *
 * Root navigation container that wraps the entire app.
 * Handles the game initialization flow:
 * - Shows NewGameScreen if no game is initialized
 * - Shows TabNavigator with main game screens otherwise
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { TabNavigator } from './TabNavigator';
import { NewGameScreen } from '../screens/NewGameScreen';
import { useGame } from '../context/GameContext';
import { useColors } from '../theme';
import { GameStorage } from '../persistence/gameStorage';

type RootStackParamList = {
  NewGame: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const colors = useColors();
  const { state, startNewGame, loadGame } = useGame();
  const [isCheckingGame, setIsCheckingGame] = useState(true);
  const [hasSavedGame, setHasSavedGame] = useState(false);

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

  // Show loading while checking for saved game
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
        {!state.initialized ? (
          <Stack.Screen name="NewGame">
            {(props) => (
              <NewGameScreen
                {...props}
                onStartGame={startNewGame}
                onLoadGame={loadGame}
                hasSavedGame={hasSavedGame}
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
