"""Rule-based AWS anomaly checks with transparent, non-probabilistic confidence.

Confidence combines configured evidence weights as 100 * (1 - product(1 - w)).
The weights describe rule strength, are not calibrated probabilities, and are
kept with the reasons that triggered each result.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from math import isfinite, prod
from statistics import median

from ..models.aws_station import AWSStation, AWSStationStatus
from ..models.sensor_observation import SensorObservation
from ..schemas.anomaly import AnomalyResult, AnomalySeverity, AnomalyType


HISTORY_SIZE = 6
MIN_HISTORY = 4
STALE_AFTER = timedelta(hours=6)
CROSS_STATION_WINDOW = timedelta(hours=1)

_CHANNELS = {
    "temperature": {
        "bounds": (-90.0, 60.0),
        "rate_limit": 8.0,
        "minimum_change": 4.0,
        "frozen_epsilon": 0.05,
        "drift_range": 5.0,
        "anomaly_type": AnomalyType.TEMPERATURE_SPIKE,
    },
    "atmospheric_pressure": {
        "bounds": (300.0, 1100.0),
        "rate_limit": 12.0,
        "minimum_change": 8.0,
        "frozen_epsilon": 0.05,
        "drift_range": 20.0,
        "anomaly_type": AnomalyType.PRESSURE_ANOMALY,
    },
    "relative_humidity": {
        "bounds": (0.0, 100.0),
        "rate_limit": 25.0,
        "minimum_change": 15.0,
        "frozen_epsilon": 0.05,
        "drift_range": 25.0,
        "anomaly_type": AnomalyType.HUMIDITY_ANOMALY,
    },
}

_QUALITY_WEIGHTS = {
    "INVALID_DATA": 0.95,
    "MISSING_DATA": 0.90,
    "POSSIBLE_COMMUNICATION_ERROR": 0.90,
    "STALE_DATA": 0.92,
}


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _status(value: object) -> str:
    return str(getattr(value, "value", value))


def _value(observation: SensorObservation, channel: str) -> float | None:
    value = getattr(observation, channel)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if isfinite(number) else None


def _confidence(weights: list[float]) -> float:
    if not weights:
        return 0.0
    bounded = [min(0.99, max(0.0, weight)) for weight in weights]
    return round(100 * (1 - prod(1 - weight for weight in bounded)), 1)


def _physical_issues(observation: SensorObservation) -> list[str]:
    issues = []
    for channel, config in _CHANNELS.items():
        value = _value(observation, channel)
        if value is None:
            continue
        low, high = config["bounds"]
        if not low <= value <= high:
            issues.append(
                f"{channel}={value:g} is outside the accepted range [{low:g}, {high:g}]."
            )
    return issues


def _quality_findings(
    observation: SensorObservation,
    station: AWSStation,
    is_latest: bool,
    duplicate_timestamp: bool,
    now: datetime,
) -> tuple[list[tuple[AnomalyType, str, float]], bool]:
    findings: list[tuple[AnomalyType, str, float]] = []
    validation_status = _status(observation.validation_status)
    physical_issues = _physical_issues(observation)

    if validation_status == "INVALID_VALUE" or physical_issues:
        reasons = physical_issues or ["Observation is marked INVALID_VALUE."]
        findings.extend(
            (AnomalyType.INVALID_DATA, reason, _QUALITY_WEIGHTS["INVALID_DATA"])
            for reason in reasons
        )

    missing = [channel for channel in _CHANNELS if _value(observation, channel) is None]
    if validation_status == "MISSING_VALUE" or missing:
        if missing:
            findings.extend(
                (
                    AnomalyType.MISSING_DATA,
                    f"{channel} is missing or not a finite numeric reading.",
                    _QUALITY_WEIGHTS["MISSING_DATA"],
                )
                for channel in missing
            )
        else:
            findings.append(
                (
                    AnomalyType.MISSING_DATA,
                    "Observation is marked MISSING_VALUE.",
                    _QUALITY_WEIGHTS["MISSING_DATA"],
                )
            )

    if validation_status == "DUPLICATE" or duplicate_timestamp:
        findings.append(
            (
                AnomalyType.POSSIBLE_COMMUNICATION_ERROR,
                "A duplicate observation was received for this station and timestamp.",
                _QUALITY_WEIGHTS["POSSIBLE_COMMUNICATION_ERROR"],
            )
        )

    age = now - _utc(observation.timestamp)
    station_offline = _status(station.status) == AWSStationStatus.OFFLINE.value
    explicitly_stale = validation_status == "STALE_OFFLINE"
    if explicitly_stale or (is_latest and (age > STALE_AFTER or station_offline)):
        type_ = AnomalyType.STALE_DATA
        detail = (
            f"Station is OFFLINE and its latest observation is {max(0, age.total_seconds() / 3600):.1f} hours old."
            if station_offline and is_latest
            else "Observation is explicitly marked stale/offline."
            if explicitly_stale
            else f"Latest observation is {max(0, age.total_seconds() / 3600):.1f} hours old; stale threshold is 6 hours."
        )
        findings.append((type_, detail, _QUALITY_WEIGHTS[type_.value]))

    return findings, bool(physical_issues or validation_status == "INVALID_VALUE")


def _channel_signals(
    observation: SensorObservation,
    histories: dict[str, list[tuple[datetime, float]]],
) -> tuple[dict[str, dict[str, object]], list[str], list[float], list[str]]:
    signals: dict[str, dict[str, object]] = {}
    reasons: list[str] = []
    weights: list[float] = []
    drift_reasons: list[str] = []
    observed_at = _utc(observation.timestamp)

    for channel, config in _CHANNELS.items():
        current = _value(observation, channel)
        history = histories[channel]
        if current is None or not history:
            continue

        prior_time, prior_value = history[-1]
        elapsed_hours = max(
            (observed_at - prior_time).total_seconds() / 3600,
            1 / 60,
        )
        delta = current - prior_value
        rate = abs(delta) / elapsed_hours
        rate_triggered = (
            rate > config["rate_limit"]
            and abs(delta) >= config["minimum_change"]
        )
        channel_reasons = []
        channel_weights = []

        previous_values = [value for _, value in history[-HISTORY_SIZE:]]
        if len(previous_values) >= MIN_HISTORY:
            center = median(previous_values)
            deviations = [abs(value - center) for value in previous_values]
            mad = median(deviations)
            robust_scale = max(1.4826 * mad, config["minimum_change"] / 4)
            robust_z = abs(current - center) / robust_scale
            temporal_triggered = (
                robust_z >= 4.0
                and abs(current - center) >= config["minimum_change"]
            )
            if temporal_triggered:
                channel_reasons.append(
                    f"{channel} deviates {robust_z:.1f} robust deviations from the prior {len(previous_values)} readings."
                )
                channel_weights.append(min(0.92, 0.60 + robust_z / 40))

        if rate_triggered:
            channel_reasons.append(
                f"{channel} changed {abs(delta):g} in {elapsed_hours:.2f} hour(s), or {rate:.1f} per hour, above the {config['rate_limit']:g} per-hour rule threshold."
            )
            channel_weights.append(min(0.90, 0.65 + rate / (config["rate_limit"] * 10)))

        prior_window = history[-3:]
        if len(prior_window) == 3:
            drift_values = [value for _, value in prior_window] + [current]
            drift_times = [timestamp for timestamp, _ in prior_window] + [observed_at]
            changes = [right - left for left, right in zip(drift_values, drift_values[1:])]
            span_hours = (drift_times[-1] - drift_times[0]).total_seconds() / 3600
            monotonic = all(change >= 0 for change in changes) or all(
                change <= 0 for change in changes
            )
            drift_range = max(drift_values) - min(drift_values)
            if (
                monotonic
                and span_hours >= 3
                and drift_range >= config["drift_range"]
                and not rate_triggered
            ):
                drift_reasons.append(
                    f"{channel} moved monotonically by {drift_range:g} across four readings over {span_hours:.1f} hours."
                )

        if channel_reasons:
            signals[channel] = {
                "direction": 1 if delta > 0 else -1,
                "rate": rate,
            }
            reasons.extend(channel_reasons)
            weights.extend(channel_weights)

    return signals, reasons, weights, drift_reasons


def _frozen_channels(
    observation: SensorObservation,
    runs: dict[str, list[tuple[datetime, float]]],
) -> list[str]:
    frozen = []
    observed_at = _utc(observation.timestamp)
    for channel, config in _CHANNELS.items():
        value = _value(observation, channel)
        if value is None:
            runs[channel].clear()
            continue
        run = runs[channel]
        run.append((observed_at, value))
        del run[:-5]
        if len(run) == 5:
            span_hours = (run[-1][0] - run[0][0]).total_seconds() / 3600
            if (
                len({timestamp for timestamp, _ in run}) == 5
                and span_hours >= 4
                and max(reading for _, reading in run)
                - min(reading for _, reading in run)
                <= config["frozen_epsilon"]
            ):
                frozen.append(channel)
    return frozen


def _result(
    observation: SensorObservation,
    anomaly_type: AnomalyType,
    severity: AnomalySeverity,
    reasons: list[str],
    weights: list[float],
    detected_at: datetime,
) -> AnomalyResult:
    detected = anomaly_type is not AnomalyType.NORMAL
    return AnomalyResult(
        station_id=observation.station_id,
        observation_id=observation.id or 0,
        observation_timestamp=observation.timestamp,
        anomaly_detected=detected,
        anomaly_type=anomaly_type,
        severity=severity,
        confidence=_confidence(weights) if detected else 0.0,
        reasons=reasons or ["No configured quality or anomaly rule was triggered."],
        detected_at=detected_at,
    )


def analyze_observations(
    observations: list[SensorObservation],
    stations: dict[str, AWSStation],
    station_id: str | None = None,
) -> list[AnomalyResult]:
    """Analyze AWS readings, using only station metadata and AWS sensor history."""
    grouped: dict[str, list[SensorObservation]] = defaultdict(list)
    for observation in observations:
        grouped[observation.station_id].append(observation)

    now = datetime.now(timezone.utc)
    candidates: dict[int, AnomalyResult] = {}
    signals_by_id: dict[int, dict[str, dict[str, object]]] = {}
    by_id: dict[int, SensorObservation] = {}

    for current_station_id, rows in grouped.items():
        station = stations.get(current_station_id)
        if station is None:
            continue
        rows.sort(key=lambda item: (_utc(item.timestamp), item.id or 0))
        latest = rows[-1]
        occurrences = Counter(_utc(row.timestamp) for row in rows)
        seen_timestamps: set[datetime] = set()
        histories: dict[str, list[tuple[datetime, float]]] = {
            channel: [] for channel in _CHANNELS
        }
        frozen_runs: dict[str, list[tuple[datetime, float]]] = {
            channel: [] for channel in _CHANNELS
        }

        for observation in rows:
            observation_id = observation.id or 0
            by_id[observation_id] = observation
            timestamp = _utc(observation.timestamp)
            duplicate_timestamp = (
                occurrences[timestamp] > 1 and timestamp in seen_timestamps
            )
            seen_timestamps.add(timestamp)
            is_latest = observation is latest
            quality, unusable_row = _quality_findings(
                observation,
                station,
                is_latest,
                duplicate_timestamp,
                now,
            )
            validation_status = _status(observation.validation_status)
            can_use_for_history = not unusable_row and not duplicate_timestamp and (
                validation_status not in {"STALE_OFFLINE", "DUPLICATE"}
            )

            channel_signals: dict[str, dict[str, object]] = {}
            signal_reasons: list[str] = []
            signal_weights: list[float] = []
            drift_reasons: list[str] = []
            if can_use_for_history:
                (
                    channel_signals,
                    signal_reasons,
                    signal_weights,
                    drift_reasons,
                ) = _channel_signals(observation, histories)
            signals_by_id[observation_id] = channel_signals

            frozen = []
            if can_use_for_history and not duplicate_timestamp:
                frozen = _frozen_channels(observation, frozen_runs)
            else:
                for channel in _CHANNELS:
                    frozen_runs[channel].clear()

            reasons = (
                [reason for _, reason, _ in quality]
                + signal_reasons
                + drift_reasons
            )
            weights = [weight for _, _, weight in quality] + signal_weights

            if quality:
                anomaly_type = quality[0][0]
                severity = {
                    AnomalyType.INVALID_DATA: AnomalySeverity.HIGH,
                    AnomalyType.MISSING_DATA: AnomalySeverity.LOW,
                    AnomalyType.POSSIBLE_COMMUNICATION_ERROR: AnomalySeverity.HIGH,
                    AnomalyType.STALE_DATA: AnomalySeverity.MEDIUM,
                }[anomaly_type]
                if (
                    anomaly_type
                    in {
                        AnomalyType.POSSIBLE_COMMUNICATION_ERROR,
                        AnomalyType.STALE_DATA,
                    }
                    and _status(station.status) == AWSStationStatus.OFFLINE.value
                ):
                    severity = AnomalySeverity.CRITICAL
            elif len(channel_signals) > 1:
                anomaly_type = AnomalyType.MULTIVARIATE_INCONSISTENCY
                severity = AnomalySeverity.HIGH
                reasons.append(
                    "Multiple AWS variables deviated together; cross-station context is checked before treating this as an isolated sensor fault."
                )
                weights.append(0.30)
            elif signal_reasons:
                strongest_channel = max(
                    channel_signals,
                    key=lambda channel: max(
                        float(channel_signals[channel]["rate"])
                        / float(_CHANNELS[channel]["rate_limit"]),
                        1.0,
                    ),
                )
                anomaly_type = _CHANNELS[strongest_channel]["anomaly_type"]
                severity = (
                    AnomalySeverity.HIGH
                    if any(weight >= 0.80 for weight in signal_weights)
                    else AnomalySeverity.MEDIUM
                )
                available_channels = [
                    channel
                    for channel in _CHANNELS
                    if _value(observation, channel) is not None
                ]
                if len(available_channels) > 1:
                    reasons.append(
                        "Other available AWS variables did not show a comparable deviation (multivariate consistency check)."
                    )
                    weights.append(0.20)
            elif drift_reasons:
                anomaly_type = AnomalyType.SENSOR_DRIFT
                severity = AnomalySeverity.MEDIUM
                weights.append(0.72)
            elif frozen:
                anomaly_type = AnomalyType.FROZEN_SENSOR
                severity = AnomalySeverity.MEDIUM
                reasons.extend(
                    f"{channel} remained within its freeze tolerance for five distinct readings spanning at least four hours."
                    for channel in frozen
                )
                weights.append(0.82)
            else:
                anomaly_type = AnomalyType.NORMAL
                severity = AnomalySeverity.NORMAL

            result = _result(
                observation,
                anomaly_type,
                severity,
                reasons,
                weights,
                now,
            )
            candidates[observation_id] = result

            if (
                can_use_for_history
                and not channel_signals
                and not drift_reasons
                and not frozen
            ):
                for channel in _CHANNELS:
                    value = _value(observation, channel)
                    if value is not None:
                        histories[channel].append((timestamp, value))
                        del histories[channel][:-HISTORY_SIZE]

    # A synchronized, same-direction channel change at another station is
    # evidence for a shared weather event, so it suppresses an isolated alarm.
    for observation_id, result in list(candidates.items()):
        channel_signals = signals_by_id.get(observation_id, {})
        if not result.anomaly_detected or not channel_signals:
            continue
        observation = by_id[observation_id]
        if result.anomaly_type in {
            AnomalyType.INVALID_DATA,
            AnomalyType.MISSING_DATA,
            AnomalyType.STALE_DATA,
            AnomalyType.POSSIBLE_COMMUNICATION_ERROR,
        }:
            continue

        corroboration: dict[str, set[str]] = defaultdict(set)
        for peer_id, peer in by_id.items():
            if peer.station_id == observation.station_id:
                continue
            if abs(_utc(peer.timestamp) - _utc(observation.timestamp)) > CROSS_STATION_WINDOW:
                continue
            for channel, signal in channel_signals.items():
                peer_signal = signals_by_id.get(peer_id, {}).get(channel)
                if peer_signal and peer_signal["direction"] == signal["direction"]:
                    corroboration[peer.station_id].add(channel)

        required_channels = 2 if len(channel_signals) > 1 else 1
        corroborating_stations = [
            peer_station
            for peer_station, matched in corroboration.items()
            if len(matched) >= required_channels
        ]
        if corroborating_stations:
            result = result.model_copy(
                update={
                    "anomaly_detected": False,
                    "anomaly_type": AnomalyType.NORMAL,
                    "severity": AnomalySeverity.NORMAL,
                    "confidence": 0.0,
                    "reasons": result.reasons
                    + [
                        "A same-direction change in the same variable(s) was observed within one hour at "
                        + ", ".join(sorted(corroborating_stations))
                        + "; this is more consistent with a shared meteorological event than an isolated sensor fault."
                    ],
                }
            )
            candidates[observation_id] = result

    results = [
        result
        for result in candidates.values()
        if station_id is None or result.station_id == station_id
    ]
    results.sort(
        key=lambda result: (
            _utc(result.observation_timestamp),
            result.observation_id,
        ),
        reverse=True,
    )
    return results