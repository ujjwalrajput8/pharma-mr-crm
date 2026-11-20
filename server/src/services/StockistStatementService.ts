import type { Prisma } from '@prisma/client';
import { AppRoles } from '../constants';
import type { SaveStatementDto, StatementSummaryQueryDto } from '../dto/stockist-statement.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { AuditService } from './AuditService';
import { TeamScopeService } from './TeamScopeService';

type Tx = Prisma.TransactionClient;
type Db = Tx | ReturnType<typeof PrismaService.getClient>;
const TX_OPTIONS = { timeout: 20_000, maxWait: 20_000 };
/** A correction re-flows openings this many months forward at most. */
const MAX_FORWARD_MONTHS = 24;

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}
function shiftMonth(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}
function currentMonth(): Date {
  // India time: the month changes at IST midnight.
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
}

interface LineInput {
  medicineId: number;
  opening: number;
  receipt: number;
  sales: number;
  returns: number;
}

/**
 * StockistStatementService — a stockist's monthly stock statement (M2.4), entered by the
 * MR who has the stockist. Opening = last month's closing (typed only for the first
 * month); closing = opening + receipt − sales − returns and never below zero.
 * Submitting locks the month for the MR; a Manager / Admin corrects it with a reason,
 * and later months' openings follow the corrected closing. Quarterly and yearly figures
 * (financial year, April–March) are calculated, never stored.
 */
export class StockistStatementService {
  private static instance: StockistStatementService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly audits = AuditService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): StockistStatementService {
    if (!StockistStatementService.instance) {
      StockistStatementService.instance = new StockistStatementService();
    }
    return StockistStatementService.instance;
  }

  /** Stockists the actor works with: MR → their MSL list, Manager → their team's, Admin → all. */
  public async stockists(actor: AuthUser) {
    const visible = await this.scope.visibleUserIds(actor, { includeInactive: true });
    const stores = await this.prisma.medicalStore.findMany({
      where: {
        deletedAt: null,
        type: 'STOCKIST',
        ...(visible ? { assignments: { some: { isActive: true, deletedAt: null, mrId: { in: visible } } } } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        city: true,
        ownerName: true,
        assignments: { where: { isActive: true, deletedAt: null }, take: 1, select: { mr: { select: { id: true, fullName: true } } } },
      },
    });
    return stores.map(({ assignments, ...s }) => ({ ...s, mr: assignments[0]?.mr ?? null }));
  }

  /** Which of the actor's stockists have this month's statement — and in what state. */
  public async overview(month: string, actor: AuthUser) {
    const stockists = await this.stockists(actor);
    const rows = await this.prisma.stockistStatement.findMany({
      where: { deletedAt: null, month: monthDate(month), storeId: { in: stockists.map((s) => s.id) } },
      select: { storeId: true, status: true, submittedAt: true, updatedAt: true },
    });
    const byStore = new Map(rows.map((r) => [r.storeId, r]));
    return stockists.map((s) => ({
      ...s,
      status: byStore.get(s.id)?.status ?? 'MISSING',
      submittedAt: byStore.get(s.id)?.submittedAt ?? null,
      updatedAt: byStore.get(s.id)?.updatedAt ?? null,
    }));
  }

  /** The month's statement — or, when there is none yet, a template with last month's closing as opening. */
  public async get(storeId: number, month: string, actor: AuthUser) {
    const store = await this.requireAccess(storeId, actor);
    const date = monthDate(month);
    const [statement, previous] = await Promise.all([
      this.findStatement(this.prisma, storeId, date),
      this.findStatement(this.prisma, storeId, shiftMonth(date, -1)),
    ]);
    const lines = statement
      ? statement.lines
      : (previous?.lines ?? []).map((l) => ({ ...l, opening: l.closing, receipt: 0, sales: 0, returns: 0, closing: l.closing }));
    return {
      store: { id: store.id, name: store.name },
      month,
      id: statement?.id ?? null,
      status: statement?.status ?? 'NEW',
      submittedAt: statement?.submittedAt ?? null,
      remarks: statement?.remarks ?? null,
      mr: statement?.mr ?? store.mr,
      /** Opening is last month's closing — the form shows it read-only. */
      openingFromPrevious: Boolean(previous),
      previousMonth: previous ? { month: monthKey(previous.month), status: previous.status } : null,
      lines: lines.map((l) => this.publicLine(l)),
      can: this.can(statement?.status ?? null, actor),
    };
  }

  public async save(dto: SaveStatementDto, actor: AuthUser) {
    const store = await this.requireAccess(dto.storeId, actor);
    const date = monthDate(dto.month);
    if (date > currentMonth()) throw new BadRequestError('A statement cannot be for a future month');
    const isMr = actor.role === AppRoles.MR;
    const manage = actor.permissions.includes('stockist-statement:manage');

    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: dto.lines.map((l) => l.medicineId) }, deletedAt: null },
      select: { id: true, name: true, pts: true },
    });
    if (medicines.length !== new Set(dto.lines.map((l) => l.medicineId)).size) throw new NotFoundError('Product not found');
    const medicine = new Map(medicines.map((m) => [m.id, m]));

    const saved = await this.prisma.$transaction(async (tx) => {
      const existing = await this.findStatement(tx, dto.storeId, date);
      const correcting = existing?.status === 'SUBMITTED';
      if (correcting) {
        if (isMr || !manage) throw new ConflictError('This statement is submitted — ask your manager to correct it');
        if ((dto.reason ?? '').length < 5) throw new BadRequestError('Say why the submitted statement is being corrected (at least 5 characters)');
      }
      const previous = await this.findStatement(tx, dto.storeId, shiftMonth(date, -1));
      const openingFrom = previous ? new Map(previous.lines.map((l) => [l.medicineId, l.closing])) : null;
      const lines: LineInput[] = dto.lines.map((l) => ({
        medicineId: l.medicineId,
        opening: openingFrom ? (openingFrom.get(l.medicineId) ?? 0) : (l.opening ?? 0),
        receipt: l.receipt,
        sales: l.sales,
        returns: l.returns,
      }));
      this.assertClosings(lines, medicine, dto.month);

      const mrId = existing?.mrId ?? (isMr ? actor.id : store.mr?.id ?? actor.id);
      const submit = dto.submit || correcting;
      const statement = existing
        ? await tx.stockistStatement.update({
            where: { id: existing.id },
            data: {
              remarks: dto.remarks ?? existing.remarks,
              status: submit ? 'SUBMITTED' : existing.status,
              submittedAt: existing.submittedAt ?? (submit ? new Date() : null),
              updatedBy: actor.id,
            },
            select: { id: true },
          })
        : await tx.stockistStatement.create({
            data: {
              storeId: dto.storeId,
              month: date,
              mrId,
              remarks: dto.remarks ?? null,
              status: submit ? 'SUBMITTED' : 'DRAFT',
              submittedAt: submit ? new Date() : null,
              createdBy: actor.id,
              updatedBy: actor.id,
            },
            select: { id: true },
          });
      await this.writeLines(tx, statement.id, lines, medicine);
      const forward = await this.flowForward(tx, dto.storeId, date, lines);

      const before = existing ? existing.lines.map((l) => this.auditLine(l)) : null;
      await this.audits.log(
        {
          userId: actor.id,
          action: correcting ? 'STATEMENT_CORRECTED' : submit ? 'STATEMENT_SUBMITTED' : 'STATEMENT_SAVED',
          entity: 'StockistStatement',
          entityId: String(statement.id),
          before: before ?? undefined,
          after: lines.map((l) => this.auditLine({ ...l, closing: l.opening + l.receipt - l.sales - l.returns })),
          reason: correcting ? dto.reason : null,
          metadata: { store: store.name, month: dto.month, ...(forward.length ? { reflowedMonths: forward } : {}) },
        },
        tx,
      );
      return statement;
    }, TX_OPTIONS);
    return this.get(dto.storeId, dto.month, actor).then((s) => ({ ...s, id: saved.id }));
  }

  /** Quarter or financial year (April–March), calculated from the monthly statements. */
  public async summary(query: StatementSummaryQueryDto, actor: AuthUser) {
    const store = await this.requireAccess(query.storeId, actor);
    const fyStart = new Date(Date.UTC(query.year, 3, 1));
    const from = query.period === 'quarter' ? shiftMonth(fyStart, (query.quarter! - 1) * 3) : fyStart;
    const count = query.period === 'quarter' ? 3 : 12;
    const months = Array.from({ length: count }, (_, i) => shiftMonth(from, i));
    const statements = await this.prisma.stockistStatement.findMany({
      where: { deletedAt: null, storeId: query.storeId, month: { gte: months[0]!, lte: months[months.length - 1]! } },
      orderBy: { month: 'asc' },
      select: { month: true, status: true, lines: { select: { medicineId: true, opening: true, receipt: true, sales: true, returns: true, closing: true, rate: true, medicine: { select: { name: true } } } } },
    });
    const products = new Map<number, { medicineId: number; name: string; opening: number; receipt: number; sales: number; returns: number; closing: number; rate: number | null }>();
    for (const s of statements) {
      for (const l of s.lines) {
        const row = products.get(l.medicineId);
        if (!row) {
          products.set(l.medicineId, { medicineId: l.medicineId, name: l.medicine.name, opening: l.opening, receipt: l.receipt, sales: l.sales, returns: l.returns, closing: l.closing, rate: l.rate != null ? Number(l.rate) : null });
        } else {
          row.receipt += l.receipt;
          row.sales += l.sales;
          row.returns += l.returns;
          row.closing = l.closing;
          if (l.rate != null) row.rate = Number(l.rate);
        }
      }
    }
    const rows = [...products.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ ...r, salesValue: r.rate != null ? r.sales * r.rate : null, closingValue: r.rate != null ? r.closing * r.rate : null }));
    const status = new Map(statements.map((s) => [monthKey(s.month), s.status]));
    return {
      store: { id: store.id, name: store.name },
      period: query.period,
      label: this.periodLabel(query),
      months: months.map((m) => ({ month: monthKey(m), status: status.get(monthKey(m)) ?? 'MISSING' })),
      rows,
      totals: {
        receipt: rows.reduce((s, r) => s + r.receipt, 0),
        sales: rows.reduce((s, r) => s + r.sales, 0),
        returns: rows.reduce((s, r) => s + r.returns, 0),
        salesValue: rows.reduce((s, r) => s + (r.salesValue ?? 0), 0),
        closingValue: rows.reduce((s, r) => s + (r.closingValue ?? 0), 0),
      },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** The stockist, if the actor may work on it: MR → in their list; Manager → their team's; Admin → any. */
  private async requireAccess(storeId: number, actor: AuthUser) {
    const store = await this.prisma.medicalStore.findFirst({
      where: { id: storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        assignments: { where: { isActive: true, deletedAt: null }, take: 1, select: { mr: { select: { id: true, fullName: true } } } },
      },
    });
    if (!store) throw new NotFoundError('Stockist not found');
    if (store.type !== 'STOCKIST') throw new BadRequestError(`${store.name} is a chemist — statements are for stockists`);
    const mr = store.assignments[0]?.mr ?? null;
    const visible = await this.scope.visibleUserIds(actor, { includeInactive: true });
    if (visible && (!mr || !visible.includes(mr.id))) {
      throw new ForbiddenError(actor.role === AppRoles.MR ? `${store.name} is not in your list` : `${store.name} is outside your team`);
    }
    return { id: store.id, name: store.name, mr };
  }

  private findStatement(db: Db, storeId: number, month: Date) {
    return db.stockistStatement.findFirst({
      where: { storeId, month, deletedAt: null },
      include: {
        lines: { orderBy: { id: 'asc' }, include: { medicine: { select: { name: true } } } },
        mr: { select: { id: true, fullName: true } },
      },
    });
  }

  private assertClosings(lines: LineInput[], medicine: Map<number, { name: string }>, month: string) {
    for (const l of lines) {
      if (l.opening + l.receipt - l.sales - l.returns < 0) {
        throw new BadRequestError(
          `${medicine.get(l.medicineId)?.name ?? 'A product'} (${month}): sales + returns (${l.sales + l.returns}) are more than opening + receipt (${l.opening + l.receipt})`,
        );
      }
    }
  }

  private async writeLines(tx: Tx, statementId: number, lines: LineInput[], medicine: Map<number, { pts: Prisma.Decimal | null }>) {
    await tx.stockistStatementLine.deleteMany({ where: { statementId } });
    if (lines.length === 0) return;
    await tx.stockistStatementLine.createMany({
      data: lines.map((l) => ({
        statementId,
        ...l,
        closing: l.opening + l.receipt - l.sales - l.returns,
        rate: medicine.get(l.medicineId)?.pts ?? null,
      })),
    });
  }

  /** Later months open with this month's closing — re-flow them (refused if any would go negative). */
  private async flowForward(tx: Tx, storeId: number, month: Date, lines: LineInput[]): Promise<string[]> {
    const changed: string[] = [];
    let closing = new Map(lines.map((l) => [l.medicineId, l.opening + l.receipt - l.sales - l.returns]));
    for (let i = 1; i <= MAX_FORWARD_MONTHS; i += 1) {
      const next = await this.findStatement(tx, storeId, shiftMonth(month, i));
      if (!next) break;
      const reflowed = next.lines.map((l) => ({ medicineId: l.medicineId, opening: closing.get(l.medicineId) ?? 0, receipt: l.receipt, sales: l.sales, returns: l.returns }));
      if (reflowed.every((l, idx) => l.opening === next.lines[idx]!.opening)) break;
      this.assertClosings(reflowed, new Map(next.lines.map((l) => [l.medicineId, { name: l.medicine.name }])), monthKey(next.month));
      for (const [idx, l] of reflowed.entries()) {
        await tx.stockistStatementLine.update({
          where: { id: next.lines[idx]!.id },
          data: { opening: l.opening, closing: l.opening + l.receipt - l.sales - l.returns },
        });
      }
      changed.push(monthKey(next.month));
      closing = new Map(reflowed.map((l) => [l.medicineId, l.opening + l.receipt - l.sales - l.returns]));
    }
    return changed;
  }

  private publicLine(l: {
    medicineId: number;
    opening: number;
    receipt: number;
    sales: number;
    returns: number;
    closing: number;
    rate?: Prisma.Decimal | null;
    medicine: { name: string };
  }) {
    const rate = l.rate != null ? Number(l.rate) : null;
    return {
      medicineId: l.medicineId,
      name: l.medicine.name,
      opening: l.opening,
      receipt: l.receipt,
      sales: l.sales,
      returns: l.returns,
      closing: l.closing,
      rate,
      salesValue: rate != null ? l.sales * rate : null,
      closingValue: rate != null ? l.closing * rate : null,
    };
  }

  private auditLine(l: { medicineId: number; opening: number; receipt: number; sales: number; returns: number; closing: number }) {
    return { medicineId: l.medicineId, opening: l.opening, receipt: l.receipt, sales: l.sales, returns: l.returns, closing: l.closing };
  }

  private can(status: string | null, actor: AuthUser) {
    const manage = actor.permissions.includes('stockist-statement:manage') && actor.role !== AppRoles.MR;
    return { edit: status !== 'SUBMITTED' || manage, correct: status === 'SUBMITTED' && manage };
  }

  private periodLabel(query: StatementSummaryQueryDto): string {
    const fy = `FY ${query.year}-${String((query.year + 1) % 100).padStart(2, '0')}`;
    if (query.period === 'year') return `${fy} (Apr–Mar)`;
    const names = ['Apr–Jun', 'Jul–Sep', 'Oct–Dec', 'Jan–Mar'];
    return `${fy} · Q${query.quarter} (${names[query.quarter! - 1]})`;
  }
}
