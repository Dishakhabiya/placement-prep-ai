import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import Svg, { Rect, Ellipse, Circle, Path, G } from 'react-native-svg';
import { COLORS } from '../../theme/prepPink';

export default function Mascot({ size = 96, animated = false }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const eyeRy = useRef(new Animated.Value(9)).current;
  const [currentRy, setCurrentRy] = useState(9);

  useEffect(() => {
    if (!animated) return;

    const listenerId = eyeRy.addListener(({ value }) => {
      setCurrentRy(value);
    });

    return () => {
      eyeRy.removeListener(listenerId);
    };
  }, [animated, eyeRy]);

  useEffect(() => {
    if (!animated) return;

    let isCancelled = false;
    let floatAnim = null;
    let blinkAnim = null;

    const startAnimations = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';

      // Float: translateY 0 -> -8 -> 0, 3s loop
      floatAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -8,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
        ])
      );

      // Blinking: ry 9 -> 1 -> 9 over 160ms around 90-98% mark (3600ms delay, 160ms blink, 240ms rest)
      blinkAnim = Animated.loop(
        Animated.sequence([
          Animated.delay(3600),
          Animated.timing(eyeRy, {
            toValue: 1,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(eyeRy, {
            toValue: 9,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay(200),
        ])
      );

      floatAnim.start();
      blinkAnim.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startAnimations(enabled);
        })
        .catch(() => {
          if (!isCancelled) startAnimations(false);
        });
    } else {
      startAnimations(false);
    }

    return () => {
      isCancelled = true;
      if (floatAnim) floatAnim.stop();
      if (blinkAnim) blinkAnim.stop();
    };
  }, [animated, translateY, eyeRy]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ translateY: animated ? translateY : 0 }],
        }}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 112 112"
          role="img"
          aria-label="PrepAI character"
        >
          <G>
            {/* Violet rounded square head */}
            <Rect
              x="14"
              y="10"
              width="84"
              height="84"
              rx="34"
              fill={COLORS.violet}
              stroke={COLORS.ink}
              strokeWidth="3"
            />

            {/* Left Eye */}
            <Ellipse
              cx="40"
              cy="48"
              rx="7"
              ry={animated ? currentRy : 9}
              fill={COLORS.ink}
            />

            {/* Right Eye */}
            <Ellipse
              cx="72"
              cy="48"
              rx="7"
              ry={animated ? currentRy : 9}
              fill={COLORS.ink}
            />

            {/* Eye glints */}
            <Circle cx="42" cy="45" r="2.5" fill="#FFFFFF" />
            <Circle cx="74" cy="45" r="2.5" fill="#FFFFFF" />

            {/* Smile */}
            <Path
              d="M42 66q14 14 28 0"
              fill="none"
              stroke={COLORS.ink}
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Cheeks */}
            <Circle cx="27" cy="62" r="5" fill={COLORS.cheek} />
            <Circle cx="85" cy="62" r="5" fill={COLORS.cheek} />

            {/* Red Tie */}
            <Path
              d="M50 94h12l4 10H46z"
              fill={COLORS.rose}
              stroke={COLORS.ink}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
