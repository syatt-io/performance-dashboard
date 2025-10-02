'use client';

import React, { useState, memo, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { PerformanceMetric } from '../lib/api';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

interface MetricsChartProps {
  metrics: PerformanceMetric[];
  metric: 'lcp' | 'fid' | 'cls' | 'tbt' | 'fcp' | 'speedIndex' | 'performanceScore' | 'imageOptimizationScore' | 'themeAssetSize' | 'thirdPartyBlockingTime' | 'inp';
  title: string;
  unit?: string;
  showTrend?: boolean;
  height?: number;
  dateRange?: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  };
  onDateRangeChange?: (range: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  }) => void;
}

// Helper function to format timestamps based on time range
function formatTimestamp(timestamp: string, range: string): string {
  const date = new Date(timestamp);

  switch (range) {
    case '1h':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '24h':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '7d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case '30d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
}

// Calculate metric statistics
function calculateMetricStats(data: any[], metric: string) {
  if (data.length < 2) {
    return { trend: 'stable', changePercent: null, average: 'N/A' };
  }

  const values = data
    .map(d => d.mobile || d.desktop)
    .filter(v => v !== null && v !== undefined);

  if (values.length === 0) {
    return { trend: 'stable', changePercent: null, average: 'N/A' };
  }

  const average = (values.reduce((a, b) => a + b, 0) / values.length);
  const formattedAverage = metric === 'cls' ? average.toFixed(3) :
                          (metric === 'tbt' || metric === 'fid') ? average.toFixed(0) :
                          average.toFixed(2);

  // Calculate trend based on first vs last value
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const changePercent = ((lastValue - firstValue) / firstValue) * 100;

  let trend: 'up' | 'down' | 'stable';
  if (Math.abs(changePercent) < 5) {
    trend = 'stable';
  } else if (changePercent > 0) {
    // For performance metrics, up is generally bad (higher LCP, CLS is worse)
    // For performance score, up is good
    trend = metric === 'performanceScore' ? 'down' : 'up'; // Flip for display logic
  } else {
    trend = metric === 'performanceScore' ? 'up' : 'down'; // Flip for display logic
  }

  return { trend, changePercent, average: formattedAverage };
}

// Get metric thresholds for reference lines
function getMetricThresholds(metric: string) {
  switch (metric) {
    case 'lcp':
      return { good: 2.5, poor: 4.0 };
    case 'fid':
      return { good: 100, poor: 300 };
    case 'fcp':
      return { good: 1.8, poor: 3.0 };
    case 'speedIndex':
      return { good: 3.4, poor: 5.8 };
    case 'cls':
      return { good: 0.1, poor: 0.25 };
    case 'tbt':
      return { good: 200, poor: 600 };
    case 'performanceScore':
      return { good: 90, poor: 50 };
    case 'imageOptimizationScore':
      return { good: 80, poor: 50 };
    case 'themeAssetSize':
      return { good: 1000000, poor: 3000000 }; // 1MB good, 3MB poor
    case 'thirdPartyBlockingTime':
      return { good: 200, poor: 600 }; // 200ms good, 600ms poor
    default:
      return {};
  }
}

const MetricsChart = memo(function MetricsChart({
  metrics,
  metric,
  title,
  unit = '',
  showTrend = true,
  height = 300,
  dateRange = {
    startDate: null,
    endDate: null,
    timeRange: '24h'
  },
  onDateRangeChange
}: MetricsChartProps) {
  const [selectedRange, setSelectedRange] = useState(dateRange);

  // Helper to get the actual metric value (handles aliases like speedIndex -> si)
  const getMetricValue = (m: PerformanceMetric, metricName: string): number | undefined => {
    if (metricName === 'speedIndex') {
      return m.si || m.speedIndex;
    }
    if (metricName === 'performanceScore') {
      return m.performance || m.performanceScore;
    }
    return m[metricName as keyof PerformanceMetric] as number | undefined;
  };

  // Process data for time-series visualization with memoization
  const processedData = useMemo(() => {
    return metrics
      .filter(m => {
        const value = getMetricValue(m, metric);
        return value !== null && value !== undefined;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(m => ({
        timestamp: m.timestamp,
        formattedTime: formatTimestamp(m.timestamp, selectedRange.timeRange),
        mobile: m.deviceType === 'mobile' ? getMetricValue(m, metric) : null,
        desktop: m.deviceType === 'desktop' ? getMetricValue(m, metric) : null,
        rawTimestamp: new Date(m.timestamp).getTime()
      }));
  }, [metrics, metric, selectedRange.timeRange]);

  // Merge mobile and desktop data points by timestamp with memoization
  const data = useMemo(() => {
    const timeGroups = processedData.reduce((acc, curr) => {
      const key = curr.formattedTime;
      if (!acc[key]) {
        acc[key] = {
          timestamp: curr.formattedTime,
          rawTimestamp: curr.rawTimestamp,
          mobile: null,
          desktop: null
        };
      }
      if (curr.mobile !== null) acc[key].mobile = curr.mobile;
      if (curr.desktop !== null) acc[key].desktop = curr.desktop;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(timeGroups).sort((a: any, b: any) => a.rawTimestamp - b.rawTimestamp);
  }, [processedData]);

  // Calculate trend and statistics with memoization
  const stats = useMemo(() => {
    return calculateMetricStats(data, metric);
  }, [data, metric]);

  // Get thresholds for reference lines
  const thresholds = useMemo(() => {
    return getMetricThresholds(metric);
  }, [metric]);

  const handleRangeChange = (range: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  }) => {
    setSelectedRange(range);
    onDateRangeChange?.(range);
  };

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8 text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {showTrend && data.length > 1 && (
            <div className="flex items-center mt-1 space-x-2">
              <span className="text-sm text-gray-600">Avg: {stats.average}{unit}</span>
              <div className="flex items-center">
                {stats.trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
                {stats.trend === 'down' && <TrendingDown className="w-3 h-3 text-green-500" />}
                {stats.trend === 'stable' && <Minus className="w-3 h-3 text-gray-500" />}
                <span className={`text-xs ml-1 ${
                  stats.trend === 'up' ? 'text-red-600' :
                  stats.trend === 'down' ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  {stats.changePercent !== null ? `${stats.changePercent > 0 ? '+' : ''}${stats.changePercent.toFixed(1)}%` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {onDateRangeChange && (
          <DateRangePicker
            value={selectedRange}
            onChange={handleRangeChange}
            showTimeRanges={true}
          />
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value}${unit}`}
          />

          {/* Reference lines for thresholds */}
          {thresholds.good && (
            <ReferenceLine
              y={thresholds.good}
              stroke="#10b981"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{ value: `Good (${thresholds.good}${unit})`, position: 'top', fontSize: 10 }}
            />
          )}
          {thresholds.poor && (
            <ReferenceLine
              y={thresholds.poor}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{ value: `Poor (${thresholds.poor}${unit})`, position: 'top', fontSize: 10 }}
            />
          )}

          <Tooltip
            formatter={(value, name) => [
              `${typeof value === 'number' ?
                value.toFixed(metric === 'cls' ? 3 : (metric === 'tbt' || metric === 'fid') ? 0 : 2) :
                value}${unit}`,
              name === 'mobile' ? 'Mobile' : 'Desktop'
            ]}
            labelFormatter={(value) => `Time: ${value}`}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />

          <Legend />

          <Line
            type="monotone"
            dataKey="mobile"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5, fill: '#3b82f6' }}
            connectNulls={false}
            name="Mobile"
          />
          <Line
            type="monotone"
            dataKey="desktop"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 5, fill: '#10b981' }}
            connectNulls={false}
            name="Desktop"
          />
        </LineChart>
      </ResponsiveContainer>

      {data.length > 0 && (
        <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
          <div className="flex space-x-4">
            <span>Data points: {data.filter(d => d.mobile !== null || d.desktop !== null).length}</span>
            <span>Time range: {selectedRange.timeRange === 'custom' ? 'Custom' : selectedRange.timeRange}</span>
          </div>
          {thresholds.good && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Good: ≤{thresholds.good}{unit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MetricsChart;