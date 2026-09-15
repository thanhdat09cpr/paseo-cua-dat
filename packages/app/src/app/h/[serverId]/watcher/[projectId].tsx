import { useLocalSearchParams } from "expo-router";
import { HostRouteBootstrapBoundary } from "@/components/host-route-bootstrap-boundary";
import { WatcherReportScreen } from "@/screens/watcher-report-screen";

export default function HostWatcherRoute() {
  const params = useLocalSearchParams<{ serverId?: string; projectId?: string }>();
  const serverId = typeof params.serverId === "string" ? params.serverId : "";
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  return (
    <HostRouteBootstrapBoundary>
      <WatcherReportScreen
        key={`${serverId}:${projectId}`}
        serverId={serverId}
        projectId={projectId}
      />
    </HostRouteBootstrapBoundary>
  );
}
