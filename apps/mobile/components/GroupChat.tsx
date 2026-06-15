import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
	ActivityIndicator,
	Avatar,
	Button,
	Card,
	Chip,
	Icon,
	IconButton,
	Modal,
	Portal,
	Searchbar,
	Text,
	TextInput,
} from 'react-native-paper';
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
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
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
			Alert.alert('Error', 'User not found');
			return;
		}

		if (!groupName.trim()) {
			Alert.alert('Error', 'Please enter a group name');
			return;
		}

		if (selectedMembers.length === 0) {
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
			Alert.alert('Error', getErrorMessage(error, 'Failed to create group'));
		} finally {
			setIsCreating(false);
		}
	};

	const handleUpdateGroup = async () => {
		if (!user || !roomId) {
			Alert.alert('Error', 'User not found');
			return;
		}

		if (!groupName.trim()) {
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
		} catch (error) {
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
			setSelectedMembers([]);
			setSearchQuery('');
			setShowMemberSearch(false);
		} catch (error) {
			Alert.alert('Error', getErrorMessage(error, 'Failed to add members'));
		}
	};

	const handleRemoveMember = async (memberUid: string) => {
		if (!user || !roomId) {
			Alert.alert('Error', 'User not found');
			return;
		}

		Alert.alert('Remove Member', 'Are you sure you want to remove this member from the group?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Remove',
				style: 'destructive',
				onPress: async () => {
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
					} catch (error) {
						Alert.alert('Error', getErrorMessage(error, 'Failed to remove member'));
					}
				},
			},
		]);
	};

	const handleDeleteGroup = async () => {
		if (!user || !roomId) {
			Alert.alert('Error', 'User not found');
			return;
		}

		Alert.alert('Delete Group', 'Are you sure you want to delete this group? This action cannot be undone.', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
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
						Alert.alert('Error', getErrorMessage(error, 'Failed to delete group'));
					}
				},
			},
		]);
	};

	const toggleMemberSelection = (uid: string) => {
		setSelectedMembers((previous) =>
			previous.includes(uid) ? previous.filter((id) => id !== uid) : [...previous, uid]
		);
	};

	return (
		<Portal>
			<Modal
				visible
				onDismiss={onClose}
				contentContainerStyle={{
					backgroundColor: colors.surface,
					margin: 20,
					borderRadius: 16,
					maxHeight: '90%',
					flex: 1,
				}}
			>
				<SafeAreaView style={{ flex: 1 }}>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: 16,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
						}}
					>
						<Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
							{isEditMode ? 'Edit Group' : 'Create Group'}
						</Text>
						<IconButton icon="close" onPress={onClose} iconColor={colors.textSecondary} />
					</View>

					<ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
						<View style={{ alignItems: 'center', marginBottom: 24 }}>
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
							<Button mode="text" onPress={pickGroupPhoto} icon="image-edit-outline" style={{ marginTop: 8 }}>
								Change Photo
							</Button>
						</View>

						<View style={{ marginBottom: 24 }}>
							<Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
								Group Name
							</Text>
							<TextInput
								value={groupName}
								onChangeText={setGroupName}
								placeholder="Enter group name"
								mode="outlined"
								disabled={isCreating || isUpdating}
							/>
						</View>

						{isEditMode ? (
							<View style={{ marginBottom: 24 }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
									<Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
										Group Members ({groupMembers.length})
									</Text>
									<Button mode="outlined" onPress={() => setShowMemberSearch(true)} icon="account-plus" compact>
										Add
									</Button>
								</View>

								<View style={{ gap: 8 }}>
									{groupMembers.map((uid) => (
										<Card key={uid} style={{ backgroundColor: colors.surface }}>
											<View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
												<Avatar.Image size={36} source={{ uri: getMemberPhoto(uid) }} />
												<Text style={{ flex: 1, color: colors.text, marginLeft: 12 }}>{getMemberName(uid)}</Text>
												<IconButton icon="close" size={18} onPress={() => handleRemoveMember(uid)} iconColor="#ef4444" />
											</View>
										</Card>
									))}
								</View>
							</View>
						) : (
							<View style={{ marginBottom: 24 }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
									<Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
										Selected Members ({selectedMembers.length})
									</Text>
									<Button mode="outlined" onPress={() => setShowMemberSearch(true)} icon="account-plus" compact>
										Add
									</Button>
								</View>

								<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
									{selectedMembers.length === 0 ? (
										<Text style={{ color: colors.textSecondary }}>Choose at least one friend to start the group.</Text>
									) : (
										selectedMembers.map((uid) => (
											<Chip
												key={uid}
												onClose={() => toggleMemberSelection(uid)}
												avatar={<Avatar.Image size={24} source={{ uri: getMemberPhoto(uid) }} />}
											>
												{getMemberName(uid)}
											</Chip>
										))
									)}
								</View>
							</View>
						)}

						<View style={{ gap: 12 }}>
							{isEditMode ? (
								<>
									<Button mode="contained" onPress={handleUpdateGroup} loading={isUpdating} disabled={isUpdating || isUploadingPhoto}>
										Save Changes
									</Button>
									<Button mode="outlined" onPress={handleDeleteGroup} buttonColor="#fef2f2" textColor="#dc2626">
										Delete Group
									</Button>
								</>
							) : (
								<Button
									mode="contained"
									onPress={handleCreateGroup}
									loading={isCreating}
									disabled={isCreating || isUploadingPhoto || !groupName.trim() || selectedMembers.length === 0}
								>
									Create Group
								</Button>
							)}
						</View>
					</ScrollView>
				</SafeAreaView>

				<Portal>
					<Modal
						visible={showMemberSearch}
						onDismiss={() => setShowMemberSearch(false)}
						contentContainerStyle={{
							backgroundColor: colors.surface,
							margin: 20,
							borderRadius: 16,
							maxHeight: '80%',
						}}
					>
						<View style={{ padding: 16 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
								<Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
									{isEditMode ? 'Add Members' : 'Choose Members'}
								</Text>
								<IconButton icon="close" onPress={() => setShowMemberSearch(false)} iconColor={colors.textSecondary} />
							</View>

							<Searchbar
								placeholder="Search friends"
								value={searchQuery}
								onChangeText={setSearchQuery}
								style={{ marginBottom: 16 }}
							/>

							<ScrollView showsVerticalScrollIndicator={false}>
								{filteredFriends.length === 0 ? (
									<View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
										<Icon source="account-search-outline" size={32} color={colors.textSecondary} />
										<Text style={{ color: colors.textSecondary }}>
											{availableFriends.length === 0 ? 'No more friends available to add.' : 'No matching friends found.'}
										</Text>
									</View>
								) : (
									filteredFriends.map((friend: TUser) => (
										<Card
											key={friend.uid}
											style={{ marginBottom: 8, backgroundColor: colors.surface }}
											onPress={() => toggleMemberSelection(friend.uid)}
										>
											<View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
												<Avatar.Image size={40} source={{ uri: friend.photo_url }} />
												<View style={{ flex: 1, marginLeft: 12 }}>
													<Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{friend.name}</Text>
													<Text style={{ fontSize: 12, color: colors.textSecondary }}>{friend.email}</Text>
												</View>
												{selectedMembers.includes(friend.uid) && <Icon source="check-circle" size={24} color={colors.primary} />}
											</View>
										</Card>
									))
								)}
							</ScrollView>

							<View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
								<Button mode="outlined" onPress={() => setShowMemberSearch(false)} style={{ flex: 1 }}>
									Cancel
								</Button>
								<Button
									mode="contained"
									onPress={isEditMode ? handleAddMembers : () => setShowMemberSearch(false)}
									disabled={selectedMembers.length === 0}
									style={{ flex: 1 }}
								>
									{isEditMode ? 'Add Members' : 'Done'}
								</Button>
							</View>
						</View>
					</Modal>
				</Portal>
			</Modal>
		</Portal>
	);
}
