/**
 * TROPHY ROOM Spacing System
 *
 * Consistent spacing values for margins, paddings, and gaps.
 * Refined shadows and sharper edges for luxury editorial aesthetic.
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

// Border radius - sharper edges for editorial feel, with options
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
};

// ============================================================================
// REFINED SHADOW SYSTEM
// Subtle, sophisticated shadows for depth without being heavy
// ============================================================================

// Standard shadows (warm-tinted for cohesion)
export const shadows = {
  none: {},

  // Subtle depth shadow
  sm: {
    shadowColor: '#0C0B09',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },

  // Medium depth shadow
  md: {
    shadowColor: '#0C0B09',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  // Large depth shadow
  lg: {
    shadowColor: '#0C0B09',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Extra large for modals and overlays
  xl: {
    shadowColor: '#0C0B09',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ============================================================================
// ACCENT GLOW EFFECTS
// Subtle gold accents for premium feel - much more restrained than neon
// ============================================================================

export const glowShadows = {
  // Primary gold glow - subtle, for active states
  primary: {
    shadowColor: '#C9A962',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Intense primary glow - for press states
  primaryIntense: {
    shadowColor: '#C9A962',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  // Secondary rust glow - for secondary accents
  secondary: {
    shadowColor: '#B87A5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Success green glow
  success: {
    shadowColor: '#7BAD7B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Warning amber glow
  warning: {
    shadowColor: '#D4A54A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Error red glow
  error: {
    shadowColor: '#C75B5B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Sport-specific glows
  basketball: {
    shadowColor: '#D4915C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  baseball: {
    shadowColor: '#C75B5B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  soccer: {
    shadowColor: '#7BAD7B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Subtle card accent - barely visible glow
  cardSubtle: {
    shadowColor: '#C9A962',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },

  // Text glow effect (for special headlines)
  text: {
    textShadowColor: '#C9A962',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  // Score/stat number glow - subtle gold highlight
  stat: {
    textShadowColor: '#C9A962',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
};

// ============================================================================
// CARD STYLES
// Sharp, sophisticated cards with subtle borders
// ============================================================================

export const cardStyles = {
  // Default card - clean with subtle border
  default: {
    borderWidth: 1,
    borderColor: '#2A2824',
    borderRadius: borderRadius.sm,
  },

  // Highlighted card with subtle gold border
  highlighted: {
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.3)', // Gold at 30%
    borderRadius: borderRadius.sm,
    ...glowShadows.cardSubtle,
  },

  // Active/selected card with gold border
  active: {
    borderWidth: 1,
    borderColor: '#C9A962',
    borderRadius: borderRadius.sm,
    ...glowShadows.primary,
  },

  // Sport-specific cards
  basketball: {
    borderWidth: 1,
    borderColor: 'rgba(212, 145, 92, 0.3)',
    borderRadius: borderRadius.sm,
    ...glowShadows.basketball,
  },

  baseball: {
    borderWidth: 1,
    borderColor: 'rgba(199, 91, 91, 0.3)',
    borderRadius: borderRadius.sm,
    ...glowShadows.baseball,
  },

  soccer: {
    borderWidth: 1,
    borderColor: 'rgba(123, 173, 123, 0.3)',
    borderRadius: borderRadius.sm,
    ...glowShadows.soccer,
  },

  // Sharp card - no radius, editorial feel
  sharp: {
    borderWidth: 1,
    borderColor: '#2A2824',
    borderRadius: 0,
  },

  // Sharp active - for buttons and CTAs
  sharpActive: {
    borderWidth: 1,
    borderColor: '#C9A962',
    borderRadius: 0,
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

  // Buttons - editorial feel with generous padding
  buttonPaddingHorizontal: spacing.xl,
  buttonPaddingVertical: spacing.lg,
  buttonHeight: 52,
  buttonHeightSmall: 40,

  // Input fields
  inputHeight: 48,
  inputPaddingHorizontal: spacing.lg,

  // Header
  headerHeight: 56,
  tabBarHeight: 60,
};
