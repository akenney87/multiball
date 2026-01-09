/**
 * Placeholder Screen
 *
 * Used during development to represent unbuilt screens.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
}

export function PlaceholderScreen({ title, subtitle }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      <Text style={[styles.badge, { color: colors.textMuted }]}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  badge: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
