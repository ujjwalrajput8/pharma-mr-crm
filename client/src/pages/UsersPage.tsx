import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input, Select } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
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
  role: 'MR',
  employeeCode: '',
  designation: '',
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
  const managersQuery = useQuery({
    queryKey: ['users', 'manager-options'],
    queryFn: () => usersApi.managerOptions(),
    enabled: open,
  });

  const table = useClientTable({
    data: usersQuery.data ?? [],
    searchKeys: [
      'employeeCode',
      'fullName',
      'email',
      'role',
      'designation',
      'assignedArea',
      'managerName',
      'status',
    ],
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
      toast.success('Account updated');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      phone: form.phone?.trim() ? form.phone.trim() : undefined,
      designation: form.designation?.trim() ? form.designation.trim() : undefined,
      address: form.address?.trim() ? form.address.trim() : undefined,
      assignedArea: form.assignedArea?.trim() ? form.assignedArea.trim() : undefined,
      joiningDate: form.joiningDate || undefined,
      managerId: form.managerId ? Number(form.managerId) : undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users & Hierarchy"
        description="Create MR and Manager (ASM / RSM) logins and set who reports to whom."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add account
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search name, code, role, manager…"
        />
        <DataTable
          columns={[
            { key: 'employeeCode', label: 'Code', sortable: true },
            { key: 'fullName', label: 'Name', sortable: true },
            { key: 'role', label: 'Role', sortable: true },
            { key: 'managerName', label: 'Reports to', sortable: true },
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
                title={table.totalAll === 0 ? 'No accounts yet' : 'No matching accounts'}
                description={
                  table.totalAll === 0
                    ? 'Click Add account to create the first Manager or MR login.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((user) => (
            <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-mono text-xs">{user.employeeCode ?? '—'}</Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar name={user.fullName} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.fullName}</div>
                    <div className="truncate text-[11px] text-[var(--color-muted)]">
                      {user.designation ?? user.email}
                    </div>
                  </div>
                </div>
              </Td>
              <Td>
                <Badge tone={user.role === 'MANAGER' ? 'primary' : 'neutral'}>{user.role}</Badge>
              </Td>
              <Td className="text-xs">{user.managerName ?? '—'}</Td>
              <Td className="text-xs">{user.assignedArea ?? '—'}</Td>
              <Td>
                <Badge tone={user.status === 'ACTIVE' ? 'success' : 'neutral'}>{user.status}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/employees/${user.id}`}>
                    <Button variant="ghost" size="sm">
                      Profile
                      <ChevronRight size={13} />
                    </Button>
                  </Link>
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
        title="Add account"
        description="Create an MR or a Manager (ASM / RSM) login, with its place in the reporting hierarchy."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-mr-form" loading={createMutation.isPending}>
              {createMutation.isPending
                ? 'Provisioning Account…'
                : `Create ${form.role === 'MANAGER' ? 'Manager' : 'MR'} Account`}
            </Button>
          </>
        }
      >
        <form id="create-mr-form" className="space-y-4" onSubmit={onCreate}>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              Account Credentials
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Role"
                required
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    role: e.target.value as CreateMrPayload['role'],
                  }))
                }
                hint="Managers approve leave and see their whole team"
              >
                <option value="MR">Medical Representative</option>
                <option value="MANAGER">Manager (ASM / RSM)</option>
              </Select>
              <Select
                label="Reports to"
                value={form.managerId ? String(form.managerId) : ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    managerId: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                hint={
                  form.role === 'MANAGER'
                    ? 'A Manager may report to another Manager (ASM → RSM)'
                    : 'The ASM this MR reports to'
                }
              >
                <option value="">No reporting manager</option>
                {(managersQuery.data ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName}
                    {manager.designation ? ` — ${manager.designation}` : ''}
                  </option>
                ))}
              </Select>
              <Input
                label="Employee Code"
                required
                placeholder="e.g. MR-2026-042"
                value={form.employeeCode}
                onChange={(e) => setForm((prev) => ({ ...prev, employeeCode: e.target.value }))}
              />
              <Input
                label="Designation"
                placeholder="e.g. Medical Representative"
                value={form.designation ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
              />
              <Input
                label="Full Name"
                required
                placeholder="e.g. Vikramaditya Singh"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
              <Input
                label="Work Email"
                type="email"
                required
                placeholder="representative@jovance.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <Input
                label="Temporary Password"
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Territory & Contact
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Assigned Territory / Area"
                placeholder="e.g. North Zone - Lucknow HQ"
                value={form.assignedArea}
                onChange={(e) => setForm((prev) => ({ ...prev, assignedArea: e.target.value }))}
              />
              <Input
                label="Contact Phone"
                placeholder="+91 98765 00000"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <DatePicker
                label="Joining Date"
                value={form.joiningDate ?? ''}
                onChange={(joiningDate) => setForm((prev) => ({ ...prev, joiningDate }))}
              />
              <Input
                label="Residential Address"
                placeholder="HQ City / Residence"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        title="Confirm Delete"
        description={`Are you sure you want to delete “${deleteTarget?.name}”? Accounts with direct reports must be reassigned first.`}
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
        description={`Set a new temporary password for ${resetTarget?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={actionMutation.isPending}
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
              {actionMutation.isPending ? 'Resetting…' : 'Reset Password'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Password"
            type="password"
            minLength={8}
            placeholder="Minimum 8 characters"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <p className="text-xs text-[var(--color-muted)]">
            The user will be able to log in with this new password immediately across all active devices.
          </p>
        </div>
      </Modal>
    </div>
  );
}
