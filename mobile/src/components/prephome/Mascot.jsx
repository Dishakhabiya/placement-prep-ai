import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import Svg, { Path, Rect, Ellipse, Circle, G } from 'react-native-svg';

export default function Mascot({ size = 96 }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const eyeRy = useRef(new Animated.Value(7)).current;
  const [currentRy, setCurrentRy] = useState(7);

  useEffect(() => {
    const listenerId = eyeRy.addListener(({ value }) => {
      setCurrentRy(value);
    });
    return () => {
      eyeRy.removeListener(listenerId);
    };
  }, [eyeRy]);

  useEffect(() => {
    let isCancelled = false;
    let floatAnim = null;
    let blinkAnim = null;

    const startAnimations = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';

      // Float animation: translateY 0 -> -6 -> 0 over 3s loop
      floatAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -6,
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

      // Eye blink animation: ry 7 -> 1 -> 7 every 4s
      blinkAnim = Animated.loop(
        Animated.sequence([
          Animated.delay(3600),
          Animated.timing(eyeRy, {
            toValue: 1,
            duration: 120,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(eyeRy, {
            toValue: 7,
            duration: 120,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay(160),
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
  }, [translateY, eyeRy]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ translateY }],
        }}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          role="img"
          aria-label="PrepAI assistant wearing a headset"
        >
          <G>
            {/* Speech bubble tail */}
            <Path d="M30 68L24 92 52 70z" fill="#FF7A3D" />

            {/* Main bubble head */}
            <Rect x="12" y="12" width="76" height="62" rx="26" fill="#FF7A3D" />

            {/* Left Eye */}
            <Ellipse
              cx="38"
              cy="42"
              rx="5"
              ry={currentRy}
              fill="#0B2F3A"
            />

            {/* Right Eye */}
            <Ellipse
              cx="62"
              cy="42"
              rx="5"
              ry={currentRy}
              fill="#0B2F3A"
            />

            {/* Eye glints */}
            <Circle cx="40" cy="39" r="2" fill="#FFFFFF" />
            <Circle cx="64" cy="39" r="2" fill="#FFFFFF" />

            {/* Smile */}
            <Path
              d="M40 56q10 9 20 0"
              fill="none"
              stroke="#0B2F3A"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Headset band */}
            <Path
              d="M16 44a34 32 0 0168 0"
              fill="none"
              stroke="#F6E7C8"
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Left earpiece */}
            <Rect x="7" y="40" width="10" height="20" rx="5" fill="#F6E7C8" />

            {/* Right earpiece */}
            <Rect x="83" y="40" width="10" height="20" rx="5" fill="#F6E7C8" />

            {/* Mic arm */}
            <Path
              d="M88 58q0 16-24 16"
              fill="none"
              stroke="#F6E7C8"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Mic tip */}
            <Circle cx="62" cy="74" r="4.5" fill="#F6E7C8" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
