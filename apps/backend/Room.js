const uuid = require('uuid');

const config = require('./config');
const utils = require('./utils');
const vectorEmbedder = require('./helpers/vector-embedder');
const logger = require('./logger');

module.exports = class Room {
	constructor(roomId, io, roomRef, isGroup, members, roomName, photoUrl, realtimeService = null) {
		this.roomId = roomId;
		this.io = io;
		this.realtimeService = realtimeService;
		this.roomRef = roomRef;
		this.isGroup = isGroup;
		this.members = members;
		this.roomName = roomName;
		this.photoUrl = photoUrl;
	}

	async emitToRoom(eventName, payload) {
		if (this.realtimeService?.emitRoomEvent) {
			await this.realtimeService.emitRoomEvent(this.roomId, eventName, payload);
			return;
		}

		this.io.to(this.roomId).emit(eventName, payload);
	}

	async getRoomState() {
		const roomSnap = await this.roomRef.get();
		return roomSnap.data() || {};
	}

	async loadChatFromDb(curChatDocId) {
		const roomData = await this.getRoomState();
		const chatDocIds = roomData.chat_doc_ids || [];

		let reqIdx = chatDocIds.length - 1;
		if (curChatDocId) {
			reqIdx = chatDocIds.findIndex((id) => id === curChatDocId) - 1;
		}

		if (reqIdx < 0) {
			return { error: 'No document found' };
		}

		const reqChatDocSnap = await this.roomRef.collection('chat_history').doc(chatDocIds[reqIdx]).get();
		return { success: 'Successfully fetch chat doc', chat_history: reqChatDocSnap.data().chat_history };
	}

	async getChatMessage(chatDocId, id) {
		const chatDocRef = this.roomRef.collection('chat_history').doc(chatDocId);
		const chatDocSnap = await chatDocRef.get();
		if (!chatDocSnap.exists) {
			throw new Error('Chat document not found');
		}

		const chatHistory = chatDocSnap.data().chat_history || [];
		const reqIdx = chatHistory.findIndex((msg) => msg.id === id);
		if (reqIdx === -1) {
			throw new Error('Required message not found');
		}

		return {
			chatDocRef,
			chatHistory,
			message: chatHistory[reqIdx],
			messageIndex: reqIdx
		};
	}

	async getWritableChatDoc() {
		const roomData = await this.getRoomState();
		const chatDocIds = roomData.chat_doc_ids || [];
		const currentChatDocId = chatDocIds[chatDocIds.length - 1];

		if (currentChatDocId) {
			const currentChatDocRef = this.roomRef.collection('chat_history').doc(currentChatDocId);
			const currentChatDocSnap = await currentChatDocRef.get();
			const currentChatDocMsgCnt = currentChatDocSnap.data()?.chat_history?.length || 0;

			if (currentChatDocMsgCnt < config.chatDocSize) {
				return {
					chatDocId: currentChatDocId,
					chatDocRef: currentChatDocRef,
					isNewDocument: false
				};
			}
		}

		const nextChatDocId = `${utils.formatDate(new Date())}_${uuid.v4()}_chat`;
		return {
			chatDocId: nextChatDocId,
			chatDocRef: this.roomRef.collection('chat_history').doc(nextChatDocId),
			isNewDocument: true
		};
	}

	async newChatEvent(chatEvent) {
		chatEvent.time = new Date();

		const isEncrypted = chatEvent.isEncrypted ?? false;
		const writableChatDoc = await this.getWritableChatDoc();
		chatEvent.chatDocId = writableChatDoc.chatDocId;

		const chatObject = {
			id: chatEvent.id,
			chatDocId: writableChatDoc.chatDocId,
			userUid: chatEvent.userUid,
			type: chatEvent.type,
			chatInfo: chatEvent.chatInfo,
			fileName: chatEvent.fileName || '',
			userName: chatEvent.userName,
			userPhoto: chatEvent.userPhoto,
			isMsgEdited: chatEvent.isMsgEdited ?? false,
			isMsgSaved: chatEvent.isMsgSaved ?? false,
			time: chatEvent.time,
			isEncrypted,
			encrypted: chatEvent.encrypted || ''
		};

		if (!isEncrypted) {
			const embedding = await vectorEmbedder.getEmbedding(chatEvent.chatInfo);
			if (embedding && embedding.length > 0) {
				chatObject.vector_embedding = embedding;
			}
		}

		if (writableChatDoc.isNewDocument) {
			await writableChatDoc.chatDocRef.set({
				chat_history: config.firebase.admin.firestore.FieldValue.arrayUnion(chatObject),
				created_at: new Date()
			});

			await this.roomRef.update({
				chat_doc_ids: config.firebase.admin.firestore.FieldValue.arrayUnion(writableChatDoc.chatDocId)
			});
		} else {
			await writableChatDoc.chatDocRef.update({
				chat_history: config.firebase.admin.firestore.FieldValue.arrayUnion(chatObject)
			});
		}

		await this.emitToRoom('chat_event_server_to_client', chatEvent);

		return { success: `Successfully sent chat msg to roomId: ${this.roomId}` };
	}

	async deleteChatMessage({ id, chatDocId, actorUid }) {
		const { chatDocRef, chatHistory, message, messageIndex } = await this.getChatMessage(chatDocId, id);
		if (message.userUid !== actorUid) {
			throw new Error('You can only delete your own messages');
		}

		chatHistory.splice(messageIndex, 1);

		await chatDocRef.update({
			chat_history: chatHistory
		});

		await this.emitToRoom('chat_delete_server_to_client', { id, chatDocId, roomId: this.roomId });

		return { success: `Successfully deleted chat in roomId: ${this.roomId}` };
	}

	async editChatMessage({ id, chatDocId, newText, actorUid }) {
		const { chatDocRef, chatHistory, message, messageIndex } = await this.getChatMessage(chatDocId, id);
		if (message.userUid !== actorUid) {
			throw new Error('You can only edit your own messages');
		}

		chatHistory[messageIndex].chatInfo = newText;
		chatHistory[messageIndex].isMsgEdited = true;

		await chatDocRef.update({
			chat_history: chatHistory
		});

		await this.emitToRoom('chat_edit_server_to_client', { id, chatDocId, roomId: this.roomId, newText });

		return { success: `Successfully edited chat in roomId: ${this.roomId}` };
	}

	async saveChatMessage({ id, chatDocId }) {
		const { chatDocRef, chatHistory, messageIndex } = await this.getChatMessage(chatDocId, id);
		const roomData = await this.getRoomState();
		const isMsgSaved = chatHistory[messageIndex].isMsgSaved || false;

		if (isMsgSaved) {
			chatHistory[messageIndex].isMsgSaved = false;

			const savedMessages = roomData.saved_messages || [];
			const reqSavedMsgIdx = savedMessages.findIndex((msg) => msg.id === id);

			if (reqSavedMsgIdx !== -1) {
				savedMessages.splice(reqSavedMsgIdx, 1);

				await this.roomRef.update({
					saved_messages: savedMessages
				});
			}
		} else {
			chatHistory[messageIndex].isMsgSaved = true;

			await this.roomRef.update({
				saved_messages: config.firebase.admin.firestore.FieldValue.arrayUnion({
					...chatHistory[messageIndex]
				})
			});
		}

		await chatDocRef.update({
			chat_history: chatHistory
		});

		await this.emitToRoom('chat_save_server_to_client', { id, chatDocId, roomId: this.roomId });

		return { success: `Successfully saved chat in roomId: ${this.roomId}` };
	}

	async updateReaction({ reactionId, id, chatDocId, userUid, userName }) {
		const chatDocRef = this.roomRef.collection('chat_history').doc(chatDocId);
		const chatDocSnap = await chatDocRef.get();
		const chatHistory = chatDocSnap.data().chat_history;
		const reqIdx = chatHistory.findIndex((msg) => msg.id === id);

		if (reqIdx === -1) {
			throw new Error('Required message not found');
		}

		const reactions = chatHistory[reqIdx].reactions || [];
		const reqReactionIdx = reactions.findIndex((data) => data.id === reactionId);

		if (reqReactionIdx === -1) {
			reactions.push({
				id: reactionId,
				reactors: [{
					uid: userUid,
					name: userName
				}]
			});
		} else {
			const reqReactorIdx = reactions[reqReactionIdx].reactors.findIndex((data) => data.uid === userUid);

			if (reqReactorIdx === -1) {
				reactions[reqReactionIdx].reactors.push({
					name: userName,
					uid: userUid
				});
			} else {
				reactions[reqReactionIdx].reactors.splice(reqReactorIdx, 1);

				if (reactions[reqReactionIdx].reactors.length === 0) {
					reactions.splice(reqReactionIdx, 1);
				}
			}
		}

		chatHistory[reqIdx].reactions = reactions;

		await chatDocRef.update({
			chat_history: chatHistory
		});

		await this.emitToRoom('chat_reaction_server_to_client', { reactionId, id, chatDocId, userUid, userName, roomId: this.roomId });

		return { success: `Successfully updated chat reaction in roomId: ${this.roomId}` };
	}

	async getRecentChatHistory(limit = 10) {
		try {
			const roomData = await this.getRoomState();
			const chatDocIds = roomData.chat_doc_ids || [];
			const allMessages = [];

			for (const chatDocId of chatDocIds) {
				const chatDocRef = this.roomRef.collection('chat_history').doc(chatDocId);
				const chatDocSnap = await chatDocRef.get();

				if (chatDocSnap.exists) {
					const chatHistory = chatDocSnap.data().chat_history || [];
					allMessages.push(...chatHistory);
				}
			}

			allMessages.sort((a, b) => new Date(b.time) - new Date(a.time));
			return allMessages.slice(0, limit);
		} catch (error) {
			logger.error('Failed to load recent chat history:', error);
			return [];
		}
	}
};
