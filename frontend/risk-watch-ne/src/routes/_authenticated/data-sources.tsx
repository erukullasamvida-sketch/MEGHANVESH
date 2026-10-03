import { createFileRoute } from "@tanstack/react-router";
import { Database, Radio } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { StationStatusBadge } from "@/components/aws-status-badge";
import { useQuery } from "@tanstack/react-query";
import { getAWSStationSnapshots } from "@/lib/api/aws";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/data-sources")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content: "AWS station list and latest temperature, pressure, and humidity observations.",
      },
      { property: "og:title", content: "MEGHANVESH | AWS Data" },
      {
        property: "og:description",
        content: "Current backend AWS station and observation data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataSourcesPage,
});

function DataSourcesPage() {
  const { data: profile } = useProfile();
  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ["aws_station_snapshots"],
    queryFn: getAWSStationSnapshots,
    refetchInterval: 30_000,
  });

  return (
    <AppShell
      title="AWS Data"
      subtitle="Available station sources and their latest backend observations"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="mb-4 rounded-md border border-amber-800/20 bg-amber-50 p-4 text-sm text-amber-950">
        The current station and observation records are seeded SIH26073 demo data. No physical AWS hardware feed is connected in this prototype.
      </div>
      <SectionCard title="AWS observation channels" description="Values analyzed from each station’s observation history">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Temperature", "°C"],
            ["Atmospheric pressure", "hPa"],
            ["Relative humidity", "%"],
          ].map(([label, unit]) => (
            <div key={label} className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
                <Radio className="h-4 w-4" />
              </div>
              <div><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{unit}</p></div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="mt-4" title="Available AWS stations" description={`${stations.length} stations returned by the backend`}>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">Could not load station data.</p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading AWS station data…</p>
        ) : stations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No AWS stations are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Station</th><th className="pb-2 pr-3 font-medium">Status</th><th className="pb-2 pr-3 font-medium">Temperature</th><th className="pb-2 pr-3 font-medium">Pressure</th><th className="pb-2 pr-3 font-medium">Humidity</th><th className="pb-2 font-medium">Latest observation</th>
              </tr></thead>
              <tbody>{stations.map(({ station, status, latestObservation }) => (
                <tr key={station.station_id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-3"><p className="font-medium text-foreground">{station.name}</p><p className="font-mono text-[11px] text-muted-foreground">{station.station_id}</p></td>
                  <td className="py-3 pr-3"><StationStatusBadge status={status} /></td>
                  <td className="py-3 pr-3 text-muted-foreground">{latestObservation?.temperature ?? "—"} °C</td>
                  <td className="py-3 pr-3 text-muted-foreground">{latestObservation?.atmospheric_pressure ?? "—"} hPa</td>
                  <td className="py-3 pr-3 text-muted-foreground">{latestObservation?.relative_humidity ?? "—"} %</td>
                  <td className="py-3 text-xs text-muted-foreground">{latestObservation?.timestamp ? new Date(latestObservation.timestamp).toLocaleString() : "No observations"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
