import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';

const NUM_BARS = 11;
// Wave contour matching Screenshot 1
const BASE_HEIGHTS = [14, 20, 26, 32, 38, 42, 38, 32, 26, 20, 14];

export default function Waveform({ isListening = false }) {
  const { colors } = useTheme();

  const barAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    let isCancelled = false;
    let animRefs = [];

    const startWaveAnimations = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      barAnims.forEach((anim, i) => {
        const duration = isListening ? 200 + (i % 4) * 45 : 850 + (i % 5) * 110;
        const delay = isListening ? (i * 40) % 160 : (i * 110) % 800;

        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ])
        );

        animRefs.push(loop);
        loop.start();
      });
    };

    startWaveAnimations();

    return () => {
      isCancelled = true;
      animRefs.forEach((a) => a.stop());
    };
  }, [isListening, barAnims]);

  return (
    <View style={styles.container} pointerEvents="none" aria-hidden={true}>
      {barAnims.map((anim, index) => {
        const baseH = BASE_HEIGHTS[index];
        const minH = isListening ? 10 : 8;
        const maxH = isListening ? Math.min(48, baseH * 1.3) : baseH;

        const heightInterpolate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [minH, maxH],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: colors.orange,
                height: heightInterpolate,
                opacity: isListening ? 1 : 0.9,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 7,
    marginBottom: 10,
  },
  bar: {
    width: 6,
    borderRadius: 999,
  },
});
