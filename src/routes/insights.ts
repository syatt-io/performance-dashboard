import { Router } from 'express';
import type { Request, Response } from 'express';
import { insightsService } from '../services/insights';
import { recommendationsService } from '../services/recommendations';
import { anomalyDetectorService } from '../services/anomalyDetector';
import { validateUuidParam } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/insights
 * Get insights for all sites
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const insights = await insightsService.getAllSitesInsights();
    res.json({ insights, total: insights.length });
  } catch (error) {
    logger.error('Error fetching all sites insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/insights/top-issues
 * Get top issues across all sites
 */
router.get('/top-issues', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const topIssues = await insightsService.getTopIssuesAcrossSites(limit);
    res.json({ issues: topIssues });
  } catch (error) {
    logger.error('Error fetching top issues:', error);
    res.status(500).json({ error: 'Failed to fetch top issues' });
  }
});

/**
 * GET /api/insights/sites/:id
 * Get comprehensive insights for a specific site
 */
router.get('/sites/:id', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const insights = await insightsService.getSiteInsights(id);
    res.json(insights);
  } catch (error: any) {
    logger.error('Error fetching site insights:', error);
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to fetch site insights' });
  }
});

/**
 * GET /api/insights/sites/:id/health-score
 * Get health score for a site
 */
router.get('/sites/:id/health-score', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const healthScore = await insightsService.getHealthScore(id);
    res.json({ siteId: id, healthScore });
  } catch (error) {
    logger.error('Error calculating health score:', error);
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
});

/**
 * POST /api/insights/sites/:id/analyze
 * Run full analysis (anomaly detection + recommendations) for a site
 */
router.post('/sites/:id/analyze', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const insights = await insightsService.runFullAnalysis(id);
    res.json(insights);
  } catch (error) {
    logger.error('Error running analysis:', error);
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

/**
 * GET /api/insights/recommendations/:id
 * Get recommendations for a site
 */
router.get('/recommendations/:id', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recommendations = await recommendationsService.getActiveRecommendations(id);
    res.json({ recommendations, total: recommendations.length });
  } catch (error) {
    logger.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * POST /api/insights/recommendations/:recId/resolve
 * Resolve a recommendation
 */
router.post('/recommendations/:recId/resolve', validateUuidParam('recId'), async (req: Request, res: Response) => {
  try {
    const { recId } = req.params;
    await recommendationsService.resolveRecommendation(recId);
    res.json({ message: 'Recommendation resolved successfully' });
  } catch (error) {
    logger.error('Error resolving recommendation:', error);
    res.status(500).json({ error: 'Failed to resolve recommendation' });
  }
});

/**
 * POST /api/insights/recommendations/:recId/dismiss
 * Dismiss a recommendation
 */
router.post('/recommendations/:recId/dismiss', validateUuidParam('recId'), async (req: Request, res: Response) => {
  try {
    const { recId } = req.params;
    await recommendationsService.dismissRecommendation(recId);
    res.json({ message: 'Recommendation dismissed successfully' });
  } catch (error) {
    logger.error('Error dismissing recommendation:', error);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

/**
 * GET /api/insights/anomalies/:id
 * Get anomalies for a site
 */
router.get('/anomalies/:id', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const anomalies = await anomalyDetectorService.getActiveAnomalies(id);
    res.json({ anomalies, total: anomalies.length });
  } catch (error) {
    logger.error('Error fetching anomalies:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

/**
 * GET /api/insights/anomalies/:id/trend
 * Get anomaly trend for a site
 */
router.get('/anomalies/:id/trend', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const trend = await anomalyDetectorService.getAnomalyTrend(id, days);
    res.json(trend);
  } catch (error) {
    logger.error('Error fetching anomaly trend:', error);
    res.status(500).json({ error: 'Failed to fetch anomaly trend' });
  }
});

/**
 * POST /api/insights/anomalies/:anomalyId/resolve
 * Resolve an anomaly
 */
router.post('/anomalies/:anomalyId/resolve', validateUuidParam('anomalyId'), async (req: Request, res: Response) => {
  try {
    const { anomalyId } = req.params;
    await anomalyDetectorService.resolveAnomaly(anomalyId);
    res.json({ message: 'Anomaly resolved successfully' });
  } catch (error) {
    logger.error('Error resolving anomaly:', error);
    res.status(500).json({ error: 'Failed to resolve anomaly' });
  }
});

/**
 * POST /api/insights/anomalies/:anomalyId/false-positive
 * Mark an anomaly as false positive
 */
router.post('/anomalies/:anomalyId/false-positive', validateUuidParam('anomalyId'), async (req: Request, res: Response) => {
  try {
    const { anomalyId } = req.params;
    await anomalyDetectorService.markAsFalsePositive(anomalyId);
    res.json({ message: 'Anomaly marked as false positive' });
  } catch (error) {
    logger.error('Error marking anomaly as false positive:', error);
    res.status(500).json({ error: 'Failed to mark anomaly as false positive' });
  }
});

export default router;
