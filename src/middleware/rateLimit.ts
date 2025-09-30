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
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
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
    logger.warn(`Metrics collection rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many metrics collection requests, please try again in an hour.',
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
    logger.warn(`Site operations rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many site operations, please try again later.',
    });
  },
});
