import { Platform } from 'react-native';

export const LIGHT_COLORS = {
  bg: '#DDE8D5',
  card: '#FFFFFF',
  ink: '#1B2E1F',
  mute: '#46594A',
  tomato: '#FF5B3A',
  tomatoInk: '#1B2E1F',
  cup: '#1B2E1F',
  pad: '#3C5A42',
  soft: '#EEF4EA',
  micHalo: 'rgba(255, 91, 58, 0.5)',
};

export const DARK_COLORS = {
  bg: '#121C16',
  card: '#1D2B22',
  ink: '#E9F1E5',
  mute: '#A9BCAB',
  tomato: '#FF6B4A',
  tomatoInk: '#121C16',
  cup: '#2E4636',
  pad: '#587A60',
  soft: '#26372D',
  micHalo: 'rgba(255, 107, 74, 0.5)',
};

export const BADGE_COLORS = {
  Q1: '#FFD166',
  Q2: '#A9D6FF',
  Q3: '#FFB3A3',
  Q: '#B9E4C9',
  badgeText: '#1B2E1F',
};

export const FONTS = {
  outfit: {
    medium: Platform.select({
      web: "'Outfit', sans-serif",
      default: 'Outfit_500Medium',
    }),
    semiBold: Platform.select({
      web: "'Outfit', sans-serif",
      default: 'Outfit_600SemiBold',
    }),
    bold: Platform.select({
      web: "'Outfit', sans-serif",
      default: 'Outfit_700Bold',
    }),
    extraBold: Platform.select({
      web: "'Outfit', sans-serif",
      default: 'Outfit_800ExtraBold',
    }),
  },
};

export const RADII = {
  card: 26,
  row: 16,
  input: 27,
};

export const SPACING = {
  frameWidth: 390,
  frameHeight: 844,
  maxWebWidth: 430,
};
