/**
 * New Game Screen (Onboarding)
 *
 * New game setup flow:
 * - Team name input
 * - Team colors selection
 * - Difficulty selection
 * - Start game
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface NewGameConfig {
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  difficulty: Difficulty;
}

interface NewGameScreenProps {
  onStartGame?: (config: NewGameConfig) => void;
  onLoadGame?: () => void;
  hasSavedGame?: boolean;
}

const colorOptions = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Navy', value: '#1E3A5F' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Gold', value: '#F59E0B' },
  { name: 'Gray', value: '#6B7280' },
];

const difficultyOptions: { key: Difficulty; label: string; description: string }[] = [
  { key: 'easy', label: 'Easy', description: 'More forgiving, perfect for learning' },
  { key: 'normal', label: 'Normal', description: 'Balanced challenge for most players' },
  { key: 'hard', label: 'Hard', description: 'For experienced managers only' },
];

export function NewGameScreen({
  onStartGame,
  onLoadGame,
  hasSavedGame = false,
}: NewGameScreenProps) {
  const colors = useColors();
  const [teamName, setTeamName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const isValid = teamName.trim().length >= 2;

  const handleStartGame = () => {
    if (hasSavedGame) {
      setShowOverwriteConfirm(true);
    } else {
      startGame();
    }
  };

  const startGame = () => {
    setShowOverwriteConfirm(false);
    onStartGame?.({
      teamName: teamName.trim(),
      primaryColor,
      secondaryColor,
      difficulty,
    });
  };

  const renderColorPicker = (
    label: string,
    selectedColor: string,
    onSelect: (color: string) => void,
    excludeColor?: string
  ) => (
    <View style={styles.colorSection}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.colorGrid}>
        {colorOptions
          .filter((c) => c.value !== excludeColor)
          .map((color) => (
            <TouchableOpacity
              key={color.value}
              style={[
                styles.colorButton,
                { backgroundColor: color.value },
                selectedColor === color.value && styles.colorButtonSelected,
              ]}
              onPress={() => onSelect(color.value)}
            >
              {selectedColor === color.value && (
                <Text style={styles.checkmark}>{'\u2713'}</Text>
              )}
            </TouchableOpacity>
          ))}
        <TouchableOpacity
          style={[
            styles.colorButton,
            { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.border },
            selectedColor === '#FFFFFF' && styles.colorButtonSelected,
          ]}
          onPress={() => onSelect('#FFFFFF')}
        >
          {selectedColor === '#FFFFFF' && (
            <Text style={[styles.checkmark, { color: colors.text }]}>{'\u2713'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Multiball</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Sports Franchise Manager
        </Text>
      </View>

      {/* Team Preview */}
      <View style={[styles.previewCard, { backgroundColor: colors.card }, shadows.md]}>
        <View
          style={[
            styles.previewBanner,
            { backgroundColor: primaryColor },
          ]}
        >
          <View style={[styles.previewAccent, { backgroundColor: secondaryColor }]} />
        </View>
        <Text
          style={[
            styles.previewName,
            { color: teamName ? colors.text : colors.textMuted },
          ]}
        >
          {teamName || 'Your Team'}
        </Text>
      </View>

      {/* Team Name Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Team Name</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Enter team name..."
          placeholderTextColor={colors.textMuted}
          value={teamName}
          onChangeText={setTeamName}
          maxLength={20}
          autoCapitalize="words"
        />
        <Text style={[styles.charCount, { color: colors.textMuted }]}>
          {teamName.length}/20
        </Text>
      </View>

      {/* Colors */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        {renderColorPicker('Primary Color', primaryColor, setPrimaryColor, secondaryColor)}
        {renderColorPicker('Secondary Color', secondaryColor, setSecondaryColor, primaryColor)}
      </View>

      {/* Difficulty */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Difficulty</Text>
        <View style={styles.difficultyOptions}>
          {difficultyOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.difficultyButton,
                {
                  backgroundColor:
                    difficulty === opt.key ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setDifficulty(opt.key)}
            >
              <Text
                style={[
                  styles.difficultyLabel,
                  { color: difficulty === opt.key ? '#FFFFFF' : colors.text },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.difficultyDesc,
                  { color: difficulty === opt.key ? '#FFFFFF99' : colors.textMuted },
                ]}
              >
                {opt.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.startButton,
            {
              backgroundColor: isValid ? colors.primary : colors.surface,
              opacity: isValid ? 1 : 0.5,
            },
          ]}
          onPress={handleStartGame}
          disabled={!isValid}
        >
          <Text
            style={[
              styles.startButtonText,
              { color: isValid ? '#FFFFFF' : colors.textMuted },
            ]}
          >
            Start New Game
          </Text>
        </TouchableOpacity>

        {hasSavedGame && (
          <TouchableOpacity
            style={[styles.loadButton, { borderColor: colors.border }]}
            onPress={onLoadGame}
          >
            <Text style={[styles.loadButtonText, { color: colors.text }]}>
              Continue Saved Game
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Overwrite Confirmation */}
      <ConfirmationModal
        visible={showOverwriteConfirm}
        title="Overwrite Save?"
        message="Starting a new game will overwrite your existing saved game. This cannot be undone."
        confirmText="Start New"
        confirmStyle="destructive"
        cancelText="Cancel"
        onConfirm={startGame}
        onCancel={() => setShowOverwriteConfirm(false)}
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
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  previewCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  previewBanner: {
    height: 80,
    justifyContent: 'flex-end',
  },
  previewAccent: {
    height: 8,
  },
  previewName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    padding: spacing.md,
  },
  inputCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  textInput: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  colorSection: {
    marginBottom: spacing.md,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  difficultyOptions: {
    gap: spacing.sm,
  },
  difficultyButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  difficultyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  difficultyDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  startButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NewGameScreen;
