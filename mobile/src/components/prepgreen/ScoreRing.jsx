import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Circle, Text as SvgText, G } from 'react-native-svg';
import { FONTS } from '../../theme/prepGreen';

const CIRCUMFERENCE = 238.8;

export default function ScoreRing({ score = 87, colors }) {
  const [displayScore, setDisplayScore] = useState(0);
  const [dashOffset, setDashOffset] = useState(CIRCUMFERENCE);
  const [burstProgress, setBurstProgress] = useState(0); // 0 to 1
  const [burstOpacity, setBurstOpacity] = useState(0);

  const arcAnim = useRef(new Animated.Value(0)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;

    // Listen to arc progress
    const arcListener = arcAnim.addListener(({ value }) => {
      const curScore = Math.round(value * score);
      setDisplayScore(curScore);
      setDashOffset(CIRCUMFERENCE * (1 - (value * score) / 100));
    });

    const burstListener = burstAnim.addListener(({ value }) => {
      setBurstProgress(value);
      setBurstOpacity(1 - value);
    });

    const startAnims = (reduceMotion) => {
      if (reduceMotion || isCancelled) {
        setDisplayScore(score);
        setDashOffset(CIRCUMFERENCE * (1 - score / 100));
        return;
      }

      // Animate arc and score counter over 1100ms
      Animated.timing(arcAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: false,
      }).start();

      // If score >= 78, burst 10 particles
      if (score >= 78) {
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(burstAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
        ]).start();
      }
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startAnims(enabled);
        })
        .catch(() => {
          if (!isCancelled) startAnims(false);
        });
    } else {
      startAnims(false);
    }

    return () => {
      isCancelled = true;
      arcAnim.removeListener(arcListener);
      burstAnim.removeListener(burstListener);
    };
  }, [score, arcAnim, burstAnim]);

  // 10 burst particles
  const burstDots = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 10;
    const dist = burstProgress * 58;
    const cx = 48 + Math.cos(angle) * dist;
    const cy = 48 + Math.sin(angle) * dist;
    const fill = i % 2 === 1 ? colors.tomato : colors.ink;
    return { cx, cy, fill };
  });

  return (
    <View style={{ width: 96, height: 96, flexShrink: 0 }}>
      <Svg width={96} height={96} viewBox="0 0 96 96" aria-hidden={true} style={{ overflow: 'visible' }}>
        {/* Track circle */}
        <Circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke={colors.soft}
          strokeWidth="10"
        />

        {/* Animated Fill Arc */}
        <Circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke={colors.tomato}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 48 48)"
        />

        {/* Counter Number */}
        <SvgText
          x="48"
          y="56"
          textAnchor="middle"
          fontFamily={FONTS.outfit.extraBold}
          fontWeight="800"
          fontSize="26"
          fill={colors.ink}
        >
          {displayScore}
        </SvgText>

        {/* Burst Particles */}
        {score >= 78 && burstOpacity > 0 ? (
          <G opacity={burstOpacity}>
            {burstDots.map((dot, idx) => (
              <Circle
                key={`burst-${idx}`}
                cx={dot.cx}
                cy={dot.cy}
                r="3"
                fill={dot.fill}
              />
            ))}
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
