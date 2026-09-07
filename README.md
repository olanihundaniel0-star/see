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

## App

```bash
cd see-app
npx expo start
```
