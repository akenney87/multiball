/**
 * Title Screen - Design #3
 *
 * "Trophy Room" - Luxury Editorial aesthetic.
 * High-fashion magazine meets elite sports heritage.
 * Near-monochrome with warm gold accent. Refined and prestigious.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { spacing } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Luxury color palette - warm monochrome with gold
const COLORS = {
  background: '#0C0B09', // Warm black
  surface: '#161513', // Slightly lighter warm black
  cream: '#F5F0E8', // Warm cream for text
  creamMuted: 'rgba(245, 240, 232, 0.5)',
  creamSubtle: 'rgba(245, 240, 232, 0.15)',
  gold: '#C9A962', // Refined gold accent
  goldMuted: 'rgba(201, 169, 98, 0.6)',
  goldSubtle: 'rgba(201, 169, 98, 0.2)',
};

interface TitleScreenProps {
  onContinue: () => void;
  onNewGame: () => void;
  hasSaveData: boolean;
  isLoading?: boolean;
  loadingProgress?: number;
}

export function TitleScreen({
  onContinue,
  onNewGame,
  hasSaveData,
  isLoading = false,
  loadingProgress: externalProgress = 0,
}: TitleScreenProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Refined, unhurried animations
  const mastHeadOpacity = useRef(new Animated.Value(0)).current;
  const mastHeadTranslateY = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.95)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const dividerDiamondOpacity = useRef(new Animated.Value(0)).current;
  const dividerDiamondScale = useRef(new Animated.Value(0.5)).current;
  const dividerLineWidth = useRef(new Animated.Value(0)).current;
  const iconsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Elegant staggered entrance - unhurried pacing
    const sequence = Animated.sequence([
      // Masthead fades in first
      Animated.parallel([
        Animated.timing(mastHeadOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(mastHeadTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Brief pause
      Animated.delay(200),
      // Title scales and fades in
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Diamond appears first (centered)
      Animated.parallel([
        Animated.timing(dividerDiamondOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dividerDiamondScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Lines extend from diamond
      Animated.timing(dividerLineWidth, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
      // Subtitle and icons
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(iconsOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Buttons rise up
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Footer last
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    sequence.start();
  }, []);

  // Loading bar animation
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: externalProgress,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [externalProgress, animatedProgress]);

  const loadingBarWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Lines grow from 0% to 100% of their container width
  const dividerLineAnimatedWidth = dividerLineWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Subtle texture overlay */}
      <View style={styles.textureOverlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top section - Masthead */}
        <Animated.View
          style={[
            styles.masthead,
            {
              opacity: mastHeadOpacity,
              transform: [{ translateY: mastHeadTranslateY }],
            },
          ]}
        >
          <View style={styles.mastheadLine} />
          <Text style={styles.mastheadText}>AK INNOVATIONS</Text>
          <View style={styles.mastheadLine} />
        </Animated.View>

        {/* Center section - Title treatment */}
        <View style={styles.centerSection}>
          {/* Main title - magazine masthead style */}
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: titleOpacity,
                transform: [{ scale: titleScale }],
              },
            ]}
          >
            <Text style={styles.titleMain}>MULTI</Text>
            <Text style={styles.titleAccent}>BALL</Text>
          </Animated.View>

          {/* Elegant divider - diamond absolutely centered on screen */}
          <View style={styles.divider}>
            {/* Left line grows from center outward */}
            <View style={styles.dividerLineWrapper}>
              <Animated.View
                style={[
                  styles.dividerLineLeft,
                  { width: dividerLineAnimatedWidth }
                ]}
              />
            </View>
            {/* Spacer for diamond */}
            <View style={styles.dividerDiamondSpacer} />
            {/* Right line grows from center outward */}
            <View style={styles.dividerLineWrapper}>
              <Animated.View
                style={[
                  styles.dividerLineRight,
                  { width: dividerLineAnimatedWidth }
                ]}
              />
            </View>
            {/* Diamond absolutely positioned at exact screen center */}
            <Animated.View
              style={[
                styles.dividerDiamond,
                {
                  opacity: dividerDiamondOpacity,
                  transform: [{ rotate: '45deg' }, { scale: dividerDiamondScale }],
                }
              ]}
            />
          </View>

          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
            FRANCHISE MANAGEMENT
          </Animated.Text>

          {/* Minimal sport icons - architectural line drawings */}
          <Animated.View style={[styles.iconRow, { opacity: iconsOpacity }]}>
            {/* Basketball - simple arc and lines */}
            <View style={styles.iconContainer}>
              <View style={styles.iconWrapper}>
                <View style={styles.iconCircle}>
                  <View style={styles.basketballLineH} />
                  <View style={styles.basketballLineV} />
                  <View style={styles.basketballArc} />
                </View>
              </View>
              <Text style={styles.iconLabel}>BASKETBALL</Text>
            </View>

            <View style={styles.iconDivider} />

            {/* Baseball spacer - maintains flex layout */}
            <View style={styles.iconContainer}>
              <View style={styles.iconWrapper} />
              <Text style={styles.iconLabelInvisible}>BASEBALL</Text>
            </View>

            <View style={styles.iconDivider} />

            {/* Soccer - hexagon pattern hint */}
            <View style={styles.iconContainer}>
              <View style={styles.iconWrapper}>
                <View style={styles.soccerCircle}>
                  <View style={styles.soccerPentagon} />
                </View>
              </View>
              <Text style={styles.iconLabel}>SOCCER</Text>
            </View>

            {/* Baseball - absolutely centered on screen */}
            <View style={styles.baseballAbsolute}>
              <View style={styles.iconWrapper}>
                <View style={styles.baseballDiamond}>
                  <View style={styles.baseballInner} />
                </View>
              </View>
              <Text style={styles.iconLabel}>BASEBALL</Text>
            </View>
          </Animated.View>
        </View>

        {/* Bottom section - Buttons */}
        <Animated.View
          style={[
            styles.buttonSection,
            {
              opacity: buttonsOpacity,
              transform: [{ translateY: buttonsTranslateY }],
            },
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>LOADING</Text>
              <View style={styles.loadingBarBackground}>
                <Animated.View
                  style={[styles.loadingBarFill, { width: loadingBarWidth }]}
                />
              </View>
            </View>
          ) : (
            <>
              {hasSaveData && (
                <TouchableOpacity
                  style={styles.buttonPrimary}
                  onPress={onContinue}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonPrimaryText}>CONTINUE</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  hasSaveData ? styles.buttonSecondary : styles.buttonPrimary,
                ]}
                onPress={onNewGame}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    hasSaveData
                      ? styles.buttonSecondaryText
                      : styles.buttonPrimaryText,
                  ]}
                >
                  NEW GAME
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <View style={styles.footerLine} />
        <Text style={styles.versionText}>VERSION 1.0</Text>
        <View style={styles.footerLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Subtle noise texture effect via very faint pattern
    backgroundColor: 'transparent',
    opacity: 0.03,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl * 1.5,
    paddingTop: SCREEN_HEIGHT * 0.08,
    paddingBottom: SCREEN_HEIGHT * 0.05,
    justifyContent: 'space-between',
  },

  // Masthead
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  mastheadLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.creamSubtle,
  },
  mastheadText: {
    color: COLORS.creamMuted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 4,
    paddingLeft: 2, // Compensate for trailing letter-spacing
  },

  // Center section
  centerSection: {
    alignSelf: 'stretch', // Explicit: take full content width
    alignItems: 'center',
    gap: spacing.lg,
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleMain: {
    color: COLORS.cream,
    fontSize: 72,
    fontWeight: '200', // Ultra light for elegance
    letterSpacing: 20,
    lineHeight: 80,
    textAlign: 'center',
    paddingLeft: 10, // Compensate for trailing letter-spacing
  },
  titleAccent: {
    color: COLORS.gold,
    fontSize: 72,
    fontWeight: '600', // Bold contrast
    letterSpacing: 20,
    lineHeight: 80,
    marginTop: -12,
    textAlign: 'center',
    paddingLeft: 10, // Compensate for trailing letter-spacing
  },

  // Divider - diamond absolutely centered on screen
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.md,
    position: 'relative', // For absolute diamond positioning
  },
  dividerLineWrapper: {
    flex: 1,
    height: 1,
    justifyContent: 'center',
  },
  dividerLineLeft: {
    height: 1,
    backgroundColor: COLORS.goldSubtle,
    alignSelf: 'flex-end', // Grow from right edge outward
    marginRight: spacing.sm,
  },
  dividerLineRight: {
    height: 1,
    backgroundColor: COLORS.goldSubtle,
    alignSelf: 'flex-start', // Grow from left edge outward
    marginLeft: spacing.sm,
  },
  dividerDiamondSpacer: {
    width: 8 + spacing.sm * 2, // Diamond size + margins
    height: 1,
  },
  dividerDiamond: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: COLORS.gold,
    // Absolute center on screen: (screenWidth/2) - contentPadding - halfDiamondSize
    left: SCREEN_WIDTH / 2 - spacing.xl * 1.5 - 4,
    top: -4, // Vertically center: (1px line - 8px diamond) / 2 = -3.5, rounded
  },

  // Subtitle
  subtitle: {
    color: COLORS.creamMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 6,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingLeft: 3, // Compensate for trailing letter-spacing
  },

  // Sport icons
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.xl * 1.5,
    position: 'relative', // For absolute baseball positioning
  },
  iconContainer: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.creamSubtle,
  },
  // Fixed height container to normalize icon heights (rotated diamond is taller)
  iconWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLabel: {
    color: COLORS.creamMuted,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    paddingLeft: 1, // Compensate for trailing letter-spacing
  },
  iconLabelInvisible: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 2,
    color: 'transparent', // Invisible but maintains spacing
  },
  // Baseball absolutely positioned at exact screen center
  baseballAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0, // Stretch to full width of iconRow
    alignItems: 'center', // Center the content horizontally
    gap: spacing.sm,
  },

  // Basketball icon
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  basketballLineH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: COLORS.goldMuted,
  },
  basketballLineV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: COLORS.goldMuted,
  },
  basketballArc: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
    left: -5,
  },

  // Baseball icon
  baseballDiamond: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseballInner: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
  },

  // Soccer icon
  soccerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soccerPentagon: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.goldSubtle,
    transform: [{ rotate: '45deg' }],
  },

  // Buttons
  buttonSection: {
    gap: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: COLORS.gold,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: 0, // Sharp edges for editorial feel
  },
  buttonPrimaryText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    paddingLeft: 2, // Compensate for trailing letter-spacing
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.creamSubtle,
  },
  buttonSecondaryText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 4,
    textAlign: 'center',
    paddingLeft: 2, // Compensate for trailing letter-spacing
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: COLORS.creamMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 6,
    textAlign: 'center',
    paddingLeft: 3, // Compensate for trailing letter-spacing
  },
  loadingBarBackground: {
    width: '100%',
    height: 2,
    backgroundColor: COLORS.creamSubtle,
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl * 1.5,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.creamSubtle,
  },
  versionText: {
    color: COLORS.creamMuted,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 3,
    textAlign: 'center',
    paddingLeft: 1.5, // Compensate for trailing letter-spacing
  },
});

export default TitleScreen;
