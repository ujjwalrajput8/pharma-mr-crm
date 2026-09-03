import { Link } from 'react-router-dom';
import { BookOpen, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotWiredYet } from '@/components/ui/NotWiredYet';
import { PageHeader } from '@/components/ui/Page';

export function LedgerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Ledger explorer"
        description="Append-only stock movements. Closing stock is derived — never edited in place."
      />

      <NotWiredYet
        icon={BookOpen}
        title="The ledger is being written, but not yet readable here"
        summary="Every stock movement already lands in stock_txns as an immutable row. This screen needs a query endpoint over that table — filter by product, batch, holder, type and date range."
        planned={[
          'Filterable transaction list across every movement type',
          'Drill down from a balance to the exact rows that produced it',
          'Rebuild stock_balances from the ledger and report any mismatch',
          'Export a period ledger for audit',
        ]}
        ready={[
          'stock_txns written for every issue, sample, sale, return and adjustment',
          'Unique clientUuid on each row for safe offline retries',
          'Indexes on type, date, medicine, batch, holder and reference',
          'Stock Balances screen reading the derived rollup',
        ]}
        footer={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/stock">
              <Button variant="secondary" size="sm">
                <Package size={14} />
                Stock balances
              </Button>
            </Link>
            <Link to="/medicine-issues">
              <Button variant="secondary" size="sm">
                <Truck size={14} />
                Issue history
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
