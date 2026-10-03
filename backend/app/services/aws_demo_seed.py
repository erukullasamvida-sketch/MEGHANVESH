import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Session, select

from ..database import engine
from ..models.aws_station import AWSStation, AWSStationStatus
from ..models.sensor_observation import (
    ObservationValidationStatus,
    SensorObservation,
)


DEMO_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "sih26073_aws_demo_observations.csv"
)

DEMO_STATIONS = (
    {
        "station_id": "AWS-ASSAM-001",
        "name": "Guwahati AWS Demo Station",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "status": AWSStationStatus.HEALTHY,
    },
    {
        "station_id": "AWS-MEGHALAYA-002",
        "name": "Shillong AWS Demo Station",
        "latitude": 25.5788,
        "longitude": 91.8933,
        "status": AWSStationStatus.HEALTHY,
    },
    {
        "station_id": "AWS-ARUNACHAL-003",
        "name": "Itanagar AWS Demo Station",
        "latitude": 27.0844,
        "longitude": 93.6053,
        "status": AWSStationStatus.OFFLINE,
    },
)


def _optional_float(value: str) -> float | None:
    return float(value) if value.strip() else None


def seed_aws_demo_data() -> None:
    with Session(engine) as session:
        if session.exec(select(AWSStation.station_id).limit(1)).first() is not None:
            return

        reference_time = datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
        observations = []
        last_seen_by_station: dict[str, datetime] = {}

        with DEMO_DATA_PATH.open(newline="", encoding="utf-8") as demo_file:
            for row in csv.DictReader(demo_file):
                timestamp = reference_time - timedelta(hours=int(row["hours_ago"]))
                station_id = row["station_id"]
                last_seen_by_station[station_id] = max(
                    timestamp, last_seen_by_station.get(station_id, timestamp)
                )
                observations.append(
                    SensorObservation(
                        station_id=station_id,
                        timestamp=timestamp,
                        temperature=_optional_float(row["temperature"]),
                        atmospheric_pressure=_optional_float(
                            row["atmospheric_pressure"]
                        ),
                        relative_humidity=_optional_float(row["relative_humidity"]),
                        validation_status=ObservationValidationStatus(
                            row["validation_status"]
                        ),
                    )
                )

        stations = [
            AWSStation(
                **station,
                last_seen=last_seen_by_station.get(station["station_id"]),
            )
            for station in DEMO_STATIONS
        ]
        session.add_all(stations)
        session.add_all(observations)
        session.commit()