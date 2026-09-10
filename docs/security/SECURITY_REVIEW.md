# See - Security Review & Hardening Guide

This guide covers all security aspects for production deployment.

---

## Security Checklist

### Authentication & Authorization
- [x] Supabase JWT-based authentication
- [x] OAuth support (Google, GitHub)
- [ ] Rate limiting on auth endpoints
- [ ] Session timeout enforcement
- [ ] Multi-factor authentication (optional)

### Data Protection
- [x] HTTPS enforcement in production
- [x] Database encryption (Supabase handles)
- [x] API credentials in environment variables
- [ ] Encryption at rest for sensitive fields
- [ ] PII redaction in logs

### Network Security
- [x] CORS properly configured
- [x] Security headers implemented
- [x] Rate limiting enabled
- [x] Input validation
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection

### Secrets Management
- [x] No hardcoded secrets in code
- [x] .env files gitignored
- [x] Secrets in environment variables
- [ ] Secrets rotation schedule
- [ ] Audit log for secret access

### Dependency Security
- [ ] Dependency scanning (npm audit, pip check)
- [ ] Regular updates
- [ ] Security patch process
- [ ] Vulnerability monitoring

### Operations Security
- [x] Error tracking (Sentry)
- [x] Monitoring & alerting
- [ ] Incident response plan
- [ ] Backup & recovery tested
- [ ] Access control to production
- [ ] Audit logs enabled

---

## Security Features Implemented

### 1. Security Headers

**Implemented in app/core/security.py:**

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 1; mode=block | XSS protection |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS |
| Content-Security-Policy | restricted | Prevent injection attacks |
| Referrer-Policy | strict-origin-when-cross-origin | Privacy |
| Permissions-Policy | Restricted | Block dangerous APIs |

### 2. Rate Limiting

**Limits by environment:**
- Development: Disabled
- Staging: 500 requests/minute
- Production: 300 requests/minute

**Implemented:**
```python
# In RateLimitMiddleware
if len(self.requests[client_ip]) >= self.limit_per_minute:
    return HTTPException(429, "Too many requests")
```

**In production, use Redis-based rate limiting:**
```bash
# Via package like slowapi
pip install slowapi
```

### 3. HTTPS Enforcement

**Enforced in production:**
```python
# HTTPSEnforceMiddleware
if settings.APP_ENV == "production":
    if not request.url.scheme == "https":
        return HTTPException(403, "HTTPS required")
```

### 4. Input Validation

**Prevents injection attacks:**
```python
# RequestValidationMiddleware checks for:
- JavaScript injection
- SQL injection
- HTML injection
- Null byte injection
```

### 5. CORS Configuration

**Strict in production:**
```python
# Only allow specified domains
CORS_ORIGINS=https://your-app-domain.com,https://www.your-app-domain.com

# NOT allowed (security risk):
CORS_ORIGINS=*
```

### 6. JWT Validation

**Handled by app/core/auth.py:**
```python
def _decode_supabase_jwt(token: str) -> dict:
    # Validates:
    # - Token signature (RS256 or HS256)
    # - Token expiration
    # - Token issuer
    # - Token audience
```

---

## Security Best Practices

### DO:

1. **Rotate secrets regularly**
   ```bash
   # Every 90 days
   - Rotate Gemini API key
   - Rotate Gmail app password
   - Rotate internal API tokens
   ```

2. **Monitor security logs**
   - Check Sentry for auth failures
   - Monitor rate limit hits
   - Review access logs

3. **Keep dependencies updated**
   ```bash
   # Monthly
   npm audit fix
   pip check
   ```

4. **Test security regularly**
   ```bash
   # Before production
   - Test HTTPS enforcement
   - Test CORS rejection
   - Test rate limiting
   - Test input validation
   ```

5. **Implement least privilege**
   - Database users with minimal permissions
   - API keys with specific scopes
   - IAM roles for cloud services

### DON'T:

1. **Hardcode secrets**
   [BAD] `API_KEY = "sk_live_xxxxx"` in code
   [GOOD] `API_KEY = os.getenv("API_KEY")`

2. **Use `*` in CORS**
   [BAD] `CORS_ORIGINS=*` (allows any domain)
   [GOOD] `CORS_ORIGINS=https://yourdomain.com`

3. **Trust user input**
   ❌ `search_query = request.query_params["q"]`
   ✅ `search_query = sanitize_input(request.query_params["q"])`

4. **Log sensitive data**
   ❌ `logger.info(f"Password: {password}")`
   ✅ Sentry automatically redacts sensitive fields

5. **Ignore security warnings**
   ❌ Ignore `npm audit` warnings
   ✅ Fix vulnerabilities before deployment

---

## Authentication Flow Security

### OAuth Sign-In (Secure)
```
User
  ↓ clicks "Sign in with Google"
  ↓
App redirects to Supabase Auth
  ↓
Supabase redirects to Google
  ↓
User authenticates with Google
  ↓
Google redirects back to Supabase
  ↓
Supabase creates JWT token
  ↓
App receives JWT (secure token)
  ↓
Backend validates JWT with Supabase public key (JWKS)
  ↓
Access granted
```

**Security features:**
- OAuth providers handle password storage
- JWT tokens are cryptographically signed
- Tokens expire automatically (3600 seconds default)
- Backend validates every request

### Token Validation
```python
# Every API request validates:
from app.core.auth import get_current_user_id

@router.get("/api/v1/jobs")
async def get_jobs(user_id: UUID = Depends(get_current_user_id)):
    # If token invalid/expired, returns 401 Unauthorized
    ...
```

---

## Data Protection

### Personally Identifiable Information (PII)

**What's protected:**
- User email (from Supabase)
- Job application details (user-specific)
- Notes and reminders (user-specific)

**How:**
- Database uses Supabase's managed encryption
- Row-level security can be configured (optional)
- Sensitive fields excluded from logs

### Secrets Management

**Store these in environment variables (NOT in code):**
- Database passwords
- API keys (Gemini, Gmail)
- JWT secrets
- Webhook secrets
- Session secrets

**Never commit:**
```bash
# DO NOT commit these files:
.env
.env.production
.env.staging
keystore.json (Android)
*.p8 (iOS)
```

---

## Vulnerability Scanning

### Regular Audits

```bash
# Backend dependencies
cd see-backend
pip install safety
safety check  # Scans for known vulnerabilities

# Frontend dependencies
cd see-app
npm audit  # Check for vulnerabilities
npm audit fix  # Auto-fix where possible
```

### Automated Scanning

**GitHub Actions (optional):**
```yaml
- name: Security scan
  run: |
    npm audit
    pip install safety && safety check
```

---

## Incident Response

### If a Secret is Compromised

1. **Immediately revoke:**
   ```bash
   # Rotate the compromised secret
   - Change Gemini API key
   - Change Gmail app password
   - Regenerate JWT secret
   ```

2. **Investigate:**
   - Check Sentry logs for unauthorized access
   - Review database audit logs (if available)
   - Monitor for suspicious activity

3. **Notify:**
   - Inform stakeholders
   - Update security documentation
   - Brief team on prevention

### If a Vulnerability is Discovered

1. **Assess severity:**
   - Critical: Immediate patch needed
   - High: Patch within 24 hours
   - Medium: Patch within 1 week
   - Low: Patch in next release

2. **Patch and test:**
   - Update dependency version
   - Run full test suite
   - Test in staging first

3. **Deploy:**
   - Create hotfix branch
   - Deploy to production
   - Monitor Sentry for issues

---

## Security Headers Explained

### Strict-Transport-Security (HSTS)
```
Forces HTTPS for all connections
max-age=31536000: Cached for 1 year
includeSubDomains: Apply to subdomains
preload: Allow browser preload list
```

### Content-Security-Policy (CSP)
```
Prevents injection attacks by controlling resources
default-src 'self': Only load from same origin
script-src 'self': Scripts only from same origin
img-src 'self' data: https:: Allow self, data URIs, HTTPS
```

### X-Frame-Options
```
DENY: Prevent embedding in iframes
Protects against clickjacking attacks
```

---

## CORS Security

### Current Configuration
```python
# Development (relaxed):
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081

# Production (strict):
CORS_ORIGINS=https://your-app-domain.com,https://www.your-app-domain.com
```

### What CORS Controls
- Which domains can make requests to API
- Which headers are allowed
- Which methods are allowed
- Whether credentials (cookies) are sent

### Browser enforces CORS
```
Frontend (yourdomain.com) → API (api.yourdomain.com)
Browser checks:
1. Is origin allowed? (CORS_ORIGINS setting)
2. Are headers allowed? (allow_headers: *)
3. Is method allowed? (allow_methods: *)
4. Send with credentials? (allow_credentials: true)
```

---

## Before Production Launch Checklist

### Security
- [ ] All secrets removed from code
- [ ] Environment variables configured
- [ ] HTTPS enforced in production config
- [ ] CORS restricted to your domain(s)
- [ ] Security headers tested
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] Error messages don't leak info

### Authentication
- [ ] OAuth configured (Google, GitHub)
- [ ] JWT validation working
- [ ] Token expiration enforced
- [ ] Logout works (token invalidation)
- [ ] Account recovery tested

### Data Protection
- [ ] Database backups enabled
- [ ] Encryption at rest (Supabase default)
- [ ] Encryption in transit (SSL/TLS)
- [ ] PII not in logs
- [ ] Sentry redaction working

### Operations
- [ ] Monitoring configured (Sentry)
- [ ] Alerts configured
- [ ] Incident response plan documented
- [ ] Team trained on security
- [ ] Access controls documented
- [ ] Audit logs enabled

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/security/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

## Next Steps

1. **Review each section** of this guide
2. **Verify all implementations** in code
3. **Test security features** (HTTPS, CORS, rate limiting)
4. **Configure Sentry** with data redaction
5. **Document security procedures** for your team
6. **Schedule security audits** (quarterly recommended)
