import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import { EditingTextInput } from "@/components/ui/text-input";
import type { EditingTextInputHandle } from "@/components/ui/text-input";
import type { UseWatcherAgentResult } from "./use-watcher-agent";

export function WatcherChatPanel({ watcher }: { watcher: UseWatcherAgentResult }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const questionInput = useRef<EditingTextInputHandle>(null);
  const handleAsk = useCallback(async () => {
    const text = question.trim();
    if (!text || asking || watcher.status !== "ready") return;
    setQuestion("");
    questionInput.current?.replaceText("");
    setAsking(true);
    try {
      await watcher.ask(text);
    } catch {
      // The hook exposes the provider error in the status line.
    } finally {
      setAsking(false);
    }
  }, [asking, question, watcher]);

  return (
    <View style={styles.chatCard}>
      <Text style={styles.sectionTitle}>Ask Watcher</Text>
      <Text style={styles.muted}>
        Đây là phiên Gemini riêng của project. Câu trả lời dùng snapshot bounded và chỉ để
        Supervisor/Lead kiểm tra, không phải acceptance hay command.
      </Text>
      {watcher.messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.message,
            message.from === "human" ? styles.humanMessage : styles.watcherMessage,
          ]}
        >
          <Text style={styles.messageLabel}>{message.from === "human" ? "Human" : "Watcher"}</Text>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      ))}
      <View style={styles.composer}>
        <EditingTextInput
          ref={questionInput}
          initialValue=""
          onChangeText={setQuestion}
          onSubmitEditing={handleAsk}
          placeholder="Hỏi tình hình project…"
          placeholderTextColor={styles.placeholder.color}
          style={styles.input}
          returnKeyType="send"
          editable={watcher.status === "ready" && !asking}
        />
        <Pressable
          onPress={handleAsk}
          style={[styles.send, (watcher.status !== "ready" || asking) && styles.sendDisabled]}
          disabled={watcher.status !== "ready" || asking}
          accessibilityRole="button"
          testID="watcher-ask"
        >
          <Send size={16} color={styles.sendIcon.color} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  muted: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
  chatCard: {
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface1,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  message: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[2],
    gap: theme.spacing[1],
  },
  humanMessage: { backgroundColor: theme.colors.surface2, alignSelf: "flex-end", maxWidth: "90%" },
  watcherMessage: {
    backgroundColor: `${theme.colors.accent}14`,
    alignSelf: "flex-start",
    maxWidth: "95%",
  },
  messageLabel: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  messageText: { color: theme.colors.foreground, fontSize: theme.fontSize.sm },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingLeft: theme.spacing[2],
  },
  input: { flex: 1, minHeight: 38, color: theme.colors.foreground, fontSize: theme.fontSize.sm },
  placeholder: { color: theme.colors.foregroundMuted },
  send: { padding: theme.spacing[2] },
  sendDisabled: { opacity: 0.45 },
  sendIcon: { color: theme.colors.accent },
}));
