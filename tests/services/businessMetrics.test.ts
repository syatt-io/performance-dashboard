import { BusinessMetricsService } from '../../src/services/businessMetrics';
import { prisma } from '../../src/services/database';

jest.mock('../../src/services/database', () => ({
  prisma: {
    performanceMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
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

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;

  beforeEach(() => {
    service = new BusinessMetricsService();
    jest.clearAllMocks();
  });

  describe('storeConversionMetrics', () => {
    it('should store conversion metrics', async () => {
      const metrics = {
        siteId: 'site-123',
        date: new Date('2024-01-01'),
        visitors: 1000,
        conversionRate: 2.5,
        revenue: 5000,
        transactions: 25,
      };

      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({});

      await service.storeConversionMetrics(metrics);

      expect(prisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: metrics.date,
        }),
      });
    });
  });

  describe('calculatePerformanceImpact', () => {
    it('should calculate performance impact on conversions', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 3.0,
          cls: 0.15,
          performance: 85,
        },
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'desktop',
          timestamp: new Date(),
          lcp: 2.8,
          cls: 0.12,
          performance: 87,
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(
        performanceMetrics
      );

      const impacts = await service.calculatePerformanceImpact('site-123', 30);

      expect(impacts).toBeDefined();
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts[0]).toHaveProperty('metric');
      expect(impacts[0]).toHaveProperty('conversionImpact');
      expect(impacts[0]).toHaveProperty('revenueImpact');
    });

    it('should return empty array when no metrics available', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const impacts = await service.calculatePerformanceImpact('site-123', 30);

      expect(impacts).toEqual([]);
    });
  });

  describe('getConversionTrends', () => {
    it('should get conversion trends over time', async () => {
      const metrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date('2024-01-01'),
          performance: 90,
        },
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'desktop',
          timestamp: new Date('2024-01-01'),
          performance: 92,
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(metrics);

      const trends = await service.getConversionTrends('site-123', 30);

      expect(trends).toBeDefined();
      expect(Array.isArray(trends)).toBe(true);
    });
  });

  describe('calculatePerformanceROI', () => {
    it('should calculate ROI for performance improvements', async () => {
      const recentMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 4.0,
          cls: 0.25,
          performance: 60,
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(
        recentMetrics
      );

      const roi = await service.calculatePerformanceROI(
        'site-123',
        2.5, // target LCP
        0.1, // target CLS
        90   // target score
      );

      expect(roi).toBeDefined();
      expect(roi).toHaveProperty('currentRevenue');
      expect(roi).toHaveProperty('projectedRevenue');
      expect(roi).toHaveProperty('revenueIncrease');
      expect(roi).toHaveProperty('conversionIncrease');
      expect(roi).toHaveProperty('roi');
      expect(typeof roi.roi).toBe('string');
      expect(roi.roi).toContain('%');
    });

    it('should show positive revenue increase for improvements', async () => {
      const recentMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 5.0,
          cls: 0.3,
          performance: 50,
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(
        recentMetrics
      );

      const roi = await service.calculatePerformanceROI(
        'site-123',
        2.0,
        0.05,
        95
      );

      expect(roi.revenueIncrease).toBeGreaterThan(0);
      expect(roi.projectedRevenue).toBeGreaterThan(roi.currentRevenue);
    });

    it('should handle sites with no metrics', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const roi = await service.calculatePerformanceROI('site-123', 2.5);

      expect(roi).toBeDefined();
      expect(roi.currentRevenue).toBeDefined();
    });
  });

  describe('LCP impact estimation', () => {
    it('should show no impact for good LCP (<2.5s)', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 2.0,
          cls: 0.05,
          performance: 95,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const lcpImpact = impacts.find(i => i.metric === 'Largest Contentful Paint');
      expect(lcpImpact).toBeDefined();
      expect(lcpImpact?.conversionImpact).toBe(0);
    });

    it('should show negative impact for poor LCP (>4s)', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 5.0,
          cls: 0.05,
          performance: 95,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const lcpImpact = impacts.find(i => i.metric === 'Largest Contentful Paint');
      expect(lcpImpact).toBeDefined();
      expect(lcpImpact?.conversionImpact).toBeLessThan(0);
    });
  });

  describe('CLS impact estimation', () => {
    it('should show no impact for good CLS (<0.1)', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 2.0,
          cls: 0.05,
          performance: 95,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const clsImpact = impacts.find(i => i.metric === 'Cumulative Layout Shift');
      expect(clsImpact).toBeDefined();
      expect(clsImpact?.conversionImpact).toBe(0);
    });

    it('should show negative impact for poor CLS (>0.25)', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 2.0,
          cls: 0.3,
          performance: 95,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const clsImpact = impacts.find(i => i.metric === 'Cumulative Layout Shift');
      expect(clsImpact).toBeDefined();
      expect(clsImpact?.conversionImpact).toBe(-12);
    });
  });

  describe('Performance score impact estimation', () => {
    it('should show no impact for score >= 90', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 2.0,
          cls: 0.05,
          performance: 95,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const scoreImpact = impacts.find(i => i.metric === 'Performance Score');
      expect(scoreImpact).toBeDefined();
      expect(scoreImpact?.conversionImpact).toBe(0);
    });

    it('should show negative impact for low scores', async () => {
      const performanceMetrics = [
        {
          id: '1',
          siteId: 'site-123',
          deviceType: 'mobile',
          timestamp: new Date(),
          lcp: 2.0,
          cls: 0.05,
          performance: 50,
        },
      ];

      const businessMetrics = [
        {
          id: '2',
          siteId: 'site-123',
          deviceType: 'business',
          timestamp: new Date(),
        },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        ...performanceMetrics,
        ...businessMetrics,
      ]);

      const impacts = await service.calculatePerformanceImpact('site-123');

      const scoreImpact = impacts.find(i => i.metric === 'Performance Score');
      expect(scoreImpact).toBeDefined();
      expect(scoreImpact?.conversionImpact).toBeLessThan(0);
    });
  });
});
