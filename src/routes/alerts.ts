import { Router, Request, Response } from 'express';
import { alertService } from '../services/alertService';

const router = Router();

// Get alerts for a specific site
router.get('/site/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { includeResolved } = req.query;

    const alerts = await alertService.getAlertsForSite(
      siteId,
      includeResolved === 'true'
    );

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all alerts across all sites
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeResolved } = req.query;

    // Get all alerts from database
    const { prisma } = await import('../services/database');
    const alerts = await prisma.alert.findMany({
      where: includeResolved === 'true' ? {} : { isResolved: false },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            url: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching all alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resolve an alert
router.patch('/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    await alertService.resolveAlert(alertId);

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      error: 'Failed to resolve alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get performance budgets for a site
router.get('/budgets/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const { prisma } = await import('../services/database');
    const budgets = await prisma.performanceBudget.findMany({
      where: { siteId },
      orderBy: [
        { metric: 'asc' },
        { deviceType: 'asc' }
      ]
    });

    res.json(budgets);
  } catch (error) {
    console.error('Error fetching performance budgets:', error);
    res.status(500).json({
      error: 'Failed to fetch performance budgets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create or update performance budgets for a site
router.post('/budgets/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const budgets = req.body.budgets;

    if (!Array.isArray(budgets)) {
      return res.status(400).json({
        error: 'Invalid request body. Expected budgets array.'
      });
    }

    const { prisma } = await import('../services/database');

    // Update or create each budget
    for (const budget of budgets) {
      await prisma.performanceBudget.upsert({
        where: {
          siteId_metric_deviceType: {
            siteId,
            metric: budget.metric,
            deviceType: budget.deviceType
          }
        },
        update: {
          warningThreshold: budget.warningThreshold,
          criticalThreshold: budget.criticalThreshold,
          isEnabled: budget.isEnabled,
          alertOnRegression: budget.alertOnRegression
        },
        create: {
          siteId,
          metric: budget.metric,
          deviceType: budget.deviceType,
          warningThreshold: budget.warningThreshold,
          criticalThreshold: budget.criticalThreshold,
          isEnabled: budget.isEnabled,
          alertOnRegression: budget.alertOnRegression
        }
      });
    }

    res.json({
      success: true,
      message: 'Performance budgets updated successfully'
    });
  } catch (error) {
    console.error('Error updating performance budgets:', error);
    res.status(500).json({
      error: 'Failed to update performance budgets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create default budgets for a site
router.post('/budgets/:siteId/defaults', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    await alertService.createDefaultBudgets(siteId);

    res.json({
      success: true,
      message: 'Default performance budgets created successfully'
    });
  } catch (error) {
    console.error('Error creating default budgets:', error);
    res.status(500).json({
      error: 'Failed to create default budgets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger regression analysis for a site
router.post('/regression/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    await alertService.checkForRegressions(siteId);

    res.json({
      success: true,
      message: 'Regression analysis completed'
    });
  } catch (error) {
    console.error('Error running regression analysis:', error);
    res.status(500).json({
      error: 'Failed to run regression analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;