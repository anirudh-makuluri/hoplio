import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import {
  Portal,
  Dialog,
  TextInput,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { semanticSearch } from "~/lib/semanticSearch";
import type { SemanticSearchResult } from "~/lib/types";
import { useTheme } from "~/lib/themeContext";
import { AppButton } from "~/components/ui";
import { hapticError, hapticLight, hapticMedium, hapticSuccess } from "~/lib/haptics";

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
  const { colors } = useTheme();

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    void hapticMedium();

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
        } else {
          void hapticSuccess();
        }
      } else {
        void hapticError();
        setErrorMessage(response.error || "Search failed. Please try again.");
      }
    } catch (error) {
      void hapticError();
      setErrorMessage("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={{ backgroundColor: colors.surface }}>
        <Dialog.Title style={{ color: colors.text, fontWeight: "800" }}>Search by meaning</Dialog.Title>
        <Dialog.Content>
          <Text
            variant="bodySmall"
            style={{ marginBottom: 8, color: colors.textSecondary }}
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
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              theme={{ colors: { onSurfaceVariant: colors.textSecondary } }}
            />
            <AppButton
              onPress={handleSearch}
              disabled={loading || !query.trim()}
              loading={loading}
              compact
            >
              Search
            </AppButton>
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
                  onPressIn={() => void hapticLight()}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
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
                      style={{ color: colors.textSecondary }}
                    >
                      {result.message.userName}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textSecondary }}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <Text variant="bodyMedium" numberOfLines={2} style={{ color: colors.text }}>
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
                backgroundColor: colors.muted,
              }}
            >
              <Text
                variant="bodySmall"
                style={{ color: colors.textSecondary }}
              >
                {errorMessage}
              </Text>
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <AppButton variant="ghost" compact onPress={onClose}>Close</AppButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
