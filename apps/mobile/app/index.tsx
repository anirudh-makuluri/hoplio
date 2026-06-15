import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, SplashScreen } from 'expo-router';
import { useUser } from './providers';
import BrandScreen from '~/components/BrandScreen';

SplashScreen.preventAutoHideAsync();

export default function Index() {
	const { user, isLoading } = useUser();

	useEffect(() => {
		if (isLoading) return;

		if (user) {
			router.replace('/home');
		} else {
			router.replace('/auth');
		}

		void SplashScreen.hideAsync();
	}, [isLoading, user]);

	const navigateToNextPage = () => {
		if (user) return;
		router.push('/auth');
	};

	if (isLoading) return null;

	return (
		<BrandScreen contentStyle={styles.screenContent}>
			<View style={styles.hero}>
				<View style={styles.badge}>
					<Text style={styles.badgeText}>Secure AI chat</Text>
				</View>
				<View style={styles.logoWrap}>
					<Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
				</View>
				<Text style={styles.wordmark}>hoplio</Text>
				<Text style={styles.title}>One connection. Everyone online.</Text>
				<Text style={styles.subtitle}>
					End-to-end encrypted messaging, AI assistance, semantic search, and scheduled delivery in one calm workspace.
				</Text>
				<View style={styles.featureRow}>
					<Text style={styles.featureChip}>Encrypted</Text>
					<Text style={styles.featureChip}>AI assistant</Text>
					<Text style={styles.featureChip}>Semantic search</Text>
				</View>
				<Pressable onPress={navigateToNextPage} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
					<Text style={styles.ctaText}>Get Started</Text>
				</Pressable>
			</View>
		</BrandScreen>
	);
}

const styles = StyleSheet.create({
	screenContent: {
		flex: 1,
		justifyContent: 'center',
	},
	hero: {
		alignItems: 'center',
	},
	badge: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 999,
		backgroundColor: 'rgba(34,211,238,0.12)',
		borderWidth: 1,
		borderColor: 'rgba(34,211,238,0.26)',
		marginBottom: 18,
	},
	badgeText: {
		color: '#67e8f9',
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	logoWrap: {
		width: 104,
		height: 104,
		borderRadius: 32,
		backgroundColor: 'rgba(15,23,42,0.45)',
		borderWidth: 1,
		borderColor: 'rgba(148,163,184,0.18)',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 24,
	},
	logo: {
		width: 84,
		height: 84,
	},
	wordmark: {
		fontSize: 18,
		fontWeight: '700',
		color: '#67e8f9',
		letterSpacing: 1.2,
		textTransform: 'lowercase',
		marginBottom: 12,
	},
	title: {
		fontSize: 38,
		fontWeight: '800',
		color: '#ffffff',
		marginBottom: 14,
		letterSpacing: -1,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 16,
		color: 'rgba(226,232,240,0.86)',
		textAlign: 'center',
		lineHeight: 24,
		marginBottom: 24,
		maxWidth: 340,
	},
	featureRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 34,
	},
	featureChip: {
		color: '#cbd5e1',
		fontSize: 12,
		fontWeight: '600',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		backgroundColor: 'rgba(15,23,42,0.48)',
		borderWidth: 1,
		borderColor: 'rgba(148,163,184,0.15)',
	},
	cta: {
		backgroundColor: '#22d3ee',
		paddingVertical: 17,
		paddingHorizontal: 32,
		borderRadius: 16,
		minWidth: 220,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.3,
		shadowRadius: 24,
		elevation: 10,
	},
	ctaPressed: {
		opacity: 0.92,
		transform: [{ scale: 0.99 }],
	},
	ctaText: {
		fontSize: 17,
		fontWeight: '700',
		color: '#082f49',
	},
});
