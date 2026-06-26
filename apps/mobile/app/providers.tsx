import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { customFetch } from '../lib/utils';
import { TAuthUser } from '../lib/types';
import ReduxProvider from '../redux/redux-provider';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { offlineStorage } from '../lib/offlineStorage';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider, useTheme } from '../lib/themeContext';
import { ToastProvider } from '../components/Toast';
import { auth } from '../lib/firebase';


type TUserContext = {
	user: TAuthUser | null,
	isLoading: boolean,
	isLoggingOut: boolean,
	isOffline: boolean,
	login: Function,
	logout: Function,
	updateUser: Function,
	loginOffline: Function
}

const UserContext = createContext<TUserContext>({
	user: null,
	isLoading: true,
	isLoggingOut: false,
	isOffline: false,
	login: () => { },
	logout: () => { },
	updateUser: () => { },
	loginOffline: () => { }
});

const lightPaperTheme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: '#3b82f6',
		primaryContainer: '#dbeafe',
		secondary: '#f1f5f9',
		surface: '#ffffff',
		surfaceVariant: '#f8fafc',
		outline: '#e2e8f0',
	},
};

const darkPaperTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: '#3b82f6',
		primaryContainer: '#1e3a5f',
		secondary: '#1e293b',
		surface: '#1e293b',
		surfaceVariant: '#334155',
		outline: '#334155',
		background: '#0f172a',
		onSurface: '#e2e8f0',
		onSurfaceVariant: '#94a3b8',
	},
};

function PaperThemeGate({ children }: { children: ReactNode }) {
	const { isDark } = useTheme();
	return <PaperProvider theme={isDark ? darkPaperTheme : lightPaperTheme}>{children}</PaperProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<TAuthUser | null>(null);
	const [isLoading, setLoading] = useState<boolean>(true);
	const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
	const [isOffline, setIsOffline] = useState<boolean>(false);

	useEffect(() => {
		// Check network status
		const unsubscribe = NetInfo.addEventListener(state => {
			setIsOffline(!state.isConnected);
		});

		// Initialize login
		if (!user) {
			login();
		}

		return () => unsubscribe();
	}, []);

	async function login() {
		setLoading(true);
		
		try {
			// Try online login first
			const data = await customFetch({ pathName: 'session' });
			if (data.success) {
				setUser(data.user);
				// Save user data for offline access
				await offlineStorage.saveUserData(data.user);
				await offlineStorage.setOfflineMode(false);
			}
		} catch (error) {
			console.warn('Online login failed, trying offline:', error);
			
			// Try offline login
			await loginOffline();
		} finally {
			setLoading(false);
		}
	}

	async function loginOffline() {
		try {
			const offlineUserData = await offlineStorage.getUserData();
			if (offlineUserData && offlineUserData.user) {
				setUser(offlineUserData.user);
				await offlineStorage.setOfflineMode(true);
				console.log('Logged in offline with cached user data');
			} else {
				console.log('No offline user data available');
			}
		} catch (error) {
			console.error('Offline login failed:', error);
		}
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

		setUser(newUserData);
		
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
			setUser(null);
			router.replace('/auth');
		} catch (error) {
			console.error('Failed to clear offline data:', error);
			// Still clear user and redirect
			setUser(null);
			router.replace('/auth');
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<UserContext.Provider value={{ user, login, logout, isLoading, isLoggingOut, isOffline, updateUser, loginOffline }}>
					<ReduxProvider>
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
