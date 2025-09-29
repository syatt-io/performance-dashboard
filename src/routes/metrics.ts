import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../services/database';
import { performanceCollector } from '../services/lighthouse';
import { scheduleAllSites, addPerformanceJob, cleanStuckJobs } from '../services/queue';
import { triggerManualRun } from '../scheduler';

const router = Router();

router.get('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { timeRange = '24h', deviceType, limit = 100, startDate, endDate } = req.query;

    // Calculate time filter - support both timeRange and custom date range
    let timeFilter: Date;

    if (startDate && endDate) {
      // Custom date range
      timeFilter = new Date(startDate as string);
      var endTimeFilter = new Date(endDate as string);
    } else {
      // Predefined time range - use start of day for daily periods to be more inclusive
      timeFilter = new Date();
      switch (timeRange) {
        case '1h':
          timeFilter.setHours(timeFilter.getHours() - 1);
          break;
        case '24h':
          timeFilter.setDate(timeFilter.getDate() - 1);
          timeFilter.setHours(0, 0, 0, 0); // Start of yesterday
          break;
        case '7d':
          timeFilter.setDate(timeFilter.getDate() - 7);
          timeFilter.setHours(0, 0, 0, 0); // Start of 7 days ago
          break;
        case '30d':
          timeFilter.setDate(timeFilter.getDate() - 30);
          timeFilter.setHours(0, 0, 0, 0); // Start of 30 days ago
          break;
        case '90d':
          timeFilter.setDate(timeFilter.getDate() - 90);
          timeFilter.setHours(0, 0, 0, 0); // Start of 90 days ago
          break;
        default:
          timeFilter.setDate(timeFilter.getDate() - 1);
          timeFilter.setHours(0, 0, 0, 0); // Start of yesterday
      }
    }

    const whereClause: any = {
      siteId,
      timestamp: startDate && endDate ?
        { gte: timeFilter, lte: endTimeFilter } :
        { gte: timeFilter },
      ...(deviceType && { deviceType: deviceType as string })
    };

    const metrics = await prisma.performanceMetric.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        timestamp: true,
        deviceType: true,
        lcp: true,
        cls: true,
        tbt: true,
        fcp: true,
        ttfb: true,
        si: true, // Speed Index
        tti: true,
        performance: true,
        accessibility: true,
        bestPractices: true,
        seo: true,
        pageLoadTime: true,
        pageSize: true,
        requests: true,
        testLocation: true
      }
    });

    res.json({
      siteId,
      timeRange: startDate && endDate ? 'custom' : timeRange,
      dateRange: startDate && endDate ? { startDate, endDate } : null,
      deviceType,
      metrics,
      total: metrics.length
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.post('/sites/:siteId/collect', async (req: Request, res: Response) => {
  try {
    console.log(`📡 Collection endpoint called for site: ${req.params.siteId}`);
    const { siteId } = req.params;
    const { deviceType = 'mobile' } = req.body || {};

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.monitoringEnabled) {
      return res.status(400).json({ error: 'Site monitoring is disabled' });
    }

    // Check for existing running jobs
    const existingJob = await prisma.scheduledJob.findFirst({
      where: {
        siteId,
        status: 'running'
      }
    });

    if (existingJob) {
      return res.status(409).json({
        error: 'Collection already in progress',
        jobId: existingJob.id,
        status: existingJob.status,
        startedAt: existingJob.startedAt || existingJob.scheduledFor
      });
    }

    // Create monitoring jobs for collection
    const jobs = [];
    const deviceTypes = deviceType && ['mobile', 'desktop'].includes(deviceType)
      ? [deviceType]
      : ['mobile', 'desktop'];

    for (const device of deviceTypes) {
      const job = await prisma.scheduledJob.create({
        data: {
          siteId,
          jobType: 'lighthouse',
          status: 'pending',
          scheduledFor: new Date()
        }
      });
      jobs.push({ job, device });
    }

    const jobId = `collection-${Date.now()}`;

    // Run collection in background
    setImmediate(async () => {
      for (const { job, device } of jobs) {
        try {
          console.log(`🚀 Starting background collection for site ${siteId} - ${site.name} (${device})`);

          // Update job status to running
          await prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: 'running',
              startedAt: new Date()
            }
          });

          await performanceCollector.collectAndStore(siteId, site.url, { deviceType: device });

          // Update job status to completed
          await prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          });

          console.log(`✅ Background collection completed for site ${siteId} (${device})`);
        } catch (error) {
          console.error(`❌ Background collection failed for ${siteId} (${device}):`, error);

          // Update job status to failed
          await prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }
    });

    res.json({
      message: `Performance collection started for site ${site.name}`,
      jobId,
      siteId,
      url: site.url,
      jobs: jobs.map(j => ({ id: j.id, status: j.status }))
    });
  } catch (error) {
    console.error('Error starting collection:', error);
    res.status(500).json({ error: 'Failed to start metrics collection' });
  }
});

router.get('/sites/:siteId/summary', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { period = '24h' } = req.query;

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Calculate time filter - use start of day for daily periods to be more inclusive
    const timeFilter = new Date();
    switch (period) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setDate(timeFilter.getDate() - 1);
        timeFilter.setHours(0, 0, 0, 0); // Start of yesterday
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        timeFilter.setHours(0, 0, 0, 0); // Start of 7 days ago
        break;
      default:
        timeFilter.setDate(timeFilter.getDate() - 1);
        timeFilter.setHours(0, 0, 0, 0); // Start of yesterday
    }

    // Get latest metrics for each device type within time period
    let latestMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: { gte: timeFilter }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    // If no recent metrics found, get the most recent metrics regardless of time
    // This ensures the overview always shows the latest data available
    if (latestMetrics.length === 0) {
      latestMetrics = await prisma.performanceMetric.findMany({
        where: { siteId },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
    }

    // Calculate summary
    const mobileMetrics = latestMetrics.filter(m => m.deviceType === 'mobile');
    const desktopMetrics = latestMetrics.filter(m => m.deviceType === 'desktop');

    const calculateStatus = (value: number | null, thresholds: { good: number; poor: number }) => {
      if (!value) return 'unknown';
      if (value <= thresholds.good) return 'good';
      if (value <= thresholds.poor) return 'needs-improvement';
      return 'poor';
    };

    const latestMobile = mobileMetrics[0];
    const latestDesktop = desktopMetrics[0];

    // Alerts not implemented yet - returning empty counts
    const alerts = {
      critical: 0,
      warning: 0,
      info: 0
    };

    const summary = {
      siteId,
      siteName: site.name,
      period,
      lastUpdated: latestMetrics[0]?.timestamp || null,
      coreWebVitals: {
        lcp: {
          value: latestMobile?.lcp || null,
          status: calculateStatus(latestMobile?.lcp || null, { good: 2.5, poor: 4.0 }),
          trend: 'stable' // TODO: Calculate actual trend
        },
        fid: {
          value: null, // FID not tracked - using INP instead
          status: 'unknown',
          trend: 'stable'
        },
        cls: {
          value: latestMobile?.cls || null,
          status: calculateStatus(latestMobile?.cls || null, { good: 0.1, poor: 0.25 }),
          trend: 'stable'
        },
        tbt: {
          value: latestMobile?.tbt || null,
          status: calculateStatus(latestMobile?.tbt || null, { good: 200, poor: 600 }),
          trend: 'stable'
        },
        fcp: {
          value: latestMobile?.fcp || null,
          status: calculateStatus(latestMobile?.fcp || null, { good: 1.8, poor: 3.0 }),
          trend: 'stable'
        },
        speedIndex: {
          value: latestMobile?.si || null, // Using si field for Speed Index
          status: calculateStatus(latestMobile?.si || null, { good: 3.4, poor: 5.8 }),
          trend: 'stable'
        }
      },
      performanceScore: {
        mobile: latestMobile?.performance || null,
        desktop: latestDesktop?.performance || null
      },
      alerts,
      metricsCount: latestMetrics.length
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

// New endpoint for aggregated trend data
router.get('/sites/:siteId/trends', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { timeRange = '30d', aggregation = 'daily' } = req.query;

    // Calculate time filter
    const timeFilter = new Date();
    switch (timeRange) {
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      case '90d':
        timeFilter.setDate(timeFilter.getDate() - 90);
        break;
      default:
        timeFilter.setDate(timeFilter.getDate() - 30);
    }

    // Build aggregation query based on timeRange and aggregation
    let dateFormat: string;
    switch (aggregation) {
      case 'hourly':
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'daily':
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        dateFormat = '%Y-%u'; // Year-week
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    // For now, let's use the standard Prisma approach instead of raw SQL
    // Get all metrics for the time period and aggregate in JavaScript
    const allMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: { gte: timeFilter }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group by time period and device type
    const groups: Record<string, any> = {};

    allMetrics.forEach(metric => {
      const date = new Date(metric.timestamp);
      let period: string;

      switch (aggregation) {
        case 'hourly':
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00:00`;
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().split('T')[0];
          break;
        default: // daily
          period = date.toISOString().split('T')[0];
      }

      const key = `${period}-${metric.deviceType}`;

      if (!groups[key]) {
        groups[key] = {
          period,
          deviceType: metric.deviceType,
          metrics: []
        };
      }

      groups[key].metrics.push(metric);
    });

    // Calculate averages
    const aggregatedData = Object.values(groups).map((group: any) => {
      const metrics = group.metrics;
      const count = metrics.length;

      return {
        period: group.period,
        deviceType: group.deviceType,
        avg_lcp: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.lcp || 0), 0) / count : null,
        avg_cls: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.cls || 0), 0) / count : null,
        avg_fid: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.fid || 0), 0) / count : null,
        avg_tbt: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.tbt || 0), 0) / count : null,
        avg_performance_score: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.performance || 0), 0) / count : null,
        avg_fcp: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.fcp || 0), 0) / count : null,
        avg_ttfb: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.ttfb || 0), 0) / count : null,
        avg_speed_index: count > 0 ? metrics.reduce((sum: number, m: any) => sum + (m.speedIndex || 0), 0) / count : null,
        data_points: count
      };
    });

    // Transform data for chart consumption
    const chartData = (aggregatedData as any[]).map(row => ({
      timestamp: row.period,
      deviceType: row.deviceType,
      avgLcp: row.avg_lcp ? parseFloat(row.avg_lcp) : null,
      avgCls: row.avg_cls ? parseFloat(row.avg_cls) : null,
      avgFid: row.avg_fid ? parseFloat(row.avg_fid) : null,
      avgTbt: row.avg_tbt ? parseFloat(row.avg_tbt) : null,
      avgPerformanceScore: row.avg_performance_score ? parseFloat(row.avg_performance_score) : null,
      avgFcp: row.avg_fcp ? parseFloat(row.avg_fcp) : null,
      avgTtfb: row.avg_ttfb ? parseFloat(row.avg_ttfb) : null,
      avgSpeedIndex: row.avg_speed_index ? parseFloat(row.avg_speed_index) : null,
      dataPoints: parseInt(row.data_points)
    }));

    res.json({
      siteId,
      timeRange,
      aggregation,
      trends: chartData,
      total: chartData.length
    });
  } catch (error) {
    console.error('Error fetching trend data:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// New endpoint for metric comparison across multiple sites
router.get('/comparison', async (req: Request, res: Response) => {
  try {
    const { siteIds, timeRange = '24h', metric = 'performanceScore' } = req.query;
  const metricStr = String(metric);
  const timeRangeStr = String(timeRange);

    if (!siteIds) {
      return res.status(400).json({ error: 'siteIds parameter is required' });
    }

    const siteIdArray = (siteIds as string).split(',');

    // Calculate time filter
    const timeFilter = new Date();
    switch (timeRangeStr) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setDate(timeFilter.getDate() - 1);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      default:
        timeFilter.setDate(timeFilter.getDate() - 1);
    }

    // Get metrics for all sites
    const metrics = await prisma.performanceMetric.findMany({
      where: {
        siteId: { in: siteIdArray },
        timestamp: { gte: timeFilter },
        [metricStr]: { not: null }
      },
      include: {
        site: {
          select: {
            name: true,
            url: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Group by site and calculate statistics
    const comparison = siteIdArray.map(siteId => {
      const siteMetrics = metrics.filter(m => m.siteId === siteId);
      const mobileMetrics = siteMetrics.filter(m => m.deviceType === 'mobile');
      const desktopMetrics = siteMetrics.filter(m => m.deviceType === 'desktop');

      const calculateStats = (data: any[], metricKey: string) => {
        const values = data.map(d => d[metricKey]).filter(v => v !== null && v !== undefined);
        if (values.length === 0) return { avg: null, min: null, max: null, latest: null };

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const latest = data[0]?.[metricKey] || null;

        return { avg, min, max, latest };
      };

      return {
        siteId,
        siteName: siteMetrics[0]?.site?.name || 'Unknown',
        siteUrl: siteMetrics[0]?.site?.url || '',
        mobile: calculateStats(mobileMetrics, metricStr),
        desktop: calculateStats(desktopMetrics, metricStr),
        totalDataPoints: siteMetrics.length,
        lastUpdated: siteMetrics[0]?.timestamp || null
      };
    });

    res.json({
      metric: metricStr,
      timeRange: timeRangeStr,
      comparison,
      siteCount: siteIdArray.length
    });
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});


// Test endpoint for local Lighthouse
router.post('/test-lighthouse-local', async (req: Request, res: Response) => {
  try {
    const { url = 'https://www.example.com', deviceType = 'mobile' } = req.body;

    console.log(`🧪 Testing local Lighthouse collection for ${url} (${deviceType})`);

    // Call the local Lighthouse directly
    const result = await performanceCollector.collectMetricsLocally(url, { deviceType });

    // Return the result with all debugging information
    res.json({
      success: result.success,
      url,
      deviceType,
      timestamp: new Date().toISOString(),
      metrics: {
        lcp: result.lcp,
        fid: result.fid,
        cls: result.cls,
        inp: result.inp,
        fcp: result.fcp,
        ttfb: result.ttfb,
        speedIndex: result.speedIndex,
        performanceScore: result.performance
      },
      error: result.error,
      lighthouseData: result
    });

  } catch (error) {
    console.error('Error testing local Lighthouse:', error);
    res.status(500).json({
      error: 'Failed to test local Lighthouse',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current job status for all sites
router.get('/job-status', async (req: Request, res: Response) => {
  try {
    console.log('📊 Fetching job status for all sites...');

    // Get all sites with their current running/pending jobs
    const sites = await prisma.site.findMany({
      where: { monitoringEnabled: true },
      include: {
        scheduledJobs: {
          where: {
            status: { in: ['pending', 'running'] }
          },
          orderBy: { scheduledFor: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const jobStatuses = sites.map(site => {
      const jobs = site.scheduledJobs;

      // Determine overall site testing status
      let status = 'idle';
      let progress = 0;
      let activeJobs: any[] = [];

      if (jobs.length > 0) {
        const runningJobs = jobs.filter(j => j.status === 'running');
        const pendingJobs = jobs.filter(j => j.status === 'pending');

        if (runningJobs.length > 0) {
          status = 'testing';
          // Estimate progress based on typical test duration
          const oldestRunning = runningJobs.sort((a, b) =>
            new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime()
          )[0];

          if (oldestRunning.startedAt) {
            const elapsedMs = Date.now() - new Date(oldestRunning.startedAt).getTime();
            // Assume tests take ~60 seconds on average
            progress = Math.min(Math.floor((elapsedMs / 60000) * 100), 90);
          }
        } else if (pendingJobs.length > 0) {
          status = 'pending';
          progress = 0;
        }

        activeJobs = jobs.map(job => ({
          id: job.id,
          jobType: job.jobType,
          status: job.status,
          scheduledFor: job.scheduledFor,
          startedAt: job.startedAt
        }));
      }

      return {
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        status, // 'idle', 'pending', 'testing'
        progress, // 0-100
        activeJobs,
        jobCount: jobs.length
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      sites: jobStatuses,
      totalSites: sites.length,
      activeSites: jobStatuses.filter(s => s.status !== 'idle').length
    });

  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// Clean up stuck monitoring jobs
router.post('/cleanup-stuck-jobs', async (req: Request, res: Response) => {
  try {
    console.log('🧹 Starting cleanup of stuck monitoring jobs...');

    // Jobs are considered stuck if they've been running for more than 10 minutes
    // or pending for more than 30 minutes
    const stuckTimeThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const pendingTimeThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    // Find stuck running jobs
    const stuckRunningJobs = await prisma.scheduledJob.findMany({
      where: {
        status: 'running',
        startedAt: {
          lte: stuckTimeThreshold
        }
      },
      include: {
        site: { select: { name: true } }
      }
    });

    // Find stuck pending jobs
    const stuckPendingJobs = await prisma.scheduledJob.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: pendingTimeThreshold
        }
      },
      include: {
        site: { select: { name: true } }
      }
    });

    const allStuckJobs = [...stuckRunningJobs, ...stuckPendingJobs];

    if (allStuckJobs.length === 0) {
      return res.json({
        message: 'No stuck jobs found',
        cleanedJobs: 0
      });
    }

    console.log(`Found ${allStuckJobs.length} stuck jobs to clean up:`);
    allStuckJobs.forEach(job => {
      console.log(`- Job ${job.id} for ${job.site.name}: ${job.status} since ${job.startedAt || job.scheduledFor}`);
    });

    // Mark all stuck jobs as failed
    const cleanupResult = await prisma.scheduledJob.updateMany({
      where: {
        id: { in: allStuckJobs.map(job => job.id) }
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: 'Job stuck - cleaned up by system'
      }
    });

    console.log(`✅ Successfully cleaned up ${cleanupResult.count} stuck jobs`);

    res.json({
      message: `Successfully cleaned up ${cleanupResult.count} stuck monitoring jobs`,
      cleanedJobs: cleanupResult.count,
      jobDetails: allStuckJobs.map(job => ({
        id: job.id,
        siteId: job.siteId,
        siteName: job.site.name,
        jobType: job.jobType,
        originalStatus: job.status,
        stuckSince: job.startedAt || job.scheduledFor
      }))
    });

  } catch (error) {
    console.error('Error cleaning up stuck jobs:', error);
    res.status(500).json({ error: 'Failed to cleanup stuck jobs' });
  }
});

// Collect metrics for all sites using queue system
router.post('/collect-all', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Starting batch collection for all sites using queue...');

    // Trigger manual run which will use the queue system
    const result = await triggerManualRun();

    if (result.success) {
      console.log(`✅ Successfully queued ${result.jobsScheduled} jobs`);
      return res.json({
        success: true,
        message: `Queued ${result.jobsScheduled} performance tests for processing`,
        details: {
          jobsScheduled: result.jobsScheduled,
          cleanedJobs: result.cleanedJobs,
          timestamp: result.timestamp
        }
      });
    } else {
      console.error('❌ Failed to queue jobs:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to queue performance tests',
        timestamp: result.timestamp
      });
    }
  } catch (error) {
    console.error('Error in collect-all:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start batch collection'
    });
  }
});

export default router;