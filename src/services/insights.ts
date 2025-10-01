import { logger } from '../utils/logger';
import { recommendationsService, Recommendation } from './recommendations';
import { anomalyDetectorService, Anomaly } from './anomalyDetector';
import { prisma } from './database';

export interface SiteInsights {
  siteId: string;
  siteName: string;
  summary: {
    criticalIssues: number;
    warnings: number;
    activeAnomalies: number;
    overallHealth: 'critical' | 'warning' | 'good';
  };
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  prioritizedActions: PrioritizedAction[];
}

export interface PrioritizedAction {
  priority: number; // 1-10, higher is more urgent
  type: 'recommendation' | 'anomaly';
  id: string;
  title: string;
  description: string;
  estimatedImpact?: string;
  actionableSteps?: string[];
}

export class InsightsService {
  /**
   * Get comprehensive insights for a site
   */
  async getSiteInsights(siteId: string): Promise<SiteInsights> {
    // Get site details
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Get recommendations and anomalies
    const [recommendations, anomalies] = await Promise.all([
      recommendationsService.getActiveRecommendations(siteId),
      anomalyDetectorService.getActiveAnomalies(siteId)
    ]);

    // Calculate summary
    const summary = this.calculateSummary(recommendations, anomalies);

    // Generate prioritized actions
    const prioritizedActions = this.prioritizeActions(recommendations, anomalies);

    return {
      siteId,
      siteName: site.name,
      summary,
      recommendations,
      anomalies,
      prioritizedActions
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    recommendations: Recommendation[],
    anomalies: Anomaly[]
  ): SiteInsights['summary'] {
    const criticalIssues = recommendations.filter(r => r.severity === 'critical').length;
    const warnings = recommendations.filter(r => r.severity === 'warning').length;
    const activeAnomalies = anomalies.length;

    let overallHealth: 'critical' | 'warning' | 'good';

    if (criticalIssues > 0 || activeAnomalies > 2) {
      overallHealth = 'critical';
    } else if (warnings > 2 || activeAnomalies > 0) {
      overallHealth = 'warning';
    } else {
      overallHealth = 'good';
    }

    return {
      criticalIssues,
      warnings,
      activeAnomalies,
      overallHealth
    };
  }

  /**
   * Prioritize actions based on impact and urgency
   */
  private prioritizeActions(
    recommendations: Recommendation[],
    anomalies: Anomaly[]
  ): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];

    // Add recommendations with priority
    recommendations.forEach(rec => {
      let priority = 5; // Base priority

      // Increase priority for critical issues
      if (rec.severity === 'critical') {
        priority += 3;
      } else if (rec.severity === 'warning') {
        priority += 1;
      }

      // Increase priority for high-impact metrics
      if (rec.metric === 'LCP' || rec.metric === 'CLS') {
        priority += 2;
      }

      actions.push({
        priority,
        type: 'recommendation',
        id: rec.id!,
        title: rec.title,
        description: rec.description,
        estimatedImpact: rec.estimatedImpact,
        actionableSteps: rec.actionableSteps
      });
    });

    // Add anomalies with priority
    anomalies.forEach(anomaly => {
      let priority = 6; // Anomalies are generally more urgent

      // Increase priority based on confidence
      if (anomaly.confidence > 0.95) {
        priority += 3;
      } else if (anomaly.confidence > 0.90) {
        priority += 2;
      } else {
        priority += 1;
      }

      // Increase priority for critical metrics
      if (anomaly.metric === 'LCP' || anomaly.metric === 'CLS' || anomaly.metric === 'PERFORMANCE') {
        priority += 1;
      }

      actions.push({
        priority,
        type: 'anomaly',
        id: anomaly.id!,
        title: `Anomaly Detected: ${anomaly.metric} Spike`,
        description: `${anomaly.metric} has increased to ${anomaly.currentValue.toFixed(2)}, which is ${anomaly.standardDeviations.toFixed(1)} standard deviations above normal (expected: ${anomaly.expectedMin.toFixed(2)}-${anomaly.expectedMax.toFixed(2)}). Confidence: ${(anomaly.confidence * 100).toFixed(1)}%`,
        estimatedImpact: `This represents a significant performance regression`
      });
    });

    // Sort by priority (highest first)
    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Run full analysis for a site (detect anomalies + generate recommendations)
   */
  async runFullAnalysis(siteId: string): Promise<SiteInsights> {
    logger.info(`Running full analysis for site ${siteId}`);

    // Auto-resolve old anomalies first
    await anomalyDetectorService.autoResolveOldAnomalies(siteId);

    // Detect new anomalies (this will trigger recommendations if anomalies found)
    await anomalyDetectorService.detectAnomalies(siteId);

    // Generate recommendations (in case no anomalies but still issues)
    await recommendationsService.generateRecommendations(siteId);

    // Return comprehensive insights
    return await this.getSiteInsights(siteId);
  }

  /**
   * Get insights for all monitored sites
   */
  async getAllSitesInsights(): Promise<SiteInsights[]> {
    const sites = await prisma.site.findMany({
      where: { monitoringEnabled: true }
    });

    const insights = await Promise.all(
      sites.map(site => this.getSiteInsights(site.id))
    );

    // Sort by health (worst first)
    return insights.sort((a, b) => {
      const healthScore = { critical: 3, warning: 2, good: 1 };
      return healthScore[b.summary.overallHealth] - healthScore[a.summary.overallHealth];
    });
  }

  /**
   * Get health score for a site (0-100)
   */
  async getHealthScore(siteId: string): Promise<number> {
    const insights = await this.getSiteInsights(siteId);

    // Get latest performance score
    const latestMetric = await prisma.performanceMetric.findFirst({
      where: { siteId },
      orderBy: { timestamp: 'desc' }
    });

    let baseScore = latestMetric?.performance || 50;

    // Deduct points for issues
    const criticalPenalty = insights.summary.criticalIssues * 10;
    const warningPenalty = insights.summary.warnings * 5;
    const anomalyPenalty = insights.summary.activeAnomalies * 8;

    const healthScore = Math.max(0, baseScore - criticalPenalty - warningPenalty - anomalyPenalty);

    return Math.round(healthScore);
  }

  /**
   * Get top issues across all sites (for dashboard overview)
   */
  async getTopIssuesAcrossSites(limit: number = 10): Promise<{
    metric: string;
    affectedSites: number;
    averageSeverity: string;
    description: string;
  }[]> {
    const allRecommendations = await prisma.recommendation.findMany({
      where: { status: 'active' }
    });

    // Group by metric
    const metricGroups = new Map<string, {
      sites: Set<string>;
      severities: string[];
      description: string;
    }>();

    allRecommendations.forEach(rec => {
      if (!metricGroups.has(rec.metric)) {
        metricGroups.set(rec.metric, {
          sites: new Set(),
          severities: [],
          description: rec.description
        });
      }

      const group = metricGroups.get(rec.metric)!;
      group.sites.add(rec.siteId);
      group.severities.push(rec.severity);
    });

    // Convert to array and sort
    const issues = Array.from(metricGroups.entries())
      .map(([metric, data]) => {
        const criticalCount = data.severities.filter(s => s === 'critical').length;
        const warningCount = data.severities.filter(s => s === 'warning').length;

        let averageSeverity = 'info';
        if (criticalCount > data.severities.length / 2) {
          averageSeverity = 'critical';
        } else if (warningCount > 0) {
          averageSeverity = 'warning';
        }

        return {
          metric,
          affectedSites: data.sites.size,
          averageSeverity,
          description: data.description
        };
      })
      .sort((a, b) => b.affectedSites - a.affectedSites)
      .slice(0, limit);

    return issues;
  }
}

export const insightsService = new InsightsService();
