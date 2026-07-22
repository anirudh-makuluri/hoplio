import { MAX_CACHED_MESSAGES_PER_ROOM } from './db/messageStore.types';
import { offlineStorage } from './offlineStorage';
import { ChatDate, ChatMessage, TRoomData } from './types';

export function isChatMessage(message: ChatMessage | ChatDate): message is ChatMessage {
	return !message.isDate;
}

export function toMessageTimeMs(time: ChatMessage['time']): number {
	if (typeof time === 'number' && Number.isFinite(time)) {
		return time;
	}

	if (typeof time === 'string') {
		const asNumber = Number(time);
		if (Number.isFinite(asNumber)) {
			return asNumber;
		}
		const parsed = Date.parse(time);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	if (time && typeof time === 'object') {
		const maybeSeconds = (time as { _seconds?: number; seconds?: number })._seconds
			?? (time as { seconds?: number }).seconds;
		if (typeof maybeSeconds === 'number' && Number.isFinite(maybeSeconds)) {
			return maybeSeconds * 1000;
		}
		const maybeMs = (time as { _milliseconds?: number })._milliseconds;
		if (typeof maybeMs === 'number' && Number.isFinite(maybeMs)) {
			return maybeMs;
		}
	}

	return Date.now();
}

export function extractChatMessages(messages: (ChatMessage | ChatDate)[]): ChatMessage[] {
	return messages.filter(isChatMessage);
}

export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
	const byId = new Map<string, ChatMessage>();

	for (const list of lists) {
		for (const message of list) {
			if (message?.id == null) {
				continue;
			}
			byId.set(String(message.id), message);
		}
	}

	return [...byId.values()]
		.sort((a, b) => toMessageTimeMs(a.time) - toMessageTimeMs(b.time))
		.slice(-MAX_CACHED_MESSAGES_PER_ROOM);
}

export async function mergeRoomWithCachedMessages(room: TRoomData): Promise<TRoomData> {
	const cached = await offlineStorage.getMessagesForRoom(room.roomId);
	const sessionMessages = extractChatMessages(room.messages || []);

	if (!cached?.length) {
		return room;
	}

	return {
		...room,
		messages: mergeMessages(cached, sessionMessages),
	};
}

export function roomsArrayToMap(rooms: TRoomData[]): Record<string, TRoomData> {
	return Object.fromEntries(rooms.map((room) => [room.roomId, room]));
}

export async function persistMessagesForRoom(
	roomId: string,
	messages: (ChatMessage | ChatDate)[]
): Promise<void> {
	const chatMessages = extractChatMessages(messages);
	if (chatMessages.length === 0) {
		return;
	}

	await offlineStorage.saveMessagesForRoom(roomId, chatMessages);
}

export async function persistMessage(message: ChatMessage): Promise<void> {
	await offlineStorage.saveMessagesForRoom(message.roomId, [message]);
}

export async function persistRoomData(room: TRoomData): Promise<void> {
	await persistMessagesForRoom(room.roomId, room.messages || []);
}

export async function persistRoomsMetadata(rooms: TRoomData[]): Promise<void> {
	if (rooms.length === 0) {
		return;
	}

	await offlineStorage.saveRoomsData(roomsArrayToMap(rooms));
}
