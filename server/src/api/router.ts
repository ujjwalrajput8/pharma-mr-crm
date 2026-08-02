import express, { type Router, type Request, type Response } from 'express';
import { Logger } from '../utils/logger';
import { ApiResponse } from '../utils/ApiResponse';
import { notFoundMiddleware } from '../middlewares/notFound.middleware';
import { HttpStatus } from '../constants';

/**
 * createApiRouter
 * Factory that creates the top-level API router and mounts versioned domain routers.
 * Design Pattern: Factory
 * SOLID: OCP — new domains mount without changing existing handlers
 */
export function createApiRouter(): Router {
  const logger = Logger.getInstance();
  const router = express.Router();

  router.get('/', (_req: Request, res: Response) => {
    ApiResponse.success(res, { name: 'pharma-mr-crm API', version: 'v1' }, 'API root');
  });

  const v1 = express.Router();

  const domains = [
    'auth',
    'dashboard',
    'users',
    'doctors',
    'stores',
    'medicines',
    'appointments',
    'visits',
    'stock',
    'distributions',
    'medicine-issues',
    'sales',
    'attendance',
    'reports',
    'settings',
    'audit-logs',
  ] as const;

  for (const domain of domains) {
    try {
      // Domain routers are added as modules are implemented
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const routeModule = require(`../routes/${domain}.routes`) as {
        default?: Router;
      };
      const domainRouter = routeModule.default;
      if (!domainRouter) {
        throw new Error(`No default export from ${domain}.routes`);
      }
      v1.use(`/${domain}`, domainRouter);
      logger.info(`Mounted router for /api/v1/${domain}`);
    } catch {
      logger.debug(`Router for domain '${domain}' not available yet — mounting placeholder`);
      v1.use(`/${domain}`, (_req: Request, res: Response) => {
        ApiResponse.error(res, 'Not implemented', HttpStatus.NOT_IMPLEMENTED, 'NOT_IMPLEMENTED');
      });
    }
  }

  v1.use(notFoundMiddleware);
  router.use('/v1', v1);

  return router;
}

export default createApiRouter;
