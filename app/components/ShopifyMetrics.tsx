'use client';

import { PerformanceMetric } from '../lib/api';
import { Image, Package, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ShopifyMetricsProps {
  metrics: PerformanceMetric[];
}

function formatBytes(bytes?: number): string {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(ms?: number): string {
  if (!ms) return 'N/A';
  return ms.toFixed(0) + 'ms';
}

function getScoreColor(score?: number): string {
  if (!score) return 'text-gray-500';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreIcon(score?: number) {
  if (!score) return <Minus className="w-4 h-4 text-gray-500" />;
  if (score >= 80) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (score >= 60) return <TrendingUp className="w-4 h-4 text-yellow-500" />;
  return <TrendingDown className="w-4 h-4 text-red-500" />;
}

function calculateAverage(values: (number | undefined)[]): number | undefined {
  const validValues = values.filter((v): v is number => v !== undefined && v !== null);
  if (validValues.length === 0) return undefined;
  return validValues.reduce((a, b) => a + b, 0) / validValues.length;
}

export default function ShopifyMetrics({ metrics }: ShopifyMetricsProps) {
  // Filter metrics that have Shopify-specific data
  const shopifyMetrics = metrics.filter(m =>
    m.imageOptimizationScore !== undefined ||
    m.themeAssetSize !== undefined ||
    m.thirdPartyBlockingTime !== undefined
  );

  if (shopifyMetrics.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">Shopify Optimization</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>No Shopify-specific metrics available</p>
          <p className="text-sm mt-1">Run a performance test to see optimization insights</p>
        </div>
      </div>
    );
  }

  // Calculate averages by device type
  const mobileMetrics = shopifyMetrics.filter(m => m.deviceType === 'mobile');
  const desktopMetrics = shopifyMetrics.filter(m => m.deviceType === 'desktop');

  const avgImageOptimization = {
    mobile: calculateAverage(mobileMetrics.map(m => m.imageOptimizationScore)),
    desktop: calculateAverage(desktopMetrics.map(m => m.imageOptimizationScore))
  };

  const avgThemeAssetSize = {
    mobile: calculateAverage(mobileMetrics.map(m => m.themeAssetSize)),
    desktop: calculateAverage(desktopMetrics.map(m => m.themeAssetSize))
  };

  const avgThirdPartyBlocking = {
    mobile: calculateAverage(mobileMetrics.map(m => m.thirdPartyBlockingTime)),
    desktop: calculateAverage(desktopMetrics.map(m => m.thirdPartyBlockingTime))
  };

  // Get the latest values for trend display
  const latestMobile = mobileMetrics[mobileMetrics.length - 1];
  const latestDesktop = desktopMetrics[desktopMetrics.length - 1];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center space-x-2 mb-6">
        <Package className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900">Shopify Optimization</h3>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
          {shopifyMetrics.length} data points
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Image Optimization Score */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Image className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-gray-900">Image Optimization</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Mobile</span>
              <div className="flex items-center space-x-1">
                {getScoreIcon(avgImageOptimization.mobile)}
                <span className={`font-medium ${getScoreColor(avgImageOptimization.mobile)}`}>
                  {avgImageOptimization.mobile ? Math.round(avgImageOptimization.mobile) + '/100' : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Desktop</span>
              <div className="flex items-center space-x-1">
                {getScoreIcon(avgImageOptimization.desktop)}
                <span className={`font-medium ${getScoreColor(avgImageOptimization.desktop)}`}>
                  {avgImageOptimization.desktop ? Math.round(avgImageOptimization.desktop) + '/100' : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Latest values */}
          {(latestMobile?.imageOptimizationScore || latestDesktop?.imageOptimizationScore) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Latest: {latestMobile?.imageOptimizationScore || latestDesktop?.imageOptimizationScore}/100
              </p>
            </div>
          )}
        </div>

        {/* Theme Asset Size */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Package className="w-4 h-4 text-purple-600" />
            <h4 className="font-medium text-gray-900">Theme Assets</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Mobile</span>
              <span className="font-medium text-gray-900">
                {formatBytes(avgThemeAssetSize.mobile)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Desktop</span>
              <span className="font-medium text-gray-900">
                {formatBytes(avgThemeAssetSize.desktop)}
              </span>
            </div>
          </div>

          {/* Latest values */}
          {(latestMobile?.themeAssetSize || latestDesktop?.themeAssetSize) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Latest: {formatBytes(latestMobile?.themeAssetSize || latestDesktop?.themeAssetSize)}
              </p>
            </div>
          )}
        </div>

        {/* Third-party Blocking Time */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-4 h-4 text-red-600" />
            <h4 className="font-medium text-gray-900">Third-party Impact</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Mobile</span>
              <span className="font-medium text-gray-900">
                {formatTime(avgThirdPartyBlocking.mobile)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Desktop</span>
              <span className="font-medium text-gray-900">
                {formatTime(avgThirdPartyBlocking.desktop)}
              </span>
            </div>
          </div>

          {/* Latest values */}
          {(latestMobile?.thirdPartyBlockingTime || latestDesktop?.thirdPartyBlockingTime) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Latest: {formatTime(latestMobile?.thirdPartyBlockingTime || latestDesktop?.thirdPartyBlockingTime)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Optimization Insights */}
      <div className="mt-6 p-4 bg-orange-50 rounded-lg">
        <h5 className="font-medium text-orange-900 mb-2">Optimization Insights</h5>
        <ul className="text-sm text-orange-800 space-y-1">
          {avgImageOptimization.mobile && avgImageOptimization.mobile < 80 && (
            <li>• Consider optimizing images: WebP format, responsive sizing, lazy loading</li>
          )}
          {avgThemeAssetSize.mobile && avgThemeAssetSize.mobile > 2000000 && (
            <li>• Theme assets are large (&gt;2MB) - review unused CSS/JS and optimize bundles</li>
          )}
          {avgThirdPartyBlocking.mobile && avgThirdPartyBlocking.mobile > 500 && (
            <li>• High third-party blocking time (&gt;500ms) - review app performance impact</li>
          )}
          {(!avgImageOptimization.mobile || avgImageOptimization.mobile >= 80) &&
           (!avgThemeAssetSize.mobile || avgThemeAssetSize.mobile <= 2000000) &&
           (!avgThirdPartyBlocking.mobile || avgThirdPartyBlocking.mobile <= 500) && (
            <li>• Your Shopify store is well-optimized! 🎉</li>
          )}
        </ul>
      </div>
    </div>
  );
}