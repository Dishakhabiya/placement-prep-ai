import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

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
  badge: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: -2,
  },
  // Variant styles
  matchedContainer: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  matchedText: {
    color: '#065F46',
  },
  missingContainer: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  missingText: {
    color: '#854D0E',
  },
  extraContainer: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  extraText: {
    color: '#1E40AF',
  },
  neutralContainer: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  neutralText: {
    color: '#1F2937',
  },
});
