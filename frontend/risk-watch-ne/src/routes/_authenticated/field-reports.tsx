import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, SectionCard } from "@/components/app-shell";
import { SeverityBadge, StationStatusBadge } from "@/components/aws-status-badge";
import { getAWSStationSnapshots } from "@/lib/api/aws";
import { useProfile } from "@/hooks/use-profile";
import { useStationSelection } from "@/hooks/use-station-selection";

export const Route = createFileRoute("/_authenticated/field-reports")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content:
          "Inspect AWS station status, latest sensor values, and recent anomaly results.",
      },
      { property: "og:title", content: "MEGHANVESH | Station Inspection" },
      {
        property: "og:description",
        content: "Station health and sensor data quality overview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StationInspectionPage,
});

function StationInspectionPage() {
  const { data: profile } = useProfile();
  const { selectedStationId, selectStation } = useStationSelection();
  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 15_000,
  });
  const selected = stations.find((item) => item.station.station_id === selectedStationId);

  return (
    <AppShell
      title="Station Inspection"
      subtitle="Review station health, current values, and recent detection results"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      {error ? (
        <SectionCard><p className="py-8 text-center text-sm text-destructive">Could not load station health.</p></SectionCard>
      ) : isLoading ? (
        <SectionCard><p className="py-8 text-center text-sm text-muted-foreground">Loading station health…</p></SectionCard>
      ) : stations.length === 0 ? (
        <SectionCard><p className="py-8 text-center text-sm text-muted-foreground">No stations are available.</p></SectionCard>
      ) : (
        <div className="space-y-4">
          <SectionCard title="Station status and latest readings">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Station</th><th className="pb-2 pr-3 font-medium">Status</th><th className="pb-2 pr-3 font-medium">Last seen</th><th className="pb-2 pr-3 font-medium">Temperature</th><th className="pb-2 pr-3 font-medium">Pressure</th><th className="pb-2 pr-3 font-medium">Humidity</th><th className="pb-2 font-medium">Recent anomalies</th>
                </tr></thead>
                <tbody>{stations.map((snapshot) => (
                  <tr key={snapshot.station.station_id} className={`border-b border-border/60 last:border-0 ${selectedStationId === snapshot.station.station_id ? "bg-accent/40" : ""}`}>
                    <td className="py-3 pr-3"><button type="button" className="text-left font-medium text-foreground hover:text-primary" onClick={() => selectStation(snapshot.station.station_id)}>{snapshot.station.name}<span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{snapshot.station.station_id}</span></button></td>
                    <td className="py-3 pr-3"><StationStatusBadge status={snapshot.status} /></td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">{snapshot.latestObservation?.timestamp ? new Date(snapshot.latestObservation.timestamp).toLocaleString() : "No observations"}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{snapshot.latestObservation?.temperature ?? "—"} °C</td>
                    <td className="py-3 pr-3 text-muted-foreground">{snapshot.latestObservation?.atmospheric_pressure ?? "—"} hPa</td>
                    <td className="py-3 pr-3 text-muted-foreground">{snapshot.latestObservation?.relative_humidity ?? "—"} %</td>
                    <td className="py-3 font-semibold text-foreground">{snapshot.anomalyCount}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </SectionCard>

          {selected && (
            <SectionCard title={`Recent anomalies · ${selected.station.name}`} description="Reasons are supplied by the detection service">
              {selected.anomalies.length === 0 ? (
                <p className="py-5 text-center text-sm text-muted-foreground">No anomaly results for this station.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {selected.anomalies.slice(0, 5).map((anomaly) => (
                    <li key={anomaly.observation_id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div><p className="text-sm font-semibold text-foreground">{anomaly.anomaly_type}</p><p className="mt-1 text-xs text-muted-foreground">{anomaly.reasons.join(" ")}</p></div>
                      <div className="flex items-center gap-2 sm:justify-end"><SeverityBadge severity={anomaly.severity} /><time className="text-xs text-muted-foreground">{new Date(anomaly.observation_timestamp).toLocaleString()}</time></div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
          <p className="text-right text-sm"><Link to="/risk-map" className="font-semibold text-primary hover:underline">Open AWS Station Map</Link></p>
        </div>
      )}
    </AppShell>
  );
}
