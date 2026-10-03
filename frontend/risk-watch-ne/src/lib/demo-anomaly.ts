import type {
  AnomalyResult,
  AWSStationSnapshot,
  AWSStationStatus,
  SensorObservation,
} from "@/lib/api/aws";

export type DemoScenario =
  | "NORMAL"
  | "TEMPERATURE_SPIKE"
  | "PRESSURE_ANOMALY"
  | "HUMIDITY_ANOMALY"
  | "FROZEN_SENSOR"
  | "COMMUNICATION_FAILURE";

export const DEMO_SCENARIOS: Array<{ value: DemoScenario; label: string }> = [
  { value: "NORMAL", label: "Normal" },
  { value: "TEMPERATURE_SPIKE", label: "Temperature Spike" },
  { value: "PRESSURE_ANOMALY", label: "Pressure Anomaly" },
  { value: "HUMIDITY_ANOMALY", label: "Humidity Anomaly" },
  { value: "FROZEN_SENSOR", label: "Frozen Sensor" },
  { value: "COMMUNICATION_FAILURE", label: "Communication Failure" },
];

const BASELINE = { temperature: 30.1, atmospheric_pressure: 1004, relative_humidity: 72 };

const SCENARIO_RESULTS = {
  NORMAL: {
    type: "NORMAL",
    severity: "NORMAL",
    confidence: 100,
    reason: "No simulated anomaly is present; these values form the normal demo baseline.",
    status: "HEALTHY",
    values: BASELINE,
  },
  TEMPERATURE_SPIKE: {
    type: "TEMPERATURE_SPIKE",
    severity: "HIGH",
    confidence: 99,
    reason: "Temperature increased sharply compared with recent station observations.",
    status: "ANOMALOUS",
    values: { ...BASELINE, temperature: 49 },
  },
  PRESSURE_ANOMALY: {
    type: "PRESSURE_ANOMALY",
    severity: "HIGH",
    confidence: 97,
    reason: "Atmospheric pressure deviates significantly from the station's recent baseline.",
    status: "ANOMALOUS",
    values: { ...BASELINE, atmospheric_pressure: 702 },
  },
  HUMIDITY_ANOMALY: {
    type: "HUMIDITY_ANOMALY",
    severity: "MEDIUM",
    confidence: 96,
    reason: "Relative humidity deviates significantly from the station's recent baseline.",
    status: "ANOMALOUS",
    values: { ...BASELINE, relative_humidity: 18 },
  },
  FROZEN_SENSOR: {
    type: "FROZEN_SENSOR",
    severity: "MEDIUM",
    confidence: 95,
    reason: "Sensor values remain unchanged across consecutive observations.",
    status: "ANOMALOUS",
    values: BASELINE,
  },
  COMMUNICATION_FAILURE: {
    type: "POSSIBLE_COMMUNICATION_ERROR",
    severity: "HIGH",
    confidence: 98,
    reason: "No fresh observation has been received within the expected interval.",
    status: "OFFLINE",
    values: BASELINE,
  },
} as const;

export type DemoStationSnapshot = AWSStationSnapshot & {
  demo?: {
    scenario: DemoScenario;
    result: AnomalyResult;
    healthMessage: string;
    connection: string;
    dataQuality: string;
  };
};

export function getDemoScenarioLabel(scenario: DemoScenario) {
  return DEMO_SCENARIOS.find((item) => item.value === scenario)?.label ?? "Normal";
}

export function getDemoScenarioDetails(scenario: DemoScenario) {
  return SCENARIO_RESULTS[scenario];
}

export function overlayDemoSnapshot(
  snapshot: AWSStationSnapshot,
  scenario: DemoScenario,
  startedAt: string,
): DemoStationSnapshot {
  const configuration = SCENARIO_RESULTS[scenario];
  const isCommunicationFailure = scenario === "COMMUNICATION_FAILURE";
  const observationTimestamp = isCommunicationFailure
    ? new Date(new Date(startedAt).getTime() - 60 * 60 * 1000).toISOString()
    : startedAt;
  const observation: SensorObservation = {
    id: -1,
    station_id: snapshot.station.station_id,
    timestamp: observationTimestamp,
    ...configuration.values,
    validation_status: isCommunicationFailure ? "STALE_OFFLINE" : "VALID",
  };
  const anomalyDetected = scenario !== "NORMAL";
  const result: AnomalyResult = {
    station_id: snapshot.station.station_id,
    observation_id: -1,
    observation_timestamp: observationTimestamp,
    anomaly_detected: anomalyDetected,
    anomaly_type: configuration.type,
    severity: configuration.severity,
    confidence: configuration.confidence,
    reasons: [configuration.reason],
    detected_at: startedAt,
  };
  const status = configuration.status as AWSStationStatus;
  const healthMessage =
    scenario === "COMMUNICATION_FAILURE"
      ? "Communication appears stale — verify station connectivity."
      : anomalyDetected
        ? "Sensor anomaly detected — inspection recommended."
        : "Normal simulated readings; backend station data remains unchanged.";

  return {
    ...snapshot,
    station: { ...snapshot.station, status, last_seen: observationTimestamp },
    status,
    health: {
      ...snapshot.health,
      current_status: status,
      last_observation: observation,
      data_quality_issues: isCommunicationFailure
        ? { ...snapshot.health.data_quality_issues, STALE_OFFLINE: 1 }
        : snapshot.health.data_quality_issues,
    },
    latestObservation: observation,
    anomalies: anomalyDetected
      ? [result, ...snapshot.anomalies.filter((item) => item.observation_id !== -1)]
      : snapshot.anomalies,
    anomalyCount: snapshot.anomalyCount + (anomalyDetected ? 1 : 0),
    demo: {
      scenario,
      result,
      healthMessage,
      connection: isCommunicationFailure ? "Degraded / offline" : "Online",
      dataQuality: isCommunicationFailure ? "Stale" : "Simulated",
    },
  };
}