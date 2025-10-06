#!/usr/bin/env node

// Script to restore original sites via production API
const fs = require('fs');
const path = require('path');

async function restoreViaAPI() {
    console.log('🔄 Restoring original sites via production API...');

    try {
        // Read the backup JSON file
        const backupPath = path.join(__dirname, 'sites-backup.json');
        if (!fs.existsSync(backupPath)) {
            console.error('❌ sites-backup.json not found!');
            process.exit(1);
        }

        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const originalSites = backup.sites;

        console.log(`📊 Found ${originalSites.length} original sites to restore`);

        const baseURL = 'https://performance-dashboard-p7pf5.ondigitalocean.app/api';

        // First, get current sites to delete them
        console.log('🔍 Getting current sites...');
        const currentResponse = await fetch(`${baseURL}/sites`);
        const currentData = await currentResponse.json();
        const currentSites = currentData.sites || [];

        console.log(`📋 Found ${currentSites.length} current sites to remove`);

        // Delete all current sites
        console.log('🧹 Clearing current sites...');
        for (const site of currentSites) {
            try {
                const deleteResponse = await fetch(`${baseURL}/sites/${site.id}`, {
                    method: 'DELETE'
                });
                if (deleteResponse.ok) {
                    console.log(`✅ Deleted: ${site.name}`);
                } else {
                    console.log(`⚠️ Failed to delete: ${site.name}`);
                }
            } catch (error) {
                console.log(`⚠️ Error deleting ${site.name}:`, error.message);
            }
        }

        // Add original sites
        console.log('📥 Adding original sites...');
        for (const site of originalSites) {
            try {
                const siteData = {
                    name: site.name,
                    url: site.url,
                    isShopify: site.url.includes('shopify') || site.url.includes('.myshopify.com') || site.shopifyDomain !== null,
                    monitoringEnabled: true,
                    checkFrequency: 360
                };

                const response = await fetch(`${baseURL}/sites`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(siteData)
                });

                if (response.ok) {
                    console.log(`✅ Added: ${site.name} (${site.url})`);
                } else {
                    const errorText = await response.text();
                    console.log(`⚠️ Failed to add ${site.name}:`, errorText);
                }
            } catch (error) {
                console.log(`⚠️ Error adding ${site.name}:`, error.message);
            }
        }

        // Verify the restoration
        console.log('🔍 Verifying restoration...');
        const finalResponse = await fetch(`${baseURL}/sites`);
        const finalData = await finalResponse.json();
        const finalSites = finalData.sites || [];

        console.log(`\n📊 Verification: ${finalSites.length} sites now in production`);

        console.log('\n📋 Restored sites:');
        finalSites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.name} - ${site.url} ${site.isShopify ? '(Shopify)' : ''}`);
        });

        console.log('\n✅ Original site restoration completed successfully!');
        console.log('\n🎯 Your original 12 sites are now restored to production:');
        console.log('   - Sites are configured with monitoring enabled (6-hour frequency)');
        console.log('   - Performance data collection will restart automatically');
        console.log('   - Check your dashboard to verify sites are visible');

    } catch (error) {
        console.error('❌ Site restoration failed:', error);
        process.exit(1);
    }
}

restoreViaAPI();