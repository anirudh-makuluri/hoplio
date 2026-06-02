export type DeviceKeyPair = {
	deviceId: string;
	publicKey: string;
	privateKey: string;
	deviceName: string;
};

export type DeviceSigningKeyPair = {
	deviceId: string;
	publicKey: string;
	privateKey: string;
	deviceName: string;
};

export type RoomKeyPair = {
	roomId: string;
	publicKey: string;
	privateKey: string;
};

export type EncryptedData = {
	ciphertext: string;
	iv?: string;
};

export type RecipientEncryptedMessages = {
	[userId: string]: {
		[deviceId: string]: EncryptedData;
	};
};

export type MemberPublicKeys = {
	[userId: string]: {
		[deviceId: string]: string;
	};
};

export type RoomMemberKeyBundle = {
	roomPublicKey: string;
	roomKeySignature: string;
	identityPublicKey: string;
	signingPublicKey: string;
	identityFingerprint: string;
	deviceName: string;
	version: number;
	derivationVersion: number;
	updatedAt: string;
};

export type E2EEDeviceState = {
	initialized: boolean;
	deviceId: string | null;
	deviceName: string | null;
	ownerUserId: string | null;
	identityKeyPair: DeviceKeyPair | null;
	signingKeyPair: DeviceSigningKeyPair | null;
	roomKeyPairs: {
		[roomId: string]: RoomKeyPair;
	};
};

export type RegisterDeviceIdentityKeyRequest = {
	userId: string;
	deviceId: string;
	deviceName: string;
	identityPublicKey: string;
	signingPublicKey: string;
};

export type RegisterDeviceIdentityKeyResponse = {
	success: boolean;
	message?: string;
	deviceId: string;
	error?: string;
};

export type RegisterDeviceRoomKeyRequest = {
	userId: string;
	deviceId: string;
	deviceName: string;
	roomPublicKey: string;
	roomKeySignature: string;
};

export type RegisterDeviceRoomKeyResponse = {
	success: boolean;
	message?: string;
	deviceId: string;
	error?: string;
};

export type GetRoomPublicKeysResponse = {
	success: boolean;
	roomId: string;
	members: {
		[userId: string]: {
			[deviceId: string]: RoomMemberKeyBundle;
		};
	};
	updatedAt: string;
	error?: string;
};

export type GetIdentityKeyResponse = {
	success: boolean;
	userId: string;
	deviceId?: string;
	publicKey?: string;
	signingPublicKey?: string;
	fingerprint?: string;
	version?: number;
	deviceName?: string;
	updatedAt?: string;
	devices?: {
		[deviceId: string]: {
			publicKey: string;
			signingPublicKey: string;
			fingerprint: string;
			version: number;
			deviceName: string;
			updatedAt: string;
		};
	};
	error?: string;
};
