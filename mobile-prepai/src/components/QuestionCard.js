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
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';

export default function QuestionCard({
  num,
  tag,
  question,
  index = 0,
  entranceDelay = 240,
}) {
  const { colors, fonts, radii } = useTheme();
  const showToast = useUiStore((s) => s.showToast);

  const [isHovered, setIsHovered] = useState(false);

  const entranceAnim = useRef(new Animated.Value(1)).current;
  const hoverAnim = useRef(new Animated.Value(0)).current;

  const tiltSign = index % 2 === 0 ? -1 : 1;
  const tiltDeg = `${tiltSign * 1.2}deg`;

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

  const animateHover = (toValue) => {
    Animated.timing(hoverAnim, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePress = () => {
    showToast(`Starting: “${question}”`);
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
    outputRange: ['0deg', tiltDeg],
  });

  const arrowTranslateX = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          borderRadius: radii.card,
          borderColor: colors.line,
          backgroundColor: colors.card,
          opacity: entranceAnim,
          transform: [{ translateY }, { rotate }],
          ...Platform.select({
            web: {
              boxShadow: isHovered
                ? '0 16px 36px rgba(11, 59, 74, 0.12)'
                : '0 6px 20px rgba(11, 59, 74, 0.05)',
              transition: 'box-shadow 0.2s ease',
              cursor: 'pointer',
            },
            default: {
              elevation: isHovered ? 6 : 2,
            },
          }),
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={() => animateHover(1)}
        onPressOut={() => animateHover(0)}
        onMouseEnter={() => {
          setIsHovered(true);
          animateHover(1);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          animateHover(0);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${num}: ${question}`}
        style={styles.cardInner}
        activeOpacity={0.92}
      >
        {/* Top Row: Q Number (Fraunces 900, 42px) + Soft Tag */}
        <View style={styles.topRow}>
          <Text
            style={[
              styles.qNum,
              { color: colors.ink, fontFamily: fonts.headingBlack },
            ]}
          >
            {num}
          </Text>
          <View style={[styles.tagBadge, { backgroundColor: colors.soft }]}>
            <Text
              style={[
                styles.tagText,
                { color: colors.ink, fontFamily: fonts.bodyBold },
              ]}
            >
              {tag}
            </Text>
          </View>
        </View>

        {/* Question Text (Fraunces 700, 21px, dark teal) */}
        <Text
          style={[
            styles.questionText,
            { color: colors.ink, fontFamily: fonts.headingBold },
          ]}
        >
          {question}
        </Text>

        {/* Footer: Practise this + Arrow Circle */}
        <View style={styles.footerRow}>
          <Text
            style={[
              styles.footerText,
              { color: colors.ink, fontFamily: fonts.bodyBold },
            ]}
          >
            Practise this
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
    marginBottom: 12,
  },
  qNum: {
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -1,
  },
  tagBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 29,
    marginVertical: 12,
    letterSpacing: -0.2,
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
