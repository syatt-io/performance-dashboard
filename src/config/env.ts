/**
 * Centralized environment configuration
 * All environment variable access should go through this module
 */

export interface EnvironmentConfig {
  // Application
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  allowedOrigins: string[];

  // Database
  databaseUrl: string;
  databaseConnectionLimit: number;

  // Security
  encryptionKey: string;

  // Redis/Queue
  redisUrl?: string;
  redisHost: string;
  redisPort: number;

  // Google/PageSpeed
  pagespeedApiKey: string;
  googleApplicationCredentials?: string;
  googleServiceAccountBase64?: string;

  // Feature Flags
  monitoringEnabled: boolean;
  lighthouseIntervalHours: number;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

class ConfigService {
  private static instance: ConfigService;
  private config: EnvironmentConfig;

  private constructor() {
    // Parse and validate environment variables
    this.config = {
      // Application
      nodeEnv: (process.env.NODE_ENV as EnvironmentConfig['nodeEnv']) || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3001', 'http://localhost:3000'],

      // Database
      databaseUrl: process.env.DATABASE_URL || '',
      databaseConnectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),

      // Security
      encryptionKey: process.env.ENCRYPTION_KEY || '',

      // Redis/Queue
      redisUrl: process.env.REDIS_URL,
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),

      // Google/PageSpeed
      pagespeedApiKey: process.env.PAGESPEED_API_KEY || '',
      googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      googleServiceAccountBase64: process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,

      // Feature Flags
      monitoringEnabled: process.env.MONITORING_ENABLED === 'true',
      lighthouseIntervalHours: parseInt(process.env.LIGHTHOUSE_INTERVAL_HOURS || '6', 10),

      // Logging
      logLevel: (process.env.LOG_LEVEL as EnvironmentConfig['logLevel']) ||
        (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    };
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(): EnvironmentConfig {
    return this.config;
  }

  // Helper methods
  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  // Allow updating GOOGLE_APPLICATION_CREDENTIALS at runtime (needed for service account setup)
  setGoogleApplicationCredentials(path: string): void {
    this.config.googleApplicationCredentials = path;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  }
}

// Export singleton instance
export const config = ConfigService.getInstance().get();
export const configService = ConfigService.getInstance();
