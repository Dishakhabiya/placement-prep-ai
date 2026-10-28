import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../theme';

export default function BackgroundBlobs() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  const animBlob1 = useRef(new Animated.Value(0)).current;
  const animBlob2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;

    const checkMotionAndAnimate = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      const loop1 = Animated.loop(
        Animated.sequence([
          Animated.timing(animBlob1, {
            toValue: 1,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(animBlob1, {
            toValue: 0,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

      const loop2 = Animated.loop(
        Animated.sequence([
          Animated.timing(animBlob2, {
            toValue: 1,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(animBlob2, {
            toValue: 0,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

      loop1.start();
      loop2.start();
    };

    checkMotionAndAnimate();

    return () => {
      isCancelled = true;
    };
  }, [animBlob1, animBlob2]);

  const trans1X = animBlob1.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 28],
  });
  const trans1Y = animBlob1.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 32],
  });

  const trans2X = animBlob2.interpolate({
    inputRange: [0, 1],
    outputRange: [24, -30],
  });
  const trans2Y = animBlob2.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -26],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Blob 1: Top-Right Warm Peach Glow matching Screenshot 1 */}
      <Animated.View
        style={[
          styles.blob,
          {
            top: -100,
            right: -80,
            transform: [{ translateX: trans1X }, { translateY: trans1Y }],
          },
        ]}
      >
        <Svg width="620" height="620" viewBox="0 0 620 620">
          <Defs>
            <RadialGradient id="gradBlobPeach" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.peachBlob} stopOpacity="0.85" />
              <Stop offset="55%" stopColor={colors.peachBlob} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={colors.peachBlob} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="310" cy="310" r="310" fill="url(#gradBlobPeach)" />
        </Svg>
      </Animated.View>

      {/* Blob 2: Bottom-Left Soft Sage/Mint Glow matching Screenshot 1 */}
      <Animated.View
        style={[
          styles.blob,
          {
            bottom: -100,
            left: -80,
            transform: [{ translateX: trans2X }, { translateY: trans2Y }],
          },
        ]}
      >
        <Svg width="600" height="600" viewBox="0 0 600 600">
          <Defs>
            <RadialGradient id="gradBlobMint" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.mintBlob} stopOpacity="0.8" />
              <Stop offset="60%" stopColor={colors.mintBlob} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={colors.mintBlob} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="300" cy="300" r="300" fill="url(#gradBlobMint)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    opacity: 0.9,
  },
});
