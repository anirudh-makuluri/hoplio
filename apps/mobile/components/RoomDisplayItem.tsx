import { router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar, Text, Badge, Icon } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { TRoomData } from '~/lib/types';
import { setActiveRoomId } from '~/redux/chatSlice';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';

export default function RoomDisplayItem({ roomData }: { roomData: TRoomData }) {
	const dispatch = useAppDispatch();
	const { user } = useUser();
	const { colors, isDark } = useTheme();
	const rooms = useAppSelector((state) => state.chat.rooms);

	function changeActiveRoom() {
		if (!user) return;
		dispatch(setActiveRoomId(roomData.roomId));
		router.push('/room');
	}

	function getLastMessage() {
		if (!user || rooms[roomData.roomId] == null) return 'Start a conversation';

		const currentMessages = rooms[roomData.roomId].messages;
		if (currentMessages.length == 0) return 'Start a conversation';

		const lastMessage = currentMessages[currentMessages.length - 1];
		if (lastMessage.isDate) {
			// Get the message before the date
			if (currentMessages.length < 2) return 'Start a conversation';
			const prevMessage = currentMessages[currentMessages.length - 2];
			if (prevMessage.isDate) return 'Start a conversation';
			return formatMessagePreview(prevMessage);
		}
		return formatMessagePreview(lastMessage);
	}

	function formatMessagePreview(msg: any) {
		const isAIMessage = msg.isAIMessage || msg.userUid === 'ai-assistant';
		const senderName = msg.userUid == user?.uid ? 'You' : isAIMessage ? 'AI' : msg.userName?.split(' ')[0];

		if (msg.isEncrypted) {
			return `${senderName}: Secure message`;
		}

		if (msg.type === 'text') {
			const preview = msg.chatInfo?.length > 35 ? msg.chatInfo.substring(0, 35) + '...' : msg.chatInfo;
			return `${senderName}: ${preview}`;
		} else if (msg.type === 'image') {
			return `${senderName}: 📷 Photo`;
		} else if (msg.type === 'file') {
			return `${senderName}: 📎 ${msg.fileName || 'File'}`;
		}
		return `${senderName}: Attachment`;
	}

	function getLastMessageTime() {
		if (!user || rooms[roomData.roomId] == null) return '';

		const currentMessages = rooms[roomData.roomId].messages;
		if (currentMessages.length == 0) return '';

		const lastMessage = currentMessages[currentMessages.length - 1];
		if (!lastMessage.time || lastMessage.isDate) return '';

		const messageTime = new Date(lastMessage.time);
		const now = new Date();
		const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

		if (diffInHours < 24) {
			return messageTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
		} else if (diffInHours < 24 * 7) {
			return messageTime.toLocaleDateString([], { weekday: 'short' });
		}
		return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	const isAIRoom = roomData.is_ai_room || roomData.roomId.startsWith('ai-assistant-');
	const unreadCount = 0; // TODO: Implement unread count

	return (
		<TouchableOpacity
			onPress={changeActiveRoom}
			style={[styles.container, { backgroundColor: colors.background }]}
			activeOpacity={0.7}
		>
			<View style={styles.avatarContainer}>
				<Avatar.Image
					size={54}
					source={{
						uri: isAIRoom
							? 'https://ui-avatars.com/api/?name=AI&background=6366f1&color=ffffff'
							: roomData.photo_url || 'https://ui-avatars.com/api/?name=' + roomData.name,
					}}
				/>
				{/* Online indicator or group badge */}
				{isAIRoom ? (
					<View style={[styles.badge, { backgroundColor: '#6366f1' }]}>
						<Text style={styles.badgeText}>AI</Text>
					</View>
				) : roomData.is_group ? (
					<View style={[styles.badge, { backgroundColor: colors.primary }]}>
						<Icon source="account-multiple" size={12} color="#fff" />
					</View>
				) : null}
			</View>

			<View style={styles.content}>
				<View style={styles.topRow}>
					<Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
						{roomData.name}
					</Text>
					<Text style={[styles.time, { color: colors.textSecondary }]}>{getLastMessageTime()}</Text>
				</View>
				<View style={styles.bottomRow}>
					<Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
						{getLastMessage()}
					</Text>
					{unreadCount > 0 && (
						<Badge size={20} style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
							{unreadCount}
						</Badge>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	avatarContainer: {
		position: 'relative',
		marginRight: 14,
	},
	badge: {
		position: 'absolute',
		bottom: -2,
		right: -2,
		width: 22,
		height: 22,
		borderRadius: 11,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: '#fff',
	},
	badgeText: {
		color: '#fff',
		fontSize: 9,
		fontWeight: '700',
	},
	content: {
		flex: 1,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	name: {
		fontSize: 16,
		fontWeight: '600',
		flex: 1,
		marginRight: 8,
	},
	time: {
		fontSize: 13,
	},
	bottomRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	preview: {
		fontSize: 14,
		flex: 1,
		marginRight: 8,
	},
	unreadBadge: {
		marginLeft: 8,
	},
});
