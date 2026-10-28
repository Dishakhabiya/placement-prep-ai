import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, FONTS, RADII } from '../theme';
import HardShadowBox from './HardShadowBox';
import Icon from './Icon';

export default function QuestionCard({
  iconName,
  iconChar,
  charColor,
  tileColor,
  question,
  onPress,
}) {
  return (
    <HardShadowBox
      offset={5}
      radius={RADII.card}
      backgroundColor={COLORS.surface}
      borderColor={COLORS.ink}
      enableHover={true}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={question}
      style={styles.cardWrapper}
      contentStyle={styles.cardContent}
    >
      {/* 52x52 Left Icon Tile */}
      <View style={[styles.iconTile, { backgroundColor: tileColor }]}>
        {iconName ? (
          <Icon name={iconName} size={28} color={COLORS.ink} strokeWidth={2.5} />
        ) : (
          <Text
            style={[
              styles.iconCharText,
              charColor ? { color: charColor } : { color: COLORS.ink },
            ]}
          >
            {iconChar}
          </Text>
        )}
      </View>

      {/* Question Text */}
      <Text style={styles.questionText}>
        {question}
      </Text>

      {/* Right Chevron */}
      <View style={styles.chevronWrapper}>
        <Icon name="chevron" size={22} color={COLORS.ink} strokeWidth={3} />
      </View>
    </HardShadowBox>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    ...Platform.select({
      web: {
        boxSizing: 'border-box',
      },
    }),
  },
  cardContent: {
    minHeight: 104,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    ...Platform.select({
      web: {
        boxSizing: 'border-box',
      },
    }),
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: RADII.iconTile,
    borderWidth: 3,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconCharText: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  questionText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    color: COLORS.ink,
  },
  chevronWrapper: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
