import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';
import MascotSvg from './MascotSvg';
import Waveform from './Waveform';
import MicButton from './MicButton';
import InputBar from './InputBar';

const H1_LINES = [
  ['What', 'shall', 'we'],
  ['practise', 'today?'],
];

export default function HeroPanel({ entranceDelay = 120 }) {
  const { colors, fonts, radii } = useTheme();
  const { width } = useWindowDimensions();
  const isListening = useUiStore((s) => s.isListening);

  const h1FontSize = width >= 1200 ? 56 : width >= 940 ? 48 : width >= 520 ? 42 : 36;
  const isMobile = width < 680;

  // Word entrance animations
  const wordAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  const heroEntranceAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={[
        styles.heroContainer,
        {
          backgroundColor: colors.heroBg,
          borderRadius: radii.hero,
        },
      ]}
    >
      {/* Top Section: Eyebrow + H1 (Left) and Mascot (Right) */}
      <View style={[styles.topSection, isMobile && styles.topSectionMobile]}>
        <View style={styles.titleColumn}>
          {/* Eyebrow in minty cyan-teal */}
          <Text
            style={[
              styles.eyebrow,
              { color: colors.eyebrowTeal, fontFamily: fonts.bodyBold },
            ]}
          >
            YOUR INTERVIEW COACH
          </Text>

          {/* H1 Title: What shall we practise today? */}
          <Text
            style={[
              styles.h1Text,
              {
                color: '#FFFDF8',
                fontFamily: fonts.headingBlack,
                fontSize: h1FontSize,
                lineHeight: h1FontSize * 1.14,
              },
            ]}
          >
            What shall we{'\n'}practise today?
          </Text>
        </View>

        {/* Mascot top-right matching Screenshot 1 */}
        <View style={styles.mascotHolder}>
          <MascotSvg size={isMobile ? 104 : 124} />
        </View>
      </View>

      {/* Bottom Area: Orange Waveform + MicButton + InputBar */}
      <View style={styles.bottomArea}>
        <Waveform isListening={isListening} />
        <MicButton />
        <InputBar />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    minHeight: 560,
    padding: 38,
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxSizing: 'border-box',
        boxShadow: '0 20px 48px rgba(7, 50, 63, 0.22)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
  },
  topSectionMobile: {
    flexDirection: 'column-reverse',
    alignItems: 'center',
    gap: 16,
  },
  titleColumn: {
    flex: 1,
    maxWidth: '82%',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  h1LinesContainer: {
    flexDirection: 'column',
  },
  h1LineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  wordBox: {
    marginRight: 10,
    marginBottom: 2,
  },
  h1Text: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  mascotHolder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
