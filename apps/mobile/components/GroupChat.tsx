import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
	ActivityIndicator,
	Avatar,
	IconButton,
	Modal,
	Portal,
	Searchbar,
	Text,
	TextInput,
} from 'react-native-paper';
import AppIcon from '~/components/ui/AppIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useUser } from '~/app/providers';
import { useTheme } from '~/lib/themeContext';
import { TRoomData, TUser } from '~/lib/types';
import { getErrorMessage, uploadFile } from '~/lib/utils';
import {
	addMembersToGroupService,
	createGroupService,
	deleteGroupService,
	removeMemberFromGroupService,
	updateGroupInfoService,
} from '~/lib/groupService';
import { setActiveRoomId } from '~/redux/chatSlice';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { AppButton, AppCard, AppChip, PressableScale } from '~/components/ui';
import { hapticError, hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '~/lib/haptics';

interface GroupChatProps {
	roomId?: string;
	onClose: () => void;
}

export default function GroupChat({ roomId, onClose }: GroupChatProps) {
	const { user, updateUser } = useUser();
	const { colors } = useTheme();
	const dispatch = useAppDispatch();
	const activeRoom = useAppSelector((state) => state.chat.rooms[roomId || '']);

	const [groupName, setGroupName] = useState(activeRoom?.name || '');
	const [groupPhotoUri, setGroupPhotoUri] = useState(activeRoom?.photo_url || '');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
	const [isCreating, setIsCreating] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
	const [showMemberSearch, setShowMemberSearch] = useState(false);

	const isEditMode = !!roomId;
	const groupMembers = activeRoom?.members || [];

	const availableFriends = useMemo(
		() =>
			user?.friend_list?.filter(
				(friend) => !selectedMembers.includes(friend.uid) && !groupMembers.includes(friend.uid)
			) || [],
		[user?.friend_list, selectedMembers, groupMembers]
	);

	const filteredFriends = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return availableFriends;
		}

		return availableFriends.filter(
			(friend) =>
				friend.name.toLowerCase().includes(query) ||
				friend.email.toLowerCase().includes(query)
		);
	}, [availableFriends, searchQuery]);

	const getMemberName = (uid: string) => {
		const friend = user?.friend_list?.find((candidate) => candidate.uid === uid);
		return friend?.name || 'Unknown User';
	};

	const getMemberPhoto = (uid: string) => {
		const friend = user?.friend_list?.find((candidate) => candidate.uid === uid);
		return friend?.photo_url || 'https://ui-avatars.com/api/?name=Member';
	};

	const updateUserRoomLocally = (transform: (rooms: TRoomData[]) => TRoomData[]) => {
		if (!user) return;
		updateUser({ rooms: transform(user.rooms || []) });
	};

	const resolveGroupPhotoUrl = async () => {
		if (!user || !groupPhotoUri || groupPhotoUri.startsWith('http')) {
			return groupPhotoUri || undefined;
		}

		setIsUploadingPhoto(true);
		try {
			return await uploadFile(user.uid, groupPhotoUri, `group-photo-${Date.now()}.jpg`, 'image/jpeg');
		} finally {
			setIsUploadingPhoto(false);
		}
	};

	const pickGroupPhoto = async () => {
		void hapticLight();
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			void hapticWarning();
			Alert.alert('Permission needed', 'Please grant photo library access');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			setGroupPhotoUri(result.assets[0].uri);
		}
	};

	const handleCreateGroup = async () => {
		if (!user) {
			void hapticError();
			Alert.alert('Error', 'User not found');
			return;
		}

		if (!groupName.trim()) {
			void hapticWarning();
			Alert.alert('Error', 'Please enter a group name');
			return;
		}

		if (selectedMembers.length === 0) {
			void hapticWarning();
			Alert.alert('Error', 'Please select at least one member');
			return;
		}

		setIsCreating(true);
		try {
			const photoUrl = await resolveGroupPhotoUrl();
			const response = (await dispatch(
				createGroupService(user, {
					name: groupName.trim(),
					photoUrl,
					memberUids: selectedMembers,
				})
			)) as any;

			if (!response?.success || !response.roomId || !response.room) {
				throw new Error(response?.error || 'Failed to create group');
			}

			updateUser({ rooms: [...(user.rooms || []), response.room] });
			void hapticSuccess();

			Alert.alert('Success', 'Group created successfully!', [
				{
					text: 'OK',
					onPress: () => {
						onClose();
						dispatch(setActiveRoomId(response.roomId));
						router.push('/room');
					},
				},
			]);
		} catch (error) {
			void hapticError();
			Alert.alert('Error', getErrorMessage(error, 'Failed to create group'));
		} finally {
			setIsCreating(false);
		}
	};

	const handleUpdateGroup = async () => {
		if (!user || !roomId) {
			void hapticError();
			Alert.alert('Error', 'User not found');
			return;
		}

		if (!groupName.trim()) {
			void hapticWarning();
			Alert.alert('Error', 'Please enter a group name');
			return;
		}

		setIsUpdating(true);
		try {
			const photoUrl = await resolveGroupPhotoUrl();
			const response = (await dispatch(
				updateGroupInfoService(user, roomId, {
					name: groupName.trim(),
					photoUrl,
				})
			)) as any;

			if (!response?.success) {
				throw new Error(response?.error || 'Failed to update group');
			}

			updateUserRoomLocally((rooms) =>
				rooms.map((room) =>
					room.roomId === roomId
						? {
								...room,
								name: groupName.trim(),
								photo_url: photoUrl || room.photo_url,
							}
						: room
				)
			);

			Alert.alert('Success', 'Group updated successfully!');
			void hapticSuccess();
		} catch (error) {
			void hapticError();
			Alert.alert('Error', getErrorMessage(error, 'Failed to update group'));
		} finally {
			setIsUpdating(false);
		}
	};

	const handleAddMembers = async () => {
		if (!user || !roomId || selectedMembers.length === 0) {
			return;
		}

		try {
			const response = (await dispatch(addMembersToGroupService(user, roomId, selectedMembers))) as any;
			if (!response?.success) {
				throw new Error(response?.error || 'Failed to add members');
			}

			updateUserRoomLocally((rooms) =>
				rooms.map((room) =>
					room.roomId === roomId
						? {
								...room,
								members: [...(room.members || []), ...selectedMembers],
							}
						: room
				)
			);

			Alert.alert('Success', 'Members added successfully!');
			void hapticSuccess();
			setSelectedMembers([]);
			setSearchQuery('');
			setShowMemberSearch(false);
		} catch (error) {
			void hapticError();
			Alert.alert('Error', getErrorMessage(error, 'Failed to add members'));
		}
	};

	const handleRemoveMember = async (memberUid: string) => {
		if (!user || !roomId) {
			void hapticError();
			Alert.alert('Error', 'User not found');
			return;
		}

		Alert.alert('Remove Member', 'Are you sure you want to remove this member from the group?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Remove',
				style: 'destructive',
				onPress: async () => {
					void hapticWarning();
					try {
						const response = (await dispatch(removeMemberFromGroupService(user, roomId, memberUid))) as any;
						if (!response?.success) {
							throw new Error(response?.error || 'Failed to remove member');
						}

						updateUserRoomLocally((rooms) =>
							rooms.map((room) =>
								room.roomId === roomId
									? {
											...room,
											members: (room.members || []).filter((uid) => uid !== memberUid),
										}
									: room
							)
						);

						Alert.alert('Success', 'Member removed successfully!');
						void hapticSuccess();
					} catch (error) {
						void hapticError();
						Alert.alert('Error', getErrorMessage(error, 'Failed to remove member'));
					}
				},
			},
		]);
	};

	const handleDeleteGroup = async () => {
		if (!user || !roomId) {
			void hapticError();
			Alert.alert('Error', 'User not found');
			return;
		}

		Alert.alert('Delete Group', 'Are you sure you want to delete this group? This action cannot be undone.', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					void hapticWarning();
					try {
						router.back();
						const response = (await dispatch(deleteGroupService(user, roomId))) as any;
						if (!response?.success) {
							throw new Error(response?.error || 'Failed to delete group');
						}

						updateUser({ rooms: (user.rooms || []).filter((room) => room.roomId !== roomId) });

						Alert.alert('Success', 'Group deleted successfully!', [
							{
								text: 'OK',
								onPress: () => {
									onClose();
								},
							},
						]);
					} catch (error) {
						void hapticError();
						Alert.alert('Error', getErrorMessage(error, 'Failed to delete group'));
					}
				},
			},
		]);
	};

	const toggleMemberSelection = (uid: string) => {
		void hapticSelection();
		setSelectedMembers((previous) =>
			previous.includes(uid) ? previous.filter((id) => id !== uid) : [...previous, uid]
		);
	};

	return (
		<Portal>
			<Modal
				visible
				onDismiss={onClose}
				contentContainerStyle={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}
			>
				<SafeAreaView style={{ flex: 1 }}>
					<View style={[styles.header, { borderBottomColor: colors.border }]}>
						<Text style={[styles.title, { color: colors.text }]}>
							{isEditMode ? 'Edit Group' : 'Create Group'}
						</Text>
						<IconButton icon="close" onPress={onClose} iconColor={colors.textSecondary} />
					</View>

					<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
						<View style={styles.photoBlock}>
							<View style={{ position: 'relative' }}>
								<Avatar.Image
									size={88}
									source={{ uri: groupPhotoUri || 'https://ui-avatars.com/api/?name=Group' }}
								/>
								{isUploadingPhoto && (
									<View
										style={{
											position: 'absolute',
											inset: 0,
											alignItems: 'center',
											justifyContent: 'center',
											backgroundColor: 'rgba(0,0,0,0.35)',
											borderRadius: 44,
										}}
									>
										<ActivityIndicator size="small" color="#fff" />
									</View>
								)}
							</View>
							<AppButton variant="ghost" compact onPress={pickGroupPhoto} icon="image-edit-outline" style={styles.photoButton}>
								Change Photo
							</AppButton>
						</View>

						<View style={styles.section}>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								Group Name
							</Text>
							<TextInput
								value={groupName}
								onChangeText={setGroupName}
								placeholder="Enter group name"
								mode="outlined"
								disabled={isCreating || isUpdating}
								outlineColor={colors.border}
								activeOutlineColor={colors.primary}
								textColor={colors.text}
								style={{ backgroundColor: colors.surface }}
							/>
						</View>

						{isEditMode ? (
							<View style={styles.section}>
								<View style={styles.sectionHeader}>
									<Text style={[styles.sectionTitle, { color: colors.text }]}>
										Group Members ({groupMembers.length})
									</Text>
									<AppButton variant="secondary" compact onPress={() => setShowMemberSearch(true)} icon="account-plus">
										Add
									</AppButton>
								</View>

								<View style={{ gap: 8 }}>
									{groupMembers.map((uid) => (
										<AppCard key={uid} style={styles.memberCard} elevated={false}>
											<View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
												<Avatar.Image size={36} source={{ uri: getMemberPhoto(uid) }} />
												<Text style={{ flex: 1, color: colors.text, marginLeft: 12 }}>{getMemberName(uid)}</Text>
												<IconButton icon="close" size={18} onPress={() => handleRemoveMember(uid)} iconColor="#ef4444" />
											</View>
										</AppCard>
									))}
								</View>
							</View>
						) : (
							<View style={styles.section}>
								<View style={styles.sectionHeader}>
									<Text style={[styles.sectionTitle, { color: colors.text }]}>
										Selected Members ({selectedMembers.length})
									</Text>
									<AppButton variant="secondary" compact onPress={() => setShowMemberSearch(true)} icon="account-plus">
										Add
									</AppButton>
								</View>

								<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
									{selectedMembers.length === 0 ? (
										<Text style={{ color: colors.textSecondary }}>Choose at least one friend to start the group.</Text>
									) : (
										selectedMembers.map((uid) => (
											<AppChip key={uid} active tone="primary" onPress={() => toggleMemberSelection(uid)}>
												{getMemberName(uid)}
											</AppChip>
										))
									)}
								</View>
							</View>
						)}

						<View style={styles.actions}>
							{isEditMode ? (
								<>
									<AppButton fullWidth onPress={handleUpdateGroup} loading={isUpdating} disabled={isUpdating || isUploadingPhoto}>
										Save Changes
									</AppButton>
									<AppButton fullWidth variant="destructive" onPress={handleDeleteGroup}>
										Delete Group
									</AppButton>
								</>
							) : (
								<AppButton
									onPress={handleCreateGroup}
									loading={isCreating}
									disabled={isCreating || isUploadingPhoto || !groupName.trim() || selectedMembers.length === 0}
									fullWidth
								>
									Create Group
								</AppButton>
							)}
						</View>
					</ScrollView>
				</SafeAreaView>

				<Portal>
					<Modal
						visible={showMemberSearch}
						onDismiss={() => setShowMemberSearch(false)}
						contentContainerStyle={[styles.memberModal, { backgroundColor: colors.surface, borderColor: colors.border }]}
					>
						<View style={styles.memberModalContent}>
							<View style={styles.memberModalHeader}>
								<Text style={[styles.title, { color: colors.text }]}>
									{isEditMode ? 'Add Members' : 'Choose Members'}
								</Text>
								<IconButton icon="close" onPress={() => setShowMemberSearch(false)} iconColor={colors.textSecondary} />
							</View>

							<Searchbar
								placeholder="Search friends"
								value={searchQuery}
								onChangeText={setSearchQuery}
								style={[styles.searchBar, { backgroundColor: colors.muted }]}
								inputStyle={{ color: colors.text }}
								placeholderTextColor={colors.textSecondary}
							/>

							<ScrollView showsVerticalScrollIndicator={false}>
								{filteredFriends.length === 0 ? (
									<View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
										<AppIcon name="account-search-outline" size={32} color={colors.textSecondary} />
										<Text style={{ color: colors.textSecondary }}>
											{availableFriends.length === 0 ? 'No more friends available to add.' : 'No matching friends found.'}
										</Text>
									</View>
								) : (
									filteredFriends.map((friend: TUser) => (
										<PressableScale
											key={friend.uid}
											style={styles.searchResult}
											onPress={() => toggleMemberSelection(friend.uid)}
										>
											<View style={[styles.searchResultInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
												<Avatar.Image size={40} source={{ uri: friend.photo_url }} />
												<View style={{ flex: 1, marginLeft: 12 }}>
													<Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{friend.name}</Text>
													<Text style={{ fontSize: 12, color: colors.textSecondary }}>{friend.email}</Text>
												</View>
												{selectedMembers.includes(friend.uid) && <AppIcon name="check-circle" size={24} color={colors.primary} />}
											</View>
										</PressableScale>
									))
								)}
							</ScrollView>

							<View style={styles.memberActions}>
								<AppButton variant="secondary" onPress={() => setShowMemberSearch(false)} style={styles.memberAction}>
									Cancel
								</AppButton>
								<AppButton
									onPress={isEditMode ? handleAddMembers : () => setShowMemberSearch(false)}
									disabled={selectedMembers.length === 0}
									style={styles.memberAction}
								>
									{isEditMode ? 'Add Members' : 'Done'}
								</AppButton>
							</View>
						</View>
					</Modal>
				</Portal>
			</Modal>
		</Portal>
	);
}

const styles = StyleSheet.create({
	modal: {
		margin: 20,
		borderRadius: 20,
		borderWidth: 2,
		maxHeight: '90%',
		flex: 1,
		overflow: 'hidden',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 2,
	},
	title: { fontSize: 20, fontWeight: '800' },
	content: { padding: 20, paddingBottom: 28 },
	photoBlock: { alignItems: 'center', marginBottom: 24 },
	photoButton: { marginTop: 8 },
	section: { marginBottom: 24 },
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
	memberCard: { marginBottom: 8, padding: 0 },
	actions: { gap: 12 },
	memberModal: { margin: 20, borderRadius: 20, borderWidth: 2, maxHeight: '80%', overflow: 'hidden' },
	memberModalContent: { padding: 20 },
	memberModalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	searchBar: { marginBottom: 16, elevation: 0 },
	searchResult: { marginBottom: 8 },
	searchResultInner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 2, borderRadius: 16 },
	memberActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
	memberAction: { flex: 1 },
});
