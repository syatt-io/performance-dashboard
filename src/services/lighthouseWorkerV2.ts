import { prisma } from './database';
import { performanceCollector } from './lighthouse';
import { thirdPartyScriptService } from './thirdPartyScripts';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestConfiguration,
  calculateMedianMetrics,
  groupTestRuns
} from '../utils/medianCalculator';
import { discoverProductUrl } from '../utils/productDiscovery';

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
  auditDetails?: any;
}

/**
 * Run a single PageSpeed Insights API test
 */
export async function runSingleTest(
  url: string,
  deviceType: 'mobile' | 'desktop'
): Promise<LighthouseMetrics> {
  console.log(`[Worker] Running PageSpeed Insights API test for ${url} (${deviceType})`);

  const result = await performanceCollector.collectMetricsPageSpeed(url, { deviceType });

  if (!result.success) {
    throw new Error(`PageSpeed Insights API failed: ${result.error}`);
  }

  return {
    performance: result.performance || 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fcp: result.fcp || 0,
    si: result.speedIndex || 0,
    lcp: result.lcp || 0,
    tti: result.fcp ? (result.fcp + 3) : 0,
    tbt: result.tbt || 0,
    cls: result.cls || 0,
    ttfb: (result.ttfb || 0) / 1000,
    pageLoadTime: result.speedIndex || 0,
    pageSize: result.themeAssetSize || 0,
    requests: 0,
    auditDetails: (result as any).auditDetails,
  };
}

/**
 * Run multiple tests for a single URL and return all results
 */
export async function runMultipleTests(
  url: string,
  deviceType: 'mobile' | 'desktop',
  numberOfRuns: number
): Promise<LighthouseMetrics[]> {
  const results: LighthouseMetrics[] = [];

  for (let runNumber = 1; runNumber <= numberOfRuns; runNumber++) {
    console.log(`[Worker] Run ${runNumber}/${numberOfRuns} for ${url} (${deviceType})`);

    try {
      const metrics = await runSingleTest(url, deviceType);
      results.push(metrics);

      // Add a small delay between runs to avoid rate limiting
      if (runNumber < numberOfRuns) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`[Worker] Run ${runNumber} failed:`, error);
      // Continue with other runs even if one fails
    }
  }

  return results;
}

/**
 * Collect metrics for all pages of a site with multiple runs
 */
export async function collectComprehensiveMetrics(
  siteId: string,
  scheduledJobId?: string
): Promise<void> {
  const batchId = uuidv4();
  console.log(`[Worker] Starting comprehensive test batch ${batchId}`);

  try {
    // Update job status to running
    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: 'running', startedAt: new Date() }
      });
    }

    // Get site configuration
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    console.log(`[Worker] Testing site: ${site.name}`);
    const config = getTestConfiguration(site);

    // Auto-discover product URL if not provided
    if (!site.productUrl) {
      console.log(`[Worker] No product URL provided, attempting auto-discovery...`);
      const discoveredProductUrl = await discoverProductUrl(site.url);

      if (discoveredProductUrl) {
        // Update the config with discovered URL
        const productPageIndex = config.pageTypes.findIndex(p => p.type === 'product');
        if (productPageIndex >= 0) {
          config.pageTypes[productPageIndex].url = discoveredProductUrl;
          console.log(`[Worker] Auto-discovered product URL: ${discoveredProductUrl}`);
        }
      } else {
        // Remove product page from config if discovery failed
        console.log(`[Worker] Product URL discovery failed, skipping product page tests`);
        config.pageTypes = config.pageTypes.filter(p => p.type !== 'product');
      }
    }

    // Track all test runs for this batch
    const allTestRuns = [];
    // Keep track of audit details for third-party script processing
    const auditDetailsMap = new Map<string, any>();

    // Test each page type
    for (const pageConfig of config.pageTypes) {
      console.log(`[Worker] Testing ${pageConfig.type} page: ${pageConfig.url}`);

      // Test each device type
      for (const deviceType of config.deviceTypes) {
        console.log(`[Worker] Device: ${deviceType}, Runs: ${config.numberOfRuns}`);

        // Run multiple tests
        const testResults = await runMultipleTests(
          pageConfig.url,
          deviceType,
          config.numberOfRuns
        );

        // Save individual test runs
        for (let i = 0; i < testResults.length; i++) {
          const result = testResults[i];
          const testRun = await prisma.performanceTestRun.create({
            data: {
              siteId,
              pageType: pageConfig.type,
              pageUrl: pageConfig.url,
              deviceType,
              runNumber: i + 1,
              batchId,
              performance: result.performance,
              accessibility: result.accessibility,
              bestPractices: result.bestPractices,
              seo: result.seo,
              fcp: result.fcp,
              si: result.si,
              lcp: result.lcp,
              tbt: result.tbt,
              cls: result.cls,
              tti: result.tti,
              ttfb: result.ttfb,
              pageLoadTime: result.pageLoadTime,
              pageSize: result.pageSize,
              requests: result.requests,
            }
          });
          allTestRuns.push(testRun);

          // Store audit details for the first run of each page/device combination
          const key = `${pageConfig.type}_${deviceType}`;
          if (!auditDetailsMap.has(key) && result.auditDetails) {
            auditDetailsMap.set(key, result.auditDetails);
          }
        }
      }
    }

    // Group test runs and calculate medians
    const groupedRuns = groupTestRuns(allTestRuns);

    // Save median metrics for each page type and device combination
    for (const [key, runs] of Object.entries(groupedRuns)) {
      const [pageType, deviceType] = key.split('_');

      if (runs.length > 0) {
        const medianMetrics = calculateMedianMetrics(runs);

        const medianMetric = await prisma.performanceMetric.create({
          data: {
            siteId,
            deviceType,
            pageType,
            timestamp: new Date(),
            performance: medianMetrics.performance ? Math.round(medianMetrics.performance) : null,
            accessibility: medianMetrics.accessibility ? Math.round(medianMetrics.accessibility) : null,
            bestPractices: medianMetrics.bestPractices ? Math.round(medianMetrics.bestPractices) : null,
            seo: medianMetrics.seo ? Math.round(medianMetrics.seo) : null,
            fcp: medianMetrics.fcp,
            si: medianMetrics.si,
            lcp: medianMetrics.lcp,
            tbt: medianMetrics.tbt,
            cls: medianMetrics.cls,
            tti: medianMetrics.tti,
            ttfb: medianMetrics.ttfb,
            pageLoadTime: medianMetrics.pageLoadTime,
            pageSize: medianMetrics.pageSize ? Math.round(medianMetrics.pageSize) : null,
            requests: medianMetrics.requests ? Math.round(medianMetrics.requests) : null,
          }
        });

        console.log(`[Worker] Saved median metrics for ${site.name} ${pageType} (${deviceType}): Performance ${medianMetrics.performance}`);

        // Process third-party scripts from the stored audit details
        const auditDetailsKey = `${pageType}_${deviceType}`;
        const auditDetails = auditDetailsMap.get(auditDetailsKey);
        if (auditDetails) {
          console.log(`[Worker] Processing third-party scripts for ${site.name} ${pageType} (${deviceType})`);
          try {
            const pageUrl = config.pageTypes.find((p: any) => p.type === pageType)?.url || site.url;
            await thirdPartyScriptService.processAndStoreScripts(
              siteId,
              site.url,
              auditDetails,
              medianMetric.id,
              pageType,
              pageUrl,
              deviceType as 'mobile' | 'desktop'
            );
            console.log(`[Worker] Third-party scripts processed for ${site.name} ${pageType} (${deviceType})`);
          } catch (error) {
            console.error(`[Worker] Failed to process third-party scripts:`, error);
          }
        } else {
          console.log(`[Worker] No audit details available for ${site.name} ${pageType} (${deviceType})`);
        }
      }
    }

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

    console.log(`[Worker] Batch ${batchId} completed successfully`);
  } catch (error) {
    console.error(`[Worker] Batch ${batchId} failed:`, error);

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

/**
 * Backward compatible function for single page/device tests
 */
export async function collectAndSaveMetrics(
  siteId: string,
  deviceType: 'mobile' | 'desktop',
  scheduledJobId?: string
): Promise<void> {
  try {
    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: 'running' }
      });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    console.log(`[Worker] Running PageSpeed Insights test for ${site.name} (${deviceType})...`);
    const metrics = await runSingleTest(site.url, deviceType);

    await prisma.performanceMetric.create({
      data: {
        siteId,
        deviceType,
        pageType: 'homepage',
        timestamp: new Date(),
        ...metrics
      }
    });

    console.log(`[Worker] Saved metrics for ${site.name} (${deviceType}): Performance ${metrics.performance}`);

    if (scheduledJobId) {
      await prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
    }
  } catch (error) {
    console.error('[Worker] Failed to collect metrics:', error);

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