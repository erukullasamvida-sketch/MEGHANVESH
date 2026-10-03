from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class AWSStationStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    ANOMALOUS = "ANOMALOUS"
    OFFLINE = "OFFLINE"


class AWSStation(SQLModel, table=True):
    __tablename__ = "awsstation"

    station_id: str = Field(primary_key=True)
    name: str
    latitude: float
    longitude: float
    status: AWSStationStatus = Field(default=AWSStationStatus.HEALTHY)
    last_seen: datetime | None = None