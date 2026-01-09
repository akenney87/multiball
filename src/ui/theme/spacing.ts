/**
 * NEON PITCH Spacing System
 *
 * Consistent spacing values for margins, paddings, and gaps.
 * Based on 4px grid with neon glow shadow effects.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

// Border radius - slightly larger for that modern gaming look
export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
};

// ============================================================================
// NEON GLOW SHADOW SYSTEM
// These shadows create the signature glowing effect of NEON PITCH
// ============================================================================

// Standard shadows (subtle, for depth without glow)
export const shadows = {
  none: {},

  // Subtle depth shadow
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  // Medium depth shadow
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },

  // Large depth shadow
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ============================================================================
// NEON GLOW EFFECTS
// Use these for that signature cyberpunk stadium-lights aesthetic
// ============================================================================

export const glowShadows = {
  // Primary cyan glow - for cards, buttons, active states
  primary: {
    shadowColor: '#00F5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Intense primary glow - for hover/press states
  primaryIntense: {
    shadowColor: '#00F5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },

  // Secondary pink glow - for accents, alerts
  secondary: {
    shadowColor: '#FF00AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Success neon green glow
  success: {
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Warning amber glow
  warning: {
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Error red glow
  error: {
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Sport-specific glows
  basketball: {
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  baseball: {
    shadowColor: '#FF2244',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  soccer: {
    shadowColor: '#00FF66',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Subtle card border glow
  cardSubtle: {
    shadowColor: '#00F5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  // Text glow effect (for headlines)
  text: {
    textShadowColor: '#00F5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // Score/stat number glow
  stat: {
    textShadowColor: '#00F5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
};

// ============================================================================
// CARD STYLES
// Pre-built card styles with neon borders and glows
// ============================================================================

export const cardStyles = {
  // Default card with subtle glow border
  default: {
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: borderRadius.lg,
  },

  // Highlighted card with primary glow
  highlighted: {
    borderWidth: 1,
    borderColor: '#00F5FF40', // 40 = 25% opacity
    borderRadius: borderRadius.lg,
    ...glowShadows.cardSubtle,
  },

  // Active/selected card with intense glow
  active: {
    borderWidth: 1,
    borderColor: '#00F5FF',
    borderRadius: borderRadius.lg,
    ...glowShadows.primary,
  },

  // Sport-specific cards
  basketball: {
    borderWidth: 1,
    borderColor: '#FF660040',
    borderRadius: borderRadius.lg,
    ...glowShadows.basketball,
  },

  baseball: {
    borderWidth: 1,
    borderColor: '#FF224440',
    borderRadius: borderRadius.lg,
    ...glowShadows.baseball,
  },

  soccer: {
    borderWidth: 1,
    borderColor: '#00FF6640',
    borderRadius: borderRadius.lg,
    ...glowShadows.soccer,
  },
};

// Common layout helpers
export const layout = {
  // Screen padding
  screenPaddingHorizontal: spacing.lg,
  screenPaddingVertical: spacing.lg,

  // Card
  cardPadding: spacing.lg,
  cardGap: spacing.md,

  // List items
  listItemPaddingVertical: spacing.md,
  listItemPaddingHorizontal: spacing.lg,
  listItemGap: spacing.sm,

  // Buttons
  buttonPaddingHorizontal: spacing.xl,
  buttonPaddingVertical: spacing.md,
  buttonHeight: 48,
  buttonHeightSmall: 36,

  // Input fields
  inputHeight: 48,
  inputPaddingHorizontal: spacing.lg,

  // Header
  headerHeight: 56,
  tabBarHeight: 60,
};
