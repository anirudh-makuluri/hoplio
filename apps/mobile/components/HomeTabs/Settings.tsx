import React, { useState } from 'react';
import { View, Alert, StyleSheet, ScrollView } from 'react-native';
import {
	Avatar,
	Text,
	IconButton,
	TextInput,
	ActivityIndicator,
	Switch,
	List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '~/app/providers';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { getErrorMessage, updateUserName, updateUserProfilePicture, uploadProfilePicture } from '~/lib/utils';
import { useTheme as useAppTheme } from '~/lib/themeContext';
import * as ImagePicker from 'expo-image-picker';
import { clearRoomData } from '~/redux/chatSlice';
import { AppButton, AppCard } from '~/components/ui';
import { hapticLight, hapticSelection, hapticSuccess, hapticError } from '~/lib/haptics';

export default function Settings() {
	const { user, updateUser, logout, isLoggingOut } = useUser();
	const { isDark, toggleTheme, colors } = useAppTheme();
	const socket = useAppSelector((state) => state.socket.socket);
	const dispatch = useAppDispatch();

	const [isEditingName, setIsEditingName] = useState(false);
	const [newName, setNewName] = useState(user?.name || '');
	const [isUploading, setIsUploading] = useState(false);

	const handleNameUpdate = async () => {
		if (!user || !socket || newName.trim() === '') return;

		try {
			await updateUserName(socket, user.uid, newName.trim());
			updateUser({ name: newName.trim() });
			setIsEditingName(false);
			void hapticSuccess();
			Alert.alert('Success', 'Name updated successfully');
		} catch (error) {
			void hapticError();
			Alert.alert('Error', getErrorMessage(error, 'Failed to update name'));
		}
	};

	const handleImagePicker = async () => {
		if (!user) return;
		void hapticLight();

		try {
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission required', 'Please grant photo library access');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.8,
			});

			if (!result.canceled && result.assets[0]) {
				setIsUploading(true);

				const downloadUrl = await uploadProfilePicture(user.uid, result.assets[0].uri);
				await updateUserProfilePicture(socket, user.uid, downloadUrl);
				updateUser({ photo_url: downloadUrl });
				void hapticSuccess();
				Alert.alert('Success', 'Profile picture updated successfully');
			}
		} catch (error) {
			void hapticError();
			Alert.alert('Error', getErrorMessage(error, 'Failed to update profile picture'));
		} finally {
			setIsUploading(false);
		}
	};

	const handleLogout = () => {
		void hapticLight();
		dispatch(clearRoomData());
		logout();
	};

	return (
		<SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['left', 'right']}>
			<ScrollView contentContainerStyle={styles.scroll}>
				{user && (
					<View style={styles.profileBlock}>
						<View style={styles.avatarWrap}>
							<Avatar.Image
								size={120}
								source={{ uri: user.photo_url }}
								style={{ borderWidth: 4, borderColor: colors.primary }}
							/>
							<IconButton
								icon="image-edit-outline"
								size={20}
								onPress={handleImagePicker}
								disabled={isUploading}
								iconColor={colors.primaryForeground}
								style={[styles.editPhotoBtn, { backgroundColor: colors.primary }]}
							/>
							{isUploading && (
								<View style={styles.uploadOverlay}>
									<ActivityIndicator size="small" color="#fff" />
								</View>
							)}
						</View>

						<View style={styles.nameBlock}>
							{isEditingName ? (
								<View style={styles.editRow}>
									<TextInput
										value={newName}
										onChangeText={setNewName}
										style={styles.nameInput}
										mode="outlined"
										placeholder="Enter new name"
										outlineColor={colors.border}
										activeOutlineColor={colors.primary}
										textColor={colors.text}
									/>
									<IconButton icon="check" onPress={handleNameUpdate} iconColor={colors.primary} />
									<IconButton
										icon="close"
										onPress={() => {
											setIsEditingName(false);
											setNewName(user.name);
										}}
										iconColor={colors.destructive}
									/>
								</View>
							) : (
								<View style={styles.nameRow}>
									<Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
									<IconButton
										icon="pencil"
										size={20}
										onPress={() => {
											void hapticLight();
											setIsEditingName(true);
										}}
										iconColor={colors.primaryDark}
									/>
								</View>
							)}
							<Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
						</View>
					</View>
				)}

				<AppCard style={styles.card}>
					<Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
					<List.Item
						title="Dark Mode"
						titleStyle={{ color: colors.text, fontWeight: '700' }}
						description={isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}
						descriptionStyle={{ color: colors.textSecondary }}
						left={(props) => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
						right={() => (
							<Switch
								value={isDark}
								onValueChange={() => {
									void hapticSelection();
									toggleTheme();
								}}
								color={colors.primary}
							/>
						)}
					/>
				</AppCard>

				<AppButton
					variant="secondary"
					icon="logout"
					onPress={handleLogout}
					loading={isLoggingOut}
					disabled={isLoggingOut}
					fullWidth
					style={styles.logout}
				>
					{isLoggingOut ? 'Logging out...' : 'Logout'}
				</AppButton>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	scroll: {
		paddingHorizontal: 20,
		paddingVertical: 24,
	},
	profileBlock: {
		alignItems: 'center',
		marginBottom: 28,
		gap: 16,
	},
	avatarWrap: {
		position: 'relative',
	},
	editPhotoBtn: {
		position: 'absolute',
		bottom: 0,
		right: 0,
	},
	uploadOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.45)',
		borderRadius: 60,
		alignItems: 'center',
		justifyContent: 'center',
	},
	nameBlock: {
		alignItems: 'center',
	},
	editRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	nameInput: {
		width: 200,
	},
	nameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	name: {
		fontSize: 26,
		fontWeight: '800',
	},
	email: {
		fontSize: 15,
		fontWeight: '600',
		marginTop: 4,
	},
	card: {
		marginBottom: 16,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: '800',
		marginBottom: 4,
	},
	logout: {
		marginTop: 8,
	},
});
