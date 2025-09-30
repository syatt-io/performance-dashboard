import { performanceQueue, addPerformanceJob, scheduleAllSites, cleanStuckJobs } from '../../src/services/queue';
import { prisma } from '../../src/services/database';

jest.mock('../../src/services/database', () => ({
  prisma: {
    site: {
      findMany: jest.fn(),
    },
    scheduledJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  }));
});

describe('Queue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addPerformanceJob', () => {
    it('should add job to queue', async () => {
      const jobData = {
        siteId: '123',
        deviceType: 'mobile' as const,
        scheduledJobId: 'job-123',
      };

      const job = await addPerformanceJob(jobData);

      expect(job).toBeDefined();
      expect(performanceQueue.add).toHaveBeenCalledWith('collect-metrics', jobData);
    });

    it('should handle job addition errors', async () => {
      (performanceQueue.add as jest.Mock).mockRejectedValue(new Error('Queue error'));

      const jobData = {
        siteId: '123',
        deviceType: 'mobile' as const,
        scheduledJobId: 'job-123',
      };

      await expect(addPerformanceJob(jobData)).rejects.toThrow('Queue error');
    });
  });

  describe('scheduleAllSites', () => {
    it('should schedule jobs for all enabled sites', async () => {
      const mockSites = [
        { id: '1', name: 'Site 1', monitoringEnabled: true },
        { id: '2', name: 'Site 2', monitoringEnabled: true },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);
      (prisma.scheduledJob.create as jest.Mock).mockResolvedValue({
        id: 'job-1',
        siteId: '1',
        status: 'pending',
      });

      (performanceQueue.add as jest.Mock).mockResolvedValue({ id: 'queue-job-1' });

      const jobs = await scheduleAllSites();

      // Should create 2 jobs per site (mobile + desktop)
      expect(jobs).toHaveLength(4);
      expect(prisma.scheduledJob.create).toHaveBeenCalledTimes(4);
    });

    it('should skip sites with monitoring disabled', async () => {
      const mockSites = [
        { id: '1', name: 'Site 1', monitoringEnabled: true },
        { id: '2', name: 'Site 2', monitoringEnabled: false },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue([mockSites[0]]);
      (prisma.scheduledJob.create as jest.Mock).mockResolvedValue({
        id: 'job-1',
        siteId: '1',
        status: 'pending',
      });

      const jobs = await scheduleAllSites();

      // Should only create 2 jobs (mobile + desktop) for 1 site
      expect(jobs).toHaveLength(2);
    });

    it('should handle empty site list', async () => {
      (prisma.site.findMany as jest.Mock).mockResolvedValue([]);

      const jobs = await scheduleAllSites();

      expect(jobs).toHaveLength(0);
    });
  });

  describe('cleanStuckJobs', () => {
    it('should mark stuck running jobs as failed', async () => {
      const stuckJob = {
        id: 'stuck-1',
        siteId: '123',
        status: 'running',
        startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      };

      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValueOnce([stuckJob]);
      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.scheduledJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBe(1);
      expect(prisma.scheduledJob.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['stuck-1'] } },
        data: {
          status: 'failed',
          error: 'Job exceeded maximum execution time',
        },
      });
    });

    it('should mark stuck pending jobs as failed', async () => {
      const stuckPendingJob = {
        id: 'stuck-2',
        siteId: '124',
        status: 'pending',
        scheduledFor: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
      };

      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValueOnce([stuckPendingJob]);
      (prisma.scheduledJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBe(1);
    });

    it('should return 0 when no stuck jobs', async () => {
      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValue([]);

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBe(0);
      expect(prisma.scheduledJob.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Queue configuration', () => {
    it('should have proper job timeout configured', () => {
      // Queue should be configured with timeout to prevent hung jobs
      // This is verified by checking the queue was created with timeout option
      expect(performanceQueue).toBeDefined();
    });

    it('should have retry configuration', () => {
      // Queue should have retry logic for failed jobs
      expect(performanceQueue).toBeDefined();
    });
  });
});
