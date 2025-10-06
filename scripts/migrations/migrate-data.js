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
