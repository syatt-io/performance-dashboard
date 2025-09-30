import cron from 'node-cron';
import { scheduleAllSites, cleanStuckJobs } from './services/queue';
import { prisma } from './services/database';
import { logger } from './utils/logger';

// Schedule nightly performance tests at 4am EST
// Note: node-cron uses the server's timezone. Adjust based on your server's timezone.
// If server is in UTC, 4am EST = 9am UTC (or 8am during DST)
const NIGHTLY_SCHEDULE = '0 9 * * *'; // 9am UTC = 4am EST (adjust for DST if needed)

// For testing: run every 5 minutes
// const NIGHTLY_SCHEDULE = '*/5 * * * *';

export function startScheduler() {
  logger.info('[Scheduler] Starting performance monitoring scheduler');

  // Schedule nightly performance tests
  const nightlyJob = cron.schedule(NIGHTLY_SCHEDULE, async () => {
    logger.info('[Scheduler] Running nightly performance tests at', { timestamp: new Date().toISOString() });

    try {
      // Clean up any stuck jobs first
      const cleanedJobs = await cleanStuckJobs();
      if (cleanedJobs > 0) {
        logger.info(`[Scheduler] Cleaned up ${cleanedJobs} stuck jobs`);
      }

      // Schedule performance tests for all enabled sites
      const jobs = await scheduleAllSites();
      logger.info(`[Scheduler] Scheduled ${jobs.length} performance tests`);

      // Log completion for tracking
      logger.info(`[Scheduler] Completed nightly run`, {
        jobsScheduled: jobs.length,
        cleanedJobs
      });
    } catch (error) {
      logger.error('[Scheduler] Error in nightly job:', { error });
      logger.error(`[Scheduler] Failed nightly run:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clean up stuck jobs every hour
  const cleanupJob = cron.schedule('0 * * * *', async () => {
    logger.info('[Scheduler] Running hourly cleanup at', { timestamp: new Date().toISOString() });

    try {
      const cleanedJobs = await cleanStuckJobs();
      if (cleanedJobs > 0) {
        logger.info(`[Scheduler] Cleaned up ${cleanedJobs} stuck jobs`);
      }
    } catch (error) {
      logger.error('[Scheduler] Error in cleanup job:', { error });
    }
  });

  // Start the scheduled tasks
  nightlyJob.start();
  cleanupJob.start();

  logger.info('[Scheduler] Scheduled jobs:', {
    nightly: `${NIGHTLY_SCHEDULE} (server time)`,
    cleanup: 'Every hour on the hour'
  });

  // Return function to stop scheduler if needed
  return () => {
    logger.info('[Scheduler] Stopping scheduler...');
    nightlyJob.stop();
    cleanupJob.stop();
  };
}

// Allow manual trigger for testing
export async function triggerManualRun() {
  logger.info('[Scheduler] Manual run triggered at', { timestamp: new Date().toISOString() });

  try {
    // Clean up stuck jobs
    const cleanedJobs = await cleanStuckJobs();
    if (cleanedJobs > 0) {
      logger.info(`[Scheduler] Cleaned up ${cleanedJobs} stuck jobs`);
    }

    // Schedule all sites
    const jobs = await scheduleAllSites();
    logger.info(`[Scheduler] Manually scheduled ${jobs.length} performance tests`);

    return {
      success: true,
      jobsScheduled: jobs.length,
      cleanedJobs,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('[Scheduler] Error in manual run:', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

// Start scheduler if this file is run directly
if (require.main === module) {
  startScheduler();
  logger.info('[Scheduler] Running as standalone process. Press Ctrl+C to stop.');
}