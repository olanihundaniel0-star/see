#!/bin/bash
# See Project Diagnostic Script
set -e

echo "============================================================"
echo " See Project Diagnostic"
echo "============================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo "  $1"
}

section() {
    echo ""
    echo "============================================================"
    echo " $1"
    echo "============================================================"
}

# Check working directory
section "Project Structure"
if [ -d "see-backend" ] && [ -d "see-app" ]; then
    success "Project directories found"
else
    error "Not in project root directory"
    exit 1
fi

# Backend checks
section "Backend Environment"
if [ -d "see-backend/.venv" ]; then
    success "Virtual environment exists"
    PYTHON="see-backend/.venv/bin/python"
else
    error "Virtual environment missing"
    echo "  Run: cd see-backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    PYTHON="python3"
fi

# Check Python version
info "Python: $($PYTHON --version)"
info "Path: $PYTHON"

# Check backend dependencies
section "Backend Dependencies"
if [ -f "see-backend/.venv/bin/python" ]; then
    $PYTHON -c "import fastapi" 2>/dev/null && success "fastapi" || error "fastapi missing"
    $PYTHON -c "import sqlalchemy" 2>/dev/null && success "sqlalchemy" || error "sqlalchemy missing"
    $PYTHON -c "import celery" 2>/dev/null && success "celery" || error "celery missing"
    $PYTHON -c "import redis" 2>/dev/null && success "redis" || error "redis missing"
    $PYTHON -c "import asyncpg" 2>/dev/null && success "asyncpg" || error "asyncpg missing"
    $PYTHON -c "import pydantic" 2>/dev/null && success "pydantic" || error "pydantic missing"
    $PYTHON -c "import jwt" 2>/dev/null && success "pyjwt" || error "pyjwt missing"
    $PYTHON -c "import bs4" 2>/dev/null && success "beautifulsoup4" || error "beautifulsoup4 missing"
else
    warning "Skipping dependency check (venv not activated)"
fi

# Check backend imports
section "Backend Application"
if [ -f "see-backend/.venv/bin/python" ]; then
    cd see-backend
    $PYTHON -c "from app.main import app; print('✓ FastAPI app imports')" 2>/dev/null || error "FastAPI app import failed"
    $PYTHON -c "from app.models import JobApplication, Note, Reminder, ScrapedEvent; print('✓ Models import')" 2>/dev/null || error "Models import failed"
    $PYTHON -c "from app.schemas import JobApplicationRead, NoteRead, EventRead; print('✓ Schemas import')" 2>/dev/null || error "Schemas import failed"
    $PYTHON -c "from app.workers.celery_app import celery_app; print('✓ Celery app imports')" 2>/dev/null || error "Celery import failed"
    cd ..
fi

# Check configuration
section "Configuration"
if [ -f "see-backend/.env" ]; then
    success "Backend .env exists"
else
    warning "Backend .env missing (using defaults from .env.example)"
fi

if [ -f "see-app/.env" ]; then
    success "Frontend .env exists"
else
    warning "Frontend .env missing"
fi

# Check secrets
if [ -f "see-backend/.env" ]; then
    if grep -q "replace-me" "see-backend/.env" 2>/dev/null; then
        warning "Some secrets still set to 'replace-me'"
    else
        success "Secrets appear to be configured"
    fi
fi

# Check PostgreSQL
section "PostgreSQL"
if command -v psql &> /dev/null; then
    success "psql installed"
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw see; then
        success "Database 'see' exists"
    else
        warning "Database 'see' not found"
        info "Create with: createdb see"
    fi
else
    warning "psql not installed (cannot check database)"
fi

# Check Redis
section "Redis"
if command -v redis-cli &> /dev/null; then
    success "redis-cli installed"
    if redis-cli ping &>/dev/null; then
        success "Redis server is running"
    else
        error "Redis server not running"
        info "Start with: redis-server"
    fi
else
    warning "redis-cli not installed"
fi

# Check migrations
section "Database Migrations"
if [ -d "see-backend/alembic/versions" ]; then
    MIGRATION_COUNT=$(ls see-backend/alembic/versions/*.py 2>/dev/null | grep -v __pycache__ | wc -l)
    success "Found $MIGRATION_COUNT migration files"
    ls see-backend/alembic/versions/*.py 2>/dev/null | grep -v __pycache__ | while read f; do
        info "- $(basename $f)"
    done
else
    error "Migrations directory not found"
fi

# Check frontend
section "Frontend"
if [ -d "see-app/node_modules" ]; then
    success "node_modules exists"
    PKG_COUNT=$(ls -1 see-app/node_modules | wc -l)
    info "$PKG_COUNT packages installed"
else
    error "node_modules missing"
    info "Run: cd see-app && npm install"
fi

# Check key frontend packages
if [ -d "see-app/node_modules/expo" ]; then
    success "expo installed"
else
    error "expo missing"
fi

if [ -d "see-app/node_modules/react-native" ]; then
    success "react-native installed"
else
    error "react-native missing"
fi

# Summary
section "Summary"
echo ""
echo "Setup Commands:"
echo ""
echo "  1. Backend virtual environment:"
echo "     cd see-backend"
echo "     python3 -m venv .venv"
echo "     .venv/bin/pip install -r requirements.txt"
echo ""
echo "  2. Environment files:"
echo "     cd see-backend && cp .env.example .env"
echo "     # Edit .env with real values"
echo ""
echo "  3. Database:"
echo "     createdb see  # or use Supabase"
echo "     cd see-backend && .venv/bin/alembic upgrade head"
echo ""
echo "  4. Redis:"
echo "     redis-server  # or: docker run -d -p 6379:6379 redis:alpine"
echo ""
echo "  5. Frontend:"
echo "     cd see-app && npm install"
echo ""
echo "Start Commands:"
echo ""
echo "  Backend API:"
echo "    cd see-backend && .venv/bin/uvicorn app.main:app --reload"
echo ""
echo "  Celery Worker:"
echo "    cd see-backend && .venv/bin/celery -A app.workers.celery_app worker -l info"
echo ""
echo "  Celery Beat:"
echo "    cd see-backend && .venv/bin/celery -A app.workers.celery_app beat -l info"
echo ""
echo "  Frontend:"
echo "    cd see-app && npx expo start"
echo ""
echo "============================================================"
echo " Diagnostic Complete"
echo "============================================================"
echo ""
