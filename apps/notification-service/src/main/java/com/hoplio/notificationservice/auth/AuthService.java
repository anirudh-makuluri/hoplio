package com.hoplio.notificationservice.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

	private final FirebaseAuth firebaseAuth;
	private final String internalToken;

	public AuthService(FirebaseAuth firebaseAuth, @Value("${NOTIFICATION_INTERNAL_TOKEN:}") String internalToken) {
		this.firebaseAuth = firebaseAuth;
		this.internalToken = internalToken == null ? "" : internalToken.trim();
	}

	public FirebaseToken verifyUserBearerToken(String authorizationHeader) {
		String token = extractBearerToken(authorizationHeader);

		try {
			return firebaseAuth.verifyIdToken(token);
		} catch (Exception exception) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Firebase bearer token");
		}
	}

	public void requireInternalToken(String authorizationHeader) {
		if (internalToken.isBlank()) {
			throw new ResponseStatusException(
				HttpStatus.SERVICE_UNAVAILABLE,
				"Notification internal token is not configured"
			);
		}

		String token = extractBearerToken(authorizationHeader);
		if (!internalToken.equals(token)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid internal token");
		}
	}

	private String extractBearerToken(String authorizationHeader) {
		if (authorizationHeader == null || authorizationHeader.isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing Authorization header");
		}

		if (!authorizationHeader.startsWith("Bearer ")) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization header must use Bearer auth");
		}

		String token = authorizationHeader.substring("Bearer ".length()).trim();
		if (token.isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bearer token is empty");
		}

		return token;
	}
}
