# Kế hoạch thời gian & Checkpoint — Team P-043

**Mục tiêu chính**
- **30/09/2026:** Có MVP deploy được và chạy end-to-end.
- **02/10/2026:** Hoàn thiện product core, evaluation, HITL và độ ổn định.
- **03/10/2026:** Release cho sales tester để thu feedback thực tế.

---

# 1. Mốc chung của toàn team

## Source layout dùng cho implementation

Build Phase app chạy từ `src.main:app`, vì vậy mọi runtime production nằm dưới
`src/`. Không tạo thêm cây `backend/` song song.

```text
src/agents/copilot/       Copilot LangGraph của Chương
src/agents/roleplay/      Role-play LangGraph, customer, analyzer, evaluator của Duy
src/api/                  FastAPI routers
src/services/             Application services và shared LLM factory
src/knowledge/            Corpus, ingestion, retrieval và vector store
src/models/               Shared request/result contracts
src/persistence/          Durable session/checkpoint adapters
```

Nếu tài liệu cũ còn nhắc `backend/...`, đường dẫn `src/...` trong mục này và code
đang chạy là nguồn chính thức.

| Ngày | Milestone | Điều kiện pass |
|---|---|---|
| **21–22/09** | Gate 1 + Contract Freeze | Chốt PRD, Wireframe, API contract, RoleplayState, scenario schema, knowledge metadata, evaluation schema |
| **23–24/09** | Walking Skeleton | Frontend → FastAPI → LangGraph/LLM → persistence → frontend chạy được |
| **25–26/09** | Core AI | Copilot RAG v1 + Role-play multi-turn v1 chạy thật |
| **27–28/09** | Product Loop | Practice → Finish → Evaluate → Result chạy end-to-end |
| **29/09** | Feature Freeze | Không thêm major feature; chỉ integration, bug fix, deployment |
| **30/09** | MVP Release | Deployed product chạy đủ Copilot + Practice + selected-attempt HITL |
| **01–02/10** | Product Complete | Benchmark, hardening, history, tester readiness và polish |
| **03/10** | Sales Tester Release | Sales tester nhận URL + task + feedback form |

## Current attempt/review lifecycle amendment

Các checkpoint đã qua được giữ nguyên như lịch sử kế hoạch. Từ Product Complete
trở đi, `selected-attempt submission` được thay bằng lifecycle MVP đơn giản hơn:

```text
Finish attempt
→ persist transcript + provisional AI evaluation automatically
→ show latest result on the scenario card
→ keep every older attempt in scenario history
→ Manager queue groups by Advisor + Scenario and prioritizes the latest unreviewed attempt
→ Manager may open any older attempt and approve/edit one specific attempt
```

Không có private practice hoặc bước Advisor chọn attempt để submit. Việc lưu mọi
attempt không đồng nghĩa Manager phải review từng attempt.

### Bàn giao ownership cho phần tích hợp còn lại

Giữ nguyên ngày của các checkpoint đã qua. Với phần triển khai còn lại, Duy
phụ trách lịch sử attempt và nghiệp vụ/API/lưu trữ Manager Review của Practice;
Chương phụ trách auth/current-user và role dùng chung. Khi auth sẵn sàng, router
Practice có phân quyền thay thế router cũ, không chạy song song. Checkpoint cũ
chưa gắn owner đã xác thực không được tự gán cho advisor; nếu cần khôi phục
lịch sử cũ thì phải có ánh xạ danh tính rõ ràng.

---

# 2. Duy — AI Customer Role-play, Coaching Logic & Practice Chat Backend

## Checkpoint D1 — 21–22/09
### Mục tiêu: Freeze Role-play contract

Hoàn thành:

```text
RoleplayState schema
Scenario schema
AI Customer behavior contract
conversation stages
scenario objection/disclosure rules
disclosure rules
termination rules
5-dimension rubric skeleton
```

Rubric:

```text
Need Discovery
Product Knowledge
Objection Handling
Policy Accuracy
Closing / Next Step
```

Chuẩn bị tối thiểu 3 scenario mẫu:
- Khách nhạy cảm về giá.
- Khách lo pin / charging.
- Khách đang so sánh hai mẫu xe.

Freeze interface với Chương:

```text
RoleplayGraph interface
knowledge-tool interface
checkpoint interface
session lifecycle
evaluation output schema
```

### Acceptance
- `RoleplayState` được chốt.
- Scenario schema được chốt.
- Duy + Chương thống nhất graph interface.
- Duy + Đạt thống nhất rubric schema.
- An có đủ contract để mock Practice Room.

---

## Checkpoint D2 — 23–24/09
### Mục tiêu: Multi-turn AI Customer chạy được

Implement:

```text
src/agents/roleplay/state.py
src/agents/roleplay/scenario_loader.py
src/agents/roleplay/customer_agent.py
src/agents/roleplay/turn_analyzer.py
src/api/practice.py
src/services/practice.py
```

API:

```text
POST /practice/sessions
POST /practice/{id}/message
```

Flow tối thiểu:

```text
select scenario
→ create session
→ AI Customer first turn
→ salesperson reply
→ analyze advisor turn
→ update state
→ AI Customer next turn
```

### Acceptance
- Chat được ít nhất 5 turns.
- Conversation history không bị mất.
- Persona không đổi ngẫu nhiên.
- Hidden information vẫn được giữ.
- Session ID được duy trì xuyên suốt.

---

## Checkpoint D3 — 25–26/09
### Mục tiêu: Scenario behavior v1 với difficulty cố định

Implement:

```text
active_objections
resolved_objections
unresolved_objections
revealed_facts
conversation_stage
```

Behavior:

```text
good discovery question
→ semantic intent được nhận diện
→ reveal relevant hidden fact, không yêu cầu exact keyword

good objection handling
→ resolve objection

poor objection handling
→ objection remains
→ customer challenges again

premature closing
→ customer resists
```

Tích hợp shared knowledge tools của Chương:

```text
search_product()
search_policy()
get_current_promotion()
get_product_comparison()
```

### Acceptance
- AI Customer phản ứng khác nhau với câu trả lời tốt/xấu.
- Có thể resolve/unresolve objection.
- Difficulty không tự thay đổi trong một attempt.
- Câu hỏi paraphrase hợp lệ có thể reveal cùng fact như câu hỏi trực tiếp.
- Có factual lookup khi scenario cần policy/product fact.
- Không hard-code product facts riêng trong role-play.

---

## Checkpoint D4 — 27–28/09
### Mục tiêu: Evaluator v1 + Coaching output

Implement:

```text
src/agents/roleplay/evaluator.py
```

Output mỗi criterion:

```text
criterion
status
score
observable checks
turn IDs + exact quotes
reason
improvement_suggestion
```

Evaluator chạy trên:
- transcript thật
- final RoleplayState
- scenario
- rubric
- relevant knowledge evidence

### Acceptance
- Session finish sinh result cho 5 criterion; criterion không có cơ hội hợp lý dùng
  `NOT_OBSERVED` và score `null`.
- Mỗi assessed score có turn ID + exact quote đã validate.
- Factual findings tách `SUPPORTED`, `CONTRADICTED`, `UNVERIFIABLE`.
- Overall score do code tính trên criterion đã assessed.
- Output đúng schema để Chương persist và An render.
- Đạt có thể chạy benchmark trên evaluator.

---

## Checkpoint D5 — 29/09
### Mục tiêu: Role-play feature freeze

Run full flow:

```text
Scenario Selection
→ Practice
→ bounded multi-turn conversation
→ Finish
→ Evaluation
→ Results
```

Fix:
- state reset
- memory loss
- repeated replies
- premature termination
- malformed evaluator JSON
- unsupported tool calls
- factual hallucination trong role-play

### Acceptance
- Không thêm major role-play feature sau checkpoint này.
- Core flow pass E2E.
- Không có blocker P0.

---

## Checkpoint D6 — 30/09
### MVP Gate

Role-play MVP phải có:

```text
✓ choose scenario
✓ multi-turn AI Customer
✓ persistent context
✓ scenario-consistent response
✓ semantic disclosure
✓ fixed difficulty per attempt
✓ knowledge lookup
✓ finish session
✓ evaluator
✓ 5-dimension result
```

---

## Checkpoint D7 — 01–02/10
### Mục tiêu: Role-play completion

Hoàn thiện:
- Better persona consistency.
- Better scenario behavior at each configured difficulty.
- Better objection escalation.
- Better termination logic.
- Improve evaluator prompt.
- Fix benchmark failures.
- Add more realistic scenarios.
- Improve coaching feedback.
- Complete automatic attempt history and latest-attempt Manager queue behavior.

### Acceptance
- Không còn P0/P1 bug trên role-play.
- Benchmark regressions đã xử lý.
- Sales tester có ít nhất 3–5 scenario đủ tốt để thử.

---

# 3. Chương — AI Sales Copilot, Shared Backend Platform & Role-play Runtime

## Checkpoint C1 — 21–22/09
### Mục tiêu: Backend/platform contract freeze

Hoàn thành:

```text
FastAPI skeleton
PostgreSQL connection
pgvector setup
shared LLM client
API schemas
knowledge runtime contract
Role-play checkpoint interface
logging/config skeleton
```

Freeze API với Duy + An:

```text
POST /copilot/query
GET  /copilot/sources/{id}

POST /practice/sessions
POST /practice/{id}/message
POST /practice/{id}/finish
GET  /practice/{id}/evaluation

GET   /manager/reviews
PATCH /manager/reviews/{id}
GET   /progress
```

Freeze interface với Đạt:

```text
normalized document schema
chunk input schema
ingestion contract
metadata requirements
```

### Acceptance
- Backend chạy local.
- DB connection pass.
- Shared LLM client gọi được model.
- API schemas được freeze.

---

## Checkpoint C2 — 23–24/09
### Mục tiêu: Walking Skeleton + Role-play persistence

Implement:

```text
src/config.py
src/services/llm.py
src/persistence/sqlite_checkpoint.py
src/main.py
```

Flow:

```text
React
→ FastAPI
→ LLM
→ response
```

và:

```text
RoleplayGraph
→ save checkpoint
→ Postgres
→ reload session
```

### Acceptance
- Session survive qua nhiều request.
- Conversation turn được persist.
- Có thể restore session.
- Duy gọi được persistence/checkpoint interface.

---

## Checkpoint C3 — 25–26/09
### Mục tiêu: Copilot RAG v1

Implement:

```text
src/knowledge/chunking.py
src/knowledge/embedding.py
src/knowledge/vector_store.py
src/knowledge/retrieval_service.py

src/agents/copilot/answer_generator.py
src/agents/copilot/graph.py
```

Flow:

```text
advisor query
→ retrieve evidence
→ grounded answer
→ citation
```

Support tối thiểu:
- product facts
- price
- policy
- promotion
- product comparison

### Acceptance
- `POST /copilot/query` chạy với corpus thật.
- Có source/citation.
- Có retrieval evidence.
- An có thể kết nối UI thật.

---

## Checkpoint C4 — 27/09
### Mục tiêu: Policy-aware Copilot + Guardrails

Implement:

```text
policy_versioning.py
citation_validator.py
guardrails.py
```

Handle:

```text
current policy
expired policy
conflicting policy
unsupported query
missing evidence
```

Output:

```text
answer
evidence
source
effective_date
```

### Acceptance
- Expired policy không được ưu tiên như current policy.
- Unsupported query có abstention.
- Citation mapping đúng source.

---

## Checkpoint C5 — 28–29/09
### Mục tiêu: Role-play runtime + Evaluation persistence

Hoàn thiện:

```text
src/integrations/practice_runtime.py
checkpoint integration
persistence integration
session recovery
evaluation persistence
criterion-score persistence
```

API:

```text
POST /practice/{id}/finish
GET  /practice/{id}/evaluation
```

### Acceptance
- Duy evaluator output được persist.
- Result có thể reload.
- Knowledge tool chạy bên trong RoleplayGraph.
- Session recovery hoạt động.

---

## Checkpoint C6 — 30/09
### MVP Gate

Backend/Copilot MVP:

```text
✓ FastAPI deployed
✓ PostgreSQL working
✓ pgvector working
✓ Copilot RAG
✓ citations
✓ policy/date filtering
✓ Role-play persistence
✓ checkpoint/session restore
✓ evaluation persistence
✓ frontend APIs stable
```

---

## Checkpoint C7 — 01–02/10
### Mục tiêu: Platform completion

Hoàn thiện:
- Manager Review API.
- Progress API.
- Error handling.
- Retry/timeout.
- Token/cost guard.
- Better logging.
- Deployment hardening.
- Retrieval fixes từ Đạt benchmark.
- Citation reliability fixes.
- Session recovery fixes.

### Acceptance
- Không còn P0/P1 backend issue.
- API contract ổn định.
- Production deployment không cần manual intervention cho happy path.

---

# 4. Đạt — Data, Knowledge Ingestion, Evaluation & Benchmark

## Checkpoint Đ1 — 21–22/09
### Mục tiêu: Data contract + minimum usable corpus

Freeze:

```text
document_id
title
document_type
product_model
policy_type
effective_date
expiry_date
source
version
status
content
```

Chuẩn bị minimum corpus:
- product information
- price
- policy
- promotion
- battery information

Freeze với Chương:

```text
normalized-document schema
metadata schema
ingestion contract
chunk/input interface
```

Freeze với Duy:
- scenario schema
- objection schema
- expected-fact fields

### Acceptance
- Chương có data contract để code RAG.
- Duy có scenario contract để code role-play.
- An có mock data đủ để dựng UI.

---

## Checkpoint Đ2 — 23–24/09
### Mục tiêu: Preprocessing + ingestion code v1

Implement:

```text
scripts/ingestion/
├── normalize_documents.py
├── validate_metadata.py
├── deduplicate.py
└── build_corpus.py

src/knowledge/
├── ingestion.py
└── schemas.py
```

Support:
- metadata validation
- required-field validation
- date validation
- duplicate detection
- invalid-record report
- call Chương's chunking/vector-store interfaces

### Acceptance
- Có một lệnh chạy được từ raw/processed data → corpus ingest.
- Invalid docs được report.
- Duplicate/version conflict cơ bản được phát hiện.
- Corpus thật đã vào được knowledge runtime.

---

## Checkpoint Đ3 — 25–26/09
### Mục tiêu: Copilot benchmark + Eval runner v1

Tạo 50 câu benchmark theo Build Guide:

```text
30 real on-topic questions
15 off-topic / unsupported / prompt-injection questions
5 edge cases, including conflicting or version-sensitive evidence
```

Implement:

```text
eval/runner.py
eval/metrics.py
eval/copilot_eval/run.py
eval/retrieval_eval/run.py
```

Metrics v1:
- retrieval hit rate
- Recall@K
- citation correctness
- policy-version correctness
- appropriate abstention / clarification

### Acceptance
- Có thể chạy benchmark bằng command/script.
- Có machine-readable result.
- Có danh sách failed cases cho Chương.

---

## Checkpoint Đ4 — 27–28/09
### Mục tiêu: Role-play benchmark + Judge calibration v1

Tạo Role-play tests:
- T1 direct discovery
- T2 paraphrased discovery
- T3 supported objection handling
- T4 unsupported confident claim
- T5 prompt leakage / role reversal
- T6 explicit finish và max-turn lifecycle

Các test là fixture trajectories với advisor messages cố định. Runner gửi từng
message qua runtime thật và assert state event/transition; không so exact wording
của customer response và không dùng một AI advisor khác trong regression chính.

Chuẩn bị evaluator labelled set ban đầu:

```text
5 calibration transcripts tách khỏi held-out benchmark
```

Implement:

```text
eval/roleplay_eval/run.py
eval/judge_eval/run.py
eval/report_generator.py
```

### Acceptance
- Có automated Role-play test runner.
- T1–T6 có machine-readable assertions cho disclosure, objection, role và lifecycle.
- Có judge MAE / criterion agreement cơ bản.
- `eval/reports/latest.md` sinh tự động.

---

## Checkpoint Đ5 — 29/09
### Mục tiêu: MVP evaluation report

Chạy:

```text
Copilot benchmark
Retrieval benchmark
Role-play benchmark
Evaluator benchmark
```

Phân lỗi:

```text
P0 Critical
P1 Major
P2 Minor
```

Output:

```text
eval/reports/latest.json
eval/reports/latest.md
```

### Acceptance
- Duy và Chương có danh sách lỗi cụ thể cần fix trước MVP.
- Mọi P0 phải được fix hoặc feature liên quan bị loại khỏi release; chỉ assign owner
  chưa đủ để pass gate.

---

## Checkpoint Đ6 — 30/09
### MVP Gate

Đạt phải có:

```text
✓ clean/normalized corpus
✓ working ingestion pipeline
✓ metadata validation
✓ scenario dataset
✓ Copilot eval set
✓ Role-play eval set
✓ automated eval runner
✓ MVP evaluation report
```

---

## Checkpoint Đ7 — 01–02/10
### Mục tiêu: Final evaluation + tester preparation

Chuẩn bị held-out evaluator set cho advanced claim:

```text
≥20 expert-labelled transcripts, không tính calibration cases
```

Chạy:
- Recall@K.
- Citation correctness.
- Groundedness aggregation.
- Policy-version correctness.
- Role-play behavioral tests.
- Judge MAE.
- Criterion-level agreement.
- Exact và ±1 agreement.
- NOT_OBSERVED agreement.
- Evidence-reference correctness.
- Critical factual miss rate.
- Repeat stability trên fixed transcripts.

Chuẩn bị:
- tester task list
- feedback categories
- known limitations list
- baseline metrics trước khi test thật

### Acceptance
- Có final pre-tester report.
- Có benchmark snapshot để so sánh sau tester feedback.
- Feedback form/questionnaire sẵn sàng.

---

# 5. An — Frontend, Product UX & Client Integration

## Checkpoint A1 — 21–22/09
### Mục tiêu: UI flow + frontend skeleton

Freeze:

```text
Home
Copilot
Scenario Selection
Practice Room
Session Result
History
Manager Review
```

Progress Dashboard đầy đủ thuộc P1; MVP chỉ hiển thị lịch sử gần đây và một
next-practice recommendation trên Home/Session Result.

Implement skeleton:

```text
routing
layout
typed API client
types
hooks structure
mock data
```

### Acceptance
- Tất cả MVP core page route tồn tại.
- Có mock navigation.
- API contract đã sync với Duy/Chương.

---

## Checkpoint A2 — 23–24/09
### Mục tiêu: Walking Skeleton UI

Hoàn thiện flow mock:

```text
Home
→ Copilot
```

và:

```text
Home
→ Scenario Selection
→ Practice Room
→ Session Result
```

Practice Room có:
- message list
- input
- loading
- error
- finish button
- conversation history

### Acceptance
- UX core flow chạy với mock data.
- Không phải đợi backend mới tiếp tục frontend.

---

## Checkpoint A3 — 25–26/09
### Mục tiêu: Connect real Copilot + Practice API

Integrate:

```text
POST /copilot/query
POST /practice/sessions
POST /practice/{id}/message
```

Copilot UI show:
- answer
- citation
- source
- effective date

Practice Room:
- session thật
- multi-turn thật
- loading/error thật

### Acceptance
- Advisor có thể dùng AI thật từ frontend.
- Core happy path không còn mock.

---

## Checkpoint A4 — 27–28/09
### Mục tiêu: Results + Manager Review v1

Implement Session Result:
- 5 rubric dimensions
- assessed / not-observed / insufficient-evidence status
- nullable score
- turn IDs + exact quotes
- factual findings riêng
- reason
- improvement suggestion
- AI draft status
- retry + submit selected attempt
- transcript

Implement Manager Review:
- pending review
- AI score
- edit score
- note
- approve
- edit recommended next practice

### Acceptance
- Full practice loop hiện được trên UI.
- Evaluation result render đúng schema.
- Chỉ submitted attempt xuất hiện trong Pending Reviews.

---

## Checkpoint A5 — 29/09
### Mục tiêu: Frontend feature freeze

Run E2E:

```text
Copilot
Role-play
Finish
Evaluation
Result
```

Fix:
- broken state
- API errors
- loading/error states
- conversation overflow
- citation rendering
- responsive issues
- broken navigation

### Acceptance
- Không thêm major page trước MVP.
- Không còn P0 frontend blocker.

---

## Checkpoint A6 — 30/09
### MVP Gate

Frontend MVP:

```text
✓ Advisor Home
✓ Copilot
✓ Scenario Selection
✓ Practice Room
✓ multi-turn chat
✓ Session Result
✓ Submit selected attempt
✓ Manager Review
✓ citations
✓ deployed frontend
```

---

## Checkpoint A7 — 01–02/10
### Mục tiêu: Product completion

Hoàn thiện:
- Manager Review hardening.
- History.
- Basic recent-session summary; full Progress Dashboard remains P1.
- Empty states.
- Better errors.
- Telemetry.
- UX polish.
- Responsive polish.
- Tester-friendly onboarding/instructions.

### Acceptance
- Sales tester có thể dùng mà không cần developer đứng cạnh hướng dẫn.
- Happy path rõ ràng từ Home.

---

# 6. Integration Gates bắt buộc

## Gate I1 — 22/09: Contract Freeze

Freeze:

```text
API schemas
RoleplayState
scenario schema
knowledge metadata
ingestion contract
evaluation result schema
```

Sau gate này, thay đổi shared interface phải báo các owner liên quan.

---

## Gate I2 — 24/09: Walking Skeleton

Phải chạy:

```text
Frontend
→ FastAPI
→ LangGraph/LLM
→ persistence
→ frontend
```

Một scenario fake hoặc simple cũng được.

Nếu gate này fail, ưu tiên sửa trước khi làm feature nâng cao.

---

## Gate I3 — 26/09: Core AI

Phải có:

```text
Copilot
query → retrieval → grounded answer → citation
```

và:

```text
Role-play
scenario → multi-turn AI Customer
```

---

## Gate I4 — 28/09: Full Product Loop

Phải chạy:

```text
Select Scenario
→ Practice
→ Finish
→ Evaluate
→ Show Result
```

Copilot cũng phải chạy trên frontend thật.

---

## Gate I5 — 29/09: Feature Freeze

Từ đây đến MVP:

```text
NO major new features
```

Chỉ:
- bug fixing
- integration
- benchmark failures
- deployment
- critical UX

---

# 7. MVP Gate — 30/09/2026

MVP pass khi salesperson có thể:

```text
1. Open deployed website
2. Ask Copilot a product/policy question
3. Receive grounded answer + citation

4. Select a Role-play scenario
5. Chat with AI Customer for multiple turns
6. AI remembers context
7. AI reacts to salesperson behavior
8. Finish session

9. Receive scores:
   - Need Discovery
   - Product Knowledge
   - Objection Handling
   - Policy Accuracy
   - Closing / Next Step

10. See evidence + improvement feedback

11. Retry or open the scenario's saved attempt history
12. Manager opens the latest unreviewed attempt by default, may inspect older attempts,
    then approves/edits one attempt and saves its official result
```

MVP không bắt buộc:
- advanced analytics
- complex progression logic
- many difficulty tiers
- voice mode
- advanced personalization
- polished manager analytics

---

# 8. Product Complete Gate — 02/10/2026

Trước khi đưa sales tester:

```text
✓ Copilot grounded + citation
✓ policy/version handling
✓ Role-play multi-turn stable
✓ fixed-difficulty, scenario-consistent customer behavior
✓ session persistence
✓ evaluation + evidence
✓ Manager HITL
✓ ≥20 annotated evaluator cases hoặc dataset đã hoàn tất
✓ benchmark run hoàn chỉnh
✓ deployed frontend
✓ deployed backend
✓ production DB
✓ logging
✓ core telemetry
✓ major bugs resolved
✓ tester instructions ready
```

---

# 9. Sales Tester Release — 03/10/2026

Tester nhận:

```text
deployed URL
short usage guide
3–5 suggested tasks/scenarios
feedback form
known limitations nếu có
```

Tester tasks:
- Copilot product lookup.
- Product comparison.
- Policy/promotion lookup.
- Easy Role-play.
- Difficult objection Role-play.
- Review evaluation feedback.

Feedback cần thu:
- AI Customer realism.
- Copilot usefulness.
- Information correctness.
- Objection realism.
- Feedback usefulness.
- Score fairness.
- Missing sales situations.
- UX problems.
- Would-use-in-real-training.
- Free-text comments.

---

# 10. Critical Path

```text
21–22 Sep
Gate 1 + Contract Freeze
        ↓
23–24 Sep
Walking Skeleton
        ↓
25–26 Sep
Copilot + Role-play Core
        ↓
27–28 Sep
Full Practice Loop + Evaluator
        ↓
29 Sep
Feature Freeze
        ↓
30 Sep
MVP Deployed
        ↓
01–02 Oct
Evaluation + Hardening + History + Polish
        ↓
03 Oct
Sales Tester Release
```

---

# 11. Daily team sync rule

Mỗi ngày chỉ cần update 4 dòng/người:

```text
DONE:
TODAY:
BLOCKED:
NEED FROM:
```

Ví dụ:

```text
Duy
DONE: Multi-turn RoleplayGraph v1
TODAY: Semantic disclosure + objection transition logic
BLOCKED: waiting knowledge tool interface
NEED FROM: Chương - search_policy() contract
```

Các checkpoint trong tài liệu này nên được tạo thành GitHub Issues và đặt Target Date tương ứng trong GitHub Project.
