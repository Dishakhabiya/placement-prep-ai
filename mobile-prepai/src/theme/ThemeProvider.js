import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT_THEME, DARK_THEME, FONTS, RADII } from './tokens';

const ThemeContext = createContext({
  theme: LIGHT_THEME,
  colors: LIGHT_THEME,
  fonts: FONTS,
  radii: RADII,
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  themeMode: 'system',
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'system' | 'light' | 'dark'

  const effectiveIsDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

  const theme = effectiveIsDark ? DARK_THEME : LIGHT_THEME;

  const toggleTheme = () => {
    setThemeMode((prev) => {
      if (prev === 'system') return effectiveIsDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: theme,
        fonts: FONTS,
        radii: RADII,
        isDark: effectiveIsDark,
        toggleTheme,
        setThemeMode,
        themeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
