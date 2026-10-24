
from datetime import datetime, timezone, timedelta

from app.services.date_filters import normalize_datetime_filter


def test_naive_datetime_is_treated_as_utc():
    value = datetime(2026, 10, 22, 12, 30)

    result = normalize_datetime_filter(value)

    assert result == datetime(
        2026, 10, 22, 12, 30, tzinfo=timezone.utc
    )


def test_aware_datetime_is_converted_to_utc():
    value = datetime(
        2026, 10, 22, 18, 0,
        tzinfo=timezone(timedelta(hours=6)),
    )

    result = normalize_datetime_filter(value)

    assert result == datetime(
        2026, 10, 22, 12, 0, tzinfo=timezone.utc
    )


def test_date_only_end_includes_the_entire_day():
    value = datetime(2026, 10, 22)

    result = normalize_datetime_filter(value, end_of_day=True)

    assert result == datetime(
        2026, 10, 22, 23, 59, 59, 999999,
        tzinfo=timezone.utc,
    )


def test_none_remains_none():
    assert normalize_datetime_filter(None) is None
    assert normalize_datetime_filter(None, end_of_day=True) is None


def test_explicit_non_midnight_end_is_preserved():
    value = datetime(2026, 10, 22, 14, 30)

    result = normalize_datetime_filter(value, end_of_day=True)

    assert result == datetime(
        2026, 10, 22, 14, 30, tzinfo=timezone.utc
    )
