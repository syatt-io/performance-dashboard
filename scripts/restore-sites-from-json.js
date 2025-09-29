#!/usr/bin/env node

// Simple script to restore sites from sites-backup.json to production database
// Usage: node scripts/restore-sites-from-json.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

async function restoreSitesFromJson() {
    try {
        console.log('🔄 Starting site restoration from sites-backup.json...');

        // Read the backup JSON file
        const backupPath = path.join(__dirname, '..', 'sites-backup.json');

        if (!fs.existsSync(backupPath)) {
            console.error('❌ sites-backup.json not found!');
            process.exit(1);
        }

        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const sites = backup.sites;

        console.log(`📊 Found ${sites.length} sites to restore`);

        // Generate unique IDs for each site
        const { v4: uuidv4 } = require('uuid');

        console.log('🧹 Clearing existing sites...');
        await prisma.site.deleteMany({});

        console.log('📥 Adding sites to production database...');

        for (const site of sites) {
            const siteData = {
                id: uuidv4(),
                name: site.name,
                url: site.url,
                categoryUrl: null,
                productUrl: null,
                isShopify: site.url.includes('shopify') || site.shopifyDomain !== null,
                monitoringEnabled: true,
                checkFrequency: 360, // 6 hours
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await prisma.site.create({
                data: siteData
            });

            console.log(`✅ Added: ${site.name} (${site.url})`);
        }

        // Verify the restoration
        const finalCount = await prisma.site.count();
        console.log(`\n🔍 Verification: ${finalCount} sites now in production database`);

        // List all restored sites
        const allSites = await prisma.site.findMany({
            select: {
                name: true,
                url: true,
                isShopify: true,
                monitoringEnabled: true
            }
        });

        console.log('\n📋 Restored sites:');
        allSites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.name} - ${site.url} ${site.isShopify ? '(Shopify)' : ''}`);
        });

        console.log('\n✅ Site restoration completed successfully!');
        console.log('\n🎯 Next steps:');
        console.log('1. Check your dashboard to verify sites are visible');
        console.log('2. Sites are configured with monitoring enabled (6-hour frequency)');
        console.log('3. Performance data collection will start automatically');

    } catch (error) {
        console.error('❌ Site restoration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Check if uuid is available, if not install it
try {
    require('uuid');
} catch (error) {
    console.log('Installing uuid dependency...');
    require('child_process').execSync('npm install uuid', { stdio: 'inherit' });
}

restoreSitesFromJson();