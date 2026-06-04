import React, { useState } from 'react'
import { View, Alert } from 'react-native';
import { Avatar, Button, Text, Card, IconButton, TextInput, ActivityIndicator, Switch, List } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '~/app/providers'
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { getErrorMessage, updateUserName, updateUserProfilePicture, uploadProfilePicture } from '~/lib/utils';
import { useTheme as useAppTheme } from '~/lib/themeContext';
import * as ImagePicker from 'expo-image-picker';
import { clearRoomData } from '~/redux/chatSlice';

export default function Settings() {
	const { user, updateUser, logout, isLoggingOut } = useUser();
	const { isDark, toggleTheme, colors } = useAppTheme();
	const socket = useAppSelector(state => state.socket.socket);
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
			Alert.alert('Success', 'Name updated successfully');
		} catch (error) {
			Alert.alert('Error', getErrorMessage(error, 'Failed to update name'));
		}
	};

	const handleImagePicker = async () => {
		if (!user) return;

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
				
				// Upload the image
				const downloadUrl = await uploadProfilePicture(user.uid, result.assets[0].uri);
				
				// Update user profile picture
				await updateUserProfilePicture(socket, user.uid, downloadUrl);
				updateUser({ photo_url: downloadUrl });
				
				Alert.alert('Success', 'Profile picture updated successfully');
			}
		} catch (error) {
			Alert.alert('Error', getErrorMessage(error, 'Failed to update profile picture'));
		} finally {
			setIsUploading(false);
		}
	};

	const handleLogout = () => {
		dispatch(clearRoomData());
		logout();
	};

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
			<View className='px-6 py-8'>
				{user && (
					<View className='flex flex-col items-center gap-6 mb-8'>
						<View className="relative">
							<Avatar.Image 
								size={120} 
								source={{ uri: user.photo_url }}
								style={{ borderWidth: 4, borderColor: colors.border }}
							/>
							<IconButton
								icon="image-edit-outline"
								size={20}
								onPress={handleImagePicker}
								disabled={isUploading}
								iconColor={colors.primary}
								style={{
									position: 'absolute',
									bottom: 0,
									right: 0,
									backgroundColor: colors.surface,
								}}
							/>
							{isUploading && (
								<View className="absolute inset-0 bg-black bg-opacity-50 rounded-full items-center justify-center">
									<ActivityIndicator size="small" color="white" />
								</View>
							)}
						</View>
						
						<View className="items-center">
							{isEditingName ? (
								<View className="flex-row items-center gap-2">
									<TextInput
										value={newName}
										onChangeText={setNewName}
										style={{ width: 200 }}
										mode="outlined"
										placeholder="Enter new name"
									/>
									<IconButton
										icon="check"
										onPress={handleNameUpdate}
										iconColor={colors.primary}
									/>
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
								<View className="flex-row items-center gap-2">
									<Text variant='headlineMedium' style={{ color: colors.text, fontWeight: 'bold' }}>
										{user.name}
									</Text>
									<IconButton
										icon="pencil"
										size={20}
										onPress={() => setIsEditingName(true)}
									/>
								</View>
							)}
							<Text variant='bodyLarge' style={{ color: colors.textSecondary }}>
								{user.email}
							</Text>
						</View>
					</View>
				)}

				{/* Dark Mode Toggle */}
				<Card
					style={{
						marginTop: 24,
						backgroundColor: colors.surface,
						borderRadius: 16,
						borderWidth: 1,
						borderColor: colors.border,
					}}
				>
					<Card.Content>
						<Text
							variant="titleMedium"
							style={{
								color: colors.text,
								marginBottom: 16,
								fontWeight: '600',
							}}
						>
							Appearance
						</Text>
						<List.Item
							title="Dark Mode"
							titleStyle={{ color: colors.text, fontWeight: '500' }}
							description={isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}
							descriptionStyle={{ color: colors.textSecondary }}
							left={(props) => (
								<List.Icon {...props} icon="theme-light-dark" color={colors.primary} />
							)}
							right={() => (
								<Switch
									value={isDark}
									onValueChange={toggleTheme}
									color={colors.primary}
								/>
							)}
						/>
					</Card.Content>
				</Card>

				<Button
					mode="contained-tonal"
					icon="logout"
					onPress={handleLogout}
					loading={isLoggingOut}
					disabled={isLoggingOut}
					textColor={colors.destructive}
					style={{
						marginTop: 20,
						borderRadius: 14,
						backgroundColor: colors.surface,
						borderWidth: 1,
						borderColor: colors.border,
					}}
					contentStyle={{ paddingVertical: 8 }}
				>
					{isLoggingOut ? 'Logging out...' : 'Logout'}
				</Button>
			</View>
		</SafeAreaView>
	)
}

