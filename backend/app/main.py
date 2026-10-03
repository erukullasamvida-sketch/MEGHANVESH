from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_db_and_tables

from .routers import (
    dashboard,
    risk,
    prediction,
    alerts,
    reports,
    analytics,
    sensors,
    environmental,
    locations,
    stations,
    observations,
    anomalies,
)
from .services.aws_demo_seed import seed_aws_demo_data


app = FastAPI(
    title="LandslideGuard API",
    description="AI-powered landslide early warning and risk monitoring API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_db_and_tables()
    seed_aws_demo_data()


@app.get("/")
def root():
    return {
        "application": "LandslideGuard",
        "status": "operational",
        "version": "1.0.0"
    }


app.include_router(dashboard.router)
app.include_router(risk.router)
app.include_router(prediction.router)
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(sensors.router)
app.include_router(environmental.router)
app.include_router(locations.router)
app.include_router(stations.router)
app.include_router(observations.router)
app.include_router(anomalies.router)
app.include_router(anomalies.health_router)