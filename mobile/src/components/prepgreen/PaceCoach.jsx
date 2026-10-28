import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { FONTS } from '../../theme/prepGreen';

export function FillerPill({ word, leftPercent = 50, onFinished, colors }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;

    const start = (reduceMotion) => {
      if (isCancelled) return;
      if (reduceMotion) {
        const timer = setTimeout(() => {
          if (!isCancelled && onFinished) onFinished();
        }, 1200);
        return () => clearTimeout(timer);
      }

      const useNative = Platform.OS !== 'web';
      Animated.timing(anim, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }).start(({ finished }) => {
        if (finished && !isCancelled && onFinished) {
          onFinished();
        }
      });
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((rm) => start(rm))
        .catch(() => start(false));
    } else {
      start(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [anim, onFinished]);

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 0],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [16, -4, -36],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.8, 1, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ftag,
        {
          left: `${leftPercent}%`,
          backgroundColor: colors.ink,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={[styles.ftagText, { color: colors.card }]}>{word}</Text>
    </Animated.View>
  );
}

export default function PaceCoach({
  wpm = 140,
  fillerCount = 0,
  colors,
}) {
  const markerAnim = useRef(new Animated.Value(50)).current;

  const clampedWpm = Math.max(80, Math.min(220, wpm || 140));
  const markerPercent = ((clampedWpm - 80) / 140) * 100;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    Animated.timing(markerAnim, {
      toValue: markerPercent,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: useNative,
    }).start();
  }, [markerPercent, markerAnim]);

  let paceClass = 'Good pace';
  if (wpm < 110) {
    paceClass = 'A bit slow';
  } else if (wpm > 170) {
    paceClass = 'Too fast';
  }

  const fillerLabel =
    fillerCount === 1 ? '1 filler word' : `${fillerCount} filler words`;

  return (
    <View style={styles.container}>
      {/* Top Labels */}
      <View style={styles.topRow}>
        <Text style={[styles.paceLabel, { color: colors.mute }]}>
          {paceClass}, {Math.round(wpm)} words a minute
        </Text>
        <Text style={[styles.fillerCount, { color: colors.mute }]}>
          {fillerLabel}
        </Text>
      </View>

      {/* Gauge */}
      <View
        style={[styles.gaugeTrack, { backgroundColor: colors.soft }]}
        aria-hidden={true}
      >
        {/* Good Zone: 110 to 170 wpm on 80-220 scale -> left 21.4%, width 42.9% */}
        <View
          style={[
            styles.goodZone,
            {
              backgroundColor: colors.tomato,
              opacity: 0.3,
            },
          ]}
        />

        {/* 20px sliding marker */}
        <Animated.View
          style={[
            styles.marker,
            {
              backgroundColor: colors.ink,
              borderColor: colors.card,
              left: markerAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  paceLabel: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  fillerCount: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  gaugeTrack: {
    position: 'relative',
    height: 10,
    borderRadius: 5,
    width: '100%',
    overflow: 'visible',
    justifyContent: 'center',
  },
  goodZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '21.4%',
    width: '42.9%',
    borderRadius: 5,
  },
  marker: {
    position: 'absolute',
    top: -5,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 3,
  },
  ftag: {
    position: 'absolute',
    top: 4,
    paddingVertical: 3,
    paddingHorizontal: 11,
    borderRadius: 10,
    zIndex: 10,
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
      },
    }),
  },
  ftagText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 14,
    fontWeight: '700',
  },
});
