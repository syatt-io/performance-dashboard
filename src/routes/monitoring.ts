import { Router, Request, Response } from 'express';

const router = Router();

// Get queue statistics
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    // const stats = await schedulerService.getQueueStats();
    res.json({ message: "Queue stats disabled" });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({
      error: 'Failed to fetch queue statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent monitoring jobs
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    // const jobs = await schedulerService.getRecentMonitoringJobs(limit);
    res.json({ message: "Monitoring jobs disabled" });
  } catch (error) {
    console.error('Error fetching monitoring jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch monitoring jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger immediate collection for all sites
router.post('/collect/all', async (req: Request, res: Response) => {
  try {
    // const job = await schedulerService.triggerAllSitesCollection();

    res.json({
      success: true,
      message: 'Performance collection disabled (scheduler not available)',
      jobId: 'disabled'
    });
  } catch (error) {
    console.error('Error triggering collection for all sites:', error);
    res.status(500).json({
      error: 'Failed to trigger collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger immediate collection for a specific site
router.post('/collect/site/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    // const job = await schedulerService.triggerSiteCollection(siteId);

    res.json({
      success: true,
      message: `Performance collection disabled for site ${siteId} (scheduler not available)`,
      jobId: 'disabled'
    });
  } catch (error) {
    console.error('Error triggering site collection:', error);
    res.status(500).json({
      error: 'Failed to trigger site collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Setup recurring jobs
router.post('/schedule/setup', async (req: Request, res: Response) => {
  try {
    // await schedulerService.setupRecurringJobs();

    res.json({
      success: true,
      message: 'Recurring monitoring jobs disabled (scheduler not available)'
    });
  } catch (error) {
    console.error('Error setting up recurring jobs:', error);
    res.status(500).json({
      error: 'Failed to setup recurring jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear recurring jobs
router.delete('/schedule/clear', async (req: Request, res: Response) => {
  try {
    // await schedulerService.clearRecurringJobs();

    res.json({
      success: true,
      message: 'Recurring jobs disabled (scheduler not available)'
    });
  } catch (error) {
    console.error('Error clearing recurring jobs:', error);
    res.status(500).json({
      error: 'Failed to clear recurring jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Pause queue
router.post('/queue/pause', async (req: Request, res: Response) => {
  try {
    // await schedulerService.pauseQueue();

    res.json({
      success: true,
      message: 'Queue disabled (scheduler not available)'
    });
  } catch (error) {
    console.error('Error pausing queue:', error);
    res.status(500).json({
      error: 'Failed to pause queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resume queue
router.post('/queue/resume', async (req: Request, res: Response) => {
  try {
    // await schedulerService.resumeQueue();

    res.json({
      success: true,
      message: 'Queue disabled (scheduler not available)'
    });
  } catch (error) {
    console.error('Error resuming queue:', error);
    res.status(500).json({
      error: 'Failed to resume queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup old jobs
router.post('/jobs/cleanup', async (req: Request, res: Response) => {
  try {
    // await schedulerService.cleanupJobs();

    res.json({
      success: true,
      message: 'Jobs cleanup disabled (scheduler not available)'
    });
  } catch (error) {
    console.error('Error cleaning up jobs:', error);
    res.status(500).json({
      error: 'Failed to cleanup jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;