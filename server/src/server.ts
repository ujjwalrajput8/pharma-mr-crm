import dotenv from 'dotenv';
dotenv.config();

import express, { type Express, type Request, type Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { Config } from './config';
import { Logger } from './utils/logger';
import { createApiRouter } from './api/router';
import { PrismaService } from './prisma/PrismaService';
import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { ApiResponse } from './utils/ApiResponse';

/**
 * Server
 * Singleton that configures and starts the Express HTTP server.
 * Design Pattern: Singleton
 * SOLID:
 *  - SRP: HTTP wiring & lifecycle only (no business logic)
 *  - DIP: Depends on Config, Logger, PrismaService abstractions/singletons
 */
export class Server {
  private static instance: Server | null = null;
  public readonly app: Express;
  private httpServer?: http.Server;
  private readonly port: number;
  private readonly logger: Logger;
  private readonly config: Config;
  private readonly prisma: PrismaService;

  private constructor() {
    this.config = Config.getInstance();
    this.logger = Logger.getInstance();
    this.prisma = PrismaService.getInstance();
    this.port = this.config.port;
    this.app = express();

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  public static getInstance(): Server {
    if (!Server.instance) {
      Server.instance = new Server();
    }
    return Server.instance;
  }

  private setupMiddlewares(): void {
    this.app.set('trust proxy', 1);
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: this.config.corsOrigin,
        credentials: true,
      }),
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use(
      rateLimit({
        windowMs: this.config.rateLimitWindowMs,
        max: this.config.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests', code: 'TOO_MANY_REQUESTS' },
      }),
    );
    this.app.use(morgan('combined', { stream: this.logger.stream }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      ApiResponse.success(res, { status: 'ok', env: this.config.nodeEnv }, 'Healthy');
    });

    this.app.use('/api', createApiRouter());
    this.app.use(notFoundMiddleware);
  }

  private setupErrorHandling(): void {
    this.app.use(errorMiddleware);
  }

  public async start(): Promise<void> {
    await this.prisma.connect();

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(this.port, () => {
          this.logger.info(`Server listening on port ${this.port}`, {
            env: this.config.nodeEnv,
          });
          resolve();
        });

        const shutdown = (): void => {
          void this.shutdown();
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Received shutdown signal, closing HTTP server');

    const forceTimer = setTimeout(() => {
      this.logger.error('Forcing shutdown after timeout');
      process.exit(1);
    }, this.config.getNumber('SHUTDOWN_TIMEOUT_MS', 30000));

    forceTimer.unref();

    await new Promise<void>((resolve) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((err) => {
        if (err) {
          this.logger.error(err);
        } else {
          this.logger.info('HTTP server closed');
        }
        resolve();
      });
    });

    await this.prisma.disconnect();
    clearTimeout(forceTimer);
    process.exit(0);
  }
}

if (require.main === module) {
  const server = Server.getInstance();
  server.start().catch((err: unknown) => {
    // Fallback until logger is guaranteed
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

export default Server;
