# See - Deployment Runbook

This is the step-by-step guide for deploying See to production.

---

## Prerequisites

Before deploying, ensure:
- [ ] All tests pass locally
- [ ] Code reviewed and approved
- [ ] Staging deployment successful
- [ ] Performance baseline acceptable
- [ ] Sentry project created and DSN configured
- [ ] Database backups tested
- [ ] On-call team briefed
- [ ] Rollback plan reviewed

---

## Pre-Deployment Checklist

### Database
```bash
# Verify database health
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Verify backups exist
# (Check Supabase dashboard or AWS backup console)
```

### Backend Configuration
```bash
# Verify all environment variables are set
env | grep -E "DATABASE_URL|SENTRY_DSN|REDIS_URL|SUPABASE"

# Check that .env.production is NOT committed to git
git ls-files | grep -E "\.env\.production"
# Expected: No results (empty)
```

### Frontend Configuration
```bash
# Verify production build compiles
cd see-app
npm run build
# Expected: Build succeeds, no errors
```

### Monitoring
```bash
# Verify Sentry is accessible
curl https://sentry.io/api/0/organizations/your-org/projects/
# Expected: 200 OK with project list
```

---

## Deployment Steps (GitHub Actions)

### Step 1: Trigger Deployment
```bash
# Push to main branch (preferred)
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin main --tags

# OR manually trigger GitHub Actions:
# 1. Go to github.com/your-org/see
# 2. Click "Actions" tab
# 3. Select "CI/CD Pipeline" workflow
# 4. Click "Run workflow"
# 5. Select branch "main"
# 6. Click "Run workflow"
```

### Step 2: GitHub Actions Runs Tests
```
1. Test Backend (2-3 min)
   - Tests database operations
   - Tests API endpoints
   - Reports coverage

2. Test Frontend (1-2 min)
   - Type checking
   - Linting
   - Unit tests

3. Security Scan (1 min)
   - npm audit
   - pip safety check

4. Build Docker Image (2-3 min)
   - Builds backend container
   - Pushes to registry
```

### Step 3: Deploy to Staging (automatic)
```
1. Pull latest code
2. Deploy backend to staging
3. Verify staging API is healthy
4. Run smoke tests
5. Send Slack notification
```

**Monitor at:** `https://staging-api.your-domain.com/health`

### Step 4: Deploy to Production (requires approval)
```bash
# GitHub Actions will wait for approval
# A notification appears in your GitHub Actions dashboard

# In GitHub UI:
# 1. Go to the workflow run
# 2. Click "Review deployments"
# 3. Select "production" environment
# 4. Click "Approve and deploy"

# OR via GitHub CLI:
gh run view [RUN_ID] --log
```

### Step 5: Production Deployment
```
1. Deploy backend to production
2. Monitor API health
3. Verify database connectivity
4. Check Sentry for errors
5. Send deployment notification
```

**Monitor at:** `https://api.your-domain.com/health`

---

## Manual Deployment (if CI/CD unavailable)

### Backend Deployment

```bash
# 1. Connect to production server
ssh user@production-server.com

# 2. Update code
cd /app/see-backend
git fetch origin
git checkout main
git pull origin main

# 3. Install dependencies
source venv/bin/activate
pip install -r requirements.txt

# 4. Run database migrations
python -m alembic upgrade head

# 5. Restart service
sudo systemctl restart see-backend

# 6. Verify deployment
curl https://api.your-domain.com/health
```

### Frontend Deployment

```bash
# 1. Build production bundle
cd see-app
npm run build

# 2. Upload to hosting (e.g., Vercel, Netlify)
# For Vercel:
npx vercel --prod

# 3. Verify deployment
curl https://your-app-domain.com
```

### Mobile App Deployment

```bash
# 1. Build production app
cd see-app
eas build --platform all --auto-submit

# 2. Track submission status
eas build:list

# 3. Check App Store/Play Store review status
# (Gmail notifications from Apple/Google)

# 4. Monitor crash reports
# (Sentry dashboard)
```

---

## Monitoring During Deployment

### Real-Time Monitoring

```bash
# Terminal 1: Watch health endpoint
watch -n 5 'curl -s https://api.your-domain.com/health | jq'

# Terminal 2: Tail Sentry errors
# Open Sentry dashboard in browser
# https://sentry.io/organizations/your-org/projects/see-backend/

# Terminal 3: Monitor logs
ssh user@production-server.com
tail -f /var/log/see-backend/app.log
```

### Metrics to Watch

| Metric | Target | Critical |
|--------|--------|----------|
| API Response Time | < 500ms p95 | > 2000ms |
| Error Rate | < 1% | > 5% |
| Database Queries | < 100ms p95 | > 500ms |
| Memory Usage | < 80% | > 95% |
| CPU Usage | < 60% | > 90% |
| Disk Usage | < 70% | > 90% |

---

## Post-Deployment Verification (First 30 minutes)

### Minute 0-5: Initial Health Check
```bash
# Health endpoint
curl https://api.your-domain.com/health
# Expected: {"status": "ok", "database": "ok", "redis": "ok"}

# Database connectivity
curl https://api.your-domain.com/api/v1/auth/me
# Expected: 401 (not authenticated is ok, means API works)

# Sentry connectivity
# Expected: Errors showing up in Sentry dashboard
```

### Minute 5-15: Smoke Tests
```bash
# Test OAuth endpoint
curl -X GET https://api.your-domain.com/api/v1/auth/supabase

# Test health endpoint multiple times
for i in {1..10}; do
  curl https://api.your-domain.com/health
  sleep 1
done
# Expected: All return 200 OK

# Check response times
time curl https://api.your-domain.com/health
# Expected: < 500ms
```

### Minute 15-30: Error Monitoring
```bash
# Check Sentry for errors
# 1. Go to Sentry dashboard
# 2. Look for new issues
# 3. If critical errors: ROLLBACK (see below)
# 4. If minor errors: Monitor and plan fix

# Check logs for warnings
ssh user@production-server.com
grep -i "error\|warning" /var/log/see-backend/app.log | tail -20
```

### Minute 30+: Full Functional Test
```bash
# Mobile app test
# 1. Download app from App Store/Play Store
# 2. Sign in with Google
# 3. View job applications
# 4. Add a note
# Expected: All features work

# Web dashboard test (if applicable)
# 1. Navigate to https://your-app-domain.com
# 2. Sign in
# 3. Check all pages load
# Expected: No errors
```

---

## Rollback Procedure

### When to Rollback

Rollback if any of these occur:
- [ ] API is not responding (health check fails)
- [ ] Database connection failing
- [ ] Error rate > 5%
- [ ] Critical security issue discovered
- [ ] Data corruption detected
- [ ] More than 3 users report inability to use app

### How to Rollback

#### Option 1: Automated Rollback (GitHub Actions)

```bash
# 1. Go to GitHub Actions workflow
# 2. Click the failed deployment run
# 3. Look for rollback environment or option
# 4. Click "Rollback to previous version"

# OR via GitHub CLI:
gh run view [RUN_ID] --log  # Find previous successful run ID
gh run download [PREVIOUS_RUN_ID]  # Get previous version
```

#### Option 2: Manual Rollback

```bash
# 1. Connect to production server
ssh user@production-server.com

# 2. Check git history
cd /app/see-backend
git log --oneline -10

# 3. Identify last good commit
LAST_GOOD_COMMIT="abc123def"

# 4. Revert to last good version
git revert HEAD --no-edit
git push origin main
# OR
git reset --hard $LAST_GOOD_COMMIT
git push origin main --force

# 5. Redeploy
sudo systemctl restart see-backend

# 6. Verify
curl https://api.your-domain.com/health
```

#### Option 3: Database Rollback

```bash
# If database migrations caused issues:

# 1. List recent backups
# (Check Supabase/AWS backup console)

# 2. Restore from backup
# For Supabase:
# - Go to Supabase dashboard
# - Click "Backups"
# - Select desired backup
# - Click "Restore"
# - Confirm and wait

# 3. Redeploy application code
cd /app/see-backend
git reset --hard [GOOD_COMMIT]
sudo systemctl restart see-backend

# 4. Verify
curl https://api.your-domain.com/health
```

### Post-Rollback

```bash
# 1. Verify application is stable
curl https://api.your-domain.com/health
for i in {1..5}; do
  curl https://api.your-domain.com/api/v1/auth/me
  sleep 1
done

# 2. Check error rate
# Expected: < 1%
# (Check Sentry)

# 3. Notify team
# Email: [team-email]
# Slack: #deployments channel
# Subject: ROLLBACK - Production rolled back to [COMMIT_HASH]

# 4. Schedule incident review
# Agenda:
# - What went wrong
# - How to prevent
# - What we learned

# 5. Document in incident log
# Location: /docs/incidents/
# File: INCIDENT-2024-[DATE].md
```

---

## Emergency Contacts

During deployment, have these contacts available:

| Role | Name | Email | Phone |
|------|------|-------|-------|
| DevOps Lead | [Name] | [Email] | [Phone] |
| Backend Lead | [Name] | [Email] | [Phone] |
| Security Lead | [Name] | [Email] | [Phone] |
| On-Call | [Rotation] | [Email] | [Phone] |

---

## Communication Template

### Pre-Deployment Announcement
```
Team,

We're deploying See v1.0.0 to production today.

Timeline:
- 2:00 PM: Begin deployment
- 2:30 PM: Staging verification
- 3:00 PM: Production deployment (requires approval)
- 3:30 PM: Full verification complete

If you notice any issues, please contact [DevOps Lead] immediately.

Thanks!
```

### Post-Deployment Success
```
Production deployment successful!

See v1.0.0 is now live.
- API: https://api.your-domain.com
- Mobile: Available on App Store and Play Store
- Web: https://your-domain.com

Monitoring: https://sentry.io/organizations/your-org/projects/see-backend/

Please report any issues in #support channel.
```

### Post-Deployment Incident
```
Production incident - rollback in progress

Issue: [Brief description]
Action: Rolled back to v[X.Y.Z]
ETA: 15 minutes to stability

Real-time updates: #incidents Slack channel
Detailed analysis: Will follow within 24 hours

Thanks for your patience!
```

---

## Troubleshooting

### API is slow (response time > 2000ms)

```bash
# 1. Check database performance
psql $DATABASE_URL -c "SELECT pid, usename, state, query FROM pg_stat_activity WHERE state != 'idle';"

# 2. Check connection pool
psql $DATABASE_URL -c "SELECT setting FROM pg_settings WHERE name = 'max_connections';"

# 3. Check Redis
redis-cli ping

# 4. Scale if needed
# (Refer to platform docs for Render/Railway/AWS)
```

### Error rate is high (> 5%)

```bash
# 1. Check Sentry for error patterns
# Go to Sentry dashboard
# Sort by frequency

# 2. Check logs
ssh user@production-server.com
tail -100 /var/log/see-backend/app.log | grep ERROR

# 3. Look for common issues
# - Database connection pool exhausted
# - External API failures (Gemini, Gmail)
# - Memory leaks

# 4. Take action
# - Restart service if needed
# - Scale resources if needed
# - Rollback if necessary
```

### Database is full

```bash
# 1. Check disk space
df -h

# 2. Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# 3. Clean old logs
psql $DATABASE_URL -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"

# 4. Analyze and vacuum
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

---

## Success Criteria

Deployment is successful when:

✅ Health check returns 200 OK  
✅ Error rate < 1%  
✅ No critical Sentry issues  
✅ API response time < 500ms p95  
✅ Mobile app downloads increase  
✅ Users report successful login  
✅ Email ingestion working  
✅ Database queries responding  

---

## Post-Deployment

### Hour 1
- [ ] Monitor error rate
- [ ] Check Sentry dashboard
- [ ] Verify API performance
- [ ] Brief team on success

### Day 1
- [ ] 24-hour stability check
- [ ] Review any minor issues
- [ ] Gather user feedback
- [ ] Document deployment experience

### Week 1
- [ ] Review metrics and logs
- [ ] Identify optimization opportunities
- [ ] Plan next improvements
- [ ] Update documentation

---

## Questions?

Refer to:
- Deployment strategy: PRODUCTION_READINESS.md
- Security checklist: SECURITY_REVIEW.md
- Monitoring setup: MONITORING_SETUP.md
- Database setup: DATABASE_SETUP.md

Or contact: [DevOps Lead Email]
