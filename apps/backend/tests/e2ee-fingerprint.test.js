const test = require('node:test');
const assert = require('node:assert/strict');

const { computeDeviceFingerprint, deriveStoredOrComputedFingerprint } = require('../helpers/e2ee-fingerprint');

const VALID_IDENTITY_PUBLIC_KEY = Buffer.alloc(32, 1).toString('base64');
const VALID_SIGNING_PUBLIC_KEY = Buffer.alloc(32, 2).toString('base64');
const EXPECTED_FINGERPRINT = '90cc8026f694c2ba1712c25864782a63da8dbe74e4261af4ff4e3d962bc28f2c';

test('computeDeviceFingerprint matches the expected BLAKE2b-256 fingerprint', () => {
	const fingerprint = computeDeviceFingerprint(VALID_IDENTITY_PUBLIC_KEY, VALID_SIGNING_PUBLIC_KEY);

	assert.equal(fingerprint, EXPECTED_FINGERPRINT);
});

test('deriveStoredOrComputedFingerprint prefers the recomputed fingerprint over stale stored data', () => {
	const fingerprint = deriveStoredOrComputedFingerprint(
		VALID_IDENTITY_PUBLIC_KEY,
		VALID_SIGNING_PUBLIC_KEY,
		'stale-fingerprint'
	);

	assert.equal(fingerprint, EXPECTED_FINGERPRINT);
});

test('deriveStoredOrComputedFingerprint falls back when key material is unavailable', () => {
	assert.equal(deriveStoredOrComputedFingerprint('', '', 'stored-fingerprint'), 'stored-fingerprint');
});
