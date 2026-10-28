import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BADGE_COLORS, FONTS } from '../../theme/prepGreen';

function SpinningRecord({
  label,
  score,
  badgeBg,
  isNewlyAdded = false,
  colors,
}) {
  const isGold = score >= 85;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dropAnim = useRef(new Animated.Value(isNewlyAdded ? 0 : 1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let spinLoop = null;

    const start = (rm) => {
      if (isCancelled) return;
      setReduceMotion(rm);
      if (rm) return;

      const useNative = Platform.OS !== 'web';

      // Drop in animation if newly added
      if (isNewlyAdded) {
        Animated.timing(dropAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: useNative,
        }).start();
      }

      // 7s linear infinite continuous spin
      spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 7000,
          easing: Easing.linear,
          useNativeDriver: useNative,
        })
      );
      spinLoop.start();
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
      if (spinLoop) spinLoop.stop();
    };
  }, [spinAnim, dropAnim, isNewlyAdded]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const translateY = dropAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [-34, 4, 0],
  });

  const opacity = dropAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 1, 1],
  });

  const a11yLabel = `Record for ${label}, score ${score}${isGold ? ', gold' : ''}`;

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={[
        styles.slot,
        {
          opacity: reduceMotion ? 1 : opacity,
          transform: [{ translateY: reduceMotion ? 0 : translateY }],
        },
      ]}
    >
      <Animated.View
        style={{
          width: 56,
          height: 56,
          transform: [{ rotate: reduceMotion ? '0deg' : spinInterpolation }],
        }}
      >
        <Svg width={56} height={56} viewBox="0 0 56 56" role="img" aria-label={a11yLabel}>
          {/* Main Disc: r26 fill #0F1A12 with stroke */}
          <Circle
            cx={28}
            cy={28}
            r={26}
            fill="#0F1A12"
            stroke={isGold ? '#E0B13A' : colors.mute}
            strokeWidth={isGold ? 3 : 1.5}
          />
          {/* Groove circles r21 and r16.5 (white at 14%) */}
          <Circle
            cx={28}
            cy={28}
            r={21}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
          />
          <Circle
            cx={28}
            cy={28}
            r={16.5}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
          />
          {/* Highlight arc M14 20a16 16 0 0 1 12-9 (white at 35%, width 2, round) */}
          <Path
            d="M14 20a16 16 0 0 1 12-9"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Centre label r9 in question's badge colour */}
          <Circle cx={28} cy={28} r={9} fill={badgeBg} />
          {/* Centre hole r2.4 #0F1A12 */}
          <Circle cx={28} cy={28} r={2.4} fill="#0F1A12" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

export default function VinylShelf({
  questions = [],
  scores = [null, null, null, null],
  colors,
}) {
  const droppedRef = useRef([false, false, false, false]);

  const answeredScores = scores.filter((s) => s != null);
  const answeredCount = answeredScores.length;
  const avgScore =
    answeredCount > 0
      ? Math.round(answeredScores.reduce((a, b) => a + b, 0) / answeredCount)
      : 0;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Today</Text>
      </View>

      {/* Row of 4 Slots (56px, gap 10, marginHorizontal 6) */}
      <View style={styles.shelfRow}>
        {questions.map((q, idx) => {
          const score = scores[idx];
          const badgeBg = BADGE_COLORS[q.n] || '#B9E4C9';

          if (score == null) {
            return (
              <View
                key={`slot-${idx}`}
                style={[
                  styles.emptySlot,
                  {
                    borderColor: colors.mute,
                  },
                ]}
              >
                <Text style={[styles.emptySlotText, { color: colors.mute }]}>
                  {q.n}
                </Text>
              </View>
            );
          }

          const isNewlyAdded = !droppedRef.current[idx];
          if (isNewlyAdded) {
            droppedRef.current[idx] = true;
          }

          return (
            <SpinningRecord
              key={`rec-${idx}`}
              label={q.n}
              score={score}
              badgeBg={badgeBg}
              isNewlyAdded={isNewlyAdded}
              colors={colors}
            />
          );
        })}
      </View>

      {/* Caption */}
      <Text style={[styles.caption, { color: colors.mute }]}>
        Your records. Gold means a score of 85 or more.
      </Text>

      {/* Average Score / Empty Line */}
      {answeredCount > 0 ? (
        <View style={styles.statsBlock}>
          <Text style={[styles.avgHeadline, { color: colors.ink }]}>
            Average score {avgScore}
          </Text>
          <Text style={[styles.avgSubline, { color: colors.mute }]}>
            {answeredCount} of 4 questions answered today.
          </Text>
        </View>
      ) : (
        <View style={styles.statsBlock}>
          <Text style={[styles.avgHeadline, { color: colors.ink }]}>
            No answers yet
          </Text>
          <Text style={[styles.avgSubline, { color: colors.mute }]}>
            Finish a question to see your average score.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    width: '100%',
  },
  secHeader: {
    marginHorizontal: 6,
    marginBottom: 12,
  },
  secTitle: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  shelfRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  slot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  caption: {
    marginHorizontal: 6,
    marginTop: 10,
    fontFamily: FONTS.outfit.medium,
    fontSize: 13,
    fontWeight: '500',
  },
  statsBlock: {
    marginHorizontal: 6,
    marginTop: 12,
  },
  avgHeadline: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 16,
    fontWeight: '600',
  },
  avgSubline: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
});
