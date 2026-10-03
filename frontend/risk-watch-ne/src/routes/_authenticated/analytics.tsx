import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, SectionCard } from "@/components/app-shell";
import { getAWSAnomalies, getAWSObservations, getAWSStationSnapshots } from "@/lib/api/aws";
import { useStationSelection } from "@/hooks/use-station-selection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content:
          "Temperature, atmospheric pressure, and relative humidity history for an AWS station.",
      },
      { property: "og:title", content: "MEGHANVESH | Sensor Analytics" },
      {
        property: "og:description",
        content: "Review actual AWS observations and anomaly markers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: profile } = useProfile();
  const { selectedStationId, selectStation } = useStationSelection();
  const { data: stations = [] } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });
  const defaultStationId =
    stations.find((item) => item.status !== "OFFLINE")?.station.station_id ??
    stations[0]?.station.station_id ??
    null;
  const activeStationId = selectedStationId ?? defaultStationId;
  const selected = stations.find((item) => item.station.station_id === activeStationId);
  const { data: observations = [], isLoading, error } = useQuery({
    queryKey: ["aws_observations", activeStationId],
    queryFn: () => getAWSObservations(activeStationId!),
    enabled: Boolean(activeStationId),
    refetchInterval: 30_000,
  });
  const { data: analysis = [] } = useQuery({
    queryKey: ["aws_station_anomalies", activeStationId],
    queryFn: () => getAWSAnomalies(activeStationId!),
    enabled: Boolean(activeStationId),
    refetchInterval: 30_000,
  });
  const chartRows = useMemo(() => {
    const flaggedIds = new Set(
      analysis.filter((result) => result.anomaly_detected).map((result) => result.observation_id),
    );
    return [...observations]
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .map((observation) => ({
        ...observation,
        label: new Date(observation.timestamp).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        anomalyDetected: flaggedIds.has(observation.id),
      }));
  }, [analysis, observations]);

  useEffect(() => {
    if (!selectedStationId && defaultStationId) selectStation(defaultStationId);
  }, [defaultStationId, selectStation, selectedStationId]);

  const charts = [
    { key: "temperature" as const, title: "Temperature", unit: "°C", color: "#c2410c" },
    { key: "atmospheric_pressure" as const, title: "Atmospheric pressure", unit: "hPa", color: "#0f766e" },
    { key: "relative_humidity" as const, title: "Relative humidity", unit: "%", color: "#2563eb" },
  ];

  return (
    <AppShell
      title="Sensor Analytics"
      subtitle="Historical sensor observations and backend anomaly markers"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <SectionCard title="Select AWS station" description={selected?.station.station_id ?? "Choose a station to view its observation history"}>
        <Select value={activeStationId ?? ""} onValueChange={selectStation}>
          <SelectTrigger className="max-w-xl"><SelectValue placeholder="Choose a station" /></SelectTrigger>
          <SelectContent>
            {stations.map(({ station }) => <SelectItem key={station.station_id} value={station.station_id}>{station.name} · {station.station_id}</SelectItem>)}
          </SelectContent>
        </Select>
      </SectionCard>

      {error ? (
        <SectionCard className="mt-4"><p className="py-8 text-center text-sm text-destructive">Could not load observations from the backend.</p></SectionCard>
      ) : isLoading ? (
        <SectionCard className="mt-4"><p className="py-8 text-center text-sm text-muted-foreground">Loading station history…</p></SectionCard>
      ) : chartRows.length === 0 ? (
        <SectionCard className="mt-4"><p className="py-8 text-center text-sm text-muted-foreground">No observations are available for this station.</p></SectionCard>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {charts.map((chart) => (
            <SectionCard key={chart.key} title={chart.title} description={`${chartRows.length} actual observations · ${chart.unit}`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe2e8" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                    <YAxis width={48} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey={chart.key} name={chart.unit} stroke={chart.color} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    {chartRows.filter((row) => row.anomalyDetected && row[chart.key] !== null).map((row) => (
                      <ReferenceDot key={`${chart.key}-${row.id}`} x={row.label} y={row[chart.key] as number} r={5} fill="#dc2626" stroke="#fff" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
