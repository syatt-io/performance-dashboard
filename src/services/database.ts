import { PrismaClient } from '../generated/prisma';
import { logger } from '../utils/logger';

// Configure connection pooling based on environment
const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT
  ? parseInt(process.env.DATABASE_CONNECTION_LIMIT, 10)
  : 10; // Default to 10 connections

// Append connection pool settings to DATABASE_URL
const databaseUrl = process.env.DATABASE_URL
  ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=20`
  : undefined;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
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
      environment: process.env.NODE_ENV,
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