/**
 * Dropdown Component
 *
 * NEON PITCH styled dropdown picker for selecting from a list of options.
 * Uses a modal for the picker interface on mobile.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../../theme';

export interface DropdownOption<T> {
  value: T;
  label: string;
}

interface DropdownProps<T> {
  /** Available options */
  options: DropdownOption<T>[];
  /** Currently selected value */
  selectedValue: T;
  /** Called when selection changes */
  onSelect: (value: T) => void;
  /** Placeholder text when nothing selected */
  placeholder?: string;
  /** Additional container styles */
  style?: ViewStyle;
  /** Size variant */
  size?: 'default' | 'compact';
  /** Disable the dropdown */
  disabled?: boolean;
}

export function Dropdown<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select...',
  style,
  size = 'default',
  disabled = false,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useColors();

  const selectedOption = options.find((o) => o.value === selectedValue);
  const isCompact = size === 'compact';

  const handleSelect = (value: T) => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.trigger,
          isCompact && styles.triggerCompact,
          {
            backgroundColor: colors.surface,
            borderColor: disabled ? colors.border : colors.primary,
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text
          style={[
            styles.triggerText,
            isCompact && styles.triggerTextCompact,
            {
              color: selectedOption ? colors.text : colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={[styles.chevron, { color: colors.primary }]}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* Modal Picker */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={[
              styles.pickerContainer,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              shadows.lg,
            ]}
          >
            <View
              style={[
                styles.pickerHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Select Option
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={[styles.closeButton, { color: colors.primary }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const isSelected = item.value === selectedValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      isSelected && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Text style={{ color: colors.primary }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 120,
  },
  triggerCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 100,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  triggerTextCompact: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 10,
    marginLeft: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionText: {
    fontSize: 14,
  },
});

export default Dropdown;
