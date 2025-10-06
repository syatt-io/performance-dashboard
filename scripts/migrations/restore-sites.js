#!/usr/bin/env node

/**
 * Site Restoration Script
 * Usage: node restore-sites.js
 *
 * This script will restore all sites from sites-backup.json to the database
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/sites';
const BACKUP_FILE = path.join(__dirname, 'sites-backup.json');

async function restoreSites() {
  console.log('🔄 Starting site restoration...\n');

  // Check if backup file exists
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error('❌ Backup file not found:', BACKUP_FILE);
    process.exit(1);
  }

  // Read backup file
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  console.log(`📦 Found ${backup.sites.length} sites to restore\n`);

  let successCount = 0;
  let failureCount = 0;

  // Restore each site
  for (const site of backup.sites) {
    try {
      console.log(`➕ Adding: ${site.name} (${site.url})`);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: site.name,
          url: site.url,
          shopifyDomain: site.shopifyDomain
        })
      });

      if (response.ok) {
        console.log(`   ✅ Success\n`);
        successCount++;
      } else {
        const error = await response.text();
        console.log(`   ⚠️  Failed: ${error}\n`);
        failureCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      failureCount++;
    }
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('\n📊 Restoration Summary:');
  console.log(`   ✅ Successfully restored: ${successCount} sites`);
  if (failureCount > 0) {
    console.log(`   ❌ Failed to restore: ${failureCount} sites`);
  }
  console.log('\n✨ Restoration complete!\n');
}

// Check if server is running
fetch('http://localhost:3000/health')
  .then(() => {
    console.log('✅ Backend server is running\n');
    return restoreSites();
  })
  .catch(() => {
    console.error('❌ Error: Backend server is not running on port 3000');
    console.log('   Please start the backend server first with: npm run dev\n');
    process.exit(1);
  });