const uuid = require('uuid');

function attachSocketServer(io, dependencies = {}) {
	const config = dependencies.config || require('./config');
	const logger = dependencies.logger || require('./logger');
	const utils = dependencies.utils || require('./utils');
	const authHelper = dependencies.authHelper || require('./helpers/auth-helper');
	const dbHelper = dependencies.dbHelper || require('./helpers/db-helper');
	const aiHelper = dependencies.aiHelper || require('./helpers/ai-helper');
	const zepHelper = dependencies.zepHelper || require('./helpers/zep-helper');
	const RoomClass = dependencies.Room || require('./Room');
	const db = dependencies.db || config.firebase.db;
	const admin = dependencies.admin || config.firebase.admin;
	const sessionStore = dependencies.sessionStore || new Map();
	const roomList = dependencies.roomList || new Map();

	function getRoomThreadId(roomId, roomData, userUid) {
		const members = roomData?.members || [];
		const humanMembers = members.filter((uid) => uid !== 'ai-assistant');
		if (humanMembers.length >= 2) {
			return `room-${roomId}`;
		}
		return `room-${userUid}`;
	}

	function validateEntityId(value, label, options = {}) {
		if (!utils.isValidEntityId(value, options)) {
			throw new Error(`Invalid ${label}`);
		}

		return value.trim();
	}

	function validateMessageText(value, label = 'message') {
		if (typeof value !== 'string') {
			throw new Error(`${label} is required`);
		}

		const normalized = value.replace(/\u0000/g, '').trim();
		if (normalized.length === 0) {
			throw new Error(`${label} is required`);
		}
		if (normalized.length > 5000) {
			throw new Error(`${label} exceeds maximum length`);
		}

		return normalized;
	}

	async function getRoomDetails(roomId) {
		validateEntityId(roomId, 'roomId');
		const roomRef = db.collection('rooms').doc(roomId);
		const roomSnap = await roomRef.get();
		if (!roomSnap.exists) {
			throw new Error('Room not found');
		}

		return {
			roomRef,
			roomData: roomSnap.data()
		};
	}

	function ensureRoomMember(roomData, uid) {
		if (!roomData?.members?.includes(uid)) {
			throw new Error('User is not a member of this room');
		}
	}

	async function getOrCreateRoomInstance(roomId, roomRef, roomData) {
		if (!roomList.has(roomId)) {
			roomList.set(
				roomId,
				new RoomClass(
					roomId,
					io,
					roomRef,
					roomData.is_group,
					roomData.members,
					roomData.name || '',
					roomData.photo_url || ''
				)
			);
		}

		return roomList.get(roomId);
	}

	function sanitizeSocketUserUpdates(newData) {
		if (!newData || typeof newData !== 'object') {
			throw new Error('No update payload provided');
		}

		const sanitized = {};
		if (newData.name !== undefined) {
			sanitized.name = utils.sanitizeInput(String(newData.name));
		}
		if (newData.photo_url !== undefined) {
			const photoUrl = String(newData.photo_url).trim();
			if (photoUrl.length === 0 || photoUrl.length > 2048) {
				throw new Error('Invalid photo_url provided');
			}
			sanitized.photo_url = photoUrl;
		}

		if (Object.keys(sanitized).length === 0) {
			throw new Error('No supported fields provided for update');
		}

		return sanitized;
	}

	function safeSocketCallback(callback, payload) {
		if (typeof callback === 'function') {
			callback(payload);
		}
	}

	function parseCookieString(cookieString) {
		const cookies = {};
		if (cookieString) {
			cookieString.split(';').forEach((token) => {
				const [key, value] = token.split('=');
				if (key && value) {
					cookies[key.trim()] = value.trim();
				}
			});
		}

		return cookies;
	}

	io.use(async (socket, next) => {
		const sessionCookie = parseCookieString(socket.handshake.headers.cookie).session || '';

		const decodedClaims = await authHelper.verifySessionCookie(sessionCookie, false)
			.then((claims) => claims)
			.catch((err) => {
				logger.error('Session cookie verification error:', err);
				return null;
			});

		logger.debug('Socket handshake auth received');
		logger.debug('-----------------------------------------------');

		if (decodedClaims) {
			socket.uid = decodedClaims.uid;
			socket.email = decodedClaims.email;
		} else {
			logger.warn('Could not get valid sessionCookie, cannot create websocket');
			return next(new Error('Could not get valid sessionCookie, cannot create websocket'));
		}

		try {
			const userRef = db.collection('auth_users').doc(socket.uid);
			const userSnap = await userRef.get();
			if (!userSnap.exists) {
				return next(new Error('Authenticated user record not found'));
			}

			const userData = userSnap.data() || {};
			socket.session = {
				currentSocketId: socket.id,
				name: userData.name || decodedClaims.name || socket.email,
				photo_url: userData.photo_url || '',
				uid: socket.uid,
				roomIds: [],
				friendUids: userData.friend_list || []
			};
			sessionStore.set(socket.uid, socket.session);
			logger.info(`Adding ${socket.uid} to sessionStore`);
			logger.debug(`SessionStore size: ${sessionStore.size}`);

			await userRef.update({ is_online: true });

			for (const friendUid of socket.session.friendUids) {
				const friendSession = sessionStore.get(friendUid);
				if (friendSession) {
					io.to(friendSession.currentSocketId).emit('presence_update', {
						uid: socket.uid,
						is_online: true,
						last_seen: null
					});
				}
			}
		} catch (error) {
			logger.error('Failed to set user online:', error);
		}
		return next();
	});

	io.on('connection', (socket) => {
		socket.on('join_room', async (roomId, callback) => {
			try {
				const normalizedRoomId = validateEntityId(roomId, 'roomId');
				const { roomRef, roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);
				await getOrCreateRoomInstance(normalizedRoomId, roomRef, roomData);

				socket.join(normalizedRoomId);
				if (!socket.session.roomIds.includes(normalizedRoomId)) {
					socket.session.roomIds.push(normalizedRoomId);
				}

				const zepThreadId = getRoomThreadId(normalizedRoomId, roomData, socket.uid);
				await zepHelper.createThread(socket.uid, zepThreadId, {
					roomId: normalizedRoomId,
					roomName: roomData.name || '',
					isGroup: roomData.is_group
				});
			} catch (error) {
				logger.error('Join room error:', error);
				return safeSocketCallback(callback, { error: error.message || 'Failed to join room' });
			}

			return safeSocketCallback(callback, { success: true, roomId: roomId.trim?.() || roomId });
		});

		socket.on('load_chat_doc_from_db', async (data, callback) => {
			try {
				const roomId = validateEntityId(data?.roomId, 'roomId');
				const curChatDocId = data?.curChatDocId == null
					? undefined
					: validateEntityId(data.curChatDocId, 'chatDocId');
				const { roomRef, roomData } = await getRoomDetails(roomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(roomId, roomRef, roomData);
				const response = await room.loadChatFromDb(curChatDocId);
				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || 'Room not found' });
			}
		});

		socket.on('chat_event_client_to_server', async (data) => {
			try {
				if (!data?.roomId || !data?.type) {
					throw new Error('roomId and type are required');
				}

				const roomId = validateEntityId(data.roomId, 'roomId');
				const messageId = data.id ? validateEntityId(data.id, 'messageId') : undefined;
				const { roomRef, roomData } = await getRoomDetails(roomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(roomId, roomRef, roomData);
				const type = String(data.type).trim();
				if (!type) {
					throw new Error('type is required');
				}
				const chatInfo = type === 'text' && data.isEncrypted !== true
					? validateMessageText(data.chatInfo, 'chatInfo')
					: data.chatInfo;

				const serverMessage = {
					id: messageId,
					roomId,
					userUid: socket.uid,
					userName: socket.session.name,
					userPhoto: socket.session.photo_url,
					type,
					chatInfo,
					fileName: data.fileName || '',
					isMsgEdited: data.isMsgEdited ?? false,
					isMsgSaved: data.isMsgSaved ?? false,
					isEncrypted: data.isEncrypted === true,
					encrypted: data.encrypted || ''
				};

				await room.newChatEvent(serverMessage);

				if (roomId.startsWith('ai-assistant-') && socket.uid !== 'ai-assistant') {
					try {
						const roomContext = {
							isGroup: room.isGroup,
							roomName: room.roomName,
							memberCount: room.members.length,
							roomId
						};

						const zepThreadId = getRoomThreadId(roomId, roomData, socket.uid);

						const aiResponse = await aiHelper.generateChatResponse(
							chatInfo,
							roomContext,
							socket.uid,
							zepThreadId
						);

						if (aiResponse.success) {
							const aiMessage = {
								id: uuid.v4(),
								roomId,
								userUid: 'ai-assistant',
								userName: 'Chatify AI',
								userPhoto: 'https://ui-avatars.com/api/?name=AI&background=6366f1&color=ffffff',
								type: 'text',
								chatInfo: aiResponse.response,
								time: aiResponse.timestamp,
								isAIMessage: true
							};

							await room.newChatEvent(aiMessage);
						}
					} catch (error) {
						logger.error('Auto AI Response Error:', error);
					}
				}
			} catch (error) {
				logger.error('Chat event error:', error);
			}
		});

		socket.on('disconnect', async () => {
			logger.info('A client disconnected:', socket.uid);
			sessionStore.delete(socket.uid);
			logger.debug(`Deleting ${socket.uid} from sessionStore`);

			try {
				const userRef = db.collection('auth_users').doc(socket.uid);
				const lastSeen = admin.firestore.FieldValue.serverTimestamp();
				await userRef.update({ is_online: false, last_seen: lastSeen });

				const friendUids = socket.session.friendUids || [];
				for (const friendUid of friendUids) {
					const friendSession = sessionStore.get(friendUid);
					if (friendSession) {
						io.to(friendSession.currentSocketId).emit('presence_update', {
							uid: socket.uid,
							is_online: false,
							last_seen: Date.now()
						});
					}
				}
			} catch (error) {
				logger.error('Failed to set user offline:', error);
			}

			const roomIds = socket.session.roomIds || [];
			roomIds.forEach((roomId) => {
				const usersInRoom = io.sockets.adapter.rooms.get(roomId);
				const numUsersInRoom = usersInRoom ? usersInRoom.size : 0;
				if (numUsersInRoom === 0) {
					roomList.delete(roomId);
					logger.debug(`Deleted ${roomId} from roomList`);
				}
			});
		});

		socket.on('send_friend_request_client_to_server', async ({ receiverUid }, callback) => {
			try {
				const normalizedReceiverUid = validateEntityId(receiverUid, 'receiverUid');

				const senderUid = socket.uid;
				const receiver = sessionStore.get(normalizedReceiverUid);
				const response = await dbHelper.sendFriendRequest(senderUid, normalizedReceiverUid);
				if (receiver) {
					const senderData = await dbHelper.getUserData(senderUid);
					io.to(receiver.currentSocketId).emit('send_friend_request_server_to_client', senderData);
				}

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('respond_friend_request_client_to_server', async ({ requestUid, isAccepted }, callback) => {
			try {
				const normalizedRequestUid = validateEntityId(requestUid, 'requestUid');

				const response = await dbHelper.respondFriendRequest(socket.uid, normalizedRequestUid, isAccepted);

				const requestedUser = sessionStore.get(normalizedRequestUid);
				if (requestedUser && isAccepted) {
					const respondedUserData = await dbHelper.getUserData(socket.uid);
					io.to(requestedUser.currentSocketId).emit('respond_friend_request_server_to_client', respondedUserData);
				}

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('update_user_data', async ({ newData }, callback) => {
			try {
				const sanitizedData = sanitizeSocketUserUpdates(newData);
				const response = await dbHelper.updateUserData(socket.uid, sanitizedData);

				if (sanitizedData.name != null && sessionStore.has(socket.uid)) {
					sessionStore.get(socket.uid).name = sanitizedData.name;
				}
				if (sanitizedData.photo_url != null && sessionStore.has(socket.uid)) {
					sessionStore.get(socket.uid).photo_url = sanitizedData.photo_url;
				}

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('chat_reaction_client_to_server', async ({ reactionId, id, chatDocId, roomId }, callback) => {
			try {
				if (!reactionId || !id || !chatDocId || !roomId) {
					throw new Error('One or more information is missing');
				}
				const normalizedRoomId = validateEntityId(roomId, 'roomId');
				const normalizedMessageId = validateEntityId(id, 'messageId');
				const normalizedChatDocId = validateEntityId(chatDocId, 'chatDocId');
				const normalizedReactionId = validateEntityId(reactionId, 'reactionId');
				const { roomRef, roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(normalizedRoomId, roomRef, roomData);
				const response = await room.updateReaction({
					reactionId: normalizedReactionId,
					id: normalizedMessageId,
					chatDocId: normalizedChatDocId,
					userUid: socket.uid,
					userName: socket.session.name
				});

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('chat_delete_client_to_server', async ({ id, chatDocId, roomId }, callback) => {
			try {
				if (!id || !chatDocId || !roomId) {
					throw new Error('One or more information is missing');
				}

				const normalizedRoomId = validateEntityId(roomId, 'roomId');
				const normalizedMessageId = validateEntityId(id, 'messageId');
				const normalizedChatDocId = validateEntityId(chatDocId, 'chatDocId');
				const { roomRef, roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(normalizedRoomId, roomRef, roomData);
				const response = await room.deleteChatMessage({
					id: normalizedMessageId,
					chatDocId: normalizedChatDocId,
					actorUid: socket.uid
				});

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('chat_edit_client_to_server', async ({ id, chatDocId, roomId, newText }, callback) => {
			try {
				if (!id || !chatDocId || !roomId || !newText) {
					throw new Error('One or more information is missing');
				}

				const normalizedRoomId = validateEntityId(roomId, 'roomId');
				const normalizedMessageId = validateEntityId(id, 'messageId');
				const normalizedChatDocId = validateEntityId(chatDocId, 'chatDocId');
				const normalizedNewText = validateMessageText(newText, 'newText');
				const { roomRef, roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(normalizedRoomId, roomRef, roomData);
				const response = await room.editChatMessage({
					id: normalizedMessageId,
					chatDocId: normalizedChatDocId,
					newText: normalizedNewText,
					actorUid: socket.uid
				});

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('chat_save_client_to_server', async ({ id, chatDocId, roomId }, callback) => {
			try {
				if (!id || !chatDocId || !roomId) {
					throw new Error('One or more information is missing');
				}

				const normalizedRoomId = validateEntityId(roomId, 'roomId');
				const normalizedMessageId = validateEntityId(id, 'messageId');
				const normalizedChatDocId = validateEntityId(chatDocId, 'chatDocId');
				const { roomRef, roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);
				const room = await getOrCreateRoomInstance(normalizedRoomId, roomRef, roomData);
				const response = await room.saveChatMessage({
					id: normalizedMessageId,
					chatDocId: normalizedChatDocId
				});

				safeSocketCallback(callback, response);
			} catch (error) {
				safeSocketCallback(callback, { error: error.message || error });
			}
		});

		socket.on('ai_summarize_conversation', async ({ roomId }, callback) => {
			try {
				const normalizedRoomId = validateEntityId(roomId, 'roomId');

				const { roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);

				const zepThreadId = getRoomThreadId(normalizedRoomId, roomData, socket.uid);
				const summaryResult = await zepHelper.getSessionSummary(zepThreadId);

				if (summaryResult.success && summaryResult.summary) {
					callback({
						success: true,
						summary: summaryResult.summary,
						timestamp: new Date()
					});
				} else {
					callback({
						success: false,
						error: 'No conversation to summarize yet'
					});
				}
			} catch (error) {
				logger.error('AI Summarize Error:', error);
				callback({ error: 'Failed to generate summary' });
			}
		});

		socket.on('ai_analyze_sentiment', async ({ message }, callback) => {
			try {
				if (!message) throw new Error('Message is required');
				const sentiment = await aiHelper.analyzeSentiment(message);
				callback(sentiment);
			} catch (error) {
				logger.error('AI Sentiment Error:', error);
				callback({ error: 'Failed to analyze sentiment' });
			}
		});

		socket.on('ai_smart_replies', async ({ message, roomId }, callback) => {
			try {
				const normalizedMessage = validateMessageText(message, 'message');
				if (roomId) {
					const normalizedRoomId = validateEntityId(roomId, 'roomId');
					const { roomData } = await getRoomDetails(normalizedRoomId);
					ensureRoomMember(roomData, socket.uid);
				}

				const smartReplies = await aiHelper.generateSmartReplies(normalizedMessage, []);
				callback(smartReplies);
			} catch (error) {
				logger.error('AI Smart Replies Error:', error);
				callback({ error: 'Failed to generate smart replies' });
			}
		});

		socket.on('schedule_message', async ({ scheduledMessage }, callback) => {
			try {
				if (!scheduledMessage?.roomId || !scheduledMessage?.message || !scheduledMessage?.scheduledTime) {
					throw new Error('Required fields: roomId, message, scheduledTime');
				}

				const normalizedRoomId = validateEntityId(scheduledMessage.roomId, 'roomId');
				const normalizedMessage = validateMessageText(scheduledMessage.message, 'message');
				const { roomData } = await getRoomDetails(normalizedRoomId);
				ensureRoomMember(roomData, socket.uid);

				const response = await dbHelper.createScheduledMessage({
					...scheduledMessage,
					roomId: normalizedRoomId,
					message: normalizedMessage,
					userUid: socket.uid,
					userName: socket.session.name,
					userPhoto: socket.session.photo_url
				});

				safeSocketCallback(callback, response);
			} catch (error) {
				logger.error('Schedule Message Error:', error);
				safeSocketCallback(callback, { error: error.message || 'Failed to schedule message' });
			}
		});

		socket.on('get_scheduled_messages', async ({ roomId }, callback) => {
			try {
				if (roomId) {
					const normalizedRoomId = validateEntityId(roomId, 'roomId');
					const { roomData } = await getRoomDetails(normalizedRoomId);
					ensureRoomMember(roomData, socket.uid);
					roomId = normalizedRoomId;
				}

				const response = await dbHelper.getScheduledMessages(socket.uid, roomId);
				safeSocketCallback(callback, response);
			} catch (error) {
				logger.error('Get Scheduled Messages Error:', error);
				safeSocketCallback(callback, { error: error.message || 'Failed to get scheduled messages' });
			}
		});

		socket.on('update_scheduled_message', async ({ scheduledMessageId, updates }, callback) => {
			try {
				const normalizedScheduledMessageId = validateEntityId(scheduledMessageId, 'scheduledMessageId');

				const scheduledMessageRef = db.collection('scheduled_messages').doc(normalizedScheduledMessageId);
				const scheduledMessageSnap = await scheduledMessageRef.get();
				if (!scheduledMessageSnap.exists) throw new Error('Scheduled message not found');

				const scheduledMessageData = scheduledMessageSnap.data();
				if (scheduledMessageData.userUid !== socket.uid) {
					throw new Error('Unauthorized to update this scheduled message');
				}

				const roomDetails = await getRoomDetails(scheduledMessageData.roomId);
				ensureRoomMember(roomDetails.roomData, socket.uid);
				const normalizedUpdates = { ...updates };
				if (normalizedUpdates.message !== undefined) {
					normalizedUpdates.message = validateMessageText(normalizedUpdates.message, 'message');
				}
				const response = await dbHelper.updateScheduledMessage(normalizedScheduledMessageId, normalizedUpdates);
				safeSocketCallback(callback, response);
			} catch (error) {
				logger.error('Update Scheduled Message Error:', error);
				safeSocketCallback(callback, { error: error.message || 'Failed to update scheduled message' });
			}
		});

		socket.on('delete_scheduled_message', async ({ scheduledMessageId }, callback) => {
			try {
				const normalizedScheduledMessageId = validateEntityId(scheduledMessageId, 'scheduledMessageId');

				const response = await dbHelper.deleteScheduledMessage(normalizedScheduledMessageId, socket.uid);
				safeSocketCallback(callback, response);
			} catch (error) {
				logger.error('Delete Scheduled Message Error:', error);
				safeSocketCallback(callback, { error: error.message || 'Failed to delete scheduled message' });
			}
		});
	});

	return {
		sessionStore,
		roomList
	};
}

module.exports = {
	attachSocketServer
};
