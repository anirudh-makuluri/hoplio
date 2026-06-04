import { ChatDate, ChatMessage, TRoomData, PresenceUpdate } from "../lib/types";
import { decryptChatMessage, formatChatMessages } from "../lib/utils";
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from '@reduxjs/toolkit'

export interface IChatState {
	activeChatRoomId: string,
	rooms: {
		[roomId: string]: TRoomData
	},
	unreadCounts: {
		[roomId: string]: number
	},
	userPresence: {
		[uid: string]: {
			is_online: boolean;
			last_seen: number | null;
		}
	},
	isOffline: boolean
}

const initialState: IChatState = {
	activeChatRoomId: '',
	rooms: {},
	unreadCounts: {},
	userPresence: {},
	isOffline: false
}

export const chatSlice = createSlice({
	name: 'chat',
	initialState,
	reducers: {
		joinChatRoom: (state, action: PayloadAction<TRoomData>) => {
			const roomData = action.payload
			const isChatMessage = (message: ChatMessage | ChatDate): message is ChatMessage => !message.isDate;
			const decryptedMessages = (roomData.messages || []).map((message) =>
				isChatMessage(message) ? decryptChatMessage(message) : message
			);
			const decryptedSavedMessages = (roomData.saved_messages || []).map((message) =>
				isChatMessage(message) ? decryptChatMessage(message) : message
			);
			state.rooms[roomData.roomId] = {
				is_group: roomData.is_group,
				is_ai_room: roomData.is_ai_room,
				messages: formatChatMessages(decryptedMessages),
				saved_messages: decryptedSavedMessages,
				name: roomData.name,
				photo_url: roomData.photo_url,
				roomId: roomData.roomId,
				currentChatDocId: roomData.messages[0]?.chatDocId,
				hasMoreMessages: false,
				isLoadingMore: false,
				members: roomData.members,
			}
			state.unreadCounts[roomData.roomId] = state.unreadCounts[roomData.roomId] || 0;
			roomData.membersData?.forEach(member => {
				state.userPresence[member.uid] = {
					is_online: member.is_online || false,
					last_seen: member.last_seen || null
				};
			});
		},
		setActiveRoomId: (state, action: PayloadAction<string>) => {
			state.activeChatRoomId = action.payload
			if (action.payload) {
				state.unreadCounts[action.payload] = 0;
			}
		},
		addMessage: (state, action: PayloadAction<{ message: ChatMessage; currentUserUid?: string }>) => {
			const { message, currentUserUid } = action.payload;
			const decryptedMessage = decryptChatMessage(message);
			const chatMessages = state.rooms[decryptedMessage.roomId].messages;

		// Check for duplicates using id
		if(chatMessages.findIndex(msg => !msg.isDate && msg.id == decryptedMessage.id) != -1) return state;

			let lastMessage = chatMessages[chatMessages.length - 1];

			const newChatDate: ChatDate = {
				time: 'Today',
				isDate: true,
			}

			if (lastMessage == null) {
				decryptedMessage.isConsecutiveMessage = false;
				chatMessages.push(newChatDate);
			} else {
				if (lastMessage.isDate) lastMessage = chatMessages[chatMessages.length - 2];

				decryptedMessage.isConsecutiveMessage = false;
				if (lastMessage.userUid == decryptedMessage.userUid) {
					decryptedMessage.isConsecutiveMessage = true;
				}


				const newMessageDate = new Date(decryptedMessage.time);
				const lastMessageDate = new Date(lastMessage.time);

				const isToday = newMessageDate.getDate() === lastMessageDate.getDate() &&
					newMessageDate.getMonth() === lastMessageDate.getMonth() &&
					newMessageDate.getFullYear() === lastMessageDate.getFullYear();

				if (!isToday) {
					chatMessages.push(newChatDate);
				}
			}

			state.rooms[decryptedMessage.roomId].messages = [...chatMessages, decryptedMessage]
			if (
				currentUserUid &&
				decryptedMessage.userUid !== currentUserUid &&
				state.activeChatRoomId !== decryptedMessage.roomId
			) {
				state.unreadCounts[decryptedMessage.roomId] =
					(state.unreadCounts[decryptedMessage.roomId] || 0) + 1;
			}
		},
		addChatDoc: (state, action: PayloadAction<{ messages: ChatMessage[], roomId: string }>) => {
			const formattedMessages = formatChatMessages(action.payload.messages);
			const currentMessages = state.rooms[action.payload.roomId].messages

			const curChatDocFirstMsg = currentMessages[1];
			const newChatDocLastMsg = formattedMessages[formattedMessages.length - 1];
			
			const firstMsgDate = new Date(curChatDocFirstMsg.time);
			const lastMsgDate = new Date(newChatDocLastMsg.time);

			const isSameDay = firstMsgDate.getDate() === lastMsgDate.getDate() &&
			firstMsgDate.getMonth() === lastMsgDate.getMonth() &&
			firstMsgDate.getFullYear() === lastMsgDate.getFullYear();

			if(isSameDay) {
				currentMessages.shift();
			}

			state.rooms[action.payload.roomId].messages = [...formattedMessages, ...currentMessages];
		},
		setLoadingMore: (state, action: PayloadAction<{ roomId: string, isLoading: boolean }>) => {
			if (state.rooms[action.payload.roomId]) {
				state.rooms[action.payload.roomId].isLoadingMore = action.payload.isLoading;
			}
		},
		addOlderMessages: (state, action: PayloadAction<{ roomId: string, messages: ChatMessage[], hasMore: boolean }>) => {
			const { roomId, messages, hasMore } = action.payload;
			
			if (!state.rooms[roomId] || messages.length === 0) {
				if (state.rooms[roomId]) {
					state.rooms[roomId].hasMoreMessages = false;
					state.rooms[roomId].isLoadingMore = false;
				}
				return;
			}

			const decryptedMessages = messages.map((message) => decryptChatMessage(message));
			const formattedMessages = formatChatMessages(decryptedMessages);
			const currentMessages = state.rooms[roomId].messages;

			// Check if first current message and last new message are on same day
			if (currentMessages.length > 0 && formattedMessages.length > 0) {
				const firstCurrentMsg = currentMessages[0]?.isDate ? currentMessages[1] : currentMessages[0];
				const lastNewMsg = formattedMessages[formattedMessages.length - 1];
				
				if (firstCurrentMsg && lastNewMsg && !lastNewMsg.isDate) {
					const firstMsgDate = new Date(firstCurrentMsg.time);
					const lastMsgDate = new Date(lastNewMsg.time);

					const isSameDay = firstMsgDate.getDate() === lastMsgDate.getDate() &&
						firstMsgDate.getMonth() === lastMsgDate.getMonth() &&
						firstMsgDate.getFullYear() === lastMsgDate.getFullYear();

					if (isSameDay && currentMessages[0]?.isDate) {
						currentMessages.shift();
					}
				}
			}

			// Prepend older messages
			state.rooms[roomId].messages = [...formattedMessages, ...currentMessages];
			
			// Update pagination state
			if (messages.length > 0) {
				state.rooms[roomId].currentChatDocId = messages[0].chatDocId;
			}
			state.rooms[roomId].hasMoreMessages = hasMore;
			state.rooms[roomId].isLoadingMore = false;
		},
		clearRoomData: () => {
			return initialState;
		},
	editMessageInChat: (state, action: PayloadAction<{ roomId: string; id: string; chatDocId: string; newText: string }>) => {
		const { roomId, id, newText } = action.payload;
		
		if (!state.rooms[roomId]) return;
		
		const messages = state.rooms[roomId].messages;
		// Search by id
		const messageIndex = messages.findIndex(msg => !msg.isDate && String(msg.id) === String(id));
		
		if (messageIndex !== -1 && !messages[messageIndex].isDate) {
			const message = messages[messageIndex];
			if (!message.isDate) {
				message.chatInfo = newText;
				message.isMsgEdited = true;
			}
		}
	},
		deleteMessageFromChat: (state, action: PayloadAction<{ roomId: string; id: string; chatDocId: string }>) => {
			const { roomId, id } = action.payload;
			
			if (!state.rooms[roomId]) return;
			
			const messages = state.rooms[roomId].messages;
			// Search by id
			const messageIndex = messages.findIndex(msg => !msg.isDate && String(msg.id) === String(id));
			
			if (messageIndex !== -1) {
				// Remove the message
				messages.splice(messageIndex, 1);
				
				// Check if we need to remove orphaned date separator
				if (messageIndex > 0 && messages[messageIndex - 1]?.isDate) {
					// If the next message is also a date or doesn't exist, remove the date separator
					if (!messages[messageIndex] || messages[messageIndex]?.isDate) {
						messages.splice(messageIndex - 1, 1);
					}
				}
			}
		},
		toggleReaction: (state, action: PayloadAction<{ roomId: string; id: string; reactionId: string; userUid: string; userName: string }>) => {
			const { roomId, id, reactionId, userUid, userName } = action.payload;
			
			if (!state.rooms[roomId]) return;
			
			const messages = state.rooms[roomId].messages;
			const messageIndex = messages.findIndex(msg => !msg.isDate && String(msg.id) === String(id));
			
			if (messageIndex !== -1) {
				const messageItem = messages[messageIndex];
				// Type guard to ensure it's a ChatMessage
				if (messageItem.isDate) return;
				
				const message = messageItem as ChatMessage;
				
				// Initialize reactions array if it doesn't exist
				if (!message.reactions) {
					message.reactions = [];
				}
				
				// Find if this reaction already exists
				const reactionIndex = message.reactions.findIndex((r: any) => r.id === reactionId);
				
				if (reactionIndex !== -1) {
					// Reaction exists, check if user already reacted
					const reaction = message.reactions[reactionIndex];
					const reactorIndex = reaction.reactors.findIndex((r: any) => r.uid === userUid);
					
					if (reactorIndex !== -1) {
						// User already reacted, remove their reaction
						reaction.reactors.splice(reactorIndex, 1);
						
						// If no reactors left, remove the entire reaction
						if (reaction.reactors.length === 0) {
							message.reactions.splice(reactionIndex, 1);
						}
					} else {
						// User hasn't reacted yet, add them
						reaction.reactors.push({ uid: userUid, name: userName });
					}
				} else {
					// Reaction doesn't exist, create it
					message.reactions.push({
						id: reactionId,
						reactors: [{ uid: userUid, name: userName }]
					});
				}
			}
		},
		// Group management actions
		addGroupRoom: (state, action: PayloadAction<TRoomData>) => {
			const roomData = action.payload;
			state.rooms[roomData.roomId] = {
				is_group: true,
				messages: [],
				saved_messages: [],
				name: roomData.name,
				photo_url: roomData.photo_url,
				roomId: roomData.roomId,
				hasMoreMessages: false,
				isLoadingMore: false,
				members: roomData.members,
			}
		},
		updateGroupMembers: (state, action: PayloadAction<{ roomId: string; members: string[] }>) => {
			const { roomId, members } = action.payload;
			if (state.rooms[roomId]) {
				state.rooms[roomId].members = members;
			}
		},
		updateGroupInfo: (state, action: PayloadAction<{ roomId: string; name?: string; photo_url?: string }>) => {
			const { roomId, name, photo_url } = action.payload;
			if (state.rooms[roomId]) {
				if (name) state.rooms[roomId].name = name;
				if (photo_url) state.rooms[roomId].photo_url = photo_url;
			}
		},
		saveChatMessage: (state, action: PayloadAction<{ roomId: string; id: string | number }>) => {
			const currentRoom = state.rooms[action.payload.roomId];
			if (!currentRoom) return;

			const messages = currentRoom.messages;
			const savedMessages = currentRoom.saved_messages || [];
			const reqIdx = messages.findIndex((msg) => !msg.isDate && msg.id == action.payload.id);
			if (reqIdx === -1) return;

			const targetMessage = messages[reqIdx];
			if (targetMessage.isDate) return;

			const isMsgSaved = targetMessage.isMsgSaved || false;

			if (isMsgSaved) {
				targetMessage.isMsgSaved = false;
				const reqSavedMsgIdx = savedMessages.findIndex((msg) => !msg.isDate && msg.id == action.payload.id);
				if (reqSavedMsgIdx !== -1) {
					savedMessages.splice(reqSavedMsgIdx, 1);
				}
			} else {
				targetMessage.isMsgSaved = true;
				savedMessages.push(targetMessage);
			}

			currentRoom.messages = [...messages];
			currentRoom.saved_messages = [...savedMessages];
		},
		removeGroupRoom: (state, action: PayloadAction<string>) => {
			const roomId = action.payload;
			delete state.rooms[roomId];
			delete state.unreadCounts[roomId];
			if (state.activeChatRoomId === roomId) {
				state.activeChatRoomId = '';
			}
		},
		// Presence management actions
		updateUserPresence: (state, action: PayloadAction<PresenceUpdate>) => {
			const { uid, is_online, last_seen } = action.payload;
			state.userPresence[uid] = {
				is_online,
				last_seen
			};
		},
		updateMultipleUserPresence: (state, action: PayloadAction<PresenceUpdate[]>) => {
			action.payload.forEach(presence => {
				state.userPresence[presence.uid] = {
					is_online: presence.is_online,
					last_seen: presence.last_seen
				};
			});
		},
		// Offline mode actions
		setOfflineMode: (state, action: PayloadAction<boolean>) => {
			state.isOffline = action.payload;
		},
		loadOfflineMessages: (state, action: PayloadAction<{ roomId: string; messages: ChatMessage[] }>) => {
			const { roomId, messages } = action.payload;
			if (state.rooms[roomId]) {
				state.rooms[roomId].messages = formatChatMessages(messages.map((message) => decryptChatMessage(message)));
			}
		},
		saveMessageOffline: (state, action: PayloadAction<ChatMessage>) => {
			// This will be handled by the thunk, but we can add local state if needed
			const message = action.payload;
			if (state.rooms[message.roomId]) {
				// Add message locally for immediate UI update
				const chatMessages = state.rooms[message.roomId].messages;
				
				// Check for duplicates
				if(chatMessages.findIndex(msg => !msg.isDate && msg.id == message.id) != -1) return state;

				let lastMessage = chatMessages[chatMessages.length - 1];

				const newChatDate: ChatDate = {
					time: 'Today',
					isDate: true,
				}

				if (lastMessage == null) {
					message.isConsecutiveMessage = false;
					chatMessages.push(newChatDate);
				} else {
					if (lastMessage.isDate) lastMessage = chatMessages[chatMessages.length - 2];

					message.isConsecutiveMessage = false;
					if (lastMessage.userUid == message.userUid) {
						message.isConsecutiveMessage = true;
					}

					const newMessageDate = new Date(message.time);
					const lastMessageDate = new Date(lastMessage.time);

					const isToday = newMessageDate.getDate() === lastMessageDate.getDate() &&
						newMessageDate.getMonth() === lastMessageDate.getMonth() &&
						newMessageDate.getFullYear() === lastMessageDate.getFullYear();

					if (!isToday) {
						chatMessages.push(newChatDate);
					}
				}

				state.rooms[message.roomId].messages = [...chatMessages, message];
			}
		}
	}
})

export const { 
	setActiveRoomId, 
	addMessage, 
	joinChatRoom, 
	clearRoomData, 
	addChatDoc, 
	setLoadingMore, 
	addOlderMessages, 
	editMessageInChat, 
	deleteMessageFromChat, 
	toggleReaction,
	addGroupRoom,
	updateGroupMembers,
	updateGroupInfo,
	saveChatMessage,
	removeGroupRoom,
	updateUserPresence,
	updateMultipleUserPresence,
	setOfflineMode,
	loadOfflineMessages,
	saveMessageOffline
} = chatSlice.actions
export const chatReducer = chatSlice.reducer
