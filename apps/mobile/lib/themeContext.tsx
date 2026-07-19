import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeColors = {
	background: string;
	surface: string;
	surfaceElevated: string;
	text: string;
	textSecondary: string;
	border: string;
	primary: string;
	primaryDark: string;
	primaryForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	destructiveForeground: string;
	success: string;
	warning: string;
	ai: string;
	aiSoft: string;
	muted: string;
	ring: string;
	bubbleSelf: string;
	bubbleOther: string;
	bubbleAI: string;
};

export type ThemeRadii = {
	sm: number;
	md: number;
	lg: number;
	xl: number;
	full: number;
	button: number;
	card: number;
};

/** Duolingo-inspired fun palette */
const LIGHT: ThemeColors = {
	background: '#F7F7F7',
	surface: '#FFFFFF',
	surfaceElevated: '#FFFFFF',
	text: '#3C3C3C',
	textSecondary: '#777777',
	border: '#E5E5E5',
	primary: '#58CC02',
	primaryDark: '#46A302',
	primaryForeground: '#FFFFFF',
	accent: '#FFC800',
	accentForeground: '#3C3C3C',
	destructive: '#FF4B4B',
	destructiveForeground: '#FFFFFF',
	success: '#58CC02',
	warning: '#FFC800',
	ai: '#CE82FF',
	aiSoft: '#F3E8FF',
	muted: '#F0F0F0',
	ring: '#58CC02',
	bubbleSelf: '#58CC02',
	bubbleOther: '#E8E8E8',
	bubbleAI: '#F3E8FF',
};

const DARK: ThemeColors = {
	background: '#131F24',
	surface: '#1A2C33',
	surfaceElevated: '#243B44',
	text: '#F0F0F0',
	textSecondary: '#A0A0A0',
	border: '#2E4550',
	primary: '#58CC02',
	primaryDark: '#46A302',
	primaryForeground: '#FFFFFF',
	accent: '#FFC800',
	accentForeground: '#131F24',
	destructive: '#FF4B4B',
	destructiveForeground: '#FFFFFF',
	success: '#58CC02',
	warning: '#FFC800',
	ai: '#CE82FF',
	aiSoft: 'rgba(206, 130, 255, 0.18)',
	muted: '#1A2C33',
	ring: '#58CC02',
	bubbleSelf: '#46A302',
	bubbleOther: '#243B44',
	bubbleAI: 'rgba(206, 130, 255, 0.22)',
};

export const RADII: ThemeRadii = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	full: 999,
	button: 16,
	card: 16,
};

/** Shared 3D lip height for chunky controls */
export const LIP_HEIGHT = 4;

type ThemeContextType = {
	isDark: boolean;
	toggleTheme: () => void;
	colors: ThemeColors;
	radii: ThemeRadii;
};

const ThemeContext = createContext<ThemeContextType>({
	isDark: false,
	toggleTheme: () => {},
	colors: LIGHT,
	radii: RADII,
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
		<ThemeContext.Provider value={{ isDark, toggleTheme, colors, radii: RADII }}>
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
