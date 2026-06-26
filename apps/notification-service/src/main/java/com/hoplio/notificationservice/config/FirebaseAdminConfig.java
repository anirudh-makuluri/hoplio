package com.hoplio.notificationservice.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
public class FirebaseAdminConfig {

	@Value("${FIREBASE_SERVICE_ACCOUNT_JSON:}")
	private String firebaseServiceAccountJson;

	@Value("${TYPE:service_account}")
	private String type;

	@Value("${PROJECT_ID:}")
	private String projectId;

	@Value("${PRIVATE_KEY_ID:}")
	private String privateKeyId;

	@Value("${PRIVATE_KEY:}")
	private String privateKey;

	@Value("${CLIENT_EMAIL:}")
	private String clientEmail;

	@Value("${CLIENT_ID:}")
	private String clientId;

	@Value("${AUTH_URI:https://accounts.google.com/o/oauth2/auth}")
	private String authUri;

	@Value("${TOKEN_URI:https://oauth2.googleapis.com/token}")
	private String tokenUri;

	@Value("${AUTH_PROVIDER_X509_CERT_URL:https://www.googleapis.com/oauth2/v1/certs}")
	private String authProviderX509CertUrl;

	@Value("${CLIENT_X509_CERT_URL:}")
	private String clientX509CertUrl;

	@Value("${UNIVERSE_DOMAIN:googleapis.com}")
	private String universeDomain;

	@Bean
	public FirebaseApp firebaseApp(ObjectMapper objectMapper) throws IOException {
		if (!FirebaseApp.getApps().isEmpty()) {
			return FirebaseApp.getInstance();
		}

		GoogleCredentials credentials = loadCredentials(objectMapper);
		FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder().setCredentials(credentials);

		if (!projectId.isBlank()) {
			optionsBuilder.setProjectId(projectId);
		}

		return FirebaseApp.initializeApp(optionsBuilder.build());
	}

	@Bean
	public Firestore firestore(FirebaseApp firebaseApp) {
		return FirestoreClient.getFirestore(firebaseApp);
	}

	@Bean
	public FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
		return FirebaseMessaging.getInstance(firebaseApp);
	}

	@Bean
	public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
		return FirebaseAuth.getInstance(firebaseApp);
	}

	private GoogleCredentials loadCredentials(ObjectMapper objectMapper) throws IOException {
		String normalizedJson = normalizeServiceAccountJson(firebaseServiceAccountJson);
		if (!normalizedJson.isBlank()) {
			return GoogleCredentials.fromStream(
				new ByteArrayInputStream(normalizedJson.getBytes(StandardCharsets.UTF_8))
			);
		}

		Map<String, Object> serviceAccount = new LinkedHashMap<>();
		serviceAccount.put("type", type);
		serviceAccount.put("project_id", projectId);
		serviceAccount.put("private_key_id", privateKeyId);
		serviceAccount.put("private_key", normalizePrivateKey(privateKey));
		serviceAccount.put("client_email", clientEmail);
		serviceAccount.put("client_id", clientId);
		serviceAccount.put("auth_uri", authUri);
		serviceAccount.put("token_uri", tokenUri);
		serviceAccount.put("auth_provider_x509_cert_url", authProviderX509CertUrl);
		serviceAccount.put("client_x509_cert_url", clientX509CertUrl);
		serviceAccount.put("universe_domain", universeDomain);

		String serviceAccountJson = objectMapper.writeValueAsString(serviceAccount);
		return GoogleCredentials.fromStream(
			new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8))
		);
	}

	static String normalizeServiceAccountJson(String value) {
		String normalized = stripWrappingQuotes(value);
		if (normalized.isBlank()) {
			return normalized;
		}

		return normalized.replace("\\n", "\n");
	}

	static String normalizePrivateKey(String value) {
		String normalized = stripWrappingQuotes(value).replace("\\n", "\n").trim();
		if (normalized.isBlank()) {
			return normalized;
		}

		normalized = normalized.replace("\r\n", "\n");
		if (normalized.contains("BEGIN PRIVATE KEY")) {
			return normalized;
		}

		return "-----BEGIN PRIVATE KEY-----\n" + normalized + "\n-----END PRIVATE KEY-----\n";
	}

	private static String stripWrappingQuotes(String value) {
		if (value == null) {
			return "";
		}

		String normalized = value.trim();
		if (normalized.length() >= 2) {
			char first = normalized.charAt(0);
			char last = normalized.charAt(normalized.length() - 1);
			if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
				return normalized.substring(1, normalized.length() - 1).trim();
			}
		}

		return normalized;
	}
}
