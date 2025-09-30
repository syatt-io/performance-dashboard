import request from 'supertest';
import express from 'express';
import sitesRouter from '../../src/routes/sites';
import { prisma } from '../../src/services/database';

// Mock dependencies
jest.mock('../../src/services/database', () => ({
  prisma: {
    site: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

describe('Sites API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sites', sitesRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/sites', () => {
    it('should return all sites', async () => {
      const mockSites = [
        {
          id: '123',
          name: 'Test Site',
          url: 'https://test.com',
          createdAt: new Date(),
          _count: { metrics: 5 },
        },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

      const response = await request(app).get('/api/sites');

      expect(response.status).toBe(200);
      expect(response.body.sites).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.sites[0].name).toBe('Test Site');
    });

    it('should handle database errors', async () => {
      (prisma.site.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const response = await request(app).get('/api/sites');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch sites');
    });
  });

  describe('POST /api/sites', () => {
    it('should create a new site', async () => {
      const newSite = {
        name: 'New Site',
        url: 'https://newsite.com',
      };

      const mockCreatedSite = {
        id: '456',
        ...newSite,
        monitoringEnabled: true,
        checkFrequency: 360,
        createdAt: new Date(),
      };

      (prisma.site.create as jest.Mock).mockResolvedValue(mockCreatedSite);

      const response = await request(app)
        .post('/api/sites')
        .send(newSite);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Site');
      expect(response.body.url).toBe('https://newsite.com');
    });

    it('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/sites')
        .send({ name: 'Test', url: 'not-a-url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid URL format');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/sites')
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name and URL are required');
    });

    it('should handle duplicate site URLs', async () => {
      (prisma.site.create as jest.Mock).mockRejectedValue({ code: 'P2002' });

      const response = await request(app)
        .post('/api/sites')
        .send({ name: 'Test', url: 'https://test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Site with this URL already exists');
    });
  });

  describe('GET /api/sites/:id', () => {
    it('should return a specific site', async () => {
      const mockSite = {
        id: '123',
        name: 'Test Site',
        url: 'https://test.com',
        _count: { metrics: 5 },
      };

      (prisma.site.findUnique as jest.Mock).mockResolvedValue(mockSite);

      const response = await request(app).get('/api/sites/123');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Site');
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/sites/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });
  });

  describe('PUT /api/sites/:id', () => {
    it('should update a site', async () => {
      const updatedSite = {
        id: '123',
        name: 'Updated Name',
        url: 'https://test.com',
      };

      (prisma.site.update as jest.Mock).mockResolvedValue(updatedSite);

      const response = await request(app)
        .put('/api/sites/123')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.update as jest.Mock).mockRejectedValue({ code: 'P2025' });

      const response = await request(app)
        .put('/api/sites/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });
  });

  describe('DELETE /api/sites/:id', () => {
    it('should delete a site', async () => {
      (prisma.site.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/sites/123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Site deleted successfully');
    });

    it('should return 404 for non-existent site', async () => {
      (prisma.site.delete as jest.Mock).mockRejectedValue({ code: 'P2025' });

      const response = await request(app).delete('/api/sites/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Site not found');
    });
  });
});
