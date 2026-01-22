/**
 * Title Screen
 *
 * "Stadium Broadcast" aesthetic - premium sports broadcast graphics feel.
 * Asymmetric composition with geometric sport symbols and diagonal energy.
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
import { useColors, spacing, hexToRgba } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const colors = useColors();
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Animated values for staggered letter reveals
  const letterAnims = useRef(
    'MULTIBALL'.split('').map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(-60),
      skewY: new Animated.Value(-15),
    }))
  ).current;

  // Other animations
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateX = useRef(new Animated.Value(40)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;
  const diagonalSlice = useRef(new Animated.Value(0)).current;
  const scanLineOffset = useRef(new Animated.Value(0)).current;

  // Sport symbol animations
  const symbol1Opacity = useRef(new Animated.Value(0)).current;
  const symbol1Scale = useRef(new Animated.Value(0.5)).current;
  const symbol2Opacity = useRef(new Animated.Value(0)).current;
  const symbol2Scale = useRef(new Animated.Value(0.5)).current;
  const symbol3Opacity = useRef(new Animated.Value(0)).current;
  const symbol3Scale = useRef(new Animated.Value(0.5)).current;

  // Ambient pulse for symbols
  const ambientPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Diagonal slice reveals first
    Animated.timing(diagonalSlice, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Staggered letter entrance - each letter slices in
    const letterAnimations = letterAnims.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 300,
          delay: 200 + index * 60,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateX, {
          toValue: 0,
          duration: 400,
          delay: 200 + index * 60,
          useNativeDriver: true,
        }),
        Animated.timing(anim.skewY, {
          toValue: 0,
          duration: 400,
          delay: 200 + index * 60,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.stagger(60, letterAnimations).start();

    // Sport symbols pop in after letters
    setTimeout(() => {
      Animated.stagger(150, [
        Animated.parallel([
          Animated.spring(symbol1Scale, { toValue: 1, friction: 8, useNativeDriver: true }),
          Animated.timing(symbol1Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(symbol2Scale, { toValue: 1, friction: 8, useNativeDriver: true }),
          Animated.timing(symbol2Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(symbol3Scale, { toValue: 1, friction: 8, useNativeDriver: true }),
          Animated.timing(symbol3Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }, 600);

    // Subtitle slides in from right
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(subtitleTranslateX, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 900);

    // Buttons fade up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1100);

    // Continuous scan line animation
    Animated.loop(
      Animated.timing(scanLineOffset, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Ambient pulse for symbols
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(ambientPulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
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

  const scanLineTranslate = scanLineOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT, SCREEN_HEIGHT * 2],
  });

  const symbolPulseOpacity = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // Letter colors - alternating pattern with accent on key letters
  const getLetterColor = (index: number) => {
    // M-U-L-T-I-B-A-L-L
    // Accent the M, T, B, L (last)
    if (index === 0 || index === 3 || index === 5 || index === 8) {
      return colors.primary;
    }
    return '#FFFFFF';
  };

  return (
    <View style={styles.container}>
      {/* Deep background with subtle gradient feel */}
      <View style={styles.backgroundBase} />

      {/* Diagonal accent stripe - top right */}
      <Animated.View
        style={[
          styles.diagonalStripe,
          {
            backgroundColor: hexToRgba(colors.primary, 0.08),
            opacity: diagonalSlice,
          },
        ]}
      />

      {/* Secondary diagonal - bottom left */}
      <Animated.View
        style={[
          styles.diagonalStripeSecondary,
          {
            backgroundColor: hexToRgba(colors.secondary, 0.05),
            opacity: diagonalSlice,
          },
        ]}
      />

      {/* Scan line effect */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            transform: [{ translateY: scanLineTranslate }],
          },
        ]}
      />

      {/* Geometric sport symbols - positioned asymmetrically */}
      {/* Basketball - hexagon with lines */}
      <Animated.View
        style={[
          styles.sportSymbol,
          styles.symbolBasketball,
          {
            opacity: Animated.multiply(symbol1Opacity, symbolPulseOpacity),
            transform: [{ scale: symbol1Scale }],
          },
        ]}
      >
        <View style={[styles.hexagon, { borderColor: colors.basketball }]}>
          <View style={[styles.hexLine, styles.hexLineH, { backgroundColor: hexToRgba(colors.basketball, 0.6) }]} />
          <View style={[styles.hexLine, styles.hexLineV, { backgroundColor: hexToRgba(colors.basketball, 0.6) }]} />
        </View>
      </Animated.View>

      {/* Baseball - diamond shape */}
      <Animated.View
        style={[
          styles.sportSymbol,
          styles.symbolBaseball,
          {
            opacity: Animated.multiply(symbol2Opacity, symbolPulseOpacity),
            transform: [{ scale: symbol2Scale }, { rotate: '45deg' }],
          },
        ]}
      >
        <View style={[styles.diamond, { borderColor: colors.baseball }]}>
          <View style={[styles.diamondInner, { borderColor: hexToRgba(colors.baseball, 0.5) }]} />
        </View>
      </Animated.View>

      {/* Soccer - pentagon/hexagon pattern */}
      <Animated.View
        style={[
          styles.sportSymbol,
          styles.symbolSoccer,
          {
            opacity: Animated.multiply(symbol3Opacity, symbolPulseOpacity),
            transform: [{ scale: symbol3Scale }],
          },
        ]}
      >
        <View style={[styles.soccerBall, { borderColor: colors.soccer }]}>
          <View style={[styles.soccerInner, { backgroundColor: hexToRgba(colors.soccer, 0.3) }]} />
        </View>
      </Animated.View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Title section - left aligned for asymmetry */}
        <View style={styles.titleSection}>
          <View style={styles.titleContainer}>
            {/* MULTI on first line */}
            <View style={styles.titleRow}>
              {'MULTI'.split('').map((letter, index) => {
                const anim = letterAnims[index];
                if (!anim) return null;
                return (
                  <Animated.Text
                    key={`multi-${index}`}
                    style={[
                      styles.titleLetter,
                      {
                        color: getLetterColor(index),
                        opacity: anim.opacity,
                        transform: [{ translateX: anim.translateX }],
                        textShadowColor: getLetterColor(index) === colors.primary
                          ? hexToRgba(colors.primary, 0.8)
                          : 'transparent',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: getLetterColor(index) === colors.primary ? 20 : 0,
                      },
                    ]}
                  >
                    {letter}
                  </Animated.Text>
                );
              })}
            </View>
            {/* BALL on second line - slightly offset */}
            <View style={[styles.titleRow, styles.titleRowOffset]}>
              {'BALL'.split('').map((letter, index) => {
                const globalIndex = index + 5;
                const anim = letterAnims[globalIndex];
                if (!anim) return null;
                return (
                  <Animated.Text
                    key={`ball-${index}`}
                    style={[
                      styles.titleLetter,
                      {
                        color: getLetterColor(globalIndex),
                        opacity: anim.opacity,
                        transform: [{ translateX: anim.translateX }],
                        textShadowColor: getLetterColor(globalIndex) === colors.primary
                          ? hexToRgba(colors.primary, 0.8)
                          : 'transparent',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: getLetterColor(globalIndex) === colors.primary ? 20 : 0,
                      },
                    ]}
                  >
                    {letter}
                  </Animated.Text>
                );
              })}
            </View>
          </View>

          {/* Subtitle with horizontal line */}
          <Animated.View
            style={[
              styles.subtitleContainer,
              {
                opacity: subtitleOpacity,
                transform: [{ translateX: subtitleTranslateX }],
              },
            ]}
          >
            <View style={[styles.subtitleLine, { backgroundColor: hexToRgba(colors.primary, 0.4) }]} />
            <Text style={[styles.subtitle, { color: hexToRgba('#FFFFFF', 0.6) }]}>
              FRANCHISE MANAGEMENT
            </Text>
          </Animated.View>
        </View>

        {/* Buttons section */}
        <Animated.View
          style={[
            styles.buttonSection,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: hexToRgba('#FFFFFF', 0.6) }]}>
                LOADING
              </Text>
              <View style={styles.loadingBarBackground}>
                <Animated.View
                  style={[
                    styles.loadingBarFill,
                    { width: loadingBarWidth, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            </View>
          ) : (
            <>
              {hasSaveData && (
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={onContinue}
                  activeOpacity={0.8}
                >
                  <View style={[styles.buttonGlow, { backgroundColor: colors.primary }]} />
                  <View style={[styles.buttonInner, { backgroundColor: colors.primary }]}>
                    <Text style={styles.primaryButtonText}>CONTINUE</Text>
                  </View>
                  <View style={[styles.buttonAccent, { backgroundColor: hexToRgba(colors.primary, 0.3) }]} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  hasSaveData ? styles.secondaryButton : styles.primaryButton,
                ]}
                onPress={onNewGame}
                activeOpacity={0.8}
              >
                {!hasSaveData && (
                  <View style={[styles.buttonGlow, { backgroundColor: colors.primary }]} />
                )}
                <View
                  style={[
                    styles.buttonInner,
                    hasSaveData
                      ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: hexToRgba('#FFFFFF', 0.3) }
                      : { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={hasSaveData ? styles.secondaryButtonText : styles.primaryButtonText}
                  >
                    NEW GAME
                  </Text>
                </View>
                {!hasSaveData && (
                  <View style={[styles.buttonAccent, { backgroundColor: hexToRgba(colors.primary, 0.3) }]} />
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>

      {/* Bottom accent bar with gradient feel */}
      <View style={styles.bottomAccent}>
        <View style={[styles.accentSegment, { backgroundColor: colors.basketball, flex: 1 }]} />
        <View style={[styles.accentSegment, { backgroundColor: colors.primary, flex: 2 }]} />
        <View style={[styles.accentSegment, { backgroundColor: colors.soccer, flex: 1 }]} />
      </View>

      {/* Version - tucked into corner */}
      <Text style={styles.versionText}>v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#030306',
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030306',
  },
  diagonalStripe: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.3,
    right: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.8,
    transform: [{ rotate: '-20deg' }],
  },
  diagonalStripeSecondary: {
    position: 'absolute',
    bottom: -SCREEN_HEIGHT * 0.2,
    left: -SCREEN_WIDTH * 0.4,
    width: SCREEN_WIDTH * 1.0,
    height: SCREEN_HEIGHT * 0.5,
    transform: [{ rotate: '-20deg' }],
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  sportSymbol: {
    position: 'absolute',
  },
  symbolBasketball: {
    top: SCREEN_HEIGHT * 0.08,
    right: SCREEN_WIDTH * 0.08,
  },
  symbolBaseball: {
    top: SCREEN_HEIGHT * 0.38,
    right: SCREEN_WIDTH * 0.05,
  },
  symbolSoccer: {
    top: SCREEN_HEIGHT * 0.22,
    left: SCREEN_WIDTH * 0.06,
  },
  hexagon: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    transform: [{ rotate: '30deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  hexLine: {
    position: 'absolute',
  },
  hexLineH: {
    width: '70%',
    height: 2,
  },
  hexLineV: {
    width: 2,
    height: '70%',
  },
  diamond: {
    width: 40,
    height: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondInner: {
    width: 20,
    height: 20,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  soccerBall: {
    width: 45,
    height: 45,
    borderWidth: 2,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soccerInner: {
    width: 18,
    height: 18,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SCREEN_HEIGHT * 0.15,
    paddingBottom: SCREEN_HEIGHT * 0.1,
    paddingHorizontal: spacing.xl,
  },
  titleSection: {
    alignItems: 'flex-start', // Left aligned for asymmetry
  },
  titleContainer: {
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
  },
  titleRowOffset: {
    marginLeft: spacing.lg, // Offset BALL slightly right
    marginTop: -8, // Tighter line height
  },
  titleLetter: {
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginLeft: spacing.sm,
  },
  subtitleLine: {
    width: 24,
    height: 2,
    marginRight: spacing.sm,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 4,
  },
  buttonSection: {
    gap: spacing.md,
  },
  button: {
    position: 'relative',
    height: 56,
  },
  primaryButton: {},
  secondaryButton: {},
  buttonGlow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 10,
    opacity: 0.3,
  },
  buttonInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    flexDirection: 'row',
  },
  accentSegment: {
    height: '100%',
  },
  versionText: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.15)',
    fontWeight: '500',
    letterSpacing: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 6,
  },
  loadingBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default TitleScreen;
