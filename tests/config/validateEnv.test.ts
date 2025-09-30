import { validateEnvironmentVariables } from '../../src/config/validateEnv';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env after all tests
    process.env = originalEnv;
  });

  describe('validateEnvironmentVariables', () => {
    it('should pass with valid environment variables', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept rediss:// URLs for Redis', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'rediss://secure.redis.cloud:6380';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should throw error for missing DATABASE_URL', () => {
      delete process.env.DATABASE_URL;
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).toThrow();
    });

    it('should throw error for invalid Redis URL protocol', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'http://localhost:6379';
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).toThrow(/REDIS_URL/);
    });

    it('should throw error for missing ENCRYPTION_KEY', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      delete process.env.ENCRYPTION_KEY;
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).toThrow();
    });

    it('should throw error for short ENCRYPTION_KEY', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.ENCRYPTION_KEY = 'short';
      process.env.PAGESPEED_API_KEY = 'test-api-key';

      expect(() => validateEnvironmentVariables()).toThrow(/32 characters/);
    });
  });
});
