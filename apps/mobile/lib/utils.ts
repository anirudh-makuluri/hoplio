import { ChatMessage, ChatDate, GroupCreateRequest, GroupCreateResponse, GroupAddMembersRequest, GroupAddMembersResponse, GroupRemoveMemberResponse, GroupUpdateRequest, GroupUpdateResponse, GroupDeleteResponse } from "./types"
import { globals } from "../globals"
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EncryptedData, RecipientEncryptedMessages } from './e2ee-types';
import * as crypto from './crypto';
import * as deviceManager from './device-manager';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (typeof error === 'string' && error.trim().length > 0) {
		return error;
	}

	if (error && typeof error === 'object') {
		const candidate = (error as any).error || (error as any).message;
		if (typeof candidate === 'string' && candidate.trim().length > 0) {
			return candidate;
		}
	}

	return fallback;
};

export const customFetch = async ({ pathName, method = 'GET', body }: {
	pathName: string,
	method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
	body?: Object
}): Promise<any> => {
	return new Promise(async (resolve, reject) => {
		const requestObj: RequestInit = {
			method,
			credentials: 'include',
			cache: 'no-store'
		}

	if (method == 'POST' || method == 'PUT' || method == 'PATCH') {
		requestObj.body = JSON.stringify(body);
		requestObj.headers = {
			"Content-Type": "application/json",
		}
	}

		try {
			console.log(`${globals.BACKEND_URL}/${pathName}`);
			const response = await fetch(`${globals.BACKEND_URL}/${pathName}`, requestObj);

			if (!response.ok) {
				return reject(response);
			}

			const data = await response.json();
			resolve(data);

		} catch (error) {
			reject(error)
		}
	})
}

export function genRoomId(uid1: string, uid2: string): string {
	const sortedUids = [uid1, uid2].sort();


	const roomId = sortedUids.join('_');

	return roomId;
}

export function formatChatMessages(messages: (ChatDate | ChatMessage)[]) {
	const formattedMessages: (ChatDate | ChatMessage)[] = [];
	let lastDate: null | string = null;

	messages.forEach((chatEvent, index) => {
		if (chatEvent.isDate) return;
		const msg = chatEvent as ChatMessage;

		const prevIndex = index > 0 ? index - 1 : -1;
		let lastMessage: ChatDate | ChatMessage | null =
			prevIndex >= 0 ? messages[prevIndex] : null;
		if (lastMessage?.isDate && prevIndex > 0) {
			lastMessage = messages[prevIndex - 1];
		}
		const isConsecutiveMessage =
			lastMessage != null &&
			!lastMessage.isDate &&
			'userUid' in lastMessage &&
			lastMessage.userUid === msg.userUid;

		const rawTime = msg.time;
		const time =
			rawTime != null &&
			typeof rawTime === 'object' &&
			'_seconds' in rawTime
				? new Date((rawTime as { _seconds: number })._seconds * 1000)
				: rawTime instanceof Date
					? rawTime
					: new Date(rawTime);

		const day = String(time.getDate()).padStart(2, '0');
		const month = String(time.getMonth() + 1).padStart(2, '0');
		const year = time.getFullYear();

		if (lastDate == null || lastDate !== `${day}-${month}-${year}`) {
			lastDate = `${day}-${month}-${year}`;
			formattedMessages.push({
				time: formatDateForChat(time),
				isDate: true,
			});
		}

		formattedMessages.push({
			...msg,
			time,
			isConsecutiveMessage,
		});
	});

	return formattedMessages;
}

export function decryptChatMessage(message: ChatMessage): ChatMessage {
	if (!message.isEncrypted || !message.encrypted) {
		return message;
	}

	try {
		if (!crypto.isSodiumReady()) {
			return {
				...message,
				chatInfo: message.chatInfo || 'Encrypted message',
				decryptionError: 'Secure messaging is still loading',
			};
		}

		const ownerUserId = deviceManager.getOwnerUserId();
		const deviceId = deviceManager.getDeviceId();
		const roomKeyPair = deviceManager.getRoomKeyPair(message.roomId);

		if (!ownerUserId || !deviceId || !roomKeyPair) {
			return {
				...message,
				chatInfo: 'Encrypted message unavailable on this device',
				decryptionError: 'Missing device or room key',
			};
		}

		let ciphertext: string | null = null;
		const encryptedPayload = message.encrypted;

		if (typeof encryptedPayload === 'object' && encryptedPayload && 'ciphertext' in encryptedPayload) {
			ciphertext = (encryptedPayload as EncryptedData).ciphertext;
		} else if (typeof encryptedPayload === 'object' && encryptedPayload) {
			const recipientMap = encryptedPayload as RecipientEncryptedMessages;
			ciphertext = recipientMap[ownerUserId]?.[deviceId]?.ciphertext ?? null;
		}

		if (!ciphertext) {
			return {
				...message,
				chatInfo: 'Encrypted message unavailable on this device',
				decryptionError: 'No encrypted payload for this device',
			};
		}

		return {
			...message,
			chatInfo: crypto.decryptMessage(ciphertext, roomKeyPair),
			decryptionError: undefined,
		};
	} catch (error) {
		return {
			...message,
			chatInfo: 'Unable to decrypt message',
			decryptionError: error instanceof Error ? error.message : 'Unknown decryption error',
		};
	}
}


function formatDateForChat(date: Date) {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const isToday = date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear();

	const isYesterday = date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isToday) {
		return 'Today';
	} else if (isYesterday) {
		return 'Yesterday';
	} else {
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		return `${day}-${month}-${year}`;
	}
}

export const uploadFile = async (
	userUid: string,
	fileUri: string,
	fileName: string,
	fileType: string
): Promise<string> => {
	return new Promise(async (resolve, reject) => {
		try {
			// Create form data
			const formData = new FormData();
			
			// Generate storage path
			const timestamp = Date.now();
			const storagePath = `chat-files/${userUid}/${timestamp}_${fileName}`;
			
			// Append file
			formData.append('file', {
				uri: fileUri,
				name: fileName,
				type: fileType
			} as any);

			// Upload file
			const response = await fetch(
				`${globals.BACKEND_URL}/users/${userUid}/files?storagePath=${encodeURIComponent(storagePath)}`,
				{
					method: 'POST',
					credentials: 'include',
					body: formData
				}
			);

			if (!response.ok) {
				throw new Error('File upload failed');
			}

			const data = await response.json();
			resolve(data.downloadUrl);
		} catch (error) {
			reject(error);
		}
	});
};

// AI Assistant API functions
export const createAIAssistantRoom = async (userUid: string): Promise<any> => {
	return customFetch({
		pathName: `users/${userUid}/ai-assistant/room`,
		method: 'POST'
	});
};

export const requestConversationSummary = (socket: any, roomId: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (!socket) {
			reject(new Error('Socket not connected'));
			return;
		}

		socket.emit('ai_summarize_conversation', {
			roomId
		}, (response: any) => {
			if (response.success) {
				resolve(response);
			} else {
				reject(new Error(response.error || 'Summary request failed'));
			}
		});
	});
};

export const analyzeMessageSentiment = (socket: any, message: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (!socket) {
			reject(new Error('Socket not connected'));
			return;
		}

		socket.emit('ai_analyze_sentiment', {
			message
		}, (response: any) => {
			if (response.success) {
				resolve(response);
			} else {
				reject(new Error(response.error || 'Sentiment analysis failed'));
			}
		});
	});
};

export const getSmartReplies = (socket: any, message: string, roomId?: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (!socket) {
			reject(new Error('Socket not connected'));
			return;
		}

		socket.emit('ai_smart_replies', {
			message,
			roomId
		}, (response: any) => {
			if (response.success) {
				resolve(response);
			} else {
				reject(new Error(response.error || 'Smart replies request failed'));
			}
		});
	});
};

// User profile update functions
export const updateUserName = (socket: any, userUid: string, newName: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (!socket) {
			reject(new Error('Socket not connected'));
			return;
		}

		socket.emit('update_user_data', { 
			newData: { name: newName } 
		}, (response: any) => {
			if (response.success) {
				resolve(response);
			} else {
				reject(new Error(response.error || 'Name update failed'));
			}
		});
	});
};

export const updateUserProfilePicture = (socket: any, userUid: string, photoUrl: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		if (!socket) {
			reject(new Error('Socket not connected'));
			return;
		}

		socket.emit('update_user_data', { 
			newData: { photo_url: photoUrl } 
		}, (response: any) => {
			if (response.success) {
				resolve(response);
			} else {
				reject(new Error(response.error || 'Profile picture update failed'));
			}
		});
	});
};

export const uploadProfilePicture = async (userUid: string, fileUri: string): Promise<string> => {
	return new Promise(async (resolve, reject) => {
		try {
			const storagePath = `${encodeURIComponent(userUid)}-profile_photo`;
			
			const formData = new FormData();
			formData.append('file', {
				uri: fileUri,
				name: 'profile_photo.jpg',
				type: 'image/jpeg'
			} as any);

			const response = await fetch(
				`${globals.BACKEND_URL}/users/${userUid}/files?storagePath=${storagePath}`,
				{
					method: 'POST',
					credentials: 'include',
					body: formData
				}
			);

			if (!response.ok) {
				throw new Error('Profile picture upload failed');
			}

			const data = await response.json();
			if (data.success) {
				resolve(data.downloadUrl);
			} else {
				throw new Error(data.error || 'Upload failed');
			}
		} catch (error) {
			reject(error);
		}
	});
};

// Group Chat API functions
export const createGroup = async (userUid: string, groupData: GroupCreateRequest): Promise<GroupCreateResponse> => {
	return customFetch({
		pathName: `users/${userUid}/groups`,
		method: 'POST',
		body: groupData
	});
};

export const addMembersToGroup = async (userUid: string, roomId: string, memberData: GroupAddMembersRequest): Promise<GroupAddMembersResponse> => {
	return customFetch({
		pathName: `users/${userUid}/groups/${roomId}/members`,
		method: 'POST',
		body: memberData
	});
};

export const removeMemberFromGroup = async (userUid: string, roomId: string, memberUid: string): Promise<GroupRemoveMemberResponse> => {
	return customFetch({
		pathName: `users/${userUid}/groups/${roomId}/members/${memberUid}`,
		method: 'DELETE'
	});
};

export const updateGroupInfo = async (userUid: string, roomId: string, updateData: GroupUpdateRequest): Promise<GroupUpdateResponse> => {
	return customFetch({
		pathName: `users/${userUid}/groups/${roomId}`,
		method: 'PATCH',
		body: updateData
	});
};

export const deleteGroup = async (userUid: string, roomId: string): Promise<GroupDeleteResponse> => {
	return customFetch({
		pathName: `users/${userUid}/groups/${roomId}`,
		method: 'DELETE'
	});
};
