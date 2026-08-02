import { AppRoles } from '../constants';
import type { ReportQueryDto } from '../dto/report.dto';
import { ForbiddenError } from '../errors/AppError';
import { ReportRepository } from '../repositories/ReportRepository';
import type { AuthUser } from '../types/auth.types';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function resolveRange(query: ReportQueryDto): { from: Date; to: Date; label: string } {
  const now = new Date();

  if (query.from && query.to) {
    return {
      from: parseDateOnly(query.from),
      to: endOfDay(parseDateOnly(query.to)),
      label: `${query.from} → ${query.to}`,
    };
  }

  if (query.type === 'daily') {
    const from = startOfDay(now);
    return { from, to: endOfDay(now), label: from.toISOString().slice(0, 10) };
  }

  if (query.type === 'weekly') {
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { from, to, label: 'Last 7 days' };
  }

  if (query.type === 'monthly') {
    const to = endOfDay(now);
    const from = startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    return { from, to, label: 'Current month' };
  }

  const to = endOfDay(now);
  const from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { from, to, label: 'Last 30 days' };
}

/**
 * ReportService — Admin org reports and MR personal reports.
 */
export class ReportService {
  private static instance: ReportService | null = null;

  private constructor(private readonly reports = ReportRepository.getInstance()) {}

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  public async getReport(query: ReportQueryDto, actor: AuthUser) {
    const scopedMrId =
      actor.role === AppRoles.MR ? actor.id : query.mrId;

    if (actor.role === AppRoles.MR && query.mrId && query.mrId !== actor.id) {
      throw new ForbiddenError('You can only view your own reports');
    }

    if (query.type === 'mr-performance' && actor.role === AppRoles.MR) {
      throw new ForbiddenError('MR performance report is available to administrators only');
    }

    if (query.type === 'stock' && actor.role === AppRoles.MR) {
      throw new ForbiddenError('Stock report is available to administrators only');
    }

    const range = resolveRange(query);

    if (query.type === 'stock') {
      const stock = await this.reports.stockReport();
      return {
        type: query.type,
        range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: range.label },
        summary: {
          totalMedicines: stock.length,
          lowStock: stock.filter((s) => s.isLow).length,
        },
        rows: stock,
      };
    }

    if (query.type === 'mr-performance') {
      const rows = await this.reports.mrPerformance(range.from, range.to, scopedMrId);
      return {
        type: query.type,
        range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: range.label },
        summary: {
          mrs: rows.length,
          visits: rows.reduce((sum, row) => sum + row.visits, 0),
          samples: rows.reduce((sum, row) => sum + row.samplesDistributed, 0),
        },
        rows,
      };
    }

    if (query.type === 'doctor-visits') {
      const rows = await this.reports.doctorVisitReport(range.from, range.to, scopedMrId);
      return {
        type: query.type,
        range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: range.label },
        summary: {
          doctors: rows.length,
          visits: rows.reduce((sum, row) => sum + row.visitCount, 0),
        },
        rows,
      };
    }

    if (query.type === 'appointments') {
      const stats = await this.reports.appointmentStats(range.from, range.to, scopedMrId);
      return {
        type: query.type,
        range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: range.label },
        summary: stats,
        rows: [],
      };
    }

    if (query.type === 'distributions') {
      const stats = await this.reports.distributionStats(range.from, range.to, scopedMrId);
      return {
        type: query.type,
        range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: range.label },
        summary: {
          rows: stats.totalRows,
          quantity: stats.totalQuantity,
        },
        rows: stats.byMedicine,
      };
    }

    // daily / weekly / monthly — combined activity snapshot
    const [appointments, visits, distributions] = await Promise.all([
      this.reports.appointmentStats(range.from, range.to, scopedMrId),
      this.reports.visitStats(range.from, range.to, scopedMrId),
      this.reports.distributionStats(range.from, range.to, scopedMrId),
    ]);

    return {
      type: query.type,
      range: {
        from: range.from.toISOString().slice(0, 10),
        to: range.to.toISOString().slice(0, 10),
        label: range.label,
      },
      summary: {
        appointments: appointments.total,
        appointmentsCompleted: appointments.completed,
        appointmentsPending: appointments.pending,
        visits: visits.total,
        followUps: visits.withFollowUp,
        samplesDistributed: distributions.totalQuantity,
      },
      rows: visits.recent.map((visit) => ({
        id: visit.id,
        visitDate: visit.visitDate.toISOString().slice(0, 10),
        doctorName: visit.doctor.fullName,
        mrName: visit.mr.fullName,
      })),
    };
  }
}
