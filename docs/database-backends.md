# Optional PostgreSQL and pgvector backend

The default local setup uses SQLite for accounts/practice records and Chroma for knowledge vectors. Docker Compose keeps these stores in named volumes. Nothing in this adapter requires a particular hosting service.

For a hosted PostgreSQL database with the pgvector extension available, set these backend environment variables:

```text
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
VECTOR_STORE_TYPE=pgvector
```

Keep the real URL in a private environment setting, never in Git. The app creates its SQL tables and the pgvector extension/table when used. It does **not** migrate local SQLite or Chroma data. The corpus index is built from the repository data when the vector table is empty; changing embedding models needs a deliberate reindex and collection name review. The code has no schema migration framework yet, so back up existing production data before deploying schema changes.

The adapter uses exact cosine search, matching the small current corpus without an approximate vector index. To run its integration test, point `PGVECTOR_TEST_DATABASE_URL` at a disposable PostgreSQL database with pgvector installed, then run `pytest tests/test_integrations/test_pgvector_store.py -q`. The test uses a unique collection and deletes its own rows.
