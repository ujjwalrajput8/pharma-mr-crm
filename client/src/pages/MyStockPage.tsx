import { Link } from 'react-router-dom';
import { Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotWiredYet } from '@/components/ui/NotWiredYet';
import { PageHeader } from '@/components/ui/Page';

export function MyStockPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="My stock"
        description="Sample stock you are carrying, by product and batch."
      />

      <NotWiredYet
        icon={Package}
        title="Per-MR stock balance endpoint is missing"
        summary="Stock balances are stored per holder, so the numbers exist — there is just no endpoint yet that returns the balance for the signed-in MR. Meanwhile, Issue to MR and Sample Given show what came in and what went out."
        planned={[
          'Batch-wise on-hand quantity for your own bag',
          'Expiry warning for batches close to their expiry date',
          'Return-to-warehouse and expiry write-off requests',
          'Acknowledge stock a manager has issued to you',
        ]}
        ready={[
          'stock_balances rows keyed by holder (USER / WAREHOUSE / DOCTOR)',
          'Append-only stock_txns ledger behind every movement',
          'RETURN, EXPIRY_WRITEOFF and LOST transaction types',
          'Batch model with mfg / expiry dates',
        ]}
        footer={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/medicine-issues">
              <Button variant="secondary" size="sm">
                <Truck size={14} />
                Stock issued to me
              </Button>
            </Link>
            <Link to="/distributions">
              <Button variant="secondary" size="sm">
                <Package size={14} />
                Samples I gave
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
