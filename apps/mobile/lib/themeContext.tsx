import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeColors = {
	background: string;
	surface: string;
	surfaceElevated: string;
	text: string;
	textSecondary: string;
	border: string;
	primary: string;
	primaryForeground: string;
	accent: string;
	destructive: string;
	muted: string;
	ring: string;
};

/** Blue theme palette aligned with website globals.css */
const LIGHT: ThemeColors = {
  background: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#f8fafc',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  accent: '#3b82f6',
  destructive: '#ef4444',
  muted: '#f1f5f9',
  ring: '#3b82f6',
};

const DARK: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceElevated: '#334155',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: '#334155',
  primary: '#3b82f6',
  primaryForeground: '#0f172a',
  accent: '#3b82f6',
  destructive: '#dc2626',
  muted: '#1e293b',
  ring: '#3b82f6',
};

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  colors: LIGHT,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme-preference');
      if (savedTheme === 'dark') {
        setIsDark(true);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem('theme-preference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
