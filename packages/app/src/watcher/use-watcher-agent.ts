import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FetchAgentTimelinePayload } from "@getpaseo/client/internal/daemon-client";
import { useHostRuntimeClient } from "@/runtime/host-runtime";
import { useSessionStore } from "@/stores/session-store";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import {
  buildWatcherConversation,
  buildWatcherQuestionPrompt,
  type WatcherConversationMessage,
  type WatcherSourceReport,
} from "./watcher-report-model";
import {
  isProjectWatcher,
  isWatcherGeminiProvider,
  selectWatcherProvider,
  watcherReadOnlyMode,
  watcherLabels,
  WATCHER_SYSTEM_PROMPT,
  type WatcherProviderSelection,
} from "./watcher-agent-config";

export type WatcherAgentStatus = "loading" | "creating" | "ready" | "unavailable" | "error";

interface UseWatcherAgentInput {
  serverId: string;
  projectId: string;
  projectName: string;
  projectRootPath: string | null;
  workspaceId: string | null;
  reports: readonly WatcherSourceReport[];
}

export interface UseWatcherAgentResult {
  agentId: string | null;
  status: WatcherAgentStatus;
  statusMessage: string | null;
  providerModel: string | null;
  messages: WatcherConversationMessage[];
  ask: (question: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useWatcherAgent(input: UseWatcherAgentInput): UseWatcherAgentResult {
  const client = useHostRuntimeClient(input.serverId);
  const session = useSessionStore((state) => state.sessions[input.serverId]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WatcherConversationMessage[]>([]);
  const [status, setStatus] = useState<WatcherAgentStatus>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const creationPromiseRef = useRef<Promise<string> | null>(null);
  const askPromiseRef = useRef<Promise<void> | null>(null);
  const {
    entries: providerSnapshotEntries,
    error: providerError,
    refresh: refreshProviderSnapshot,
  } = useProvidersSnapshot(input.serverId, {
    cwd: input.projectRootPath,
    enabled: Boolean(input.projectRootPath),
  });
  const providerEntries = providerSnapshotEntries ?? null;
  const labeledWatchers = useMemo(
    () =>
      [...(session?.agents.values() ?? [])].filter((agent) =>
        isProjectWatcher(agent, input.projectId),
      ),
    [input.projectId, session?.agents],
  );
  const activeLabeledWatchers = useMemo(
    () => labeledWatchers.filter((agent) => agent.status !== "closed"),
    [labeledWatchers],
  );
  const watcherAgent = useMemo(() => {
    if (!providerEntries) return null;
    const validWatchers = labeledWatchers.filter((agent) => {
      const providerEntry = providerEntries.find((entry) => entry.provider === agent.provider);
      if (
        !providerEntry ||
        !providerEntry.enabled ||
        providerEntry.status !== "ready" ||
        !isWatcherGeminiProvider(providerEntry) ||
        agent.status === "closed" ||
        agent.status === "error"
      ) {
        return false;
      }
      const advertisedModel = providerEntry.models?.some(
        (model) => model.id === agent.model && model.isSelectable !== false,
      );
      const readOnlyMode = watcherReadOnlyMode(providerEntry);
      if (!advertisedModel || !readOnlyMode || agent.currentModeId !== readOnlyMode.id) {
        return false;
      }
      return !input.workspaceId || agent.workspaceId === input.workspaceId;
    });
    return (
      [...validWatchers].sort(
        (left, right) =>
          (Number.isNaN(right.updatedAt.getTime()) ? 0 : right.updatedAt.getTime()) -
          (Number.isNaN(left.updatedAt.getTime()) ? 0 : left.updatedAt.getTime()),
      )[0] ?? null
    );
  }, [input.workspaceId, labeledWatchers, providerEntries]);
  const selection = useMemo(
    () => selectWatcherProvider(providerEntries ?? undefined),
    [providerEntries],
  );

  const fetchConversation = useCallback(
    async (id: string): Promise<FetchAgentTimelinePayload> => {
      if (!client) throw new Error("Host chưa kết nối");
      const payload = await client.fetchAgentTimeline(id, {
        limit: 20,
        projection: "projected",
      });
      setMessages(buildWatcherConversation(payload));
      return payload;
    },
    [client],
  );

  useEffect(() => {
    if (!input.projectRootPath) {
      setStatus("unavailable");
      setStatusMessage("Không xác định được project root; Watcher chưa được khởi tạo.");
      return undefined;
    }
    if (!client) {
      setStatus("unavailable");
      setStatusMessage("Host chưa kết nối; Watcher chưa được khởi tạo.");
      return undefined;
    }
  }, [client, input.projectRootPath]);

  useEffect(() => {
    if (providerError) {
      setStatus("error");
      setStatusMessage(`Không đọc được danh sách provider Gemini: ${providerError}`);
    }
  }, [providerError]);

  useEffect(() => {
    if (watcherAgent && !agentId) {
      setAgentId(watcherAgent.id);
      setStatus("ready");
      setStatusMessage(null);
      void fetchConversation(watcherAgent.id).catch((error) => {
        setStatusMessage(formatError(error));
      });
    }
  }, [agentId, fetchConversation, watcherAgent]);

  useEffect(() => {
    if (providerEntries !== null && activeLabeledWatchers.length > 0 && !watcherAgent) {
      setStatus("error");
      setStatusMessage(
        "Watcher hiện có nhưng provider, workspace hoặc lifecycle không còn hợp lệ; cần kiểm tra trước khi dùng lại.",
      );
      return undefined;
    }
    if (
      !client ||
      !session?.hasHydratedAgents ||
      !input.projectRootPath ||
      providerEntries === null ||
      watcherAgent ||
      activeLabeledWatchers.length > 0 ||
      agentId ||
      creatingRef.current
    ) {
      return undefined;
    }
    if (!selection) {
      setStatus(providerError ? "error" : "unavailable");
      setStatusMessage(
        providerError ??
          "Host chưa quảng cáo provider/model Gemini khả dụng; Watcher chưa được tạo.",
      );
      return undefined;
    }
    if (creationPromiseRef.current) return undefined;
    creatingRef.current = true;
    setStatus("creating");
    setStatusMessage(`Đang khởi tạo ${selection.providerModel} cho project…`);
    const config = {
      provider: selection.provider,
      model: selection.model,
      cwd: input.projectRootPath,
      title: `Watcher · ${input.projectName}`,
      systemPrompt: WATCHER_SYSTEM_PROMPT,
      ...(selection.modeId ? { modeId: selection.modeId } : {}),
    };
    creationPromiseRef.current = client
      .createAgent({
        config,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        labels: watcherLabels(input.projectId),
      })
      .then((agent) => {
        setAgentId(agent.id);
        setStatus("ready");
        setStatusMessage(`Gemini ${selection.model} đã sẵn sàng cho project này.`);
        void fetchConversation(agent.id).catch((error) => {
          setStatusMessage(`Gemini đã sẵn sàng nhưng chưa đọc được lịch sử: ${formatError(error)}`);
        });
        return agent.id;
      })
      .catch((error) => {
        setStatus("error");
        setStatusMessage(formatError(error));
        throw error;
      })
      .finally(() => {
        creatingRef.current = false;
        creationPromiseRef.current = null;
      });
    void creationPromiseRef.current.catch(() => undefined);
    return undefined;
  }, [
    agentId,
    client,
    fetchConversation,
    input.projectId,
    input.projectName,
    input.projectRootPath,
    input.workspaceId,
    providerEntries,
    providerError,
    selection,
    session?.hasHydratedAgents,
    watcherAgent,
    labeledWatchers,
    activeLabeledWatchers,
  ]);

  const refresh = useCallback(async () => {
    if (agentId) {
      await fetchConversation(agentId);
      return;
    }
    if (!client || !input.projectRootPath) return;
    await refreshProviderSnapshot();
    setStatus("loading");
    setStatusMessage(null);
  }, [agentId, client, fetchConversation, input.projectRootPath, refreshProviderSnapshot]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !agentId || !client || askPromiseRef.current) return;
      const pending = (async () => {
        const prompt = buildWatcherQuestionPrompt(trimmed, input.reports);
        setMessages((current) => [
          ...current,
          { id: `pending:${Date.now()}`, from: "human", text: trimmed },
        ]);
        try {
          await client.sendAgentMessage(agentId, prompt);
          await client.waitForFinish(agentId, 90_000);
          await fetchConversation(agentId);
        } catch (error) {
          setStatusMessage(formatError(error));
          throw error;
        }
      })();
      askPromiseRef.current = pending;
      try {
        await pending;
      } finally {
        if (askPromiseRef.current === pending) askPromiseRef.current = null;
      }
    },
    [agentId, client, fetchConversation, input.reports],
  );

  const resolvedSelection: WatcherProviderSelection | null = selection;
  return {
    agentId,
    status,
    statusMessage,
    providerModel: watcherAgent?.model
      ? `${watcherAgent.provider}/${watcherAgent.model}`
      : (resolvedSelection?.providerModel ?? watcherAgent?.provider ?? null),
    messages,
    ask,
    refresh,
  };
}
