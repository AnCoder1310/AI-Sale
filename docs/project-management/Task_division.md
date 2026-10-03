# Kế hoạch phân công nhiệm vụ đầy đủ — Team P-043

## 1. Duy — AI Customer Role-play, Coaching Logic & Practice Chat Backend

### Trách nhiệm chính
Phụ trách business intelligence và conversational behavior của hệ thống **AI Customer Role-play**, gồm:

- AI Customer behavior
- Scenario logic
- Customer persona
- Hidden customer state
- Conversation stages
- Scenario objection/disclosure behavior với difficulty cố định trong mỗi attempt
- Sales conversation strategy
- Role-play prompts
- Turn analysis
- Coaching/evaluator behavior
- Practice chat backend

### Gate 1
- Xác định flow Advisor → AI Customer → multi-turn conversation → session finish → evaluator → manager review.
- Xác định Role-play user journey.
- Xác định scenario structure.
- Xác định AI Customer behavior contract.
- Xác định persona structure.
- Xác định visible customer information.
- Xác định hidden customer information.
- Xác định buyer intent và customer goals.
- Xác định objection structure.
- Xác định disclosure rules.
- Xác định conversation stages.
- Xác định difficulty levels.
- Xác định success conditions và termination conditions.
- Xác định coaching output và evaluation output.
- Co-own rubric với Đạt gồm:
  - Need Discovery
  - Product Knowledge
  - Objection Handling
  - Policy Accuracy
  - Closing / Next Step
- Với mỗi rubric dimension, xác định:
  - definition
  - expected behavior
  - poor behavior
  - good behavior
  - evidence expected from transcript
  - score range
- Hỗ trợ Chương xác định:
  - sales intent taxonomy
  - sales-use-case questions
  - answer structure
  - recommended talking points
  - recommended follow-up questions
  - customer-fit reasoning
- Phụ trách chính:
  - `BRIEF.md`
  - `PRD.md` — phần product + role-play
  - Role-play specification
  - Scenario specification
  - Rubric business requirements
- Hỗ trợ:
  - `WIREFRAME_UI_FLOW.md`
  - Architecture diagram
  - Copilot behavior specification

### Build responsibilities

#### 1. RoleplayGraph business flow
Duy là editor-owner của `RoleplayGraph`; Chương review và cung cấp runtime/tool/
persistence interfaces để tránh shared-file ownership mơ hồ.

Duy phụ trách business transitions:

```text
START
 ↓
load_scenario
 ↓
customer_turn
 ↓
wait_for_advisor
 ↓
analyze_advisor_turn
 ↓
update_customer_state
 ↓
decide_conversation_stage
 ↓
continue / finish
 ↓
evaluate_session
 ↓
provisional_result
 ↓
advisor_retry_or_submit
 ↓
manager_review_pending only when submitted
 ↓
END
```

Duy phụ trách meaning và behavior của:
- `load_scenario`
- `customer_turn`
- `analyze_advisor_turn`
- `update_customer_state`
- conversation transition rules
- evaluation reasoning

Chương phụ trách runtime/tool/persistence nodes trong cùng graph.

#### 2. AI Customer Agent
Implement:

```text
src/agents/roleplay/customer_agent.py
src/agents/roleplay/prompts/
```

AI Customer Agent cần:
- Giữ consistency với persona.
- Bám scenario goal.
- Mô phỏng buyer behavior thực tế.
- Hỏi contextual questions.
- Đưa objections.
- Phản ứng khác nhau tùy câu trả lời của salesperson.
- Không reveal hidden information quá sớm.
- Reveal thông tin theo semantic intent; keyword chỉ là example/test hint.
- Giữ difficulty cố định trong một attempt.
- Không tự bịa product hoặc policy information.
- Dùng shared knowledge tools khi cần factual information.
- End conversation theo termination conditions.

#### 3. Role-play business state
Phụ trách:

```text
src/agents/roleplay/state.py
```

State fields:
- `scenario_id`
- `conversation_stage`
- `turn_count`
- `interest_level`
- `trust_level`
- `visible_customer_facts`
- `hidden_customer_facts`
- `revealed_facts`
- `active_objections`
- `resolved_objections`
- `unresolved_objections`
- `customer_goals`
- `advisor_discoveries`
- `current_intent`
- `current_topic`
- `termination_status`
- `termination_reason`

#### 4. Scenario engine
Phụ trách runtime interpretation của structured scenarios.

Scenario format hỗ trợ:
- persona
- visible_context
- hidden_information
- buyer_intent
- customer_goals
- objections
- difficulty
- disclosure_rules
- sales_channel
- training_objective
- scenario_version
- expected_discovery
- success_conditions
- termination_conditions
- target_skills

Implement:

```text
src/agents/roleplay/scenario_loader.py
```

Phối hợp với Đạt về scenario content.

#### 5. Turn-analysis logic
Implement:

```text
src/agents/roleplay/turn_analyzer.py
```

Phân tích mỗi salesperson turn để phát hiện:
- question asked
- need discovered
- product claim made
- policy claim made
- objection addressed
- objection avoided
- next-step attempt
- incorrect information
- customer concern resolved

Output thành structured signals để cập nhật `RoleplayState`.

#### 6. Scenario Customer logic
Implement các transitions:

```text
good objection handling
→ objection resolved
→ trust increases
→ customer may reveal more information
```

```text
poor objection handling
→ objection stays active
→ trust may decrease
→ customer challenges salesperson again
```

```text
good discovery question
→ semantic intent được phát hiện
→ relevant hidden fact revealed
```

```text
premature selling
→ customer may resist
→ unresolved needs remain
```

#### 7. Practice Chat backend
Phụ trách:

```text
POST /practice/sessions
POST /practice/{id}/message
POST /practice/{id}/finish
GET  /practice/history?scenario_id={scenario_id}
```

Implement:

```text
src/api/practice.py
src/services/practice.py
```

`POST /practice/sessions`:
- validate scenario
- request session creation
- initialize role-play state
- invoke first customer turn
- return session information

`POST /practice/{id}/message`:
- receive advisor message
- load current role-play state
- invoke RoleplayGraph
- analyze advisor turn
- update business state
- generate next customer response
- return customer response + session status

`POST /practice/{id}/finish`:
- persist final turn and freeze transcript idempotently
- invoke evaluator once for the transcript/rubric version
- persist the completed attempt and provisional AI result automatically
- return provisional result or retryable evaluation status

`GET /practice/history?scenario_id={scenario_id}`:
- validate current-user ownership
- return every completed attempt for that Advisor and scenario, newest first
- expose enough summary data for the scenario card to render the latest result
- preserve transcript/result access for older attempts

Manager Review Queue:
- make every completed attempt available for Manager inspection
- group the default queue by `advisor + scenario`
- prioritize the latest unreviewed attempt in each group
- do not require the Manager to review every stored attempt

Persistence mechanism do Chương cung cấp.

#### 8. Evaluator / Coaching behavior
Phụ trách:

```text
src/agents/roleplay/evaluator.py
```

Evaluation input:
- scenario
- transcript
- final RoleplayState
- rubric
- relevant evidence

Evaluation output:
- criterion
- status (`ASSESSED`, `NOT_OBSERVED`, `INSUFFICIENT_EVIDENCE`)
- nullable score
- observable checks
- turn IDs + exact quotes
- reason
- improvement suggestion
- separated factual findings
- one recommended next practice/document

Áp dụng cho:
- Need Discovery
- Product Knowledge
- Objection Handling
- Policy Accuracy
- Closing / Next Step

Phối hợp với Đạt về benchmark/calibration.
Chương phụ trách persistence và retrieval của evaluation results.

#### 9. Shared knowledge usage trong Role-play
Dùng các tools do Chương cung cấp:

```text
search_product()
search_policy()
get_current_promotion()
get_product_comparison()
citation_validator()
```

Dùng cho:
- current product facts
- price/policy facts
- promotion information
- product comparisons
- factual validation

#### 10. Integration responsibilities
Với Chương:
- RoleplayGraph
- state interfaces
- tool contracts
- checkpoint behavior
- session lifecycle

Với Đạt:
- scenario dataset
- objection library
- rubric
- evaluator benchmark
- expert calibration

Với An:
- Practice Room behavior
- session states
- customer message behavior
- Session Result semantics

### Boundary
Duy phụ trách:
- AI Customer behavior
- conversation strategy
- scenario runtime semantics
- RoleplayState business semantics
- scenario objection/disclosure transitions
- customer-turn logic
- turn-analysis logic
- role-play prompts
- evaluation reasoning
- coaching logic
- practice start/message backend
- practice finish/result/history business lifecycle
- lịch sử attempt và nghiệp vụ/API/lưu trữ Manager Review sau khi có auth dùng chung

Cần phối hợp với Chương trước khi thay đổi:
- shared FastAPI setup
- database connection
- checkpoint implementation
- persistence implementation
- shared LLM client
- shared knowledge tools
- shared middleware
- global API conventions

Không tự ý thay đổi:
- Copilot retrieval implementation
- vector-store implementation
- knowledge ingestion
- policy-versioning infrastructure
- evaluation ground-truth datasets
- frontend components

---

# 2. Chương — AI Sales Copilot, Shared Backend Platform & Role-play Runtime

### Trách nhiệm chính
Phụ trách:
- AI Sales Copilot
- RAG / retrieval
- grounding
- citations
- policy versioning
- shared knowledge runtime
- FastAPI platform
- PostgreSQL
- pgvector
- shared LangGraph infrastructure
- LLM provider integration
- logging
- deployment
- Role-play runtime infrastructure
- Role-play persistence
- Role-play checkpointing

### Gate 1
Định nghĩa:
- technical architecture
- Copilot architecture
- shared knowledge architecture
- shared LangGraph architecture
- backend service boundaries
- FastAPI contracts
- PostgreSQL structure
- pgvector structure
- session persistence design
- checkpoint design
- AI logging structure
- deployment architecture
- knowledge-service interface

Phụ trách phần technical của `PRD.md`.

Phụ trách:
- Architecture diagram
- Copilot specification
- API contracts
- Database/data-model draft
- GitHub repo setup
- AI Log setup

Phối hợp với An về frontend/backend contracts.
Phối hợp với Duy về shared RoleplayGraph architecture.

### Build responsibilities

#### 1. AI Sales Copilot
Phụ trách toàn bộ flow:

```text
Advisor question
      ↓
classify intent
      ↓
retrieve knowledge
      ↓
metadata/date filtering
      ↓
rerank evidence
      ↓
generate grounded response
      ↓
validate citation
      ↓
answer / abstain
```

Implement:

```text
src/agents/copilot/
├── graph.py
├── state.py
├── prompts.py
├── intent_router.py
├── retrieval.py
├── reranker.py
├── answer_generator.py
├── citation_validator.py
└── guardrails.py
```

#### 2. Copilot capabilities
Support:
- product specifications
- product comparison
- price
- battery policy
- promotion
- sales policy
- current applicable policy
- customer-fit recommendation
- sales talking points
- suggested follow-up questions

Response cần có:
- answer
- supporting evidence
- source citation
- effective date
- relevant product
- relevant policy
- recommended talking point
- suggested next question

#### 3. Unsupported-query handling
Xử lý:
- insufficient evidence
- missing evidence
- conflicting evidence
- expired policy
- missing policy
- out-of-scope query

Hỗ trợ controlled abstention.

#### 4. Shared Knowledge Runtime

Chương phụ trách phần runtime sau khi corpus đã được Đạt chuẩn hóa, validate và đưa qua ingestion contract.

Chương phụ trách:

```text
src/knowledge/
├── chunking.py
├── embeddings.py
├── vector_store.py
├── policy_versioning.py
└── retrieval_service.py
```

Chương định nghĩa interface để `ingestion.py` của Đạt gọi các bước:

```text
normalized document
→ chunking
→ embeddings
→ vector-store upsert
```

Chương expose shared tools:

```text
search_product()
search_policy()
get_current_promotion()
get_product_comparison()
citation_validator()
```

Các tools này dùng chung bởi:

```text
CopilotGraph
RoleplayGraph
```

Đạt phụ trách:

```text
src/knowledge/ingestion.py
src/models/evaluation.py
```

bao gồm ingestion orchestration và metadata schema/validation.

#### 5. Shared LangGraph infrastructure
Phụ trách:
- graph execution infrastructure
- tool-node conventions
- checkpoint implementation
- state persistence mechanism
- session restore
- error handling
- retry
- timeout
- token guards
- cost guards
- shared logging
- LLM provider configuration

#### 6. Contribution trực tiếp vào Role-play runtime
Phụ trách:
- knowledge/tool node
- checkpoint node
- persistence node
- session-recovery logic

Implement:

```text
src/persistence/sqlite_checkpoint.py
src/integrations/practice_runtime.py
```

Trong `RoleplayGraph`:

```text
[Duy]
customer_turn
   ↓
analyze_turn
   ↓
update_customer_state

[Chương]
   ↓
knowledge lookup if required
   ↓
persist turn
   ↓
checkpoint state

[Duy]
   ↓
next customer turn
```

#### 7. RoleplayGraph shared implementation
Co-own:

```text
src/agents/roleplay/graph.py
```

Chương phụ trách:
- graph wiring
- tool integration
- checkpoint integration
- persistence integration
- runtime reliability
- error/retry behavior
- session recovery

Duy phụ trách business logic và transition meaning.

#### 8. Backend/API
Chương phụ trách platform-level FastAPI structure.

Chương phụ trách:

```text
POST /copilot/query
GET  /copilot/sources/{id}

GET  /practice/{id}/evaluation

GET /progress
```

Duy phụ trách:

```text
POST /practice/sessions
POST /practice/{id}/message
POST /practice/{id}/finish
GET  /practice/history?scenario_id={scenario_id}
GET  /manager/reviews
GET  /manager/reviews/{id}
PATCH /manager/reviews/{id}
```

`GET /manager/reviews` mặc định trả các group `advisor + scenario` với latest
unreviewed attempt; review detail vẫn có thể truy cập các attempt cũ trong group.

#### 9. Evaluation backend
Phụ trách:
- evaluation persistence
- criterion-score persistence
- evaluation retrieval API
- shared authentication/current-user dependency and role verification contract

Duy phụ trách attempt index của Practice, API/lưu trữ Manager Review, quy tắc
duyệt một lần và audit. Chương cung cấp `current_user` đã xác thực gồm `user_id`
ổn định và role `advisor`/`manager`; không dùng user ID do client tự gửi làm
danh tính. Khi auth sẵn sàng, router Practice có phân quyền thay thế router cũ;
không mount cả hai cùng lúc.

Flow:

```text
[Duy]
Evaluator reasoning
        ↓
criterion scores
evidence
feedback
        ↓
[Chương]
persist evaluation
        ↓
evaluation API
        ↓
manager review
```

#### 10. Database / persistence
Phụ trách shared PostgreSQL infrastructure.

Models/tables:
- users
- roles
- documents
- document_versions
- scenarios
- practice_sessions
- conversation_turns
- roleplay_checkpoints
- evaluations
- criterion_scores
- manager_reviews
- progress
- AI logs
- telemetry

Phối hợp với Duy về business fields trong Role-play tables.
Phối hợp với Đạt về corpus metadata.

#### 11. Shared platform
Phụ trách:

```text
src/config.py
src/services/llm.py
src/main.py
src/persistence/
src/integrations/
```

Bao gồm:
- database connection
- shared LLM client
- environment configuration
- logging
- API error handling
- backend deployment

#### 12. Integration responsibilities
Với Duy:
- RoleplayGraph
- knowledge tools
- state persistence
- checkpoints
- practice session lifecycle

Với Đạt:
- corpus metadata
- ingestion contract
- chunk/input schema
- retrieval evaluation
- policy versioning
- RAG benchmark

Với An:
- API contract
- Copilot integration
- Manager APIs
- frontend/backend schemas

### Boundary
Chương phụ trách:
- Copilot
- RAG runtime
- retrieval
- reranking
- citations
- knowledge runtime services
- chunking / embeddings / vector-store runtime
- policy versioning infrastructure
- shared tools
- shared backend platform
- FastAPI platform
- PostgreSQL/pgvector
- checkpointing
- persistence
- session recovery
- Role-play tool nodes
- evaluation persistence
- manager APIs
- backend deployment

Cần phối hợp với Duy trước khi thay đổi:
- Role-play business transitions
- RoleplayState semantics
- customer behavior
- role-play prompts
- scenario behavior
- evaluation reasoning

Cần phối hợp với Đạt trước khi thay đổi:
- ingestion contract
- metadata schema
- ground-truth format
- evaluation datasets
- benchmark definitions
- corpus labeling conventions

Không tự ý thay đổi phần do Đạt owner:
- `src/knowledge/ingestion.py`
- `src/models/evaluation.py`
- raw/normalized corpus preprocessing
- automated evaluation runner và metrics implementation

Cần phối hợp với An trước khi thay đổi:
- frontend-facing API schemas
- response payloads
- UI-required fields

---

# 3. Đạt — Data, Evaluation, Benchmark & Product Evidence

### Trách nhiệm chính
Phụ trách:
- knowledge datasets
- product/policy corpus
- knowledge ingestion orchestration
- metadata schema / validation
- sales conversation data
- objection data
- scenario evidence
- benchmark datasets
- ground truth
- evaluation harness
- automated evaluation runner / metrics / report generation
- RAG evaluation
- Role-play evaluation
- Judge calibration
- HITL evaluation analysis

### Gate 1
Định nghĩa:
- knowledge/data source plan
- dataset feasibility
- product/policy corpus requirements
- sales dialogue data requirements
- scenario-data requirements
- evaluation strategy
- ground-truth strategy
- policy-versioning data requirements
- benchmark structure
- success metrics

Hỗ trợ `BRIEF.md` bằng problem/data evidence.
Hỗ trợ `PRD.md` bằng measurable requirements.
Co-own rubric với Duy.

### Build responsibilities

#### 1. Product / policy corpus
Chuẩn bị và normalize:
- vehicle information
- product specifications
- price information
- battery information
- promotion policies
- sales policies
- FAQs
- sales playbooks

Data format:
- document_id
- title
- document_type
- product_model
- policy_type
- effective_date
- expiry_date
- source
- version
- status
- content

Cung cấp normalized data cho knowledge runtime của Chương.

#### 2. Knowledge ingestion + metadata validation

Đạt phụ trách coding cho data-to-knowledge boundary:

```text
src/knowledge/
├── ingestion.py
└── schemas.py
```

`schemas.py` phụ trách:

```text
metadata schema
metadata validation
required-field checks
effective/expiry date validation
document status validation
version/source validation
```

Các helper dự kiến:

```text
validate_metadata()
validate_policy_dates()
is_active_policy()
detect_missing_metadata()
detect_duplicate_version()
```

`ingestion.py` phụ trách orchestration:

```text
normalized corpus
→ validate metadata
→ reject/report invalid documents
→ call Chương's chunking interface
→ call embedding/vector-store interfaces
→ collect ingestion result
```

Đạt không implement chunking algorithm, embeddings hay pgvector internals; các interface này do Chương cung cấp.

Ngoài ra Đạt phụ trách preprocessing scripts:

```text
scripts/ingestion/
├── normalize_documents.py
├── validate_metadata.py
├── deduplicate.py
└── build_corpus.py
```

#### 3. Sales dialogue / objection data
Thu thập và structure:
- customer objections
- buyer intents
- common customer questions
- discovery questions
- follow-up questions
- sales responses
- good response patterns
- bad response patterns
- customer personas
- conversation stages
- closing patterns

#### 4. Scenario dataset
Co-own scenario content với Duy.

Đạt phụ trách data/evidence side:
- scenario source
- persona attributes
- buyer intent
- objection library
- difficulty metadata
- target skills
- expected facts
- reference response patterns
- expected discovery points

Duy phụ trách runtime behavior.

#### 5. Copilot evaluation dataset
Tạo benchmark:
- single-product facts
- multi-product comparison
- current policies
- expired policies
- promotions
- battery policies
- multi-document questions
- unsupported questions
- conflicting information
- date-sensitive questions

Initial benchmark:

```text
50 cases: 30 real on-topic + 15 off-topic/adversarial + 5 edge cases
```

#### 6. RAG evaluation
Theo dõi:
- retrieval hit rate
- Recall@K
- citation correctness
- answer groundedness
- unsupported-query abstention
- policy-version correctness

Chạy trên Copilot implementation của Chương.

#### 7. Role-play benchmark
Tạo tests:
- T1 direct discovery
- T2 paraphrased discovery
- T3 supported objection handling
- T4 unsupported confident claim
- T5 prompt leakage / role reversal
- T6 explicit finish và max-turn lifecycle

Mỗi case là fixture có advisor messages cố định và expected state events. Runner
không dùng một AI advisor khác trong regression chính và không assert exact customer
wording. Naturalness/role consistency được chấm riêng trên transcript output.

Chạy cùng Duy.

#### 8. Judge / evaluator calibration
Chuẩn bị expert-labelled transcripts.

Calibration set ban đầu, không tính vào held-out result:

```text
5 annotated transcripts
```

Advanced held-out target:

```text
≥20 additional expert-labelled transcripts
```

Với mỗi rubric criterion:
- expert score
- expert evidence
- expert rationale
- expected weakness

Metrics:
- MAE
- exact agreement
- ±1 agreement
- applicability / NOT_OBSERVED agreement
- evidence-reference correctness
- critical factual miss rate
- repeat stability
- criterion-level agreement
- weighted agreement/QWK chỉ là metric bổ sung khi sample đủ

#### 9. HITL evaluation
Phân tích:
- AI score
- manager score
- AI evidence
- AI rationale
- manager correction
- manager note

Dùng cho evaluator calibration.

#### 10. Evaluation harness + automated eval coding

Đạt phụ trách code để benchmark có thể chạy lặp lại tự động:

```text
eval/
├── runner.py
├── metrics.py
├── report_generator.py
├── copilot_eval/
│   └── run.py
├── retrieval_eval/
│   └── run.py
├── roleplay_eval/
│   └── run.py
├── judge_eval/
│   └── run.py
├── datasets/
└── reports/
```

`runner.py`:
- load evaluation dataset
- call target system/API
- collect predictions/results
- handle repeatable batch runs

`metrics.py`:
- Recall@K
- retrieval hit rate
- citation correctness
- groundedness result aggregation
- policy-version correctness
- evaluator MAE
- criterion-level agreement

`report_generator.py`:
- generate machine-readable JSON results
- generate Markdown summary
- list failed cases
- group failures by category

Output:

```text
eval/reports/latest.json
eval/reports/latest.md
```

#### 11. Integration responsibilities
Với Duy:
- scenario data
- objection library
- rubric
- Role-play benchmark
- judge calibration

Với Chương:
- corpus schema
- ingestion contract
- chunk/input schema
- metadata
- policy versioning data
- retrieval benchmark
- Copilot evaluation

Với An:
- evaluation result semantics
- progress metrics
- manager-review analysis
- dashboard data definitions

### Boundary
Đạt phụ trách:
- source data
- normalized corpus
- knowledge ingestion orchestration
- metadata schema / validation
- preprocessing / deduplication scripts
- scenario evidence
- benchmark datasets
- ground truth
- evaluation runner
- evaluation metrics implementation
- automated evaluation reports
- evaluation scripts
- judge calibration

Không tự ý thay đổi:
- Copilot reasoning/runtime
- retrieval/reranker logic
- chunking algorithm
- embeddings implementation
- pgvector/vector-store internals
- RoleplayGraph runtime
- production prompts
- shared FastAPI platform
- database infrastructure
- frontend components

Evaluation findings chuyển cho owner tương ứng.

---

# 4. An — Frontend, Product UX & Client Integration

### Trách nhiệm chính
Phụ trách:
- Advisor frontend
- Manager frontend
- Copilot UI
- Scenario Selection
- Practice Room
- Session Results
- History
- Basic session history; Progress Dashboard sau MVP
- Manager Review
- frontend API integration
- frontend telemetry

### Gate 1
Phụ trách:

```text
WIREFRAME_UI_FLOW.md
```

Định nghĩa:
- Advisor journey
- Training Manager journey
- navigation
- Copilot interaction
- Scenario Selection
- Practice Room
- Session Result
- History
- Progress (P1; Gate 1 mô tả nhưng không nằm trong MVP navigation)
- Manager Review
- score-editing flow
- approval flow

Draft frontend/backend contracts với Chương.

### Build responsibilities

#### 1. Frontend architecture
Phụ trách:

```text
frontend/src/
├── api/
├── types/
├── hooks/
├── components/
├── pages/
└── features/
```

Tạo typed API clients và reusable hooks.

#### 2. Advisor Home
Cung cấp:
- Copilot
- Practice
- History
- one next-practice recommendation

#### 3. Copilot UI
Implement:
- question input
- conversation history
- grounded answer
- citation cards
- source detail
- effective-date display
- unsupported-answer state
- loading state
- error state
- suggested follow-up questions

Integrate:

```text
POST /copilot/query
GET /copilot/sources/{id}
```

#### 4. Scenario Selection
Hiển thị:
- scenario title
- persona
- difficulty
- training objective
- target skills
- optional duration hint; backend turn limit là safety cap, không phải skill score

Start session bằng:

```text
POST /practice/sessions
```

#### 5. Practice Room
Implement:
- AI Customer messages
- advisor messages
- conversation history
- scenario context
- session state
- finish action
- error handling
- retry

Integrate:

```text
POST /practice/sessions
POST /practice/{id}/message
POST /practice/{id}/finish
```

Giữ continuous multi-turn session context.

#### 6. Session Result
Hiển thị:
- overall result
- Need Discovery
- Product Knowledge
- Objection Handling
- Policy Accuracy
- Closing / Next Step

Với mỗi criterion:
- status + nullable score
- turn IDs + exact quotes
- reason
- improvement suggestion

Hiển thị riêng factual findings và trạng thái `AI draft`. Mọi attempt hoàn thành được
lưu tự động. Scenario card hiển thị result gần nhất; Advisor có thể retry hoặc mở
history để xem transcript/result của các attempt cũ.

Cung cấp transcript view.

#### 7. Manager Review
Implement:
- Pending Reviews
- Review Detail
- Transcript
- AI Scores
- Evidence
- Manager Score Editing
- Manager Notes
- Approve
- Edit recommended next practice

Integrate:

```text
GET /manager/reviews
PATCH /manager/reviews/{id}
```

#### 8. Progress Dashboard (sau MVP)
Hiển thị:
- sessions completed
- scores over time
- criterion-level performance
- weak skills
- manager-reviewed scores
- practice history

#### 9. UX telemetry
Capture:
- session_started
- session_finished
- message_sent
- copilot_query
- source_clicked
- practice_abandoned
- retry_triggered
- manager_score_edited
- manager_review_approved

Phối hợp persistence với Chương.
Phối hợp analysis với Đạt.

#### 10. Integration responsibilities
Với Duy:
- Practice Room behavior
- role-play session states
- customer interaction
- Session Result semantics

Với Chương:
- API contracts
- Copilot integration
- Manager integration
- authentication/API errors

Với Đạt:
- evaluation visualizations
- progress metrics
- dashboard semantics

### Boundary
An phụ trách:
- frontend architecture
- React components
- frontend state
- API client
- Advisor UX
- Manager UX
- visualizations
- frontend telemetry

Cần phối hợp với Chương trước khi thay đổi:
- API schemas
- response structures
- backend contracts

Cần phối hợp với Duy trước khi thay đổi:
- Practice behavior
- Role-play session semantics
- customer interaction rules

Cần phối hợp với Đạt trước khi thay đổi:
- evaluation metric meaning
- dashboard metric meaning
- score interpretation

Không tự ý thay đổi:
- backend implementation
- Copilot reasoning
- Role-play reasoning
- rubric logic
- evaluation formulas
- database schema

---

# 5. Role-play Ownership Map

| Component | Owner | Support |
|---|---|---|
| Customer persona | Duy | Đạt |
| Customer behavior | Duy | Chương |
| Scenario runtime logic | Duy | Đạt |
| Conversation stages | Duy | Chương |
| Scenario objection/disclosure transitions | Duy | Đạt |
| RoleplayState semantics | Duy | Chương |
| `RoleplayGraph` editor-owner | Duy | Chương review/runtime integration |
| Customer-turn node | Duy | Chương |
| Turn-analysis node | Duy | Chương |
| State-transition logic | Duy | Chương |
| Knowledge/tool node | Chương | Duy |
| Checkpoint node | Chương | Duy |
| Persistence node | Chương | Duy |
| Session recovery | Chương | Duy |
| Knowledge grounding | Chương | Duy + Đạt |
| Evaluation reasoning | Duy | Đạt |
| Evaluation calibration | Đạt | Duy |
| Evaluation persistence | Chương | Duy |
| Practice start API | Duy | Chương |
| Practice message API | Duy | Chương |
| Practice finish/result/history business flow | Duy | Chương |
| Practice manager-review API and persistence | Duy | Chương (auth contract) |
| Shared authentication/current-user role dependency | Chương | Duy (Practice integration) |
| Evaluation persistence/result API | Chương | Duy |
| Practice Room UI | An | Duy |
| Result UI | An | Duy + Đạt |

---

# 6. Copilot Ownership Map

| Component | Owner | Support |
|---|---|---|
| Copilot behavior | Chương | Duy |
| Copilot LangGraph | Chương | Duy |
| Intent routing | Chương | Duy |
| Retrieval | Chương | Đạt |
| Reranking | Chương | Đạt |
| Metadata filtering | Chương | Đạt |
| Policy/version filtering | Chương | Đạt |
| Grounded generation | Chương | Duy |
| Citation validation | Chương | Đạt |
| Abstention | Chương | Đạt |
| Knowledge corpus | Đạt | Chương |
| Knowledge ingestion orchestration | Đạt | Chương |
| Metadata schema / validation | Đạt | Chương |
| Chunking / embeddings / vector store | Chương | Đạt |
| Copilot benchmark | Đạt | Chương |
| Copilot UI | An | Chương |
| Sales-use-case taxonomy | Duy + Chương | Đạt |

---

# 7. Shared Platform Ownership Map

| Component | Owner | Support |
|---|---|---|
| FastAPI platform | Chương | Duy + An |
| PostgreSQL | Chương | Đạt |
| pgvector | Chương | Đạt |
| Knowledge ingestion pipeline | Đạt | Chương |
| Knowledge metadata validation | Đạt | Chương |
| Shared LLM client | Chương | Duy |
| Shared logging | Chương | Cả team |
| AI-call logging | Chương | Cả team |
| Deployment | Chương | An |
| Shared knowledge tools | Chương | Duy |
| Role-play checkpointing | Chương | Duy |
| Role-play persistence | Chương | Duy |
| Practice business API incl. finish/submit semantics | Duy | Chương |
| Manager API | Chương | An |
| API contract | Chương + An | Duy |
| Frontend integration | An | Chương + Duy |

---

# 8. Evaluation Ownership Map

| Component | Owner | Support |
|---|---|---|
| Rubric | Duy + Đạt | Chương |
| Ground truth | Đạt | Duy |
| Corpus benchmark | Đạt | Chương |
| Retrieval benchmark | Đạt | Chương |
| Automated eval runner | Đạt | Chương |
| Metrics implementation | Đạt | Duy + Chương |
| Evaluation report generator | Đạt | Chương |
| Role-play benchmark | Đạt | Duy |
| Judge benchmark | Đạt | Duy |
| Evaluation reasoning | Duy | Đạt |
| Evaluation persistence | Chương | Duy |
| Manager correction data | Đạt | Chương + An |
| E2E evaluation | Đạt | Cả team |

---

# 9. Gate 1 Task Ownership

| Deliverable / Task | Owner | Support |
|---|---|---|
| `BRIEF.md` | Duy | Đạt |
| `PRD.md` | Duy | Chương + Đạt |
| `WIREFRAME_UI_FLOW.md` | An | Duy |
| Role-play specification | Duy | Đạt + Chương |
| Copilot specification | Chương | Duy |
| Architecture diagram | Chương | Duy |
| Scenario specification | Duy | Đạt |
| Rubric skeleton | Duy + Đạt | Chương |
| Data/source plan | Đạt | Chương |
| Knowledge metadata + ingestion contract | Đạt | Chương |
| Evaluation plan | Đạt | Duy + Chương |
| API contracts | Chương + An | Duy |
| Database model draft | Chương | Đạt + Duy |
| GitHub repo setup | Chương | Cả team |
| AI Log setup | Chương | Cả team |
| Final Gate-1 consistency check | Duy | Cả team |

---

# 10. Build Ownership by Phase

| Phase | Duy | Chương | Đạt | An |
|---|---|---|---|---|
| **Gate 1** | Product + Role-play specification | Copilot + architecture | Data + evaluation plan | Wireframe/UI Flow |
| **Walking Skeleton** | Basic RoleplayGraph + complete Practice lifecycle | Platform + graph runtime integration + persistence | Test fixtures | React shell + mocks |
| **Knowledge Layer** | Role-play knowledge requirements | Chunking + embeddings + vector store + RAG runtime | Corpus preparation + ingestion + metadata validation | Source/citation UI |
| **Copilot** | Sales behavior support | Copilot lead | Copilot benchmark | Copilot UI |
| **Role-play** | AI Customer lead | Runtime/tools/checkpoint/persistence | Scenario dataset | Practice Room |
| **Evaluator** | Evaluation reasoning | Evaluation backend/persistence | Calibration + benchmark + eval runner/metrics/report | Results UI |
| **Manager HITL** | Coaching semantics | Manager APIs | AI-vs-manager analysis | Manager UI |
| **Progress** | Skill semantics | Progress backend | Metric definition | Dashboard |
| **Final Integration** | Role-play fixes | Platform/Copilot fixes | E2E evaluation | UX/E2E fixes |

---

# 11. Code Ownership

## Duy

```text
src/
├── agents/roleplay/
│   ├── graph.py
│   ├── state.py
│   ├── customer_agent.py
│   ├── scenario_loader.py
│   ├── turn_analyzer.py
│   ├── evaluator.py
│   └── prompts/
├── api/practice.py
├── services/practice.py
└── models/evaluation.py
```

`src/agents/roleplay/graph.py` do Duy làm editor-owner; Chương review các boundary liên quan
runtime, checkpoint, persistence và shared tools.

## Chương

```text
src/
├── agents/copilot/
│   ├── graph.py
│   ├── state.py
│   ├── intent_router.py
│   ├── answer_generator.py
│   └── guardrails.py
│
├── knowledge/
│   ├── chunking.py
│   ├── embedding.py
│   ├── vector_store.py
│   ├── ingestion.py
│   ├── schemas.py
│   └── retrieval_service.py
│
├── api/copilot.py
├── services/llm.py
└── config.py
```

## Đạt

```text
data/
├── raw/
├── processed/
├── knowledge/
├── scenarios/
└── evaluation/

src/knowledge/
├── ingestion.py
└── schemas.py

scripts/
├── ingestion/
│   ├── normalize_documents.py
│   ├── validate_metadata.py
│   ├── deduplicate.py
│   └── build_corpus.py
├── normalize/
├── validate/
└── prepare_eval/

eval/
├── runner.py
├── metrics.py
├── report_generator.py
├── copilot_eval/
│   └── run.py
├── retrieval_eval/
│   └── run.py
├── roleplay_eval/
│   └── run.py
├── judge_eval/
│   └── run.py
├── datasets/
└── reports/
```

## An

```text
frontend/src/
├── api/
├── types/
├── hooks/
├── components/
├── pages/
├── features/
│   ├── copilot/
│   ├── practice/
│   ├── results/
│   ├── manager/
│   └── progress/
└── telemetry/
```

---

# 12. Shared Interfaces

## Duy ↔ Chương
- RoleplayGraph
- RoleplayState interface
- knowledge-tool interface
- checkpoint interface
- session lifecycle
- evaluation result contract

## Duy ↔ Đạt
- scenario schema
- persona data
- objection library
- rubric
- Role-play benchmark
- judge calibration

## Duy ↔ An
- Practice Room
- session states
- AI Customer interaction
- Result semantics

## Chương ↔ Đạt
- corpus schema
- ingestion contract
- normalized-document schema
- chunk/input interface
- metadata schema
- policy versions
- retrieval benchmark
- Copilot evaluation

## Chương ↔ An
- API contracts
- Copilot API
- Manager API
- frontend/backend schemas

## Đạt ↔ An
- evaluation display
- progress metrics
- manager correction data
- dashboard semantics
