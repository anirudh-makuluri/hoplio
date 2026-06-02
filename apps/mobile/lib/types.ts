import { EncryptedData, RecipientEncryptedMessages } from './e2ee-types';

export type ChatMessage = {
	id: number | string;
	roomId: string;
	chatDocId?: string;
	type: 'text' | 'image' | 'gif' | 'file' | 'audio' | 'video';
	chatInfo: string;
	fileName?: string;
	isMsgEdited?: boolean;
	isMsgSaved?: boolean;
	isAIMessage?: boolean;
	isEncrypted?: boolean;
	encrypted?: EncryptedData | RecipientEncryptedMessages | '';
	decryptionError?: string;
	reactions?: Array<{
		id: string;
		reactors: Array<{ uid: string; name: string }>;
	}>;
	userUid: string;
	userName: string;
	userPhoto: string;
	time: any; //TODO: fix
	isUserInfoDisplayed?: boolean;
	isConsecutiveMessage?: boolean;
	isDate?: boolean;
};

export type ChatDate = {
	id?: undefined;
	roomId?: undefined;
	chatDocId?: undefined
	type?: undefined;
	chatInfo?: undefined;
	fileName?: undefined;
	isMsgEdited?: undefined;
	isMsgSaved?: undefined;
	isAIMessage?: undefined;
	userUid?: undefined;
	userName?: undefined;
	userPhoto?: undefined;
	time: string;
	isUserInfoDisplayed?: undefined,
	isConsecutiveMessage?: undefined,
	isDate?: boolean
}

export type TUser = {
	name: string,
	email: string,
	photo_url: string,
	uid: string,
	is_online?: boolean,
	last_seen?: number
}

export type TAuthUser = {
	email: string,
	name: string,
	photo_url: string,
	received_friend_requests: TUser[],
	friend_list: TUser[],
	sent_friend_requests: TUser[],
	uid: string,
	rooms: TRoomData[],
}

export type TRoomData = {
	is_group: boolean;
	roomId: string;
	messages: (ChatMessage | ChatDate)[];
	name: string;
	photo_url: string;
	currentChatDocId?: string;
	hasMoreMessages?: boolean;
	isLoadingMore?: boolean;
	is_ai_room?: boolean;
	members?: string[]; // Array of member UIDs for group chats
	created_at?: string; // Creation timestamp for group chats
	membersData?: TUser[];
}

// AI Assistant types
export type AIResponse = {
	success: boolean;
	response?: string;
	messageId?: string;
	error?: string;
}

export type AISummaryResponse = {
	success: boolean;
	summary?: string;
	timestamp?: string;
	error?: string;
}

export type AISentimentResponse = {
	success: boolean;
	sentiment?: 'positive' | 'negative' | 'neutral';
	timestamp?: string;
	error?: string;
}

export type AISmartRepliesResponse = {
	success: boolean;
	replies?: string[];
	timestamp?: string;
	error?: string;
}

export type AIRoomData = {
	success: boolean;
	roomId?: string;
	message?: string;
	room?: TRoomData;
	error?: string;
}

// Group Chat types
export type GroupCreateRequest = {
	name: string;
	photoUrl?: string;
	memberUids: string[];
}

export type GroupCreateResponse = {
	success: string;
	roomId: string;
	room: TRoomData;
}

export type GroupAddMembersRequest = {
	memberUids: string[];
}

export type GroupAddMembersResponse = {
	success: string;
	added: string[];
	roomId: string;
}

export type GroupRemoveMemberResponse = {
	success: string;
	removed: string;
	roomId: string;
}

export type GroupUpdateRequest = {
	name?: string;
	photoUrl?: string;
}

export type GroupUpdateResponse = {
	success: string;
	roomId: string;
	updates: Partial<GroupUpdateRequest>;
}

export type GroupDeleteResponse = {
	success: string;
	roomId: string;
}

// Presence types
export type PresenceUpdate = {
	uid: string;
	is_online: boolean;
	last_seen: number | null;
}

// Scheduled Messages types
export type ScheduledMessage = {
	id: string;
	userUid: string;
	roomId: string;
	message: string;
	messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
	fileName?: string;
	scheduledTime: Date;
	createdAt: Date;
	status: 'pending' | 'sent' | 'cancelled';
	recurring: boolean;
	recurringPattern?: 'daily' | 'weekly' | 'monthly';
	timezone: string;
	userName: string;
	userPhoto: string;
	sentAt?: Date;
}

export type CreateScheduledMessageRequest = {
	roomId: string;
	userUid: string;
	message: string;
	messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
	fileName?: string;
	scheduledTime: string; // ISO string
	recurring: boolean;
	recurringPattern?: 'daily' | 'weekly' | 'monthly';
	timezone: string;
}

export type UpdateScheduledMessageRequest = {
	message?: string;
	scheduledTime?: string; // ISO string
	recurring?: boolean;
	recurringPattern?: 'daily' | 'weekly' | 'monthly';
	timezone?: string;
}

export type ScheduledMessageResponse = {
	success: boolean;
	scheduledMessage?: ScheduledMessage;
	error?: string;
}

export type ScheduledMessagesListResponse = {
	success: boolean;
	scheduledMessages?: ScheduledMessage[];
	error?: string;
}

// Semantic search (vector search in room messages)
export type SemanticSearchResult = {
	message: ChatMessage & { chatDocId?: string };
	score: number;
};

export type SemanticSearchResponse = {
	success: boolean;
	results?: SemanticSearchResult[];
	message?: string;
	error?: string;
};
