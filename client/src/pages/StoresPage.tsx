import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { storesApi, type CreateStorePayload } from '@/services/stores.service';

const emptyForm: CreateStorePayload = {
  name: '',
  gstNumber: '',
  ownerName: '',
  drugLicenseNumber: '',
  phone: '',
  city: '',
};

export function StoresPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateStorePayload>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
  });

  const table = useClientTable({
    data: storesQuery.data ?? [],
    searchKeys: ['name', 'ownerName', 'gstNumber', 'drugLicenseNumber', 'city'],
    initialSortKey: 'name',
  });

  const createMutation = useMutation({
    mutationFn: storesApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: storesApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Medical store deleted');
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
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
      gstNumber: form.gstNumber || undefined,
      ownerName: form.ownerName || undefined,
      drugLicenseNumber: form.drugLicenseNumber || undefined,
      phone: form.phone || undefined,
      city: form.city || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Medical Stores"
        description="Partner store directory with GST and contact details."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add Store
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search stores…"
        />
        <DataTable
          columns={[
            { key: 'name', label: 'Store', sortable: true },
            { key: 'ownerName', label: 'Owner', sortable: true },
            { key: 'gstNumber', label: 'GST', sortable: true },
            { key: 'drugLicenseNumber', label: 'License', sortable: true },
            { key: 'city', label: 'City', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={storesQuery.isLoading}
          empty={
            !storesQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No stores found' : 'No matching stores'}
                description={
                  table.totalAll === 0
                    ? 'Add a medical store to begin.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((store) => (
            <tr key={store.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{store.name}</Td>
              <Td>
                <div>{store.ownerName ?? '—'}</div>
                <div className="text-[var(--color-muted)]">{store.phone ?? ''}</div>
              </Td>
              <Td>{store.gstNumber ?? '—'}</Td>
              <Td>{store.drugLicenseNumber ?? '—'}</Td>
              <Td>{store.city ?? '—'}</Td>
              <Td>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget({ id: store.id, name: store.name })}
                >
                  Delete
                </Button>
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
        title="Add Medical Store"
        description="Register a partner pharmacy or retail medical store with GST and drug license credentials."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-store-form" loading={createMutation.isPending}>
              {createMutation.isPending ? 'Registering Store…' : 'Save Medical Store'}
            </Button>
          </>
        }
      >
        <form id="create-store-form" className="space-y-4" onSubmit={onCreate}>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              Store & Licensing Information
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Medical Store Name"
                required
                placeholder="e.g. Apollo Pharmacy / Sanjeevani Medicos"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Owner / Pharmacist Name"
                placeholder="e.g. Ramesh Chandra"
                value={form.ownerName}
                onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))}
              />
              <Input
                label="GST Identification Number"
                placeholder="e.g. 07AAAAA0000A1Z5"
                value={form.gstNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value }))}
              />
              <Input
                label="Drug License Number (DL)"
                placeholder="e.g. DL-20B/21B-12345"
                value={form.drugLicenseNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, drugLicenseNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Contact & Location
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Store Contact Phone"
                placeholder="+91 98765 11111"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <Input
                label="City / Territory"
                placeholder="e.g. Varanasi, Prayagraj"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        title="Confirm Delete"
        description={`Are you sure you want to delete medical store “${deleteTarget?.name}”?`}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
