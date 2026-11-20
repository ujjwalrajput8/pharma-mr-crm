import type { Prisma } from '@prisma/client';
import type { SalesBreakdownQueryDto } from '../dto/sale.dto';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { formatDateOnly, monthRange, parseDateOnly, todayDateOnly } from '../utils/datetime';
import { TeamScopeService } from './TeamScopeService';

/**
 * SalesBreakdownService — the client note's "View → Sales: party-wise / product-wise"
 * (M2.5), from the bill lines of invoices and Quick POB (primary sales). MR: own sales;
 * Manager: their team (or one MR); Admin: everyone. Default range: this month.
 */
export class SalesBreakdownService {
  private static instance: SalesBreakdownService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): SalesBreakdownService {
    if (!SalesBreakdownService.instance) {
      SalesBreakdownService.instance = new SalesBreakdownService();
    }
    return SalesBreakdownService.instance;
  }

  public async breakdown(query: SalesBreakdownQueryDto, actor: AuthUser) {
    const filter = await this.scope.resolveMrFilter(actor, query.mrId);
    const month = monthRange(todayDateOnly());
    const from = query.from ? parseDateOnly(query.from) : month.start;
    const to = query.to ? parseDateOnly(query.to) : month.end;
    const where: Prisma.SaleWhereInput = {
      deletedAt: null,
      invoiceDate: { gte: from, lte: to },
      ...(filter.mrId ? { mrId: filter.mrId } : filter.mrIds ? { mrId: { in: filter.mrIds } } : {}),
    };
    const range = { from: formatDateOnly(from), to: formatDateOnly(to) };
    return query.by === 'party' ? { by: query.by, range, ...(await this.byParty(where)) } : { by: query.by, range, ...(await this.byProduct(where)) };
  }

  private async byParty(where: Prisma.SaleWhereInput) {
    const [groups, bills] = await Promise.all([
      this.prisma.sale.groupBy({ by: ['doctorId', 'medicalStoreId'], where, _sum: { amount: true, quantity: true } }),
      this.prisma.sale.groupBy({ by: ['doctorId', 'medicalStoreId', 'invoiceId'], where }),
    ]);
    const billCount = new Map<string, number>();
    for (const b of bills) {
      const key = `${b.doctorId ?? ''}:${b.medicalStoreId ?? ''}`;
      billCount.set(key, (billCount.get(key) ?? 0) + 1);
    }
    const doctorIds = groups.map((g) => g.doctorId).filter((id): id is number => id != null);
    const storeIds = groups.map((g) => g.medicalStoreId).filter((id): id is number => id != null);
    const [doctors, stores] = await Promise.all([
      this.prisma.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, fullName: true, area: true } }),
      this.prisma.medicalStore.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true, type: true, city: true } }),
    ]);
    const doctor = new Map(doctors.map((d) => [d.id, d]));
    const store = new Map(stores.map((s) => [s.id, s]));
    const rows = groups
      .map((g) => {
        const d = g.doctorId != null ? doctor.get(g.doctorId) : undefined;
        const s = g.medicalStoreId != null ? store.get(g.medicalStoreId) : undefined;
        return {
          party: d?.fullName ?? s?.name ?? 'Unknown party',
          type: d ? 'Doctor' : s?.type === 'STOCKIST' ? 'Stockist' : s ? 'Chemist' : '—',
          area: d?.area ?? s?.city ?? null,
          bills: billCount.get(`${g.doctorId ?? ''}:${g.medicalStoreId ?? ''}`) ?? 0,
          quantity: g._sum.quantity ?? 0,
          amount: Number(g._sum.amount ?? 0),
        };
      })
      .sort((a, b) => b.amount - a.amount);
    return { rows, totals: { parties: rows.length, quantity: rows.reduce((t, r) => t + r.quantity, 0), amount: rows.reduce((t, r) => t + r.amount, 0) } };
  }

  private async byProduct(where: Prisma.SaleWhereInput) {
    const [groups, parties] = await Promise.all([
      this.prisma.sale.groupBy({ by: ['medicineId'], where, _sum: { amount: true, quantity: true } }),
      this.prisma.sale.groupBy({ by: ['medicineId', 'doctorId', 'medicalStoreId'], where }),
    ]);
    const partyCount = new Map<number, number>();
    for (const p of parties) partyCount.set(p.medicineId, (partyCount.get(p.medicineId) ?? 0) + 1);
    const medicines = await this.prisma.medicine.findMany({ where: { id: { in: groups.map((g) => g.medicineId) } }, select: { id: true, name: true } });
    const name = new Map(medicines.map((m) => [m.id, m.name]));
    const rows = groups
      .map((g) => ({
        product: name.get(g.medicineId) ?? `Product ${g.medicineId}`,
        parties: partyCount.get(g.medicineId) ?? 0,
        quantity: g._sum.quantity ?? 0,
        amount: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, totals: { products: rows.length, quantity: rows.reduce((t, r) => t + r.quantity, 0), amount: rows.reduce((t, r) => t + r.amount, 0) } };
  }
}
