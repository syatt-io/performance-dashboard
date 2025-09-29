import Bull from 'bull';
import { performanceCollector } from './lighthouse';
import { prisma } from './database';

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  }
};

// Create job queues
export const performanceQueue = new Bull('performance collection', redisConfig);

// Job processors
performanceQueue.process('collect-site-metrics', async (job) => {
  const { siteId } = job.data;

  console.log(`🔄 Processing scheduled performance collection for site ${siteId}`);

  try {
    // Create scheduled job record
    const scheduledJob = await prisma.scheduledJob.create({
      data: {
        siteId,
        jobType: 'lighthouse',
        status: 'running',
        scheduledFor: new Date(),
        startedAt: new Date()
      }
    });

    // Collect metrics
    await performanceCollector.collectForSite(siteId);

    // Update job status
    await prisma.scheduledJob.update({
      where: { id: scheduledJob.id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    console.log(`✅ Completed scheduled performance collection for site ${siteId}`);

  } catch (error) {
    console.error(`❌ Failed scheduled performance collection for site ${siteId}:`, error);

    // Update job status to failed
    try {
      await prisma.scheduledJob.updateMany({
        where: {
          siteId,
          status: 'running',
          jobType: 'lighthouse'
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (dbError) {
      console.error('Failed to update monitoring job status:', dbError);
    }

    throw error;
  }
});

// Process all sites at once
performanceQueue.process('collect-all-sites', async (job) => {
  console.log('🔄 Processing scheduled performance collection for all sites');

  try {
    await performanceCollector.collectForAllSites();
    console.log('✅ Completed scheduled performance collection for all sites');
  } catch (error) {
    console.error('❌ Failed scheduled performance collection for all sites:', error);
    throw error;
  }
});

// Process cleanup of stuck monitoring jobs
performanceQueue.process('cleanup-stuck-jobs', async (job) => {
  console.log('🧹 Processing automatic cleanup of stuck monitoring jobs');

  try {
    // Jobs are considered stuck if they've been running for more than 10 minutes
    // or pending for more than 30 minutes
    const stuckTimeThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const pendingTimeThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    // Find stuck running jobs
    const stuckRunningJobs = await prisma.scheduledJob.findMany({
      where: {
        status: 'running',
        startedAt: {
          lte: stuckTimeThreshold
        }
      },
      include: {
        site: { select: { name: true } }
      }
    });

    // Find stuck pending jobs
    const stuckPendingJobs = await prisma.scheduledJob.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: pendingTimeThreshold
        }
      },
      include: {
        site: { select: { name: true } }
      }
    });

    const allStuckJobs = [...stuckRunningJobs, ...stuckPendingJobs];

    if (allStuckJobs.length === 0) {
      console.log('✅ No stuck monitoring jobs found to clean up');
      return { cleanedJobs: 0 };
    }

    console.log(`Found ${allStuckJobs.length} stuck jobs to clean up:`);
    allStuckJobs.forEach(job => {
      console.log(`- Job ${job.id} for ${job.site.name}: ${job.status} since ${job.startedAt || job.scheduledFor}`);
    });

    // Mark all stuck jobs as failed
    const cleanupResult = await prisma.scheduledJob.updateMany({
      where: {
        id: { in: allStuckJobs.map(job => job.id) }
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: 'Job stuck - cleaned up by automatic cleanup process'
      }
    });

    console.log(`✅ Successfully cleaned up ${cleanupResult.count} stuck monitoring jobs`);
    return { cleanedJobs: cleanupResult.count };

  } catch (error) {
    console.error('❌ Failed automatic cleanup of stuck jobs:', error);
    throw error;
  }
});

export class SchedulerService {

  // Schedule performance collection for a specific site
  async scheduleSiteCollection(siteId: string, options?: Bull.JobOptions): Promise<Bull.Job> {
    const defaultOptions: Bull.JobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 100,
      removeOnFail: 50,
      // Add job timeout of 10 minutes (Lighthouse tests should complete within this time)
      timeout: 10 * 60 * 1000 // 10 minutes
    };

    return performanceQueue.add('collect-site-metrics',
      { siteId },
      { ...defaultOptions, ...options }
    );
  }

  // Schedule performance collection for all sites
  async scheduleAllSitesCollection(options?: Bull.JobOptions): Promise<Bull.Job> {
    const defaultOptions: Bull.JobOptions = {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 10000
      },
      removeOnComplete: 50,
      removeOnFail: 25,
      // Add job timeout of 30 minutes for all sites collection
      timeout: 30 * 60 * 1000 // 30 minutes
    };

    return performanceQueue.add('collect-all-sites',
      {},
      { ...defaultOptions, ...options }
    );
  }

  // Set up recurring jobs for automatic monitoring
  async setupRecurringJobs(): Promise<void> {
    console.log('⏰ Setting up recurring performance monitoring jobs...');

    // Clear existing recurring jobs to avoid duplicates
    await this.clearRecurringJobs();

    const monitoringInterval = parseInt(process.env.LIGHTHOUSE_INTERVAL_HOURS || '24');

    // Determine cron expression based on interval
    let cronExpression: string;
    let intervalDescription: string;

    if (monitoringInterval === 24) {
      // Daily at 2 AM (configurable via MONITORING_HOUR env var)
      const hour = parseInt(process.env.MONITORING_HOUR || '2');
      cronExpression = `0 ${hour} * * *`;
      intervalDescription = `daily at ${hour}:00`;
    } else if (monitoringInterval > 24) {
      // Every N days at 2 AM
      const days = Math.floor(monitoringInterval / 24);
      const hour = parseInt(process.env.MONITORING_HOUR || '2');
      cronExpression = `0 ${hour} */${days} * *`;
      intervalDescription = `every ${days} days at ${hour}:00`;
    } else {
      // Every N hours
      cronExpression = `0 */${monitoringInterval} * * *`;
      intervalDescription = `every ${monitoringInterval} hours`;
    }

    // Schedule collection for all sites
    await this.scheduleAllSitesCollection({
      repeat: {
        cron: cronExpression
      },
      jobId: 'recurring-all-sites-collection'
    });

    // Schedule automatic cleanup of stuck jobs every 15 minutes
    await this.scheduleStuckJobCleanup({
      repeat: {
        cron: '*/15 * * * *' // Every 15 minutes
      },
      jobId: 'recurring-stuck-job-cleanup'
    });

    console.log(`✅ Scheduled recurring performance collection ${intervalDescription}`);
    console.log(`✅ Scheduled automatic stuck job cleanup every 15 minutes`);
  }

  // Clear all recurring jobs
  async clearRecurringJobs(): Promise<void> {
    const repeatableJobs = await performanceQueue.getRepeatableJobs();

    for (const job of repeatableJobs) {
      await performanceQueue.removeRepeatableByKey(job.key);
    }

    console.log(`🗑️ Cleared ${repeatableJobs.length} existing recurring jobs`);
  }

  // Get job queue statistics
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      performanceQueue.getWaiting(),
      performanceQueue.getActive(),
      performanceQueue.getCompleted(),
      performanceQueue.getFailed(),
      performanceQueue.getDelayed(),
      performanceQueue.getPaused()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length
    };
  }

  // Get recent monitoring jobs from database
  async getRecentMonitoringJobs(limit: number = 50): Promise<any[]> {
    return prisma.scheduledJob.findMany({
      include: {
        site: {
          select: {
            id: true,
            name: true,
            url: true
          }
        }
      },
      orderBy: { scheduledFor: 'desc' },
      take: limit
    });
  }

  // Trigger immediate collection for all sites
  async triggerAllSitesCollection(): Promise<Bull.Job> {
    console.log('🚀 Triggering immediate performance collection for all sites');
    return this.scheduleAllSitesCollection({
      priority: 10 // High priority for manual triggers
    });
  }

  // Trigger immediate collection for a specific site
  async triggerSiteCollection(siteId: string): Promise<Bull.Job> {
    console.log(`🚀 Triggering immediate performance collection for site ${siteId}`);
    return this.scheduleSiteCollection(siteId, {
      priority: 10 // High priority for manual triggers
    });
  }

  // Schedule automatic cleanup of stuck monitoring jobs
  async scheduleStuckJobCleanup(options?: Bull.JobOptions): Promise<Bull.Job> {
    const defaultOptions: Bull.JobOptions = {
      attempts: 1, // Only try once for cleanup jobs
      removeOnComplete: 10,
      removeOnFail: 5
    };

    return performanceQueue.add('cleanup-stuck-jobs',
      {},
      { ...defaultOptions, ...options }
    );
  }

  // Trigger immediate cleanup of stuck jobs
  async triggerStuckJobCleanup(): Promise<Bull.Job> {
    console.log('🧹 Triggering immediate cleanup of stuck monitoring jobs');
    return this.scheduleStuckJobCleanup({
      priority: 5 // Medium priority for cleanup
    });
  }

  // Pause/resume queue
  async pauseQueue(): Promise<void> {
    await performanceQueue.pause();
    console.log('⏸️ Performance collection queue paused');
  }

  async resumeQueue(): Promise<void> {
    await performanceQueue.resume();
    console.log('▶️ Performance collection queue resumed');
  }

  // Clean up completed and failed jobs
  async cleanupJobs(): Promise<void> {
    await performanceQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Clean completed jobs older than 24h
    await performanceQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Clean failed jobs older than 7 days
    console.log('🧹 Cleaned up old jobs from queue');
  }
}

export const schedulerService = new SchedulerService();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📤 Gracefully closing performance queue...');
  await performanceQueue.close();
});

process.on('SIGINT', async () => {
  console.log('📤 Gracefully closing performance queue...');
  await performanceQueue.close();
});