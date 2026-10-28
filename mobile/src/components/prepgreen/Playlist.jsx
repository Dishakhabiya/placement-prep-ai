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
import { BADGE_COLORS, FONTS } from '../../theme/prepGreen';
import { PlayTriangleIcon } from './Icons';

function EqualiserBar({ duration = 900, color }) {
  const scaleAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    let isCancelled = false;
    let loop = null;

    const startEq = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';
      const half = duration / 2;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: half,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.35,
            duration: half,
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
          if (!isCancelled) startEq(enabled);
        })
        .catch(() => {
          if (!isCancelled) startEq(false);
        });
    } else {
      startEq(false);
    }

    return () => {
      isCancelled = true;
      if (loop) loop.stop();
    };
  }, [duration, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.eqBar,
        {
          backgroundColor: color,
          transform: [{ scaleY: scaleAnim }],
        },
      ]}
    />
  );
}

export default function Playlist({
  questions,
  currentIndex,
  scores,
  onSelectRow,
  colors,
  isIdle,
}) {
  const highlightY = useRef(new Animated.Value(currentIndex * 56)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    Animated.timing(highlightY, {
      toValue: currentIndex * 56,
      duration: 450,
      easing: Easing.bezier(0.3, 1.3, 0.5, 1),
      useNativeDriver: useNative,
    }).start();
  }, [currentIndex, highlightY]);

  return (
    <View style={styles.container}>
      {/* Sliding Highlight Border Box */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            borderColor: colors.tomato,
            transform: [{ translateY: highlightY }],
          },
        ]}
      />

      {questions.map((q, idx) => {
        const isSelected = idx === currentIndex;
        const score = scores[idx];
        const badgeBg = BADGE_COLORS[q.n] || '#B9E4C9';
        const statusText = score != null ? `Answered ${score}` : 'Not tried';

        return (
          <TouchableOpacity
            key={`row-${idx}`}
            activeOpacity={0.88}
            onPress={() => isIdle && onSelectRow(idx)}
            disabled={!isIdle || isSelected}
            accessibilityRole="button"
            accessibilityLabel={`${q.s}, ${statusText}`}
            style={[styles.row, { backgroundColor: colors.card }]}
          >
            {/* 30x30 Badge */}
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={styles.badgeText}>{q.n}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {q.s}
            </Text>

            {/* Status */}
            <Text style={[styles.statusText, { color: colors.mute }]}>
              {statusText}
            </Text>

            {/* 30x30 Right Slot */}
            <View style={styles.slot}>
              {isSelected ? (
                <View style={styles.eqsContainer}>
                  <EqualiserBar duration={900} color={colors.tomato} />
                  <EqualiserBar duration={700} color={colors.tomato} />
                  <EqualiserBar duration={1100} color={colors.tomato} />
                </View>
              ) : (
                <View style={[styles.playCircle, { backgroundColor: colors.ink }]}>
                  <PlayTriangleIcon size={14} color={colors.card} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'column',
    gap: 6,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 50,
    borderWidth: 2,
    borderRadius: 16,
    zIndex: 2,
  },
  row: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 10,
    gap: 10,
    zIndex: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  badge: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: '#1B2E1F',
  },
  title: {
    flex: 1,
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 12.5,
    fontWeight: '500',
  },
  slot: {
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqsContainer: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  eqBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
});
