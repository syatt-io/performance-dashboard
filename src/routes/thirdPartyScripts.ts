import { Router, Request, Response } from 'express';
import { thirdPartyScriptService } from '../services/thirdPartyScripts';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/third-party-scripts/sites/:siteId
 * Get all third-party scripts detected for a site
 */
router.get('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { pageType, deviceType, timeRange } = req.query;

    const options: any = {};

    if (pageType) {
      options.pageType = pageType as string;
    }

    if (deviceType) {
      options.deviceType = deviceType as string;
    }

    if (timeRange) {
      // Parse timeRange (e.g., "24h", "7d", "30d")
      const match = (timeRange as string).match(/^(\d+)([hdw])$/);
      if (match) {
        const [, amount, unit] = match;
        const now = new Date();
        const start = new Date();

        switch (unit) {
          case 'h':
            start.setHours(start.getHours() - parseInt(amount));
            break;
          case 'd':
            start.setDate(start.getDate() - parseInt(amount));
            break;
          case 'w':
            start.setDate(start.getDate() - parseInt(amount) * 7);
            break;
        }

        options.timeRange = { start, end: now };
      }
    }

    const scripts = await thirdPartyScriptService.getScriptsForSite(siteId, options);

    res.json({
      success: true,
      data: scripts
    });
  } catch (error) {
    logger.error('Failed to get third-party scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve third-party scripts'
    });
  }
});

/**
 * GET /api/third-party-scripts/sites/:siteId/summary
 * Get summary statistics for third-party scripts on a site
 */
router.get('/sites/:siteId/summary', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const summary = await thirdPartyScriptService.getSummaryForSite(siteId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Failed to get third-party scripts summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve third-party scripts summary'
    });
  }
});

export default router;
