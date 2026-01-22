/**
 * TROPHY ROOM Theme Module
 *
 * Exports all theme-related values and components.
 * Luxury editorial aesthetic with warm monochrome palette and gold accents.
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
