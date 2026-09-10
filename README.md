# See

See is a developer life hub and productivity engine split into two decoupled projects:

- `see-backend/`: FastAPI + SQLAlchemy + Supabase PostgreSQL + Redis/Celery
- `see-app/`: Expo Router + TypeScript + NativeWind mobile app

## Quick Start

### Getting Started
1. Read the [documentation guide](docs/README.md)
2. Set up your environment: [Environment Setup](docs/setup/ENVIRONMENT_SETUP.md)
3. Review security: [Security Review](docs/security/SECURITY_REVIEW.md)

### Production Deployment
- Timeline & checklist: [Production Launch Checklist](docs/operations/PRODUCTION_LAUNCH_CHECKLIST.md)
- Deployment guide: [Deployment Runbook](docs/operations/DEPLOYMENT_RUNBOOK.md)
- Database setup: [Database Setup](docs/infrastructure/DATABASE_SETUP.md)

### Monitoring & Performance
- Error tracking: [Monitoring Setup](docs/monitoring/MONITORING_SETUP.md)
- Load testing: [Performance Testing](docs/monitoring/PERFORMANCE_TESTING.md)

## Layout

- `docs/`: Documentation organized by category (setup, infrastructure, operations, security, monitoring)
- `see-backend/`: async API, database models, workers, and Alembic
- `see-app/`: mobile client, design system, and screens

## Backend

```bash
cd see-backend
python -m uvicorn app.main:app --reload --port 8000
```

## Local Stack

```bash
make compose-up
```

Starts Postgres, Redis, the backend API, the Celery worker, and Celery beat.

Quick commands:
- `make setup` - Initialize environment
- `make backend-test` - Run backend tests
- `make frontend-typecheck` - Type check frontend
- `make migrate` - Run database migrations

## App

```bash
make frontend-start
```

## CI/CD

GitHub Actions runs:
- Backend migrations and tests on every push
- Frontend type checking on every push
- Automated staging deployment on main branch
- Manual approval required for production deployment

See [GitHub Actions workflow](.github/workflows/deploy.yml)

## Documentation

All documentation is organized in `docs/`:

- **[docs/README.md](docs/README.md)** - Documentation guide and quick links
- **[docs/setup/](docs/setup/)** - Environment configuration
- **[docs/infrastructure/](docs/infrastructure/)** - Database and infrastructure setup
- **[docs/operations/](docs/operations/)** - Deployment procedures
- **[docs/security/](docs/security/)** - Security hardening
- **[docs/monitoring/](docs/monitoring/)** - Monitoring and performance

## Public vs Internal Documentation

**Public (committed to repo):**
- Setup, infrastructure, operations, security, monitoring guides

**Internal (gitignored):**
- Legacy documentation
- Design files
- Product planning documents

See [.gitignore](.gitignore) for details.

## Production Status

The See app is production-ready with:
- Complete CI/CD pipeline
- Security hardening (HTTPS, rate limiting, input validation, security headers)
- Error tracking and monitoring (Sentry)
- Performance optimization
- Comprehensive deployment runbooks
- 3-week launch timeline

See [PRODUCTION_READY.md](PRODUCTION_READY.md) for full details.
