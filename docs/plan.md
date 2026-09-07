# See Implementation Plan

Date: 2026-09-07

## Goal

Build `See` as two decoupled projects in one monorepo:

- `see-backend/`: FastAPI async API with SQLAlchemy 2.0, PostgreSQL via Supabase, Redis, and Celery.
- `see-app/`: Expo Router mobile app with TypeScript, NativeWind v4, TanStack Query, and SecureStore auth storage.

The implementation should follow the PRD and the seven design screens in `docs/design/stitch_see_developer_dashboard/`.

## Working Principles

- Keep the backend stateless and token-driven.
- Keep the mobile app visually consistent with the dark monochrome glass design language.
- Prefer stable API contracts before expanding UI behavior.
- Implement data models, schema validation, and endpoint contracts before making screens data-driven.
- Keep background work in Celery, not in request handlers.
- Use native device storage for secrets only; do not introduce AsyncStorage.

## Source Of Truth

- Product requirements: `docs/See_PRD.docx`
- Visual references: `docs/design/stitch_see_developer_dashboard/*`
- Existing repo scaffold: `see-backend/` and `see-app/`

## Phase 0: Audit And Normalize

Deliverables:

- Confirm folder layout matches the PRD scope.
- Align schema names, API payloads, and route prefixes with the PRD.
- Remove placeholder-only code that masks missing behavior.
- Document any intentional deviations in code comments or a short note in `README.md`.

Exit criteria:

- No route path conflicts.
- No duplicated model definitions that drift from the API schemas.
- No broken imports or missing package entrypoints.

## Phase 1: Backend Foundation

Deliverables:

- Finalize `app/core/config.py`, `app/core/database.py`, and `app/core/auth.py`.
- Define SQLAlchemy models for jobs, checklists, notes, reminders, and scraped events.
- Define Pydantic schemas for create, update, and read flows.
- Wire `app/main.py` and `app/api/v1/router.py`.
- Add Alembic metadata wiring and a migration baseline.

Implementation order:

1. Configuration and environment variables.
2. Database engine and async session dependency.
3. JWT verification dependency.
4. Models and schema exports.
5. API router registration.
6. Alembic environment setup.

Exit criteria:

- `python -m compileall app` passes.
- `uvicorn app.main:app --reload` starts cleanly.
- `/health` returns `200`.
- `/docs` renders all registered routes.

## Phase 2: Backend Contract Completion

Deliverables:

- `GET /api/v1/dashboard/today`
- `POST /api/v1/quick-add`
- `GET /api/v1/jobs`
- `POST /api/v1/jobs`
- `PATCH /api/v1/jobs/{id}`
- `GET /api/v1/events`
- `GET /api/v1/notes`
- `POST /api/v1/notes`
- `POST /api/v1/webhooks/email`

Implementation order:

1. Dashboard aggregation.
2. Jobs CRUD and checklist updates.
3. Notes search and tag filtering.
4. Events pagination and source filtering.
5. Quick-add dispatcher.
6. Email webhook HMAC verification and Celery enqueueing.

Exit criteria:

- Endpoints match the PRD payloads and query parameters.
- Error responses are stable and predictable.
- User scoping is enforced on all user-owned records.

## Phase 3: Mobile Foundation

Deliverables:

- Expo Router navigation shell.
- NativeWind v4 configuration.
- Shared glass components.
- Theme constants and ASCII tokens.
- SecureStore-backed Supabase client.
- Axios or fetch API client with Bearer token injection.

Implementation order:

1. App shell and root providers.
2. Tailwind / Metro / NativeWind wiring.
3. Shared UI primitives.
4. Supabase auth client.
5. API client.

Exit criteria:

- `npx expo start` opens without bundler errors.
- Navigation works across tabs, modal, and detail route.
- Styling builds without NativeWind or Metro configuration errors.

## Phase 4: Mobile Screen Implementation

Deliverables:

- Action Center today view.
- Job pipeline screen.
- Radar screen.
- Knowledge vault screen.
- Quick-add bottom sheet.
- Job dossier deep view.

Implementation order:

1. Build the tab screens with static mock data.
2. Replace static data with query hooks.
3. Add optimistic updates where the UX benefits from it.
4. Add haptic feedback and small interaction polish.

Exit criteria:

- Screens match the seven design references closely in layout and tone.
- No broken routes or missing screen registrations.
- Primary actions are usable on a physical device.

## Phase 5: Background Automation

Deliverables:

- Celery worker bootstrapping.
- Email extraction task pipeline.
- Event scraper task pipeline.
- Redis-backed queue integration.
- Optional scheduling hooks for recurring scrapes.

Implementation order:

1. Celery app setup.
2. Task registration.
3. Webhook ingestion to queue.
4. Structured extraction and DB upserts.
5. Scheduled event refresh jobs.

Exit criteria:

- Workers can run independently of the API.
- Long-running work does not block request handlers.
- Queue failures degrade gracefully.

## Phase 6: Quality And Validation

Deliverables:

- Backend compile and startup checks.
- Frontend bundler checks.
- Contract sanity checks against the PRD.
- Manual smoke tests for auth, quick-add, pipeline, notes, events, and dossier views.

Validation checklist:

- Backend imports compile.
- App bundler starts cleanly.
- API route list matches the intended contract.
- Design fidelity is reviewed screen by screen.
- No credentials are committed to source control.

## Phase 7: Release Hardening

Deliverables:

- Production environment variable examples.
- README setup instructions.
- Clear local dev commands for backend and app.
- Migration notes for schema changes.
- A short operational note for Celery and Redis.

Exit criteria:

- A new developer can bootstrap the repo from the README.
- The backend and app can be run separately without manual code edits.

## Explicit Non-Goals For Early Implementation

- No real-time sync engine until the core API is stable.
- No offline conflict resolution layer until the online flow is complete.
- No advanced analytics dashboard until the basic pipeline and today view are done.
- No background AI features beyond the email extraction worker until the worker pipeline is stable.

## Recommended Build Order

1. Backend config, models, and schema stability.
2. API contracts and basic persistence.
3. Mobile shell and design system.
4. Data-driven mobile screens.
5. Celery and webhook automation.
6. Validation and cleanup.

