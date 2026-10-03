from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    NORMAL = "NORMAL"
    TEMPERATURE_SPIKE = "TEMPERATURE_SPIKE"
    PRESSURE_ANOMALY = "PRESSURE_ANOMALY"
    HUMIDITY_ANOMALY = "HUMIDITY_ANOMALY"
    FROZEN_SENSOR = "FROZEN_SENSOR"
    SENSOR_DRIFT = "SENSOR_DRIFT"
    MULTIVARIATE_INCONSISTENCY = "MULTIVARIATE_INCONSISTENCY"
    MISSING_DATA = "MISSING_DATA"
    INVALID_DATA = "INVALID_DATA"
    STALE_DATA = "STALE_DATA"
    POSSIBLE_COMMUNICATION_ERROR = "POSSIBLE_COMMUNICATION_ERROR"


class AnomalySeverity(str, Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnomalyResult(BaseModel):
    station_id: str
    observation_id: int
    observation_timestamp: datetime
    anomaly_detected: bool
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    confidence: float = Field(ge=0, le=100)
    reasons: list[str]
    detected_at: datetime