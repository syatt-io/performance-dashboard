import { logger } from '../utils/logger';
import { prisma } from './database';

export type RecommendationSeverity = 'critical' | 'warning' | 'info';
export type RecommendationCategory = 'images' | 'javascript' | 'css' | 'fonts' | 'shopify-apps' | 'infrastructure';
export type RecommendationStatus = 'active' | 'resolved' | 'dismissed';

export interface Recommendation {
  id?: string;
  siteId: string;
  metricId?: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  metric: string;
  title: string;
  description: string;
  actionableSteps: string[];
  estimatedImpact?: string;
  status: RecommendationStatus;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}

export interface MetricSnapshot {
  lcp?: number | null;
  cls?: number | null;
  fcp?: number | null;
  tti?: number | null;
  tbt?: number | null;
  ttfb?: number | null;
  performance?: number | null;
  pageSize?: number | null;
  requests?: number | null;
  imageOptimizationScore?: number | null;
  thirdPartyBlockingTime?: number | null;
}

export class RecommendationsService {
  /**
   * Generate recommendations for a site based on latest metrics
   */
  async generateRecommendations(siteId: string): Promise<Recommendation[]> {
    // Get latest metric for the site
    const latestMetric = await prisma.performanceMetric.findFirst({
      where: { siteId },
      orderBy: { timestamp: 'desc' }
    });

    if (!latestMetric) {
      logger.info(`No metrics found for site ${siteId}, skipping recommendations`);
      return [];
    }

    const recommendations: Recommendation[] = [];

    // Run all rule checks
    recommendations.push(...this.checkLCP(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkCLS(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkFCP(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkTTI(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkTTFB(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkPageSize(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkImageOptimization(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkThirdPartyScripts(siteId, latestMetric.id, latestMetric));
    recommendations.push(...this.checkPerformanceScore(siteId, latestMetric.id, latestMetric));

    // Store recommendations in database
    for (const rec of recommendations) {
      await this.storeRecommendation(rec);
    }

    logger.info(`Generated ${recommendations.length} recommendations for site ${siteId}`);
    return recommendations;
  }

  /**
   * Check LCP and generate recommendations
   */
  private checkLCP(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const lcp = metric.lcp;

    if (!lcp) return recommendations;

    if (lcp > 4.0) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'critical',
        category: 'images',
        metric: 'LCP',
        title: 'Critical: Very Slow Largest Contentful Paint',
        description: `Your LCP is ${lcp.toFixed(2)}s, significantly slower than the recommended 2.5s. This severely impacts user experience and conversion rates.`,
        actionableSteps: [
          'Shopify: Use image_url filter with format parameter: {{ product.featured_image | image_url: width: 800, format: "webp" }}',
          'Preload your LCP image: <link rel="preload" as="image" href="hero-image.webp" fetchpriority="high">',
          'Compress images with TinyPNG, Squoosh, or Shopify\'s built-in optimization',
          'Add width/height to prevent layout shift: <img src="..." width="800" height="600" loading="eager">',
          'For hero images, use eager loading (loading="eager") and fetchpriority="high"',
          'Use Shopify CDN by default - ensure images are served from cdn.shopify.com',
          'Test with: Chrome DevTools → Performance → Find LCP element → Optimize it specifically'
        ],
        estimatedImpact: `Improving LCP to 2.5s could improve conversions by ~${((lcp - 2.5) * 7).toFixed(1)}%`,
        status: 'active'
      });
    } else if (lcp > 2.5) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'images',
        metric: 'LCP',
        title: 'Warning: Largest Contentful Paint Needs Improvement',
        description: `Your LCP is ${lcp.toFixed(2)}s, which needs improvement (target: <2.5s).`,
        actionableSteps: [
          'Shopify: Convert product images to WebP: {{ image | image_url: width: 800, format: "webp" }}',
          'Preload LCP image: <link rel="preload" as="image" href="hero.webp" fetchpriority="high">',
          'Add fetchpriority="high" to your hero/banner image',
          'Ensure images use Shopify CDN (cdn.shopify.com) not external CDNs',
          'Use Chrome DevTools Lighthouse to identify exact LCP element',
          'Defer non-critical CSS and JavaScript that blocks rendering'
        ],
        estimatedImpact: `Improving LCP to 2.5s could improve conversions by ~${((lcp - 2.5) * 7).toFixed(1)}%`,
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check CLS and generate recommendations
   */
  private checkCLS(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const cls = metric.cls;

    if (!cls) return recommendations;

    if (cls > 0.25) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'critical',
        category: 'css',
        metric: 'CLS',
        title: 'Critical: High Cumulative Layout Shift',
        description: `Your CLS score is ${cls.toFixed(3)}, causing significant visual instability (target: <0.1). This frustrates users and hurts conversions.`,
        actionableSteps: [
          'Add width/height to ALL images: <img src="..." width="800" height="600"> (required for CLS)',
          'Shopify: Use image_url with explicit dimensions: {{ image | image_url: width: 800, height: 600 }}',
          'Reserve space with CSS: .banner { aspect-ratio: 16/9; } or min-height',
          'For fonts: Add <link rel="preload" as="font"> and use font-display: swap in CSS',
          'Avoid injecting content above fold - banners/announcements cause major CLS',
          'Test CLS sources: Chrome DevTools → Performance → Experience → Layout Shifts',
          'Fix common Shopify theme issues: lazy-loaded hero images, dynamic announcement bars'
        ],
        estimatedImpact: 'Fixing CLS could improve conversions by up to 12%',
        status: 'active'
      });
    } else if (cls > 0.1) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'css',
        metric: 'CLS',
        title: 'Warning: Layout Shift Needs Improvement',
        description: `Your CLS score is ${cls.toFixed(3)}, which needs improvement (target: <0.1).`,
        actionableSteps: [
          'Audit all images for missing width/height: Check <img> tags and CSS backgrounds',
          'Shopify specific: Check theme.liquid for dynamically injected announcement bars',
          'Set min-height on containers that load dynamic content (reviews, related products)',
          'Use aspect-ratio CSS: .product-image { aspect-ratio: 1/1; }',
          'Preload web fonts: <link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin>',
          'Review Shopify app embeds - they often inject content causing CLS'
        ],
        estimatedImpact: 'Improving CLS could increase conversions by 4-6%',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check FCP and generate recommendations
   */
  private checkFCP(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const fcp = metric.fcp;

    if (!fcp) return recommendations;

    if (fcp > 3.0) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'javascript',
        metric: 'FCP',
        title: 'Slow First Contentful Paint',
        description: `Your FCP is ${fcp.toFixed(2)}s, which is slower than recommended (target: <1.8s).`,
        actionableSteps: [
          'Eliminate render-blocking JavaScript and CSS',
          'Inline critical CSS for above-the-fold content',
          'Defer or async non-critical JavaScript',
          'Minimize main-thread work',
          'Reduce JavaScript bundle size'
        ],
        estimatedImpact: 'Faster FCP improves perceived performance and reduces bounce rate',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check TTI and generate recommendations
   */
  private checkTTI(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const tti = metric.tti;

    if (!tti) return recommendations;

    if (tti > 5.0) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'javascript',
        metric: 'TTI',
        title: 'Slow Time to Interactive',
        description: `Your TTI is ${tti.toFixed(2)}s. Users cannot interact with your page for ${tti.toFixed(1)} seconds.`,
        actionableSteps: [
          'Code-split JavaScript bundles to load only what\'s needed',
          'Remove unused JavaScript and CSS',
          'Break up long tasks (>50ms)',
          'Implement lazy loading for non-critical features',
          'Reduce JavaScript execution time'
        ],
        estimatedImpact: 'Faster TTI directly improves user experience and engagement',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check TTFB and generate recommendations
   */
  private checkTTFB(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const ttfb = metric.ttfb;

    if (!ttfb) return recommendations;

    if (ttfb > 600) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'infrastructure',
        metric: 'TTFB',
        title: 'Slow Time to First Byte',
        description: `Your TTFB is ${ttfb.toFixed(0)}ms, indicating slow server response (target: <200ms).`,
        actionableSteps: [
          'Enable server-side caching for static content',
          'Optimize database queries and indexes',
          'Use a CDN to serve content from edge locations',
          'Consider upgrading to Shopify Plus for better infrastructure',
          'Review and optimize Liquid template rendering'
        ],
        estimatedImpact: 'Faster TTFB improves all other performance metrics',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check page size and generate recommendations
   */
  private checkPageSize(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const pageSize = metric.pageSize;

    if (!pageSize) return recommendations;

    const pageSizeMB = pageSize / (1024 * 1024);

    if (pageSizeMB > 5) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'images',
        metric: 'Page Size',
        title: 'Large Page Size',
        description: `Your page size is ${pageSizeMB.toFixed(2)}MB, which is quite large (target: <3MB).`,
        actionableSteps: [
          'Compress and optimize all images',
          'Use next-gen image formats (WebP, AVIF)',
          'Implement lazy loading for images and videos',
          'Minify CSS and JavaScript files',
          'Remove unused code and dependencies'
        ],
        estimatedImpact: 'Reducing page size improves load times, especially on slow connections',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check image optimization score
   */
  private checkImageOptimization(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const score = metric.imageOptimizationScore;

    if (!score) return recommendations;

    if (score < 50) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'critical',
        category: 'images',
        metric: 'Image Optimization',
        title: 'Poor Image Optimization',
        description: `Your image optimization score is ${score.toFixed(0)}/100. Images are a major performance bottleneck.`,
        actionableSteps: [
          'Convert all images to WebP or AVIF format',
          'Compress images without visible quality loss',
          'Serve responsive images using srcset',
          'Lazy load off-screen images',
          'Use Shopify\'s built-in image optimization (image_url filter)'
        ],
        estimatedImpact: 'Proper image optimization can reduce page size by 50-70%',
        status: 'active'
      });
    } else if (score < 75) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'images',
        metric: 'Image Optimization',
        title: 'Image Optimization Needs Improvement',
        description: `Your image optimization score is ${score.toFixed(0)}/100.`,
        actionableSteps: [
          'Review and compress large images',
          'Consider using next-gen formats for product images',
          'Implement lazy loading if not already done',
          'Use appropriate image dimensions (don\'t serve oversized images)'
        ],
        estimatedImpact: 'Better image optimization improves LCP and page load time',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check third-party scripts blocking time
   */
  private checkThirdPartyScripts(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const blockingTime = metric.thirdPartyBlockingTime;

    if (!blockingTime) return recommendations;

    if (blockingTime > 1000) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'shopify-apps',
        metric: 'Third-party Scripts',
        title: 'High Third-Party Blocking Time',
        description: `Third-party scripts are blocking for ${blockingTime.toFixed(0)}ms. Apps and tracking scripts are slowing down your site.`,
        actionableSteps: [
          'Shopify Admin → Apps → Remove unused apps (each app adds ~50-200ms)',
          'Audit app scripts: Online Store → Themes → Actions → Edit Code → Check theme.liquid and layout files',
          'Replace heavy apps: Reviews, popups, chat widgets often have lighter alternatives',
          'Use Shopify Web Pixels (GA4, Meta Pixel) instead of custom tracking scripts',
          'Defer scripts: <script src="..." defer> or move to {{ content_for_footer }}',
          'Common culprits: Klaviyo, Yotpo, Privy, Gorgias - check if you need all features',
          'Test performance impact: Disable apps one-by-one and re-run Lighthouse'
        ],
        estimatedImpact: 'Reducing third-party scripts can improve TTI by 20-30%',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Check overall performance score
   */
  private checkPerformanceScore(siteId: string, metricId: string, metric: MetricSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const score = metric.performance;

    if (!score) return recommendations;

    if (score < 50) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'critical',
        category: 'infrastructure',
        metric: 'Performance Score',
        title: 'Critical: Very Low Performance Score',
        description: `Your Lighthouse performance score is ${score}/100. This indicates serious performance issues.`,
        actionableSteps: [
          'Review and implement all critical recommendations above',
          'Consider a comprehensive performance audit',
          'Review theme code for inefficiencies',
          'Optimize Liquid templates and collections',
          'Consider switching to a performance-optimized theme'
        ],
        estimatedImpact: 'Every 10-point improvement correlates with ~2% conversion increase',
        status: 'active'
      });
    } else if (score < 75) {
      recommendations.push({
        siteId,
        metricId,
        severity: 'warning',
        category: 'infrastructure',
        metric: 'Performance Score',
        title: 'Low Performance Score',
        description: `Your Lighthouse performance score is ${score}/100, which needs improvement.`,
        actionableSteps: [
          'Address the most critical recommendations first (LCP, CLS)',
          'Optimize images and reduce page weight',
          'Review and optimize third-party scripts',
          'Implement proper caching strategies'
        ],
        estimatedImpact: 'Improving to 90+ could increase conversions by ~2-4%',
        status: 'active'
      });
    }

    return recommendations;
  }

  /**
   * Store recommendation in database
   */
  private async storeRecommendation(rec: Recommendation): Promise<void> {
    try {
      // Check if similar recommendation already exists and is active
      const existing = await prisma.recommendation.findFirst({
        where: {
          siteId: rec.siteId,
          metric: rec.metric,
          severity: rec.severity,
          status: 'active'
        }
      });

      if (existing) {
        // Update existing recommendation
        await prisma.recommendation.update({
          where: { id: existing.id },
          data: {
            description: rec.description,
            actionableSteps: JSON.stringify(rec.actionableSteps),
            estimatedImpact: rec.estimatedImpact,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new recommendation
        await prisma.recommendation.create({
          data: {
            siteId: rec.siteId,
            metricId: rec.metricId,
            severity: rec.severity,
            category: rec.category,
            metric: rec.metric,
            title: rec.title,
            description: rec.description,
            actionableSteps: JSON.stringify(rec.actionableSteps),
            estimatedImpact: rec.estimatedImpact,
            status: rec.status
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to store recommendation for site ${rec.siteId}:`, error);
    }
  }

  /**
   * Get active recommendations for a site
   */
  async getActiveRecommendations(siteId: string): Promise<Recommendation[]> {
    const recs = await prisma.recommendation.findMany({
      where: {
        siteId,
        status: 'active'
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return recs.map(rec => ({
      ...rec,
      metricId: rec.metricId || undefined,
      estimatedImpact: rec.estimatedImpact || undefined,
      resolvedAt: rec.resolvedAt || undefined,
      severity: rec.severity as RecommendationSeverity,
      category: rec.category as RecommendationCategory,
      status: rec.status as RecommendationStatus,
      actionableSteps: JSON.parse(rec.actionableSteps)
    }));
  }

  /**
   * Resolve a recommendation
   */
  async resolveRecommendation(id: string): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(id: string): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'dismissed',
        resolvedAt: new Date()
      }
    });
  }
}

export const recommendationsService = new RecommendationsService();
