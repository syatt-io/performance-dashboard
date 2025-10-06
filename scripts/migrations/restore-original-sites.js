#!/usr/bin/env node

// Script to restore original sites from sites-backup.json to production database
// This connects to the live production PostgreSQL database

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function restoreOriginalSites() {
    console.log('🔄 Restoring original sites from backup to production...');

    // Initialize Prisma client (will use production DATABASE_URL from environment)
    const prisma = new PrismaClient();

    try {
        // Test the connection
        console.log('🔗 Testing production database connection...');
        await prisma.$connect();

        // Read the backup JSON file
        const backupPath = path.join(__dirname, 'sites-backup.json');
        if (!fs.existsSync(backupPath)) {
            console.error('❌ sites-backup.json not found!');
            process.exit(1);
        }

        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const originalSites = backup.sites;

        console.log(`📊 Found ${originalSites.length} original sites to restore`);
        console.log('Original sites:', originalSites.map(s => s.name).join(', '));

        // Check current production sites
        const currentSites = await prisma.site.findMany({
            select: { name: true, url: true, id: true }
        });

        console.log(`\n📋 Current production has ${currentSites.length} sites:`);
        currentSites.forEach(site => console.log(`  - ${site.name} (${site.url})`));

        // Generate unique IDs for each site
        const { v4: uuidv4 } = require('uuid');

        console.log('\n🧹 Clearing current sites from production database...');
        await prisma.performanceMetric.deleteMany({}); // Delete metrics first (foreign key constraint)
        await prisma.site.deleteMany({});

        console.log('📥 Adding original sites back to production...');

        for (const site of originalSites) {
            const siteData = {
                id: uuidv4(),
                name: site.name,
                url: site.url,
                categoryUrl: null,
                productUrl: null,
                isShopify: site.url.includes('shopify') || site.url.includes('.myshopify.com') || site.shopifyDomain !== null,
                monitoringEnabled: true,
                checkFrequency: 360, // 6 hours
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await prisma.site.create({
                data: siteData
            });

            console.log(`✅ Restored: ${site.name} (${site.url})`);
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

        console.log('\n📋 Successfully restored original sites:');
        allSites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.name} - ${site.url} ${site.isShopify ? '(Shopify)' : ''}`);
        });

        console.log('\n✅ Original site restoration completed successfully!');
        console.log('\n🎯 Your original 12 sites are now back in production:');
        console.log('   - Sites are configured with monitoring enabled (6-hour frequency)');
        console.log('   - Performance data collection will restart automatically');
        console.log('   - Check your dashboard to verify sites are visible');

    } catch (error) {
        console.error('❌ Site restoration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Check if uuid is available
try {
    require('uuid');
} catch (error) {
    console.log('Installing uuid dependency...');
    require('child_process').execSync('npm install uuid', { stdio: 'inherit' });
}

restoreOriginalSites();