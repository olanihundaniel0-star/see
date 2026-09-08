# Deployment And Testing

## Local Setup

1. Copy the environment templates:
   - `cp see-backend/.env.example see-backend/.env`
   - `cp see-app/.env.example see-app/.env`
2. Fill in the real values:
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET` or `SUPABASE_JWKS_URL`
   - `EMAIL_WEBHOOK_SECRET`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Install dependencies:
   - `make setup`
4. Start the full stack:
   - `make compose-up`
5. Or run the pieces separately:
   - Backend: `make backend-run`
   - Frontend: `make frontend-start`

## Database Migration

The backend schema is managed by Alembic.

- Local stack: `make compose-up` runs the `migrate` service before the API, worker, and beat start.
- Manual migration: `make migrate`

## Validation

Run these before testing a deployment:

- Backend tests: `make backend-test`
- Frontend typecheck: `make frontend-typecheck`

If you are using the local Docker stack, the backend health endpoint is:

- `http://localhost:8000/health`

## Production Env Vars

Backend:

- `APP_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `SUPABASE_URL`
- `SUPABASE_ISSUER`
- `SUPABASE_AUDIENCE`
- `SUPABASE_JWKS_URL` or `SUPABASE_JWT_SECRET`
- `EMAIL_WEBHOOK_SECRET`
- `MAILGUN_SIGNING_KEY`
- `GEMINI_API_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `GMAIL_POLL_INTERVAL_MINUTES`
- `CORS_ORIGINS`

Frontend:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Suggested Deployment Order

1. Provision PostgreSQL and Redis.
2. Run Alembic migrations.
3. Start the API.
4. Start the Celery worker.
5. Start Celery beat if Gmail polling is enabled.
6. Deploy the Expo app or web build with the frontend environment variables set.
