#!/bin/bash
# See - Environment Setup Script
# Usage: ./setup-env.sh [development|staging|production]

set -e

ENVIRONMENT=${1:-development}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo "[ERROR] Invalid environment: $ENVIRONMENT"
    echo "   Usage: ./setup-env.sh [development|staging|production]"
    exit 1
fi

echo "================================"
echo "See - Environment Setup"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Backend setup
echo "🔧 Setting up backend..."
cd see-backend

if [ "$ENVIRONMENT" == "development" ]; then
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "[OK] Created .env from template"
    fi
    echo "   Settings: debug=true, rate_limit=disabled"

elif [ "$ENVIRONMENT" == "staging" ]; then
    if [ ! -f ".env.staging" ]; then
        cp .env.example .env.staging
        echo "[WARNING] Created .env.staging template"
        echo "   [WARNING] UPDATE .env.staging with staging database credentials!"
    fi
    echo "   Settings: debug=false, rate_limit=500/min, https=required"

elif [ "$ENVIRONMENT" == "production" ]; then
    if [ ! -f ".env.production" ]; then
        cp .env.example .env.production
        echo "[WARNING] Created .env.production template"
        echo "   [WARNING] UPDATE .env.production with production credentials!"
        echo "   [WARNING] NEVER commit .env.production to git!"
    fi
    echo "   Settings: debug=false, rate_limit=300/min, https=required"
fi

cd ..

# Frontend setup
echo ""
echo "🔧 Setting up frontend..."
cd see-app

if [ "$ENVIRONMENT" == "development" ]; then
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "✅ Created .env from template"
    fi
    echo "   API URL: http://localhost:8000/api/v1"

elif [ "$ENVIRONMENT" == "staging" ]; then
    if [ ! -f ".env.staging" ]; then
        cp .env.example .env.staging
        echo "⚠️  Created .env.staging template"
        echo "   ⚠️  UPDATE EXPO_PUBLIC_API_URL to staging API!"
    fi
    echo "   API URL: https://staging-api.your-domain.com/api/v1"

elif [ "$ENVIRONMENT" == "production" ]; then
    if [ ! -f ".env.production" ]; then
        cp .env.example .env.production
        echo "⚠️  Created .env.production template"
        echo "   ⚠️  UPDATE EXPO_PUBLIC_API_URL to production API!"
        echo "   ⚠️  NEVER commit .env.production to git!"
    fi
    echo "   API URL: https://api.your-domain.com/api/v1"
fi

cd ..

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "Next steps:"

if [ "$ENVIRONMENT" == "development" ]; then
    echo "1. Backend dependencies:"
    echo "   cd see-backend && python3 -m venv .venv"
    echo "   source .venv/bin/activate && pip install -r requirements.txt"
    echo ""
    echo "2. Frontend dependencies:"
    echo "   cd see-app && npm install"
    echo ""
    echo "3. Start stack:"
    echo "   docker-compose up"
    echo ""
    echo "4. In another terminal, start app:"
    echo "   cd see-app && npm start"

elif [ "$ENVIRONMENT" == "staging" ]; then
    echo "1. Update credentials:"
    echo "   vi see-backend/.env.staging"
    echo "   vi see-app/.env.staging"
    echo ""
    echo "2. Start staging stack:"
    echo "   docker-compose -f docker-compose.staging.yml up"
    echo ""
    echo "3. Deploy to staging server:"
    echo "   docker-compose -f docker-compose.staging.yml push"
    echo "   # Then deploy to Render/Railway/AWS"

elif [ "$ENVIRONMENT" == "production" ]; then
    echo "1. Update credentials (SECURELY):"
    echo "   ✅ Use secrets manager, NOT git"
    echo "   vi see-backend/.env.production"
    echo "   vi see-app/.env.production"
    echo ""
    echo "2. Do NOT commit .env files:"
    echo "   git checkout see-backend/.env* see-app/.env*"
    echo ""
    echo "3. Test on staging first!"
    echo ""
    echo "4. Deploy to production:"
    echo "   # Use CI/CD pipeline or platform-specific deployment"
fi

echo ""
