import Bull from 'bull';
import { prisma } from './database';

// Create queues for different job types
export const performanceQueue = new Bull('performance-metrics', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job types
export interface PerformanceJobData {
  siteId: string;
  deviceType: 'mobile' | 'desktop';
  scheduledJobId?: string;
}

// Add job to queue
export async function addPerformanceJob(data: PerformanceJobData, options?: Bull.JobOptions) {
  const job = await performanceQueue.add('collect-metrics', data, options);

  // Update scheduled job status if provided
  if (data.scheduledJobId) {
    await prisma.scheduledJob.update({
      where: { id: data.scheduledJobId },
      data: {
        status: 'queued',
        metadata: { bullJobId: job.id }
      }
    });
  }

  return job;
}

// Schedule all sites for testing
export async function scheduleAllSites() {
  const sites = await prisma.site.findMany({
    where: { monitoringEnabled: true }
  });

  const jobs = [];

  for (const site of sites) {
    // Create scheduled jobs in database
    for (const deviceType of ['mobile', 'desktop'] as const) {
      const scheduledJob = await prisma.scheduledJob.create({
        data: {
          siteId: site.id,
          jobType: 'lighthouse',
          status: 'pending',
          scheduledFor: new Date(),
        }
      });

      // Add to queue
      const job = await addPerformanceJob({
        siteId: site.id,
        deviceType,
        scheduledJobId: scheduledJob.id,
      });

      jobs.push(job);
    }
  }

  return jobs;
}

// Clean up stuck jobs
export async function cleanStuckJobs() {
  // Mark old pending/queued jobs as failed
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const updated = await prisma.scheduledJob.updateMany({
    where: {
      status: { in: ['pending', 'queued', 'running'] },
      createdAt: { lt: oneHourAgo }
    },
    data: {
      status: 'failed',
      error: 'Job stuck for more than 1 hour',
      completedAt: new Date()
    }
  });

  // Clean bull queue
  await performanceQueue.clean(60 * 60 * 1000, 'failed');
  await performanceQueue.clean(60 * 60 * 1000, 'completed');

  return updated.count;
}