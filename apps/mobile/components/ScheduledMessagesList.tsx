import React, { useEffect, useState } from "react";
import { View, ScrollView, Alert, Platform } from "react-native";
import {
  Card,
  Text,
  Button,
  IconButton,
  Chip,
  Portal,
  Dialog,
  TextInput,
  useTheme,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppDispatch, useAppSelector } from "~/redux/store";
import {
  getScheduledMessages,
  updateScheduledMessage,
  deleteScheduledMessage,
} from "~/redux/socketSlice";
import { ScheduledMessage } from "~/lib/types";
import { useUser } from "~/app/providers";

interface ScheduledMessagesListProps {
  roomId: string;
  visible: boolean;
  onClose: () => void;
}

export default function ScheduledMessagesList({
  roomId,
  visible,
  onClose,
}: ScheduledMessagesListProps) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { user } = useUser();
  const { scheduledMessages } = useAppSelector(
    (state) => state.scheduledMessages,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(
    null,
  );
  const [editText, setEditText] = useState("");
  const [editDateTime, setEditDateTime] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);

  const roomScheduledMessages = scheduledMessages[roomId] || [];

  useEffect(() => {
    if (visible && user) {
      loadScheduledMessages();
    }
  }, [visible, roomId, user]);

  const loadScheduledMessages = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      dispatch(getScheduledMessages(user.uid, roomId));
    } catch (error) {
      console.error("Error loading scheduled messages:", error);
      Alert.alert("Error", "Failed to load scheduled messages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setEditText(message.message);
    setEditDateTime(new Date(message.scheduledTime));
  };

  const handleUpdate = async () => {
    if (!editingMessage || !user) return;

    if (!editText.trim()) {
      Alert.alert("Error", "Please enter a message");
      return;
    }

    if (editDateTime <= new Date()) {
      Alert.alert("Error", "Scheduled time must be in the future");
      return;
    }

    try {
      dispatch(
        updateScheduledMessage(editingMessage.id, user.uid, {
          message: editText.trim(),
          scheduledTime: editDateTime.toISOString(),
          timezone: editingMessage.timezone,
        }),
      );

      setEditingMessage(null);
      setEditText("");
      setEditDateTime(new Date());
      setShowEditDatePicker(false);
      setShowEditTimePicker(false);
      loadScheduledMessages();
    } catch (error) {
      console.error("Error updating scheduled message:", error);
      Alert.alert("Error", "Failed to update scheduled message");
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!user) return;

    Alert.alert(
      "Delete Scheduled Message",
      "Are you sure you want to delete this scheduled message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              dispatch(deleteScheduledMessage(messageId, user.uid));
              loadScheduledMessages();
            } catch (error) {
              console.error("Error deleting scheduled message:", error);
              Alert.alert("Error", "Failed to delete scheduled message");
            }
          },
        },
      ],
    );
  };

  const formatScheduledTime = (scheduledTime: Date, timezone: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(scheduledTime));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return theme.colors.primary;
      case "sent":
        return theme.colors.tertiary;
      case "cancelled":
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  };

  const handleEditDateChange = (event: any, selectedDate?: Date) => {
    setShowEditDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      const nextDate = new Date(editDateTime);
      nextDate.setFullYear(selectedDate.getFullYear());
      nextDate.setMonth(selectedDate.getMonth());
      nextDate.setDate(selectedDate.getDate());
      setEditDateTime(nextDate);
    }
  };

  const handleEditTimeChange = (event: any, selectedTime?: Date) => {
    setShowEditTimePicker(Platform.OS === "ios");
    if (selectedTime) {
      const nextDate = new Date(editDateTime);
      nextDate.setHours(selectedTime.getHours());
      nextDate.setMinutes(selectedTime.getMinutes());
      setEditDateTime(nextDate);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onClose}
        style={{ maxHeight: "80%" }}
      >
        <Dialog.Title>Scheduled Messages</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={{ padding: 16 }}>
            {isLoading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text>Loading scheduled messages...</Text>
              </View>
            ) : roomScheduledMessages.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text variant="bodyLarge" style={{ textAlign: "center" }}>
                  No scheduled messages for this room
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {roomScheduledMessages.map((message) => (
                  <Card key={message.id} style={{ marginBottom: 12 }}>
                    <Card.Content>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            variant="bodyMedium"
                            style={{ marginBottom: 8 }}
                          >
                            {message.message}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <Chip
                              mode="outlined"
                              textStyle={{ fontSize: 12 }}
                              style={{
                                backgroundColor:
                                  getStatusColor(message.status) + "20",
                              }}
                            >
                              {message.status}
                            </Chip>
                            {message.recurring && (
                              <Chip
                                mode="outlined"
                                textStyle={{ fontSize: 12 }}
                              >
                                {message.recurringPattern}
                              </Chip>
                            )}
                          </View>
                          <Text
                            variant="bodySmall"
                            style={{
                              color: theme.colors.onSurfaceVariant,
                              marginBottom: 4,
                            }}
                          >
                            {formatScheduledTime(
                              message.scheduledTime,
                              message.timezone,
                            )}
                          </Text>
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            Timezone: {message.timezone}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row" }}>
                          <IconButton
                            icon="pencil"
                            size={20}
                            onPress={() => handleEdit(message)}
                          />
                          <IconButton
                            icon="delete"
                            size={20}
                            onPress={() => handleDelete(message.id)}
                          />
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </ScrollView>
            )}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onClose}>Close</Button>
        </Dialog.Actions>
      </Dialog>

      <Dialog
        visible={!!editingMessage}
        onDismiss={() => setEditingMessage(null)}
      >
        <Dialog.Title>Edit Scheduled Message</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 16 }}>
            <TextInput
              label="Message"
              value={editText}
              onChangeText={setEditText}
              multiline
              numberOfLines={3}
            />

            <View style={{ gap: 12 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
                Scheduled Date and Time
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowEditDatePicker(true)}
                    icon="calendar"
                  >
                    {editDateTime.toLocaleDateString()}
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowEditTimePicker(true)}
                    icon="clock"
                  >
                    {editDateTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Button>
                </View>
              </View>
            </View>

            {editingMessage && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Timezone: {editingMessage.timezone}
              </Text>
            )}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setEditingMessage(null)}>Cancel</Button>
          <Button mode="contained" onPress={handleUpdate}>
            Update
          </Button>
        </Dialog.Actions>
      </Dialog>

      {showEditDatePicker && (
        <DateTimePicker
          value={editDateTime}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEditDateChange}
          minimumDate={new Date()}
        />
      )}

      {showEditTimePicker && (
        <DateTimePicker
          value={editDateTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEditTimeChange}
        />
      )}
    </Portal>
  );
}
