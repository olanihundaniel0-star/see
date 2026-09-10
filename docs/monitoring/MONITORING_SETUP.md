# See - Error Tracking & Monitoring Setup

This guide covers setting up Sentry for production error tracking and monitoring.

---

## What is Sentry?

Sentry is an error tracking and performance monitoring platform that:
- **Captures exceptions** in real-time
- **Groups similar errors** together
- **Tracks performance metrics** (response times, database queries)
- **Alerts on critical errors**
- **Provides dashboards** for monitoring health

**Pricing:**
- Free tier: 5,000 events/month (good for small projects)
- Paid: Starts at $29/month

---

## Setting Up Sentry

### Step 1: Create Sentry Account

1. Go to https://sentry.io
2. Sign up (free account)
3. Create new organization (e.g., "See")
4. Create new project:
   - Platform: **Python** (for backend)
   - Alert platform: **FastAPI**
   - Select **Release tracking**

### Step 2: Get DSN

After creating project:
```
https://[PROJECT_ID]@[ORG].ingest.sentry.io/[ACCOUNT_ID]
```

Save this URL - you'll need it for configuration.

### Step 3: Configure Backend

#### Add to see-backend/.env (development - optional)
```bash
SENTRY_DSN=  # Leave empty for development
```

#### Add to see-backend/.env.staging
```bash
SENTRY_DSN=https://[YOUR_DSN]@sentry.io/[PROJECT_ID]
```

#### Add to see-backend/.env.production
```bash
SENTRY_DSN=https://[YOUR_DSN]@sentry.io/[PROJECT_ID]
```

### Step 4: Install Dependencies

```bash
cd see-backend
pip install -r requirements.txt  # Already includes sentry-sdk[fastapi]
```

### Step 5: Test Sentry

```python
# Quick test
python3 << 'EOF'
import sentry_sdk

sentry_sdk.init("YOUR_DSN_HERE")

try:
    1 / 0
except ZeroDivisionError:
    sentry_sdk.capture_exception()

print("✅ Event sent to Sentry")
EOF
```

Then check Sentry dashboard - you should see the error appear within seconds.

---

## Sentry Features

### 1. Error Tracking

**Automatic capture:**
- All unhandled exceptions are automatically sent
- Groups similar errors together
- Shows stack traces with source code

**Manual capture:**
```python
from app.core.monitoring import capture_exception, capture_message

# Capture exception
try:
    risky_operation()
except Exception as e:
    capture_exception(e)

# Capture message
capture_message("Important event occurred", level="warning")
```

### 2. Performance Monitoring

**Automatic:**
- HTTP request/response times
- Database query times
- Redis operation times

**Sample rates by environment:**
- Development: 0% (disabled)
- Staging: 10% of transactions
- Production: 5% of transactions

**View in dashboard:**
- Performance → Transactions
- See slowest endpoints
- Identify bottlenecks

### 3. Release Tracking

Track which version of code has errors:

```bash
# In deployment script:
export VERSION=1.0.1
docker run -e SENTRY_RELEASE=$VERSION see-backend
```

Then in Sentry:
- Errors are tagged with release
- See which releases have issues
- Track error trends across versions

### 4. User Context

Track which user encountered the error:

```python
from app.core.monitoring import set_user_context, clear_user_context

@router.get("/api/v1/jobs")
async def get_jobs(user_id: UUID, db: AsyncSession = Depends(get_db)):
    # Set user context for all errors in this request
    set_user_context(str(user_id))
    
    try:
        jobs = await get_user_jobs(db, user_id)
        return jobs
    finally:
        # Clear context when done
        clear_user_context()
```

### 5. Custom Attributes

Tag errors with custom information:

```python
import sentry_sdk

# Tag specific error
sentry_sdk.set_tag("feature", "gmail_polling")
sentry_sdk.set_tag("email_provider", "gmail")

# Set context
sentry_sdk.set_context("email", {
    "subject": email_subject,
    "from": sender_email,
})
```

---

## Monitoring Dashboard

### Key Metrics to Watch

1. **Error Rate**
   - Path: Issues → Stats
   - Alert if > 1% of requests fail
   - Check for spikes after deployments

2. **Response Time**
   - Path: Performance → Transactions
   - Target: <500ms p95
   - Watch for database slow queries

3. **Critical Errors**
   - Path: Issues → Errors
   - Database connection failures
   - Auth token validation errors
   - Gmail API failures

4. **Releases**
   - Path: Releases
   - See errors introduced by each release
   - Rollback if critical issues detected

### Setting Up Alerts

**Email alerts:**
1. Settings → Integrations → Email
2. Rules → New Alert Rule
3. Conditions:
   - When: An event is captured
   - If: Error count > 10 in 5 minutes
   - Then: Send email

**Slack integration (optional):**
1. Sentry Settings → Integrations → Slack
2. Grant Sentry access to Slack workspace
3. Route errors to specific channel

---

## Data Privacy & Redaction

Sentry automatically redacts:
- Passwords
- API keys
- Authorization tokens
- User credentials

**Custom redaction in monitoring.py:**
```python
def before_send_sentry(event, hint):
    # Automatically removes sensitive keys
    if "request" in event:
        event["request"]["headers"] = redact_dict(event["request"]["headers"])
    return event
```

**Never send:**
- Credit card numbers
- Social security numbers
- Personal health information

---

## Performance Monitoring

### Transaction Sampling

```python
# In .env.production:
SENTRY_TRACE_SAMPLE_RATE=0.05  # 5% of transactions

# Why sampling?
# - Reduces cost and data volume
# - Captures representative sample of performance
# - Still catches all errors
```

### Common Performance Issues to Track

1. **Slow API Endpoints**
   - Database N+1 queries
   - Missing indexes
   - Inefficient ORM usage

2. **Database Queries**
   - Long-running migrations
   - Full table scans
   - Connection pool exhaustion

3. **External APIs**
   - Gemini API timeouts
   - Gmail IMAP timeouts
   - Supabase query slowness

### Optimization Workflow

1. **Identify** - Find slow transactions in Sentry
2. **Trace** - Look at stack trace to find bottleneck
3. **Fix** - Optimize code or database
4. **Monitor** - Watch metrics after fix

---

## Celery Task Monitoring

Monitor background jobs:

```python
# In app/workers/tasks.py
import sentry_sdk
from celery import Task

class SentryTask(Task):
    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        if einfo:
            sentry_sdk.capture_exception(einfo.exception)

@app.task(base=SentryTask)
def process_gmail_emails():
    # Error will be automatically captured
    emails = fetch_gmail_emails()
    for email in emails:
        extract_and_save(email)
```

---

## Troubleshooting

### Issue: Events not appearing in Sentry

**Check:**
```bash
# 1. Is SENTRY_DSN set?
echo $SENTRY_DSN

# 2. Test connection
python3 << 'EOF'
import sentry_sdk
sentry_sdk.init("YOUR_DSN")
sentry_sdk.capture_message("Test event")
EOF

# 3. Check Sentry dashboard - Settings → Issues
```

### Issue: Too many events (high cost)

**Solutions:**
1. Reduce sample rate:
   ```bash
   SENTRY_TRACE_SAMPLE_RATE=0.01  # 1% instead of 5%
   ```

2. Filter out noisy errors:
   - Sentry → Settings → Inbound Filters
   - Ignore specific errors

3. Error budgeting:
   - Set limits per environment
   - Only capture critical errors in production

### Issue: Missing source maps

**Fix:**
```bash
# Upload source maps to Sentry
sentry-cli releases files upload-sourcemaps /path/to/dist
```

---

## Best Practices

### ✅ DO:
- Tag all major features
- Set user context when available
- Monitor critical workflows (auth, email)
- Use appropriate log levels
- Review alerts daily
- Triage errors regularly

### ❌ DON'T:
- Ignore warnings in production
- Leave errors unresolved for weeks
- Send sensitive PII to Sentry
- Use Sentry as a logging service (too expensive)
- Forget to redact data

---

## Monitoring Checklist

### Before Production Launch
- [ ] Sentry account created
- [ ] DSN configured in .env.production
- [ ] Error tracking tested
- [ ] Performance monitoring enabled
- [ ] User context implemented
- [ ] Critical errors defined
- [ ] Alert rules created
- [ ] Slack integration (optional)
- [ ] Data privacy review completed

### Ongoing Monitoring
- [ ] Daily: Review critical errors
- [ ] Weekly: Check performance metrics
- [ ] Monthly: Review error trends
- [ ] After deployment: Monitor for new errors
- [ ] Quarterly: Optimize based on data

---

## Next Steps

1. **Create Sentry account** at https://sentry.io
2. **Get DSN** from project settings
3. **Add to .env.staging and .env.production**
4. **Test error capture:**
   ```bash
   cd see-backend
   python3 -m uvicorn app.main:app --reload
   # Visit http://localhost:8000/test-error (if endpoint exists)
   ```
5. **Check Sentry dashboard** within seconds
6. **Set up alerts** for critical errors
7. **Monitor during staging testing**

---

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [FastAPI Integration](https://docs.sentry.io/platforms/python/integrations/fastapi/)
- [Performance Monitoring](https://docs.sentry.io/platforms/python/performance/)
- [Pricing](https://sentry.io/pricing/)
