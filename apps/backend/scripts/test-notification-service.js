#!/usr/bin/env node

const crypto = require('crypto');
const admin = require('firebase-admin');

const config = require('../config');
const { createNotificationDispatcher } = require('../helpers/notification-dispatcher');

function parseArgs(argv) {
	const args = {};

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith('--')) {
			continue;
		}

		const key = token.slice(2);
		const next = argv[index + 1];
		if (!next || next.startsWith('--')) {
			args[key] = true;
			continue;
		}

		args[key] = next;
		index += 1;
	}

	return args;
}

function printUsage() {
	console.log(`
Usage:
  node scripts/test-notification-service.js --recipient-user-id <firebase-uid> [options]

What this tests:
  1. Node.js can reach the notification service internal endpoint
  2. The notification service can read seeded device docs from Firestore
  3. The notification service writes a notification_deliveries document

Notes:
  - This does not require a physical phone.
  - A fake FCM token is fine. Delivery will likely be marked FAILED, but that still proves the integration path.

Options:
  --recipient-user-id <uid>   Firestore auth_users/{uid} target to seed and dispatch to
  --sender-user-id <uid>      Defaults to local-smoke-sender
  --sender-name <name>        Defaults to Local Smoke Test
  --device-id <id>            Defaults to local-smoke-device
  --room-id <id>              Defaults to local-smoke-room
  --message-id <id>           Defaults to an auto-generated id
  --preview <text>            Defaults to Notification smoke test
  --fcm-token <token>         Defaults to fake-local-token
  --type <type>               Defaults to text
  --group                     Sends as a group message
  --room-name <name>          Optional group name
  --encrypted                 Marks payload as encrypted
  --cleanup                   Deletes the seeded device doc after the run
  --help                      Show this message
`);
}

function requireArg(args, name) {
	const value = args[name];
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Missing required argument --${name}`);
	}

	return value.trim();
}

function initializeFirebaseAdmin() {
	if (admin.apps.length > 0) {
		return admin.app();
	}

	return admin.initializeApp({
		credential: admin.credential.cert(config.serviceAccount)
	});
}

async function ensureNotificationServiceReachable(baseUrl) {
	const response = await fetch(`${baseUrl}/health`);
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Notification service health check failed with ${response.status}: ${body || response.statusText}`);
	}

	return response.json().catch(() => ({ status: 'ok' }));
}

async function pollForDeliveryDoc(deliveryRef, timeoutMs) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const snapshot = await deliveryRef.get();
		if (snapshot.exists) {
			return snapshot.data();
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return null;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printUsage();
		return;
	}

	const recipientUserId = requireArg(args, 'recipient-user-id');
	const senderUserId = typeof args['sender-user-id'] === 'string' && args['sender-user-id'].trim()
		? args['sender-user-id'].trim()
		: 'local-smoke-sender';
	const senderName = typeof args['sender-name'] === 'string' && args['sender-name'].trim()
		? args['sender-name'].trim()
		: 'Local Smoke Test';
	const deviceId = typeof args['device-id'] === 'string' && args['device-id'].trim()
		? args['device-id'].trim()
		: 'local-smoke-device';
	const roomId = typeof args['room-id'] === 'string' && args['room-id'].trim()
		? args['room-id'].trim()
		: 'local-smoke-room';
	const messageId = typeof args['message-id'] === 'string' && args['message-id'].trim()
		? args['message-id'].trim()
		: `notif-smoke-${crypto.randomUUID()}`;
	const plaintextPreview = typeof args.preview === 'string' && args.preview.trim()
		? args.preview.trim()
		: 'Notification smoke test';
	const fcmToken = typeof args['fcm-token'] === 'string' && args['fcm-token'].trim()
		? args['fcm-token'].trim()
		: 'fake-local-token';
	const type = typeof args.type === 'string' && args.type.trim()
		? args.type.trim()
		: 'text';
	const isGroup = Boolean(args.group);
	const roomName = typeof args['room-name'] === 'string' ? args['room-name'].trim() : '';
	const isEncrypted = Boolean(args.encrypted);
	const shouldCleanup = Boolean(args.cleanup);

	if (!config.notificationService.baseUrl) {
		throw new Error('NOTIFICATION_SERVICE_URL is not configured in apps/backend/.env');
	}

	if (!config.notificationService.internalToken) {
		throw new Error('NOTIFICATION_INTERNAL_TOKEN is not configured in apps/backend/.env');
	}

	initializeFirebaseAdmin();
	const db = admin.firestore();

	console.log(`Checking notification service health at ${config.notificationService.baseUrl}/health`);
	const health = await ensureNotificationServiceReachable(config.notificationService.baseUrl);
	console.log('Health response:', JSON.stringify(health, null, 2));

	const deviceRef = db.collection('auth_users').doc(recipientUserId).collection('devices').doc(deviceId);
	const deliveryRef = db.collection('notification_deliveries')
		.doc(`${messageId}__${recipientUserId}__${deviceId}`);

	console.log(`Seeding Firestore device doc at auth_users/${recipientUserId}/devices/${deviceId}`);
	await deviceRef.set({
		userId: recipientUserId,
		deviceId,
		fcmToken,
		platform: 'android',
		deviceName: 'Local Smoke Device',
		notificationsEnabled: true,
		pushProvider: 'fcm',
		updatedAt: admin.firestore.FieldValue.serverTimestamp(),
		lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
		lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp()
	}, { merge: true });

	const dispatcher = createNotificationDispatcher({
		serviceConfig: config.notificationService,
		logger: console
	});

	const payload = {
		messageId,
		roomId,
		senderUserId,
		senderName,
		isGroup,
		roomName,
		type,
		plaintextPreview,
		isEncrypted,
		recipientUserIds: [recipientUserId],
		deliveredViaWs: {
			[recipientUserId]: []
		}
	};

	console.log('Dispatching payload through the backend notification helper');
	console.log(JSON.stringify(payload, null, 2));

	const response = await dispatcher.dispatchChatMessage(payload);
	console.log('Dispatch response:', JSON.stringify(response, null, 2));

	console.log(`Waiting for Firestore delivery doc notification_deliveries/${deliveryRef.id}`);
	const deliveryDoc = await pollForDeliveryDoc(deliveryRef, 10000);
	if (!deliveryDoc) {
		throw new Error('Timed out waiting for notification_deliveries document');
	}

	console.log('Observed Firestore delivery doc:', JSON.stringify(deliveryDoc, null, 2));

	if (shouldCleanup) {
		console.log(`Cleaning up seeded device doc auth_users/${recipientUserId}/devices/${deviceId}`);
		await deviceRef.delete();
	}

	console.log('');
	console.log('Smoke test completed.');
	console.log(`Final delivery status: ${deliveryDoc.status || 'UNKNOWN'}`);
	console.log('If you used a fake FCM token, FAILED or INVALID_ARGUMENT is expected and still proves the integration path.');
}

main().catch((error) => {
	console.error('Notification smoke test failed.');
	console.error(error?.stack || error?.message || error);
	process.exitCode = 1;
});
