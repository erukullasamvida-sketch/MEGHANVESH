import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BellRing, Check, Radio, TriangleAlert } from "lucide-react";

import { AppShell, EmptyRow, KpiCard, SectionCard } from "@/components/app-shell";
import { MapPanel } from "@/components/map/map-panel";
import { SeverityBadge, StationStatusBadge } from "@/components/aws-status-badge";
import { Button } from "@/components/ui/button";
import { getAllAWSAnomalies, getAWSStationSnapshots } from "@/lib/api/aws";
import { useProfile } from "@/hooks/use-profile";
import { useStationSelection } from "@/hooks/use-station-selection";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { overlayDemoSnapshot } from "@/lib/demo-anomaly";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content:
          "Automatic weather station status, current sensor observations, and explainable anomaly results.",
      },
      { property: "og:title", content: "MEGHANVESH | AWS Monitoring Dashboard" },
      {
        property: "og:description",
        content: "Monitor AWS stations, observations, and sensor anomalies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();
  const { selectStation } = useStationSelection();
  const { demoActive, demoStationId, demoScenario, demoStartedAt } = useDemoMode();
  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });
  const { data: anomalies = [] } = useQuery({
    queryKey: ["aws_anomalies"],
    queryFn: getAllAWSAnomalies,
    refetchInterval: 15_000,
  });
  const displayStations = demoActive
    ? stations.map((snapshot) =>
        snapshot.station.station_id === demoStationId
          ? overlayDemoSnapshot(snapshot, demoScenario, demoStartedAt)
          : snapshot,
      )
    : stations;

  const countStatus = (status: string) => displayStations.filter((station) => station.status === status).length;
  const stationNames = new Map(stations.map(({ station }) => [station.station_id, station.name]));
  const recentAnomalies = anomalies.slice(0, 5);

  return (
    <AppShell
      title="AWS Monitoring Dashboard"
      subtitle={`Station observations and anomaly status${profile?.name ? ` · ${profile.name}` : ""}`}
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total AWS Stations" value={stations.length} icon={Radio} />
        <KpiCard label="Healthy Stations" value={countStatus("HEALTHY")} icon={Check} tone="healthy" />
        <KpiCard label="Anomalous Stations" value={countStatus("ANOMALOUS")} icon={Activity} tone="anomalous" />
        <KpiCard label="Warning Stations" value={countStatus("WARNING")} icon={TriangleAlert} tone="warning" />
        <KpiCard label="Offline Stations" value={countStatus("OFFLINE")} icon={AlertTriangle} tone="offline" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_minmax(0,1fr)]">
        <SectionCard
          title="Live AWS Monitoring"
          description={demoActive ? "Selected station overlay is simulated; all other stations show backend status" : "Station positions and current backend status"}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/risk-map">Open station map</Link>
            </Button>
          }
        >
          {error ? (
            <EmptyRow>Could not load AWS stations. Check the backend connection.</EmptyRow>
          ) : isLoading ? (
            <EmptyRow>Loading AWS stations…</EmptyRow>
          ) : stations.length === 0 ? (
            <EmptyRow>No AWS stations are available.</EmptyRow>
          ) : (
            <MapPanel
              stations={displayStations}
              height={360}
              compact
              onSelectStation={selectStation}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recent Sensor Anomalies"
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link to="/alerts">View all</Link>
            </Button>
          }
        >
          {recentAnomalies.length === 0 ? (
            <EmptyRow>No anomalies are currently returned by the backend.</EmptyRow>
          ) : (
            <ul className="space-y-3">
              {recentAnomalies.map((anomaly) => (
                <li key={anomaly.observation_id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {stationNames.get(anomaly.station_id) ?? anomaly.station_id}
                    </p>
                    <SeverityBadge severity={anomaly.severity} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">{anomaly.anomaly_type}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {anomaly.reasons[0]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard className="mt-4" title="Station Readings" description="Latest available observation per station">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Station</th>
                <th className="pb-2 pr-3 font-medium">Station ID</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Temperature</th>
                <th className="pb-2 pr-3 font-medium">Pressure</th>
                <th className="pb-2 pr-3 font-medium">Humidity</th>
                <th className="pb-2 pr-3 font-medium">Last Seen</th>
                <th className="pb-2 font-medium">Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {displayStations.map(({ station, status, latestObservation, anomalyCount, demo }) => (
                <tr key={station.station_id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    {station.name}
                    {demo && <span className="ml-2 text-[10px] font-bold text-orange-800">DEMO MODE</span>}
                    {demo && <span className="block text-[10px] text-orange-800">{demo.healthMessage}</span>}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{station.station_id}</td>
                  <td className="py-2.5 pr-3"><StationStatusBadge status={status} /></td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{latestObservation?.temperature ?? "—"} °C</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{latestObservation?.atmospheric_pressure ?? "—"} hPa</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{latestObservation?.relative_humidity ?? "—"} %</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {demo?.scenario === "COMMUNICATION_FAILURE" ? "Stale" : latestObservation?.timestamp ? new Date(latestObservation.timestamp).toLocaleString() : "No observations"}
                  </td>
                  <td className="py-2.5">
                    {demo?.result.anomaly_detected ? (
                      <span className="font-mono text-xs font-semibold text-orange-900">
                        {demo.result.anomaly_type} · {demo.result.severity} · {demo.result.confidence}%
                      </span>
                    ) : (
                      <Link to="/prediction" onClick={() => selectStation(station.station_id)} className="font-semibold text-primary hover:underline">
                        {anomalyCount}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
