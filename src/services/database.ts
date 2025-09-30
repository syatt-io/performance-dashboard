import { PrismaClient } from '../generated/prisma';
import { logger } from '../utils/logger';
import { config, configService } from '../config/env';

// Configure connection pooling based on environment
const connectionLimit = config.databaseConnectionLimit;

// Append connection pool settings to DATABASE_URL
const databaseUrl = config.databaseUrl
  ? `${config.databaseUrl}${config.databaseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=20`
  : undefined;

export const prisma = new PrismaClient({
  log: configService.isDevelopment() ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully', {
      connectionLimit,
      environment: config.nodeEnv,
    });
  } catch (error) {
    logger.error('❌ Database connection failed:', { error });
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('🔌 Database disconnected');
}