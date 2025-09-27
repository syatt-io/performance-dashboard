#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const PROD_API = 'https://performance-dashboard-p7pf5.ondigitalocean.app/api';
const SECRET_KEY = 'temp-migration-key-2024';
const SQLITE_DB = path.join(__dirname, '../prisma/dev.db');

// Mapping from old SQLite IDs to new production IDs
const SITE_ID_MAPPING = {
  '25bfa367-90c9-4d1a-bf7a-005ecb77677f': 'b56f9b5b-c73b-444f-b90a-3a45dfc3350f', // Worksite Safety
  '5aa5e7ec-2ce4-474f-a10e-18baa945f0e2': 'a783e4ee-1642-4899-a3fd-9c63476b0119', // Tomlinson's
  '8ce7a5c5-b0a9-404e-98e7-b9e47f253b4e': '89bd1584-5aa4-4447-82dc-6d1301e8cb49', // Iris Windows
  '4c945250-8b97-4e57-aabf-da849dc83878': 'f638c98d-13d0-4005-8bc3-f0fdf262feda', // ECS Coffee
  'baf5f23c-c015-4105-a5a3-dd63aebb68de': 'a4537970-357b-44dd-9f6f-d7a2c6c6be2b', // BrightBean
  '96295c23-f37f-4376-86d8-2a68d02f4016': 'b26f13bc-a8c2-4504-a582-76d4aa07f9ab', // Beauchamp
  '2998bf65-eec8-4fb7-8eec-159077c7feee': '2356e807-a2f9-425e-949b-c8d97310c6b0', // Envy & Grace
  '39d8acf3-7485-4b1f-be40-959707a6c786': 'ef0c57d1-93c1-4a20-a6f0-9d3708d16ed7', // Pseudio
  '093e9a71-aa5e-455f-8ad2-065616173a51': 'ec54b414-400a-43c4-a43c-3dd5805d77bf', // Turkstra
  'c956ca83-d9b1-4aa5-8870-cb2457b28ff6': 'd59873c0-03e4-4084-b4c2-78bc949c9e31', // Bigelow
  'fbafd606-5cc5-4e3a-bd8a-b5525649ab29': '8dfa583a-7d10-45a2-8ece-27aa95d5772b', // University Co-op
  'd12e447b-6c8a-47ef-91b1-ed05153063bd': 'd466474d-cbde-4854-9d56-0192d96fae91'  // Snuggle Bugz
};

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

async function migrateMetrics() {
  console.log('Starting metrics migration from SQLite to Production...\n');

  try {
    let totalMetrics = 0;
    let successfulMetrics = 0;

    for (const [oldId, newId] of Object.entries(SITE_ID_MAPPING)) {
      // Get site name
      const sites = await fetchData(`SELECT name FROM sites WHERE id = '${oldId}'`);
      const siteName = sites[0]?.name || 'Unknown Site';

      console.log(`\nProcessing ${siteName}...`);

      // Fetch metrics from SQLite
      const metrics = await fetchData(`
        SELECT
          timestamp, deviceType,
          performanceScore as performance,
          fcp, speedIndex as si, lcp, cls, ttfb
        FROM performance_metrics
        WHERE siteId = '${oldId}'
        ORDER BY timestamp DESC
      `);

      console.log(`  Found ${metrics.length} metrics`);
      totalMetrics += metrics.length;

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
          ttfb: m.ttfb
        }));

        // Send in batches of 20 to avoid timeout
        const batchSize = 20;
        for (let i = 0; i < metricsData.length; i += batchSize) {
          const batch = metricsData.slice(i, i + batchSize);

          try {
            const response = await sendToProduction('/admin/add-sample-metrics', {
              siteId: newId,
              metrics: batch
            });

            if (response.success) {
              const added = response.results?.filter(r => r.success).length || 0;
              successfulMetrics += added;
              console.log(`  ✓ Batch ${Math.floor(i/batchSize) + 1}: Added ${added} metrics`);
            } else {
              console.log(`  ✗ Batch ${Math.floor(i/batchSize) + 1} failed:`, response.error);
            }
          } catch (err) {
            console.log(`  ✗ Batch ${Math.floor(i/batchSize) + 1} error:`, err.message);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migration complete!`);
    console.log(`   Total metrics found: ${totalMetrics}`);
    console.log(`   Successfully migrated: ${successfulMetrics}`);
    console.log('\nVisit https://performance-dashboard-p7pf5.ondigitalocean.app to see your data');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    db.close();
  }
}

// Run migration
migrateMetrics();