#!/bin/bash

# Backup Current PostgreSQL Data Script
# Creates a full backup of current PostgreSQL data before migration
# Usage: ./scripts/backup-current-data.sh

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

echo "💾 Creating backup of current PostgreSQL data..."

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

# Create backup directory with timestamp
BACKUP_DIR="/tmp/claude/pg-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

log "Testing PostgreSQL connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null || error "Cannot connect to PostgreSQL database."

log "Creating backup directory: $BACKUP_DIR"

log "Backing up current sites..."
CURRENT_SITES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM sites;" | tr -d ' ')
if [ "$CURRENT_SITES" -gt 0 ]; then
    psql "$DATABASE_URL" -c "\copy sites TO '$BACKUP_DIR/sites_backup.csv' WITH CSV HEADER;"
    success "Backed up $CURRENT_SITES sites"
else
    log "No sites to backup"
    touch "$BACKUP_DIR/sites_backup.csv"
fi

log "Backing up current performance_metrics..."
CURRENT_METRICS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM performance_metrics;" | tr -d ' ')
if [ "$CURRENT_METRICS" -gt 0 ]; then
    psql "$DATABASE_URL" -c "\copy performance_metrics TO '$BACKUP_DIR/metrics_backup.csv' WITH CSV HEADER;"
    success "Backed up $CURRENT_METRICS performance metrics"
else
    log "No metrics to backup"
    touch "$BACKUP_DIR/metrics_backup.csv"
fi

log "Backing up current scheduled_jobs..."
CURRENT_JOBS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM scheduled_jobs;" | tr -d ' ')
if [ "$CURRENT_JOBS" -gt 0 ]; then
    psql "$DATABASE_URL" -c "\copy scheduled_jobs TO '$BACKUP_DIR/jobs_backup.csv' WITH CSV HEADER;"
    success "Backed up $CURRENT_JOBS scheduled jobs"
else
    log "No scheduled jobs to backup"
    touch "$BACKUP_DIR/jobs_backup.csv"
fi

# Create restoration script
log "Creating restoration script..."
cat > "$BACKUP_DIR/restore-backup.sh" << EOF
#!/bin/bash

# Restoration Script - Generated $(date)
# This script will restore the PostgreSQL data to the state before migration

set -e

echo "🔄 Restoring PostgreSQL data from backup..."

# Load environment variables
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production file not found. Please create it first."
    exit 1
fi

source .env.production

if [ -z "\$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set in .env.production"
    exit 1
fi

echo "⚠️  WARNING: This will restore the database to the state before migration!"
echo "⚠️  Current data will be REPLACED with backed up data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [ "\$confirmation" != "yes" ]; then
    echo "❌ Restoration cancelled by user"
    exit 1
fi

echo "Truncating current tables..."
psql "\$DATABASE_URL" -c "TRUNCATE TABLE performance_metrics CASCADE;"
psql "\$DATABASE_URL" -c "TRUNCATE TABLE scheduled_jobs CASCADE;"
psql "\$DATABASE_URL" -c "TRUNCATE TABLE sites CASCADE;"

echo "Restoring sites ($CURRENT_SITES records)..."
if [ -s "$BACKUP_DIR/sites_backup.csv" ]; then
    psql "\$DATABASE_URL" -c "\copy sites FROM '$BACKUP_DIR/sites_backup.csv' WITH CSV HEADER;"
fi

echo "Restoring performance_metrics ($CURRENT_METRICS records)..."
if [ -s "$BACKUP_DIR/metrics_backup.csv" ]; then
    psql "\$DATABASE_URL" -c "\copy performance_metrics FROM '$BACKUP_DIR/metrics_backup.csv' WITH CSV HEADER;"
fi

echo "Restoring scheduled_jobs ($CURRENT_JOBS records)..."
if [ -s "$BACKUP_DIR/jobs_backup.csv" ]; then
    psql "\$DATABASE_URL" -c "\copy scheduled_jobs FROM '$BACKUP_DIR/jobs_backup.csv' WITH CSV HEADER;"
fi

echo "✅ Database restoration completed successfully!"
echo "📊 Restored:"
echo "  - Sites: $CURRENT_SITES"
echo "  - Performance Metrics: $CURRENT_METRICS"
echo "  - Scheduled Jobs: $CURRENT_JOBS"
EOF

chmod +x "$BACKUP_DIR/restore-backup.sh"

# Create backup info file
cat > "$BACKUP_DIR/backup-info.txt" << EOF
PostgreSQL Database Backup
Created: $(date)
Backup Directory: $BACKUP_DIR

Contents:
- Sites: $CURRENT_SITES records
- Performance Metrics: $CURRENT_METRICS records
- Scheduled Jobs: $CURRENT_JOBS records

To restore this backup:
  cd /Users/msamimi/syatt/projects/performance-dashboard
  $BACKUP_DIR/restore-backup.sh

Files:
- sites_backup.csv: Site data backup
- metrics_backup.csv: Performance metrics backup
- jobs_backup.csv: Scheduled jobs backup
- restore-backup.sh: Automated restoration script
- backup-info.txt: This info file
EOF

success "Backup completed successfully!"

echo ""
echo "📋 Backup Summary:"
echo "🗂️  Backup Location: $BACKUP_DIR"
echo "📊 Backed up:"
echo "  - Sites: $CURRENT_SITES records"
echo "  - Performance Metrics: $CURRENT_METRICS records"
echo "  - Scheduled Jobs: $CURRENT_JOBS records"
echo ""
echo "🔄 To restore this backup later:"
echo "  $BACKUP_DIR/restore-backup.sh"
echo ""

# Store backup path for the migration script
echo "$BACKUP_DIR" > /tmp/claude/latest-backup-path.txt
success "Backup path saved for migration script"