import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleAuthProvider, User, createUserWithEmailAndPassword, signInWithCredential, signInWithEmailAndPassword } from '@firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useUser } from './providers';
import BrandScreen from '~/components/BrandScreen';
import { auth } from '~/lib/firebase';
import { customFetch } from '~/lib/utils';
import { offlineStorage } from '~/lib/offlineStorage';

export default function AuthPage() {
	const { user, isLoading, isLoggingOut, login, loginOffline } = useUser();
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

	const authWithEmailAndPassword = async () => {
		if (!email.trim() || !password.trim()) {
			setSnackbarMsg('Email and password are required.');
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

			setSnackbarMsg(errorMessage);
			setIsAuthenticating(false);
		}
	};

	const authWithGoogle = async () => {
		setIsAuthenticating(true);
		setSnackbarMsg('');

		try {
			await GoogleSignin.hasPlayServices();
			const response = await GoogleSignin.signIn();
			const idToken = response.idToken;

			if (!idToken) {
				throw new Error('Google sign-in did not return an ID token.');
			}

			const googleCredential = GoogleAuthProvider.credential(idToken);
			const userCredentials = await signInWithCredential(auth, googleCredential);
			await setSession(userCredentials.user);
			await GoogleSignin.revokeAccess();
			await GoogleSignin.signOut();
		} catch (error: any) {
			console.warn('Google Sign-In error:', {
				code: error.code,
				message: error.message,
			});
			setSnackbarMsg('Unable to sign in with Google right now. Please try again.');
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
			await auth.signOut();
			await login();
		} catch (error) {
			console.warn('Session creation failed:', error);
			setSnackbarMsg('Authentication failed. Please try again.');
			setIsAuthenticating(false);
		}
	};

	const handleOfflineLogin = async () => {
		setIsAuthenticating(true);

		try {
			await loginOffline();
			setSnackbarMsg('Logged in offline with your cached data.');
		} catch {
			setSnackbarMsg('Offline login failed.');
		} finally {
			setIsAuthenticating(false);
		}
	};

	return (
		<BrandScreen contentStyle={styles.content}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
					<View style={styles.hero}>
						<View style={styles.badge}>
							<Text style={styles.badgeText}>Private by default</Text>
						</View>
						<View style={styles.logoWrap}>
							<Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
						</View>
						<Text style={styles.wordmark}>hoplio</Text>
						<Text style={styles.title}>{isSignIn ? 'Welcome back' : 'Create your account'}</Text>
						<Text style={styles.subtitle}>
							{isSignIn
								? 'Pick up your encrypted conversations across mobile and web.'
								: 'Start with secure chat, AI assistance, and smart message search.'}
						</Text>
					</View>

					<View style={styles.card}>
						{isLoggingOut ? (
							<View style={styles.loadingState}>
								<ActivityIndicator size="large" color="#22d3ee" />
								<Text style={styles.loadingTitle}>Logging out...</Text>
								<Text style={styles.loadingCopy}>Clearing your current session.</Text>
							</View>
						) : isAuthenticating ? (
							<View style={styles.loadingState}>
								<ActivityIndicator size="large" color="#22d3ee" />
								<Text style={styles.loadingTitle}>
									{isSignIn ? 'Signing you in...' : 'Creating your account...'}
								</Text>
								<Text style={styles.loadingCopy}>Checking with the Hoplio backend.</Text>
							</View>
						) : (
							<>
								{hasOfflineData && (
									<>
										<Button mode="outlined" onPress={handleOfflineLogin} style={styles.offlineButton} textColor="#e2e8f0" icon="wifi-off">
											Continue Offline
										</Button>
										<View style={styles.dividerRow}>
											<View style={styles.dividerLine} />
											<Text style={styles.dividerText}>OR</Text>
											<View style={styles.dividerLine} />
										</View>
									</>
								)}

								<Button
									mode="contained"
									onPress={authWithGoogle}
									disabled={isAuthenticating}
									icon="google"
									style={styles.googleButton}
									labelStyle={styles.googleLabel}
								>
									{isSignIn ? 'Continue with Google' : 'Sign up with Google'}
								</Button>

								<View style={styles.dividerRow}>
									<View style={styles.dividerLine} />
									<Text style={styles.dividerText}>OR</Text>
									<View style={styles.dividerLine} />
								</View>

								<TextInput
									label="Email"
									value={email}
									mode="outlined"
									keyboardType="email-address"
									autoCapitalize="none"
									autoComplete="email"
									style={styles.input}
									onChangeText={(text) => setEmail(text.toLowerCase())}
									disabled={isAuthenticating}
									outlineColor="rgba(148,163,184,0.28)"
									activeOutlineColor="#22d3ee"
									textColor="#f8fafc"
									theme={{ colors: { onSurfaceVariant: '#94a3b8' } }}
								/>
								<TextInput
									label="Password"
									value={password}
									mode="outlined"
									secureTextEntry
									autoComplete={isSignIn ? 'password' : 'new-password'}
									style={styles.input}
									onChangeText={setPassword}
									disabled={isAuthenticating}
									outlineColor="rgba(148,163,184,0.28)"
									activeOutlineColor="#22d3ee"
									textColor="#f8fafc"
									theme={{ colors: { onSurfaceVariant: '#94a3b8' } }}
								/>
								<Button mode="contained" onPress={authWithEmailAndPassword} disabled={isAuthenticating} style={styles.primaryButton}>
									{isSignIn ? 'Sign In' : 'Create Account'}
								</Button>

								<TouchableOpacity onPress={() => setSignIn((prev) => !prev)} disabled={isAuthenticating} style={styles.toggleRow}>
									<Text style={styles.toggleCopy}>
										{isSignIn ? "Don't have an account? " : 'Already have an account? '}
									</Text>
									<Text style={styles.toggleAction}>{isSignIn ? 'Create account' : 'Sign in'}</Text>
								</TouchableOpacity>

								<Text style={styles.legalCopy}>By continuing, you agree to the Hoplio Terms and Privacy Policy.</Text>
							</>
						)}
					</View>
				</ScrollView>
			</SafeAreaView>

			<Snackbar visible={snackbarMsg.length > 0} duration={5000} onDismiss={() => setSnackbarMsg('')} style={styles.snackbar}>
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
		paddingHorizontal: 24,
		paddingVertical: 18,
		justifyContent: 'center',
	},
	hero: {
		alignItems: 'center',
		marginBottom: 28,
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
	},
	logoWrap: {
		width: 92,
		height: 92,
		borderRadius: 28,
		backgroundColor: 'rgba(15,23,42,0.5)',
		borderWidth: 1,
		borderColor: 'rgba(148,163,184,0.18)',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 16,
	},
	logo: {
		width: 72,
		height: 72,
	},
	wordmark: {
		fontSize: 17,
		fontWeight: '700',
		color: '#67e8f9',
		letterSpacing: 1.1,
		textTransform: 'lowercase',
		marginBottom: 10,
	},
	title: {
		fontSize: 30,
		fontWeight: '800',
		color: '#ffffff',
		marginBottom: 10,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 15,
		lineHeight: 22,
		color: 'rgba(226,232,240,0.82)',
		textAlign: 'center',
		maxWidth: 330,
	},
	card: {
		borderRadius: 24,
		padding: 20,
		backgroundColor: 'rgba(15,23,42,0.72)',
		borderWidth: 1,
		borderColor: 'rgba(148,163,184,0.14)',
	},
	loadingState: {
		alignItems: 'center',
		paddingVertical: 24,
	},
	loadingTitle: {
		color: '#f8fafc',
		fontSize: 16,
		fontWeight: '700',
		marginTop: 16,
	},
	loadingCopy: {
		color: '#94a3b8',
		fontSize: 14,
		marginTop: 8,
		textAlign: 'center',
	},
	offlineButton: {
		borderRadius: 14,
		borderColor: 'rgba(148,163,184,0.28)',
		marginBottom: 6,
	},
	googleButton: {
		borderRadius: 14,
		backgroundColor: '#22d3ee',
	},
	googleLabel: {
		color: '#082f49',
		fontWeight: '700',
	},
	dividerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginVertical: 16,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: 'rgba(148,163,184,0.18)',
	},
	dividerText: {
		color: '#94a3b8',
		fontSize: 12,
		fontWeight: '600',
	},
	input: {
		marginBottom: 12,
		backgroundColor: 'rgba(15,23,42,0.38)',
	},
	primaryButton: {
		marginTop: 4,
		borderRadius: 14,
		backgroundColor: '#0ea5e9',
	},
	toggleRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		flexWrap: 'wrap',
		marginTop: 18,
	},
	toggleCopy: {
		color: '#94a3b8',
	},
	toggleAction: {
		color: '#67e8f9',
		fontWeight: '700',
	},
	legalCopy: {
		marginTop: 14,
		color: '#64748b',
		fontSize: 12,
		textAlign: 'center',
		lineHeight: 18,
	},
	snackbar: {
		backgroundColor: 'rgba(15,23,42,0.94)',
	},
});
