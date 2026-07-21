import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types';
import { MAX_CACHED_MESSAGES_PER_ROOM, type PendingMessage } from './messageStore.types';

export { MAX_CACHED_MESSAGES_PER_ROOM, type PendingMessage };

const MESSAGES_DATA_KEY = 'offline_messages_data';
const PENDING_MESSAGES_KEY = 'offline_pending_messages';

async function readMessagesData(): Promise<Record<string, ChatMessage[]>> {
	const raw = await AsyncStorage.getItem(MESSAGES_DATA_KEY);
	return raw ? (JSON.parse(raw) as Record<string, ChatMessage[]>) : {};
}

async function writeMessagesData(data: Record<string, ChatMessage[]>): Promise<void> {
	await AsyncStorage.setItem(MESSAGES_DATA_KEY, JSON.stringify(data));
}

export async function saveMessagesForRoom(roomId: string, messages: ChatMessage[]): Promise<void> {
	if (!roomId || messages.length === 0) {
		return;
	}

	const data = await readMessagesData();
	const existing = data[roomId] ?? [];
	data[roomId] = [...existing, ...messages].slice(-MAX_CACHED_MESSAGES_PER_ROOM);
	await writeMessagesData(data);
}

export async function getMessagesForRoom(roomId: string): Promise<ChatMessage[] | null> {
	const data = await readMessagesData();
	return data[roomId] ?? null;
}

export async function getAllMessagesData(): Promise<Record<string, ChatMessage[]>> {
	return readMessagesData();
}

export async function replaceAllMessagesData(
	messagesByRoom: Record<string, ChatMessage[]>
): Promise<void> {
	const trimmed: Record<string, ChatMessage[]> = {};
	for (const [roomId, messages] of Object.entries(messagesByRoom)) {
		trimmed[roomId] = messages.slice(-MAX_CACHED_MESSAGES_PER_ROOM);
	}
	await writeMessagesData(trimmed);
}

export async function clearCachedMessages(): Promise<void> {
	await AsyncStorage.removeItem(MESSAGES_DATA_KEY);
}

export async function savePendingMessage(message: ChatMessage): Promise<void> {
	const pending = await getPendingMessages();
	pending.push({
		id: String(message.id),
		roomId: message.roomId,
		message,
		timestamp: Date.now(),
		retryCount: 0,
	});
	await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));
}

export async function getPendingMessages(): Promise<PendingMessage[]> {
	const raw = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
	return raw ? (JSON.parse(raw) as PendingMessage[]) : [];
}

export async function replacePendingMessages(pending: PendingMessage[]): Promise<void> {
	await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));
}

export async function clearPendingMessages(): Promise<void> {
	await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
}

export async function removePendingMessage(messageId: string): Promise<void> {
	const pending = await getPendingMessages();
	const next = pending.filter((item) => item.id !== messageId);
	await replacePendingMessages(next);
}

export async function incrementPendingRetry(messageId: string): Promise<void> {
	const pending = await getPendingMessages();
	const next = pending.map((item) =>
		item.id === messageId
			? { ...item, retryCount: item.retryCount + 1, timestamp: Date.now() }
			: item
	);
	await replacePendingMessages(next);
}

export async function clearAllMessageData(): Promise<void> {
	await AsyncStorage.multiRemove([MESSAGES_DATA_KEY, PENDING_MESSAGES_KEY]);
}
