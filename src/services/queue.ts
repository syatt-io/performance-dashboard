import Bull from 'bull';
import { prisma } from './database';

// Parse Redis connection options
function getRedisConfig() {
  if (process.env.REDIS_URL) {
    console.log('[Queue] Using REDIS_URL for connection');

    // For Upstash Redis, parse URL and add proper config
    if (process.env.REDIS_URL.includes('upstash.io') ||
        process.env.REDIS_URL.startsWith('rediss://') ||
        process.env.REDIS_URL.startsWith('redis://')) {
      const url = new URL(process.env.REDIS_URL);
      const config = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password,
        maxRetriesPerRequest: null, // Disable retry limit for long-running jobs
        enableReadyCheck: false,
        connectTimeout: 10000,
      };

      // Add TLS if using rediss:// or upstash.io
      if (url.protocol === 'rediss:' || url.hostname.includes('upstash.io')) {
        config.tls = {
          rejectUnauthorized: false,
        };
      }

      console.log(`[Queue] Configured Redis for ${url.hostname} with maxRetriesPerRequest=null`);
      return config;
    }

    return process.env.REDIS_URL;
  }

  // Fallback to host/port for local development
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
  console.log(`[Queue] Using Redis host:port connection: ${config.host}:${config.port}`);
  return config;
}

// Create queues for different job types
export const performanceQueue = new Bull('performance-metrics', {
  redis: getRedisConfig(),
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

// Test Redis connection on startup
performanceQueue.on('error', (error) => {
  console.error('[Queue] Redis connection error:', error.message);
});

performanceQueue.on('ready', () => {
  console.log('[Queue] Redis connection established successfully');
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
        status: 'queued'
      }
    });
  }

  return job;
}

// Schedule all sites for testing
export async function scheduleAllSites() {
  console.log('[Queue] Fetching sites with monitoring enabled...');
  const sites = await prisma.site.findMany({
    where: { monitoringEnabled: true }
  });

  console.log(`[Queue] Found ${sites.length} sites to schedule`);

  const jobs = [];

  for (const site of sites) {
    // Create scheduled jobs in database
    for (const deviceType of ['mobile', 'desktop'] as const) {
      console.log(`[Queue] Creating scheduled job for ${site.name} (${deviceType})`);

      const scheduledJob = await prisma.scheduledJob.create({
        data: {
          siteId: site.id,
          jobType: 'lighthouse',
          status: 'pending',
          scheduledFor: new Date(),
        }
      });

      console.log(`[Queue] Adding job to queue for ${site.name} (${deviceType})`);

      // Add to queue
      const job = await addPerformanceJob({
        siteId: site.id,
        deviceType,
        scheduledJobId: scheduledJob.id,
      });

      jobs.push(job);
    }
  }

  console.log(`[Queue] Successfully scheduled ${jobs.length} jobs`);
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