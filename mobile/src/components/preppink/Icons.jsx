import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function HistoryIcon({ size = 20, color = '#2A1033', strokeWidth = 2.5 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole="image"
      aria-hidden={true}
    >
      <Path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 8v4l3 2" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 20, color = '#2A1033', strokeWidth = 2.5 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole="image"
      aria-hidden={true}
    >
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function MicIcon({ size = 24, color = '#FFFFFF', strokeWidth = 2.5 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole="image"
      aria-hidden={true}
    >
      <Rect x={9} y={3} width={6} height={12} rx={3} />
      <Path d="M5 11a7 7 0 0014 0M12 18v3" />
    </Svg>
  );
}

export function ArrowUpIcon({ size = 22, color = '#FFFFFF', strokeWidth = 2.5 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole="image"
      aria-hidden={true}
    >
      <Path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  );
}
