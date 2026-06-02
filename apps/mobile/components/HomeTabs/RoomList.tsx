import React, { useState, useMemo } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Button } from 'react-native-paper';
import RoomDisplayItem from '../RoomDisplayItem';
import StatusRow from '../StatusRow';
import FilterTabs, { FilterType } from '../FilterTabs';
import { useUser } from '~/app/providers';
import { useTheme } from '~/lib/themeContext';
import { useToast } from '../Toast';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { joinChatRoom, setActiveRoomId } from '~/redux/chatSlice';
import { joinSocketRoom } from '~/redux/socketSlice';
import { createAIAssistantRoom, getErrorMessage } from '~/lib/utils';
import { router } from 'expo-router';

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

	const insets = useSafeAreaInsets();

	const filteredRooms = useMemo(() => {
		if (!user?.rooms) return [];
		
		let rooms = user.rooms;
		
		// Apply filter
		if (activeFilter === 'groups') {
			rooms = rooms.filter((room) => room.is_group === true);
		}
		
		return rooms;
	}, [user?.rooms, activeFilter]);

	const handleComingSoon = () => {
		showToast({ message: 'This feature is coming soon!', type: 'coming-soon' });
	};

	const aiRoom = user?.rooms?.find((room) => room.is_ai_room);

	const openAIRoom = async () => {
		if (!user) {
			return;
		}

		try {
			if (aiRoom) {
				if (!rooms[aiRoom.roomId]) {
					dispatch(joinSocketRoom(aiRoom.roomId));
					dispatch(joinChatRoom(aiRoom));
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
			dispatch(joinChatRoom(response.room));
			dispatch(setActiveRoomId(response.roomId));
			updateUser({ rooms: [...(user.rooms || []), response.room] });
			router.push('/room');
		} catch (error) {
			showToast({ message: getErrorMessage(error, 'Unable to open AI assistant'), type: 'error' });
		}
	};

	const renderEmptyState = () => (
		<View style={styles.emptyContainer}>
			<View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.surface : colors.muted }]}>
				<Icon source="chat" size={48} color={colors.primary} />
			</View>
			<Text style={[styles.emptyTitle, { color: colors.text }]}>No Chats Yet</Text>
			<Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
				Start a conversation by adding friends or creating a group chat
			</Text>
			<View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
				<Text style={[styles.tipText, { color: colors.primary }]}>
					💡 Go to Friends tab to add new friends and start chatting!
				</Text>
			</View>
			{onCreateGroup && (
				<Button
					mode="contained"
					onPress={onCreateGroup}
					icon="account-multiple-plus"
					style={[styles.createButton, { backgroundColor: colors.primary }]}
				>
					Create Group Chat
				</Button>
			)}
		</View>
	);

	const renderNoResults = () => (
		<View style={styles.emptyContainer}>
			<View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.surface : colors.muted }]}>
				<Icon
					source={activeFilter === 'groups' ? 'account-group' : 'magnify'}
					size={40}
					color={colors.textSecondary}
				/>
			</View>
			<Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
				{activeFilter === 'groups' ? 'No Groups Yet' : 'No Results Found'}
			</Text>
			<Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
				{activeFilter === 'groups'
					? 'Create a group to start chatting with multiple friends'
					: 'Try a different filter'}
			</Text>
			{activeFilter === 'groups' && onCreateGroup && (
				<Button
					mode="contained"
					onPress={onCreateGroup}
					icon="account-multiple-plus"
					style={[styles.createButton, { backgroundColor: colors.primary }]}
				>
					Create Group
				</Button>
			)}
		</View>
	);

	const ListHeader = () => (
		<>
			{/* Stories/Status Row */}
			<StatusRow onAddStatusPress={handleComingSoon} />

			{/* Filter Tabs */}
			<FilterTabs
				activeFilter={activeFilter}
				onFilterChange={setActiveFilter}
				onComingSoon={handleComingSoon}
			/>

			<TouchableOpacity
				style={[styles.aiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
				activeOpacity={0.8}
				onPress={openAIRoom}
			>
				<View style={[styles.aiIcon, { backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : '#eef2ff' }]}>
					<Icon source="robot-happy-outline" size={24} color="#6366f1" />
				</View>
				<View style={styles.aiContent}>
					<Text style={[styles.aiTitle, { color: colors.text }]}>AI Assistant</Text>
					<Text style={[styles.aiDescription, { color: colors.textSecondary }]}>
						{aiRoom ? 'Open your assistant room' : 'Create a private AI assistant room'}
					</Text>
				</View>
			</TouchableOpacity>
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
		marginBottom: 4,
		paddingHorizontal: 14,
		paddingVertical: 14,
		borderRadius: 18,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	aiIcon: {
		width: 46,
		height: 46,
		borderRadius: 23,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	aiContent: {
		flex: 1,
	},
	aiTitle: {
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 2,
	},
	aiDescription: {
		fontSize: 13,
		lineHeight: 18,
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
		fontWeight: '700',
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyMessage: {
		fontSize: 15,
		textAlign: 'center',
		lineHeight: 22,
		marginBottom: 24,
	},
	tipCard: {
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		marginBottom: 20,
	},
	tipText: {
		textAlign: 'center',
		fontWeight: '600',
		fontSize: 14,
	},
	createButton: {
		borderRadius: 12,
	},
});
