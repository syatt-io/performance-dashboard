import { prisma } from './database';

export interface PerformanceBudgetConfig {
  metric: string;
  deviceType: 'mobile' | 'desktop' | 'both';
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  alertOnRegression: boolean;
}

export interface AlertRule {
  id: string;
  siteId: string;
  metric: string;
  deviceType: string;
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  alertOnRegression: boolean;
}

export class AlertService {

  // Default performance budgets based on Core Web Vitals and best practices
  static getDefaultBudgets(): PerformanceBudgetConfig[] {
    return [
      // Performance Score
      { metric: 'performanceScore', deviceType: 'mobile', warningThreshold: 75, criticalThreshold: 50, isEnabled: true, alertOnRegression: false },
      { metric: 'performanceScore', deviceType: 'desktop', warningThreshold: 85, criticalThreshold: 70, isEnabled: true, alertOnRegression: false },

      // Largest Contentful Paint (LCP)
      { metric: 'lcp', deviceType: 'mobile', warningThreshold: 2.5, criticalThreshold: 4.0, isEnabled: true, alertOnRegression: true },
      { metric: 'lcp', deviceType: 'desktop', warningThreshold: 2.0, criticalThreshold: 3.5, isEnabled: true, alertOnRegression: true },

      // Cumulative Layout Shift (CLS)
      { metric: 'cls', deviceType: 'both', warningThreshold: 0.1, criticalThreshold: 0.25, isEnabled: true, alertOnRegression: true },

      // First Input Delay (FID)
      { metric: 'fid', deviceType: 'both', warningThreshold: 100, criticalThreshold: 300, isEnabled: true, alertOnRegression: true },

      // First Contentful Paint (FCP)
      { metric: 'fcp', deviceType: 'mobile', warningThreshold: 1.8, criticalThreshold: 3.0, isEnabled: true, alertOnRegression: true },
      { metric: 'fcp', deviceType: 'desktop', warningThreshold: 1.5, criticalThreshold: 2.5, isEnabled: true, alertOnRegression: true },

      // Speed Index
      { metric: 'speedIndex', deviceType: 'mobile', warningThreshold: 3.4, criticalThreshold: 5.8, isEnabled: true, alertOnRegression: true },
      { metric: 'speedIndex', deviceType: 'desktop', warningThreshold: 2.5, criticalThreshold: 4.0, isEnabled: true, alertOnRegression: true },
    ];
  }

  // Create default performance budgets for a site
  async createDefaultBudgets(siteId: string): Promise<void> {
    const defaultBudgets = AlertService.getDefaultBudgets();

    for (const budget of defaultBudgets) {
      await prisma.performanceBudget.upsert({
        where: {
          siteId_metric_deviceType: {
            siteId,
            metric: budget.metric,
            deviceType: budget.deviceType
          }
        },
        update: {
          warningThreshold: budget.warningThreshold,
          criticalThreshold: budget.criticalThreshold,
          isEnabled: budget.isEnabled,
          alertOnRegression: budget.alertOnRegression
        },
        create: {
          siteId,
          metric: budget.metric,
          deviceType: budget.deviceType,
          warningThreshold: budget.warningThreshold,
          criticalThreshold: budget.criticalThreshold,
          isEnabled: budget.isEnabled,
          alertOnRegression: budget.alertOnRegression
        }
      });
    }

    console.log(`✅ Created default performance budgets for site ${siteId}`);
  }

  // Check if a metric value violates performance budgets
  async checkMetricThresholds(siteId: string, metricName: string, deviceType: string, value: number): Promise<void> {
    if (!value || value === null || value === undefined) return;

    // Get budgets for this specific metric and device type, or 'both'
    const budgets = await prisma.performanceBudget.findMany({
      where: {
        siteId,
        metric: metricName,
        deviceType: { in: [deviceType, 'both'] },
        isEnabled: true
      }
    });

    for (const budget of budgets) {
      let alertType: string | null = null;
      let threshold: number;

      // Determine alert type based on thresholds
      // For metrics where lower is better (most metrics)
      if (['lcp', 'cls', 'fid', 'fcp', 'ttfb', 'speedIndex'].includes(metricName)) {
        if (value >= budget.criticalThreshold) {
          alertType = 'critical';
          threshold = budget.criticalThreshold;
        } else if (value >= budget.warningThreshold) {
          alertType = 'warning';
          threshold = budget.warningThreshold;
        }
      }
      // For metrics where higher is better (performance score)
      else if (metricName === 'performanceScore') {
        if (value <= budget.criticalThreshold) {
          alertType = 'critical';
          threshold = budget.criticalThreshold;
        } else if (value <= budget.warningThreshold) {
          alertType = 'warning';
          threshold = budget.warningThreshold;
        }
      }

      if (alertType) {
        await this.createAlert(siteId, alertType, metricName, threshold, value, deviceType);
      }
    }
  }

  // Create an alert
  private async createAlert(
    siteId: string,
    type: string,
    metric: string,
    threshold: number,
    currentValue: number,
    deviceType: string
  ): Promise<void> {
    // Check if similar alert already exists (avoid spam)
    const existingAlert = await prisma.alert.findFirst({
      where: {
        siteId,
        type,
        metric,
        isResolved: false,
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000) // Within last 30 minutes
        }
      }
    });

    if (existingAlert) {
      console.log(`⚠️ Similar ${type} alert for ${metric} already exists for site ${siteId}`);
      return;
    }

    // Generate human-readable message
    const message = this.generateAlertMessage(metric, type, threshold, currentValue, deviceType);

    await prisma.alert.create({
      data: {
        siteId,
        type,
        metric,
        threshold,
        currentValue,
        message
      }
    });

    console.log(`🚨 ${type.toUpperCase()} Alert created for site ${siteId}: ${message}`);
  }

  // Generate human-readable alert messages
  private generateAlertMessage(
    metric: string,
    type: string,
    threshold: number,
    currentValue: number,
    deviceType: string
  ): string {
    const metricNames: Record<string, string> = {
      performanceScore: 'Performance Score',
      lcp: 'Largest Contentful Paint',
      cls: 'Cumulative Layout Shift',
      fid: 'First Input Delay',
      fcp: 'First Contentful Paint',
      ttfb: 'Time to First Byte',
      speedIndex: 'Speed Index'
    };

    const metricName = metricNames[metric] || metric;
    const deviceLabel = deviceType === 'mobile' ? ' (Mobile)' : deviceType === 'desktop' ? ' (Desktop)' : '';

    if (metric === 'performanceScore') {
      return `${metricName}${deviceLabel} dropped to ${currentValue} (threshold: ${threshold})`;
    } else if (metric === 'cls') {
      return `${metricName}${deviceLabel} increased to ${currentValue.toFixed(3)} (threshold: ${threshold})`;
    } else if (['fid', 'ttfb'].includes(metric)) {
      return `${metricName}${deviceLabel} increased to ${Math.round(currentValue)}ms (threshold: ${threshold}ms)`;
    } else {
      return `${metricName}${deviceLabel} increased to ${currentValue.toFixed(2)}s (threshold: ${threshold}s)`;
    }
  }

  // Check for performance regressions
  async checkForRegressions(siteId: string): Promise<void> {
    // Get enabled budgets with regression monitoring
    const budgets = await prisma.performanceBudget.findMany({
      where: {
        siteId,
        isEnabled: true,
        alertOnRegression: true
      }
    });

    for (const budget of budgets) {
      await this.analyzeMetricRegression(siteId, budget.metric, budget.deviceType);
    }
  }

  // Analyze metric for regression
  private async analyzeMetricRegression(siteId: string, metricName: string, deviceType: string): Promise<void> {
    const deviceFilter = deviceType === 'both' ? {} : { deviceType };

    // Get recent metrics (last 24 hours)
    const recentMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        ...deviceFilter,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        [metricName]: { not: null }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    // Get baseline metrics (7-14 days ago)
    const baselineMetrics = await prisma.performanceMetric.findMany({
      where: {
        siteId,
        ...deviceFilter,
        timestamp: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        [metricName]: { not: null }
      },
      take: 20
    });

    if (recentMetrics.length < 3 || baselineMetrics.length < 3) {
      return; // Not enough data for regression analysis
    }

    // Calculate averages
    const recentAvg = this.calculateAverage(recentMetrics, metricName);
    const baselineAvg = this.calculateAverage(baselineMetrics, metricName);

    if (recentAvg === null || baselineAvg === null) return;

    // Check for significant regression (20% worse)
    let isRegression = false;
    if (metricName === 'performanceScore') {
      isRegression = recentAvg < baselineAvg * 0.8; // 20% drop in score
    } else {
      isRegression = recentAvg > baselineAvg * 1.2; // 20% increase in time/shift
    }

    if (isRegression) {
      const message = `Performance regression detected: ${metricName} changed from ${baselineAvg.toFixed(2)} to ${recentAvg.toFixed(2)} (${deviceType})`;

      await prisma.alert.create({
        data: {
          siteId,
          type: 'warning',
          metric: metricName,
          threshold: baselineAvg,
          currentValue: recentAvg,
          message
        }
      });

      console.log(`📈 Regression detected for site ${siteId}: ${message}`);
    }
  }

  // Calculate average of a metric from performance data
  private calculateAverage(metrics: any[], metricName: string): number | null {
    const values = metrics
      .map(m => m[metricName])
      .filter(v => v !== null && v !== undefined) as number[];

    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  // Get all alerts for a site
  async getAlertsForSite(siteId: string, includeResolved = false): Promise<any[]> {
    return prisma.alert.findMany({
      where: {
        siteId,
        ...(includeResolved ? {} : { isResolved: false })
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  // Resolve an alert
  async resolveAlert(alertId: string): Promise<void> {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date()
      }
    });
  }

  // Process performance metric and check for alerts
  async processMetric(siteId: string, metric: any): Promise<void> {
    const deviceType = metric.deviceType;

    // Check each metric against thresholds
    const metricsToCheck = ['performanceScore', 'lcp', 'cls', 'fid', 'fcp', 'ttfb', 'speedIndex'];

    for (const metricName of metricsToCheck) {
      const value = metric[metricName];
      if (value !== null && value !== undefined) {
        await this.checkMetricThresholds(siteId, metricName, deviceType, value);
      }
    }
  }
}

export const alertService = new AlertService();