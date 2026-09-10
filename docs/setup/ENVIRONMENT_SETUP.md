# See - Environment Configuration Guide

This guide covers setting up the See app for development, staging, and production environments.

---

## Environment Overview

### Development
- **Purpose:** Local testing and development
- **Database:** Local PostgreSQL or Docker
- **Debug:** Enabled
- **Rate limiting:** Disabled
- **HTTPS:** Not enforced
- **Monitoring:** Optional (Sentry disabled by default)

### Staging
- **Purpose:** Pre-production testing
- **Database:** Dedicated staging database (Supabase)
- **Debug:** Disabled, but logging enabled
- **Rate limiting:** Enabled (500 req/min)
- **HTTPS:** Enforced
- **Monitoring:** Enabled (10% trace sampling)

### Production
- **Purpose:** Live user-facing environment
- **Database:** Production PostgreSQL with backups (Supabase)
- **Debug:** Disabled
- **Rate limiting:** Strict (300 req/min)
- **HTTPS:** Enforced
- **Monitoring:** Enabled (5% trace sampling)

---

## Backend Configuration

### Environment Variables by Stage

#### Development (.env)
```bash
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/see
REDIS_URL=redis://localhost:6379/0
SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
SUPABASE_JWT_SECRET=dev-secret-key-for-testing-only
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
SENTRY_DSN=  # Leave empty
```

#### Staging (.env.staging)
```bash
APP_ENV=staging
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@staging-db.supabase.co:5432/postgres?ssl=require
REDIS_URL=redis://staging-redis:6379/0
SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
SUPABASE_JWT_SECRET=[STAGING-JWT-SECRET]
CORS_ORIGINS=https://staging.your-app-domain.com,https://staging-api.your-app-domain.com
SENTRY_DSN=https://[PROJECT_ID]@sentry.io/[ORG_ID]
```

#### Production (.env.production)
```bash
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@prod-db.supabase.co:5432/postgres?ssl=require
REDIS_URL=redis://prod-redis:6379/0
SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
SUPABASE_JWT_SECRET=[PRODUCTION-JWT-SECRET]
CORS_ORIGINS=https://your-app-domain.com,https://www.your-app-domain.com
SENTRY_DSN=https://[PROJECT_ID]@sentry.io/[ORG_ID]
```

### Configuration Precedence

The backend uses the `EnvironmentConfig` system to manage settings per environment:

```python
# app/core/config.py loads config based on APP_ENV
from app.core.config_environments import get_environment_config

env_config = get_environment_config(settings.APP_ENV)
print(env_config.DEBUG)  # True for dev, False for staging/prod
print(env_config.API_RATE_LIMIT_ENABLED)  # False for dev, True for staging/prod
```

### Key Differences by Environment

| Setting | Development | Staging | Production |
|---------|-------------|---------|-----------|
| DEBUG | Yes | No | No |
| LOG_LEVEL | DEBUG | INFO | WARNING |
| RATE_LIMITING | No | 500/min | 300/min |
| DATABASE_POOL_SIZE | 5 | 15 | 20 |
| HTTPS_ENFORCED | No | Yes | Yes |
| SENTRY | No | 10% | 5% |
| EMAIL_POLLING | Yes | Yes | Yes |

---

## Frontend Configuration

### Environment Variables by Stage

#### Development (.env)
```bash
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

#### Staging (.env.staging)
```bash
EXPO_PUBLIC_API_URL=https://staging-api.your-app-domain.com/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

#### Production (.env.production)
```bash
EXPO_PUBLIC_API_URL=https://api.your-app-domain.com/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://nvdhvesydakhkjamfkfs.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Build Commands by Environment

```bash
# Development
cp .env .env.local
npm start

# Staging (preview build for testing)
cp .env.staging .env
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Production (release build for stores)
cp .env.production .env
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## Docker Compose Setup

### Development (Default)
```bash
docker-compose up
# Uses docker-compose.yml
# Local PostgreSQL and Redis
# Backend on http://localhost:8000
```

### Staging
```bash
docker-compose -f docker-compose.staging.yml up
# Uses docker-compose.staging.yml
# Staging database from Supabase
# Backend on http://localhost:8000
```

### Production (Manual/CI-CD)
```bash
# Production uses container orchestration (Kubernetes, ECS, etc.)
# Not typically run with docker-compose
# Use cloud deployment platform instead (Render, Railway, AWS, etc.)
```

---

## Setting Up Each Environment

### 1. Development Setup

```bash
# Clone repo
git clone [repo-url]
cd see

# Backend
cd see-backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../see-app
cp .env.example .env
npm install

# Start stack
cd ..
docker-compose up

# In another terminal
cd see-app
npm start
```

### 2. Staging Setup

```bash
# Backend
cp see-backend/.env.example see-backend/.env.staging

# Edit .env.staging:
# - DATABASE_URL: staging database
# - REDIS_URL: staging Redis
# - SUPABASE_JWT_SECRET: staging JWT
# - SENTRY_DSN: staging Sentry project

# Frontend
cp see-app/.env.example see-app/.env.staging
# - EXPO_PUBLIC_API_URL: staging API

# Build and deploy
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml push  # Push to container registry

# Deploy to staging server (Render, Railway, etc.)
# Platform-specific instructions below
```

### 3. Production Setup

```bash
# Backend - create .env.production
cp see-backend/.env.example see-backend/.env.production

# Edit see-backend/.env.production:
# - DATABASE_URL: production database (Supabase)
# - REDIS_URL: production Redis
# - SUPABASE_JWT_SECRET: production JWT (from Supabase)
# - SENTRY_DSN: production Sentry
# - CORS_ORIGINS: production domain(s)
# - All API keys rotated

# Frontend - create .env.production
cp see-app/.env.example see-app/.env.production
# - EXPO_PUBLIC_API_URL: production API

# Never commit .env files - use secrets management
git checkout see-backend/.env*
git checkout see-app/.env*
```

---

## Deployment Platforms

### Render (Recommended for Beginners)

**Backend:**
1. Connect GitHub repo
2. Create new Web Service
3. Set environment variables in dashboard
4. Auto-deploys on push to main
5. Set APP_ENV=production

**Frontend:**
1. Use EAS (not Render)

**Setup:**
```bash
# Set in Render dashboard:
APP_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SENTRY_DSN=https://...

# Backend auto-restarts on env change
```

### Railway

**Backend:**
```bash
# Install CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway variables set APP_ENV production
railway up
```

**Frontend:**
1. Use EAS for mobile builds

### AWS (ECS/Fargate)

**Backend:**
```bash
# Build and push image
docker build -t see-backend see-backend/
docker tag see-backend:latest [AWS_ACCOUNT].dkr.ecr.[REGION].amazonaws.com/see-backend
docker push [AWS_ACCOUNT].dkr.ecr.[REGION].amazonaws.com/see-backend

# Deploy via ECS task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs update-service --cluster production --service see-backend --force-new-deployment
```

---

## Environment-Specific Checklist

### Before Staging Deployment
- [ ] Database backups enabled
- [ ] Redis instance created
- [ ] Sentry project created and DSN obtained
- [ ] Staging domain configured
- [ ] SSL certificates installed
- [ ] CORS origins updated
- [ ] Rate limiting tested
- [ ] Email notifications configured
- [ ] All secrets in environment variables (not .env)

### Before Production Deployment
- [ ] All staging tests passed
- [ ] Database migration tested on prod database schema
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures documented
- [ ] Rollback plan created
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] API documentation updated
- [ ] Release notes prepared
- [ ] On-call procedure established

---

## Managing Environment Variables Securely

### Option 1: GitHub Secrets (for CI/CD)
```bash
# In GitHub repo settings:
Settings → Secrets and variables → Actions

# Add:
SUPABASE_JWT_SECRET_PROD
SENTRY_DSN_PROD
GEMINI_API_KEY_PROD
DATABASE_URL_PROD

# Use in workflow:
- name: Deploy
  env:
    SUPABASE_JWT_SECRET: ${{ secrets.SUPABASE_JWT_SECRET_PROD }}
```

### Option 2: Platform Secrets (Render, Railway, AWS)
```bash
# In Render dashboard or similar:
Environment → Add Variable
[KEY] = [VALUE]
# Platform encrypts and never shows value again
```

### Option 3: Secrets Manager (AWS, HashiCorp Vault)
```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name see-production-secrets \
  --secret-string '{"DATABASE_URL":"...", "SENTRY_DSN":"..."}'

# Application reads:
import boto3
client = boto3.client('secretsmanager')
secret = client.get_secret_value(SecretId='see-production-secrets')
```

---

## Troubleshooting Environment Issues

### Issue: App connects to wrong database
**Solution:** Check APP_ENV is set correctly
```bash
# Verify environment
curl http://localhost:8000/health
# Check logs for: "APP_ENV: production"
```

### Issue: Rate limiting blocking requests
**Solution:** Check environment and rates
```python
# In code:
from app.core.config_environments import get_environment_config
config = get_environment_config(settings.APP_ENV)
print(f"Rate limit: {config.API_RATE_LIMIT_REQUESTS_PER_MINUTE}")
# Dev: unlimited
# Staging: 500/min
# Prod: 300/min
```

### Issue: Sentry not capturing errors
**Solution:** Check SENTRY_DSN and environment
```bash
# Verify Sentry is configured
env | grep SENTRY
# Must be set for production/staging
# Leave empty for development
```

---

## Next Steps

1. **Set up Staging:**
   - Create staging database
   - Update docker-compose.staging.yml
   - Deploy to staging server
   - Run integration tests

2. **Set up Production:**
   - Create production database with backups
   - Configure monitoring and alerting
   - Set up SSL certificates
   - Document runbooks

3. **Automate Deployments:**
   - Create GitHub Actions workflow
   - Test automated deployments
   - Set up auto-rollback on failure
