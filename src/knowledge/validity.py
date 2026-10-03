"""Shared date handling for dense and sparse knowledge retrieval."""

from datetime import date, datetime, timedelta, timezone

from src.knowledge.schemas import ChunkMetadata


def today_in_vietnam() -> date:
    return datetime.now(timezone(timedelta(hours=7))).date()


def parse_target_date(value: date | str | None) -> date | None:
    if value is None:
        return None
    if type(value) is date:
        return value
    return date.fromisoformat(str(value))


def is_document_retrievable(metadata: ChunkMetadata, target_date: date | None = None) -> bool:
    """Only current active documents or dated historical documents may be used."""
    if metadata.status not in {"active", "expired"}:
        return False
    try:
        effective_from = parse_target_date(metadata.effective_date)
        effective_to = parse_target_date(metadata.expiry_date)
    except ValueError:
        return False
    lookup_date = target_date or today_in_vietnam()
    if target_date is None and metadata.status != "active":
        return False
    if metadata.status == "expired" and effective_to is None:
        return False
    if effective_from and effective_from > lookup_date:
        return False
    return not (effective_to and effective_to < lookup_date)
