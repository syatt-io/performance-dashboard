#!/usr/bin/env tsx
/**
 * Standalone script to collect performance metrics for all sites
 * Run with: npx tsx scripts/collect-all-sites.ts
 */

import 'dotenv/config';
import { prisma } from '../src/services/database';
import { performanceCollector } from '../src/services/lighthouse';

async function collectAllSites() {
  console.log('🚀 Starting performance collection for all sites...');
  console.log('⏰ Start time:', new Date().toISOString());
  console.log('🔑 Using WebPageTest API:', !!process.env.WEBPAGETEST_API_KEY);

  try {
    // Get all active sites
    const sites = await prisma.site.findMany({
      where: { isActive: true }
    });

    console.log(`📊 Found ${sites.length} active sites to process`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { site: string; error: string }[]
    };

    // Process sites sequentially to avoid overwhelming WebPageTest
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 Processing site ${i + 1}/${sites.length}: ${site.name}`);
      console.log(`🌐 URL: ${site.url}`);
      console.log(`${'='.repeat(60)}`);

      try {
        // Collect for both mobile and desktop
        const devices = ['mobile', 'desktop'] as const;

        for (const deviceType of devices) {
          console.log(`\n📱 Testing ${deviceType.toUpperCase()} performance...`);

          try {
            await performanceCollector.collectAndStore(site.id, site.url, { deviceType });
            console.log(`✅ ${deviceType} collection successful`);
            results.successful++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${deviceType} collection failed: ${errorMsg}`);
            results.failed++;
            results.errors.push({
              site: `${site.name} (${deviceType})`,
              error: errorMsg
            });
          }

          // Add delay between tests to avoid rate limiting
          if (!(i === sites.length - 1 && deviceType === 'desktop')) {
            console.log(`⏳ Waiting 10 seconds before next test...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      } catch (error) {
        console.error(`❌ Failed to process site ${site.name}:`, error);
        results.failed += 2; // Count both mobile and desktop as failed
        results.errors.push({
          site: site.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 COLLECTION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successful tests: ${results.successful}`);
    console.log(`❌ Failed tests: ${results.failed}`);
    console.log(`📈 Success rate: ${((results.successful / (results.successful + results.failed)) * 100).toFixed(1)}%`);

    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.site}: ${err.error}`);
      });
    }

    console.log('\n⏰ End time:', new Date().toISOString());
    console.log('✅ Collection complete!');

  } catch (error) {
    console.error('Fatal error during collection:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the collection
collectAllSites().catch(console.error);