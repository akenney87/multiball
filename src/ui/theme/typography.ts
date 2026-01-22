/**
 * TROPHY ROOM Typography System
 *
 * Luxury editorial typography with dramatic weight contrast.
 * Ultra-light headlines paired with bold accents for sophistication.
 * Designed for warm backgrounds with cream text.
 */

import { TextStyle, Platform } from 'react-native';

// Font families - using system fonts for reliability
// For production, consider premium fonts like Canela, Didot, or Chronicle
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
  light: Platform.select({
    ios: 'System',
    android: 'Roboto-Light',
    default: 'System',
  }),
  // Monospace for stats and numbers
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

// Font sizes - refined scale for editorial feel
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
  '6xl': 48,
  '7xl': 56, // For dramatic headlines
};

// Line heights
export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.6,
};

// Font weights - expanded for editorial contrast
export const fontWeight = {
  thin: '100' as const,
  extraLight: '200' as const,
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
};

// Letter spacing - wider for luxury feel
export const letterSpacing = {
  tighter: -1,
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
  editorial: 4, // For mastheads and labels
  display: 6,   // For dramatic headlines
};

// Pre-defined text styles with TROPHY ROOM aesthetic
export const textStyles: Record<string, TextStyle> = {
  // ============================================================================
  // HEADINGS - Dramatic weight contrast (ultra-light with tight tracking)
  // ============================================================================
  h1: {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.extraLight, // Ultra-light for elegance
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  },
  h1Bold: {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.semibold, // Bold contrast
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  },
  h2: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.light,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  h2Bold: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  h3: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.light,
    lineHeight: fontSize['3xl'] * lineHeight.snug,
  },
  h3Bold: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['3xl'] * lineHeight.snug,
  },
  h4: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.medium,
    lineHeight: fontSize['2xl'] * lineHeight.snug,
  },

  // ============================================================================
  // BODY TEXT - Clean and readable with warm cream color
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
  // LABELS - Uppercase with generous letter spacing for editorial feel
  // ============================================================================
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.sm * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },
  labelSmall: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.xs * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.widest,
  },
  labelLarge: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.md * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },
  // Editorial masthead style
  masthead: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.xs * lineHeight.tight,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.editorial,
  },

  // ============================================================================
  // STATS & SCORES - Bold, prominent, scoreboard feel with subtle elegance
  // ============================================================================
  stat: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  statSmall: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },
  statLarge: {
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['6xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  // For player ratings, percentages
  rating: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },

  // ============================================================================
  // BUTTONS - Clean, editorial uppercase
  // ============================================================================
  button: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.sm * lineHeight.tight,
    letterSpacing: letterSpacing.editorial,
    textTransform: 'uppercase',
  },
  buttonSmall: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.xs * lineHeight.tight,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
  buttonLarge: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.md * lineHeight.tight,
    letterSpacing: letterSpacing.editorial,
    textTransform: 'uppercase',
  },

  // ============================================================================
  // SPECIAL STYLES
  // ============================================================================
  // Live indicator text
  live: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
  },
  // Match time display
  matchTime: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
    fontFamily: fontFamily.mono,
  },
  // Player name
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.lg * lineHeight.tight,
  },
  // Position badge
  position: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
  // Section header (like "BASKETBALL", "BASEBALL", "SOCCER")
  sectionHeader: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.editorial,
    textTransform: 'uppercase',
  },
  // Subtle metadata (dates, times, secondary info)
  meta: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.wide,
  },
};

// ============================================================================
// TEXT GLOW STYLES (now gold-tinted for Trophy Room aesthetic)
// Apply these alongside textStyles for subtle highlight effects
// ============================================================================
export const textGlow = {
  primary: {
    textShadowColor: '#C9A962',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  primaryIntense: {
    textShadowColor: '#C9A962',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  secondary: {
    textShadowColor: '#B87A5E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  success: {
    textShadowColor: '#7BAD7B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  error: {
    textShadowColor: '#C75B5B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  score: {
    textShadowColor: '#C9A962',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
};
