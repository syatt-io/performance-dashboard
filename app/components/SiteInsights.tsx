'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, TrendingUp, AlertCircle, X, ThumbsDown } from 'lucide-react';

interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  metric: string;
  title: string;
  description: string;
  actionableSteps: string[];
  estimatedImpact?: string;
  status: string;
}

interface Anomaly {
  id: string;
  metric: string;
  currentValue: number;
  expectedMin: number;
  expectedMax: number;
  standardDeviations: number;
  confidence: number;
  status: string;
}

interface PrioritizedAction {
  priority: number;
  type: 'recommendation' | 'anomaly';
  id: string;
  title: string;
  description: string;
  estimatedImpact?: string;
  actionableSteps?: string[];
}

interface SiteInsights {
  siteId: string;
  siteName: string;
  summary: {
    criticalIssues: number;
    warnings: number;
    activeAnomalies: number;
    overallHealth: 'critical' | 'warning' | 'good';
  };
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  prioritizedActions: PrioritizedAction[];
}

interface SiteInsightsProps {
  siteId: string;
  onClose?: () => void;
}

export default function SiteInsights({ siteId, onClose }: SiteInsightsProps) {
  const [insights, setInsights] = useState<SiteInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchInsights();
  }, [siteId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/insights/sites/${siteId}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/insights/sites/${siteId}/analyze`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to run analysis');
      const data = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const resolveRecommendation = async (recId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/insights/recommendations/${recId}/resolve`, {
        method: 'POST'
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to resolve recommendation:', err);
    }
  };

  const dismissRecommendation = async (recId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/insights/recommendations/${recId}/dismiss`, {
        method: 'POST'
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    }
  };

  const resolveAnomaly = async (anomalyId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/insights/anomalies/${anomalyId}/resolve`, {
        method: 'POST'
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to resolve anomaly:', err);
    }
  };

  const markAsFalsePositive = async (anomalyId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/insights/anomalies/${anomalyId}/false-positive`, {
        method: 'POST'
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to mark as false positive:', err);
    }
  };

  const toggleAction = (actionId: string) => {
    const newExpanded = new Set(expandedActions);
    if (newExpanded.has(actionId)) {
      newExpanded.delete(actionId);
    } else {
      newExpanded.add(actionId);
    }
    setExpandedActions(newExpanded);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'critical':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Critical</span>;
      case 'warning':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Needs Attention</span>;
      case 'good':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Good</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">{error || 'Failed to load insights'}</div>
        <button
          onClick={fetchInsights}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Performance Insights</h2>
            <p className="text-gray-600 mt-1">AI-powered recommendations and anomaly detection</p>
          </div>
          <div className="flex items-center space-x-3">
            {getHealthBadge(insights.summary.overallHealth)}
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <TrendingUp className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
              <span>{analyzing ? 'Analyzing...' : 'Run Analysis'}</span>
            </button>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{insights.summary.criticalIssues}</div>
            <div className="text-sm text-red-700">Critical Issues</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{insights.summary.warnings}</div>
            <div className="text-sm text-yellow-700">Warnings</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{insights.summary.activeAnomalies}</div>
            <div className="text-sm text-blue-700">Anomalies Detected</div>
          </div>
        </div>
      </div>

      {/* Prioritized Actions */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prioritized Actions</h3>

        {insights.prioritizedActions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">No issues found!</p>
              <p className="text-sm text-gray-500 mt-1">Your site performance looks great.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.prioritizedActions.map((action) => (
              <div
                key={action.id}
                className={`border rounded-lg p-4 ${
                  action.type === 'recommendation'
                    ? getSeverityColor(
                        insights.recommendations.find(r => r.id === action.id)?.severity || 'info'
                      )
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {action.type === 'recommendation' ? (
                      getSeverityIcon(insights.recommendations.find(r => r.id === action.id)?.severity || 'info')
                    ) : (
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">{action.title}</h4>
                        <span className="text-xs px-2 py-1 bg-white rounded-full">
                          Priority: {action.priority}/10
                        </span>
                      </div>
                      <p className="text-sm mt-1">{action.description}</p>

                      {action.estimatedImpact && (
                        <p className="text-sm mt-2 font-medium">💡 {action.estimatedImpact}</p>
                      )}

                      {/* Expandable Action Steps */}
                      {action.actionableSteps && action.actionableSteps.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleAction(action.id)}
                            className="text-sm font-medium underline hover:no-underline"
                          >
                            {expandedActions.has(action.id) ? 'Hide' : 'Show'} Action Steps
                          </button>

                          {expandedActions.has(action.id) && (
                            <ol className="mt-2 ml-4 space-y-1 text-sm list-decimal">
                              {action.actionableSteps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-4">
                    {action.type === 'recommendation' ? (
                      <>
                        <button
                          onClick={() => resolveRecommendation(action.id)}
                          className="p-2 hover:bg-white rounded transition-colors"
                          title="Mark as resolved"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => dismissRecommendation(action.id)}
                          className="p-2 hover:bg-white rounded transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => resolveAnomaly(action.id)}
                          className="p-2 hover:bg-white rounded transition-colors"
                          title="Mark as resolved"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => markAsFalsePositive(action.id)}
                          className="p-2 hover:bg-white rounded transition-colors"
                          title="False positive"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
