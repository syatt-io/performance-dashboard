import { logger } from '../utils/logger';
import { prisma } from './database';

export interface ConversionMetrics {
  siteId: string;
  date: Date;
  visitors?: number;
  pageViews?: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  cartAbandonment?: number;
  conversionRate?: number;
  averageOrderValue?: number;
  revenue?: number;
  transactions?: number;
  productViews?: number;
  addToCarts?: number;
  checkoutStarts?: number;
  checkoutCompletions?: number;
}

export interface PerformanceImpact {
  metric: string;
  threshold: number;
  conversionImpact: number; // Percentage impact on conversion
  revenueImpact: number; // Estimated revenue impact
}

export class BusinessMetricsService {

  /**
   * Store conversion metrics for a site
   */
  async storeConversionMetrics(metrics: ConversionMetrics): Promise<void> {
    // Store in the lighthouseData JSON field for now
    // In production, you'd want a dedicated table for business metrics
    await prisma.performanceMetric.create({
      data: {
        siteId: metrics.siteId,
        deviceType: 'business', // Use a special device type for business metrics
        timestamp: metrics.date,
        // lighthouseData field doesn't exist in current schema
        // lighthouseData: {
        //   type: 'business_metrics',
        //   conversions: {
        //     visitors: metrics.visitors,
        //     pageViews: metrics.pageViews,
        //     bounceRate: metrics.bounceRate,
        //     avgSessionDuration: metrics.avgSessionDuration,
        //     cartAbandonment: metrics.cartAbandonment,
        //     conversionRate: metrics.conversionRate,
        //     averageOrderValue: metrics.averageOrderValue,
        //     revenue: metrics.revenue,
        //     transactions: metrics.transactions,
        //     productViews: metrics.productViews,
        //     addToCarts: metrics.addToCarts,
        //     checkoutStarts: metrics.checkoutStarts,
        //     checkoutCompletions: metrics.checkoutCompletions
        //   }
        // }
      }
    });

    logger.info(`📊 Stored business metrics for site ${metrics.siteId}`);
  }

  /**
   * Calculate the correlation between performance metrics and conversion rates
   */
  async calculatePerformanceImpact(
    siteId: string,
    days: number = 30
  ): Promise<PerformanceImpact[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get performance and business metrics
    const metrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Separate performance and business metrics
    const performanceMetrics = metrics.filter(m => m.deviceType !== 'business');
    const businessMetrics = metrics.filter(m => m.deviceType === 'business');

    if (performanceMetrics.length === 0 || businessMetrics.length === 0) {
      return [];
    }

    // Calculate correlations (simplified version)
    const impacts: PerformanceImpact[] = [];

    // LCP Impact on Conversion
    const avgLCP = this.calculateAverage(performanceMetrics, 'lcp');
    if (avgLCP) {
      // Research shows 1 second improvement in LCP can improve conversion by 7%
      const lcpImpact = this.estimateLCPImpact(avgLCP);
      impacts.push({
        metric: 'Largest Contentful Paint',
        threshold: avgLCP,
        conversionImpact: lcpImpact.conversionChange,
        revenueImpact: lcpImpact.revenueImpact
      });
    }

    // CLS Impact on Conversion
    const avgCLS = this.calculateAverage(performanceMetrics, 'cls');
    if (avgCLS) {
      // High CLS can reduce conversions by up to 12%
      const clsImpact = this.estimateCLSImpact(avgCLS);
      impacts.push({
        metric: 'Cumulative Layout Shift',
        threshold: avgCLS,
        conversionImpact: clsImpact.conversionChange,
        revenueImpact: clsImpact.revenueImpact
      });
    }

    // Performance Score Impact
    const avgScore = this.calculateAverage(performanceMetrics, 'performance');
    if (avgScore) {
      // Every 10 point improvement in performance score correlates with ~2% conversion increase
      const scoreImpact = this.estimateScoreImpact(avgScore);
      impacts.push({
        metric: 'Performance Score',
        threshold: avgScore,
        conversionImpact: scoreImpact.conversionChange,
        revenueImpact: scoreImpact.revenueImpact
      });
    }

    return impacts;
  }

  /**
   * Calculate average of a metric
   */
  private calculateAverage(metrics: Array<Record<string, unknown>>, field: string): number | null {
    const values = metrics
      .map(m => m[field])
      .filter((v): v is number => typeof v === 'number');

    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  /**
   * Estimate LCP impact on conversions
   * Based on industry research: https://web.dev/vitals-business-impact/
   */
  private estimateLCPImpact(lcp: number): {
    conversionChange: number;
    revenueImpact: number;
  } {
    let conversionChange = 0;

    if (lcp < 2.5) {
      // Good LCP - baseline
      conversionChange = 0;
    } else if (lcp < 4.0) {
      // Needs improvement - 7% conversion loss per second
      conversionChange = -7 * (lcp - 2.5);
    } else {
      // Poor LCP - accelerated conversion loss
      conversionChange = -10.5 - (10 * (lcp - 4.0));
    }

    // Assume $100k monthly revenue baseline for impact calculation
    const monthlyRevenue = 100000;
    const revenueImpact = (monthlyRevenue * conversionChange) / 100;

    return {
      conversionChange,
      revenueImpact
    };
  }

  /**
   * Estimate CLS impact on conversions
   */
  private estimateCLSImpact(cls: number): {
    conversionChange: number;
    revenueImpact: number;
  } {
    let conversionChange = 0;

    if (cls < 0.1) {
      // Good CLS
      conversionChange = 0;
    } else if (cls < 0.25) {
      // Needs improvement - 4% conversion loss
      conversionChange = -4;
    } else {
      // Poor CLS - 12% conversion loss
      conversionChange = -12;
    }

    const monthlyRevenue = 100000;
    const revenueImpact = (monthlyRevenue * conversionChange) / 100;

    return {
      conversionChange,
      revenueImpact
    };
  }

  /**
   * Estimate Performance Score impact
   */
  private estimateScoreImpact(score: number): {
    conversionChange: number;
    revenueImpact: number;
  } {
    // Every 10 points below 90 costs ~2% in conversions
    const conversionChange = score >= 90 ? 0 : -((90 - score) / 10 * 2);

    const monthlyRevenue = 100000;
    const revenueImpact = (monthlyRevenue * conversionChange) / 100;

    return {
      conversionChange,
      revenueImpact
    };
  }

  /**
   * Get conversion trends over time
   */
  async getConversionTrends(
    siteId: string,
    days: number = 30
  ): Promise<{
    date: Date;
    conversionRate: number;
    revenue: number;
    transactions: number;
    avgPerformanceScore: number | null;
  }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group by date
    const dailyMetrics = new Map<string, any>();

    metrics.forEach(metric => {
      const dateKey = metric.timestamp.toISOString().split('T')[0];

      if (!dailyMetrics.has(dateKey)) {
        dailyMetrics.set(dateKey, {
          date: new Date(dateKey),
          performances: [],
          businessData: null
        });
      }

      const daily = dailyMetrics.get(dateKey);

      if (metric.deviceType === 'business') {
        const data = metric as any;
        if (data?.conversions) {
          daily.businessData = data.conversions;
        }
      } else if (metric.performance) {
        daily.performances.push(metric.performance);
      }
    });

    // Calculate daily averages and format response
    interface TrendData {
      date: Date;
      conversionRate: number;
      revenue: number;
      transactions: number;
      avgPerformanceScore: number | null;
    }
    const trends: TrendData[] = [];

    dailyMetrics.forEach(daily => {
      const avgScore = daily.performances.length > 0
        ? daily.performances.reduce((a: number, b: number) => a + b, 0) / daily.performances.length
        : null;

      trends.push({
        date: daily.date,
        conversionRate: daily.businessData?.conversionRate || 0,
        revenue: daily.businessData?.revenue || 0,
        transactions: daily.businessData?.transactions || 0,
        avgPerformanceScore: avgScore
      });
    });

    return trends;
  }

  /**
   * Calculate ROI of performance improvements
   */
  async calculatePerformanceROI(
    siteId: string,
    targetLCP?: number,
    targetCLS?: number,
    targetScore?: number
  ): Promise<{
    currentRevenue: number;
    projectedRevenue: number;
    revenueIncrease: number;
    conversionIncrease: number;
    roi: string;
  }> {
    // Get current performance metrics
    const recentMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        deviceType: { not: 'business' },
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const currentLCP = this.calculateAverage(recentMetrics, 'lcp') || 4.0;
    const currentCLS = this.calculateAverage(recentMetrics, 'cls') || 0.25;
    const currentScore = this.calculateAverage(recentMetrics, 'performance') || 50;

    // Calculate improvement impacts
    let totalConversionIncrease = 0;

    if (targetLCP && targetLCP < currentLCP) {
      const currentImpact = this.estimateLCPImpact(currentLCP);
      const targetImpact = this.estimateLCPImpact(targetLCP);
      totalConversionIncrease += targetImpact.conversionChange - currentImpact.conversionChange;
    }

    if (targetCLS && targetCLS < currentCLS) {
      const currentImpact = this.estimateCLSImpact(currentCLS);
      const targetImpact = this.estimateCLSImpact(targetCLS);
      totalConversionIncrease += targetImpact.conversionChange - currentImpact.conversionChange;
    }

    if (targetScore && targetScore > currentScore) {
      const currentImpact = this.estimateScoreImpact(currentScore);
      const targetImpact = this.estimateScoreImpact(targetScore);
      totalConversionIncrease += targetImpact.conversionChange - currentImpact.conversionChange;
    }

    // Calculate revenue impact
    const currentRevenue = 100000; // Baseline monthly revenue
    const revenueIncrease = (currentRevenue * totalConversionIncrease) / 100;
    const projectedRevenue = currentRevenue + revenueIncrease;

    // Calculate ROI (assuming $10k investment in performance improvements)
    const investmentCost = 10000;
    const annualRevenueIncrease = revenueIncrease * 12;
    const roi = ((annualRevenueIncrease - investmentCost) / investmentCost * 100).toFixed(1) + '%';

    return {
      currentRevenue,
      projectedRevenue,
      revenueIncrease,
      conversionIncrease: totalConversionIncrease,
      roi
    };
  }
}

export const businessMetricsService = new BusinessMetricsService();