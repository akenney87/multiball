/**
 * Connected Lineups Screen
 *
 * Manage default lineups for all three sports.
 * Changes here persist and become the default for all matches.
 * Located in Manage > Squad > Lineups.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, spacing } from '../theme';
import { SegmentControl } from '../components/common';
import { ConnectedLineupEditorScreen } from './ConnectedLineupEditorScreen';

type SportTab = 'basketball' | 'baseball' | 'soccer';

interface ConnectedLineupsScreenProps {
  onPlayerPress?: (playerId: string) => void;
}

export function ConnectedLineupsScreen({ onPlayerPress }: ConnectedLineupsScreenProps) {
  const colors = useColors();
  const [selectedSport, setSelectedSport] = useState<SportTab>('basketball');

  // No-op for save/cancel since this is a persistent editor (changes auto-save)
  const handleSave = () => {
    // Changes are already persisted via useLineup hook
  };

  const handleCancel = () => {
    // No-op - this is not a modal, changes persist automatically
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sport Tabs */}
      <View style={styles.tabContainer}>
        <SegmentControl
          segments={[
            { key: 'basketball', label: 'Basketball' },
            { key: 'baseball', label: 'Baseball' },
            { key: 'soccer', label: 'Soccer' },
          ]}
          selectedKey={selectedSport}
          onChange={(key) => setSelectedSport(key as SportTab)}
          size="compact"
        />
      </View>

      {/* Lineup Editor for Selected Sport */}
      <View style={styles.editorContainer}>
        <ConnectedLineupEditorScreen
          sport={selectedSport}
          onSave={handleSave}
          onCancel={handleCancel}
          onPlayerPress={onPlayerPress}
          hideActionButtons
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editorContainer: {
    flex: 1,
  },
});

export default ConnectedLineupsScreen;
