'use client';

import React, { useState, memo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Zap, Globe, LayoutDashboard, BarChart3 } from 'lucide-react';
import { usePerformanceDashboard } from './hooks/usePerformanceDashboard';
import { useApp } from './context/AppContext';
import SiteCard from './components/SiteCard';
import SiteDashboard from './components/SiteDashboard';
import SiteInsights from './components/SiteInsights';
import MultiSiteOverview from './components/MultiSiteOverview';
import SiteComparison from './components/SiteComparison';
import SiteModal from './components/modals/SiteModal';
import DeleteConfirmModal from './components/modals/DeleteConfirmModal';
import { ComponentErrorBoundary } from './components/ErrorBoundary';

// Disable static generation for this page due to dynamic URL parameters
export const dynamic = 'force-dynamic';

const PerformanceTargetsLegend = memo(function PerformanceTargetsLegend() {
  return (
    <div className="mt-12 bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
        Performance Targets & Metrics Guide
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-medium text-gray-900">FCP</div>
          <div className="text-xs text-gray-600 mb-1">First Contentful Paint</div>
          <div className="text-lg font-bold text-green-600">≤1.78s</div>
          <div className="text-xs text-gray-500">Good performance target</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-medium text-gray-900">SI</div>
          <div className="text-xs text-gray-600 mb-1">Speed Index</div>
          <div className="text-lg font-bold text-green-600">≤3.39s</div>
          <div className="text-xs text-gray-500">Good performance target</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-medium text-gray-900">LCP</div>
          <div className="text-xs text-gray-600 mb-1">Largest Contentful Paint</div>
          <div className="text-lg font-bold text-green-600">≤2.48s</div>
          <div className="text-xs text-gray-500">Good performance target</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-medium text-gray-900">TBT</div>
          <div className="text-xs text-gray-600 mb-1">Total Blocking Time</div>
          <div className="text-lg font-bold text-green-600">≤200ms</div>
          <div className="text-xs text-gray-500">Good performance target</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-medium text-gray-900">CLS</div>
          <div className="text-xs text-gray-600 mb-1">Cumulative Layout Shift</div>
          <div className="text-lg font-bold text-green-600">≤0.10</div>
          <div className="text-xs text-gray-500">Good performance target</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        <span className="font-medium">Note:</span> These targets represent "good" performance thresholds based on Core Web Vitals guidelines and industry standards.
        Values above these thresholds may indicate performance optimization opportunities.
      </div>
    </div>
  );
});

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setViewMode, setShowComparison } = useApp();
  const {
    sites,
    selectedSite,
    summary,
    metrics,
    loading,
    collecting,
    collectionError,
    dateRange,
    viewMode,
    showComparison,
    handleCollectMetrics,
    handleAddSite,
    handleUpdateSite,
    handleDeleteSite,
    handleDateRangeChange,
    handleRetryCollection,
    handleSelectSite
  } = usePerformanceDashboard();

  // Modal state
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [showEditSiteModal, setShowEditSiteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [deletingSite, setDeletingSite] = useState<any>(null);
  const [siteFormData, setSiteFormData] = useState({
    name: '',
    url: '',
    shopifyDomain: ''
  });

  // Track if we've completed initial URL restoration
  const [initialRestoreDone, setInitialRestoreDone] = useState(false);

  // Restore state from URL on mount
  useEffect(() => {
    if (!sites.length || loading) return;

    const siteId = searchParams.get('site');
    if (siteId) {
      const site = sites.find(s => s.id === siteId);
      if (site && (!selectedSite || selectedSite.id !== siteId)) {
        handleSelectSite(site);
        setViewMode('detail');
      }
    }
    setInitialRestoreDone(true);
  }, [sites, loading, searchParams]);

  // Update URL when site selection or view mode changes
  // Only run after initial restoration is complete to avoid clearing URL on page load
  useEffect(() => {
    if (!initialRestoreDone) return;

    const params = new URLSearchParams(searchParams.toString());

    if (viewMode === 'detail' && selectedSite) {
      params.set('site', selectedSite.id);
    } else {
      params.delete('site');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [selectedSite, viewMode, initialRestoreDone]);

  // Modal handlers
  const handleOpenAddModal = () => {
    setSiteFormData({ name: '', url: '', shopifyDomain: '' });
    setShowAddSiteModal(true);
  };

  const handleOpenEditModal = (site: any) => {
    setEditingSite(site);
    setSiteFormData({
      name: site.name,
      url: site.url,
      shopifyDomain: site.shopifyDomain || ''
    });
    setShowEditSiteModal(true);
  };

  const handleOpenDeleteModal = (site: any) => {
    setDeletingSite(site);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (data: typeof siteFormData) => {
    try {
      await handleAddSite(data);
      setShowAddSiteModal(false);
    } catch (error) {
      console.error('Failed to add site:', error);
    }
  };

  const handleSubmitEdit = async (data: typeof siteFormData) => {
    if (!editingSite) return;
    try {
      await handleUpdateSite(editingSite.id, data);
      setShowEditSiteModal(false);
      setEditingSite(null);
    } catch (error) {
      console.error('Failed to edit site:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSite) return;
    try {
      await handleDeleteSite(deletingSite.id);
      setShowDeleteModal(false);
      setDeletingSite(null);
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleSiteSelectFromOverview = (site: any) => {
    handleSelectSite(site);
    setViewMode('detail');
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
              <span>Syatt - Performance Dashboard</span>
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
                onClick={handleOpenAddModal}
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
                onClick={handleOpenAddModal}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Site</span>
              </button>
            </div>
          ) : (
            <ComponentErrorBoundary>
              <MultiSiteOverview sites={sites} onSiteSelect={handleSiteSelectFromOverview} />
            </ComponentErrorBoundary>
          )}
        </div>
      ) : (
        <div className="w-full">
          {/* Metrics Dashboard - Full Width */}
          {selectedSite && summary ? (
            <>
              <ComponentErrorBoundary>
                <SiteDashboard
                  site={selectedSite}
                  summary={summary}
                  metrics={metrics}
                  collecting={collecting}
                  collectionError={collectionError}
                  dateRange={dateRange}
                  onCollectMetrics={handleCollectMetrics}
                  onDateRangeChange={handleDateRangeChange}
                  onRetryCollection={handleRetryCollection}
                />
              </ComponentErrorBoundary>

              {/* Performance Insights Section */}
              <div className="mt-6">
                <ComponentErrorBoundary>
                  <SiteInsights siteId={selectedSite.id} />
                </ComponentErrorBoundary>
              </div>
            </>
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
      )}

      {/* Performance Targets Legend */}
      <PerformanceTargetsLegend />

      {/* Modals */}
      <SiteModal
        isOpen={showAddSiteModal}
        onClose={() => setShowAddSiteModal(false)}
        onSubmit={handleSubmitAdd}
        title="Add New Site"
        submitText="Add Site"
        initialData={siteFormData}
        onDataChange={setSiteFormData}
      />

      <SiteModal
        isOpen={showEditSiteModal}
        onClose={() => setShowEditSiteModal(false)}
        onSubmit={handleSubmitEdit}
        title="Edit Site"
        submitText="Update Site"
        site={editingSite}
        initialData={siteFormData}
        onDataChange={setSiteFormData}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        site={deletingSite}
      />

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

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg text-gray-600">Loading...</div></div>}>
      <HomeContent />
    </Suspense>
  );
}