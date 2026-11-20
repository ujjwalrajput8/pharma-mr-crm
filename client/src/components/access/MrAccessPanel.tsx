import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, Badge, Card } from '@/components/ui/Page';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { permissionsApi, type MrAccessItem } from '@/services/permissions.service';

const SECTION_NOTE: Record<string, string> = {
  Dashboard: 'Home screens',
  Submit: 'What the MR fills in',
  'Stockist Statement': 'Monthly entry; quarterly and yearly worked out',
  View: 'Lists and reports the MR can open',
  'MSL Management': 'Add / remove requests — the Manager approves',
  Approval: 'Status of what the MR sent for approval',
  Stock: 'Sample bag',
};

/**
 * MR menu switches for every MR at once. An item that is off disappears from the MR
 * menu and its screens / API answer "no access"; the Dashboard is always on.
 */
export function MrAccessPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  // null = untouched (shows what is saved); a list once Admin flips a switch.
  const [edited, setEdited] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const query = useQuery({ queryKey: ['permissions', 'mr'], queryFn: () => permissionsApi.getMrAccess() });

  const sections = useMemo(() => {
    const map = new Map<string, MrAccessItem[]>();
    for (const item of query.data?.items ?? []) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return [...map.entries()];
  }, [query.data]);

  const saved = query.data?.enabled ?? [];
  const draft = edited ?? saved;
  const dirty = edited !== null && (edited.length !== saved.length || edited.some((key) => !saved.includes(key)));

  const onSaved = (message: string) => async () => {
    setError(null);
    setEdited(null);
    toast.success(message, 'MRs see the change on their next page load.');
    await queryClient.invalidateQueries({ queryKey: ['permissions', 'mr'] });
  };
  const save = useMutation({
    mutationFn: () => permissionsApi.setMrAccess(draft),
    onSuccess: onSaved('MR access saved'),
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const reset = useMutation({
    mutationFn: () => permissionsApi.resetMrAccess(),
    onSuccess: async () => {
      setConfirmReset(false);
      await onSaved('MR access back to defaults')();
    },
    onError: (err) => {
      setConfirmReset(false);
      setError(getApiErrorMessage(err));
    },
  });

  const toggle = (key: string, on: boolean) =>
    setEdited((prev) => {
      const list = prev ?? saved;
      return on ? [...new Set([...list, key])] : list.filter((k) => k !== key);
    });

  return (
    <div className="space-y-4" data-testid="mr-access">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Menu for every MR</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Switch an item off and it leaves the MR menu, and its screens answer “no access”. Dashboard is always on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={query.data?.customized ? 'warning' : 'neutral'}>{query.data?.customized ? 'Custom' : 'Defaults'}</Badge>
          <Button variant="secondary" size="sm" disabled={!query.data?.customized || reset.isPending} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} />
            Reset to defaults
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>
            Save MR access
          </Button>
        </div>
      </Card>

      {error ? <Alert message={error} /> : null}
      {query.isLoading ? <p className="text-sm text-[var(--color-muted)]">Loading MR menu…</p> : null}
      {query.isError ? <Alert message={getApiErrorMessage(query.error)} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map(([section, items]) => (
          <Card key={section} className="p-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">{section}</h3>
            <p className="mb-3 text-xs text-[var(--color-muted)]">{SECTION_NOTE[section] ?? ''}</p>
            <ul className="divide-y divide-[var(--color-border)]">
              {items.map((item) => {
                const on = draft.includes(item.key);
                const isDefault = query.data?.defaults.includes(item.key);
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--color-ink)]">{item.label}</span>
                      <span className="block text-[11px] text-[var(--color-muted)]">
                        {on ? 'Shown to MRs' : 'Hidden from MRs'}
                        {isDefault ? '' : ' · off by default'}
                      </span>
                    </span>
                    <Switch checked={on} label={item.label} onChange={(next) => toggle(item.key, next)} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={confirmReset}
        variant="generic"
        badge="MR access"
        title="Back to the default MR menu?"
        description="Every MR gets the standard menu again. Your switches are cleared."
        confirmLabel="Reset"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
