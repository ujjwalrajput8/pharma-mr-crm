import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { usersApi, type CreateMrPayload } from '@/services/users.service';

const emptyForm: CreateMrPayload = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  employeeCode: '',
  address: '',
  joiningDate: '',
  assignedArea: '',
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMrPayload>(emptyForm);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      action: 'activate' | 'deactivate' | 'remove' | 'reset';
      password?: string;
    }) => {
      if (input.action === 'activate') return usersApi.activate(input.id);
      if (input.action === 'deactivate') return usersApi.deactivate(input.id);
      if (input.action === 'remove') return usersApi.remove(input.id);
      if (!input.password) throw new Error('Password required');
      return usersApi.resetPassword(input.id, input.password);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      phone: form.phone?.trim() ? form.phone.trim() : undefined,
      address: form.address?.trim() ? form.address.trim() : undefined,
      assignedArea: form.assignedArea?.trim() ? form.assignedArea.trim() : undefined,
      joiningDate: form.joiningDate || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="MR Management"
        description="Create and manage Medical Representative accounts."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add MR
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <DataTable
          columns={['Code', 'Name', 'Email', 'Area', 'Status', 'Actions']}
          loading={usersQuery.isLoading}
          empty={
            !usersQuery.isLoading && usersQuery.data?.length === 0 ? (
              <EmptyState title="No MR accounts yet" description="Click Add MR to create the first account." />
            ) : null
          }
        >
          {usersQuery.data?.map((user) => (
            <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{user.employeeCode ?? '—'}</Td>
              <Td>
                <div className="font-medium">{user.fullName}</div>
                <div className="text-[var(--color-muted)]">{user.phone ?? '—'}</div>
              </Td>
              <Td>{user.email}</Td>
              <Td>{user.assignedArea ?? '—'}</Td>
              <Td>
                <Badge tone={user.status === 'ACTIVE' ? 'success' : 'neutral'}>{user.status}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  {user.status === 'ACTIVE' ? (
                    <Button
                      variant="secondary"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => actionMutation.mutate({ id: user.id, action: 'deactivate' })}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => actionMutation.mutate({ id: user.id, action: 'activate' })}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => {
                      const password = window.prompt('Enter new password (min 8 chars)');
                      if (password) actionMutation.mutate({ id: user.id, action: 'reset', password });
                    }}
                  >
                    Reset password
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => {
                      if (window.confirm(`Delete ${user.fullName}?`)) {
                        actionMutation.mutate({ id: user.id, action: 'remove' });
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Medical Representative"
        description="Only Admin can create MR accounts. No public registration."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-mr-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create MR'}
            </Button>
          </>
        }
      >
        <form id="create-mr-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Input
            label="Employee code"
            required
            value={form.employeeCode}
            onChange={(e) => setForm((prev) => ({ ...prev, employeeCode: e.target.value }))}
          />
          <Input
            label="Full name"
            required
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label="Temporary password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <Input
            label="Assigned area"
            value={form.assignedArea}
            onChange={(e) => setForm((prev) => ({ ...prev, assignedArea: e.target.value }))}
          />
          <Input
            label="Joining date"
            type="date"
            value={form.joiningDate}
            onChange={(e) => setForm((prev) => ({ ...prev, joiningDate: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
