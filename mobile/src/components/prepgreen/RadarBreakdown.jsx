import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, { Polygon, Path, Circle, Text as SvgText, G } from 'react-native-svg';
import { FONTS } from '../../theme/prepGreen';

export default function RadarBreakdown({
  clarity = 80,
  structure = 75,
  confidence = 82,
  relevance = 85,
  colors,
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;

    const startAnim = (reduceMotion) => {
      if (isCancelled) return;
      if (reduceMotion) {
        anim.setValue(1);
        return;
      }

      const useNative = Platform.OS !== 'web';
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.2, 0.9, 0.3, 1),
          useNativeDriver: useNative,
        }),
      ]).start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((rm) => startAnim(rm))
        .catch(() => startAnim(false));
    } else {
      startAnim(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [anim]);

  const cx = 110;
  const cy = 95;
  const R = 46;

  // Score to radius mapping: (score - 30) / 70 * R
  const k = (val) => {
    const clamped = Math.max(30, Math.min(100, val || 70));
    return ((clamped - 30) / 70) * R;
  };

  const cR = k(clarity);
  const sR = k(structure);
  const confR = k(confidence);
  const relR = k(relevance);

  const pts = [
    [cx, cy - cR], // Clarity (top)
    [cx + sR, cy], // Structure (right)
    [cx, cy + confR], // Confidence (bottom)
    [cx - relR, cy], // Relevance (left)
  ];

  const polygonPointsStr = pts.map((p) => `${p[0]},${p[1]}`).join(' ');

  // Lowest axis recommendation
  const axes = [
    { name: 'clarity', score: Math.round(clarity) },
    { name: 'structure', score: Math.round(structure) },
    { name: 'confidence', score: Math.round(confidence) },
    { name: 'relevance', score: Math.round(relevance) },
  ];
  axes.sort((a, b) => a.score - b.score);
  const lowest = axes[0];

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 1],
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.soft }]}>
      <Text style={[styles.headerTitle, { color: colors.ink }]}>
        Score breakdown
      </Text>

      <View style={styles.chartWrapper}>
        <Svg
          width="100%"
          height={190}
          viewBox="0 0 220 190"
          role="img"
          aria-label="Score breakdown chart"
          style={{ overflow: 'visible' }}
        >
          {/* Diamond Grids at 33%, 66%, 100% */}
          {[0.33, 0.66, 1].map((f) => {
            const r = R * f;
            const diamondPoints = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
            return (
              <Polygon
                key={`grid-${f}`}
                points={diamondPoints}
                fill="none"
                stroke={colors.mute}
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            );
          })}

          {/* Axis lines */}
          <Path
            d={`M${cx} ${cy - R}V${cy + R}M${cx - R} ${cy}H${cx + R}`}
            stroke={colors.mute}
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          {/* Animated Polygon & Vertex Dots */}
          <G>
            <Polygon
              points={polygonPointsStr}
              fill={colors.tomato}
              fillOpacity={0.35}
              stroke={colors.tomato}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {pts.map((p, idx) => (
              <Circle
                key={`dot-${idx}`}
                cx={p[0]}
                cy={p[1]}
                r={4}
                fill={colors.ink}
              />
            ))}
          </G>

          {/* Axis Labels: Clarity (top), Structure (right), Confidence (bottom), Relevance (left) */}
          <SvgText
            x={110}
            y={20}
            textAnchor="middle"
            fill={colors.mute}
            fontSize={12}
            fontFamily="Outfit, sans-serif"
            fontWeight="600"
          >
            Clarity
          </SvgText>
          <SvgText
            x={170}
            y={99}
            textAnchor="start"
            fill={colors.mute}
            fontSize={12}
            fontFamily="Outfit, sans-serif"
            fontWeight="600"
          >
            Structure
          </SvgText>
          <SvgText
            x={110}
            y={182}
            textAnchor="middle"
            fill={colors.mute}
            fontSize={12}
            fontFamily="Outfit, sans-serif"
            fontWeight="600"
          >
            Confidence
          </SvgText>
          <SvgText
            x={50}
            y={99}
            textAnchor="end"
            fill={colors.mute}
            fontSize={12}
            fontFamily="Outfit, sans-serif"
            fontWeight="600"
          >
            Relevance
          </SvgText>
        </Svg>
      </View>

      {/* Tip below chart */}
      <Text style={[styles.tipText, { color: colors.ink }]}>
        Work on {lowest.name} next ({lowest.score} out of 100).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  chartWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 6,
  },
});
