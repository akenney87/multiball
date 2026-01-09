/**
 * Main App Component
 *
 * Root component that sets up:
 * - Theme provider
 * - Error boundary
 * - Game context
 * - Navigation
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useColors } from './theme';
import { AppNavigator } from './navigation';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { GameProvider } from './context/GameContext';

function AppContent() {
  const colors = useColors();

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />
      <AppNavigator />
    </>
  );
}

export function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <GameProvider>
            <AppContent />
          </GameProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default App;
