import { ThirdPartyScriptService } from '../../src/services/thirdPartyScripts';
import { prisma } from '../../src/services/database';

// Mock the database
jest.mock('../../src/services/database', () => ({
  prisma: {
    thirdPartyScript: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    thirdPartyScriptDetection: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('ThirdPartyScriptService', () => {
  let service: ThirdPartyScriptService;

  beforeEach(() => {
    service = new ThirdPartyScriptService();
    jest.clearAllMocks();
  });

  describe('processAndStoreScripts', () => {
    const mockSiteId = 'site-123';
    const mockSiteUrl = 'https://example.com';
    const mockMetricId = 'metric-456';

    it('should process and store third-party scripts from audit details', async () => {
      const auditDetails = {
        thirdParty: [
          {
            entity: 'Google Analytics',
            transferSize: 50, // KB
            blockingTime: 150, // ms
          },
          {
            entity: 'Facebook',
            transferSize: 30,
            blockingTime: 100,
          },
        ],
      };

      const mockScript = {
        id: 'script-1',
        url: 'entity://google-analytics',
        domain: 'google.analytics',
        vendor: 'Google Analytics',
        category: 'analytics',
        isBlocking: false,
      };

      (prisma.thirdPartyScript.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.thirdPartyScript.create as jest.Mock).mockResolvedValue(mockScript);
      (prisma.thirdPartyScriptDetection.create as jest.Mock).mockResolvedValue({});

      await service.processAndStoreScripts(
        mockSiteId,
        mockSiteUrl,
        auditDetails,
        mockMetricId,
        'homepage',
        mockSiteUrl,
        'mobile'
      );

      // Should create two scripts
      expect(prisma.thirdPartyScript.create).toHaveBeenCalledTimes(2);

      // Should create two detections
      expect(prisma.thirdPartyScriptDetection.create).toHaveBeenCalledTimes(2);

      // Verify the first detection call
      expect(prisma.thirdPartyScriptDetection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          siteId: mockSiteId,
          scriptId: mockScript.id,
          metricId: mockMetricId,
          pageType: 'homepage',
          pageUrl: mockSiteUrl,
          deviceType: 'mobile',
          transferSize: 50 * 1024, // Converted to bytes
          blockingTime: 150,
        }),
      });
    });

    it('should handle empty third-party list', async () => {
      const auditDetails = {
        thirdParty: [],
      };

      await service.processAndStoreScripts(
        mockSiteId,
        mockSiteUrl,
        auditDetails,
        mockMetricId
      );

      expect(prisma.thirdPartyScript.create).not.toHaveBeenCalled();
      expect(prisma.thirdPartyScriptDetection.create).not.toHaveBeenCalled();
    });

    it('should handle missing audit details', async () => {
      await service.processAndStoreScripts(
        mockSiteId,
        mockSiteUrl,
        {},
        mockMetricId
      );

      expect(prisma.thirdPartyScript.create).not.toHaveBeenCalled();
      expect(prisma.thirdPartyScriptDetection.create).not.toHaveBeenCalled();
    });

    it('should update existing script if found', async () => {
      const auditDetails = {
        thirdParty: [
          {
            entity: 'Google Analytics',
            transferSize: 50,
            blockingTime: 150,
          },
        ],
      };

      const existingScript = {
        id: 'script-1',
        url: 'entity://google-analytics',
        domain: 'google.analytics',
        vendor: 'Unknown',
        category: 'third-party',
        isBlocking: false,
      };

      (prisma.thirdPartyScript.findUnique as jest.Mock).mockResolvedValue(existingScript);
      (prisma.thirdPartyScript.update as jest.Mock).mockResolvedValue(existingScript);
      (prisma.thirdPartyScriptDetection.create as jest.Mock).mockResolvedValue({});

      await service.processAndStoreScripts(
        mockSiteId,
        mockSiteUrl,
        auditDetails,
        mockMetricId
      );

      // Should update the existing script
      expect(prisma.thirdPartyScript.update).toHaveBeenCalled();
      expect(prisma.thirdPartyScript.create).not.toHaveBeenCalled();
    });
  });

  describe('getScriptsForSite', () => {
    const mockSiteId = 'site-123';

    it('should return aggregated script data', async () => {
      const mockDetections = [
        {
          id: 'det-1',
          siteId: mockSiteId,
          scriptId: 'script-1',
          timestamp: new Date('2024-01-01'),
          transferSize: 50000,
          blockingTime: 150,
          script: {
            id: 'script-1',
            url: 'https://google-analytics.com/analytics.js',
            domain: 'google-analytics.com',
            vendor: 'Google Analytics',
            category: 'analytics',
            isBlocking: false,
          },
        },
        {
          id: 'det-2',
          siteId: mockSiteId,
          scriptId: 'script-1',
          timestamp: new Date('2024-01-02'),
          transferSize: 55000,
          blockingTime: 160,
          script: {
            id: 'script-1',
            url: 'https://google-analytics.com/analytics.js',
            domain: 'google-analytics.com',
            vendor: 'Google Analytics',
            category: 'analytics',
            isBlocking: false,
          },
        },
      ];

      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue(mockDetections);

      const result = await service.getScriptsForSite(mockSiteId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'script-1',
        vendor: 'Google Analytics',
        category: 'analytics',
        detectionCount: 2,
        totalTransferSize: 105000,
        totalBlockingTime: 310,
        avgTransferSize: 52500,
        avgBlockingTime: 155,
      });
    });

    it('should filter by page type', async () => {
      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue([]);

      await service.getScriptsForSite(mockSiteId, { pageType: 'product' });

      expect(prisma.thirdPartyScriptDetection.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          siteId: mockSiteId,
          pageType: 'product',
        }),
        include: { script: true },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by device type', async () => {
      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue([]);

      await service.getScriptsForSite(mockSiteId, { deviceType: 'desktop' });

      expect(prisma.thirdPartyScriptDetection.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          siteId: mockSiteId,
          deviceType: 'desktop',
        }),
        include: { script: true },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by time range', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');

      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue([]);

      await service.getScriptsForSite(mockSiteId, {
        timeRange: { start, end },
      });

      expect(prisma.thirdPartyScriptDetection.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          siteId: mockSiteId,
          timestamp: { gte: start, lte: end },
        }),
        include: { script: true },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should return empty array when no detections found', async () => {
      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getScriptsForSite(mockSiteId);

      expect(result).toEqual([]);
    });
  });

  describe('getSummaryForSite', () => {
    const mockSiteId = 'site-123';

    it('should return summary statistics', async () => {
      const mockDetections = [
        {
          id: 'det-1',
          siteId: mockSiteId,
          scriptId: 'script-1',
          timestamp: new Date(),
          transferSize: 50000,
          blockingTime: 150,
          script: {
            id: 'script-1',
            url: 'https://google-analytics.com/analytics.js',
            domain: 'google-analytics.com',
            vendor: 'Google Analytics',
            category: 'analytics',
            isBlocking: false,
          },
        },
        {
          id: 'det-2',
          siteId: mockSiteId,
          scriptId: 'script-2',
          timestamp: new Date(),
          transferSize: 30000,
          blockingTime: 100,
          script: {
            id: 'script-2',
            url: 'https://static.klaviyo.com/widget.js',
            domain: 'static.klaviyo.com',
            vendor: 'Klaviyo',
            category: 'marketing',
            isBlocking: false,
          },
        },
      ];

      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue(mockDetections);

      const result = await service.getSummaryForSite(mockSiteId);

      expect(result).toMatchObject({
        totalScripts: 2,
        totalTransferSize: 80000,
        totalBlockingTime: 250,
        avgTransferSize: 40000,
        avgBlockingTime: 125,
      });

      expect(result.byCategory).toHaveProperty('analytics');
      expect(result.byCategory).toHaveProperty('marketing');
      expect(result.byCategory.analytics.count).toBe(1);
      expect(result.byCategory.marketing.count).toBe(1);
    });

    it('should return zero values when no scripts found', async () => {
      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummaryForSite(mockSiteId);

      expect(result).toMatchObject({
        totalScripts: 0,
        totalTransferSize: 0,
        totalBlockingTime: 0,
        avgTransferSize: 0,
        avgBlockingTime: 0,
      });
    });

    it('should include top 10 scripts sorted by blocking time', async () => {
      // Create 15 mock detections with different blocking times
      const mockDetections = Array.from({ length: 15 }, (_, i) => ({
        id: `det-${i}`,
        siteId: mockSiteId,
        scriptId: `script-${i}`,
        timestamp: new Date(),
        transferSize: 10000,
        blockingTime: (i + 1) * 10, // 10, 20, 30, ... 150
        script: {
          id: `script-${i}`,
          url: `https://example-${i}.com/script.js`,
          domain: `example-${i}.com`,
          vendor: `Vendor ${i}`,
          category: 'analytics',
          isBlocking: false,
        },
      }));

      (prisma.thirdPartyScriptDetection.findMany as jest.Mock).mockResolvedValue(mockDetections);

      const result = await service.getSummaryForSite(mockSiteId);

      expect(result.scripts).toHaveLength(10); // Top 10 only
      expect(result.scripts[0].avgBlockingTime).toBeGreaterThan(result.scripts[9].avgBlockingTime);
    });
  });
});
