import { logger } from '../utils/logger';
import { prisma } from './database';
import { recommendationsService } from './recommendations';

export type AnomalyStatus = 'active' | 'resolved' | 'false_positive';

export interface Anomaly {
  id?: string;
  siteId: string;
  metricId: string;
  metric: string;
  currentValue: number;
  expectedMin: number;
  expectedMax: number;
  standardDeviations: number;
  confidence: number;
  status: AnomalyStatus;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}

export interface StatisticalAnalysis {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export class AnomalyDetectorService {
  // Z-score threshold for anomaly detection (2 = ~95% confidence, 3 = ~99.7% confidence)
  private readonly Z_SCORE_THRESHOLD = 2.5;

  // Minimum number of data points needed for statistical analysis
  private readonly MIN_DATA_POINTS = 10;

  /**
   * Detect anomalies in the latest metrics for a site
   */
  async detectAnomalies(siteId: string): Promise<Anomaly[]> {
    const latestMetric = await prisma.performanceMetric.findFirst({
      where: { siteId },
      orderBy: { timestamp: 'desc' }
    });

    if (!latestMetric) {
      logger.info(`No metrics found for site ${siteId}, skipping anomaly detection`);
      return [];
    }

    const anomalies: Anomaly[] = [];

    // Check each metric type
    const metricsToCheck = [
      { name: 'lcp', value: latestMetric.lcp },
      { name: 'cls', value: latestMetric.cls },
      { name: 'fcp', value: latestMetric.fcp },
      { name: 'tti', value: latestMetric.tti },
      { name: 'ttfb', value: latestMetric.ttfb },
      { name: 'tbt', value: latestMetric.tbt },
      { name: 'performance', value: latestMetric.performance },
      { name: 'pageSize', value: latestMetric.pageSize }
    ];

    for (const { name, value } of metricsToCheck) {
      if (value === null || value === undefined) continue;

      const anomaly = await this.checkMetricForAnomaly(
        siteId,
        latestMetric.id,
        name,
        value
      );

      if (anomaly) {
        anomalies.push(anomaly);
        await this.storeAnomaly(anomaly);
      }
    }

    // If anomalies detected, trigger recommendation generation
    if (anomalies.length > 0) {
      logger.info(`Detected ${anomalies.length} anomalies for site ${siteId}, generating recommendations`);
      await recommendationsService.generateRecommendations(siteId);
    }

    return anomalies;
  }

  /**
   * Check a specific metric for anomalies using statistical analysis
   */
  private async checkMetricForAnomaly(
    siteId: string,
    metricId: string,
    metricName: string,
    currentValue: number
  ): Promise<Anomaly | null> {
    // Get historical data for this metric (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        timestamp: { gte: thirtyDaysAgo }
      },
      orderBy: { timestamp: 'desc' },
      select: {
        [metricName]: true
      }
    });

    // Extract values and filter out nulls
    const values = historicalMetrics
      .map(m => m[metricName as keyof typeof m] as unknown)
      .filter((v): v is number => typeof v === 'number');

    if (values.length < this.MIN_DATA_POINTS) {
      logger.debug(`Not enough data points for ${metricName} on site ${siteId}`);
      return null;
    }

    // Calculate statistics
    const stats = this.calculateStatistics(values);

    // Calculate z-score for current value
    const zScore = (currentValue - stats.mean) / stats.stdDev;
    const absZScore = Math.abs(zScore);

    // Check if value is an anomaly
    if (absZScore >= this.Z_SCORE_THRESHOLD) {
      const confidence = this.calculateConfidence(absZScore);
      const expectedRange = this.calculateExpectedRange(stats);

      // Check if this is a regression (worse performance) or improvement
      const isRegression = this.isPerformanceRegression(metricName, currentValue, stats.mean);

      // Only flag regressions as anomalies (we don't alert on improvements)
      if (isRegression) {
        return {
          siteId,
          metricId,
          metric: metricName.toUpperCase(),
          currentValue,
          expectedMin: expectedRange.min,
          expectedMax: expectedRange.max,
          standardDeviations: absZScore,
          confidence,
          status: 'active'
        };
      }
    }

    return null;
  }

  /**
   * Calculate statistical measures for a dataset
   */
  private calculateStatistics(values: number[]): StatisticalAnalysis {
    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;

    // Mean
    const mean = values.reduce((sum, val) => sum + val, 0) / count;

    // Median
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // Standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[count - 1],
      count
    };
  }

  /**
   * Calculate confidence level based on z-score
   */
  private calculateConfidence(zScore: number): number {
    // Convert z-score to confidence percentage
    // 2.0 = ~95%, 2.5 = ~98.7%, 3.0 = ~99.7%
    if (zScore >= 3.0) return 0.997;
    if (zScore >= 2.5) return 0.987;
    if (zScore >= 2.0) return 0.954;
    if (zScore >= 1.5) return 0.866;
    return 0.68;
  }

  /**
   * Calculate expected range (mean ± 2 standard deviations)
   */
  private calculateExpectedRange(stats: StatisticalAnalysis): { min: number; max: number } {
    return {
      min: Math.max(0, stats.mean - (2 * stats.stdDev)),
      max: stats.mean + (2 * stats.stdDev)
    };
  }

  /**
   * Determine if a value represents performance regression
   * For some metrics, higher is worse (LCP, CLS, TTI, etc.)
   * For others, lower is worse (performance score)
   */
  private isPerformanceRegression(metricName: string, currentValue: number, historicalMean: number): boolean {
    const higherIsWorse = ['lcp', 'cls', 'fcp', 'tti', 'ttfb', 'tbt', 'pageSize', 'requests', 'thirdPartyBlockingTime'];
    const lowerIsWorse = ['performance', 'accessibility', 'bestPractices', 'seo', 'imageOptimizationScore'];

    if (higherIsWorse.includes(metricName)) {
      return currentValue > historicalMean;
    }

    if (lowerIsWorse.includes(metricName)) {
      return currentValue < historicalMean;
    }

    return false;
  }

  /**
   * Store anomaly in database
   */
  private async storeAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      // Check if anomaly already exists for this metric
      const existing = await prisma.anomaly.findFirst({
        where: {
          siteId: anomaly.siteId,
          metricId: anomaly.metricId,
          metric: anomaly.metric,
          status: 'active'
        }
      });

      if (existing) {
        // Update existing anomaly
        await prisma.anomaly.update({
          where: { id: existing.id },
          data: {
            currentValue: anomaly.currentValue,
            expectedMin: anomaly.expectedMin,
            expectedMax: anomaly.expectedMax,
            standardDeviations: anomaly.standardDeviations,
            confidence: anomaly.confidence,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new anomaly
        await prisma.anomaly.create({
          data: {
            siteId: anomaly.siteId,
            metricId: anomaly.metricId,
            metric: anomaly.metric,
            currentValue: anomaly.currentValue,
            expectedMin: anomaly.expectedMin,
            expectedMax: anomaly.expectedMax,
            standardDeviations: anomaly.standardDeviations,
            confidence: anomaly.confidence,
            status: anomaly.status
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to store anomaly for site ${anomaly.siteId}:`, error);
    }
  }

  /**
   * Get active anomalies for a site
   */
  async getActiveAnomalies(siteId: string): Promise<Anomaly[]> {
    const anomalies = await prisma.anomaly.findMany({
      where: {
        siteId,
        status: 'active'
      },
      orderBy: [
        { confidence: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return anomalies.map(a => ({
      ...a,
      status: a.status as AnomalyStatus,
      resolvedAt: a.resolvedAt || undefined
    }));
  }

  /**
   * Resolve an anomaly
   */
  async resolveAnomaly(id: string): Promise<void> {
    await prisma.anomaly.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });
  }

  /**
   * Mark anomaly as false positive
   */
  async markAsFalsePositive(id: string): Promise<void> {
    await prisma.anomaly.update({
      where: { id },
      data: {
        status: 'false_positive',
        resolvedAt: new Date()
      }
    });
  }

  /**
   * Auto-resolve old anomalies that may have been fixed
   */
  async autoResolveOldAnomalies(siteId: string): Promise<void> {
    // Get active anomalies older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldAnomalies = await prisma.anomaly.findMany({
      where: {
        siteId,
        status: 'active',
        createdAt: { lte: sevenDaysAgo }
      }
    });

    for (const anomaly of oldAnomalies) {
      // Check if the metric is still anomalous
      const latestMetric = await prisma.performanceMetric.findFirst({
        where: { siteId },
        orderBy: { timestamp: 'desc' }
      });

      if (latestMetric) {
        const currentValue = latestMetric[anomaly.metric.toLowerCase() as keyof typeof latestMetric] as number;

        if (currentValue !== null && currentValue !== undefined) {
          // If current value is within expected range, auto-resolve
          if (currentValue >= anomaly.expectedMin && currentValue <= anomaly.expectedMax) {
            await this.resolveAnomaly(anomaly.id);
            logger.info(`Auto-resolved anomaly ${anomaly.id} for metric ${anomaly.metric} on site ${siteId}`);
          }
        }
      }
    }
  }

  /**
   * Get anomaly trend (are anomalies increasing or decreasing?)
   */
  async getAnomalyTrend(siteId: string, days: number = 30): Promise<{
    currentCount: number;
    previousCount: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const midDate = new Date(cutoffDate);
    midDate.setDate(midDate.getDate() + (days / 2));

    // Count anomalies in first half vs second half of period
    const previousCount = await prisma.anomaly.count({
      where: {
        siteId,
        createdAt: {
          gte: cutoffDate,
          lt: midDate
        }
      }
    });

    const currentCount = await prisma.anomaly.count({
      where: {
        siteId,
        createdAt: {
          gte: midDate,
          lte: now
        }
      }
    });

    let trend: 'increasing' | 'decreasing' | 'stable';
    const difference = currentCount - previousCount;

    if (difference > 1) {
      trend = 'increasing';
    } else if (difference < -1) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      currentCount,
      previousCount,
      trend
    };
  }
}

export const anomalyDetectorService = new AnomalyDetectorService();
