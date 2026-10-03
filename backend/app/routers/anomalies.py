from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models.aws_station import AWSStation, AWSStationStatus
from ..models.sensor_observation import SensorObservation
from ..schemas.anomaly import AnomalyType
from ..services.anomaly_detection import analyze_observations


router = APIRouter(prefix="/api/anomalies", tags=["AWS Anomalies"])
health_router = APIRouter(prefix="/api/station-health", tags=["AWS Station Health"])


def _load_analysis(session: Session, station_id: str | None = None):
    stations = session.exec(select(AWSStation)).all()
    observations = session.exec(
        select(SensorObservation).order_by(
            SensorObservation.timestamp,
            SensorObservation.id,
        )
    ).all()
    station_map = {station.station_id: station for station in stations}
    if station_id is not None and station_id not in station_map:
        raise HTTPException(status_code=404, detail="AWS station not found")
    return analyze_observations(observations, station_map, station_id)


@router.get("")
def get_anomalies(
    station_id: str | None = None,
    include_normal: bool = False,
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    results = _load_analysis(session, station_id)
    if not include_normal:
        results = [result for result in results if result.anomaly_detected]
    return results[:limit]


@router.get("/{station_id}")
def get_station_anomalies(
    station_id: str,
    include_normal: bool = True,
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    results = _load_analysis(session, station_id)
    if not include_normal:
        results = [result for result in results if result.anomaly_detected]
    return results[:limit]


@health_router.get("/{station_id}")
def get_station_health(
    station_id: str,
    session: Session = Depends(get_session),
):
    station = session.get(AWSStation, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="AWS station not found")

    observations = session.exec(
        select(SensorObservation)
        .where(SensorObservation.station_id == station_id)
        .order_by(SensorObservation.timestamp.desc(), SensorObservation.id.desc())
    ).all()
    if not observations:
        return {
            "station_id": station_id,
            "current_status": AWSStationStatus.OFFLINE.value,
            "last_observation": None,
            "recent_anomaly_count": 0,
            "data_quality_issues": {},
        }

    all_results = _load_analysis(session, station_id)
    now = datetime.now(timezone.utc)
    latest_time = observations[0].timestamp
    latest_time = (
        latest_time.replace(tzinfo=timezone.utc)
        if latest_time.tzinfo is None
        else latest_time.astimezone(timezone.utc)
    )
    status = str(getattr(station.status, "value", station.status))
    if now - latest_time > timedelta(hours=6):
        status = AWSStationStatus.OFFLINE.value

    cutoff = now - timedelta(hours=24)
    recent_anomalies = [
        result
        for result in all_results
        if result.anomaly_detected
        and (
            result.observation_timestamp.replace(tzinfo=timezone.utc)
            if result.observation_timestamp.tzinfo is None
            else result.observation_timestamp.astimezone(timezone.utc)
        )
        >= cutoff
    ]
    recent_window = all_results[: min(24, len(all_results))]
    quality_types = {
        AnomalyType.MISSING_DATA,
        AnomalyType.INVALID_DATA,
        AnomalyType.STALE_DATA,
        AnomalyType.POSSIBLE_COMMUNICATION_ERROR,
    }
    quality_issues: dict[str, int] = {}
    for result in recent_window:
        if result.anomaly_type in quality_types:
            quality_issues[result.anomaly_type.value] = (
                quality_issues.get(result.anomaly_type.value, 0) + 1
            )

    return {
        "station_id": station_id,
        "current_status": status,
        "last_observation": observations[0],
        "recent_anomaly_count": len(recent_anomalies),
        "data_quality_issues": quality_issues,
    }