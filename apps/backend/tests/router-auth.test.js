const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('../config');
const usersRouter = require('../routers/users-router');
const e2eeRouter = require('../routers/e2ee-router');
const scheduledMessagesRouter = require('../routers/scheduled-messages-router');
const searchRouter = require('../routers/search-router');

const VALID_PUBLIC_KEY = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=';

let state = {};
let server;
let baseUrl;

function resetState(overrides = {}) {
	state = {
		rooms: {},
		scheduled_messages: {},
		auth_users: {},
		...overrides
	};
}

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function makeDocumentSnapshot(record) {
	return {
		exists: record !== undefined,
		data: () => clone(record)
	};
}

function makeRoomDocRef(roomId) {
	return {
		async get() {
			return makeDocumentSnapshot(state.rooms[roomId]);
		},
		collection(subcollectionName) {
			return {
				doc(docId) {
					return {
						async get() {
							const room = state.rooms[roomId];
							const record = room?.[subcollectionName]?.[docId];
							return makeDocumentSnapshot(record);
						}
					};
				}
			};
		}
	};
}

function makeGenericDocRef(collectionName, docId) {
	return {
		async get() {
			return makeDocumentSnapshot(state[collectionName]?.[docId]);
		}
	};
}

function createFakeDb() {
	return {
		collection(collectionName) {
			return {
				doc(docId) {
					if (collectionName === 'rooms') {
						return makeRoomDocRef(docId);
					}

					return makeGenericDocRef(collectionName, docId);
				}
			};
		}
	};
}

function createFakeAdmin() {
	return {
		auth() {
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
		},
		firestore: {
			FieldValue: {
				serverTimestamp() {
					return new Date();
				}
			}
		}
	};
}

function createTestApp() {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use(usersRouter);
	app.use(e2eeRouter);
	app.use('/api/scheduled-messages', scheduledMessagesRouter);
	app.use('/api', searchRouter);
	return app;
}

async function request(path, { method = 'GET', cookie, body } = {}) {
	const headers = {};
	if (cookie) {
		headers.Cookie = `session=${cookie}`;
	}
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}

	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	let json = null;
	try {
		json = await response.json();
	} catch (error) {
		json = null;
	}

	return { status: response.status, json };
}

test.before(async () => {
	config.firebase = {
		admin: createFakeAdmin(),
		db: createFakeDb()
	};

	server = http.createServer(createTestApp());
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
	if (server) {
		server.close();
		await once(server, 'close');
	}
});

test.beforeEach(() => {
	resetState();
});

test('users routes require an authenticated session', async () => {
	const response = await request('/users/user-1/friend-request?receiveruid=user-2', {
		method: 'PUT'
	});

	assert.equal(response.status, 401);
	assert.deepEqual(response.json, { error: 'Session invalid, please login again' });
});

test('users routes reject actor mismatch even with a valid session', async () => {
	const response = await request('/users/user-2/friend-request?receiveruid=user-1', {
		method: 'PUT',
		cookie: 'session-user-1'
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'Forbidden' });
});

test('search route rejects authenticated users who are not room members', async () => {
	resetState({
		rooms: {
			'room-1': {
				members: ['user-2'],
				chat_doc_ids: []
			}
		}
	});

	const response = await request('/api/search?roomId=room-1&query=hello', {
		cookie: 'session-user-1'
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'Not a member of this room' });
});

test('scheduled message user route rejects cross-user access', async () => {
	const response = await request('/api/scheduled-messages/user/user-2', {
		cookie: 'session-user-1'
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'Unauthorized to access these scheduled messages' });
});

test('scheduled message room route rejects non-members', async () => {
	resetState({
		rooms: {
			'room-1': {
				members: ['user-2']
			}
		}
	});

	const response = await request('/api/scheduled-messages/room/room-1', {
		cookie: 'session-user-1'
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'User not authorized to access scheduled messages in this room' });
});

test('scheduled message update rejects non-owners', async () => {
	resetState({
		scheduled_messages: {
			'scheduled-1': {
				userUid: 'user-2',
				roomId: 'room-1'
			}
		}
	});

	const response = await request('/api/scheduled-messages/scheduled-1', {
		method: 'PUT',
		cookie: 'session-user-1',
		body: {
			message: 'updated'
		}
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'Unauthorized to update this scheduled message' });
});

test('e2ee setup-keys rejects mismatched authenticated user', async () => {
	const response = await request('/auth/setup-keys', {
		method: 'POST',
		cookie: 'session-user-1',
		body: {
			userId: 'user-2',
			deviceId: 'device-1',
			identityPublicKey: VALID_PUBLIC_KEY
		}
	});

	assert.equal(response.status, 403);
	assert.deepEqual(response.json, { error: 'Forbidden' });
});
