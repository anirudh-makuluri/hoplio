import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Icon, FAB } from 'react-native-paper';
import { useUser } from './providers';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { initAndJoinSocketRooms, joinSocketRoom, syncPendingMessages } from '~/redux/socketSlice';
import {
	addMessage,
	clearRoomData,
	joinChatRoom,
	editMessageInChat,
	deleteMessageFromChat,
	saveChatMessage,
	toggleReaction,
	updateUserPresence,
	setOfflineMode,
	setActiveRoomId,
} from '~/redux/chatSlice';
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
	useE2EEInitialization,
	useDeviceId,
	useEnsureE2EEKeys,
	useE2EESyncingKeys,
} from '~/lib/hooks/useE2EE';
import {
	consumePendingNotificationRoomId,
	initializeNotificationResponseTracking,
	registerAndroidPushDevice,
} from '~/lib/pushNotifications';
import { hapticMedium } from '~/lib/haptics';

type TabType = 'chats' | 'updates' | 'profile';

export default function Page() {
	const { user, isLoading, updateUser, logout, isOffline } = useUser();
	const { colors, isDark } = useTheme();
	const { showToast } = useToast();
	const socket = useAppSelector((state) => state.socket.socket);
	const activeChatRoomId = useAppSelector((state) => state.chat.activeChatRoomId);
	const unreadCounts = useAppSelector((state) => state.chat.unreadCounts);
	const deviceName = useAppSelector((state) => state.e2ee.deviceState?.deviceName);
	const dispatch = useAppDispatch();
	const reduxDispatch = useDispatch();
	const e2eeInitialized = useE2EEInitialization();
	const deviceId = useDeviceId();
	const ensureE2EEKeys = useEnsureE2EEKeys();
	const isSyncingE2EEKeys = useE2EESyncingKeys();
	const [currentTab, setCurrentTab] = useState<TabType>('chats');
	const [showGroupModal, setShowGroupModal] = useState(false);
	const [roomsBootstrapped, setRoomsBootstrapped] = useState(false);
	const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

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
		let cancelled = false;

		const bootstrapRooms = async () => {
			try {
				if (!isLoading && !user) {
					router.replace('/auth');
					return;
				}

				if (!user || !e2eeInitialized) {
					return;
				}

				dispatch(setOfflineMode(isOffline || false));

				const roomIds: string[] = Array.isArray(user.rooms) ? user.rooms.map((room) => room.roomId) : [];
				const e2eeRoomIds = roomIds.filter((roomId) => !roomId.startsWith('ai-assistant-'));

				if (!isOffline) {
					await ensureE2EEKeys(user.uid, e2eeRoomIds);

					dispatch(
						initAndJoinSocketRooms(roomIds, {
							email: user.email,
							name: user.name,
							photo_url: user.photo_url,
							uid: user.uid,
							deviceId,
						})
					);

					dispatch(syncPendingMessages());
				}

				if (Array.isArray(user.rooms)) {
					user.rooms.forEach((roomData) => {
						dispatch(joinChatRoom(roomData));
					});
				}

				if (!cancelled) {
					setRoomsBootstrapped(true);
				}
			} catch (error) {
				console.error('Failed to bootstrap mobile rooms:', error);
				if (!cancelled) {
					showToast({ message: 'Unable to finish secure room setup.', type: 'error' });
				}
			}
		};

		if (!roomsBootstrapped) {
			void bootstrapRooms();
		}

		return () => {
			cancelled = true;
		};
	}, [user, isLoading, isOffline, e2eeInitialized, ensureE2EEKeys, roomsBootstrapped, dispatch, router, deviceId]);

	useEffect(() => {
		if (!user) {
			setRoomsBootstrapped(false);
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
				addMessage({
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
			dispatch(joinChatRoom(newRoomData));

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

	if (user && (!e2eeInitialized || !roomsBootstrapped || isSyncingE2EEKeys)) {
		return (
			<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
				<View style={[styles.comingSoonContainer, { backgroundColor: colors.background }]}>
					<View style={[styles.comingSoonIcon, { backgroundColor: isDark ? colors.surface : colors.muted }]}>
						<Icon source="shield-lock" size={64} color={colors.primary} />
					</View>
					<Text style={[styles.comingSoonTitle, { color: colors.text }]}>Securing your chats</Text>
					<Text style={[styles.comingSoonMessage, { color: colors.textSecondary }]}>
						Preparing device keys and loading your rooms.
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
			<View style={styles.content}>
				<View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
					<Text style={[styles.headerTitle, { color: colors.text }]}>
						{currentTab === 'chats' ? 'Chats' : currentTab === 'updates' ? 'Friends' : 'Profile'}
					</Text>
					{currentTab === 'chats' ? (
						<Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
							Keep the streak going
						</Text>
					) : null}
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
	headerTitle: {
		fontSize: 30,
		fontWeight: '800',
		letterSpacing: -0.6,
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
	comingSoonContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 40,
	},
	comingSoonIcon: {
		width: 120,
		height: 120,
		borderRadius: 60,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 24,
	},
	comingSoonTitle: {
		fontSize: 24,
		fontWeight: '800',
		marginBottom: 8,
	},
	comingSoonMessage: {
		fontSize: 16,
		textAlign: 'center',
	},
});
