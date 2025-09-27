import { prisma } from './database';
import { performanceCollector } from './lighthouse';

export interface LighthouseMetrics {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number;
  si: number;
  lcp: number;
  tti: number;
  tbt: number;
  cls: number;
  ttfb: number;
  pageLoadTime: number;
  pageSize: number;
  requests: number;
}

export async function runLighthouseTest(
  url: string,
  deviceType: 'mobile' | 'desktop'
): Promise<LighthouseMetrics> {
  console.log(`[Worker] Running PageSpeed Insights API test for ${url} (${deviceType})`);

  // Use the PageSpeed Insights API from lighthouse.ts
  const result = await performanceCollector.collectMetricsPageSpeed(url, { deviceType });

  if (!result.success) {
    throw new Error(`PageSpeed Insights API failed: ${result.error}`);
  }

  // Convert the result to the expected format
  // Note: Some metrics might not be available from PageSpeed API
  return {
    performance: result.performanceScore || 0,
    accessibility: 0, // PageSpeed API doesn't provide this in performance mode
    bestPractices: 0, // PageSpeed API doesn't provide this in performance mode
    seo: 0, // PageSpeed API doesn't provide this in performance mode
    fcp: result.fcp || 0,
    si: result.speedIndex || 0,
    lcp: result.lcp || 0,
    tti: result.fcp ? (result.fcp + 3) : 0, // Estimate TTI as FCP + 3s if not available
    tbt: result.tbt || 0,
    cls: result.cls || 0,
    ttfb: (result.ttfb || 0) / 1000, // Convert ms to seconds if needed
    pageLoadTime: result.speedIndex || 0, // Use speed index as approximate page load time
    pageSize: result.themeAssetSize || 0,
    requests: 0, // Not available from PageSpeed API
  };
}

export async function collectAndSaveMetrics(
  siteId: string,
  deviceType: 'mobile' | 'desktop',
  scheduledJobId?: string
): Promise<void> {
  try {
    // Update job status to running
    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: 'running' }
      });
    }

    // Get site URL
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    console.log(`[Worker] Running PageSpeed Insights test for ${site.name} (${deviceType})...`);

    // Run PageSpeed Insights API test (NOT local Lighthouse)
    const metrics = await runLighthouseTest(site.url, deviceType);

    // Save metrics to database
    const savedMetric = await prisma.performanceMetric.create({
      data: {
        siteId,
        deviceType,
        timestamp: new Date(),
        ...metrics
      }
    });

    console.log(`[Worker] Saved metrics for ${site.name} (${deviceType}): Performance ${metrics.performance}`);

    // Update job status to completed
    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
    }

    // Update site's last tested timestamp
    await prisma.site.update({
      where: { id: siteId },
      data: { updatedAt: new Date() }
    });

  } catch (error) {
    console.error(`[Worker] Error collecting metrics for site ${siteId}:`, error);

    // Update job status to failed
    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        }
      });
    }

    throw error;
  }
}