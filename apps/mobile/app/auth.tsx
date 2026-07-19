import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Snackbar, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleAuthProvider, User, createUserWithEmailAndPassword, signInWithCredential, signInWithEmailAndPassword } from '@firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useUser } from './providers';
import BrandScreen from '~/components/BrandScreen';
import { AppButton, AppCard } from '~/components/ui';
import { auth } from '~/lib/firebase';
import { customFetch } from '~/lib/utils';
import { offlineStorage } from '~/lib/offlineStorage';
import { useTheme } from '~/lib/themeContext';
import { hapticError, hapticSuccess } from '~/lib/haptics';

export default function AuthPage() {
	const { user, isLoading, isLoggingOut, login, loginOffline } = useUser();
	const { colors } = useTheme();
	const [isSignIn, setSignIn] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [snackbarMsg, setSnackbarMsg] = useState('');
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [hasOfflineData, setHasOfflineData] = useState(false);

	useEffect(() => {
		GoogleSignin.configure({
			webClientId: '1068380641937-tthsla89okh6stfi2epcjquqfm4b94tl.apps.googleusercontent.com',
		});
	}, []);

	useEffect(() => {
		if (user && !isLoading && !isLoggingOut) {
			void hapticSuccess();
			router.replace('/home');
			return;
		}

		if (!isLoggingOut) {
			void checkOfflineData();
		}
	}, [isLoading, isLoggingOut, user]);

	const checkOfflineData = async () => {
		try {
			const offlineUserData = await offlineStorage.getUserData();
			setHasOfflineData(!!offlineUserData);
		} catch (error) {
			console.error('Failed to check offline data:', error);
		}
	};

	const showError = (message: string) => {
		void hapticError();
		setSnackbarMsg(message);
	};

	const authWithEmailAndPassword = async () => {
		if (!email.trim() || !password.trim()) {
			showError('Email and password are required.');
			return;
		}

		setIsAuthenticating(true);
		setSnackbarMsg('');

		try {
			const credential = isSignIn
				? await signInWithEmailAndPassword(auth, email.trim(), password)
				: await createUserWithEmailAndPassword(auth, email.trim(), password);

			await setSession(credential.user);
		} catch (error: any) {
			let errorMessage = error.message;

			switch (error.code) {
				case 'auth/email-already-in-use':
					errorMessage = 'That email is already being used by another account.';
					break;
				case 'auth/invalid-email':
					errorMessage = 'Enter a valid email address.';
					break;
				case 'auth/weak-password':
					errorMessage = 'Choose a stronger password.';
					break;
				case 'auth/invalid-credential':
					errorMessage = 'Account not found. Check your email and password.';
					break;
			}

			showError(errorMessage);
			setIsAuthenticating(false);
		}
	};

	const authWithGoogle = async () => {
		setIsAuthenticating(true);
		setSnackbarMsg('');

		try {
			await GoogleSignin.hasPlayServices();
			const response = await GoogleSignin.signIn();
			const idToken = response.idToken ?? (response as { data?: { idToken?: string } }).data?.idToken;

			if (!idToken) {
				throw new Error('Google sign-in did not return an ID token.');
			}

			const googleCredential = GoogleAuthProvider.credential(idToken);
			const userCredentials = await signInWithCredential(auth, googleCredential);
			await setSession(userCredentials.user);
			await GoogleSignin.revokeAccess();
			await GoogleSignin.signOut();
		} catch (error: any) {
			const code = String(error?.code ?? error?.statusCode ?? '');
			console.warn('Google Sign-In error:', {
				code,
				message: error?.message,
				statusCode: error?.statusCode,
			});

			if (code === '10' || code === 'DEVELOPER_ERROR' || /DEVELOPER_ERROR/i.test(String(error?.message ?? ''))) {
				showError(
					'Google Sign-In is misconfigured for this build. Add the Play App Signing SHA-1 in Firebase for com.arm8tron.hoplio.'
				);
			} else if (code === '12501' || code === 'SIGN_IN_CANCELLED') {
				setSnackbarMsg('Google sign-in was cancelled.');
			} else {
				showError('Unable to sign in with Google right now. Please try again.');
			}
			setIsAuthenticating(false);
		}
	};

	const setSession = async (firebaseUser: User | null) => {
		if (!firebaseUser) {
			throw new Error('User not found');
		}

		try {
			const idToken = await firebaseUser.getIdToken(true);
			await customFetch({
				pathName: 'session',
				method: 'POST',
				body: { idToken },
			});
			await login();
		} catch (error) {
			console.warn('Session creation failed:', error);
			showError('Authentication failed. Please try again.');
			setIsAuthenticating(false);
		}
	};

	const handleOfflineLogin = async () => {
		setIsAuthenticating(true);

		try {
			await loginOffline();
			void hapticSuccess();
			setSnackbarMsg('Logged in offline with your cached data.');
		} catch {
			showError('Offline login failed.');
		} finally {
			setIsAuthenticating(false);
		}
	};

	return (
		<BrandScreen contentStyle={styles.content}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
					<View style={styles.hero}>
						<View style={[styles.badge, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
							<Text style={[styles.badgeText, { color: colors.primaryDark }]}>Private by default</Text>
						</View>
						<View style={[styles.logoWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
						</View>
						<Text style={[styles.wordmark, { color: colors.primaryDark }]}>hoplio</Text>
						<Text style={[styles.title, { color: colors.text }]}>
							{isSignIn ? 'Welcome back!' : 'Join the fun'}
						</Text>
						<Text style={[styles.subtitle, { color: colors.textSecondary }]}>
							{isSignIn
								? 'Pick up your encrypted conversations across mobile and web.'
								: 'Start with secure chat, AI assistance, and smart message search.'}
						</Text>
					</View>

					<AppCard style={styles.card}>
						{isLoggingOut ? (
							<View style={styles.loadingState}>
								<ActivityIndicator size="large" color={colors.primary} />
								<Text style={[styles.loadingTitle, { color: colors.text }]}>Logging out...</Text>
								<Text style={[styles.loadingCopy, { color: colors.textSecondary }]}>
									Clearing your current session.
								</Text>
							</View>
						) : isAuthenticating ? (
							<View style={styles.loadingState}>
								<ActivityIndicator size="large" color={colors.primary} />
								<Text style={[styles.loadingTitle, { color: colors.text }]}>
									{isSignIn ? 'Signing you in...' : 'Creating your account...'}
								</Text>
								<Text style={[styles.loadingCopy, { color: colors.textSecondary }]}>
									Checking with the Hoplio backend.
								</Text>
							</View>
						) : (
							<>
								{hasOfflineData && (
									<>
										<AppButton
											variant="secondary"
											onPress={handleOfflineLogin}
											icon="wifi-off"
											fullWidth
											style={styles.stackGap}
										>
											Continue Offline
										</AppButton>
										<View style={styles.dividerRow}>
											<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
											<Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
											<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
										</View>
									</>
								)}

								<AppButton
									variant="accent"
									onPress={authWithGoogle}
									disabled={isAuthenticating}
									icon="google"
									fullWidth
									style={styles.stackGap}
								>
									{isSignIn ? 'Continue with Google' : 'Sign up with Google'}
								</AppButton>

								<View style={styles.dividerRow}>
									<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
									<Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
									<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
								</View>

								<TextInput
									label="Email"
									value={email}
									mode="outlined"
									keyboardType="email-address"
									autoCapitalize="none"
									autoComplete="email"
									style={[styles.input, { backgroundColor: colors.muted }]}
									onChangeText={(text) => setEmail(text.toLowerCase())}
									disabled={isAuthenticating}
									outlineColor={colors.border}
									activeOutlineColor={colors.primary}
									textColor={colors.text}
									theme={{ colors: { onSurfaceVariant: colors.textSecondary } }}
								/>
								<TextInput
									label="Password"
									value={password}
									mode="outlined"
									secureTextEntry
									autoComplete={isSignIn ? 'password' : 'new-password'}
									style={[styles.input, { backgroundColor: colors.muted }]}
									onChangeText={setPassword}
									disabled={isAuthenticating}
									outlineColor={colors.border}
									activeOutlineColor={colors.primary}
									textColor={colors.text}
									theme={{ colors: { onSurfaceVariant: colors.textSecondary } }}
								/>
								<AppButton
									onPress={authWithEmailAndPassword}
									disabled={isAuthenticating}
									fullWidth
									style={styles.stackGap}
								>
									{isSignIn ? 'Sign In' : 'Create Account'}
								</AppButton>

								<TouchableOpacity
									onPress={() => setSignIn((prev) => !prev)}
									disabled={isAuthenticating}
									style={styles.toggleRow}
								>
									<Text style={[styles.toggleCopy, { color: colors.textSecondary }]}>
										{isSignIn ? "Don't have an account? " : 'Already have an account? '}
									</Text>
									<Text style={[styles.toggleAction, { color: colors.primaryDark }]}>
										{isSignIn ? 'Create account' : 'Sign in'}
									</Text>
								</TouchableOpacity>

								<Text style={[styles.legalCopy, { color: colors.textSecondary }]}>
									By continuing, you agree to the Hoplio Terms and Privacy Policy.
								</Text>
							</>
						)}
					</AppCard>
				</ScrollView>
			</SafeAreaView>

			<Snackbar
				visible={snackbarMsg.length > 0}
				duration={5000}
				onDismiss={() => setSnackbarMsg('')}
				style={[styles.snackbar, { backgroundColor: colors.surfaceElevated }]}
			>
				{snackbarMsg}
			</Snackbar>
		</BrandScreen>
	);
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingHorizontal: 4,
		paddingVertical: 18,
		justifyContent: 'center',
	},
	hero: {
		alignItems: 'center',
		marginBottom: 24,
	},
	badge: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 999,
		borderWidth: 2,
		marginBottom: 16,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: '800',
	},
	logoWrap: {
		width: 92,
		height: 92,
		borderRadius: 28,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 14,
	},
	logo: {
		width: 72,
		height: 72,
	},
	wordmark: {
		fontSize: 17,
		fontWeight: '800',
		letterSpacing: 1.1,
		textTransform: 'lowercase',
		marginBottom: 8,
	},
	title: {
		fontSize: 30,
		fontWeight: '800',
		marginBottom: 8,
		textAlign: 'center',
		letterSpacing: -0.5,
	},
	subtitle: {
		fontSize: 15,
		lineHeight: 22,
		textAlign: 'center',
		maxWidth: 330,
	},
	card: {
		marginBottom: 12,
	},
	loadingState: {
		alignItems: 'center',
		paddingVertical: 24,
	},
	loadingTitle: {
		fontSize: 16,
		fontWeight: '800',
		marginTop: 16,
	},
	loadingCopy: {
		fontSize: 14,
		marginTop: 8,
		textAlign: 'center',
	},
	stackGap: {
		marginBottom: 4,
	},
	dividerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginVertical: 16,
	},
	dividerLine: {
		flex: 1,
		height: 2,
	},
	dividerText: {
		fontSize: 12,
		fontWeight: '800',
	},
	input: {
		marginBottom: 12,
	},
	toggleRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		flexWrap: 'wrap',
		marginTop: 18,
	},
	toggleCopy: {
		fontSize: 14,
	},
	toggleAction: {
		fontWeight: '800',
		fontSize: 14,
	},
	legalCopy: {
		marginTop: 14,
		fontSize: 12,
		textAlign: 'center',
		lineHeight: 18,
	},
	snackbar: {
		borderRadius: 12,
	},
});
