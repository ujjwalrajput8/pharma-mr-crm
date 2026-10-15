import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  Stethoscope,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Modal, FormSection } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  TERRITORY_CHILD_OF,
  TERRITORY_TYPE_LABEL,
  territoriesApi,
  type TerritoryTreeNode,
  type TerritoryType,
} from '@/services/territories.service';

const TYPE_TONE: Record<TerritoryType, 'primary' | 'success' | 'warning' | 'neutral'> = {
  STATE: 'primary',
  DISTRICT: 'success',
  HQ: 'warning',
  BEAT: 'neutral',
};

interface FormState {
  id: number | null;
  name: string;
  type: TerritoryType;
  parentId: number | null;
  parentName: string | null;
  code: string;
  latitude: string;
  longitude: string;
  geofenceRadiusM: string;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  type: 'STATE',
  parentId: null,
  parentName: null,
  code: '',
  latitude: '',
  longitude: '',
  geofenceRadiusM: '',
};

function flatten(
  nodes: TerritoryTreeNode[],
  depth: number,
  collapsed: Set<number>,
): Array<{ node: TerritoryTreeNode; depth: number }> {
  const rows: Array<{ node: TerritoryTreeNode; depth: number }> = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (!collapsed.has(node.id) && node.children.length > 0) {
      rows.push(...flatten(node.children, depth + 1, collapsed));
    }
  }
  return rows;
}

export function TerritoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TerritoryTreeNode | null>(null);

  const treeQuery = useQuery({
    queryKey: ['territories', 'tree'],
    queryFn: () => territoriesApi.tree(true),
  });

  const rows = useMemo(
    () => flatten(treeQuery.data ?? [], 0, collapsed),
    [treeQuery.data, collapsed],
  );

  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['territories'] });
  }

  const saveMutation = useMutation({
    mutationFn: (input: FormState) => {
      const payload = {
        name: input.name.trim(),
        code: input.code.trim() || null,
        latitude: input.latitude.trim() === '' ? null : Number(input.latitude),
        longitude: input.longitude.trim() === '' ? null : Number(input.longitude),
        geofenceRadiusM:
          input.geofenceRadiusM.trim() === '' ? null : Number(input.geofenceRadiusM),
      };
      return input.id
        ? territoriesApi.update(input.id, payload)
        : territoriesApi.create({
            ...payload,
            code: payload.code ?? undefined,
            type: input.type,
            parentId: input.parentId ?? undefined,
          });
    },
    onSuccess: async (_, input) => {
      setFormOpen(false);
      setError(null);
      toast.success(input.id ? 'Territory updated' : 'Territory created');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => territoriesApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      toast.success('Territory deleted');
      await invalidate();
    },
    onError: (err) => {
      setDeleting(null);
      toast.error('Cannot delete', getApiErrorMessage(err));
    },
  });

  function toggle(id: number): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate(parent: TerritoryTreeNode | null): void {
    const type = parent ? TERRITORY_CHILD_OF[parent.type] : 'STATE';
    if (!type) return;
    setForm({
      ...emptyForm,
      type,
      parentId: parent?.id ?? null,
      parentName: parent?.name ?? null,
    });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(node: TerritoryTreeNode): void {
    setForm({
      id: node.id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      parentName: node.parent?.name ?? null,
      code: node.code ?? '',
      latitude: node.latitude != null ? String(node.latitude) : '',
      longitude: node.longitude != null ? String(node.longitude) : '',
      geofenceRadiusM: node.geofenceRadiusM != null ? String(node.geofenceRadiusM) : '',
    });
    setError(null);
    setFormOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    saveMutation.mutate(form);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Territories"
        description="STATE → DISTRICT → HQ → BEAT. Beats drive the tour plan; HQ / beat centres drive the attendance geo-fence."
        actions={
          <Button size="lg" onClick={() => openCreate(null)}>
            <Plus size={15} />
            Add state
          </Button>
        }
      />

      <Card>
        {treeQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No territories yet"
            description="Start with a state, then add districts, headquarters and beats under it."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map(({ node, depth }) => {
              const childType = TERRITORY_CHILD_OF[node.type];
              const hasChildren = node.children.length > 0;
              return (
                <li
                  key={node.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--color-bg)]/60 sm:flex-nowrap"
                  style={{ paddingLeft: `${12 + depth * 22}px` }}
                >
                  <button
                    type="button"
                    onClick={() => hasChildren && toggle(node.id)}
                    className={
                      hasChildren
                        ? 'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]'
                        : 'h-6 w-6 shrink-0'
                    }
                    aria-label={collapsed.has(node.id) ? 'Expand' : 'Collapse'}
                  >
                    {hasChildren ? (
                      collapsed.has(node.id) ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )
                    ) : null}
                  </button>

                  <Badge tone={TYPE_TONE[node.type]} dot={false}>
                    {TERRITORY_TYPE_LABEL[node.type]}
                  </Badge>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--color-ink)]">
                      {node.name}
                      {node.code ? (
                        <span className="font-mono text-[10px] font-normal text-[var(--color-muted)]">
                          {node.code}
                        </span>
                      ) : null}
                      {node.status === 'INACTIVE' ? <Badge tone="danger">Inactive</Badge> : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
                      {hasChildren ? (
                        <span className="inline-flex items-center gap-1">
                          <Landmark size={11} /> {node.counts.children} child
                        </span>
                      ) : null}
                      {node.counts.users > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} /> {node.counts.users} staff
                        </span>
                      ) : null}
                      {node.counts.doctors > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Stethoscope size={11} /> {node.counts.doctors} doctors
                        </span>
                      ) : null}
                      {node.latitude != null && node.longitude != null ? (
                        <span
                          className="inline-flex items-center gap-1 text-[var(--color-success)]"
                          title={`Geo-fence ${node.geofenceRadiusM ?? '—'} m @ ${node.latitude}, ${node.longitude}`}
                        >
                          <MapPin size={11} />
                          {node.geofenceRadiusM ? `${node.geofenceRadiusM} m fence` : 'located'}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {childType ? (
                      <Button size="sm" variant="soft" onClick={() => openCreate(node)}>
                        <Plus size={12} />
                        {TERRITORY_TYPE_LABEL[childType]}
                      </Button>
                    ) : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => openEdit(node)}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete"
                      className="hover:text-[var(--color-danger)]"
                      onClick={() => setDeleting(node)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Create / edit modal ──────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? `Edit ${TERRITORY_TYPE_LABEL[form.type].toLowerCase()}` : `Add ${TERRITORY_TYPE_LABEL[form.type].toLowerCase()}`}
        description={
          form.parentName
            ? `Under ${form.parentName}`
            : form.type === 'STATE'
              ? 'Top level of the territory tree'
              : undefined
        }
        icon={Landmark}
        badge={TERRITORY_TYPE_LABEL[form.type]}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? <Alert message={error} /> : null}

          <FormSection title="Details" icon={Landmark}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={form.type === 'BEAT' ? 'Hazratganj beat' : 'Lucknow'}
              />
              <Input
                label="Code"
                optional
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="LKO-01"
              />
            </div>
          </FormSection>

          <FormSection title="Geo-fence" icon={MapPin} subtitle="Used for the attendance geo-fence">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Input
                label="Latitude"
                optional
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="26.8467"
              />
              <Input
                label="Longitude"
                optional
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="80.9462"
              />
              <Input
                label="Radius (m)"
                optional
                type="number"
                min={10}
                value={form.geofenceRadiusM}
                onChange={(e) => setForm((f) => ({ ...f, geofenceRadiusM: e.target.value }))}
                placeholder="500"
                hint="Check-ins beyond this get flagged"
              />
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {form.id ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="Deletion is blocked while child territories, employees or doctors still point here."
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
