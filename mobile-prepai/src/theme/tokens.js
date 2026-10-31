import { Platform } from 'react-native';

export const LIGHT_THEME = {
  isDark: false,
  bg: '#FAF3E7',
  ink: '#0A3B4A',
  heroBg: '#0A3B4A',
  eyebrowTeal: '#9CEBD8',
  streakBg: '#FDD962',
  card: '#FFFFFF',
  soft: '#F3E4C6',
  muted: '#4F7480',
  line: 'rgba(10, 59, 74, 0.12)',
  orange: '#FE6F2B',
  peachBlob: '#FDC6A8',
  mintBlob: '#DCEFDC',
};

export const DARK_THEME = {
  isDark: true,
  bg: '#082C38',
  ink: '#F7E6C8',
  heroBg: '#05222C',
  eyebrowTeal: '#9CEBD8',
  streakBg: '#FDD962',
  card: '#0F4655',
  soft: '#14586A',
  muted: '#9BC0C7',
  line: 'rgba(247, 230, 200, 0.15)',
  orange: '#FE6F2B',
  peachBlob: '#2A3038',
  mintBlob: '#153630',
};

export const FONTS = {
  headingBlack: Platform.select({
    web: "'Fraunces', Georgia, serif",
    default: 'Fraunces_900Black',
  }),
  headingBold: Platform.select({
    web: "'Fraunces', Georgia, serif",
    default: 'Fraunces_700Bold',
  }),
  bodyRegular: Platform.select({
    web: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    default: 'DMSans_400Regular',
  }),
  bodyMedium: Platform.select({
    web: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    default: 'DMSans_500Medium',
  }),
  bodyBold: Platform.select({
    web: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    default: 'DMSans_700Bold',
  }),
};

export const RADII = {
  hero: 34,
  card: 28,
  pill: 999,
  badge: 999,
  iconBox: 16,
};
