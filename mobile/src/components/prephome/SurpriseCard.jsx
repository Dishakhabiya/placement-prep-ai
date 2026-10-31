import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import { COLORS, FONTS, SPACING } from '../../theme/prepHome';
import { ArrowRightIcon } from './Icons';

export default function SurpriseCard({
  index = 4,
  onPress,
}) {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const diceAnim = useRef(new Animated.Value(0)).current; // 0 -> 1 -> 0 for -12deg to +12deg

  useEffect(() => {
    const delay = 100 + index * 100;
    const useNative = Platform.OS !== 'web';

    // Entry slide and fade
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 550,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 550,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
    ]).start();

    // Dice rotation animation
    let isCancelled = false;
    let loopAnim = null;

    const startDiceLoop = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(diceAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(diceAnim, {
            toValue: -1,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
        ])
      );
      loopAnim.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startDiceLoop(enabled);
        })
        .catch(() => {
          if (!isCancelled) startDiceLoop(false);
        });
    } else {
      startDiceLoop(false);
    }

    return () => {
      isCancelled = true;
      if (loopAnim) loopAnim.stop();
    };
  }, [index, cardOpacity, cardTranslateY, diceAnim]);

  const diceRotate = diceAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Surprise me. A random question, just for you. Roll the dice."
        style={styles.card}
      >
        {/* Top: Animated Rolling Dice */}
        <View style={styles.diceContainer}>
          <Animated.View
            style={{
              width: 84,
              height: 84,
              transform: [{ rotate: diceRotate }],
            }}
          >
            <Svg width="84" height="84" viewBox="0 0 48 48" aria-hidden={true}>
              <Rect x="6" y="6" width="36" height="36" rx="9" fill="#F6E7C8" />
              <Circle cx="16" cy="16" r="3" fill="#0B2F3A" />
              <Circle cx="32" cy="16" r="3" fill="#0B2F3A" />
              <Circle cx="24" cy="24" r="3" fill="#0B2F3A" />
              <Circle cx="16" cy="32" r="3" fill="#0B2F3A" />
              <Circle cx="32" cy="32" r="3" fill="#0B2F3A" />
            </Svg>
          </Animated.View>
        </View>

        {/* Middle: Headline & Subtitle */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>Surprise me</Text>
          <Text style={styles.subtitle}>A random question, just for you.</Text>
        </View>

        {/* Bottom: "Roll the dice" & Arrow Circle */}
        <View style={styles.bottomRow}>
          <Text style={styles.rollText}>Roll the dice</Text>
          <View style={styles.arrowCircle}>
            <ArrowRightIcon size={18} color={COLORS.orange} />
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
    backgroundColor: COLORS.orange,
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
  diceContainer: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    marginTop: 4,
  },
  title: {
    fontFamily: FONTS.fraunces.bold,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    color: COLORS.ink,
  },
  subtitle: {
    fontFamily: FONTS.dmSans.medium,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.ink,
    marginTop: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rollText: {
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
