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
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';

export default function TopBar({ navigation }) {
  const { colors, fonts } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 720;

  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const streakCount = useUiStore((s) => s.streakCount);

  // Logo hopping dot animation
  const dotHopAnim = useRef(new Animated.Value(0)).current;
  // Streak pulsing orange dot animation
  const streakPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isCancelled = false;

    const startAnimations = async () => {
      let isReduceMotion = false;
      try {
        isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch (e) {}

      if (isCancelled || isReduceMotion) return;

      // 1. Logo dot hop loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotHopAnim, {
            toValue: -7,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(dotHopAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.delay(1400),
        ])
      ).start();

      // 2. Streak dot pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(streakPulseAnim, {
            toValue: 1.45,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(streakPulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    };

    startAnimations();

    return () => {
      isCancelled = true;
    };
  }, [dotHopAnim, streakPulseAnim]);

  const handleTabPress = (tabName) => {
    setActiveTab(tabName);
    if (navigation) {
      if (tabName === 'Practise') navigation.navigate('Home');
      else if (tabName === 'History') navigation.navigate('History');
      else if (tabName === 'Saved') navigation.navigate('Saved');
    }
  };

  const tabs = ['Practise', 'History', 'Saved'];

  return (
    <View style={styles.headerWrapper}>
      {/* Top Row: Logo (Left) and Pill Tabs (Right) */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => handleTabPress('Practise')}
          accessibilityRole="button"
          accessibilityLabel="PrepAI Home"
          style={styles.logoRow}
          activeOpacity={0.8}
        >
          <Text style={[styles.logoText, { color: colors.ink, fontFamily: fonts.headingBlack }]}>
            PrepAI
          </Text>
          <Animated.View
            style={[
              styles.orangeDot,
              {
                backgroundColor: colors.orange,
                transform: [{ translateY: dotHopAnim }],
              },
            ]}
          />
        </TouchableOpacity>

        {/* Right: Pill Tabs Container */}
        <View style={[styles.tabsWhitePill, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabPress(tab)}
                accessibilityRole="button"
                accessibilityLabel={tab}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.tabBtn,
                  isActive
                    ? { backgroundColor: colors.ink }
                    : { backgroundColor: 'transparent' },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      fontFamily: fonts.bodyBold,
                      color: isActive ? '#FFFFFF' : colors.ink,
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Row Below: 3-day Streak Badge under logo on the left */}
      <View style={styles.streakRow}>
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.streakBg },
          ]}
          accessibilityLabel={`${streakCount}-day streak`}
        >
          {/* Vector SVG flame icon - strictly no unicode emoji */}
          <Animated.View style={{ transform: [{ scale: streakPulseAnim }] }}>
            <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2.5c.6 2.8 2.3 4.8 4.2 7 1.8 2.2 2.8 4.6 2.8 7.5a7 7 0 11-14 0c0-3.2 1.8-6.1 4.2-8.5.9-.9 2-2.4 2.8-6z"
                fill={colors.orange}
              />
            </Svg>
          </Animated.View>
          <Text
            style={[
              styles.streakText,
              { color: colors.ink, fontFamily: fonts.bodyBold },
            ]}
          >
            {streakCount}-day streak
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    zIndex: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  orangeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: 3,
    marginBottom: 8,
  },
  tabsWhitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    borderRadius: 999,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(11, 59, 74, 0.06)',
      },
      default: {
        elevation: 3,
      },
    }),
  },
  tabBtn: {
    minHeight: 40,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  streakRow: {
    marginTop: 8,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
