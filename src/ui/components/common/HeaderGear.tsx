/**
 * Header Gear Icon Component
 *
 * Settings gear icon for header navigation.
 * NEON PITCH styled with glow on press.
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useColors, glowShadows } from '../../theme';

interface HeaderGearProps {
  onPress: () => void;
}

export function HeaderGear({ onPress }: HeaderGearProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isPressed && glowShadows.primary,
      ]}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text
        style={[
          styles.icon,
          {
            color: isPressed ? colors.primary : colors.textMuted,
          },
        ]}
      >
        {/* Gear/Settings Unicode character */}
        {'\u2699'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
});

export default HeaderGear;
