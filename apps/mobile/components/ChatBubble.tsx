import React, { useState } from 'react';
import { View, Pressable, Image, Linking, StyleSheet } from 'react-native';
import { Avatar, Text, Menu, Portal, Dialog, Button, TextInput } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { ChatDate, ChatMessage } from '~/lib/types';
import { useAppDispatch } from '~/redux/store';
import { editMessage, deleteMessage, addReaction } from '~/redux/socketSlice';
import { useTheme } from '~/lib/themeContext';

export default function ChatBubble({
	message,
	isGroup,
	roomId,
}: {
	message: ChatMessage | ChatDate;
	isGroup: boolean;
	roomId: string;
}) {
	const user = useUser()?.user;
	const { colors, isDark } = useTheme();
	const dispatch = useAppDispatch();

	const [menuVisible, setMenuVisible] = useState(false);
	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [editDialogVisible, setEditDialogVisible] = useState(false);
	const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
	const [editText, setEditText] = useState('');

	const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

	if (message.isDate) {
		return (
			<View style={styles.dateContainer}>
				<View style={[styles.dateBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
					<Text style={[styles.dateText, { color: colors.textSecondary }]}>{message.time}</Text>
				</View>
			</View>
		);
	}

	const chatMessage = message as ChatMessage;
	const isSelf = chatMessage.userUid == user?.uid;
	const isAIMessage = chatMessage.isAIMessage || chatMessage.userUid === 'ai-assistant';
	const time = new Date(chatMessage.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

	const openMenu = () => setMenuVisible(true);
	const closeMenu = () => setMenuVisible(false);

	const handleEditPress = () => {
		setEditText(message.chatInfo || '');
		setEditDialogVisible(true);
		closeMenu();
	};

	const handleDeletePress = () => {
		setDeleteDialogVisible(true);
		closeMenu();
	};

	const handleReactPress = () => {
		setEmojiPickerVisible(true);
		closeMenu();
	};

	const handleEmojiSelect = (emoji: string) => {
		if (!user || !message.chatDocId) return;
		dispatch(
			addReaction({
				reactionId: emoji,
				id: String(message.id),
				chatDocId: message.chatDocId,
				roomId: roomId,
				userUid: user.uid,
				userName: user.name,
			})
		);
		setEmojiPickerVisible(false);
	};

	const handleReactionClick = (emoji: string) => {
		if (!user || !message.chatDocId) return;
		dispatch(
			addReaction({
				reactionId: emoji,
				id: String(message.id),
				chatDocId: message.chatDocId,
				roomId: roomId,
				userUid: user.uid,
				userName: user.name,
			})
		);
	};

	const confirmEdit = () => {
		if (editText.trim() && message.chatDocId) {
			dispatch(
				editMessage({
					id: String(message.id),
					chatDocId: message.chatDocId,
					roomId: roomId,
					newText: editText,
				})
			);
		}
		setEditDialogVisible(false);
		setEditText('');
	};

	const confirmDelete = () => {
		if (message.chatDocId) {
			dispatch(
				deleteMessage({
					id: String(message.id),
					chatDocId: message.chatDocId,
					roomId: roomId,
				})
			);
		}
		setDeleteDialogVisible(false);
	};

	const getBubbleStyle = () => {
		if (isSelf) {
			return {
				backgroundColor: colors.primary,
				borderTopRightRadius: message.isConsecutiveMessage ? 18 : 4,
				borderTopLeftRadius: 18,
				borderBottomLeftRadius: 18,
				borderBottomRightRadius: 18,
			};
		}
		if (isAIMessage) {
			return {
				backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
				borderTopRightRadius: 18,
				borderTopLeftRadius: message.isConsecutiveMessage ? 18 : 4,
				borderBottomLeftRadius: 18,
				borderBottomRightRadius: 18,
				borderWidth: 1,
				borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe',
			};
		}
		return {
			backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
			borderTopRightRadius: 18,
			borderTopLeftRadius: message.isConsecutiveMessage ? 18 : 4,
			borderBottomLeftRadius: 18,
			borderBottomRightRadius: 18,
		};
	};

	return (
		<>
			<View style={[styles.messageRow, { justifyContent: isSelf ? 'flex-end' : 'flex-start' }]}>
				{/* Avatar for non-self messages */}
				{!isSelf && !message.isConsecutiveMessage && (
					<Avatar.Image
						size={32}
						source={{
							uri: isAIMessage
								? 'https://ui-avatars.com/api/?name=AI&background=6366f1&color=ffffff'
								: message.userPhoto,
						}}
						style={styles.avatar}
					/>
				)}
				{!isSelf && message.isConsecutiveMessage && <View style={styles.avatarPlaceholder} />}

				<View style={[styles.bubbleContainer, { maxWidth: '75%' }]}>
					{/* Sender name for groups */}
					{!isSelf && !message.isConsecutiveMessage && (isGroup || isAIMessage) && (
						<View style={styles.senderRow}>
							<Text style={[styles.senderName, { color: isAIMessage ? '#6366f1' : colors.textSecondary }]}>
								{isAIMessage ? 'Hoplio AI' : message.userName}
							</Text>
							{isAIMessage && (
								<View style={[styles.aiBadge, { backgroundColor: '#6366f1' }]}>
									<Text style={styles.aiBadgeText}>AI</Text>
								</View>
							)}
						</View>
					)}

					<Menu
						visible={menuVisible}
						onDismiss={closeMenu}
						anchor={
							<Pressable onLongPress={openMenu} delayLongPress={400}>
								<View style={[styles.bubble, getBubbleStyle()]}>
									{/* Image */}
									{message.type === 'image' && (
										<Image
											source={{ uri: message.chatInfo }}
											style={styles.imageContent}
											resizeMode="cover"
										/>
									)}

									{/* File attachment */}
									{message.type === 'file' && (
										<Pressable onPress={() => Linking.openURL(message.chatInfo)}>
											<View
												style={[
													styles.fileContainer,
													{
														backgroundColor: isSelf ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
													},
												]}
											>
												<View style={[styles.fileIcon, { backgroundColor: colors.primary }]}>
													<Text style={styles.fileIconText}>📄</Text>
												</View>
												<View style={styles.fileInfo}>
													<Text
														style={[styles.fileName, { color: isSelf ? '#fff' : colors.text }]}
														numberOfLines={1}
													>
														{message.fileName || 'Document'}
													</Text>
													<Text
														style={[
															styles.fileHint,
															{ color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
														]}
													>
														Tap to open
													</Text>
												</View>
											</View>
										</Pressable>
									)}

									{/* Text message */}
									{message.type === 'text' && (
										<Text style={[styles.messageText, { color: isSelf ? '#fff' : colors.text }]}>
											{message.isEncrypted && !message.chatInfo
												? 'Encrypted message - Unable to decrypt'
												: message.chatInfo}
										</Text>
									)}
									{chatMessage.isEncrypted && (
										<Text
											style={[
												styles.encryptionLabel,
												{ color: isSelf ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
											]}
										>
											Secure message
										</Text>
									)}

									{/* Time */}
									<View style={styles.timeRow}>
										<Text
											style={[
												styles.timeText,
												{ color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
											]}
										>
											{time}
										</Text>
										{message.isMsgEdited && (
											<Text
												style={[
													styles.editedText,
													{ color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
												]}
											>
												• edited
											</Text>
										)}
									</View>
								</View>
							</Pressable>
						}
						contentStyle={{ backgroundColor: colors.surface, borderRadius: 12 }}
					>
						<Menu.Item onPress={handleReactPress} title="React" leadingIcon="emoticon-happy-outline" />
						{isSelf && !isAIMessage && !chatMessage.isEncrypted && <Menu.Item onPress={handleEditPress} title="Edit" leadingIcon="pencil" />}
						{isSelf && !isAIMessage && (
							<Menu.Item onPress={handleDeletePress} title="Delete" leadingIcon="delete" titleStyle={{ color: '#ef4444' }} />
						)}
					</Menu>

					{/* Reactions */}
					{(message as ChatMessage).reactions && (message as ChatMessage).reactions!.length > 0 && (
						<View style={styles.reactionsRow}>
							{(message as ChatMessage).reactions!.map((reaction: any, index: number) => {
								const hasUserReacted = reaction.reactors.some((r: any) => r.uid === user?.uid);
								return (
									<Pressable key={index} onPress={() => handleReactionClick(reaction.id)}>
										<View
											style={[
												styles.reactionChip,
												{
													backgroundColor: hasUserReacted
														? isDark
															? 'rgba(59, 130, 246, 0.3)'
															: '#dbeafe'
														: isDark
															? 'rgba(255,255,255,0.1)'
															: '#f1f5f9',
													borderColor: hasUserReacted ? colors.primary : 'transparent',
													borderWidth: hasUserReacted ? 1 : 0,
												},
											]}
										>
											<Text style={styles.reactionEmoji}>{reaction.id}</Text>
											<Text style={[styles.reactionCount, { color: colors.text }]}>
												{reaction.reactors.length}
											</Text>
										</View>
									</Pressable>
								);
							})}
						</View>
					)}
				</View>
			</View>

			{/* Dialogs */}
			<Portal>
				<Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)} style={{ backgroundColor: colors.surface }}>
					<Dialog.Title style={{ color: colors.text }}>Edit Message</Dialog.Title>
					<Dialog.Content>
						<TextInput mode="outlined" value={editText} onChangeText={setEditText} multiline autoFocus textColor={colors.text} />
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setEditDialogVisible(false)} textColor={colors.textSecondary}>
							Cancel
						</Button>
						<Button onPress={confirmEdit} textColor={colors.primary}>
							Save
						</Button>
					</Dialog.Actions>
				</Dialog>

				<Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)} style={{ backgroundColor: colors.surface }}>
					<Dialog.Title style={{ color: colors.text }}>Delete Message</Dialog.Title>
					<Dialog.Content>
						<Text style={{ color: colors.textSecondary }}>Are you sure you want to delete this message?</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setDeleteDialogVisible(false)} textColor={colors.textSecondary}>
							Cancel
						</Button>
						<Button onPress={confirmDelete} textColor="#ef4444">
							Delete
						</Button>
					</Dialog.Actions>
				</Dialog>

				<Dialog visible={emojiPickerVisible} onDismiss={() => setEmojiPickerVisible(false)} style={{ backgroundColor: colors.surface }}>
					<Dialog.Title style={{ color: colors.text }}>React</Dialog.Title>
					<Dialog.Content>
						<View style={styles.emojiGrid}>
							{commonEmojis.map((emoji, index) => (
								<Pressable key={index} onPress={() => handleEmojiSelect(emoji)}>
									<View style={[styles.emojiButton, { backgroundColor: isDark ? colors.muted : '#f1f5f9' }]}>
										<Text style={styles.emoji}>{emoji}</Text>
									</View>
								</Pressable>
							))}
						</View>
					</Dialog.Content>
				</Dialog>
			</Portal>
		</>
	);
}

const styles = StyleSheet.create({
	dateContainer: {
		alignItems: 'center',
		marginVertical: 16,
	},
	dateBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 12,
	},
	dateText: {
		fontSize: 12,
		fontWeight: '500',
	},
	messageRow: {
		flexDirection: 'row',
		marginVertical: 2,
		paddingHorizontal: 8,
	},
	avatar: {
		marginRight: 8,
		marginTop: 4,
	},
	avatarPlaceholder: {
		width: 40,
	},
	bubbleContainer: {
		flexDirection: 'column',
	},
	senderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 4,
		marginLeft: 4,
		gap: 6,
	},
	senderName: {
		fontSize: 12,
		fontWeight: '600',
	},
	aiBadge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	aiBadgeText: {
		color: '#fff',
		fontSize: 9,
		fontWeight: '700',
	},
	bubble: {
		paddingHorizontal: 14,
		paddingVertical: 10,
		minWidth: 60,
	},
	imageContent: {
		width: 220,
		height: 160,
		borderRadius: 12,
		marginBottom: 6,
	},
	fileContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 10,
		borderRadius: 10,
		gap: 10,
	},
	fileIcon: {
		width: 40,
		height: 40,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	fileIconText: {
		fontSize: 20,
	},
	fileInfo: {
		flex: 1,
	},
	fileName: {
		fontSize: 14,
		fontWeight: '500',
	},
	fileHint: {
		fontSize: 11,
		marginTop: 2,
	},
	messageText: {
		fontSize: 15,
		lineHeight: 21,
	},
	encryptionLabel: {
		fontSize: 11,
		marginTop: 6,
	},
	timeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
		gap: 4,
	},
	timeText: {
		fontSize: 11,
	},
	editedText: {
		fontSize: 11,
	},
	reactionsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 4,
		marginTop: 6,
		marginLeft: 4,
	},
	reactionChip: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		gap: 4,
	},
	reactionEmoji: {
		fontSize: 14,
	},
	reactionCount: {
		fontSize: 12,
		fontWeight: '500',
	},
	emojiGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
	},
	emojiButton: {
		width: 56,
		height: 56,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emoji: {
		fontSize: 28,
	},
});
