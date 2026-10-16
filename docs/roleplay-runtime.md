# Role-play runtime contracts

Scenario JSON is the source of product outcomes, objections, upsell benefits and
policy expectations. The analyzer extracts signals; the reducer validates IDs,
accumulates unique benefit/need pairs and policy IDs, and applies transitions.
`visible_goals` represents needs stated in `customer_goals`; other benefit links
must reference a fact key already revealed before that advisor turn. A feature
list alone is not a linked benefit: the analyzer must identify an explicit link
in the advisor's message to the customer's need.

Objections activate on their stage or a case-insensitive whole-word keyword.
An upsell objection can resolve only after the configured number of distinct
linked benefits and safety benefits has accumulated. Neither analyzer resolution
signals nor customer acceptance can bypass this rule.

Customer acceptance records `closing_outcome` only for a concrete proposed next
step. Outcomes must exist and have all prerequisite objections resolved. Invalid
or ineligible selections fall back to a preferred outcome without prerequisites,
then another outcome without prerequisites, or null. Legacy scenarios retain the
`close` outcome. Acceptance keeps the conversation available until the advisor
finishes it, matching the existing practice flow.

Customer output carries `disclosed_fact_keys`. The graph only records pending
fact keys, retaining exact revealed-statement recognition for legacy responses.
Existing deterministic disclosure replies also supply these keys. Customer
output is retried once when it introduces a price or numeric specification not
already present in advisor dialogue or a revealed statement. Ordinary model names
and appointment times are allowed. This guard is deterministic pattern checking;
semantic role compliance remains part of the customer prompt.

Advisor abuse is screened locally before the analyzer provider call. The local
registry uses word boundaries, Unicode normalization and conservative accent
folding to preserve normal sales phrases. Mild slang returns a warning verdict;
explicit abuse ends the session. The analyzer's semantic `unsafe_or_abusive`
signal independently ends the session. Both paths persist `advisor_misconduct`,
a category-only reason, the finished stage, and one fixed polite customer reply
without customer generation. New messages receive HTTP 409. Finish and evaluation
use the normal terminated-session lifecycle. The frontend keeps the score button
and displays the misconduct banner.

The public session view includes `closing_outcome` and `termination_reason`,
without private customer state. The scorecard renders `closing_outcome_label`
when supplied by evaluation. The catalog loads `/practice/scenarios`; static
presets are not its source. VF 6 retains its existing backend scenario 03 link.

Deterministic specs: `tests/test_roleplay/test_scenario04_runtime.py`, including
all 25 positive and 25 negative cases from the supplied abuse-pattern catalog.

## Verification on 2026-10-16

- 255 passed: `APP_ENV=test env -u OPENROUTER_API_KEY -u LLM_PROVIDER .venv/bin/python -m pytest tests/test_roleplay tests/test_api/test_practice_chat.py tests/test_api/test_recorded_practice.py tests/test_integrations/test_practice_runtime.py tests/test_integrations/test_practice_composition.py tests/test_integrations/test_practice_records.py tests/test_integrations/test_practice_persistence.py tests/test_integrations/test_practice_knowledge.py -q`.
- The new runtime spec file contributes 81 passing cases. Evaluation persistence
  after misconduct is verified using deterministic evaluator and evidence fakes.
- Ruff check and format check passed on all 11 changed Python files.
- Frontend production build and ESLint on both changed role-play components passed.
- Full frontend lint fails in untouched `components/copilot/SourceViewerModal.jsx:15`
  (`react-hooks/set-state-in-effect`); Copilot edits are outside this task's scope.
- The requested full backend command was attempted and interrupted after stalling
  on `test_copilot_agentic::test_simple_graph_has_nine_nodes_and_three_calls`.
  Diagnostic tracebacks showed the event loop waiting and an idle executor worker;
  an isolated `asyncio.to_thread` probe also stalled in this sandbox. Full-suite
  status is not verified, including the coordinator's known observability failure.
- No live provider evaluation, deployment, GitHub CI, or mergeability checks ran.
  No commit or push was made; generated tracked build output was restored.
