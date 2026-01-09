/**
 * NEON PITCH Color Theme
 *
 * A bold, gaming-forward aesthetic inspired by FIFA meets Cyberpunk.
 * Electric neon accents on deep dark backgrounds with glowing effects.
 *
 * Design Philosophy:
 * - Pure black backgrounds for maximum contrast and OLED optimization
 * - Electric cyan (#00F5FF) as the dominant primary for that stadium-lights feel
 * - Hot pink/magenta (#FF00AA) as accent for high-impact moments
 * - Sport-specific neon colors for visual differentiation
 * - All UI elements should feel like they're glowing in the dark
 */

export interface ColorTheme {
  // Primary colors (electric cyan - the signature neon)
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Secondary accent (hot pink for highlights)
  secondary: string;
  secondaryDark: string;

  // Background (pure black to near-black gradient)
  background: string;
  surface: string;
  card: string;

  // Text (high contrast whites and grays)
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Status colors (neon variants)
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI elements
  border: string;
  divider: string;
  disabled: string;

  // Sport-specific neon colors
  basketball: string;
  baseball: string;
  soccer: string;

  // === NEON PITCH EXCLUSIVE ===
  // Glow colors for shadow effects
  glowPrimary: string;
  glowSecondary: string;
  glowSuccess: string;
  glowError: string;

  // Card styling
  cardBorder: string;
  cardGlow: string;

  // Gradient stops for premium effects
  gradientStart: string;
  gradientEnd: string;
}

// ============================================================================
// NEON PITCH - DARK MODE (Primary Experience)
// The full cyberpunk stadium experience
// ============================================================================
export const darkColors: ColorTheme = {
  // Primary - Electric Cyan (the signature neon blue)
  primary: '#00F5FF',
  primaryDark: '#00C4CC',
  primaryLight: '#66F9FF',

  // Secondary - Hot Pink (for accents and highlights)
  secondary: '#FF00AA',
  secondaryDark: '#CC0088',

  // Background - Pure black to deep purple-black
  background: '#000000',
  surface: '#0A0A0F',
  card: '#14141F',

  // Text - Crisp whites with gray hierarchy
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#505060',
  textInverse: '#000000',

  // Status - Neon variants for maximum visibility
  success: '#00FF88',
  warning: '#FFB800',
  error: '#FF3366',
  info: '#00F5FF',

  // UI Elements
  border: '#1E1E2E',
  divider: '#14141F',
  disabled: '#303040',

  // Sports - Neon sport colors
  basketball: '#FF6600',
  baseball: '#FF2244',
  soccer: '#00FF66',

  // Glow effects
  glowPrimary: '#00F5FF',
  glowSecondary: '#FF00AA',
  glowSuccess: '#00FF88',
  glowError: '#FF3366',

  // Card styling
  cardBorder: '#1E1E2E',
  cardGlow: '#00F5FF',

  // Gradients
  gradientStart: '#00F5FF',
  gradientEnd: '#FF00AA',
};

// ============================================================================
// NEON PITCH - LIGHT MODE (Softer Neon Variant)
// A lighter take that's still distinctly neon - think daytime stadium
// ============================================================================
export const lightColors: ColorTheme = {
  // Primary - Deeper cyan for light backgrounds
  primary: '#00D4E0',
  primaryDark: '#00A8B3',
  primaryLight: '#33E0EA',

  // Secondary - Magenta
  secondary: '#E6009A',
  secondaryDark: '#B30078',

  // Background - Soft dark grays (not true light - stays gaming)
  background: '#0F0F14',
  surface: '#18181F',
  card: '#1E1E28',

  // Text - Slightly softer whites
  text: '#F0F0F5',
  textSecondary: '#9090A0',
  textMuted: '#606070',
  textInverse: '#0F0F14',

  // Status - Slightly muted neons
  success: '#00E07A',
  warning: '#E6A600',
  error: '#E62E5C',
  info: '#00D4E0',

  // UI Elements
  border: '#2A2A38',
  divider: '#1E1E28',
  disabled: '#404050',

  // Sports
  basketball: '#E65C00',
  baseball: '#E62040',
  soccer: '#00E05C',

  // Glow effects
  glowPrimary: '#00D4E0',
  glowSecondary: '#E6009A',
  glowSuccess: '#00E07A',
  glowError: '#E62E5C',

  // Card styling
  cardBorder: '#2A2A38',
  cardGlow: '#00D4E0',

  // Gradients
  gradientStart: '#00D4E0',
  gradientEnd: '#E6009A',
};

/**
 * Create a custom theme with team colors while preserving neon aesthetic
 */
export function createTeamTheme(
  baseTheme: ColorTheme,
  primaryColor: string,
  secondaryColor?: string
): ColorTheme {
  return {
    ...baseTheme,
    primary: primaryColor,
    primaryDark: adjustBrightness(primaryColor, -20),
    primaryLight: adjustBrightness(primaryColor, 20),
    secondary: secondaryColor || baseTheme.secondary,
    glowPrimary: primaryColor,
    cardGlow: primaryColor,
    gradientStart: primaryColor,
  };
}

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Get rgba version of hex color for transparency effects
 */
export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
