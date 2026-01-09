/**
 * NEON PITCH Typography System
 *
 * Gaming-forward typography with bold headlines and crisp body text.
 * Designed for high contrast on dark backgrounds.
 */

import { TextStyle, Platform } from 'react-native';

// Font families - using system fonts for reliability
// On a real gaming app, you'd want custom fonts like Orbitron, Rajdhani, or Exo
export const fontFamily = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }),
  // Monospace for stats and numbers
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

// Font sizes - slightly larger for gaming readability
export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 26,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48, // For big score displays
};

// Line heights
export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
};

// Font weights
export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
};

// Letter spacing - wider for that futuristic feel
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
};

// Pre-defined text styles with NEON PITCH aesthetic
export const textStyles: Record<string, TextStyle> = {
  // ============================================================================
  // HEADINGS - Bold, impactful, gaming-forward
  // ============================================================================
  h1: {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.black,
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },
  h4: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },

  // ============================================================================
  // BODY TEXT - Clean and readable
  // ============================================================================
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.md * lineHeight.normal,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  bodyLarge: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.lg * lineHeight.normal,
  },

  // ============================================================================
  // LABELS - Uppercase with letter spacing for that tech feel
  // ============================================================================
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.sm * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },
  labelSmall: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xs * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.widest,
  },
  labelLarge: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.md * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
  },

  // ============================================================================
  // STATS & SCORES - Big, bold, for that scoreboard feel
  // ============================================================================
  stat: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.black,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  statSmall: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },
  statLarge: {
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.black,
    lineHeight: fontSize['6xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  // For player ratings, percentages
  rating: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },

  // ============================================================================
  // BUTTONS - Clear, actionable
  // ============================================================================
  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.md * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.sm * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },

  // ============================================================================
  // SPECIAL STYLES
  // ============================================================================
  // Live indicator text
  live: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
  },
  // Match time display
  matchTime: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
    fontFamily: fontFamily.mono,
  },
  // Player name
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.lg * lineHeight.tight,
  },
  // Position badge
  position: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
};

// ============================================================================
// NEON TEXT GLOW STYLES
// Apply these alongside textStyles for glowing text effects
// ============================================================================
export const textGlow = {
  primary: {
    textShadowColor: '#00F5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  primaryIntense: {
    textShadowColor: '#00F5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  secondary: {
    textShadowColor: '#FF00AA',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  success: {
    textShadowColor: '#00FF88',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  error: {
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  score: {
    textShadowColor: '#00F5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
};
