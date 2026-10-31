import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../theme/prepHome';
import { ArrowRightIcon } from './Icons';

export default function QuestionCard({
  item,
  index = 0,
  onPress,
}) {
  const { id, tag, tagColor, question } = item;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const delay = 100 + index * 100;
    const useNative = Platform.OS !== 'web';

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 550,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onPress && onPress(question)}
        accessibilityRole="button"
        accessibilityLabel={`${id}: ${question}. Practise this.`}
        style={styles.card}
      >
        {/* Top Row: Q Number & Tag Pill */}
        <View style={styles.topRow}>
          <Text style={styles.qNumber}>{id}</Text>
          <View style={[styles.tagPill, { backgroundColor: tagColor }]}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        </View>

        {/* Middle: Question Text */}
        <Text style={styles.questionText} numberOfLines={4}>
          {question}
        </Text>

        {/* Bottom Row: "Practise this" & Arrow Circle */}
        <View style={styles.bottomRow}>
          <Text style={styles.practiseText}>Practise this</Text>
          <View style={styles.arrowCircle}>
            <ArrowRightIcon size={18} color={COLORS.cream} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    width: SPACING.cardWidth,
    height: SPACING.cardHeight,
  },
  card: {
    width: SPACING.cardWidth,
    height: SPACING.cardHeight,
    backgroundColor: COLORS.cream,
    borderRadius: SPACING.cardRadius,
    padding: 18,
    flexDirection: 'column',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  qNumber: {
    fontFamily: FONTS.fraunces.bold,
    fontSize: 58,
    lineHeight: 52,
    fontWeight: '700',
    color: COLORS.ink,
  },
  tagPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontFamily: FONTS.dmSans.bold,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  questionText: {
    fontFamily: FONTS.fraunces.semiBold,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '600',
    color: COLORS.ink,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  practiseText: {
    fontFamily: FONTS.dmSans.bold,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
