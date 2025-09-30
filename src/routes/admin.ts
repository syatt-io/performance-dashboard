import { logger } from '../utils/logger';
import express, { Router } from 'express';
import { execSync } from 'child_process';
import { prisma } from '../services/database';

const router: Router = express.Router();

// One-time migration endpoint - REMOVE AFTER USE
router.post('/migrate-db-once', async (req, res) => {
  try {
    // Check for secret key
    const secretKey = req.headers['x-migration-key'];
    if (secretKey !== 'temp-migration-key-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    logger.info('Creating database tables directly...');

    // Create tables directly using raw SQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "sites" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
        "checkFrequency" INTEGER NOT NULL DEFAULT 360,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "performance_metrics" (
        "id" TEXT NOT NULL,
        "siteId" TEXT NOT NULL,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "testLocation" TEXT,
        "deviceType" TEXT NOT NULL DEFAULT 'mobile',
        "performance" INTEGER,
        "accessibility" INTEGER,
        "bestPractices" INTEGER,
        "seo" INTEGER,
        "fcp" DOUBLE PRECISION,
        "si" DOUBLE PRECISION,
        "lcp" DOUBLE PRECISION,
        "tbt" DOUBLE PRECISION,
        "cls" DOUBLE PRECISION,
        "tti" DOUBLE PRECISION,
        "ttfb" DOUBLE PRECISION,
        "pageLoadTime" DOUBLE PRECISION,
        "pageSize" INTEGER,
        "requests" INTEGER,
        "errorDetails" TEXT,
        CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
        "id" TEXT NOT NULL,
        "siteId" TEXT NOT NULL,
        "jobType" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "scheduledFor" TIMESTAMP(3) NOT NULL,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "error" TEXT,
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "sites_url_key" ON "sites"("url")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "performance_metrics_siteId_timestamp_idx" ON "performance_metrics"("siteId", "timestamp" DESC)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "scheduled_jobs_siteId_status_idx" ON "scheduled_jobs"("siteId", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "scheduled_jobs_scheduledFor_idx" ON "scheduled_jobs"("scheduledFor")`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_key" ON "api_keys"("key")`);

    // Add foreign keys
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "performance_metrics"
      ADD CONSTRAINT "performance_metrics_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "sites"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `).catch(e => logger.info('Foreign key might already exist'));

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "scheduled_jobs"
      ADD CONSTRAINT "scheduled_jobs_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "sites"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `).catch(e => logger.info('Foreign key might already exist'));

    logger.info('Database tables created successfully');

    res.json({
      success: true,
      message: 'Database tables created successfully'
    });
  } catch (error: any) {
    logger.error('Migration error:', error.message);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message,
      stdout: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    });
  }
});

// Check database tables
router.get('/check-tables', async (req, res) => {
  try {
    // Check for secret key
    const secretKey = req.headers['x-migration-key'];
    if (secretKey !== 'temp-migration-key-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    logger.info('Checking database tables...');

    // Get all tables
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    // Test sites table
    let sitesTest = null;
    try {
      const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM sites`);
      sitesTest = { success: true, count: Number(count[0]?.count || 0) };
    } catch (e: any) {
      sitesTest = { success: false, error: e.message };
    }

    res.json({
      tables,
      sitesTest,
      message: 'Database check complete'
    });
  } catch (error: any) {
    logger.error('Database check error:', error.message);
    res.status(500).json({
      error: 'Database check failed',
      details: error.message
    });
  }
});

// Add sample metrics endpoint - TEMPORARY
router.post('/add-sample-metrics', async (req, res) => {
  try {
    // Check for secret key
    const secretKey = req.headers['x-migration-key'];
    if (secretKey !== 'temp-migration-key-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { siteId, metrics } = req.body;

    if (!siteId || !metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    logger.info(`Adding ${metrics.length} sample metrics for site ${siteId}...`);

    // Insert metrics
    const results = [];
    for (const metric of metrics) {
      try {
        const result = await prisma.performanceMetric.create({
          data: {
            siteId,
            timestamp: metric.timestamp ? new Date(metric.timestamp) : new Date(),
            deviceType: metric.deviceType || 'mobile',
            performance: metric.performance || null,
            accessibility: metric.accessibility || null,
            bestPractices: metric.bestPractices || null,
            seo: metric.seo || null,
            fcp: metric.fcp || null,
            si: metric.si || null,
            lcp: metric.lcp || null,
            tbt: metric.tbt || null,
            cls: metric.cls || null,
            tti: metric.tti || null,
            ttfb: metric.ttfb || null,
            pageLoadTime: metric.pageLoadTime || null,
            pageSize: metric.pageSize || null,
            requests: metric.requests || null,
            testLocation: metric.testLocation || null
          }
        });
        results.push({ success: true, id: result.id });
      } catch (error: any) {
        logger.error('Failed to insert metric:', error.message);
        results.push({ success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Added ${results.filter(r => r.success).length} of ${metrics.length} metrics`,
      results
    });
  } catch (error: any) {
    logger.error('Add sample metrics error:', error.message);
    res.status(500).json({
      error: 'Failed to add sample metrics',
      details: error.message
    });
  }
});

export default router;