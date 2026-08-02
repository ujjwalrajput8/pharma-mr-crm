import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { settingsApi } from '@/services/settings.service';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('company.name');
  const [value, setValue] = useState('');
  const [group, setGroup] = useState('branding');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  const upsertMutation = useMutation({
    mutationFn: settingsApi.upsert,
    onSuccess: async () => {
      setError(null);
      setValue('');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const branding = useMemo(
    () => settingsQuery.data?.filter((item) => item.group === 'branding') ?? [],
    [settingsQuery.data],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    upsertMutation.mutate({
      key: key.trim(),
      value: value.trim(),
      group: group.trim() || 'general',
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Organization-level application settings. Branding values come from company documents."
      />

      {error ? <Alert message={error} /> : null}

      <Card className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Branding
        </h3>
        <div className="mt-3 space-y-2">
          {branding.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No branding settings yet. Run seed.</p>
          ) : (
            branding.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-lg bg-[var(--color-surface)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-[var(--color-ink)]">{item.key}</span>
                <span className="text-sm text-[var(--color-muted)]">{item.value}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Upsert setting
        </h3>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Input label="Key" required value={key} onChange={(e) => setKey(e.target.value)} />
          <Input label="Group" required value={group} onChange={(e) => setGroup(e.target.value)} />
          <div className="sm:col-span-2">
            <Textarea
              label="Value"
              required
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Saving…' : 'Save setting'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <DataTable
          columns={['Key', 'Group', 'Value', 'Updated']}
          loading={settingsQuery.isLoading}
          empty={
            !settingsQuery.isLoading && settingsQuery.data?.length === 0 ? (
              <EmptyState title="No settings" description="Create the first setting above." />
            ) : null
          }
        >
          {settingsQuery.data?.map((item) => (
            <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{item.key}</Td>
              <Td>{item.group}</Td>
              <Td>{item.value}</Td>
              <Td>{new Date(item.updatedAt).toLocaleString()}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
