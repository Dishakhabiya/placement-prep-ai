import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Text,
  View,
  Platform,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';

export default function Toast() {
  const { colors, fonts } = useTheme();
  const toast = useUiStore((s) => s.toast);
  const hideToast = useUiStore((s) => s.hideToast);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;

    let isCancelled = false;

    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    const timer = setTimeout(() => {
      if (isCancelled) return;
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        if (!isCancelled) hideToast();
      });
    }, 2300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [toast, anim, hideToast]);

  if (!toast) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.toastContainer,
          {
            backgroundColor: colors.ink,
            borderColor: colors.soft,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.orange }]} />
        <Text
          style={[
            styles.toastText,
            { color: colors.bg, fontFamily: fonts.bodyBold },
          ]}
          numberOfLines={2}
        >
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    maxWidth: 580,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px rgba(11, 59, 74, 0.28)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    flexShrink: 0,
  },
  toastText: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});
