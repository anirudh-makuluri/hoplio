import { useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet } from 'react-native';
import {
	Modal,
	Text,
	Portal,
	Searchbar,
	IconButton,
	Avatar,
} from 'react-native-paper';
import AppIcon from '~/components/ui/AppIcon';
import { TUser } from '~/lib/types';
import { customFetch, formatLastSeen } from '~/lib/utils';
import FetchedUser from '../FetchedUser';
import { useUser } from '~/app/providers';
import FriendRequest from '../FriendRequest';
import CustomSnackbar from '../CustomSnackbar';
import { useAppSelector } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';
import { hapticLight } from '~/lib/haptics';

export default function Friends() {
	const { user } = useUser();
	const { colors } = useTheme();
	const userPresence = useAppSelector((state) => state.chat.userPresence);
	const friendList = user?.friend_list ?? [];
	const receivedRequests = user?.received_friend_requests ?? [];

	const [searchUser, setSearchUser] = useState('');
	const [fetchedUsers, setFetchedUsers] = useState<TUser[]>([]);
	const [openFetchedUsersModal, setOpenFetchedUsersModal] = useState(false);
	const [snackbarMsg, setSnackbarMsg] = useState('');

	const getUserPresence = (uid: string) => userPresence[uid];

	function handleSubmitSearch() {
		if (searchUser.trim().length === 0) return;
		void hapticLight();

		customFetch({
			pathName: 'users/search-user?searchuser=' + searchUser,
		}).then((res) => {
			if (res.requiredUsers) {
				setFetchedUsers(res.requiredUsers);
				if (res.requiredUsers.length > 0) setOpenFetchedUsersModal(true);
				else setSnackbarMsg('No users found');
			}
		});
	}

	function closeModal() {
		setOpenFetchedUsersModal(false);
	}

	const renderEmptyState = () => (
		<View style={styles.emptyContainer}>
			<View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
				<AppIcon name="account-multiple" size={48} color={colors.primary} />
			</View>
			<Text style={[styles.emptyTitle, { color: colors.text }]}>No friend requests</Text>
			<Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
				When someone sends you a request, it will show up here. Search above to add people.
			</Text>
		</View>
	);

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<View style={[styles.searchSection, { borderBottomColor: colors.border }]}>
				<View style={styles.searchRow}>
					<View
						style={[
							styles.searchWrap,
							{ backgroundColor: colors.muted, borderColor: colors.border },
						]}
					>
						<Searchbar
							placeholder="Search for a friend"
							value={searchUser}
							onChangeText={setSearchUser}
							onSubmitEditing={handleSubmitSearch}
							style={styles.searchBar}
							placeholderTextColor={colors.textSecondary}
							inputStyle={{ color: colors.text }}
						/>
					</View>
					<IconButton
						icon="magnify"
						mode="contained"
						size={24}
						iconColor="#fff"
						onPress={handleSubmitSearch}
						style={{ backgroundColor: colors.primary, borderRadius: 14 }}
					/>
				</View>
				<View style={styles.statsRow}>
					<View style={styles.stat}>
						<View style={[styles.statDot, { backgroundColor: colors.primary }]} />
						<Text style={[styles.statText, { color: colors.textSecondary }]}>
							{friendList.length} friends
						</Text>
					</View>
					<View style={styles.stat}>
						<View style={[styles.statDot, { backgroundColor: colors.accent }]} />
						<Text style={[styles.statText, { color: colors.textSecondary }]}>
							{receivedRequests.length} requests
						</Text>
					</View>
				</View>
			</View>

			{friendList.length > 0 && (
				<View style={styles.friendsBlock}>
					<View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
						<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
							Friends ({friendList.length})
						</Text>
					</View>
					<FlatList
						data={friendList}
						keyExtractor={(item) => item.uid}
						renderItem={({ item }) => {
							const presence = getUserPresence(item.uid);
							const isOnline = presence?.is_online;
							const subtitle = isOnline
								? 'Online'
								: presence?.last_seen
									? `Last seen ${formatLastSeen(presence.last_seen)}`
									: 'Offline';

							return (
								<View
									style={[
										styles.friendCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<View style={styles.friendRow}>
										<View style={styles.avatarWrap}>
											<Avatar.Image size={48} source={{ uri: item.photo_url }} />
											<View
												style={[
													styles.presenceDot,
													{
														borderColor: colors.surface,
														backgroundColor: isOnline ? colors.primary : colors.textSecondary,
													},
												]}
											/>
										</View>
										<View style={styles.friendInfo}>
											<Text style={[styles.friendName, { color: colors.text }]}>{item.name}</Text>
											<Text style={[styles.friendSub, { color: colors.textSecondary }]}>
												{subtitle}
											</Text>
										</View>
									</View>
								</View>
							);
						}}
						showsVerticalScrollIndicator={false}
					/>
				</View>
			)}

			{receivedRequests.length === 0 ? (
				renderEmptyState()
			) : (
				<View style={styles.requestsBlock}>
					<View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
						<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
							Friend Requests ({receivedRequests.length})
						</Text>
					</View>
					<FlatList
						data={receivedRequests}
						keyExtractor={(item) => item.uid}
						renderItem={({ item }) => <FriendRequest invitedUser={item} />}
						showsVerticalScrollIndicator={false}
					/>
				</View>
			)}

			<Portal>
				<Modal
					contentContainerStyle={[
						styles.modal,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
					visible={openFetchedUsersModal}
					onDismiss={closeModal}
				>
					<View style={styles.modalHeader}>
						<View>
							<Text style={[styles.modalTitle, { color: colors.text }]}>Search Results</Text>
							<Text style={[styles.modalSub, { color: colors.textSecondary }]}>
								Found {fetchedUsers.length} users
							</Text>
						</View>
						<IconButton icon="close" onPress={closeModal} iconColor={colors.textSecondary} />
					</View>

					<ScrollView showsVerticalScrollIndicator={false}>
						{fetchedUsers.map((fetchedUser) => (
							<FetchedUser
								closeModal={closeModal}
								fetchedUser={fetchedUser}
								key={fetchedUser.uid}
							/>
						))}
					</ScrollView>
				</Modal>
			</Portal>

			<CustomSnackbar setSnackbarMsg={setSnackbarMsg} snackbarMsg={snackbarMsg} />
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	searchSection: {
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 2,
	},
	searchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 12,
	},
	searchWrap: {
		flex: 1,
		borderRadius: 16,
		borderWidth: 2,
		overflow: 'hidden',
	},
	searchBar: {
		backgroundColor: 'transparent',
		elevation: 0,
	},
	statsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 20,
	},
	stat: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	statDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	statText: {
		fontSize: 14,
		fontWeight: '600',
	},
	friendsBlock: {
		maxHeight: 260,
	},
	requestsBlock: {
		flex: 1,
	},
	sectionHeader: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 2,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	friendCard: {
		marginHorizontal: 16,
		marginVertical: 6,
		borderRadius: 16,
		borderWidth: 2,
		padding: 12,
	},
	friendRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatarWrap: {
		position: 'relative',
	},
	presenceDot: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: 2,
	},
	friendInfo: {
		flex: 1,
		marginLeft: 12,
	},
	friendName: {
		fontSize: 16,
		fontWeight: '700',
	},
	friendSub: {
		fontSize: 12,
		marginTop: 2,
		fontWeight: '600',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
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
		textAlign: 'center',
		fontSize: 15,
		lineHeight: 22,
	},
	modal: {
		padding: 20,
		margin: 20,
		borderRadius: 18,
		maxHeight: '80%',
		borderWidth: 2,
	},
	modalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '800',
	},
	modalSub: {
		fontSize: 14,
		marginTop: 2,
		fontWeight: '600',
	},
});
