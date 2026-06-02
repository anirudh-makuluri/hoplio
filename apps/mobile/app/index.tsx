import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUser } from './providers';
import { router, SplashScreen } from 'expo-router';
import { useTheme } from '~/lib/themeContext';

SplashScreen.preventAutoHideAsync();

export default function Index() {
	const { user, isLoading } = useUser();
	const { colors } = useTheme();

	useEffect(() => {
		if (isLoading) return;
		if (user) {
			router.replace('/home');
		} else {
			router.replace('/auth');
		}
		SplashScreen.hideAsync();
	}, [user, isLoading]);

	const navigateToNextPage = () => {
		if (user) return;
		router.push('/auth');
	};

	if (isLoading) return null;

	return (
		<View style={[styles.gradient, { backgroundColor: colors.primary }]}>
			<View style={styles.content}>
				<View style={styles.logoRing}>
					<Text style={styles.logoEmoji}>💬</Text>
				</View>
				<Text style={styles.title}>Hoplio</Text>
				<Text style={styles.subtitle}>
					Connect, collaborate, and chat effortlessly with your friends and teams.
				</Text>
				<Pressable
					onPress={navigateToNextPage}
					style={({ pressed }) => [
						styles.cta,
						pressed && styles.ctaPressed,
					]}
				>
					<Text style={[styles.ctaText, { color: colors.primary }]}>Get Started</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	gradient: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	content: {
		alignItems: 'center',
		paddingHorizontal: 32,
		maxWidth: 340,
	},
	logoRing: {
		width: 96,
		height: 96,
		borderRadius: 48,
		backgroundColor: 'rgba(255,255,255,0.2)',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 24,
	},
	logoEmoji: {
		fontSize: 48,
	},
	title: {
		fontSize: 36,
		fontWeight: '700',
		color: '#ffffff',
		marginBottom: 12,
		letterSpacing: -0.5,
	},
	subtitle: {
		fontSize: 16,
		color: 'rgba(255,255,255,0.9)',
		textAlign: 'center',
		lineHeight: 24,
		marginBottom: 40,
	},
	cta: {
		backgroundColor: '#ffffff',
		paddingVertical: 16,
		paddingHorizontal: 32,
		borderRadius: 14,
		minWidth: 200,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 4,
	},
	ctaPressed: {
		opacity: 0.9,
	},
	ctaText: {
		fontSize: 17,
		fontWeight: '600',
	},
});
