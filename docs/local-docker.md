# Run P-043 with Docker Compose

From the repository root:

```bash
docker compose up --build -d
curl -f http://localhost:3000/health
curl -f http://localhost:3000/api/v1/status
```

Open <http://localhost:3000>. Compose starts the React frontend and FastAPI backend; Caddy proxies `/api/*` and `/health` to the backend. The local database is SQLite and the local knowledge index is Chroma. Both use Docker named volumes, so `docker compose down` preserves their data. `docker compose down -v` deletes that local data.

For real AI calls, set `OPENROUTER_API_KEY` in an untracked `.env` in the repository root. For demo login, also set distinct `DEMO_ADVISOR_PASSWORD` and `DEMO_MANAGER_PASSWORD`, then run:

```bash
docker compose exec backend python -m scripts.seed_demo_users
```

Sign in as `advisor.demo` or `manager.demo` using the password you set. Reseeding replaces those demo accounts and invalidates their sessions. The frontend host port defaults to 3000; set `FRONTEND_PORT` in `.env` to change it.

The backend image installs the pinned `requirements.lock`, while the frontend uses `frontend/package-lock.json`. After changing `requirements.txt`, regenerate the Python lock with:

```bash
uv pip compile --python-version 3.11 requirements.txt -o requirements.lock
```
