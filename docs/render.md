# Render Deployment

This repo ships with a Render Blueprint in [render.yaml](../render.yaml).

## What It Creates

- `see-backend`: FastAPI web service
- `see-worker`: Celery worker for background jobs
- `see-beat`: Celery beat for scheduled Gmail polling
- `see-redis`: Render Key Value instance
- `see-postgres`: Render Postgres instance

## Deploy Steps

1. Push the repo to GitHub.
2. In Render, create a new Blueprint and point it at `render.yaml`.
3. Let Render create the Postgres and Redis resources.
4. Fill in the secret environment variables Render prompts for:
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET` or `SUPABASE_JWKS_URL` if you choose to add it later
   - `EMAIL_WEBHOOK_SECRET`
   - `GEMINI_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
5. Deploy the blueprint.

## After Deploy

1. Copy the Render web service URL into the app:
   - `see-app/.env`
   - `EXPO_PUBLIC_API_URL=https://<your-render-backend>/api/v1`
2. Add your Expo or web front-end origin to `CORS_ORIGINS` on the backend if it is not already covered.
3. Confirm the API is healthy:
   - `https://<your-render-backend>/health`
4. Run a smoke test:
   - Open the app
   - Sign in
   - Create a job, note, and reminder
   - Verify Gmail polling only after the credentials are set

## Notes

- The backend Docker image already runs on Render as-is.
- `preDeployCommand: alembic upgrade head` keeps the database schema current for the web service.
- If you add new required env vars, update both `render.yaml` and `see-backend/.env.example`.
