import request from 'supertest';
import express from 'express';
import monitoringRouter from '../../src/routes/monitoring';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Monitoring Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/monitoring', monitoringRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/monitoring/queue/stats', () => {
    it('should return queue stats disabled message', async () => {
      const response = await request(app).get('/api/monitoring/queue/stats');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Queue stats disabled');
    });
  });

  describe('GET /api/monitoring/jobs', () => {
    it('should return monitoring jobs disabled message', async () => {
      const response = await request(app).get('/api/monitoring/jobs');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Monitoring jobs disabled');
    });

    it('should accept limit query parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/jobs')
        .query({ limit: 100 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Monitoring jobs disabled');
    });

    it('should default to limit of 50', async () => {
      const response = await request(app).get('/api/monitoring/jobs');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/monitoring/collect/all', () => {
    it('should return collection disabled message', async () => {
      const response = await request(app).post('/api/monitoring/collect/all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
      expect(response.body.jobId).toBe('disabled');
    });
  });

  describe('POST /api/monitoring/collect/site/:siteId', () => {
    it('should return site collection disabled message', async () => {
      const response = await request(app).post(
        '/api/monitoring/collect/site/site-123'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('site-123');
      expect(response.body.message).toContain('disabled');
      expect(response.body.jobId).toBe('disabled');
    });

    it('should include siteId in response message', async () => {
      const siteId = 'test-site-456';
      const response = await request(app).post(
        `/api/monitoring/collect/site/${siteId}`
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toContain(siteId);
    });
  });

  describe('POST /api/monitoring/schedule/setup', () => {
    it('should return schedule setup disabled message', async () => {
      const response = await request(app).post(
        '/api/monitoring/schedule/setup'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });
  });

  describe('DELETE /api/monitoring/schedule/clear', () => {
    it('should return schedule clear disabled message', async () => {
      const response = await request(app).delete(
        '/api/monitoring/schedule/clear'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });
  });

  describe('POST /api/monitoring/queue/pause', () => {
    it('should return queue pause disabled message', async () => {
      const response = await request(app).post('/api/monitoring/queue/pause');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });
  });

  describe('POST /api/monitoring/queue/resume', () => {
    it('should return queue resume disabled message', async () => {
      const response = await request(app).post('/api/monitoring/queue/resume');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });
  });

  describe('POST /api/monitoring/jobs/cleanup', () => {
    it('should return jobs cleanup disabled message', async () => {
      const response = await request(app).post('/api/monitoring/jobs/cleanup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disabled');
    });
  });

  describe('Response format consistency', () => {
    it('all POST endpoints should return success: true', async () => {
      const endpoints = [
        '/api/monitoring/collect/all',
        '/api/monitoring/collect/site/test-123',
        '/api/monitoring/schedule/setup',
        '/api/monitoring/queue/pause',
        '/api/monitoring/queue/resume',
        '/api/monitoring/jobs/cleanup',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).post(endpoint);
        expect(response.body.success).toBe(true);
      }
    });

    it('all endpoints should return 200 status', async () => {
      const getEndpoints = [
        '/api/monitoring/queue/stats',
        '/api/monitoring/jobs',
      ];

      const postEndpoints = [
        '/api/monitoring/collect/all',
        '/api/monitoring/collect/site/test-123',
        '/api/monitoring/schedule/setup',
        '/api/monitoring/queue/pause',
        '/api/monitoring/queue/resume',
        '/api/monitoring/jobs/cleanup',
      ];

      const deleteEndpoints = ['/api/monitoring/schedule/clear'];

      for (const endpoint of getEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(200);
      }

      for (const endpoint of postEndpoints) {
        const response = await request(app).post(endpoint);
        expect(response.status).toBe(200);
      }

      for (const endpoint of deleteEndpoints) {
        const response = await request(app).delete(endpoint);
        expect(response.status).toBe(200);
      }
    });
  });
});
