# Role-play Contract

## Scope

This document is the living business contract for the role-play vertical slice. D1
created the initial schema; later build changes must keep this document, typed
contracts, consumers, tests, and UI semantics aligned.

## State and session lifecycle

`RoleplayState` is initialized from `ScenarioContract` with a `session_id`. It keeps
scenario identity, difficulty, persona, stages, turn count, trust/interest, visible
and hidden facts, objections, discoveries, termination state, and message history.
Validated advisor factual claims are retained with their originating message ID and
category so Finish can retrieve evidence for the exact claim rather than the whole
transcript.
Objections and termination conditions are nested typed contracts. All scenario
objections start as unresolved. They are not active until D2 checks `trigger_stage`.
D2 loads a scenario, creates state, persists every turn, and checkpoints it. On
termination it persists the final turn and freezes the transcript. `POST
/practice/{session_id}/finish` then evaluates the saved attempt. The checkpoint
records `pending`, `failed`, or `complete`; a failed evaluation can be retried
through Finish without losing the transcript. `GET /practice/{session_id}/result`
returns the status and, when complete, the provisional AI result.
`GET /practice/{session_id}` returns only `advisor_visible_context()` so the
Practice Room can recover the saved transcript after a reply fails.

Difficulty is selected before the session and remains fixed for that attempt.
Adaptive difficulty inside an attempt is out of MVP scope; later attempts may use a
different configured difficulty.

## Context boundaries

`customer_prompt_context()` is server-only input for the AI customer. It includes
difficulty, persona, trust/interest levels, customer goals, current intent, revealed
facts, active objections, and chat history. It never includes unrevealed
`hidden_facts`.

`advisor_visible_context()` is the frontend/trainee contract. It exposes session
identity, stage, turn count, chosen difficulty, sales channel/training objective when
configured, visible context, termination status, and chat history. It does not expose
hidden facts, private persona controls, trust/interest levels, customer goals, current
intent, objection state, disclosure rules, rubric internals, or evaluator feedback.

Visible context contains only information the advisor can reasonably know before the
conversation. A fact shown there cannot later be treated as successful discovery.

## Customer behavior

The AI is always the customer. It keeps persona/history, reveals hidden facts only
after an allowed semantic disclosure intent is detected, can revisit unresolved
objections, and never reveals rubric/evaluator feedback. `trigger_keywords` are test
examples and fallback hints, not exact phrases the advisor must say. Broad questions
may reveal a partial clue; a single prompt must not dump all hidden facts.

Turn analysis proposes known intent/fact/objection IDs and application code validates
them against scenario state before updating it. The customer model receives only facts
already revealed or explicitly allowed for the current turn. Replies should normally
be one to three natural sentences. Current price, promotion, battery, charging, and
product facts must use the knowledge tool, not scenario data or code.

## Stages and termination

Stages are `opening`, `discovery`, `presentation`, `objection_handling`, `closing`, and
`finished`. D2 can move them forward or backward based on dialogue. Termination is
active, completed, advisor-ended, dropped-out, or max-turns.

## Integration boundary

`RoleplayGraphContract.start(session_id, scenario_id)` and
`continue_session(session_id, advisor_message)` are the D2 turn boundary. The
graph also exposes finish, state load, and result save operations through the same
checkpoint contract.
The application composition uses `SQLCheckpointRepository`, selected through
`DATABASE_URL`, so the same checkpoint contract works with local SQLite and hosted
PostgreSQL. Role-play model calls use the shared provider factory through strict
structured-output adapters; provider and malformed-output failures remain visible.
The session lifecycle additionally needs an idempotent finish operation at the
service/API layer. Finishing creates and persists one provisional AI result for that
attempt. Every completed attempt remains available in the advisor's scenario history;
there is no separate selected-attempt submit operation. The Manager queue groups by
advisor and scenario and prioritizes the latest unreviewed attempt, while preserving
access to older attempts. Only Manager approval makes a specific attempt official.

Duy owns the complete practice lifecycle and role-play graph semantics. Chương
supplies checkpoint, persistence, knowledge and platform integrations. An consumes
public scenario/session DTOs only. Evaluation uses the shared five criteria and 1–5
scale from `src/models/evaluation.py`, supports `ASSESSED`, `NOT_OBSERVED`, and
`INSUFFICIENT_EVIDENCE`, and requires verified transcript evidence for every assessed
score.

The practice service requires an evaluator and a knowledge-evidence provider. The
mounted runtime supplies those dependencies and retrieves bounded evidence for each
recorded factual claim through the shared knowledge service. Every recorded claim
must receive exactly one factual verdict; missing verdicts invalidate the draft.
Session ownership checks must still be supplied by the shared authentication boundary
before exposing attempt history, transcript, or training-result operations to users.
