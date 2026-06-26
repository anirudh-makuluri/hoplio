package com.hoplio.notificationservice.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

public class NotificationDispatchRequest {

	@NotBlank
	private String messageId;

	@NotBlank
	private String roomId;

	@NotBlank
	private String senderUserId;

	@NotBlank
	private String senderName;

	@JsonProperty("isGroup")
	private boolean isGroup;
	private String roomName;

	@NotBlank
	private String type;

	private String plaintextPreview;
	@JsonProperty("isEncrypted")
	private boolean isEncrypted;

	@NotEmpty
	private List<String> recipientUserIds;

	private Map<String, List<String>> deliveredViaWs;

	public String getMessageId() {
		return messageId;
	}

	public void setMessageId(String messageId) {
		this.messageId = messageId;
	}

	public String getRoomId() {
		return roomId;
	}

	public void setRoomId(String roomId) {
		this.roomId = roomId;
	}

	public String getSenderUserId() {
		return senderUserId;
	}

	public void setSenderUserId(String senderUserId) {
		this.senderUserId = senderUserId;
	}

	public String getSenderName() {
		return senderName;
	}

	public void setSenderName(String senderName) {
		this.senderName = senderName;
	}

	public boolean isGroup() {
		return isGroup;
	}

	public void setGroup(boolean group) {
		isGroup = group;
	}

	public String getRoomName() {
		return roomName;
	}

	public void setRoomName(String roomName) {
		this.roomName = roomName;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getPlaintextPreview() {
		return plaintextPreview;
	}

	public void setPlaintextPreview(String plaintextPreview) {
		this.plaintextPreview = plaintextPreview;
	}

	public boolean isEncrypted() {
		return isEncrypted;
	}

	public void setEncrypted(boolean encrypted) {
		isEncrypted = encrypted;
	}

	public List<String> getRecipientUserIds() {
		return recipientUserIds;
	}

	public void setRecipientUserIds(List<String> recipientUserIds) {
		this.recipientUserIds = recipientUserIds;
	}

	public Map<String, List<String>> getDeliveredViaWs() {
		return deliveredViaWs;
	}

	public void setDeliveredViaWs(Map<String, List<String>> deliveredViaWs) {
		this.deliveredViaWs = deliveredViaWs;
	}
}
