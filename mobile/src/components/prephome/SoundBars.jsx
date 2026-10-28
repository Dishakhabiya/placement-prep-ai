import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { COLORS } from '../../theme/prepHome';

const LEFT_SPECS = [
  { peak: 20, dur: 800 },
  { peak: 34, dur: 1250 },
  { peak: 50, dur: 950 },
  { peak: 38, dur: 1400 },
  { peak: 28, dur: 1100 },
  { peak: 44, dur: 800 },
];

const RIGHT_SPECS = [
  { peak: 44, dur: 800 },
  { peak: 28, dur: 1250 },
  { peak: 38, dur: 950 },
  { peak: 50, dur: 1400 },
  { peak: 34, dur: 1100 },
  { peak: 20, dur: 800 },
];

function AnimatedBar({ x, peak, dur }) {
  const heightAnim = useRef(new Animated.Value(8)).current;
  const [heightVal, setHeightVal] = useState(8);

  useEffect(() => {
    const listenerId = heightAnim.addListener(({ value }) => {
      setHeightVal(value);
    });
    return () => {
      heightAnim.removeListener(listenerId);
    };
  }, [heightAnim]);

  useEffect(() => {
    let isCancelled = false;
    let loopAnim = null;

    const startLoop = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const halfDur = dur / 2;
      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(heightAnim, {
            toValue: peak,
            duration: halfDur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: 8,
            duration: halfDur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      loopAnim.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startLoop(enabled);
        })
        .catch(() => {
          if (!isCancelled) startLoop(false);
        });
    } else {
      startLoop(false);
    }

    return () => {
      isCancelled = true;
      if (loopAnim) loopAnim.stop();
    };
  }, [dur, heightAnim, peak]);

  const yVal = 28 - heightVal / 2;

  return (
    <Rect
      x={x}
      y={yVal}
      width={8}
      height={heightVal}
      rx={4}
      fill={COLORS.orange}
      opacity={0.9}
    />
  );
}

export default function SoundBars({ side = 'left' }) {
  const specs = side === 'left' ? LEFT_SPECS : RIGHT_SPECS;
  const xs = [4, 22, 40, 58, 76, 94];

  return (
    <View style={{ width: 104, height: 56 }}>
      <Svg width={104} height={56} viewBox="0 0 104 56" aria-hidden={true}>
        {specs.map((spec, idx) => (
          <AnimatedBar
            key={`${side}-bar-${idx}`}
            x={xs[idx]}
            peak={spec.peak}
            dur={spec.dur}
          />
        ))}
      </Svg>
    </View>
  );
}
