import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, FAB } from 'react-native-paper';
import { useUser } from './providers';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { initAndJoinSocketRooms, joinSocketRoom } from '~/redux/socketSlice';
import { runBackgroundSync } from '~/redux/syncThunks';
import { selectIsSyncing } from '~/redux/syncSlice';
import {
	clearRoomData,
	editMessageInChat,
	deleteMessageFromChat,
	saveChatMessage,
	toggleReaction,
	updateUserPresence,
	setOfflineMode,
	setActiveRoomId,
} from '~/redux/chatSlice';
import { joinChatRoomWithCache, receiveChatMessage } from '~/redux/chatThunks';
import { offlineStorage } from '~/lib/offlineStorage';
import { useDispatch } from 'react-redux';
import { ChatMessage, TUser, TRoomData } from '~/lib/types';
import { genRoomId } from '~/lib/utils';
import { useTheme } from '~/lib/themeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import RoomList from '~/components/HomeTabs/RoomList';
import Settings from '~/components/HomeTabs/Settings';
import Friends from '~/components/HomeTabs/Friends';
import GroupChat from '~/components/GroupChat';
import BottomNavBar from '~/components/BottomNavBar';
import { useToast } from '~/components/Toast';
import {
	useDeviceId,
	useEnsureE2EEKeys,
} from '~/lib/hooks/useE2EE';
import {
	consumePendingNotificationRoomId,
	initializeNotificationResponseTracking,
	registerAndroidPushDevice,
} from '~/lib/pushNotifications';
import { hapticMedium } from '~/lib/haptics';

type TabType = 'chats' | 'updates' | 'profile';

export default function Page() {
	const { user, isLoading, updateUser, logout, isOffline, replaceUserFromSync } = useUser();
	const { colors } = useTheme();
	const { showToast } = useToast();
	const socket = useAppSelector((state) => state.socket.socket);
	const activeChatRoomId = useAppSelector((state) => state.chat.activeChatRoomId);
	const unreadCounts = useAppSelector((state) => state.chat.unreadCounts);
	const deviceName = useAppSelector((state) => state.e2ee.deviceState?.deviceName);
	const dispatch = useAppDispatch();
	const reduxDispatch = useDispatch();
	const deviceId = useDeviceId();
	const e2eeInitialized = useAppSelector((state) => state.e2ee.deviceState != null);
	const ensureE2EEKeys = useEnsureE2EEKeys();
	const [currentTab, setCurrentTab] = useState<TabType>('chats');
	const [showGroupModal, setShowGroupModal] = useState(false);
	const [roomsBootstrapped, setRoomsBootstrapped] = useState(false);
	const [backgroundSetupDone, setBackgroundSetupDone] = useState(false);
	const isSyncing = useAppSelector(selectIsSyncing);
	const hasScheduledInitialSyncRef = useRef(false);
	const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

	const triggerBackgroundSync = useCallback(() => {
		dispatch(runBackgroundSync({ onUserUpdated: replaceUserFromSync }));
	}, [dispatch, replaceUserFromSync]);

	useEffect(() => {
		initializeNotificationResponseTracking().catch((error) => {
			console.error('Failed to initialize notification response tracking:', error);
		});
	}, []);

	const renderCurrentView = () => {
		switch (currentTab) {
			case 'updates':
				return <Friends />;
			case 'profile':
				return <Settings />;
			default:
				return <RoomList onCreateGroup={() => setShowGroupModal(true)} />;
		}
	};

	const handleTabChange = (tab: TabType) => {
		setCurrentTab(tab);
	};

	const handleLogout = () => {
		reduxDispatch(clearRoomData());
		logout();
	};

	useEffect(() => {
		if (!isLoading && !user) {
			router.replace('/auth');
			return;
		}

		if (!user || roomsBootstrapped) {
			return;
		}

		let cancelled = false;

		const bootstrapRooms = async () => {
			dispatch(setOfflineMode(isOffline || false));

			let rooms = Array.isArray(user.rooms) ? user.rooms : [];
			if (rooms.length === 0) {
				const cachedRooms = await offlineStorage.getRoomsData();
				if (cachedRooms) {
					rooms = Object.values(cachedRooms);
				}
			}

			for (const roomData of rooms) {
				if (cancelled) {
					return;
				}
				await dispatch(joinChatRoomWithCache(roomData));
			}

			if (!cancelled) {
				setRoomsBootstrapped(true);
			}
		};

		void bootstrapRooms();

		return () => {
			cancelled = true;
		};
	}, [user, isLoading, isOffline, roomsBootstrapped, dispatch, router]);

	useEffect(() => {
		if (!user) {
			offlineStorage.setSyncHandler(null);
			hasScheduledInitialSyncRef.current = false;
			return;
		}

		offlineStorage.setSyncHandler(async () => {
			await dispatch(runBackgroundSync({ onUserUpdated: replaceUserFromSync }));
		});

		return () => {
			offlineStorage.setSyncHandler(null);
		};
	}, [user, dispatch, replaceUserFromSync]);

	useEffect(() => {
		if (!user || !roomsBootstrapped || !backgroundSetupDone || hasScheduledInitialSyncRef.current) {
			return;
		}

		hasScheduledInitialSyncRef.current = true;
		triggerBackgroundSync();
	}, [user, roomsBootstrapped, backgroundSetupDone, triggerBackgroundSync]);

	useEffect(() => {
		if (!user || !roomsBootstrapped || isOffline || backgroundSetupDone || !e2eeInitialized) {
			return;
		}

		let cancelled = false;

		const bootstrapBackground = async () => {
			const roomIds: string[] = Array.isArray(user.rooms) ? user.rooms.map((room) => room.roomId) : [];
			const e2eeRoomIds = roomIds.filter((roomId) => !roomId.startsWith('ai-assistant-'));

			try {
				dispatch(
					initAndJoinSocketRooms(roomIds, {
						email: user.email,
						name: user.name,
						photo_url: user.photo_url,
						uid: user.uid,
						deviceId,
					})
				);

				void ensureE2EEKeys(user.uid, e2eeRoomIds).catch((error) => {
					console.error('Background E2EE key sync failed:', error);
				});
			} catch (error) {
				console.error('Failed to connect realtime chat:', error);
				if (!cancelled) {
					showToast({ message: 'Unable to connect to chat server.', type: 'error' });
				}
			} finally {
				if (!cancelled) {
					setBackgroundSetupDone(true);
				}
			}
		};

		void bootstrapBackground();

		return () => {
			cancelled = true;
		};
	}, [
		user,
		roomsBootstrapped,
		isOffline,
		backgroundSetupDone,
		e2eeInitialized,
		ensureE2EEKeys,
		deviceId,
		dispatch,
		showToast,
	]);

	useEffect(() => {
		if (!user) {
			setRoomsBootstrapped(false);
			setBackgroundSetupDone(false);
		}
	}, [user]);

	useEffect(() => {
		if (!user || !deviceId || isOffline) {
			return;
		}

		registerAndroidPushDevice({
			deviceId,
			deviceName,
		}).catch((error) => {
			console.error('Failed to register Android push device:', error);
		});
	}, [user, deviceId, deviceName, isOffline]);

	useEffect(() => {
		if (!roomsBootstrapped) {
			return;
		}

		let cancelled = false;
		const openPendingRoom = async () => {
			const pendingRoomId = await consumePendingNotificationRoomId();
			if (!pendingRoomId || cancelled) {
				return;
			}

			dispatch(setActiveRoomId(pendingRoomId));
			router.push('/room');
		};

		void openPendingRoom();

		return () => {
			cancelled = true;
		};
	}, [dispatch, roomsBootstrapped]);

	useEffect(() => {
		if (!socket) return;

		socket.on('chat_event_server_to_client', (msg: any) => {
			const mappedMessage: ChatMessage = {
				...msg,
				id: msg.id,
			};
			dispatch(
				receiveChatMessage({
					message: mappedMessage,
					currentUserUid: user?.uid,
				})
			);
		});

		socket.on('send_friend_request_server_to_client', (data: TUser) => {
			console.log('Received friend request from ' + data.name);
			const receivedFriendRequests = user?.received_friend_requests || [];
			receivedFriendRequests.push(data);
			updateUser({ received_friend_requests: receivedFriendRequests });
		});

		socket.on('respond_friend_request_server_to_client', (data: TUser) => {
			if (!user) return;

			const friendList = user.friend_list;
			const rooms = user.rooms;

			friendList.push(data);

			const newRoomId: string = genRoomId(data.uid, user.uid);
			const newRoomData: TRoomData = {
				is_group: false,
				messages: [],
				saved_messages: [],
				name: data.name,
				photo_url: data.photo_url,
				roomId: newRoomId,
			};
			rooms.push(newRoomData);

			dispatch(joinSocketRoom(newRoomId));
			dispatch(joinChatRoomWithCache(newRoomData));

			updateUser({
				friend_list: friendList,
				rooms,
			});
		});

		socket.on('chat_edit_server_to_client', (data: any) => {
			console.log('Message edited by another user:', data);
			dispatch(
				editMessageInChat({
					roomId: data.roomId,
					id: data.id,
					chatDocId: data.chatDocId,
					newText: data.newText,
				})
			);
		});

		socket.on('chat_delete_server_to_client', (data: any) => {
			console.log('Message deleted by another user:', data);
			dispatch(
				deleteMessageFromChat({
					roomId: data.roomId,
					id: data.id,
					chatDocId: data.chatDocId,
				})
			);
		});

		socket.on('chat_reaction_server_to_client', (data: any) => {
			console.log('Reaction added/removed by another user:', data);
			dispatch(
				toggleReaction({
					roomId: data.roomId,
					id: data.id,
					reactionId: data.reactionId,
					userUid: data.userUid,
					userName: data.userName,
				})
			);
		});

		socket.on('chat_save_server_to_client', (data: any) => {
			dispatch(
				saveChatMessage({
					roomId: data.roomId,
					id: data.id,
				})
			);
		});

		socket.on('presence_update', (presenceData: any) => {
			console.log('User presence changed:', presenceData);
			dispatch(updateUserPresence(presenceData));
		});

		return () => {
			socket.off('chat_event_server_to_client');
			socket.off('send_friend_request_server_to_client');
			socket.off('respond_friend_request_server_to_client');
			socket.off('chat_edit_server_to_client');
			socket.off('chat_delete_server_to_client');
			socket.off('chat_reaction_server_to_client');
			socket.off('chat_save_server_to_client');
			socket.off('presence_update');
		};
	}, [socket, user, updateUser, dispatch]);

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
			<View style={styles.content}>
				<View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
					<View style={styles.headerRow}>
						<Text style={[styles.headerTitle, { color: colors.text }]}>
							{currentTab === 'chats' ? 'Chats' : currentTab === 'updates' ? 'Friends' : 'Profile'}
						</Text>
						{isSyncing && (
							<View style={styles.syncIndicator}>
								<ActivityIndicator size="small" color={colors.primary} />
								<Text style={[styles.syncText, { color: colors.textSecondary }]}>Syncing</Text>
							</View>
						)}
					</View>
				</View>

				<View style={styles.mainContent}>{renderCurrentView()}</View>

				{currentTab === 'chats' && (
					<FAB
						icon="plus"
						style={[
							styles.fab,
							{
								backgroundColor: colors.primary,
								shadowColor: colors.primaryDark,
							},
						]}
						onPress={() => {
							void hapticMedium();
							setShowGroupModal(true);
						}}
						color={colors.primaryForeground}
					/>
				)}
			</View>

			<BottomNavBar
				activeTab={currentTab}
				onTabChange={handleTabChange}
				unreadCount={totalUnreadCount}
				pendingRequests={user?.received_friend_requests?.length || 0}
			/>

			{showGroupModal && <GroupChat onClose={() => setShowGroupModal(false)} />}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 14,
		borderBottomWidth: 2,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	headerTitle: {
		fontSize: 30,
		fontWeight: '800',
		letterSpacing: -0.6,
		flexShrink: 1,
	},
	syncIndicator: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	syncText: {
		fontSize: 12,
		fontWeight: '600',
	},
	headerSubtitle: {
		fontSize: 13,
		fontWeight: '600',
		marginTop: 2,
	},
	mainContent: {
		flex: 1,
	},
	fab: {
		position: 'absolute',
		right: 20,
		bottom: 20,
		borderRadius: 18,
		elevation: 6,
	},
});
