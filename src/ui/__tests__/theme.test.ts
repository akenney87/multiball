/**
 * Theme Tests
 */

import {
  lightColors,
  darkColors,
  createTeamTheme,
  spacing,
  borderRadius,
  shadows,
  layout,
  fontSize,
  fontWeight,
  textStyles,
} from '../theme';

describe('Theme System', () => {
  describe('Colors', () => {
    it('light colors has all required properties', () => {
      expect(lightColors.primary).toBeDefined();
      expect(lightColors.background).toBeDefined();
      expect(lightColors.text).toBeDefined();
      expect(lightColors.success).toBeDefined();
      expect(lightColors.error).toBeDefined();
      expect(lightColors.basketball).toBeDefined();
      expect(lightColors.baseball).toBeDefined();
      expect(lightColors.soccer).toBeDefined();
    });

    it('dark colors has all required properties', () => {
      expect(darkColors.primary).toBeDefined();
      expect(darkColors.background).toBeDefined();
      expect(darkColors.text).toBeDefined();
    });

    it('light and dark have different backgrounds', () => {
      expect(lightColors.background).not.toBe(darkColors.background);
    });

    it('createTeamTheme creates custom theme with primary color', () => {
      const customTheme = createTeamTheme(lightColors, '#FF0000');
      expect(customTheme.primary).toBe('#FF0000');
      expect(customTheme.primaryDark).toBeDefined();
      expect(customTheme.primaryLight).toBeDefined();
    });

    it('createTeamTheme accepts optional secondary color', () => {
      const customTheme = createTeamTheme(lightColors, '#FF0000', '#00FF00');
      expect(customTheme.primary).toBe('#FF0000');
      expect(customTheme.secondary).toBe('#00FF00');
    });
  });

  describe('Spacing', () => {
    it('spacing values are defined and in order', () => {
      expect(spacing.xs).toBeLessThan(spacing.sm);
      expect(spacing.sm).toBeLessThan(spacing.md);
      expect(spacing.md).toBeLessThan(spacing.lg);
      expect(spacing.lg).toBeLessThan(spacing.xl);
    });

    it('borderRadius values are defined', () => {
      expect(borderRadius.none).toBe(0);
      expect(borderRadius.sm).toBeGreaterThan(0);
      expect(borderRadius.md).toBeGreaterThan(borderRadius.sm);
      expect(borderRadius.full).toBe(9999);
    });

    it('shadows are defined', () => {
      expect(shadows.none).toEqual({});
      expect(shadows.sm.shadowColor).toBeDefined();
      expect(shadows.md.shadowRadius).toBeGreaterThan(shadows.sm.shadowRadius!);
    });

    it('layout values are defined', () => {
      expect(layout.screenPaddingHorizontal).toBeDefined();
      expect(layout.buttonHeight).toBeGreaterThan(0);
      expect(layout.headerHeight).toBeGreaterThan(0);
      expect(layout.tabBarHeight).toBeGreaterThan(0);
    });
  });

  describe('Typography', () => {
    it('fontSize values are defined and in order', () => {
      expect(fontSize.xs).toBeLessThan(fontSize.sm);
      expect(fontSize.sm).toBeLessThan(fontSize.md);
      expect(fontSize.md).toBeLessThan(fontSize.lg);
    });

    it('fontWeight values are strings', () => {
      expect(typeof fontWeight.normal).toBe('string');
      expect(typeof fontWeight.bold).toBe('string');
    });

    it('textStyles has heading styles', () => {
      expect(textStyles.h1).toBeDefined();
      expect(textStyles.h1.fontSize).toBeGreaterThan(textStyles.h2.fontSize!);
    });

    it('textStyles has body styles', () => {
      expect(textStyles.body).toBeDefined();
      expect(textStyles.bodySmall).toBeDefined();
      expect(textStyles.bodyLarge).toBeDefined();
    });

    it('textStyles has button styles', () => {
      expect(textStyles.button).toBeDefined();
      expect(textStyles.buttonSmall).toBeDefined();
    });
  });
});
