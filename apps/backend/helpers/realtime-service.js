const { randomUUID } = require('node:crypto');
const { Redis } = require('@upstash/redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const DEFAULT_SOCKET_SESSION_TTL_SECONDS = 60 * 60 * 6;

function uniqStrings(values) {
	if (!Array.isArray(values)) {
		return [];
	}

	return [...new Set(
		values
			.filter((value) => typeof value === 'string')
			.map((value) => value.trim())
			.filter(Boolean)
	)];
}

function parseStoredSession(value) {
	if (!value) {
		return null;
	}

	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}

	return value;
}

function normalizeSession(session) {
	if (!session || typeof session !== 'object' || !session.currentSocketId || !session.uid) {
		throw new Error('Invalid realtime session payload');
	}

	return {
		currentSocketId: String(session.currentSocketId),
		name: typeof session.name === 'string' ? session.name : '',
		photo_url: typeof session.photo_url === 'string' ? session.photo_url : '',
		uid: String(session.uid),
		roomIds: uniqStrings(session.roomIds),
		friendUids: uniqStrings(session.friendUids)
	};
}

function createRealtimeService(io, options = {}) {
	const logger = options.logger || require('../logger');
	const redisConfig = options.redisConfig || {};
	const instanceId = options.instanceId || randomUUID();
	const sessionTtlSeconds = Number(redisConfig.sessionTtlSeconds) || DEFAULT_SOCKET_SESSION_TTL_SECONDS;
	const redisClient = options.redisClient || (
		redisConfig.restUrl && redisConfig.restToken
			? new Redis({
				url: redisConfig.restUrl,
				token: redisConfig.restToken
			})
			: null
	);
	const adapterFactory = options.adapterFactory || createAdapter;
	const redisTcpClientFactory = options.redisTcpClientFactory || createClient;

	const prefix = redisConfig.prefix || 'hoplio:realtime';
	const roomEventChannel = `${prefix}:room-events`;
	const sessionKeyPrefix = `${prefix}:session`;
	const userSocketsKeyPrefix = `${prefix}:user-sockets`;
	const instanceSocketsKeyPrefix = `${prefix}:instance-sockets`;
	const userRoomPrefix = `${prefix}:user-room:`;
	const useSocketIoRedisAdapter = Boolean(redisConfig.enableSocketIoRedisAdapter && redisConfig.url);

	const localSessions = new Map();
	const localUserSocketIds = new Map();

	let subscription = null;
	let pubClient = null;
	let subClient = null;
	let ready = !redisClient;
	let adapterMode = redisClient ? 'upstash-room-bridge' : 'memory-only';

	function sessionKey(socketId) {
		return `${sessionKeyPrefix}:${socketId}`;
	}

	function userSocketsKey(uid) {
		return `${userSocketsKeyPrefix}:${uid}`;
	}

	function instanceSocketsKey() {
		return `${instanceSocketsKeyPrefix}:${instanceId}`;
	}

	function getUserRoomName(uid) {
		return `${userRoomPrefix}${uid}`;
	}

	function addLocalSession(session) {
		localSessions.set(session.currentSocketId, session);
		if (!localUserSocketIds.has(session.uid)) {
			localUserSocketIds.set(session.uid, new Set());
		}
		localUserSocketIds.get(session.uid).add(session.currentSocketId);
	}

	function removeLocalSession(socketId) {
		const session = localSessions.get(socketId) || null;
		if (!session) {
			return null;
		}

		localSessions.delete(socketId);
		const socketIds = localUserSocketIds.get(session.uid);
		if (socketIds) {
			socketIds.delete(socketId);
			if (socketIds.size === 0) {
				localUserSocketIds.delete(session.uid);
			}
		}

		return session;
	}

	function emitLocalRoomEvent(roomId, eventName, payload) {
		io.to(roomId).emit(eventName, payload);
	}

	function applyLocalUserSessionPatch(uid, patch) {
		const socketIds = localUserSocketIds.get(uid);
		if (!socketIds) {
			return;
		}

		for (const socketId of socketIds) {
			const session = localSessions.get(socketId);
			if (!session) {
				continue;
			}

			const nextSession = normalizeSession({
				...session,
				...patch,
				currentSocketId: session.currentSocketId,
				uid: session.uid,
				roomIds: patch.roomIds !== undefined ? patch.roomIds : session.roomIds,
				friendUids: patch.friendUids !== undefined ? patch.friendUids : session.friendUids
			});
			localSessions.set(socketId, nextSession);
		}
	}

	async function publishRoomEvent(roomId, eventName, payload) {
		if (!redisClient) {
			return;
		}

		await redisClient.publish(roomEventChannel, JSON.stringify({
			kind: 'room_event',
			originInstanceId: instanceId,
			roomId,
			eventName,
			payload
		}));
	}

	async function publishSessionPatch(uid, patch) {
		if (!redisClient) {
			return;
		}

		await redisClient.publish(roomEventChannel, JSON.stringify({
			kind: 'session_patch',
			originInstanceId: instanceId,
			uid,
			patch
		}));
	}

	async function handleSubscriptionEvent(event) {
		try {
			const channel = event?.channel;
			if (channel !== roomEventChannel) {
				return;
			}

			const data = typeof event.message === 'string'
				? JSON.parse(event.message)
				: event.message;

			if (!data || data.originInstanceId === instanceId) {
				return;
			}

			if (data.kind === 'room_event') {
				emitLocalRoomEvent(data.roomId, data.eventName, data.payload);
				return;
			}

			if (data.kind === 'session_patch') {
				applyLocalUserSessionPatch(data.uid, data.patch || {});
			}
		} catch (error) {
			logger.error('Failed to handle realtime subscription event:', error);
		}
	}

	async function attachSocketIoAdapter() {
		pubClient = redisTcpClientFactory({ url: redisConfig.url });
		subClient = pubClient.duplicate();

		await Promise.all([
			pubClient.connect(),
			subClient.connect()
		]);

		io.adapter(adapterFactory(pubClient, subClient, {
			key: `${prefix}:socket.io`
		}));

		adapterMode = 'socket.io-redis-adapter';
		logger.info('Socket.IO Redis adapter enabled');
	}

	async function storeSession(session) {
		if (!redisClient) {
			return session;
		}

		await Promise.all([
			redisClient.set(sessionKey(session.currentSocketId), JSON.stringify(session), { ex: sessionTtlSeconds }),
			redisClient.sadd(userSocketsKey(session.uid), session.currentSocketId),
			redisClient.expire(userSocketsKey(session.uid), sessionTtlSeconds),
			redisClient.sadd(instanceSocketsKey(), session.currentSocketId),
			redisClient.expire(instanceSocketsKey(), sessionTtlSeconds)
		]);

		return session;
	}

	async function getSocketSession(socketId) {
		const local = localSessions.get(socketId);
		if (local) {
			return local;
		}

		if (!redisClient) {
			return null;
		}

		return parseStoredSession(await redisClient.get(sessionKey(socketId)));
	}

	async function getUserSessions(uid) {
		if (!redisClient) {
			const local = [];
			const socketIds = localUserSocketIds.get(uid) || new Set();
			for (const socketId of socketIds) {
				const session = localSessions.get(socketId);
				if (session) {
					local.push(session);
				}
			}
			return local;
		}

		const socketIds = uniqStrings(await redisClient.smembers(userSocketsKey(uid)));
		if (socketIds.length === 0) {
			return [];
		}

		const sessions = await Promise.all(socketIds.map(async (socketId) => {
			const session = parseStoredSession(await redisClient.get(sessionKey(socketId)));
			if (!session) {
				await redisClient.srem(userSocketsKey(uid), socketId);
				return null;
			}
			return normalizeSession(session);
		}));

		return sessions.filter(Boolean);
	}

	return {
		instanceId,
		getUserRoomName,
		async start() {
			if (!redisClient) {
				logger.warn('Realtime Redis credentials are not configured; running in local-only mode');
				ready = false;
				return;
			}

			subscription = redisClient.subscribe(roomEventChannel);
			subscription.on(`message:${roomEventChannel}`, (event) => {
				void handleSubscriptionEvent(event);
			});

			if (useSocketIoRedisAdapter) {
				try {
					await attachSocketIoAdapter();
				} catch (error) {
					adapterMode = 'upstash-room-bridge';
					logger.error('Failed to enable Socket.IO Redis adapter, falling back to Upstash room bridge:', error);
				}
			}

			ready = true;
		},
		async stop() {
			if (subscription) {
				await subscription.unsubscribe();
				subscription = null;
			}

			await Promise.allSettled([
				pubClient?.quit?.(),
				subClient?.quit?.()
			]);
		},
		isReady() {
			return ready;
		},
		getStatus() {
			return {
				configured: Boolean(redisClient),
				ready,
				instanceId,
				adapterMode,
				socketIoAdapterConfigured: useSocketIoRedisAdapter
			};
		},
		async registerSocketSession(session) {
			const normalized = normalizeSession(session);
			addLocalSession(normalized);
			await storeSession(normalized);
			return normalized;
		},
		async updateSocketRooms(socketId, roomIds) {
			const session = await getSocketSession(socketId);
			if (!session) {
				return null;
			}

			const updated = normalizeSession({
				...session,
				roomIds
			});
			addLocalSession(updated);
			await storeSession(updated);
			return updated;
		},
		async updateUserSessions(uid, patch) {
			const sessions = await getUserSessions(uid);
			if (sessions.length === 0) {
				applyLocalUserSessionPatch(uid, patch);
				return;
			}

			const updatedSessions = sessions.map((session) => normalizeSession({
				...session,
				...patch,
				currentSocketId: session.currentSocketId,
				uid: session.uid,
				roomIds: patch.roomIds !== undefined ? patch.roomIds : session.roomIds,
				friendUids: patch.friendUids !== undefined ? patch.friendUids : session.friendUids
			}));

			applyLocalUserSessionPatch(uid, patch);
			await Promise.all(updatedSessions.map((session) => storeSession(session)));
			await publishSessionPatch(uid, patch);
		},
		async getSocketSession(socketId) {
			return getSocketSession(socketId);
		},
		async getUserSessions(uid) {
			return getUserSessions(uid);
		},
		async restoreRoomIds(uid, fallbackRoomIds = []) {
			const sessions = await getUserSessions(uid);
			return uniqStrings([
				...fallbackRoomIds,
				...sessions.flatMap((session) => session.roomIds || [])
			]);
		},
		async unregisterSocketSession(socketId) {
			const session = (await getSocketSession(socketId)) || removeLocalSession(socketId);
			if (!session) {
				return {
					session: null,
					remainingUserSessionCount: 0
				};
			}

			removeLocalSession(socketId);

			if (redisClient) {
				await Promise.all([
					redisClient.del(sessionKey(socketId)),
					redisClient.srem(userSocketsKey(session.uid), socketId),
					redisClient.srem(instanceSocketsKey(), socketId)
				]);
			}

			const remainingSessions = await getUserSessions(session.uid);
			return {
				session,
				remainingUserSessionCount: remainingSessions.length
			};
		},
		async emitRoomEvent(roomId, eventName, payload) {
			emitLocalRoomEvent(roomId, eventName, payload);
			if (adapterMode === 'socket.io-redis-adapter') {
				return;
			}

			await publishRoomEvent(roomId, eventName, payload);
		}
	};
}

module.exports = {
	createRealtimeService
};
