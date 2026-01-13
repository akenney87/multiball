/**
 * Swipeable Player Detail
 *
 * Enables swipe left/right navigation between players using
 * react-native-gesture-handler for native-level gesture handling.
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, Dimensions, Animated } from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';

// =============================================================================
// CONSTANTS
// =============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;
const EDGE_RESISTANCE = 0.3;

// =============================================================================
// TYPES
// =============================================================================

interface SwipeablePlayerDetailProps {
  playerId: string;
  playerList: string[];
  currentIndex: number;
  onNavigate: (playerId: string, newIndex: number) => void;
  children: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SwipeablePlayerDetail({
  playerList,
  currentIndex,
  onNavigate,
  children,
}: SwipeablePlayerDetailProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  // Refs for current values
  const currentIndexRef = useRef(currentIndex);
  const playerListRef = useRef(playerList);

  // Update refs
  currentIndexRef.current = currentIndex;
  playerListRef.current = playerList;

  const canSwipe = playerList.length > 1;

  // Animate out and navigate
  const animateAndNavigate = useCallback(
    (direction: 'left' | 'right') => {
      const toValue = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;

      Animated.timing(translateX, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        const newIndex = direction === 'left'
          ? currentIndexRef.current + 1
          : currentIndexRef.current - 1;

        if (newIndex >= 0 && newIndex < playerListRef.current.length) {
          onNavigate(playerListRef.current[newIndex], newIndex);
        }
        translateX.setValue(0);
      });
    },
    [translateX, onNavigate]
  );

  // Snap back
  const snapBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [translateX]);

  // Handle gesture events
  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationX } = event.nativeEvent;
      const idx = currentIndexRef.current;
      const len = playerListRef.current.length;

      let dx = translationX;

      // Apply edge resistance at boundaries
      if ((idx === 0 && dx > 0) || (idx === len - 1 && dx < 0)) {
        dx = dx * EDGE_RESISTANCE;
      }

      translateX.setValue(dx);
    },
    [translateX]
  );

  // Handle gesture end
  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX, velocityX } = event.nativeEvent;
        const idx = currentIndexRef.current;
        const len = playerListRef.current.length;

        // Swipe left → next player
        if (
          (translationX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) &&
          idx < len - 1
        ) {
          animateAndNavigate('left');
          return;
        }

        // Swipe right → previous player
        if (
          (translationX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) &&
          idx > 0
        ) {
          animateAndNavigate('right');
          return;
        }

        snapBack();
      }
    },
    [animateAndNavigate, snapBack]
  );

  if (!canSwipe) {
    return <>{children}</>;
  }

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-10, 10]}
      failOffsetY={[-20, 20]}
    >
      <Animated.View style={[styles.container, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SwipeablePlayerDetail;
