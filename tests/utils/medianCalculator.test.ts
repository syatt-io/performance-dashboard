import {
  calculateMedian,
  calculateMedianMetrics,
  groupTestRuns,
  getTestConfiguration,
} from '../../src/utils/medianCalculator';
import { PerformanceTestRun } from '../../src/generated/prisma';

describe('medianCalculator', () => {
  describe('calculateMedian', () => {
    it('should return null for empty array', () => {
      expect(calculateMedian([])).toBeNull();
    });

    it('should return the single value for array with one element', () => {
      expect(calculateMedian([5])).toBe(5);
    });

    it('should calculate median for odd number of values', () => {
      expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate median for even number of values', () => {
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    });

    it('should filter out null and undefined values', () => {
      expect(calculateMedian([1, null, 3, undefined, 5])).toBe(3);
    });

    it('should return null if all values are null or undefined', () => {
      expect(calculateMedian([null, undefined, null])).toBeNull();
    });

    it('should handle unsorted arrays correctly', () => {
      expect(calculateMedian([5, 1, 3, 2, 4])).toBe(3);
    });

    it('should handle negative numbers', () => {
      expect(calculateMedian([-5, -1, 0, 1, 5])).toBe(0);
    });

    it('should handle decimal numbers', () => {
      expect(calculateMedian([1.5, 2.5, 3.5])).toBe(2.5);
    });
  });

  describe('calculateMedianMetrics', () => {
    it('should throw error for empty runs array', () => {
      expect(() => calculateMedianMetrics([])).toThrow(
        'No test runs provided for median calculation'
      );
    });

    it('should calculate median metrics from multiple runs', () => {
      const mockRuns: Partial<PerformanceTestRun>[] = [
        {
          performance: 90,
          accessibility: 95,
          bestPractices: 85,
          seo: 100,
          fcp: 1.5,
          si: 2.0,
          lcp: 2.5,
          tbt: 200,
          cls: 0.1,
          tti: 3.0,
          ttfb: 0.5,
          pageLoadTime: 4.0,
          pageSize: 1000000,
          requests: 50,
        },
        {
          performance: 80,
          accessibility: 90,
          bestPractices: 80,
          seo: 95,
          fcp: 2.0,
          si: 2.5,
          lcp: 3.0,
          tbt: 300,
          cls: 0.15,
          tti: 3.5,
          ttfb: 0.7,
          pageLoadTime: 5.0,
          pageSize: 1200000,
          requests: 60,
        },
        {
          performance: 85,
          accessibility: 92,
          bestPractices: 82,
          seo: 98,
          fcp: 1.8,
          si: 2.2,
          lcp: 2.8,
          tbt: 250,
          cls: 0.12,
          tti: 3.2,
          ttfb: 0.6,
          pageLoadTime: 4.5,
          pageSize: 1100000,
          requests: 55,
        },
      ];

      const result = calculateMedianMetrics(mockRuns as PerformanceTestRun[]);

      expect(result.performance).toBe(85);
      expect(result.accessibility).toBe(92);
      expect(result.lcp).toBe(2.8);
      expect(result.cls).toBe(0.12);
    });

    it('should handle runs with null values', () => {
      const mockRuns: Partial<PerformanceTestRun>[] = [
        { performance: 90, lcp: 2.5, cls: null },
        { performance: 80, lcp: null, cls: 0.1 },
        { performance: 85, lcp: 2.8, cls: 0.12 },
      ];

      const result = calculateMedianMetrics(mockRuns as PerformanceTestRun[]);

      expect(result.performance).toBe(85);
      expect(result.lcp).toBe(2.65); // Median of [2.5, 2.8]
      expect(result.cls).toBe(0.11); // Median of [0.1, 0.12]
    });
  });

  describe('groupTestRuns', () => {
    it('should group test runs by page type and device type', () => {
      const mockRuns: Partial<PerformanceTestRun>[] = [
        { id: '1', pageType: 'homepage', deviceType: 'mobile' },
        { id: '2', pageType: 'homepage', deviceType: 'desktop' },
        { id: '3', pageType: 'homepage', deviceType: 'mobile' },
        { id: '4', pageType: 'product', deviceType: 'mobile' },
      ];

      const grouped = groupTestRuns(mockRuns as PerformanceTestRun[]);

      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped['homepage_mobile']).toHaveLength(2);
      expect(grouped['homepage_desktop']).toHaveLength(1);
      expect(grouped['product_mobile']).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const grouped = groupTestRuns([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should create unique keys for each combination', () => {
      const mockRuns: Partial<PerformanceTestRun>[] = [
        { pageType: 'category', deviceType: 'desktop' },
      ];

      const grouped = groupTestRuns(mockRuns as PerformanceTestRun[]);

      expect(grouped['category_desktop']).toBeDefined();
      expect(grouped['category_desktop']).toHaveLength(1);
    });
  });

  describe('getTestConfiguration', () => {
    it('should return configuration with homepage only', () => {
      const site = {
        url: 'https://example.com',
      };

      const config = getTestConfiguration(site);

      expect(config.pageTypes).toHaveLength(1);
      expect(config.pageTypes[0]).toEqual({
        type: 'homepage',
        url: 'https://example.com',
      });
      expect(config.deviceTypes).toEqual(['mobile', 'desktop']);
      expect(config.numberOfRuns).toBe(3);
    });

    it('should include category page when provided', () => {
      const site = {
        url: 'https://example.com',
        categoryUrl: 'https://example.com/category',
      };

      const config = getTestConfiguration(site);

      expect(config.pageTypes).toHaveLength(2);
      expect(config.pageTypes[1]).toEqual({
        type: 'category',
        url: 'https://example.com/category',
      });
    });

    it('should include product page when provided', () => {
      const site = {
        url: 'https://example.com',
        productUrl: 'https://example.com/product',
      };

      const config = getTestConfiguration(site);

      expect(config.pageTypes).toHaveLength(2);
      expect(config.pageTypes[1]).toEqual({
        type: 'product',
        url: 'https://example.com/product',
      });
    });

    it('should include all page types when all URLs provided', () => {
      const site = {
        url: 'https://example.com',
        categoryUrl: 'https://example.com/category',
        productUrl: 'https://example.com/product',
        isShopify: true,
      };

      const config = getTestConfiguration(site);

      expect(config.pageTypes).toHaveLength(3);
      expect(config.pageTypes.map(p => p.type)).toEqual([
        'homepage',
        'category',
        'product',
      ]);
    });

    it('should handle null values for optional URLs', () => {
      const site = {
        url: 'https://example.com',
        categoryUrl: null,
        productUrl: null,
      };

      const config = getTestConfiguration(site);

      expect(config.pageTypes).toHaveLength(1);
      expect(config.pageTypes[0].type).toBe('homepage');
    });

    it('should always return both device types', () => {
      const site = { url: 'https://example.com' };
      const config = getTestConfiguration(site);

      expect(config.deviceTypes).toContain('mobile');
      expect(config.deviceTypes).toContain('desktop');
    });

    it('should always set numberOfRuns to 3', () => {
      const site = { url: 'https://example.com' };
      const config = getTestConfiguration(site);

      expect(config.numberOfRuns).toBe(3);
    });
  });
});
