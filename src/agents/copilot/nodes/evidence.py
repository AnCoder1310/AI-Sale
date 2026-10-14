"""Code-only evidence selection and bounded context; no LLM audits."""

import hashlib
import re
from itertools import zip_longest

from src.agents.copilot.nodes._shared import (
    _lookup_date,
    _profile,
    _valid_evidence_date,
    _valid_evidence_scope,
    observed,
    schedule_corrective,
)
from src.agents.copilot.runtime import CopilotDependencyError, bounded_io
from src.agents.copilot.tools import (
    STOP_WORDS,
    build_evidence_context,
    get_bm25_search_engine,
    reciprocal_rank_fusion,
    tokenize_text,
)
from src.observability import annotate, event, span


def requirement_affinity(requirement, hit):
    """Candidate relevance only; semantic support is decided by the checker."""
    if requirement.kind != "fact":
        return 0
    description = requirement.description.lower()
    content = hit["content"].lower()
    models = {"VF " + n for n in re.findall(r"\bvf[\s-]*(\d+)\b", description)}
    if models and hit["product_model"] not in models | {"ALL"}:
        return 0
    if models and hit["product_model"] == "ALL" and hit["document_type"] == "price_list":
        if not any(re.search(r"\b" + re.escape(model.lower()) + r"\b", content) for model in models):
            return 0
    if re.search(r"giá niêm yết|msrp|giá.*kèm pin", description) and hit["document_type"] != "price_list":
        return 0
    patterns = [
        (r"nedc|wltp|quãng đường", r"nedc|wltp|quãng đường", r"\d[\d.,]*\s*km"),
        (r"dung lượng|kwh", r"dung lượng|kwh", r"\d[\d.,]*\s*kwh"),
        (r"giá|msrp", r"giá|msrp", r"\d[\d.,]*\s*(?:vnđ|đồng|triệu|tỷ)"),
        (r"bảo hành", r"bảo hành", r"\d"),
    ]
    for query_pattern, source_pattern, value_pattern in patterns:
        if re.search(query_pattern, description) and not (
            re.search(source_pattern, content) and re.search(value_pattern, content)
        ):
            return 0
    if re.search(r"nedc|wltp|quãng đường", description):
        if not any(
            abs(metric.start() - value.start()) < 120
            and not re.search(r"bảo hành", content[min(metric.start(), value.start()) : max(metric.end(), value.end())])
            for metric in re.finditer(r"nedc|wltp|quãng đường", content)
            for value in re.finditer(r"\d[\d.,]*\s*km", content)
        ):
            return 0
    terms = set(tokenize_text(description)) - STOP_WORDS - {"vf", "của", "về", "cho", "và"}
    overlap = terms & set(tokenize_text(content))
    return len(overlap) if overlap else 0


def _merge_evidence(state, hits):
    registry = {h["chunk_id"]: dict(h) for h in state.get("evidence_registry", [])}
    for hit in hits:
        if not _valid_evidence_date(hit, state) or not _valid_evidence_scope(hit, state):
            continue
        if state.get("snapshot") is not None:
            from src.agents.copilot.tools import _make_hit

            chunk = state["snapshot"].chunks.get(hit["chunk_id"])
            if chunk is None:
                raise CopilotDependencyError("retrieved chunk outside verified snapshot")
            expected = _make_hit(chunk, 0, 1, "bm25")
            keys = set(expected) - {"native_score", "rank", "retrieval_method"}
            if any(hit.get(key) != expected[key] for key in keys):
                raise CopilotDependencyError("retrieved content or metadata differs from snapshot")
        old = registry.get(hit["chunk_id"])
        if old:
            old["search_requirement_ids"] = list(
                dict.fromkeys([*old.get("search_requirement_ids", []), *hit.get("search_requirement_ids", [])])
            )
        else:
            registry[hit["chunk_id"]] = {**hit, "citation_id": f"C{len(registry) + 1}"}
    result = list(registry.values())
    return result, result


@observed
async def select_evidence(state):
    profile = _profile(state)
    ranked = []
    for result in state.get("raw_search_results", []):
        ranked.append(
            [
                {**hit, "search_requirement_ids": result["requirement_ids"]}
                for hit in reciprocal_rank_fusion(
                    result["dense"],
                    result["bm25"],
                    rrf_k=60,
                    top_k=profile.candidate_pool,
                    target_date=_lookup_date(state),
                )
            ]
        )
    fair = [h for group in zip_longest(*ranked) for h in group if h] if ranked else state.get("new_hits", [])
    # Only previously supported sources deserve priority over newly targeted hits.
    snapshot = state.get("verified_snapshot")
    verified_ids = {c.citation_id for c in snapshot.citations} if snapshot else set()
    seeds = (
        [h for h in state.get("selected_evidence", []) if h["citation_id"] in verified_ids]
        if state.get("corrective_retrieval_count") and verified_ids
        else []
    )
    pool, seen = [], set()
    for hit in [*seeds, *fair, *state.get("candidate_evidence", [])]:
        if hit["chunk_id"] not in seen and _valid_evidence_date(hit, state) and _valid_evidence_scope(hit, state):
            seen.add(hit["chunk_id"])
            pool.append(hit)
            if len(pool) == profile.candidate_pool:
                break
    registry, _ = _merge_evidence(state, pool)
    by_id = {h["chunk_id"]: h for h in registry}
    selection_order = pool
    models = [m for m in state.get("product_models", []) if m.upper() != "ALL"]
    if state.get("task") == "comparison" or len(models) >= 2:
        # Keep the RRF pool intact, spend scarce context slots on factual rows across all compared models
        terms = (
            set(tokenize_text(state["query"] + " " + " ".join(r.description for r in state.get("requirements", []))))
            - STOP_WORDS
        )
        terms -= {
            "so",
            "sánh",
            "khách",
            "mỗi",
            "ngày",
            "nên",
            "cân",
            "nhắc",
            "điểm",
            "niêm",
            "yết",
            "theo",
            "chuẩn",
            "về",
            "đi",
            "làm",
        }
        sorted_pool = sorted(pool, key=lambda h: len(terms & set(tokenize_text(h["content"]))), reverse=True)
        if len(models) >= 2:
            by_model = {m: [] for m in models}
            others = []
            for h in sorted_pool:
                h_model = h.get("product_model")
                if h_model in by_model:
                    by_model[h_model].append(h)
                else:
                    others.append(h)
            interleaved = [h for group in zip_longest(*by_model.values()) for h in group if h]
            selection_order = interleaved + others
        else:
            selection_order = sorted_pool
    requirements = [r for r in state.get("requirements", []) if r.kind == "fact"]
    bundles = []
    from src.agents.copilot.nodes._shared import _runtime
    runtime = _runtime(state)
    max_anchors_to_expand = min(len(selection_order), profile.evidence_blocks + 2)
    parent_reads_this_run = 0
    max_parent_reads = 4

    for idx, anchor in enumerate(selection_order):
        anchor = by_id[anchor["chunk_id"]]
        needs = (
            idx < max_anchors_to_expand
            and (
                anchor.get("requires_context")
                or anchor.get("context_prefix")
                or anchor.get("document_type") in {"price_list", "policy"}
            )
        )
        expanded = []
        if needs:
            cache = state.setdefault("parent_context_cache", {})
            cache_key = (anchor["chunk_id"], str(_lookup_date(state)))
            if cache_key in cache:
                expanded = cache[cache_key]
            elif runtime.remaining() >= 10.0 and parent_reads_this_run < max_parent_reads:
                timeout = min(10.0, max(2.0, runtime.remaining() - 10.0))
                with span("retrieval.parent_context", branch="bm25"):
                    expanded = await bounded_io(
                        lambda: get_bm25_search_engine().read_context(anchor["chunk_id"], _lookup_date(state)), timeout
                    )
                cache[cache_key] = expanded
                parent_reads_this_run += 1
            registry, _ = _merge_evidence({**state, "evidence_registry": registry}, expanded)
            by_id = {h["chunk_id"]: h for h in registry}
        bundle = [by_id[h["chunk_id"]] for h in expanded if h["chunk_id"] in by_id] or [anchor]
        bundles.append((anchor, bundle))
        event(
            "retrieval.evidence",
            evidence_stage="candidate",
            citation_id=anchor["citation_id"],
            source_hash=hashlib.sha256(anchor["chunk_id"].encode()).hexdigest()[:16],
        )
    selected, overflow_anchors, covered = [], [], set()
    pending = list(bundles)
    while pending:

        def priority(item):
            _, bundle = item
            scores = {r.requirement_id: max(requirement_affinity(r, h) for h in bundle) for r in requirements}
            new = set(rid for rid, score in scores.items() if score) - covered
            cost = max(1, len({h["chunk_id"] for h in bundle} - {h["chunk_id"] for h in selected}))
            return len(new), sum(scores.values()) if new else 0, -cost

        # Stable ties retain the fused ranking; no semantic approval is inferred here.
        item = max(pending, key=priority) if requirements else pending[0]
        pending.remove(item)
        anchor, bundle = item
        proposal = list({h["chunk_id"]: h for h in [*selected, *bundle]}.values())
        if (
            len(proposal) <= profile.evidence_blocks
            and len(build_evidence_context(proposal)[0]) <= profile.context_characters
        ):
            selected = proposal
            covered |= {r.requirement_id for r in requirements if any(requirement_affinity(r, h) for h in bundle)}
        else:
            if not selected:
                overflow_anchors.append(anchor["citation_id"])
                break  # Do not replace the strongest source with unrelated chunks merely to fill the cap.
    evidence_map = {
        r.requirement_id: [h["citation_id"] for h in selected if requirement_affinity(r, h)] for r in requirements
    }
    for requirement in requirements:
        if not evidence_map[requirement.requirement_id]:
            candidates = [item for item in bundles if any(requirement_affinity(requirement, h) for h in item[1])]
            if candidates:
                overflow_anchors.append(candidates[0][0]["citation_id"])
    for source in selected:
        source_hash = hashlib.sha256(source["chunk_id"].encode()).hexdigest()[:16]
        event(
            "retrieval.evidence", evidence_stage="selected", citation_id=source["citation_id"], source_hash=source_hash
        )
        for requirement in requirements:
            if source["citation_id"] in evidence_map[requirement.requirement_id]:
                event(
                    "retrieval.coverage_candidate",
                    requirement_id=requirement.requirement_id,
                    citation_id=source["citation_id"],
                    source_hash=source_hash,
                    affinity=requirement_affinity(requirement, source),
                )
    annotate(candidate_count=len(pool), selected_count=len(selected), profile=state.get("profile_name", "simple"))
    return {
        "evidence_registry": registry,
        "candidate_evidence": [by_id[h["chunk_id"]] for h in pool],
        "selected_evidence": selected,
        "evidence_map": evidence_map,
        "overflow_anchor_ids": list(dict.fromkeys(overflow_anchors))[:2],
        "parent_context_cache": state.get("parent_context_cache", {}),
        "route": "build_context",
    }


@observed
async def build_context(state):
    selected = state.get("selected_evidence", [])
    if selected and state.get("overflow_anchor_ids") and not state.get("generation_count", 0):
        corrective = schedule_corrective(
            state,
            anchors=state["overflow_anchor_ids"],
            feedback="Đọc nguồn cho dữ kiện chưa vừa context; giữ header/điều kiện và nguồn của các mẫu còn lại.",
        )
        if corrective:
            return corrective
    if not selected:
        corrective = schedule_corrective(
            state,
            anchors=state.get("overflow_anchor_ids") or None,
            feedback="Không có context đủ ngữ cảnh; tìm nguồn cho requirements còn thiếu. Bỏ filter loại tài liệu/chính sách quá hẹp nếu không có hits.",
        )
        if corrective:
            return corrective
        return {"route": "fallback_response", "fallback_reason": "insufficient_evidence"}
    context, _ = build_evidence_context(selected)
    annotate(context_characters=len(context))
    return {
        "answer_context": context,
        "self_check": None,
        "route": "generate_answer",
    }
