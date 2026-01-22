/**
 * TROPHY ROOM Color Theme
 *
 * A refined, luxury editorial aesthetic inspired by high-fashion sports magazines.
 * Warm monochrome palette with gold accents. Prestigious and timeless.
 *
 * Design Philosophy:
 * - Warm black backgrounds for an intimate, club-like atmosphere
 * - Cream text for softer contrast that's easier on the eyes
 * - Gold (#C9A962) as the signature accent for elegance and prestige
 * - Muted, sophisticated sport colors that feel classic, not garish
 * - All UI elements should feel like premium print design
 */

export interface ColorTheme {
  // Primary colors (refined gold - the signature accent)
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Secondary accent (warm rust for highlights)
  secondary: string;
  secondaryDark: string;

  // Background (warm black to charcoal gradient)
  background: string;
  surface: string;
  card: string;

  // Text (warm cream hierarchy)
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Status colors (muted, sophisticated variants)
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI elements
  border: string;
  divider: string;
  disabled: string;

  // Sport-specific colors (refined, not neon)
  basketball: string;
  baseball: string;
  soccer: string;

  // === TROPHY ROOM EXCLUSIVE ===
  // Accent colors for subtle highlight effects
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
// TROPHY ROOM - DARK MODE (Primary Experience)
// The luxury editorial experience - like reading a premium sports magazine
// ============================================================================
export const darkColors: ColorTheme = {
  // Primary - Refined Gold (the signature luxury accent)
  primary: '#C9A962',
  primaryDark: '#A68B4B',
  primaryLight: '#D9C08A',

  // Secondary - Warm Rust (for secondary accents)
  secondary: '#B87A5E',
  secondaryDark: '#96604A',

  // Background - Warm blacks (not pure black)
  background: '#0C0B09',
  surface: '#161513',
  card: '#1E1C19',

  // Text - Warm cream hierarchy
  text: '#F5F0E8',
  textSecondary: '#B8B2A6',
  textMuted: '#6B665C',
  textInverse: '#0C0B09',

  // Status - Sophisticated, muted variants
  success: '#7BAD7B',
  warning: '#D4A54A',
  error: '#C75B5B',
  info: '#7A9BC7',

  // UI Elements
  border: '#2A2824',
  divider: '#1E1C19',
  disabled: '#3D3A35',

  // Sports - Classic, refined sport colors
  basketball: '#D4915C',
  baseball: '#C75B5B',
  soccer: '#7BAD7B',

  // Accent effects (subtle gold glow)
  glowPrimary: '#C9A962',
  glowSecondary: '#B87A5E',
  glowSuccess: '#7BAD7B',
  glowError: '#C75B5B',

  // Card styling
  cardBorder: '#2A2824',
  cardGlow: '#C9A962',

  // Gradients
  gradientStart: '#C9A962',
  gradientEnd: '#B87A5E',
};

// ============================================================================
// TROPHY ROOM - LIGHT MODE (Alternative Experience)
// A lighter take - think daytime luxury lounge
// ============================================================================
export const lightColors: ColorTheme = {
  // Primary - Deeper gold for light backgrounds
  primary: '#A68B4B',
  primaryDark: '#8A7340',
  primaryLight: '#C9A962',

  // Secondary - Deeper rust
  secondary: '#96604A',
  secondaryDark: '#7A4E3D',

  // Background - Warm off-whites and creams
  background: '#F5F2ED',
  surface: '#EBE7E0',
  card: '#FFFFFF',

  // Text - Warm dark browns
  text: '#1E1C19',
  textSecondary: '#4A463E',
  textMuted: '#8A8478',
  textInverse: '#F5F0E8',

  // Status - Slightly more saturated for visibility
  success: '#5E8A5E',
  warning: '#C4952A',
  error: '#B54545',
  info: '#5A7BA7',

  // UI Elements
  border: '#D9D5CC',
  divider: '#EBE7E0',
  disabled: '#C9C5BC',

  // Sports
  basketball: '#C47A42',
  baseball: '#B54545',
  soccer: '#5E8A5E',

  // Accent effects
  glowPrimary: '#A68B4B',
  glowSecondary: '#96604A',
  glowSuccess: '#5E8A5E',
  glowError: '#B54545',

  // Card styling
  cardBorder: '#D9D5CC',
  cardGlow: '#A68B4B',

  // Gradients
  gradientStart: '#A68B4B',
  gradientEnd: '#96604A',
};

/**
 * Create a custom theme with team colors while preserving luxury aesthetic
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
