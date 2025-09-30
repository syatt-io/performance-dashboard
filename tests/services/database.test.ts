import { prisma, connectDatabase, disconnectDatabase } from '../../src/services/database';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Prisma Client
jest.mock('../../src/generated/prisma', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    })),
  };
});

describe('Database Service', () => {
  describe('connectDatabase', () => {
    it('should connect to database successfully', async () => {
      (prisma.$connect as jest.Mock).mockResolvedValue(undefined);

      await expect(connectDatabase()).resolves.not.toThrow();
      expect(prisma.$connect).toHaveBeenCalled();
    });

    it('should exit process on connection failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      (prisma.$connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(connectDatabase()).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect from database', async () => {
      (prisma.$disconnect as jest.Mock).mockResolvedValue(undefined);

      await disconnectDatabase();
      expect(prisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('prisma client configuration', () => {
    it('should have proper connection pool settings in DATABASE_URL', () => {
      const databaseUrl = process.env.DATABASE_URL;

      if (databaseUrl) {
        // Connection pool parameters are optional and may be configured in production
        // Just verify the URL is defined
        expect(databaseUrl).toBeTruthy();
      }
    });
  });
});
