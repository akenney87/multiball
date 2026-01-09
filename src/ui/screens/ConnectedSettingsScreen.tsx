/**
 * Connected Settings Screen
 *
 * Connects SettingsScreen to real game data via GameContext.
 * Handles settings persistence and game reset functionality.
 */

import React, { useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { SettingsScreen } from './SettingsScreen';
import type { GameSettings as PersistenceSettings } from '../persistence/gameStorage';
import type { GameSettings as ContextSettings } from '../context/types';

interface ConnectedSettingsScreenProps {
  /** Callback when game is reset */
  onGameReset?: () => void;
  /** Callback to open theme preview */
  onPreviewThemes?: () => void;
  /** App version to display */
  appVersion?: string;
}

export function ConnectedSettingsScreen({
  onGameReset,
  onPreviewThemes,
  appVersion = '1.0.0',
}: ConnectedSettingsScreenProps) {
  const { state, updateSettings, resetGame } = useGame();

  // Convert context settings to persistence format (for SettingsScreen)
  const convertToDisplaySettings = useCallback(
    (settings: ContextSettings): PersistenceSettings => ({
      simulationSpeed: settings.simulationSpeed,
      soundEnabled: settings.soundEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      autoSave: settings.autoSaveEnabled,
      theme: settings.theme,
    }),
    []
  );

  // Convert persistence format back to context settings
  const convertFromDisplaySettings = useCallback(
    (settings: PersistenceSettings): Partial<ContextSettings> => ({
      simulationSpeed: settings.simulationSpeed,
      soundEnabled: settings.soundEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      autoSaveEnabled: settings.autoSave,
      theme: settings.theme,
    }),
    []
  );

  // Handle settings change
  const handleSettingsChange = useCallback(
    (newSettings: PersistenceSettings) => {
      const contextSettings = convertFromDisplaySettings(newSettings);
      updateSettings(contextSettings);
    },
    [updateSettings, convertFromDisplaySettings]
  );

  // Handle game reset
  const handleResetGame = useCallback(async () => {
    await resetGame();
    onGameReset?.();
  }, [resetGame, onGameReset]);

  // Get display settings
  const displaySettings = convertToDisplaySettings(state.settings);

  return (
    <SettingsScreen
      settings={displaySettings}
      onSettingsChange={handleSettingsChange}
      onResetGame={handleResetGame}
      onPreviewThemes={onPreviewThemes}
      appVersion={appVersion}
    />
  );
}

export default ConnectedSettingsScreen;
