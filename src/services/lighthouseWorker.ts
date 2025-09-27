import puppeteer from 'puppeteer';
import { prisma } from './database';

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
  // Dynamic import to handle ESM module
  const lighthouse = (await import('lighthouse')).default;

  // Try to use system chromium if available, otherwise use downloaded Chrome
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
    '/usr/bin/chromium-browser' ||
    '/usr/bin/chromium' ||
    '/usr/bin/google-chrome';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions'
    ],
    executablePath: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD ? executablePath : undefined
  });

  try {
    // Get a port from the browser
    const wsEndpoint = browser.wsEndpoint();
    const port = new URL(wsEndpoint).port;

    // Configure Lighthouse options
    const options = {
      port: Number(port),
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      throttling: {
        cpuSlowdownMultiplier: deviceType === 'mobile' ? 4 : 1,
      },
      formFactor: deviceType as 'mobile' | 'desktop',
      screenEmulation: deviceType === 'mobile'
        ? { mobile: true, width: 375, height: 667, deviceScaleFactor: 2 }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
    };

    // Run Lighthouse
    const runnerResult = await lighthouse(url, options);

    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('Lighthouse failed to generate results');
    }

    const lhr = runnerResult.lhr;

    // Extract metrics
    const metrics: LighthouseMetrics = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),

      // Core Web Vitals and other metrics (convert to seconds)
      fcp: (lhr.audits['first-contentful-paint']?.numericValue || 0) / 1000,
      si: (lhr.audits['speed-index']?.numericValue || 0) / 1000,
      lcp: (lhr.audits['largest-contentful-paint']?.numericValue || 0) / 1000,
      tti: (lhr.audits['interactive']?.numericValue || 0) / 1000,
      tbt: lhr.audits['total-blocking-time']?.numericValue || 0, // Keep in ms
      cls: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
      ttfb: lhr.audits['server-response-time']?.numericValue || 0, // Keep in ms

      // Additional metrics
      pageLoadTime: (lhr.audits['speed-index']?.numericValue || 0) / 1000, // Approximate
      pageSize: lhr.audits['total-byte-weight']?.numericValue || 0,
      requests: lhr.audits['network-requests']?.details?.items?.length || 0,
    };

    return metrics;
  } finally {
    await browser.close();
  }
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

    console.log(`Running Lighthouse test for ${site.name} (${deviceType})...`);

    // Run Lighthouse test
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

    console.log(`Saved metrics for ${site.name} (${deviceType}): Performance ${metrics.performance}`);

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
      data: { lastChecked: new Date() }
    });

  } catch (error) {
    console.error(`Error collecting metrics for site ${siteId}:`, error);

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