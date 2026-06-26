package com.hoplio.notificationservice.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteBatch;
import com.google.firebase.auth.FirebaseToken;
import com.hoplio.notificationservice.model.DeviceRegistrationRequest;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeviceRegistryService {

	private final Firestore firestore;

	public DeviceRegistryService(Firestore firestore) {
		this.firestore = firestore;
	}

	public Map<String, Object> registerDevice(FirebaseToken firebaseToken, DeviceRegistrationRequest request) throws Exception {
		String userId = firebaseToken.getUid();
		String deviceId = request.getDeviceId().trim();

		cleanupDeviceRegistrationsForOtherUsers(userId, deviceId);

		DocumentReference deviceRef = getUserDevicesCollection(userId).document(deviceId);
		DocumentSnapshot existingDevice = deviceRef.get().get();
		Timestamp now = Timestamp.now();

		Map<String, Object> payload = new HashMap<>();
		payload.put("userId", userId);
		payload.put("deviceId", deviceId);
		payload.put("fcmToken", request.getFcmToken().trim());
		payload.put("platform", request.getPlatform().trim().toLowerCase());
		payload.put("deviceName", normalizeDeviceName(request.getDeviceName()));
		payload.put("notificationsEnabled", request.getNotificationsEnabled() == null || request.getNotificationsEnabled());
		payload.put("pushProvider", "fcm");
		payload.put("updatedAt", now);
		payload.put("lastSeenAt", now);
		payload.put("lastTokenRefreshAt", now);

		if (!existingDevice.exists()) {
			payload.put("createdAt", now);
		}

		deviceRef.set(payload, com.google.cloud.firestore.SetOptions.merge()).get();

		return Map.of(
			"success", true,
			"userId", userId,
			"deviceId", deviceId
		);
	}

	public Map<String, Object> unregisterDevice(FirebaseToken firebaseToken, String deviceId) throws Exception {
		String userId = firebaseToken.getUid();
		getUserDevicesCollection(userId).document(deviceId).delete().get();

		return Map.of(
			"success", true,
			"userId", userId,
			"deviceId", deviceId
		);
	}

	public List<QueryDocumentSnapshot> getRegisteredDevices(String userId) throws Exception {
		return getUserDevicesCollection(userId).get().get().getDocuments();
	}

	public void deleteDevice(String userId, String deviceId) throws Exception {
		getUserDevicesCollection(userId).document(deviceId).delete().get();
	}

	private CollectionReference getUserDevicesCollection(String userId) {
		return firestore.collection("auth_users").document(userId).collection("devices");
	}

	private void cleanupDeviceRegistrationsForOtherUsers(String currentUserId, String deviceId) throws Exception {
		QuerySnapshot existingRegistrations = firestore.collectionGroup("devices")
			.whereEqualTo("deviceId", deviceId)
			.get()
			.get();

		if (existingRegistrations.isEmpty()) {
			return;
		}

		WriteBatch batch = firestore.batch();
		boolean hasDeletes = false;

		for (QueryDocumentSnapshot document : existingRegistrations.getDocuments()) {
			String registeredUserId = document.getString("userId");
			if (registeredUserId == null || registeredUserId.equals(currentUserId)) {
				continue;
			}

			batch.delete(document.getReference());
			hasDeletes = true;
		}

		if (hasDeletes) {
			batch.commit().get();
		}
	}

	private String normalizeDeviceName(String deviceName) {
		if (deviceName == null || deviceName.isBlank()) {
			return "Android Device";
		}

		return deviceName.trim();
	}
}
