package com.hoplio.notificationservice.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.hoplio.notificationservice.model.NotificationDispatchRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class NotificationDispatchService {

	private final Firestore firestore;
	private final FirebaseMessaging firebaseMessaging;
	private final DeviceRegistryService deviceRegistryService;

	public NotificationDispatchService(
		Firestore firestore,
		FirebaseMessaging firebaseMessaging,
		DeviceRegistryService deviceRegistryService
	) {
		this.firestore = firestore;
		this.firebaseMessaging = firebaseMessaging;
		this.deviceRegistryService = deviceRegistryService;
	}

	public Map<String, Object> dispatch(NotificationDispatchRequest request) throws Exception {
		int sentCount = 0;
		int skippedCount = 0;
		int failedCount = 0;
		List<Map<String, Object>> deliveries = new ArrayList<>();
		System.out.println("Dispatching to users");

		for (String recipientUserId : request.getRecipientUserIds()) {
			System.out.println(recipientUserId);
			List<QueryDocumentSnapshot> devices = deviceRegistryService.getRegisteredDevices(recipientUserId);
			List<String> deliveredViaWsDeviceIds = normalizeDeliveredDeviceIds(request.getDeliveredViaWs(), recipientUserId);

			for (QueryDocumentSnapshot device : devices) {
				String deviceId = valueOrEmpty(device.getString("deviceId"));
				String fcmToken = valueOrEmpty(device.getString("fcmToken"));
				boolean notificationsEnabled = !Boolean.FALSE.equals(device.getBoolean("notificationsEnabled"));

				if (deviceId.isBlank()) {
					skippedCount++;
					deliveries.add(recordDelivery(request, recipientUserId, "", "SKIPPED", "missing-device-id", null));
					continue;
				}

				if (!notificationsEnabled) {
					skippedCount++;
					deliveries.add(recordDelivery(request, recipientUserId, deviceId, "SKIPPED", "notifications-disabled", null));
					continue;
				}

				if (deliveredViaWsDeviceIds.contains(deviceId)) {
					skippedCount++;
					deliveries.add(recordDelivery(request, recipientUserId, deviceId, "SKIPPED", "delivered-via-websocket", null));
					continue;
				}

				if (fcmToken.isBlank()) {
					skippedCount++;
					deliveries.add(recordDelivery(request, recipientUserId, deviceId, "SKIPPED", "missing-fcm-token", null));
					continue;
				}

				try {
					String providerMessageId = firebaseMessaging.send(
						buildFirebaseMessage(request, recipientUserId, deviceId, fcmToken)
					);

					sentCount++;
					deliveries.add(recordDelivery(request, recipientUserId, deviceId, "SENT", null, providerMessageId));
				} catch (FirebaseMessagingException exception) {
					failedCount++;

					if (exception.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
						deviceRegistryService.deleteDevice(recipientUserId, deviceId);
					}

					deliveries.add(recordDelivery(
						request,
						recipientUserId,
						deviceId,
						"FAILED",
						exception.getMessagingErrorCode() == null ? exception.getMessage() : exception.getMessagingErrorCode().name(),
						null
					));
				}
			}
		}

		return Map.of(
			"success", true,
			"messageId", request.getMessageId(),
			"sent", sentCount,
			"skipped", skippedCount,
			"failed", failedCount,
			"deliveries", deliveries
		);
	}

	private Message buildFirebaseMessage(
		NotificationDispatchRequest request,
		String recipientUserId,
		String deviceId,
		String fcmToken
	) {
		Map<String, String> data = new HashMap<>();
		data.put("type", "CHAT_MESSAGE");
		data.put("messageId", request.getMessageId());
		data.put("roomId", request.getRoomId());
		data.put("senderUserId", request.getSenderUserId());
		data.put("recipientUserId", recipientUserId);
		data.put("deviceId", deviceId);
		data.put("isEncrypted", Boolean.toString(request.isEncrypted()));
		data.put("isGroup", Boolean.toString(request.isGroup()));

		return Message.builder()
			.setToken(fcmToken)
			.setNotification(Notification.builder()
				.setTitle(buildNotificationTitle(request))
				.setBody(buildNotificationBody(request))
				.build())
			.putAllData(data)
			.setAndroidConfig(AndroidConfig.builder()
				.setPriority(AndroidConfig.Priority.HIGH)
				.build())
			.build();
	}

	private String buildNotificationTitle(NotificationDispatchRequest request) {
		if (request.isGroup()) {
			String roomName = valueOrEmpty(request.getRoomName());
			return roomName.isBlank() ? request.getSenderName() : roomName;
		}

		return request.getSenderName();
	}

	private String buildNotificationBody(NotificationDispatchRequest request) {
		if (request.isEncrypted()) {
			return request.isGroup()
				? request.getSenderName() + " sent an encrypted message"
				: "Sent an encrypted message";
		}

		if (!"text".equalsIgnoreCase(request.getType())) {
			return request.isGroup()
				? request.getSenderName() + " sent an attachment"
				: "Sent an attachment";
		}

		String preview = valueOrEmpty(request.getPlaintextPreview());
		if (preview.isBlank()) {
			return request.isGroup()
				? request.getSenderName() + " sent a message"
				: "New message";
		}

		return request.isGroup() ? request.getSenderName() + ": " + preview : preview;
	}

	private List<String> normalizeDeliveredDeviceIds(Map<String, List<String>> deliveredViaWs, String recipientUserId) {
		if (deliveredViaWs == null || deliveredViaWs.isEmpty()) {
			return List.of();
		}

		List<String> deviceIds = deliveredViaWs.get(recipientUserId);
		if (deviceIds == null || deviceIds.isEmpty()) {
			return List.of();
		}

		return deviceIds.stream()
			.filter(Objects::nonNull)
			.map(String::trim)
			.filter(value -> !value.isBlank())
			.toList();
	}

	private Map<String, Object> recordDelivery(
		NotificationDispatchRequest request,
		String recipientUserId,
		String deviceId,
		String status,
		String reason,
		String providerMessageId
	) throws Exception {
		Timestamp now = Timestamp.now();
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("messageId", request.getMessageId());
		payload.put("roomId", request.getRoomId());
		payload.put("senderUserId", request.getSenderUserId());
		payload.put("recipientUserId", recipientUserId);
		payload.put("deviceId", deviceId);
		payload.put("status", status);
		payload.put("reason", reason);
		payload.put("provider", "fcm");
		payload.put("providerMessageId", providerMessageId);
		payload.put("isEncrypted", request.isEncrypted());
		payload.put("type", request.getType());
		payload.put("updatedAt", now);

		DocumentReference deliveryRef = firestore.collection("notification_deliveries")
			.document(request.getMessageId() + "__" + recipientUserId + "__" + deviceId);
		if (!deliveryRef.get().get().exists()) {
			payload.put("createdAt", now);
		}
		deliveryRef.set(payload, com.google.cloud.firestore.SetOptions.merge()).get();
		return payload;
	}

	private String valueOrEmpty(String value) {
		return value == null ? "" : value.trim();
	}
}
