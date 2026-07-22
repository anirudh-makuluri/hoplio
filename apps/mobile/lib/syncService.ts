import type { Socket } from 'socket.io-client';
import { offlineStorage } from './offlineStorage';
import { MAX_PENDING_RETRIES, PENDING_MESSAGE_ACK_TIMEOUT_MS } from './db/messageStore.types';
import type { ChatMessage } from './types';

function toBackendMessage(message: ChatMessage) {
	return {
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
		encrypted: message.encrypted || '',
	};
}

export function waitForMessageAck(socket: Socket, message: ChatMessage): Promise<boolean> {
	return new Promise((resolve) => {
		const messageId = String(message.id);
		let settled = false;

		const cleanup = () => {
			if (settled) {
				return;
			}
			settled = true;
			socket.off('chat_event_server_to_client', onServerMessage);
			clearTimeout(timer);
		};

		const onServerMessage = (msg: ChatMessage) => {
			if (String(msg.id) === messageId && msg.roomId === message.roomId) {
				cleanup();
				resolve(true);
			}
		};

		socket.on('chat_event_server_to_client', onServerMessage);
		socket.emit('chat_event_client_to_server', toBackendMessage(message));

		const timer = setTimeout(() => {
			cleanup();
			resolve(false);
		}, PENDING_MESSAGE_ACK_TIMEOUT_MS);
	});
}

export async function flushPendingMessages(socket: Socket | null): Promise<{
	sent: number;
	failed: number;
	skipped: number;
}> {
	if (!socket?.connected) {
		return { sent: 0, failed: 0, skipped: 0 };
	}

	const pendingMessages = await offlineStorage.getPendingMessages();
	let sent = 0;
	let failed = 0;
	let skipped = 0;

	for (const pending of pendingMessages) {
		if (pending.retryCount >= MAX_PENDING_RETRIES) {
			await offlineStorage.removePendingMessage(pending.id);
			skipped++;
			continue;
		}

		const delivered = await waitForMessageAck(socket, pending.message);
		if (delivered) {
			await offlineStorage.removePendingMessage(pending.id);
			sent++;
		} else {
			await offlineStorage.incrementPendingRetry(pending.id);
			failed++;
		}
	}

	return { sent, failed, skipped };
}
