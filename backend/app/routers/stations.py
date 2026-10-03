from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.aws_station import AWSStation


router = APIRouter(
    prefix="/api/stations",
    tags=["AWS Stations"],
)


@router.get("")
def get_stations(session: Session = Depends(get_session)):
    return session.exec(
        select(AWSStation).order_by(AWSStation.station_id)
    ).all()


@router.get("/{station_id}")
def get_station(station_id: str, session: Session = Depends(get_session)):
    station = session.get(AWSStation, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="AWS station not found")
    return station