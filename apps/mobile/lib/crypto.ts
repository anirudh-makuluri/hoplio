import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { blake2b } from 'blakejs';
import { Platform } from 'react-native';
import { EncryptedData } from './e2ee-types';

let cryptoReady = false;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Map(BASE64_ALPHABET.split('').map((char, index) => [char, index]));

const concatUint8Arrays = (...arrays: Uint8Array[]) => {
	const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
	const combined = new Uint8Array(totalLength);
	let offset = 0;

	for (const array of arrays) {
		combined.set(array, offset);
		offset += array.length;
	}

	return combined;
};

const encodeBase64 = (bytes: Uint8Array): string => {
	let output = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;
		const chunk = (a << 16) | (b << 8) | c;

		output += BASE64_ALPHABET[(chunk >> 18) & 63];
		output += BASE64_ALPHABET[(chunk >> 12) & 63];
		output += i + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
		output += i + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : '=';
	}

	return output;
};

const decodeBase64 = (value: string): Uint8Array => {
	const normalized = value.replace(/\s+/g, '');
	if (normalized.length % 4 !== 0) {
		throw new Error('Invalid base64 length');
	}

	const output: number[] = [];
	for (let i = 0; i < normalized.length; i += 4) {
		const chars = normalized.slice(i, i + 4);
		const a = BASE64_LOOKUP.get(chars[0]);
		const b = BASE64_LOOKUP.get(chars[1]);
		const c = chars[2] === '=' ? 0 : BASE64_LOOKUP.get(chars[2]);
		const d = chars[3] === '=' ? 0 : BASE64_LOOKUP.get(chars[3]);

		if (a == null || b == null || c == null || d == null) {
			throw new Error('Invalid base64 character');
		}

		const chunk = (a << 18) | (b << 12) | (c << 6) | d;
		output.push((chunk >> 16) & 255);
		if (chars[2] !== '=') {
			output.push((chunk >> 8) & 255);
		}
		if (chars[3] !== '=') {
			output.push(chunk & 255);
		}
	}

	return new Uint8Array(output);
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const computeSealNonce = (ephemeralPublicKey: Uint8Array, recipientPublicKey: Uint8Array) =>
	blake2b(concatUint8Arrays(ephemeralPublicKey, recipientPublicKey), undefined, nacl.box.nonceLength);

export const initiateSodium = async (): Promise<void> => {
	cryptoReady = true;
};

export const isSodiumReady = () => cryptoReady;

export const generateBoxKeypair = (): { publicKey: string; privateKey: string } => {
	if (!cryptoReady) {
		throw new Error('Crypto not initialized');
	}

	const keypair = nacl.box.keyPair();
	return {
		publicKey: encodeBase64(keypair.publicKey),
		privateKey: encodeBase64(keypair.secretKey),
	};
};

export const generateSigningKeypair = (): { publicKey: string; privateKey: string } => {
	if (!cryptoReady) {
		throw new Error('Crypto not initialized');
	}

	const keypair = nacl.sign.keyPair();
	return {
		publicKey: encodeBase64(keypair.publicKey),
		privateKey: encodeBase64(keypair.secretKey),
	};
};

export const encryptMessageForRecipient = (
	message: string,
	recipientPublicKeyBase64: string
): EncryptedData => {
	if (!cryptoReady) {
		throw new Error('Crypto not initialized');
	}

	const recipientPublicKey = decodeBase64(recipientPublicKeyBase64);
	const ephemeral = nacl.box.keyPair();
	const nonce = computeSealNonce(ephemeral.publicKey, recipientPublicKey);
	const messageBytes = textEncoder.encode(message);
	const sealedPayload = nacl.box(messageBytes, nonce, recipientPublicKey, ephemeral.secretKey);
	const ciphertext = concatUint8Arrays(ephemeral.publicKey, sealedPayload);

	return {
		ciphertext: encodeBase64(ciphertext),
		iv: encodeBase64(nonce),
	};
};

export const decryptMessage = (
	ciphertextBase64: string,
	keyPair: { publicKey: string; privateKey: string }
): string => {
	if (!cryptoReady) {
		throw new Error('Crypto not initialized');
	}

	const ciphertext = decodeBase64(ciphertextBase64);
	const recipientPublicKey = decodeBase64(keyPair.publicKey);
	const recipientPrivateKey = decodeBase64(keyPair.privateKey);

	if (ciphertext.length <= nacl.box.publicKeyLength) {
		throw new Error('Ciphertext is too short');
	}

	const ephemeralPublicKey = ciphertext.slice(0, nacl.box.publicKeyLength);
	const sealedPayload = ciphertext.slice(nacl.box.publicKeyLength);
	const nonce = computeSealNonce(ephemeralPublicKey, recipientPublicKey);
	const decrypted = nacl.box.open(sealedPayload, nonce, ephemeralPublicKey, recipientPrivateKey);

	if (!decrypted) {
		throw new Error('Unable to decrypt ciphertext');
	}

	return textDecoder.decode(decrypted);
};

export const normalizeBase64Key = (value: string) => encodeBase64(decodeBase64(value));

export const signMessage = (message: string, secretKeyBase64: string) =>
	encodeBase64(nacl.sign.detached(textEncoder.encode(message), decodeBase64(secretKeyBase64)));

export const verifySignature = (message: string, signatureBase64: string, publicKeyBase64: string) => {
	try {
		return nacl.sign.detached.verify(
			textEncoder.encode(message),
			decodeBase64(signatureBase64),
			decodeBase64(publicKeyBase64)
		);
	} catch (_error) {
		return false;
	}
};

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

export const computeDeviceFingerprint = (identityPublicKey: string, signingPublicKey: string) => {
	const fingerprintSource = `${normalizeBase64Key(identityPublicKey)}:${normalizeBase64Key(signingPublicKey)}`;
	return toHex(blake2b(textEncoder.encode(fingerprintSource), undefined, 32));
};

export const formatFingerprintForDisplay = (fingerprint: string) =>
	fingerprint.match(/.{1,4}/g)?.join(' ') || fingerprint;

export const buildRoomKeySignaturePayload = (
	roomId: string,
	userId: string,
	deviceId: string,
	roomPublicKey: string
) => `${roomId}:${userId}:${deviceId}:${normalizeBase64Key(roomPublicKey)}`;

export const isValidBase64Key = (value: string, minLength = 40, maxLength = 45) => {
	if (typeof value !== 'string') {
		return false;
	}

	const trimmed = value.trim();
	if (trimmed.length < minLength || trimmed.length > maxLength) {
		return false;
	}

	try {
		return normalizeBase64Key(trimmed).replace(/=+$/, '') === trimmed.replace(/=+$/, '');
	} catch (_error) {
		return false;
	}
};

export const generateDeviceId = (deviceType: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android') => {
	const randomBytes = nacl.randomBytes(8);
	const randomHex = Array.from(randomBytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

	return `${deviceType}:mobile:${randomHex}`;
};
