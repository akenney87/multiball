/**
 * Title Screen
 *
 * Opening screen for Multiball with bold typographic branding
 * and Continue/New Game options.
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
import { useColors, spacing } from '../theme';

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

  // Animated values
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;
  const ballFloat1 = useRef(new Animated.Value(0)).current;
  const ballFloat2 = useRef(new Animated.Value(0)).current;
  const ballFloat3 = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Floating ball animations (continuous)
    const createFloatAnimation = (animValue: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createFloatAnimation(ballFloat1, 3000).start();
    createFloatAnimation(ballFloat2, 4000).start();
    createFloatAnimation(ballFloat3, 3500).start();

    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Loading bar animation - animate smoothly to external progress value
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: externalProgress,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [externalProgress, animatedProgress]);

  // Interpolate floating animations
  const ball1TranslateY = ballFloat1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });
  const ball2TranslateY = ballFloat2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const ball3TranslateY = ballFloat3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  // Loading bar width interpolation
  const loadingBarWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: '#0a0a0f' }]}>
      {/* Background gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Animated glow behind title */}
      <Animated.View
        style={[
          styles.titleGlow,
          {
            opacity: glowPulse,
            backgroundColor: colors.primary,
          },
        ]}
      />

      {/* Floating sport balls - decorative */}
      <Animated.View
        style={[
          styles.floatingBall,
          styles.ball1,
          { transform: [{ translateY: ball1TranslateY }] },
        ]}
      >
        <Text style={styles.ballEmoji}>🏀</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.floatingBall,
          styles.ball2,
          { transform: [{ translateY: ball2TranslateY }] },
        ]}
      >
        <Text style={styles.ballEmoji}>⚾</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.floatingBall,
          styles.ball3,
          { transform: [{ translateY: ball3TranslateY }] },
        ]}
      >
        <Text style={styles.ballEmoji}>⚽</Text>
      </Animated.View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Title section */}
        <View style={styles.titleSection}>
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            {/* Stacked letter treatment */}
            <View style={styles.titleStack}>
              <Text style={[styles.titleLetter, { color: colors.primary }]}>M</Text>
              <Text style={[styles.titleLetter, { color: '#ffffff' }]}>U</Text>
              <Text style={[styles.titleLetter, { color: colors.primary }]}>L</Text>
              <Text style={[styles.titleLetter, { color: '#ffffff' }]}>T</Text>
              <Text style={[styles.titleLetter, { color: colors.primary }]}>I</Text>
            </View>
            <View style={styles.titleStack}>
              <Text style={[styles.titleLetter, { color: '#ffffff' }]}>B</Text>
              <Text style={[styles.titleLetter, { color: colors.primary }]}>A</Text>
              <Text style={[styles.titleLetter, { color: '#ffffff' }]}>L</Text>
              <Text style={[styles.titleLetter, { color: colors.primary }]}>L</Text>
            </View>
          </Animated.View>

          <Animated.Text
            style={[
              styles.subtitle,
              { color: 'rgba(255,255,255,0.5)', opacity: subtitleOpacity },
            ]}
          >
            FRANCHISE MANAGEMENT
          </Animated.Text>
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
            // Loading bar
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>LOADING...</Text>
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
                  style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={onContinue}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>CONTINUE</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  hasSaveData ? styles.secondaryButton : styles.primaryButton,
                  hasSaveData
                    ? { borderColor: 'rgba(255,255,255,0.3)' }
                    : { backgroundColor: colors.primary },
                ]}
                onPress={onNewGame}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.buttonText,
                    hasSaveData ? styles.secondaryButtonText : styles.primaryButtonText,
                  ]}
                >
                  NEW GAME
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>

      {/* Bottom accent line */}
      <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

      {/* Version text */}
      <Text style={styles.versionText}>v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    // Simulated gradient with multiple overlays
    borderTopWidth: SCREEN_HEIGHT * 0.4,
    borderTopColor: 'rgba(20, 20, 35, 0.8)',
  },
  titleGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.15,
    left: SCREEN_WIDTH * 0.1,
    width: SCREEN_WIDTH * 0.8,
    height: 200,
    borderRadius: 100,
    transform: [{ scaleX: 1.5 }],
  },
  floatingBall: {
    position: 'absolute',
    opacity: 0.15,
  },
  ball1: {
    top: SCREEN_HEIGHT * 0.12,
    right: SCREEN_WIDTH * 0.1,
  },
  ball2: {
    top: SCREEN_HEIGHT * 0.35,
    left: SCREEN_WIDTH * 0.05,
  },
  ball3: {
    top: SCREEN_HEIGHT * 0.55,
    right: SCREEN_WIDTH * 0.15,
  },
  ballEmoji: {
    fontSize: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SCREEN_HEIGHT * 0.12,
    paddingBottom: SCREEN_HEIGHT * 0.08,
    paddingHorizontal: spacing.xl,
  },
  titleSection: {
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleStack: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  titleLetter: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 6,
    marginTop: spacing.lg,
  },
  buttonSection: {
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  primaryButtonText: {
    color: '#000000',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.8)',
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  versionText: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.6)',
  },
  loadingBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default TitleScreen;
