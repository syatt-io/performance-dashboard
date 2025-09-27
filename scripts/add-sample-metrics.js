#!/usr/bin/env node

const API_URL = 'https://performance-dashboard-p7pf5.ondigitalocean.app/api';
const SITE_ID = '8f26bfe2-2aa7-4345-8fd3-0a2e625b5471'; // Example Store

// Sample metrics data for the last 7 days
const sampleMetrics = [
  {
    deviceType: 'mobile',
    performance: 95,
    fcp: 1.2,
    lcp: 2.5,
    cls: 0.05,
    tti: 3.8,
    si: 2.1,
    tbt: 150,
    ttfb: 800,
    pageLoadTime: 4.2,
    pageSize: 1024000,
    requests: 45,
    accessibility: 98,
    bestPractices: 92,
    seo: 100
  },
  {
    deviceType: 'desktop',
    performance: 98,
    fcp: 0.8,
    lcp: 1.8,
    cls: 0.02,
    tti: 2.5,
    si: 1.5,
    tbt: 50,
    ttfb: 600,
    pageLoadTime: 3.1,
    pageSize: 1024000,
    requests: 45,
    accessibility: 98,
    bestPractices: 92,
    seo: 100
  }
];

async function addMetrics() {
  console.log('Adding sample metrics to production database...\n');

  // Generate metrics for the last 7 days
  const days = 7;
  const now = new Date();

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);

    for (const baseMetric of sampleMetrics) {
      // Add some variation to make it realistic
      const variation = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation

      const metric = {
        ...baseMetric,
        timestamp: date.toISOString(),
        performance: Math.round(baseMetric.performance * variation),
        fcp: +(baseMetric.fcp * variation).toFixed(2),
        lcp: +(baseMetric.lcp * variation).toFixed(2),
        cls: +(baseMetric.cls * variation).toFixed(3),
        tti: +(baseMetric.tti * variation).toFixed(2),
        si: +(baseMetric.si * variation).toFixed(2),
        tbt: Math.round(baseMetric.tbt * variation),
        ttfb: Math.round(baseMetric.ttfb * variation),
        pageLoadTime: +(baseMetric.pageLoadTime * variation).toFixed(2),
      };

      console.log(`Adding ${metric.deviceType} metric for ${date.toLocaleDateString()}...`);

      // We'll need to use a different endpoint or method to add historical data
      // For now, this is a placeholder
      console.log('Metric:', metric);
    }
  }

  console.log('\nNote: Direct metric insertion requires database access or an admin API endpoint.');
  console.log('The production app needs an endpoint to accept historical metrics.');
}

addMetrics().catch(console.error);