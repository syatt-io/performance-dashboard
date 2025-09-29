#!/bin/bash

# Database Migration Script for DigitalOcean PostgreSQL
# Usage: ./scripts/migrate-db.sh

set -e

echo "🗄️ Starting database migration to PostgreSQL..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production file not found. Please create it first."
fi

# Load environment variables
source .env.production

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL not set in .env.production"
fi

log "Backing up current SQLite database (if exists)..."
if [ -f "prisma/dev.db" ]; then
    cp prisma/dev.db "prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)"
    success "SQLite database backed up"
else
    warning "No SQLite database found to backup"
fi

log "Generating Prisma client for PostgreSQL..."
npx prisma generate

log "Creating PostgreSQL database schema..."
echo "⚠️  WARNING: This will reset the database and destroy all data!"
echo "⚠️  This should ONLY be used for initial setup, never in production!"
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi
npx prisma db push --force-reset

log "Running database migrations..."
npx prisma migrate deploy

log "Checking database connection..."
if npx prisma db seed 2>/dev/null; then
    success "Database connection verified"
else
    warning "No seed script found or seed failed - this is usually okay"
fi

success "Database migration completed successfully!"

echo ""
echo "📋 Next steps:"
echo "1. Verify your PostgreSQL database in DigitalOcean console"
echo "2. Test the connection with: npx prisma studio"
echo "3. Deploy your application: ./scripts/deploy.sh"