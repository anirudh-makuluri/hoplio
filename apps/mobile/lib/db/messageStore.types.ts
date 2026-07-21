import type { ChatMessage } from '../types';

export const MAX_CACHED_MESSAGES_PER_ROOM = 100;
export const MAX_PENDING_RETRIES = 5;
export const PENDING_MESSAGE_ACK_TIMEOUT_MS = 10000;

export type PendingMessage = {
	id: string;
	roomId: string;
	message: ChatMessage;
	timestamp: number;
	retryCount: number;
};
