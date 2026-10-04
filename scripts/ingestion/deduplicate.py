"""Detect exact duplicates and basic version conflicts without deleting valid archives."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


def _normalized_content(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def _content_hash(text: str) -> str:
    return hashlib.sha256(_normalized_content(text).encode("utf-8")).hexdigest()


def _family_id(document_id: str) -> str:
    # Remove a terminal YYYYMMDD date or LEGACY token to compare document families.
    return re.sub(r"_(?:20\d{6}|LEGACY)$", "", document_id)


def analyze_duplicates(records: list[dict[str, Any]]) -> dict[str, Any]:
    id_seen: dict[str, int] = {}
    family_version_seen: dict[tuple[str, str], int] = {}
    hash_seen: dict[str, int] = {}
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for index, record in enumerate(records):
        doc_id = str(record.get("document_id", ""))
        version = str(record.get("version", ""))
        content = str(record.get("content", ""))

        if doc_id in id_seen:
            errors.append({
                "type": "duplicate_document_id",
                "document_id": doc_id,
                "records": [id_seen[doc_id], index],
            })
        else:
            id_seen[doc_id] = index

        fv = (_family_id(doc_id), version)
        if fv in family_version_seen:
            errors.append({
                "type": "duplicate_family_version",
                "family": fv[0],
                "version": version,
                "records": [family_version_seen[fv], index],
            })
        else:
            family_version_seen[fv] = index

        digest = _content_hash(content)
        if digest in hash_seen:
            other = hash_seen[digest]
            # Identical content can be a source duplication; report but do not auto-delete versions.
            warnings.append({
                "type": "identical_content",
                "records": [other, index],
                "document_ids": [records[other].get("document_id"), doc_id],
                "sha256": digest,
            })
        else:
            hash_seen[digest] = index

    return {
        "is_conflict_free": not errors,
        "record_count": len(records),
        "errors": errors,
        "warnings": warnings,
        "note": "Archived/expired versions are intentionally retained; only same ID or same family+version is a blocking conflict.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("corpus", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    records = json.loads(args.corpus.read_text(encoding="utf-8"))
    report = analyze_duplicates(records)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["is_conflict_free"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
