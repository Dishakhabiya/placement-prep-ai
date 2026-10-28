import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import Svg, { Path, Rect, G } from 'react-native-svg';

export default function Headphones({
  isRecording = false,
  voiceLevel = 0,
  colors,
}) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveAnimInner = useRef(new Animated.Value(0.15)).current;
  const waveAnimOuter = useRef(new Animated.Value(0.15)).current;
  const [waveInnerOp, setWaveInnerOp] = useState(0.15);
  const [waveOuterOp, setWaveOuterOp] = useState(0.15);

  // Float animation
  useEffect(() => {
    let isCancelled = false;
    let loop = null;

    const startFloat = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      loop.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startFloat(enabled);
        })
        .catch(() => {
          if (!isCancelled) startFloat(false);
        });
    } else {
      startFloat(false);
    }

    return () => {
      isCancelled = true;
      if (loop) loop.stop();
    };
  }, [floatAnim]);

  // Wave pulse listeners
  useEffect(() => {
    const l1 = waveAnimInner.addListener(({ value }) => setWaveInnerOp(value));
    const l2 = waveAnimOuter.addListener(({ value }) => setWaveOuterOp(value));
    return () => {
      waveAnimInner.removeListener(l1);
      waveAnimOuter.removeListener(l2);
    };
  }, [waveAnimInner, waveAnimOuter]);

  // Wave pulse animation (switches speed when recording)
  useEffect(() => {
    let isCancelled = false;
    let loop1 = null;
    let loop2 = null;

    const duration = isRecording ? 550 : 1800;
    const halfDur = duration / 2;

    const startWaves = (reduceMotion) => {
      if (reduceMotion || isCancelled) {
        setWaveInnerOp(0.7);
        setWaveOuterOp(0.7);
        return;
      }

      loop1 = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimInner, {
            toValue: 1,
            duration: halfDur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(waveAnimInner, {
            toValue: 0.15,
            duration: halfDur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );

      loop2 = Animated.loop(
        Animated.sequence([
          Animated.delay(isRecording ? 100 : 300),
          Animated.timing(waveAnimOuter, {
            toValue: 1,
            duration: halfDur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(waveAnimOuter, {
            toValue: 0.15,
            duration: halfDur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );

      loop1.start();
      loop2.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startWaves(enabled);
        })
        .catch(() => {
          if (!isCancelled) startWaves(false);
        });
    } else {
      startWaves(false);
    }

    return () => {
      isCancelled = true;
      if (loop1) loop1.stop();
      if (loop2) loop2.stop();
    };
  }, [isRecording, waveAnimInner, waveAnimOuter]);

  // Calculate cup squash from voiceLevel (0 to 1)
  const lvl = Math.max(0, Math.min(1, voiceLevel || 0));
  const scaleX = (1 - lvl * 0.09).toFixed(3);
  const scaleY = (1 + lvl * 0.05).toFixed(3);

  // Cup centres: left (65, 108), right (175, 108)
  const leftTransform = `translate(65, 108) scale(${scaleX}, ${scaleY}) translate(-65, -108)`;
  const rightTransform = `translate(175, 108) scale(${scaleX}, ${scaleY}) translate(-175, -108)`;

  return (
    <View style={{ width: 210, height: 122, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          width: 210,
          transform: [{ translateY: floatAnim }],
        }}
      >
        <Svg
          width={210}
          height={122}
          viewBox="0 0 240 140"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label="PrepAI headphones"
        >
          <G>
            {/* Outer Headband */}
            <Path
              d="M60 92C60 24 180 24 180 92"
              fill="none"
              stroke="#FF5B3A"
              strokeWidth="15"
              strokeLinecap="round"
            />

            {/* Inner Headband line */}
            <Path
              d="M60 92C60 38 180 38 180 92"
              fill="none"
              stroke={colors.ink}
              strokeWidth="3"
              strokeLinecap="round"
              opacity={0.22}
            />

            {/* Left Cup & Pad with squash */}
            <G transform={leftTransform}>
              <Rect x="44" y="80" width="42" height="56" rx="17" fill={colors.cup} />
              <Rect x="52" y="90" width="14" height="36" rx="7" fill={colors.pad} />
            </G>

            {/* Right Cup & Pad with squash */}
            <G transform={rightTransform}>
              <Rect x="154" y="80" width="42" height="56" rx="17" fill={colors.cup} />
              <Rect x="174" y="90" width="14" height="36" rx="7" fill={colors.pad} />
            </G>

            {/* Sound waves Left */}
            <Path
              d="M32 94q-9 14 0 28"
              fill="none"
              stroke={colors.ink}
              strokeWidth="4"
              strokeLinecap="round"
              opacity={waveInnerOp}
            />
            <Path
              d="M20 84q-17 24 0 50"
              fill="none"
              stroke={colors.ink}
              strokeWidth="4"
              strokeLinecap="round"
              opacity={waveOuterOp}
            />

            {/* Sound waves Right */}
            <Path
              d="M208 94q9 14 0 28"
              fill="none"
              stroke={colors.ink}
              strokeWidth="4"
              strokeLinecap="round"
              opacity={waveInnerOp}
            />
            <Path
              d="M220 84q17 24 0 50"
              fill="none"
              stroke={colors.ink}
              strokeWidth="4"
              strokeLinecap="round"
              opacity={waveOuterOp}
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
