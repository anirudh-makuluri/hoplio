package com.hoplio.notificationservice.controller;

import com.hoplio.notificationservice.auth.AuthService;
import com.hoplio.notificationservice.model.NotificationDispatchRequest;
import com.hoplio.notificationservice.service.NotificationDispatchService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/internal")
public class InternalDispatchController {

	private final AuthService authService;
	private final NotificationDispatchService notificationDispatchService;

	public InternalDispatchController(
		AuthService authService,
		NotificationDispatchService notificationDispatchService
	) {
		this.authService = authService;
		this.notificationDispatchService = notificationDispatchService;
	}

	@PostMapping("/dispatch")
	public ResponseEntity<Map<String, Object>> dispatchNotification(
		@RequestHeader("Authorization") String authorizationHeader,
		@Valid @RequestBody NotificationDispatchRequest request
	) throws Exception {
		authService.requireInternalToken(authorizationHeader);
		return ResponseEntity.ok(notificationDispatchService.dispatch(request));
	}
}
