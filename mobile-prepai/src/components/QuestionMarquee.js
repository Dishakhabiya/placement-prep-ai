import React, { useEffect, useRef, useState } from 'react';
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
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';
import { MARQUEE_QUESTIONS } from '../data/questions';

export default function QuestionMarquee({ entranceDelay = 600 }) {
  const { colors, fonts } = useTheme();
  const showToast = useUiStore((s) => s.showToast);

  const [trackWidth, setTrackWidth] = useState(1400);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(1)).current;
  const isPaused = useRef(false);
  const currentVal = useRef(0);

  const repeatedQuestions = [
    ...MARQUEE_QUESTIONS,
    ...MARQUEE_QUESTIONS,
    ...MARQUEE_QUESTIONS,
  ];

  useEffect(() => {
    let isCancelled = false;

    const runEntrance = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled) return;

      if (isReduceMotion) {
        entranceAnim.setValue(1);
        return;
      }

      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 550,
        delay: entranceDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };

    runEntrance();

    return () => {
      isCancelled = true;
    };
  }, [entranceDelay, entranceAnim]);

  useEffect(() => {
    let isCancelled = false;
    let animLoop = null;

    const startMarquee = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      const oneHalf = trackWidth / 3;

      animLoop = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: -oneHalf,
          duration: 32000,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );

      animLoop.start();
    };

    startMarquee();

    return () => {
      isCancelled = true;
      if (animLoop) animLoop.stop();
    };
  }, [trackWidth, scrollAnim]);

  const onMouseEnter = () => {
    if (Platform.OS === 'web' && !isPaused.current) {
      isPaused.current = true;
      scrollAnim.stopAnimation((value) => {
        currentVal.current = value;
      });
    }
  };

  const onMouseLeave = () => {
    if (Platform.OS === 'web' && isPaused.current) {
      isPaused.current = false;
      const oneHalf = trackWidth / 3;
      const remainingDistance = Math.abs(-oneHalf - currentVal.current);
      const remainingTime = (remainingDistance / oneHalf) * 32000;

      Animated.sequence([
        Animated.timing(scrollAnim, {
          toValue: -oneHalf,
          duration: Math.max(1000, remainingTime),
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        if (!isPaused.current) {
          scrollAnim.setValue(0);
          Animated.loop(
            Animated.timing(scrollAnim, {
              toValue: -oneHalf,
              duration: 32000,
              easing: Easing.linear,
              useNativeDriver: Platform.OS !== 'web',
            })
          ).start();
        }
      });
    }
  };

  const handleChipPress = (question) => {
    showToast(`Starting: “${question}”`);
  };

  const translateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        {
          borderColor: colors.line,
          backgroundColor: colors.card,
          opacity: entranceAnim,
          transform: [{ translateY }],
        },
      ]}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Animated.View
        style={[
          styles.track,
          {
            transform: [{ translateX: scrollAnim }],
          },
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - trackWidth) > 50) {
            setTrackWidth(w);
          }
        }}
      >
        {repeatedQuestions.map((q, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => handleChipPress(q)}
            accessibilityRole="button"
            accessibilityLabel={`Practise question: ${q}`}
            style={[styles.chip, { backgroundColor: colors.soft }]}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.ink, fontFamily: fonts.bodyBold },
              ]}
            >
              {q}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Left Gradient Fade Mask */}
      <View style={[styles.gradientMask, styles.gradientMaskLeft]} pointerEvents="none">
        <Svg width="80" height="76" viewBox="0 0 80 76">
          <Defs>
            <LinearGradient id="fadeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.card} stopOpacity="1" />
              <Stop offset="70%" stopColor={colors.card} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={colors.card} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="80" height="76" fill="url(#fadeLeft)" />
        </Svg>
      </View>

      {/* Right Gradient Fade Mask */}
      <View style={[styles.gradientMask, styles.gradientMaskRight]} pointerEvents="none">
        <Svg width="80" height="76" viewBox="0 0 80 76">
          <Defs>
            <LinearGradient id="fadeRight" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.card} stopOpacity="0" />
              <Stop offset="30%" stopColor={colors.card} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={colors.card} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="80" height="76" fill="url(#fadeRight)" />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 26,
    marginBottom: 10,
    width: '100%',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(11, 59, 74, 0.05)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    width: 2900,
  },
  chip: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  gradientMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 10,
  },
  gradientMaskLeft: {
    left: 0,
  },
  gradientMaskRight: {
    right: 0,
  },
});
