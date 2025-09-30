/**
 * Validates required environment variables on application startup
 * Throws an error if any required variables are missing or invalid
 */
export function validateEnvironmentVariables(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'ENCRYPTION_KEY',
    'PAGESPEED_API_KEY',
  ];

  const missing: string[] = [];
  const invalid: string[] = [];

  // Check for missing variables
  requiredEnvVars.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      'Please set these variables in your .env file or environment configuration.'
    );
  }

  // Validate specific format requirements
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    invalid.push('ENCRYPTION_KEY (must be at least 32 characters)');
  }

  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    invalid.push('DATABASE_URL (must start with postgresql://)');
  }

  if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('redis://')) {
    invalid.push('REDIS_URL (must start with redis://)');
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment variable formats:\n${invalid.map(v => `  - ${v}`).join('\n')}`
    );
  }

  // Log success
  console.log('✅ All required environment variables validated successfully');
}

/**
 * Gets optional environment variables with defaults
 */
export function getOptionalEnvVars() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3001', 'http://localhost:3000'],
  };
}