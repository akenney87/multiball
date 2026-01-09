/**
 * Scout Instructions Modal
 *
 * Modal for setting auto-scouting filter criteria.
 * Physical, geographic, and contract filters.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';
import type { ScoutInstructions } from '../../context/types';

interface ScoutInstructionsModalProps {
  visible: boolean;
  instructions: ScoutInstructions;
  onSave: (instructions: ScoutInstructions) => void;
  onCancel: () => void;
}

interface RangeInputProps {
  label: string;
  minValue?: number;
  maxValue?: number;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  placeholder?: { min: string; max: string };
  formatValue?: (value: number) => string;
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  placeholder = { min: 'Min', max: 'Max' },
}: RangeInputProps) {
  const colors = useColors();

  const parseNumber = (text: string): number | undefined => {
    const num = parseInt(text, 10);
    return isNaN(num) ? undefined : num;
  };

  return (
    <View style={styles.rangeContainer}>
      <Text style={[styles.rangeLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rangeInputs}>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
          ]}
          value={minValue?.toString() || ''}
          onChangeText={(text) => onMinChange(parseNumber(text))}
          placeholder={placeholder.min}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <Text style={[styles.rangeDash, { color: colors.textMuted }]}>—</Text>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
          ]}
          value={maxValue?.toString() || ''}
          onChangeText={(text) => onMaxChange(parseNumber(text))}
          placeholder={placeholder.max}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

export function ScoutInstructionsModal({
  visible,
  instructions,
  onSave,
  onCancel,
}: ScoutInstructionsModalProps) {
  const colors = useColors();
  const [draft, setDraft] = useState<ScoutInstructions>(instructions);

  // Reset draft when modal opens
  React.useEffect(() => {
    if (visible) {
      setDraft(instructions);
    }
  }, [visible, instructions]);

  const handleReset = () => {
    setDraft({
      freeAgentsOnly: false,
    });
  };

  const updateDraft = (updates: Partial<ScoutInstructions>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modal, { backgroundColor: colors.card }, shadows.lg]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Scout Instructions
                </Text>
                <TouchableOpacity onPress={handleReset}>
                  <Text style={[styles.resetButton, { color: colors.primary }]}>
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Physical Filters Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    PHYSICAL FILTERS
                  </Text>

                  <RangeInput
                    label="Age"
                    minValue={draft.ageMin}
                    maxValue={draft.ageMax}
                    onMinChange={(v) => updateDraft({ ageMin: v })}
                    onMaxChange={(v) => updateDraft({ ageMax: v })}
                    placeholder={{ min: '18', max: '40' }}
                  />

                  <RangeInput
                    label="Height (inches)"
                    minValue={draft.heightMin}
                    maxValue={draft.heightMax}
                    onMinChange={(v) => updateDraft({ heightMin: v })}
                    onMaxChange={(v) => updateDraft({ heightMax: v })}
                    placeholder={{ min: '60 (5\'0")' , max: '90 (7\'6")' }}
                  />

                  <RangeInput
                    label="Weight (lbs)"
                    minValue={draft.weightMin}
                    maxValue={draft.weightMax}
                    onMinChange={(v) => updateDraft({ weightMin: v })}
                    onMaxChange={(v) => updateDraft({ weightMax: v })}
                    placeholder={{ min: '150', max: '300' }}
                  />
                </View>

                {/* Contract Status Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    CONTRACT STATUS
                  </Text>

                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>
                      Free Agents Only
                    </Text>
                    <Switch
                      value={draft.freeAgentsOnly}
                      onValueChange={(v) => updateDraft({ freeAgentsOnly: v })}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.textInverse}
                    />
                  </View>

                  {!draft.freeAgentsOnly && (
                    <>
                      <RangeInput
                        label="Salary ($)"
                        minValue={draft.salaryMin}
                        maxValue={draft.salaryMax}
                        onMinChange={(v) => updateDraft({ salaryMin: v })}
                        onMaxChange={(v) => updateDraft({ salaryMax: v })}
                        placeholder={{ min: '0', max: '50M' }}
                      />

                      <RangeInput
                        label="Transfer Value ($)"
                        minValue={draft.transferValueMin}
                        maxValue={draft.transferValueMax}
                        onMinChange={(v) => updateDraft({ transferValueMin: v })}
                        onMaxChange={(v) => updateDraft({ transferValueMax: v })}
                        placeholder={{ min: '0', max: '100M' }}
                      />
                    </>
                  )}
                </View>

                {/* Help Text */}
                <Text style={[styles.helpText, { color: colors.textMuted }]}>
                  Scouts will prioritize targeted players first, then players matching
                  these filters. Leave fields empty for no restriction.
                </Text>
              </ScrollView>

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { borderColor: colors.border },
                  ]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.saveButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => onSave(draft)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '80%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  resetButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  rangeContainer: {
    marginBottom: spacing.md,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  rangeDash: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScoutInstructionsModal;
