
from datetime import datetime, timedelta, timezone


def normalize_datetime_filter(
    value: datetime | None,
    *,
    end_of_day: bool = False,
) -> datetime | None:
    """
    Treat naive datetimes as UTC and convert aware datetimes to UTC.

    When end_of_day=True, a midnight end value is interpreted as a
    date-only filter and extended through the end of that UTC day.
    """
    if value is None:
        return None

    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)

    if (
        end_of_day
        and value.hour == 0
        and value.minute == 0
        and value.second == 0
        and value.microsecond == 0
    ):
        value = value + timedelta(days=1) - timedelta(microseconds=1)

    return value


def normalize_stored_datetime(value: datetime) -> datetime:
    """Normalize a datetime returned by the database to UTC."""
    normalized = normalize_datetime_filter(value)
    assert normalized is not None
    return normalized
