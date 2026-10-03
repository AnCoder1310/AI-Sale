"""Gate 2 corpus and build checks; no embedding or external services required."""

import json
import sys
from pathlib import Path
from zipfile import ZipFile

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ingestion"))

from deduplicate import analyze_duplicates  # noqa: E402
from validate_metadata import CORPUS_FIELDS, validate_corpus  # noqa: E402


@pytest.fixture
def corpus():
    return json.loads((ROOT / "data" / "knowledge" / "corpus.json").read_text(encoding="utf-8"))


@pytest.fixture
def faq():
    return json.loads((ROOT / "data" / "knowledge" / "faq.json").read_text(encoding="utf-8"))


def test_dataset_contracts(corpus, faq):
    assert (len(corpus), len(faq), len(corpus) + len(faq)) == (17, 6, 23)
    assert all(record["document_type"] != "faq" for record in corpus)
    assert all(record["document_type"] == "faq" for record in faq)
    assert all(list(record) == CORPUS_FIELDS for record in corpus + faq)
    assert all("sales_script" not in record for record in corpus + faq)
    knowledge_ids = {record["document_id"] for record in corpus}
    faq_ids = {record["document_id"] for record in faq}
    assert len(knowledge_ids) == len(corpus)
    assert len(faq_ids) == len(faq)
    assert knowledge_ids.isdisjoint(faq_ids)
    assert validate_corpus(corpus, dataset="knowledge")["is_valid"]
    assert validate_corpus(faq, dataset="faq")["is_valid"]
    assert analyze_duplicates(corpus + faq)["is_conflict_free"]


def test_product_coverage_and_archives(corpus, faq):
    expected = {"VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9"}
    product_models = {record["product_model"] for record in corpus if record["document_type"] == "product_specs"}
    faq_models = [record["product_model"] for record in faq]
    assert product_models == expected
    assert set(faq_models) == expected
    assert len(faq_models) == len(set(faq_models))
    assert any(record["status"] == "expired" for record in corpus)
    assert any(record["document_id"] == "FAQ_VF8_LEGACY" for record in faq)
    assert any(record["document_id"] == "POLICY_CHARGING_VINFAST_20260424" for record in corpus)


def test_dataset_validation_rejects_wrong_document_type(corpus, faq):
    assert not validate_corpus(faq, dataset="knowledge")["is_valid"]
    assert not validate_corpus(corpus, dataset="faq")["is_valid"]


def test_validation_rejects_bad_metadata(corpus):
    invalid = dict(corpus[0])
    invalid.pop("source")
    invalid["content"] = 123
    invalid["effective_date"] = "20260230"
    invalid["sales_script"] = "not part of the clean corpus"
    errors = validate_corpus([invalid])["errors"]
    assert any("missing fields" in error and "source" in error for error in errors)
    assert any("content" in error for error in errors)
    assert any("invalid date" in error for error in errors)
    assert any("sales_script" in error for error in errors)
    assert not validate_corpus({"document_id": "bad"})["is_valid"]
    assert not validate_corpus([None])["is_valid"]
    assert not validate_corpus([])["is_valid"]


def test_validation_rejects_duplicate_id(corpus):
    report = validate_corpus([corpus[0], corpus[0]])
    assert not report["is_valid"]
    assert any("duplicate document_id" in error for error in report["errors"])


def test_dedup_distinguishes_archive_from_version_conflict(corpus):
    old = next(record for record in corpus if record["document_id"] == "POLICY_CHARGING_VINFAST_20260424")
    current = next(record for record in corpus if record["document_id"] == "POLICY_CHARGING_VINFAST_20260919")
    assert analyze_duplicates([old, current])["is_conflict_free"]
    conflict = {**current, "version": old["version"]}
    report = analyze_duplicates([old, conflict])
    assert not report["is_conflict_free"]
    assert any(error["type"] == "duplicate_family_version" for error in report["errors"])


def _raw_archives(tmp_path, models):
    product_zip = tmp_path / "product.zip"
    knowledge_zip = tmp_path / "knowledge.zip"
    with ZipFile(product_zip, "w") as archive:
        for model in models:
            slug = model.replace(" ", "").lower()
            html = (
                "<html><head><link rel='canonical' href='https://example.org/"
                + slug
                + "'></head><body><main><h1>"
                + model
                + "</h1><p>Official model description with enough text for the clean corpus "
                "validation check.</p></main></body></html>"
            )
            archive.writestr(f"vinfast-product-spec/{slug}/product.html", html)
            faq_name = "faq-old.html" if model == "VF 8" else "faq.html"
            archive.writestr(
                f"vinfast-product-spec/{slug}/{faq_name}",
                "<html><body><main>Frequently asked questions for this model with enough "
                "explanatory text to pass corpus validation.</main></body></html>",
            )
    with ZipFile(knowledge_zip, "w") as archive:
        archive.writestr("vinfast-knowledge/.keep", "")
    return product_zip, knowledge_zip


def test_build_creates_reproducible_corpus_and_keeps_archive(tmp_path):
    pytest.importorskip("bs4")
    from build_corpus import build

    models = {"VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9"}
    product_zip, knowledge_zip = _raw_archives(tmp_path, models)
    output = tmp_path / "corpus.json"
    report = build(product_zip, knowledge_zip, output, tmp_path / "reports")
    first_output = output.read_bytes()
    first_faq_output = (tmp_path / "faq.json").read_bytes()
    assert report["status"] == "success"
    assert (report["knowledge_record_count"], report["faq_record_count"]) == (6, 6)
    assert all(record["document_type"] != "faq" for record in json.loads(first_output))
    assert any(record["document_id"] == "FAQ_VF8_LEGACY" for record in json.loads(first_faq_output))
    build(product_zip, knowledge_zip, output, tmp_path / "reports")
    assert output.read_bytes() == first_output
    assert (tmp_path / "faq.json").read_bytes() == first_faq_output


def test_build_splits_all_current_records(tmp_path, corpus, faq, monkeypatch):
    pytest.importorskip("bs4")
    import build_corpus

    product_zip = tmp_path / "product.zip"
    knowledge_zip = tmp_path / "knowledge.zip"
    with ZipFile(product_zip, "w"), ZipFile(knowledge_zip, "w"):
        pass
    monkeypatch.setattr(build_corpus, "normalize_all", lambda _product, _knowledge: (corpus + faq, []))
    output = tmp_path / "corpus.json"
    report = build_corpus.build(product_zip, knowledge_zip, output, tmp_path / "reports")
    assert (report["knowledge_record_count"], report["faq_record_count"]) == (17, 6)
    assert json.loads(output.read_text(encoding="utf-8")) == corpus
    assert json.loads((tmp_path / "faq.json").read_text(encoding="utf-8")) == faq


def test_failed_build_does_not_replace_output(tmp_path):
    pytest.importorskip("bs4")
    from build_corpus import build

    product_zip, knowledge_zip = _raw_archives(tmp_path, {"VF 3"})
    output = tmp_path / "corpus.json"
    output.write_text("existing corpus", encoding="utf-8")
    faq_output = tmp_path / "faq.json"
    faq_output.write_text("existing FAQ", encoding="utf-8")
    with pytest.raises(ValueError, match="Missing product coverage"):
        build(product_zip, knowledge_zip, output, tmp_path / "reports")
    assert output.read_text(encoding="utf-8") == "existing corpus"
    assert faq_output.read_text(encoding="utf-8") == "existing FAQ"
