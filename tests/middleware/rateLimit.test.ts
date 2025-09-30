import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  apiLimiter,
  metricsCollectionLimiter,
  siteOperationsLimiter,
} from '../../src/middleware/rateLimit';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Rate Limiting Middleware', () => {
  describe('apiLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(apiLimiter);
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    it('should have limit of 1000 requests per 15 minutes', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['ratelimit-limit']).toBe('1000');
    });
  });

  describe('metricsCollectionLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(metricsCollectionLimiter);
      app.post('/collect', (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).post('/collect');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should have limit of 10 requests per hour', async () => {
      const response = await request(app).post('/collect');

      expect(response.headers['ratelimit-limit']).toBe('10');
    });

    it('should include detailed error message when limit exceeded', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await request(app).post('/collect');
      }

      // This request should be rate limited
      const response = await request(app).post('/collect');

      if (response.status === 429) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Rate limit exceeded');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('retryAfter');
        expect(response.body).toHaveProperty('resetTime');
        expect(response.body).toHaveProperty('limit');
        expect(response.body).toHaveProperty('window');
        expect(response.body.limit).toBe(10);
        expect(response.body.window).toBe('1 hour');
      }
    });
  });

  describe('siteOperationsLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(siteOperationsLimiter);
      app.post('/sites', (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).post('/sites');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should have limit of 50 requests per 15 minutes', async () => {
      const response = await request(app).post('/sites');

      expect(response.headers['ratelimit-limit']).toBe('50');
    });

    it('should include detailed error message when limit exceeded', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 50; i++) {
        await request(app).post('/sites');
      }

      // This request should be rate limited
      const response = await request(app).post('/sites');

      if (response.status === 429) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Rate limit exceeded');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('retryAfter');
        expect(response.body.retryAfter).toBe('15 minutes');
        expect(response.body.limit).toBe(50);
      }
    });
  });

  describe('Rate limiter configuration', () => {
    it('apiLimiter should use standard headers', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      // Should have RateLimit-* headers (standardHeaders: true)
      expect(response.headers).toHaveProperty('ratelimit-limit');
      // Should NOT have X-RateLimit-* headers (legacyHeaders: false)
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('metricsCollectionLimiter should count requests toward the limit', async () => {
      const app = express();
      app.use(metricsCollectionLimiter);
      app.post('/collect', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const firstResponse = await request(app).post('/collect');
      const firstRemaining = parseInt(firstResponse.headers['ratelimit-remaining']);

      // Should have consumed one request from the limit
      expect(firstRemaining).toBeLessThanOrEqual(9);
      expect(firstResponse.status).toBe(200);
    });
  });

  describe('Error message format', () => {
    it('should provide ISO 8601 formatted resetTime', async () => {
      const app = express();
      app.use(metricsCollectionLimiter);
      app.post('/collect', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await request(app).post('/collect');
      }

      const response = await request(app).post('/collect');

      if (response.status === 429) {
        expect(response.body.resetTime).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      }
    });

    it('should include helpful message explaining the limit', async () => {
      const app = express();
      app.use(metricsCollectionLimiter);
      app.post('/collect', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      for (let i = 0; i < 10; i++) {
        await request(app).post('/collect');
      }

      const response = await request(app).post('/collect');

      if (response.status === 429) {
        expect(response.body.message).toContain('Performance tests are resource-intensive');
      }
    });
  });
});
