'use client'
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider } from "@/components/theme-provider"
import { customFetch } from '@/lib/utils';
import { TAuthUser } from '@/lib/types';
import { useRouter } from 'next/navigation';
import ReduxProvider from '@/redux/redux-provider';
import { Tooltip, TooltipProvider } from '@radix-ui/react-tooltip';


type TUserContext = {
	user: TAuthUser | null,
	isLoading: boolean,
	login: Function,
	logout: Function,
	updateUser: Function
}

const UserContext = createContext<TUserContext>({
	user: null,
	isLoading: true,
	login: () => { },
	logout: () => { },
	updateUser: () => { }
});

export function Providers({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<TAuthUser | null>(null);
	const [isLoading, setLoading] = useState<boolean>(true);
	const router = useRouter();

	const roomIdsSignature = useMemo(() => {
		if (!user?.rooms) return '';
		return user.rooms
			.filter((room) => !room.roomId.startsWith('ai-assistant-'))
			.map((room) => room.roomId)
			.sort()
			.join('|');
	}, [user]);

	const userId = user?.uid || '';

	const ensureE2EEKeys = useCallback(async (normalizedUser: TAuthUser) => {
		try {
			const e2eeServiceModule = await import('@/lib/e2ee-service');
			const deviceManagerModule = await import('@/lib/device-manager');
			const e2eeApiModule = await import('@/lib/e2ee-api');

			const e2eeService = e2eeServiceModule.getE2EEService();
			await e2eeService.initialize();

			const deviceId = deviceManagerModule.getDeviceId();
			const userId = normalizedUser.uid;
			if (!deviceId) {
				console.warn('E2EE device is not initialized yet.');
				return;
			}

			let keyExists = false;
			try {
				const response = await e2eeApiModule.getIdentityKeyForDevice(userId, deviceId);
				keyExists = !!response?.success && !!response?.publicKey && !!response?.signingPublicKey;
			} catch (error) {
				if (error instanceof Response && error.status === 404) {
					keyExists = false;
				} else {
					console.error('Failed to check identity key status:', error);
					return;
				}
			}

			const roomIds = Array.from(
				new Set(
					(normalizedUser.rooms || [])
						.filter((room) => !room.roomId.startsWith('ai-assistant-'))
						.map((room) => room.roomId)
				)
			);

			// setupDeviceKeys is idempotent on the backend, so we reuse it to
			// register any missing room keys even when the identity key already exists.
			if (!keyExists || roomIds.length > 0) {
				await e2eeService.setupDeviceKeys(userId, roomIds);
			}
		} catch (error) {
			console.error('E2EE key setup on login failed:', error);
		}
	}, []);

	const login = useCallback(() => {
		setLoading(true);
		customFetch({ pathName: 'session' })
			.then((data) => {
				if (data.success) {

					const normalizedUser = {
						...data.user,
						friend_list: (data.user.friend_list || []).map((u: any) => ({
							...u,
							is_online: u.is_online ?? false,
							last_seen: u.last_seen ?? null
						})),
						received_friend_requests: (data.user.received_friend_requests || []).map((u: any) => ({
							...u,
							is_online: u.is_online ?? false,
							last_seen: u.last_seen ?? null
						})),
						sent_friend_requests: (data.user.sent_friend_requests || []).map((u: any) => ({
							...u,
							is_online: u.is_online ?? false,
							last_seen: u.last_seen ?? null
						})),
						rooms: (data.user.rooms || []).map((r: any) => ({
							...r,
							membersData: (r.membersData || []).map((m: any) => ({
								...m,
								is_online: m.is_online ?? false,
								last_seen: m.last_seen ?? null
							}))
						}))
					}
					setUser(normalizedUser)
				}
			})
			.catch(error => {
				console.error('Error fetching user data:', error);
			}).finally(() => {
				setLoading(false);
			})
	}, []);

	useEffect(() => {
		if (!user) {
			login();
		}
	}, [user, login]);

	useEffect(() => {
		if (!userId || !user) return;
		void ensureE2EEKeys(user);
	}, [ensureE2EEKeys, roomIdsSignature, user, userId]);

	function updateUser(newData: Partial<TAuthUser>) {
		if(!user) return;

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
	}

	function logout() {
		customFetch({
			pathName: 'session',
			method: 'DELETE'
		}).then(res => {
			setUser(null);
			router.replace('/auth');
		})
	}

	return (
		<UserContext.Provider value={{ user, login, logout, isLoading, updateUser }}>
			<ReduxProvider>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					forcedTheme="dark"
					enableSystem={false}
					disableTransitionOnChange
				>
					<TooltipProvider delayDuration={100}>
						{children}
					</TooltipProvider>
				</ThemeProvider>
			</ReduxProvider>
		</UserContext.Provider>
	)

}


export function useUser() {
	return useContext(UserContext);
}
