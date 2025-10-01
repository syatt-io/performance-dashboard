'use client';

import React, { memo, useCallback } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import { Site, MetricsSummary, PerformanceMetric } from '../lib/api';
import MetricsChart from './MetricsChart';
import ShopifyMetrics from './ShopifyMetrics';

interface SiteDashboardProps {
  site: Site;
  summary: MetricsSummary;
  metrics: PerformanceMetric[];
  collecting: boolean;
  collectionError: string | null;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  };
  onCollectMetrics: () => void;
  onDateRangeChange: (range: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  }) => void;
  onRetryCollection: () => void;
}

const SiteDashboard = memo(function SiteDashboard({
  site,
  summary,
  metrics,
  collecting,
  collectionError,
  dateRange,
  onCollectMetrics,
  onDateRangeChange,
  onRetryCollection
}: SiteDashboardProps) {
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, []);

  const handleDateRangeChange = useCallback((range: any) => {
    onDateRangeChange(range);
  }, [onDateRangeChange]);

  return (
    <div className="space-y-6">
      {/* Site Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{summary.siteName}</h2>
            <p className="text-gray-600">{site.url}</p>
          </div>

          <button
            onClick={onCollectMetrics}
            disabled={collecting}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Zap className={`w-4 h-4 ${collecting ? 'animate-spin' : ''}`} />
            <span>{collecting ? 'Running Test...' : 'Run Test'}</span>
          </button>
        </div>

        {/* Loading Progress Bar */}
        {collecting && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Performance Test in Progress</span>
              <span className="text-sm text-gray-500">This may take 30-60 seconds</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-ping"></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Running Lighthouse analysis on mobile and desktop...
            </div>
          </div>
        )}

        {/* Error message display */}
        {collectionError && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {collectionError.includes('temporarily') ? 'Service Temporarily Unavailable' : 'Performance Test Failed'}
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  {collectionError}
                </div>
                {collectionError.includes('temporarily') && (
                  <div className="mt-3">
                    <button
                      onClick={onRetryCollection}
                      className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md border border-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {summary.lastUpdated && (
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {new Date(summary.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">LCP</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">
              {summary.coreWebVitals.lcp.value?.toFixed(2) || 'N/A'}
              {summary.coreWebVitals.lcp.value && 's'}
            </div>
            <div className={`text-sm ${getStatusColor(summary.coreWebVitals.lcp.status)}`}>
              {summary.coreWebVitals.lcp.status.replace('-', ' ')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">INP</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">
              {summary.coreWebVitals.inp?.value?.toFixed(0) || summary.coreWebVitals.fid?.value?.toFixed(0) || 'N/A'}
              {(summary.coreWebVitals.inp?.value || summary.coreWebVitals.fid?.value) && 'ms'}
            </div>
            <div className={`text-sm ${getStatusColor(summary.coreWebVitals.inp?.status || summary.coreWebVitals.fid?.status || 'unknown')}`}>
              {(summary.coreWebVitals.inp?.status || summary.coreWebVitals.fid?.status || 'unknown').replace('-', ' ')}
            </div>
            <div className="text-xs text-gray-400 mt-1">Interaction to Next Paint</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">CLS</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">
              {summary.coreWebVitals.cls.value?.toFixed(3) || 'N/A'}
            </div>
            <div className={`text-sm ${getStatusColor(summary.coreWebVitals.cls.status)}`}>
              {summary.coreWebVitals.cls.status.replace('-', ' ')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">TBT</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">
              {summary.coreWebVitals?.tbt?.value?.toFixed(0) || 'N/A'}
              {summary.coreWebVitals?.tbt?.value && 'ms'}
            </div>
            <div className={`text-sm ${getStatusColor(summary.coreWebVitals?.tbt?.status || 'unknown')}`}>
              {summary.coreWebVitals?.tbt?.status?.replace('-', ' ') || 'Unknown'}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Alerts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Alerts</h3>
          <div className="text-sm text-gray-500">
            {((summary.alerts?.critical || 0) + (summary.alerts?.warning || 0) + (summary.alerts?.info || 0)) || 0} total
          </div>
        </div>

        {((summary.alerts?.critical || 0) + (summary.alerts?.warning || 0) + (summary.alerts?.info || 0)) === 0 ? (
          <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 text-green-600">✓</div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                No active alerts. Your site is performing well!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(summary.alerts?.critical || 0) > 0 && (
              <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">
                    {summary.alerts.critical} Critical Alert{summary.alerts.critical !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-sm text-red-700 mt-1">
                    Performance metrics have exceeded critical thresholds and require immediate attention.
                  </p>
                </div>
              </div>
            )}

            {(summary.alerts?.warning || 0) > 0 && (
              <div className="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">
                    {summary.alerts.warning} Warning Alert{summary.alerts.warning !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Performance metrics are approaching concerning levels and should be monitored.
                  </p>
                </div>
              </div>
            )}

            {(summary.alerts?.info || 0) > 0 && (
              <div className="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    {summary.alerts.info} Info Alert{summary.alerts.info !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Informational notices about your site's performance metrics.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile vs Desktop Performance Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mobile vs Desktop Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mobile Performance */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-blue-600 uppercase tracking-wide flex items-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
              Mobile Performance
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Performance Score</div>
                <div className="text-lg font-bold text-gray-900">
                  {summary.performanceScore.mobile || 'N/A'}
                  {summary.performanceScore.mobile && '/100'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">LCP</div>
                <div className="text-lg font-bold text-gray-900">
                  {summary.coreWebVitals.lcp.value?.toFixed(2) || 'N/A'}
                  {summary.coreWebVitals.lcp.value && 's'}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Performance */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-green-600 uppercase tracking-wide flex items-center">
              <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
              Desktop Performance
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Performance Score</div>
                <div className="text-lg font-bold text-gray-900">
                  {summary.performanceScore.desktop || 'N/A'}
                  {summary.performanceScore.desktop && '/100'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">LCP</div>
                <div className="text-lg font-bold text-gray-900">
                  {metrics.filter(m => m.deviceType === 'desktop' && m.lcp).length > 0
                    ? (metrics.filter(m => m.deviceType === 'desktop' && m.lcp)
                        .slice(-1)[0]?.lcp?.toFixed(2) || 'N/A')
                    : 'N/A'}
                  {metrics.filter(m => m.deviceType === 'desktop' && m.lcp).length > 0 && 's'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Difference Insight */}
        {summary.performanceScore.mobile && summary.performanceScore.desktop && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center">
              {summary.performanceScore.mobile > summary.performanceScore.desktop ? (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  📱 Mobile performs {summary.performanceScore.mobile - summary.performanceScore.desktop} points better
                </div>
              ) : summary.performanceScore.desktop > summary.performanceScore.mobile ? (
                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  💻 Desktop performs {summary.performanceScore.desktop - summary.performanceScore.mobile} points better
                </div>
              ) : (
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                  📊 Mobile and Desktop perform equally
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Performance Score Chart */}
        <MetricsChart
          metrics={metrics}
          metric="performanceScore"
          title="Performance Score Trends"
          unit="/100"
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          height={300}
        />

        {/* Core Web Vitals Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetricsChart
            metrics={metrics}
            metric="lcp"
            title="Largest Contentful Paint (LCP)"
            unit="s"
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />

          <MetricsChart
            metrics={metrics}
            metric="inp"
            title="Interaction to Next Paint (INP)"
            unit="ms"
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />

          <MetricsChart
            metrics={metrics}
            metric="cls"
            title="Cumulative Layout Shift (CLS)"
            unit=""
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />

          <MetricsChart
            metrics={metrics}
            metric="tbt"
            title="Total Blocking Time (TBT)"
            unit="ms"
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />
        </div>

        {/* Additional Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetricsChart
            metrics={metrics}
            metric="speedIndex"
            title="Speed Index"
            unit="s"
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />

          <MetricsChart
            metrics={metrics}
            metric="fcp"
            title="First Contentful Paint (FCP)"
            unit="s"
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            height={250}
          />
        </div>

        {/* Shopify-specific Metrics */}
        <ShopifyMetrics metrics={metrics} />
      </div>
    </div>
  );
});

export default SiteDashboard;