# Documentation Directory

## Organization

### /docs/setup/
Getting started and environment setup
- ENVIRONMENT_SETUP.md - Configure dev/staging/production environments
- setup-env.sh - Quick setup script

### /docs/infrastructure/
Deployment and infrastructure
- DATABASE_SETUP.md - Database configuration and options
- DEPLOYMENT_RUNBOOK.md - Step-by-step deployment procedures
- ENVIRONMENT_SETUP.md - Environment configuration

### /docs/operations/
Runbooks and procedures
- DEPLOYMENT_RUNBOOK.md - Production deployment procedures
- PRODUCTION_LAUNCH_CHECKLIST.md - 3-week launch timeline

### /docs/security/
Security and compliance
- SECURITY_REVIEW.md - Security hardening checklist

### /docs/monitoring/
Observability and monitoring
- MONITORING_SETUP.md - Sentry integration and monitoring
- PERFORMANCE_TESTING.md - Load testing and optimization

### /docs/legacy/
Legacy and archived documentation
- PRODUCTION_READINESS.md - Initial assessment (archived)
- READINESS_CHECK.md - Readiness check (archived)
- See_PRD.docx - Product requirements (archived)
- deployment.md - Deployment notes (archived)
- integration.md - Integration notes (archived)
- plan.md - Planning notes (archived)
- render.md - Render deployment notes (archived)
- build_prd.py - Build script (archived)
- design/ - Design files (archived)

## Public vs Internal

### Public-Facing (commit to repo)
- README.md (root)
- PRODUCTION_READY.md (root)
- docs/setup/*
- docs/infrastructure/*
- docs/operations/*
- docs/security/*
- docs/monitoring/*

### Internal-Only (gitignore)
- docs/legacy/*
- Design files
- Build scripts
- Old notes

## Quick Links

- **For new team members**: Start with README.md, then docs/setup/ENVIRONMENT_SETUP.md
- **For deployment**: See docs/operations/DEPLOYMENT_RUNBOOK.md
- **For security review**: See docs/security/SECURITY_REVIEW.md
- **For monitoring**: See docs/monitoring/MONITORING_SETUP.md
- **For performance**: See docs/monitoring/PERFORMANCE_TESTING.md
