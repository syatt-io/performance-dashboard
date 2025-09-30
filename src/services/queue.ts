import Bull from 'bull';
import { RedisOptions } from 'ioredis';
import { prisma } from './database';
import { logger } from '../utils/logger';

// Type-safe Redis configuration
interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
}

// Parse Redis connection options
function getRedisConfig(): string | RedisConfig {
  if (process.env.REDIS_URL) {
    logger.info('[Queue] Using REDIS_URL for connection');

    // For Upstash Redis, parse URL and add proper config
    if (process.env.REDIS_URL.includes('upstash.io') ||
        process.env.REDIS_URL.startsWith('rediss://') ||
        process.env.REDIS_URL.startsWith('redis://')) {
      const url = new URL(process.env.REDIS_URL);
      const config: RedisConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        maxRetriesPerRequest: null, // Disable retry limit for long-running jobs
        enableReadyCheck: false,
        connectTimeout: 10000,
      };

      // Add TLS if using rediss:// or upstash.io
      if (url.protocol === 'rediss:' || url.hostname.includes('upstash.io')) {
        config.tls = {
          // Enable proper TLS validation for security
          // Only disable in development if you have certificate issues
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        };
      }

      logger.info(`[Queue] Configured Redis for ${url.hostname} with TLS: ${!!config.tls}`);
      return config;
    }

    return process.env.REDIS_URL;
  }

  // Fallback to host/port for local development
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
  logger.info(`[Queue] Using Redis host:port connection: ${config.host}:${config.port}`);
  return config;
}

// Create queues for different job types
export const performanceQueue = new Bull('performance-metrics', {
  redis: getRedisConfig(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    timeout: 600000, // 10 minutes timeout for Lighthouse jobs
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Test Redis connection on startup
performanceQueue.on('error', (error) => {
  logger.error('[Queue] Redis connection error:', { error: error.message });
});

performanceQueue.on('ready', () => {
  logger.info('[Queue] Redis connection established successfully');
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
  logger.info('[Queue] Fetching sites with monitoring enabled...');
  const sites = await prisma.site.findMany({
    where: { monitoringEnabled: true }
  });

  logger.info(`[Queue] Found ${sites.length} sites to schedule`);

  const jobs = [];

  for (const site of sites) {
    // Create scheduled jobs in database
    for (const deviceType of ['mobile', 'desktop'] as const) {
      logger.info(`[Queue] Creating scheduled job for ${site.name} (${deviceType})`);

      const scheduledJob = await prisma.scheduledJob.create({
        data: {
          siteId: site.id,
          jobType: 'lighthouse',
          status: 'pending',
          scheduledFor: new Date(),
        }
      });

      logger.info(`[Queue] Adding job to queue for ${site.name} (${deviceType})`);

      // Add to queue
      const job = await addPerformanceJob({
        siteId: site.id,
        deviceType,
        scheduledJobId: scheduledJob.id,
      });

      jobs.push(job);
    }
  }

  logger.info(`[Queue] Successfully scheduled ${jobs.length} jobs`);
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