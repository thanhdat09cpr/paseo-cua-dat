import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Eye, RefreshCw } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { MenuHeader } from "@/components/headers/menu-header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useHostRuntimeClient } from "@/runtime/host-runtime";
import { useSessionStore } from "@/stores/session-store";
import { buildWatcherSourceReport, type WatcherSourceReport } from "@/watcher/watcher-report-model";
import { useWatcherAgent } from "@/watcher/use-watcher-agent";
import { WatcherChatPanel } from "@/watcher/watcher-chat-panel";

export function WatcherReportScreen({
  serverId,
  projectId,
}: {
  serverId: string;
  projectId: string;
}) {
  const client = useHostRuntimeClient(serverId);
  const session = useSessionStore((state) => state.sessions[serverId]);
  const [reports, setReports] = useState<WatcherSourceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const project = session?.projects.get(projectId);
  const projectWorkspaceIds = useMemo(
    () =>
      new Set(
        [...(session?.workspaces.values() ?? [])]
          .filter((workspace) => workspace.projectId === projectId)
          .map((workspace) => workspace.id),
      ),
    [projectId, session?.workspaces],
  );
  const agents = useMemo(
    () =>
      [...(session?.agents.values() ?? [])].filter((agent) => {
        const role = agent.roleBinding?.roleId;
        return (
          (role === "lead" || role === "peer") &&
          Boolean(agent.workspaceId && projectWorkspaceIds.has(agent.workspaceId))
        );
      }),
    [projectWorkspaceIds, session?.agents],
  );
  const watcher = useWatcherAgent({
    serverId,
    projectId,
    projectName: project?.projectCustomName ?? project?.projectDisplayName ?? projectId,
    projectRootPath: project?.projectRootPath ?? null,
    workspaceId: [...projectWorkspaceIds][0] ?? null,
    reports,
  });

  useEffect(() => {
    let cancelled = false;
    if (!client || !session?.hasHydratedAgents) return undefined;
    setLoading(true);
    void Promise.all(
      agents.map(async (agent) => {
        const role = agent.roleBinding?.roleId;
        if (role !== "lead" && role !== "peer") return null;
        try {
          const payload = await client.fetchAgentTimeline(agent.id, {
            limit: 20,
            projection: "projected",
          });
          return buildWatcherSourceReport({
            agent: { id: agent.id, title: agent.title, role, status: agent.status },
            payload,
          });
        } catch (error) {
          return buildWatcherSourceReport({
            agent: { id: agent.id, title: agent.title, role, status: agent.status },
            error,
          });
        }
      }),
    )
      .then((next) => {
        if (!cancelled)
          setReports(next.filter((report): report is WatcherSourceReport => report !== null));
        return next;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agents, client, refreshKey, session?.hasHydratedAgents]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
    void watcher.refresh();
  }, [watcher]);
  const projectName = project?.projectCustomName ?? project?.projectDisplayName ?? projectId;

  return (
    <View style={styles.screen} testID="watcher-report-screen">
      <MenuHeader title={`Watcher · ${projectName}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Eye size={22} color={styles.accent.color} />
            <Text style={styles.title}>Project Watcher</Text>
          </View>
          <Text style={styles.muted}>
            Read-only observation of public Lead/Peer activity. Watcher has no governance or write
            authority.
          </Text>
          <Text style={styles.statusLine}>
            {watcher.statusMessage ??
              (watcher.providerModel
                ? `Gemini: ${watcher.providerModel}`
                : "Đang kiểm tra Gemini trên host…")}
          </Text>
          <Pressable
            style={styles.refresh}
            onPress={handleRefresh}
            accessibilityRole="button"
            testID="watcher-refresh"
          >
            <RefreshCw size={15} color={styles.accent.color} />
            <Text style={styles.refreshText}>Refresh bounded report</Text>
          </Pressable>
        </View>
        <WatcherActivityPanel loading={loading} reports={reports} />
        <WatcherChatPanel watcher={watcher} />
      </ScrollView>
    </View>
  );
}

function WatcherActivityPanel({
  loading,
  reports,
}: {
  loading: boolean;
  reports: readonly WatcherSourceReport[];
}) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner size="large" color={styles.muted.color} />
      </View>
    );
  }
  if (reports.length === 0) {
    return (
      <View style={styles.empty}>
        <Activity size={22} color={styles.muted.color} />
        <Text style={styles.emptyTitle}>No Lead/Peer activity found</Text>
        <Text style={styles.muted}>
          This is bounded coverage, not proof that the project is healthy.
        </Text>
      </View>
    );
  }
  return (
    <>
      {reports.map((report) => (
        <View key={report.agentId} style={styles.sourceCard}>
          <View style={styles.sourceTitle}>
            <Text style={styles.role}>{report.role.toUpperCase()}</Text>
            <Text style={styles.sourceName}>{report.title}</Text>
            <Text style={styles.status}>{report.status}</Text>
          </View>
          {report.error ? <Text style={styles.error}>{report.error}</Text> : null}
          {report.entries.slice(-8).map((entry) => (
            <View key={entry.sourceRef} style={styles.entry}>
              <Text style={styles.entryMeta}>
                {entry.kind} · {entry.sourceRef}
              </Text>
              <Text style={styles.entryText}>{entry.text}</Text>
            </View>
          ))}
          <Text style={styles.coverage}>
            Coverage: {report.coverage.returnedEntries} public / {report.coverage.returnedRows}{" "}
            returned rows
            {report.coverage.truncated ? " · partial" : ""}
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.surface0 },
  content: { padding: theme.spacing[4], gap: theme.spacing[4] },
  centered: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  headerCard: {
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface1,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
  },
  muted: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
  statusLine: { color: theme.colors.accent, fontSize: theme.fontSize.xs },
  accent: { color: theme.colors.accent },
  refresh: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[1],
  },
  refreshText: { color: theme.colors.accent, fontSize: theme.fontSize.xs },
  sourceCard: {
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface1,
  },
  sourceTitle: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  role: { color: theme.colors.accent, fontSize: theme.fontSize.xs },
  sourceName: { flex: 1, color: theme.colors.foreground, fontSize: theme.fontSize.base },
  status: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  entry: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing[2],
    gap: theme.spacing[1],
  },
  entryMeta: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  entryText: { color: theme.colors.foreground, fontSize: theme.fontSize.sm },
  coverage: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  error: { color: theme.colors.statusWarning, fontSize: theme.fontSize.xs },
  empty: { alignItems: "center", gap: theme.spacing[2], padding: theme.spacing[6] },
  emptyTitle: { color: theme.colors.foreground, fontSize: theme.fontSize.base },
}));
