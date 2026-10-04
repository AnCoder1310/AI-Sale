# Phase B — Local authentication verification

Date: 2026-10-03

## Implemented

- Persistent local users in the configured SQL database.
- PBKDF2-SHA256 password hashing with per-user random salts.
- Opaque login sessions; only SHA-256 token hashes are stored.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`.
- HttpOnly, SameSite=Lax session cookie with configurable TTL and Secure flag.
- Environment-driven demo account seeding without committed passwords.

Account ownership is deliberately not connected to Practice endpoints in this phase. That is Phase C, after the authentication boundary is verified independently.

## Verification actually run

```text
.venv/bin/ruff check src tests
All checks passed!

.venv/bin/ruff format --check src tests
90 files already formatted

.venv/bin/pytest -q
157 passed in 2.54s
```

The seed command was also exercised against a temporary SQLite database using local test passwords:

```text
.venv/bin/python -m scripts.seed_demo_users
Seeded advisor account: advisor.demo
Seeded manager account: manager.demo
```

No real password or API key was written to this evidence file or committed configuration.
