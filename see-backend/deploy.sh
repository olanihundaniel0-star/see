#!/bin/bash
# See Backend - Production Deployment Script
# This script handles database migrations and backend deployment

set -e  # Exit on error

echo "================================"
echo "See Backend - Deployment Script"
echo "================================"

# Check if .env is set
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Copy .env.production and fill in all values"
    exit 1
fi

# Load environment
source .env

echo "📋 Configuration:"
echo "   Environment: $APP_ENV"
echo "   Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/@/g')"
echo "   Redis: $REDIS_URL"
echo ""

# Verify environment
if [ "$APP_ENV" != "production" ]; then
    echo "⚠️  WARNING: APP_ENV is not 'production' (current: $APP_ENV)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check dependencies
echo "🔍 Checking dependencies..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found"
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

echo "✅ Dependencies OK"
echo ""

# Activate venv
source .venv/bin/activate

# Install/upgrade dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

echo ""
echo "🗄️  Database Migrations"
echo "========================"

# Test database connection
echo "Testing database connection..."
python3 << EOF
import asyncio
from app.core.database import engine
from sqlalchemy import text

async def test_connection():
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"✅ Database connection successful")
            print(f"   PostgreSQL version: {version.split(',')[0]}")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

success = asyncio.run(test_connection())
exit(0 if success else 1)
EOF

if [ $? -ne 0 ]; then
    echo "❌ Database connection test failed"
    exit 1
fi

echo ""

# Run migrations
echo "Running database migrations..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migrations failed"
    exit 1
fi

echo ""
echo "🚀 Deployment Steps"
echo "===================="
echo ""
echo "✅ Prerequisites complete:"
echo "   • Python dependencies installed"
echo "   • Database connection verified"
echo "   • Migrations applied"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy backend to your hosting platform:"
echo "      • Render: git push (auto-deploys)"
echo "      • Railway: railway deploy"
echo "      • AWS ECS: aws ecs update-service"
echo "   2. Monitor deployment:"
echo "      • Check backend logs"
echo "      • Verify health check: curl https://api.your-domain.com/health"
echo "   3. Start Celery workers (if not auto-started):"
echo "      • Worker: celery -A app.workers.celery_app worker -l info"
echo "      • Beat: celery -A app.workers.celery_app beat -l info"
echo ""
echo "✅ Deployment script complete!"
