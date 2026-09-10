# See - Performance Testing Guide

This guide covers load testing, profiling, and optimization for production.

---

## Performance Targets

| Component | Target | Warning | Critical |
|-----------|--------|---------|----------|
| API Response Time (p95) | < 500ms | > 1000ms | > 2000ms |
| API Response Time (p99) | < 1000ms | > 2000ms | > 5000ms |
| Error Rate | < 1% | > 3% | > 5% |
| Database Query (p95) | < 100ms | > 200ms | > 500ms |
| Mobile App Startup | < 3s | > 5s | > 10s |
| Mobile Bundle Size | < 50MB | > 60MB | > 80MB |
| Email Processing | < 5min/100 | > 10min/100 | > 20min/100 |
| Concurrent Users | 1000+ | 500+ | 100+ |

---

## Pre-Launch Performance Testing

### 1. Local Performance Profile

```bash
# Measure backend startup time
time python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Expected: < 5 seconds from start to ready
```

### 2. Simple Load Test (Apache Bench)

```bash
# Install Apache Bench
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Test health endpoint
ab -n 1000 -c 10 http://localhost:8000/health

# Results to check:
# - Requests per second (RPS)
# - Time taken for tests
# - Percentage served within time (p95, p99)
# - Failed requests (should be 0)
```

### 3. Advanced Load Test (k6)

Create `load-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // Test health endpoint
  let res = http.get('https://staging-api.your-domain.com/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test auth endpoint (requires token)
  const token = 'your-test-token'; // Get from auth flow
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  res = http.get('https://staging-api.your-domain.com/api/v1/auth/me', {
    headers: headers,
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

Run:
```bash
# Install k6
# https://k6.io/docs/getting-started/installation/

# Run load test
k6 run load-test.js --vus 10 --duration 30s

# Run against staging
k6 run load-test.js --vus 100 --duration 5m
```

### 4. Database Query Performance

```bash
# Profile slow queries
psql $DATABASE_URL << EOF
-- Enable slow query log
SET log_min_duration_statement = 100; -- Log queries > 100ms

-- Find slow queries
SELECT query, mean_time, calls, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Find missing indexes
SELECT schemaname, tablename, attname
FROM pg_stat_user_tables t
JOIN pg_attribute a ON t.relid = a.attrelid
WHERE seq_scan > 100
ORDER BY seq_scan DESC;
EOF
```

### 5. Memory Profile

```bash
# Monitor memory during load test
while true; do
  ps aux | grep 'uvicorn' | grep -v grep | awk '{print $6}'
  sleep 1
done

# Expected: Stable memory, no growth > 100MB
```

---

## Staging Environment Load Testing

### Scenario 1: Normal Load (100 concurrent users)

```bash
# Expected: All metrics within targets
ab -n 10000 -c 100 https://staging-api.your-domain.com/health

# Analyze results
# Requests per second should be > 1000
# Failed requests should be 0
# Time per request should be < 500ms average
```

### Scenario 2: Peak Load (500 concurrent users)

```bash
# Expected: Performance degradation acceptable
ab -n 50000 -c 500 https://staging-api.your-domain.com/health

# Check monitoring:
# - CPU < 90%
# - Memory < 80%
# - Error rate < 1%
```

### Scenario 3: Stress Test (1000+ concurrent users)

```bash
# Expected: System handles gracefully (not necessarily meeting all targets)
ab -n 100000 -c 1000 https://staging-api.your-domain.com/health

# Check graceful degradation:
# - API still responds (no complete failure)
# - Error rate increases but stays < 10%
# - Recovery quick when load decreases
```

### Scenario 4: Email Ingestion Load

```bash
# Simulate bulk email ingestion
# - Generate 100 sample emails
# - Measure processing time
# - Monitor CPU/Memory/Database

# Expected: < 5 minutes for 100 emails
# Actual measurement: [Your result]
```

---

## Mobile App Performance Testing

### Bundle Size Analysis

```bash
# Check JavaScript bundle size
cd see-app
npm run build
ls -lh dist/

# Expected: < 50MB total
# If exceeding: Run code splitting analysis

# Analyze bundle composition
npm install -g source-map-explorer
source-map-explorer 'dist/**/*.js'

# Look for:
# - Large dependencies
# - Duplicate modules
# - Unused code
```

### App Startup Performance

```bash
# Measure startup time on real device
adb shell am start -W -n com.example.see/.MainActivity

# Expected: < 3 seconds to app ready
# Measure from "TotalTime" in output

# For iOS (Xcode):
# 1. Run app in Xcode
# 2. Monitor > Instruments > App Launch
# 3. Check startup time
```

### Animation/Scroll Performance

```bash
# Monitor frame rate
# Android: Check "Show frame rate" in developer options
# iOS: Check "Color Blended Layers" in Xcode

# Expected: 60 FPS consistently
# Acceptable: Not dropping below 50 FPS
```

---

## Continuous Monitoring (Production)

### Real-Time Metrics

Monitor these continuously:

**API Metrics:**
```bash
# Via Sentry or APM tool
- Request rate (requests/min)
- Response time (p50, p95, p99)
- Error rate (percentage)
- Slow transactions
```

**Database Metrics:**
```bash
# Via database monitoring
- Connection count
- Query response time
- Cache hit rate
- Lock contention
```

**Infrastructure Metrics:**
```bash
# Via cloud provider
- CPU utilization
- Memory utilization
- Disk I/O
- Network I/O
```

### Alerting Rules

Set up alerts for:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 5% | Page on-call engineer |
| API p95 | > 2000ms | Alert on Slack |
| Database connections | > 90% | Scale or alert |
| Memory | > 90% | Scale or alert |
| Disk usage | > 85% | Alert to ops |

---

## Optimization Strategies

### If API response time is slow (> 500ms):

1. **Check database queries**
   ```bash
   # Find slow queries
   SELECT query, mean_time FROM pg_stat_statements
   ORDER BY mean_time DESC LIMIT 10;
   
   # Add indexes if needed
   CREATE INDEX idx_user_email ON users(email);
   ```

2. **Check N+1 queries**
   ```python
   # Bad:
   users = User.query.all()
   for user in users:
       jobs = Job.query.filter_by(user_id=user.id).all()
   
   # Good:
   users = User.query.options(joinedload(User.jobs)).all()
   ```

3. **Add caching**
   ```python
   from functools import lru_cache
   
   @lru_cache(maxsize=128)
   def get_user_profile(user_id: str):
       return User.query.get(user_id)
   ```

4. **Optimize endpoints**
   ```python
   # Reduce payload size
   @router.get("/api/v1/jobs")
   async def get_jobs(skip: int = 0, limit: int = 10):
       # Only return needed fields
       return db.query(Job).offset(skip).limit(limit).all()
   ```

### If database is slow:

1. **Check connection pool**
   ```bash
   # Monitor
   psql -c "SELECT count(*) FROM pg_stat_activity;"
   
   # Increase pool size if needed
   # DATABASE_POOL_SIZE=30  # from 20
   # DATABASE_MAX_OVERFLOW=50  # from 40
   ```

2. **Analyze query plans**
   ```bash
   EXPLAIN ANALYZE SELECT * FROM jobs WHERE user_id = '123';
   # Look for Sequential Scans - these need indexes
   ```

3. **Add covering indexes**
   ```bash
   # Indexes that include all columns needed
   CREATE INDEX idx_jobs_user_status 
   ON jobs(user_id) INCLUDE (status, created_at);
   ```

### If memory usage is high:

1. **Profile application**
   ```bash
   # Using memory_profiler
   pip install memory-profiler
   python -m memory_profiler app/main.py
   ```

2. **Check for memory leaks**
   ```bash
   # Monitor memory growth over time
   watch -n 5 'ps aux | grep uvicorn | grep -v grep | awk "{print \$6}"'
   ```

3. **Reduce data in memory**
   ```python
   # Stream large datasets instead of loading all
   for batch in get_records_in_batches(size=1000):
       process_batch(batch)
   ```

### If error rate is high:

1. **Check Sentry for error patterns**
   - Go to Sentry dashboard
   - Sort by frequency
   - Fix top errors first

2. **Add retry logic for external APIs**
   ```python
   from tenacity import retry, stop_after_attempt
   
   @retry(stop=stop_after_attempt(3))
   async def call_external_api():
       return await api.call()
   ```

3. **Add circuit breaker for failing services**
   ```python
   from pybreaker import CircuitBreaker
   
   breaker = CircuitBreaker(fail_max=5, reset_timeout=60)
   
   @breaker
   async def call_service():
       return await service.call()
   ```

---

## Performance Regression Testing

Before each deployment:

```bash
# 1. Baseline test on staging
k6 run load-test.js --vus 100 --duration 5m > baseline.json

# 2. Deploy new version

# 3. Post-deployment test
k6 run load-test.js --vus 100 --duration 5m > postdeploy.json

# 4. Compare results
# If performance degraded > 10%:
# - Investigate changes
# - Optimize before production deployment
# - Or rollback to previous version
```

---

## Reporting Performance

### Weekly Report Template

```
Performance Report - Week of [Date]

Metrics:
- Average API response time: [Xms]
- p95 response time: [Xms]
- Error rate: [X%]
- Peak concurrent users: [X]
- Database query average: [Xms]

Trends:
- Response time: [↑ increasing / ↓ decreasing / → stable]
- Error rate: [↑ increasing / ↓ decreasing / → stable]

Issues identified:
1. [Issue and action taken]
2. [Issue and action taken]

Optimizations planned:
1. [Optimization for next week]
2. [Optimization for next week]
```

---

## Tools & Resources

### Load Testing Tools
- [k6](https://k6.io/) - Modern load testing
- [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html) - Simple HTTP load testing
- [Locust](https://locust.io/) - Python-based load testing
- [JMeter](https://jmeter.apache.org/) - Enterprise load testing

### Monitoring Tools
- [Sentry](https://sentry.io/) - Error tracking (already configured)
- [DataDog](https://www.datadoghq.com/) - Infrastructure monitoring
- [New Relic](https://newrelic.com/) - APM and monitoring
- [Prometheus](https://prometheus.io/) - Metrics collection

### Profiling Tools
- [py-spy](https://github.com/benfred/py-spy) - Python profiler
- [memory_profiler](https://pypi.org/project/memory-profiler/) - Memory profiling
- [line_profiler](https://pypi.org/project/line_profiler/) - Line-by-line profiling
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - JavaScript profiling

---

## Checklist Before Production

Performance testing complete when:
- [ ] Load test with 100 concurrent users passed
- [ ] Load test with 500 concurrent users passed (acceptable degradation)
- [ ] p95 response time < 500ms
- [ ] Error rate < 1%
- [ ] Database queries < 100ms p95
- [ ] Memory stable (no leaks)
- [ ] Mobile bundle size < 50MB
- [ ] App startup time < 3s
- [ ] No performance regression vs. staging
- [ ] Monitoring and alerts configured
- [ ] Team briefed on performance expectations

---

## Questions?

Refer to:
- Monitoring setup: MONITORING_SETUP.md
- Deployment runbook: DEPLOYMENT_RUNBOOK.md
- Production readiness: PRODUCTION_READINESS.md

Or contact: [DevOps Lead Email]
