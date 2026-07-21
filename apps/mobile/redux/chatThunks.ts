import { AppThunk } from './store';
import { addMessage, addOlderMessages, joinChatRoom } from './chatSlice';
import {
	mergeRoomWithCachedMessages,
	persistMessage,
	persistMessagesForRoom,
	persistRoomData,
} from '../lib/messageCache';
import { offlineStorage } from '../lib/offlineStorage';
import { ChatMessage, TRoomData } from '../lib/types';

export const joinChatRoomWithCache = (roomData: TRoomData): AppThunk => async (dispatch) => {
	const mergedRoom = await mergeRoomWithCachedMessages(roomData);
	dispatch(joinChatRoom(mergedRoom));

	try {
		await persistRoomData(mergedRoom);
	} catch (error) {
		console.error(`Failed to cache messages for room ${mergedRoom.roomId}:`, error);
	}
};

export const receiveChatMessage = (params: {
	message: ChatMessage;
	currentUserUid?: string;
}): AppThunk => async (dispatch) => {
	dispatch(addMessage(params));

	try {
		await persistMessage(params.message);
		await offlineStorage.removePendingMessage(String(params.message.id));
	} catch (error) {
		console.error('Failed to cache incoming message:', error);
	}
};

export const loadOlderMessagesWithCache = (payload: {
	roomId: string;
	messages: ChatMessage[];
	hasMore: boolean;
}): AppThunk => async (dispatch, getState) => {
	dispatch(addOlderMessages(payload));

	try {
		const roomMessages = getState().chat.rooms[payload.roomId]?.messages ?? [];
		await persistMessagesForRoom(payload.roomId, roomMessages);
	} catch (error) {
		console.error(`Failed to cache older messages for room ${payload.roomId}:`, error);
	}
};
