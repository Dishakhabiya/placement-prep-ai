import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { COLORS } from '../theme';

export default function Icon({
  name,
  size = 24,
  color = COLORS.ink,
  strokeWidth = 2.5,
  style,
}) {
  switch (name) {
    case 'plus':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={style}
          aria-hidden="true"
        >
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      );

    case 'history':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={style}
          aria-hidden="true"
        >
          <Path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
        </Svg>
      );

    case 'chevron':
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
          style={style}
          aria-hidden="true"
        >
          <Path d="M9 5l7 7-7 7" />
        </Svg>
      );

    case 'mic':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={style}
          aria-hidden="true"
        >
          <Rect x="9" y="3" width="6" height="11" rx="3" fill={color} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </Svg>
      );

    case 'arrowUp':
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
          style={style}
          aria-hidden="true"
        >
          <Path d="M12 19V5M5 12l7-7 7 7" />
        </Svg>
      );

    case 'user':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={style}
          aria-hidden="true"
        >
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
        </Svg>
      );

    case 'bolt':
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
          style={style}
          aria-hidden="true"
        >
          <Path d="M13 3L5 14h6l-1 7 8-11h-6z" />
        </Svg>
      );

    case 'doc':
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
          style={style}
          aria-hidden="true"
        >
          <Path d="M6 3h8l4 4v14H6zM14 3v4h4" />
        </Svg>
      );

    case 'figure':
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
          style={style}
          aria-hidden="true"
        >
          <Circle cx="12" cy="5" r="2.5" />
          <Path d="M12 8v7M7 10l5-2 5 2M9 21l3-6 3 6" />
        </Svg>
      );

    default:
      return null;
  }
}
