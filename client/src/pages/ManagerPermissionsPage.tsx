import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import {
  permissionsApi,
  type ManagerPermissionState,
  type ManagerPermissionSummary,
} from '@/services/permissions.service';

export function ManagerPermissionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<string[]>([]);

  const managersQuery = useQuery({
    queryKey: ['permissions', 'managers'],
    queryFn: () => permissionsApi.listManagers(),
  });

  const detailQuery = useQuery({
    queryKey: ['permissions', 'managers', selectedId],
    queryFn: () => permissionsApi.getManager(selectedId!),
    enabled: selectedId != null,
  });

  useEffect(() => {
    if (detailQuery.data) {
      setDraft([...detailQuery.data.effective]);
    }
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedId == null) throw new Error('No manager selected');
      return permissionsApi.setManager(selectedId, draft);
    },
    onSuccess: async () => {
      setError(null);
      toast.success('Manager permissions saved');
      await queryClient.invalidateQueries({ queryKey: ['permissions', 'managers'] });
      await queryClient.invalidateQueries({ queryKey: ['permissions', 'managers', selectedId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (selectedId == null) throw new Error('No manager selected');
      return permissionsApi.resetManager(selectedId);
    },
    onSuccess: async (state) => {
      setError(null);
      setDraft([...state.effective]);
      toast.success('Reset to role defaults');
      await queryClient.invalidateQueries({ queryKey: ['permissions', 'managers'] });
      await queryClient.invalidateQueries({ queryKey: ['permissions', 'managers', selectedId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const grouped = useMemo(() => groupCatalog(detailQuery.data), [detailQuery.data]);

  function toggle(key: string): void {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function selectAllDefaults(): void {
    if (!detailQuery.data) return;
    setDraft([...detailQuery.data.defaults]);
  }

  function openEditor(row: ManagerPermissionSummary): void {
    setError(null);
    setSelectedId(row.id);
  }

  function closeEditor(): void {
    setSelectedId(null);
    setDraft([]);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manager permissions"
        description="Default Manager access is fixed. Customize per ASM/RSM when needed."
      />

      {error && selectedId == null ? <Alert message={error} /> : null}

      <Card className="p-4">
        <DataTable
          columns={[
            { key: 'fullName', label: 'Manager' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' },
            { key: 'access', label: 'Access' },
            { key: 'actions', label: 'Actions' },
          ]}
          loading={managersQuery.isLoading}
          empty={
            !managersQuery.isLoading && !(managersQuery.data?.length ?? 0) ? (
              <EmptyState
                title="No managers yet"
                description="Create a Manager account first, then assign permissions here."
              />
            ) : null
          }
        >
          {(managersQuery.data ?? []).map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{row.fullName}</Td>
              <Td>{row.email}</Td>
              <Td>
                <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.permissionsCustomized ? 'warning' : 'neutral'}>
                    {row.permissionsCustomized ? 'Custom' : 'Defaults'}
                  </Badge>
                  <span className="text-xs text-[var(--color-muted)]">
                    {row.permissionCount} permissions
                  </span>
                </div>
              </Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => openEditor(row)}>
                  <Shield size={14} />
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Modal
        open={selectedId != null}
        onClose={closeEditor}
        title={detailQuery.data?.user.fullName ?? 'Manager permissions'}
        description={
          detailQuery.data
            ? `${detailQuery.data.user.email} · ${
                detailQuery.data.user.permissionsCustomized ? 'Customized' : 'Using role defaults'
              }`
            : 'Loading…'
        }
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={resetMutation.isPending || !detailQuery.data}
              onClick={() => resetMutation.mutate()}
            >
              Reset defaults
            </Button>
            <Button
              disabled={saveMutation.isPending || draft.length === 0}
              onClick={() => saveMutation.mutate()}
            >
              Save permissions
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="mb-4">
            <Alert message={error} />
          </div>
        ) : null}

        {detailQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading permission catalog…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={selectAllDefaults}>
                Apply default set
              </Button>
              <span className="text-xs self-center text-[var(--color-muted)]">
                {draft.length} selected
              </span>
            </div>

            {grouped.map((section) => (
              <div key={section.group} className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">{section.group}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {section.items.map((item) => {
                    const checked = draft.includes(item.key);
                    const isDefault = detailQuery.data?.defaults.includes(item.key);
                    return (
                      <li key={item.key}>
                        <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg)]">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggle(item.key)}
                          />
                          <span>
                            <span className="block font-medium">{item.label}</span>
                            <span className="block text-xs text-[var(--color-muted)]">
                              {item.key}
                              {isDefault ? ' · default' : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function groupCatalog(state: ManagerPermissionState | undefined) {
  if (!state) return [] as { group: string; items: ManagerPermissionState['catalog'] }[];
  const map = new Map<string, ManagerPermissionState['catalog']>();
  for (const item of state.catalog) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}
