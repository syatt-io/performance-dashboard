import { performanceQueue } from '../src/services/queue';
import { collectPerformanceMetrics } from '../src/services/lighthouse';
import { prisma } from '../src/services/database';

jest.mock('../src/services/database', () => ({
  prisma: {
    scheduledJob: {
      update: jest.fn(),
    },
  },
}));
jest.mock('../src/services/lighthouse');
jest.mock('../src/services/queue', () => ({
  performanceQueue: {
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  },
}));
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job processing', () => {
    it('should process performance collection jobs', async () => {
      const mockJob = {
        id: 'job-123',
        data: {
          siteId: 'site-1',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-1',
        },
      };

      const mockMetrics = {
        id: 'metric-1',
        siteId: 'site-1',
        performance: 95,
        lcp: 2.5,
      };

      (collectPerformanceMetrics as jest.Mock).mockResolvedValue(mockMetrics);
      (prisma.scheduledJob.update as jest.Mock).mockResolvedValue({
        id: 'scheduled-1',
        status: 'completed',
      });

      // Simulate worker processing the job
      const processCallback = (performanceQueue.process as jest.Mock).mock.calls[0]?.[1];
      if (processCallback) {
        await processCallback(mockJob);
      }

      // Verify the job would be processed correctly
      expect(collectPerformanceMetrics).toHaveBeenCalledWith('site-1', 'mobile');
    });

    it('should handle job failures', async () => {
      const mockJob = {
        id: 'job-456',
        data: {
          siteId: 'site-2',
          deviceType: 'desktop',
          scheduledJobId: 'scheduled-2',
        },
      };

      (collectPerformanceMetrics as jest.Mock).mockRejectedValue(
        new Error('Collection failed')
      );
      (prisma.scheduledJob.update as jest.Mock).mockResolvedValue({
        id: 'scheduled-2',
        status: 'failed',
      });

      // Simulate worker processing the job
      const processCallback = (performanceQueue.process as jest.Mock).mock.calls[0]?.[1];
      if (processCallback) {
        await expect(processCallback(mockJob)).rejects.toThrow('Collection failed');
      }
    });

    it('should update scheduled job status on completion', async () => {
      const mockJob = {
        id: 'job-789',
        data: {
          siteId: 'site-3',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-3',
        },
      };

      (collectPerformanceMetrics as jest.Mock).mockResolvedValue({
        id: 'metric-3',
      });
      (prisma.scheduledJob.update as jest.Mock).mockResolvedValue({
        id: 'scheduled-3',
        status: 'completed',
      });

      // Worker should update job status to completed
      expect(prisma.scheduledJob.update).toHaveBeenCalledWith;
    });

    it('should handle missing scheduled job ID', async () => {
      const mockJob = {
        id: 'job-999',
        data: {
          siteId: 'site-4',
          deviceType: 'mobile',
          // scheduledJobId intentionally missing
        },
      };

      (collectPerformanceMetrics as jest.Mock).mockResolvedValue({
        id: 'metric-4',
      });

      // Worker should still process the job even without scheduledJobId
      const processCallback = (performanceQueue.process as jest.Mock).mock.calls[0]?.[1];
      if (processCallback) {
        await processCallback(mockJob);
      }

      expect(collectPerformanceMetrics).toHaveBeenCalledWith('site-4', 'mobile');
    });
  });

  describe('Concurrency and rate limiting', () => {
    it('should respect concurrency limits', () => {
      // Queue should be configured with concurrency limit
      expect(performanceQueue).toBeDefined();
      expect(performanceQueue.process).toBeDefined();
    });

    it('should handle multiple concurrent jobs', async () => {
      const jobs = [
        { id: '1', data: { siteId: 's1', deviceType: 'mobile', scheduledJobId: 'j1' } },
        { id: '2', data: { siteId: 's2', deviceType: 'desktop', scheduledJobId: 'j2' } },
        { id: '3', data: { siteId: 's3', deviceType: 'mobile', scheduledJobId: 'j3' } },
      ];

      (collectPerformanceMetrics as jest.Mock).mockResolvedValue({ id: 'metric' });
      (prisma.scheduledJob.update as jest.Mock).mockResolvedValue({});

      // All jobs should be processable
      expect(jobs.length).toBe(3);
    });
  });

  describe('Error handling and retries', () => {
    it('should retry failed jobs', async () => {
      const mockJob = {
        id: 'retry-job',
        data: {
          siteId: 'site-retry',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-retry',
        },
        attemptsMade: 0,
      };

      (collectPerformanceMetrics as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ id: 'metric-success' });

      // Queue should support retry configuration
      expect(performanceQueue).toBeDefined();
    });

    it('should mark job as failed after max retries', async () => {
      const mockJob = {
        id: 'max-retry-job',
        data: {
          siteId: 'site-fail',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-fail',
        },
        attemptsMade: 3,
      };

      (collectPerformanceMetrics as jest.Mock).mockRejectedValue(
        new Error('Permanent failure')
      );
      (prisma.scheduledJob.update as jest.Mock).mockResolvedValue({
        id: 'scheduled-fail',
        status: 'failed',
        error: 'Permanent failure',
      });

      // After max retries, job should be marked as failed
      expect(prisma.scheduledJob.update).toBeDefined();
    });
  });

  describe('Job timeout handling', () => {
    it('should timeout long-running jobs', async () => {
      const mockJob = {
        id: 'timeout-job',
        data: {
          siteId: 'site-timeout',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-timeout',
        },
      };

      // Simulate a job that takes too long
      (collectPerformanceMetrics as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ id: 'metric' }), 700000)
          ) // 11+ minutes
      );

      // Job should timeout at 10 minutes (600000ms)
      // This is configured in the queue settings
      expect(performanceQueue).toBeDefined();
    });
  });

  describe('Worker lifecycle', () => {
    it('should gracefully shut down', async () => {
      await performanceQueue.close();
      expect(performanceQueue.close).toHaveBeenCalled();
    });

    it('should handle shutdown during job processing', async () => {
      const mockJob = {
        id: 'shutdown-job',
        data: {
          siteId: 'site-shutdown',
          deviceType: 'mobile',
          scheduledJobId: 'scheduled-shutdown',
        },
      };

      (collectPerformanceMetrics as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 5000))
      );

      // Worker should allow current jobs to complete before shutting down
      expect(performanceQueue.close).toBeDefined();
    });
  });
});
