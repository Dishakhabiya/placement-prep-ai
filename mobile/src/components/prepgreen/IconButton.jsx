import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../../theme/prepGreen';
import {
  HistoryIcon,
  ShuffleIcon,
  MicIcon,
  SkipIcon,
  StopIcon,
  ArrowUpIcon,
} from './Icons';

// Trigger haptic helper
export const triggerHaptic = (type = 'light') => {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

// Generic Pressable wrapper that scales to 0.94 on active press
function PressableScale({ children, onPress, style, accessibilityLabel, accessibilityRole = 'button', disabled = false }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: Platform.OS !== 'web',
      speed: 20,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function HeaderHistoryBtn({ onPress, colors }) {
  return (
    <PressableScale
      onPress={() => {
        triggerHaptic('light');
        onPress();
      }}
      accessibilityLabel="Chat history"
      style={[styles.historyBtn, { borderColor: colors.ink }]}
    >
      <HistoryIcon size={20} color={colors.ink} strokeWidth={2.3} />
    </PressableScale>
  );
}

export function SurpriseBtn({ onPress, colors, isRolling = false }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRolling) {
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => rotateAnim.setValue(0));
    }
  }, [isRolling, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.ctlCol}>
      <PressableScale
        onPress={() => {
          triggerHaptic('light');
          onPress();
        }}
        accessibilityLabel="Surprise me"
        style={[styles.ringBtn, { borderColor: colors.ink }]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <ShuffleIcon size={22} color={colors.ink} strokeWidth={2.3} />
        </Animated.View>
      </PressableScale>
      <Text style={[styles.ctlLabel, { color: colors.mute }]}>Surprise me</Text>
    </View>
  );
}

export function MicAnswerBtn({ onPress, colors }) {
  const haloScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    let isCancelled = false;
    let haloLoop = null;

    const startHalo = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';
      haloLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1.5,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      haloLoop.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startHalo(enabled);
        })
        .catch(() => {
          if (!isCancelled) startHalo(false);
        });
    } else {
      startHalo(false);
    }

    return () => {
      isCancelled = true;
      if (haloLoop) haloLoop.stop();
    };
  }, [haloOpacity, haloScale]);

  return (
    <View style={styles.ctlCol}>
      <View style={styles.micWrapper}>
        {/* Pulsing halo ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.micHalo,
            {
              backgroundColor: colors.micHalo,
              transform: [{ scale: haloScale }],
              opacity: haloOpacity,
            },
          ]}
        />
        <PressableScale
          onPress={() => {
            triggerHaptic('light');
            onPress();
          }}
          accessibilityLabel="Tap to answer"
          style={[styles.micBtn, { backgroundColor: colors.tomato }]}
        >
          <MicIcon size={30} color={colors.tomatoInk} strokeWidth={2.3} />
        </PressableScale>
      </View>
      <Text style={[styles.ctlLabel, { color: colors.mute }]}>Tap to answer</Text>
    </View>
  );
}

export function SkipBtn({ onPress, colors }) {
  return (
    <View style={styles.ctlCol}>
      <PressableScale
        onPress={() => {
          triggerHaptic('light');
          onPress();
        }}
        accessibilityLabel="Skip"
        style={[styles.ringBtn, { borderColor: colors.ink }]}
      >
        <SkipIcon size={22} color={colors.ink} strokeWidth={2.3} />
      </PressableScale>
      <Text style={[styles.ctlLabel, { color: colors.mute }]}>Skip</Text>
    </View>
  );
}

export function StopAnswerBtn({ onPress, colors }) {
  return (
    <View style={styles.stopWrapper}>
      <PressableScale
        onPress={() => {
          triggerHaptic('medium');
          onPress();
        }}
        accessibilityLabel="Finish answer"
        style={[styles.stopBtn, { backgroundColor: colors.ink }]}
      >
        <StopIcon size={20} color={colors.card} />
      </PressableScale>
      <Text style={[styles.ctlLabel, { color: colors.mute }]}>Tap to finish</Text>
    </View>
  );
}

export function NextQuestionBtn({ onPress, colors, isWeb = false }) {
  return (
    <PressableScale
      onPress={() => {
        triggerHaptic('medium');
        onPress();
      }}
      accessibilityLabel="Next question"
      style={[
        styles.nextBtn,
        { backgroundColor: colors.ink },
        isWeb && styles.nextBtnWeb,
      ]}
    >
      <Text style={[styles.nextText, { color: colors.card }, isWeb && styles.nextTextWeb]}>
        Next question
      </Text>
    </PressableScale>
  );
}

export function ShareResultBtn({ onPress, colors, isWeb = false }) {
  return (
    <PressableScale
      onPress={() => {
        triggerHaptic('light');
        onPress();
      }}
      accessibilityLabel="Share result"
      style={[
        styles.shareBtn,
        { borderColor: colors.ink },
        isWeb && styles.shareBtnWeb,
      ]}
    >
      <Text style={[styles.shareText, { color: colors.ink }, isWeb && styles.shareTextWeb]}>
        Share result
      </Text>
    </PressableScale>
  );
}

export function SendBtn({ onPress, colors, disabled = false }) {
  return (
    <PressableScale
      onPress={() => {
        triggerHaptic('light');
        onPress();
      }}
      disabled={disabled}
      accessibilityLabel="Send"
      style={[styles.sendBtn, { backgroundColor: colors.ink }, disabled && styles.btnDisabled]}
    >
      <ArrowUpIcon size={20} color={colors.card} strokeWidth={2.5} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  ctlCol: {
    width: 88,
    alignItems: 'center',
    gap: 6,
  },
  ctlLabel: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  ringBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  micWrapper: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  micHalo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  micBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  stopWrapper: {
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  stopBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  nextBtn: {
    marginTop: 14,
    width: '100%',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  nextBtnWeb: {
    marginTop: 0,
    width: 'auto',
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
  },
  nextText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  nextTextWeb: {
    fontSize: 16,
  },
  shareBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  shareBtnWeb: {
    height: 50,
    paddingHorizontal: 26,
    borderRadius: 25,
  },
  shareText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  shareTextWeb: {
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  btnDisabled: {
    opacity: 0.45,
    ...Platform.select({ web: { cursor: 'default' } }),
  },
});
