import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SkillChip({
  label,
  variant = 'neutral',
  onRemove,
  onPress,
  isRemovable = false,
}) {
  const getStyleForVariant = () => {
    switch (variant) {
      case 'matched':
        return {
          container: styles.matchedContainer,
          text: styles.matchedText,
          badge: '✓',
        };
      case 'missing':
        return {
          container: styles.missingContainer,
          text: styles.missingText,
          badge: '!',
        };
      case 'extra':
        return {
          container: styles.extraContainer,
          text: styles.extraText,
          badge: '+',
        };
      default:
        return {
          container: styles.neutralContainer,
          text: styles.neutralText,
          badge: null,
        };
    }
  };

  const { container, text, badge } = getStyleForVariant();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, container]}
    >
      {badge && <Text style={[styles.badge, text]}>{badge}</Text>}
      <Text style={[styles.chipText, text]}>{label}</Text>
      {isRemovable && onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removeBtn}
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 5,
  },
  removeBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  removeText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  neutralContainer: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  neutralText: {
    color: '#E2E8F0',
  },
  matchedContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  matchedText: {
    color: '#34D399',
  },
  missingContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  missingText: {
    color: '#F87171',
  },
  extraContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#6366F1',
  },
  extraText: {
    color: '#818CF8',
  },
});
