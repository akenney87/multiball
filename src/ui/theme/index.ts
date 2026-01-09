/**
 * NEON PITCH Theme Module
 *
 * Exports all theme-related values and components.
 * Gaming-forward aesthetic with electric neon accents.
 */

// Colors
export { lightColors, darkColors, createTeamTheme, hexToRgba } from './colors';
export type { ColorTheme } from './colors';

// Typography
export {
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  textStyles,
  textGlow,
} from './typography';

// Spacing & Effects
export {
  spacing,
  borderRadius,
  shadows,
  glowShadows,
  cardStyles,
  layout,
} from './spacing';

// Context
export { ThemeProvider, useTheme, useColors, useGlow } from './ThemeContext';
