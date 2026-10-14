export const colors = {
  // Backgrounds
  background: '#F8F9FA',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  surfaceSubtle: '#F3F4F6',
  sidebar: '#FAFAFA',

  // Black, Yellow, White Theme
  black: '#111827',
  blackPure: '#000000',
  charcoal: '#1F2937',
  yellow: '#FFC82C',
  yellowHover: '#EAB308',
  yellowLight: '#FEF9C3',
  yellowMuted: '#FFFBEB',
  yellowBorder: '#FDE047',
  yellowDark: '#854D0E',
  white: '#FFFFFF',

  // Semantic
  primary: '#111827',
  primaryYellow: '#FFC82C',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textLight: '#6B7280',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#111827',

  // Status
  onlineGreen: '#10B981',
  onlineGreenBg: '#ECFDF5',
  errorRed: '#EF4444',
  errorRedBg: '#FEF2F2',
  infoBlue: '#3B82F6',
  infoBlueBg: '#EFF6FF',
};

export const theme = {
  colors,
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    hover: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
};

export default theme;
