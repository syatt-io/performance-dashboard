import { performanceQueue } from './services/queue';
import { collectAndSaveMetrics } from './services/lighthouseWorker';
import { collectComprehensiveMetrics } from './services/lighthouseWorkerV2';
import { prisma } from './services/database';
import Bull from 'bull';

// Process performance collection jobs
performanceQueue.process('collect-metrics', async (job: Bull.Job) => {
  const { siteId, deviceType, scheduledJobId, comprehensive } = job.data;

  console.log(`[Worker] Processing job ${job.id}: Site ${siteId} (${deviceType || 'comprehensive'})`);

  try {
    // Use V2 for comprehensive testing if flag is set
    if (comprehensive) {
      await collectComprehensiveMetrics(siteId, scheduledJobId);
    } else {
      // Backward compatibility for single device type tests
      await collectAndSaveMetrics(siteId, deviceType, scheduledJobId);
    }
    console.log(`[Worker] Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    throw error; // Re-throw to mark job as failed for retry
  }
});

// Handle job events
performanceQueue.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

performanceQueue.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

performanceQueue.on('stalled', (job) => {
  console.warn(`[Worker] Job ${job?.id} stalled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  await performanceQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  await performanceQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Worker] Performance metrics worker started');
console.log('[Worker] Waiting for jobs...');