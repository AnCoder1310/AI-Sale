# Run P-043 with Docker Compose

From the repository root:

```bash
docker compose up --build -d
curl -f http://localhost:3000/health
curl -f http://localhost:3000/api/v1/status
```

Open <http://localhost:3000>. Compose starts React, FastAPI, and a local PostgreSQL 16 server with pgvector; Caddy proxies `/api/*` and `/health` to FastAPI. Accounts, login sessions, practice transcripts, reviews, and knowledge vectors live in the same local PostgreSQL database. Each teammate's Docker volume is private to their computer; Compose does not connect to Neon or share chat history. The database is reachable only by the Compose services, using a development-only password in `docker-compose.yml`.

`docker compose down` preserves the `postgres_data` volume. `docker compose down -v` deletes it, including accounts and practice history. Earlier SQLite and Chroma volumes are **not migrated or deleted** by this change. If you need their existing data, keep those volumes and plan an explicit migration before removing them.

The backend ingests `data/knowledge/corpus.json` on startup only when the selected vector collection is empty. It reuses existing vectors on subsequent restarts; corpus or embedding-model changes require an explicit reindex. Startup can still report `/health` as healthy if ingestion fails, so verify a real Copilot query before relying on retrieval.

For real AI calls, set `OPENROUTER_API_KEY` in an untracked `.env` in the repository root. For demo login, also set distinct `DEMO_ADVISOR_PASSWORD` and `DEMO_MANAGER_PASSWORD`, then run:

```bash
docker compose exec backend python -m scripts.seed_demo_users
```

Sign in as `advisor.demo` or `manager.demo` using the password you set. Reseeding replaces those demo accounts and invalidates their sessions. The frontend host port defaults to 3000; set `FRONTEND_PORT` in `.env` to change it.

The backend image installs the pinned `requirements.lock`, while the frontend uses `frontend/package-lock.json`. After changing `requirements.txt`, regenerate the Python lock with:

```bash
uv pip compile --python-version 3.11 requirements.txt -o requirements.lock
```
