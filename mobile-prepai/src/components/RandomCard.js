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
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';
import { RANDOM_QUESTIONS } from '../data/questions';

export default function RandomCard({ entranceDelay = 480 }) {
  const { colors, fonts, radii } = useTheme();
  const showToast = useUiStore((s) => s.showToast);

  const [isHovered, setIsHovered] = useState(false);
  const [displayTitle, setDisplayTitle] = useState('Surprise me');
  const [isRolling, setIsRolling] = useState(false);

  const entranceAnim = useRef(new Animated.Value(1)).current;
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const diceRotAnim = useRef(new Animated.Value(0)).current;
  const diceScaleAnim = useRef(new Animated.Value(1)).current;

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
        duration: 520,
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

  const onHoverIn = () => {
    setIsHovered(true);
    Animated.parallel([
      Animated.timing(hoverAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(diceRotAnim, {
        toValue: 360,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const onHoverOut = () => {
    setIsHovered(false);
    Animated.parallel([
      Animated.timing(hoverAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(diceRotAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(diceScaleAnim, {
          toValue: 1.4,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(diceScaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.timing(diceRotAnim, {
        toValue: 720,
        duration: 770,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    let step = 0;
    const interval = setInterval(() => {
      const randIdx = Math.floor(Math.random() * RANDOM_QUESTIONS.length);
      const chosen = RANDOM_QUESTIONS[randIdx];
      setDisplayTitle(chosen);
      step += 1;

      if (step >= 7) {
        clearInterval(interval);
        setIsRolling(false);
        showToast(`Starting: “${chosen}”`);
        diceRotAnim.setValue(0);
      }
    }, 110);
  };

  const translateY = Animated.add(
    entranceAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [30, 0],
    }),
    hoverAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    })
  );

  const rotate = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1.2deg'],
  });

  const arrowTranslateX = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  const diceRotation = diceRotAnim.interpolate({
    inputRange: [0, 360, 720],
    outputRange: ['0deg', '360deg', '720deg'],
  });

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          borderRadius: radii.card,
          backgroundColor: colors.orange,
          opacity: entranceAnim,
          transform: [{ translateY }, { rotate }],
          ...Platform.select({
            web: {
              boxShadow: isHovered
                ? '0 16px 36px rgba(255, 111, 44, 0.35)'
                : '0 8px 24px rgba(255, 111, 44, 0.22)',
              transition: 'box-shadow 0.2s ease',
              cursor: 'pointer',
            },
            default: {
              elevation: isHovered ? 8 : 4,
            },
          }),
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleRoll}
        onPressIn={onHoverIn}
        onPressOut={onHoverOut}
        onMouseEnter={onHoverIn}
        onMouseLeave={onHoverOut}
        accessibilityRole="button"
        accessibilityLabel={`Random question: ${displayTitle}. Roll the dice.`}
        style={styles.cardInner}
        activeOpacity={0.92}
      >
        {/* Top Row: 44px Dice Icon + Dark Teal Tag "Random" */}
        <View style={styles.topRow}>
          {/* Animated 5-dot Dice Icon (44px, 3px ink border matching Screenshot 2) */}
          <Animated.View
            style={{
              transform: [{ rotate: diceRotation }, { scale: diceScaleAnim }],
            }}
          >
            <Svg width="44" height="44" viewBox="0 0 44 44">
              <Rect
                x="3"
                y="3"
                width="38"
                height="38"
                rx="12"
                fill={colors.orange}
                stroke={colors.ink}
                strokeWidth="3.2"
              />
              {/* 5 Dots: Center and 4 corners */}
              <Circle cx="22" cy="22" r="3.2" fill={colors.ink} />
              <Circle cx="13" cy="13" r="3.2" fill={colors.ink} />
              <Circle cx="31" cy="13" r="3.2" fill={colors.ink} />
              <Circle cx="13" cy="31" r="3.2" fill={colors.ink} />
              <Circle cx="31" cy="31" r="3.2" fill={colors.ink} />
            </Svg>
          </Animated.View>

          {/* Dark Teal Tag "Random" with White Text matching Screenshot 2 */}
          <View style={[styles.tagBadge, { backgroundColor: colors.ink }]}>
            <Text
              style={[
                styles.tagText,
                { color: '#FFFFFF', fontFamily: fonts.bodyBold },
              ]}
            >
              Random
            </Text>
          </View>
        </View>

        {/* Middle: Title & Subtitle */}
        <View style={styles.textBlock}>
          <Text
            style={[
              styles.cardTitle,
              { color: colors.ink, fontFamily: fonts.headingBlack },
            ]}
          >
            {displayTitle}
          </Text>
          <Text
            style={[
              styles.cardSub,
              { color: colors.ink, fontFamily: fonts.bodyMedium },
            ]}
          >
            A random question, just for you.
          </Text>
        </View>

        {/* Footer: Roll the dice + Arrow Circle */}
        <View style={styles.footerRow}>
          <Text
            style={[
              styles.footerText,
              { color: colors.ink, fontFamily: fonts.bodyBold },
            ]}
          >
            Roll the dice
          </Text>

          <Animated.View
            style={[
              styles.arrowCircle,
              {
                backgroundColor: colors.ink,
                transform: [{ translateX: arrowTranslateX }],
              },
            ]}
          >
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="#FFFFFF"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    minHeight: 230,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    boxSizing: 'border-box',
    width: '100%',
  },
  cardInner: {
    padding: 26,
    minHeight: 230,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagBadge: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textBlock: {
    marginVertical: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.9,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
