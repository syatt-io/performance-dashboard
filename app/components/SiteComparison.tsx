'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, Site } from '../lib/api';
import { TrendingUp, TrendingDown, BarChart3, CheckCircle2, X } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

interface SiteComparisonProps {
  sites: Site[];
  onClose?: () => void;
}

interface ComparisonData {
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
}

interface MetricCellProps {
  mobileValue: number | null;
  desktopValue: number | null;
  metric: string;
}

function MetricCell({ mobileValue, desktopValue, metric }: MetricCellProps) {
  const getScoreColor = (value: number | null, metric: string) => {
    if (value === null) return 'text-gray-500';

    switch (metric) {
      case 'performanceScore':
        if (value >= 90) return 'text-green-600';
        if (value >= 75) return 'text-yellow-600';
        return 'text-red-600';
      case 'lcp':
        if (value <= 2.5) return 'text-green-600';
        if (value <= 4.0) return 'text-yellow-600';
        return 'text-red-600';
      case 'cls':
        if (value <= 0.1) return 'text-green-600';
        if (value <= 0.25) return 'text-yellow-600';
        return 'text-red-600';
      case 'fid':
        if (value <= 100) return 'text-green-600';
        if (value <= 300) return 'text-yellow-600';
        return 'text-red-600';
      case 'fcp':
        if (value <= 1.8) return 'text-green-600';
        if (value <= 3.0) return 'text-yellow-600';
        return 'text-red-600';
      case 'ttfb':
        if (value <= 800) return 'text-green-600';
        if (value <= 1800) return 'text-yellow-600';
        return 'text-red-600';
      case 'speedIndex':
        if (value <= 3.4) return 'text-green-600';
        if (value <= 5.8) return 'text-yellow-600';
        return 'text-red-600';
      default:
        return 'text-gray-700';
    }
  };

  const formatValue = (value: number | null, metric: string) => {
    if (value === null) return 'N/A';

    switch (metric) {
      case 'cls':
        return value.toFixed(3);
      case 'performanceScore':
        return Math.round(value).toString();
      case 'fid':
      case 'ttfb':
        return Math.round(value).toString();
      default:
        return value.toFixed(2);
    }
  };

  return (
    <div className="space-y-1">
      <div className={`text-xs font-medium ${getScoreColor(mobileValue, metric)}`}>
        <span className="text-gray-500">M:</span> {formatValue(mobileValue, metric)}
      </div>
      <div className={`text-xs font-medium ${getScoreColor(desktopValue, metric)}`}>
        <span className="text-gray-500">D:</span> {formatValue(desktopValue, metric)}
      </div>
    </div>
  );
}

export default function SiteComparison({ sites, onClose }: SiteComparisonProps) {
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('performanceScore');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: null as string | null,
    endDate: null as string | null,
    timeRange: '7d' as '1h' | '24h' | '7d' | '30d' | '90d' | 'custom'
  });

  const metricOptions = [
    { value: 'performanceScore', label: 'Performance Score', unit: '/100' },
    { value: 'lcp', label: 'Largest Contentful Paint', unit: 's' },
    { value: 'cls', label: 'Cumulative Layout Shift', unit: '' },
    { value: 'fid', label: 'First Input Delay', unit: 'ms' },
    { value: 'fcp', label: 'First Contentful Paint', unit: 's' },
    { value: 'ttfb', label: 'Time to First Byte', unit: 'ms' },
    { value: 'speedIndex', label: 'Speed Index', unit: 's' }
  ];

  // Auto-select first 3 sites by default
  useEffect(() => {
    if (sites.length > 0 && selectedSites.length === 0) {
      setSelectedSites(sites.slice(0, Math.min(3, sites.length)).map(site => site.id));
    }
  }, [sites]);

  useEffect(() => {
    if (selectedSites.length > 0) {
      loadComparisonData();
    }
  }, [selectedSites, selectedMetric, dateRange]);

  const loadComparisonData = async () => {
    if (selectedSites.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const params: any = {
        siteIds: selectedSites,
        metric: selectedMetric
      };

      if (dateRange.timeRange === 'custom' && dateRange.startDate && dateRange.endDate) {
        params.startDate = dateRange.startDate;
        params.endDate = dateRange.endDate;
      } else {
        params.timeRange = dateRange.timeRange;
      }

      const response = await api.getComparison(params);
      setComparisonData(response.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const prepareChartData = () => {
    return comparisonData.map(item => {
      const metricData = item.metrics[selectedMetric as keyof typeof item.metrics];
      return {
        name: item.siteName.length > 20 ? item.siteName.substring(0, 20) + '...' : item.siteName,
        fullName: item.siteName,
        mobile: metricData?.mobile,
        desktop: metricData?.desktop,
        siteId: item.siteId
      };
    });
  };

  const getMetricInfo = () => {
    return metricOptions.find(opt => opt.value === selectedMetric) || metricOptions[0];
  };

  const getScoreColor = (value: number | null, metric: string) => {
    if (value === null) return 'text-gray-500';

    switch (metric) {
      case 'performanceScore':
        if (value >= 90) return 'text-green-600';
        if (value >= 75) return 'text-yellow-600';
        return 'text-red-600';
      case 'lcp':
        if (value <= 2.5) return 'text-green-600';
        if (value <= 4.0) return 'text-yellow-600';
        return 'text-red-600';
      case 'cls':
        if (value <= 0.1) return 'text-green-600';
        if (value <= 0.25) return 'text-yellow-600';
        return 'text-red-600';
      default:
        return 'text-gray-700';
    }
  };

  const formatValue = (value: number | null, metric: string) => {
    if (value === null) return 'N/A';

    switch (metric) {
      case 'cls':
        return value.toFixed(3);
      case 'performanceScore':
        return Math.round(value).toString();
      case 'fid':
      case 'ttfb':
        return Math.round(value).toString();
      default:
        return value.toFixed(2);
    }
  };

  const getMetricValue = (item: ComparisonData, metric: string, deviceType: 'mobile' | 'desktop') => {
    const metricData = item.metrics[metric as keyof typeof item.metrics];
    return metricData?.[deviceType] || null;
  };

  const chartData = prepareChartData();
  const metricInfo = getMetricInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Site Performance Comparison</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Site Selection */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Sites to Compare ({selectedSites.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => toggleSiteSelection(site.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedSites.includes(site.id)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selectedSites.includes(site.id) && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                    {site.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metric</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {metricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                showTimeRanges={true}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-600">Loading comparison data...</div>
            </div>
          ) : selectedSites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Select at least one site to compare performance metrics
            </div>
          ) : (
            <>
              {/* Chart for Selected Metric */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {metricInfo.label} Comparison Chart
                </h3>

                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}${metricInfo.unit}`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          `${formatValue(value as number, selectedMetric)}${metricInfo.unit}`,
                          name === 'mobile' ? 'Mobile' : 'Desktop'
                        ]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item ? item.fullName : label;
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="mobile"
                        fill="#3b82f6"
                        name="Mobile"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="desktop"
                        fill="#10b981"
                        name="Desktop"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No data available for the selected sites and time range
                  </div>
                )}
              </div>

              {/* Comprehensive Metrics Table */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Complete Performance Comparison</h3>
                  <p className="text-sm text-gray-600 mt-1">All metrics for selected sites (Mobile / Desktop)</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                          Site
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Performance<br />Score
                          <div className="text-xs font-normal text-gray-400">/100</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          LCP<br />
                          <div className="text-xs font-normal text-gray-400">seconds</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CLS<br />
                          <div className="text-xs font-normal text-gray-400">score</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          FID<br />
                          <div className="text-xs font-normal text-gray-400">ms</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          FCP<br />
                          <div className="text-xs font-normal text-gray-400">seconds</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          TTFB<br />
                          <div className="text-xs font-normal text-gray-400">ms</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Speed Index<br />
                          <div className="text-xs font-normal text-gray-400">seconds</div>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonData.map((item) => (
                        <tr key={item.siteId} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.siteName}</div>
                              <div className="text-xs text-gray-500">{new URL(item.siteUrl).hostname}</div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'performanceScore', 'mobile')}
                              desktopValue={getMetricValue(item, 'performanceScore', 'desktop')}
                              metric="performanceScore"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'lcp', 'mobile')}
                              desktopValue={getMetricValue(item, 'lcp', 'desktop')}
                              metric="lcp"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'cls', 'mobile')}
                              desktopValue={getMetricValue(item, 'cls', 'desktop')}
                              metric="cls"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'fid', 'mobile')}
                              desktopValue={getMetricValue(item, 'fid', 'desktop')}
                              metric="fid"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'fcp', 'mobile')}
                              desktopValue={getMetricValue(item, 'fcp', 'desktop')}
                              metric="fcp"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'ttfb', 'mobile')}
                              desktopValue={getMetricValue(item, 'ttfb', 'desktop')}
                              metric="ttfb"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <MetricCell
                              mobileValue={getMetricValue(item, 'speedIndex', 'mobile')}
                              desktopValue={getMetricValue(item, 'speedIndex', 'desktop')}
                              metric="speedIndex"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-xs text-gray-500">
                              {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'Never'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.totalDataPoints} data points
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}