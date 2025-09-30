import request from 'supertest';
import express from 'express';
import shopifyRouter from '../../src/routes/shopify';
import { prisma } from '../../src/services/database';
import { shopifyMetricsCollector } from '../../src/services/shopifyMetrics';

jest.mock('../../src/services/database', () => ({
  prisma: {
    site: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/shopifyMetrics', () => ({
  shopifyMetricsCollector: {
    collectCollectionMetrics: jest.fn(),
    collectProductMetrics: jest.fn(),
    collectShopifyPageMetrics: jest.fn(),
    getShopifyPageSummary: jest.fn(),
    getPageTypeAverages: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Shopify Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/shopify', shopifyRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/shopify/metrics/collection', () => {
    it('should collect collection metrics', async () => {
      const mockMetrics = {
        siteId: 'site-123',
        pageType: 'collection',
        performance: 90,
      };

      (shopifyMetricsCollector.collectCollectionMetrics as jest.Mock).mockResolvedValue(
        mockMetrics
      );

      const response = await request(app)
        .post('/api/shopify/metrics/collection')
        .send({
          siteId: 'site-123',
          collectionUrl: 'https://example.com/collections/all',
          collectionName: 'All Products',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toEqual(mockMetrics);
      expect(shopifyMetricsCollector.collectCollectionMetrics).toHaveBeenCalledWith(
        'site-123',
        'https://example.com/collections/all',
        'All Products'
      );
    });

    it('should return 400 for missing siteId', async () => {
      const response = await request(app)
        .post('/api/shopify/metrics/collection')
        .send({
          collectionUrl: 'https://example.com/collections/all',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for missing collectionUrl', async () => {
      const response = await request(app)
        .post('/api/shopify/metrics/collection')
        .send({
          siteId: 'site-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should handle errors from collector', async () => {
      (shopifyMetricsCollector.collectCollectionMetrics as jest.Mock).mockRejectedValue(
        new Error('Collection not found')
      );

      const response = await request(app)
        .post('/api/shopify/metrics/collection')
        .send({
          siteId: 'site-123',
          collectionUrl: 'https://example.com/collections/all',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to collect collection metrics');
    });
  });

  describe('POST /api/shopify/metrics/product', () => {
    it('should collect product metrics', async () => {
      const mockMetrics = {
        siteId: 'site-123',
        pageType: 'product',
        performance: 92,
      };

      (shopifyMetricsCollector.collectProductMetrics as jest.Mock).mockResolvedValue(
        mockMetrics
      );

      const response = await request(app)
        .post('/api/shopify/metrics/product')
        .send({
          siteId: 'site-123',
          productUrl: 'https://example.com/products/test-product',
          productName: 'Test Product',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toEqual(mockMetrics);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/shopify/metrics/product')
        .send({
          siteId: 'site-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/shopify/metrics/all/:siteId', () => {
    it('should collect all Shopify page metrics', async () => {
      (shopifyMetricsCollector.collectShopifyPageMetrics as jest.Mock).mockResolvedValue(
        undefined
      );

      const response = await request(app).post(
        '/api/shopify/metrics/all/site-123'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('collection started');
      expect(shopifyMetricsCollector.collectShopifyPageMetrics).toHaveBeenCalledWith(
        'site-123'
      );
    });

    it('should handle errors from collector', async () => {
      (shopifyMetricsCollector.collectShopifyPageMetrics as jest.Mock).mockRejectedValue(
        new Error('Site not found')
      );

      const response = await request(app).post(
        '/api/shopify/metrics/all/site-123'
      );

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to collect Shopify metrics');
    });
  });

  describe('GET /api/shopify/summary/:siteId', () => {
    it('should return Shopify page summary', async () => {
      const mockSummary = {
        siteId: 'site-123',
        totalPages: 10,
        avgPerformance: 88,
      };

      (shopifyMetricsCollector.getShopifyPageSummary as jest.Mock).mockResolvedValue(
        mockSummary
      );

      const response = await request(app).get('/api/shopify/summary/site-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSummary);
      expect(shopifyMetricsCollector.getShopifyPageSummary).toHaveBeenCalledWith(
        'site-123',
        7
      );
    });

    it('should accept days query parameter', async () => {
      (shopifyMetricsCollector.getShopifyPageSummary as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .get('/api/shopify/summary/site-123')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(shopifyMetricsCollector.getShopifyPageSummary).toHaveBeenCalledWith(
        'site-123',
        30
      );
    });

    it('should default to 7 days if not specified', async () => {
      (shopifyMetricsCollector.getShopifyPageSummary as jest.Mock).mockResolvedValue({});

      await request(app).get('/api/shopify/summary/site-123');

      expect(shopifyMetricsCollector.getShopifyPageSummary).toHaveBeenCalledWith(
        'site-123',
        7
      );
    });
  });

  describe('GET /api/shopify/averages/:siteId', () => {
    it('should return page type averages', async () => {
      const mockAverages = {
        homepage: { avgPerformance: 90 },
        product: { avgPerformance: 85 },
        collection: { avgPerformance: 88 },
      };

      (shopifyMetricsCollector.getPageTypeAverages as jest.Mock).mockResolvedValue(
        mockAverages
      );

      const response = await request(app).get('/api/shopify/averages/site-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAverages);
      expect(shopifyMetricsCollector.getPageTypeAverages).toHaveBeenCalledWith(
        'site-123',
        30
      );
    });

    it('should accept days query parameter', async () => {
      (shopifyMetricsCollector.getPageTypeAverages as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .get('/api/shopify/averages/site-123')
        .query({ days: 90 });

      expect(response.status).toBe(200);
      expect(shopifyMetricsCollector.getPageTypeAverages).toHaveBeenCalledWith(
        'site-123',
        90
      );
    });
  });

  describe('PUT /api/shopify/config/:siteId', () => {
    it('should update Shopify configuration', async () => {
      const response = await request(app)
        .put('/api/shopify/config/site-123')
        .send({
          isShopify: true,
          collections: [{ url: 'https://example.com/collections/all', name: 'All' }],
          products: [{ url: 'https://example.com/products/test', name: 'Test' }],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('configuration updated');
      expect(response.body.config).toBeDefined();
    });

    it('should default isShopify to true', async () => {
      const response = await request(app)
        .put('/api/shopify/config/site-123')
        .send({
          collections: [],
          products: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.config.isShopify).toBe(true);
    });
  });

  describe('GET /api/shopify/config/:siteId', () => {
    it('should return Shopify configuration', async () => {
      const mockSite = {
        id: 'site-123',
        name: 'Test Site',
        url: 'https://example.com',
        isShopify: true,
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app).get('/api/shopify/config/site-123');

      expect(response.status).toBe(200);
      expect(response.body.isShopify).toBe(true);
      expect(response.body.collections).toBeDefined();
      expect(response.body.products).toBeDefined();
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/shopify/config/site-999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });

    it('should default isShopify to false if not set', async () => {
      const mockSite = {
        id: 'site-123',
        name: 'Test Site',
        url: 'https://example.com',
        isShopify: null,
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app).get('/api/shopify/config/site-123');

      expect(response.status).toBe(200);
      expect(response.body.isShopify).toBe(false);
    });
  });

  describe('POST /api/shopify/config/:siteId/collection', () => {
    it('should add collection to monitoring', async () => {
      const mockSite = {
        id: 'site-123',
        name: 'Test Site',
        url: 'https://example.com',
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app)
        .post('/api/shopify/config/site-123/collection')
        .send({
          url: 'https://example.com/collections/new',
          name: 'New Collection',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Collection added');
    });

    it('should return 400 for missing url', async () => {
      const response = await request(app)
        .post('/api/shopify/config/site-123/collection')
        .send({
          name: 'Collection Name',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/shopify/config/site-123/collection')
        .send({
          url: 'https://example.com/collections/test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopify/config/site-999/collection')
        .send({
          url: 'https://example.com/collections/test',
          name: 'Test',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });
  });

  describe('POST /api/shopify/config/:siteId/product', () => {
    it('should add product to monitoring', async () => {
      const mockSite = {
        id: 'site-123',
        name: 'Test Site',
        url: 'https://example.com',
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app)
        .post('/api/shopify/config/site-123/product')
        .send({
          url: 'https://example.com/products/new-product',
          name: 'New Product',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Product added');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/shopify/config/site-123/product')
        .send({
          url: 'https://example.com/products/test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopify/config/site-999/product')
        .send({
          url: 'https://example.com/products/test',
          name: 'Test',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });
  });
});
