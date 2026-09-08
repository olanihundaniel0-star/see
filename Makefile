SHELL := /bin/bash
PYTHON ?= python3

.PHONY: setup backend-install frontend-install backend-run backend-test frontend-start frontend-typecheck compose-up compose-down migrate

setup: backend-install frontend-install

backend-install:
	cd see-backend && if [ ! -x .venv/bin/python ]; then $(PYTHON) -m venv .venv; fi && . .venv/bin/activate && python -m pip install --upgrade pip && python -m pip install -r requirements.txt

frontend-install:
	cd see-app && npm install

backend-run:
	cd see-backend && if [ -x .venv/bin/python ]; then PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --reload --port 8000; else PYTHONPATH=. $(PYTHON) -m uvicorn app.main:app --reload --port 8000; fi

backend-test:
	cd see-backend && if [ -x .venv/bin/python ]; then PYTHONPATH=. .venv/bin/python -m pytest; else PYTHONPATH=. $(PYTHON) -m pytest; fi

frontend-start:
	cd see-app && npx expo start

frontend-typecheck:
	cd see-app && npx tsc --noEmit

compose-up:
	docker compose up --build

compose-down:
	docker compose down -v

migrate:
	docker compose run --rm migrate
