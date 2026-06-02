import React, { useEffect, useState } from 'react';
import { LogBox, View, StyleSheet, TouchableOpacity } from 'react-native';
import {
	Text,
	Button,
	TextInput,
	Snackbar,
	ActivityIndicator,
} from 'react-native-paper';
import { useUser } from './providers';
import { router } from 'expo-router';
import { initializeApp } from 'firebase/app';
import {
	initializeAuth,
	GoogleAuthProvider,
	User,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signInWithCredential,
	getReactNativePersistence,
} from 'firebase/auth';
import { config } from '~/lib/config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { customFetch } from '~/lib/utils';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from '~/lib/offlineStorage';
import { useTheme } from '~/lib/themeContext';

const app = initializeApp(config.firebaseConfig);
const auth = initializeAuth(app, {
	persistence: getReactNativePersistence(AsyncStorage),
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export default function Page() {
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
			webClientId:
				'1068380641937-tthsla89okh6stfi2epcjquqfm4b94tl.apps.googleusercontent.com',
		});
	}, []);

	useEffect(() => {
		if (user && !isLoading && !isLoggingOut) {
			router.replace('/home');
			return;
		}
		if (!isLoggingOut) {
			checkOfflineData();
		}
	}, [user, isLoading, isLoggingOut]);

	const checkOfflineData = async () => {
		try {
			const offlineUserData = await offlineStorage.getUserData();
			setHasOfflineData(!!offlineUserData);
		} catch (error) {
			console.error('Failed to check offline data:', error);
		}
	};

	async function authWithEmailAndPassword() {
		if (
			email == null ||
			email.trim() == '' ||
			password == null ||
			password.trim() == ''
		) {
			setSnackbarMsg('Email or Password not given');
			return;
		}
		setIsAuthenticating(true);
		setSnackbarMsg('');
		try {
			if (isSignIn) {
				const { user } = await signInWithEmailAndPassword(auth, email, password);
				setSession(user);
			} else {
				const { user } = await createUserWithEmailAndPassword(
					auth,
					email,
					password
				);
				setSession(user);
			}
		} catch (error: any) {
			let errorMessage = error.message;
			switch (error.code) {
				case 'auth/email-already-in-use':
					errorMessage = 'The email address is already in use by another account.';
					break;
				case 'auth/invalid-email':
					errorMessage = 'The email address is invalid.';
					break;
				case 'auth/weak-password':
					errorMessage = 'The password is too weak.';
					break;
				case 'auth/invalid-credential':
					errorMessage = 'Account not found';
					break;
			}
			setSnackbarMsg(errorMessage);
			setIsAuthenticating(false);
		}
	}

	async function authWithGoogle() {
		setIsAuthenticating(true);
		setSnackbarMsg('');
		try {
			await GoogleSignin.hasPlayServices();
			const { idToken } = await GoogleSignin.signIn();
			const googleCredential = GoogleAuthProvider.credential(idToken);
			const userCredentials = await signInWithCredential(auth, googleCredential);
			const user = userCredentials.user;
			setSession(user);
			await GoogleSignin.revokeAccess();
			await GoogleSignin.signOut();
		} catch (error: any) {
			console.warn('Google Sign-In error:', {
				code: error.code,
				message: error.message,
			});
			setSnackbarMsg('Error occurred while trying to sign in with Google');
			setIsAuthenticating(false);
		}
	}

	async function setSession(user: User | null) {
		if (!user) throw new Error('User not found');
		const idToken = await user.getIdToken(true);
		customFetch({
			pathName: 'session',
			method: 'POST',
			body: { idToken },
		})
			.then(() => {
				auth.signOut();
				login();
			})
			.catch(() => {
				setSnackbarMsg('Authentication failed. Please try again.');
				setIsAuthenticating(false);
			});
	}

	async function handleOfflineLogin() {
		setIsAuthenticating(true);
		try {
			await loginOffline();
			setSnackbarMsg('Logged in offline with cached data');
		} catch {
			setSnackbarMsg('Failed to login offline');
		} finally {
			setIsAuthenticating(false);
		}
	}

	const Divider = () => (
		<View style={styles.dividerRow}>
			<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
			<Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
			<View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
		</View>
	);

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				{isLoggingOut ? (
					<View style={[styles.card, { backgroundColor: colors.surface }]}>
						<ActivityIndicator size="large" color={colors.primary} />
						<Text style={[styles.cardTitle, { color: colors.text }]}>
							Logging out...
						</Text>
						<Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
							Please wait while we sign you out
						</Text>
					</View>
				) : isAuthenticating ? (
					<View style={[styles.card, { backgroundColor: colors.surface }]}>
						<ActivityIndicator size="large" color={colors.primary} />
						<Text style={[styles.cardTitle, { color: colors.text }]}>
							{isSignIn ? 'Signing you in...' : 'Creating your account...'}
						</Text>
						<Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
							Please wait while we authenticate with the server
						</Text>
					</View>
				) : (
					<View style={styles.form}>
						<Text style={[styles.welcomeTitle, { color: colors.text }]}>
							Welcome to Hoplio
						</Text>
						<Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
							Sign in or create an account to continue
						</Text>

						{hasOfflineData && (
							<>
								<Button
									mode="outlined"
									onPress={handleOfflineLogin}
									disabled={isAuthenticating}
									icon="wifi-off"
									style={[styles.button, { borderColor: colors.primary }]}
									labelStyle={{ color: colors.primary }}
								>
									Continue Offline
								</Button>
								<Divider />
							</>
						)}

						<Button
							mode="contained"
							onPress={authWithGoogle}
							disabled={isAuthenticating}
							icon="google"
							style={[styles.button, { backgroundColor: colors.primary }]}
						>
							{isSignIn ? 'Sign In' : 'Sign Up'} With Google
						</Button>
						<Divider />

						<TextInput
							label="Email"
							value={email}
							mode="outlined"
							keyboardType="email-address"
							autoCapitalize="none"
							style={styles.input}
							onChangeText={(text) => setEmail(text.toLowerCase())}
							disabled={isAuthenticating}
							outlineColor={colors.border}
							activeOutlineColor={colors.primary}
							textColor={colors.text}
						/>
						<TextInput
							label="Password"
							value={password}
							mode="outlined"
							secureTextEntry
							style={styles.input}
							onChangeText={setPassword}
							disabled={isAuthenticating}
							outlineColor={colors.border}
							activeOutlineColor={colors.primary}
							textColor={colors.text}
						/>
						<Button
							mode="contained"
							onPress={authWithEmailAndPassword}
							disabled={isAuthenticating}
							style={[styles.button, { backgroundColor: colors.primary }]}
						>
							{isSignIn ? 'Sign In' : 'Sign Up'}
						</Button>

						<TouchableOpacity
							onPress={() => setSignIn((prev) => !prev)}
							disabled={isAuthenticating}
							style={styles.toggleRow}
						>
							<Text style={{ color: colors.textSecondary }}>
								{isSignIn ? "Don't have an account? " : 'Already have an account? '}
							</Text>
							<Text style={{ color: colors.primary, fontWeight: '600' }}>
								{isSignIn ? 'Create account' : 'Sign in'}
							</Text>
						</TouchableOpacity>
					</View>
				)}

				<Snackbar
					visible={snackbarMsg.length > 0}
					duration={5000}
					onDismiss={() => setSnackbarMsg('')}
					style={{ backgroundColor: colors.surfaceElevated ?? colors.surface }}
				>
					{snackbarMsg}
				</Snackbar>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	card: {
		width: '88%',
		paddingVertical: 40,
		paddingHorizontal: 24,
		alignItems: 'center',
		borderRadius: 16,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginTop: 16,
		textAlign: 'center',
	},
	cardSubtitle: {
		fontSize: 14,
		marginTop: 8,
		textAlign: 'center',
	},
	form: {
		width: '100%',
		maxWidth: 340,
		alignItems: 'center',
		gap: 4,
	},
	welcomeTitle: {
		fontSize: 24,
		fontWeight: '700',
		marginBottom: 4,
	},
	welcomeSubtitle: {
		fontSize: 14,
		marginBottom: 24,
	},
	button: {
		width: '100%',
		borderRadius: 12,
		marginVertical: 4,
	},
	input: {
		width: '100%',
		borderRadius: 12,
		marginVertical: 4,
	},
	dividerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		marginVertical: 12,
		width: '100%',
	},
	dividerLine: {
		height: 1,
		width: '28%',
	},
	dividerText: {
		fontSize: 12,
		fontWeight: '500',
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 16,
		flexWrap: 'wrap',
		justifyContent: 'center',
	},
});
