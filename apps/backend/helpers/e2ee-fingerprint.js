const { blake2bHex } = require('blakejs');

function normalizeBase64(value) {
	return Buffer.from(value.trim(), 'base64').toString('base64');
}

function computeDeviceFingerprint(identityPublicKey, signingPublicKey) {
	const fingerprintSource = `${normalizeBase64(identityPublicKey)}:${normalizeBase64(signingPublicKey)}`;
	return blake2bHex(Buffer.from(fingerprintSource, 'utf8'), null, 32);
}

function deriveStoredOrComputedFingerprint(identityPublicKey, signingPublicKey, fallbackFingerprint = '') {
	if (typeof identityPublicKey === 'string' && typeof signingPublicKey === 'string' && identityPublicKey.trim() && signingPublicKey.trim()) {
		return computeDeviceFingerprint(identityPublicKey, signingPublicKey);
	}

	return typeof fallbackFingerprint === 'string' ? fallbackFingerprint : '';
}

module.exports = {
	computeDeviceFingerprint,
	deriveStoredOrComputedFingerprint,
};
