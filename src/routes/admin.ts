import express, { Router } from 'express';
import { execSync } from 'child_process';
import { prisma } from '../db';

const router: Router = express.Router();

// One-time migration endpoint - REMOVE AFTER USE
router.post('/migrate-db-once', async (req, res) => {
  try {
    // Check for secret key
    const secretKey = req.headers['x-migration-key'];
    if (secretKey !== 'temp-migration-key-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    console.log('Creating database tables directly...');

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
    `).catch(e => console.log('Foreign key might already exist'));

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "scheduled_jobs"
      ADD CONSTRAINT "scheduled_jobs_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "sites"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `).catch(e => console.log('Foreign key might already exist'));

    console.log('Database tables created successfully');

    res.json({
      success: true,
      message: 'Migrations completed successfully',
      output: output
    });
  } catch (error: any) {
    console.error('Migration error:', error.message);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message,
      stdout: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    });
  }
});

export default router;