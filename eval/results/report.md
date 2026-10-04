# Evaluation Report — P-043

## Backend verification, 02/10/2026

Environment: Python 3.11.16, branch `feature/duy-practice-mvp-integration`,
commit `dda3cb1`. These are **local** checks, not GitHub Actions or production
deployment results. The test suite uses deterministic mocks; the separate live
smoke tests below used the configured OpenRouter model and synthetic advisor data.

### Automated checks

```bash
./.venv/bin/python -m ruff check src/ tests/
./.venv/bin/python -m ruff format --check src/ tests/
APP_ENV=test ./.venv/bin/python -m pytest tests/ -q
```

Output recorded from this run:

```text
All checks passed!
72 files already formatted
........................................................................ [ 63%]
..........................................                               [100%]
114 passed in 0.40s
```

This is 114 *collected pytest cases*, including parametrized cases; it is not
114 independent real-LLM evaluations. Coverage was **not measured** because this
run did not use `pytest-cov`. The Build Phase 60% coverage target is therefore
still unverified.

### What the test files verify

| File(s) | Boundary and important assertions |
|---|---|
| `tests/test_agents/test_copilot_grounding.py` | Price retrieval keeps the VF 5 vehicle MSRP chunk rather than charger/other-model prices; missing MSRP and unsupported VF models abstain; provider errors are surfaced as retryable HTTP 503 without exposing internal detail. |
| `tests/test_services/test_llm.py` | OpenRouter selects its provider-specific model and rejects a missing key before a network call. |
| `tests/test_integrations/test_practice_knowledge.py` | Finish-time evidence retrieval deduplicates claims/chunks, selects the price list for a price claim and product specs for a driving-range claim even if the analyzer calls it `battery_charging`, and rejects a mismatched scenario. |
| `tests/test_integrations/test_practice_runtime.py` | Shared structured-LLM adapters validate Customer, Turn Analysis and Evaluation outputs; analyzer context omits hidden facts; malformed judge output gets one bounded retry; provider/malformed-output errors remain visible. All model responses here are fakes. |
| `tests/test_integrations/test_practice_composition.py` | Composed Practice service runs a small start/turn/finish/evaluation slice with fake model and retriever. |
| `tests/test_integrations/test_practice_persistence.py` | Checkpoint survives repository recreation, upsert replaces prior state, blank IDs are rejected, and hosted Postgres URLs select the intended driver. |
| `tests/test_api/test_practice_chat.py` | Advisor HTTP contract: safe scenario listing/session view, create/chat/finish/result, validation and 404/502/503 failure paths. |
| `tests/test_api/test_routes.py` | Health/basic template routes and mounting of Practice routes. |
| `tests/test_roleplay/test_contracts.py`, `test_scenario_loader.py` | Scenario/schema validity, unique IDs, valid references, safe public summaries, hidden-fact isolation and rubric/result invariants. |
| `tests/test_roleplay/test_turn_analyzer.py`, `test_state_reducer.py` | Paraphrased discovery, disclosure authorization, objection transitions, exact factual claim extraction, turn limits and deterministic state changes. |
| `tests/test_roleplay/test_customer_agent.py`, `test_graph.py` | Customer output validation and hidden-fact protection; multi-turn history, explicit finish, max-turn handling, session conflicts and provider-failure recovery. |
| `tests/test_roleplay/test_evaluator.py`, `test_practice_service.py` | Exact transcript/source references, all recorded factual claims covered, deterministic aggregate score, result persistence/idempotent finish and retry after evaluation failure. |
| `tests/test_ingestion/test_gate2.py` | Corpus/FAQ schema, product coverage, duplicate/version rules, reproducible corpus build and preservation of output on failed build. |
| `tests/test_agents/test_graph.py` | Basic template agent smoke tests; these do not establish the quality of the Copilot or Role-play agents. |

### Live local smoke tests (manual, not part of the 114 pytest cases)

- Practice API: scenario list → create session (`201`) → real AI customer turn
  (`200`) → finish with real AI judge (`200`, `evaluation_status=complete`) →
  GET result (`200`). A three-turn attempt was also reloaded through a newly
  created service/checkpoint instance after process restart; repeated finish
  returned the saved result.
- Synthetic false-claim attempt: the advisor claimed VF 5 Plus cost 100 million
  VNĐ and could travel 1,000 km per charge. The final integrated API run returned
  two `contradicted` findings, each with one validated knowledge-source reference:
  current VF 5 MSRP and VF 5 range specification. Result reload returned `200`.
- Copilot API: a VF 5 Plus MSRP question produced `496.000.000 VNĐ` with citation
  `PRICE_LIST_VINFAST_20260921`; the source endpoint returned `200`. A weather
  question and an unknown VF 10 price question returned `is_abstain=true` with
  no citations. A regression test confirms provider failure returns HTTP 503.
- Docker: the first image built but failed to import FastAPI as non-root
  `appuser`. After the Dockerfile fix, the final image rebuilt and
  `docker run --rm --entrypoint python p043-practice-mvp-smoke -c "import src.main; print('CONTAINER_IMPORT_OK')"`
  printed `CONTAINER_IMPORT_OK`. A containerized startup also ingested 144
  chunks, returned `/health` 200 and listed three scenarios 200.

These manual checks establish a working **local backend API path**, not the
browser/frontend flow or a hosted deployment.

### Not yet verified / remaining evidence

| Item | Status |
|---|---|
| Code coverage ≥60% | Not measured; `pytest-cov` is not declared in `requirements.txt`. |
| GitHub Actions for the pushed feature branch / PR | Not recorded here. Local pytest does not imply CI pass. |
| Frontend → hosted backend → provider → persistence → frontend | Not run. Vercel/Render CORS, secrets and durable database/storage remain to verify. |
| Copilot benchmark and RAG metrics | Separate benchmark artifacts exist under `eval/`; no score from them is claimed by this backend test run. |
| Judge agreement against ≥20 expert-labelled held-out transcripts | Not measured. The two synthetic factual claims are a smoke test, not expert validation. |
| Response latency, user satisfaction and real-user feedback | Not measured/collected. |

## Historical snapshot, 29/09/2026

The results below are retained as the earlier checkpoint. The 02/10 local
checks above supersede the older *software-test* statuses, but not the missing
coverage, benchmark, deployment, or user-feedback evidence.

---

## 1. Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Response accuracy | >80% | Chưa đo | Chưa xác minh |
| Response latency | <3s | Chưa đo | Chưa xác minh |
| User satisfaction | >4/5 | Chưa thu thập | Chưa xác minh |
| Test coverage | >60% | Chưa chạy coverage | Chưa xác minh |

## 2. Test Results

### Role-play và Practice API

Đã chạy:

```bash
.venv/bin/pytest tests/test_roleplay tests/test_api/test_practice_chat.py -q
```

Kết quả:

```text
72 passed in 2.21s
```

Phạm vi đã kiểm tra gồm scenario contract, hidden-fact isolation, turn analysis,
state transitions, customer response validation, session graph, evaluator,
Practice service và Practice API.

### Full Test Suite

Đã thu thập được 77 test:

```bash
.venv/bin/pytest --collect-only -q
```

Lần chạy toàn bộ suite chưa hoàn tất. Quá trình dừng tiến triển sau test đầu tiên
trong nhóm generic template agent và được chủ động dừng sau hơn 90 giây. Vì vậy
không được báo cáo full suite là pass cho đến khi nguyên nhân được xác định.

### Static Checks

Đã chạy:

```bash
.venv/bin/ruff check src backend tests
```

Kết quả: PASS.

Kiểm tra format:

```bash
.venv/bin/ruff format --check src backend tests
```

Kết quả: FAIL; sáu file cần được format:

```
src/models/evaluation.py
src/agents/roleplay/contracts.py
src/agents/roleplay/graph.py
src/agents/roleplay/state.py
src/services/practice.py
tests/test_roleplay/test_practice_service.py
```

### Integration Tests

Luồng end-to-end Frontend → FastAPI → model/provider → persistence → Frontend
chưa được chạy trên branch hiện tại. Deployment và smoke test production cũng
chưa được xác minh.

## 3. User Feedback

| User | Feedback | Rating |
|------|----------|--------|
| — | Chưa thu thập feedback có cấu trúc | — |

## 4. Demo Results

- Ngày demo: Chưa ghi nhận
- Người tham gia: Chưa ghi nhận
- Feedback chung: Chưa có bằng chứng
- Issues phát hiện: Chưa chạy demo end-to-end trên bản deploy

## 5. Action Items

- [ ] Điều tra test generic template agent bị dừng tiến triển trong full suite.
- [ ] Format sáu file được Ruff báo cáo rồi chạy lại format check.
- [ ] Chạy full suite và coverage sau khi xử lý test bị dừng tiến triển.
- [ ] Chạy integration/E2E trên ứng dụng đã compose và ghi lại bằng chứng.
- [ ] Bổ sung benchmark Copilot, role-play trajectories và Judge calibration.
