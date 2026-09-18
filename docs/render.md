# Render Deployment

This repo ships with a Render Blueprint in [render.yaml](../render.yaml).

## What It Creates

- `see-backend`: FastAPI web service
- `see-redis`: Render Key Value instance
- `see-postgres`: Render Postgres instance

This blueprint targets Render's free tier, which supports web services and
datastores but **not** Background Workers or Cron Jobs. Background work (Gmail
polling and event scraping) is therefore triggered by free GitHub Actions
schedules that call protected internal endpoints on the web service:

- [`.github/workflows/poll-gmail.yml`](../.github/workflows/poll-gmail.yml) runs
  every 15 minutes and calls `POST /internal/poll-gmail`.
- [`.github/workflows/scrape-events.yml`](../.github/workflows/scrape-events.yml)
  runs every 6 hours and calls `POST /internal/scrape-events`.

No Celery worker or beat is required in this mode.

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
   - `DEFAULT_USER_ID` (recommended in production; the UUID of the Supabase user who receives all Gmail-created records. If left empty the backend starts with a warning instead of failing, and Gmail records are ingested without a user. Must be a valid UUID if set.)
   - `INTERNAL_API_TOKEN` (a long random value shared with the GitHub Actions secret)
   - `CORS_ORIGINS` (comma-separated browser origins; required for web builds, not native apps)
   - `LUMA_PAGE_URLS` (optional; Luma pages to scrape for events)
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
5. Add these GitHub Actions repository secrets so the scheduled workflows can
   reach the backend:
   - `BACKEND_URL`: the Render web service URL, e.g.
     `https://see-backend-dgoe.onrender.com` (no trailing slash, no `/api/v1`)
   - `INTERNAL_API_TOKEN`: the same value set on the backend
6. Trigger each workflow once from the Actions tab (`Run workflow`) to confirm
   it returns `{"status": "ok", ...}`.

## Notes

- Scheduled GitHub Actions are the free-tier substitute for Celery beat. GitHub
  disables `schedule` triggers on repositories with no activity for 60 days; if
  polling silently stops, re-enable the workflow in the Actions tab.
- GitHub's cron scheduler is best-effort and can run late under load; treat
  `GMAIL_POLL_INTERVAL_MINUTES`/`EVENT_SCRAPE_INTERVAL_MINUTES` as guidance for
  the workflow cron expressions, not a hard guarantee.
- The Mailgun webhook path publishes to Redis via Celery. With no worker on the
  free tier those queued jobs are not processed, so rely on the Gmail poll
  workflow (which fetches and persists directly) for email ingestion.
- Do not rely on the free Key Value instance for durable queued jobs: it is
  in-memory and may be restarted.
- If you add new required env vars, update both `render.yaml` and `see-backend/.env.example`.

## Optional: Run A Real Celery Worker

If you later move off the free tier (or host a worker elsewhere), you can run a
continuous worker instead of the scheduled workflows:

1. **Render Background Worker:** create a worker service with
   `celery -A app.workers.celery_app worker -B -l info` and the same `REDIS_URL`,
   database, and application secrets. Keep it to a single instance because beat
   runs in-process.
2. **Another always-on host:** run the same command with the same secrets, and
   replace Celery beat with an external scheduler if the host cannot run beat.
   Use this only with a Redis endpoint the host can reach.
