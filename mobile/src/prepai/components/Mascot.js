import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { COLORS } from '../theme';

export default function Mascot({ width, height, size = 120, style }) {
  const finalWidth = width || size;
  const finalHeight = height || Math.round(finalWidth * 1.2);

  return (
    <View style={[{ width: finalWidth, height: finalHeight }, style]}>
      <Svg
        width={finalWidth}
        height={finalHeight}
        viewBox="0 0 100 120"
        aria-hidden="true"
      >
        {/* Head */}
        <Rect
          x="10"
          y="8"
          width="80"
          height="84"
          rx="26"
          fill={COLORS.primary}
          stroke={COLORS.ink}
          strokeWidth={5}
        />

        {/* Eyes */}
        <Circle cx="36" cy="46" r="6" fill={COLORS.ink} />
        <Circle cx="64" cy="46" r="6" fill={COLORS.ink} />

        {/* Blush Cheeks */}
        <Circle cx="24" cy="62" r="7" fill={COLORS.cheek} />
        <Circle cx="76" cy="62" r="7" fill={COLORS.cheek} />

        {/* Smile */}
        <Path
          d="M38 66 Q50 80 62 66"
          stroke={COLORS.ink}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />

        {/* Pink Tie */}
        <Path
          d="M42 96 L58 96 L63 114 L37 114 Z"
          fill={COLORS.tie}
          stroke={COLORS.ink}
          strokeWidth={4}
        />
      </Svg>
    </View>
  );
}
