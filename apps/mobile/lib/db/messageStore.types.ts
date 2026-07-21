import type { ChatMessage } from '../types';

export const MAX_CACHED_MESSAGES_PER_ROOM = 100;

export type PendingMessage = {
	id: string;
	roomId: string;
	message: ChatMessage;
	timestamp: number;
	retryCount: number;
};
