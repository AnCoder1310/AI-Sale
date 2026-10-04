"""Validate the Gate-2 Knowledge corpus and separate FAQ dataset.

Schema = corpus.json Gate 1 minus sales_script, keeping all other fields.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

CORPUS_FIELDS = [
    "document_id",
    "title",
    "document_type",
    "product_model",
    "competitor_model",
    "policy_type",
    "effective_date",
    "expiry_date",
    "source",
    "version",
    "status",
    "content",
]
REQUIRED_NON_NULL = {
    "document_id",
    "title",
    "document_type",
    "product_model",
    "effective_date",
    "source",
    "version",
    "status",
    "content",
}
DOCUMENT_TYPES = {"product_specs", "battlecard", "price_list", "policy", "promotion", "faq"}
KNOWLEDGE_DOCUMENT_TYPES = DOCUMENT_TYPES - {"faq"}
POLICY_TYPES = {None, "battery", "charging", "financing", "trade_in", "general"}
STATUSES = {"active", "expired", "draft"}
PRODUCT_MODELS = {"VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9", "ALL"}


def _date_or_none(value: Any) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("must be an ISO date string (YYYY-MM-DD) or null")
    return date.fromisoformat(value)


def validate_record(record: dict[str, Any], index: int | None = None, dataset: str = "knowledge") -> list[str]:
    if dataset not in {"knowledge", "faq", "combined"}:
        raise ValueError(f"Unknown dataset: {dataset}")
    if not isinstance(record, dict):
        return [f"record[{index}]: expected an object"]
    prefix = f"record[{index}]" if index is not None else str(record.get("document_id", "record"))
    errors: list[str] = []

    keys = set(record)
    missing = set(CORPUS_FIELDS) - keys
    extra = keys - set(CORPUS_FIELDS)
    if missing:
        errors.append(f"{prefix}: missing fields: {sorted(missing)}")
    if extra:
        errors.append(f"{prefix}: unexpected fields: {sorted(extra)}")
    if "sales_script" in record:
        errors.append(f"{prefix}: sales_script must be removed in Gate 2 corpus")

    for field in sorted(REQUIRED_NON_NULL):
        value = record.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{prefix}: required field '{field}' must be a non-empty string")

    if record.get("competitor_model") is not None and not isinstance(record["competitor_model"], str):
        errors.append(f"{prefix}: competitor_model must be a string or null")
    if record.get("policy_type") is not None and not isinstance(record["policy_type"], str):
        errors.append(f"{prefix}: policy_type must be a string or null")

    if dataset == "faq":
        allowed_types = {"faq"}
    elif dataset == "combined":
        allowed_types = DOCUMENT_TYPES
    else:
        allowed_types = KNOWLEDGE_DOCUMENT_TYPES
    if not isinstance(record.get("document_type"), str) or record["document_type"] not in allowed_types:
        errors.append(f"{prefix}: invalid document_type={record.get('document_type')!r}")
    if not isinstance(record.get("policy_type"), (str, type(None))) or record.get("policy_type") not in POLICY_TYPES:
        errors.append(f"{prefix}: invalid policy_type={record.get('policy_type')!r}")
    if not isinstance(record.get("status"), str) or record["status"] not in STATUSES:
        errors.append(f"{prefix}: invalid status={record.get('status')!r}")
    if not isinstance(record.get("product_model"), str) or record["product_model"] not in PRODUCT_MODELS:
        errors.append(f"{prefix}: invalid product_model={record.get('product_model')!r}")

    if record.get("document_type") == "battlecard" and not record.get("competitor_model"):
        errors.append(f"{prefix}: battlecard requires competitor_model")
    if record.get("document_type") != "battlecard" and record.get("competitor_model") is not None:
        errors.append(f"{prefix}: competitor_model should be null outside battlecard")

    try:
        effective = _date_or_none(record.get("effective_date"))
        expiry = _date_or_none(record.get("expiry_date"))
        if effective and expiry and expiry < effective:
            errors.append(f"{prefix}: expiry_date precedes effective_date")
    except ValueError as exc:
        errors.append(f"{prefix}: invalid date: {exc}")

    content = record.get("content")
    if isinstance(content, str) and len(content.strip()) < 50:
        errors.append(f"{prefix}: content is suspiciously short (<50 chars)")

    return errors


def validate_corpus(records: list[dict[str, Any]], dataset: str = "knowledge") -> dict[str, Any]:
    if dataset not in {"knowledge", "faq", "combined"}:
        raise ValueError(f"Unknown dataset: {dataset}")
    if not isinstance(records, list):
        return {"is_valid": False, "record_count": 0, "errors": ["corpus: expected a JSON array"], "summary": {}}
    errors: list[str] = []
    if not records:
        errors.append("corpus: no records")
    ids: dict[str, int] = {}
    by_type: dict[str, int] = {}
    by_model: dict[str, int] = {}
    by_status: dict[str, int] = {}

    for index, record in enumerate(records):
        errors.extend(validate_record(record, index=index, dataset=dataset))
        if not isinstance(record, dict):
            continue
        doc_id = record.get("document_id")
        if isinstance(doc_id, str):
            if doc_id in ids:
                errors.append(f"record[{index}]: duplicate document_id '{doc_id}' also used by record[{ids[doc_id]}]")
            else:
                ids[doc_id] = index
        for target, key in ((by_type, "document_type"), (by_model, "product_model"), (by_status, "status")):
            value = str(record.get(key))
            target[value] = target.get(value, 0) + 1

    return {
        "is_valid": not errors,
        "record_count": len(records),
        "errors": errors,
        "summary": {
            "by_document_type": dict(sorted(by_type.items())),
            "by_product_model": dict(sorted(by_model.items())),
            "by_status": dict(sorted(by_status.items())),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("corpus", type=Path)
    parser.add_argument("--dataset", choices=("knowledge", "faq", "combined"), default="knowledge")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    records = json.loads(args.corpus.read_text(encoding="utf-8"))
    report = validate_corpus(records, dataset=args.dataset)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["is_valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
