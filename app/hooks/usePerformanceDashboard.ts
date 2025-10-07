'use client';

import { useEffect, useCallback } from 'react';
import { api, Site } from '../lib/api';
import { useApp } from '../context/AppContext';

export function usePerformanceDashboard() {
  const {
    state,
    setSites,
    setSelectedSite,
    setSummary,
    setMetrics,
    setLoading,
    setCollecting,
    setCollectionError,
    setDateRange,
    addSite,
    updateSite,
    removeSite
  } = useApp();

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  // Load site data when selected site changes
  useEffect(() => {
    if (state.selectedSite) {
      loadSiteData(state.selectedSite.id);
      checkJobStatus(state.selectedSite.id);
    }
  }, [state.selectedSite]);

  // Real-time job status polling - only when collecting
  useEffect(() => {
    // Only poll when we have a selected site AND collection is in progress
    if (!state.selectedSite || !state.collecting) return;

    const pollJobStatus = async () => {
      try {
        const jobStatus = await api.getJobStatus();
        const siteStatus = jobStatus.sites.find(s => s.siteId === state.selectedSite!.id);

        if (siteStatus) {
          // If site is idle and we're still collecting, the job completed
          if (siteStatus.status === 'idle' && state.collecting) {
            setCollecting(false);
            setCollectionError(null);
            // Refresh data after job completion
            loadSiteData(state.selectedSite!.id);
          }
          // If site has active jobs but we're not collecting, sync the state
          else if (siteStatus.status !== 'idle' && !state.collecting) {
            setCollecting(true);
            setCollectionError(null);
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
      }
    };

    // Delay initial poll by 3 seconds to allow backend to queue the job
    // This prevents race condition where we check status before job is queued
    const initialTimeout = setTimeout(pollJobStatus, 3000);

    // Poll every 5 seconds while collecting (reduced from 2s to lower Redis load)
    const interval = setInterval(pollJobStatus, 5000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [state.selectedSite, state.collecting]);

  const loadSites = useCallback(async () => {
    try {
      const data = await api.getSites();
      setSites(data.sites);
      // Don't auto-select first site - let URL restoration or user interaction handle it
      // This prevents race condition where first site is selected before URL restoration completes
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      setLoading(false);
    }
  }, [setSites, setLoading]);

  const loadSiteData = useCallback(async (siteId: string, range?: typeof state.dateRange) => {
    try {
      const currentRange = range || state.dateRange;
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
  }, [state.dateRange, setSummary, setMetrics]);

  const checkJobStatus = useCallback(async (siteId: string) => {
    try {
      const jobStatus = await api.getJobStatus();
      const siteStatus = jobStatus.sites.find(s => s.siteId === siteId);

      if (siteStatus && siteStatus.status !== 'idle') {
        setCollecting(true);
        setCollectionError(null);
      }
    } catch (error) {
      console.error('Failed to check job status:', error);
    }
  }, [setCollecting, setCollectionError]);

  const handleCollectMetrics = useCallback(async () => {
    if (!state.selectedSite) return;

    console.log('🚀 Starting metrics collection for site:', state.selectedSite.id);
    setCollecting(true);
    setCollectionError(null);

    try {
      console.log('📡 Calling API collectMetrics...');
      const result = await api.collectMetrics(state.selectedSite.id);
      console.log('✅ API call successful:', result);

      // Note: We don't set collecting to false here anymore
      // The job status polling will handle that when the job actually completes
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
      let errorMessage = 'Failed to collect performance metrics';

      // Handle specific error cases
      if (error instanceof Error) {
        const message = error.message;

        if (message.includes('Collection already in progress')) {
          errorMessage = 'A performance test is already running for this site. Please wait for it to complete or try again in a few minutes.';
        }
        // API Server Errors (5xx)
        else if (message.includes('API failed (500)') || message.includes('API failed (502)') || message.includes('API failed (503)') ||
                 message.includes('Server Error') || message.includes('Something went wrong') ||
                 message.includes('Internal Server Error') || message.includes('Service Unavailable')) {
          errorMessage = 'The performance testing service is temporarily experiencing issues. Please try again in a few minutes.';
        }
        // API Rate Limits & Quota (4xx)
        else if (message.includes('API failed (429)') || message.includes('API failed (403)') ||
                 message.includes('quota') || message.includes('rate limit') || message.includes('Too Many Requests')) {
          errorMessage = 'API rate limit reached. Please try again later.';
        }
        // API Authentication & Permission Errors
        else if (message.includes('API failed (401)') || message.includes('API failed (403)') ||
                 message.includes('authentication') || message.includes('unauthorized') || message.includes('forbidden')) {
          errorMessage = 'Authentication error with the performance testing service. Please check your API configuration.';
        }
        // Network & Connection Errors
        else if (message.includes('API failed (404)') || message.includes('Not Found') ||
                 message.includes('ECONNREFUSED') || message.includes('network') || message.includes('timeout') ||
                 message.includes('ENOTFOUND') || message.includes('DNS')) {
          errorMessage = 'Unable to connect to the performance testing service. Please check your internet connection and try again.';
        }
        // Any other API-related errors
        else if (message.includes('API failed') || message.includes('PageSpeed') || message.includes('WebPageTest') ||
                 message.includes('Lighthouse') || message.toLowerCase().includes('api')) {
          errorMessage = 'Performance testing service error. Please try again in a few minutes.';
        }
        // Generic errors
        else {
          errorMessage = message;
        }
      }

      setCollectionError(errorMessage);
      setCollecting(false);
    }
  }, [state.selectedSite, setCollecting, setCollectionError]);

  const handleAddSite = useCallback(async (siteData: { name: string; url: string; shopifyDomain?: string; categoryUrl?: string; productUrl?: string }) => {
    try {
      const site = await api.createSite({
        name: siteData.name,
        url: siteData.url,
        shopifyDomain: siteData.shopifyDomain || undefined,
        categoryUrl: siteData.categoryUrl || undefined,
        productUrl: siteData.productUrl || undefined,
      });
      addSite(site);
    } catch (error) {
      console.error('Failed to add site:', error);
      throw error;
    }
  }, [addSite]);

  const handleUpdateSite = useCallback(async (siteId: string, siteData: { name: string; url: string; shopifyDomain?: string; categoryUrl?: string; productUrl?: string }) => {
    try {
      const updatedSite = await api.updateSite(siteId, {
        name: siteData.name,
        url: siteData.url,
        shopifyDomain: siteData.shopifyDomain || undefined,
        categoryUrl: siteData.categoryUrl || undefined,
        productUrl: siteData.productUrl || undefined,
      });
      updateSite(updatedSite);
    } catch (error) {
      console.error('Failed to update site:', error);
      throw error;
    }
  }, [updateSite]);

  const handleDeleteSite = useCallback(async (siteId: string) => {
    try {
      await api.deleteSite(siteId);
      removeSite(siteId);
    } catch (error) {
      console.error('Failed to delete site:', error);
      throw error;
    }
  }, [removeSite]);

  const handleDateRangeChange = useCallback((range: typeof state.dateRange) => {
    setDateRange(range);
    if (state.selectedSite) {
      loadSiteData(state.selectedSite.id, range);
    }
  }, [setDateRange, loadSiteData, state.selectedSite]);

  const handleRetryCollection = useCallback(() => {
    setCollectionError(null);
    handleCollectMetrics();
  }, [setCollectionError, handleCollectMetrics]);

  const handleSelectSite = useCallback((site: Site) => {
    console.log('✅ handleSelectSite: Setting selected site to:', site.name, 'ID:', site.id);
    setSelectedSite(site);
  }, [setSelectedSite]);

  return {
    // State
    ...state,

    // Actions
    handleCollectMetrics,
    handleAddSite,
    handleUpdateSite,
    handleDeleteSite,
    handleDateRangeChange,
    handleRetryCollection,
    handleSelectSite,
    loadSiteData
  };
}