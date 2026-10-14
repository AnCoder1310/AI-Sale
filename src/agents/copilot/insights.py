"""Deterministic, snapshot-grounded Product Insights builder.

Builds complementary insight cards strictly from verified sources, without repeating
facts already stated in the main answer or deleting essential conditions/disclaimers.
"""

import hashlib
import re
from typing import Literal

from src.agents.copilot.state import Citation, ProductInsight


def _resolve_category(document_type: str | None) -> Literal["highlight", "policy"]:
    if not document_type:
        return "highlight"
    doc_type_lower = document_type.strip().lower()
    if doc_type_lower in {"policy", "promotion"}:
        return "policy"
    return "highlight"


def _extract_sentences(raw_text: str) -> list[str]:
    """Split text into distinct, coherent sentences, protecting numbers, dates and acronyms."""
    normalized = re.sub(r"[\r\n]+", "\n", raw_text)
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    raw_sentences: list[str] = []

    for line in lines:
        if re.match(r"^[\s\|\-\:\+]+$", line):
            continue
        if re.search(
            r"^(?:Hợp đồng|Cộng hòa xã hội|Độc lập|Số:\s*\[|CCCD|Mã số doanh nghiệp|Các Bên thống nhất|ĐIỀU \d+|Mọi tranh chấp|Khi xảy ra sự kiện bất khả kháng|Điện thoại\s*\|)",
            line,
            re.I,
        ):
            continue

        # Protect numbers with decimal or comma separators (e.g. 3.858, 160.000, 7,5) and dates
        protected = re.sub(r"(\d+)[\.,](\d+)", r"\1__NUM__\2", line)
        parts = re.split(r"(?<=[.!?])\s+", protected)
        for p in parts:
            restored = p.replace("__NUM__", ".").strip()
            restored = re.sub(r"^[-•+*o\d\.]+\s*", "", restored).strip()
            restored = re.sub(r"^\|\s*|\s*\|$", "", restored).strip()
            if len(restored) >= 10:
                raw_sentences.append(restored)

    return raw_sentences


def _score_sentence(s: str, category: str) -> float:
    """Score a sentence by its relevance to vehicle highlights or active commercial policies."""
    score = 0.0
    s_lower = s.lower()

    if "(*) lưu ý" in s_lower or "điều kiện" in s_lower or "chưa có sẵn" in s_lower:
        score += 3.5

    if re.search(
        r"\b\d+(?:[\.,]\d+)?\s*(?:triệu|tỷ|km|kwh|năm|tháng|%|hp|nm|kw|phút|giờ|vnđ|đồng)\b",
        s_lower,
    ):
        score += 2.5

    if category == "policy":
        policy_keywords = [
            "ưu đãi", "miễn phí", "áp dụng", "đơn giá", "sạc", "trụ sạc", "thuê pin",
            "bảo hành", "chi phí", "thời hạn", "hóa đơn", "biểu phí", "quy định", "hợp đồng"
        ]
        for kw in policy_keywords:
            if kw in s_lower:
                score += 1.0
    else:  # highlight
        highlight_keywords = [
            "công suất", "động cơ", "quãng đường", "pin", "adas", "an toàn",
            "tính năng", "trang bị", "thông minh", "thiết kế", "tiện nghi", "vận hành", "bảo hành"
        ]
        for kw in highlight_keywords:
            if kw in s_lower:
                score += 1.0

    return score


def _clean_summary(excerpt: str | None, title: str | None, category: str = "highlight") -> str:
    """Produce a concise 1-3 sentence summary focusing on highlights and active policies."""
    raw = (excerpt or "").strip()
    if not raw:
        raw = (title or "").strip()
    if not raw:
        return "Thông tin và chính sách đối chiếu theo tài liệu chính thức."

    # Remove marketing lead capture boilerplate only
    raw = re.sub(r"Vui lòng để lại thông tin[^\.\n]*[\.\n]?", "", raw, flags=re.I)
    raw = re.sub(r"Các thông tin sản phẩm có thể thay đổi[^\.\n]*[\.\n]?", "", raw, flags=re.I)
    raw = re.sub(r"Nguồn:\s*https?://\S+", "", raw, flags=re.I)

    sentences = _extract_sentences(raw)
    if not sentences:
        cleaned = re.sub(r"[ \t]+", " ", raw).strip()
        if len(cleaned) > 280:
            cleaned = cleaned[:277] + "..."
        return cleaned if len(cleaned) >= 2 else "Thông tin và chính sách đối chiếu theo tài liệu chính thức."

    # Select between 1 and 3 concise sentences
    if len(sentences) <= 3:
        chosen = sentences
    else:
        scored = []
        for idx, s in enumerate(sentences):
            scored.append((_score_sentence(s, category), idx, s))
        top_scored = sorted(scored, key=lambda x: x[0], reverse=True)[:3]
        chosen = [s for _, _, s in sorted(top_scored, key=lambda x: x[1])]

    result = " ".join(chosen)
    if len(result) > 480:
        if len(chosen) > 1:
            result = " ".join(chosen[:2])
        if len(result) > 480:
            result = chosen[0][:477] + "..."

    result = re.sub(r"\s+", " ", result).strip()
    if not re.search(r"[.!?…]$", result):
        result += "."

    if len(result) < 2:
        return "Thông tin và chính sách đối chiếu theo tài liệu chính thức."
    return result


def _clean_title(section: str | None, title: str | None) -> str:
    raw = (section or title or "Thông tin & Chính sách").strip()
    cleaned = re.sub(r"\s+", " ", raw).strip()
    if len(cleaned) > 160:
        cleaned = cleaned[:157] + "..."
    if len(cleaned) < 2:
        cleaned = "Thông tin & Chính sách"
    return cleaned


def _clean_model(citation_model: str | None, state_models: list[str]) -> str:
    if citation_model and citation_model.strip():
        m = citation_model.strip()
        if m.upper() == "ALL":
            return "ALL"
        return m[:50]
    if state_models:
        for m in state_models:
            if m and m.upper() != "ALL":
                return m[:50]
    return "VinFast"


def _extract_essential_conditions(raw_text: str | None, category: str) -> str | None:
    if not raw_text:
        return None
    matches = re.findall(
        r"(?:\(\*\)\s*Lưu ý:[^.\n]+|Điều kiện:[^.\n]+|Áp dụng cho[^.\n]+|Một số tính năng sẽ chưa có sẵn[^.\n]+|Thời hạn[^.\n]+)",
        raw_text,
        re.I,
    )
    if matches:
        return "; ".join(m.strip() for m in matches[:2])
    if category == "policy":
        return "Cần đối chiếu điều kiện áp dụng cho từng đối tượng khách hàng."
    return None


def _is_semantically_covered(candidate_text: str, answer_text: str) -> bool:
    """Check if the core factual information in candidate_text is already asserted in answer_text."""
    if not answer_text or not answer_text.strip() or not candidate_text:
        return False

    ans_norm = re.sub(r"\s+", " ", answer_text.lower())
    cand_norm = re.sub(r"\s+", " ", candidate_text.lower())

    # Check 1: Extract numeric facts (numbers + units) from candidate
    cand_numbers = re.findall(r"\b\d+(?:[\.,]\d+)?(?:\s*(?:triệu|tỷ|km|kwh|năm|tháng|%|hp|nm|kw))?\b", cand_norm)
    meaningful_numbers = [n for n in cand_numbers if len(n.strip()) > 1 and not n.strip().isdigit() or int(re.sub(r"\D", "", n) or 0) > 10]
    if meaningful_numbers:
        matched_numbers = [num for num in meaningful_numbers if num in ans_norm]
        # If all major numbers from candidate appear in the answer, check topic keywords
        if len(matched_numbers) >= 2 or (len(meaningful_numbers) == 1 and matched_numbers):
            # Check if key topic keywords also overlap
            topics = ["giá", "pin", "bảo hành", "sạc", "quãng đường", "thuê pin", "wltp", "nedc", "ưu đãi"]
            cand_topics = [t for t in topics if t in cand_norm]
            if any(t in ans_norm for t in cand_topics):
                return True

    # Check 2: Substantial n-gram overlap (sequences of 5+ words)
    words = cand_norm.split()
    for i in range(len(words) - 5):
        ngram = " ".join(words[i : i + 6])
        if len(ngram) > 20 and ngram in ans_norm:
            return True

    return False


def build_product_insights(
    state: dict,
    answer_text: str = "",
    existing_citations: list[Citation] | None = None,
    filter_novelty: bool = False,
) -> list[ProductInsight]:
    """Build insight cards with sources, optionally filtering out facts already in answer_text."""
    citations = list(existing_citations or [])
    if not citations:
        snapshot = state.get("verified_snapshot")
        if snapshot is not None and hasattr(snapshot, "citations"):
            citations = list(snapshot.citations)

    # Supplement candidate citations with selected_evidence if available
    selected_evidence = state.get("selected_evidence") or []
    existing_chunk_ids = {c.chunk_id for c in citations if c.chunk_id}
    cid_counter = len(citations) + 1
    for hit in selected_evidence:
        chunk_id = hit.get("chunk_id", "")
        if chunk_id and chunk_id not in existing_chunk_ids:
            citations.append(
                Citation(
                    citation_id=hit.get("citation_id") or f"C{cid_counter}",
                    chunk_id=chunk_id,
                    document_id=hit.get("document_id", "doc"),
                    title=hit.get("title", "Tài liệu sản phẩm"),
                    section=hit.get("section"),
                    page=hit.get("page"),
                    effective_from=hit.get("effective_from"),
                    effective_to=hit.get("effective_to"),
                    source_uri=hit.get("source_uri"),
                    product_model=hit.get("product_model"),
                    document_type=hit.get("document_type"),
                    version=hit.get("version"),
                    excerpt=hit.get("content"),
                )
            )
            existing_chunk_ids.add(chunk_id)
            cid_counter += 1

    if not citations:
        return []

    state_models = state.get("product_models") or []
    seen_keys: set[str] = set()
    insights: list[ProductInsight] = []

    for c in citations:
        dedup_key = c.chunk_id or c.citation_id or c.title
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        category = _resolve_category(c.document_type)
        title = _clean_title(c.section, c.title)
        summary = _clean_summary(c.excerpt, c.title, category=category)
        product_model = _clean_model(c.product_model, state_models)

        # Check semantic novelty against answer_text when requested: omit cards whose facts are already in answer
        if filter_novelty and answer_text and _is_semantically_covered(summary, answer_text):
            continue

        raw_source = (c.excerpt or "") + " " + summary
        conditions = _extract_essential_conditions(raw_source, category)
        advisory_hint = (
            "Điểm nổi bật hữu ích để chia sẻ thêm khi khách tìm hiểu trang bị và tính năng."
            if category == "highlight"
            else "Lưu ý làm rõ điều kiện và thời hạn áp dụng khi tư vấn ưu đãi cho khách."
        )
        applicability = "conditional" if category == "policy" or product_model == "ALL" else "confirmed"

        stable_id = f"ins-{hashlib.md5((dedup_key + title).encode()).hexdigest()[:8]}"

        insights.append(
            ProductInsight(
                category=category,
                product_model=product_model,
                title=title,
                summary=summary,
                citation=c,
                insight_id=stable_id,
                essential_conditions=conditions,
                advisory_hint=advisory_hint,
                applicability=applicability,
            )
        )
        if len(insights) >= 4:
            break

    return insights


def build_complementary_insights(
    state: dict,
    answer_text: str = "",
    existing_citations: list[Citation] | None = None,
) -> list[ProductInsight]:
    """Build complementary insight cards strictly filtering facts already in answer_text."""
    return build_product_insights(
        state=state,
        answer_text=answer_text,
        existing_citations=existing_citations,
        filter_novelty=True,
    )
