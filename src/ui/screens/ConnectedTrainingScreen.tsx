/**
 * Connected Training Screen
 *
 * Team-wide training management screen.
 * Allows setting team default training focus and individual player overrides.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useGame } from '../context/GameContext';
import { TrainingFocusSlider, PlayerTrainingRow } from '../components/training';
import type { TrainingFocus } from '../../systems/trainingSystem';
import { DEFAULT_TRAINING_FOCUS } from '../../systems/trainingSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESETS: { label: string; focus: TrainingFocus }[] = [
  { label: 'Balanced', focus: { physical: 34, mental: 33, technical: 33 } },
  { label: 'Physical', focus: { physical: 50, mental: 25, technical: 25 } },
  { label: 'Mental', focus: { physical: 25, mental: 50, technical: 25 } },
  { label: 'Technical', focus: { physical: 25, mental: 25, technical: 50 } },
];

// =============================================================================
// TYPES
// =============================================================================

interface ConnectedTrainingScreenProps {
  onPlayerPress: (playerId: string) => void;
}

type FilterMode = 'all' | 'custom' | 'team';

// =============================================================================
// COMPONENT
// =============================================================================

export function ConnectedTrainingScreen({ onPlayerPress: _onPlayerPress }: ConnectedTrainingScreenProps) {
  const colors = useColors();
  const { state, setTrainingFocus, getPlayer } = useGame();

  // Local state
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Get team focus
  const teamFocus = useMemo(
    () => state.userTeam.trainingFocus ?? DEFAULT_TRAINING_FOCUS,
    [state.userTeam.trainingFocus]
  );

  // Get roster players
  const rosterPlayers = useMemo(() => {
    return state.userTeam.rosterIds
      .map((id) => getPlayer(id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.userTeam.rosterIds, getPlayer]);

  // Filter players
  const filteredPlayers = useMemo(() => {
    if (filterMode === 'all') return rosterPlayers;
    if (filterMode === 'custom') {
      return rosterPlayers.filter((p) => p.trainingFocus !== null && p.trainingFocus !== undefined);
    }
    return rosterPlayers.filter((p) => p.trainingFocus === null || p.trainingFocus === undefined);
  }, [rosterPlayers, filterMode]);

  // Count players with custom training
  const customCount = useMemo(
    () => rosterPlayers.filter((p) => p.trainingFocus !== null && p.trainingFocus !== undefined).length,
    [rosterPlayers]
  );

  // Get player being edited
  const editingPlayer = useMemo(
    () => (editingPlayerId ? getPlayer(editingPlayerId) : null),
    [editingPlayerId, getPlayer]
  );

  // Handlers
  const handleTeamFocusChange = useCallback(
    (focus: TrainingFocus) => {
      setTrainingFocus(focus);
    },
    [setTrainingFocus]
  );

  const handlePlayerFocusChange = useCallback(
    (playerId: string, focus: TrainingFocus) => {
      setTrainingFocus(focus, playerId);
    },
    [setTrainingFocus]
  );

  const handleResetToTeam = useCallback(
    (playerId: string) => {
      setTrainingFocus(null as any, playerId);
    },
    [setTrainingFocus]
  );

  const handlePresetPress = useCallback(
    (preset: TrainingFocus) => {
      setTrainingFocus(preset);
    },
    [setTrainingFocus]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Team Default Section */}
      <View style={[styles.section, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Team Default Focus
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Applied to all players without custom training
        </Text>

        <View style={styles.teamSliders}>
          <TrainingFocusSlider focus={teamFocus} onChange={handleTeamFocusChange} />
        </View>

        {/* Presets */}
        <View style={styles.presetsRow}>
          {PRESETS.map((preset) => {
            const isActive =
              teamFocus.physical === preset.focus.physical &&
              teamFocus.mental === preset.focus.mental &&
              teamFocus.technical === preset.focus.technical;

            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  {
                    backgroundColor: isActive
                      ? colors.primary + '20'
                      : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handlePresetPress(preset.focus)}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isActive ? colors.primary : colors.text },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Roster Training Section */}
      <View style={styles.rosterSection}>
        <View style={styles.rosterHeader}>
          <Text style={[styles.rosterTitle, { color: colors.text }]}>
            Roster Training
          </Text>
          <Text style={[styles.rosterSubtitle, { color: colors.textMuted }]}>
            {customCount} players with custom training
          </Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterRow}>
          {(['all', 'custom', 'team'] as FilterMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.filterButton,
                {
                  backgroundColor: filterMode === mode
                    ? colors.primary + '20'
                    : colors.surface,
                  borderColor: filterMode === mode ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilterMode(mode)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filterMode === mode ? colors.primary : colors.text },
                ]}
              >
                {mode === 'all' ? 'All' : mode === 'custom' ? 'Custom' : 'Team Default'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Player List */}
        <View style={styles.playerList}>
          {filteredPlayers.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No players match this filter
            </Text>
          ) : (
            filteredPlayers.map((player) => (
              <PlayerTrainingRow
                key={player.id}
                player={player}
                teamFocus={teamFocus}
                onEditPress={() => setEditingPlayerId(player.id)}
                onResetToTeam={() => handleResetToTeam(player.id)}
              />
            ))
          )}
        </View>
      </View>

      {/* Edit Player Modal */}
      <Modal
        visible={editingPlayer !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditingPlayerId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingPlayer?.name}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Age {editingPlayer?.age}
            </Text>

            <View style={styles.modalSliders}>
              <TrainingFocusSlider
                focus={
                  editingPlayer?.trainingFocus ?? teamFocus ?? DEFAULT_TRAINING_FOCUS
                }
                onChange={(focus) =>
                  editingPlayerId && handlePlayerFocusChange(editingPlayerId, focus)
                }
              />
            </View>

            {/* Modal Presets */}
            <View style={styles.presetsRow}>
              {PRESETS.map((preset) => {
                const playerFocus = editingPlayer?.trainingFocus ?? teamFocus;
                const isActive =
                  playerFocus.physical === preset.focus.physical &&
                  playerFocus.mental === preset.focus.mental &&
                  playerFocus.technical === preset.focus.technical;

                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.presetButton,
                      {
                        backgroundColor: isActive
                          ? colors.primary + '20'
                          : colors.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() =>
                      editingPlayerId &&
                      handlePlayerFocusChange(editingPlayerId, preset.focus)
                    }
                  >
                    <Text
                      style={[
                        styles.presetText,
                        { color: isActive ? colors.primary : colors.text },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              {editingPlayer?.trainingFocus && (
                <TouchableOpacity
                  style={[styles.modalResetButton, { borderColor: colors.border }]}
                  onPress={() => {
                    if (editingPlayerId) {
                      handleResetToTeam(editingPlayerId);
                    }
                  }}
                >
                  <Text style={[styles.modalResetText, { color: colors.textSecondary }]}>
                    Reset to Team Default
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
                onPress={() => setEditingPlayerId(null)}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  section: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  teamSliders: {
    marginBottom: spacing.lg,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rosterSection: {
    gap: spacing.md,
  },
  rosterHeader: {
    marginBottom: spacing.xs,
  },
  rosterTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rosterSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  playerList: {
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalSliders: {
    marginBottom: spacing.lg,
  },
  modalActions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalResetButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalResetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalCloseButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ConnectedTrainingScreen;
