# Phase C — Account-bound Practice and manager review

Date: 2026-10-03

## Implemented

- Replaced the public application-level Practice router with the recorded Practice router.
- Reused the authenticated cookie identity from Phase B; identity is never accepted from request JSON.
- Advisor session creation records the authenticated `user_id` as owner.
- Session, result, attempt detail, message, finish, and history operations enforce ownership.
- Cross-account lookup returns not found instead of disclosing another advisor's attempt.
- Advisor and manager routes enforce their respective roles.
- Manager queue, detail, and approval use the authenticated manager ID.

## Verification actually run

```text
.venv/bin/ruff check src tests
All checks passed!

.venv/bin/ruff format --check src tests
90 files already formatted

.venv/bin/pytest -q
158 passed in 3.02s

cd frontend && npm run lint
PASS

cd frontend && npm run build
PASS (41 modules transformed)
```

The account-isolation integration test uses three real cookie sessions: two advisors and one manager. It proves owner-only history/detail, advisor/manager role separation, and manager queue/detail access against the same SQL database.

## Remaining vertical-slice work

The existing frontend has no login screen or manager review UI yet. Because Practice is now correctly protected, those UI flows must be added before the browser demo can use Practice again.
