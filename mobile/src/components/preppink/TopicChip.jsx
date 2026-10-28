import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS, FONTS } from '../../theme/prepPink';

export default function TopicChip({ label, cleanTopic, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress && onPress(cleanTopic || label)}
      accessibilityRole="button"
      accessibilityLabel={cleanTopic || label}
      style={styles.chip}
    >
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      },
    }),
  },
  chipText: {
    fontFamily: FONTS.poppins.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
});
