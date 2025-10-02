'use client';

import React, { useMemo } from 'react';
import { PerformanceMetric } from '../lib/api';
import { FileText, Package, Home } from 'lucide-react';

interface PerPageMetricsProps {
  metrics: PerformanceMetric[];
}

export default function PerPageMetrics({ metrics }: PerPageMetricsProps) {
  const pageMetrics = useMemo(() => {
    // Group metrics by pageType and deviceType
    const grouped: Record<string, {
      mobile: PerformanceMetric[];
      desktop: PerformanceMetric[];
    }> = {
      homepage: { mobile: [], desktop: [] },
      category: { mobile: [], desktop: [] },
      product: { mobile: [], desktop: [] }
    };

    metrics.forEach(metric => {
      const pageType = metric.pageType || 'homepage';
      if (grouped[pageType]) {
        grouped[pageType][metric.deviceType].push(metric);
      }
    });

    // Calculate averages for each pageType/deviceType combination
    const calculateAverage = (metrics: PerformanceMetric[], field: keyof PerformanceMetric): number | null => {
      const values = metrics
        .map(m => m[field])
        .filter(v => typeof v === 'number') as number[];

      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    return Object.entries(grouped).map(([pageType, devices]) => {
      const hasData = devices.mobile.length > 0 || devices.desktop.length > 0;
      if (!hasData) return null;

      return {
        pageType,
        mobile: {
          performanceScore: calculateAverage(devices.mobile, 'performance'),
          lcp: calculateAverage(devices.mobile, 'lcp'),
          cls: calculateAverage(devices.mobile, 'cls'),
          tbt: calculateAverage(devices.mobile, 'tbt'),
          fcp: calculateAverage(devices.mobile, 'fcp'),
          speedIndex: calculateAverage(devices.mobile, 'si'),
          count: devices.mobile.length
        },
        desktop: {
          performanceScore: calculateAverage(devices.desktop, 'performance'),
          lcp: calculateAverage(devices.desktop, 'lcp'),
          cls: calculateAverage(devices.desktop, 'cls'),
          tbt: calculateAverage(devices.desktop, 'tbt'),
          fcp: calculateAverage(devices.desktop, 'fcp'),
          speedIndex: calculateAverage(devices.desktop, 'si'),
          count: devices.desktop.length
        }
      };
    }).filter(Boolean);
  }, [metrics]);

  if (pageMetrics.length === 0) return null;

  const getPageIcon = (pageType: string) => {
    switch (pageType) {
      case 'homepage': return <Home className="w-5 h-5" />;
      case 'category': return <FileText className="w-5 h-5" />;
      case 'product': return <Package className="w-5 h-5" />;
      default: return <Home className="w-5 h-5" />;
    }
  };

  const getPageLabel = (pageType: string) => {
    switch (pageType) {
      case 'homepage': return 'Homepage';
      case 'category': return 'Category Page';
      case 'product': return 'Product Page';
      default: return pageType;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLCPColor = (lcp: number | null) => {
    if (lcp === null) return 'text-gray-400';
    if (lcp <= 2.5) return 'text-green-600';
    if (lcp <= 4.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCLSColor = (cls: number | null) => {
    if (cls === null) return 'text-gray-400';
    if (cls <= 0.1) return 'text-green-600';
    if (cls <= 0.25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTBTColor = (tbt: number | null) => {
    if (tbt === null) return 'text-gray-400';
    if (tbt <= 200) return 'text-green-600';
    if (tbt <= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFCPColor = (fcp: number | null) => {
    if (fcp === null) return 'text-gray-400';
    if (fcp <= 1.8) return 'text-green-600';
    if (fcp <= 3.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSIColor = (si: number | null) => {
    if (si === null) return 'text-gray-400';
    if (si <= 3.4) return 'text-green-600';
    if (si <= 5.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatValue = (value: number | null, unit: string = '', decimals: number = 2): string => {
    if (value === null) return 'N/A';
    return `${value.toFixed(decimals)}${unit}`;
  };

  return (
    <div className="mt-6 bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Performance by Page Type
      </h3>

      <div className="space-y-6">
        {pageMetrics.map((page: any) => (
          <div key={page.pageType} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
            <div className="flex items-center mb-4">
              <div className="mr-3 text-blue-600">
                {getPageIcon(page.pageType)}
              </div>
              <h4 className="text-md font-medium text-gray-900">
                {getPageLabel(page.pageType)}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mobile Metrics */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-gray-700">Mobile</h5>
                  {page.mobile.count > 0 && (
                    <span className="text-xs text-gray-500">
                      {page.mobile.count} test{page.mobile.count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {page.mobile.count > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Performance Score:</span>
                      <span className={`text-sm font-semibold ${getScoreColor(page.mobile.performanceScore)}`}>
                        {formatValue(page.mobile.performanceScore, '', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">LCP:</span>
                      <span className={`text-sm font-semibold ${getLCPColor(page.mobile.lcp)}`}>
                        {formatValue(page.mobile.lcp, 's')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">CLS:</span>
                      <span className={`text-sm font-semibold ${getCLSColor(page.mobile.cls)}`}>
                        {formatValue(page.mobile.cls, '', 3)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">TBT:</span>
                      <span className={`text-sm font-semibold ${getTBTColor(page.mobile.tbt)}`}>
                        {formatValue(page.mobile.tbt, 'ms', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">FCP:</span>
                      <span className={`text-sm font-semibold ${getFCPColor(page.mobile.fcp)}`}>
                        {formatValue(page.mobile.fcp, 's')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Speed Index:</span>
                      <span className={`text-sm font-semibold ${getSIColor(page.mobile.speedIndex)}`}>
                        {formatValue(page.mobile.speedIndex, 's')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No mobile data available</div>
                )}
              </div>

              {/* Desktop Metrics */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-gray-700">Desktop</h5>
                  {page.desktop.count > 0 && (
                    <span className="text-xs text-gray-500">
                      {page.desktop.count} test{page.desktop.count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {page.desktop.count > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Performance Score:</span>
                      <span className={`text-sm font-semibold ${getScoreColor(page.desktop.performanceScore)}`}>
                        {formatValue(page.desktop.performanceScore, '', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">LCP:</span>
                      <span className={`text-sm font-semibold ${getLCPColor(page.desktop.lcp)}`}>
                        {formatValue(page.desktop.lcp, 's')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">CLS:</span>
                      <span className={`text-sm font-semibold ${getCLSColor(page.desktop.cls)}`}>
                        {formatValue(page.desktop.cls, '', 3)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">TBT:</span>
                      <span className={`text-sm font-semibold ${getTBTColor(page.desktop.tbt)}`}>
                        {formatValue(page.desktop.tbt, 'ms', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">FCP:</span>
                      <span className={`text-sm font-semibold ${getFCPColor(page.desktop.fcp)}`}>
                        {formatValue(page.desktop.fcp, 's')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Speed Index:</span>
                      <span className={`text-sm font-semibold ${getSIColor(page.desktop.speedIndex)}`}>
                        {formatValue(page.desktop.speedIndex, 's')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No desktop data available</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
