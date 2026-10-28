import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../../theme/prepPink';
import HardShadow from './HardShadow';
import { ChevronRightIcon } from './Icons';

export default function QuestionRow({ item, index = 0, onPress }) {
  const { emoji, tileColor, question } = item;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const delay = 150 + index * 100;
    const useNative = Platform.OS !== 'web';

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <HardShadow
        offset={{ x: 4, y: 4 }}
        borderRadius={20}
        shadowColor={COLORS.ink}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onPress && onPress(question)}
          accessibilityRole="button"
          accessibilityLabel={question}
          style={styles.card}
        >
          {/* Tile 44x44 with emoji */}
          <View
            style={[styles.tile, { backgroundColor: tileColor }]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            aria-hidden={true}
          >
            <Text style={styles.tileEmoji}>{emoji}</Text>
          </View>

          {/* Question Text */}
          <Text style={styles.questionText}>
            {question}
          </Text>

          {/* Chevron Right */}
          <ChevronRightIcon size={20} color={COLORS.ink} strokeWidth={2.5} />
        </TouchableOpacity>
      </HardShadow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.white,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  tile: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  questionText: {
    flex: 1,
    fontFamily: FONTS.poppins.semiBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.ink,
  },
});
