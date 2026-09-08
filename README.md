# See

See is a developer life hub and productivity engine split into two decoupled projects:

- `see-backend/`: FastAPI + SQLAlchemy + Supabase PostgreSQL + Redis/Celery
- `see-app/`: Expo Router + TypeScript + NativeWind mobile app

## Layout

- `docs/`: PRD and design references
- `see-backend/`: async API, database models, workers, and Alembic
- `see-app/`: mobile client, design system, and screens

## Backend

```bash
cd see-backend
python -m uvicorn app.main:app --reload --port 8000
```

## Local stack

```bash
make compose-up
```

That starts Postgres, Redis, the backend API, the Celery worker, and Celery beat.

For one-off tasks:

- `make setup`
- `make backend-test`
- `make frontend-typecheck`
- `make migrate`

## App

```bash
make frontend-start
```

## CI

GitHub Actions runs backend migrations and tests plus frontend typechecking on every push and pull request.

## Deployment Notes

See [docs/deployment.md](docs/deployment.md) for the env vars and startup order needed to run and test the app locally or in production.

For Render specifically, see [docs/render.md](docs/render.md).
