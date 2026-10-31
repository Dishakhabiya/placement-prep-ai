import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import Svg, { Path, Rect, G } from 'react-native-svg';

export default function Headphones({
  isRecording = false,
  isIdle = true,
  voiceLevel = 0,
  width = 210,
  height = 122,
  colors,
}) {
  const svgRef = useRef(null);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveAnimInner = useRef(new Animated.Value(0.15)).current;
  const waveAnimOuter = useRef(new Animated.Value(0.15)).current;
  const [waveInnerOp, setWaveInnerOp] = useState(0.15);
  const [waveOuterOp, setWaveOuterOp] = useState(0.15);

  // Mouse tracking state for cursor-aware animation (Feature 6)
  const mouseAnimX = useRef(new Animated.Value(0)).current;
  const mouseAnimY = useRef(new Animated.Value(0)).current;
  const mouseAnimRot = useRef(new Animated.Value(0)).current;
  const [trackTransform, setTrackTransform] = useState({ x: 0, y: 0, rot: 0 });

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

  // Track transform listeners for cursor tracking
  useEffect(() => {
    const lx = mouseAnimX.addListener(({ value }) =>
      setTrackTransform((prev) => ({ ...prev, x: value }))
    );
    const ly = mouseAnimY.addListener(({ value }) =>
      setTrackTransform((prev) => ({ ...prev, y: value }))
    );
    const lr = mouseAnimRot.addListener(({ value }) =>
      setTrackTransform((prev) => ({ ...prev, rot: value }))
    );
    return () => {
      mouseAnimX.removeListener(lx);
      mouseAnimY.removeListener(ly);
      mouseAnimRot.removeListener(lr);
    };
  }, [mouseAnimX, mouseAnimY, mouseAnimRot]);

  // Cursor-aware mouse move tracking (web only, idle state only, disabled under reduced motion and on touch devices)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const isTouch =
      'ontouchstart' in window ||
      (window.matchMedia && window.matchMedia('(hover: none)').matches);
    if (isTouch) return;

    let reduceMotion = false;
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      reduceMotion = true;
    }

    if (!isIdle || reduceMotion) {
      Animated.parallel([
        Animated.timing(mouseAnimX, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(mouseAnimY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(mouseAnimRot, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    const handleMouseMove = (e) => {
      if (!isIdle || reduceMotion) return;
      const rect = svgRef.current?.getBoundingClientRect
        ? svgRef.current.getBoundingClientRect()
        : null;

      const centreX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const centreY =
        rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

      const dx = (e.clientX - centreX) / window.innerWidth;
      const dy = (e.clientY - centreY) / window.innerHeight;

      const targetX = Math.max(-8, Math.min(8, dx * 30));
      const targetY = Math.max(-4, Math.min(4, dy * 14));
      const targetRot = Math.max(-7, Math.min(7, dx * 18));

      Animated.parallel([
        Animated.timing(mouseAnimX, {
          toValue: targetX,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(mouseAnimY, {
          toValue: targetY,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(mouseAnimRot, {
          toValue: targetRot,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isIdle, mouseAnimX, mouseAnimY, mouseAnimRot]);

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

  const trackTransformStr = `translate(${trackTransform.x.toFixed(2)}, ${trackTransform.y.toFixed(2)}) rotate(${trackTransform.rot.toFixed(2)}, 120, 100)`;

  return (
    <View
      ref={svgRef}
      style={{
        width,
        height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          width,
          transform: [{ translateY: floatAnim }],
        }}
      >
        <Svg
          width={width}
          height={height}
          viewBox="0 0 240 140"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label="PrepAI headphones"
        >
          {/* Tracking G for cursor-aware mouse movement */}
          <G transform={trackTransformStr}>
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
              <Rect
                x="44"
                y="80"
                width="42"
                height="56"
                rx="17"
                fill={colors.cup}
              />
              <Rect
                x="52"
                y="90"
                width="14"
                height="36"
                rx="7"
                fill={colors.pad}
              />
            </G>

            {/* Right Cup & Pad with squash */}
            <G transform={rightTransform}>
              <Rect
                x="154"
                y="80"
                width="42"
                height="56"
                rx="17"
                fill={colors.cup}
              />
              <Rect
                x="174"
                y="90"
                width="14"
                height="36"
                rx="7"
                fill={colors.pad}
              />
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
