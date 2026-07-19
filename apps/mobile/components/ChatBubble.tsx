import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Dialog, Icon, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { ChatDate, ChatMessage } from '~/lib/types';
import { deleteMessage, editMessage, addReaction, saveMessage } from '~/redux/socketSlice';
import { useAppDispatch } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';
import { hapticSelection } from '~/lib/haptics';

const COMMON_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}', '\u{1F389}', '\u{1F525}'];

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
	const isSelf = chatMessage.userUid === user?.uid;
	const isAIMessage = chatMessage.isAIMessage || chatMessage.userUid === 'ai-assistant';
	const time = new Date(chatMessage.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

	const openMenu = () => {
		void hapticSelection();
		setMenuVisible(true);
	};
	const closeMenu = () => setMenuVisible(false);

	const handleEditPress = () => {
		setEditText(chatMessage.chatInfo || '');
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

	const handleSavePress = () => {
		if (!chatMessage.chatDocId) return;
		dispatch(
			saveMessage({
				id: String(chatMessage.id),
				chatDocId: chatMessage.chatDocId,
				roomId,
			})
		);
		closeMenu();
	};

	const handleEmojiSelect = (emoji: string) => {
		if (!user || !chatMessage.chatDocId) return;
		dispatch(
			addReaction({
				reactionId: emoji,
				id: String(chatMessage.id),
				chatDocId: chatMessage.chatDocId,
				roomId,
				userUid: user.uid,
				userName: user.name,
			})
		);
		setEmojiPickerVisible(false);
	};

	const confirmEdit = () => {
		if (!editText.trim() || !chatMessage.chatDocId) return;
		dispatch(
			editMessage({
				id: String(chatMessage.id),
				chatDocId: chatMessage.chatDocId,
				roomId,
				newText: editText,
			})
		);
		setEditDialogVisible(false);
		setEditText('');
	};

	const confirmDelete = () => {
		if (!chatMessage.chatDocId) return;
		dispatch(
			deleteMessage({
				id: String(chatMessage.id),
				chatDocId: chatMessage.chatDocId,
				roomId,
			})
		);
		setDeleteDialogVisible(false);
	};

	const getBubbleStyle = () => {
		if (isSelf) {
			return {
				backgroundColor: colors.bubbleSelf,
				borderTopRightRadius: chatMessage.isConsecutiveMessage ? 18 : 6,
				borderTopLeftRadius: 18,
				borderBottomLeftRadius: 18,
				borderBottomRightRadius: 18,
			};
		}
		if (isAIMessage) {
			return {
				backgroundColor: colors.bubbleAI,
				borderTopRightRadius: 18,
				borderTopLeftRadius: chatMessage.isConsecutiveMessage ? 18 : 6,
				borderBottomLeftRadius: 18,
				borderBottomRightRadius: 18,
				borderWidth: 2,
				borderColor: colors.ai,
			};
		}
		return {
			backgroundColor: colors.bubbleOther,
			borderTopRightRadius: 18,
			borderTopLeftRadius: chatMessage.isConsecutiveMessage ? 18 : 6,
			borderBottomLeftRadius: 18,
			borderBottomRightRadius: 18,
		};
	};

	return (
		<>
			<View style={[styles.messageRow, { justifyContent: isSelf ? 'flex-end' : 'flex-start' }]}>
				{!isSelf && !chatMessage.isConsecutiveMessage && (
					<Avatar.Image
						size={32}
						source={{
							uri: isAIMessage
								? 'https://ui-avatars.com/api/?name=AI&background=CE82FF&color=ffffff'
								: chatMessage.userPhoto,
						}}
						style={styles.avatar}
					/>
				)}
				{!isSelf && chatMessage.isConsecutiveMessage && <View style={styles.avatarPlaceholder} />}

				<View style={[styles.bubbleContainer, { maxWidth: '75%' }]}>
					{!isSelf && !chatMessage.isConsecutiveMessage && (isGroup || isAIMessage) && (
						<View style={styles.senderRow}>
							<Text style={[styles.senderName, { color: isAIMessage ? colors.ai : colors.textSecondary }]}>
								{isAIMessage ? 'Hoplio AI' : chatMessage.userName}
							</Text>
							{isAIMessage && (
								<View style={[styles.aiBadge, { backgroundColor: colors.ai }]}>
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
									{(chatMessage.type === 'image' || chatMessage.type === 'gif') && (
										<Image source={{ uri: chatMessage.chatInfo }} style={styles.imageContent} resizeMode="cover" />
									)}

									{chatMessage.type === 'file' && (
										<Pressable onPress={() => Linking.openURL(chatMessage.chatInfo)}>
											<View
												style={[
													styles.fileContainer,
													{
														backgroundColor: isSelf ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
													},
												]}
											>
												<View style={[styles.fileIcon, { backgroundColor: colors.primary }]}>
													<Icon source="file-outline" size={20} color="#fff" />
												</View>
												<View style={styles.fileInfo}>
													<Text style={[styles.fileName, { color: isSelf ? '#fff' : colors.text }]} numberOfLines={1}>
														{chatMessage.fileName || 'Document'}
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

									{chatMessage.type === 'text' && (
										<Text style={[styles.messageText, { color: isSelf ? '#fff' : colors.text }]}>
											{chatMessage.isEncrypted && !chatMessage.chatInfo
												? 'Encrypted message unavailable'
												: chatMessage.chatInfo}
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

									<View style={styles.timeRow}>
										<Text
											style={[
												styles.timeText,
												{ color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
											]}
										>
											{time}
										</Text>
										{chatMessage.isMsgEdited && (
											<Text
												style={[
													styles.editedText,
													{ color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
												]}
											>
												(edited)
											</Text>
										)}
										{chatMessage.isMsgSaved && <Icon source="star" size={12} color={isSelf ? '#fff' : colors.primary} />}
									</View>
								</View>
							</Pressable>
						}
						contentStyle={{ backgroundColor: colors.surface, borderRadius: 12 }}
					>
						<Menu.Item onPress={handleReactPress} title="React" leadingIcon="emoticon-happy-outline" />
						<Menu.Item
							onPress={handleSavePress}
							title={chatMessage.isMsgSaved ? 'Remove star' : 'Star message'}
							leadingIcon={chatMessage.isMsgSaved ? 'star-off-outline' : 'star-outline'}
						/>
						{isSelf && !isAIMessage && !chatMessage.isEncrypted && (
							<Menu.Item onPress={handleEditPress} title="Edit" leadingIcon="pencil" />
						)}
						{isSelf && !isAIMessage && (
							<Menu.Item
								onPress={handleDeletePress}
								title="Delete"
								leadingIcon="delete"
								titleStyle={{ color: colors.destructive }}
							/>
						)}
					</Menu>

					{chatMessage.reactions && chatMessage.reactions.length > 0 && (
						<View style={styles.reactionsRow}>
							{chatMessage.reactions.map((reaction, index) => {
								const hasUserReacted = reaction.reactors.some((reactor) => reactor.uid === user?.uid);
								return (
									<Pressable
										key={index}
										onPress={() => {
											void hapticSelection();
											handleEmojiSelect(reaction.id);
										}}
									>
										<View
											style={[
												styles.reactionChip,
												{
													backgroundColor: hasUserReacted
														? isDark
															? 'rgba(88, 204, 2, 0.25)'
															: '#D7FFB8'
														: colors.muted,
													borderColor: hasUserReacted ? colors.primary : colors.border,
													borderWidth: 2,
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
						<Button onPress={confirmDelete} textColor={colors.destructive}>
							Delete
						</Button>
					</Dialog.Actions>
				</Dialog>

				<Dialog visible={emojiPickerVisible} onDismiss={() => setEmojiPickerVisible(false)} style={{ backgroundColor: colors.surface }}>
					<Dialog.Title style={{ color: colors.text }}>React</Dialog.Title>
					<Dialog.Content>
						<View style={styles.emojiGrid}>
							{COMMON_EMOJIS.map((emoji) => (
								<Pressable
									key={emoji}
									onPress={() => {
										void hapticSelection();
										handleEmojiSelect(emoji);
									}}
								>
									<View style={[styles.emojiButton, { backgroundColor: colors.muted }]}>
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
