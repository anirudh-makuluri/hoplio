import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Avatar, Badge, Icon, Text } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { TRoomData } from '~/lib/types';
import { useTheme } from '~/lib/themeContext';
import { setActiveRoomId } from '~/redux/chatSlice';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import PressableScale from '~/components/ui/PressableScale';
import { hapticLight } from '~/lib/haptics';

export default function RoomDisplayItem({ roomData }: { roomData: TRoomData }) {
	const dispatch = useAppDispatch();
	const { user } = useUser();
	const { colors } = useTheme();
	const rooms = useAppSelector((state) => state.chat.rooms);
	const unreadCount = useAppSelector((state) => state.chat.unreadCounts[roomData.roomId] || 0);

	function changeActiveRoom() {
		if (!user) return;
		void hapticLight();
		dispatch(setActiveRoomId(roomData.roomId));
		router.push('/room');
	}

	function getLastMessage() {
		if (!user || rooms[roomData.roomId] == null) return 'Start a conversation';

		const currentMessages = rooms[roomData.roomId].messages;
		if (currentMessages.length == 0) return 'Start a conversation';

		const lastMessage = currentMessages[currentMessages.length - 1];
		if (lastMessage.isDate) {
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
		}

		if (msg.type === 'image') {
			return `${senderName}: Photo`;
		}

		if (msg.type === 'gif') {
			return `${senderName}: GIF`;
		}

		if (msg.type === 'file') {
			return `${senderName}: ${msg.fileName || 'File'}`;
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
		}
		if (diffInHours < 24 * 7) {
			return messageTime.toLocaleDateString([], { weekday: 'short' });
		}
		return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	const isAIRoom = roomData.is_ai_room || roomData.roomId.startsWith('ai-assistant-');

	return (
		<PressableScale
			onPress={changeActiveRoom}
			haptic="none"
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<View style={styles.avatarContainer}>
				<Avatar.Image
					size={54}
					source={{
						uri: isAIRoom
							? `https://ui-avatars.com/api/?name=AI&background=CE82FF&color=ffffff`
							: roomData.photo_url || `https://ui-avatars.com/api/?name=${roomData.name}`,
					}}
				/>
				{isAIRoom ? (
					<View style={[styles.badge, { backgroundColor: colors.ai, borderColor: colors.background }]}>
						<Text style={styles.badgeText}>AI</Text>
					</View>
				) : roomData.is_group ? (
					<View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
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
					<Text
						style={[
							styles.preview,
							{
								color: unreadCount > 0 ? colors.text : colors.textSecondary,
								fontWeight: unreadCount > 0 ? '700' : '400',
							},
						]}
						numberOfLines={1}
					>
						{getLastMessage()}
					</Text>
					{unreadCount > 0 && (
						<Badge size={22} style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
							{unreadCount > 99 ? '99+' : unreadCount}
						</Badge>
					)}
				</View>
			</View>
		</PressableScale>
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
	},
	badgeText: {
		color: '#fff',
		fontSize: 9,
		fontWeight: '800',
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
		fontWeight: '700',
		flex: 1,
		marginRight: 8,
	},
	time: {
		fontSize: 12,
		fontWeight: '600',
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
