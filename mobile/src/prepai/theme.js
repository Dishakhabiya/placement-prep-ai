import { Platform } from 'react-native';

export const COLORS = {
  bg: '#F8DBE4',
  panel: '#FDEEF3',
  surface: '#FFFFFF',
  ink: '#2B0F3D',
  muted: '#5B2A66',
  primary: '#6D4CF6',
  danger: '#7D2750', // send button
  accentMint: '#B8F0D8',
  accentYellow: '#FBE38A',
  accentBlue: '#A9D6FF',
  accentSalmon: '#F4B4A3',
  tie: '#E04B7A',
  cheek: '#F9A8D4',
  online: '#2F9E6B',
};

export const FONTS = {
  nunito: {
    medium: Platform.select({
      web: "'Nunito', Arial, sans-serif",
      default: 'Nunito_500Medium',
    }),
    bold: Platform.select({
      web: "'Nunito', Arial, sans-serif",
      default: 'Nunito_700Bold',
    }),
    extraBold: Platform.select({
      web: "'Nunito', Arial, sans-serif",
      default: 'Nunito_800ExtraBold',
    }),
  },
};

export const BORDER = {
  width: 3,
  color: COLORS.ink,
  solid: `${3}px solid ${COLORS.ink}`,
};

export const RADII = {
  card: 24,
  bubble: 28,
  pill: 999,
  iconTile: 14,
  button: 16,
};

export const SHADOWS = {
  card: {
    offset: 5,
    web: `5px 5px 0 ${COLORS.ink}`,
    webHover: `8px 8px 0 ${COLORS.ink}`,
  },
  bubble: {
    offset: 6,
    web: `6px 6px 0 ${COLORS.ink}`,
  },
  button: {
    offset: 4,
    web: `4px 4px 0 ${COLORS.ink}`,
  },
};
