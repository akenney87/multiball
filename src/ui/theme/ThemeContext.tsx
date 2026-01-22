/**
 * TROPHY ROOM Theme Context
 *
 * Provides theme values throughout the app with luxury accent support.
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { ColorTheme, lightColors, darkColors, createTeamTheme } from './colors';
import { glowShadows } from './spacing';

interface ThemeContextValue {
  colors: ColorTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTeamColors: (primary: string, secondary?: string) => void;
  // Accent utilities
  getGlow: (type: 'primary' | 'secondary' | 'success' | 'warning' | 'error') => typeof glowShadows.primary;
  getSportGlow: (sport: 'basketball' | 'baseball' | 'soccer') => typeof glowShadows.primary;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialDark?: boolean;
}

export function ThemeProvider({ children, initialDark = true }: ThemeProviderProps) {
  // Default to dark mode for TROPHY ROOM (the primary experience)
  const [isDark, setIsDark] = useState(initialDark);
  const [teamPrimary, setTeamPrimary] = useState<string | null>(null);
  const [teamSecondary, setTeamSecondary] = useState<string | null>(null);

  const colors = useMemo(() => {
    const baseTheme = isDark ? darkColors : lightColors;
    if (teamPrimary) {
      return createTeamTheme(baseTheme, teamPrimary, teamSecondary || undefined);
    }
    return baseTheme;
  }, [isDark, teamPrimary, teamSecondary]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const setTeamColors = (primary: string, secondary?: string) => {
    setTeamPrimary(primary);
    setTeamSecondary(secondary || null);
  };

  // Dynamic accent shadow based on current theme colors
  const getGlow = (type: 'primary' | 'secondary' | 'success' | 'warning' | 'error') => {
    const glowColors = {
      primary: colors.glowPrimary,
      secondary: colors.glowSecondary,
      success: colors.glowSuccess,
      warning: colors.warning,
      error: colors.glowError,
    };
    return {
      shadowColor: glowColors[type],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    };
  };

  // Sport-specific accent glow
  const getSportGlow = (sport: 'basketball' | 'baseball' | 'soccer') => {
    const sportColors = {
      basketball: colors.basketball,
      baseball: colors.baseball,
      soccer: colors.soccer,
    };
    return {
      shadowColor: sportColors[sport],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    };
  };

  const value = useMemo(
    () => ({ colors, isDark, toggleTheme, setTeamColors, getGlow, getSportGlow }),
    [colors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useColors(): ColorTheme {
  const { colors } = useTheme();
  return colors;
}

/**
 * Hook to get accent glow shadow styles
 */
export function useGlow() {
  const { getGlow, getSportGlow } = useTheme();
  return { getGlow, getSportGlow };
}
