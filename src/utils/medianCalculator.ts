import { PerformanceTestRun } from '../generated/prisma';

/**
 * Calculate median from an array of numbers, filtering out null/undefined
 */
export function calculateMedian(values: (number | null | undefined)[]): number | null {
  const validValues = values.filter((v): v is number => v !== null && v !== undefined);

  if (validValues.length === 0) return null;
  if (validValues.length === 1) return validValues[0];

  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate median metrics from multiple test runs
 */
export function calculateMedianMetrics(runs: PerformanceTestRun[]) {
  if (runs.length === 0) {
    throw new Error('No test runs provided for median calculation');
  }

  return {
    performance: calculateMedian(runs.map(r => r.performance)),
    accessibility: calculateMedian(runs.map(r => r.accessibility)),
    bestPractices: calculateMedian(runs.map(r => r.bestPractices)),
    seo: calculateMedian(runs.map(r => r.seo)),
    fcp: calculateMedian(runs.map(r => r.fcp)),
    si: calculateMedian(runs.map(r => r.si)),
    lcp: calculateMedian(runs.map(r => r.lcp)),
    tbt: calculateMedian(runs.map(r => r.tbt)),
    cls: calculateMedian(runs.map(r => r.cls)),
    tti: calculateMedian(runs.map(r => r.tti)),
    ttfb: calculateMedian(runs.map(r => r.ttfb)),
    pageLoadTime: calculateMedian(runs.map(r => r.pageLoadTime)),
    pageSize: calculateMedian(runs.map(r => r.pageSize)),
    requests: calculateMedian(runs.map(r => r.requests)),
  };
}

/**
 * Group test runs by page type and device type for median calculation
 */
export function groupTestRuns(runs: PerformanceTestRun[]) {
  const grouped: Record<string, PerformanceTestRun[]> = {};

  runs.forEach(run => {
    const key = `${run.pageType}_${run.deviceType}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(run);
  });

  return grouped;
}

export interface TestConfiguration {
  pageTypes: Array<{
    type: 'homepage' | 'category' | 'product';
    url: string;
  }>;
  deviceTypes: Array<'mobile' | 'desktop'>;
  numberOfRuns: number;
}

/**
 * Get test configuration for a site
 */
export function getTestConfiguration(site: {
  url: string;
  categoryUrl?: string | null;
  productUrl?: string | null;
  isShopify?: boolean;
}): TestConfiguration {
  const pageTypes: TestConfiguration['pageTypes'] = [
    { type: 'homepage', url: site.url }
  ];

  // Always add category page - use /collections/all as default for Shopify sites
  const categoryUrl = site.categoryUrl || `${site.url.replace(/\/$/, '')}/collections/all`;
  pageTypes.push({ type: 'category', url: categoryUrl });

  // Always add product page - will be auto-discovered if not provided
  // The productUrl will be discovered in the worker if null
  const productUrl = site.productUrl || null;
  pageTypes.push({ type: 'product', url: productUrl || site.url }); // Temporary placeholder

  return {
    pageTypes,
    deviceTypes: ['mobile', 'desktop'],
    numberOfRuns: 3 // Run each test 3 times
  };
}