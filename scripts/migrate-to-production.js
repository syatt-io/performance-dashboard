#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const PROD_API = 'https://performance-dashboard-p7pf5.ondigitalocean.app/api';
const SECRET_KEY = 'temp-migration-key-2024';
const SQLITE_DB = path.join(__dirname, '../prisma/dev.db');

// Open SQLite database
const db = new sqlite3.Database(SQLITE_DB, sqlite3.OPEN_READONLY);

async function fetchData(query) {
  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function sendToProduction(endpoint, data) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(`${PROD_API}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-migration-key': SECRET_KEY
    },
    body: JSON.stringify(data)
  });

  return response.json();
}

async function migrate() {
  console.log('Starting migration from SQLite to Production...\n');

  try {
    // 1. Fetch all sites
    console.log('Fetching sites from SQLite...');
    const sites = await fetchData(`
      SELECT id, name, url, isActive, shopifyDomain,
             createdAt, updatedAt
      FROM sites
      WHERE isActive = 1
    `);
    console.log(`Found ${sites.length} active sites\n`);

    // 2. Create sites in production
    for (const site of sites) {
      console.log(`Creating site: ${site.name}...`);

      const siteData = {
        name: site.name,
        url: site.url,
        monitoringEnabled: site.isActive === 1,
        checkFrequency: 360  // Default value since old schema doesn't have this
      };

      try {
        const response = await sendToProduction('/sites', siteData);

        if (response.error && response.error.includes('already exists')) {
          console.log(`  Site already exists, skipping...`);
        } else if (response.id) {
          console.log(`  ✓ Created with ID: ${response.id}`);

          // Map old ID to new ID for metrics migration
          site.newId = response.id;
        } else {
          console.log(`  ✗ Failed:`, response.error || 'Unknown error');
        }
      } catch (err) {
        console.log(`  ✗ Error:`, err.message);
      }
    }

    // 3. Fetch and migrate metrics for each site
    console.log('\nMigrating metrics...');

    for (const site of sites) {
      // Skip if site wasn't created (already exists or failed)
      if (!site.newId && site.name !== 'Example Store') {
        console.log(`Skipping metrics for ${site.name} (no new ID)`);
        continue;
      }

      const targetId = site.newId || site.id; // Use new ID or original if site exists

      console.log(`\nFetching metrics for ${site.name}...`);
      const metrics = await fetchData(`
        SELECT
          timestamp, deviceType,
          performanceScore as performance,
          fcp, speedIndex as si, lcp, cls, ttfb, inp,
          themeAssetSize, liquidRenderTime,
          cartResponseTime, checkoutStepTime
        FROM performance_metrics
        WHERE siteId = '${site.id}'
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      console.log(`  Found ${metrics.length} metrics`);

      if (metrics.length > 0) {
        // Prepare metrics for batch insert
        const metricsData = metrics.map(m => ({
          timestamp: m.timestamp,
          deviceType: m.deviceType || 'mobile',
          performance: m.performance,
          fcp: m.fcp,
          si: m.si,
          lcp: m.lcp,
          cls: m.cls,
          ttfb: m.ttfb,
          // Map other fields where available
          pageSize: m.themeAssetSize || null,
          // These fields don't exist in old schema, set to null
          accessibility: null,
          bestPractices: null,
          seo: null,
          tbt: null,
          tti: null,
          pageLoadTime: null,
          requests: null
        }));

        console.log(`  Sending ${metricsData.length} metrics to production...`);

        try {
          const response = await sendToProduction('/admin/add-sample-metrics', {
            siteId: targetId,
            metrics: metricsData
          });

          if (response.success) {
            console.log(`  ✓ ${response.message}`);
          } else {
            console.log(`  ✗ Failed:`, response.error || 'Unknown error');
          }
        } catch (err) {
          console.log(`  ✗ Error:`, err.message);
        }
      }
    }

    console.log('\n✅ Migration complete!');
    console.log('Visit https://performance-dashboard-p7pf5.ondigitalocean.app to see your data');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    db.close();
  }
}

// Run migration
migrate();