import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from '@reduxjs/toolkit'
import io, { Socket } from 'socket.io-client';
import { AppThunk } from "./store";
import { ChatMessage, TUser, CreateScheduledMessageRequest, UpdateScheduledMessageRequest, ScheduledMessageResponse, ScheduledMessagesListResponse } from "../lib/types";
import { globals } from "../globals";
import { requestConversationSummary, getSmartReplies } from "../lib/utils";
import { offlineStorage } from '../lib/offlineStorage';
import { addMessage, loadOfflineMessages } from './chatSlice';
import { setScheduledMessages, updateScheduledMessage as updateScheduledMessageAction, removeScheduledMessage } from './scheduledMessageSlice';

interface SocketState {
	socket: Socket | null
}

const initialState: SocketState = {
	socket: null
}

const socketSlice = createSlice({
	name: 'socket',
	initialState,
	reducers: {
		initSocket: (state, action : PayloadAction<TUser>) => {
			if (state.socket == null) {

				console.log("initing socket");
				const backendUrl = globals.BACKEND_URL;
				const socket = io(backendUrl, {
					transports: ['websocket'],
					// upgrade: false,
					// autoConnect: false,
					query: {
						...action.payload
					},
					closeOnBeforeunload: false
				})

				socket.auth = {
					uid: action.payload.uid,
					name: action.payload.name
				}
				
				return { ...state, socket };
			}
			return state;
		},
		joinSocketRoom: (state, action: PayloadAction<string>) => {
			if (state.socket) {
				state.socket?.emit('join_room', action.payload);
			}
		}
	}
})

export const { initSocket, joinSocketRoom } = socketSlice.actions;
export const socketReducer = socketSlice.reducer

export const initAndJoinSocketRooms = (rooms: string[], user: TUser): AppThunk => dispatch => {
	dispatch(initSocket(user));
	rooms.forEach(roomId => {
		dispatch(joinSocketRoom(roomId));
	});
}

export const sendMessageToServer = (message: ChatMessage): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	const { isOffline } = getState().chat;
	
	// Always add message to local state first for immediate UI update
	dispatch(
		addMessage({
			message,
			currentUserUid: message.userUid,
		})
	);
	
	if (socket && !isOffline) {
		// Online: Send to server
		const backendMessage = {
			id: message.id,
			roomId: message.roomId,
			userUid: message.userUid,
			userName: message.userName,
			userPhoto: message.userPhoto,
			type: message.type,
			chatInfo: message.chatInfo,
			fileName: message.fileName || '',
			isMsgEdited: message.isMsgEdited || false,
			isMsgSaved: message.isMsgSaved || false,
			isEncrypted: message.isEncrypted || false,
			encrypted: message.encrypted || ''
		};
		socket.emit('chat_event_client_to_server', backendMessage);
	} else {
		// Offline: Save message for later sync
		try {
			await offlineStorage.savePendingMessage(message);
			await offlineStorage.saveMessagesForRoom(message.roomId, [message]);
			console.log('Message saved offline for later sync');
		} catch (error) {
			console.error('Failed to save message offline:', error);
		}
	}
};

export const loadChatHistory = (roomId: string, currentChatDocId?: string): AppThunk => (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('load_chat_doc_from_db', {
		roomId,
		curChatDocId: currentChatDocId
	}, (response: any) => {
		if (response.success && response.chat_history) {
			// Backend sends 'id', which we use directly
			const messages = response.chat_history.map((msg: any) => ({
				...msg,
				id: msg.id
			}));
			const hasMore = messages.length > 0;
			
			// Import the action from chatSlice
			const { addOlderMessages } = require('./chatSlice');
			dispatch(addOlderMessages({ roomId, messages, hasMore }));
		} else {
			// No more messages
			const { addOlderMessages } = require('./chatSlice');
			dispatch(addOlderMessages({ roomId, messages: [], hasMore: false }));
		}
	});
};

export const editMessage = (params: {
	id: string;
	chatDocId: string;
	roomId: string;
	newText: string;
}): AppThunk => (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	console.log('Editing message:', params);

	socket.emit('chat_edit_client_to_server', params, (response: any) => {
		if (response.success) {
			console.log('Message edited successfully:', response);
		} else {
			console.error('Failed to edit message:', response);
		}
	});
};

export const deleteMessage = (params: {
	id: string;
	chatDocId: string;
	roomId: string;
}): AppThunk => (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('chat_delete_client_to_server', params, (response: any) => {
		if (response.success) {
			console.log('Message deleted successfully:', response);
		} else {
			console.error('Failed to delete message:', response);
		}
	});
};

export const addReaction = (params: {
	reactionId: string;
	id: string;
	chatDocId: string;
	roomId: string;
	userUid: string;
	userName: string;
}): AppThunk => (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	const { reactionId, id, chatDocId, roomId } = params;
	socket.emit('chat_reaction_client_to_server', { reactionId, id, chatDocId, roomId }, (response: any) => {
		if (response.success) {
			console.log('Reaction added/removed successfully:', response);
		} else {
			console.error('Failed to add/remove reaction:', response);
		}
	});
};

export const saveMessage = (params: {
	id: string;
	chatDocId: string;
	roomId: string;
}): AppThunk => (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('chat_save_client_to_server', params, (response: any) => {
		if (response.success) {
			console.log('Message saved successfully:', response);
		} else {
			console.error('Failed to save message:', response);
		}
	});
};

export const requestConversationSummaryAction = (roomId: string): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	try {
		const response = await requestConversationSummary(socket, roomId);
		console.log('Conversation Summary:', response);
		return response;
	} catch (error) {
		console.error('Conversation Summary failed:', error);
		throw error;
	}
};

export const getSmartRepliesAction = (message: string, roomId?: string): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	try {
		const response = await getSmartReplies(socket, message, roomId);
		console.log('Smart Replies:', response);
		return response;
	} catch (error) {
		console.error('Smart Replies failed:', error);
		throw error;
	}
};

// Offline message loading
export const loadOfflineMessagesForRoom = (roomId: string): AppThunk => async (dispatch, getState) => {
	try {
		const messages = await offlineStorage.getMessagesForRoom(roomId);
		if (messages && messages.length > 0) {
			dispatch(loadOfflineMessages({ roomId, messages }));
			console.log(`Loaded ${messages.length} offline messages for room ${roomId}`);
		}
	} catch (error) {
		console.error('Failed to load offline messages:', error);
	}
};

// Sync pending messages when back online
export const syncPendingMessages = (): AppThunk => async (dispatch, getState) => {
	try {
		const pendingMessages = await offlineStorage.getPendingMessages();
		if (pendingMessages.length > 0) {
			console.log(`Syncing ${pendingMessages.length} pending messages`);
			
			// Send each pending message to server
			for (const pendingMessage of pendingMessages) {
				dispatch(sendMessageToServer(pendingMessage.message));
			}
			
			// Clear pending messages after sync
			await offlineStorage.clearPendingMessages();
		}
	} catch (error) {
		console.error('Failed to sync pending messages:', error);
	}
};

// Scheduled Messages WebSocket actions
export const scheduleMessage = (request: CreateScheduledMessageRequest): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('schedule_message', { scheduledMessage: request }, (response: ScheduledMessageResponse) => {
		if (response.success) {
			console.log('Message scheduled successfully:', response);
			// You can dispatch an action to update the Redux state here if needed
		} else {
			console.error('Failed to schedule message:', response.error);
		}
	});
};

export const getScheduledMessages = (userUid: string, roomId?: string): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('get_scheduled_messages', { roomId }, (response: ScheduledMessagesListResponse) => {
		if (response.success) {
			console.log('Scheduled messages retrieved:', response);
			// Dispatch action to update Redux state with scheduled messages
			if (response.scheduledMessages) {
				dispatch(setScheduledMessages({ roomId: roomId || 'all', messages: response.scheduledMessages }));
			}
		} else {
			console.error('Failed to get scheduled messages:', response.error);
		}
	});
};

export const updateScheduledMessage = (scheduledMessageId: string, userUid: string, updates: UpdateScheduledMessageRequest): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('update_scheduled_message', { scheduledMessageId, updates }, (response: ScheduledMessageResponse) => {
		if (response.success) {
			console.log('Scheduled message updated:', response);
			// Dispatch action to update Redux state with updated message
			if (response.scheduledMessage) {
				dispatch(updateScheduledMessageAction(response.scheduledMessage));
			}
		} else {
			console.error('Failed to update scheduled message:', response.error);
		}
	});
};

export const deleteScheduledMessage = (scheduledMessageId: string, userUid: string): AppThunk => async (dispatch, getState) => {
	const { socket } = getState().socket;
	if (!socket) return;

	socket.emit('delete_scheduled_message', { scheduledMessageId }, (response: { success: boolean; error?: string }) => {
		if (response.success) {
			console.log('Scheduled message deleted:', response);
			// Dispatch action to remove message from Redux state
			dispatch(removeScheduledMessage({ roomId: 'all', messageId: scheduledMessageId }));
		} else {
			console.error('Failed to delete scheduled message:', response.error);
		}
	});
};
