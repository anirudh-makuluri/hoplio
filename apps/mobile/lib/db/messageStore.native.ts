import * as SQLite from 'expo-sqlite';
import type { ChatMessage } from '../types';
import { MAX_CACHED_MESSAGES_PER_ROOM, type PendingMessage } from './messageStore.types';

export { MAX_CACHED_MESSAGES_PER_ROOM, type PendingMessage };
type MessageRow = {
	room_id: string;
	message_id: string;
	time_ms: number;
	payload: string;
};

type PendingRow = {
	id: string;
	room_id: string;
	timestamp: number;
	retry_count: number;
	payload: string;
};

const DB_NAME = 'hoplio-messages.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function toMessageId(message: ChatMessage): string {
	return String(message.id);
}

function toTimeMs(time: ChatMessage['time']): number {
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

async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const db = await SQLite.openDatabaseAsync(DB_NAME);
			await db.execAsync(`
				PRAGMA journal_mode = WAL;
				PRAGMA foreign_keys = ON;

				CREATE TABLE IF NOT EXISTS cached_messages (
					room_id TEXT NOT NULL,
					message_id TEXT NOT NULL,
					time_ms INTEGER NOT NULL,
					payload TEXT NOT NULL,
					PRIMARY KEY (room_id, message_id)
				);

				CREATE INDEX IF NOT EXISTS idx_cached_messages_room_time
					ON cached_messages (room_id, time_ms);

				CREATE TABLE IF NOT EXISTS pending_messages (
					id TEXT PRIMARY KEY NOT NULL,
					room_id TEXT NOT NULL,
					timestamp INTEGER NOT NULL,
					retry_count INTEGER NOT NULL DEFAULT 0,
					payload TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_pending_messages_room
					ON pending_messages (room_id);
			`);
			return db;
		})().catch((error) => {
			dbPromise = null;
			throw error;
		});
	}

	return dbPromise;
}

async function trimRoomCache(db: SQLite.SQLiteDatabase, roomId: string): Promise<void> {
	await db.runAsync(
		`
			DELETE FROM cached_messages
			WHERE room_id = ?
				AND message_id IN (
					SELECT message_id
					FROM cached_messages
					WHERE room_id = ?
					ORDER BY time_ms DESC, message_id DESC
					LIMIT -1 OFFSET ?
				)
		`,
		roomId,
		roomId,
		MAX_CACHED_MESSAGES_PER_ROOM
	);
}

export async function saveMessagesForRoom(roomId: string, messages: ChatMessage[]): Promise<void> {
	if (!roomId || messages.length === 0) {
		return;
	}

	const db = await getDb();

	await db.withTransactionAsync(async () => {
		for (const message of messages) {
			if (message?.id == null) {
				continue;
			}

			await db.runAsync(
				`
					INSERT INTO cached_messages (room_id, message_id, time_ms, payload)
					VALUES (?, ?, ?, ?)
					ON CONFLICT(room_id, message_id) DO UPDATE SET
						time_ms = excluded.time_ms,
						payload = excluded.payload
				`,
				roomId,
				toMessageId(message),
				toTimeMs(message.time),
				JSON.stringify(message)
			);
		}

		await trimRoomCache(db, roomId);
	});
}

export async function getMessagesForRoom(roomId: string): Promise<ChatMessage[] | null> {
	const db = await getDb();
	const rows = await db.getAllAsync<MessageRow>(
		`
			SELECT room_id, message_id, time_ms, payload
			FROM cached_messages
			WHERE room_id = ?
			ORDER BY time_ms ASC, message_id ASC
		`,
		roomId
	);

	if (rows.length === 0) {
		return null;
	}

	return rows.map((row) => JSON.parse(row.payload) as ChatMessage);
}

export async function getAllMessagesData(): Promise<Record<string, ChatMessage[]>> {
	const db = await getDb();
	const rows = await db.getAllAsync<MessageRow>(
		`
			SELECT room_id, message_id, time_ms, payload
			FROM cached_messages
			ORDER BY room_id ASC, time_ms ASC, message_id ASC
		`
	);

	const byRoom: Record<string, ChatMessage[]> = {};
	for (const row of rows) {
		if (!byRoom[row.room_id]) {
			byRoom[row.room_id] = [];
		}
		byRoom[row.room_id].push(JSON.parse(row.payload) as ChatMessage);
	}
	return byRoom;
}

export async function replaceAllMessagesData(
	messagesByRoom: Record<string, ChatMessage[]>
): Promise<void> {
	const db = await getDb();

	await db.withTransactionAsync(async () => {
		await db.runAsync('DELETE FROM cached_messages');

		for (const [roomId, messages] of Object.entries(messagesByRoom)) {
			const recent = messages.slice(-MAX_CACHED_MESSAGES_PER_ROOM);
			for (const message of recent) {
				if (message?.id == null) {
					continue;
				}

				await db.runAsync(
					`
						INSERT INTO cached_messages (room_id, message_id, time_ms, payload)
						VALUES (?, ?, ?, ?)
					`,
					roomId,
					toMessageId(message),
					toTimeMs(message.time),
					JSON.stringify(message)
				);
			}
		}
	});
}

export async function clearCachedMessages(): Promise<void> {
	const db = await getDb();
	await db.runAsync('DELETE FROM cached_messages');
}

export async function savePendingMessage(message: ChatMessage): Promise<void> {
	const db = await getDb();
	const pending: PendingMessage = {
		id: toMessageId(message),
		roomId: message.roomId,
		message,
		timestamp: Date.now(),
		retryCount: 0,
	};

	await db.runAsync(
		`
			INSERT INTO pending_messages (id, room_id, timestamp, retry_count, payload)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				room_id = excluded.room_id,
				timestamp = excluded.timestamp,
				retry_count = excluded.retry_count,
				payload = excluded.payload
		`,
		pending.id,
		pending.roomId,
		pending.timestamp,
		pending.retryCount,
		JSON.stringify(pending.message)
	);
}

export async function getPendingMessages(): Promise<PendingMessage[]> {
	const db = await getDb();
	const rows = await db.getAllAsync<PendingRow>(
		`
			SELECT id, room_id, timestamp, retry_count, payload
			FROM pending_messages
			ORDER BY timestamp ASC
		`
	);

	return rows.map((row) => ({
		id: row.id,
		roomId: row.room_id,
		timestamp: row.timestamp,
		retryCount: row.retry_count,
		message: JSON.parse(row.payload) as ChatMessage,
	}));
}

export async function replacePendingMessages(pending: PendingMessage[]): Promise<void> {
	const db = await getDb();

	await db.withTransactionAsync(async () => {
		await db.runAsync('DELETE FROM pending_messages');
		for (const item of pending) {
			await db.runAsync(
				`
					INSERT INTO pending_messages (id, room_id, timestamp, retry_count, payload)
					VALUES (?, ?, ?, ?, ?)
				`,
				item.id,
				item.roomId,
				item.timestamp,
				item.retryCount,
				JSON.stringify(item.message)
			);
		}
	});
}

export async function clearPendingMessages(): Promise<void> {
	const db = await getDb();
	await db.runAsync('DELETE FROM pending_messages');
}

export async function clearAllMessageData(): Promise<void> {
	const db = await getDb();
	await db.withTransactionAsync(async () => {
		await db.runAsync('DELETE FROM cached_messages');
		await db.runAsync('DELETE FROM pending_messages');
	});
}
