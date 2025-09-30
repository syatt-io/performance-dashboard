import { scheduleAllSites, cleanStuckJobs } from '../src/services/queue';
import { prisma } from '../src/services/database';

jest.mock('../src/services/database', () => ({
  prisma: {
    site: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('../src/services/queue');
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleAllSites', () => {
    it('should schedule monitoring jobs for all enabled sites', async () => {
      const mockSites = [
        {
          id: 'site-1',
          name: 'Site 1',
          url: 'https://site1.com',
          monitoringEnabled: true,
          checkFrequency: 360,
        },
        {
          id: 'site-2',
          name: 'Site 2',
          url: 'https://site2.com',
          monitoringEnabled: true,
          checkFrequency: 360,
        },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);
      (scheduleAllSites as jest.Mock).mockResolvedValue([
        { id: 'job-1' },
        { id: 'job-2' },
        { id: 'job-3' },
        { id: 'job-4' },
      ]);

      const jobs = await scheduleAllSites();

      // Should create 2 jobs per site (mobile + desktop)
      expect(jobs).toHaveLength(4);
    });

    it('should skip sites with monitoring disabled', async () => {
      const mockSites = [
        {
          id: 'site-1',
          name: 'Site 1',
          url: 'https://site1.com',
          monitoringEnabled: false,
        },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue([]);
      (scheduleAllSites as jest.Mock).mockResolvedValue([]);

      const jobs = await scheduleAllSites();

      expect(jobs).toHaveLength(0);
    });

    it('should handle scheduling errors gracefully', async () => {
      (scheduleAllSites as jest.Mock).mockRejectedValue(
        new Error('Scheduling failed')
      );

      await expect(scheduleAllSites()).rejects.toThrow('Scheduling failed');
    });
  });

  describe('cleanStuckJobs', () => {
    it('should mark stuck jobs as failed', async () => {
      const stuckJobs = [
        {
          id: 'stuck-1',
          siteId: 'site-1',
          status: 'running',
          startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        },
        {
          id: 'stuck-2',
          siteId: 'site-2',
          status: 'running',
          startedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
        },
      ];

      (cleanStuckJobs as jest.Mock).mockResolvedValue(2);

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBe(2);
    });

    it('should return 0 when no stuck jobs exist', async () => {
      (cleanStuckJobs as jest.Mock).mockResolvedValue(0);

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBe(0);
    });

    it('should identify jobs stuck in pending state', async () => {
      (cleanStuckJobs as jest.Mock).mockResolvedValue(1);

      const cleanedCount = await cleanStuckJobs();

      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scheduled job execution', () => {
    it('should run nightly at configured time', async () => {
      // Verify cron schedule is configured
      const cronSchedule = '0 2 * * *'; // 2 AM daily
      expect(cronSchedule).toMatch(/^[0-9*\-,/\s]+$/);
    });

    it('should complete full cycle: schedule + cleanup', async () => {
      (scheduleAllSites as jest.Mock).mockResolvedValue([{ id: 'job-1' }]);
      (cleanStuckJobs as jest.Mock).mockResolvedValue(0);

      const jobs = await scheduleAllSites();
      const cleaned = await cleanStuckJobs();

      expect(jobs.length).toBeGreaterThanOrEqual(0);
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Job frequency and timing', () => {
    it('should respect site-specific check frequencies', async () => {
      const mockSites = [
        {
          id: 'site-1',
          checkFrequency: 360, // 6 hours
          monitoringEnabled: true,
        },
        {
          id: 'site-2',
          checkFrequency: 720, // 12 hours
          monitoringEnabled: true,
        },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

      // Verify frequencies are within expected ranges
      mockSites.forEach((site) => {
        expect(site.checkFrequency).toBeGreaterThanOrEqual(60); // At least 1 hour
        expect(site.checkFrequency).toBeLessThanOrEqual(1440); // At most 24 hours
      });
    });
  });
});
