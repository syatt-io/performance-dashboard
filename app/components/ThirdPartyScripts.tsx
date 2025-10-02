'use client';

import React, { useState, useEffect } from 'react';
import { api, ThirdPartyScript, ThirdPartyScriptSummary } from '../lib/api';
import { Package, AlertTriangle, TrendingUp, Filter } from 'lucide-react';

interface ThirdPartyScriptsProps {
  siteId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(ms: number): string {
  if (ms < 1000) return Math.round(ms) + ' ms';
  return (ms / 1000).toFixed(2) + ' s';
}

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    'analytics': 'bg-blue-100 text-blue-800',
    'marketing': 'bg-purple-100 text-purple-800',
    'chat': 'bg-green-100 text-green-800',
    'reviews': 'bg-yellow-100 text-yellow-800',
    'payments': 'bg-indigo-100 text-indigo-800',
    'shopify-app': 'bg-teal-100 text-teal-800',
    'personalization': 'bg-pink-100 text-pink-800',
    'loyalty': 'bg-orange-100 text-orange-800',
    'search': 'bg-cyan-100 text-cyan-800',
    'social-proof': 'bg-lime-100 text-lime-800',
    'optimization': 'bg-red-100 text-red-800',
    'shipping': 'bg-sky-100 text-sky-800',
    'security': 'bg-emerald-100 text-emerald-800',
    'subscriptions': 'bg-violet-100 text-violet-800',
    'page-builder': 'bg-fuchsia-100 text-fuchsia-800',
    'media': 'bg-rose-100 text-rose-800',
    'monitoring': 'bg-amber-100 text-amber-800',
  };
  return colors[category || 'unknown'] || 'bg-gray-100 text-gray-800';
}

export default function ThirdPartyScripts({ siteId }: ThirdPartyScriptsProps) {
  const [summary, setSummary] = useState<ThirdPartyScriptSummary | null>(null);
  const [scripts, setScripts] = useState<ThirdPartyScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageTypeFilter, setPageTypeFilter] = useState<'homepage' | 'category' | 'product' | 'all'>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<'mobile' | 'desktop' | 'all'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const options = {
          pageType: pageTypeFilter !== 'all' ? pageTypeFilter : undefined,
          deviceType: deviceTypeFilter !== 'all' ? deviceTypeFilter : undefined,
          timeRange: '7d',
        };

        const [summaryData, scriptsData] = await Promise.all([
          api.getThirdPartyScriptSummary(siteId, options),
          api.getThirdPartyScripts(siteId, options),
        ]);

        setSummary(summaryData);
        setScripts(scriptsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load third-party scripts');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [siteId, pageTypeFilter, deviceTypeFilter]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Third-Party Scripts</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Third-Party Scripts</h2>
        </div>
        <div className="text-center py-8 text-red-500">{error}</div>
      </div>
    );
  }

  if (!summary || scripts.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Third-Party Scripts</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          No third-party scripts detected yet. Run a performance test to start tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Third-Party Scripts</h2>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={pageTypeFilter}
              onChange={(e) => setPageTypeFilter(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Pages</option>
              <option value="homepage">Homepage</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
            </select>
          </div>
          <select
            value={deviceTypeFilter}
            onChange={(e) => setDeviceTypeFilter(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All Devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 font-medium">Total Scripts</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{summary.totalScripts ?? 0}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-700 font-medium">Total Transfer Size</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">{formatBytes(summary.totalTransferSize ?? 0)}</div>
            <div className="text-xs text-purple-600 mt-1">Avg: {formatBytes(summary.avgTransferSize ?? 0)}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="text-sm text-orange-700 font-medium">Total Blocking Time</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">{formatTime(summary.totalBlockingTime ?? 0)}</div>
            <div className="text-xs text-orange-600 mt-1">Avg: {formatTime(summary.avgBlockingTime ?? 0)}</div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.byCategory)
              .sort((a, b) => b[1].blockingTime - a[1].blockingTime)
              .map(([category, data]) => (
                <div key={category} className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryColor(category)}`}>
                      {category}
                    </span>
                    <span className="text-xs text-gray-600">{data.count}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatBytes(data.transferSize)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(data.blockingTime)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Scripts Table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detected Scripts</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detections
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Size
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Blocking
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scripts.map((script) => (
                <tr key={script.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {script.isBlocking && (
                        <AlertTriangle className="w-4 h-4 text-red-500 mr-2" title="Blocking script" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {script.vendor || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryColor(script.category)}`}>
                      {script.category || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={script.domain}>
                    {script.domain}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {script.detectionCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatBytes(script.avgTransferSize)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-medium ${
                      script.avgBlockingTime > 500 ? 'text-red-600' :
                      script.avgBlockingTime > 200 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {formatTime(script.avgBlockingTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(script.lastSeen).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Data from last 7 days. Blocking scripts can significantly impact page load performance.
        </p>
      </div>
    </div>
  );
}
