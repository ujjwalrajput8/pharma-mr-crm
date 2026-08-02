import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { medicinesApi, type CreateMedicinePayload } from '@/services/medicines.service';

const emptyForm: CreateMedicinePayload = {
  name: '',
  company: '',
  category: '',
  strength: '',
  packSize: '',
  mrp: 0,
  openingStock: 0,
  minimumStockAlert: 10,
};

export function MedicinesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMedicinePayload>(emptyForm);

  const medicinesQuery = useQuery({
    queryKey: ['medicines', search],
    queryFn: () => medicinesApi.list(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: medicinesApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: medicinesApi.remove,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['medicines'] }),
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      name: form.name,
      company: form.company || undefined,
      category: form.category || undefined,
      strength: form.strength || undefined,
      packSize: form.packSize || undefined,
      mrp: Number(form.mrp),
      openingStock: Number(form.openingStock ?? 0),
      minimumStockAlert: Number(form.minimumStockAlert ?? 10),
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Medicines"
        description="Product catalog with MRP and available stock."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add Medicine
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-[var(--color-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medicines…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <Card>
        <DataTable
          columns={['Medicine', 'Company', 'MRP', 'Available', 'Actions']}
          loading={medicinesQuery.isLoading}
          empty={
            !medicinesQuery.isLoading && medicinesQuery.data?.length === 0 ? (
              <EmptyState title="No medicines found" description="Add products to the catalog." />
            ) : null
          }
        >
          {medicinesQuery.data?.map((medicine) => (
            <tr key={medicine.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>
                <div className="font-medium">{medicine.name}</div>
                <div className="text-[var(--color-muted)]">
                  {[medicine.strength, medicine.category, medicine.packSize]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </Td>
              <Td>{medicine.company ?? '—'}</Td>
              <Td>₹{medicine.mrp.toFixed(2)}</Td>
              <Td>
                <span
                  className={
                    medicine.stock?.isLow
                      ? 'font-semibold text-[var(--color-danger)]'
                      : 'font-semibold text-[var(--color-primary)]'
                  }
                >
                  {medicine.stock?.available ?? 0}
                </span>
              </Td>
              <Td>
                <Button
                  variant="danger"
                  className="!px-2.5 !py-1.5 text-xs"
                  onClick={() => {
                    if (window.confirm(`Delete ${medicine.name}?`)) {
                      deleteMutation.mutate(medicine.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Medicine"
        description="Create a product and optional opening stock."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-medicine-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Medicine'}
            </Button>
          </>
        }
      >
        <form id="create-medicine-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Company"
            value={form.company}
            onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
          />
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          />
          <Input
            label="Strength"
            value={form.strength}
            onChange={(e) => setForm((prev) => ({ ...prev, strength: e.target.value }))}
          />
          <Input
            label="Pack size"
            value={form.packSize}
            onChange={(e) => setForm((prev) => ({ ...prev, packSize: e.target.value }))}
          />
          <Input
            label="MRP"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.mrp}
            onChange={(e) => setForm((prev) => ({ ...prev, mrp: Number(e.target.value) }))}
          />
          <Input
            label="Opening stock"
            type="number"
            min={0}
            value={form.openingStock}
            onChange={(e) => setForm((prev) => ({ ...prev, openingStock: Number(e.target.value) }))}
          />
          <Input
            label="Minimum stock alert"
            type="number"
            min={0}
            value={form.minimumStockAlert}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, minimumStockAlert: Number(e.target.value) }))
            }
          />
        </form>
      </Modal>
    </div>
  );
}
