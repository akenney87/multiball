/**
 * Settings Screen
 *
 * App and game settings:
 * - Simulation speed
 * - Sound toggle
 * - Notifications toggle
 * - Auto-save toggle
 * - Theme selection
 * - Reset game option
 * - About/credits
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import type { GameSettings } from '../persistence/gameStorage';

type SimulationSpeed = 'slow' | 'normal' | 'fast';
type ThemeOption = 'light' | 'dark' | 'system';

interface SettingsScreenProps {
  settings?: GameSettings;
  onSettingsChange?: (settings: GameSettings) => void;
  onResetGame?: () => void;
  onPreviewThemes?: () => void;
  appVersion?: string;
}

const defaultSettings: GameSettings = {
  simulationSpeed: 'normal',
  soundEnabled: true,
  notificationsEnabled: true,
  autoSave: true,
  theme: 'system',
};

export function SettingsScreen({
  settings = defaultSettings,
  onSettingsChange,
  onResetGame,
  onPreviewThemes,
  appVersion = '1.0.0',
}: SettingsScreenProps) {
  const colors = useColors();
  const [localSettings, setLocalSettings] = useState<GameSettings>(settings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const handleResetGame = () => {
    setShowResetConfirm(false);
    onResetGame?.();
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title}
      </Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }, shadows.sm]}>
        {children}
      </View>
    </View>
  );

  const renderToggleRow = (
    label: string,
    description: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    isLast?: boolean
  ) => (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowDescription, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : colors.surface}
      />
    </View>
  );

  const renderSpeedSelector = () => {
    const speeds: { key: SimulationSpeed; label: string }[] = [
      { key: 'slow', label: 'Slow' },
      { key: 'normal', label: 'Normal' },
      { key: 'fast', label: 'Fast' },
    ];

    return (
      <View style={styles.row}>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Simulation Speed
          </Text>
          <Text style={[styles.rowDescription, { color: colors.textMuted }]}>
            Speed of match simulation
          </Text>
        </View>
        <View style={styles.speedSelector}>
          {speeds.map((speed) => (
            <TouchableOpacity
              key={speed.key}
              style={[
                styles.speedButton,
                {
                  backgroundColor:
                    localSettings.simulationSpeed === speed.key
                      ? colors.primary
                      : colors.surface,
                },
              ]}
              onPress={() => updateSetting('simulationSpeed', speed.key)}
            >
              <Text
                style={[
                  styles.speedText,
                  {
                    color:
                      localSettings.simulationSpeed === speed.key
                        ? '#FFFFFF'
                        : colors.text,
                  },
                ]}
              >
                {speed.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderThemeSelector = () => {
    const themes: { key: ThemeOption; label: string }[] = [
      { key: 'light', label: 'Light' },
      { key: 'dark', label: 'Dark' },
      { key: 'system', label: 'System' },
    ];

    return (
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
          <Text style={[styles.rowDescription, { color: colors.textMuted }]}>
            App appearance
          </Text>
        </View>
        <View style={styles.themeSelector}>
          {themes.map((theme) => (
            <TouchableOpacity
              key={theme.key}
              style={[
                styles.themeButton,
                {
                  backgroundColor:
                    localSettings.theme === theme.key
                      ? colors.primary
                      : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => updateSetting('theme', theme.key)}
            >
              <Text
                style={[
                  styles.themeText,
                  {
                    color:
                      localSettings.theme === theme.key
                        ? '#FFFFFF'
                        : colors.text,
                  },
                ]}
              >
                {theme.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Gameplay Settings */}
      {renderSection(
        'GAMEPLAY',
        <>
          {renderSpeedSelector()}
          {renderToggleRow(
            'Sound Effects',
            'Play sounds during matches',
            localSettings.soundEnabled,
            (v) => updateSetting('soundEnabled', v)
          )}
          {renderToggleRow(
            'Notifications',
            'Receive game notifications',
            localSettings.notificationsEnabled,
            (v) => updateSetting('notificationsEnabled', v)
          )}
          {renderToggleRow(
            'Auto-Save',
            'Automatically save after matches',
            localSettings.autoSave,
            (v) => updateSetting('autoSave', v),
            true
          )}
        </>
      )}

      {/* Appearance */}
      {renderSection(
        'APPEARANCE',
        <>
          {renderThemeSelector()}
          {onPreviewThemes && (
            <TouchableOpacity
              style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={onPreviewThemes}
            >
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.primary }]}>
                  Preview New Themes
                </Text>
                <Text style={[styles.rowDescription, { color: colors.textMuted }]}>
                  See redesigned UI options before applying
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.primary }]}>&gt;</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Data Management */}
      {renderSection(
        'DATA',
        <TouchableOpacity
          style={styles.resetRow}
          onPress={() => setShowResetConfirm(true)}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.error }]}>
              Reset Game
            </Text>
            <Text style={[styles.rowDescription, { color: colors.textMuted }]}>
              Delete all saved data and start fresh
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.error }]}>&gt;</Text>
        </TouchableOpacity>
      )}

      {/* About */}
      {renderSection(
        'ABOUT',
        <View style={styles.aboutContent}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>
              Version
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>
              {appVersion}
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>
              Developer
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>
              Multiball Studios
            </Text>
          </View>
          <Text style={[styles.copyright, { color: colors.textMuted }]}>
            A sports franchise management simulation game.
          </Text>
        </View>
      )}

      {/* Reset Confirmation */}
      <ConfirmationModal
        visible={showResetConfirm}
        title="Reset Game?"
        message="This will delete all your saved progress, including your team, players, and season data. This action cannot be undone."
        confirmText="Reset"
        confirmStyle="destructive"
        cancelText="Cancel"
        onConfirm={handleResetGame}
        onCancel={() => setShowResetConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  speedSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  speedButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  themeSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  themeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
  },
  aboutContent: {
    padding: spacing.md,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  copyright: {
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default SettingsScreen;
