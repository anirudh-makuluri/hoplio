import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { E2EEDeviceState, RoomKeyPair } from './e2ee-types';
import { generateBoxKeypair, generateDeviceId, generateSigningKeypair } from './crypto';

const DEVICE_STORAGE_KEY = 'mobile_e2ee_device_state';
const TRUSTED_FINGERPRINTS_KEY = 'mobile_e2ee_trusted_fingerprints';

let cachedState: E2EEDeviceState | null = null;
let cachedTrustedFingerprints: Record<string, string> | null = null;

const ensureStateShape = async (state: E2EEDeviceState) => {
	if (state.signingKeyPair) {
		return state;
	}

	const signingKeyPair = generateSigningKeypair();
	const nextState: E2EEDeviceState = {
		...state,
		signingKeyPair: {
			deviceId: state.deviceId || generateDeviceId(Platform.OS === 'ios' ? 'ios' : 'android'),
			deviceName: state.deviceName || (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device'),
			publicKey: signingKeyPair.publicKey,
			privateKey: signingKeyPair.privateKey,
		},
	};

	await persistState(nextState);
	return nextState;
};

const buildInitialState = (ownerUserId: string | null = null): E2EEDeviceState => {
	const deviceId = generateDeviceId(Platform.OS === 'ios' ? 'ios' : 'android');
	const identityKeyPair = generateBoxKeypair();
	const signingKeyPair = generateSigningKeypair();
	const deviceName = Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';

	return {
		initialized: true,
		deviceId,
		deviceName,
		ownerUserId,
		identityKeyPair: {
			deviceId,
			deviceName,
			publicKey: identityKeyPair.publicKey,
			privateKey: identityKeyPair.privateKey,
		},
		signingKeyPair: {
			deviceId,
			deviceName,
			publicKey: signingKeyPair.publicKey,
			privateKey: signingKeyPair.privateKey,
		},
		roomKeyPairs: {},
	};
};

const persistState = async (state: E2EEDeviceState) => {
	cachedState = state;
	await AsyncStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(state));
};

export const loadDeviceState = async (): Promise<E2EEDeviceState | null> => {
	if (cachedState) {
		return cachedState;
	}

	const stored = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
	if (!stored) {
		return null;
	}

	cachedState = (await ensureStateShape(JSON.parse(stored) as E2EEDeviceState)) as E2EEDeviceState;
	return cachedState;
};

export const initializeDevice = async (ownerUserId: string | null = null) => {
	const existing = await loadDeviceState();
	if (existing?.initialized && existing.deviceId) {
		return existing;
	}

	const nextState = buildInitialState(ownerUserId);
	await persistState(nextState);
	return nextState;
};

export const ensureDeviceForUser = async (userId: string) => {
	const existing = await loadDeviceState();

	if (existing?.ownerUserId && existing.ownerUserId !== userId) {
		await clearDeviceData();
		const resetState = buildInitialState(userId);
		await persistState(resetState);
		return resetState;
	}

	const state = existing ?? (await initializeDevice(userId));
	if (state.ownerUserId !== userId) {
		const nextState = { ...state, ownerUserId: userId };
		await persistState(nextState);
		return nextState;
	}

	return state;
};

export const getDeviceState = () => cachedState;

export const getDeviceId = () => cachedState?.deviceId ?? null;

export const getOwnerUserId = () => cachedState?.ownerUserId ?? null;

export const getDeviceName = () => cachedState?.deviceName ?? null;

export const getIdentityKeyPair = () => cachedState?.identityKeyPair ?? null;

export const getIdentityPublicKey = () => cachedState?.identityKeyPair?.publicKey ?? null;

export const getSigningKeyPair = () => cachedState?.signingKeyPair ?? null;

export const getSigningPublicKey = () => cachedState?.signingKeyPair?.publicKey ?? null;

export const rotateSigningKeyPair = async () => {
	const currentState = cachedState ?? (await initializeDevice());
	const signingKeyPair = generateSigningKeypair();
	const deviceId = currentState.deviceId || generateDeviceId(Platform.OS === 'ios' ? 'ios' : 'android');
	const deviceName = currentState.deviceName || (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device');
	const nextState: E2EEDeviceState = {
		...currentState,
		deviceId,
		deviceName,
		signingKeyPair: {
			deviceId,
			deviceName,
			publicKey: signingKeyPair.publicKey,
			privateKey: signingKeyPair.privateKey,
		},
	};

	await persistState(nextState);
	return nextState.signingKeyPair;
};

export const getRoomKeyPair = (roomId: string) => cachedState?.roomKeyPairs[roomId] ?? null;

export const getAllRoomKeyPairs = () => cachedState?.roomKeyPairs ?? {};

export const setRoomKeyPair = async (roomKeyPair: RoomKeyPair) => {
	const currentState = cachedState ?? (await initializeDevice());
	const nextState: E2EEDeviceState = {
		...currentState,
		roomKeyPairs: {
			...currentState.roomKeyPairs,
			[roomKeyPair.roomId]: roomKeyPair,
		},
	};

	await persistState(nextState);
	return nextState;
};

export const ensureRoomKeyPair = async (roomId: string) => {
	const existing = getRoomKeyPair(roomId);
	if (existing) {
		return existing;
	}

	const generated = generateBoxKeypair();
	const roomKeyPair: RoomKeyPair = {
		roomId,
		publicKey: generated.publicKey,
		privateKey: generated.privateKey,
	};

	await setRoomKeyPair(roomKeyPair);
	return roomKeyPair;
};

export const clearDeviceData = async () => {
	cachedState = null;
	cachedTrustedFingerprints = null;
	await AsyncStorage.removeItem(DEVICE_STORAGE_KEY);
	await AsyncStorage.removeItem(TRUSTED_FINGERPRINTS_KEY);
};

const loadTrustedFingerprints = async () => {
	if (cachedTrustedFingerprints) {
		return cachedTrustedFingerprints;
	}

	const stored = await AsyncStorage.getItem(TRUSTED_FINGERPRINTS_KEY);
	cachedTrustedFingerprints = stored ? (JSON.parse(stored) as Record<string, string>) : {};
	return cachedTrustedFingerprints;
};

const persistTrustedFingerprints = async (trustedFingerprints: Record<string, string>) => {
	cachedTrustedFingerprints = trustedFingerprints;
	await AsyncStorage.setItem(TRUSTED_FINGERPRINTS_KEY, JSON.stringify(trustedFingerprints));
};

export const getTrustedFingerprint = async (userId: string, deviceId: string) => {
	const trustedFingerprints = await loadTrustedFingerprints();
	return trustedFingerprints[`${userId}:${deviceId}`] ?? null;
};

export const rememberTrustedFingerprint = async (userId: string, deviceId: string, fingerprint: string) => {
	const trustedFingerprints = await loadTrustedFingerprints();
	trustedFingerprints[`${userId}:${deviceId}`] = fingerprint;
	await persistTrustedFingerprints(trustedFingerprints);
};
