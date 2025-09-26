'use client';

import { useState, useEffect } from 'react';
import { Plus, Zap, Globe, LayoutDashboard, BarChart3, AlertCircle } from 'lucide-react';
import { api, Site, MetricsSummary, PerformanceMetric } from './lib/api';
import SiteCard from './components/SiteCard';
import MetricsChart from './components/MetricsChart';
import ShopifyMetrics from './components/ShopifyMetrics';
import MultiSiteOverview from './components/MultiSiteOverview';
import SiteComparison from './components/SiteComparison';

export default function Home() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: null as string | null,
    endDate: null as string | null,
    timeRange: '7d' as '1h' | '24h' | '7d' | '30d' | '90d' | 'custom'
  });
  const [showComparison, setShowComparison] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showEditSite, setShowEditSite] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');

  const [newSite, setNewSite] = useState({
    name: '',
    url: '',
    shopifyDomain: '',
  });

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      loadSiteData(selectedSite.id);
    }
  }, [selectedSite]);

  const loadSites = async () => {
    try {
      const data = await api.getSites();
      setSites(data.sites);
      if (data.sites.length > 0 && !selectedSite) {
        setSelectedSite(data.sites[0]);
      }
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSiteData = async (siteId: string, range?: typeof dateRange) => {
    try {
      const currentRange = range || dateRange;
      const metricsParams: any = { limit: 100 };

      if (currentRange.timeRange === 'custom' && currentRange.startDate && currentRange.endDate) {
        metricsParams.startDate = currentRange.startDate;
        metricsParams.endDate = currentRange.endDate;
      } else {
        metricsParams.timeRange = currentRange.timeRange;
      }

      const [summaryData, metricsData] = await Promise.all([
        api.getMetricsSummary(siteId),
        api.getMetrics(siteId, metricsParams),
      ]);
      setSummary(summaryData);
      setMetrics(metricsData.metrics);
    } catch (error) {
      console.error('Failed to load site data:', error);
    }
  };

  const handleAddSite = async () => {
    try {
      const site = await api.createSite({
        name: newSite.name,
        url: newSite.url,
        shopifyDomain: newSite.shopifyDomain || undefined,
      });
      setSites([site, ...sites]);
      setSelectedSite(site);
      setShowAddSite(false);
      setNewSite({ name: '', url: '', shopifyDomain: '' });
    } catch (error) {
      console.error('Failed to add site:', error);
    }
  };

  const handleCollectMetrics = async () => {
    if (!selectedSite) return;

    console.log('🚀 Starting metrics collection for site:', selectedSite.id);
    setCollecting(true);
    setCollectionError(null);

    try {
      console.log('📡 Calling API collectMetrics...');
      const result = await api.collectMetrics(selectedSite.id);
      console.log('✅ API call successful:', result);

      // Refresh data after a short delay
      setTimeout(() => {
        console.log('🔄 Refreshing site data...');
        loadSiteData(selectedSite.id);
        setCollecting(false);
      }, 3000);
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
      let errorMessage = 'Failed to collect performance metrics';

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Collection already in progress')) {
          errorMessage = 'A performance test is already running for this site. Please wait for it to complete or try again in a few minutes.';
        } else {
          errorMessage = error.message;
        }
      }

      setCollectionError(errorMessage);
      setCollecting(false);
    }
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setNewSite({
      name: site.name,
      url: site.url,
      shopifyDomain: site.shopifyDomain || '',
    });
    setShowEditSite(true);
  };

  const handleDeleteSite = (site: Site) => {
    setDeletingSite(site);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingSite) return;

    try {
      await api.deleteSite(deletingSite.id);
      setSites(sites.filter(s => s.id !== deletingSite.id));
      if (selectedSite?.id === deletingSite.id) {
        setSelectedSite(sites.length > 1 ? sites.find(s => s.id !== deletingSite.id) || null : null);
      }
      setShowDeleteConfirm(false);
      setDeletingSite(null);
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleUpdateSite = async () => {
    if (!editingSite) return;

    try {
      const updatedSite = await api.updateSite(editingSite.id, {
        name: newSite.name,
        url: newSite.url,
        shopifyDomain: newSite.shopifyDomain || undefined,
      });
      setSites(sites.map(s => s.id === editingSite.id ? updatedSite : s));
      if (selectedSite?.id === editingSite.id) {
        setSelectedSite(updatedSite);
      }
      setShowEditSite(false);
      setEditingSite(null);
      setNewSite({ name: '', url: '', shopifyDomain: '' });
    } catch (error) {
      console.error('Failed to update site:', error);
    }
  };

  const handleSiteSelectFromOverview = (site: Site) => {
    setSelectedSite(site);
    setViewMode('detail');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-full xl:max-w-[95%] 2xl:max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
              <Zap className="w-8 h-8 text-blue-600" />
              <span>Performance Dashboard</span>
            </h1>
            <p className="text-gray-600 mt-2">Monitor your Shopify store performance</p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'overview'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setViewMode('detail')}
              disabled={!selectedSite}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'detail'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${!selectedSite ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Site Details</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'overview' ? (
        <div className="space-y-6">
          {/* Add Site Button for Overview */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">All Sites Overview</h2>
            <div className="flex space-x-3">
              {sites.length > 1 && (
                <button
                  onClick={() => setShowComparison(true)}
                  className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Compare Sites</span>
                </button>
              )}
              <button
                onClick={() => setShowAddSite(true)}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Site</span>
              </button>
            </div>
          </div>

          {sites.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Globe className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sites configured yet</h3>
              <p className="text-gray-600 mb-4">Add your first site to start monitoring performance</p>
              <button
                onClick={() => setShowAddSite(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Site</span>
              </button>
            </div>
          ) : (
            <MultiSiteOverview sites={sites} onSiteSelect={handleSiteSelectFromOverview} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sites List */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Sites</h2>
              <button
                onClick={() => setShowAddSite(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Site</span>
              </button>
            </div>

            <div className="space-y-4">
              {sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  onSelect={setSelectedSite}
                  onEdit={handleEditSite}
                  onDelete={handleDeleteSite}
                />
              ))}
            </div>

            {sites.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No sites configured yet</p>
              </div>
            )}
          </div>

          {/* Metrics Dashboard */}
          <div className="lg:col-span-2">
            {selectedSite && summary ? (
              <div className="space-y-6">
                {/* Site Header */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{summary.siteName}</h2>
                      <p className="text-gray-600">{selectedSite.url}</p>
                    </div>

                    <button
                      onClick={handleCollectMetrics}
                      disabled={collecting}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{collecting ? 'Collecting...' : 'Run Test'}</span>
                    </button>
                  </div>

                  {/* Error message display */}
                  {collectionError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Performance Collection Failed
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            {collectionError}
                          </div>
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
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">FID</h3>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-gray-900">
                        {summary.coreWebVitals.fid.value?.toFixed(0) || 'N/A'}
                        {summary.coreWebVitals.fid.value && 'ms'}
                      </div>
                      <div className={`text-sm ${getStatusColor(summary.coreWebVitals.fid.status)}`}>
                        {summary.coreWebVitals.fid.status.replace('-', ' ')}
                      </div>
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

                {/* Alerts Section */}
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
                            {/* Calculate desktop LCP from metrics if available */}
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
                    onDateRangeChange={(range) => {
                      setDateRange(range);
                      loadSiteData(selectedSite.id, range);
                    }}
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
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
                      height={250}
                    />

                    <MetricsChart
                      metrics={metrics}
                      metric="fid"
                      title="First Input Delay (FID)"
                      unit="ms"
                      dateRange={dateRange}
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
                      height={250}
                    />

                    <MetricsChart
                      metrics={metrics}
                      metric="cls"
                      title="Cumulative Layout Shift (CLS)"
                      unit=""
                      dateRange={dateRange}
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
                      height={250}
                    />

                    <MetricsChart
                      metrics={metrics}
                      metric="tbt"
                      title="Total Blocking Time (TBT)"
                      unit="ms"
                      dateRange={dateRange}
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
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
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
                      height={250}
                    />

                    <MetricsChart
                      metrics={metrics}
                      metric="fcp"
                      title="First Contentful Paint (FCP)"
                      unit="s"
                      dateRange={dateRange}
                      onDateRangeChange={(range) => {
                        setDateRange(range);
                        loadSiteData(selectedSite.id, range);
                      }}
                      height={250}
                    />
                  </div>

                  {/* Shopify-specific Metrics */}
                  <ShopifyMetrics metrics={metrics} />
                </div>
              </div>
            ) : selectedSite ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-500 mb-4">
                  {collecting ? 'Running performance analysis...' : 'No performance data available'}
                </div>
                {!collecting && (
                  <div className="text-sm text-gray-400">
                    Click "Run Test" to analyze this site's performance using real Lighthouse data.
                    <br />
                    Note: Performance testing may take 30-60 seconds to complete.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-500">Select a site to view metrics</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {showEditSite && editingSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Site</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="My Store"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={newSite.url}
                  onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://my-store.myshopify.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shopify Domain (optional)
                </label>
                <input
                  type="text"
                  value={newSite.shopifyDomain}
                  onChange={(e) => setNewSite({ ...newSite, shopifyDomain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="my-store"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditSite(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSite}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Update Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Site Modal */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Site</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="My Store"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={newSite.url}
                  onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://my-store.myshopify.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shopify Domain (optional)
                </label>
                <input
                  type="text"
                  value={newSite.shopifyDomain}
                  onChange={(e) => setNewSite({ ...newSite, shopifyDomain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="my-store"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddSite(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSite}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Delete Site</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deletingSite.name}"? This action cannot be undone and will remove all associated performance data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Comparison Modal */}
      {showComparison && (
        <SiteComparison
          sites={sites}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
