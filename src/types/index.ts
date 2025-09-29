export interface Site {
  id: string;
  name: string;
  url: string;
  isShopify?: boolean;
  monitoringEnabled?: boolean;
  checkFrequency?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetric {
  id: string;
  siteId: string;
  timestamp: Date;
  deviceType: 'mobile' | 'desktop';
  metrics: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
    speedIndex?: number;
    performanceScore?: number;
  };
  lighthouse?: any;
  shopifyMetrics?: {
    cartResponseTime?: number;
    checkoutStepTime?: number;
    themeAssetSize?: number;
    liquidRenderTime?: number;
  };
}

export interface Alert {
  id: string;
  siteId: string;
  type: 'critical' | 'warning' | 'info';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
}