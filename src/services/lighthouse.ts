import { logger } from '../utils/logger';
import { prisma } from './database';
import { shopifyMetricsCollector } from './shopifyMetrics';
import { GoogleAuth } from 'google-auth-library';

export interface LighthouseConfig {
  deviceType: 'mobile' | 'desktop';
  location?: string;
  throttling?: boolean;
}

export interface LighthouseResult {
  lcp?: number;
  fid?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
  speedIndex?: number;
  tbt?: number;
  performance?: number;
  imageOptimizationScore?: number;
  themeAssetSize?: number;
  thirdPartyBlockingTime?: number;
  // WebPageTest-specific fields
  loadTime?: number;
  fullyLoadedTime?: number;
  bytesIn?: number;
  requests?: number;
  visualProgress?: Record<string, unknown>;
  lighthouseData?: import('../types').LighthouseData;
  error?: string;
  success: boolean;
  // Additional fields for tracking test metadata
  testProvider?: string;
  testId?: string;
  fallbackReason?: string;
}

export class PerformanceCollector {
  // Track which sites have had Shopify collection in this session to avoid duplication
  private shopifyCollectedThisSession = new Set<string>();

  private async getGoogleAccessToken(): Promise<string | null> {
    try {
      // Check if service account is provided via base64 environment variable
      if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
        logger.info('🔐 Using Google Service Account from environment variable');

        const fs = require('fs');
        const path = require('path');
        const serviceAccountPath = '/tmp/service-account.json';

        // Decode and write service account to temp file
        const serviceAccountJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
        fs.writeFileSync(serviceAccountPath, serviceAccountJson);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

        logger.info('✅ Service account decoded and saved to temp file');
      }

      // Check if service account credentials are available
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        logger.info('📝 No service account credentials found, checking for API key...');
        return null;
      }

      logger.info('🔐 Attempting Google Service Account authentication (direct method)');
      logger.info(`📁 Service account file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        logger.error('❌ Service account file does not exist:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        return null;
      }

      // Try direct service account authentication without OAuth scopes
      // PageSpeed Insights API may work better with default service account auth
      logger.info('🔄 Attempting direct service account authentication...');

      const auth = new GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        // PageSpeed API doesn't require OAuth scopes for service accounts
      });

      logger.info('🔄 Getting auth client...');
      const client = await auth.getClient();

      logger.info('🔄 Getting access token...');
      const accessTokenResponse = await client.getAccessToken();

      // Get project info from the auth client
      const projectId = await auth.getProjectId();
      logger.info('🔍 Service account project info:', {
        projectId: projectId,
        hasToken: !!accessTokenResponse.token,
        tokenLength: accessTokenResponse.token?.length || 0,
        hasRes: !!accessTokenResponse.res
      });

      // Also read the service account file to see what project it contains
      try {
        const serviceAccountData = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        logger.info('📋 Service account file project_id:', serviceAccountData.project_id);
        logger.info('📋 Service account client_email:', serviceAccountData.client_email);
      } catch (error) {
        const err = error as Error;
        logger.warn('⚠️ Could not read service account file for debugging:', err.message);
      }

      if (accessTokenResponse.token) {
        logger.info('✅ Successfully obtained service account access token (direct method)');
        logger.info(`🔑 Token length: ${accessTokenResponse.token.length} characters`);
        logger.info(`🔑 Token prefix: ${accessTokenResponse.token.substring(0, 20)}...`);
        return accessTokenResponse.token;
      } else {
        logger.error('❌ Failed to obtain access token from service account - no token in response');
        return null;
      }
    } catch (error) {
      const err = error as any;
      logger.error('❌ Service account authentication failed with detailed error:');
      logger.error('📝 Error name:', err.name);
      logger.error('📝 Error message:', err.message);
      if (err.code) {
        logger.error('📝 Error code:', err.code);
      }
      logger.info('📝 Falling back to API key or free tier...');
      return null;
    }
  }

  async collectMetrics(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    const hasApiKey = !!process.env.PAGESPEED_API_KEY;
    const hasServiceAccount = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    logger.info('Using PageSpeed Insights API', {
      hasApiKey,
      hasServiceAccount,
      deviceType: config.deviceType
    });

    // Use PageSpeed Insights with service account authentication (25k requests/day limit)
    const result = await this.collectMetricsPageSpeed(url, config);

    // If PageSpeed fails, we fail completely
    if (!result.success) {
      throw new Error(`PageSpeed Insights failed: ${result.error} - 25k daily limit should be sufficient`);
    }

    return result;
  }

  async collectMetricsPageSpeed(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    logger.info(`📊 Starting PageSpeed Insights collection for ${url} (${config.deviceType})`);
    logger.info(`🔑 Using PageSpeed Insights API (not simulated data)`);

    try {
      // Use PageSpeed Insights API instead of local Lighthouse
      const strategy = config.deviceType === 'mobile' ? 'mobile' : 'desktop';

      // Build PageSpeed Insights API URL
      const baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
      const params = new URLSearchParams({
        url: url,
        strategy: strategy,
        category: 'performance'
      });

      // Initialize headers for potential authentication
      let headers: HeadersInit = {};

      // PageSpeed API works best with API keys, not Bearer tokens
      // The API key should be from the syatt-io project for 25k requests/day quota
      const apiKey = process.env.PAGESPEED_API_KEY;

      if (!apiKey) {
        throw new Error('PAGESPEED_API_KEY environment variable is required');
      }

      logger.info('🔑 Using API Key authentication from syatt-io project');
      logger.info('📊 Quota: 25,000 requests/day with API key');
      logger.info(`🎯 API key prefix: ${apiKey.substring(0, 15)}...`);
      params.append('key', apiKey);

      const apiUrl = `${baseUrl}?${params.toString()}`;

      logger.info('⚡ Calling PageSpeed Insights API...');
      logger.info(`📍 API URL: ${baseUrl}`);
      logger.info(`📍 Full API URL: ${apiUrl}`);
      logger.info(`📍 Request headers:`, headers);
      logger.info(`📍 URL parameters:`, Object.fromEntries(params));

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PageSpeed API failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Debug: Log raw API response structure
      logger.info('🔍 Raw PageSpeed API response for debugging:');
      logger.info('- Response status:', response.status);
      logger.info('- Has loadingExperience:', !!data.loadingExperience);
      logger.info('- Has originLoadingExperience:', !!data.originLoadingExperience);
      logger.info('- Has lighthouseResult:', !!data.lighthouseResult);
      logger.info('- Performance score (raw):', data.lighthouseResult?.categories?.performance?.score);
      logger.info('- Field data availability:', {
        LARGEST_CONTENTFUL_PAINT_MS: !!data.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS,
        FIRST_CONTENTFUL_PAINT_MS: !!data.loadingExperience?.metrics?.FIRST_CONTENTFUL_PAINT_MS,
        CUMULATIVE_LAYOUT_SHIFT_SCORE: !!data.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE,
        INTERACTION_TO_NEXT_PAINT: !!data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT
      });
      logger.info('- Lab audits availability:', {
        'largest-contentful-paint': !!data.lighthouseResult?.audits?.['largest-contentful-paint'],
        'cumulative-layout-shift': !!data.lighthouseResult?.audits?.['cumulative-layout-shift'],
        'first-contentful-paint': !!data.lighthouseResult?.audits?.['first-contentful-paint'],
        'speed-index': !!data.lighthouseResult?.audits?.['speed-index']
      });
      if (data.loadingExperience?.metrics) {
        logger.info('- Field LCP (ms):', data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile);
        logger.info('- Field CLS (0-100):', data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile);
      }
      if (data.lighthouseResult?.audits) {
        logger.info('- Lab LCP (ms):', data.lighthouseResult.audits['largest-contentful-paint']?.numericValue);
        logger.info('- Lab CLS (0-1):', data.lighthouseResult.audits['cumulative-layout-shift']?.numericValue);
      }

      if (!data.lighthouseResult) {
        throw new Error('No Lighthouse result in PageSpeed response');
      }

      const { lighthouseResult } = data;
      const audits = lighthouseResult.audits;

      // Extract Core Web Vitals and performance metrics
      // Prefer field data (real users) over lab data when available
      const fieldData = data.loadingExperience?.metrics;
      const originFieldData = data.originLoadingExperience?.metrics;

      // LCP - prefer field data, fallback to lab data (convert ms to seconds)
      const lcp = fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
        ? fieldData.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
        : (audits['largest-contentful-paint']?.numericValue ? audits['largest-contentful-paint'].numericValue / 1000 : undefined);

      // INP (replaced FID in 2024) - only available in field data
      const inp = fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile || undefined;

      // Legacy FID for compatibility - use max-potential-fid from lab as fallback
      const fid = inp || (audits['max-potential-fid']?.numericValue || undefined);

      // CLS - prefer field data, fallback to lab data
      const cls = fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined
        ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100  // Field data is 0-100 scale, convert to 0-1
        : (audits['cumulative-layout-shift']?.numericValue || undefined);

      // FCP - prefer field data, fallback to lab data (convert ms to seconds)
      const fcp = fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile
        ? fieldData.FIRST_CONTENTFUL_PAINT_MS.percentile / 1000
        : (audits['first-contentful-paint']?.numericValue ? audits['first-contentful-paint'].numericValue / 1000 : undefined);

      // TTFB - prefer field data, fallback to server response time
      const ttfb = fieldData?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile
        || (audits['server-response-time']?.numericValue || undefined);

      // Speed Index - only available in lab data (convert ms to seconds)
      const speedIndex = audits['speed-index']?.numericValue ? audits['speed-index'].numericValue / 1000 : undefined;

      // Total Blocking Time - only available in lab data
      const tbt = audits['total-blocking-time']?.numericValue || undefined;

      const performance = lighthouseResult.categories?.performance?.score ? Math.round(lighthouseResult.categories.performance.score * 100) : undefined;

      // Extract Shopify-specific image optimization metrics
      const imageOptimization = {
        unoptimizedImages: audits['uses-optimized-images']?.details?.items?.length || 0,
        unoptimizedImageBytes: audits['uses-optimized-images']?.details?.overallSavingsBytes || 0,
        nextGenFormatScore: Math.round((audits['uses-webp-images']?.score || 0) * 100),
        nextGenFormatSavings: audits['uses-webp-images']?.details?.overallSavingsBytes || 0,
        appropriatelySizedScore: Math.round((audits['uses-responsive-images']?.score || 0) * 100),
        appropriatelySizedSavings: audits['uses-responsive-images']?.details?.overallSavingsBytes || 0,
        lazyLoadingScore: Math.round((audits['offscreen-images']?.score || 0) * 100),
        lazyLoadingSavings: audits['offscreen-images']?.details?.overallSavingsBytes || 0
      };

      // Calculate overall image optimization score (0-100)
      const imageOptimizationScore = Math.round(
        (imageOptimization.nextGenFormatScore +
         imageOptimization.appropriatelySizedScore +
         imageOptimization.lazyLoadingScore) / 3
      );

      // Extract theme asset analysis
      const themeAssets = {
        totalByteWeight: audits['total-byte-weight']?.numericValue || 0,
        unusedCssBytes: audits['unused-css-rules']?.details?.totalBytes || 0,
        unusedJsBytes: audits['unused-javascript']?.details?.totalBytes || 0,
        renderBlockingResources: audits['render-blocking-resources']?.details?.items?.length || 0,
        renderBlockingBytes: audits['render-blocking-resources']?.details?.totalBytes || 0,
        largestBundleSize: Math.max(
          audits['unused-css-rules']?.details?.totalBytes || 0,
          audits['unused-javascript']?.details?.totalBytes || 0
        )
      };

      // Extract third-party impact
      const thirdPartyImpact = {
        blockingTime: audits['third-party-summary']?.numericValue || 0,
        transferSize: audits['third-party-summary']?.details?.items?.reduce((sum: number, item: Record<string, unknown>) =>
          sum + (typeof item.transferSize === 'number' ? item.transferSize : 0), 0) || 0,
        requestCount: audits['third-party-summary']?.details?.items?.length || 0
      };

      // Log data sources for debugging
      const hasFieldData = !!fieldData;
      const dataSource = hasFieldData ? 'field+lab' : 'lab-only';
      const dataSourceDetails = {
        lcp: fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ? 'field' : 'lab',
        cls: fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined ? 'field' : 'lab',
        fcp: fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile ? 'field' : 'lab'
      };
      logger.info(`✅ PageSpeed Insights metrics (${dataSource}) - LCP: ${lcp?.toFixed(2)}s (${dataSourceDetails.lcp}), CLS: ${cls?.toFixed(3)} (${dataSourceDetails.cls}), Performance: ${performance}/100`);
      logger.info(`🖼️ Image optimization score: ${imageOptimizationScore}/100 (${imageOptimization.unoptimizedImages} unoptimized images)`);
      logger.info(`📦 Theme assets: ${Math.round(themeAssets.totalByteWeight / 1024)}KB total, ${themeAssets.renderBlockingResources} blocking resources`);
      logger.info(`📊 Raw field data - LCP: ${fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile}ms, CLS: ${fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile}, FCP: ${fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile}ms`);

      return {
        success: true,
        lcp,
        fid,
        cls,
        inp,
        fcp,
        ttfb,
        speedIndex,
        tbt,
        performance,
        // New Shopify-specific metrics
        imageOptimizationScore,
        themeAssetSize: themeAssets.totalByteWeight,
        thirdPartyBlockingTime: thirdPartyImpact.blockingTime,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          testProvider: 'pagespeed',
          imageOptimization,
          themeAssets,
          thirdPartyImpact,
          note: 'Real PageSpeed Insights data with Shopify-specific metrics (raw report removed to save space)'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`❌ PageSpeed Insights collection failed for ${url}:`, error);

      return {
        success: false,
        error: `Performance analysis failed: ${errorMessage}. Please check that the URL is accessible and try again.`,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          note: 'Failed collection attempt'
        }
      };
    }
  }

  async collectAndStore(siteId: string, url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<string> {
    try {
      logger.info(`🔍 [${config.deviceType.toUpperCase()}] Starting performance collection for ${url}`);

      // Use collectMetrics which now uses PageSpeed Insights with Service Account (25k requests/day)
      logger.info(`📡 [${config.deviceType.toUpperCase()}] Using PageSpeed Insights API with Service Account...`);
      const metrics = await this.collectMetrics(url, config);

      // Check if collection was successful
      if (!metrics.success) {
        logger.error(`❌ [${config.deviceType.toUpperCase()}] Failed to collect metrics for ${url}:`, metrics.error);
        throw new Error(`Performance analysis failed: ${metrics.error}`);
      }

      logger.info(`💾 [${config.deviceType.toUpperCase()}] Storing metrics to database...`);

      // Only store if we have real data
      const performanceMetric = await prisma.performanceMetric.create({
        data: {
          siteId,
          deviceType: config.deviceType,
          lcp: metrics.lcp,
          cls: metrics.cls,
          inp: metrics.inp,
          fcp: metrics.fcp,
          ttfb: metrics.ttfb,
          si: metrics.speedIndex, // Map speedIndex to si field
          tbt: metrics.tbt,
          performance: metrics.performance,
          // Map some fields to available schema fields
          pageLoadTime: metrics.loadTime,
          pageSize: metrics.bytesIn,
          requests: metrics.requests,
          testLocation: config.location,
          // Shopify-specific metrics
          imageOptimizationScore: metrics.imageOptimizationScore,
          themeAssetSize: metrics.themeAssetSize,
          thirdPartyBlockingTime: metrics.thirdPartyBlockingTime
          // Note: visualProgress, testProvider, testId, lighthouseData are not in schema
        }
      });

      logger.info(`✅ [${config.deviceType.toUpperCase()}] Successfully stored metrics for ${url} - DB ID: ${performanceMetric.id}`);
      logger.info(`📊 [${config.deviceType.toUpperCase()}] Metrics: LCP=${metrics.lcp?.toFixed(2)}s, CLS=${metrics.cls?.toFixed(3)}, Performance=${metrics.performance}/100`);

      // Log data source for debugging
      const testProvider = metrics?.testProvider || 'unknown';
      const dataSource = testProvider === 'webpagetest' ? 'WebPageTest API' :
                        testProvider === 'pagespeed' ? 'PageSpeed Insights API' :
                        metrics?.fallbackReason ? 'Local Lighthouse (fallback)' : 'Unknown';
      logger.info(`🔍 [${config.deviceType.toUpperCase()}] Data source: ${dataSource}`);

      // Log additional WebPageTest metrics if available
      if (testProvider === 'webpagetest') {
        logger.info(`📊 [${config.deviceType.toUpperCase()}] WebPageTest extras: Load=${metrics.loadTime?.toFixed(2)}s, Fully Loaded=${metrics.fullyLoadedTime?.toFixed(2)}s, Requests=${metrics.requests}`);
        if (metrics?.testId) {
          logger.info(`🔗 [${config.deviceType.toUpperCase()}] Test URL: https://www.webpagetest.org/result/${metrics.testId}`);
        }
      }

      // Alert service disabled for now - tables don't exist
      // logger.info(`🚨 [${config.deviceType.toUpperCase()}] Processing through alert service...`);
      // await alertService.processMetric(siteId, { ... });
      // logger.info(`✅ [${config.deviceType.toUpperCase()}] Alert processing complete for ${url}`);

      // Check if this is a Shopify store and collect additional metrics (only once per site per session)
      logger.info(`🔍 [${config.deviceType.toUpperCase()}] Calling checkAndCollectShopifyMetrics for site ${siteId}`);
      await this.checkAndCollectShopifyMetrics(siteId);

      return performanceMetric.id;

    } catch (error) {
      const err = error as Error;
      logger.error(`❌ [${config.deviceType.toUpperCase()}] collectAndStore failed for ${url}:`, error);
      logger.error(`📝 [${config.deviceType.toUpperCase()}] Error type: ${err.constructor.name}`);
      logger.error(`📝 [${config.deviceType.toUpperCase()}] Error message: ${err.message}`);
      throw error;
    }
  }

  async collectForSite(siteId: string): Promise<void> {
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site || !site.monitoringEnabled) {
      throw new Error(`Site ${siteId} not found or monitoring disabled`);
    }

    logger.info(`\n🎯 ================================================`);
    logger.info(`🎯 Starting collection for site: ${site.name}`);
    logger.info(`🌐 URL: ${site.url}`);
    logger.info(`🆔 Site ID: ${siteId}`);
    logger.info(`⏰ Start time: ${new Date().toISOString()}`);
    logger.info(`🎯 ================================================`);

    // Ensure default performance budgets exist for this site
    // TODO: Implement alertService
    // try {
    //   await alertService.createDefaultBudgets(siteId);
    // } catch (error) {
    //   logger.warn(`⚠️ Could not create default budgets for site ${siteId}:`, error);
    // }

    // Collect metrics for mobile and desktop separately to see which fails
    const results = [];

    logger.info(`📱 Starting MOBILE collection for ${site.name}...`);
    try {
      const mobileResult = await this.collectAndStore(siteId, site.url, { deviceType: 'mobile' });
      logger.info(`✅ MOBILE collection succeeded for ${site.name} - Metric ID: ${mobileResult}`);
      results.push({ device: 'mobile', success: true, id: mobileResult });
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ MOBILE collection failed for ${site.name}:`, error);
      results.push({ device: 'mobile', success: false, error: err.message });
    }

    logger.info(`🖥️ Starting DESKTOP collection for ${site.name}...`);
    try {
      const desktopResult = await this.collectAndStore(siteId, site.url, { deviceType: 'desktop' });
      logger.info(`✅ DESKTOP collection succeeded for ${site.name} - Metric ID: ${desktopResult}`);
      results.push({ device: 'desktop', success: true, id: desktopResult });
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ DESKTOP collection failed for ${site.name}:`, error);
      results.push({ device: 'desktop', success: false, error: err.message });
    }

    // Log summary for this site
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info(`\n📊 ================================================`);
    logger.info(`📊 Collection summary for ${site.name}:`);
    logger.info(`✅ Successful collections: ${successCount}/2`);
    logger.info(`❌ Failed collections: ${failureCount}/2`);
    if (failureCount > 0) {
      logger.info(`📝 Failures:`, results.filter(r => !r.success).map(r => `${r.device}: ${r.error}`));
    }
    logger.info(`⏰ End time: ${new Date().toISOString()}`);
    logger.info(`📊 ================================================\n`);

    // Check if this is a Shopify store and collect additional metrics
    await this.checkAndCollectShopifyMetrics(siteId);

    // Check for performance regressions after collecting new data
    // TODO: Implement alertService
    // try {
    //   await alertService.checkForRegressions(siteId);
    // } catch (error) {
    //   logger.warn(`⚠️ Could not check for regressions for site ${siteId}:`, error);
    // }
  }

  /**
   * Check if a site is a Shopify store and collect additional eCommerce metrics
   * Only runs once per site per collection session to avoid duplication
   */
  private async checkAndCollectShopifyMetrics(siteId: string): Promise<void> {
    // Skip if already collected for this site in this session
    if (this.shopifyCollectedThisSession.has(siteId)) {
      logger.info(`🛍️ Shopify metrics already collected for site ${siteId} in this session, skipping`);
      return;
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      logger.warn(`⚠️ Site ${siteId} not found for Shopify detection`);
      return;
    }

    let isShopifyStore = false;

    // First check database configuration
    if (site) {
      // Check if it's already marked as Shopify in the database
      if (site.isShopify !== undefined) {
        isShopifyStore = site.isShopify;
      } else {
        // Check if URL contains shopify indicators
        isShopifyStore = site.url.includes('myshopify.com') ||
                        site.url.includes('.shopify.com');
      }
    }

    // If not detected yet, check if the site is actually a Shopify store by checking headers
    if (!isShopifyStore) {
      try {
        logger.info(`🔍 Checking if ${site.url} is a Shopify store...`);
        const checkResponse = await fetch(site.url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PerformanceDashboard/1.0)'
          }
        });

        // Check for Shopify-specific headers
        const poweredBy = checkResponse.headers.get('powered-by');
        const shopId = checkResponse.headers.get('x-shopid');
        const shopifyHeader = checkResponse.headers.get('x-shopify-stage');

        if (poweredBy?.toLowerCase().includes('shopify') || shopId || shopifyHeader) {
          isShopifyStore = true;
          logger.info(`✅ Detected Shopify store via headers (x-shopid: ${shopId})`);
        }
      } catch (error) {
        const err = error as Error;
        logger.info(`⚠️ Could not check Shopify headers for ${site.url}:`, err.message);
      }
    }

    if (isShopifyStore) {
      logger.info(`🛍️ Detected Shopify store - collecting additional eCommerce metrics`);
      try {
        // Mark as collected for this session
        this.shopifyCollectedThisSession.add(siteId);
        await shopifyMetricsCollector.collectShopifyPageMetrics(siteId);
      } catch (error) {
        logger.warn(`⚠️ Could not collect Shopify metrics for site ${siteId}:`, error);
        // Remove from collected set on failure so it can be retried
        this.shopifyCollectedThisSession.delete(siteId);
      }
    }
  }

  async collectForAllSites(): Promise<void> {
    const sites = await prisma.site.findMany({
      where: { monitoringEnabled: true }
    });

    logger.info(`🔄 Starting performance collection for ${sites.length} active sites`);

    // Clear the Shopify collection tracking for new batch
    this.shopifyCollectedThisSession.clear();

    // Process sites sequentially with delay to prevent system freeze
    for (const site of sites) {
      try {
        logger.info(`📊 Processing site ${site.name} (${site.url})`);
        await this.collectForSite(site.id);

        // Add delay between sites to prevent overwhelming the system
        logger.info(`⏱️ Waiting 5 seconds before next site...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Failed to collect metrics for site ${site.name}:`, error);
      }
    }

    logger.info(`✅ Performance collection completed for all sites`);
  }
}

export const performanceCollector = new PerformanceCollector();