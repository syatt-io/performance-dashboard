import { performanceQueue } from './services/queue';
import { collectAndSaveMetrics } from './services/lighthouseWorker';
import { collectComprehensiveMetrics } from './services/lighthouseWorkerV2';
import { prisma } from './services/database';
import { logger } from './utils/logger';
import Bull from 'bull';

// Process performance collection jobs with concurrency
// Process up to 3 sites in parallel to reduce total test time
performanceQueue.process('collect-metrics', 3, async (job: Bull.Job) => {
  const { siteId, deviceType, scheduledJobId, comprehensive } = job.data;

  logger.info(`[Worker] Processing job ${job.id}`, {
    jobId: job.id,
    siteId,
    deviceType: deviceType || 'comprehensive'
  });

  try {
    // Use V2 for comprehensive testing if flag is set
    if (comprehensive) {
      await collectComprehensiveMetrics(siteId, scheduledJobId);
    } else {
      // Backward compatibility for single device type tests
      await collectAndSaveMetrics(siteId, deviceType, scheduledJobId);
    }
    logger.info(`[Worker] Job ${job.id} completed successfully`);
  } catch (error) {
    logger.error(`[Worker] Job ${job.id} failed:`, { error, jobId: job.id, siteId });
    throw error; // Re-throw to mark job as failed for retry
  }
});

// Handle job events
performanceQueue.on('completed', (job, result) => {
  logger.info(`[Worker] Job ${job.id} completed`);
});

performanceQueue.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job?.id} failed:`, { error: err.message, jobId: job?.id });
});

performanceQueue.on('stalled', (job) => {
  logger.warn(`[Worker] Job ${job?.id} stalled`, { jobId: job?.id });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Worker] SIGTERM received, shutting down gracefully...');
  await performanceQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Worker] SIGINT received, shutting down gracefully...');
  await performanceQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

logger.info('[Worker] Performance metrics worker started');
logger.info('[Worker] Waiting for jobs...');