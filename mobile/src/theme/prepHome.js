import { Platform } from 'react-native';

export const COLORS = {
  bg: '#0B3C49',
  surface: '#11505F',
  border: '#2C6573',
  text: '#F6F1E4',
  muted: '#9CC3CC',
  cream: '#F6E7C8',
  ink: '#0B2F3A',
  orange: '#FF7A3D',
  halo: 'rgba(255, 122, 61, 0.55)',
  tags: {
    mint: '#9FE0C4',
    yellow: '#FFD166',
    sky: '#8EC9FF',
    pink: '#FF9EB5',
  },
};

export const FONTS = {
  fraunces: {
    semiBold: Platform.select({
      web: "'Fraunces', Georgia, serif",
      default: 'Fraunces_600SemiBold',
    }),
    bold: Platform.select({
      web: "'Fraunces', Georgia, serif",
      default: 'Fraunces_700Bold',
    }),
  },
  dmSans: {
    regular: Platform.select({
      web: "'DM Sans', sans-serif",
      default: 'DMSans_400Regular',
    }),
    medium: Platform.select({
      web: "'DM Sans', sans-serif",
      default: 'DMSans_500Medium',
    }),
    semiBold: Platform.select({
      web: "'DM Sans', sans-serif",
      default: 'DMSans_600SemiBold',
    }),
    bold: Platform.select({
      web: "'DM Sans', sans-serif",
      default: 'DMSans_700Bold',
    }),
  },
};

export const SPACING = {
  frameWidth: 390,
  frameHeight: 844,
  maxWebWidth: 430,
  cardWidth: 232,
  cardHeight: 252,
  cardGap: 12,
  cardRadius: 26,
};
