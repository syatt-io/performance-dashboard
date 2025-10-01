'use client';

import { useState, useEffect } from 'react';
import { Site, MetricsSummary, api } from '../lib/api';
import { AlertCircle, TrendingUp, TrendingDown, Activity, CheckCircle, Clock, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

interface MultiSiteData {
  site: Site;
  summary: MetricsSummary | null;
  loading: boolean;
  error: string | null;
  testingStatus?: 'idle' | 'pending' | 'testing';
  testingProgress?: number;
}

interface MultiSiteOverviewProps {
  sites: Site[];
  onSiteSelect: (site: Site) => void;
}

type SortField = 'name' | 'mobileScore' | 'desktopScore' | 'tbt' | 'lcp' | 'cls' | 'fcp' | 'speedIndex' | 'lastUpdated';
type SortDirection = 'asc' | 'desc';

export default function MultiSiteOverview({ sites, onSiteSelect }: MultiSiteOverviewProps) {
  const [siteData, setSiteData] = useState<MultiSiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingAll, setCollectingAll] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadAllSiteData();
  }, [sites]);

  // Real-time job status polling with rate limit handling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let currentDelay = 10000; // Start with 10 seconds
    const MAX_DELAY = 60000; // Max 60 seconds
    const MIN_DELAY = 10000; // Min 10 seconds

    const pollJobStatus = async () => {
      try {
        const jobStatus = await api.getJobStatus();

        // Success - reset to normal polling interval
        currentDelay = MIN_DELAY;

        // Update site data with job status information
        setSiteData(prevData =>
          prevData.map(item => {
            const siteStatus = jobStatus.sites.find(s => s.siteId === item.site.id);
            if (siteStatus) {
              return {
                ...item,
                testingStatus: siteStatus.status,
                testingProgress: siteStatus.progress
              };
            }
            return {
              ...item,
              testingStatus: 'idle',
              testingProgress: 0
            };
          })
        );
      } catch (error: any) {
        // Check if it's a 429 rate limit error
        if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
          // Exponential backoff - double the delay
          currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
          console.warn(`Rate limited. Backing off to ${currentDelay}ms`);
        } else {
          console.error('Failed to fetch job status:', error);
        }
      }

      // Reschedule with current delay
      if (interval) {
        clearInterval(interval);
      }
      interval = setInterval(pollJobStatus, currentDelay);
    };

    // Initial poll
    pollJobStatus();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadAllSiteData = async () => {
    setLoading(true);
    const data: MultiSiteData[] = [];

    for (const site of sites) {
      const siteInfo: MultiSiteData = {
        site,
        summary: null,
        loading: true,
        error: null
      };
      data.push(siteInfo);
    }

    setSiteData(data);

    // Load summaries for each site with delay to avoid rate limits
    for (let i = 0; i < sites.length; i++) {
      try {
        const summary = await api.getMetricsSummary(sites[i].id);
        setSiteData(prev => prev.map((item, index) =>
          index === i ? { ...item, summary, loading: false } : item
        ));

        // Add 500ms delay between requests to avoid rate limiting
        if (i < sites.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        setSiteData(prev => prev.map((item, index) =>
          index === i ? {
            ...item,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load metrics'
          } : item
        ));

        // If rate limited, add longer delay before next request
        if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
          console.warn(`Rate limited loading site ${sites[i].name}, waiting 2s before next request`);
          if (i < sites.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'needs-improvement': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTargetTooltip = (metric: string) => {
    const targets: Record<string, string> = {
      'performance': 'Target: ≥90/100 for good performance',
      'lcp': 'Target: ≤2.48s for good performance',
      'cls': 'Target: ≤0.10 for good performance',
      'tbt': 'Target: ≤200ms for good performance',
      'fcp': 'Target: ≤1.78s for good performance',
      'speedIndex': 'Target: ≤3.39s for good performance'
    };
    return targets[metric] || '';
  };

  const calculateOverallStats = () => {
    const validData = siteData.filter(item => item.summary && !item.error);

    if (validData.length === 0) {
      return {
        avgMobileScore: 0,
        avgDesktopScore: 0,
        goodSites: 0,
        needsAttention: 0,
        totalSites: sites.length
      };
    }

    const mobileScores = validData
      .map(item => item.summary?.performanceScore.mobile)
      .filter((score): score is number => score !== null && score !== undefined);

    const desktopScores = validData
      .map(item => item.summary?.performanceScore.desktop)
      .filter((score): score is number => score !== null && score !== undefined);

    const avgMobileScore = mobileScores.length > 0
      ? Math.round(mobileScores.reduce((a, b) => a + b, 0) / mobileScores.length)
      : 0;

    const avgDesktopScore = desktopScores.length > 0
      ? Math.round(desktopScores.reduce((a, b) => a + b, 0) / desktopScores.length)
      : 0;

    const goodSites = validData.filter(item => {
      const mobile = item.summary?.performanceScore.mobile || 0;
      const desktop = item.summary?.performanceScore.desktop || 0;
      return mobile >= 90 && desktop >= 90;
    }).length;

    const needsAttention = validData.filter(item => {
      const mobile = item.summary?.performanceScore.mobile || 0;
      const desktop = item.summary?.performanceScore.desktop || 0;
      const hasAlerts = (item.summary?.alerts.critical || 0) + (item.summary?.alerts.warning || 0) > 0;
      return mobile < 75 || desktop < 75 || hasAlerts;
    }).length;

    return {
      avgMobileScore,
      avgDesktopScore,
      goodSites,
      needsAttention,
      totalSites: sites.length
    };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedData = () => {
    const sorted = [...siteData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.site.name.toLowerCase();
          bValue = b.site.name.toLowerCase();
          break;
        case 'mobileScore':
          aValue = a.summary?.performanceScore.mobile || 0;
          bValue = b.summary?.performanceScore.mobile || 0;
          break;
        case 'desktopScore':
          aValue = a.summary?.performanceScore.desktop || 0;
          bValue = b.summary?.performanceScore.desktop || 0;
          break;
        case 'tbt':
          aValue = a.summary?.coreWebVitals.tbt.value || 999;
          bValue = b.summary?.coreWebVitals.tbt.value || 999;
          break;
        case 'lcp':
          aValue = a.summary?.coreWebVitals.lcp.value || 999;
          bValue = b.summary?.coreWebVitals.lcp.value || 999;
          break;
        case 'cls':
          aValue = a.summary?.coreWebVitals.cls.value || 999;
          bValue = b.summary?.coreWebVitals.cls.value || 999;
          break;
        case 'fcp':
          aValue = a.summary?.coreWebVitals?.fcp?.value || 999;
          bValue = b.summary?.coreWebVitals?.fcp?.value || 999;
          break;
        case 'speedIndex':
          aValue = a.summary?.coreWebVitals?.speedIndex?.value || 999;
          bValue = b.summary?.coreWebVitals?.speedIndex?.value || 999;
          break;
        case 'lastUpdated':
          aValue = a.summary?.lastUpdated ? new Date(a.summary.lastUpdated).getTime() : 0;
          bValue = b.summary?.lastUpdated ? new Date(b.summary.lastUpdated).getTime() : 0;
          break;
        default:
          aValue = a.site.name.toLowerCase();
          bValue = b.site.name.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return sorted;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 ${sortField === field && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${sortField === field && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
          />
        </div>
      </div>
    </th>
  );

  const handleRunAllTests = async () => {
    setCollectingAll(true);
    setCollectionMessage(null);

    try {
      console.log('🚀 Starting metrics collection for all sites');
      const result = await api.collectAllMetrics();

      setCollectionMessage(`Started performance testing for ${result.totalSites} sites`);

      // Keep checking for updates periodically while collection is running
      // Reduced frequency to avoid rate limits - job status polling handles real-time updates
      const checkInterval = setInterval(() => {
        loadAllSiteData();
      }, 30000); // Check every 30 seconds

      // Stop checking after 10 minutes (collection should be done by then)
      setTimeout(() => {
        clearInterval(checkInterval);
        setCollectingAll(false);
        setCollectionMessage(null);
        loadAllSiteData(); // Final refresh
      }, 600000); // 10 minutes

    } catch (error) {
      console.error('❌ Failed to start collection for all sites:', error);
      setCollectionMessage('Failed to start performance testing. Please try again.');
      setCollectingAll(false);
    }
  };

  const stats = calculateOverallStats();

  if (loading && siteData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg text-gray-600">Loading site data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Overview Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.totalSites}</div>
              <div className="text-sm text-gray-600">Total Sites</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.goodSites}</div>
              <div className="text-sm text-gray-600">High Performance</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.needsAttention}</div>
              <div className="text-sm text-gray-600">Need Attention</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                {Math.round((stats.avgMobileScore + stats.avgDesktopScore) / 2)}
              </div>
              <div className="text-sm text-gray-600">Avg Performance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Collection Status Message */}
      {collectionMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">{collectionMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sites Performance Grid */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Site Performance Overview</h3>
          {sites.length > 0 && (
            <button
              onClick={handleRunAllTests}
              disabled={collectingAll}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Activity className={`w-4 h-4 ${collectingAll ? 'animate-spin' : ''}`} />
              <span>{collectingAll ? 'Running Tests...' : 'Run Tests for All Sites'}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="min-w-full lg:w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="name">Site</SortableHeader>
                <SortableHeader field="mobileScore">Mobile Score</SortableHeader>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('desktopScore')}>
                  <div className="flex items-center space-x-1">
                    <span>Desktop Score</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'desktopScore' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'desktopScore' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('tbt')}>
                  <div className="flex items-center space-x-1">
                    <span>TBT</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'tbt' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'tbt' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('cls')}>
                  <div className="flex items-center space-x-1">
                    <span>CLS</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'cls' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'cls' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <SortableHeader field="lcp">LCP</SortableHeader>
                <th className="hidden xl:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('speedIndex')}>
                  <div className="flex items-center space-x-1">
                    <span>SI</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'speedIndex' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'speedIndex' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <th className="hidden xl:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('fcp')}>
                  <div className="flex items-center space-x-1">
                    <span>FCP</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'fcp' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'fcp' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    onClick={() => handleSort('lastUpdated')}>
                  <div className="flex items-center space-x-1">
                    <span>Last Updated</span>
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 ${sortField === 'lastUpdated' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${sortField === 'lastUpdated' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                      />
                    </div>
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getSortedData().map((item, index) => {
                // Dynamic row styling based on testing status
                let rowClasses = "hover:bg-gray-50 transition-all duration-300 cursor-pointer";

                if (item.testingStatus === 'testing') {
                  rowClasses = "bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100 animate-pulse cursor-pointer";
                } else if (item.testingStatus === 'pending') {
                  rowClasses = "bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100 cursor-pointer";
                }

                return (
                <tr key={item.site.id} className={rowClasses} onClick={() => {
                  console.log('🔍 MultiSiteOverview: Clicked on site:', item.site.name, 'ID:', item.site.id);
                  onSiteSelect(item.site);
                }}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">{item.site.name}</div>
                        {item.testingStatus === 'testing' && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Testing
                          </span>
                        )}
                        {item.testingStatus === 'pending' && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs sm:max-w-none">{item.site.url}</div>
                    </div>
                  </td>

                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">Error</span>
                    ) : (
                      <div className="flex items-center">
                        <span
                          className="text-sm font-medium cursor-help"
                          title={getTargetTooltip('performance')}
                        >
                          {item.summary?.performanceScore.mobile || 'N/A'}
                        </span>
                        {item.summary?.performanceScore.mobile && (
                          <span className={`ml-1 sm:ml-2 inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (item.summary.performanceScore.mobile >= 90) ? 'bg-green-100 text-green-800' :
                            (item.summary.performanceScore.mobile >= 75) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            <span className="hidden sm:inline">{item.summary.performanceScore.mobile >= 90 ? 'Good' :
                             item.summary.performanceScore.mobile >= 75 ? 'OK' : 'Poor'}</span>
                            <span className="sm:hidden">{item.summary.performanceScore.mobile >= 90 ? '✓' :
                             item.summary.performanceScore.mobile >= 75 ? '!' : '✗'}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">Error</span>
                    ) : (
                      <div className="flex items-center">
                        <span
                          className="text-sm font-medium cursor-help"
                          title={getTargetTooltip('performance')}
                        >
                          {item.summary?.performanceScore.desktop || 'N/A'}
                        </span>
                        {item.summary?.performanceScore.desktop && (
                          <span className={`ml-1 sm:ml-2 inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (item.summary.performanceScore.desktop >= 90) ? 'bg-green-100 text-green-800' :
                            (item.summary.performanceScore.desktop >= 75) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            <span className="hidden sm:inline">{item.summary.performanceScore.desktop >= 90 ? 'Good' :
                             item.summary.performanceScore.desktop >= 75 ? 'OK' : 'Poor'}</span>
                            <span className="sm:hidden">{item.summary.performanceScore.desktop >= 90 ? '✓' :
                             item.summary.performanceScore.desktop >= 75 ? '!' : '✗'}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* TBT */}
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">-</span>
                    ) : (
                      <div>
                        <span
                          className="text-sm font-medium cursor-help"
                          title={getTargetTooltip('tbt')}
                        >
                          {item.summary?.coreWebVitals.tbt.value?.toFixed(0) || 'N/A'}
                          {item.summary?.coreWebVitals.tbt.value && 'ms'}
                        </span>
                        {item.summary?.coreWebVitals.tbt.status && (
                          <div className={`text-xs ${getStatusColor(item.summary.coreWebVitals.tbt.status)}`}>
                            {item.summary.coreWebVitals.tbt.status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* CLS */}
                  <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">-</span>
                    ) : (
                      <div>
                        <span
                          className="text-sm font-medium cursor-help"
                          title={getTargetTooltip('cls')}
                        >
                          {item.summary?.coreWebVitals.cls.value?.toFixed(3) || 'N/A'}
                        </span>
                        {item.summary?.coreWebVitals.cls.status && (
                          <div className={`text-xs ${getStatusColor(item.summary.coreWebVitals.cls.status)}`}>
                            {item.summary.coreWebVitals.cls.status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* LCP */}
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">-</span>
                    ) : (
                      <div>
                        <span
                          className="text-sm font-medium cursor-help"
                          title={getTargetTooltip('lcp')}
                        >
                          {item.summary?.coreWebVitals.lcp.value?.toFixed(2) || 'N/A'}
                          {item.summary?.coreWebVitals.lcp.value && 's'}
                        </span>
                        {item.summary?.coreWebVitals.lcp.status && (
                          <div className={`text-xs ${getStatusColor(item.summary.coreWebVitals.lcp.status)}`}>
                            {item.summary.coreWebVitals.lcp.status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* SI (Speed Index) */}
                  <td className="hidden xl:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">-</span>
                    ) : (
                      <div>
                        <span
                          className="text-sm font-medium text-gray-900 cursor-help"
                          title={getTargetTooltip('speedIndex')}
                        >
                          {item.summary?.coreWebVitals.speedIndex?.value ?
                            `${item.summary.coreWebVitals.speedIndex.value.toFixed(1)}s` :
                            'N/A'
                          }
                        </span>
                        {item.summary?.coreWebVitals.speedIndex?.status && (
                          <div className={`text-xs ${getStatusColor(item.summary.coreWebVitals.speedIndex.status)}`}>
                            {item.summary.coreWebVitals.speedIndex.status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* FCP */}
                  <td className="hidden xl:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                    {item.loading ? (
                      <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500 text-sm">-</span>
                    ) : (
                      <div>
                        <span
                          className="text-sm font-medium text-gray-900 cursor-help"
                          title={getTargetTooltip('fcp')}
                        >
                          {item.summary?.coreWebVitals.fcp?.value ?
                            `${item.summary.coreWebVitals.fcp.value.toFixed(1)}s` :
                            'N/A'
                          }
                        </span>
                        {item.summary?.coreWebVitals.fcp?.status && (
                          <div className={`text-xs ${getStatusColor(item.summary.coreWebVitals.fcp.status)}`}>
                            {item.summary.coreWebVitals.fcp.status.replace('-', ' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>


                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.loading ? (
                      <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.error ? (
                      <span className="text-red-500">Error</span>
                    ) : item.summary?.lastUpdated ? (
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">{new Date(item.summary.lastUpdated).toLocaleDateString()}</span>
                        <span className="sm:hidden">{new Date(item.summary.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>

                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {item.testingStatus === 'testing' ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          <div className="hidden sm:flex flex-col">
                            <span className="text-sm font-medium text-blue-600">Testing</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${item.testingProgress || 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="sm:hidden text-sm font-medium text-blue-600">Testing</span>
                        </div>
                      ) : item.testingStatus === 'pending' ? (
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-600">Pending</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-gray-400" />
                          <span className="hidden sm:inline text-sm text-gray-500">Idle</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}