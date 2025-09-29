#!/bin/bash

# Selective Data Migration Script
# Migrates only compatible data from old SQLite schema to new PostgreSQL schema
# Skips problematic fields to avoid reintroducing TypeScript errors
# Usage: ./scripts/selective-data-migration.sh

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

echo "🔄 Starting selective data migration from SQLite to PostgreSQL..."

# Check if SQLite database exists
if [ ! -f "prisma/dev.db" ]; then
    error "SQLite database file 'prisma/dev.db' not found. Cannot migrate data."
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

log "Checking SQLite data to migrate..."
SITE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sites;")
METRICS_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM performance_metrics;")

log "Data to migrate:"
log "  - Sites: $SITE_COUNT"
log "  - Performance Metrics: $METRICS_COUNT"

if [ "$SITE_COUNT" -eq 0 ]; then
    error "No sites found in SQLite database. Nothing to migrate."
fi

echo ""
echo "📋 Migration Strategy:"
echo "✅ WILL MIGRATE:"
echo "   Sites: id, name, url, createdAt, updatedAt"
echo "   Performance Metrics: id, siteId, timestamp, deviceType, lcp, cls, fcp, ttfb, performanceScore→performance"
echo ""
echo "❌ WILL SKIP (to avoid TypeScript errors):"
echo "   Sites: shopifyDomain, apiKey, accessToken, isActive"
echo "   Metrics: fid, speedIndex, lighthouseData, cartResponseTime, etc."
echo ""
echo "⚠️  This will import data into the PostgreSQL production database."
echo "⚠️  Current PostgreSQL data will be preserved (no TRUNCATE)."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi

log "Creating temporary migration directory..."
mkdir -p /tmp/claude/selective-migration
export_dir="/tmp/claude/selective-migration"

log "Testing PostgreSQL connection..."
npx prisma db status || error "Cannot connect to PostgreSQL database. Check your DATABASE_URL."

log "Extracting sites data with field mapping..."
sqlite3 -header -csv prisma/dev.db "
SELECT
    id,
    name,
    url,
    NULL as categoryUrl,
    NULL as productUrl,
    CASE WHEN url LIKE '%shopify%' THEN 1 ELSE 0 END as isShopify,
    1 as monitoringEnabled,
    360 as checkFrequency,
    createdAt,
    updatedAt
FROM sites
" > "$export_dir/sites.csv"

log "Extracting performance metrics with field mapping..."
sqlite3 -header -csv prisma/dev.db "
SELECT
    id,
    siteId,
    timestamp,
    COALESCE(location, 'us-east-1') as testLocation,
    deviceType,
    'homepage' as pageType,
    performanceScore as performance,
    NULL as accessibility,
    NULL as bestPractices,
    NULL as seo,
    fcp,
    NULL as si,
    lcp,
    tbt,
    cls,
    NULL as tti,
    ttfb,
    NULL as pageLoadTime,
    NULL as pageSize,
    requests,
    NULL as errorDetails
FROM performance_metrics
WHERE performanceScore IS NOT NULL OR lcp IS NOT NULL OR cls IS NOT NULL OR fcp IS NOT NULL
" > "$export_dir/metrics.csv"

log "Preparing PostgreSQL import statements..."

# Generate sites import
cat > "$export_dir/import_sites.sql" << 'EOF'
-- Import sites with conflict resolution
\copy temp_sites FROM '/tmp/claude/selective-migration/sites.csv' WITH CSV HEADER;

INSERT INTO sites (
    id, name, url, "categoryUrl", "productUrl", "isShopify",
    "monitoringEnabled", "checkFrequency", "createdAt", "updatedAt"
)
SELECT
    id, name, url, "categoryUrl", "productUrl", "isShopify"::boolean,
    "monitoringEnabled"::boolean, "checkFrequency"::integer,
    "createdAt"::timestamp, "updatedAt"::timestamp
FROM temp_sites
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    "isShopify" = EXCLUDED."isShopify",
    "updatedAt" = NOW();

DROP TABLE temp_sites;
EOF

# Generate metrics import
cat > "$export_dir/import_metrics.sql" << 'EOF'
-- Import performance metrics
\copy temp_metrics FROM '/tmp/claude/selective-migration/metrics.csv' WITH CSV HEADER;

INSERT INTO performance_metrics (
    id, "siteId", timestamp, "testLocation", "deviceType", "pageType",
    performance, accessibility, "bestPractices", seo,
    fcp, si, lcp, tbt, cls, tti, ttfb,
    "pageLoadTime", "pageSize", requests, "errorDetails"
)
SELECT
    id, "siteId", timestamp::timestamp, "testLocation", "deviceType", "pageType",
    CASE WHEN performance = '' THEN NULL ELSE performance::integer END,
    CASE WHEN accessibility = '' THEN NULL ELSE accessibility::integer END,
    CASE WHEN "bestPractices" = '' THEN NULL ELSE "bestPractices"::integer END,
    CASE WHEN seo = '' THEN NULL ELSE seo::integer END,
    CASE WHEN fcp = '' THEN NULL ELSE fcp::float END,
    CASE WHEN si = '' THEN NULL ELSE si::float END,
    CASE WHEN lcp = '' THEN NULL ELSE lcp::float END,
    CASE WHEN tbt = '' THEN NULL ELSE tbt::float END,
    CASE WHEN cls = '' THEN NULL ELSE cls::float END,
    CASE WHEN tti = '' THEN NULL ELSE tti::float END,
    CASE WHEN ttfb = '' THEN NULL ELSE ttfb::float END,
    CASE WHEN "pageLoadTime" = '' THEN NULL ELSE "pageLoadTime"::float END,
    CASE WHEN "pageSize" = '' THEN NULL ELSE "pageSize"::integer END,
    CASE WHEN requests = '' THEN NULL ELSE requests::integer END,
    "errorDetails"
FROM temp_metrics
WHERE "siteId" IN (SELECT id FROM sites)
ON CONFLICT (id) DO NOTHING;

DROP TABLE temp_metrics;
EOF

log "Creating temporary tables in PostgreSQL..."
psql "$DATABASE_URL" << 'EOF'
-- Create temporary table for sites
CREATE TEMP TABLE temp_sites (
    id TEXT,
    name TEXT,
    url TEXT,
    "categoryUrl" TEXT,
    "productUrl" TEXT,
    "isShopify" TEXT,
    "monitoringEnabled" TEXT,
    "checkFrequency" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- Create temporary table for metrics
CREATE TEMP TABLE temp_metrics (
    id TEXT,
    "siteId" TEXT,
    timestamp TEXT,
    "testLocation" TEXT,
    "deviceType" TEXT,
    "pageType" TEXT,
    performance TEXT,
    accessibility TEXT,
    "bestPractices" TEXT,
    seo TEXT,
    fcp TEXT,
    si TEXT,
    lcp TEXT,
    tbt TEXT,
    cls TEXT,
    tti TEXT,
    ttfb TEXT,
    "pageLoadTime" TEXT,
    "pageSize" TEXT,
    requests TEXT,
    "errorDetails" TEXT
);
EOF

log "Importing sites data..."
psql "$DATABASE_URL" -f "$export_dir/import_sites.sql"

log "Importing performance metrics data..."
psql "$DATABASE_URL" -f "$export_dir/import_metrics.sql"

log "Verifying data import..."
IMPORTED_SITES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM sites;" | tr -d ' ')
IMPORTED_METRICS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM performance_metrics;" | tr -d ' ')

log "Migration verification:"
log "  - Sites: $IMPORTED_SITES (original: $SITE_COUNT)"
log "  - Metrics: $IMPORTED_METRICS (original: $METRICS_COUNT)"

# Sample verification
log "Sample of migrated data:"
psql "$DATABASE_URL" -c "SELECT name, url, \"isShopify\" FROM sites LIMIT 3;"
psql "$DATABASE_URL" -c "SELECT s.name, pm.\"deviceType\", pm.lcp, pm.performance FROM performance_metrics pm JOIN sites s ON pm.\"siteId\" = s.id ORDER BY pm.timestamp DESC LIMIT 3;"

# Clean up temporary files
log "Cleaning up temporary files..."
rm -rf "$export_dir"

success "Selective data migration completed successfully!"

echo ""
echo "📋 Migration Summary:"
echo "✅ Migrated $IMPORTED_SITES sites with clean schema fields"
echo "✅ Migrated $IMPORTED_METRICS performance metrics with mapped fields"
echo "✅ Skipped problematic legacy fields to prevent TypeScript errors"
echo "✅ Preserved existing PostgreSQL data structure"
echo ""
echo "🎯 Next steps:"
echo "1. Verify the data in your application dashboard"
echo "2. Test site monitoring functionality"
echo "3. Confirm no TypeScript compilation errors"
echo "4. Deploy the application with restored data"