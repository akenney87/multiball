/**
 * Save Indicator Component
 *
 * Visual indicator for save status:
 * - Saving animation
 * - Last saved timestamp
 * - Error indicator
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: string | null;
  errorMessage?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function SaveIndicator({
  status,
  lastSaved,
  errorMessage,
  autoHide = true,
  autoHideDelay = 3000,
}: SaveIndicatorProps) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      if (autoHide && (status === 'saved' || status === 'error')) {
        const timer = setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setVisible(false));
        }, autoHideDelay);

        return () => clearTimeout(timer);
      }
    }
  }, [status, autoHide, autoHideDelay, opacity]);

  if (!visible && status === 'idle') return null;

  const formatLastSaved = (timestamp: string | null | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'saving':
        return {
          icon: '...',
          text: 'Saving',
          color: colors.primary,
          bgColor: colors.primary + '20',
        };
      case 'saved':
        return {
          icon: '\u2713',
          text: lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Saved',
          color: colors.success,
          bgColor: colors.success + '20',
        };
      case 'error':
        return {
          icon: '!',
          text: errorMessage || 'Save failed',
          color: colors.error,
          bgColor: colors.error + '20',
        };
      default:
        return {
          icon: '',
          text: '',
          color: colors.textMuted,
          bgColor: colors.surface,
        };
    }
  };

  const info = getStatusInfo();

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: info.bgColor, opacity },
      ]}
    >
      <Text style={[styles.icon, { color: info.color }]}>{info.icon}</Text>
      <Text style={[styles.text, { color: info.color }]}>{info.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default SaveIndicator;
