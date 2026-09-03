import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  CalendarCheck2,
  ChevronRight,
  Users,
  UserX,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { Meter } from '@/components/ui/Meter';
import { Badge, Card, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useClientTable } from '@/hooks/useClientTable';
import { employeesApi, type EmployeeListRow } from '@/services/employees.service';
import { formatDisplayDate } from '@/utils/datetime';

type RoleFilter = 'ALL' | 'MANAGER' | 'MR';

function tenureLabel(joiningDate: string | null): string {
  if (!joiningDate) return '—';
  const start = new Date(joiningDate);
  const months =
    (new Date().getFullYear() - start.getFullYear()) * 12 +
    (new Date().getMonth() - start.getMonth());
  if (months < 1) return 'New joiner';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

export function EmployeesPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const employeesQuery = useQuery({
    queryKey: ['employees', 'directory'],
    queryFn: () => employeesApi.list(),
  });

  const all = employeesQuery.data ?? [];
  const rows = roleFilter === 'ALL' ? all : all.filter((row) => row.role === roleFilter);

  const table = useClientTable({
    data: rows,
    getSearchText: (row) =>
      [
        row.fullName,
        row.email,
        row.phone,
        row.employeeCode,
        row.designation,
        row.assignedArea,
        row.manager?.fullName,
        row.status,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'name') return row.fullName;
      if (key === 'code') return row.employeeCode;
      if (key === 'role') return row.role;
      if (key === 'manager') return row.manager?.fullName;
      if (key === 'joining') return row.joiningDate;
      if (key === 'leave') return row.leaveRemaining;
      if (key === 'attendance') return row.monthPresent;
      return undefined;
    },
    initialSortKey: 'name',
    pageSize: 20,
  });

  const stats = {
    total: all.length,
    managers: all.filter((row) => row.role === 'MANAGER').length,
    mrs: all.filter((row) => row.role === 'MR').length,
    inactive: all.filter((row) => row.status !== 'ACTIVE').length,
    onLeaveThisMonth: all.filter((row) => row.monthLeave > 0).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        description="Every MR and Manager with their reporting line, attendance and leave position."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total employees" value={stats.total} icon={Users} />
        <StatTile
          label="Managers"
          value={stats.managers}
          hint="ASM / RSM accounts"
          icon={Briefcase}
          tone="primary"
        />
        <StatTile label="Medical reps" value={stats.mrs} hint="Field force" icon={BadgeCheck} />
        <StatTile
          label="Inactive"
          value={stats.inactive}
          hint="Deactivated accounts"
          icon={UserX}
          tone={stats.inactive > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={roleFilter}
            onChange={setRoleFilter}
            items={[
              { value: 'ALL', label: 'Everyone', count: stats.total },
              { value: 'MANAGER', label: 'Managers', count: stats.managers },
              { value: 'MR', label: 'MRs', count: stats.mrs },
            ]}
          />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-muted)]">
            <CalendarCheck2 size={13} />
            Attendance / leave figures are for the current month & year
          </span>
        </div>

        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search name, code, area, manager…"
        />

        <DataTable
          loading={employeesQuery.isLoading}
          columns={[
            { key: 'name', label: 'Employee', sortable: true },
            { key: 'code', label: 'Code', sortable: true },
            { key: 'role', label: 'Role', sortable: true },
            { key: 'manager', label: 'Reports to', sortable: true },
            { key: 'joining', label: 'Tenure', sortable: true },
            { key: 'attendance', label: 'This month', sortable: true },
            { key: 'leave', label: 'Leave left', sortable: true },
            { key: 'actions', label: '' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          empty={
            table.rows.length === 0 ? (
              <EmptyState
                title="No employees found"
                description="Create MR and Manager accounts from Users & Hierarchy."
              />
            ) : null
          }
        >
          {table.rows.map((row: EmployeeListRow) => (
            <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={row.fullName} photoUrl={row.photoUrl} />
                  <div className="min-w-0">
                    <Link
                      to={`/employees/${row.id}`}
                      className="truncate text-sm font-semibold hover:text-[var(--color-primary)] hover:underline"
                    >
                      {row.fullName}
                    </Link>
                    <p className="truncate text-[11px] text-[var(--color-muted)]">
                      {row.designation ?? row.email}
                    </p>
                  </div>
                </div>
              </Td>
              <Td className="font-mono text-xs">{row.employeeCode ?? '—'}</Td>
              <Td>
                <Badge tone={row.role === 'MANAGER' ? 'primary' : 'neutral'}>{row.role}</Badge>
              </Td>
              <Td className="text-xs">{row.manager?.fullName ?? '—'}</Td>
              <Td className="whitespace-nowrap text-xs">
                <p className="font-semibold">{tenureLabel(row.joiningDate)}</p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  {row.joiningDate ? formatDisplayDate(row.joiningDate) : 'No joining date'}
                </p>
              </Td>
              <Td className="whitespace-nowrap text-xs">
                <span className="font-semibold text-[var(--color-success)]">
                  {row.monthPresent}P
                </span>
                <span className="mx-1 text-[var(--color-muted)]">/</span>
                <span className="font-semibold text-[var(--color-danger)]">
                  {row.monthAbsent}A
                </span>
                <span className="mx-1 text-[var(--color-muted)]">/</span>
                <span className="font-semibold text-[var(--color-cal-visit)]">
                  {row.monthLeave}L
                </span>
              </Td>
              <Td className="min-w-[110px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums">{row.leaveRemaining}</span>
                  <Meter
                    className="w-14"
                    value={row.leaveUsed}
                    total={row.leaveEntitled}
                    color="var(--color-primary)"
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                  {row.leaveUsed} of {row.leaveEntitled} used
                </p>
              </Td>
              <Td className="text-right">
                <Link to={`/employees/${row.id}`}>
                  <Button size="sm" variant="ghost">
                    Profile
                    <ChevronRight size={13} />
                  </Button>
                </Link>
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
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>
    </div>
  );
}
