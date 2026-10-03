import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, ScanSearch } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { SeverityBadge, StationStatusBadge } from "@/components/aws-status-badge";
import { getAWSAnomalies, getAWSStationSnapshots } from "@/lib/api/aws";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStationSelection } from "@/hooks/use-station-selection";
import { useProfile } from "@/hooks/use-profile";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { getDemoScenarioLabel, overlayDemoSnapshot } from "@/lib/demo-anomaly";

export const Route = createFileRoute("/_authenticated/prediction")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content: "Review AWS readings, anomaly classifications, confidence, and backend reasons.",
      },
      { property: "og:title", content: "MEGHANVESH | Anomaly Detection" },
      {
        property: "og:description",
        content: "Explainable anomaly analysis for Automatic Weather Station observations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnomalyDetectionPage,
});

function AnomalyDetectionPage() {
  const { data: profile } = useProfile();
  const { selectedStationId, selectStation } = useStationSelection();
  const {
    demoActive,
    demoStationId,
    demoScenario,
    demoStartedAt,
    setDemoStationId,
  } = useDemoMode();
  const { data: stations = [] } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });
  const defaultStationId =
    stations.find((item) => item.status !== "OFFLINE")?.station.station_id ??
    stations[0]?.station.station_id ??
    null;
  const activeStationId = demoActive ? demoStationId : selectedStationId ?? defaultStationId;
  const selected = stations.find((item) => item.station.station_id === activeStationId);
  const displaySelected = selected && demoActive
    ? overlayDemoSnapshot(selected, demoScenario, demoStartedAt)
    : selected;
  const { data: analysis = [], isLoading, error } = useQuery({
    queryKey: ["aws_station_anomalies", activeStationId],
    queryFn: () => getAWSAnomalies(activeStationId!),
    enabled: Boolean(activeStationId),
    refetchInterval: 15_000,
  });
  const latestResult = displaySelected?.demo?.result ?? analysis[0];
  const recentAnomalies = analysis.filter((result) => result.anomaly_detected).slice(0, 6);

  useEffect(() => {
    if (!selectedStationId && defaultStationId) selectStation(defaultStationId);
  }, [defaultStationId, selectStation, selectedStationId]);

  return (
    <AppShell
      title="Anomaly Detection"
      subtitle="Inspect backend analysis or run a clearly labeled frontend demonstration"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <SectionCard title="Select AWS station" description="Station analysis refreshes from the backend">
        <Select
          value={activeStationId ?? ""}
          onValueChange={(stationId) => {
            selectStation(stationId);
            if (demoActive) setDemoStationId(stationId);
          }}
        >
          <SelectTrigger className="max-w-xl">
            <SelectValue placeholder="Choose a station" />
          </SelectTrigger>
          <SelectContent>
            {stations.map(({ station }) => (
              <SelectItem key={station.station_id} value={station.station_id}>
                {station.name} · {station.station_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SectionCard>

      {displaySelected && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
          <SectionCard title={displaySelected.station.name} description={displaySelected.station.station_id}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StationStatusBadge status={displaySelected.status} />
              {displaySelected.demo && (
                <span className="rounded-md border border-orange-800/20 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-900">
                  DEMO MODE · Simulated sensor anomaly
                </span>
              )}
              {displaySelected.latestObservation && (
                <span className="text-xs text-muted-foreground">
                  Last observed {displaySelected.demo?.scenario === "COMMUNICATION_FAILURE" ? "stale" : new Date(displaySelected.latestObservation.timestamp).toLocaleString()}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Temperature", displaySelected.latestObservation?.temperature, "°C"],
                ["Atmospheric pressure", displaySelected.latestObservation?.atmospheric_pressure, "hPa"],
                ["Relative humidity", displaySelected.latestObservation?.relative_humidity, "%"],
              ].map(([label, value, unit]) => (
                <div key={String(label)} className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {value ?? "—"} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
            {displaySelected.demo && (
              <p className="mt-3 text-sm font-medium text-foreground">{displaySelected.demo.healthMessage}</p>
            )}
          </SectionCard>

          <SectionCard
            title={displaySelected.demo ? "Simulated Demo Result" : "Latest observation analysis"}
            description={displaySelected.demo ? "Deterministic frontend-only explanation; not sent to the backend" : "Rule-based result from the AWS history"}
          >
            {!displaySelected.demo && isLoading ? (
              <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing station history…
              </p>
            ) : !displaySelected.demo && error ? (
              <p className="py-8 text-sm text-destructive">Could not load station analysis.</p>
            ) : latestResult ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {latestResult.anomaly_detected ? "ANOMALY DETECTED" : "NORMAL"}
                  </span>
                  <SeverityBadge severity={latestResult.severity} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Anomaly type</dt>
                    <dd className="mt-1 font-medium text-foreground">{latestResult.anomaly_type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Evidence confidence</dt>
                    <dd className="mt-1 font-medium text-foreground">{latestResult.confidence}%</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Detected at</dt>
                    <dd className="mt-1 font-medium text-foreground">{new Date(latestResult.detected_at).toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="border-t border-border pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Why was this flagged?</h3>
                  <ul className="space-y-2 text-sm text-foreground">
                    {latestResult.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">No observation analysis is available for this station.</p>
            )}
          </SectionCard>
        </div>
      )}

      {demoActive && displaySelected?.demo && (
        <SectionCard className="mt-4" title="Live Detection Demonstration" description="Simulated sensor values remain in the browser and never update backend records">
          <div className="space-y-3">
            <div className="rounded-md border border-orange-800/20 bg-orange-50/60 p-3">
              <p className="text-xs font-bold uppercase text-orange-900">DEMO MODE · Sensor Input</p>
              <p className="mt-2 text-sm text-foreground">
                Temperature {displaySelected.latestObservation?.temperature} °C · Pressure {displaySelected.latestObservation?.atmospheric_pressure} hPa · Humidity {displaySelected.latestObservation?.relative_humidity} %
              </p>
              {demoScenario === "COMMUNICATION_FAILURE" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last seen: stale · Connection: {displaySelected.demo.connection} · Data quality: stale
                </p>
              )}
            </div>
            <p className="pl-4 text-muted-foreground">↓</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Detection", latestResult.anomaly_detected ? "Anomaly detected" : "No anomaly detected"],
                ["Classification", getDemoScenarioLabel(demoScenario)],
                ["Explanation", latestResult.reasons[0]],
                ["Alert", latestResult.anomaly_detected ? "SIMULATED ALERT" : "No simulated alert"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                  {label === "Classification" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={latestResult.severity} />
                      <span className="text-xs text-muted-foreground">{latestResult.confidence}% confidence</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard className="mt-4" title="Recent flagged observations" description="Backend classifications for this station">
        {recentAnomalies.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">No flagged observations for this station.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentAnomalies.map((result) => (
              <li key={result.observation_id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="text-sm font-semibold text-foreground">{result.anomaly_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.reasons.join(" ")}</p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <SeverityBadge severity={result.severity} />
                  <time className="text-xs text-muted-foreground">{new Date(result.observation_timestamp).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ScanSearch className="h-3.5 w-3.5" /> Confidence is an evidence score, not a probability.
      </p>
    </AppShell>
  );
}
