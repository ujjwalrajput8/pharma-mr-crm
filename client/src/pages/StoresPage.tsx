import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateStorePayload>(emptyForm);

  const storesQuery = useQuery({
    queryKey: ['stores', search],
    queryFn: () => storesApi.list(search || undefined),
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
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
    onError: (err) => setError(getApiErrorMessage(err)),
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

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-[var(--color-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <Card>
        <DataTable
          columns={['Store', 'Owner', 'GST', 'License', 'City', 'Actions']}
          loading={storesQuery.isLoading}
          empty={
            !storesQuery.isLoading && storesQuery.data?.length === 0 ? (
              <EmptyState title="No stores found" description="Add a medical store to begin." />
            ) : null
          }
        >
          {storesQuery.data?.map((store) => (
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
                  className="!px-2.5 !py-1.5 text-xs"
                  onClick={() => {
                    if (window.confirm(`Delete ${store.name}?`)) deleteMutation.mutate(store.id);
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
        title="Add Medical Store"
        description="Save partner pharmacy / medical store details."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-store-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Store'}
            </Button>
          </>
        }
      >
        <form id="create-store-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Input
            label="Store name"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Owner name"
            value={form.ownerName}
            onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))}
          />
          <Input
            label="GST number"
            value={form.gstNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value }))}
          />
          <Input
            label="Drug license number"
            value={form.drugLicenseNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, drugLicenseNumber: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            className="sm:col-span-2"
            label="City"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
