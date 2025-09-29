#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

// Read the backup file
const backupPath = path.join(process.cwd(), 'sites-backup.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

async function migrateSites() {
  console.log('🔄 Starting sites migration...');
  console.log(`📂 Found ${backup.sites.length} sites in backup from ${backup.metadata.exported}`);

  const PROD_URL = 'https://performance-dashboard-p7pf5.ondigitalocean.app';

  let successCount = 0;
  let errorCount = 0;

  for (const site of backup.sites) {
    try {
      console.log(`➕ Creating site: ${site.name}`);

      const response = await fetch(`${PROD_URL}/api/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: site.name,
          url: site.url,
          isShopify: site.shopifyDomain ? true : false,
          monitoringEnabled: true,
          checkFrequency: 14400, // 4 hours in seconds (4am EST schedule)
          categoryUrl: site.url + '/collections',
          productUrl: site.url + '/products'
        }),
      });

      if (response.ok) {
        const created = await response.json();
        console.log(`✅ Created: ${site.name} (ID: ${created.id})`);
        successCount++;
      } else {
        const error = await response.text();
        console.error(`❌ Failed to create ${site.name}: ${response.status} ${error}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error creating ${site.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successfully migrated: ${successCount} sites`);
  console.log(`❌ Failed: ${errorCount} sites`);
  console.log(`📈 Total processed: ${successCount + errorCount}/${backup.sites.length} sites`);

  if (successCount > 0) {
    console.log('\n🎉 Sites migration completed! You can now:');
    console.log('1. Visit the dashboard to see your restored sites');
    console.log('2. Trigger performance tests to populate initial data');
    console.log('3. Verify 4am EST scheduled monitoring is working');
  }
}

// Run migration
migrateSites().catch(console.error);