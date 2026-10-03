import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { DemoStationSnapshot } from "@/lib/demo-anomaly";

const RiskLeafletMap = lazy(() => import("./risk-leaflet-map"));

function MapSkeleton({ height }: { height: number }) {
  return (
    <div
      className="grid animate-pulse place-items-center rounded-lg bg-muted text-sm text-muted-foreground"
      style={{ height }}
    >
      Loading map…
    </div>
  );
}

export function MapPanel({
  stations,
  onSelectStation,
  height = 420,
  compact = false,
}: {
  stations: DemoStationSnapshot[];
  onSelectStation: (stationId: string) => void;
  height?: number;
  compact?: boolean;
}) {

  return (
    <ClientOnly fallback={<MapSkeleton height={height} />}>
      <Suspense fallback={<MapSkeleton height={height} />}>
        <RiskLeafletMap
          stations={stations}
          onSelectStation={onSelectStation}
          height={height}
          compact={compact}
        />
      </Suspense>
    </ClientOnly>
  );
}
