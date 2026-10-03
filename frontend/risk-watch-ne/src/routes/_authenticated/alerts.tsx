import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BellRing } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { SeverityBadge } from "@/components/aws-status-badge";
import { getAllAWSAnomalies, getAWSStationSnapshots } from "@/lib/api/aws";
import { useProfile } from "@/hooks/use-profile";
import type { AnomalySeverity } from "@/lib/api/aws";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { getDemoScenarioLabel, overlayDemoSnapshot } from "@/lib/demo-anomaly";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content:
          "Sensor anomalies returned by the AWS detection service, with backend reasons and evidence confidence.",
      },
      { property: "og:title", content: "MEGHANVESH | Sensor Anomaly Alerts" },
      {
        property: "og:description",
        content: "Review real AWS anomaly results across monitored stations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

const FILTERS: Array<"ALL" | Exclude<AnomalySeverity, "NORMAL">> = [
  "ALL",
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

function AlertsPage() {
  const { data: profile } = useProfile();
  const { demoActive, demoStationId, demoScenario, demoStartedAt } = useDemoMode();
  const { data: anomalies = [], isLoading, error } = useQuery({
    queryKey: ["aws_anomalies"],
    queryFn: getAllAWSAnomalies,
    refetchInterval: 15_000,
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const stationNames = new Map(stations.map(({ station }) => [station.station_id, station.name]));
  const filtered = anomalies.filter((anomaly) => filter === "ALL" || anomaly.severity === filter);
  const demoSnapshot = demoActive
    ? stations.find(({ station }) => station.station_id === demoStationId)
    : undefined;
  const demoResult = demoSnapshot
    ? overlayDemoSnapshot(demoSnapshot, demoScenario, demoStartedAt).demo?.result
    : undefined;

  return (
    <AppShell
      title="Sensor Anomaly Alerts"
      subtitle={demoActive ? "Backend alerts remain separate from the simulated frontend alert" : "Only anomaly results returned by the backend are shown"}
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      {demoActive && demoResult?.anomaly_detected && demoSnapshot && (
        <article className="mb-4 rounded-md border border-orange-800/20 bg-orange-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-orange-800 px-2 py-1 text-[10px] font-bold text-white">SIMULATED ALERT</span>
            <SeverityBadge severity={demoResult.severity} />
            <span className="text-xs font-semibold text-orange-900">{demoResult.confidence}% confidence</span>
          </div>
          <h2 className="mt-3 text-sm font-bold text-foreground">Simulated AWS Anomaly</h2>
          <p className="mt-1 text-sm text-foreground">{demoSnapshot.station.name}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{getDemoScenarioLabel(demoScenario)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Temperature: {overlayDemoSnapshot(demoSnapshot, demoScenario, demoStartedAt).latestObservation?.temperature} °C
          </p>
          <p className="mt-2 text-sm text-foreground">{demoResult.reasons[0]}</p>
          <p className="mt-3 text-xs text-orange-900">Simulated sensor anomaly · Frontend-only; not stored in the backend</p>
        </article>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {f === "ALL" ? "All" : f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">Loading anomaly results…</p>
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-destructive">Could not load anomaly results from the backend.</p>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">No backend anomalies match this filter.</p>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((anomaly) => (
            <article key={`${anomaly.station_id}-${anomaly.observation_id}`} className="rounded-lg border border-border bg-card p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-orange-50 text-orange-800">
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      {stationNames.get(anomaly.station_id) ?? anomaly.station_id}
                    </h2>
                    <SeverityBadge severity={anomaly.severity} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{anomaly.station_id}</p>
                  <p className="mt-3 text-sm font-semibold text-foreground">{anomaly.anomaly_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Observation {new Date(anomaly.observation_timestamp).toLocaleString()} · Confidence {anomaly.confidence.toFixed(1)} / 100
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-foreground">
                    {anomaly.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
