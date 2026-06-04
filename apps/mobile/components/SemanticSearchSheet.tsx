import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import {
  Portal,
  Dialog,
  Button,
  TextInput,
  Text,
  ActivityIndicator,
  useTheme,
} from "react-native-paper";
import { semanticSearch } from "~/lib/semanticSearch";
import type { SemanticSearchResult } from "~/lib/types";

interface SemanticSearchSheetProps {
  roomId: string;
  visible: boolean;
  onClose: () => void;
}

export default function SemanticSearchSheet({
  roomId,
  visible,
  onClose,
}: SemanticSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const theme = useTheme();

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setLoading(true);
    setResults([]);
    setErrorMessage("");
    setHasSearched(true);

    try {
      const response = await semanticSearch(roomId, trimmedQuery);
      if (response.success && response.results) {
        setResults(response.results);
        if (response.results.length === 0) {
          setErrorMessage(response.message || "No matching messages found.");
        }
      } else {
        setErrorMessage(response.error || "Search failed. Please try again.");
      }
    } catch (error) {
      setErrorMessage("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose}>
        <Dialog.Title>Search by meaning</Dialog.Title>
        <Dialog.Content>
          <Text
            variant="bodySmall"
            style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}
          >
            Find messages by topic, not just exact words.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TextInput
              mode="outlined"
              placeholder="e.g. dinner plans"
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1 }}
              onSubmitEditing={handleSearch}
            />
            <Button
              mode="contained"
              onPress={handleSearch}
              disabled={loading || !query.trim()}
              loading={loading}
            >
              <Text style={{ color: "#fff" }}>Search</Text>
            </Button>
          </View>

          {loading && (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" />
            </View>
          )}

          {!loading && results.length > 0 && (
            <ScrollView
              style={{ maxHeight: 280 }}
              showsVerticalScrollIndicator={false}
            >
              {results.map((result, index) => (
                <TouchableOpacity
                  key={`${result.message.id}-${index}`}
                  onPress={onClose}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.surfaceVariant,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {result.message.userName}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <Text variant="bodyMedium" numberOfLines={2}>
                    {result.message.chatInfo}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {!loading && hasSearched && errorMessage.length > 0 && (
            <View
              style={{
                borderRadius: 12,
                padding: 12,
                backgroundColor: theme.colors.surfaceVariant,
              }}
            >
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {errorMessage}
              </Text>
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
