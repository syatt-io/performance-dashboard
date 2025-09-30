import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// General API rate limiter - 1000 requests per 15 minutes per IP
// With 12 sites and multiple metrics per site, the dashboard makes ~40-50 requests on initial load
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 15 * 60 * 1000);
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      resetTime: resetTime.toISOString(),
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You have exceeded the maximum number of API requests (1000 per 15 minutes).',
      retryAfter: '15 minutes',
      resetTime: resetTime.toISOString(),
      limit: 1000,
      window: '15 minutes',
    });
  },
});

// Stricter rate limit for metrics collection - 10 requests per hour per IP
export const metricsCollectionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many metrics collection requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 60 * 60 * 1000);
    logger.warn(`Metrics collection rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      resetTime: resetTime.toISOString(),
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You have exceeded the maximum number of metrics collection requests (10 per hour). Performance tests are resource-intensive operations.',
      retryAfter: '1 hour',
      resetTime: resetTime.toISOString(),
      limit: 10,
      window: '1 hour',
    });
  },
});

// Rate limit for site operations - 50 requests per 15 minutes per IP
export const siteOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many site operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 15 * 60 * 1000);
    logger.warn(`Site operations rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      resetTime: resetTime.toISOString(),
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You have exceeded the maximum number of site operations (50 per 15 minutes).',
      retryAfter: '15 minutes',
      resetTime: resetTime.toISOString(),
      limit: 50,
      window: '15 minutes',
    });
  },
});
