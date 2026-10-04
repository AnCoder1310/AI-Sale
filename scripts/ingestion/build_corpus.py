"""Build separate Knowledge and FAQ JSON datasets from Gate-2 raw ZIPs."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from deduplicate import analyze_duplicates
from normalize_documents import CORPUS_FIELDS, normalize_all
from validate_metadata import validate_corpus


def _extract_zip(zip_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(destination)


def build(
    product_zip: Path,
    knowledge_zip: Path,
    output: Path,
    reports_dir: Path,
    faq_output: Path | None = None,
) -> dict:
    faq_output = faq_output or output.with_name("faq.json")
    if output.resolve() == faq_output.resolve():
        raise ValueError("Knowledge and FAQ outputs must be different files")
    reports_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="vinfast_gate2_") as tmp:
        temp = Path(tmp)
        product_root = temp / "product"
        knowledge_root = temp / "knowledge"
        product_root.mkdir()
        knowledge_root.mkdir()
        _extract_zip(product_zip, product_root)
        _extract_zip(knowledge_zip, knowledge_root)

        records, trace = normalize_all(product_root, knowledge_root)

    # Enforce exact agreed field set and no sales_script before writing.
    records = [{field: item.get(field) for field in CORPUS_FIELDS} for item in records]

    validation = validate_corpus(records, dataset="combined")
    dedup = analyze_duplicates(records)

    (reports_dir / "validation_report.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (reports_dir / "dedup_report.json").write_text(
        json.dumps(dedup, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (reports_dir / "source_trace.json").write_text(
        json.dumps(trace, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if not validation["is_valid"]:
        raise ValueError("Corpus validation failed; see validation_report.json")
    if not dedup["is_conflict_free"]:
        raise ValueError("Duplicate/version conflict detected; see dedup_report.json")

    knowledge_records = [record for record in records if record["document_type"] != "faq"]
    faq_records = [record for record in records if record["document_type"] == "faq"]
    knowledge_validation = validate_corpus(knowledge_records, dataset="knowledge")
    faq_validation = validate_corpus(faq_records, dataset="faq")
    if not knowledge_validation["is_valid"] or not faq_validation["is_valid"]:
        raise ValueError("Split dataset validation failed")

    expected_models = {"VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9"}
    actual_product_models = {
        r["product_model"] for r in knowledge_records if r["document_type"] == "product_specs"
    }
    missing_models = sorted(expected_models - actual_product_models)
    faq_models = {record["product_model"] for record in faq_records}
    missing_faq_models = sorted(expected_models - faq_models)

    build_report = {
        "status": "success" if not (missing_models or missing_faq_models) else "failed",
        "output": str(output),
        "faq_output": str(faq_output),
        "record_count": len(records),
        "knowledge_record_count": len(knowledge_records),
        "faq_record_count": len(faq_records),
        "source_file_count": len(trace),
        "schema_fields": CORPUS_FIELDS,
        "sales_script_present": any("sales_script" in r for r in records),
        "product_models_covered": sorted(actual_product_models),
        "missing_required_product_models": missing_models,
        "faq_models_covered": sorted(faq_models),
        "missing_required_faq_models": missing_faq_models,
        "validation_passed": validation["is_valid"],
        "knowledge_validation_passed": knowledge_validation["is_valid"],
        "faq_validation_passed": faq_validation["is_valid"],
        "dedup_conflict_free": dedup["is_conflict_free"],
        "active_records": sum(r["status"] == "active" for r in records),
        "expired_records": sum(r["status"] == "expired" for r in records),
    }
    (reports_dir / "build_report.json").write_text(
        json.dumps(build_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if missing_models:
        raise ValueError(f"Missing product coverage: {missing_models}")
    if missing_faq_models:
        raise ValueError(f"Missing FAQ coverage: {missing_faq_models}")
    output.parent.mkdir(parents=True, exist_ok=True)
    faq_output.parent.mkdir(parents=True, exist_ok=True)
    faq_output.write_text(json.dumps(faq_records, ensure_ascii=False, indent=2), encoding="utf-8")
    output.write_text(json.dumps(knowledge_records, ensure_ascii=False, indent=2), encoding="utf-8")
    return build_report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-zip", type=Path, required=True)
    parser.add_argument("--knowledge-zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/knowledge/corpus.json"))
    parser.add_argument("--faq-output", type=Path, help="Defaults to faq.json beside --output")
    parser.add_argument("--reports-dir", type=Path, default=Path("data/processed/gate2"))
    args = parser.parse_args()

    report = build(args.product_zip, args.knowledge_zip, args.output, args.reports_dir, args.faq_output)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
