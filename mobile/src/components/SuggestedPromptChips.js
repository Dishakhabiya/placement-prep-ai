import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function SuggestedPromptChips({ actions = [], onSelectAction }) {
  if (!actions || actions.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((action, idx) => (
          <TouchableOpacity
            key={`action-${idx}-${action.title}`}
            style={styles.chip}
            onPress={() => onSelectAction(action)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipIcon}>⚡</Text>
            <Text style={styles.chipText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#854D0E',
  },
});
