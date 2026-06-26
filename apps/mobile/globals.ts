import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PROD_BACKEND_URL = 'https://hoplio.onrender.com';
const DEFAULT_NOTIFICATION_SERVICE_PORT = 8080;

function normalizeHost(value?: string | null) {
	if (!value) return null;

	const trimmedValue = value.trim();
	if (!trimmedValue) return null;

	const withoutScheme = trimmedValue.replace(/^[a-z]+:\/\//i, '');
	const host = withoutScheme.split(/[/:]/)[0];
	return host || null;
}

function getExpoDevHost() {
	const constantsWithLegacyManifest = Constants as typeof Constants & {
		manifest?: { debuggerHost?: string | null };
		manifest2?: { extra?: { expoClient?: { hostUri?: string | null } } };
	};

	const candidates = [
		(Constants.expoConfig as { hostUri?: string | null } | null)?.hostUri,
		constantsWithLegacyManifest.manifest2?.extra?.expoClient?.hostUri,
		constantsWithLegacyManifest.manifest?.debuggerHost,
		Constants.linkingUri,
	];

	for (const candidate of candidates) {
		const host = normalizeHost(candidate);
		if (host) return host;
	}

	return null;
}

function getDefaultDevBackendUrl() {
	if (Platform.OS === 'web') {
		return 'http://localhost:5000';
	}

	const expoDevHost = getExpoDevHost();
	if (expoDevHost) {
		return `http://${expoDevHost}:5000`;
	}

	if (Platform.OS === 'android') {
		// Android emulators need 10.0.2.2 to reach services on the host machine.
		return 'http://10.0.2.2:5000';
	}

	return 'http://localhost:5000';
}

const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
const envNotificationServiceUrl = process.env.EXPO_PUBLIC_NOTIFICATION_SERVICE_URL?.trim();

function getDefaultDevNotificationServiceUrl() {
	if (Platform.OS === 'web') {
		return `http://localhost:${DEFAULT_NOTIFICATION_SERVICE_PORT}`;
	}

	const expoDevHost = getExpoDevHost();
	if (expoDevHost) {
		return `http://${expoDevHost}:${DEFAULT_NOTIFICATION_SERVICE_PORT}`;
	}

	if (Platform.OS === 'android') {
		return `http://10.0.2.2:${DEFAULT_NOTIFICATION_SERVICE_PORT}`;
	}

	return `http://localhost:${DEFAULT_NOTIFICATION_SERVICE_PORT}`;
}

export const globals = {
	BACKEND_URL: envBackendUrl || (__DEV__ ? getDefaultDevBackendUrl() : PROD_BACKEND_URL),
	NOTIFICATION_SERVICE_URL: envNotificationServiceUrl || (__DEV__ ? getDefaultDevNotificationServiceUrl() : '')
};
