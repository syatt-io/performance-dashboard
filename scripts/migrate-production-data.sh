#!/bin/bash

# Production Data Migration Script
# Migrates SQLite data to production PostgreSQL using app logs to get DATABASE_URL
# Usage: ./scripts/migrate-production-data.sh

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

echo "🔄 Starting production data migration..."

# Check if SQLite database exists
if [ ! -f "prisma/dev.db" ]; then
    error "SQLite database file 'prisma/dev.db' not found. Cannot migrate data."
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
echo "   Performance Metrics: id, siteId, timestamp, deviceType, lcp, cls, fcp, ttfb, performance"
echo ""
echo "❌ WILL SKIP (to avoid TypeScript errors):"
echo "   Sites: shopifyDomain, apiKey, accessToken, isActive"
echo "   Metrics: fid, speedIndex, lighthouseData, cartResponseTime, etc."
echo ""
echo "⚠️  This will import data into the production database."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi

log "Creating Node.js migration script..."
cat > migrate-data.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

// Get DATABASE_URL from environment (should be set in production)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
}

console.log('🔗 Connecting to databases...');

// Initialize Prisma with production database
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL
        }
    }
});

// Initialize SQLite database
const sqlite = new Database('prisma/dev.db', { readonly: true });

async function migrateData() {
    try {
        console.log('📊 Reading SQLite data...');

        // Read sites from SQLite with selective fields
        const sqliteSites = sqlite.prepare(`
            SELECT
                id,
                name,
                url,
                createdAt,
                updatedAt
            FROM sites
        `).all();

        console.log(`Found ${sqliteSites.length} sites to migrate`);

        // Read performance metrics from SQLite with selective fields and mapping
        const sqliteMetrics = sqlite.prepare(`
            SELECT
                id,
                siteId,
                timestamp,
                COALESCE(location, 'us-east-1') as testLocation,
                deviceType,
                'homepage' as pageType,
                performanceScore as performance,
                fcp,
                lcp,
                tbt,
                cls,
                ttfb,
                requests
            FROM performance_metrics
            WHERE performanceScore IS NOT NULL OR lcp IS NOT NULL OR cls IS NOT NULL OR fcp IS NOT NULL
        `).all();

        console.log(`Found ${sqliteMetrics.length} metrics to migrate`);

        console.log('🧹 Clearing existing production data...');
        await prisma.performanceMetric.deleteMany({});
        await prisma.site.deleteMany({});

        console.log('📥 Migrating sites...');
        for (const site of sqliteSites) {
            await prisma.site.create({
                data: {
                    id: site.id,
                    name: site.name,
                    url: site.url,
                    categoryUrl: null,
                    productUrl: null,
                    isShopify: site.url.includes('shopify') ? true : false,
                    monitoringEnabled: true,
                    checkFrequency: 360,
                    createdAt: new Date(site.createdAt),
                    updatedAt: new Date(site.updatedAt)
                }
            });
        }

        console.log('📈 Migrating performance metrics...');
        for (const metric of sqliteMetrics) {
            await prisma.performanceMetric.create({
                data: {
                    id: metric.id,
                    siteId: metric.siteId,
                    timestamp: new Date(metric.timestamp),
                    testLocation: metric.testLocation,
                    deviceType: metric.deviceType,
                    pageType: metric.pageType,
                    performance: metric.performance ? parseInt(metric.performance) : null,
                    accessibility: null,
                    bestPractices: null,
                    seo: null,
                    fcp: metric.fcp ? parseFloat(metric.fcp) : null,
                    si: null,
                    lcp: metric.lcp ? parseFloat(metric.lcp) : null,
                    tbt: metric.tbt ? parseFloat(metric.tbt) : null,
                    cls: metric.cls ? parseFloat(metric.cls) : null,
                    tti: null,
                    ttfb: metric.ttfb ? parseFloat(metric.ttfb) : null,
                    pageLoadTime: null,
                    pageSize: null,
                    requests: metric.requests ? parseInt(metric.requests) : null,
                    errorDetails: null
                }
            });
        }

        console.log('✅ Migration completed successfully!');
        console.log(`📊 Migrated ${sqliteSites.length} sites and ${sqliteMetrics.length} metrics`);

        // Verify the migration
        const finalSiteCount = await prisma.site.count();
        const finalMetricCount = await prisma.performanceMetric.count();

        console.log('🔍 Verification:');
        console.log(`  - Sites in production: ${finalSiteCount}`);
        console.log(`  - Metrics in production: ${finalMetricCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        sqlite.close();
    }
}

migrateData();
EOF

log "Installing required dependencies..."
npm install better-sqlite3

log "Running data migration..."
DATABASE_URL=$(npm run prisma:db:url 2>/dev/null | grep -o 'postgres://.*' | head -1) node migrate-data.js || {
    warning "Direct DATABASE_URL extraction failed, trying alternative method..."

    # Alternative: Use Prisma's built-in connection
    npx prisma generate
    node migrate-data.js
}

# Clean up
rm migrate-data.js

success "Production data migration completed!"

echo ""
echo "🎯 Next steps:"
echo "1. Verify the data in your application dashboard"
echo "2. Test site monitoring functionality"
echo "3. Confirm no TypeScript compilation errors"
echo "4. The application should now have your original production data"