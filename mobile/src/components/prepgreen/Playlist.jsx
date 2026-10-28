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

function PlaylistRow({
  q,
  idx,
  isSelected,
  score,
  onPress,
  disabled,
  isWeb,
  colors,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const badgeBg = BADGE_COLORS[q.n] || '#B9E4C9';
  const statusText = score != null ? `Answered ${score}` : 'Not tried';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      onMouseEnter={() => Platform.OS === 'web' && setIsHovered(true)}
      onMouseLeave={() => Platform.OS === 'web' && setIsHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`${q.s}, ${statusText}`}
      style={[
        styles.row,
        isWeb && styles.rowWeb,
        {
          backgroundColor: colors.card,
          transform: [{ translateX: isWeb && isHovered ? 3 : 0 }],
        },
      ]}
    >
      {/* Badge (34px web, 30px mobile) */}
      <View
        style={[
          styles.badge,
          isWeb && styles.badgeWeb,
          { backgroundColor: badgeBg },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            isWeb && styles.badgeTextWeb,
          ]}
        >
          {q.n}
        </Text>
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          isWeb && styles.titleWeb,
          { color: colors.ink },
        ]}
        numberOfLines={1}
      >
        {q.s}
      </Text>

      {/* Status */}
      <Text
        style={[
          styles.statusText,
          isWeb && styles.statusTextWeb,
          { color: colors.mute },
        ]}
      >
        {statusText}
      </Text>

      {/* Right Slot */}
      <View style={[styles.slot, isWeb && styles.slotWeb]}>
        {isSelected ? (
          <View style={styles.eqsContainer}>
            <EqualiserBar duration={900} color={colors.tomato} />
            <EqualiserBar duration={700} color={colors.tomato} />
            <EqualiserBar duration={1100} color={colors.tomato} />
          </View>
        ) : (
          <View
            style={[
              styles.playCircle,
              isWeb && styles.playCircleWeb,
              { backgroundColor: colors.ink },
            ]}
          >
            <PlayTriangleIcon size={14} color={colors.card} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function Playlist({
  questions,
  currentIndex,
  scores,
  onSelectRow,
  colors,
  isIdle,
  isWeb = false,
}) {
  const rowStep = isWeb ? 66 : 56;
  const highlightY = useRef(new Animated.Value(currentIndex * rowStep)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    Animated.timing(highlightY, {
      toValue: currentIndex * rowStep,
      duration: 450,
      easing: Easing.bezier(0.3, 1.3, 0.5, 1),
      useNativeDriver: useNative,
    }).start();
  }, [currentIndex, rowStep, highlightY]);

  return (
    <View style={[styles.container, isWeb && styles.containerWeb]}>
      {/* Sliding Highlight Border Box */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlight,
          isWeb && styles.highlightWeb,
          {
            borderColor: colors.tomato,
            transform: [{ translateY: highlightY }],
          },
        ]}
      />

      {questions.map((q, idx) => {
        const isSelected = idx === currentIndex;
        const score = scores[idx];

        return (
          <PlaylistRow
            key={`row-${idx}`}
            q={q}
            idx={idx}
            isSelected={isSelected}
            score={score}
            onPress={() => isIdle && onSelectRow(idx)}
            disabled={!isIdle || isSelected}
            isWeb={isWeb}
            colors={colors}
          />
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
  containerWeb: {
    gap: 8,
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
  highlightWeb: {
    height: 58,
    borderRadius: 18,
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
        transition: 'transform 0.15s ease',
      },
    }),
  },
  rowWeb: {
    height: 58,
    borderRadius: 18,
    paddingLeft: 11,
    paddingRight: 12,
    gap: 12,
  },
  badge: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWeb: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  badgeText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: '#1B2E1F',
  },
  badgeTextWeb: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  titleWeb: {
    fontSize: 16,
  },
  statusText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 12.5,
    fontWeight: '500',
  },
  statusTextWeb: {
    fontSize: 13.5,
  },
  slot: {
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotWeb: {
    width: 32,
    height: 32,
  },
  playCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircleWeb: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  eqsContainer: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  eqBar: {
    width: 5,
    height: 22,
    borderRadius: 2,
  },
});
