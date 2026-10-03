from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models.aws_station import AWSStation
from ..models.sensor_observation import SensorObservation


router = APIRouter(
    prefix="/api/observations",
    tags=["AWS Observations"],
)


def _get_observations(
    session: Session,
    station_id: str | None,
    limit: int,
):
    statement = select(SensorObservation)
    if station_id is not None:
        statement = statement.where(SensorObservation.station_id == station_id)
    return session.exec(
        statement.order_by(
            SensorObservation.timestamp.desc(),
            SensorObservation.id.desc(),
        ).limit(limit)
    ).all()


@router.get("")
def get_observations(
    station_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    return _get_observations(session, station_id, limit)


@router.get("/{station_id}")
def get_station_observations(
    station_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    if session.get(AWSStation, station_id) is None:
        raise HTTPException(status_code=404, detail="AWS station not found")
    return _get_observations(session, station_id, limit)