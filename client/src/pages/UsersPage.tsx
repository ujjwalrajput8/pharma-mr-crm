import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
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
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMrPayload>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });

  const table = useClientTable({
    data: usersQuery.data ?? [],
    searchKeys: ['employeeCode', 'fullName', 'email', 'assignedArea', 'status'],
    initialSortKey: 'fullName',
  });

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
      id: number;
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
      setDeleteTarget(null);
      setResetTarget(null);
      setResetPassword('');
      toast.success('MR updated');
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

      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search MRs…"
        />
        <DataTable
          columns={[
            { key: 'employeeCode', label: 'Code', sortable: true },
            { key: 'fullName', label: 'Name', sortable: true },
            { key: 'email', label: 'Email', sortable: true },
            { key: 'assignedArea', label: 'Area', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={usersQuery.isLoading}
          empty={
            !usersQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No MR accounts yet' : 'No matching MRs'}
                description={
                  table.totalAll === 0
                    ? 'Click Add MR to create the first account.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((user) => (
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
                      size="sm"
                      onClick={() => actionMutation.mutate({ id: user.id, action: 'deactivate' })}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => actionMutation.mutate({ id: user.id, action: 'activate' })}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setResetTarget({ id: user.id, name: user.fullName });
                      setResetPassword('');
                    }}
                  >
                    Reset password
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: user.id, name: user.fullName })}
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
          <DatePicker
            label="Joining date"
            value={form.joiningDate ?? ''}
            onChange={(joiningDate) => setForm((prev) => ({ ...prev, joiningDate }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        title="Confirm Delete"
        description={`Are you sure you want to delete MR “${deleteTarget?.name}”?`}
        loading={actionMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && actionMutation.mutate({ id: deleteTarget.id, action: 'remove' })
        }
      />

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        description={`Set a new password for ${resetTarget?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={actionMutation.isPending || resetPassword.length < 8}
              onClick={() =>
                resetTarget &&
                actionMutation.mutate({
                  id: resetTarget.id,
                  action: 'reset',
                  password: resetPassword,
                })
              }
            >
              {actionMutation.isPending ? 'Saving…' : 'Reset Password'}
            </Button>
          </>
        }
      >
        <Input
          label="New password"
          type="password"
          minLength={8}
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
        />
      </Modal>
    </div>
  );
}
