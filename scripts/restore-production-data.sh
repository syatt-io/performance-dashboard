#!/bin/bash

# Production Data Restoration Script
# Exports data from SQLite and imports to PostgreSQL production database
# Usage: ./scripts/restore-production-data.sh

set -e

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

echo "🔄 Starting production data restoration process..."

# Check if SQLite database exists
if [ ! -f "prisma/dev.db" ]; then
    error "SQLite database file 'prisma/dev.db' not found. Cannot restore data."
fi

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

log "Checking SQLite data to restore..."
SITE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sites;")
METRICS_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM performance_metrics;")
ALERTS_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM alerts;")
BUDGETS_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM performance_budgets;")
JOBS_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM monitoring_jobs;")

log "Data to restore:"
log "  - Sites: $SITE_COUNT"
log "  - Performance Metrics: $METRICS_COUNT"
log "  - Alerts: $ALERTS_COUNT"
log "  - Performance Budgets: $BUDGETS_COUNT"
log "  - Monitoring Jobs: $JOBS_COUNT"

if [ "$SITE_COUNT" -eq 0 ]; then
    error "No sites found in SQLite database. Nothing to restore."
fi

echo ""
echo "⚠️  WARNING: This will restore data to the PostgreSQL production database!"
echo "⚠️  Make sure the production database schema is already created and up to date."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi

log "Creating temporary SQL export directory..."
mkdir -p /tmp/claude/data-restore
export_dir="/tmp/claude/data-restore"

log "Exporting sites data from SQLite..."
sqlite3 prisma/dev.db <<EOF > "$export_dir/sites.sql"
.mode insert sites
SELECT * FROM sites;
EOF

log "Exporting performance_metrics data from SQLite..."
sqlite3 prisma/dev.db <<EOF > "$export_dir/performance_metrics.sql"
.mode insert performance_metrics
SELECT * FROM performance_metrics;
EOF

log "Exporting alerts data from SQLite..."
sqlite3 prisma/dev.db <<EOF > "$export_dir/alerts.sql"
.mode insert alerts
SELECT * FROM alerts;
EOF

log "Exporting performance_budgets data from SQLite..."
sqlite3 prisma/dev.db <<EOF > "$export_dir/performance_budgets.sql"
.mode insert performance_budgets
SELECT * FROM performance_budgets;
EOF

log "Exporting monitoring_jobs data from SQLite..."
sqlite3 prisma/dev.db <<EOF > "$export_dir/monitoring_jobs.sql"
.mode insert monitoring_jobs
SELECT * FROM monitoring_jobs;
EOF

success "Data exported to $export_dir"

log "Testing PostgreSQL connection..."
npx prisma db status || error "Cannot connect to PostgreSQL database. Check your DATABASE_URL."

log "Starting data import to PostgreSQL..."

# Import sites first (other tables may reference these)
log "Importing sites..."
if [ -s "$export_dir/sites.sql" ]; then
    psql "$DATABASE_URL" -c "TRUNCATE TABLE sites CASCADE;"
    psql "$DATABASE_URL" -f "$export_dir/sites.sql"
    success "Sites imported"
else
    warning "No sites data to import"
fi

# Import performance metrics
log "Importing performance metrics..."
if [ -s "$export_dir/performance_metrics.sql" ]; then
    psql "$DATABASE_URL" -c "TRUNCATE TABLE performance_metrics CASCADE;"
    psql "$DATABASE_URL" -f "$export_dir/performance_metrics.sql"
    success "Performance metrics imported"
else
    warning "No performance metrics data to import"
fi

# Import alerts
log "Importing alerts..."
if [ -s "$export_dir/alerts.sql" ]; then
    psql "$DATABASE_URL" -c "TRUNCATE TABLE alerts CASCADE;"
    psql "$DATABASE_URL" -f "$export_dir/alerts.sql"
    success "Alerts imported"
else
    warning "No alerts data to import"
fi

# Import performance budgets
log "Importing performance budgets..."
if [ -s "$export_dir/performance_budgets.sql" ]; then
    psql "$DATABASE_URL" -c "TRUNCATE TABLE performance_budgets CASCADE;"
    psql "$DATABASE_URL" -f "$export_dir/performance_budgets.sql"
    success "Performance budgets imported"
else
    warning "No performance budgets data to import"
fi

# Import monitoring jobs
log "Importing monitoring jobs..."
if [ -s "$export_dir/monitoring_jobs.sql" ]; then
    psql "$DATABASE_URL" -c "TRUNCATE TABLE monitoring_jobs CASCADE;"
    psql "$DATABASE_URL" -f "$export_dir/monitoring_jobs.sql"
    success "Monitoring jobs imported"
else
    warning "No monitoring jobs data to import"
fi

log "Verifying data import..."
IMPORTED_SITES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM sites;")
IMPORTED_METRICS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM performance_metrics;")

log "Import verification:"
log "  - Sites: $IMPORTED_SITES (original: $SITE_COUNT)"
log "  - Metrics: $IMPORTED_METRICS (original: $METRICS_COUNT)"

# Clean up temporary files
log "Cleaning up temporary files..."
rm -rf "$export_dir"

success "Production data restoration completed successfully!"

echo ""
echo "📋 Next steps:"
echo "1. Verify the data in your application dashboard"
echo "2. Test site monitoring functionality"
echo "3. Check that performance metrics are displaying correctly"
echo "4. Consider setting up automated database backups to prevent future data loss"