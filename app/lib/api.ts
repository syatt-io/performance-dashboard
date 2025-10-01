// Determine API base URL based on environment
// In development: use localhost:3000
// In production: use same origin (since frontend and backend are served from the same domain)
const getAPIBase = () => {
  if (typeof window === 'undefined') {
    // Server-side (build time)
    return '/api';
  }

  // Client-side runtime detection
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isDevelopment ? 'http://localhost:3000/api' : '/api';
};

const API_BASE = getAPIBase();

export interface Site {
  id: string;
  name: string;
  url: string;
  shopifyDomain?: string;
  categoryUrl?: string | null;
  productUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    metrics: number;
    alerts: number;
  };
}

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  deviceType: 'mobile' | 'desktop';
  pageType?: 'homepage' | 'category' | 'product'; // Type of page tested
  lcp?: number;
  fid?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  tbt?: number;
  ttfb?: number;
  si?: number; // Speed Index (stored as 'si' in database)
  speedIndex?: number; // Alias for si
  tti?: number;
  performance?: number; // Performance score
  performanceScore?: number; // Alias for performance
  pageLoadTime?: number;
  pageSize?: number;
  requests?: number;
  // Shopify-specific metrics
  imageOptimizationScore?: number;
  themeAssetSize?: number;
  thirdPartyBlockingTime?: number;
  location?: string;
  testLocation?: string;
}

export interface MetricsSummary {
  siteId: string;
  siteName: string;
  period: string;
  lastUpdated: string | null;
  coreWebVitals: {
    lcp: { value: number | null; status: string; trend: string };
    fid?: { value: number | null; status: string; trend: string };
    inp?: { value: number | null; status: string; trend: string };
    cls: { value: number | null; status: string; trend: string };
    tbt: { value: number | null; status: string; trend: string };
    fcp: { value: number | null; status: string; trend: string };
    speedIndex: { value: number | null; status: string; trend: string };
  };
  performanceScore: {
    mobile: number | null;
    desktop: number | null;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  metricsCount: number;
}

export const api = {
  async getSites(): Promise<{ sites: Site[]; total: number }> {
    const res = await fetch(`${API_BASE}/sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    return res.json();
  },

  async createSite(site: { name: string; url: string; shopifyDomain?: string; categoryUrl?: string; productUrl?: string }): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(site),
    });
    if (!res.ok) throw new Error('Failed to create site');
    return res.json();
  },

  async getSite(id: string): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${id}`);
    if (!res.ok) throw new Error('Failed to fetch site');
    return res.json();
  },

  async updateSite(id: string, updates: { name?: string; url?: string; shopifyDomain?: string; categoryUrl?: string; productUrl?: string; isActive?: boolean }): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update site');
    return res.json();
  },

  async deleteSite(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sites/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete site');
  },

  async getMetrics(siteId: string, params?: {
    timeRange?: string;
    deviceType?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ metrics: PerformanceMetric[]; total: number }> {
    const searchParams = new URLSearchParams(params as any);
    const res = await fetch(`${API_BASE}/metrics/sites/${siteId}?${searchParams}`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  async collectMetrics(siteId: string, deviceType?: 'mobile' | 'desktop'): Promise<{
    message: string;
    jobId: string;
    siteId: string;
    url: string;
  }> {
    const res = await fetch(`${API_BASE}/metrics/sites/${siteId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType }),
    });
    if (!res.ok) {
      try {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start collection');
      } catch (parseError) {
        // If JSON parsing fails, use generic message
        if (parseError instanceof Error && parseError.message && !parseError.message.includes('Unexpected token')) {
          throw parseError; // Re-throw if it's our custom error
        }
        throw new Error('Failed to start collection');
      }
    }
    return res.json();
  },

  async collectAllMetrics(): Promise<{
    message: string;
    totalSites: number;
    startedJobs: number;
  }> {
    const res = await fetch(`${API_BASE}/metrics/collect-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to start collection for all sites');
    return res.json();
  },

  async getMetricsSummary(siteId: string, period?: string): Promise<MetricsSummary> {
    const params = period ? `?period=${period}` : '';
    const res = await fetch(`${API_BASE}/metrics/sites/${siteId}/summary${params}`);
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },

  async getTrends(siteId: string, params?: {
    timeRange?: string;
    aggregation?: 'hourly' | 'daily' | 'weekly';
  }): Promise<{
    siteId: string;
    timeRange: string;
    aggregation: string;
    trends: Array<{
      timestamp: string;
      deviceType: string;
      avgLcp: number | null;
      avgCls: number | null;
      avgFid: number | null;
      avgPerformanceScore: number | null;
      avgFcp: number | null;
      avgTtfb: number | null;
      avgSpeedIndex: number | null;
      dataPoints: number;
    }>;
    total: number;
  }> {
    const searchParams = new URLSearchParams(params as any);
    const res = await fetch(`${API_BASE}/metrics/sites/${siteId}/trends?${searchParams}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },

  async getComparison(params: {
    siteIds: string[];
    timeRange?: string;
    metric?: string;
  }): Promise<{
    metric: string;
    timeRange: string;
    comparison: Array<{
      siteId: string;
      siteName: string;
      siteUrl: string;
      metrics: {
        performanceScore: { mobile: number | null; desktop: number | null };
        lcp: { mobile: number | null; desktop: number | null };
        cls: { mobile: number | null; desktop: number | null };
        fid: { mobile: number | null; desktop: number | null };
        fcp: { mobile: number | null; desktop: number | null };
        ttfb: { mobile: number | null; desktop: number | null };
        speedIndex: { mobile: number | null; desktop: number | null };
      };
      totalDataPoints: number;
      lastUpdated: string | null;
    }>;
    siteCount: number;
  }> {
    // Build comparison data with all metrics for each site
    const { timeRange = '24h', siteIds } = params;

    const comparisonPromises = siteIds.map(async siteId => {
      try {
        const [summary, site, metricsData] = await Promise.all([
          this.getMetricsSummary(siteId, timeRange),
          this.getSite(siteId),
          this.getMetrics(siteId, { timeRange, limit: 50 })
        ]);

        // Separate mobile and desktop metrics
        const mobileMetrics = metricsData.metrics.filter(m => m.deviceType === 'mobile');
        const desktopMetrics = metricsData.metrics.filter(m => m.deviceType === 'desktop');

        // Calculate averages for all metrics
        const calculateAverage = (metrics: any[], metricKey: string) => {
          const values = metrics.map(m => m[metricKey]).filter(v => v !== null && v !== undefined) as number[];
          return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
        };

        return {
          siteId,
          siteName: site.name,
          siteUrl: site.url,
          metrics: {
            performanceScore: {
              mobile: summary.performanceScore.mobile,
              desktop: summary.performanceScore.desktop
            },
            lcp: {
              mobile: calculateAverage(mobileMetrics, 'lcp'),
              desktop: calculateAverage(desktopMetrics, 'lcp')
            },
            cls: {
              mobile: calculateAverage(mobileMetrics, 'cls'),
              desktop: calculateAverage(desktopMetrics, 'cls')
            },
            fid: {
              mobile: calculateAverage(mobileMetrics, 'fid'),
              desktop: calculateAverage(desktopMetrics, 'fid')
            },
            fcp: {
              mobile: calculateAverage(mobileMetrics, 'fcp'),
              desktop: calculateAverage(desktopMetrics, 'fcp')
            },
            ttfb: {
              mobile: calculateAverage(mobileMetrics, 'ttfb'),
              desktop: calculateAverage(desktopMetrics, 'ttfb')
            },
            speedIndex: {
              mobile: calculateAverage(mobileMetrics, 'speedIndex'),
              desktop: calculateAverage(desktopMetrics, 'speedIndex')
            }
          },
          totalDataPoints: metricsData.metrics.length,
          lastUpdated: metricsData.metrics[0]?.timestamp || null
        };
      } catch (error) {
        console.error(`Failed to get data for site ${siteId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(comparisonPromises);
    const comparison = results.filter(result => result !== null) as any[];

    return {
      metric: 'all',
      timeRange,
      comparison,
      siteCount: comparison.length
    };
  },

  async getJobStatus(): Promise<{
    timestamp: string;
    sites: Array<{
      siteId: string;
      siteName: string;
      siteUrl: string;
      status: 'idle' | 'pending' | 'testing';
      progress: number;
      activeJobs: Array<{
        id: string;
        deviceType: string;
        status: string;
        scheduledAt: string;
        startedAt: string | null;
      }>;
      jobCount: number;
    }>;
    totalSites: number;
    activeSites: number;
  }> {
    const res = await fetch(`${API_BASE}/metrics/job-status`);
    if (!res.ok) throw new Error('Failed to fetch job status');
    return res.json();
  },
};