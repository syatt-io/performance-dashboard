#!/usr/bin/env tsx
/**
 * Cleanup script to remove audit details older than 180 days
 * Prevents database bloat by removing resource-level data while keeping core metrics
 *
 * Run manually or schedule as a cron job:
 *   npx tsx scripts/cleanup-old-audit-details.ts
 */

import { prisma } from '../src/services/database';
import { logger } from '../src/utils/logger';

const RETENTION_DAYS = 180;

async function cleanupOldAuditDetails() {
  try {
    logger.info('🧹 Starting cleanup of old audit details...');
    logger.info(`📅 Retention policy: ${RETENTION_DAYS} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    logger.info(`📆 Removing audit details older than: ${cutoffDate.toISOString()}`);

    // Find how many records have audit details that will be cleaned
    const countResult = await prisma.performanceMetric.count({
      where: {
        timestamp: {
          lt: cutoffDate
        },
        auditDetails: {
          not: null
        }
      }
    });

    logger.info(`📊 Found ${countResult} records with audit details older than ${RETENTION_DAYS} days`);

    if (countResult === 0) {
      logger.info('✅ No audit details to clean up');
      return;
    }

    // Set auditDetails to null for old records to free up space
    const result = await prisma.performanceMetric.updateMany({
      where: {
        timestamp: {
          lt: cutoffDate
        },
        auditDetails: {
          not: null
        }
      },
      data: {
        auditDetails: null
      }
    });

    logger.info(`✅ Successfully cleaned up ${result.count} records`);
    logger.info(`💾 Estimated space saved: ~${Math.round(result.count * 15 / 1024)}MB`);

    // Log summary stats
    const totalWithAuditDetails = await prisma.performanceMetric.count({
      where: {
        auditDetails: {
          not: null
        }
      }
    });

    const totalMetrics = await prisma.performanceMetric.count();

    logger.info(`📈 Database stats after cleanup:`);
    logger.info(`   - Total metrics: ${totalMetrics}`);
    logger.info(`   - Metrics with audit details: ${totalWithAuditDetails}`);
    logger.info(`   - Metrics without audit details: ${totalMetrics - totalWithAuditDetails}`);

  } catch (error) {
    logger.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupOldAuditDetails()
  .then(() => {
    logger.info('🎉 Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
