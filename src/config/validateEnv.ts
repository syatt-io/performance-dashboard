import { logger } from '../utils/logger';
import { config } from './env';

/**
 * Validates required environment variables on application startup
 * Throws an error if any required variables are missing or invalid
 */
export function validateEnvironmentVariables(): void {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  if (!config.databaseUrl) {
    missing.push('DATABASE_URL');
  }
  if (!config.encryptionKey) {
    missing.push('ENCRYPTION_KEY');
  }
  if (!config.pagespeedApiKey) {
    missing.push('PAGESPEED_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      'Please set these variables in your .env file or environment configuration.'
    );
  }

  // Validate format requirements
  if (config.encryptionKey.length < 32) {
    invalid.push('ENCRYPTION_KEY (must be at least 32 characters)');
  }

  if (!config.databaseUrl.startsWith('postgresql://')) {
    invalid.push('DATABASE_URL (must start with postgresql://)');
  }

  if (config.redisUrl &&
      !config.redisUrl.startsWith('redis://') &&
      !config.redisUrl.startsWith('rediss://')) {
    invalid.push('REDIS_URL (must start with redis:// or rediss://)');
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment variable formats:\n${invalid.map(v => `  - ${v}`).join('\n')}`
    );
  }

  // Check for optional variables
  if (!config.redisUrl) {
    warnings.push('REDIS_URL: Queue functionality may not work without Redis. Fallback: localhost:6379');
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('⚠️  Optional environment variables not set:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  // Log success
  logger.info('✅ All required environment variables validated successfully');
}