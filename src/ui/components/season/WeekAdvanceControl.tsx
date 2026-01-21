/**
 * Week Advance Control
 *
 * Allows advancing multiple weeks at once with:
 * - Stepper control (+/-) to select number of weeks
 * - Loading modal with progress bar during advancement
 * - Cancel button to stop after current week
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';

interface WeekAdvanceControlProps {
  /** Current week number */
  currentWeek: number;
  /** Total weeks in season */
  totalWeeks: number;
  /** Whether currently advancing (external state) */
  isAdvancing?: boolean;
  /** Callback to advance a single week, returns when complete */
  onAdvanceWeek: () => Promise<void>;
  /** Optional callback for progress updates */
  onProgress?: (current: number, total: number) => void;
}

export function WeekAdvanceControl({
  currentWeek,
  totalWeeks,
  isAdvancing: externalIsAdvancing,
  onAdvanceWeek,
}: WeekAdvanceControlProps) {
  const colors = useColors();
  const [weeksToAdvance, setWeeksToAdvance] = useState(1);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [shouldCancel, setShouldCancel] = useState(false);
  const cancelRef = React.useRef(false);

  // Max weeks we can advance (don't go past season end)
  const maxWeeks = Math.min(10, totalWeeks - currentWeek + 1);

  const incrementWeeks = useCallback(() => {
    setWeeksToAdvance((prev) => Math.min(prev + 1, maxWeeks));
  }, [maxWeeks]);

  const decrementWeeks = useCallback(() => {
    setWeeksToAdvance((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleAdvance = useCallback(async () => {
    if (isAdvancing || externalIsAdvancing) return;

    setIsAdvancing(true);
    setCurrentProgress(0);
    setShouldCancel(false);
    cancelRef.current = false;

    try {
      for (let i = 0; i < weeksToAdvance; i++) {
        // Check for cancellation via ref (immediate)
        if (cancelRef.current) {
          break;
        }

        setCurrentProgress(i + 1);
        await onAdvanceWeek();

        // Small delay between weeks for UI responsiveness
        if (i < weeksToAdvance - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      setIsAdvancing(false);
      setCurrentProgress(0);
      setShouldCancel(false);
      cancelRef.current = false;
    }
  }, [weeksToAdvance, onAdvanceWeek, isAdvancing, externalIsAdvancing]);

  const handleCancel = useCallback(() => {
    setShouldCancel(true);
    cancelRef.current = true;
  }, []);

  const progressPercent = weeksToAdvance > 0
    ? Math.round((currentProgress / weeksToAdvance) * 100)
    : 0;

  const disabled = isAdvancing || externalIsAdvancing;

  return (
    <View style={styles.container}>
      {/* Compact horizontal layout: [-] [Advance X Weeks] [+] */}
      <View style={styles.compactRow}>
        <TouchableOpacity
          style={[
            styles.compactStepper,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled || weeksToAdvance <= 1 ? 0.5 : 1,
            },
          ]}
          onPress={decrementWeeks}
          disabled={disabled || weeksToAdvance <= 1}
        >
          <Text style={[styles.compactStepperText, { color: colors.text }]}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.compactAdvanceButton,
            {
              backgroundColor: disabled ? colors.surface : colors.secondary,
              borderColor: disabled ? colors.border : colors.secondary,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
          onPress={handleAdvance}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {externalIsAdvancing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[styles.compactAdvanceText, { color: '#000000' }]}>
              Advance {weeksToAdvance} {weeksToAdvance === 1 ? 'Week' : 'Weeks'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.compactStepper,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled || weeksToAdvance >= maxWeeks ? 0.5 : 1,
            },
          ]}
          onPress={incrementWeeks}
          disabled={disabled || weeksToAdvance >= maxWeeks}
        >
          <Text style={[styles.compactStepperText, { color: colors.text }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Modal */}
      <Modal
        visible={isAdvancing}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Advancing Season
            </Text>

            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                Week {currentProgress} of {weeksToAdvance}
              </Text>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPercent, { color: colors.textMuted }]}>
                {progressPercent}%
              </Text>
            </View>

            <View style={styles.processingInfo}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.processingText, { color: colors.textSecondary }]}>
                Simulating matches, processing AI transfers, updating player progression...
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleCancel}
            >
              <Text style={[styles.cancelButtonText, { color: colors.error }]}>
                Cancel After Current Week
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactStepper: {
    width: 36,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStepperText: {
    fontSize: 20,
    fontWeight: '600',
  },
  compactAdvanceButton: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAdvanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  processingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  processingText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default WeekAdvanceControl;
