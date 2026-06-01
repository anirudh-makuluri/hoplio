const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const dbHelper = require('../helpers/db-helper');

let state = {};

function resetState() {
	state = {
		auth_users: {
			'user-1': { uid: 'user-1', joined_rooms: ['group-1'] },
			'user-2': { uid: 'user-2', joined_rooms: ['group-1'] },
			'user-3': { uid: 'user-3', joined_rooms: [] }
		},
		rooms: {
			'group-1': {
				roomId: 'group-1',
				members: ['user-1', 'user-2'],
				is_group: true,
				name: 'Launch Team',
				created_by: 'user-1',
				admins: ['user-1'],
				photo_url: '',
				chat_history: {
					'chat-1': { id: 'chat-1' }
				}
			}
		}
	};
}

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function applyFieldValue(currentValue, operation) {
	if (!operation || typeof operation !== 'object' || !operation.__op) {
		return operation;
	}

	const currentArray = Array.isArray(currentValue) ? [...currentValue] : [];
	if (operation.__op === 'arrayUnion') {
		for (const value of operation.values) {
			if (!currentArray.includes(value)) {
				currentArray.push(value);
			}
		}
		return currentArray;
	}

	if (operation.__op === 'arrayRemove') {
		return currentArray.filter((value) => !operation.values.includes(value));
	}

	return operation;
}

function applyUpdates(record, updates) {
	for (const [key, value] of Object.entries(updates)) {
		record[key] = applyFieldValue(record[key], value);
	}
}

function makeSnapshot(record, ref) {
	return {
		exists: record !== undefined,
		data: () => clone(record),
		ref
	};
}

function createFakeDb() {
	function makeAuthUserRef(userId) {
		return {
			async get() {
				return makeSnapshot(state.auth_users[userId], this);
			},
			async update(updates) {
				if (!state.auth_users[userId]) {
					throw new Error(`auth_users/${userId} not found`);
				}
				applyUpdates(state.auth_users[userId], updates);
			}
		};
	}

	function makeRoomRef(roomId) {
		return {
			async get() {
				return makeSnapshot(state.rooms[roomId], this);
			},
			async set(data) {
				state.rooms[roomId] = clone(data);
			},
			async update(updates) {
				if (!state.rooms[roomId]) {
					throw new Error(`rooms/${roomId} not found`);
				}
				applyUpdates(state.rooms[roomId], updates);
			},
			async delete() {
				delete state.rooms[roomId];
			},
			collection(subcollectionName) {
				if (subcollectionName !== 'chat_history') {
					throw new Error(`Unsupported room subcollection: ${subcollectionName}`);
				}

				return {
					async get() {
						const docs = Object.entries(state.rooms[roomId]?.chat_history || {}).map(([docId, docData]) => ({
							id: docId,
							data: () => clone(docData),
							ref: {
								async delete() {
									delete state.rooms[roomId].chat_history[docId];
								}
							}
						}));

						return {
							forEach(callback) {
								docs.forEach(callback);
							}
						};
					}
				};
			}
		};
	}

	return {
		collection(collectionName) {
			return {
				doc(docId) {
					if (collectionName === 'rooms') {
						return makeRoomRef(docId);
					}
					if (collectionName === 'auth_users') {
						return makeAuthUserRef(docId);
					}
					throw new Error(`Unsupported collection: ${collectionName}`);
				}
			};
		},
		batch() {
			const operations = [];
			return {
				update(ref, updates) {
					operations.push(async () => ref.update(updates));
				},
				delete(ref) {
					operations.push(async () => ref.delete());
				},
				async commit() {
					for (const operation of operations) {
						await operation();
					}
				}
			};
		}
	};
}

function createFakeAdmin() {
	return {
		firestore: {
			FieldValue: {
				arrayUnion(...values) {
					return { __op: 'arrayUnion', values };
				},
				arrayRemove(...values) {
					return { __op: 'arrayRemove', values };
				}
			}
		}
	};
}

async function expectRejection(factory, expectedMessage) {
	try {
		await factory();
		assert.fail(`Expected rejection: ${expectedMessage}`);
	} catch (error) {
		assert.equal(String(error), expectedMessage);
	}
}

test.before(() => {
	config.firebase = {
		db: createFakeDb(),
		admin: createFakeAdmin()
	};
});

test.beforeEach(() => {
	resetState();
});

test('group add members rejects non-admin actors', async () => {
	await expectRejection(
		() => dbHelper.addGroupMembers('group-1', 'user-2', ['user-3']),
		'Only group admins can add members'
	);
});

test('group remove member rejects non-admins removing other members', async () => {
	await expectRejection(
		() => dbHelper.removeGroupMember('group-1', 'user-2', 'user-1'),
		'Only group admins can remove other members'
	);
});

test('group update rejects non-admin actors', async () => {
	await expectRejection(
		() => dbHelper.updateGroupInfo('group-1', 'user-2', { name: 'Renamed group' }),
		'Only group admins can update group info'
	);
});

test('group delete rejects non-creator actors', async () => {
	await expectRejection(
		() => dbHelper.deleteGroup('group-1', 'user-2'),
		'Only the group creator can delete the group'
	);
});

test('group add members allows admins and updates membership state', async () => {
	const response = await dbHelper.addGroupMembers('group-1', 'user-1', ['user-3']);

	assert.equal(response.success, 'Members added');
	assert.deepEqual(state.rooms['group-1'].members.sort(), ['user-1', 'user-2', 'user-3']);
	assert.deepEqual(state.auth_users['user-3'].joined_rooms, ['group-1']);
});
