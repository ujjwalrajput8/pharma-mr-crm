import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input, Select } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { medicinesApi, type CreateMedicinePayload } from '@/services/medicines.service';

const emptyForm: CreateMedicinePayload = {
  name: '',
  brandName: '',
  genericName: '',
  company: '',
  category: '',
  strength: '',
  composition: '',
  packSize: '',
  mrp: 0,
  batchNumber: '',
  expiryDate: '',
  openingStock: 0,
  minimumStockAlert: 10,
  sampleAvailable: true,
};

export function MedicinesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMedicinePayload>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
  });

  const table = useClientTable({
    data: medicinesQuery.data ?? [],
    searchKeys: ['name', 'brandName', 'batchNumber', 'stock.available', 'sampleAvailable'],
    getSortValue: (row, key) => (key === 'stock' ? row.stock?.available ?? 0 : undefined),
    initialSortKey: 'name',
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
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Medicine deleted');
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      toast.error('Delete failed', getApiErrorMessage(err));
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      name: form.name,
      brandName: form.brandName || undefined,
      genericName: form.genericName || undefined,
      company: form.company || undefined,
      category: form.category || undefined,
      strength: form.strength || undefined,
      composition: form.composition || undefined,
      packSize: form.packSize || undefined,
      mrp: Number(form.mrp),
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
      openingStock: Number(form.openingStock ?? 0),
      minimumStockAlert: Number(form.minimumStockAlert ?? 10),
      sampleAvailable: form.sampleAvailable !== false,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Medicines"
        description="Medicine master: brand, generic, batch, expiry, stock and samples."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add Medicine
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search medicines…"
        />
        <DataTable
          columns={[
            { key: 'name', label: 'Medicine', sortable: true },
            { key: 'brandName', label: 'Brand / Generic', sortable: true },
            { key: 'batchNumber', label: 'Batch / Expiry', sortable: true },
            { key: 'stock', label: 'Stock', sortable: true },
            { key: 'sampleAvailable', label: 'Samples', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={medicinesQuery.isLoading}
          empty={
            !medicinesQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No medicines found' : 'No matching medicines'}
                description={
                  table.totalAll === 0
                    ? 'Add products to the catalog.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((medicine) => (
            <tr key={medicine.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>
                <Link to={`/medicines/${medicine.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {medicine.name}
                </Link>
                <div className="text-[var(--color-muted)]">
                  {[medicine.strength, medicine.category, medicine.company].filter(Boolean).join(' · ') || '—'}
                </div>
              </Td>
              <Td>
                <div>{medicine.brandName || '—'}</div>
                <div className="text-xs text-[var(--color-muted)]">{medicine.genericName || '—'}</div>
              </Td>
              <Td>
                <div>{medicine.batchNumber || '—'}</div>
                <div className="text-xs text-[var(--color-muted)]">{medicine.expiryDate || '—'}</div>
              </Td>
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
              <Td>{medicine.sampleAvailable ? 'Yes' : 'No'}</Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/medicines/${medicine.id}`}>
                    <Button variant="secondary" size="sm">
                      Details
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: medicine.id, name: medicine.name })}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          from={table.from}
          to={table.to}
          total={table.filteredTotal}
          pageSize={table.pageSize}
          pageSizeOptions={table.pageSizeOptions}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Medicine Master"
        description="Register pharmaceutical products into catalog with batch specifications, MRP, and stock controls."
        className="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-medicine-form" loading={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Medicine'}
            </Button>
          </>
        }
      >
        <form id="create-medicine-form" className="space-y-4" onSubmit={onCreate}>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              Molecule & Brand Identity
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Medicine Name"
                required
                placeholder="e.g. Jovamox 500"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Brand Name"
                placeholder="e.g. Jovamox"
                value={form.brandName}
                onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
              />
              <Input
                label="Generic / Active Salt"
                placeholder="e.g. Amoxicillin Trihydrate"
                value={form.genericName}
                onChange={(e) => setForm((prev) => ({ ...prev, genericName: e.target.value }))}
              />
              <Input
                label="Manufacturing Company"
                placeholder="e.g. Jovance Laboratories"
                value={form.company}
                onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Formulation & Batch Details
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Composition Details"
                placeholder="e.g. Amoxicillin 500mg + Clavulanic Acid 125mg"
                value={form.composition}
                onChange={(e) => setForm((prev) => ({ ...prev, composition: e.target.value }))}
              />
              <Input
                label="Strength / Dosage Form"
                placeholder="e.g. 500mg Tablet / 100ml Syrup"
                value={form.strength}
                onChange={(e) => setForm((prev) => ({ ...prev, strength: e.target.value }))}
              />
              <Input
                label="Therapeutic Category"
                placeholder="e.g. Antibiotic, Analgesic, Cardiology"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              />
              <Input
                label="Initial Batch Number"
                placeholder="e.g. BATCH-2026-A1"
                value={form.batchNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, batchNumber: e.target.value }))}
              />
              <DatePicker
                label="Expiry Date"
                value={form.expiryDate || ''}
                onChange={(value) => setForm((prev) => ({ ...prev, expiryDate: value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Pricing & Inventory Controls
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="MRP (₹)"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="0.00"
                value={form.mrp}
                onChange={(e) => setForm((prev) => ({ ...prev, mrp: Number(e.target.value) }))}
              />
              <Input
                label="Opening Stock"
                type="number"
                min={0}
                value={form.openingStock}
                onChange={(e) => setForm((prev) => ({ ...prev, openingStock: Number(e.target.value) }))}
              />
              <Input
                label="Low Stock Alert Threshold"
                type="number"
                min={0}
                value={form.minimumStockAlert}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, minimumStockAlert: Number(e.target.value) }))
                }
              />
              <Select
                label="Sample Available for MR"
                value={form.sampleAvailable === false ? 'no' : 'yes'}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sampleAvailable: e.target.value === 'yes' }))
                }
              >
                <option value="yes">Yes (Distributable)</option>
                <option value="no">No (Commercial Only)</option>
              </Select>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        title="Confirm Delete"
        description={`Are you sure you want to delete medicine “${deleteTarget?.name}”?`}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
