import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Config } from '../config';
import { Logger } from '../utils/logger';

/**
 * PrismaService
 * Singleton Prisma Client with PostgreSQL driver adapter (Prisma 7).
 * Design Pattern: Singleton
 * SOLID:
 *  - SRP: Owns DB client lifecycle only
 *  - DIP: Repositories depend on this shared client instance
 * Prisma Client is the only place allowed to touch the database driver.
 */
export class PrismaService {
  private static instance: PrismaService | null = null;
  public readonly client: PrismaClient;

  private constructor() {
    const config = Config.getInstance();
    const connectionString = config.getString('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is required to initialize PrismaService');
    }

    const adapter = new PrismaPg({ connectionString });
    this.client = new PrismaClient({ adapter });
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public static getClient(): PrismaClient {
    return PrismaService.getInstance().client;
  }

  public async connect(): Promise<void> {
    const logger = Logger.getInstance();
    await this.client.$connect();
    logger.info('Prisma connected to database');
  }

  public async disconnect(): Promise<void> {
    const logger = Logger.getInstance();
    await this.client.$disconnect();
    logger.info('Prisma disconnected from database');
  }
}

export const prisma = (): PrismaClient => PrismaService.getClient();
