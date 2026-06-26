package com.hoplio.notificationservice.controller;

import com.google.firebase.auth.FirebaseToken;
import com.hoplio.notificationservice.auth.AuthService;
import com.hoplio.notificationservice.model.DeviceRegistrationRequest;
import com.hoplio.notificationservice.service.DeviceRegistryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/devices")
public class DeviceRegistrationController {

	private final AuthService authService;
	private final DeviceRegistryService deviceRegistryService;

	public DeviceRegistrationController(AuthService authService, DeviceRegistryService deviceRegistryService) {
		this.authService = authService;
		this.deviceRegistryService = deviceRegistryService;
	}

	@PostMapping("/register")
	public ResponseEntity<Map<String, Object>> registerDevice(
		@RequestHeader("Authorization") String authorizationHeader,
		@Valid @RequestBody DeviceRegistrationRequest request
	) throws Exception {
		FirebaseToken firebaseToken = authService.verifyUserBearerToken(authorizationHeader);
		return ResponseEntity.ok(deviceRegistryService.registerDevice(firebaseToken, request));
	}

	@DeleteMapping("/{deviceId}")
	public ResponseEntity<Map<String, Object>> unregisterDevice(
		@RequestHeader("Authorization") String authorizationHeader,
		@PathVariable String deviceId
	) throws Exception {
		FirebaseToken firebaseToken = authService.verifyUserBearerToken(authorizationHeader);
		return ResponseEntity.ok(deviceRegistryService.unregisterDevice(firebaseToken, deviceId));
	}
}
