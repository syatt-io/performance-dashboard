import { Router, Request, Response } from 'express';
import { shopifyMetricsCollector } from '../services/shopifyMetrics';
import { prisma } from '../services/database';

const router = Router();

// Collect metrics for specific collection page
router.post('/metrics/collection', async (req: Request, res: Response) => {
  try {
    const { siteId, collectionUrl, collectionName } = req.body;

    if (!siteId || !collectionUrl) {
      return res.status(400).json({
        error: 'Missing required fields: siteId and collectionUrl'
      });
    }

    const metrics = await shopifyMetricsCollector.collectCollectionMetrics(
      siteId,
      collectionUrl,
      collectionName
    );

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error collecting collection metrics:', error);
    res.status(500).json({
      error: 'Failed to collect collection metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Collect metrics for specific product page
router.post('/metrics/product', async (req: Request, res: Response) => {
  try {
    const { siteId, productUrl, productName } = req.body;

    if (!siteId || !productUrl) {
      return res.status(400).json({
        error: 'Missing required fields: siteId and productUrl'
      });
    }

    const metrics = await shopifyMetricsCollector.collectProductMetrics(
      siteId,
      productUrl,
      productName
    );

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error collecting product metrics:', error);
    res.status(500).json({
      error: 'Failed to collect product metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Collect metrics for all configured Shopify pages
router.post('/metrics/all/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    await shopifyMetricsCollector.collectShopifyPageMetrics(siteId);

    res.json({
      success: true,
      message: 'Shopify page metrics collection started'
    });
  } catch (error) {
    console.error('Error collecting Shopify metrics:', error);
    res.status(500).json({
      error: 'Failed to collect Shopify metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Shopify page performance summary
router.get('/summary/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const summary = await shopifyMetricsCollector.getShopifyPageSummary(siteId, days);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching Shopify summary:', error);
    res.status(500).json({
      error: 'Failed to fetch Shopify summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get average performance by page type
router.get('/averages/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const averages = await shopifyMetricsCollector.getPageTypeAverages(siteId, days);

    res.json(averages);
  } catch (error) {
    console.error('Error calculating page type averages:', error);
    res.status(500).json({
      error: 'Failed to calculate page type averages',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Configure which pages to monitor for a site
router.put('/config/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { collections, products, isShopify } = req.body;

    // Store configuration in the site's apiKey field as JSON
    const config = {
      isShopify: isShopify !== false, // Default to true
      collections: collections || [],
      products: products || []
    };

    await prisma.site.update({
      where: { id: siteId },
      data: {
        apiKey: JSON.stringify(config)
      }
    });

    res.json({
      success: true,
      message: 'Shopify monitoring configuration updated',
      config
    });
  } catch (error) {
    console.error('Error updating Shopify config:', error);
    res.status(500).json({
      error: 'Failed to update Shopify configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current configuration
router.get('/config/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return res.status(404).json({
        error: 'Site not found'
      });
    }

    let config = {
      isShopify: false,
      collections: [],
      products: []
    };

    if (site.apiKey) {
      try {
        config = JSON.parse(site.apiKey);
      } catch {
        // apiKey is not JSON, assume not configured
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching Shopify config:', error);
    res.status(500).json({
      error: 'Failed to fetch Shopify configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a collection to monitor
router.post('/config/:siteId/collection', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { url, name } = req.body;

    if (!url || !name) {
      return res.status(400).json({
        error: 'Missing required fields: url and name'
      });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return res.status(404).json({
        error: 'Site not found'
      });
    }

    let config = {
      isShopify: true,
      collections: [],
      products: []
    };

    if (site.apiKey) {
      try {
        config = JSON.parse(site.apiKey);
      } catch {
        // Start fresh
      }
    }

    // Add new collection if not already present
    const exists = config.collections.some((c: any) => c.url === url);
    if (!exists) {
      config.collections.push({ url, name });
    }

    await prisma.site.update({
      where: { id: siteId },
      data: {
        apiKey: JSON.stringify(config)
      }
    });

    res.json({
      success: true,
      message: 'Collection added to monitoring',
      config
    });
  } catch (error) {
    console.error('Error adding collection:', error);
    res.status(500).json({
      error: 'Failed to add collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a product to monitor
router.post('/config/:siteId/product', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { url, name } = req.body;

    if (!url || !name) {
      return res.status(400).json({
        error: 'Missing required fields: url and name'
      });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return res.status(404).json({
        error: 'Site not found'
      });
    }

    let config = {
      isShopify: true,
      collections: [],
      products: []
    };

    if (site.apiKey) {
      try {
        config = JSON.parse(site.apiKey);
      } catch {
        // Start fresh
      }
    }

    // Add new product if not already present
    const exists = config.products.some((p: any) => p.url === url);
    if (!exists) {
      config.products.push({ url, name });
    }

    await prisma.site.update({
      where: { id: siteId },
      data: {
        apiKey: JSON.stringify(config)
      }
    });

    res.json({
      success: true,
      message: 'Product added to monitoring',
      config
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({
      error: 'Failed to add product',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;