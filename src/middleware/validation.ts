import { Request, Response, NextFunction } from 'express';

/**
 * Basic input validation middleware
 */
export const validateSiteCreation = (req: Request, res: Response, next: NextFunction) => {
  const { name, url, shopifyDomain, apiKey, accessToken, categoryUrl, productUrl } = req.body;

  // Required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Site name is required and must be a non-empty string' });
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required and must be a string' });
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).json({ error: 'URL must use HTTP or HTTPS protocol' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Optional field validation
  if (shopifyDomain && (typeof shopifyDomain !== 'string' || shopifyDomain.length > 100)) {
    return res.status(400).json({ error: 'Shopify domain must be a string with max 100 characters' });
  }

  if (apiKey && (typeof apiKey !== 'string' || apiKey.length > 10000)) {
    return res.status(400).json({ error: 'API key must be a string with max 10000 characters' });
  }

  if (accessToken && (typeof accessToken !== 'string' || accessToken.length > 10000)) {
    return res.status(400).json({ error: 'Access token must be a string with max 10000 characters' });
  }

  // Validate categoryUrl and productUrl
  if (categoryUrl && typeof categoryUrl === 'string' && categoryUrl.trim().length > 0) {
    try {
      const categoryUrlObj = new URL(categoryUrl);
      if (!['http:', 'https:'].includes(categoryUrlObj.protocol)) {
        return res.status(400).json({ error: 'Category URL must use HTTP or HTTPS protocol' });
      }
      req.body.categoryUrl = categoryUrl.trim();
    } catch {
      return res.status(400).json({ error: 'Invalid category URL format' });
    }
  }

  if (productUrl && typeof productUrl === 'string' && productUrl.trim().length > 0) {
    try {
      const productUrlObj = new URL(productUrl);
      if (!['http:', 'https:'].includes(productUrlObj.protocol)) {
        return res.status(400).json({ error: 'Product URL must use HTTP or HTTPS protocol' });
      }
      req.body.productUrl = productUrl.trim();
    } catch {
      return res.status(400).json({ error: 'Invalid product URL format' });
    }
  }

  // Sanitize inputs
  req.body.name = name.trim();
  req.body.url = url.trim();
  if (shopifyDomain) req.body.shopifyDomain = shopifyDomain.trim();

  next();
};

/**
 * Validate site updates
 */
export const validateSiteUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { name, url, shopifyDomain, isActive, categoryUrl, productUrl } = req.body;

  // All fields are optional for updates, but validate if provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Site name must be a non-empty string' });
    }
    req.body.name = name.trim();
  }

  if (url !== undefined) {
    if (typeof url !== 'string') {
      return res.status(400).json({ error: 'URL must be a string' });
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ error: 'URL must use HTTP or HTTPS protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    req.body.url = url.trim();
  }

  if (shopifyDomain !== undefined) {
    if (shopifyDomain !== null && (typeof shopifyDomain !== 'string' || shopifyDomain.length > 100)) {
      return res.status(400).json({ error: 'Shopify domain must be a string with max 100 characters' });
    }
    if (shopifyDomain) req.body.shopifyDomain = shopifyDomain.trim();
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  // Validate categoryUrl
  if (categoryUrl !== undefined) {
    if (categoryUrl && typeof categoryUrl === 'string' && categoryUrl.trim().length > 0) {
      try {
        const categoryUrlObj = new URL(categoryUrl);
        if (!['http:', 'https:'].includes(categoryUrlObj.protocol)) {
          return res.status(400).json({ error: 'Category URL must use HTTP or HTTPS protocol' });
        }
        req.body.categoryUrl = categoryUrl.trim();
      } catch {
        return res.status(400).json({ error: 'Invalid category URL format' });
      }
    } else if (categoryUrl === null || categoryUrl === '') {
      // Allow clearing the categoryUrl
      req.body.categoryUrl = null;
    }
  }

  // Validate productUrl
  if (productUrl !== undefined) {
    if (productUrl && typeof productUrl === 'string' && productUrl.trim().length > 0) {
      try {
        const productUrlObj = new URL(productUrl);
        if (!['http:', 'https:'].includes(productUrlObj.protocol)) {
          return res.status(400).json({ error: 'Product URL must use HTTP or HTTPS protocol' });
        }
        req.body.productUrl = productUrl.trim();
      } catch {
        return res.status(400).json({ error: 'Invalid product URL format' });
      }
    } else if (productUrl === null || productUrl === '') {
      // Allow clearing the productUrl
      req.body.productUrl = null;
    }
  }

  next();
};

/**
 * Validate UUID parameters
 */
export const validateUuidParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];

    if (!value) {
      return res.status(400).json({ error: `${paramName} parameter is required` });
    }

    // Basic UUID validation (v4 format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }

    next();
  };
};

/**
 * Rate limiting placeholder (implement with redis-based solution in production)
 */
export const rateLimitPlaceholder = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement actual rate limiting with redis
  // For now, just pass through
  next();
};

/**
 * Sanitize query parameters for metrics endpoints
 */
export const validateMetricsQuery = (req: Request, res: Response, next: NextFunction) => {
  const { timeRange, deviceType, limit, startDate, endDate } = req.query;

  // Validate timeRange
  if (timeRange && !['1h', '24h', '7d', '30d', '90d', 'custom'].includes(timeRange as string)) {
    return res.status(400).json({ error: 'Invalid timeRange. Must be one of: 1h, 24h, 7d, 30d, 90d, custom' });
  }

  // Validate deviceType
  if (deviceType && !['mobile', 'desktop'].includes(deviceType as string)) {
    return res.status(400).json({ error: 'Invalid deviceType. Must be mobile or desktop' });
  }

  // Validate limit
  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ error: 'Limit must be a number between 1 and 1000' });
    }
  }

  // Validate date range
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Both startDate and endDate are required for custom date range' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Limit date range to prevent excessive queries
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return res.status(400).json({ error: 'Date range cannot exceed 1 year' });
    }
  }

  next();
};