import { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import {
	selectDeviceId,
	selectE2EEError,
	selectIsInitializing,
	selectIsSyncingKeys,
	selectRoomMemberPublicKeys,
	setDeviceState,
	setError,
	setInitializing,
	setRoomKeyPair,
	setRoomMemberPublicKeys,
	setSyncingKeys,
} from '../../redux/e2eeSlice';
import * as crypto from '../crypto';
import * as deviceManager from '../device-manager';
import * as e2eeApi from '../e2ee-api';
import { RecipientEncryptedMessages, RoomMemberKeyBundle, MemberPublicKeys } from '../e2ee-types';

const verifyAndNormalizeMemberKeys = async (
	roomId: string,
	rawMembers: Record<string, Record<string, RoomMemberKeyBundle>>
): Promise<{ verifiedKeys: MemberPublicKeys; warnings: string[] }> => {
	const verifiedKeys: MemberPublicKeys = {};
	const warnings: string[] = [];

	for (const [userId, devices] of Object.entries(rawMembers || {})) {
		for (const [deviceId, deviceBundle] of Object.entries(devices || {})) {
			try {
				const computedFingerprint = crypto.computeDeviceFingerprint(
					deviceBundle.identityPublicKey,
					deviceBundle.signingPublicKey
				);

				if (computedFingerprint !== deviceBundle.identityFingerprint) {
					warnings.push(`Fingerprint mismatch for ${userId}/${deviceId}`);
					continue;
				}

				const signaturePayload = crypto.buildRoomKeySignaturePayload(
					roomId,
					userId,
					deviceId,
					deviceBundle.roomPublicKey
				);

				if (
					!crypto.verifySignature(
						signaturePayload,
						deviceBundle.roomKeySignature,
						deviceBundle.signingPublicKey
					)
				) {
					warnings.push(`Invalid room key signature for ${userId}/${deviceId}`);
					continue;
				}

				const trustedFingerprint = await deviceManager.getTrustedFingerprint(userId, deviceId);
				if (trustedFingerprint && trustedFingerprint !== deviceBundle.identityFingerprint) {
					warnings.push(`Trusted fingerprint changed for ${userId}/${deviceId}`);
					continue;
				}

				if (!trustedFingerprint) {
					await deviceManager.rememberTrustedFingerprint(userId, deviceId, deviceBundle.identityFingerprint);
				}

				if (!verifiedKeys[userId]) {
					verifiedKeys[userId] = {};
				}
				verifiedKeys[userId][deviceId] = deviceBundle.roomPublicKey;
			} catch (_error) {
				warnings.push(`Unable to verify device ${userId}/${deviceId}`);
			}
		}
	}

	return { verifiedKeys, warnings };
};

export const useE2EEInitialization = () => {
	const dispatch = useAppDispatch();
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const initialize = async () => {
			try {
				dispatch(setInitializing(true));
				await crypto.initiateSodium();
				const state = (await deviceManager.loadDeviceState()) ?? (await deviceManager.initializeDevice());

				if (!cancelled) {
					dispatch(setDeviceState(state));
					setInitialized(true);
				}
			} catch (error) {
				if (!cancelled) {
					dispatch(setError(error instanceof Error ? error.message : 'Failed to initialize secure messaging'));
				}
			} finally {
				if (!cancelled) {
					dispatch(setInitializing(false));
				}
			}
		};

		void initialize();

		return () => {
			cancelled = true;
		};
	}, [dispatch]);

	return initialized;
};

export const useEnsureE2EEKeys = () => {
	const dispatch = useAppDispatch();

	return useCallback(
		async (userId: string, roomIds: string[]) => {
			dispatch(setSyncingKeys(true));
			try {
				await crypto.initiateSodium();
				const deviceState = await deviceManager.ensureDeviceForUser(userId);
				dispatch(setDeviceState(deviceState));

				if (!deviceState.deviceId || !deviceState.identityKeyPair || !deviceState.signingKeyPair) {
					throw new Error('Device identity is not available');
				}

				let identityExists = false;
				try {
					const identityResponse = await e2eeApi.getIdentityKeyForDevice(userId, deviceState.deviceId);
					identityExists = Boolean(
						identityResponse.success &&
						identityResponse.publicKey &&
						identityResponse.signingPublicKey
					);
				} catch (error) {
					if (!(error instanceof Response) || error.status !== 404) {
						throw error;
					}
				}

				if (!identityExists) {
					await e2eeApi.registerDeviceIdentityKey({
						userId,
						deviceId: deviceState.deviceId,
						deviceName: deviceState.deviceName || 'Mobile Device',
						identityPublicKey: deviceState.identityKeyPair.publicKey,
						signingPublicKey: deviceState.signingKeyPair.publicKey,
					});
				}

				for (const roomId of roomIds) {
					const roomKeyPair = await deviceManager.ensureRoomKeyPair(roomId);
					dispatch(setRoomKeyPair(roomKeyPair));
					const roomKeySignature = crypto.signMessage(
						crypto.buildRoomKeySignaturePayload(
							roomId,
							userId,
							deviceState.deviceId,
							roomKeyPair.publicKey
						),
						deviceState.signingKeyPair.privateKey
					);

					await e2eeApi.registerDeviceRoomKey(roomId, {
						userId,
						deviceId: deviceState.deviceId,
						deviceName: deviceState.deviceName || 'Mobile Device',
						roomPublicKey: roomKeyPair.publicKey,
						roomKeySignature,
					});
				}

				dispatch(setError(null));
			} catch (error) {
				dispatch(setError(error instanceof Error ? error.message : 'Failed to sync secure messaging keys'));
				throw error;
			} finally {
				dispatch(setSyncingKeys(false));
			}
		},
		[dispatch]
	);
};

export const useFetchRoomMemberPublicKeys = (roomId: string) => {
	const dispatch = useAppDispatch();
	const memberPublicKeys = useAppSelector(selectRoomMemberPublicKeys(roomId));
	const [loading, setLoading] = useState(false);
	const [error, setLocalError] = useState<string | null>(null);

	const fetch = useCallback(async () => {
		if (!roomId) {
			return null;
		}

		try {
			setLoading(true);
			setLocalError(null);
			const response = await e2eeApi.getRoomPublicKeys(roomId);
			const { verifiedKeys, warnings } = await verifyAndNormalizeMemberKeys(roomId, response.members);
			dispatch(setRoomMemberPublicKeys({ roomId, memberPublicKeys: verifiedKeys }));
			const warningMessage = warnings.length > 0 ? warnings[0] : null;
			dispatch(setError(warningMessage));
			return verifiedKeys;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to fetch room member keys';
			setLocalError(message);
			dispatch(setError(message));
			throw error;
		} finally {
			setLoading(false);
		}
	}, [dispatch, roomId]);

	return { memberPublicKeys, fetch, loading, error };
};

export const useEncryptRoomMessage = (roomId: string) => {
	const memberPublicKeys = useAppSelector(selectRoomMemberPublicKeys(roomId));
	const [loading, setLoading] = useState(false);
	const [error, setLocalError] = useState<string | null>(null);

	const encrypt = useCallback(
		(message: string): RecipientEncryptedMessages => {
			setLoading(true);
			try {
				if (!memberPublicKeys || Object.keys(memberPublicKeys).length === 0) {
					throw new Error('Member keys are not available for this room yet');
				}

				const encrypted: RecipientEncryptedMessages = {};
				for (const [userId, devices] of Object.entries(memberPublicKeys)) {
					encrypted[userId] = {};
					for (const [deviceId, publicKey] of Object.entries(devices as Record<string, string>)) {
						encrypted[userId][deviceId] = crypto.encryptMessageForRecipient(message, publicKey);
					}
				}

				setLocalError(null);
				return encrypted;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to encrypt message';
				setLocalError(message);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[memberPublicKeys]
	);

	return { encrypt, loading, error };
};

export const useDeviceId = () => useAppSelector(selectDeviceId);
export const useE2EEError = () => useAppSelector(selectE2EEError);
export const useE2EEInitializing = () => useAppSelector(selectIsInitializing);
export const useE2EESyncingKeys = () => useAppSelector(selectIsSyncingKeys);
