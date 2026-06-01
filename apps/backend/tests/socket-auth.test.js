const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');

const { attachSocketServer } = require('../socket-server');

function createState() {
	return {
		auth_users: {
			'user-1': {
				uid: 'user-1',
				name: 'User One',
				email: 'user1@example.com',
				photo_url: 'https://example.com/u1.png',
				friend_list: ['user-2'],
				is_online: false
			},
			'user-2': {
				uid: 'user-2',
				name: 'User Two',
				email: 'user2@example.com',
				photo_url: 'https://example.com/u2.png',
				friend_list: ['user-1'],
				is_online: false
			}
		},
		rooms: {
			'room-1': {
				roomId: 'room-1',
				members: ['user-1'],
				is_group: false,
				name: 'Room One',
				photo_url: ''
			},
			'room-2': {
				roomId: 'room-2',
				members: ['user-2'],
				is_group: false,
				name: 'Room Two',
				photo_url: ''
			}
		},
		scheduled_messages: {
			'scheduled-1': {
				id: 'scheduled-1',
				userUid: 'user-1',
				roomId: 'room-1',
				message: 'owned by user 1',
				status: 'pending'
			},
			'scheduled-2': {
				id: 'scheduled-2',
				userUid: 'user-2',
				roomId: 'room-2',
				message: 'owned by user 2',
				status: 'pending'
			}
		}
	};
}

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function makeSnapshot(record) {
	return {
		exists: record !== undefined,
		data: () => clone(record)
	};
}

function createFakeDb(state) {
	return {
		collection(collectionName) {
			return {
				doc(docId) {
					return {
						async get() {
							return makeSnapshot(state[collectionName]?.[docId]);
						},
						async update(updates) {
							if (!state[collectionName]?.[docId]) {
								throw new Error(`${collectionName}/${docId} not found`);
							}
							Object.assign(state[collectionName][docId], updates);
						}
					};
				}
			};
		}
	};
}

function createFakeAdmin() {
	return {
		firestore: {
			FieldValue: {
				serverTimestamp() {
					return new Date();
				}
			}
		}
	};
}

function createFakeAuthHelper() {
	return {
		async verifySessionCookie(sessionCookie) {
			if (sessionCookie === 'session-user-1') {
				return { uid: 'user-1', email: 'user1@example.com' };
			}
			if (sessionCookie === 'session-user-2') {
				return { uid: 'user-2', email: 'user2@example.com' };
			}
			throw new Error('Invalid session');
		}
	};
}

function createHarness() {
	const state = createState();
	const calls = {
		sendFriendRequest: [],
		updateUserData: [],
		createScheduledMessage: [],
		aiSmartReplies: [],
		zepSummaries: [],
		getScheduledMessages: [],
		updateScheduledMessage: [],
		deleteScheduledMessage: [],
		roomLoadChat: [],
		roomNewChatEvent: [],
		roomUpdateReaction: [],
		roomDeleteChatMessage: [],
		roomEditChatMessage: [],
		roomSaveChatMessage: []
	};
	const roomInstances = new Map();

	class FakeRoom {
		constructor(roomId) {
			this.roomId = roomId;
			this.isGroup = false;
			this.roomName = `Room ${roomId}`;
			this.members = state.rooms[roomId]?.members || [];
			roomInstances.set(roomId, this);
		}

		async loadChatFromDb(chatDocId) {
			calls.roomLoadChat.push({ roomId: this.roomId, chatDocId });
			return { success: true, chat_history: [] };
		}

		async newChatEvent(payload) {
			calls.roomNewChatEvent.push(payload);
			return { success: true };
		}

		async updateReaction(payload) {
			calls.roomUpdateReaction.push(payload);
			return { success: true, payload };
		}

		async deleteChatMessage(payload) {
			calls.roomDeleteChatMessage.push(payload);
			return { success: true, payload };
		}

		async editChatMessage(payload) {
			calls.roomEditChatMessage.push(payload);
			return { success: true, payload };
		}

		async saveChatMessage(payload) {
			calls.roomSaveChatMessage.push(payload);
			return { success: true, payload };
		}
	}

	const dbHelper = {
		async sendFriendRequest(senderUid, receiverUid) {
			calls.sendFriendRequest.push({ senderUid, receiverUid });
			return { success: true };
		},
		async getUserData(uid) {
			return clone(state.auth_users[uid]);
		},
		async respondFriendRequest() {
			return { success: true };
		},
		async updateUserData(uid, newData) {
			calls.updateUserData.push({ uid, newData });
			return { success: true };
		},
		async createScheduledMessage(payload) {
			calls.createScheduledMessage.push(payload);
			return { success: true, scheduledMessage: payload };
		},
		async getScheduledMessages(userUid, roomId) {
			calls.getScheduledMessages.push({ userUid, roomId });
			return { success: true, scheduledMessages: [], userUid, roomId };
		},
		async updateScheduledMessage(scheduledMessageId, updates) {
			calls.updateScheduledMessage.push({ scheduledMessageId, updates });
			return { success: true, scheduledMessageId, updates };
		},
		async deleteScheduledMessage(scheduledMessageId, userUid) {
			calls.deleteScheduledMessage.push({ scheduledMessageId, userUid });
			const scheduledMessage = state.scheduled_messages[scheduledMessageId];
			if (!scheduledMessage) {
				throw new Error('Scheduled message not found');
			}
			if (scheduledMessage.userUid !== userUid) {
				throw new Error('Unauthorized to delete this scheduled message');
			}
			return { success: true, scheduledMessageId };
		}
	};

	const httpServer = http.createServer();
	const io = new Server(httpServer, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST'],
			credentials: true
		}
	});

	attachSocketServer(io, {
		config: {
			firebase: {
				db: createFakeDb(state),
				admin: createFakeAdmin()
			}
		},
		db: createFakeDb(state),
		admin: createFakeAdmin(),
		authHelper: createFakeAuthHelper(),
		dbHelper,
		aiHelper: {
			async generateChatResponse() {
				return { success: false };
			},
			async analyzeSentiment() {
				return { success: true, sentiment: 'neutral' };
			},
			async generateSmartReplies(message) {
				calls.aiSmartReplies.push(message);
				return { success: true, replies: [] };
			}
		},
		zepHelper: {
			async createThread() {
				return { success: true };
			},
			async getSessionSummary(threadId) {
				calls.zepSummaries.push(threadId);
				return { success: true, summary: `Summary for ${threadId}` };
			}
		},
		Room: FakeRoom,
		logger: {
			info() {},
			warn() {},
			error() {},
			debug() {}
		}
	});

	return { state, calls, roomInstances, httpServer, io };
}

async function startHarness() {
	const harness = createHarness();
	harness.httpServer.listen(0, '127.0.0.1');
	await once(harness.httpServer, 'listening');
	const port = harness.httpServer.address().port;
	harness.baseUrl = `http://127.0.0.1:${port}`;
	return harness;
}

async function stopHarness(harness) {
	for (const socket of await harness.io.fetchSockets()) {
		socket.disconnect(true);
	}
	harness.io.close();
	harness.httpServer.close();
	await once(harness.httpServer, 'close');
}

function connectClient(harness, sessionCookie) {
	return createClient(harness.baseUrl, {
		transports: ['websocket'],
		extraHeaders: {
			Cookie: `session=${sessionCookie}`
		}
	});
}

function emitAck(socket, event, payload) {
	return new Promise((resolve) => {
		socket.emit(event, payload, (response) => resolve(response));
	});
}

async function flushSocketEvents() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

test('socket handshake rejects invalid session cookies', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'invalid-session');
		const [error] = await once(client, 'connect_error');
		assert.match(String(error.message), /valid sessionCookie/i);
		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('join_room rejects authenticated users who are not members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'join_room', 'room-2');
		assert.deepEqual(response, { error: 'User is not a member of this room' });

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('join_room rejects invalid room identifiers', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'join_room', '../room-1');
		assert.deepEqual(response, { error: 'Invalid roomId' });

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('load_chat_doc_from_db rejects authenticated users who are not members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'load_chat_doc_from_db', {
			roomId: 'room-2',
			curChatDocId: 'chat-doc-2'
		});

		assert.deepEqual(response, { error: 'User is not a member of this room' });
		assert.deepEqual(harness.calls.roomLoadChat, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('send_friend_request uses the authenticated socket user', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		await emitAck(client, 'send_friend_request_client_to_server', {
			senderUid: 'spoofed-user',
			receiverUid: 'user-2'
		});

		assert.deepEqual(harness.calls.sendFriendRequest, [
			{ senderUid: 'user-1', receiverUid: 'user-2' }
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('chat events use authenticated socket identity instead of client-supplied identity', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		client.emit('chat_event_client_to_server', {
			id: 'message-1',
			roomId: 'room-1',
			userUid: 'spoofed-user',
			userName: 'Spoofed Name',
			userPhoto: 'https://example.com/spoofed.png',
			type: 'text',
			chatInfo: 'hello there'
		});

		await flushSocketEvents();

		assert.deepEqual(harness.calls.roomNewChatEvent, [
			{
				id: 'message-1',
				roomId: 'room-1',
				userUid: 'user-1',
				userName: 'User One',
				userPhoto: 'https://example.com/u1.png',
				type: 'text',
				chatInfo: 'hello there',
				fileName: '',
				isMsgEdited: false,
				isMsgSaved: false,
				isEncrypted: false,
				encrypted: ''
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('update_user_data uses the authenticated socket user and filters unsupported fields', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		await emitAck(client, 'update_user_data', {
			uid: 'spoofed-user',
			newData: {
				name: 'Renamed User',
				is_online: true
			}
		});

		assert.deepEqual(harness.calls.updateUserData, [
			{
				uid: 'user-1',
				newData: {
					name: 'Renamed User'
				}
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('chat reactions use authenticated identity instead of client-supplied identity', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		await emitAck(client, 'chat_reaction_client_to_server', {
			reactionId: '1f44d',
			id: 'message-1',
			chatDocId: 'chat-doc-1',
			roomId: 'room-1',
			userUid: 'spoofed-user',
			userName: 'Spoofed Name'
		});

		assert.deepEqual(harness.calls.roomUpdateReaction, [
			{
				reactionId: '1f44d',
				id: 'message-1',
				chatDocId: 'chat-doc-1',
				userUid: 'user-1',
				userName: 'User One'
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('chat_delete passes the authenticated actor uid to room authorization', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'chat_delete_client_to_server', {
			id: 'message-1',
			chatDocId: 'chat-doc-1',
			roomId: 'room-1',
			actorUid: 'spoofed-user'
		});

		assert.deepEqual(response, {
			success: true,
			payload: {
				id: 'message-1',
				chatDocId: 'chat-doc-1',
				actorUid: 'user-1'
			}
		});
		assert.deepEqual(harness.calls.roomDeleteChatMessage, [
			{
				id: 'message-1',
				chatDocId: 'chat-doc-1',
				actorUid: 'user-1'
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('chat_edit passes the authenticated actor uid to room authorization', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'chat_edit_client_to_server', {
			id: 'message-1',
			chatDocId: 'chat-doc-1',
			roomId: 'room-1',
			newText: 'edited text',
			actorUid: 'spoofed-user'
		});

		assert.deepEqual(response, {
			success: true,
			payload: {
				id: 'message-1',
				chatDocId: 'chat-doc-1',
				newText: 'edited text',
				actorUid: 'user-1'
			}
		});
		assert.deepEqual(harness.calls.roomEditChatMessage, [
			{
				id: 'message-1',
				chatDocId: 'chat-doc-1',
				newText: 'edited text',
				actorUid: 'user-1'
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('chat_save rejects authenticated users who are not room members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'chat_save_client_to_server', {
			id: 'message-2',
			chatDocId: 'chat-doc-2',
			roomId: 'room-2'
		});

		assert.deepEqual(response, { error: 'User is not a member of this room' });
		assert.deepEqual(harness.calls.roomSaveChatMessage, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('ai_summarize_conversation rejects authenticated users who are not room members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'ai_summarize_conversation', {
			roomId: 'room-2'
		});

		assert.deepEqual(response, { error: 'Failed to generate summary' });
		assert.deepEqual(harness.calls.zepSummaries, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('ai_summarize_conversation allows members and uses the authorized room thread', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'ai_summarize_conversation', {
			roomId: 'room-1'
		});

		assert.equal(response.success, true);
		assert.match(response.summary, /Summary for room-user-1/);
		assert.deepEqual(harness.calls.zepSummaries, ['room-user-1']);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('ai_smart_replies rejects room-scoped requests from non-members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'ai_smart_replies', {
			message: 'Need a reply',
			roomId: 'room-2'
		});

		assert.deepEqual(response, { error: 'Failed to generate smart replies' });
		assert.deepEqual(harness.calls.aiSmartReplies, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('ai_smart_replies allows members and validates the requested room', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'ai_smart_replies', {
			message: 'Need a reply',
			roomId: 'room-1'
		});

		assert.deepEqual(response, { success: true, replies: [] });
		assert.deepEqual(harness.calls.aiSmartReplies, ['Need a reply']);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('schedule_message uses authenticated identity and rejects spoofed ownership', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		await emitAck(client, 'schedule_message', {
			scheduledMessage: {
				userUid: 'spoofed-user',
				roomId: 'room-1',
				message: 'hello later',
				scheduledTime: '2026-06-01T12:00:00.000Z'
			}
		});

		assert.deepEqual(harness.calls.createScheduledMessage, [
			{
				userUid: 'user-1',
				roomId: 'room-1',
				message: 'hello later',
				scheduledTime: '2026-06-01T12:00:00.000Z',
				userName: 'User One',
				userPhoto: 'https://example.com/u1.png'
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('get_scheduled_messages rejects room-scoped access for non-members', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'get_scheduled_messages', {
			roomId: 'room-2'
		});

		assert.deepEqual(response, { error: 'User is not a member of this room' });
		assert.deepEqual(harness.calls.getScheduledMessages, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('update_scheduled_message rejects users who do not own the scheduled message', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'update_scheduled_message', {
			scheduledMessageId: 'scheduled-2',
			updates: {
				message: 'sneaky update'
			}
		});

		assert.deepEqual(response, {
			error: 'Unauthorized to update this scheduled message'
		});
		assert.deepEqual(harness.calls.updateScheduledMessage, []);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('update_scheduled_message allows owners and forwards the requested updates', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'update_scheduled_message', {
			scheduledMessageId: 'scheduled-1',
			updates: {
				message: 'updated safely'
			}
		});

		assert.deepEqual(response, {
			success: true,
			scheduledMessageId: 'scheduled-1',
			updates: {
				message: 'updated safely'
			}
		});
		assert.deepEqual(harness.calls.updateScheduledMessage, [
			{
				scheduledMessageId: 'scheduled-1',
				updates: {
					message: 'updated safely'
				}
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});

test('delete_scheduled_message uses the authenticated socket user for ownership checks', async () => {
	const harness = await startHarness();
	try {
		const client = connectClient(harness, 'session-user-1');
		await once(client, 'connect');

		const response = await emitAck(client, 'delete_scheduled_message', {
			scheduledMessageId: 'scheduled-1',
			userUid: 'spoofed-user'
		});

		assert.deepEqual(response, {
			success: true,
			scheduledMessageId: 'scheduled-1'
		});
		assert.deepEqual(harness.calls.deleteScheduledMessage, [
			{
				scheduledMessageId: 'scheduled-1',
				userUid: 'user-1'
			}
		]);

		client.close();
	} finally {
		await stopHarness(harness);
	}
});
