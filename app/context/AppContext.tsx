'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Site, MetricsSummary, PerformanceMetric } from '../lib/api';

// Types
interface AppState {
  sites: Site[];
  selectedSite: Site | null;
  summary: MetricsSummary | null;
  metrics: PerformanceMetric[];
  loading: boolean;
  collecting: boolean;
  collectionError: string | null;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  };
  viewMode: 'overview' | 'detail';
  showComparison: boolean;
}

type AppAction =
  | { type: 'SET_SITES'; payload: Site[] }
  | { type: 'SET_SELECTED_SITE'; payload: Site | null }
  | { type: 'SET_SUMMARY'; payload: MetricsSummary | null }
  | { type: 'SET_METRICS'; payload: PerformanceMetric[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_COLLECTING'; payload: boolean }
  | { type: 'SET_COLLECTION_ERROR'; payload: string | null }
  | { type: 'SET_DATE_RANGE'; payload: AppState['dateRange'] }
  | { type: 'SET_VIEW_MODE'; payload: 'overview' | 'detail' }
  | { type: 'SET_SHOW_COMPARISON'; payload: boolean }
  | { type: 'ADD_SITE'; payload: Site }
  | { type: 'UPDATE_SITE'; payload: Site }
  | { type: 'REMOVE_SITE'; payload: string };

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenient helper functions
  setSites: (sites: Site[]) => void;
  setSelectedSite: (site: Site | null) => void;
  setSummary: (summary: MetricsSummary | null) => void;
  setMetrics: (metrics: PerformanceMetric[]) => void;
  setLoading: (loading: boolean) => void;
  setCollecting: (collecting: boolean) => void;
  setCollectionError: (error: string | null) => void;
  setDateRange: (range: AppState['dateRange']) => void;
  setViewMode: (mode: 'overview' | 'detail') => void;
  setShowComparison: (show: boolean) => void;
  addSite: (site: Site) => void;
  updateSite: (site: Site) => void;
  removeSite: (siteId: string) => void;
}

// Initial state
const initialState: AppState = {
  sites: [],
  selectedSite: null,
  summary: null,
  metrics: [],
  loading: true,
  collecting: false,
  collectionError: null,
  dateRange: {
    startDate: null,
    endDate: null,
    timeRange: '7d'
  },
  viewMode: 'overview',
  showComparison: false
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SITES':
      return { ...state, sites: action.payload };
    case 'SET_SELECTED_SITE':
      return { ...state, selectedSite: action.payload };
    case 'SET_SUMMARY':
      return { ...state, summary: action.payload };
    case 'SET_METRICS':
      return { ...state, metrics: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_COLLECTING':
      return { ...state, collecting: action.payload };
    case 'SET_COLLECTION_ERROR':
      return { ...state, collectionError: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SHOW_COMPARISON':
      return { ...state, showComparison: action.payload };
    case 'ADD_SITE':
      return {
        ...state,
        sites: [action.payload, ...state.sites],
        selectedSite: action.payload
      };
    case 'UPDATE_SITE':
      return {
        ...state,
        sites: state.sites.map(s => s.id === action.payload.id ? action.payload : s),
        selectedSite: state.selectedSite?.id === action.payload.id ? action.payload : state.selectedSite
      };
    case 'REMOVE_SITE':
      const remainingSites = state.sites.filter(s => s.id !== action.payload);
      return {
        ...state,
        sites: remainingSites,
        selectedSite: state.selectedSite?.id === action.payload
          ? (remainingSites.length > 0 ? remainingSites[0] : null)
          : state.selectedSite
      };
    default:
      return state;
  }
}

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const contextValue: AppContextType = {
    state,
    dispatch,
    // Helper functions
    setSites: (sites: Site[]) => dispatch({ type: 'SET_SITES', payload: sites }),
    setSelectedSite: (site: Site | null) => dispatch({ type: 'SET_SELECTED_SITE', payload: site }),
    setSummary: (summary: MetricsSummary | null) => dispatch({ type: 'SET_SUMMARY', payload: summary }),
    setMetrics: (metrics: PerformanceMetric[]) => dispatch({ type: 'SET_METRICS', payload: metrics }),
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setCollecting: (collecting: boolean) => dispatch({ type: 'SET_COLLECTING', payload: collecting }),
    setCollectionError: (error: string | null) => dispatch({ type: 'SET_COLLECTION_ERROR', payload: error }),
    setDateRange: (range: AppState['dateRange']) => dispatch({ type: 'SET_DATE_RANGE', payload: range }),
    setViewMode: (mode: 'overview' | 'detail') => dispatch({ type: 'SET_VIEW_MODE', payload: mode }),
    setShowComparison: (show: boolean) => dispatch({ type: 'SET_SHOW_COMPARISON', payload: show }),
    addSite: (site: Site) => dispatch({ type: 'ADD_SITE', payload: site }),
    updateSite: (site: Site) => dispatch({ type: 'UPDATE_SITE', payload: site }),
    removeSite: (siteId: string) => dispatch({ type: 'REMOVE_SITE', payload: siteId })
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}