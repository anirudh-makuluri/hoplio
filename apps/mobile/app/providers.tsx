import { ReactNode, createContext, useContext, useEffect, useReducer, useState } from 'react'
import { customFetch } from '../lib/utils';
import { TAuthUser } from '../lib/types';
import ReduxProvider from '../redux/redux-provider';
import { useE2EEInitialization } from '../lib/hooks/useE2EE';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { offlineStorage } from '../lib/offlineStorage';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider, useTheme } from '../lib/themeContext';
import { ToastProvider } from '../components/Toast';
import AppIcon from '../components/ui/AppIcon';
import { auth } from '../lib/firebase';


type TUserContext = {
	user: TAuthUser | null,
	isLoading: boolean,
	isLoggingOut: boolean,
	isOffline: boolean,
	login: Function,
	logout: Function,
	updateUser: Function,
	loginOffline: Function,
	replaceUserFromSync: (user: TAuthUser) => void,
}

const UserContext = createContext<TUserContext>({
	user: null,
	isLoading: true,
	isLoggingOut: false,
	isOffline: false,
	login: () => { },
	logout: () => { },
	updateUser: () => { },
	loginOffline: () => { },
	replaceUserFromSync: () => { },
});

type AuthState = {
	user: TAuthUser | null;
	isLoading: boolean;
};

type AuthAction =
	| { type: 'RESTORE_SESSION'; user: TAuthUser }
	| { type: 'SET_USER'; user: TAuthUser | null }
	| { type: 'SET_LOADING'; isLoading: boolean }
	| { type: 'FINISH_LOADING' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
	switch (action.type) {
		case 'RESTORE_SESSION':
			return { user: action.user, isLoading: false };
		case 'SET_USER':
			return { ...state, user: action.user };
		case 'SET_LOADING':
			return { ...state, isLoading: action.isLoading };
		case 'FINISH_LOADING':
			return { ...state, isLoading: false };
		default:
			return state;
	}
}

/** Duolingo-inspired Paper MD3 mapping — keep in sync with themeContext */
const lightPaperTheme = {
	...MD3LightTheme,
	roundness: 16,
	colors: {
		...MD3LightTheme.colors,
		primary: '#58CC02',
		primaryContainer: '#D7FFB8',
		onPrimary: '#FFFFFF',
		onPrimaryContainer: '#46A302',
		secondary: '#FFC800',
		secondaryContainer: '#FFF3BF',
		onSecondary: '#3C3C3C',
		surface: '#FFFFFF',
		surfaceVariant: '#F0F0F0',
		background: '#F7F7F7',
		onSurface: '#3C3C3C',
		onSurfaceVariant: '#777777',
		outline: '#E5E5E5',
		error: '#FF4B4B',
		onError: '#FFFFFF',
	},
};

const darkPaperTheme = {
	...MD3DarkTheme,
	roundness: 16,
	colors: {
		...MD3DarkTheme.colors,
		primary: '#58CC02',
		primaryContainer: '#2E5A12',
		onPrimary: '#FFFFFF',
		onPrimaryContainer: '#D7FFB8',
		secondary: '#FFC800',
		secondaryContainer: '#5C4A00',
		onSecondary: '#131F24',
		surface: '#1A2C33',
		surfaceVariant: '#243B44',
		background: '#131F24',
		onSurface: '#F0F0F0',
		onSurfaceVariant: '#A0A0A0',
		outline: '#2E4550',
		error: '#FF4B4B',
		onError: '#FFFFFF',
	},
};

/** Start loading device keys as early as possible — does not block UI. */
function E2EEInitializer() {
	useE2EEInitialization();
	return null;
}

function PaperThemeGate({ children }: { children: ReactNode }) {
	const { isDark } = useTheme();
	return (
		<PaperProvider
			theme={isDark ? darkPaperTheme : lightPaperTheme}
			settings={{
				icon: ({ name, color, size }) => <AppIcon name={name} color={color} size={size} />,
			}}
		>
			{children}
		</PaperProvider>
	);
}

export function Providers({ children }: { children: ReactNode }) {
	const [{ user, isLoading }, dispatchAuth] = useReducer(authReducer, {
		user: null,
		isLoading: true,
	});
	const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
	const [isOffline, setIsOffline] = useState<boolean>(false);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener(state => {
			setIsOffline(!state.isConnected);
		});

		void initializeAuth();

		return () => unsubscribe();
	}, []);

	/** Cache-first launch: show cached user immediately, refresh session in background. */
	async function initializeAuth() {
		let hadCachedUser = false;

		try {
			const cached = await offlineStorage.getUserData();
			if (cached?.user) {
				hadCachedUser = true;
				dispatchAuth({ type: 'RESTORE_SESSION', user: cached.user });
			}
		} catch (error) {
			console.error('Failed to hydrate user from cache:', error);
		}

		if (!hadCachedUser) {
			await refreshSession({ showLoading: true });
		}
	}

	async function refreshSession(options: { showLoading?: boolean; hadCachedUser?: boolean } = {}) {
		const { showLoading = false, hadCachedUser = false } = options;

		if (showLoading) {
			dispatchAuth({ type: 'SET_LOADING', isLoading: true });
		}

		try {
			const data = await customFetch({ pathName: 'session' });
			if (data.success) {
				dispatchAuth({ type: 'SET_USER', user: data.user });
				await offlineStorage.saveUserData(data.user);
				await offlineStorage.setOfflineMode(false);
			}
		} catch (error) {
			console.warn('Session refresh failed:', error);

			if (!hadCachedUser) {
				await loginOffline();
			} else {
				await offlineStorage.setOfflineMode(true);
			}
		} finally {
			if (showLoading) {
				dispatchAuth({ type: 'FINISH_LOADING' });
			}
		}
	}

	/** Explicit session fetch after sign-in (network-first). */
	async function login() {
		await refreshSession({ showLoading: true });
	}

	async function loginOffline() {
		try {
			const offlineUserData = await offlineStorage.getUserData();
			if (offlineUserData && offlineUserData.user) {
				dispatchAuth({ type: 'SET_USER', user: offlineUserData.user });
				await offlineStorage.setOfflineMode(true);
				console.log('Logged in offline with cached user data');
			} else {
				console.log('No offline user data available');
			}
		} catch (error) {
			console.error('Offline login failed:', error);
		}
	}

	function replaceUserFromSync(sessionUser: TAuthUser) {
		dispatchAuth({ type: 'SET_USER', user: sessionUser });
	}

	async function updateUser(newData: Partial<TAuthUser>) {
		if (!user) return;

		const newUserData: TAuthUser = {
			email: newData.email !== undefined ? newData.email : user.email,
			name: newData.name !== undefined ? newData.name : user.name,
			photo_url: newData.photo_url !== undefined ? newData.photo_url : user.photo_url,
			received_friend_requests: newData.received_friend_requests !== undefined ? newData.received_friend_requests : user.received_friend_requests,
			friend_list: newData.friend_list !== undefined ? newData.friend_list : user.friend_list,
			sent_friend_requests: newData.sent_friend_requests !== undefined ? newData.sent_friend_requests : user.sent_friend_requests,
			uid: newData.uid !== undefined ? newData.uid : user.uid,
			rooms: newData.rooms !== undefined ? newData.rooms : user.rooms,
		};

		dispatchAuth({ type: 'SET_USER', user: newUserData });
		
		// Update offline storage
		try {
			await offlineStorage.saveUserData(newUserData);
		} catch (error) {
			console.error('Failed to update offline user data:', error);
		}
	}

	async function logout() {
		setIsLoggingOut(true);
		
		try {
			// Try online logout first
			await customFetch({ pathName: 'session', method: 'DELETE' });
			console.log('Logged out online');
		} catch (error) {
			console.error('Online logout failed:', error);
			// Continue with local logout even if backend call fails
		}

		try {
			const deviceManager = await import('../lib/device-manager');
			const pushNotifications = await import('../lib/pushNotifications');
			const deviceId = deviceManager.getDeviceId();
			if (deviceId) {
				await pushNotifications.unregisterAndroidPushDevice(deviceId);
			}
		} catch (error) {
			console.error('Failed to unregister push notifications during logout:', error);
		}

		try {
			await auth.signOut();
		} catch (error) {
			console.error('Failed to sign out Firebase auth session:', error);
		}
		
		try {
			// Clear offline data
			await offlineStorage.clearUserData();
			dispatchAuth({ type: 'SET_USER', user: null });
			router.replace('/auth');
		} catch (error) {
			console.error('Failed to clear offline data:', error);
			// Still clear user and redirect
			dispatchAuth({ type: 'SET_USER', user: null });
			router.replace('/auth');
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<UserContext.Provider value={{ user, login, logout, isLoading, isLoggingOut, isOffline, updateUser, loginOffline, replaceUserFromSync }}>
					<ReduxProvider>
						<E2EEInitializer />
						<PaperThemeGate>
							<ToastProvider>{children}</ToastProvider>
						</PaperThemeGate>
					</ReduxProvider>
				</UserContext.Provider>
			</ThemeProvider>
		</SafeAreaProvider>
	)

}


export function useUser() {
	return useContext(UserContext);
}
