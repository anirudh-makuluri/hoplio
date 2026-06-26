package com.hoplio.notificationservice.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FirebaseAdminConfigTest {

	@Test
	void normalizePrivateKeyStripsWrappingQuotesAndRestoresPemNewlines() {
		String rawValue = "\"MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC\\nLINE_TWO\\nLINE_THREE\"";

		String normalized = FirebaseAdminConfig.normalizePrivateKey(rawValue);

		assertEquals(
			"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC\nLINE_TWO\nLINE_THREE\n-----END PRIVATE KEY-----\n",
			normalized
		);
	}

	@Test
	void normalizePrivateKeyLeavesExistingPemUntouchedAfterQuoteRemoval() {
		String rawValue = "\"-----BEGIN PRIVATE KEY-----\\nLINE_ONE\\n-----END PRIVATE KEY-----\\n\"";

		String normalized = FirebaseAdminConfig.normalizePrivateKey(rawValue);

		assertEquals("-----BEGIN PRIVATE KEY-----\nLINE_ONE\n-----END PRIVATE KEY-----", normalized);
	}
}
