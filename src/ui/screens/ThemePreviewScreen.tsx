/**
 * Theme Preview Screen
 *
 * Temporary screen to preview the 3 proposed UI themes before committing.
 * Access from Settings > "Preview New Themes"
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const themes = {
  pressBox: {
    name: 'PRESS BOX',
    subtitle: 'Sports Broadcast Editorial',
    description: 'ESPN meets The Athletic. Bold, data-driven, professional.',
    colors: {
      background: '#0D1117',
      surface: '#161B22',
      card: '#21262D',
      cardBorder: '#30363D',
      primary: '#FFD100',
      primaryDark: '#E5BC00',
      accent: '#FF4444',
      text: '#F0F6FC',
      textSecondary: '#8B949E',
      textMuted: '#484F58',
      success: '#3FB950',
      warning: '#D29922',
      error: '#F85149',
      basketball: '#FF6B35',
      baseball: '#E63946',
      soccer: '#06D6A0',
    },
    fonts: {
      display: 'bold',
      body: 'normal',
    },
    borderRadius: 4,
    cardStyle: 'angular', // Sharp left edge accent
  },
  neonPitch: {
    name: 'NEON PITCH',
    subtitle: 'Stadium Lights After Dark',
    description: 'FIFA meets Cyberpunk. Electric, immersive, gaming-forward.',
    colors: {
      background: '#000000',
      surface: '#0A0A0F',
      card: '#14141F',
      cardBorder: '#1E1E2E',
      primary: '#00F5FF',
      primaryDark: '#00C4CC',
      accent: '#FF00AA',
      text: '#FFFFFF',
      textSecondary: '#A0A0B0',
      textMuted: '#505060',
      success: '#00FF88',
      warning: '#FFB800',
      error: '#FF3366',
      basketball: '#FF6600',
      baseball: '#FF2244',
      soccer: '#00FF66',
    },
    fonts: {
      display: 'bold',
      body: 'normal',
    },
    borderRadius: 12,
    cardStyle: 'glow', // Glowing borders
  },
  vintageLeague: {
    name: 'VINTAGE LEAGUE',
    subtitle: 'Classic Sports Heritage',
    description: 'Trading cards meet old scoreboards. Warm, nostalgic, premium.',
    colors: {
      background: '#F5F0E8',
      surface: '#FFFDF8',
      card: '#FFFFFF',
      cardBorder: '#D4C5B0',
      primary: '#8B2942',
      primaryDark: '#6B1F32',
      accent: '#C9A227',
      text: '#2C1810',
      textSecondary: '#5C4D44',
      textMuted: '#9C8B7D',
      success: '#2D6A4F',
      warning: '#B8860B',
      error: '#9B2226',
      basketball: '#E07A2D',
      baseball: '#B31B1B',
      soccer: '#355E3B',
    },
    fonts: {
      display: 'bold',
      body: 'normal',
    },
    borderRadius: 8,
    cardStyle: 'framed', // Double border frame
  },
};

type ThemeKey = keyof typeof themes;

// ============================================================================
// PREVIEW COMPONENTS
// ============================================================================

interface ThemePreviewProps {
  themeKey: ThemeKey;
}

function ThemePreview({ themeKey }: ThemePreviewProps) {
  const theme = themes[themeKey];
  const { colors, borderRadius, cardStyle } = theme;

  // Card style variations
  const getCardStyle = () => {
    const base = {
      backgroundColor: colors.card,
      borderRadius,
      padding: 16,
      marginBottom: 12,
    };

    switch (cardStyle) {
      case 'angular':
        return {
          ...base,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          borderRadius: 2,
        };
      case 'glow':
        return {
          ...base,
          borderWidth: 1,
          borderColor: colors.primary + '40',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        };
      case 'framed':
        return {
          ...base,
          borderWidth: 2,
          borderColor: colors.primary,
        };
      default:
        return base;
    }
  };

  const cardStyles = getCardStyle();

  return (
    <View style={[styles.themeContainer, { backgroundColor: colors.background }]}>
      {/* Theme Header */}
      <View style={styles.themeHeader}>
        <Text style={[styles.themeName, { color: colors.primary }]}>
          {theme.name}
        </Text>
        <Text style={[styles.themeSubtitle, { color: colors.textSecondary }]}>
          {theme.subtitle}
        </Text>
      </View>

      {/* Sample Dashboard */}
      <View style={[styles.sampleSection, { backgroundColor: colors.surface }]}>
        {/* Team Header */}
        <View style={styles.teamHeader}>
          <View>
            <Text style={[styles.teamName, { color: colors.text }]}>
              Riverside Raptors
            </Text>
            <Text style={[styles.teamRecord, { color: colors.textSecondary }]}>
              12-5 | 3rd Place
            </Text>
          </View>
          <View style={[styles.budgetBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.budgetText, { color: colors.primary }]}>
              $4.2M
            </Text>
          </View>
        </View>

        {/* Next Match Card */}
        <View style={cardStyles}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              NEXT MATCH
            </Text>
            {cardStyle === 'angular' && (
              <View style={[styles.liveBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            {cardStyle === 'glow' && (
              <View style={[styles.liveBadge, {
                backgroundColor: colors.accent,
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
              }]}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.matchup}>
            <View style={styles.matchTeam}>
              <View style={[styles.teamLogo, { backgroundColor: colors.basketball }]}>
                <Text style={styles.logoText}>RR</Text>
              </View>
              <Text style={[styles.matchTeamName, { color: colors.text }]}>
                Raptors
              </Text>
            </View>

            <View style={styles.scoreContainer}>
              <Text style={[styles.score, { color: colors.text }]}>78</Text>
              <Text style={[styles.scoreDivider, { color: colors.textMuted }]}>-</Text>
              <Text style={[styles.score, { color: colors.text }]}>72</Text>
            </View>

            <View style={styles.matchTeam}>
              <View style={[styles.teamLogo, { backgroundColor: colors.textMuted }]}>
                <Text style={styles.logoText}>WS</Text>
              </View>
              <Text style={[styles.matchTeamName, { color: colors.text }]}>
                Wolves
              </Text>
            </View>
          </View>

          <Text style={[styles.matchInfo, { color: colors.textSecondary }]}>
            Q3 | 4:32 remaining
          </Text>
        </View>

        {/* Player Card */}
        <View style={cardStyles}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            TOP PERFORMER
          </Text>
          <View style={styles.playerRow}>
            <View style={[styles.playerAvatar, {
              backgroundColor: colors.primary,
              borderColor: cardStyle === 'glow' ? colors.primary : 'transparent',
              borderWidth: cardStyle === 'glow' ? 2 : 0,
              shadowColor: cardStyle === 'glow' ? colors.primary : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: cardStyle === 'glow' ? 0.5 : 0,
              shadowRadius: 8,
            }]}>
              <Text style={[styles.avatarText, {
                color: themeKey === 'vintageLeague' ? '#FFFFFF' : colors.background
              }]}>
                MJ
              </Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={[styles.playerName, { color: colors.text }]}>
                Marcus Johnson
              </Text>
              <Text style={[styles.playerPosition, { color: colors.textSecondary }]}>
                Point Guard | 87 OVR
              </Text>
            </View>
            <View style={styles.playerStats}>
              <Text style={[styles.statValue, { color: colors.success }]}>28</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>PTS</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryButton, {
              backgroundColor: colors.primary,
              borderRadius: borderRadius,
              shadowColor: cardStyle === 'glow' ? colors.primary : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: cardStyle === 'glow' ? 0.4 : 0,
              shadowRadius: 12,
            }]}
          >
            <Text style={[styles.primaryButtonText, {
              color: themeKey === 'vintageLeague' ? '#FFFFFF' : colors.background
            }]}>
              Sim Match
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, {
              backgroundColor: 'transparent',
              borderColor: colors.primary,
              borderWidth: cardStyle === 'framed' ? 2 : 1,
              borderRadius: borderRadius,
            }]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              View Roster
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sport Indicators */}
        <View style={styles.sportRow}>
          <View style={[styles.sportBadge, { backgroundColor: colors.basketball + '20' }]}>
            <View style={[styles.sportDot, { backgroundColor: colors.basketball }]} />
            <Text style={[styles.sportText, { color: colors.basketball }]}>Basketball</Text>
          </View>
          <View style={[styles.sportBadge, { backgroundColor: colors.baseball + '20' }]}>
            <View style={[styles.sportDot, { backgroundColor: colors.baseball }]} />
            <Text style={[styles.sportText, { color: colors.baseball }]}>Baseball</Text>
          </View>
          <View style={[styles.sportBadge, { backgroundColor: colors.soccer + '20' }]}>
            <View style={[styles.sportDot, { backgroundColor: colors.soccer }]} />
            <Text style={[styles.sportText, { color: colors.soccer }]}>Soccer</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {theme.description}
      </Text>
    </View>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export function ThemePreviewScreen({ navigation }: { navigation?: any }) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('pressBox');

  return (
    <View style={styles.container}>
      {/* Theme Selector */}
      <View style={styles.selector}>
        {(Object.keys(themes) as ThemeKey[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.selectorButton,
              selectedTheme === key && styles.selectorButtonActive,
            ]}
            onPress={() => setSelectedTheme(key)}
          >
            <Text
              style={[
                styles.selectorText,
                selectedTheme === key && styles.selectorTextActive,
              ]}
            >
              {themes[key].name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Theme Preview */}
      <ScrollView
        style={styles.previewScroll}
        contentContainerStyle={styles.previewContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemePreview themeKey={selectedTheme} />
      </ScrollView>

      {/* Back Button */}
      {navigation && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  selector: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#16162a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a4a',
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#4a4a8a',
  },
  selectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8888aa',
    textAlign: 'center',
  },
  selectorTextActive: {
    color: '#ffffff',
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 16,
  },
  themeContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  themeHeader: {
    padding: 20,
    alignItems: 'center',
  },
  themeName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  themeSubtitle: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sampleSection: {
    padding: 16,
    margin: 12,
    borderRadius: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamName: {
    fontSize: 20,
    fontWeight: '700',
  },
  teamRecord: {
    fontSize: 13,
    marginTop: 2,
  },
  budgetBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  budgetText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  matchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchTeam: {
    alignItems: 'center',
    width: 70,
  },
  teamLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  matchTeamName: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  score: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreDivider: {
    fontSize: 24,
  },
  matchInfo: {
    fontSize: 12,
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  playerPosition: {
    fontSize: 12,
    marginTop: 2,
  },
  playerStats: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sportRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  sportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sportText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    lineHeight: 20,
  },
  backButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#4a4a8a',
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ThemePreviewScreen;
