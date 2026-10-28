import { Platform } from 'react-native';

export const COLORS = {
  bg: '#FFD9E2',
  ink: '#2A1033',
  violet: '#7B5CFF',
  rose: '#E8326B',
  muted: '#5A2D63',
  white: '#FFFFFF',
  chipBg: '#FFF3F6',
  online: '#1FA971',
  cheek: '#FFB3C7',
  tiles: {
    mint: '#A8F0D1',
    yellow: '#FFE27A',
    sky: '#9ED8FF',
    peach: '#FFB59E',
  },
  micRing: 'rgba(123, 92, 255, 0.55)',
};

export const FONTS = {
  poppins: {
    medium: Platform.select({
      web: "'Poppins', sans-serif",
      default: 'Poppins_500Medium',
    }),
    semiBold: Platform.select({
      web: "'Poppins', sans-serif",
      default: 'Poppins_600SemiBold',
    }),
    bold: Platform.select({
      web: "'Poppins', sans-serif",
      default: 'Poppins_700Bold',
    }),
  },
};

export const SPACING = {
  frameWidth: 390,
  frameHeight: 844,
  maxWebWidth: 430,
};
