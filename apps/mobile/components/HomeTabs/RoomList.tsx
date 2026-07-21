import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import RoomDisplayItem from '../RoomDisplayItem';
import FilterTabs, { FilterType } from '../FilterTabs';
import { useUser } from '~/app/providers';
import { useTheme } from '~/lib/themeContext';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { joinChatRoomWithCache } from '~/redux/chatThunks';
import { setActiveRoomId } from '~/redux/chatSlice';
import { joinSocketRoom } from '~/redux/socketSlice';
import { createAIAssistantRoom, getErrorMessage } from '~/lib/utils';
import { useToast } from '../Toast';
import { AppButton } from '~/components/ui';
import AppIcon from '~/components/ui/AppIcon';
import PressableScale from '~/components/ui/PressableScale';
import { hapticLight } from '~/lib/haptics';

interface RoomListProps {
	onCreateGroup?: () => void;
}

export default function RoomList({ onCreateGroup }: RoomListProps) {
	const { user, updateUser } = useUser();
	const { colors, isDark } = useTheme();
	const { showToast } = useToast();
	const dispatch = useAppDispatch();
	const rooms = useAppSelector((state) => state.chat.rooms);
	const [activeFilter, setActiveFilter] = useState<FilterType>('all');

	const filteredRooms = useMemo(() => {
		if (!user?.rooms) return [];

		let nextRooms = user.rooms;

		if (activeFilter === 'groups') {
			nextRooms = nextRooms.filter((room) => room.is_group === true);
		}

		return nextRooms;
	}, [user?.rooms, activeFilter]);

	const aiRoom = user?.rooms?.find((room) => room.is_ai_room);

	const openAIRoom = async () => {
		if (!user) {
			return;
		}

		void hapticLight();

		try {
			if (aiRoom) {
				if (!rooms[aiRoom.roomId]) {
					dispatch(joinSocketRoom(aiRoom.roomId));
					dispatch(joinChatRoomWithCache(aiRoom));
				}

				dispatch(setActiveRoomId(aiRoom.roomId));
				router.push('/room');
				return;
			}

			const response = await createAIAssistantRoom(user.uid);
			if (!response.success || !response.room || !response.roomId) {
				throw new Error(response.error || 'Unable to create AI assistant room');
			}

			dispatch(joinSocketRoom(response.roomId));
			dispatch(joinChatRoomWithCache(response.room));
			dispatch(setActiveRoomId(response.roomId));
			updateUser({ rooms: [...(user.rooms || []), response.room] });
			router.push('/room');
		} catch (error) {
			showToast({ message: getErrorMessage(error, 'Unable to open AI assistant'), type: 'error' });
		}
	};

	const renderEmptyState = () => (
		<View style={styles.emptyContainer}>
			<View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.surface : '#D7FFB8' }]}>
				<AppIcon name="chat" size={48} color={colors.primaryDark} />
			</View>
			<Text style={[styles.emptyTitle, { color: colors.text }]}>No chats yet</Text>
			<Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
				Add friends or start a group — your conversations will land here.
			</Text>
			{onCreateGroup && (
				<AppButton onPress={onCreateGroup} icon="account-multiple-plus" fullWidth style={styles.createButton}>
					Create Group Chat
				</AppButton>
			)}
		</View>
	);

	const renderNoResults = () => (
		<View style={styles.emptyContainer}>
			<View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.surface : colors.muted }]}>
				<AppIcon name="account-group" size={40} color={colors.textSecondary} />
			</View>
			<Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
			<Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
				Create a group to chat with multiple friends at once.
			</Text>
			{onCreateGroup && (
				<AppButton onPress={onCreateGroup} icon="account-multiple-plus" fullWidth style={styles.createButton}>
					Create Group
				</AppButton>
			)}
		</View>
	);

	const ListHeader = () => (
		<>
			<FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />

			<PressableScale
				style={[
					styles.aiCard,
					{
						backgroundColor: colors.surface,
						borderColor: colors.ai,
					},
				]}
				haptic="none"
				onPress={openAIRoom}
			>
				<View style={[styles.aiIcon, { backgroundColor: colors.aiSoft }]}>
					<AppIcon name="robot-happy-outline" size={24} color={colors.ai} />
				</View>
				<View style={styles.aiContent}>
					<Text style={[styles.aiTitle, { color: colors.text }]}>AI Assistant</Text>
					<Text style={[styles.aiDescription, { color: colors.textSecondary }]}>
						{aiRoom ? 'Open your assistant room' : 'Create a private AI assistant room'}
					</Text>
				</View>
				<AppIcon name="chevron-right" size={22} color={colors.ai} />
			</PressableScale>
		</>
	);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			{user?.rooms && user.rooms.length > 0 ? (
				<FlatList
					data={filteredRooms}
					ListHeaderComponent={ListHeader}
					renderItem={({ item }) => <RoomDisplayItem roomData={item} />}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.listContent}
					keyExtractor={(item) => item.roomId}
					ListEmptyComponent={renderNoResults}
				/>
			) : (
				<>
					<ListHeader />
					{renderEmptyState()}
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContent: {
		paddingBottom: 100,
	},
	aiCard: {
		marginHorizontal: 16,
		marginTop: 12,
		marginBottom: 8,
		paddingHorizontal: 14,
		paddingVertical: 14,
		borderRadius: 16,
		borderWidth: 2,
		flexDirection: 'row',
		alignItems: 'center',
	},
	aiIcon: {
		width: 46,
		height: 46,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	aiContent: {
		flex: 1,
	},
	aiTitle: {
		fontSize: 16,
		fontWeight: '800',
		marginBottom: 2,
	},
	aiDescription: {
		fontSize: 13,
		lineHeight: 18,
		fontWeight: '500',
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
		paddingVertical: 48,
	},
	emptyIcon: {
		width: 96,
		height: 96,
		borderRadius: 48,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 24,
	},
	emptyTitle: {
		fontSize: 22,
		fontWeight: '800',
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyMessage: {
		fontSize: 15,
		textAlign: 'center',
		lineHeight: 22,
		marginBottom: 24,
	},
	createButton: {
		maxWidth: 280,
	},
});
