#!/bin/bash
# See App - Prepare Production Build Script

set -e

echo "================================"
echo "See App - Build Preparation"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo "❌ Error: app.json not found"
    echo "   Please run this script from see-app directory"
    exit 1
fi

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js 18+ recommended (you have $(node -v))"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "🔐 Checking environment files..."
if [ ! -f ".env.production" ]; then
    echo "⚠️  .env.production not found"
    echo "   Creating template..."
    cp .env.example .env.production
    echo "   ⚠️  UPDATE .env.production with production values!"
fi

if [ ! -f ".env" ]; then
    echo "ℹ️  .env not found"
    echo "   Copy .env.production to .env for build"
    cp .env.production .env
fi

echo ""
echo "✅ Type checking..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found"
    echo "   Fix errors before building"
    exit 1
fi

echo ""
echo "📝 Checking configuration..."

# Check app.json
if ! grep -q '"version"' app.json; then
    echo "❌ Version not set in app.json"
    exit 1
fi

VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
echo "✅ App version: $VERSION"

echo ""
echo "🚀 Build preparation complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with production values"
echo "2. Commit changes: git add -A && git commit -m 'Prepare v${VERSION} build'"
echo "3. Tag release: git tag v${VERSION}"
echo "4. Build with EAS:"
echo "   eas build --platform android --profile production"
echo ""
