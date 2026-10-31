import React, { useState } from 'react';
import { View, Pressable, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export default function HardShadowBox({
  children,
  offset = 5,
  radius = 24,
  borderWidth = 3,
  borderColor = COLORS.ink,
  backgroundColor = COLORS.surface,
  shadowColor = COLORS.ink,
  enableHover = false,
  onPress,
  style,
  contentStyle,
  accessibilityRole,
  accessibilityLabel,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const currentOffset = enableHover && isHovered ? offset + 3 : offset;
  const translateY = enableHover && isHovered ? -2 : 0;
  const translateX = enableHover && isHovered ? -2 : 0;

  if (Platform.OS === 'web') {
    const webStyle = {
      backgroundColor,
      borderRadius: radius,
      borderWidth,
      borderColor,
      boxShadow: `${currentOffset}px ${currentOffset}px 0 ${shadowColor}`,
      transform: [{ translateX }, { translateY }],
      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      cursor: onPress ? 'pointer' : 'default',
      boxSizing: 'border-box',
    };

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          onHoverIn={() => enableHover && setIsHovered(true)}
          onHoverOut={() => enableHover && setIsHovered(false)}
          accessibilityRole={accessibilityRole || 'button'}
          accessibilityLabel={accessibilityLabel}
          style={[webStyle, style, contentStyle]}
        >
          {children}
        </Pressable>
      );
    }

    return (
      <View style={[webStyle, style, contentStyle]}>
        {children}
      </View>
    );
  }

  // Native fallback: layered offset view
  const nativeShadow = (
    <View
      style={[
        styles.nativeShadowLayer,
        {
          borderRadius: radius,
          backgroundColor: shadowColor,
          top: currentOffset,
          left: currentOffset,
          right: -currentOffset,
          bottom: -currentOffset,
        },
      ]}
    />
  );

  const nativeContent = (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth,
          borderColor,
          backgroundColor,
          transform: [{ translateX }, { translateY }],
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole || 'button'}
        accessibilityLabel={accessibilityLabel}
        style={[styles.container, style]}
      >
        {nativeShadow}
        {nativeContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {nativeShadow}
      {nativeContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  nativeShadowLayer: {
    position: 'absolute',
    zIndex: 0,
  },
});
