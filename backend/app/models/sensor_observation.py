from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class ObservationValidationStatus(str, Enum):
    VALID = "VALID"
    MISSING_VALUE = "MISSING_VALUE"
    INVALID_VALUE = "INVALID_VALUE"
    DUPLICATE = "DUPLICATE"
    STALE_OFFLINE = "STALE_OFFLINE"


class SensorObservation(SQLModel, table=True):
    __tablename__ = "sensorobservation"

    id: Optional[int] = Field(default=None, primary_key=True)
    station_id: str = Field(foreign_key="awsstation.station_id", index=True)
    timestamp: datetime = Field(index=True)
    temperature: Optional[float] = None
    atmospheric_pressure: Optional[float] = None
    relative_humidity: Optional[float] = None
    validation_status: ObservationValidationStatus = Field(
        default=ObservationValidationStatus.VALID
    )