# See Documentation

## Quick Navigation

### For Getting Started
- **New to the project?** Start with [../README.md](../README.md)
- **Setting up your environment?** See [setup/ENVIRONMENT_SETUP.md](setup/ENVIRONMENT_SETUP.md)

### For Operations
- **Deploying to production?** See [operations/DEPLOYMENT_RUNBOOK.md](operations/DEPLOYMENT_RUNBOOK.md)
- **3-week launch timeline?** See [operations/PRODUCTION_LAUNCH_CHECKLIST.md](operations/PRODUCTION_LAUNCH_CHECKLIST.md)

### For Infrastructure
- **Database setup?** See [infrastructure/DATABASE_SETUP.md](infrastructure/DATABASE_SETUP.md)

### For Security
- **Security review?** See [security/SECURITY_REVIEW.md](security/SECURITY_REVIEW.md)

### For Monitoring & Performance
- **Setting up error tracking?** See [monitoring/MONITORING_SETUP.md](monitoring/MONITORING_SETUP.md)
- **Load testing?** See [monitoring/PERFORMANCE_TESTING.md](monitoring/PERFORMANCE_TESTING.md)

---

## Documentation Structure

### /setup/
Getting started and environment configuration
- ENVIRONMENT_SETUP.md - Configure dev/staging/production environments

### /infrastructure/
Deployment and infrastructure setup
- DATABASE_SETUP.md - Database options (Supabase, AWS RDS, DigitalOcean) and configuration

### /operations/
Deployment runbooks and procedures
- DEPLOYMENT_RUNBOOK.md - Step-by-step production deployment guide
- PRODUCTION_LAUNCH_CHECKLIST.md - 3-week launch timeline with detailed checklist

### /security/
Security and compliance documentation
- SECURITY_REVIEW.md - Security hardening checklist and best practices

### /monitoring/
Observability, monitoring, and performance
- MONITORING_SETUP.md - Sentry error tracking setup
- PERFORMANCE_TESTING.md - Load testing and performance optimization

### /legacy/
Archived documentation (not in production repo)
- PRODUCTION_READINESS.md - Initial assessment
- READINESS_CHECK.md - Readiness verification
- design/ - Design files and mockups
- See_PRD.docx - Product requirements document
- Other planning documents

---

## For Different Roles

### Product Manager
- Read: README.md, operations/PRODUCTION_LAUNCH_CHECKLIST.md

### DevOps Engineer
- Read: operations/DEPLOYMENT_RUNBOOK.md, infrastructure/DATABASE_SETUP.md, monitoring/MONITORING_SETUP.md
- Reference: security/SECURITY_REVIEW.md

### Backend Engineer
- Read: setup/ENVIRONMENT_SETUP.md, infrastructure/DATABASE_SETUP.md
- Reference: security/SECURITY_REVIEW.md, monitoring/PERFORMANCE_TESTING.md

### Mobile Engineer
- Read: setup/ENVIRONMENT_SETUP.md, monitoring/PERFORMANCE_TESTING.md

### New Team Member
1. Start with ../README.md
2. Run setup/ENVIRONMENT_SETUP.md
3. Review security/SECURITY_REVIEW.md
4. Read operations/DEPLOYMENT_RUNBOOK.md

---

## Common Tasks

### How do I set up a development environment?
See [setup/ENVIRONMENT_SETUP.md](setup/ENVIRONMENT_SETUP.md) - Development Setup section

### How do I deploy to staging?
See [operations/DEPLOYMENT_RUNBOOK.md](operations/DEPLOYMENT_RUNBOOK.md) - GitHub Actions deploys automatically

### How do I deploy to production?
See [operations/DEPLOYMENT_RUNBOOK.md](operations/DEPLOYMENT_RUNBOOK.md) - Manual approval required

### What database should I use?
See [infrastructure/DATABASE_SETUP.md](infrastructure/DATABASE_SETUP.md)

### How do I set up monitoring?
See [monitoring/MONITORING_SETUP.md](monitoring/MONITORING_SETUP.md)

### What are the security requirements?
See [security/SECURITY_REVIEW.md](security/SECURITY_REVIEW.md)

---

## File Organization

### Public Documentation (Committed to Repo)
- All files in `/setup`, `/infrastructure`, `/operations`, `/security`, `/monitoring`

### Internal Documentation (Gitignored)
- All files in `/legacy`
- All design files
- Product requirement documents

---

## Version Control

### What Gets Committed
- Operational runbooks
- Setup guides
- Security policies
- Infrastructure documentation

### What Gets Gitignored
- Legacy/outdated documentation
- Design files and mockups
- Product planning documents
- Historical notes

---

## Contributing

When adding new documentation:
1. Determine category (setup, infrastructure, operations, security, monitoring)
2. Place in appropriate `/docs/[category]/` folder
3. Add link to this README
4. If document is historical or internal-only, it will be added to `/docs/legacy/` and gitignored

---

## Questions?

Refer to the appropriate documentation section above, or check the legacy folder for historical context.
