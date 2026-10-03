import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import { Link } from "@tanstack/react-router";

import type { DemoStationSnapshot } from "@/lib/demo-anomaly";

const STATUS_COLORS = {
  HEALTHY: "#15803d",
  WARNING: "#b45309",
  ANOMALOUS: "#c2410c",
  OFFLINE: "#64748b",
} as const;

export default function RiskLeafletMap({
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
    <MapContainer
      center={[26.2, 92.9]}
      zoom={compact ? 6 : 7}
      scrollWheelZoom={!compact}
      style={{ height, width: "100%", borderRadius: "0.5rem", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {stations.map((snapshot) => {
        const { station, latestObservation, demo } = snapshot;
        const markerColor = STATUS_COLORS[snapshot.status];
        const lastSeen = latestObservation?.timestamp ?? station.last_seen;
        return (
          <CircleMarker
            key={station.station_id}
            center={[station.latitude, station.longitude]}
            radius={snapshot.status === "ANOMALOUS" ? 10 : 8}
            eventHandlers={{ click: () => onSelectStation(station.station_id) }}
            pathOptions={{ color: "#ffffff", fillColor: markerColor, fillOpacity: 0.9, weight: 2 }}
          >
            <Tooltip direction="top">{station.name}</Tooltip>
            <Popup>
              <div style={{ minWidth: 210, fontFamily: "inherit" }}>
                <p style={{ fontWeight: 700, margin: "0 0 2px" }}>{station.name}</p>
                <p style={{ color: "#475569", fontSize: 12, margin: "0 0 8px" }}>
                  {station.station_id}
                </p>
                <p style={{ color: markerColor, fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>
                  {snapshot.status}
                </p>
                {demo && (
                  <div style={{ borderBottom: "1px solid #e2e8f0", marginBottom: 8, paddingBottom: 8 }}>
                    <p style={{ color: "#9a3412", fontSize: 11, fontWeight: 700, margin: "0 0 3px" }}>
                      DEMO MODE
                    </p>
                    <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>
                      Simulated sensor anomaly
                    </p>
                  </div>
                )}
                <p style={{ fontSize: 12, margin: "3px 0" }}>
                  Temperature: {latestObservation?.temperature ?? "—"} °C
                </p>
                <p style={{ fontSize: 12, margin: "3px 0" }}>
                  Pressure: {latestObservation?.atmospheric_pressure ?? "—"} hPa
                </p>
                <p style={{ fontSize: 12, margin: "3px 0" }}>
                  Humidity: {latestObservation?.relative_humidity ?? "—"} %
                </p>
                <p style={{ color: "#475569", fontSize: 11, margin: "7px 0" }}>
                  Last seen: {demo?.scenario === "COMMUNICATION_FAILURE" ? "Stale" : lastSeen ? new Date(lastSeen).toLocaleString() : "No readings"}
                </p>
                {demo && (
                  <>
                    <p style={{ fontSize: 12, margin: "3px 0" }}>Anomaly: {demo.result.anomaly_type}</p>
                    <p style={{ fontSize: 12, margin: "3px 0" }}>Severity: {demo.result.severity}</p>
                    <p style={{ fontSize: 12, margin: "3px 0 8px" }}>Confidence: {demo.result.confidence}%</p>
                  </>
                )}
                <p style={{ fontSize: 12, margin: "3px 0 8px" }}>
                  Anomalies: {snapshot.anomalyCount}
                </p>
                <Link
                  to="/prediction"
                  onClick={() => onSelectStation(station.station_id)}
                  style={{ color: "#166534", fontSize: 12, fontWeight: 700 }}
                >
                  Open anomaly details
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
