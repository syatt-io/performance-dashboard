import { collectPerformanceMetrics } from '../../src/services/lighthouse';
import { prisma } from '../../src/services/database';

jest.mock('../../src/services/database', () => ({
  prisma: {
    site: {
      findUnique: jest.fn(),
    },
    performanceMetric: {
      create: jest.fn(),
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

// Mock fetch for PageSpeed Insights API
global.fetch = jest.fn();

describe('Lighthouse Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('collectPerformanceMetrics', () => {
    it('should collect and save performance metrics', async () => {
      const mockPageSpeedResponse = {
        lighthouseResult: {
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'cumulative-layout-shift': { numericValue: 0.1 },
            'first-contentful-paint': { numericValue: 1800 },
            'total-blocking-time': { numericValue: 300 },
            'speed-index': { numericValue: 3000 },
            interactive: { numericValue: 3800 },
          },
          categories: {
            performance: { score: 0.95 },
          },
        },
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2400 },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.08 },
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPageSpeedResponse,
      });

      const mockSite = {
        id: '123',
        name: 'Test Site',
        url: 'https://test.com',
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
        siteId: '123',
      });

      const result = await collectPerformanceMetrics('123', 'mobile');

      expect(result).toBeDefined();
      expect(prisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          siteId: '123',
          deviceType: 'mobile',
          performance: 95,
          lcp: 2.5,
          cls: 0.1,
        }),
      });
    });

    it('should handle missing API key', async () => {
      const originalKey = process.env.PAGESPEED_API_KEY;
      delete process.env.PAGESPEED_API_KEY;

      await expect(collectPerformanceMetrics('123', 'mobile')).rejects.toThrow(
        'PageSpeed Insights API key not configured'
      );

      process.env.PAGESPEED_API_KEY = originalKey;
    });

    it('should handle non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(collectPerformanceMetrics('999', 'mobile')).rejects.toThrow(
        'Site not found'
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const mockSite = { id: '123', url: 'https://test.com' };
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      await expect(collectPerformanceMetrics('123', 'mobile')).rejects.toThrow();
    });

    it('should retry on network errors', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lighthouseResult: {
              audits: {},
              categories: { performance: { score: 0.9 } },
            },
          }),
        });

      const mockSite = { id: '123', url: 'https://test.com' };
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
      });

      await collectPerformanceMetrics('123', 'mobile');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should collect metrics for both device types', async () => {
      const mockResponse = {
        lighthouseResult: {
          audits: {
            'largest-contentful-paint': { numericValue: 2000 },
          },
          categories: { performance: { score: 0.98 } },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const mockSite = { id: '123', url: 'https://test.com' };
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({});

      await collectPerformanceMetrics('123', 'mobile');
      await collectPerformanceMetrics('123', 'desktop');

      expect(prisma.performanceMetric.create).toHaveBeenCalledTimes(2);
      expect(prisma.performanceMetric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deviceType: 'mobile' }),
        })
      );
      expect(prisma.performanceMetric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deviceType: 'desktop' }),
        })
      );
    });
  });
});
