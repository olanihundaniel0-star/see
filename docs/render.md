# Render Deployment

This repo ships with a Render Blueprint in [render.yaml](../render.yaml).

## What It Creates

- `see-backend`: FastAPI web service
- `see-redis`: Render Key Value instance
- `see-postgres`: Render Postgres instance

This blueprint intentionally targets Render's free tier. Free Render instances
support web services and datastores, but not Background Workers or Cron Jobs.

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

The web service runs `alembic upgrade head` before Uvicorn starts. This keeps
the schema current without Render's paid pre-deploy jobs. The container's
`start.sh` is the source of truth for this sequence, and `dockerCommand` points
to `./start.sh` so Render does not need to parse an inline shell command.

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

- The free blueprint does not run Celery worker or beat. Webhook jobs can still
  be published to Redis, but they will not be processed until you choose one of
  the worker options below.
- Do not rely on the free Key Value instance for durable queued jobs: it is
  in-memory and may be restarted.
- If you add new required env vars, update both `render.yaml` and `see-backend/.env.example`.

## Worker And Scheduler Options

1. **Recommended for reliable production processing:** upgrade the Render
   worker and scheduler to paid services. Run a Celery worker continuously and
   use a Render Cron Job to enqueue `app.workers.tasks.poll_gmail_inbox` every
   15 minutes. This keeps the current Celery implementation unchanged.
2. **Host the worker elsewhere:** run `celery -A app.workers.celery_app worker
   -l info` on another always-on host and configure it with the same
   `REDIS_URL`, database, and application secrets. Replace Celery beat with an
   external scheduler that enqueues `app.workers.tasks.poll_gmail_inbox` every
   15 minutes. Use this only with a Redis endpoint the external host can reach.
3. **Serverless scheduler redesign:** use GitHub Actions, a cloud scheduler, or
   a webhook scheduler to invoke a protected API endpoint every 15 minutes.
   That endpoint must poll Gmail and process each message directly (or enqueue
   it to a managed queue). This requires a small application change; it is not
   safe to call the existing Celery task while no worker is running.
