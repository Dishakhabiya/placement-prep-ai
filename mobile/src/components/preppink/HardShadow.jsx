import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/prepPink';

export default function HardShadow({
  children,
  offset = { x: 4, y: 4 },
  borderRadius = 20,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomRightRadius,
  borderBottomLeftRadius,
  style,
  shadowColor = COLORS.ink,
}) {
  const radiusStyles = {
    borderRadius: borderRadius,
    ...(borderTopLeftRadius !== undefined && { borderTopLeftRadius }),
    ...(borderTopRightRadius !== undefined && { borderTopRightRadius }),
    ...(borderBottomRightRadius !== undefined && { borderBottomRightRadius }),
    ...(borderBottomLeftRadius !== undefined && { borderBottomLeftRadius }),
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingRight: offset.x,
          paddingBottom: offset.y,
        },
        style,
      ]}
    >
      {/* Background Hard Offset Shadow */}
      <View
        pointerEvents="none"
        style={[
          styles.shadowLayer,
          {
            top: offset.y,
            left: offset.x,
            backgroundColor: shadowColor,
          },
          radiusStyles,
        ]}
      />

      {/* Foreground Real Content */}
      <View style={[styles.frontContent, radiusStyles]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowLayer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  frontContent: {
    position: 'relative',
    zIndex: 1,
  },
});
