.PHONY: run fix-prod seed-db seed-db-prod ingest-kb ingest-kb-prod test lint format typecheck check clean deploy deploy-be deploy-fe

run:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/

format:
	ruff format src/ tests/

typecheck:
	mypy src/

check: lint format test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +

deploy:
	./scripts/deploy_to_server.sh

deploy-be:
	./scripts/deploy_to_server.sh backend

deploy-fe:
	./scripts/deploy_to_server.sh frontend

seed-db:
	./.venv/bin/python scripts/apply_seed_database.py

seed-db-prod:
	cat recreate_and_seed_database.sql | ssh webdeploy "cd /home/admin/aisale && docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'psql -U \$${POSTGRES_USER:-p043_prod} -d \$${POSTGRES_DB:-p043_prod}'"

ingest-kb:
	./.venv/bin/python scripts/ingest_knowledge.py

ingest-kb-prod:
	ssh webdeploy "cd /home/admin/aisale && docker compose -f docker-compose.prod.yml exec -T backend python scripts/ingest_knowledge.py"

fix-prod: deploy-be ingest-kb-prod

