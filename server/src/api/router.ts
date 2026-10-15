import express, { type Router, type Request, type Response } from 'express';
import { Logger } from '../utils/logger';
import { ApiResponse } from '../utils/ApiResponse';
import { notFoundMiddleware } from '../middlewares/notFound.middleware';

import appointmentsRoutes from '../routes/appointments.routes';
import attendanceRoutes from '../routes/attendance.routes';
import auditLogsRoutes from '../routes/audit-logs.routes';
import authRoutes from '../routes/auth.routes';
import dashboardRoutes from '../routes/dashboard.routes';
import distributionsRoutes from '../routes/distributions.routes';
import doctorsRoutes from '../routes/doctors.routes';
import employeesRoutes from '../routes/employees.routes';
import expensesRoutes from '../routes/expenses.routes';
import filesRoutes from '../routes/files.routes';
import holidaysRoutes from '../routes/holidays.routes';
import invoicesRoutes from '../routes/invoices.routes';
import leavesRoutes from '../routes/leaves.routes';
import ledgerRoutes from '../routes/ledger.routes';
import medicineIssuesRoutes from '../routes/medicine-issues.routes';
import medicinesRoutes from '../routes/medicines.routes';
import myDayRoutes from '../routes/my-day.routes';
import notificationsRoutes from '../routes/notifications.routes';
import permissionsRoutes from '../routes/permissions.routes';
import reportsRoutes from '../routes/reports.routes';
import salesRoutes from '../routes/sales.routes';
import settingsRoutes from '../routes/settings.routes';
import stockRoutes from '../routes/stock.routes';
import storesRoutes from '../routes/stores.routes';
import targetsRoutes from '../routes/targets.routes';
import territoriesRoutes from '../routes/territories.routes';
import tourPlansRoutes from '../routes/tour-plans.routes';
import usersRoutes from '../routes/users.routes';
import visitsRoutes from '../routes/visits.routes';

/**
 * createApiRouter
 * Factory that creates the top-level API router and mounts versioned domain routers.
 * Design Pattern: Factory
 * SOLID: OCP — new domains are added to the table below
 *
 * Imports are static on purpose: the previous dynamic `require` inside try/catch
 * turned a syntax error in any route file into a silent 501 placeholder, which is
 * very hard to debug. A broken module now fails at boot, loudly.
 */
export function createApiRouter(): Router {
  const logger = Logger.getInstance();
  const router = express.Router();

  router.get('/', (_req: Request, res: Response) => {
    ApiResponse.success(res, { name: 'pharma-mr-crm API', version: 'v1' }, 'API root');
  });

  const v1 = express.Router();

  const domains: Array<[string, Router]> = [
    ['auth', authRoutes],
    ['dashboard', dashboardRoutes],
    ['users', usersRoutes],
    ['employees', employeesRoutes],
    ['permissions', permissionsRoutes],
    ['doctors', doctorsRoutes],
    ['territories', territoriesRoutes],
    ['tour-plans', tourPlansRoutes],
    ['my-day', myDayRoutes],
    ['stores', storesRoutes],
    ['medicines', medicinesRoutes],
    ['appointments', appointmentsRoutes],
    ['visits', visitsRoutes],
    ['stock', stockRoutes],
    ['ledger', ledgerRoutes],
    ['distributions', distributionsRoutes],
    ['medicine-issues', medicineIssuesRoutes],
    ['sales', salesRoutes],
    ['invoices', invoicesRoutes],
    ['targets', targetsRoutes],
    ['attendance', attendanceRoutes],
    ['expenses', expensesRoutes],
    ['files', filesRoutes],
    ['notifications', notificationsRoutes],
    ['leaves', leavesRoutes],
    ['holidays', holidaysRoutes],
    ['reports', reportsRoutes],
    ['settings', settingsRoutes],
    ['audit-logs', auditLogsRoutes],
  ];

  for (const [path, domainRouter] of domains) {
    v1.use(`/${path}`, domainRouter);
    logger.info(`Mounted router for /api/v1/${path}`);
  }

  v1.use(notFoundMiddleware);
  router.use('/v1', v1);

  return router;
}

export default createApiRouter;
