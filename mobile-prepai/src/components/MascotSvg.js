import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, {
  Path,
  Rect,
} from 'react-native-svg';
import { useTheme } from '../theme';

export default function MascotSvg({ size = 124 }) {
  const { colors } = useTheme();

  // Floating & rotation animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  // Eye blink animation
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isCancelled = false;

    const startAnimations = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      // 1. Float & gentle sway loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();

      // 2. Eye blink loop every ~4s
      const blinkCycle = () => {
        if (isCancelled) return;
        Animated.sequence([
          Animated.delay(3600),
          Animated.timing(blinkAnim, {
            toValue: 0.1,
            duration: 110,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 110,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start(() => {
          if (!isCancelled) blinkCycle();
        });
      };

      blinkCycle();
    };

    startAnimations();

    return () => {
      isCancelled = true;
    };
  }, [floatAnim, blinkAnim]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 6],
  });

  const rotate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg'],
  });

  const eyeSize = Math.round(size * 0.095);
  const eyeRadius = Math.round(eyeSize / 2);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ translateY }, { rotate }],
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="PrepAI Mascot"
    >
      <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Solid Orange Speech Bubble Body with sharp down-left tail */}
          <Path
            d="M 22 24
               C 22 14, 28 8, 40 8
               L 72 8
               C 84 8, 90 14, 90 24
               L 90 54
               C 90 64, 84 70, 72 70
               L 42 70
               L 36 86
               L 36 70
               L 40 70
               L 26 70
               C 22 70, 22 64, 22 54
               Z"
            fill={colors.orange}
          />

          {/* Cream Headphone Band (Arch over top) */}
          <Path
            d="M 17 48 C 17 12, 83 12, 83 48"
            fill="none"
            stroke="#FBF3E4"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Mascot Face: Cheerful Dark Teal Smile */}
          <Path
            d="M 45 46 Q 56 56 67 46"
            fill="none"
            stroke="#0B3B4A"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Headphone Ear Cups (Cream rounded pills on sides) */}
          <Rect
            x="11"
            y="38"
            width="12"
            height="24"
            rx="6"
            fill="#FBF3E4"
          />
          <Rect
            x="77"
            y="38"
            width="12"
            height="24"
            rx="6"
            fill="#FBF3E4"
          />
        </Svg>

        {/* Mascot Eyes Overlay (Blinking animated view positioned on face) */}
        <Animated.View
          style={[
            styles.eyesRow,
            {
              top: size * 0.33,
              left: size * 0.44,
              width: size * 0.24,
              transform: [{ scaleY: blinkAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.eyeDot,
              {
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeRadius,
                backgroundColor: '#0B3B4A',
              },
            ]}
          />
          <View
            style={[
              styles.eyeDot,
              {
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeRadius,
                backgroundColor: '#0B3B4A',
              },
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyesRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyeDot: {
    backgroundColor: '#0B3B4A',
  },
});
