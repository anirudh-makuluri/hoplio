import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { auth } from './firebase';
import { globals } from '../globals';

const PENDING_NOTIFICATION_ROOM_KEY = 'pending_notification_room_id';
const MESSAGE_CHANNEL_ID = 'hoplio-messages';

let notificationTrackingInitialized = false;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: true,
	}),
});

type RegisterAndroidPushDeviceParams = {
	deviceId: string;
	deviceName?: string | null;
};

export async function initializeNotificationResponseTracking() {
	if (notificationTrackingInitialized) {
		return;
	}

	notificationTrackingInitialized = true;
	await rememberRoomFromNotificationResponse(await Notifications.getLastNotificationResponseAsync());
	Notifications.addNotificationResponseReceivedListener((response) => {
		void rememberRoomFromNotificationResponse(response);
	});
}

export async function registerAndroidPushDevice({
	deviceId,
	deviceName,
}: RegisterAndroidPushDeviceParams) {
	if (Platform.OS !== 'android' || !deviceId || !globals.NOTIFICATION_SERVICE_URL) {
		return { skipped: true };
	}

	await initializeAndroidChannel();

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;
	if (finalStatus !== 'granted') {
		const permissionResponse = await Notifications.requestPermissionsAsync();
		finalStatus = permissionResponse.status;
	}

	if (finalStatus !== 'granted') {
		return { skipped: true, reason: 'permission-not-granted' };
	}

	const firebaseUser = auth.currentUser;
	if (!firebaseUser) {
		return { skipped: true, reason: 'missing-firebase-user' };
	}

	const idToken = await firebaseUser.getIdToken(true);
	const pushToken = await Notifications.getDevicePushTokenAsync();
	const fcmToken = typeof pushToken.data === 'string' ? pushToken.data.trim() : '';

	if (!fcmToken) {
		return { skipped: true, reason: 'missing-fcm-token' };
	}

	const response = await fetch(`${globals.NOTIFICATION_SERVICE_URL}/api/v1/devices/register`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`,
		},
		body: JSON.stringify({
			deviceId,
			deviceName: deviceName || 'Android Device',
			fcmToken,
			platform: 'android',
			notificationsEnabled: true,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(errorText || 'Failed to register Android push token');
	}

	return response.json();
}

export async function unregisterAndroidPushDevice(deviceId: string) {
	if (Platform.OS !== 'android' || !deviceId || !globals.NOTIFICATION_SERVICE_URL) {
		return;
	}

	const firebaseUser = auth.currentUser;
	if (!firebaseUser) {
		return;
	}

	const idToken = await firebaseUser.getIdToken();
	await fetch(`${globals.NOTIFICATION_SERVICE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${idToken}`,
		},
	});
}

export async function consumePendingNotificationRoomId() {
	const roomId = await AsyncStorage.getItem(PENDING_NOTIFICATION_ROOM_KEY);
	if (!roomId) {
		return null;
	}

	await AsyncStorage.removeItem(PENDING_NOTIFICATION_ROOM_KEY);
	return roomId;
}

async function initializeAndroidChannel() {
	if (Platform.OS !== 'android') {
		return;
	}

	await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL_ID, {
		name: 'Messages',
		importance: Notifications.AndroidImportance.MAX,
		vibrationPattern: [0, 250, 250, 250],
		lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
	});
}

async function rememberRoomFromNotificationResponse(response: Notifications.NotificationResponse | null) {
	const roomId = extractRoomId(response);
	if (!roomId) {
		return;
	}

	await AsyncStorage.setItem(PENDING_NOTIFICATION_ROOM_KEY, roomId);
}

function extractRoomId(response: Notifications.NotificationResponse | null) {
	const maybeRoomId = response?.notification?.request?.content?.data?.roomId;
	return typeof maybeRoomId === 'string' && maybeRoomId.trim() ? maybeRoomId.trim() : null;
}
