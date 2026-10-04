# PR #7 integration smoke — 2026-10-03

Branch: `integration/pr7-develop`, merging `origin/develop` into the PR #7 head.
The original checkout's unrelated uncommitted files were not modified.

## Local checks actually run

- Python 3.12: `python -m pytest tests -q` — **151 passed**.
- `ruff check src tests` — passed.
- `ruff format --check src tests` — passed.
- `npm run lint` in `frontend/` — passed.
- `npm run build` in `frontend/` — passed (Vite 8.3.2, 41 modules).
- `git diff --check` and staged diff check — passed.

## Browser flow against live local backend

Chromium ran the Vite frontend against the FastAPI backend with the configured
OpenRouter chat and embedding providers. The browser recorded no JavaScript
page errors. The following API calls completed:

| Step | HTTP result | Visible result |
| --- | --- | --- |
| Load scenarios | `GET /api/v1/practice/scenarios` → 200 | Three scenario cards loaded. |
| Ask VF 8 price | `POST /api/v1/copilot/query` → 200 | Answer showed the VF 8 price and a source button. |
| Start VF 5 taxi practice | `POST /api/v1/practice/sessions` → 201 | Customer opening turn appeared. |
| Send one advisor discovery question | `POST /api/v1/practice/{id}/message` → 200 | Customer replied; no UI error alert. |
| Finish | `POST /api/v1/practice/{id}/finish` → 200 | Five-criterion provisional evaluation appeared with transcript evidence. |

After stopping and restarting the backend, `GET /api/v1/practice/{id}/result`
returned HTTP 200 with `evaluation_status=complete` and `overall_score=1.4`.
The low score is expected for an intentionally short one-message practice
attempt and is not a calibration result.

## Limits

- This is one local browser path, not a broad AI benchmark or a multi-turn
  quality evaluation.
- Python 3.11 tests were not run in this checkout; the available project venv
  was Python 3.12.
- GitHub Actions remains blocked before runner execution by organization
  billing; these local results are not a CI pass.
- No deployed URL was verified. Run the same Copilot and Practice paths after
  deploying the merged build before recording the final demo video.
- SQLite and Chroma in local filesystem do not prove persistence on a hosted
  ephemeral filesystem.
