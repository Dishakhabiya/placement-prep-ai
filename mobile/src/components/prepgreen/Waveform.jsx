import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function Waveform({ barHeights, color = '#FF5B3A' }) {
  // 28 bars
  const bars = barHeights || Array.from({ length: 28 }, () => 6);

  return (
    <View style={styles.container} aria-hidden={true}>
      {bars.map((h, i) => (
        <View
          key={`bar-${i}`}
          style={[
            styles.bar,
            {
              height: Math.max(6, Math.min(50, h)),
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 5,
    borderRadius: 3,
  },
});
