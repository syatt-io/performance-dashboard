import { prisma } from './database';
import { performanceCollector } from './lighthouse';
import { decryptCredentials } from '../utils/encryption';

export interface ShopifyPageMetrics {
  url: string;
  pageType: 'collection' | 'product' | 'cart' | 'checkout' | 'home';
  loadTime?: number;
  timeToInteractive?: number;
  firstProductVisible?: number;
  totalProducts?: number;
  performance?: any;
}

export class ShopifyMetricsCollector {

  /**
   * Extract Shopify domain from URL
   */
  private getShopifyDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Check for myshopify.com domain or custom domain
      if (urlObj.hostname.includes('myshopify.com')) {
        return urlObj.hostname.split('.myshopify.com')[0];
      }
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Detect Shopify page type from URL patterns
   */
  private detectPageType(url: string): string {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('/collections/') || urlLower.includes('/collection/')) {
      return 'collection';
    }
    if (urlLower.includes('/products/') || urlLower.includes('/product/')) {
      return 'product';
    }
    if (urlLower.includes('/cart')) {
      return 'cart';
    }
    if (urlLower.includes('/checkout') || urlLower.includes('/checkouts/')) {
      return 'checkout';
    }
    if (urlLower.endsWith('/') || urlLower.includes('/home')) {
      return 'home';
    }

    return 'other';
  }

  /**
   * Collect metrics for a collection/category page
   */
  async collectCollectionMetrics(
    siteId: string,
    collectionUrl: string,
    collectionName?: string
  ): Promise<ShopifyPageMetrics> {
    console.log(`🛍️ Collecting metrics for collection: ${collectionName || collectionUrl}`);

    try {
      // Use WebPageTest API ONLY (no fallbacks) to get performance metrics
      console.log(`🛍️🛍️🛍️ SHOPIFY METRICS CALLING collectMetrics for ${collectionUrl} 🛍️🛍️🛍️`);
      const metrics = await performanceCollector.collectMetrics(collectionUrl, {
        deviceType: 'mobile'
      });

      if (!metrics.success) {
        throw new Error(metrics.error || 'Failed to collect metrics');
      }

      // Store Shopify-specific metrics
      const shopifyMetrics = await prisma.performanceMetric.create({
        data: {
          siteId,
          deviceType: 'mobile',
          lcp: metrics.lcp,
          fcp: metrics.fcp,
          cls: metrics.cls,
          ttfb: metrics.ttfb,
          // speedIndex: metrics.speedIndex,
          performance: metrics.performance,
//           lighthouseData: {
//             ...metrics.lighthouseData,
//             shopifyPage: {
//               type: 'collection',
//               name: collectionName,
//               url: collectionUrl,
//               timestamp: new Date().toISOString()
//             }
        }
      });

      // Also collect desktop metrics
      console.log(`🛍️🛍️🛍️ SHOPIFY METRICS CALLING collectMetrics for ${collectionUrl} (DESKTOP) 🛍️🛍️🛍️`);
      const desktopMetrics = await performanceCollector.collectMetrics(collectionUrl, {
        deviceType: 'desktop'
      });

      if (desktopMetrics.success) {
        await prisma.performanceMetric.create({
          data: {
            siteId,
            deviceType: 'desktop',
            lcp: desktopMetrics.lcp,
            fcp: desktopMetrics.fcp,
            cls: desktopMetrics.cls,
            ttfb: desktopMetrics.ttfb,
            // speedIndex: desktopMetrics.speedIndex,
            performance: desktopMetrics.performance
//             lighthouseData: {
//               ...desktopMetrics.lighthouseData,
//               shopifyPage: {
//                 type: 'collection',
//                 name: collectionName,
//                 url: collectionUrl,
//                 timestamp: new Date().toISOString()
//               }
//             }
          }
        });
      }

      console.log(`✅ Collection metrics collected - LCP: ${metrics.lcp?.toFixed(2)}s, Score: ${metrics.performance}/100`);

      return {
        url: collectionUrl,
        pageType: 'collection',
        loadTime: metrics.lcp,
        timeToInteractive: metrics.fcp,
        firstProductVisible: metrics.fcp, // Approximation
        performance: metrics
      };

    } catch (error) {
      console.error(`❌ Failed to collect collection metrics:`, error);
      throw error;
    }
  }

  /**
   * Collect metrics for a product detail page
   */
  async collectProductMetrics(
    siteId: string,
    productUrl: string,
    productName?: string
  ): Promise<ShopifyPageMetrics> {
    console.log(`🛍️ Collecting metrics for product: ${productName || productUrl}`);

    try {
      // Collect mobile metrics using WebPageTest API ONLY
      console.log(`🛒🛒🛒 SHOPIFY METRICS CALLING collectMetrics for PRODUCT ${productUrl} (MOBILE) 🛒🛒🛒`);
      const metrics = await performanceCollector.collectMetrics(productUrl, {
        deviceType: 'mobile'
      });

      if (!metrics.success) {
        throw new Error(metrics.error || 'Failed to collect metrics');
      }

      // Store with Shopify context
      await prisma.performanceMetric.create({
        data: {
          siteId,
          deviceType: 'mobile',
          lcp: metrics.lcp,
          fcp: metrics.fcp,
          cls: metrics.cls,
          // fid: metrics.fid,
          ttfb: metrics.ttfb,
          // speedIndex: metrics.speedIndex,
          performance: metrics.performance,
//           lighthouseData: {
//             ...metrics.lighthouseData,
//             shopifyPage: {
//               type: 'product',
//               name: productName,
//               url: productUrl,
//               timestamp: new Date().toISOString()
//             }
        }
      });

      // Also collect desktop metrics using WebPageTest API ONLY
      console.log(`🛒🛒🛒 SHOPIFY METRICS CALLING collectMetrics for PRODUCT ${productUrl} (DESKTOP) 🛒🛒🛒`);
      const desktopMetrics = await performanceCollector.collectMetrics(productUrl, {
        deviceType: 'desktop'
      });

      if (desktopMetrics.success) {
        await prisma.performanceMetric.create({
          data: {
            siteId,
            deviceType: 'desktop',
            lcp: desktopMetrics.lcp,
            fcp: desktopMetrics.fcp,
            cls: desktopMetrics.cls,
            // fid: desktopMetrics.fid,
            ttfb: desktopMetrics.ttfb,
            // speedIndex: desktopMetrics.speedIndex,
            performance: desktopMetrics.performance,
//             lighthouseData: {
//               ...desktopMetrics.lighthouseData,
//               shopifyPage: {
//                 type: 'product',
//                 name: productName,
//                 url: productUrl,
//                 timestamp: new Date().toISOString()
//               }
//             }
          }
        });
      }

      console.log(`✅ Product metrics collected - LCP: ${metrics.lcp?.toFixed(2)}s, Score: ${metrics.performance}/100`);

      return {
        url: productUrl,
        pageType: 'product',
        loadTime: metrics.lcp,
        timeToInteractive: metrics.fcp,
        performance: metrics
      };

    } catch (error) {
      console.error(`❌ Failed to collect product metrics:`, error);
      throw error;
    }
  }

  /**
   * Collect metrics for all critical Shopify pages
   */
  async collectShopifyPageMetrics(siteId: string): Promise<void> {
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    console.log(`🛍️ Starting Shopify page metrics collection for ${site.name}`);

    // Site doesn't have shopifyDomain field in current schema
    const shopifyDomain = this.getShopifyDomain(site.url);

    if (!shopifyDomain) {
      console.warn(`⚠️ Not a Shopify store or domain not detected for ${site.url}`);
      return;
    }

    // Define critical pages to monitor
    const baseUrl = site.url.endsWith('/') ? site.url.slice(0, -1) : site.url;
    const criticalPages = [
      {
        url: site.url,
        type: 'home',
        name: 'Homepage'
      },
      {
        url: `${baseUrl}/collections/all`,
        type: 'collection',
        name: 'All Products'
      },
      // Add more specific collections/products as needed
    ];

    // Commented out - apiKey field doesn't exist in current schema
    // if (site.apiKey) {
    //   // Decrypt credentials before use
    //   const { apiKey } = decryptCredentials({ apiKey: site.apiKey });
    //
    //   // apiKey field could store JSON with specific URLs to monitor
    //   try {
    //     const config = JSON.parse(apiKey || '');
    //     if (config.collections) {
    //       config.collections.forEach((collection: any) => {
    //         criticalPages.push({
    //           url: collection.url,
    //           type: 'collection',
    //           name: collection.name
    //         });
    //       });
    //     }
    //     if (config.products) {
    //       config.products.forEach((product: any) => {
    //         criticalPages.push({
    //           url: product.url,
    //           type: 'product',
    //           name: product.name
    //         });
    //       });
    //     }
    //   } catch {
    //     // apiKey is not JSON config, skip
    //   }
    // }

    // Collect metrics for each critical page
    for (const page of criticalPages) {
      try {
        if (page.type === 'collection') {
          await this.collectCollectionMetrics(siteId, page.url, page.name);
        } else if (page.type === 'product') {
          await this.collectProductMetrics(siteId, page.url, page.name);
        } else {
          // Use regular performance collector for other pages
          await performanceCollector.collectAndStore(siteId, page.url, {
            deviceType: 'mobile'
          });
          await performanceCollector.collectAndStore(siteId, page.url, {
            deviceType: 'desktop'
          });
        }

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Failed to collect metrics for ${page.name}:`, error);
      }
    }

    console.log(`✅ Shopify page metrics collection completed for ${site.name}`);
  }

  /**
   * Get performance summary for Shopify pages
   */
  async getShopifyPageSummary(siteId: string, days: number = 7): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: {
          gte: since
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Group by page type
    const summary: any = {
      collections: [],
      products: [],
      home: [],
      other: []
    };

    metrics.forEach(metric => {
      // lighthouseData field doesn't exist - entire block disabled
      // const data = metric.lighthouseData as any;
      // if (data?.shopifyPage) {
      //   const pageData = {
      //     url: data.shopifyPage.url,
      //     name: data.shopifyPage.name,
      //     type: data.shopifyPage.type,
      //     lcp: metric.lcp,
      //     cls: metric.cls,
      //     performance: metric.performance,
      //     deviceType: metric.deviceType,
      //     timestamp: metric.timestamp
      //   };

      //   switch (data.shopifyPage.type) {
      //     case 'collection':
      //       summary.collections.push(pageData);
      //       break;
      //     case 'product':
      //       summary.products.push(pageData);
      //       break;
      //     case 'home':
      //       summary.home.push(pageData);
      //       break;
      //     default:
      //       summary.other.push(pageData);
      //   }
      // }
    });

    return summary;
  }

  /**
   * Calculate average performance by page type
   */
  async getPageTypeAverages(siteId: string, days: number = 30): Promise<any> {
    const summary = await this.getShopifyPageSummary(siteId, days);

    const calculateAverage = (pages: any[], metric: string) => {
      const values = pages.map(p => p[metric]).filter(v => v !== null && v !== undefined);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    return {
      collections: {
        avgLCP: calculateAverage(summary.collections, 'lcp'),
        avgCLS: calculateAverage(summary.collections, 'cls'),
        avgScore: calculateAverage(summary.collections, 'performance'),
        count: summary.collections.length
      },
      products: {
        avgLCP: calculateAverage(summary.products, 'lcp'),
        avgCLS: calculateAverage(summary.products, 'cls'),
        avgScore: calculateAverage(summary.products, 'performance'),
        count: summary.products.length
      },
      home: {
        avgLCP: calculateAverage(summary.home, 'lcp'),
        avgCLS: calculateAverage(summary.home, 'cls'),
        avgScore: calculateAverage(summary.home, 'performance'),
        count: summary.home.length
      }
    };
  }
}

export const shopifyMetricsCollector = new ShopifyMetricsCollector();