import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { MapPanel } from "@/components/map/map-panel";
import { StationStatusBadge } from "@/components/aws-status-badge";
import { Input } from "@/components/ui/input";
import { getAWSStationSnapshots, type AWSStationStatus } from "@/lib/api/aws";
import { useStationSelection } from "@/hooks/use-station-selection";
import { useProfile } from "@/hooks/use-profile";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { overlayDemoSnapshot } from "@/lib/demo-anomaly";

export const Route = createFileRoute("/_authenticated/risk-map")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content: "Map of AWS station locations, current status, latest observations, and anomalies.",
      },
      { property: "og:title", content: "MEGHANVESH | AWS Station Map" },
      {
        property: "og:description",
        content: "Explore AWS stations and their latest sensor readings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskMapPage,
});

const STATUSES: Array<"ALL" | AWSStationStatus> = [
  "ALL",
  "HEALTHY",
  "WARNING",
  "ANOMALOUS",
  "OFFLINE",
];

function RiskMapPage() {
  const { data: profile } = useProfile();
  const { selectedStationId, selectStation } = useStationSelection();
  const { demoActive, demoStationId, demoScenario, demoStartedAt } = useDemoMode();
  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });
  const displayStations = demoActive
    ? stations.map((snapshot) =>
        snapshot.station.station_id === demoStationId
          ? overlayDemoSnapshot(snapshot, demoScenario, demoStartedAt)
          : snapshot,
      )
    : stations;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AWSStationStatus>("ALL");
  const filtered = useMemo(
    () =>
      displayStations.filter(({ station, status }) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          station.name.toLowerCase().includes(query) ||
          station.station_id.toLowerCase().includes(query);
        return matchesSearch && (statusFilter === "ALL" || status === statusFilter);
      }),
    [displayStations, search, statusFilter],
  );

  return (
    <AppShell
      title="AWS Station Map"
      subtitle="Station coordinates, health, and latest sensor observations"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <SectionCard title="Station locations" description={demoActive ? `${filtered.length} stations shown · selected station demo overlay only` : `${filtered.length} stations shown`}>
            {error ? (
              <p className="py-8 text-center text-sm text-destructive">Could not load AWS stations.</p>
            ) : isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading station map…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No stations match these filters.</p>
            ) : (
              <MapPanel stations={filtered} height={540} onSelectStation={selectStation} />
            )}
          </SectionCard>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(["HEALTHY", "WARNING", "ANOMALOUS", "OFFLINE"] as AWSStationStatus[]).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <StationStatusBadge status={status} />
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SectionCard title="Find a station">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or station ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    statusFilter === status
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "ALL" ? "All" : status}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Station status">
            <ul className="max-h-[500px] space-y-2 overflow-y-auto">
              {filtered.map((snapshot) => (
                <li key={snapshot.station.station_id}>
                  <button
                    type="button"
                    onClick={() => selectStation(snapshot.station.station_id)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                      selectedStationId === snapshot.station.station_id
                        ? "border-primary/50 bg-accent/50"
                        : "border-border"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {snapshot.station.name}
                      </span>
                      {snapshot.demo && (
                        <span className="mt-1 block text-[10px] font-bold text-orange-900">
                          DEMO MODE · Simulated sensor anomaly
                        </span>
                      )}
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {snapshot.station.station_id}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {snapshot.latestObservation?.temperature ?? "—"} °C · {snapshot.latestObservation?.atmospheric_pressure ?? "—"} hPa · {snapshot.latestObservation?.relative_humidity ?? "—"} %
                      </span>
                      {snapshot.demo?.scenario === "COMMUNICATION_FAILURE" && (
                        <span className="block text-xs text-slate-700">Last seen: stale · Data quality: stale</span>
                      )}
                    </span>
                    <StationStatusBadge status={snapshot.status} />
                  </button>
                  {selectedStationId === snapshot.station.station_id && (
                    <Link
                      to="/prediction"
                      className="mt-1 inline-block pl-3 text-xs font-semibold text-primary hover:underline"
                    >
                      View anomaly analysis
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
