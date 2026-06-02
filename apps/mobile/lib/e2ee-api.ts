import { customFetch } from './utils';
import {
	GetIdentityKeyResponse,
	GetRoomPublicKeysResponse,
	RegisterDeviceIdentityKeyRequest,
	RegisterDeviceIdentityKeyResponse,
	RegisterDeviceRoomKeyRequest,
	RegisterDeviceRoomKeyResponse,
} from './e2ee-types';

export const registerDeviceIdentityKey = (
	request: RegisterDeviceIdentityKeyRequest
): Promise<RegisterDeviceIdentityKeyResponse> =>
	customFetch({
		pathName: 'auth/setup-keys',
		method: 'POST',
		body: request,
	});

export const registerDeviceRoomKey = (
	roomId: string,
	request: RegisterDeviceRoomKeyRequest
): Promise<RegisterDeviceRoomKeyResponse> =>
	customFetch({
		pathName: `rooms/${roomId}/members/add-key`,
		method: 'POST',
		body: request,
	});

export const getRoomPublicKeys = (roomId: string): Promise<GetRoomPublicKeysResponse> =>
	customFetch({
		pathName: `rooms/${roomId}/members/public-keys`,
		method: 'GET',
	});

export const getIdentityKeyForDevice = (
	userId: string,
	deviceId: string
): Promise<GetIdentityKeyResponse> =>
	customFetch({
		pathName: `users/${userId}/identity-key?deviceId=${encodeURIComponent(deviceId)}`,
		method: 'GET',
	});
