import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Path, Line } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';

export default function MicButton() {
  const { colors, fonts } = useTheme();
  const isListening = useUiStore((s) => s.isListening);
  const toggleListening = useUiStore((s) => s.toggleListening);

  const breathAnim = useRef(new Animated.Value(1)).current;
  const ripple1Anim = useRef(new Animated.Value(0)).current;
  const ripple2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;
    let anims = [];

    const startAnimations = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      const breathDuration = isListening ? 900 : 1800;
      const breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.05,
            duration: breathDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: breathDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      anims.push(breathLoop);
      breathLoop.start();

      const ripplePeriod = isListening ? 1200 : 2800;

      const ripple1Loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ripple1Anim, {
            toValue: 1,
            duration: ripplePeriod,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(ripple1Anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

      const ripple2Loop = Animated.loop(
        Animated.sequence([
          Animated.delay(ripplePeriod / 2),
          Animated.timing(ripple2Anim, {
            toValue: 1,
            duration: ripplePeriod,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(ripple2Anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

      anims.push(ripple1Loop);
      anims.push(ripple2Loop);

      ripple1Loop.start();
      ripple2Loop.start();
    };

    startAnimations();

    return () => {
      isCancelled = true;
      anims.forEach((a) => a.stop());
    };
  }, [isListening, breathAnim, ripple1Anim, ripple2Anim]);

  const r1Scale = ripple1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.45],
  });
  const r1Opacity = ripple1Anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.4, 0.25, 0],
  });

  const r2Scale = ripple2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.45],
  });
  const r2Opacity = ripple2Anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.4, 0.25, 0],
  });

  const buttonBg = isListening ? colors.bg : colors.orange;
  const iconColor = colors.ink; // Always dark teal matching Screenshot 1
  const labelText = isListening ? 'Listening… tap to stop' : 'Tap and ask out loud';

  return (
    <View style={styles.wrapper}>
      {/* 104px wrapper containing ripple rings and 88px button */}
      <View style={styles.buttonWrapper}>
        {/* Ripple Ring 1 */}
        <Animated.View
          style={[
            styles.rippleRing,
            {
              borderColor: colors.orange,
              transform: [{ scale: r1Scale }],
              opacity: r1Opacity,
            },
          ]}
          pointerEvents="none"
        />

        {/* Ripple Ring 2 */}
        <Animated.View
          style={[
            styles.rippleRing,
            {
              borderColor: colors.orange,
              transform: [{ scale: r2Scale }],
              opacity: r2Opacity,
            },
          ]}
          pointerEvents="none"
        />

        {/* Permanent subtle ambient ring matching Screenshot 1 */}
        <View
          style={[
            styles.ambientRing,
            { borderColor: 'rgba(255, 111, 44, 0.35)' },
          ]}
          pointerEvents="none"
        />

        {/* Main 88px Breathing Button */}
        <Animated.View style={{ transform: [{ scale: breathAnim }] }}>
          <TouchableOpacity
            onPress={toggleListening}
            accessibilityRole="button"
            accessibilityLabel={labelText}
            style={[styles.mainButton, { backgroundColor: buttonBg }]}
            activeOpacity={0.85}
          >
            {/* SVG Dark Teal Microphone Icon */}
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Rect
                x="8.5"
                y="3"
                width="7"
                height="11"
                rx="3.5"
                stroke={iconColor}
                strokeWidth="2.4"
                fill="none"
              />
              <Path
                d="M5 10.5c0 3.86 3.14 7 7 7s7-3.14 7-7"
                stroke={iconColor}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <Line
                x1="12"
                y1="17.5"
                x2="12"
                y2="21"
                stroke={iconColor}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <Line
                x1="8.5"
                y1="21"
                x2="15.5"
                y2="21"
                stroke={iconColor}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Caption Text */}
      <Text
        style={[
          styles.caption,
          {
            color: colors.bg,
            fontFamily: fonts.bodyBold,
          },
        ]}
      >
        {labelText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buttonWrapper: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ambientRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  rippleRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  mainButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
      },
      default: {
        elevation: 6,
      },
    }),
  },
  caption: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
