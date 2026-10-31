import React, { useState } from 'react';
import { Text, Pressable, Platform, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII } from '../theme';
import Icon from './Icon';

export default function Chip({ iconName, label, onPress, style }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          transform: [
            { translateY: isHovered ? -2 : 0 },
            { translateX: isHovered ? -2 : 0 },
          ],
          ...Platform.select({
            web: {
              boxShadow: isHovered ? `4px 4px 0 ${COLORS.ink}` : `0px 0px 0 transparent`,
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
              cursor: 'pointer',
            },
          }),
        },
        style,
      ]}
    >
      <Icon name={iconName} size={18} color={COLORS.ink} strokeWidth={2.5} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: RADII.pill,
    borderWidth: 3,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
});
