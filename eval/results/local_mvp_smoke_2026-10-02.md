# Local MVP smoke — 2026-10-02

Environment: `feature/duy-practice-mvp-integration`, local FastAPI, SQLite
`data/app.db`, persistent Chroma collection
`vinfast_knowledge_openrouter_3_small`, OpenRouter chat and
`openai/text-embedding-3-small` embeddings. No API key is recorded here.

## Observed results

- OpenRouter embedding request returned a 1536-dimensional vector. Initial
  attempt exposed a tokenizer lookup problem for the OpenRouter-prefixed model;
  `check_embedding_ctx_length=False` fixed it for the already-chunked corpus.
- Backend startup ingested 144 chunks. A separate process confirmed the active
  store was `ChromaVectorStore` with 144 chunks.
- `GET /health` and `GET /api/v1/practice/scenarios` returned 200; three public
  scenarios were listed.
- Copilot answered a charging-policy question with citations; the cited
  `POLICY_CHARGING_VINFAST_20260919` source opened through the source API and
  had `status=active`.
- Copilot abstained from a request for an exact dealer insurance price not in
  the corpus (`is_abstain=true`, zero citations).
- Role-play scenario `SCENARIO_01_VF5_TAXI` started with 201. Two advisor turns
  received AI Customer responses; `finish` returned a complete evaluation with
  five assessed criteria, seven checks and eleven transcript evidence refs.
  All eleven refs matched message IDs in the saved five-message transcript.
- After a backend stop/start, both the saved session and result returned 200;
  the result retained `evaluation_status=complete` and score 2.2.
- `pytest tests/ -q`: 116 passed. Ruff check and format check passed.
- After integrating An's frontend, a headless Chromium test completed the
  browser flow: Copilot query -> source document modal -> scenario start ->
  advisor message/customer response (`message` HTTP 200) -> finish/evaluation
  (`finish` HTTP 200). No JavaScript page errors or visible UI alerts occurred.
- A separate browser test with the backend stopped showed explicit Copilot and
  scenario-load errors, with no fabricated citation or startable scenario.
- Frontend `npm run lint` and `npm run build` passed. The evaluator prompt was
  updated to request Vietnamese feedback; the repeated browser run showed a
  Vietnamese strength. Home no longer displays a fabricated 88.5/100 score.

## Limits

This is local browser E2E, not a deployed E2E test. Citation IDs
were checked for resolvability, not independent semantic support of every
sentence. The short role-play transcript is not a calibration benchmark for
judge quality. The local SQLite and Chroma files are not durable hosted storage.

An pushed the missing `frontend/src/data/*` modules in commit `8d82adb`; the
frontend branch was merged locally into the Duy integration branch. The root
`.gitignore` rule `data/` had ignored these nested source files; it has been
narrowed to `/data/` so the root dataset remains ignored without hiding
frontend source files.
