import { AlertTriangle, PencilLine } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Page';
import type { MrUser } from '@/services/users.service';

interface TreeNode {
  user: MrUser;
  children: TreeNode[];
  /** Something about this reporting link an Admin should look at (never auto-fixed). */
  problem: string | null;
}

/** Builds RSM → ASM → MR from managerId. Anyone whose manager is missing becomes a root. */
function buildTree(people: MrUser[]): TreeNode[] {
  const byId = new Map(people.map((person) => [person.id, person]));

  // Walks up from a person; true when the walk comes back round to them.
  const inLoop = (start: MrUser) => {
    const seen = new Set<number>();
    let cursor: MrUser | undefined = start;
    while (cursor?.managerId) {
      if (seen.has(cursor.id)) return true;
      seen.add(cursor.id);
      cursor = byId.get(cursor.managerId);
      if (cursor?.id === start.id) return true;
    }
    return false;
  };

  const problemOf = (person: MrUser): string | null => {
    const manager = person.managerId ? byId.get(person.managerId) : undefined;
    if (inLoop(person)) return 'Reporting loop — fix this line';
    if (!manager) return null;
    if (manager.role === 'MR') return `Reports to ${manager.fullName}, who is an MR`;
    if (manager.status !== 'ACTIVE') return `Reports to ${manager.fullName}, who is inactive`;
    return null;
  };

  const nodes = new Map<number, TreeNode>(
    people.map((person) => [person.id, { user: person, children: [], problem: problemOf(person) }]),
  );
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.user.managerId ? nodes.get(node.user.managerId) : undefined;
    // People in a loop are shown at the top so they are not lost inside it.
    if (parent && !node.problem?.startsWith('Reporting loop')) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) =>
      a.user.role === b.user.role ? a.user.fullName.localeCompare(b.user.fullName) : a.user.role === 'MANAGER' ? -1 : 1,
    );
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/**
 * Read-only reporting tree for Users & Hierarchy. Problem links (inactive
 * manager, MR as manager, loops) are marked for the Admin to fix by hand.
 */
export function HierarchyTree({ people, onEdit }: { people: MrUser[]; onEdit: (user: MrUser) => void }) {
  const roots = buildTree(people);
  if (roots.length === 0) {
    return <EmptyState title="No accounts yet" description="Add Managers and MRs to see the reporting tree." />;
  }
  return (
    <ul className="space-y-1 p-3" data-testid="hierarchy-tree">
      {roots.map((node) => (
        <Branch key={node.user.id} node={node} depth={0} onEdit={onEdit} />
      ))}
    </ul>
  );
}

function Branch({ node, depth, onEdit }: { node: TreeNode; depth: number; onEdit: (user: MrUser) => void }) {
  const { user } = node;
  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-bg)]"
        style={{ marginLeft: depth * 22 }}
        data-testid="tree-node"
        data-name={user.fullName}
        data-depth={depth}
      >
        {depth > 0 ? <span aria-hidden className="h-px w-3 bg-[var(--color-border-strong)]" /> : null}
        <Avatar name={user.fullName} userId={user.id} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.fullName}</p>
          <p className="truncate text-[11px] text-[var(--color-muted)]">
            {user.designation ?? user.role}
            {node.children.length ? ` · ${node.children.length} direct` : ''}
          </p>
        </div>
        <Badge tone={user.role === 'MANAGER' ? 'primary' : 'neutral'}>{user.role}</Badge>
        {user.status !== 'ACTIVE' ? <Badge tone="neutral">Inactive</Badge> : null}
        {node.problem ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-warning)]">
            <AlertTriangle size={12} />
            {node.problem}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onEdit(user)} aria-label={`Edit ${user.fullName}`}>
          <PencilLine size={13} />
          Edit
        </Button>
      </div>
      {node.children.length ? (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <Branch key={child.user.id} node={child} depth={depth + 1} onEdit={onEdit} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
