"""Normalize VinFast raw source files into Gate-2 corpus records.

Scope owned by Data/Gate 2 only:
raw PDF/HTML/Markdown -> cleaned NormalizedDocument-like dictionaries.
No chunking, embedding, vector DB, or backend runtime is implemented here.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import unicodedata
from datetime import date
from pathlib import Path
from typing import Iterable

try:
    from bs4 import BeautifulSoup
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: beautifulsoup4. Install it with: pip install beautifulsoup4"
    ) from exc


SNAPSHOT_DATE = "2026-09-22"
MODEL_MAP = {
    "vf3": "VF 3",
    "vf5": "VF 5",
    "vf6": "VF 6",
    "vf7": "VF 7",
    "vf8": "VF 8",
    "vf9": "VF 9",
}

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

_UI_ONLY = {
    "×",
    "đóng",
    "đặt cọc",
    "đặt cọc ngay",
    "đăng ký tư vấn",
    "đăng ký lái thử",
    "nhận ưu đãi",
    "nhận tư vấn",
    "xem chi tiết",
    "tải brochure",
    "đăng nhập / đăng ký",
    "-->",
    "về đầu trang",
    "tại đây",
}

_NOISY_TOKENS = (
    "header",
    "footer",
    "navigation",
    "navbar",
    "breadcrumb",
    "cookie",
    "modal",
    "popup",
    "drawer",
    "sticky",
    "login",
    "compare",
    "comparison",
    "calculator",
)


def _clean_line(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\xa0", " ").replace("\u200b", "")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _join_blocks(lines: Iterable[str]) -> str:
    """Make paragraph boundaries explicit for downstream chunking without chunking here."""
    cleaned: list[str] = []
    previous = None
    for raw in lines:
        line = _clean_line(raw)
        if not line:
            continue
        if line.casefold() in _UI_ONLY:
            continue
        if line == previous:
            continue
        cleaned.append(line)
        previous = line
    return "\n\n".join(cleaned).strip()


def _canonical_url(soup: BeautifulSoup) -> str | None:
    canonical = soup.find("link", rel=lambda value: value and "canonical" in value)
    if canonical and canonical.get("href"):
        return str(canonical["href"]).strip()
    og_url = soup.find("meta", attrs={"property": "og:url"})
    if og_url and og_url.get("content"):
        return str(og_url["content"]).strip()
    return None


def _remove_noise(soup: BeautifulSoup) -> None:
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav", "form"]):
        tag.decompose()

    for tag in list(soup.find_all(True)):
        if getattr(tag, "attrs", None) is None:
            continue
        attrs = " ".join(
            [
                str(tag.get("id") or ""),
                " ".join(tag.get("class") or []),
            ]
        ).casefold()
        if any(token in attrs for token in _NOISY_TOKENS):
            tag.decompose()


def _extract_faq_html(path: Path, model_slug: str) -> tuple[str, str, str]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    title = f"Câu hỏi thường gặp VinFast {MODEL_MAP[model_slug]}"
    source = _canonical_url(soup) or f"VinFast official FAQ snapshot: {path.name}"

    marker = soup.find(attrs={"data-id": model_slug.replace("vf", "vf-")})
    # Some pages use vf-3, vf-6, vf-9; try exact folder-to-id mapping.
    expected_id = f"vf-{model_slug[-1]}"
    marker = marker or soup.find(attrs={"data-id": expected_id})
    block = marker.find_parent("div", class_="child-block") if marker else None

    if block:
        qa_blocks: list[str] = []
        for post in block.select("div.post"):
            q = post.select_one(".post-title")
            a = post.select_one(".post-content")
            if not q or not a:
                continue
            q_text = _clean_line(q.get_text(" ", strip=True))
            answer_lines = [_clean_line(x) for x in a.stripped_strings if _clean_line(x)]
            if q_text and answer_lines:
                qa_blocks.append(f"## {q_text}\n" + "\n".join(answer_lines))
        if qa_blocks:
            return title, source, "\n\n".join(qa_blocks)

    # Safe fallback: strip site chrome, then keep cleaned text.
    _remove_noise(soup)
    root = soup.find("main") or soup.body or soup
    return title, source, _join_blocks(root.stripped_strings)


def _extract_product_html(path: Path, model: str) -> tuple[str, str, str]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    raw_title = soup.title.get_text(" ", strip=True) if soup.title else f"VinFast {model} product page"
    title = re.sub(r"\s*\|\s*VinFast\s*$", "", raw_title).strip()
    source = _canonical_url(soup) or f"VinFast official product page snapshot: {path.name}"

    _remove_noise(soup)
    root = soup.find("main") or soup.body or soup
    lines = list(root.stripped_strings)
    content = _join_blocks(lines)
    return title, source, content


def _extract_markdown(path: Path, model: str) -> tuple[str, str, str]:
    text = path.read_text(encoding="utf-8", errors="ignore").replace("\xa0", " ")
    url_match = re.search(r"\((https?://[^)]+)\)", text)
    source = url_match.group(1) if url_match else f"VinFast FAQ snapshot: {path.name}"
    title = f"Câu hỏi thường gặp VinFast {model}"

    lines: list[str] = []
    for raw in text.splitlines():
        line = _clean_line(raw)
        if not line:
            continue
        # Remove generic category headers and the link-only model heading.
        if line in {"## Ô tô VinFast", "### Thông tin sản phẩm"}:
            continue
        if line.startswith("### ["):
            continue
        lines.append(line)
    return title, source, _join_blocks(lines)


def _extract_pdf(path: Path) -> str:
    """Prefer pdftotext -layout to keep tables; pypdf is a fallback."""
    if shutil.which("pdftotext"):
        proc = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        text = proc.stdout.decode("utf-8", errors="ignore")
    else:  # pragma: no cover - fallback for environments without poppler
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("PDF extraction requires pdftotext or pypdf") from exc
        reader = PdfReader(str(path))
        text = "\n\n".join((page.extract_text() or "") for page in reader.pages)

    text = text.replace("\f", "\n\n")
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        # Remove obvious repeating page-number footers while keeping legal text.
        if re.fullmatch(r"(?:Trang|Page)\s+\d+(?:\s+(?:của|of)\s+\d+)?", stripped, re.I):
            continue
        # Convert layout columns to readable separators.
        line = re.sub(r"\s{2,}", " | ", stripped)
        lines.append(line)
    return _join_blocks(lines)


def _extract_web_terms(path: Path) -> tuple[str, str, str]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    canonical = _canonical_url(soup)
    source = (
        canonical
        if canonical and "dev-cms" not in canonical
        else f"VinFast official website snapshot: Điều khoản đặt cọc ({SNAPSHOT_DATE})"
    )

    # Prefer the specific accordion/card for deposit terms, not the entire legal page.
    target = None
    for button in soup.find_all("button"):
        if _clean_line(button.get_text(" ", strip=True)).casefold() == "điều khoản đặt cọc".casefold():
            card = button.find_parent(class_="card")
            if card:
                target = card.find(class_="card-body")
                if target:
                    break
    if target is None:
        # Fallback: choose a card-body whose text explicitly discusses deposit terms.
        candidates = soup.select(".card-body")
        target = next(
            (c for c in candidates if "Điều Khoản Đặt Cọc" in c.get_text(" ", strip=True)),
            None,
        )
    target = target or soup.body or soup
    content = _join_blocks(target.stripped_strings)
    return "Điều khoản đặt cọc mua xe VinFast", source, content


def _doc_code_date(content: str) -> str | None:
    match = re.search(r"Mã văn bản:\s*(20\d{6,7})_", content, re.I)
    if not match:
        return None
    raw = match.group(1)
    if len(raw) == 8:
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    # One archived source contains the malformed-looking code 202600805;
    # preserve its apparent YYYY-MM-DD meaning from the trailing MMDD.
    return f"{raw[0:4]}-{raw[-4:-2]}-{raw[-2:]}"


def _filename_date(path: Path) -> str | None:
    match = re.match(r"(20\d{2})-(\d{2})(?:-(\d{2}))?", path.name)
    if not match:
        return None
    year, month, day = match.groups()
    return f"{year}-{month}-{day or '01'}"


def _first_global_effective_date(content: str) -> str | None:
    # Use only a clearly labeled global "Thời gian áp dụng" statement.
    patterns = [
        r"Thời gian áp dụng:\s*Áp dụng từ ngày\s*(\d{1,2})/(\d{1,2})/(20\d{2})",
        r"Thời gian áp dụng:\s*Từ ngày\s*(\d{1,2})/(\d{1,2})/(20\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, content, re.I)
        if match:
            d, m, y = match.groups()
            return f"{y}-{int(m):02d}-{int(d):02d}"
    return None


def _slug_date(value: str) -> str:
    return value.replace("-", "")


def _knowledge_metadata(path: Path, content: str, bucket: str) -> dict:
    lower = path.name.casefold()
    status = "expired" if bucket == "archive_for_versioning" else "active"

    code_date = _doc_code_date(content)
    file_date = _filename_date(path)
    effective = _first_global_effective_date(content) or code_date or file_date or SNAPSHOT_DATE
    version_date = code_date or file_date or SNAPSHOT_DATE
    version = version_date.replace("-", ".")

    if "chinh-sach-gia-ban" in lower:
        return {
            "document_id": f"PRICE_LIST_VINFAST_{_slug_date(version_date)}",
            "document_type": "price_list",
            "policy_type": "general",
            "effective_date": effective,
            "version": version,
            "status": status,
        }
    if "chinh-sach-thuc-day-ban-hang" in lower:
        return {
            "document_id": f"PROMOTION_SALES_VINFAST_{_slug_date(version_date)}",
            "document_type": "promotion",
            "policy_type": "general",
            # This document contains several sub-programs with different date ranges;
            # use the document issue/version date rather than one nested program date.
            "effective_date": code_date or file_date or effective,
            "version": version,
            "status": status,
        }
    if "chinh-sach-uu-dai-sac-pin" in lower:
        return {
            "document_id": f"POLICY_CHARGING_VINFAST_{_slug_date(version_date)}",
            "document_type": "policy",
            "policy_type": "charging",
            "effective_date": effective,
            "version": version,
            "status": status,
        }
    if "chinh-sach-vinclub" in lower:
        return {
            "document_id": f"PROMOTION_VINCLUB_{_slug_date(version_date)}",
            "document_type": "promotion",
            "policy_type": "general",
            "effective_date": effective,
            "version": version,
            "status": status,
        }
    if "mau-hop-dong-thue-pin" in lower:
        return {
            "document_id": f"POLICY_BATTERY_RENTAL_CONTRACT_{_slug_date(version_date)}",
            "document_type": "policy",
            "policy_type": "battery",
            "effective_date": file_date or effective,
            "version": version,
            "status": status,
        }
    if "mau-hop-dong-mua-ban" in lower:
        explicit = re.search(r"VER\s*([0-9]+(?:\.[0-9]+)?)", content, re.I)
        return {
            "document_id": f"POLICY_SALES_CONTRACT_{_slug_date(version_date)}",
            "document_type": "policy",
            "policy_type": "general",
            "effective_date": file_date or effective,
            "version": explicit.group(1) if explicit else version,
            "status": status,
        }
    raise ValueError(f"Unsupported knowledge PDF: {path}")


def normalize_product_sources(product_root: Path) -> tuple[list[dict], list[dict]]:
    records: list[dict] = []
    trace: list[dict] = []
    base = product_root / "vinfast-product-spec"
    if not base.exists():
        candidates = list(product_root.rglob("vinfast-product-spec"))
        if not candidates:
            raise FileNotFoundError("Could not find vinfast-product-spec directory")
        base = candidates[0]

    for path in sorted(p for p in base.rglob("*") if p.is_file()):
        slug = path.parent.name.casefold()
        if slug not in MODEL_MAP:
            continue
        model = MODEL_MAP[slug]
        name_lower = path.name.casefold()
        is_faq = "faq" in name_lower
        status = "expired" if "old" in name_lower else "active"
        suffix = "LEGACY" if status == "expired" else SNAPSHOT_DATE.replace("-", "")

        if path.suffix.casefold() == ".html" and is_faq:
            title, source, content = _extract_faq_html(path, slug)
        elif path.suffix.casefold() == ".html":
            title, source, content = _extract_product_html(path, model)
        elif path.suffix.casefold() == ".md" and is_faq:
            title, source, content = _extract_markdown(path, model)
        else:
            continue

        kind = "FAQ" if is_faq else "PRODUCT"
        record = {
            "document_id": f"{kind}_{model.replace(' ', '')}_{suffix}",
            "title": title,
            "document_type": "faq" if is_faq else "product_specs",
            "product_model": model,
            "competitor_model": None,
            "policy_type": None,
            "effective_date": SNAPSHOT_DATE,
            "expiry_date": None,
            "source": source,
            "version": "legacy" if status == "expired" else SNAPSHOT_DATE.replace("-", "."),
            "status": status,
            "content": content,
        }
        records.append(record)
        trace.append({"document_id": record["document_id"], "source_file": str(path.relative_to(product_root))})
    return records, trace


def normalize_knowledge_sources(knowledge_root: Path) -> tuple[list[dict], list[dict]]:
    records: list[dict] = []
    trace: list[dict] = []
    base = knowledge_root / "vinfast-knowledge"
    if not base.exists():
        candidates = list(knowledge_root.rglob("vinfast-knowledge"))
        if not candidates:
            raise FileNotFoundError("Could not find vinfast-knowledge directory")
        base = candidates[0]

    for path in sorted(p for p in base.rglob("*") if p.is_file()):
        bucket = path.parent.name
        if path.suffix.casefold() == ".pdf":
            content = _extract_pdf(path)
            meta = _knowledge_metadata(path, content, bucket)
            title = content.split("\n\n", 1)[0].strip()
            code = re.search(r"Mã văn bản:\s*([^\n|]+)", content, re.I)
            source = f"VinFast official PDF: {code.group(1).strip()}" if code else f"VinFast official PDF: {path.name}"
            record = {
                **meta,
                "title": title,
                "product_model": "ALL",
                "competitor_model": None,
                "expiry_date": None,
                "source": source,
                "content": content,
            }
        elif path.suffix.casefold() == ".html" and "dieu-khoan-dat-coc" in path.name.casefold():
            title, source, content = _extract_web_terms(path)
            record = {
                "document_id": f"POLICY_DEPOSIT_TERMS_{SNAPSHOT_DATE.replace('-', '')}",
                "title": title,
                "document_type": "policy",
                "product_model": "ALL",
                "competitor_model": None,
                "policy_type": "general",
                "effective_date": SNAPSHOT_DATE,
                "expiry_date": None,
                "source": source,
                "version": SNAPSHOT_DATE.replace("-", "."),
                "status": "active",
                "content": content,
            }
        else:
            continue

        # Reorder exactly to the agreed corpus schema.
        record = {field: record.get(field) for field in CORPUS_FIELDS}
        records.append(record)
        trace.append({"document_id": record["document_id"], "source_file": str(path.relative_to(knowledge_root))})
    return records, trace


def normalize_all(product_root: Path, knowledge_root: Path) -> tuple[list[dict], list[dict]]:
    product_records, product_trace = normalize_product_sources(product_root)
    knowledge_records, knowledge_trace = normalize_knowledge_sources(knowledge_root)
    records = product_records + knowledge_records
    records = [{field: item.get(field) for field in CORPUS_FIELDS} for item in records]
    records.sort(key=lambda x: (x["document_type"], x["product_model"], x["document_id"]))
    return records, product_trace + knowledge_trace
