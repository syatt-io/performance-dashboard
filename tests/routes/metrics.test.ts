import request from 'supertest';
import express from 'express';
import metricsRouter from '../../src/routes/metrics';
import { prisma } from '../../src/services/database';

// Mock dependencies
jest.mock('../../src/services/database', () => ({
  prisma: {
    site: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    performanceMetric: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    scheduledJob: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));
jest.mock('../../src/services/lighthouse');
jest.mock('../../src/services/queue');
jest.mock('../../src/scheduler');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Metrics API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/metrics', metricsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/metrics/sites/:siteId', () => {
    it('should return metrics for a site', async () => {
      const mockMetrics = [
        {
          id: '1',
          siteId: '123',
          timestamp: new Date(),
          deviceType: 'mobile',
          lcp: 2.5,
          cls: 0.1,
          fcp: 1.8,
          performance: 95,
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app).get('/api/metrics/sites/123');

      expect(response.status).toBe(200);
      expect(response.body.metrics).toHaveLength(1);
      expect(response.body.siteId).toBe('123');
    });

    it('should filter by device type', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/metrics/sites/123')
        .query({ deviceType: 'mobile' });

      expect(response.status).toBe(200);
      expect(prisma.performanceMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deviceType: 'mobile',
          }),
        })
      );
    });

    it('should filter by time range', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/metrics/sites/123')
        .query({ timeRange: '24h' });

      expect(response.status).toBe(200);
    });

    it('should handle custom date range', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/metrics/sites/123')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.timeRange).toBe('custom');
    });

    it('should handle database errors', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      const response = await request(app).get('/api/metrics/sites/123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch metrics');
    });
  });

  describe('GET /api/metrics/sites/:siteId/summary', () => {
    it('should return metrics summary', async () => {
      const mockSite = {
        id: '123',
        name: 'Test Site',
      };

      const mockMetrics = [
        {
          id: '1',
          siteId: '123',
          timestamp: new Date(),
          deviceType: 'mobile',
          lcp: 2.5,
          cls: 0.1,
          tbt: 200,
          fcp: 1.8,
          performance: 95,
        },
      ];

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app).get('/api/metrics/sites/123/summary');

      expect(response.status).toBe(200);
      expect(response.body.siteId).toBe('123');
      expect(response.body.coreWebVitals).toBeDefined();
      expect(response.body.coreWebVitals.lcp).toBeDefined();
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/metrics/sites/999/summary');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });

    it('should handle missing metrics gracefully', async () => {
      const mockSite = { id: '123', name: 'Test Site' };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/metrics/sites/123/summary');

      expect(response.status).toBe(200);
      expect(response.body.lastUpdated).toBeNull();
    });
  });

  describe('POST /api/metrics/sites/:siteId/collect', () => {
    it('should queue metrics collection job', async () => {
      const mockSite = {
        id: '123',
        name: 'Test Site',
        url: 'https://test.com',
        monitoringEnabled: true,
      };

      const mockJob = {
        id: 'job-123',
        siteId: '123',
        status: 'pending',
        scheduledFor: new Date(),
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.scheduledJob.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.scheduledJob.create as jest.Mock).mockResolvedValue(mockJob);

      const addPerformanceJob = jest.fn().mockResolvedValue({ id: 'queue-123' });
      jest.mock('../../src/services/queue', () => ({
        addPerformanceJob,
      }));

      const response = await request(app)
        .post('/api/metrics/sites/123/collect')
        .send({ deviceType: 'mobile' });

      expect(response.status).toBe(200);
      expect(response.body.siteId).toBe('123');
    });

    it('should reject collection for disabled monitoring', async () => {
      const mockSite = {
        id: '123',
        name: 'Test Site',
        url: 'https://test.com',
        monitoringEnabled: false,
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app)
        .post('/api/metrics/sites/123/collect');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Site monitoring is disabled');
    });

    it('should prevent concurrent collections', async () => {
      const mockSite = {
        id: '123',
        name: 'Test Site',
        url: 'https://test.com',
        monitoringEnabled: true,
      };

      const runningJob = {
        id: 'existing-job',
        status: 'running',
        startedAt: new Date(),
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.scheduledJob.findFirst as jest.Mock).mockResolvedValue(runningJob);

      const response = await request(app)
        .post('/api/metrics/sites/123/collect');

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Collection already in progress');
    });
  });

  describe('GET /api/metrics/sites/:siteId/trends', () => {
    it('should return trend data', async () => {
      const mockTrends = [
        {
          period: '2024-01-01',
          deviceType: 'mobile',
          avg_lcp: 2.5,
          avg_cls: 0.1,
          data_points: 10,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/api/metrics/sites/123/trends')
        .query({ timeRange: '30d', aggregation: 'daily' });

      expect(response.status).toBe(200);
      expect(response.body.trends).toBeDefined();
    });

    it('should handle invalid aggregation parameter', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/metrics/sites/123/trends')
        .query({ aggregation: 'invalid' });

      expect(response.status).toBe(200);
      // Should default to 'daily'
    });
  });

  describe('POST /api/metrics/cleanup-stuck-jobs', () => {
    it('should cleanup stuck jobs', async () => {
      const stuckJobs = [
        {
          id: 'stuck-1',
          siteId: '123',
          status: 'running',
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          site: { name: 'Test Site' },
        },
      ];

      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValue(stuckJobs);
      (prisma.scheduledJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app).post('/api/metrics/cleanup-stuck-jobs');

      expect(response.status).toBe(200);
      expect(response.body.cleanedJobs).toBe(1);
    });

    it('should return message when no stuck jobs', async () => {
      (prisma.scheduledJob.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).post('/api/metrics/cleanup-stuck-jobs');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('No stuck jobs found');
      expect(response.body.cleanedJobs).toBe(0);
    });
  });
});
