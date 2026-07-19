import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, SplashScreen } from 'expo-router';
import { useUser } from './providers';
import BrandScreen from '~/components/BrandScreen';
import { AppButton } from '~/components/ui';
import { useTheme } from '~/lib/themeContext';
import { hapticMedium } from '~/lib/haptics';

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

		void SplashScreen.hideAsync();
	}, [isLoading, user]);

	const navigateToNextPage = () => {
		if (user) return;
		void hapticMedium();
		router.push('/auth');
	};

	if (isLoading) return null;

	return (
		<BrandScreen contentStyle={styles.screenContent}>
			<View style={styles.hero}>
				<View style={[styles.badge, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
					<Text style={[styles.badgeText, { color: colors.primaryDark }]}>Secure AI chat</Text>
				</View>
				<View style={[styles.logoWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
					<Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
				</View>
				<Text style={[styles.wordmark, { color: colors.primaryDark }]}>hoplio</Text>
				<Text style={[styles.title, { color: colors.text }]}>Chat that feels fun.</Text>
				<Text style={[styles.subtitle, { color: colors.textSecondary }]}>
					Encrypted messaging, AI help, and smart search — with a little extra bounce.
				</Text>
				<View style={styles.featureRow}>
					{['Encrypted', 'AI assistant', 'Semantic search'].map((label) => (
						<View
							key={label}
							style={[styles.featureChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
						>
							<Text style={[styles.featureChipText, { color: colors.text }]}>{label}</Text>
						</View>
					))}
				</View>
				<AppButton onPress={navigateToNextPage} fullWidth style={styles.cta}>
					Get Started
				</AppButton>
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
		borderWidth: 2,
		marginBottom: 18,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: '800',
		letterSpacing: 0.3,
	},
	logoWrap: {
		width: 104,
		height: 104,
		borderRadius: 28,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 20,
	},
	logo: {
		width: 84,
		height: 84,
	},
	wordmark: {
		fontSize: 18,
		fontWeight: '800',
		letterSpacing: 1.2,
		textTransform: 'lowercase',
		marginBottom: 12,
	},
	title: {
		fontSize: 34,
		fontWeight: '800',
		marginBottom: 12,
		letterSpacing: -0.8,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 16,
		textAlign: 'center',
		lineHeight: 24,
		marginBottom: 22,
		maxWidth: 340,
	},
	featureRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 28,
	},
	featureChip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 2,
	},
	featureChipText: {
		fontSize: 12,
		fontWeight: '700',
	},
	cta: {
		minWidth: 240,
	},
});
