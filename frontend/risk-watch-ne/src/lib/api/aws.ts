import { apiFetch } from "./client";

export type AWSStationStatus = "HEALTHY" | "WARNING" | "ANOMALOUS" | "OFFLINE";

export type ObservationValidationStatus =
  | "VALID"
  | "MISSING_VALUE"
  | "INVALID_VALUE"
  | "DUPLICATE"
  | "STALE_OFFLINE";

export type AnomalyType =
  | "NORMAL"
  | "TEMPERATURE_SPIKE"
  | "PRESSURE_ANOMALY"
  | "HUMIDITY_ANOMALY"
  | "FROZEN_SENSOR"
  | "SENSOR_DRIFT"
  | "MULTIVARIATE_INCONSISTENCY"
  | "MISSING_DATA"
  | "INVALID_DATA"
  | "STALE_DATA"
  | "POSSIBLE_COMMUNICATION_ERROR";

export type AnomalySeverity = "NORMAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AWSStation {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: AWSStationStatus;
  last_seen: string | null;
}

export interface SensorObservation {
  id: number;
  station_id: string;
  timestamp: string;
  temperature: number | null;
  atmospheric_pressure: number | null;
  relative_humidity: number | null;
  validation_status: ObservationValidationStatus;
}

export interface AnomalyResult {
  station_id: string;
  observation_id: number;
  observation_timestamp: string;
  anomaly_detected: boolean;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  reasons: string[];
  detected_at: string;
}

export interface AWSStationHealth {
  station_id: string;
  current_status: AWSStationStatus;
  last_observation: SensorObservation | null;
  recent_anomaly_count: number;
  data_quality_issues: Record<string, number>;
}

export interface AWSStationSnapshot {
  station: AWSStation;
  status: AWSStationStatus;
  health: AWSStationHealth;
  latestObservation: SensorObservation | null;
  anomalies: AnomalyResult[];
  anomalyCount: number;
}

const QUALITY_ANOMALIES: AnomalyType[] = [
  "MISSING_DATA",
  "INVALID_DATA",
  "STALE_DATA",
  "POSSIBLE_COMMUNICATION_ERROR",
];

export function getAWSStations(): Promise<AWSStation[]> {
  return apiFetch<AWSStation[]>("/api/stations");
}

export function getAWSObservations(stationId: string): Promise<SensorObservation[]> {
  return apiFetch<SensorObservation[]>(`/api/observations/${encodeURIComponent(stationId)}`);
}

export function getAWSAnomalies(stationId: string): Promise<AnomalyResult[]> {
  return apiFetch<AnomalyResult[]>(
    `/api/anomalies/${encodeURIComponent(stationId)}?include_normal=true`,
  );
}

export function getAllAWSAnomalies(): Promise<AnomalyResult[]> {
  return apiFetch<AnomalyResult[]>("/api/anomalies");
}

export function getStationHealth(stationId: string): Promise<AWSStationHealth> {
  return apiFetch<AWSStationHealth>(`/api/station-health/${encodeURIComponent(stationId)}`);
}

export async function getAWSStationSnapshots(): Promise<AWSStationSnapshot[]> {
  const stations = await getAWSStations();
  return Promise.all(
    stations.map(async (station) => {
      const [health, stationResults] = await Promise.all([
        getStationHealth(station.station_id),
        getAWSAnomalies(station.station_id),
      ]);
      const anomalies = stationResults.filter((result) => result.anomaly_detected);
      const instrumentAnomalies = anomalies.filter(
        (result) => !QUALITY_ANOMALIES.includes(result.anomaly_type),
      );
      const status: AWSStationStatus =
        health.current_status === "OFFLINE" || station.status === "OFFLINE"
          ? "OFFLINE"
          : health.current_status === "ANOMALOUS" ||
              station.status === "ANOMALOUS" ||
              instrumentAnomalies.length > 0
            ? "ANOMALOUS"
            : health.current_status === "WARNING" ||
                station.status === "WARNING" ||
                anomalies.length > 0
              ? "WARNING"
              : "HEALTHY";

      return {
        station,
        status,
        health,
        latestObservation: health.last_observation,
        anomalies,
        anomalyCount: health.recent_anomaly_count,
      };
    }),
  );
}