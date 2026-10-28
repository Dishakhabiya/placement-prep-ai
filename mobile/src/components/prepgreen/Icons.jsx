import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function HistoryIcon({ size = 20, color = 'currentColor', strokeWidth = 2.3 }) {
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
      aria-hidden={true}
    >
      <Path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 8v4l3 2" />
    </Svg>
  );
}

export function ShuffleIcon({ size = 22, color = 'currentColor', strokeWidth = 2.3 }) {
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
      aria-hidden={true}
    >
      <Path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4" />
    </Svg>
  );
}

export function MicIcon({ size = 30, color = 'currentColor', strokeWidth = 2.3 }) {
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
      aria-hidden={true}
    >
      <Rect x={9} y={3} width={6} height={12} rx={3} />
      <Path d="M5 11a7 7 0 0014 0M12 18v3" />
    </Svg>
  );
}

export function SkipIcon({ size = 22, color = 'currentColor', strokeWidth = 2.3 }) {
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
      aria-hidden={true}
    >
      <Path d="M5 4l10 8-10 8z" />
      <Path d="M19 5v14" />
    </Svg>
  );
}

export function StopIcon({ size = 20, color = 'currentColor' }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden={true}
    >
      <Rect x={5} y={5} width={14} height={14} rx={3} />
    </Svg>
  );
}

export function PlayTriangleIcon({ size = 14, color = 'currentColor' }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden={true}
    >
      <Path d="M8 5l11 7-11 7z" />
    </Svg>
  );
}

export function ArrowUpIcon({ size = 20, color = 'currentColor', strokeWidth = 2.5 }) {
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
      aria-hidden={true}
    >
      <Path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  );
}
